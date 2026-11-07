/**
 * The live parts of the Healthcare suite, one script for its pages. The
 * root container carries data-hc-page, and this picks the drawing for
 * it: the clinic on a monitor and the rest of today on
 * index.html, the floor plan and check-in on
 * front-desk-and-check-in.html, the day by provider and the week on
 * appointments.html, the visit, the exam and AI notes on
 * appointment-details.html, the departments around the body
 * on providers.html, one provider's week on
 * provider-schedule.html, the chart's overview on
 * patient-chart.html, the patients list, the emergency queue
 * with triage, the wards, telehealth, supplies and claim details, and
 * the small chart band (clinic.insights) on the pages that have one.
 *
 * Everything is read from window.Basalt.data.clinic (assets/js/data/
 * clinic.js), dated Friday, October 9, 2026 at 11:20. What the pages
 * change (a patient called to a room, a visit moved, a bed freed) lives
 * in memory until the page reloads.
 */
(() => {
	'use strict';

	const root = pick('[data-hc-root]', document);
	const clinic = window.Basalt.data && window.Basalt.data.clinic;
	if (!root || !clinic) return;

	const SVG = 'http://www.w3.org/2000/svg';
	/* The working day runs 08:00 to 18:00; NOW is 11:20. */
	const NOW_MINUTES = 200;

	function start() {
		const page = root.dataset.hcPage;
		if (page === 'dashboard') drawDashboard();
		if (page === 'front-desk') startFrontDesk();
		if (page === 'appointments') startAppointments();
		if (page === 'providers') startProviders();
		if (page === 'patient-chart') startPatientChart();
		if (page === 'patients') startPatients();
		if (page === 'provider-schedule') startSchedule();
		if (page === 'supplies') startSupplies();
		if (page === 'wards') startWards();
		if (page === 'emergency') startEmergency();
		if (page === 'appointment-details') {
			drawVisitRecord('Harold Merritt');
			liveVisitVitals();
			wireExam();
			wireAiNote();
		}
		if (page === 'telehealth') wireAiNote();
		if (page === 'claim-details') wireClaimFix();
		if (page === 'telehealth') startTelehealth();
		drawInsights(page);
		paintAvatars(root);
		/* The top bar and trays sit outside the page, and name providers too. */
		wearFaces(document);
		placeRanges(root);
		wireCheckIn();
		wireBooking();
		wireSmallThings();
		/* The orders script runs after this one and draws its own lists,
		   so the entrances wait for every deferred script to have run. */
		if (document.readyState === 'complete') playEntrances(page);
		else document.addEventListener('DOMContentLoaded', () => playEntrances(page));
	}

	/* Appointment details */

	/** Record the exam: vitals flagged against normal as they are typed,
	 * and what was found. Saving updates Harold today and adds the exam to
	 * the visit's steps. */
	function wireExam() {
		const form = pick('[data-hc-exam]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		const value = (key) => Number(pick(`[data-hc-ex="${key}"]`, form).value);
		const flags = () => {
			const out = [];
			if (value('sys') >= 140 || value('dia') >= 90) out.push('Blood pressure is high');
			else if (value('sys') < 90) out.push('Blood pressure is low');
			if (value('hr') > 100) out.push('Heart rate is fast');
			else if (value('hr') < 50) out.push('Heart rate is slow');
			if (value('o2') < 94) out.push('Oxygen is low');
			if (value('temp') >= 100.4) out.push('He has a fever');
			return out;
		};
		const paint = () => {
			const found = flags();
			pick('[data-hc-ex-flags]', form).innerHTML = found.length
				? found
						.map(
							(f) =>
								`<li class="is-warn"><i aria-hidden="true" class="bi bi-exclamation-triangle"></i>${f}</li>`,
						)
						.join('')
				: '<li class="is-ok"><i aria-hidden="true" class="bi bi-check2-circle"></i>Every vital in its normal range</li>';
		};
		form.addEventListener('input', paint);
		modal.addEventListener('show.bs.modal', paint);
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const set = (key, text, unit) => {
				const cell = pick(`[data-hc-vital="${key}"]`);
				if (cell) cell.innerHTML = `${text}<small>${unit}</small>`;
			};
			set('hr', value('hr'), 'bpm');
			set('bp', `${value('sys')}/${value('dia')}`, 'mmHg');
			set('o2', value('o2'), '%');
			set('kg', value('kg'), 'lb');
			const at = clockOfMinutes(NOW_MINUTES).replace(/ (am|pm)$/, '');
			pick('[data-hc-exam-sub]').textContent = `From the exam Dr. Hayes recorded at ${at}.`;
			/* Typed in by hand, so every tile now says when, and the live ones stop. */
			const tiles = pick('[data-hc-ad-vitals]');
			if (tiles) {
				tiles.dataset.hcExamined = 'true';
				for (const mark of pickAll('.hc-live, [data-hc-vital-when]', tiles))
					mark.outerHTML = `<span data-hc-vital-when class="hc-vital-when">Taken ${at}</span>`;
			}
			const found = pick('[data-hc-ex-found]', form).value.trim();
			const plan = pick('[data-hc-ex-plan]', form).value.trim();
			const now = pick('[data-hc-steps] .is-now');
			if (now) {
				const step = document.createElement('li');
				step.className = 'is-done';
				step.innerHTML = `<span class="hc-next-time">${at}</span><span><span class="hc-who-name">Examined by Dr. Hayes</span><span class="hc-who-meta"></span></span>`;
				pick('.hc-who-meta', step).textContent = `${found}${plan ? ` Plan: ${plan}` : ''}`;
				/* Dr. Hayes has him now: the wait is over and the test is next. */
				now.replaceWith(step);
				step.nextElementSibling?.classList.add('is-now');
			}
			const warned = flags();
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			toast(
				warned.length ? 'warning' : 'success',
				'Exam saved to his record',
				warned.length
					? `${warned.join(', ')}. Dr. Pearce gets a copy of the note.`
					: 'Every vital in range. Dr. Pearce gets a copy of the note.',
			);
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.classList.remove('was-validated');
			pick('[data-hc-ex-found]', form).value = '';
			pick('[data-hc-ex-plan]', form).value = '';
		});
	}

	/* Claim details */

	/** Fix and resubmit: Resubmit unlocks once every step is ticked, and
	 * sending it moves the claim along its path. */
	function wireClaimFix() {
		const list = pick('[data-hc-cd-fix]');
		const send = pick('[data-hc-cd-send]');
		if (!list || !send) return;
		const sync = () => {
			const left = pickAll('input', list).filter((box) => !box.checked).length;
			send.disabled = left > 0;
			pick('[data-hc-cd-left]').textContent = left
				? `${left === 1 ? 'One thing' : `${left === 2 ? 'Two' : 'Three'} things`} left before it goes back.`
				: 'Ready to go back to Pacific Mutual.';
		};
		list.addEventListener('change', sync);
		sync();
		send.addEventListener('click', () => {
			const now = pick('.hc-cd-step.is-now');
			now?.classList.replace('is-now', 'is-done');
			if (now) {
				pick('.hc-cd-step-dot', now).innerHTML = '<i class="bi bi-check-lg"></i>';
				pick('.hc-cd-step-when', now).textContent = 'Oct 9';
				pick('.hc-cd-step-note', now).textContent = 'Sent with the note';
				now.nextElementSibling?.classList.replace('is-next', 'is-now');
			}
			send.disabled = true;
			send.innerHTML = '<i aria-hidden="true" class="bi bi-check2 me-1"></i>Resubmitted';
			for (const box of pickAll('input', list)) box.disabled = true;
			pick('[data-hc-cd-left]').textContent = 'Sent back on Oct 9. Pacific pays in about 34 days.';
			toast(
				'success',
				'Claim resubmitted',
				'#4483 went back to Pacific Mutual with Dr. Hayes’s note and your letter.',
			);
		});
	}

	/* Dashboard */

	/** Counts a figure up from zero; with reduced motion it just shows it. */
	function countUp(el, value) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			el.textContent = value;
			return;
		}
		const start = performance.now();
		const step = (now) => {
			const t = Math.min(1, (now - start) / 500);
			el.textContent = Math.round(value * (1 - Math.pow(1 - t, 3)));
			if (t < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	/* The director's view: the clinic on a monitor, today's figures
	   against last week, the day as a flow and the rest of today. */
	function drawDashboard() {
		const today = clinic.today;
		drawMonitor(pick('[data-hc-monitor]'));
		introWhenSeen(pick('[data-hc-monitor]'));
		for (const node of pickAll('[data-hc-fig]')) {
			const fig = today[node.dataset.hcFig];
			if (!fig) continue;
			countUp(pick('[data-hc-value]', node), fig.value);
			const diff = fig.value - fig.lastWeek;
			const lowerIsBetter = node.dataset.hcFig === 'late' || node.dataset.hcFig === 'noShows';
			const good = lowerIsBetter ? diff < 0 : diff > 0;
			const trend = pick('[data-hc-trend]', node);
			if (diff === 0) {
				trend.textContent = 'same as last week';
			} else {
				trend.className = `hc-band-trend basalt-delta ${good ? 'basalt-delta-up' : 'basalt-delta-down'}`;
				trend.innerHTML = `<i aria-hidden="true" class="bi bi-arrow-${diff > 0 ? 'up' : 'down'}-right"></i>${Math.abs(diff)} vs last week`;
			}
		}
		drawFlow(pick('[data-hc-flow]'));
		drawMoney();
		drawRestOfDay(pick('[data-hc-rest]'));
	}

	/** The rest of today by provider: visits left, the time they finish,
	 * how far behind their waiting room runs, and the open time that could
	 * still go to the waitlist. The list searches, filters and sorts like
	 * the template's other lists; a row opens the provider's afternoon in
	 * the quick view, and offering a gap texts the waitlist. */
	function drawRestOfDay(body) {
		if (!body) return;
		const waits = {};
		for (const seat of Object.values(clinic.seats)) (waits[seat.with] = waits[seat.with] || []).push(seat.minutes);
		const rows = Object.entries(clinic.lanes).map(([id, lane]) => {
			const p = clinic.provider(id);
			const ahead = lane.filter(([from, , , kind]) => from >= NOW_MINUTES && kind !== 'gone');
			const visits = ahead.filter(([, , , kind]) => kind !== 'break');
			const last = lane.at(-1);
			const gaps = [];
			/* A visit under way now holds the room until it ends. */
			let at = Math.max(
				NOW_MINUTES,
				...lane.filter(([from]) => from < NOW_MINUTES).map(([from, length]) => from + length),
			);
			for (const [from, length] of ahead) {
				if (from - at >= 20) gaps.push([at, from - at]);
				at = Math.max(at, from + length);
			}
			if (600 - at >= 20) gaps.push([at, 600 - at]);
			const list = waits[id] || [];
			const avg = list.length ? Math.round(list.reduce((s, m) => s + m, 0) / list.length) : 0;
			const open = gaps.reduce((s, g) => s + g[1], 0);
			return {
				p,
				visits,
				left: visits.length,
				done: last[0] + last[1],
				behind: Math.max(0, avg - 10),
				gaps,
				open,
			};
		});
		const table = body.closest('table');
		const search = pick('[data-hc-rest-search]');
		const show = pick('[data-hc-rest-show]');
		const count = pick('[data-hc-rest-count]');
		const state = { query: '', show: 'all', sort: 'name', asc: true, shown: rows };
		const keys = {
			name: (r) => r.p.name.split(' ').pop(),
			left: (r) => r.left,
			done: (r) => r.done,
			behind: (r) => r.behind,
			open: (r) => r.open,
		};
		const offered = new Set();

		function paint() {
			const fits = (r) =>
				window.Basalt.matchesQuery(`${r.p.name} ${r.p.role} Room ${r.p.room}`, state.query) &&
				(state.show === 'all' || (state.show === 'behind' ? r.behind > 0 : r.open > 0));
			const key = keys[state.sort];
			state.shown = rows
				.filter(fits)
				.sort((x, y) => (key(x) > key(y) ? 1 : key(x) < key(y) ? -1 : 0) * (state.asc ? 1 : -1));
			body.innerHTML = state.shown.length
				? state.shown.map(restRow).join('')
				: `<tr class="basalt-empty-row"><td colspan="6">${window.Basalt.emptyState({ query: state.query, noun: 'providers', title: state.query ? '' : 'Nobody fits that filter', text: state.query ? '' : 'Everyone is on time and fully booked.' })}</td></tr>`;
			count.textContent = `${state.shown.length} of ${rows.length} providers`;
			paintAvatars(body);
			if (window.Basalt.tips) window.Basalt.tips(body);
		}

		function restRow(r, at) {
			const gap = r.gaps[0];
			const name = r.p.name;
			const button = gap
				? offered.has(r.p.id)
					? '<button type="button" class="btn btn-outline-secondary btn-sm" disabled>Offered</button>'
					: `<button data-hc-offer="${r.p.id}" data-hc-offer-at="${gap[0]}" type="button" class="btn btn-outline-secondary btn-sm">Offer to waitlist</button>`
				: '';
			return `<tr data-hc-rest-row="${at}">
				<td>${personLink(name, 'provider-schedule.html')}<span class="hc-rest-room">${r.p.role} · Room ${r.p.room}</span></td>
				<td class="hc-num hc-rest-left">${r.left}</td>
				<td class="hc-rest-done">${clockOfMinutes(r.done)}</td>
				<td class="hc-rest-run"><span class="hc-pill ${r.behind ? 'hc-pill-late' : 'hc-pill-ok'}">${r.behind ? `${r.behind} min behind` : 'On time'}</span></td>
				<td class="hc-rest-open">${gap ? `${r.open} min, first at ${clockOfMinutes(gap[0])}` : '<span class="hc-rest-none">Fully booked</span>'}</td>
				<td><div class="hc-rest-acts">${button}<div class="basalt-row-actions"><button data-hc-rest-peek="${at}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view" aria-label="Quick view: ${name}" type="button" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-layout-sidebar-inset-reverse"></i></button><a href="provider-schedule.html" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page" aria-label="Open full page: ${name}" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-arrows-angle-expand"></i></a></div></div></td>
			</tr>`;
		}

		/** The provider's afternoon for the quick view. */
		function peekOf(r) {
			const gap = r.gaps[0];
			const next = r.visits.slice(0, 4);
			return {
				name: r.p.name,
				sub: `${r.p.role} · Room ${r.p.room}`,
				href: 'provider-schedule.html',
				lead: r.behind ? `The waiting room runs ${r.behind} minutes behind.` : '',
				facts: [
					['Visits left', String(r.left)],
					['Done by', clockOfMinutes(r.done)],
					['Running', r.behind ? `${r.behind} min behind` : 'On time'],
					['Open time', gap ? `${r.open} min, first at ${clockOfMinutes(gap[0])}` : 'Fully booked'],
				],
				listTitle: 'Still to see',
				list: next.map(
					([from, , label]) => `<span class="hc-peek-when">${clockOfMinutes(from)}</span>${label}`,
				),
				more: r.visits.length > next.length ? `${r.visits.length - next.length} more on the schedule` : '',
				action:
					gap && !offered.has(r.p.id)
						? { label: 'Offer to waitlist', run: () => offer(r.p.id, gap[0]) }
						: null,
			};
		}

		function offer(id, at) {
			offered.add(id);
			paint();
			toast(
				'success',
				'Offered to the waitlist',
				`Three waitlisted patients got a text for ${clockOfMinutes(at)} with ${clinic.provider(id).name}. The first to reply gets it.`,
			);
		}

		search.addEventListener('input', () => {
			state.query = search.value.trim();
			paint();
		});
		show.addEventListener('change', () => {
			state.show = show.value;
			paint();
			wave(table, pickAll('tbody tr:not(.basalt-empty-row)', table));
		});
		sortHeads(table, state, () => {
			paint();
			wave(table, pickAll('tbody tr:not(.basalt-empty-row)', table));
		});
		body.addEventListener('click', (event) => {
			const button = event.target.closest('[data-hc-offer]');
			if (button) {
				offer(button.dataset.hcOffer, Number(button.dataset.hcOfferAt));
				return;
			}
			const peekButton = event.target.closest('[data-hc-rest-peek]');
			const row = event.target.closest('[data-hc-rest-row]');
			if (!peekButton && (!row || event.target.closest('a, button'))) return;
			const at = Number((peekButton || row).dataset[peekButton ? 'hcRestPeek' : 'hcRestRow']);
			openPeek(
				state.shown.map((r) => () => peekOf(r)),
				at,
			);
		});
		paint();

		const late = rows.filter((r) => r.behind).sort((x, y) => y.behind - x.behind);
		const open = rows.reduce((s, r) => s + r.open, 0);
		pick('[data-hc-rest-sub]').textContent =
			`${rows.reduce((s, r) => s + r.left, 0)} visits left across ${rows.length} rooms after ${clockOfMinutes(NOW_MINUTES)}.`;
		pick('[data-hc-rest-foot]').textContent = late.length
			? `${late[0].p.name} runs ${late[0].behind} minutes behind; ${open} open minutes could take the overflow.`
			: `Everyone is on time; ${open} open minutes left.`;
	}

	/** Right now as one picture: today's patients flowing through the
	 * building, from the door through the waiting room and the exam rooms
	 * to the lab, home or the infusion chairs. Each stop carries its count, each band
	 * is one thickness, and the dots are people moving.
	 * Used on the Dashboard and on the Front Desk. */
	function drawFlow(host) {
		if (!host) return;
		const seats = Object.values(clinic.seats);
		const busyRooms = clinic.rooms.filter((r) => r.state === 'busy');
		const chairsTaken = clinic.chairs.filter(
			(b) => b.state === 'taken' || b.state === 'watch' || b.state === 'home',
		).length;
		const freeingUp = clinic.chairs.filter((b) => b.state === 'home').length;
		const inToday = clinic.today.providersIn;
		const W = 1160;
		const H = 340;
		host.innerHTML = '';
		const art = svgNode('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', class: 'hc-flow-art' }, host);
		art.setAttribute(
			'aria-label',
			`Today's patients through the building: 86 booked, 41 checked in, ${seats.length} waiting, ${busyRooms.length} in exam rooms, 7 results and 5 renewals at the lab and pharmacy, 31 gone home, ${chairsTaken} in the infusion chairs.`,
		);

		/* The stops: a card each with a label, a figure and one quiet line. */
		const stops = {
			door: {
				x: 20,
				y: 130,
				w: 160,
				label: 'Through the door',
				figure: '41',
				unit: 'of 86 booked',
				line: '2 did not come',
				href: 'appointments.html',
			},
			wait: {
				x: 260,
				y: 130,
				w: 180,
				label: 'Waiting room',
				figure: String(seats.length),
				unit: 'in a chair',
				line: `longest ${clinic.today.longestWait} min`,
				href: 'front-desk-and-check-in.html',
			},
			rooms: {
				x: 520,
				y: 130,
				w: 200,
				label: 'Exam rooms',
				figure: String(busyRooms.length),
				unit: `of ${clinic.rooms.length} in use`,
				line: `${inToday[0]} of ${inToday[1]} providers in`,
				href: 'providers.html',
			},
			lab: {
				x: 800,
				y: 20,
				w: 150,
				label: 'Lab & pharmacy',
				figure: '7',
				unit: 'results to sign',
				line: '5 renewals waiting',
				href: 'lab-orders-and-results.html',
			},
			home: {
				x: 1020,
				y: 130,
				w: 120,
				label: 'Home',
				figure: '31',
				unit: 'seen today',
				line: 'avg 24 min visit',
				href: 'patients.html',
			},
			ward: {
				x: 800,
				y: 240,
				w: 150,
				label: 'Infusion chairs',
				figure: String(chairsTaken),
				unit: `of ${clinic.chairs.length} chairs`,
				line: `${freeingUp} going home now`,
				href: 'front-desk-and-check-in.html',
			},
		};
		const right = (s) => ({ x: s.x + s.w, y: s.y + 40 });
		const left = (s) => ({ x: s.x, y: s.y + 40 });

		/* The bands between stops, all one thickness; the dots on them show
		   how many people move along each one. */
		const bands = [
			['door', 'wait', 41, 'var(--basalt-series-2)'],
			['wait', 'rooms', 37, 'var(--basalt-hue)'],
			['rooms', 'lab', 12, 'var(--basalt-series-7)'],
			['rooms', 'home', 29, 'var(--basalt-success)'],
			['lab', 'home', 10, 'var(--basalt-series-7)'],
			['rooms', 'ward', 2, 'var(--basalt-series-4)'],
		];
		const lanes = svgNode('g', { class: 'lanes' }, art);
		const dots = svgNode('g', { class: 'dots' }, art);
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		bands.forEach(([from, to, people, tone], i) => {
			const a = right(stops[from]);
			const b = left(stops[to]);
			const mid = (a.x + b.x) / 2;
			const d = `M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;
			svgNode('path', { d, class: 'lane', style: `--tone: ${tone}` }, lanes);
			if (reduced) return;
			/* Calm on purpose: few dots, slow and at an even pace along the
			   curve, each fading in where its lane starts and out where it ends,
			   so nothing jumps or races. */
			const count = Math.max(1, Math.min(3, Math.round(people / 12)));
			const dur = 15 + i * 1.2;
			for (let k = 0; k < count; k += 1) {
				const dot = svgNode('circle', { r: 4, class: 'dot', style: `--tone: ${tone}` }, dots);
				const begin = `-${((k / count) * dur).toFixed(2)}s`;
				svgNode(
					'animateMotion',
					{ dur: `${dur}s`, begin, repeatCount: 'indefinite', path: d, calcMode: 'paced' },
					dot,
				);
				svgNode(
					'animate',
					{
						attributeName: 'opacity',
						values: '0;1;1;0',
						keyTimes: '0;0.12;0.88;1',
						dur: `${dur}s`,
						begin,
						repeatCount: 'indefinite',
					},
					dot,
				);
			}
		});

		/* The stops, on top of the bands, each a link to its page. */
		for (const [key, s] of Object.entries(stops)) {
			const link = svgNode('a', { href: s.href, class: `stop stop-${key}` }, art);
			link.setAttribute('aria-label', `${s.label}: ${s.figure} ${s.unit}, ${s.line}`);
			svgNode('rect', { x: s.x, y: s.y, width: s.w, height: 80, rx: 12, class: 'stop-box' }, link);
			svgText(link, s.x + 14, s.y + 22, 'stop-label', s.label);
			svgText(link, s.x + 14, s.y + 52, 'stop-figure', s.figure);
			svgText(link, s.x + 14 + s.figure.length * 15 + 6, s.y + 52, 'stop-unit', s.unit);
			svgText(link, s.x + 14, s.y + 70, 'stop-line', s.line);
		}

		/* Under the stops: a dot per chair, a square per room, a bed per bed. */
		const wait = stops.wait;
		for (let i = 0; i < 24; i += 1) {
			const seat = clinic.seats[i];
			const cls = seat ? (seat.minutes >= 20 ? 'is-late' : seat.minutes >= 10 ? 'is-long' : 'is-taken') : '';
			svgNode(
				'circle',
				{
					cx: wait.x + 16 + (i % 12) * 13.5,
					cy: wait.y + 98 + Math.floor(i / 12) * 14,
					r: 4.5,
					class: `chair ${cls}`,
				},
				art,
			);
		}
		const rooms = stops.rooms;
		clinic.rooms.forEach((room, i) => {
			/* Big enough to read whose room it is at a glance. */
			const x = rooms.x + 6 + i * 26;
			svgNode(
				'rect',
				{ x, y: rooms.y + 92, width: 23, height: 23, rx: 6, class: `roomlet is-${room.state}` },
				art,
			);
			if (room.state === 'busy')
				svgText(art, x + 11.5, rooms.y + 107.5, 'roomlet-who', room.who.toUpperCase(), {
					'text-anchor': 'middle',
				});
		});
		const ward = stops.ward;
		clinic.chairs.forEach((bed, i) => {
			svgNode(
				'rect',
				{
					x: ward.x + 12 + (i % 6) * 22,
					y: ward.y - 18 + Math.floor(i / 6) * 12,
					width: 17,
					height: 9,
					rx: 3,
					class: `bedlet is-${bed.state}`,
				},
				art,
			);
		});
	}

	/** The week's money: the figures beside a chart of billed against
	 * collected over the last eight weeks. */
	function drawMoney() {
		const money = pick('[data-hc-money]');
		if (!money) return;
		const m = clinic.today.money;
		const k = (n) => `$${(n / 1000).toFixed(1)}k`;
		money.innerHTML = `
			<dl class="hc-money-figs">
				<div><dt>Billed</dt><dd>${k(m.billed)}</dd></div>
				<div><dt>Collected</dt><dd>${k(m.collected)}<small>${Math.round((m.collected / m.billed) * 100)}%</small></dd></div>
				<div><dt>Still to come</dt><dd>${k(m.billed - m.collected)}</dd></div>
				<div><dt>Outstanding, all time</dt><dd>${k(m.outstanding)}</dd></div>
				<div><dt>Claims over 30 days</dt><dd>${m.claimsOver30}<small>$5.9k</small></dd></div>
			</dl>
			<div class="hc-money-chart"><canvas data-hc-money-chart role="img" aria-label="Billed and collected per week for the last eight weeks: collected has climbed from 34 to 42 thousand dollars"></canvas></div>`;
		const canvas = pick('[data-hc-money-chart]', money);
		const spec = {
			kind: 'bars',
			title: 'Money',
			labels: m.weeks,
			series: [
				{ name: 'Billed', data: m.billedWeeks },
				{ name: 'Collected', data: m.collectedWeeks },
			],
			unit: 'k',
		};
		const draw = () => insightChart(canvas, spec);
		charts.push({ draw, chart: draw() });
	}

	/** Four traces across the working day, drawn from the lanes and the
	 * monitor series: arrivals as a beat per check-in, the average wait,
	 * rooms in use and infusion chairs taken. Solid up to now, faint for what is
	 * booked after it. */
	function drawMonitor(host) {
		if (!host) return;
		const BINS = 40;
		const nowBin = NOW_MINUTES / 15;
		const arrivals = new Array(BINS).fill(0);
		const rooms = new Array(BINS).fill(0);
		let booked = 0;
		let checkedIn = 0;
		for (const visits of Object.values(clinic.lanes)) {
			for (const [from, length, , kind] of visits) {
				if (kind === 'break') continue;
				booked += 1;
				const first = Math.floor(from / 15);
				if (kind === 'gone' && first < nowBin) continue;
				arrivals[first] += 1;
				if (from - NOW_MINUTES <= 20 && kind !== 'gone') checkedIn += 1;
				for (let b = first; b < Math.min(BINS, Math.ceil((from + length) / 15)); b += 1) rooms[b] += 1;
			}
		}
		const beds = [];
		for (let b = 0; b < BINS; b += 1) {
			beds.push(b < clinic.monitor.beds.until ? clinic.monitor.beds.before : clinic.monitor.beds.after);
		}
		const waits = clinic.monitor.waits;

		const traces = [
			{
				name: 'Arrivals',
				sub: 'a beat per check-in',
				tone: 'var(--basalt-success)',
				kind: 'beats',
				series: arrivals,
				top: 6,
				read: String(checkedIn),
				unit: `checked in of ${booked} booked`,
			},
			{
				name: 'Waiting',
				sub: 'average minutes in a chair',
				tone: 'var(--basalt-warning)',
				kind: 'line',
				series: waits,
				top: 30,
				read: String(waits[waits.length - 1]),
				unit: `min now · longest ${clinic.today.longestWait}`,
			},
			{
				name: 'Rooms',
				sub: 'exam rooms in use',
				tone: 'var(--basalt-hue)',
				kind: 'steps',
				series: rooms,
				top: 8,
				read: String(rooms[Math.floor(nowBin)]),
				unit: `of ${clinic.rooms.length} in use`,
			},
			{
				name: 'Chairs',
				sub: 'infusion and observation',
				tone: 'var(--basalt-series-4)',
				kind: 'steps',
				series: beds,
				top: 12,
				read: String(beds[Math.floor(nowBin)]),
				unit: `of ${clinic.chairs.length} taken`,
			},
		];

		const W = 1000;
		const H = 100;
		const x = (bin) => (bin / BINS) * W;
		const y = (value, top) => 88 - (value / top) * 72;
		function beats(series, top, fromBin, toBin) {
			let d = `M${x(fromBin).toFixed(1)},88`;
			for (let b = fromBin; b < toBin; b += 1) {
				const cx = x(b + 0.5);
				if (!series[b]) {
					d += ` L${(cx + 10).toFixed(1)},88`;
					continue;
				}
				const peak = y(series[b], top);
				d += ` L${(cx - 7).toFixed(1)},88 L${(cx - 4).toFixed(1)},92 L${cx.toFixed(1)},${peak.toFixed(1)} L${(cx + 4).toFixed(1)},95 L${(cx + 7).toFixed(1)},88`;
			}
			return d;
		}
		function line(series, top, fromBin, toBin) {
			const points = [];
			for (let b = fromBin; b < Math.min(toBin, series.length); b += 1) {
				points.push(`${x(b + 0.5).toFixed(1)},${y(series[b], top).toFixed(1)}`);
			}
			return points.length ? `M${points.join(' L')}` : '';
		}
		function steps(series, top, fromBin, toBin) {
			let d = '';
			for (let b = fromBin; b < toBin; b += 1) {
				const yy = y(series[b], top).toFixed(1);
				d += `${d ? ' L' : 'M'}${x(b).toFixed(1)},${yy} L${x(b + 1).toFixed(1)},${yy}`;
			}
			return d;
		}
		const shapes = { beats, line, steps };

		/* The first drawing traces itself in, a row after the other, and
		   waits on its first frame until introWhenSeen() lets it go; a later
		   redraw lands finished. */
		const first = !('hcDrawn' in host.dataset);
		host.dataset.hcDrawn = '';
		host.classList.toggle('is-drawing-in', first);
		host.classList.toggle('is-waiting', first);
		host.innerHTML = '';
		traces.forEach((t, i) => {
			const row = document.createElement('div');
			row.className = 'hc-trace';
			row.style.setProperty('--tone', t.tone);
			row.style.setProperty('--row', i);
			row.innerHTML = `
				<div class="hc-trace-label"><span class="hc-trace-name">${t.name}</span><span class="hc-trace-sub">${t.sub}</span></div>
				<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${t.name}: ${t.read} ${t.unit}" class="hc-trace-art"></svg>
				<div class="hc-trace-read"><strong>${t.read}</strong><small>${t.unit}</small></div>`;
			const art = pick('svg', row);
			for (let h = 2; h < 10; h += 2)
				svgNode('line', { x1: x(h * 4), y1: 0, x2: x(h * 4), y2: H, class: 'grid' }, art);
			for (const gy of [26, 52]) svgNode('line', { x1: 0, y1: gy, x2: W, y2: gy, class: 'grid' }, art);
			row.trace = t;
			const cut = Math.ceil(nowBin);
			svgNode('path', { d: shapes[t.kind](t.series, t.top, 0, cut), class: 'past' }, art);
			if (t.series.length > cut)
				svgNode('path', { d: shapes[t.kind](t.series, t.top, cut, BINS), class: 'future' }, art);
			svgNode('line', { x1: x(nowBin), y1: 0, x2: x(nowBin), y2: H, class: 'now' }, art);
			const last = t.kind === 'beats' ? 88 : y(t.series[Math.min(t.series.length, cut) - 1], t.top);
			svgNode('circle', { cx: x(nowBin), cy: last, r: 4, class: 'dot' }, art);
			svgNode('line', { x1: 0, y1: 0, x2: 0, y2: H, class: 'cursor' }, art);
			host.appendChild(row);
		});

		/* Hovering the traces, or dragging a finger along them: a cursor
		   across all four and each readout turns into the value at that
		   quarter hour, then back to now. A finger moving up or down still
		   scrolls the page (touch-action: pan-y in the stylesheet). */
		const rows = pickAll('.hc-trace', host);
		const reads = rows.map((row) => pick('.hc-trace-read', row));
		const live = reads.map((r) => r.innerHTML);
		const clockAt = (bin) => {
			const mins = 480 + bin * 15;
			return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
		};
		const wording = {
			Arrivals: (v, bin) => [
				`${v}`,
				`${v === 1 ? 'check-in' : 'check-ins'} ${bin < nowBin ? 'at' : 'booked for'} ${clockAt(bin)}`,
			],
			Waiting: (v, bin) => [`${v}`, `min average at ${clockAt(bin)}`],
			Rooms: (v, bin) => [
				`${v}`,
				`of ${clinic.rooms.length} ${bin < nowBin ? 'in use' : 'booked'} at ${clockAt(bin)}`,
			],
			Chairs: (v, bin) => [`${v}`, `of ${clinic.chairs.length} taken at ${clockAt(bin)}`],
		};
		function leave() {
			rows.forEach((row, i) => {
				row.classList.remove('is-hover');
				reads[i].innerHTML = live[i];
			});
		}
		function readAt(event) {
			const first = rows[0] && pick('svg', rows[0]);
			if (!first) return;
			const box = first.getBoundingClientRect();
			const share = (event.clientX - box.left) / box.width;
			if (share < 0 || share > 1) {
				leave();
				return;
			}
			const bin = Math.min(BINS - 1, Math.floor(share * BINS));
			const px = x(bin + 0.5);
			rows.forEach((row, i) => {
				const line = pick('.cursor', row);
				line.setAttribute('x1', px);
				line.setAttribute('x2', px);
				row.classList.add('is-hover');
				const t = row.trace;
				const value = t.series[bin];
				if (value === undefined) {
					reads[i].innerHTML = `<strong>–</strong><small>no reading yet for ${clockAt(bin)}</small>`;
					return;
				}
				const [big, small] = wording[t.name](value, bin);
				reads[i].innerHTML = `<strong>${big}</strong><small>${small}</small>`;
			});
		}
		host.addEventListener('pointerdown', readAt);
		host.addEventListener('pointermove', readAt);
		host.addEventListener('pointerleave', leave);
		host.addEventListener('pointercancel', leave);
		const scale = document.createElement('div');
		scale.className = 'hc-trace-scale';
		scale.setAttribute('aria-hidden', 'true');
		for (let h = 0; h <= 10; h += 2) {
			const mark = document.createElement('span');
			mark.style.left = `${(h / 10) * 100}%`;
			mark.textContent = `${8 + h}:00`;
			scale.appendChild(mark);
		}
		host.appendChild(scale);
	}

	/* Front desk */

	/* The front desk works from the floor plan: every room, chair and
	   infusion chair opens a dialog with what the desk can do about it.
	   Wards & Beds uses the same dialog for Mission Bay Hospital's beds.
	   The state below starts from the data and changes as they act. */
	const desk = {
		rooms: clinic.rooms.map((r) => ({ ...r })),
		seats: Object.fromEntries(Object.entries(clinic.seats).map(([i, s]) => [i, { ...s }])),
		beds: clinic.beds.map((b) => ({ ...b })),
		chairs: clinic.chairs.map((b) => ({ ...b })),
	};
	/* How a bed and an infusion chair are spoken of in the dialog. */
	const PLACE = {
		bed: { list: 'beds', word: 'Bed', doctor: 'Doctor', out: 'Discharge', gone: 'discharged from' },
		chair: { list: 'chairs', word: 'Chair', doctor: 'Ordered by', out: 'Done, send home', gone: 'sent home from' },
	};

	function startFrontDesk() {
		const art = pick('[data-hc-floor]');
		if (!art) return;
		paintFrontDesk();
		drawWaitChart();
		drawNextUp(pick('[data-hc-next]'));
		art.addEventListener('click', (event) => {
			const spot = event.target.closest('[data-hc-spot]');
			if (spot) openSpot(spot.dataset.hcSpot);
		});
		art.addEventListener('keydown', (event) => {
			const spot = event.target.closest('[data-hc-spot]');
			if (!spot || (event.key !== 'Enter' && event.key !== ' ')) return;
			event.preventDefault();
			openSpot(spot.dataset.hcSpot);
		});
		const dialog = pick('[data-hc-spot-dialog]', document);
		if (dialog) {
			dialog.addEventListener('click', (event) => {
				const button = event.target.closest('[data-hc-act]');
				if (button) act(button.dataset.hcAct, button.dataset.hcArg);
			});
		}
	}

	/** Who is backing up: the average wait in a chair by the provider
	 * people are waiting for, redrawn as the desk moves people. */
	function drawWaitChart() {
		const canvas = pick('[data-hc-wait-chart]');
		if (!canvas || !window.Chart) return;
		const byProvider = {};
		for (const seat of Object.values(desk.seats)) {
			byProvider[seat.with] = byProvider[seat.with] || [];
			byProvider[seat.with].push(seat.minutes);
		}
		const rows = clinic.providers
			.filter((p) => p.room)
			.map((p) => ({
				name: p.name,
				avg: byProvider[p.id]
					? Math.round(byProvider[p.id].reduce((s, m) => s + m, 0) / byProvider[p.id].length)
					: 0,
			}))
			.sort((x, y) => y.avg - x.avg);
		const spec = {
			kind: 'hbar',
			title: 'Waiting',
			labels: rows.map((r) => r.name),
			series: [{ name: 'Minutes waiting', data: rows.map((r) => r.avg) }],
			/* Over the ten-minute target in the danger color, the rest in the accent. */
			colors: rows.map((r) => (r.avg > 10 ? 'danger' : 'hue')),
			unit: ' min',
		};
		const old = charts.find((entry) => entry.canvas === canvas);
		if (old && old.chart) old.chart.destroy();
		const draw = () => insightChart(canvas, spec);
		if (old) old.chart = draw();
		else charts.push({ canvas, draw, chart: draw() });
	}

	/** Redraws the floor plan, the facts beside it and the longest waits. */
	function paintFrontDesk() {
		const art = pick('[data-hc-floor]');
		art.innerHTML = '';
		drawFloor(art);
		const taken = Object.values(desk.seats);
		const busy = desk.rooms.filter((r) => r.state === 'busy').length;
		const chairsTaken = desk.chairs.filter(
			(b) => b.state === 'taken' || b.state === 'watch' || b.state === 'home',
		).length;
		const avg = taken.length ? Math.round(taken.reduce((sum, s) => sum + s.minutes, 0) / taken.length) : 0;
		setFact('building', `${taken.length + busy + chairsTaken + 7}`, 'patients');
		setFact('waiting', String(taken.length), taken.length ? `avg ${avg} min` : 'nobody waiting');
		setFact('rooms', String(busy), `of ${desk.rooms.length}`, (busy / desk.rooms.length) * 100);
		setFact('beds', String(chairsTaken), `of ${desk.chairs.length}`, (chairsTaken / desk.chairs.length) * 100);
		const waits = pick('[data-hc-waits]');
		if (waits) {
			const longest = [...taken].sort((a, b) => b.minutes - a.minutes).slice(0, 3);
			waits.innerHTML = longest.length
				? longest
						.map(
							(w) => `
						<li>
							${avatar(w.name, 'sm')}
							<span><a href="patient-chart.html" class="hc-waits-name">${w.name}</a><span class="hc-waits-meta">${clinic.short(w.with)} · ${w.why}</span></span>
							<span class="hc-waits-time ${w.minutes >= 20 ? 'is-late' : w.minutes >= 10 ? 'is-long' : ''}">${w.minutes} min</span>
						</li>`,
						)
						.join('')
				: '<li><span class="hc-waits-meta">Nobody is waiting.</span></li>';
			paintAvatars(waits);
		}
	}

	function setFact(key, value, meta, share) {
		const node = pick(`[data-hc-fact="${key}"]`);
		if (!node) return;
		pick('[data-hc-fact-value]', node).innerHTML = `${value} <small>${meta}</small>`;
		const bar = pick('.hc-fact-bar span', node);
		if (bar && share !== undefined) bar.style.setProperty('--share', `${Math.round(share)}%`);
	}

	/** Draws the clinic as seen from above into an empty SVG: the exam
	 * rooms along the corridor, the waiting area chair by chair, the lab
	 * and pharmacy, and the infusion room chair by chair. Every room and
	 * chair is a button for the front desk. */
	function drawFloor(art) {
		svgNode('rect', { x: 16, y: 84, width: 496, height: 26, rx: 4, class: 'thorne' }, art);
		svgText(art, 264, 101, 'room-name', 'Corridor · front desk at the left end', { 'text-anchor': 'middle' });

		desk.rooms.forEach((room, i) => {
			const x = 16 + i * 62;
			const group = spotNode(art, `room:${room.id}`, roomSpoken(room));
			svgNode('rect', { x, y: 16, width: 56, height: 60, class: `room is-${room.state}` }, group);
			svgText(group, x + 8, 30, `room-name${room.state === 'busy' ? ' on-busy' : ''}`, room.id);
			if (room.state === 'busy') {
				svgText(group, x + 8, 52, 'room-who', room.who.toUpperCase());
				svgText(group, x + 8, 66, 'room-since', `${room.since} min`);
			} else {
				svgText(group, x + 8, 58, 'room-free', room.state === 'free' ? 'Free' : 'Cleaning');
			}
		});

		/* A room running over time rings out on a layer of its own, over the
		   rooms beside it and the card's edge rather than under them. */
		desk.rooms.forEach((room, i) => {
			if (room.state === 'busy' && room.since >= 30)
				svgNode('rect', { x: 16 + i * 62, y: 16, width: 56, height: 60, rx: 6, class: 'pulse' }, art);
		});

		svgNode('rect', { x: 16, y: 118, width: 198, height: 166, class: 'room is-zone' }, art);
		svgText(art, 28, 136, 'room-name', 'Waiting area');
		for (let i = 0; i < 24; i += 1) {
			const cx = 40 + (i % 6) * 30;
			const cy = 160 + Math.floor(i / 6) * 34;
			const seat = desk.seats[i];
			let cls = 'seat';
			if (seat) cls += seat.minutes >= 20 ? ' is-late' : seat.minutes >= 10 ? ' is-long' : ' is-taken';
			const group = spotNode(
				art,
				`seat:${i}`,
				seat ? `Chair ${i + 1}: ${seat.name}, waiting ${seat.minutes} minutes` : `Chair ${i + 1}: empty`,
			);
			svgNode('circle', { cx, cy, r: 7, class: cls }, group);
		}

		/* The waiting area keeps only the width its chairs need, so the lab
		   and pharmacy have room for their lines on one row. */
		svgNode('rect', { x: 224, y: 118, width: 102, height: 76, class: 'room' }, art);
		svgText(art, 234, 136, 'room-name', 'Lab');
		svgText(art, 234, 162, 'room-free', `${clinic.results.length + 2} results to sign`);
		svgNode('rect', { x: 224, y: 206, width: 102, height: 78, class: 'room' }, art);
		svgText(art, 234, 224, 'room-name', 'Pharmacy');
		svgText(art, 234, 250, 'room-free', '5 renewals waiting');

		svgNode('rect', { x: 336, y: 118, width: 176, height: 166, class: 'room is-zone' }, art);
		svgText(art, 348, 136, 'room-name', `Infusion · ${desk.chairs.length} chairs`);
		desk.chairs.forEach((bed, i) => {
			const x = 350 + (i % 4) * 40;
			const y = 146 + Math.floor(i / 4) * 44;
			const taken = bed.state === 'taken' || bed.state === 'watch' || bed.state === 'home';
			const group = spotNode(
				art,
				`chair:${bed.id}`,
				`${bed.id}: ${bed.patient ? `${bed.patient}, ` : ''}${bed.note}`,
			);
			svgNode('rect', { x, y, width: 30, height: 34, class: `bed is-${taken ? 'taken' : bed.state}` }, group);
			if (taken) svgText(group, x + 15, y + 21, 'room-who', bed.id, { 'text-anchor': 'middle' });
		});
	}

	function spotNode(art, key, spoken) {
		const group = svgNode('g', { 'data-hc-spot': key, role: 'button', tabindex: '0', class: 'spot' }, art);
		group.setAttribute('aria-label', spoken);
		const title = svgNode('title', {}, group);
		title.textContent = spoken;
		return group;
	}

	function roomSpoken(room) {
		if (room.state === 'busy')
			return `${room.id}: ${clinic.short(room.who)} with ${room.patient} for ${room.since} minutes`;
		return `${room.id}: ${room.state === 'free' ? 'free' : 'being cleaned'}`;
	}

	/** Fills and opens the dialog for one room, waiting chair, infusion chair or bed. */
	function openSpot(key) {
		const dialog = pick('[data-hc-spot-dialog]', document);
		if (!dialog || !window.bootstrap) return;
		const [kind, id] = key.split(':');
		const title = pick('[data-hc-spot-title]', dialog);
		const sub = pick('[data-hc-spot-sub]', dialog);
		const facts = pick('[data-hc-spot-facts]', dialog);
		const actions = pick('[data-hc-spot-actions]', dialog);
		const freeRooms = desk.rooms.filter((r) => r.state === 'free');
		let rows;
		let buttons;

		if (kind === 'seat') {
			const seat = desk.seats[id];
			if (seat) {
				title.textContent = seat.name;
				sub.textContent = `Chair ${Number(id) + 1} · waiting ${seat.minutes} minutes`;
				rows = [
					['Patient', chartLink(seat.name)],
					['Seeing', providerLink(seat.with)],
					[
						'Appointment',
						`<a href="appointment-details.html">${seat.why}, booked for ${minutesAgo(seat.minutes - 5)}</a>`,
					],
					['Checked in', minutesAgo(seat.minutes)],
				];
				buttons = freeRooms.map((r) => ({
					act: 'call',
					arg: `${id}:${r.id}`,
					label: `Call to ${r.id}`,
					primary: true,
				}));
				if (!freeRooms.length)
					rows.push(['Rooms', 'None free. E5 is being cleaned and is free in about five minutes.']);
				buttons.push(
					{ act: 'text', arg: id, label: 'Send a text' },
					{ act: 'left', arg: id, label: 'Mark as left' },
				);
			} else {
				title.textContent = `Chair ${Number(id) + 1}`;
				sub.textContent = 'Empty';
				rows = [['Waiting area', `${Object.keys(desk.seats).length} of 24 chairs taken`]];
				buttons = [{ act: 'checkin', label: 'Check someone in', primary: true }];
			}
		} else if (kind === 'room') {
			const room = desk.rooms.find((r) => r.id === id);
			title.textContent = `Room ${room.id}`;
			if (room.state === 'busy') {
				const who = clinic.provider(room.who);
				sub.textContent = `${who.name} with ${room.patient} · ${room.since} min`;
				rows = [
					['Patient', chartLink(room.patient)],
					['Provider', providerLink(room.who)],
					[
						'Appointment',
						`<a href="appointment-details.html">Started ${minutesAgo(room.since)}, ${room.since} minutes in</a>`,
					],
				];
				const next = clinic.nextUp.find((n) => n.room === room.id);
				if (next) rows.push(['Next here', `${chartLink(next.name)} at ${next.at}`]);
				if (room.since >= 30) rows.push(['Target', 'Thirty minutes, so this visit is running over.']);
				buttons = [
					{ act: 'done', arg: id, label: 'Visit done', primary: true },
					{ act: 'hand', arg: id, label: 'Send a nurse' },
				];
			} else if (room.state === 'clean') {
				sub.textContent = 'Being cleaned';
				rows = [['Free in', 'About five minutes']];
				buttons = [{ act: 'cleaned', arg: id, label: 'Cleaning done', primary: true }];
			} else {
				sub.textContent = 'Free';
				const longest = longestWait();
				rows = longest
					? [
							[
								'Longest wait',
								`${longest.name}, ${longest.minutes} minutes for ${clinic.short(longest.with)}`,
							],
						]
					: [['Waiting area', 'Nobody is waiting.']];
				buttons = longest
					? [
							{
								act: 'call',
								arg: `${longest.index}:${id}`,
								label: `Call ${longest.name.split(' ')[0]} here`,
								primary: true,
							},
						]
					: [];
			}
		} else {
			const place = PLACE[kind];
			const bed = desk[place.list].find((b) => b.id === id);
			const arg = `${kind}:${id}`;
			title.textContent = `${place.word} ${bed.id}`;
			sub.textContent = bed.patient ? `${bed.patient} · ${bed.note}` : bed.note;
			if (bed.state === 'taken' || bed.state === 'watch' || bed.state === 'home') {
				const chair = kind === 'chair';
				rows = [
					['Patient', chartLink(bed.patient)],
					[place.doctor, providerLink(bed.with)],
					['In for', bed.why],
					[
						'Status',
						bed.state === 'watch'
							? `Under watch since ${chair ? '11:05' : '09:40'}`
							: bed.state === 'home'
								? chair
									? 'Done, ready to go home'
									: 'Going home today'
								: chair
									? `${bed.note}, done at ${bed.home}`
									: `${bed.note}, home ${bed.home}`,
					],
					['Last check', bed.check],
				];
				buttons = [
					{
						act: 'discharge',
						arg,
						label: bed.state === 'home' && !chair ? 'Discharge now' : place.out,
						primary: true,
					},
					{ act: 'note', arg, label: 'Add a note' },
				];
			} else if (bed.state === 'clean') {
				rows = [['Housekeeping', 'Being cleaned']];
				buttons = [{ act: 'made', arg, label: kind === 'chair' ? 'Chair cleaned' : 'Bed made', primary: true }];
			} else {
				rows = [['Status', 'Free and clean']];
				buttons =
					kind === 'chair'
						? [{ act: 'checkin', label: 'Check someone in', primary: true }]
						: [{ act: 'admit', arg, label: 'Admit a patient', primary: true }];
			}
		}

		facts.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
		paintAvatars(facts);
		actions.innerHTML = buttons
			.map(
				(b) =>
					`<button data-hc-act="${b.act}"${b.arg ? ` data-hc-arg="${b.arg}"` : ''} type="button" class="btn ${b.primary ? 'btn-primary' : 'btn-outline-secondary'}">${b.label}</button>`,
			)
			.join('');
		window.bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	/** The patient's name as a link to their chart, and a provider's name
	 * as a link to Providers. Only Heidi has a chart in the demo; the rest
	 * point at hers, so the link always lands somewhere. */
	function chartLink(name) {
		return personLink(name, 'patient-chart.html');
	}
	function providerLink(id) {
		return personLink(clinic.provider(id).name, 'providers.html');
	}

	function longestWait() {
		let best = null;
		for (const [index, seat] of Object.entries(desk.seats)) {
			if (!best || seat.minutes > best.minutes) best = { ...seat, index };
		}
		return best;
	}

	function minutesAgo(minutes) {
		const total = 480 + NOW_MINUTES - minutes;
		return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
	}

	/** One front-desk action from the dialog, then the plan is redrawn. */
	function act(action, arg) {
		const dialog = pick('[data-hc-spot-dialog]', document);
		const hide = () => window.bootstrap.Modal.getOrCreateInstance(dialog).hide();
		if (action === 'call') {
			const [index, roomId] = arg.split(':');
			const seat = desk.seats[index];
			const room = desk.rooms.find((r) => r.id === roomId);
			if (!seat || !room) return;
			Object.assign(room, { state: 'busy', who: seat.with, since: 0, patient: seat.name });
			delete desk.seats[index];
			hide();
			paintFrontDesk();
			toast(
				'success',
				`${seat.name} called to ${roomId}`,
				`${clinic.short(seat.with)} has them now, after ${seat.minutes} minutes in a chair.`,
			);
		} else if (action === 'text') {
			const seat = desk.seats[arg];
			hide();
			toast(
				'info',
				`Text sent to ${seat.name}`,
				'Your room will be ready in a few minutes. Please stay in the building.',
			);
		} else if (action === 'left') {
			const seat = desk.seats[arg];
			delete desk.seats[arg];
			hide();
			paintFrontDesk();
			toast(
				'warning',
				`${seat.name} marked as left`,
				`Their ${seat.why} with ${clinic.short(seat.with)} is back in the queue.`,
			);
		} else if (action === 'checkin') {
			hide();
			const form = pick('[data-hc-checkin]', document);
			if (form) window.bootstrap.Modal.getOrCreateInstance(form.closest('.modal')).show();
		} else if (action === 'done') {
			const room = desk.rooms.find((r) => r.id === arg);
			const patient = room.patient;
			Object.assign(room, { state: 'clean', who: undefined, since: undefined, patient: undefined });
			hide();
			paintFrontDesk();
			toast(
				'success',
				`${arg} is being cleaned`,
				`${patient}'s visit is done. The room is free again in about five minutes.`,
			);
		} else if (action === 'hand') {
			hide();
			toast('info', `Megan Price is on her way to ${arg}`, 'She has the message on her pager.');
		} else if (action === 'cleaned') {
			const room = desk.rooms.find((r) => r.id === arg);
			room.state = 'free';
			hide();
			paintFrontDesk();
			toast('success', `${arg} is free`, 'Call the longest wait in from its dialog.');
		} else if (action === 'discharge') {
			const [kind, id] = arg.split(':');
			const bed = desk[PLACE[kind].list].find((b) => b.id === id);
			const patient = bed.patient;
			Object.assign(bed, { state: 'clean', note: 'Being cleaned', patient: undefined });
			hide();
			if (pick('[data-hc-floor]')) paintFrontDesk();
			toast(
				'success',
				`${patient} ${PLACE[kind].gone} ${id}`,
				kind === 'chair'
					? 'The chair is being cleaned. The visit note is in their file.'
					: 'Housekeeping has the bed. The discharge letter is in their file.',
			);
		} else if (action === 'note') {
			const [kind, id] = arg.split(':');
			hide();
			toast(
				'info',
				'Note added',
				kind === 'chair'
					? `It is on ${id}'s chart for the nurse.`
					: `It is on the ${id} chart for the next round.`,
			);
		} else if (action === 'made') {
			const [kind, id] = arg.split(':');
			const bed = desk[PLACE[kind].list].find((b) => b.id === id);
			Object.assign(bed, { state: 'free', note: 'Free' });
			hide();
			if (pick('[data-hc-floor]')) paintFrontDesk();
			toast('success', `${id} is ready`, 'Free and clean.');
		} else if (action === 'admit') {
			hide();
			/* An admission is made on Wards & Beds, so the button goes there. */
			window.location.href = 'wards-and-beds.html';
		}
	}

	/* Appointments */

	/* The schedule on FullCalendar: a day or a week, every visit colored by
	   its provider, drag to move, click to check in, move or cancel. The
	   events are drawn from the lanes for the week of October 5 to 9. */
	let calendar = null;
	/* Today's visits under the calendar, repainted whenever the calendar's events change. */
	let dayList = null;
	const hiddenProviders = new Set();
	const visits = [];

	function startAppointments() {
		const host = pick('[data-hc-calendar]');
		if (!host || !window.Basalt.calendar) return;
		const tones = {};
		clinic.providers
			.filter((p) => p.room)
			.forEach((p, i) => {
				tones[p.id] = i + 1;
			});
		const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
		days.forEach((day, d) => {
			for (const [id, lane] of Object.entries(clinic.lanes)) {
				lane.forEach(([from, length, label, kind], i) => {
					if (kind === 'break') return;
					if (d < 4 && (i + d) % 5 === 0) return;
					const start = new Date(`${day}T08:00:00`);
					start.setMinutes(start.getMinutes() + from);
					const end = new Date(start.getTime() + length * 60000);
					let state = kind === 'gone' ? 'gone' : 'booked';
					if (d === 4 && !kind) {
						state =
							from + length <= NOW_MINUTES
								? 'seen'
								: from <= NOW_MINUTES
									? 'now'
									: from - NOW_MINUTES <= 20
										? 'checked'
										: 'booked';
					}
					if (d < 4 && !kind) state = 'seen';
					const named = clinic.register[label] !== undefined || /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(label);
					const reasons = ['follow-up', 'check-up', 'new patient', 'results review', 'prescription review'];
					const who = named
						? clinic.patientRecord(label)
						: clinic.patientRecord(clinic.walkIns[(i + d * 3) % clinic.walkIns.length]);
					const fresh = who.last === 'New patient' || who.last === 'First visit';
					const why = named
						? fresh
							? 'new patient'
							: reasons.filter((r) => r !== 'new patient')[(i + d) % 4]
						: label.toLowerCase();
					visits.push({
						id: `${id}-${d}-${i}`,
						provider: id,
						title: label,
						patient: who,
						why,
						start,
						end,
						state,
						tone: tones[id],
					});
				});
			}
		});

		/* Who the calendar shows: one menu instead of a chip per provider,
		   with everyone, a department or one provider a click away, and a
		   box per provider for any mix. The label says what is showing. */
		const filter = pick('[data-hc-provider-chips]');
		if (filter) {
			const inRooms = clinic.providers.filter((p) => p.room);
			const depts = clinic.departments.filter((d) => inRooms.some((p) => p.dept === d.key));
			filter.innerHTML = `<div class="dropdown"><button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle hc-who-btn" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false"><i class="bi bi-people me-1" aria-hidden="true"></i>Showing <b data-hc-who-label>All providers</b></button><div class="dropdown-menu hc-who-menu"><p class="hc-who-head">Show</p><button type="button" class="dropdown-item" data-hc-who-set="all">All providers</button>${depts
				.map((d) => `<button type="button" class="dropdown-item" data-hc-who-set="${d.key}">${d.name}</button>`)
				.join('')}<hr class="dropdown-divider"><p class="hc-who-head">Providers</p>${inRooms
				.map(
					(p) =>
						`<div class="hc-who-row"><input type="checkbox" class="form-check-input" id="hc-who-${p.id}" data-hc-who="${p.id}" checked><label for="hc-who-${p.id}"><i class="hc-who-dot" style="--tone: var(--basalt-hue)" aria-hidden="true"></i>${p.name}</label><button type="button" class="btn btn-link btn-sm" data-hc-who-only="${p.id}">Only</button></div>`,
				)
				.join('')}</div></div>`;
			const label = pick('[data-hc-who-label]', filter);
			const show = (ids) => {
				hiddenProviders.clear();
				for (const p of inRooms) if (!ids.includes(p.id)) hiddenProviders.add(p.id);
				for (const box of pickAll('[data-hc-who]', filter))
					box.checked = !hiddenProviders.has(box.dataset.hcWho);
				const shown = inRooms.filter((p) => !hiddenProviders.has(p.id));
				const dept = depts.find((d) => {
					const staff = inRooms.filter((p) => p.dept === d.key);
					return shown.length === staff.length && staff.every((p) => shown.includes(p));
				});
				label.textContent =
					shown.length === inRooms.length
						? 'All providers'
						: shown.length === 1
							? clinic.short(shown[0].id)
							: dept
								? dept.name
								: shown.length
									? `${shown.length} providers`
									: 'No one';
				calendar.refetchEvents();
				drawBoard();
			};
			filter.addEventListener('click', (event) => {
				const set = event.target.closest('[data-hc-who-set]');
				const only = event.target.closest('[data-hc-who-only]');
				if (set) {
					const key = set.dataset.hcWhoSet;
					show(inRooms.filter((p) => key === 'all' || p.dept === key).map((p) => p.id));
				} else if (only) {
					show([only.dataset.hcWhoOnly]);
				}
			});
			filter.addEventListener('change', (event) => {
				if (!event.target.closest('[data-hc-who]')) return;
				show(
					pickAll('[data-hc-who]', filter)
						.filter((box) => box.checked)
						.map((box) => box.dataset.hcWho),
				);
			});
		}

		calendar = window.Basalt.calendar(host, {
			now: '2026-10-09T11:20:00',
			initialDate: '2026-10-09',
			initialView: 'timeGridWeek',
			headerToolbar: { left: 'title', center: '', right: 'today prev,next' },
			slotMinTime: '08:00:00',
			slotMaxTime: '18:30:00',
			slotDuration: '00:30:00',
			snapDuration: '00:15:00',
			allDaySlot: false,
			weekends: false,
			nowIndicator: true,
			editable: true,
			eventOverlap: true,
			events: (info, ok) => ok(visits.filter((v) => !hiddenProviders.has(v.provider) && matches(v)).map(toEvent)),
			eventClick: (info) => {
				info.jsEvent.preventDefault();
				openVisit(info.event.id);
			},
			eventDrop: (info) => moved(info),
			eventResize: (info) => moved(info),
			eventsSet: () => {
				if (dayList) dayList.repaint();
			},
			eventDidMount: (info) => {
				const v = visits.find((x) => x.id === info.event.id);
				if (v)
					info.el.setAttribute(
						'aria-label',
						`${v.title}, ${clinic.short(v.provider)}, ${clock(v.start)} to ${clock(v.end)}, ${stateWord(v.state)}`,
					);
			},
		});

		wireSearch();
		wireBoard();
		const dialog = pick('[data-hc-visit-dialog]', document);
		if (dialog) {
			dialog.addEventListener('click', (event) => {
				const button = event.target.closest('[data-hc-visit-act]');
				if (button) visitAct(button.dataset.hcVisitAct, dialog.dataset.hcVisitId);
			});
		}
		startDayList();
	}

	/** Today's visits under the calendar as a working list: the ones in a
	 * room carry a live dot, and the quick view hands over to the visit
	 * dialog to check in, move or cancel. */
	function startDayList() {
		const host = pick('[data-hc-day-list]');
		if (!host) return;
		const states = {
			now: { word: 'In the room', live: true },
			checked: { word: 'Checked in', pill: 'hc-pill-wait' },
			booked: { word: 'Booked', pill: 'hc-pill-info' },
			seen: { word: 'Seen', pill: 'hc-pill-ok' },
			gone: { word: 'Did not come', pill: 'hc-pill-late' },
		};
		const today = () =>
			visits
				.filter((v) => v.start.toDateString() === new Date('2026-10-09T12:00:00').toDateString())
				.map((v) => {
					const h = v.start.getHours();
					const m = v.start.getMinutes();
					return {
						id: v.id,
						minutes: h * 60 + m,
						at: `${h}:${String(m).padStart(2, '0')}`,
						name: v.patient.name,
						record: v.patient,
						provider: v.provider,
						why: v.why,
						length: `${Math.round((v.end - v.start) / 60000)} min · ${clinic.provider(v.provider).room}`,
						state: v.state,
					};
				});
		const drawer = pick('[data-hc-vd]', document);
		dayList = visitList(host, today, states, {
			noun: 'visits today',
			sort: 'state',
			page: 10,
			primary: () => ({
				label: 'Check in, move or cancel',
				icon: 'bi-calendar-event',
				run: (r) => {
					window.bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
					openVisit(r.id);
				},
			}),
		});
	}

	let query = '';
	function matches(v) {
		if (!query) return true;
		return (
			v.patient.name.toLowerCase().includes(query) ||
			v.patient.id.toLowerCase().includes(query) ||
			v.title.toLowerCase().includes(query)
		);
	}

	/** The search box above the calendar: a name or an id narrows the
	 * calendar to those visits and lists them; picking one opens it. */
	function wireSearch() {
		const box = pick('[data-hc-search]');
		const list = pick('[data-hc-search-results]');
		if (!box || !list) return;
		box.addEventListener('input', () => {
			query = box.value.trim().toLowerCase();
			calendar.refetchEvents();
			drawBoard();
			if (!query) {
				list.hidden = true;
				list.innerHTML = '';
				return;
			}
			const hits = visits
				.filter(matches)
				.sort((x, y) => x.start - y.start)
				.slice(0, 8);
			list.hidden = false;
			list.innerHTML = hits.length
				? hits
						.map(
							(v) =>
								`<li><button data-hc-search-open="${v.id}" type="button" class="hc-search-row">${avatar(v.patient.name, 'xs')}<span class="hc-search-who"><b>${v.patient.name}</b><small>${v.patient.id} · ${v.why}</small></span><span class="hc-search-when">${v.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${clock(v.start)}<small>${clinic.short(v.provider)}</small></span></button></li>`,
						)
						.join('')
				: '<li class="hc-search-none">No visit matches that name or id.</li>';
			paintAvatars(list);
		});
		list.addEventListener('click', (event) => {
			const row = event.target.closest('[data-hc-search-open]');
			if (!row) return;
			const v = visits.find((x) => x.id === row.dataset.hcSearchOpen);
			if (!v) return;
			calendar.gotoDate(v.start);
			openVisit(v.id);
		});
	}

	/* The day by provider */

	/* The week the demo holds, and the day the board shows. */
	const BOARD_DAYS = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
	let boardDay = '2026-10-09';
	/* Which part of the day the board spreads across its width: half a day
	   leaves room for names; the morning holds now. */
	const BOARD_SPANS = { am: [8, 13], pm: [13, 18], day: [8, 18] };
	let boardSpan = 'am';

	/** The board's day buttons, and the switch between the board and one
	 * provider's week on FullCalendar (which needs one provider to read). */
	function wireBoard() {
		const board = pick('[data-hc-board]');
		if (!board) return;
		board.addEventListener('click', (event) => {
			const step = event.target.closest('[data-hc-board-day]');
			if (step) {
				const move = Number(step.dataset.hcBoardDay);
				const at = BOARD_DAYS.indexOf(boardDay);
				boardDay = move ? BOARD_DAYS[Math.min(BOARD_DAYS.length - 1, Math.max(0, at + move))] : '2026-10-09';
				drawBoard();
				return;
			}
			const visit = event.target.closest('[data-hc-board-visit]');
			if (visit) openVisit(visit.dataset.hcBoardVisit);
		});
		root.addEventListener('change', (event) => {
			if (event.target.name === 'hc-span') {
				boardSpan = event.target.value;
				drawBoard();
				return;
			}
			if (event.target.name !== 'hc-view') return;
			const week = event.target.value === 'week';
			board.hidden = week;
			pick('[data-hc-calendar]').hidden = !week;
			if (week) {
				const shown = clinic.providers.filter((p) => p.room && !hiddenProviders.has(p.id));
				if (shown.length !== 1) pick(`[data-hc-who-only="${shown[0]?.id ?? 'ev'}"]`)?.click();
				calendar.updateSize();
			}
		});
		drawBoard();
	}

	/** Draws the day: a row per provider, hours across, a block per visit in
	 * the provider's color, its state in the fill, lunch shaded, and now as
	 * a line. A block opens the visit. */
	function drawBoard() {
		const grid = pick('[data-hc-board-grid]');
		if (!grid) return;
		const [first, last] = BOARD_SPANS[boardSpan];
		const from = first * 60;
		const span = (last - first) * 60;
		const at = (minutes) => `${((minutes - from) / span) * 100}%`;
		const minutesOf = (date) => date.getHours() * 60 + date.getMinutes();
		const dayOf = (date) =>
			`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		const shown = clinic.providers.filter((p) => p.room && !hiddenProviders.has(p.id));
		const today = visits.filter((v) => dayOf(v.start) === boardDay && matches(v));
		const inSpan = (v) => minutesOf(v.end) > from && minutesOf(v.start) < from + span;
		const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
		const tones = {};
		for (const v of visits) tones[v.provider] = v.tone;
		grid.innerHTML = `
			<div class="hc-board-row is-head"><span class="hc-board-who"></span><div class="hc-board-track">${hours
				.map(
					(h) =>
						`<span class="hc-board-hour" style="left: ${at(h * 60)}">${h > 12 ? h - 12 : h} ${h < 12 ? 'am' : 'pm'}</span>`,
				)
				.join('')}</div></div>
			${shown
				.map((p) => {
					const own = today.filter((v) => v.provider === p.id).sort((x, y) => x.start - y.start);
					const blocks = own
						.filter(inSpan)
						.map((v) => {
							const start = minutesOf(v.start);
							const length = minutesOf(v.end) - start;
							const words = `${v.patient.name}, ${clock(v.start)} to ${clock(v.end)}, ${v.why}, ${stateWord(v.state)}`;
							return `<button type="button" class="hc-board-visit is-${v.state}" data-hc-board-visit="${v.id}" style="left: ${at(start)}; width: calc(${(length / span) * 100}% - 3px)" title="${words}" aria-label="${words}"><b>${v.patient.name}</b><span>${v.why}</span></button>`;
						})
						.join('');
					return `<div class="hc-board-row" style="--tone: var(--basalt-hue)"><span class="hc-board-who">${personLink(p.name, 'provider-schedule.html', clinic.short(p.id))}<small>Room ${p.room} · ${own.length} ${own.length === 1 ? 'visit' : 'visits'}</small></span><div class="hc-board-track">${hours.map((h) => `<i class="hc-board-line" style="left: ${at(h * 60)}"></i>`).join('')}${last > 13 && first < 14 ? `<i class="hc-board-lunch" style="left: ${at(13 * 60)}; width: ${(60 / span) * 100}%"></i>` : ''}${boardDay === '2026-10-09' && 8 * 60 + NOW_MINUTES > from && 8 * 60 + NOW_MINUTES < from + span ? `<i class="hc-board-now" style="left: ${at(8 * 60 + NOW_MINUTES)}"></i>` : ''}${blocks}</div></div>`;
				})
				.join('')}`;
		paintAvatars(grid);
		const date = new Date(`${boardDay}T12:00`);
		pick('[data-hc-board-title]').textContent = date.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
		});
		const seen = today.filter((v) => v.state === 'seen').length;
		const missed = today.filter((v) => v.state === 'gone').length;
		pick('[data-hc-board-sum]').textContent = shown.length
			? `${today.filter((v) => shown.some((p) => p.id === v.provider)).length} visits · ${seen} seen${missed ? ` · ${missed} did not come` : ''}`
			: 'Pick a provider to show.';
	}

	function toEvent(v) {
		return {
			id: v.id,
			title: v.title,
			start: v.start,
			end: v.end,
			classNames: [`hc-visit-${v.state}`],
		};
	}

	function stateWord(state) {
		return { seen: 'seen', now: 'in the room now', checked: 'checked in', booked: 'booked', gone: 'did not come' }[
			state
		];
	}

	function clock(date) {
		return window.Basalt.calendar.clock
			? window.Basalt.calendar.clock(date)
			: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	/** Drag and resize land here: the visit keeps its new time, with Undo. */
	function moved(info) {
		const v = visits.find((x) => x.id === info.event.id);
		if (!v) return;
		const before = { start: v.start, end: v.end };
		v.start = info.event.start;
		v.end = info.event.end || new Date(v.start.getTime() + 30 * 60000);
		toast(
			'success',
			'Visit moved',
			`${v.title} with ${clinic.short(v.provider)}, now ${clock(v.start)} to ${clock(v.end)}.`,
			[
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(v, before);
						calendar.refetchEvents();
					},
				},
			],
		);
	}

	/** Opens one visit: who, when, where it stands, and what to do with it. */
	function openVisit(id) {
		const dialog = pick('[data-hc-visit-dialog]', document);
		const v = visits.find((x) => x.id === id);
		if (!dialog || !v) return;
		dialog.dataset.hcVisitId = id;
		const who = clinic.provider(v.provider);
		const p = v.patient;
		pick('[data-hc-visit-title]', dialog).innerHTML = `<a href="patient-chart.html">${p.name}</a>`;
		pick('[data-hc-visit-sub]', dialog).innerHTML =
			`${personLink(who.name, 'providers.html')} · ${who.room} · ${clock(v.start)} to ${clock(v.end)}`;
		paintAvatars(dialog);
		pick('[data-hc-visit-facts]', dialog).innerHTML = [
			['Patient id', `<a href="patient-chart.html">${p.id}</a>`],
			['Age', p.age === 0 ? 'Under one' : String(p.age)],
			['Phone', `<a href="tel:${p.phone.replace(/[^+\d]/g, '')}">${p.phone}</a>`],
			['Reason', `<a href="appointment-details.html">${v.why}</a>`],
			[
				'Allergies',
				p.allergies === 'None known' ? p.allergies : `<span class="hc-pill hc-pill-late">${p.allergies}</span>`,
			],
			['Last visit', `<a href="patient-chart.html">${p.last}</a>`],
		]
			.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`)
			.join('');
		pick('[data-hc-visit-links]', dialog).innerHTML = `
			<a href="patient-chart.html" class="btn btn-outline-secondary btn-sm"><i aria-hidden="true" class="bi bi-clipboard2-pulse me-1"></i>Open chart</a>
			<a href="appointment-details.html" class="btn btn-outline-secondary btn-sm"><i aria-hidden="true" class="bi bi-calendar-event me-1"></i>Appointment</a>
			<a href="chat.html" class="btn btn-outline-secondary btn-sm"><i aria-hidden="true" class="bi bi-chat-left-text me-1"></i>Message</a>
			<button data-hc-done="Text sent" data-hc-toast="Text sent to ${p.name}: your visit with ${clinic.short(v.provider)} is at ${clock(v.start)} in ${who.room}." type="button" class="btn btn-outline-secondary btn-sm"><i aria-hidden="true" class="bi bi-phone me-1"></i>Send a text</button>`;
		const when = pick('[data-hc-visit-when]', dialog);
		when.value = `${String(v.start.getHours()).padStart(2, '0')}:${String(v.start.getMinutes()).padStart(2, '0')}`;
		pick('[data-hc-visit-act="checkin"]', dialog).hidden = v.state !== 'booked';
		window.bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	function visitAct(action, id) {
		const dialog = pick('[data-hc-visit-dialog]', document);
		const v = visits.find((x) => x.id === id);
		if (!v) return;
		const hide = () => window.bootstrap.Modal.getOrCreateInstance(dialog).hide();
		if (action === 'checkin') {
			v.state = 'checked';
			hide();
			calendar.refetchEvents();
			toast(
				'success',
				`${v.title} checked in`,
				`${clinic.short(v.provider)} will see them in ${clinic.provider(v.provider).room}.`,
			);
		} else if (action === 'move') {
			const [h, m] = pick('[data-hc-visit-when]', dialog).value.split(':').map(Number);
			if (Number.isNaN(h)) return;
			const length = v.end - v.start;
			const before = { start: v.start, end: v.end };
			v.start = new Date(v.start);
			v.start.setHours(h, m, 0, 0);
			v.end = new Date(v.start.getTime() + length);
			hide();
			calendar.refetchEvents();
			toast('success', 'Visit moved', `${v.title}, now ${clock(v.start)} to ${clock(v.end)}.`, [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(v, before);
						calendar.refetchEvents();
					},
				},
			]);
		} else if (action === 'cancel') {
			const index = visits.indexOf(v);
			visits.splice(index, 1);
			hide();
			calendar.refetchEvents();
			toast(
				'warning',
				'Visit canceled',
				`${v.title} with ${clinic.short(v.provider)} at ${clock(v.start)}. The slot is open again.`,
				[
					{
						label: 'Undo',
						onClick: () => {
							visits.splice(index, 0, v);
							calendar.refetchEvents();
						},
					},
				],
			);
		}
	}

	/* A day's visits as a list that works like the template's best one:
	   search, a Filters menu, sortable heads, a running count, an honest
	   empty state, and a quick view beside each visit's full page. Used by
	   Appointments and Telehealth. */

	/**
	 * Wires one visit list inside `host` (a card with an id).
	 * @param {HTMLElement} host the card holding the toolbar and the table
	 * @param {() => object[]} source the visits, read on every paint, as
	 *   { id, minutes, at, name, record, provider, why, length, state };
	 *   `length` is the line under the reason
	 * @param {object} states state key to { word, pill, live }, in the order
	 *   the Status column sorts by
	 * @param {object} options noun (plural), page (rows before Show more,
	 *   0 for all), sort (the column to start on, time by default), and
	 *   primary(row) giving the drawer's main button as { label, icon, run },
	 *   or null for none
	 * @returns {{ repaint(): void }}
	 */
	function visitList(host, source, states, options) {
		const body = pick('[data-hc-vl-body]', host);
		const search = pick('[data-hc-vl-search]', host);
		const summary = pick('[data-hc-vl-summary]', host);
		const applied = pick('[data-hc-vl-applied]', host);
		const filterBtn = pick('[data-hc-vl-filter-btn]', host);
		const filterCount = pick('[data-hc-vl-filter-count]', host);
		const more = pick('[data-hc-vl-more]', host);
		const drawer = pick('[data-hc-vd]', document);
		const order = Object.keys(states);
		const view = {
			text: '',
			state: 'all',
			provider: 'all',
			sort: options.sort || 'minutes',
			up: true,
			shown: options.page,
		};
		let onScreen = [];
		let stepList = [];
		let stepper = null;

		const chip = (group, value, label) => {
			const id = `${host.id}-${group}-${value}`;
			return `<input type="radio" class="btn-check" name="${host.id}-${group}" id="${id}" value="${value}"${value === 'all' ? ' checked' : ''}><label class="hc-vl-chip" for="${id}">${label}</label>`;
		};
		const first = source();
		const providerIds = [...new Set(first.map((r) => r.provider))];
		pick('[data-hc-vl-chips="state"]', host).innerHTML = [
			chip('state', 'all', 'Any'),
			...order.filter((k) => first.some((r) => r.state === k)).map((k) => chip('state', k, states[k].word)),
		].join('');
		pick('[data-hc-vl-chips="provider"]', host).innerHTML = [
			chip('provider', 'all', 'Anyone'),
			...providerIds.map((id) => chip('provider', id, clinic.short(id))),
		].join('');

		function setFilters(state, provider) {
			view.state = state;
			view.provider = provider;
			view.shown = options.page;
			for (const [group, value] of [
				['state', state],
				['provider', provider],
			]) {
				const radio = pick(`input[name="${host.id}-${group}"][value="${value}"]`, host);
				if (radio) radio.checked = true;
			}
			paint();
		}

		host.addEventListener('change', (event) => {
			const radio = event.target.closest('.btn-check');
			if (!radio) return;
			const group = radio.name.slice(host.id.length + 1);
			if (group === 'state') setFilters(radio.value, view.provider);
			else setFilters(view.state, radio.value);
		});
		search.addEventListener('input', () => {
			view.text = search.value.trim();
			view.shown = options.page;
			paint();
		});
		host.addEventListener('click', (event) => {
			const sorter = event.target.closest('[data-hc-vl-sort]');
			if (sorter) {
				const key = sorter.dataset.hcVlSort;
				view.up = view.sort === key ? !view.up : true;
				view.sort = key;
				paint();
				return;
			}
			if (event.target.closest('[data-hc-vl-clear]')) {
				setFilters('all', 'all');
				return;
			}
			if (event.target.closest('[data-hc-vl-done]')) {
				window.bootstrap.Dropdown.getOrCreateInstance(filterBtn).hide();
				return;
			}
			if (event.target.closest('[data-hc-vl-more]')) {
				window.Basalt.slide(body.closest('table').parentElement, () => {
					view.shown += options.page;
					paint();
				});
				return;
			}
			const peek = event.target.closest('[data-hc-vl-open]');
			const row = event.target.closest('[data-hc-vl-row]');
			if (peek) openQuick(peek.dataset.hcVlOpen);
			else if (row && !event.target.closest('a, button')) openQuick(row.dataset.hcVlRow);
		});

		function sorted(list) {
			const value = {
				minutes: (r) => r.minutes,
				name: (r) => r.name,
				provider: (r) => clinic.short(r.provider),
				state: (r) => order.indexOf(r.state),
			}[view.sort];
			return [...list].sort((a, b) => {
				const x = value(a);
				const y = value(b);
				const diff = typeof x === 'string' ? x.localeCompare(y) : x - y;
				return (view.up ? diff : -diff) || a.minutes - b.minutes;
			});
		}

		function fits(r) {
			if (view.state !== 'all' && r.state !== view.state) return false;
			if (view.provider !== 'all' && r.provider !== view.provider) return false;
			const words = `${r.name} ${r.record.id} ${r.why} ${clinic.provider(r.provider).name}`;
			return !view.text || window.Basalt.matchesQuery(words, view.text);
		}

		function paint() {
			const all = source().filter((r) => states[r.state]);
			onScreen = sorted(all.filter(fits));
			const shown = options.page ? onScreen.slice(0, view.shown) : onScreen;
			const columns = pickAll('thead th', host).length;
			const blank = view.text
				? { query: view.text, noun: options.noun }
				: {
						title: `No ${options.noun} fit these filters`,
						text: 'Clear a filter to see the rest of the day.',
						icon: 'funnel',
					};
			body.innerHTML = shown.length
				? shown.map(rowMarkup).join('')
				: `<tr class="basalt-empty-row"><td colspan="${columns}">${window.Basalt.emptyState(blank)}</td></tr>`;
			paintAvatars(body);
			if (window.Basalt.tips) window.Basalt.tips(body);
			summary.textContent =
				onScreen.length === all.length
					? `${all.length} ${options.noun}`
					: `${onScreen.length} of ${all.length} ${options.noun}`;
			if (more) {
				const left = onScreen.length - shown.length;
				more.hidden = left <= 0;
				more.textContent = `Show ${Math.min(left, options.page)} more`;
			}
			for (const th of pickAll('[data-hc-vl-th]', host)) {
				const on = th.dataset.hcVlTh === view.sort;
				if (on) th.setAttribute('aria-sort', view.up ? 'ascending' : 'descending');
				else th.removeAttribute('aria-sort');
				const arrow = on ? (view.up ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up hc-vl-idle';
				pick('.bi', th).className = `bi ${arrow}`;
			}
			const used = [];
			if (view.state !== 'all')
				used.push({ label: states[view.state].word, remove: () => setFilters('all', view.provider) });
			if (view.provider !== 'all')
				used.push({ label: clinic.short(view.provider), remove: () => setFilters(view.state, 'all') });
			filterCount.hidden = !used.length;
			filterCount.textContent = used.length;
			filterBtn.classList.toggle('is-on', used.length > 0);
			if (window.Basalt.drawer)
				window.Basalt.drawer.applied(applied, used, () => setFilters('all', 'all'), filterBtn);
		}

		function pillFor(state) {
			const s = states[state];
			return s.live
				? `<span class="hc-live hc-vl-live">${s.word}</span>`
				: `<span class="hc-pill ${s.pill}">${s.word}</span>`;
		}

		function rowMarkup(r) {
			const who = clinic.provider(r.provider);
			const tip = (title) => `data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${title}"`;
			return `<tr data-hc-vl-row="${r.id}" class="hc-vl-row">
				<td class="hc-vl-time">${r.at}</td>
				<td class="hc-vl-who"><a href="appointment-details.html" class="hc-person-link">${avatar(r.name, 'xs')}<span>${r.name}</span></a><span class="hc-who-meta hc-under-person">${r.record.id}</span></td>
				<td class="hc-vl-why"><span class="hc-vl-why-name">${r.why[0].toUpperCase()}${r.why.slice(1)}</span><span class="hc-who-meta">${r.length}</span></td>
				<td class="hc-vl-with">${personLink(who.name, 'providers.html', clinic.short(r.provider))}</td>
				<td class="hc-vl-state">${pillFor(r.state)}</td>
				<td class="hc-vl-act"><div class="basalt-row-actions"><button data-hc-vl-open="${r.id}" ${tip('Quick view')} aria-label="Quick view: ${r.name}" type="button" class="btn btn-icon btn-sm"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a href="appointment-details.html" ${tip('Open full page')} aria-label="Open full page: ${r.name}" class="btn btn-icon btn-sm"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></div></td>
			</tr>`;
		}

		function openQuick(id) {
			if (!drawer || !window.bootstrap) return;
			stepList = [...onScreen];
			let index = stepList.findIndex((r) => r.id === id);
			if (index < 0) {
				stepList = source().filter((r) => r.id === id);
				index = 0;
			}
			if (!stepList.length) return;
			if (!stepper && window.Basalt.drawer) {
				const count = { valueOf: () => Math.max(1, stepList.length) };
				stepper = window.Basalt.drawer.recordNav(drawer, count, (at) => fillQuick(stepList[at]));
			}
			if (stepper) stepper.go(index, 0);
			else fillQuick(stepList[index]);
			pick('.basalt-drawer-nav', drawer).hidden = stepList.length < 2;
			window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
		}

		function fillQuick(r) {
			const p = r.record;
			const who = clinic.provider(r.provider);
			const plan = clinic.cover.plans.find((x) => x.id === p.plan);
			pick('[data-hc-vd="face"]', drawer).dataset.name = r.name;
			pick('[data-hc-vd="name"]', drawer).textContent = r.name;
			pick('[data-hc-vd="sub"]', drawer).textContent = `${r.at} · ${r.why}`;
			pick('[data-hc-vd="state"]', drawer).innerHTML =
				`${pillFor(r.state)}<span class="hc-vd-length">${r.length}</span>`;
			pick('[data-hc-vd="facts"]', drawer).innerHTML = [
				['Seen by', personLink(who.name, 'providers.html')],
				['Patient id', `<a href="patient-chart.html">${p.id}</a>`],
				['Age', p.age === 0 ? 'Under one' : String(p.age)],
				['Phone', `<a href="tel:${p.phone.replace(/\s/g, '')}">${p.phone}</a>`],
				['Insurance', plan ? plan.name : 'Self-pay'],
				[
					'Allergies',
					p.allergies === 'None known'
						? p.allergies
						: `<span class="hc-pill hc-pill-late">${p.allergies}</span>`,
				],
				['Last visit', `<a href="visit-notes.html">${p.last}</a>`],
			]
				.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
				.join('');
			const action = options.primary(r);
			const primary = pick('[data-hc-vd="primary"]', drawer);
			primary.hidden = !action;
			if (action) {
				primary.innerHTML = `<i class="bi ${action.icon} me-1" aria-hidden="true"></i>${action.label}`;
				primary.onclick = () => action.run(r);
			}
			paintAvatars(drawer);
		}

		paint();
		return { repaint: paint };
	}

	/** Telehealth: today's video visits as a working list. The quick view's
	 * main button fits where the visit stands: join it, let them in, send
	 * the link, or read the note. */
	function startTelehealth() {
		const host = pick('[data-hc-video-list]');
		if (!host || !clinic.video) return;
		const lines = {
			done: (v) => `${v.minutes} min`,
			live: (v) => `${v.minutes} min so far`,
			waiting: (v) => `waited ${v.minutes} min`,
			booked: (v) => `${v.minutes} min booked`,
		};
		const rows = clinic.video.map((v, i) => {
			const [h, m] = v.at.split(':').map(Number);
			return {
				id: `video-${i}`,
				minutes: h * 60 + m,
				at: v.at,
				name: v.name,
				record: clinic.patientRecord(v.name),
				provider: v.with,
				why: v.why,
				length: lines[v.state](v),
				state: v.state,
			};
		});
		const states = {
			live: { word: 'Live', live: true },
			waiting: { word: 'In the waiting room', pill: 'hc-pill-wait' },
			booked: { word: 'Booked', pill: 'hc-pill-info' },
			done: { word: 'Done', pill: 'hc-pill-ok' },
		};
		const drawer = pick('[data-hc-vd]', document);
		const close = () => window.bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
		const first = (r) => r.name.split(' ')[0];
		visitList(host, () => rows, states, {
			noun: 'video visits',
			page: 0,
			primary: (r) =>
				({
					live: {
						label: 'Back to the call',
						icon: 'bi-camera-video',
						run: () => {
							close();
							pick('[data-hc-call]').scrollIntoView({ behavior: 'smooth', block: 'center' });
						},
					},
					waiting: {
						label: 'Let them in',
						icon: 'bi-door-open',
						run: () => {
							close();
							toast(
								'success',
								`${r.name} let in`,
								`${clinic.short(r.provider)} sees ${first(r)} as soon as the call before ends.`,
							);
						},
					},
					booked: {
						label: 'Send the link',
						icon: 'bi-send',
						run: () => {
							close();
							toast('success', 'Link sent', `${first(r)} got the video link by text for ${r.at}.`);
						},
					},
					done: {
						label: 'Read the note',
						icon: 'bi-journal-text',
						run: () => {
							window.location.href = 'visit-notes.html';
						},
					},
				})[r.state],
		});
	}

	/* Providers */

	/* The roster under the body: what is typed, the facets picked, the
	   sort, the period the band shows and a department pinned on the body.
	   shown is the list as drawn, which the quick view steps through. */
	const roster = {
		query: '',
		dept: '',
		now: '',
		sort: 'load',
		ascending: false,
		period: 'today',
		pinned: null,
		shown: [],
	};
	const ROSTER_NOW = [
		{ id: 'with', name: 'With a patient' },
		{ id: 'free', name: 'Between patients' },
		{ id: 'video', name: 'Video visits' },
	];
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	let rosterStepper = null;
	let rosterOpen = [];
	let rosterTyping = 0;

	function startProviders() {
		let period = 'today';
		let focus = null;
		const stage = pick('[data-hc-stage]');
		const deptOf = (key) => clinic.departments.find((x) => x.key === key);

		/* The statistics band above the body: the whole clinic, or the
		   department under the pointer or pinned. */
		function paintStats(key) {
			const host = pick('[data-hc-dept-stats]');
			if (!host) return;
			const depts = key ? [deptOf(key)] : clinic.departments;
			const count = (d) => (period === 'today' ? d.visits : d[period][0]);
			const last = (d) => (period === 'today' ? d.lastWeek : d[period][1]);
			const visits = depts.reduce((s, d) => s + count(d), 0);
			const before = depts.reduce((s, d) => s + last(d), 0);
			const dayTotals = [0, 1, 2, 3, 4].map((i) => depts.reduce((s, d) => s + d.days[i], 0));
			const dayMin = Math.min(...dayTotals);
			const dayMax = Math.max(...dayTotals, 1);
			const slots = depts.reduce((s, d) => [s[0] + d.slots[0], s[1] + d.slots[1]], [0, 0]);
			const share = Math.round((slots[0] / slots[1]) * 100);
			const wait = Math.round(depts.reduce((s, d) => s + d.wait * count(d), 0) / Math.max(visits, 1));
			const staff = depts.flatMap((d) => d.staff);
			const name = key ? deptOf(key).name : 'Broadway Street';
			const against = { today: 'last week', week: 'the week before', month: 'the month before' }[period];
			const diff = visits - before;
			const tone = key ? `var(--basalt-series-${deptOf(key).tone})` : 'var(--basalt-hue)';
			host.style.setProperty('--tone', tone);
			host.innerHTML = `
				<div class="hc-stat">
					<span class="hc-stat-label">${name}</span>
					<span class="hc-stat-value">${visits}<small>visits ${period === 'today' ? 'today' : `this ${period}`}</small></span>
					<span class="hc-stat-note ${diff > 0 ? 'is-up' : diff < 0 ? 'is-down' : ''}">${diff === 0 ? `same as ${against}` : `${diff > 0 ? '↗' : '↘'} ${Math.abs(diff)} vs ${against}`}</span>
				</div>
				<div class="hc-stat">
					<span class="hc-stat-label">Visits each day</span>
					<span class="hc-stat-days" role="img" aria-label="Visits each day this week: ${dayTotals.join(', ')}">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => `<span class="${i === 4 ? 'is-today' : ''}" title="${d}: ${dayTotals[i]} visits" style="--share: ${Math.round(20 + ((dayTotals[i] - dayMin) / Math.max(dayMax - dayMin, 1)) * 80)}%"><em>${dayTotals[i]}</em><i><s></s></i><b>${d}</b></span>`).join('')}</span>
				</div>
				<div class="hc-stat">
					<span class="hc-stat-label">Slots booked today</span>
					<span class="hc-stat-ring"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="track"></circle><circle cx="18" cy="18" r="15.5" class="fill" style="--share: ${share}"></circle></svg><span class="hc-stat-value">${share}%<small>${slots[0]} of ${slots[1]}</small></span></span>
				</div>
				<div class="hc-stat">
					<span class="hc-stat-label">Average wait${period === 'today' ? '<span class="hc-now is-live">Live</span>' : ''}</span>
					<span class="hc-stat-value">${wait}<small>min in a chair</small></span>
					<span class="hc-stat-heads">${staff
						.slice(0, 6)
						.map((id) => avatar(clinic.provider(id).name.replace('Dr. ', ''), 'xs'))
						.join('')}${staff.length > 6 ? `<small>+${staff.length - 6}</small>` : ''}</span>
					<span class="hc-stat-note">${staff.length} ${staff.length === 1 ? 'provider' : 'providers'}</span>
				</div>`;
			paintAvatars(host);
			/* After the first paint, a switch of period or department leaves the
			   cards still: the figures count to their new values and the day
			   bars and the ring redraw. */
			if (host.dataset.painted && !motionStill()) {
				host.classList.remove('is-redrawn');
				void host.offsetWidth;
				host.classList.add('is-redrawn');
				window.Basalt.countUp?.(pickAll('.hc-stat-value', host));
			}
			host.dataset.painted = 'true';
		}

		const paint = () => {
			const items = clinic.departments.map((d) => {
				const [count, last] = period === 'today' ? [d.visits, d.lastWeek] : d[period];
				const against = { today: 'vs last week', week: 'vs the week before', month: 'vs the month before' }[
					period
				];
				return {
					key: d.key,
					name: d.name,
					organ: d.organ,
					tone: d.tone,
					side: d.side,
					spot: d.spot,
					ring: count,
					line: trendText(count - last, against),
					who: d.staff,
					more: `${peopleLine(d.staff)} · ${d.slots[0]} of ${d.slots[1]} slots today`,
					spoken: `${d.name}: ${count} visits ${period === 'today' ? 'today' : `this ${period}`}, ${peopleLine(d.staff)}, ${d.slots[0]} of ${d.slots[1]} slots booked today`,
				};
			});
			drawBody(stage, items, 'dept', (organ, pinned) => {
				const item = items.find((it) => it.organ === organ);
				focus = item ? item.key : null;
				paintStats(focus);
				/* Pinning a department narrows the roster to it; unpinning
				   lets it go again. Hovering alone leaves the roster be. */
				if (pinned && roster.pinned !== focus) {
					roster.pinned = focus;
					roster.dept = focus;
					paintProviders();
				} else if (!pinned && roster.pinned) {
					roster.pinned = null;
					roster.dept = '';
					paintProviders();
				}
			});
			paintAvatars(stage);
			paintStats(focus);
			const sum = items.reduce((total, it) => total + it.ring, 0);
			const sub = pick('[data-hc-dept-sub]');
			if (sub) {
				sub.textContent = {
					today: `${sum} visits today, up 8 on last week.`,
					week: `${sum} visits this week, up 28.`,
					month: `${sum} visits this month, up 40.`,
				}[period];
			}
		};
		paint();
		for (const option of pickAll('[name="hc-range"]')) {
			option.addEventListener('change', () => {
				if (!option.checked) return;
				period = option.value;
				roster.period = period;
				paint();
				paintProviders();
			});
		}
		wireRoster();
		paintProviders();
		wireProviderMessage();
	}

	/** Draws the roster: the rows that pass the search and the filters, in
	 * the chosen order, with the count, the chips for filters in use, the
	 * sort arrows and an empty state when nothing is left. */
	function paintProviders() {
		const body = pick('[data-hc-providers]');
		if (!body) return;
		const top = Math.max(1, ...clinic.providers.map((p) => providerLoad(p).value));
		roster.shown = sortRoster(clinic.providers.filter(fitsRoster));
		body.innerHTML = roster.shown.length
			? roster.shown.map((p) => rosterRow(p, top)).join('')
			: `<tr class="basalt-empty-row"><td colspan="6">${rosterEmpty()}</td></tr>`;
		paintAvatars(body);
		if (window.Basalt.tips) window.Basalt.tips(body);
		const total = clinic.providers.length;
		pick('[data-hc-roster-count]').textContent =
			roster.shown.length === total ? `${total} providers` : `${roster.shown.length} of ${total} providers`;
		pick('[data-hc-roster-load-head]').textContent = {
			today: 'Seen today',
			week: 'This week',
			month: 'This month',
		}[roster.period];
		for (const head of pickAll('[data-hc-roster-th]')) {
			const on = head.dataset.hcRosterTh === roster.sort;
			if (on) head.setAttribute('aria-sort', roster.ascending ? 'ascending' : 'descending');
			else head.removeAttribute('aria-sort');
			const arrow = roster.ascending ? 'bi-arrow-up' : 'bi-arrow-down';
			pick('.bi', head).className = `bi ${on ? arrow : 'bi-arrow-down-up hc-list-sort-idle'}`;
		}
		paintRosterChips();
	}

	function fitsRoster(p) {
		if (roster.dept && p.dept !== roster.dept) return false;
		if (roster.now && providerNow(p).id !== roster.now) return false;
		if (!roster.query || !window.Basalt || !window.Basalt.matchesQuery) return true;
		const dept = clinic.departments.find((d) => d.key === p.dept);
		return window.Basalt.matchesQuery(`${p.name} ${p.role} ${p.room || ''} ${dept ? dept.name : ''}`, roster.query);
	}

	function sortRoster(list) {
		const keys = {
			name: (p) => p.name.replace(/^Dr\. /, ''),
			dept: (p) => (clinic.departments.find((d) => d.key === p.dept) || { name: '' }).name,
			load: (p) => providerLoad(p).value,
			now: (p) => ROSTER_NOW.findIndex((s) => s.id === providerNow(p).id),
		};
		const key = keys[roster.sort];
		const sign = roster.ascending ? 1 : -1;
		return [...list].sort((a, b) => {
			const x = key(a);
			const y = key(b);
			const order = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
			return order * sign || a.name.localeCompare(b.name);
		});
	}

	/** One provider's row: who, department, room, the period's figure as a
	 * bar with its number, what they are doing now and the two row actions. */
	function rosterRow(p, top) {
		const dept = clinic.departments.find((d) => d.key === p.dept);
		const now = providerNow(p);
		const today = roster.period === 'today';
		const value = providerLoad(p).value;
		const share = Math.round((today ? (p.booked ? p.seen / p.booked : 0) : value / top) * 100);
		const figure = today ? `${p.seen}<small>of ${p.booked}</small>` : `${value}<small>visits</small>`;
		const nowCell =
			now.id === 'with'
				? `<span class="hc-now is-live">${now.name}</span><span class="hc-who-meta"><a href="patient-chart.html">${now.patient}</a> · ${now.since} min</span>`
				: `<span class="hc-now">${now.name}</span>`;
		const tip = (label) => `data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${label}"`;
		const room = p.room ? p.room : '<span class="hc-roster-none">No room</span>';
		return `
			<tr data-hc-roster-row="${p.id}" class="hc-list-row">
				<td class="hc-roster-who"><a href="provider-details.html?id=${p.id}" class="hc-person-link hc-roster-name">${avatar(p.name.replace(/^Dr\.? /, ''), 'sm')}<span><b>${p.name}</b><small>${p.role}</small></span></a></td>
				<td class="hc-roster-dept">${dept ? dept.name : ''}</td>
				<td class="hc-roster-room">${room}</td>
				<td class="hc-roster-load"><span class="hc-roster-bar"><span aria-hidden="true" class="hc-provider-track"><span class="hc-provider-fill" style="--share: ${share}%"></span></span><span class="hc-provider-value">${figure}</span></span></td>
				<td class="hc-roster-now">${nowCell}</td>
				<td class="hc-roster-act"><div class="basalt-row-actions"><button data-hc-roster-open="${p.id}" ${tip('Quick view')} aria-label="Quick view: ${p.name}" type="button" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-layout-sidebar-inset-reverse"></i></button><a href="provider-details.html?id=${p.id}" ${tip('Open full page')} aria-label="Open full page: ${p.name}" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-arrows-angle-expand"></i></a></div></td>
			</tr>`;
	}

	/** The empty state: no match for the search, or filters that leave nobody. */
	function rosterEmpty() {
		const blank = window.Basalt && window.Basalt.emptyState;
		if (!blank) return 'Nobody matches.';
		if (roster.query) return blank({ query: roster.query, noun: 'providers' });
		return blank({
			title: 'Nobody fits these filters',
			text: 'Clear a filter to see more of the team.',
			icon: 'person-x',
		}).replace(
			/<\/div>$/,
			'<button data-hc-roster-clear type="button" class="btn btn-sm btn-outline-secondary">Clear filters</button></div>',
		);
	}

	/** The filter chips in the menu, the count on the Filters button and
	 * the removable chips beside the search. */
	function paintRosterChips() {
		const facets = {
			dept: [
				{ id: '', name: 'Every department' },
				...clinic.departments.map((d) => ({ id: d.key, name: d.name })),
			],
			now: [{ id: '', name: 'Anyone' }, ...ROSTER_NOW],
		};
		for (const [facet, options] of Object.entries(facets)) {
			pick(`[data-hc-roster-chips="${facet}"]`).innerHTML = options
				.map(
					(o, i) =>
						`<input id="hc-rf-${facet}-${i}" type="radio" name="hc-rf-${facet}" value="${o.id}" class="btn-check"${roster[facet] === o.id ? ' checked' : ''} /><label for="hc-rf-${facet}-${i}" class="hc-list-chip">${o.name}</label>`,
				)
				.join('');
		}
		const inUse = Object.keys(facets).filter((facet) => roster[facet]);
		const badge = pick('[data-hc-roster-filter-count]');
		const button = pick('[data-hc-roster-filter-btn]');
		badge.hidden = inUse.length === 0;
		badge.textContent = inUse.length;
		button.classList.toggle('is-on', inUse.length > 0);
		if (!window.Basalt.drawer || !window.Basalt.drawer.applied) return;
		window.Basalt.drawer.applied(
			pick('[data-hc-roster-applied]'),
			inUse.map((facet) => ({
				label: facets[facet].find((o) => o.id === roster[facet]).name,
				remove: () => setRosterFacet(facet, ''),
			})),
			clearRosterFilters,
			button,
		);
	}

	/** Sets one filter. Letting go of a pinned department unpins it on the body too. */
	function setRosterFacet(facet, value) {
		if (facet === 'dept' && roster.pinned && value !== roster.pinned) {
			const lit = pick('[data-hc-stage] .hc-orb.is-lit');
			roster.pinned = null;
			if (lit) lit.click();
		}
		roster[facet] = value;
		paintProviders();
	}

	function clearRosterFilters() {
		roster.now = '';
		setRosterFacet('dept', '');
	}

	function wireRoster() {
		const search = pick('[data-hc-roster-search]');
		search.addEventListener('input', () => {
			clearTimeout(rosterTyping);
			rosterTyping = setTimeout(() => {
				roster.query = search.value.trim();
				paintProviders();
			}, 120);
		});
		pick('#hc-roster-filters').addEventListener('change', (event) => {
			const facet = event.target.name.replace('hc-rf-', '');
			if (facet === 'dept' || facet === 'now') setRosterFacet(facet, event.target.value);
		});
		pick('[data-hc-roster-done]').addEventListener('click', () => {
			const menu = window.bootstrap && window.bootstrap.Dropdown.getInstance(pick('[data-hc-roster-filter-btn]'));
			if (menu) menu.hide();
		});
		root.addEventListener('click', (event) => {
			if (event.target.closest('[data-hc-roster-clear]')) {
				clearRosterFilters();
				return;
			}
			const sorter = event.target.closest('[data-hc-roster-sort]');
			if (sorter) {
				const key = sorter.dataset.hcRosterSort;
				roster.ascending =
					roster.sort === key ? !roster.ascending : key === 'name' || key === 'dept' || key === 'now';
				roster.sort = key;
				paintProviders();
				return;
			}
			const opener = event.target.closest('[data-hc-roster-open]');
			const row = event.target.closest('[data-hc-roster-row]');
			if (opener) openProvider(opener.dataset.hcRosterOpen);
			else if (row && !event.target.closest('a, button')) openProvider(row.dataset.hcRosterRow);
		});
	}

	/** What a provider is doing at 11:20: with a patient in their room,
	 * free between patients, or seeing patients by video with no room. */
	function providerNow(p) {
		const room = clinic.rooms.find((r) => r.who === p.id && r.state === 'busy');
		if (room) return { ...ROSTER_NOW[0], patient: room.patient, since: room.since, room: room.id };
		return p.room ? ROSTER_NOW[1] : ROSTER_NOW[2];
	}

	/** A provider's visits for the period: today's seen, or their share of
	 * the department's week or month by how much of it they book. */
	function providerLoad(p, period = roster.period) {
		if (period === 'today') return { value: p.seen };
		const dept = clinic.departments.find((d) => d.key === p.dept);
		return { value: Math.round(dept[period][0] * providerShare(p)) };
	}

	function providerShare(p) {
		const team = clinic.providers.filter((x) => x.dept === p.dept);
		const booked = team.reduce((sum, x) => sum + x.booked, 0);
		return booked ? p.booked / booked : 1 / team.length;
	}

	/** Opens the quick view on one provider; previous and next step through
	 * the roster as it is drawn. */
	function openProvider(id) {
		const drawer = document.getElementById('hc-prov-drawer');
		if (!drawer || !window.bootstrap) return;
		rosterOpen = roster.shown.length ? [...roster.shown] : [...clinic.providers];
		const index = Math.max(
			0,
			rosterOpen.findIndex((p) => p.id === id),
		);
		if (!rosterStepper && window.Basalt.drawer) {
			/* The length is read on every step, so one binding keeps up with the roster. */
			const length = { valueOf: () => Math.max(1, rosterOpen.length) };
			rosterStepper = window.Basalt.drawer.recordNav(drawer, length, (at) => fillProvider(rosterOpen[at]));
		}
		if (rosterStepper) rosterStepper.go(index, 0);
		else fillProvider(rosterOpen[index]);
		pick('.basalt-drawer-nav', drawer).hidden = rosterOpen.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	/** Fills the quick view for one provider: who, what they are doing now,
	 * today's figures, and their week as a bar chart. */
	function fillProvider(p) {
		const drawer = document.getElementById('hc-prov-drawer');
		const slot = (name) => pick(`[data-hc-pd="${name}"]`, drawer);
		const dept = clinic.departments.find((d) => d.key === p.dept);
		const now = providerNow(p);
		slot('face').dataset.name = p.name.replace(/^Dr\.? /, '');
		paintAvatars(drawer);
		slot('name').textContent = p.name;
		slot('sub').textContent = `${p.role} · ${(p.sites || []).map(([site, days]) => `${site} ${days}`).join('; ')}`;
		slot('page').setAttribute('aria-label', `Open full page: ${p.name}`);
		slot('now').innerHTML =
			now.id === 'with'
				? `<span class="hc-now is-live">${now.name}</span><span><a href="patient-chart.html">${now.patient}</a> in ${now.room}, for ${now.since} minutes.</span>`
				: `<span class="hc-now">${now.name}</span><span>${now.id === 'free' ? `${p.room} is ready for the next patient.` : 'Seeing patients by video, no room booked.'}</span>`;
		const left = p.booked - p.seen;
		slot('tiles').innerHTML = [
			['Seen', p.seen, `of ${p.booked} booked`, 1],
			['Still to see', left, left === 1 ? 'patient today' : 'patients today', 5],
			['Room', p.room || 'None', p.room ? 'Exam room' : 'Video visits', 3],
		]
			.map(
				([label, value, sub, tone]) =>
					`<div class="hc-tile" style="--tone: var(--basalt-series-${tone})"><dt>${label}</dt><dd>${value}</dd><dd class="hc-tile-sub">${sub}</dd></div>`,
			)
			.join('');
		const days = dept.days.slice(0, 5).map((v) => Math.round(v * providerShare(p)));
		const total = days.reduce((sum, v) => sum + v, 0);
		const busiest = WEEKDAYS[days.indexOf(Math.max(...days))];
		slot('week-note').textContent = `${total} visits this week, ${busiest} the busiest day.`;
		const canvas = slot('chart');
		canvas.setAttribute('aria-label', `Visits by day: ${WEEKDAYS.map((d, i) => `${d} ${days[i]}`).join(', ')}`);
		if (!window.Chart) return;
		const spec = { kind: 'bar', title: 'Visits', labels: WEEKDAYS, series: [{ name: 'Visits', data: days }] };
		const draw = () => insightChart(canvas, spec);
		const old = charts.find((entry) => entry.canvas === canvas);
		if (old) {
			if (old.chart) old.chart.destroy();
			old.draw = draw;
			old.chart = draw();
		} else {
			charts.push({ canvas, draw, chart: draw() });
		}
	}

	/** The Message button in the quick view: a short message to the
	 * provider on show, sent with a toast. */
	function wireProviderMessage() {
		const dialog = document.getElementById('hc-prov-message');
		const drawer = document.getElementById('hc-prov-drawer');
		if (!dialog || !drawer || !window.bootstrap) return;
		const form = pick('[data-hc-prov-message]', dialog);
		const text = pick('textarea', form);
		const who = () => rosterOpen[rosterStepper ? rosterStepper.at : 0];
		pick('[data-hc-pd="message"]', drawer).addEventListener('click', () => {
			const p = who();
			pick('#hc-prov-message-title', dialog).textContent = `Message ${clinic.short(p.id)}`;
			pick('[data-hc-pm-sub]', dialog).textContent =
				providerNow(p).id === 'with'
					? 'They are with a patient, so it waits until they step out.'
					: 'It lands in their inbox on the staff app.';
			form.reset();
			form.classList.remove('was-validated');
			window.bootstrap.Modal.getOrCreateInstance(dialog).show();
		});
		dialog.addEventListener('shown.bs.modal', () => text.focus());
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!text.value.trim()) {
				text.focus();
				return;
			}
			const urgent = pick('input[name="when"]:checked', form).value === 'now';
			window.bootstrap.Modal.getOrCreateInstance(dialog).hide();
			toast(
				'success',
				`Sent to ${clinic.short(who().id)}`,
				urgent ? 'Marked urgent, so it buzzes their phone now.' : 'They see it between patients.',
			);
		});
	}

	/* Patient Chart */

	function startPatientChart() {
		const patient = clinic.patient;
		/* Each problem's number is the days to its next step; a click opens
		   the problem in a quick view. */
		const items = patient.problems.map((p) => {
			const days = daysUntil(p.due);
			const when = days === 0 ? 'today' : `in ${days} days`;
			return {
				key: p.key,
				name: p.name,
				organ: p.organ,
				tone: p.tone,
				side: p.side,
				spot: p.spot,
				ring: p.visits,
				count: days === 0 ? 'Now' : days,
				line: `${p.step} ${when}`,
				who: [p.with],
				more: `${p.state} · ${clinic.short(p.with)}`,
				spoken: `${p.name}, ${p.state}. Next: ${p.step} ${when}. Open the problem.`,
			};
		});
		drawBody(pick('[data-hc-stage]'), items, 'problem', null, (organ) =>
			openProblem(patient.problems.find((p) => p.organ === organ).key),
		);
		wireProblems();

		const vitals = pick('[data-hc-vitals]');
		if (vitals) {
			vitals.innerHTML = patient.vitals
				.map((v) => {
					const points = sparkline(v.series);
					const lastY = points.split(' ').pop().split(',')[1];
					return `
						<li class="hc-vital" style="--tone: var(--basalt-series-${v.tone})">
							<span class="hc-vital-head"><span class="hc-vital-name">${v.name}</span>${v.key === 'temp' ? '<span class="hc-vital-when">Taken 11:05</span>' : '<span class="hc-live">Live</span>'}</span>
							<span class="hc-vital-value">${v.value}<small>${v.unit}</small></span>
							<svg viewBox="0 0 100 28" role="img" aria-label="${v.name} over the last eight visits" class="hc-vital-spark"><polyline points="${points}"></polyline><circle cx="100" cy="${lastY}" r="2.5"></circle></svg>
						</li>`;
				})
				.join('');
		}
		liveVitals(vitals);
		const meds = pick('[data-hc-meds]');
		if (meds) {
			const tones = { ok: 'hc-pill-ok', due: 'hc-pill-wait' };
			meds.innerHTML = patient.medications
				.map((m) => {
					const problem = patient.problems.find((p) => p.key === m.for);
					return `
						<tr>
							<td><a href="#meds" class="hc-cell-link">${m.name}</a><span class="hc-who-meta">${m.dose}${problem ? ` · for <a href="#" data-hc-problem-open="${problem.key}">${problem.name.toLowerCase()}</a>` : ''}</span></td>
							<td>${personLink(clinic.provider(m.with).name, 'providers.html', clinic.short(m.with))}</td>
							<td><span class="hc-pill ${tones[m.refill[0]] || ''}">${m.refill[1]}</span>${m.refill[0] === 'due' ? `<button type="button" class="hc-renew" data-hc-renew="${m.name}">Renew</button>` : ''}</td>
						</tr>`;
				})
				.join('');
			paintAvatars(meds);
			meds.addEventListener('click', (event) => {
				const renew = event.target.closest('[data-hc-renew]');
				if (!renew) return;
				renew.closest('td').innerHTML = '<span class="hc-pill hc-pill-ok">Renewed</span>';
				toast('success', 'Renewal sent', `${renew.dataset.hcRenew} goes to her pharmacy for another 90 days.`);
			});
		}
		drawResults(pick('[data-hc-results]'), patient.results);
		const visitsList = pick('[data-hc-visits]');
		if (visitsList) {
			visitsList.innerHTML = patient.visits
				.map(
					(v) => `
						<li>
							<span class="hc-next-time">${v.on}</span>
							<div class="hc-who"><div><span class="hc-who-name">${v.why}</span><span class="hc-who-meta">${clinic.short(v.with)} · ${v.note}</span></div></div>
						</li>`,
				)
				.join('');
		}
		const team = pick('[data-hc-team]');
		if (team) {
			const ids = [patient.gp, ...patient.problems.map((p) => p.with)].filter(
				(id, i, all) => all.indexOf(id) === i,
			);
			team.innerHTML = ids
				.map((id) => {
					const p = clinic.provider(id);
					const why =
						id === patient.gp
							? 'Primary care'
							: patient.problems
									.filter((x) => x.with === id)
									.map((x) => x.name)
									.join(', ');
					return `<li>${avatar(p.name.replace('Dr. ', ''), 'sm')}<span><span class="hc-waits-name">${p.name}</span><span class="hc-waits-meta">${p.role} · ${why}</span></span><a href="providers.html" class="btn btn-outline-secondary btn-sm">Message</a></li>`;
				})
				.join('');
		}
		const upcoming = pick('[data-hc-upcoming]');
		if (upcoming) {
			upcoming.innerHTML = patient.upcoming
				.map(
					(u) => `
						<li>
							<span class="hc-next-time">${u.on}</span>
							<div class="hc-who"><div><span class="hc-who-name">${u.what}</span><span class="hc-who-meta">${clinic.short(u.with)} · ${u.where}</span></div></div>
							<span class="hc-pill ${u.kind === 'video' ? 'hc-pill-info' : ''}">${u.kind === 'video' ? 'Video visit' : 'In person'}</span>
						</li>`,
				)
				.join('');
		}
		wireAiNote();
		const video = pick('[data-hc-video]');
		if (video) {
			video.addEventListener('click', () => {
				toast(
					'info',
					'Video room ready',
					`A link went to ${patient.name.split(' ')[0]} by text. The Telehealth page picks it up from here.`,
				);
			});
		}
	}

	/** The vitals tick like a monitor: every second and a half each value
	 * drifts a little inside a believable band and its line moves on. */
	function liveVitals(host) {
		if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const bands = { hr: [64, 84, 1, 0], bp: [122, 134, 1, 0], spo2: [95, 99, 1, 0], temp: [97.7, 98.8, 0.2, 1] };
		const series = Object.fromEntries(clinic.patient.vitals.map((v) => [v.key, [...v.series]]));
		const low = { bp: 80 };
		let seed = 7;
		const rand = () => {
			seed = (seed * 9301 + 49297) % 233280;
			return seed / 233280;
		};
		setInterval(() => {
			clinic.patient.vitals.forEach((v, i) => {
				const [min, max, step, digits] = bands[v.key];
				const s = series[v.key];
				const next = Math.min(max, Math.max(min, s[s.length - 1] + (rand() - 0.5) * 2 * step));
				s.push(Number(next.toFixed(digits)));
				s.shift();
				const tile = host.children[i];
				/* Temperature is taken by hand; only the monitor's readings move. */
				if (!tile || v.key === 'temp') return;
				const value =
					v.key === 'bp' ? `${Math.round(next)}/${low.bp + Math.round(rand() * 4)}` : next.toFixed(digits);
				pick('.hc-vital-value', tile).innerHTML = `${value}<small>${v.unit}</small>`;
				const points = sparkline(s);
				pick('polyline', tile).setAttribute('points', points);
				pick('circle', tile).setAttribute('cy', points.split(' ').pop().split(',')[1]);
			});
		}, 1500);
	}

	/** The AI note dialog: it "listens" for a moment, then drafts a note
	 * from what the chart already knows about today's visit, section by
	 * section, for the clinician to fix and sign. */
	function wireAiNote() {
		const dialog = pick('[data-hc-ai-dialog]', document);
		if (!dialog || !window.bootstrap) return;
		const patient = clinic.patient;
		const draft = pick('[data-hc-ai-draft]', dialog);
		const status = pick('[data-hc-ai-status]', dialog);
		const save = pick('[data-hc-ai-save]', dialog);
		const first = patient.name.split(' ')[0];
		/* Heidi's knee follow-up everywhere but the appointment page, which is
		   Harold's stress test. */
		const harold = root.dataset.hcPage === 'appointment-details';
		const sections = harold
			? [
					[
						'Reason for the visit',
						'Harold is here for a stress test: tightness in his chest on the stairs since August. Metoprolol was held this morning.',
					],
					[
						'Findings',
						'Resting blood pressure 131/84, heart rate 74. Eleven minutes on the Bruce protocol to 92% of his target rate. No pain, no ST changes, recovery normal.',
					],
					[
						'Assessment',
						'Negative stress test. Chest tightness unlikely to be from the heart; reflux or the knee limiting effort more likely.',
					],
					[
						'Plan',
						'Restart metoprolol tonight. Note to Dr. Pearce to try a reflux medicine for four weeks. No cardiology follow-up needed unless it changes.',
					],
				]
			: [
					[
						'Reason for the visit',
						`${first} is here for her knee follow-up with ${clinic.short('ta')} and a repeat blood pressure reading. She says the swelling is down and she is walking without the brace.`,
					],
					[
						'Findings',
						'Blood pressure 128/82, down from 131/84 in August. Heart rate 72. Oxygen 97%. Left knee: no swelling, full extension, mild tenderness on the inner joint line.',
					],
					[
						'Assessment',
						'Meniscus tear improving with physical therapy. Blood pressure controlled on amlodipine 5 mg. Asthma stable, no change since September 30.',
					],
					[
						'Plan',
						'Continue physical therapy twice a week for four more weeks. Keep amlodipine as is and repeat the reading in two months. Spirometry on October 23 as booked. Repeat fasting glucose with the next labs.',
					],
				];
		let timers = [];
		const stop = () => {
			for (const t of timers) clearTimeout(t);
			timers = [];
		};
		dialog.addEventListener('shown.bs.modal', () => {
			stop();
			draft.innerHTML = '';
			save.disabled = true;
			status.textContent = 'Listening to the visit…';
			sections.forEach(([head, text], i) => {
				timers.push(
					setTimeout(
						() => {
							const block = document.createElement('div');
							block.className = 'hc-ai-section';
							block.innerHTML = `<h3 class="hc-ai-head">${head}</h3><p class="hc-ai-text">${text}</p>`;
							draft.appendChild(block);
							const last = i === sections.length - 1;
							status.textContent = last
								? 'Draft ready. Read it through, change anything, then sign.'
								: `Drafting ${sections[i + 1][0].toLowerCase()}…`;
							if (last) save.disabled = false;
						},
						900 + i * 1100,
					),
				);
			});
		});
		dialog.addEventListener('hidden.bs.modal', stop);
		save.addEventListener('click', () => {
			window.bootstrap.Modal.getOrCreateInstance(dialog).hide();
			const steps = pick('[data-hc-steps]');
			if (harold && steps) {
				steps.insertAdjacentHTML(
					'beforeend',
					'<li class="is-done"><span class="hc-next-time">Note</span><span><span class="hc-who-name">Visit note signed</span><span class="hc-who-meta">Negative stress test. Metoprolol restarts tonight; Dr. Pearce has the note.</span></span></li>',
				);
			}
			const list = pick('[data-hc-visits]');
			if (list) {
				list.insertAdjacentHTML(
					'afterbegin',
					'<li><span class="hc-next-time">Today</span><div class="hc-who"><div><span class="hc-who-name">Knee follow-up and blood pressure</span><span class="hc-who-meta">Dr. Ashby · Swelling down, PT four more weeks. Blood pressure 128/82.</span></div></div><span class="hc-pill hc-pill-ok">Signed</span></li>',
				);
			}
			toast(
				'success',
				'Visit note signed',
				'It is on the chart, and the orders in the plan are now real orders.',
			);
		});
	}

	/* Problems on the chart */

	let problemNav = null;

	/** Days from the demo's today to an ISO date. */
	function daysUntil(iso) {
		return Math.round((Date.parse(`${iso}T12:00`) - Date.parse(`${clinic.asOf}T12:00`)) / 864e5);
	}

	/** The problem quick view: prev and next step through her problems, and
	 * any "for asthma" link on the page opens the same view. */
	function wireProblems() {
		const drawer = pick('#hc-problem-drawer', document);
		if (!drawer || !window.Basalt.drawer) return;
		const list = clinic.patient.problems;
		problemNav = window.Basalt.drawer.recordNav(drawer, list.length, (i) => fillProblem(list[i]));
		root.addEventListener('click', (event) => {
			const link = event.target.closest('[data-hc-problem-open]');
			if (!link) return;
			event.preventDefault();
			openProblem(link.dataset.hcProblemOpen);
		});
		drawer.addEventListener('click', (event) => {
			const act = event.target.closest('[data-hc-problem-act]');
			if (!act) return;
			const p = list[problemNav.at];
			const words = {
				book: [
					'Follow-up booked',
					`${p.step} for ${p.name.toLowerCase()} is booked with ${clinic.short(p.with)}. She gets a text.`,
				],
				note: ['Note added', `Your note is on ${p.name.toLowerCase()} in her record.`],
			}[act.dataset.hcProblemAct];
			window.bootstrap.Offcanvas.getInstance(drawer)?.hide();
			toast('success', words[0], words[1]);
		});
	}

	function openProblem(key) {
		const drawer = pick('#hc-problem-drawer', document);
		if (!drawer || !problemNav) return;
		const at = clinic.patient.problems.findIndex((p) => p.key === key);
		problemNav.go(at, 0);
		window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	/** Writes one problem into the quick view: how it stands, its measure
	 * over time, what treats it, the next step and the last visits. */
	function fillProblem(p) {
		const drawer = pick('#hc-problem-drawer', document);
		const part = (name) => pick(`[data-hc-p="${name}"]`, drawer);
		const days = daysUntil(p.due);
		const m = p.measure;
		const now = m.series.at(-1);
		const points = sparkline(m.series);
		drawer.style.setProperty('--tone', `var(--basalt-series-${p.tone})`);
		part('title').textContent = p.name;
		part('sub').textContent = `Since ${p.since} · ${p.visits} visits this year`;
		part('state').textContent = p.state;
		part('measure').innerHTML =
			`<p class="hc-p-figure"><b>${now}</b> <span>${m.unit}</span></p><p class="hc-p-measure">${m.name}, last five readings</p><svg viewBox="0 0 100 28" preserveAspectRatio="none" preserveAspectRatio="none" role="img" aria-label="${m.name}: ${m.series.join(', ')}" class="hc-vital-spark hc-p-spark"><polyline points="${points}"></polyline><circle cx="100" cy="${points.split(' ').pop().split(',')[1]}" r="2.5"></circle></svg><p class="hc-p-target">${m.target}</p>`;
		part('treats').innerHTML = `${p.treats
			.map((name) => `<li><a href="#meds" class="hc-cell-link">${name}</a></li>`)
			.join(
				'',
			)}<li class="hc-p-by">Looked after by ${personLink(clinic.provider(p.with).name, 'providers.html')}</li>`;
		part('next').innerHTML =
			`<b>${p.step}</b><span>${days === 0 ? 'Today' : `In ${days} days`}, ${new Date(`${p.due}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`;
		part('history').innerHTML = p.history
			.map(
				([on, what, note]) =>
					`<li><span class="hc-next-time">${on}</span><span><span class="hc-who-name">${what}</span><span class="hc-who-meta">${note}</span></span></li>`,
			)
			.join('');
		paintAvatars(drawer);
	}

	/* The body */

	/** Draws the body into the stage's SVG and floats one chip per item
	 * around it. An item names the organ it stands for; organs no item
	 * names are drawn quiet. Pointing at a chip, an organ or its number
	 * lights all three; a click pins that until the next click. `mode`
	 * only prefixes the SVG ids so two bodies can share a page. */
	function drawBody(stage, items, mode, onFocus, onOpen) {
		if (!stage) return;
		const art = pick('[data-hc-figure]', stage);
		const orbit = pick('[data-hc-orbit]', stage);
		art.innerHTML = '';
		orbit.innerHTML = '';
		const top = Math.max(...items.map((it) => it.ring));
		const byOrgan = new Map(items.map((it) => [it.organ, it]));

		const defs = svgNode('defs', {}, art);
		const skin = svgNode('linearGradient', { id: `hc-skin-${mode}`, x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
		svgNode('stop', { offset: '0', class: 'skin-stop-a' }, skin);
		svgNode('stop', { offset: '1', class: 'skin-stop-b' }, skin);
		svgNode('path', { d: bodyOutline(), class: 'body', style: `fill: url(#hc-skin-${mode})` }, art);

		/* Skeleton hints behind the organs: spine, collarbones, pelvis, joints, limbs. */
		const bones = svgNode('g', { class: 'bones' }, art);
		for (let y = 142; y <= 392; y += 12) svgNode('rect', { x: 155, y, width: 10, height: 8, rx: 2 }, bones);
		svgNode(
			'path',
			{ d: 'M100,164 C120,154 140,152 158,156 M220,164 C200,154 180,152 162,156', class: 'bone-line' },
			bones,
		);
		svgNode('path', { d: 'M116,372 C124,400 142,404 160,400 C178,404 196,400 204,372', class: 'bone-line' }, bones);
		svgNode('circle', { cx: 90, cy: 168, r: 9 }, bones);
		svgNode('circle', { cx: 230, cy: 168, r: 9 }, bones);
		svgNode(
			'path',
			{ d: 'M90,176 C80,230 74,300 68,380 M230,176 C240,230 246,300 252,380', class: 'bone-line' },
			bones,
		);
		svgNode(
			'path',
			{
				d: 'M130,404 C128,450 130,500 132,524 M190,404 C192,450 190,500 188,524 M132,536 C132,580 134,620 134,650 M188,536 C188,580 186,620 186,650',
				class: 'bone-line',
			},
			bones,
		);

		const organs = {};
		function organ(name, cls, draw) {
			const item = byOrgan.get(name);
			const heat = item ? (0.4 + 0.6 * (item.ring / top)).toFixed(2) : '0.18';
			const tone = item ? `var(--basalt-series-${item.tone})` : 'var(--basalt-copy-muted)';
			const group = svgNode(
				'g',
				{
					'data-hc-organ': name,
					class: `organ ${cls}${item ? '' : ' is-quiet'}`,
					style: `--tone: ${tone}; --heat: ${heat}`,
				},
				art,
			);
			if (item) {
				group.setAttribute('tabindex', '0');
				group.setAttribute('role', 'button');
				group.setAttribute('aria-label', item.spoken);
			} else {
				group.setAttribute('aria-hidden', 'true');
			}
			draw(group);
			organs[name] = group;
		}

		organ('brain', 'organ-brain', (g) => {
			svgNode(
				'path',
				{
					d: 'M134,70 C130,48 146,36 160,40 C174,36 190,48 186,70 C190,82 178,94 160,94 C142,94 130,82 134,70 Z',
					class: 'organ-fill',
				},
				g,
			);
			svgNode(
				'path',
				{
					d: 'M146,62 C152,54 160,58 162,66 M170,58 C176,64 174,74 166,78 M150,78 C154,84 162,84 166,80 M160,42 L160,92',
					class: 'organ-line',
				},
				g,
			);
		});
		organ('throat', 'organ-throat', (g) => {
			svgNode('path', { d: 'M160,100 L160,142', class: 'organ-tube' }, g);
			svgNode(
				'path',
				{ d: 'M142,118 C138,124 138,134 144,140 M178,118 C182,124 182,134 176,140', class: 'organ-line' },
				g,
			);
			svgNode('path', { d: 'M120,70 C114,64 112,76 116,82 C118,86 122,86 124,82', class: 'organ-line' }, g);
			svgNode('path', { d: 'M200,70 C206,64 208,76 204,82 C202,86 198,86 196,82', class: 'organ-line' }, g);
			svgNode('path', { d: 'M150,104 C154,110 166,110 170,104', class: 'organ-line' }, g);
		});
		organ('lungs', 'organ-lungs', (g) => {
			svgNode(
				'path',
				{
					d: 'M160,142 L160,186 M160,186 C160,194 146,196 142,206 M160,186 C160,194 174,196 178,206',
					class: 'organ-tube',
				},
				g,
			);
			const lungs = svgNode('g', { class: 'lungs' }, g);
			svgNode(
				'path',
				{
					d: 'M152,200 C142,190 120,198 114,226 C106,258 110,296 124,308 C136,318 152,308 152,286 Z',
					class: 'organ-fill',
				},
				lungs,
			);
			svgNode(
				'path',
				{
					d: 'M168,200 C178,190 200,198 206,226 C214,258 210,296 196,308 C184,318 168,308 168,286 Z',
					class: 'organ-fill',
				},
				lungs,
			);
			svgNode(
				'path',
				{ d: 'M124,236 C130,250 134,272 130,296 M196,236 C190,250 186,272 190,296', class: 'organ-line' },
				lungs,
			);
		});
		organ('heart', 'organ-heart', (g) => {
			const heart = svgNode('g', { class: 'heart' }, g);
			svgNode(
				'path',
				{
					d: 'M166,218 C160,204 138,208 140,230 C142,250 162,266 168,276 C176,264 194,250 192,228 C190,210 172,206 166,218 Z',
					class: 'organ-fill',
				},
				heart,
			);
			svgNode('path', { d: 'M154,222 C148,230 150,244 158,252', class: 'organ-line' }, heart);
		});
		organ('gut', 'organ-gut', (g) => {
			svgNode(
				'path',
				{
					d: 'M146,300 C132,296 124,310 130,324 C136,338 158,342 174,334 C186,328 186,314 176,308 C168,304 156,308 146,300 Z',
					class: 'organ-fill',
				},
				g,
			);
			svgNode(
				'path',
				{
					d: 'M124,344 h72 a10,10 0 0 1 0,20 h-72 a10,10 0 0 1 0,-20 Z M124,368 h72 a10,10 0 0 1 0,20 h-72 a10,10 0 0 1 0,-20 Z',
					class: 'organ-fill organ-soft',
				},
				g,
			);
			svgNode(
				'path',
				{ d: 'M118,340 C110,350 110,380 120,392 M202,340 C210,350 210,380 200,392', class: 'organ-line' },
				g,
			);
		});
		organ('joints', 'organ-joints', (g) => {
			svgNode('rect', { x: 153, y: 140, width: 14, height: 262, rx: 5, class: 'organ-fill organ-soft' }, g);
			svgNode('circle', { cx: 131, cy: 528, r: 11, class: 'organ-fill' }, g);
			svgNode('circle', { cx: 189, cy: 528, r: 11, class: 'organ-fill' }, g);
		});
		organ('shoulder', 'organ-shot', (g) => {
			svgNode(
				'path',
				{
					d: 'M60,206 C62,190 76,178 90,180 C94,196 90,224 80,238 C70,236 62,222 60,206 Z',
					class: 'organ-fill',
				},
				g,
			);
			svgNode('circle', { cx: 74, cy: 208, r: 4, class: 'organ-dot' }, g);
		});
		organ('skin', 'organ-skin', (g) => {
			svgNode(
				'path',
				{
					d: 'M246,320 C258,318 270,330 272,348 C272,364 264,376 252,378 C244,366 242,340 246,320 Z',
					class: 'organ-fill',
				},
				g,
			);
			for (const [cx, cy] of [
				[254, 338],
				[262, 350],
				[252, 360],
				[264, 366],
			]) {
				svgNode('circle', { cx, cy, r: 2.5, class: 'organ-dot' }, g);
			}
		});

		/* The count sits on the organ as a small tag, no lines. */
		const tagAt = {
			brain: [186, 60],
			throat: [160, 126],
			lungs: [132, 246],
			heart: [168, 236],
			gut: [156, 320],
			joints: [130, 528],
			shoulder: [74, 214],
			skin: [262, 350],
		};
		const tags = {};
		const tagLayer = svgNode('g', { class: 'tags' }, art);
		for (const item of items) {
			const [x, y] = tagAt[item.organ];
			const label = String(item.count ?? item.ring);
			const width = 16 + label.length * 8;
			const tag = svgNode(
				'g',
				{
					'data-hc-tag': item.organ,
					class: 'tag',
					transform: `translate(${x} ${y})`,
					style: `--tone: var(--basalt-series-${item.tone})`,
					'aria-hidden': 'true',
				},
				tagLayer,
			);
			svgNode('rect', { x: -width / 2, y: -11, width, height: 22, rx: 11, class: 'tag-box' }, tag);
			svgText(tag, 0, 4.5, 'tag-text', label, { 'text-anchor': 'middle' });
			tags[item.organ] = tag;
		}

		/* One chip per item, floating near its organ. */
		const chips = {};
		items.forEach((item, i) => {
			const chip = document.createElement('button');
			chip.type = 'button';
			chip.className = `hc-orb is-${item.side}`;
			chip.setAttribute('data-hc-chip', item.organ);
			chip.setAttribute('aria-label', item.spoken);
			chip.style.setProperty('--tone', `var(--basalt-series-${item.tone})`);
			chip.style.setProperty('--x', `${item.spot[0]}%`);
			chip.style.setProperty('--y', `${item.spot[1]}%`);
			chip.style.setProperty('--size', (0.85 + 0.35 * (item.ring / top)).toFixed(2));
			chip.style.setProperty('--drift', `${(5 + (i % 4) * 0.9).toFixed(1)}s`);
			chip.style.setProperty('--phase', `-${(i * 0.7).toFixed(1)}s`);
			const faces = item.who.map((id) => avatar(clinic.provider(id).name.replace('Dr. ', ''), 'xs')).join('');
			chip.innerHTML = `
				<span class="hc-orb-count">${item.count ?? item.ring}</span>
				<span class="hc-orb-text"><span class="hc-orb-name">${item.name}</span><span class="hc-orb-line">${item.line}</span></span>
				<span class="hc-orb-more"><span class="hc-orb-faces">${faces}</span><span>${item.more}</span></span>`;
			orbit.appendChild(chip);
			chips[item.organ] = chip;
		});

		let pinned = null;
		function tell(organName, on) {
			if (!onFocus) return;
			if (pinned) onFocus(pinned, true);
			else onFocus(on ? organName : null, false);
		}
		function light(organName, on) {
			for (const name of Object.keys(chips)) {
				const lit = (on && name === organName) || name === pinned;
				for (const node of [organs[name], tags[name], chips[name]]) {
					if (node) node.classList.toggle('is-lit', lit);
				}
			}
			art.classList.toggle('has-lit', on || pinned !== null);
			tell(organName, on);
		}
		function pin(organName) {
			/* Where a page gives the items a quick view, a click opens it. */
			if (onOpen) {
				onOpen(organName);
				return;
			}
			pinned = pinned === organName ? null : organName;
			light(organName, pinned !== null);
		}
		function wire(node, organName) {
			node.addEventListener('mouseenter', () => light(organName, true));
			node.addEventListener('mouseleave', () => light(organName, false));
			node.addEventListener('focus', () => light(organName, true));
			node.addEventListener('blur', () => light(organName, false));
			node.addEventListener('click', () => pin(organName));
			node.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					pin(organName);
				}
			});
		}
		for (const item of items) {
			wire(organs[item.organ], item.organ);
			wire(chips[item.organ], item.organ);
			wire(tags[item.organ], item.organ);
		}
	}

	/** The silhouette as one path: the left half as cubic curves from the
	 * crown to the crotch, mirrored for the right half around x = 160. */
	function bodyOutline() {
		const C = 160;
		const half = [
			[
				[140, 20],
				[118, 40],
				[118, 74],
			],
			[
				[118, 96],
				[128, 112],
				[142, 118],
			],
			[
				[142, 126],
				[140, 134],
				[138, 140],
			],
			[
				[118, 146],
				[96, 150],
				[82, 160],
			],
			[
				[66, 172],
				[58, 196],
				[54, 222],
			],
			[
				[50, 254],
				[46, 290],
				[42, 330],
			],
			[
				[39, 356],
				[36, 384],
				[36, 404],
			],
			[
				[36, 424],
				[44, 440],
				[56, 440],
			],
			[
				[66, 440],
				[70, 428],
				[68, 412],
			],
			[
				[70, 386],
				[74, 350],
				[78, 318],
			],
			[
				[84, 286],
				[90, 236],
				[98, 192],
			],
			[
				[100, 220],
				[98, 260],
				[104, 300],
			],
			[
				[104, 330],
				[100, 360],
				[104, 392],
			],
			[
				[104, 430],
				[108, 480],
				[116, 520],
			],
			[
				[116, 560],
				[118, 610],
				[118, 650],
			],
			[
				[116, 664],
				[124, 672],
				[146, 670],
			],
			[
				[152, 668],
				[152, 660],
				[150, 646],
			],
			[
				[150, 610],
				[150, 570],
				[148, 530],
			],
			[
				[148, 496],
				[152, 440],
				[160, 404],
			],
		];
		const mirror = (p) => `${2 * C - p[0]},${p[1]}`;
		const starts = [];
		let d = 'M160,20';
		let prev = [160, 20];
		for (const seg of half) {
			starts.push(prev);
			d += ` C${seg[0]} ${seg[1]} ${seg[2]}`;
			prev = seg[2];
		}
		for (let i = half.length - 1; i >= 0; i -= 1) {
			const seg = half[i];
			d += ` C${mirror(seg[1])} ${mirror(seg[0])} ${mirror(starts[i])}`;
		}
		return `${d} Z`;
	}

	/* Shared lists */

	/** Lab results as table rows, each value on its normal range. */
	/** Her latest results: the test opens it in the Labs tab, and the bar
	 * shows the value against the normal band, read out on hover. */
	function drawResults(body, rows) {
		if (!body) return;
		body.innerHTML = rows
			.map(
				(r) => `
					<tr>
						<td><a href="#labs${r.lab ? `/${r.lab}` : ''}" class="hc-cell-link">${r.test}</a><span class="hc-who-meta">${r.on}</span></td>
						<td class="hc-num">${r.value}</td>
						<td class="hc-col-range"><span role="img" aria-label="${r.spoken}" data-bs-toggle="tooltip" data-bs-title="${r.spoken}" class="hc-range${r.out ? ' is-out' : ''}" data-lo="${r.range[0]}" data-hi="${r.range[1]}" data-at="${r.at}"></span><span class="hc-range-note">${r.spoken}</span></td>
					</tr>`,
			)
			.join('');
		placeRanges(body);
		if (window.Basalt.tips) window.Basalt.tips(body);
	}

	/** The next patients due in a room: the first three as table rows, the
	 * rest counted in the card's foot with a way to the appointments. */
	function drawNextUp(body) {
		if (!body) return;
		const pills = { checked: 'hc-pill-wait', late: 'hc-pill-late', booked: 'hc-pill-info' };
		const shown = clinic.nextUp.slice(0, 3);
		body.innerHTML = shown
			.map(
				(n) => `
					<tr>
						<td><span class="hc-next-time">${n.at}<small>${n.room}</small></span></td>
						<td>${personLink(n.name, 'patient-chart.html')}<span class="hc-who-meta hc-under-person">${n.why.charAt(0).toUpperCase()}${n.why.slice(1)}</span></td>
						<td class="hc-next-with">${personLink(clinic.provider(n.with).name, 'providers.html', clinic.short(n.with))}</td>
						<td><span class="hc-pill ${pills[n.state]}">${n.label}</span></td>
					</tr>`,
			)
			.join('');
		paintAvatars(body);
		const more = clinic.nextUp.length - shown.length;
		const foot = pick('[data-hc-next-foot]');
		if (foot)
			foot.innerHTML = more
				? `${more} more due before noon. <a href="appointments.html">All appointments</a>`
				: 'Nobody else due before noon.';
	}

	/** Appointment details: a way into each part of the patient's record,
	 * standing on its own under the tiles. A part with news today carries
	 * a live dot and a few words, a count stays quiet, the rest are plain
	 * links. A first visit gets what to collect today instead. */
	function drawVisitRecord(name) {
		const host = pick('[data-hc-ad-record]');
		if (!host) return;
		const r = clinic.patientRecord(name);
		const first = !r.since || r.last === 'First visit';
		if (first) {
			const steps = [
				'Photo ID and insurance card scanned',
				'Intake form filled in',
				'Consent signed',
				'Records asked for from their last doctor',
				'Allergies and medicines checked',
			];
			host.classList.add('is-first');
			host.innerHTML = `<p class="hc-ad-record-title"><i class="bi bi-stars" aria-hidden="true"></i>First visit: collect these before they go in</p><ul class="hc-ad-intake">${steps
				.map(
					(step, i) =>
						`<li><input class="form-check-input" type="checkbox" id="hc-ad-intake-${i}"><label for="hc-ad-intake-${i}">${step}</label></li>`,
				)
				.join('')}</ul>`;
			return;
		}
		/* Each part of his record as a tile: its own color, what is in it,
		   and anything that needs a look today in the danger color. */
		const parts = [
			['labs', 'bi-droplet', 'Labs', 'LDL high', true, 7],
			['imaging', 'bi-images', 'Imaging', 'ECG, Aug 19', false, 4],
			['meds', 'bi-capsule', 'Medications', 'One held today', true, 1],
			['history', 'bi-clock-history', 'History', `${r.visits} visits`, false, 2],
		];
		host.innerHTML = `${parts
			.map(
				([tab, icon, label, note, live, tone]) =>
					`<a href="patient-chart.html#${tab}" class="hc-ad-record-link" style="--tone: var(--basalt-series-${tone})"><span class="hc-ad-record-icon" aria-hidden="true"><i class="bi ${icon}"></i></span><span class="hc-ad-record-text"><b>${label}</b><span class="hc-ad-record-note${live ? ' is-live' : ''}">${note}</span></span><i class="bi bi-chevron-right hc-ad-record-go" aria-hidden="true"></i></a>`,
			)
			.join(
				'',
			)}<a href="patient-chart.html" class="hc-ad-record-link is-full"><span class="hc-ad-record-icon" aria-hidden="true"><i class="bi bi-person-vcard"></i></span><span class="hc-ad-record-text"><b>Full record</b><span class="hc-ad-record-note">Every tab</span></span><i class="bi bi-arrow-right hc-ad-record-go" aria-hidden="true"></i></a>`;
	}

	/** The vitals the monitor feeds drift a little every two seconds, as
	 * on the screen in the room; the ones taken by hand stay put, and an
	 * exam saved by hand stops the drift. */
	/* Harold's last six readings of each vital, oldest first, for the
	   little lines under today's figures. */
	const VISIT_TRENDS = {
		hr: [78, 76, 75, 74, 73, 74],
		bp: [146, 138, 136, 134, 132, 131],
		o2: [95, 96, 96, 97, 96, 96],
		kg: [201, 198, 198, 196, 194, 194],
	};

	function liveVisitVitals() {
		const host = pick('[data-hc-ad-vitals]');
		if (!host) return;
		/* Heart rate and oxygen come from the monitor, so their lines keep a
		   rolling window of readings on a fixed band; the other two are one
		   reading each and keep the history that led to it. */
		const bands = { hr: [60, 90, 'bpm'], o2: [92, 100, '%'] };
		const lines = {};
		for (const [key, series] of Object.entries(VISIT_TRENDS)) {
			const cell = pick(`[data-hc-vital="${key}"]`, host);
			if (!cell) continue;
			const live = bands[key];
			cell.insertAdjacentHTML(
				'afterend',
				`<svg viewBox="0 0 100 28" role="img" aria-label="${live ? 'Live readings' : 'Last six readings'}" class="hc-vital-spark"><polyline></polyline><circle cx="100" r="2.5"></circle></svg>`,
			);
			lines[key] = { svg: cell.nextElementSibling, series: [...series] };
			drawVitalLine(lines[key], live);
		}
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		let seed = 11;
		setInterval(() => {
			if (host.dataset.hcExamined) return;
			for (const [key, band] of Object.entries(bands)) {
				const cell = pick(`[data-hc-vital="${key}"]`, host);
				if (!cell || !lines[key]) continue;
				const [min, max, unit] = band;
				const low = key === 'hr' ? 70 : 95;
				const high = key === 'hr' ? 82 : 98;
				seed = (seed * 9301 + 49297) % 233280;
				const now = Number.parseInt(cell.textContent, 10);
				const next = Math.min(high, Math.max(low, now + Math.round((seed / 233280 - 0.5) * 3)));
				cell.innerHTML = `${next}<small>${unit}</small>`;
				lines[key].series = [...lines[key].series.slice(1), next];
				drawVitalLine(lines[key], [min, max]);
			}
		}, 2000);
	}

	/** Draws one vital's line; a live line keeps a fixed band so a beat or two moves it a little, not the whole line. */
	function drawVitalLine(line, band) {
		const values = band ? [...line.series, band[0], band[1]] : line.series;
		const points = sparkline(values).split(' ').slice(0, line.series.length);
		const step = 100 / (line.series.length - 1);
		const spaced = points.map((p, i) => `${(i * step).toFixed(1)},${p.split(',')[1]}`);
		pick('polyline', line.svg).setAttribute('points', spaced.join(' '));
		pick('circle', line.svg).setAttribute('cy', spaced.at(-1).split(',')[1]);
	}

	/* Check-in and booking */

	/* Both dialogs start with the same patient step: typing suggests
	   patients by name or id, or adds a new one; a picked patient shows
	   who they are, their insurance (which can be updated right there) and
	   anything booked today. Changes live in memory. */

	const SELF_PAY = { id: 'self', name: 'Self-pay', covers: 0, copay: 0 };
	const PLANS = [...clinic.cover.plans, SELF_PAY];

	function planOptions(current) {
		return PLANS.map(
			(p) => `<option value="${p.id}"${p.id === current ? ' selected' : ''}>${p.name}</option>`,
		).join('');
	}

	function clockOfMinutes(minutes) {
		const h = 8 + Math.floor(minutes / 60);
		const m = String(minutes % 60).padStart(2, '0');
		return `${h > 12 ? h - 12 : h}:${m} ${h < 12 ? 'am' : 'pm'}`;
	}

	function longDate(iso) {
		return new Date(`${iso}T12:00`).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}

	function lapsed(record) {
		return Boolean(record?.plan && record.until && record.until < clinic.asOf);
	}

	function planOf(record) {
		if (!record || lapsed(record)) return SELF_PAY;
		return PLANS.find((p) => p.id === record.plan) || SELF_PAY;
	}

	/** Today's booking for a name: the provider, the time and why, or null. */
	function bookingFor(name) {
		for (const [id, lane] of Object.entries(clinic.lanes)) {
			const at = lane.findIndex(([, , label, state]) => label === name && state !== 'gone' && state !== 'break');
			if (at < 0) continue;
			const seat = Object.values(clinic.seats).find((s) => s && s.name === name);
			const next = lane[at + 1];
			const why =
				seat?.why || (next && !clinic.register[next[2]] && !next[3] ? next[2].toLowerCase() : 'follow-up');
			return { with: id, at: lane[at][0], why };
		}
		return null;
	}

	function kindFor(why) {
		if (/new/i.test(why)) return 'new';
		if (/check/i.test(why)) return 'check';
		if (/test|draw|ecg|stress|x-ray|scan/i.test(why)) return 'test';
		return 'follow';
	}

	/** The estimate for a visit: the fee, what the insurer pays after the copay, and the patient's part. */
	function estimate(visitId, record, name) {
		const visit = clinic.cover.visits.find((v) => v.id === visitId);
		const plan = planOf(record);
		const insurer = Math.round((visit.fee - plan.copay) * plan.covers);
		const own = visit.fee - insurer;
		const now = plan.id === 'self' ? own : plan.copay;
		const share = Math.round((insurer / visit.fee) * 100);
		const note = lapsed(record)
			? '<p class="hc-ci-warn"><i class="bi bi-exclamation-triangle" aria-hidden="true"></i>Their insurance lapsed, so this is the self-pay price. Update it on the first step.</p>'
			: '';
		const html = `
			${note}
			<p class="hc-ci-cost-lead">About <b>$${own}</b> for ${name ? name.split(' ')[0] : 'them'}</p>
			<div class="hc-ci-split" role="img" aria-label="${plan.name} pays about $${insurer}, the patient about $${own}">
				<span class="is-insurer" style="flex-grow: ${insurer || 0.0001}"></span><span class="is-patient" style="flex-grow: ${own}"></span>
			</div>
			<dl class="hc-ci-sum">
				<div><dt>${visit.name}</dt><dd>$${visit.fee}</dd></div>
				<div><dt><span class="hc-ci-key is-insurer"></span>${plan.name} pays about</dt><dd>$${insurer}${plan.covers ? ` <small>${share}%</small>` : ''}</dd></div>
				<div><dt><span class="hc-ci-key is-patient"></span>Copay at the desk</dt><dd>$${plan.copay}</dd></div>
				<div><dt>Their share later</dt><dd>$${own - plan.copay}</dd></div>
			</dl>
			<p class="hc-ci-fine">An estimate. The insurer decides the final amount after the visit.</p>`;
		return { html, now };
	}

	/**
	 * Wires the patient step inside a dialog form.
	 * @param {HTMLFormElement} form the dialog's form
	 * @param {(record: object) => void} onChoose called when a patient is picked or added
	 * @returns {{ chosen: () => object|null, clear: () => void, recordForCost: () => object|null }}
	 */
	function patientStep(form, onChoose) {
		const find = pick('[data-hc-ci-find]', form);
		const hits = pick('[data-hc-ci-hits]', form);
		const card = pick('[data-hc-ci-card]', form);
		const fresh = pick('[data-hc-ci-new]', form);
		let chosen = null;
		let lit = -1;
		pick('[data-hc-ci-field="plan"]', form).innerHTML = planOptions('hhp');

		function showHits() {
			const q = find.value.trim().toLowerCase();
			if (!q) {
				hits.hidden = true;
				find.setAttribute('aria-expanded', 'false');
				return;
			}
			const names = Object.keys(clinic.register)
				.filter((name) => {
					const lower = name.toLowerCase();
					return (
						lower.startsWith(q) ||
						lower.split(' ').some((part) => part.startsWith(q)) ||
						clinic.register[name].id.toLowerCase().includes(q)
					);
				})
				.slice(0, 5);
			const typed = find.value.trim().replace(/[<>&"]/g, '');
			hits.innerHTML =
				names
					.map((name) => {
						const r = clinic.patientRecord(name);
						const b = bookingFor(name);
						return `<li role="option" id="${form.id || 'hc'}-hit-${r.id.replace('#', '')}" aria-selected="false" data-hc-ci-pick="${name}" class="hc-ci-hit">${avatar(name, 'sm')}<span class="hc-ci-hit-text"><b>${name}</b><small>${r.id} · born ${longDate(r.born)}</small></span>${b ? `<span class="hc-ci-hit-tag">Booked ${clockOfMinutes(b.at)}</span>` : ''}</li>`;
					})
					.join('') +
				`<li role="option" id="${form.id || 'hc'}-hit-new" aria-selected="false" data-hc-ci-pick="" class="hc-ci-hit is-new"><span class="hc-ci-hit-plus" aria-hidden="true"><i class="bi bi-person-plus"></i></span><span class="hc-ci-hit-text"><b>New patient</b><small>Open a chart for “${typed}”</small></span></li>`;
			paintAvatars(hits);
			lit = -1;
			hits.hidden = false;
			find.setAttribute('aria-expanded', 'true');
		}

		function light(at) {
			const options = pickAll('[data-hc-ci-pick]', hits);
			lit = (at + options.length) % options.length;
			options.forEach((option, i) => option.setAttribute('aria-selected', String(i === lit)));
			find.setAttribute('aria-activedescendant', options[lit].id);
		}

		function choose(name) {
			hits.hidden = true;
			find.setAttribute('aria-expanded', 'false');
			find.removeAttribute('aria-activedescendant');
			if (name) {
				chosen = { ...clinic.patientRecord(name), booking: bookingFor(name) };
				find.value = name;
				fresh.hidden = true;
				drawCard();
			} else {
				chosen = { name: find.value.trim(), fresh: true, booking: null, last: 'First visit' };
				card.hidden = true;
				fresh.hidden = false;
				pick('[data-hc-ci-field="born"]', form).focus();
			}
			for (const field of pickAll('[data-hc-ci-field="born"], [data-hc-ci-field="phone"]', form)) {
				field.required = Boolean(chosen.fresh);
			}
			find.setCustomValidity('');
			onChoose(chosen);
		}

		function drawCard() {
			const r = chosen;
			const allergy = r.allergies && r.allergies !== 'None known';
			const insured = lapsed(r)
				? `<span class="hc-ci-state is-off">Lapsed ${longDate(r.until)}</span>`
				: r.plan
					? `<span class="hc-ci-state is-on">Active until ${longDate(r.until)}</span>`
					: '';
			const booked = r.booking
				? `<p class="hc-ci-today"><i class="bi bi-calendar-check" aria-hidden="true"></i>Booked today at <b>${clockOfMinutes(r.booking.at)}</b> with ${clinic.provider(r.booking.with).name}, ${r.booking.why}.</p>`
				: `<p class="hc-ci-today is-none"><i class="bi bi-calendar" aria-hidden="true"></i>Nothing booked today.</p>`;
			card.innerHTML = `
				<header class="hc-ci-card-head">${avatar(r.name, 'md')}<div><b>${r.name}</b><small>${r.id} · ${r.age} years</small></div><a href="patient-chart.html" class="btn btn-outline-secondary btn-sm">Open chart</a></header>
				<dl class="hc-ci-facts">
					<div><dt>Born</dt><dd>${longDate(r.born)}</dd></div>
					<div><dt>Phone</dt><dd>${r.phone}</dd></div>
					<div><dt>Allergies</dt><dd>${allergy ? `<span class="hc-ci-allergy">${r.allergies}</span>` : 'None known'}</dd></div>
					<div><dt>Last visit</dt><dd>${r.last}</dd></div>
				</dl>
				<div class="hc-ci-insurance">
					<div class="hc-ci-ins-text"><span class="hc-ci-ins-label">Insurance</span><b>${r.plan ? PLANS.find((p) => p.id === r.plan)?.name : 'Self-pay'}</b><small>${r.member || 'No card on file'}</small>${insured}</div>
					<button data-hc-ci-edit type="button" class="btn btn-outline-secondary btn-sm">Update</button>
				</div>
				<div class="hc-ci-ins-edit" data-hc-ci-ins-edit hidden>
					<div class="row g-2 align-items-end">
						<div class="col-sm-5"><label class="form-label" for="${form.id}-plan-edit">Insurance</label><select id="${form.id}-plan-edit" class="form-select form-select-sm" data-hc-ci-plan-edit>${planOptions(r.plan || 'self')}</select></div>
						<div class="col-sm-4"><label class="form-label" for="${form.id}-member-edit">Member id</label><input id="${form.id}-member-edit" class="form-control form-control-sm" data-hc-ci-member-edit value="${r.member || ''}" autocomplete="off"></div>
						<div class="col-sm-3"><button data-hc-ci-save type="button" class="btn btn-primary btn-sm w-100">Save</button></div>
					</div>
				</div>
				${booked}`;
			paintAvatars(card);
			card.hidden = false;
		}

		find.addEventListener('input', () => {
			chosen = null;
			card.hidden = true;
			fresh.hidden = true;
			find.setCustomValidity(find.value.trim() ? 'Pick a patient' : '');
			showHits();
		});
		find.addEventListener('keydown', (event) => {
			if (hits.hidden) return;
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				light(lit + (event.key === 'ArrowDown' ? 1 : -1));
			} else if (event.key === 'Enter' && lit >= 0) {
				event.preventDefault();
				choose(pickAll('[data-hc-ci-pick]', hits)[lit].dataset.hcCiPick);
			} else if (event.key === 'Escape') {
				event.stopPropagation();
				hits.hidden = true;
			}
		});
		hits.addEventListener('mousedown', (event) => {
			const hit = event.target.closest('[data-hc-ci-pick]');
			if (!hit) return;
			event.preventDefault();
			choose(hit.dataset.hcCiPick);
		});
		card.addEventListener('click', (event) => {
			if (event.target.closest('[data-hc-ci-edit]')) {
				pick('[data-hc-ci-ins-edit]', card).hidden = false;
				pick('[data-hc-ci-plan-edit]', card).focus();
			}
			if (event.target.closest('[data-hc-ci-save]')) {
				const plan = pick('[data-hc-ci-plan-edit]', card).value;
				chosen.plan = plan === 'self' ? null : plan;
				chosen.member = pick('[data-hc-ci-member-edit]', card).value.trim();
				chosen.until = '2027-09-30';
				if (clinic.register[chosen.name]) {
					Object.assign(clinic.register[chosen.name], {
						plan: chosen.plan,
						member: chosen.member,
						until: chosen.until,
					});
				}
				drawCard();
				onChoose(chosen);
				toast(
					'success',
					'Insurance updated',
					`${chosen.name} is now on ${PLANS.find((p) => p.id === plan).name}.`,
				);
			}
		});

		return {
			chosen: () => chosen,
			/** What the estimate reads: the record, or a new patient's typed plan. */
			recordForCost: () =>
				chosen?.fresh ? { plan: pick('[data-hc-ci-field="plan"]', form).value, until: '2099-01-01' } : chosen,
			clear() {
				chosen = null;
				card.hidden = true;
				fresh.hidden = true;
				hits.hidden = true;
				find.value = '';
				find.setCustomValidity('');
			},
		};
	}

	/* Check-in, on the Front desk: the patient step, the visit (filled in
	   from today's booking), then the estimate and the copay. They take the
	   first empty chair. */
	function wireCheckIn() {
		const form = pick('[data-hc-checkin]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		const withBox = pick('[data-hc-ci-with]', form);
		const kindBox = pick('[data-hc-ci-kind]', form);
		const whyBox = pick('[data-hc-ci-why]', form);
		withBox.innerHTML = clinic.providers
			.filter((p) => p.room)
			.map((p) => `<option value="${p.id}">${p.name}</option>`)
			.join('');
		kindBox.innerHTML = clinic.cover.visits
			.map((v) => `<option value="${v.id}">${v.name} · $${v.fee}</option>`)
			.join('');
		const who = patientStep(form, (record) => {
			const b = record.booking;
			const banner = pick('[data-hc-ci-booked]', form);
			banner.hidden = !b;
			if (b) {
				banner.innerHTML = `<i class="bi bi-calendar-check" aria-hidden="true"></i>Booked at ${clockOfMinutes(b.at)}, so this is filled in from the booking.`;
				withBox.value = b.with;
				whyBox.value = b.why.charAt(0).toUpperCase() + b.why.slice(1);
				kindBox.value = kindFor(b.why);
			} else {
				whyBox.value = '';
				kindBox.value = record.fresh ? 'new' : 'follow';
			}
			drawCost();
		});

		function drawCost() {
			const { html, now } = estimate(kindBox.value, who.recordForCost(), who.chosen()?.name);
			pick('[data-hc-ci-cost]', form).innerHTML = html;
			const collect = pick('[data-hc-ci-collect]', form);
			collect.disabled = now === 0;
			collect.checked = now > 0 && collect.checked;
			pick('[data-hc-ci-collect-label]', form).textContent = now
				? `Take $${now} now`
				: 'Nothing to take at the desk';
			form.dataset.takeNow = now;
		}

		form.addEventListener('change', (event) => {
			if (event.target.closest('[data-hc-ci-kind], [data-hc-ci-field="plan"]')) drawCost();
		});
		form.addEventListener('basalt:steps-done', () => {
			const name = who.chosen().name;
			const withId = withBox.value;
			const why = whyBox.value.trim() || clinic.cover.visits.find((v) => v.id === kindBox.value).name;
			const took = pick('[data-hc-ci-collect]', form).checked ? Number(form.dataset.takeNow) : 0;
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			if (pick('[data-hc-floor]')) {
				let chair = 0;
				while (desk.seats[chair]) chair += 1;
				desk.seats[chair] = { name, with: withId, why: why.toLowerCase(), minutes: 0 };
				paintFrontDesk();
			}
			toast(
				'success',
				`${name} checked in`,
				`Seeing ${clinic.short(withId)}.${took ? ` $${took} taken at the desk.` : ''} They are in the waiting area.`,
			);
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.basaltSteps?.reset();
			who.clear();
		});
		modal.addEventListener('shown.bs.modal', () => pick('[data-hc-ci-find]', form).focus());
		drawCost();
	}

	/* Booking: the patient step, then the next free times by provider
	   (today after now, then next week), the earliest picked to start with,
	   then a summary with the estimate. On Appointments the visit lands on
	   the calendar. */
	const BOOK_DAYS = ['2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];

	/** The next free half hours for a provider, in person or by video,
	 * from now on: a gap today left by a cancellation, then next week,
	 * where most slots are taken. Video has its own hours, evenings up to
	 * seven included, so a provider can be free on video and not in a
	 * room. Visits booked here are taken too. */
	function freeSlots(id, count, how) {
		const out = [];
		const video = how === 'video';
		const mix = (text) => {
			let hash = 2166136261;
			for (const ch of text) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
			return hash >>> 8;
		};
		const taken = (day, m) =>
			visits.some(
				(v) =>
					v.booked &&
					v.provider === id &&
					v.start.toISOString().slice(0, 10) === day &&
					minutesOf(v.start) === m,
			);
		const gap = 240 + (mix(`${id}-${how}-today`) % (video ? 14 : 10)) * 30;
		if (gap > NOW_MINUTES && (gap < 300 || gap >= 360) && !taken(BOOK_DAYS[0], gap)) {
			out.push({ id, day: BOOK_DAYS[0], m: gap });
		}
		for (const day of BOOK_DAYS.slice(1)) {
			for (let m = 0; m < (video ? 660 : 600) && out.length < count; m += 30) {
				if (m >= 300 && m < 360) continue;
				if (mix(`${id}|${how}|${day}|${m}`) % 10 > (video ? 3 : 2) || taken(day, m)) continue;
				out.push({ id, day, m });
			}
		}
		return out.slice(0, count);
	}

	function minutesOf(date) {
		return (date.getHours() - 8) * 60 + date.getMinutes();
	}

	function dayWord(day) {
		if (day === clinic.asOf) return 'Today';
		return new Date(`${day}T12:00`).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
		});
	}

	function wireBooking() {
		const form = pick('[data-hc-book]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		const kindBox = pick('[data-hc-bk-kind]', form);
		const deptBox = pick('[data-hc-bk-dept]', form);
		const withBox = pick('[data-hc-bk-with]', form);
		const slotsBox = pick('[data-hc-bk-slots]', form);
		kindBox.innerHTML = clinic.cover.visits
			.map((v) => `<option value="${v.id}">${v.name} · $${v.fee}</option>`)
			.join('');
		deptBox.innerHTML =
			'<option value="any">Any department</option>' +
			clinic.departments.map((d) => `<option value="${d.key}">${d.name}</option>`).join('');

		/** The providers in the picked department, every one for any. */
		function people() {
			return clinic.providers.filter((p) => deptBox.value === 'any' || p.dept === deptBox.value);
		}

		function fillWith() {
			const keep = withBox.value;
			withBox.innerHTML =
				'<option value="any">First available</option>' +
				people()
					.map((p) => `<option value="${p.id}">${p.name} · ${p.role}</option>`)
					.join('');
			withBox.value = people().some((p) => p.id === keep) ? keep : 'any';
		}
		fillWith();
		const who = patientStep(form, (record) => {
			kindBox.value = record.fresh ? 'new' : 'follow';
			drawSummary();
		});

		function drawSlots() {
			const any = withBox.value === 'any';
			const how = form.elements.how.value;
			const list = any
				? people()
						.flatMap((p) => freeSlots(p.id, 2, how))
						.sort((a, b) => BOOK_DAYS.indexOf(a.day) - BOOK_DAYS.indexOf(b.day) || a.m - b.m)
						.slice(0, 8)
				: freeSlots(withBox.value, 8, how);
			slotsBox.innerHTML = list
				.map(
					(s, i) =>
						`<label class="hc-bk-slot"><input type="radio" name="slot" value="${s.id}|${s.day}|${s.m}" class="visually-hidden"${i === 0 ? ' checked' : ''}><span class="hc-bk-slot-day">${dayWord(s.day)}</span><span class="hc-bk-slot-time">${clockOfMinutes(s.m)}</span>${any ? `<span class="hc-bk-slot-who">${clinic.short(s.id)}</span>` : ''}</label>`,
				)
				.join('');
			drawSummary();
		}

		function picked() {
			const value = form.elements.slot?.value;
			if (!value) return null;
			const [id, day, m] = value.split('|');
			return { id, day, m: Number(m) };
		}

		function drawSummary() {
			const slot = picked();
			const record = who.chosen();
			const how = form.elements.how.value;
			const visit = clinic.cover.visits.find((v) => v.id === kindBox.value);
			pick('[data-hc-bk-summary]', form).innerHTML = `
				<dl class="hc-bk-sum">
					<div><dt>Patient</dt><dd>${record ? record.name : '—'}</dd></div>
					<div><dt>When</dt><dd>${slot ? `${dayWord(slot.day)}, ${clockOfMinutes(slot.m)}` : '—'}</dd></div>
					<div><dt>With</dt><dd>${slot ? clinic.provider(slot.id).name : '—'}</dd></div>
					<div><dt>Visit</dt><dd>${visit.name}, ${how === 'video' ? 'by video' : 'in person'}</dd></div>
				</dl>`;
			pick('[data-hc-bk-cost]', form).innerHTML = estimate(kindBox.value, who.recordForCost(), record?.name).html;
			drawReminder(slot, record, how);
		}

		/* The reminder: one of the clinic's text templates, filled in for
		   this patient and this visit, with when it goes out. */
		const texts = window.Basalt.data.clinicTexts;
		const templateBox = pick('[data-hc-bk-template]', form);
		function drawReminder(slot, record, how) {
			const body = pick('[data-hc-bk-remind-body]', form);
			body.hidden = !pick('[data-hc-bk-remind]', form).checked || !texts;
			if (!texts || body.hidden || !slot) return;
			const hhmm = `${String(8 + Math.floor(slot.m / 60)).padStart(2, '0')}:${String(slot.m % 60).padStart(2, '0')}`;
			const visit = `${slot.day}T${hhmm}`;
			/* Only texts that can still go out before the visit are offered. */
			const now = new Date(`${clinic.asOf}T${clinic.now}`);
			const offered = [
				...texts.byCategory('reminder'),
				...(how === 'video' ? texts.byCategory('video') : []),
			].filter((t) => t.on && texts.sendsAt(t.when, visit) > now);
			const keep = templateBox.value;
			templateBox.hidden = !offered.length;
			templateBox.innerHTML = offered
				.map((t) => `<option value="${t.id}">${t.name}, ${texts.timing(t.when)}</option>`)
				.join('');
			if (offered.some((t) => t.id === keep)) templateBox.value = keep;
			const template = offered.length ? texts.find(templateBox.value) : null;
			const stamp = (date) =>
				`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
			const at = template ? texts.sendsAt(template.when, visit) : null;
			pick('[data-hc-bk-when]', form).textContent = at
				? `Goes out ${at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${texts.clock(stamp(at))}`
				: 'Too close to the visit for a reminder; the booking text still goes out.';
			pick('[data-hc-bk-text]', form).hidden = !template;
			if (!template) return;
			pick('[data-hc-bk-text]', form).textContent = texts.render(template.id, {
				firstName: (record?.name || 'there').split(' ')[0],
				provider: clinic.short(slot.id),
				date: texts.dateLabel(slot.day),
				time: texts.clock(hhmm),
				link: 'harborstreet.clinic/v/4KQ2',
			});
		}

		form.addEventListener('change', (event) => {
			if (event.target.closest('[data-hc-bk-dept]')) fillWith();
			if (event.target.closest('[data-hc-bk-dept], [data-hc-bk-with], [name="how"]')) drawSlots();
			else drawSummary();
		});
		form.addEventListener('basalt:steps-done', () => {
			const slot = picked();
			const record = who.chosen();
			const how = form.elements.how.value;
			const visit = clinic.cover.visits.find((v) => v.id === kindBox.value);
			const start = new Date(`${slot.day}T08:00:00`);
			start.setMinutes(slot.m);
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			if (calendar) {
				visits.push({
					id: `bk-${visits.length}`,
					provider: slot.id,
					title: record.name,
					patient: record.fresh ? clinic.patientRecord(record.name) : record,
					why: visit.name.toLowerCase(),
					start,
					end: new Date(start.getTime() + 30 * 60000),
					state: 'booked',
					booked: true,
					tone: (clinic.providers.findIndex((p) => p.id === slot.id) % 8) + 1,
				});
				calendar.refetchEvents();
				calendar.gotoDate(slot.day);
			}
			toast(
				'success',
				'Visit booked',
				`${record.name} with ${clinic.short(slot.id)}, ${dayWord(slot.day).toLowerCase() === 'today' ? 'today' : dayWord(slot.day)} at ${clockOfMinutes(slot.m)}${how === 'video' ? ' by video' : ''}.${pick('[data-hc-bk-remind]', form).checked && texts && !templateBox.hidden ? ` ${texts.find(templateBox.value)?.name} is set.` : ''}`,
			);
		});
		for (const opener of pickAll('[data-hc-book-open]', document)) {
			opener.addEventListener('click', () => {
				form.elements.how.value = opener.dataset.hcBookOpen === 'video' ? 'video' : 'room';
				deptBox.value = 'any';
				fillWith();
				window.bootstrap.Modal.getOrCreateInstance(modal).show();
			});
		}
		modal.addEventListener('show.bs.modal', drawSlots);
		modal.addEventListener('shown.bs.modal', () => pick('[data-hc-ci-find]', form).focus());
		modal.addEventListener('hidden.bs.modal', () => {
			form.basaltSteps?.reset();
			who.clear();
		});
	}

	/* The other pages */

	/** Provider Schedule: a week of half-hour slots as a grid. */
	/** Provider schedule: one provider's week on FullCalendar. Their visits
	 * by patient, lunch and blocked time shaded; drag across open time to
	 * hold a slot (Undo lets it go), and a visit opens its page. The
	 * searchable select switches provider. */
	function startSchedule() {
		const host = pick('[data-hc-week]');
		const who = pick('[data-hc-ps-who]');
		if (!host || !who || !window.Basalt.calendar) return;
		const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'];
		const named = (label) => clinic.register[label] !== undefined || /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(label);
		const held = [];
		who.innerHTML = clinic.providers
			.filter((p) => clinic.lanes[p.id])
			.map((p) => `<option value="${p.id}">${p.name}</option>`)
			.join('');
		const at = (day, minutes) => {
			const date = new Date(`${day}T08:00:00`);
			date.setMinutes(date.getMinutes() + minutes);
			return date;
		};
		const eventsFor = (id) => {
			const events = [];
			days.forEach((day, d) => {
				(clinic.lanes[id] || []).forEach(([from, length, label, kind], i) => {
					if (kind === 'break' || (d < 4 && (i + d) % 5 === 0)) return;
					events.push({
						id: `${id}-${d}-${i}`,
						title: named(label)
							? label
							: `${clinic.walkIns[(i + d) % clinic.walkIns.length]} · ${label.toLowerCase()}`,
						start: at(day, from),
						end: at(day, from + length),
						url: 'appointment-details.html',
						classNames: [kind === 'gone' ? 'hc-visit-gone' : 'hc-visit-booked'],
					});
				});
				events.push({
					start: at(day, 300),
					end: at(day, 360),
					display: 'background',
					classNames: ['hc-fc-lunch'],
				});
			});
			/* Wednesday mornings go to the clinic's paperwork. */
			events.push({
				start: at(days[2], 0),
				end: at(days[2], 120),
				display: 'background',
				classNames: ['hc-fc-blocked'],
			});
			return [...events, ...held.filter((h) => h.provider === id)];
		};
		const calendar = window.Basalt.calendar(host, {
			now: '2026-10-09T11:20:00',
			initialDate: '2026-10-09',
			initialView: window.matchMedia('(max-width: 767.98px)').matches ? 'listWeek' : 'timeGridWeek',
			headerToolbar: false,
			datesSet: (info) => {
				pick('#hc-ps-title').textContent = info.view.title;
			},
			slotMinTime: '08:00:00',
			slotMaxTime: '18:30:00',
			allDaySlot: false,
			weekends: false,
			selectable: true,
			selectOverlap: false,
			events: (info, ok) => ok(eventsFor(who.value)),
			select: (info) => {
				const slot = {
					id: `held-${held.length + 1}`,
					provider: who.value,
					title: 'Held for a booking',
					start: info.start,
					end: info.end,
					classNames: ['hc-fc-held'],
				};
				held.push(slot);
				calendar.unselect();
				calendar.refetchEvents();
				const when = info.start.toLocaleString('en-US', {
					weekday: 'short',
					hour: 'numeric',
					minute: '2-digit',
				});
				toast(
					'success',
					'Slot held',
					`${when} with ${clinic.short(who.value)} is held for ten minutes; finish it in Appointments.`,
					[
						{
							label: 'Undo',
							onClick: () => {
								held.splice(held.indexOf(slot), 1);
								calendar.refetchEvents();
							},
						},
					],
				);
			},
		});
		const paintHead = () => {
			const p = clinic.provider(who.value);
			pick('[data-hc-ps-desc]').textContent = `${p.name}’s week: visits, lunch and blocked time.`;
			pick('[data-hc-ps-hours]').href = `provider-details.html?id=${p.id}`;
			const count = eventsFor(p.id).filter((e) => e.display !== 'background').length;
			pick('[data-hc-ps-foot]').textContent =
				`${count} visits Monday to Friday. Drag across open time to hold a slot.`;
		};
		who.addEventListener('change', () => {
			calendar.refetchEvents();
			paintHead();
		});
		root.addEventListener('click', (event) => {
			const go = event.target.closest('[data-hc-cal-go]');
			if (!go) return;
			calendar[go.dataset.hcCalGo]();
			go.blur();
		});
		paintHead();
	}

	/* Supplies: what is typed, the facets picked and the sort, plus what
	   has been ordered since the page opened, by item name. */
	const shelf = { query: '', kind: '', state: '', sort: 'cover', ascending: true, ordered: new Map() };
	const STOCK_KINDS = [
		{ id: 'medicine', name: 'Medicines' },
		{ id: 'vaccine', name: 'Vaccines' },
		{ id: 'consumable', name: 'Consumables' },
		{ id: 'lab', name: 'Lab' },
		{ id: 'equipment', name: 'Equipment' },
	];
	const STOCK_STATES = [
		{ id: 'low', name: 'Below reorder point' },
		{ id: 'ordered', name: 'On order' },
		{ id: 'fine', name: 'Fine' },
	];
	/* Which kind each shelf item is, as the spend chart groups them. */
	const STOCK_KIND_OF = {
		'Nitrile gloves, medium': 'consumable',
		'Flu vaccine, 2026': 'vaccine',
		'Amoxicillin 500 mg': 'medicine',
		'ECG electrodes': 'equipment',
		'Saline 0.9%, 500 mL': 'medicine',
		'Albuterol inhalers': 'medicine',
		'Blood tubes, lavender': 'lab',
		'Amlodipine 5 mg': 'medicine',
		'Paper rolls, exam table': 'consumable',
		'Wound dressings, large': 'consumable',
	};
	let shelfTyping = 0;

	/** Supplies & pharmacy: the stock table with its toolbar, the reorder
	 * and stock count dialogs, and the next step on each prescription. */
	function startSupplies() {
		const search = pick('[data-hc-stock-search]');
		if (!search) return;
		search.addEventListener('input', () => {
			clearTimeout(shelfTyping);
			shelfTyping = setTimeout(() => {
				shelf.query = search.value.trim();
				drawStock();
			}, 120);
		});
		pick('#hc-stock-filters').addEventListener('change', (event) => {
			const facet = event.target.name.replace('hc-sf-', '');
			if (facet === 'kind' || facet === 'state') {
				shelf[facet] = event.target.value;
				drawStock();
			}
		});
		pick('[data-hc-stock-done]').addEventListener('click', () => {
			const menu = window.bootstrap && window.bootstrap.Dropdown.getInstance(pick('[data-hc-stock-filter-btn]'));
			if (menu) menu.hide();
		});
		root.addEventListener('click', (event) => {
			if (event.target.closest('[data-hc-stock-clear]')) {
				clearStockFilters();
				return;
			}
			const sorter = event.target.closest('[data-hc-stock-sort]');
			if (sorter) {
				const key = sorter.dataset.hcStockSort;
				shelf.ascending = shelf.sort === key ? !shelf.ascending : true;
				shelf.sort = key;
				drawStock();
				return;
			}
			const reorder = event.target.closest('[data-hc-stock-reorder]');
			if (reorder) openReorder(reorder.dataset.hcStockReorder);
			if (event.target.closest('[data-hc-reorder-open]')) openReorder(null);
			if (event.target.closest('[data-hc-count-open]')) openCount();
			const step = event.target.closest('[data-hc-rx-step]');
			if (step) stepPrescription(step);
		});
		wireReorder();
		wireCount();
		drawStock();
	}

	function stockState(it) {
		if (shelf.ordered.has(it.name)) return 'ordered';
		return it.have < it.point ? 'low' : 'fine';
	}

	/** Draws the stock table: the rows that pass the search and filters in
	 * the chosen order, the count, the filter chips and the sort arrows. */
	function drawStock() {
		const body = pick('[data-hc-stock]');
		const kindName = (it) => STOCK_KINDS.find((k) => k.id === STOCK_KIND_OF[it.name]).name;
		const fits = (it) =>
			(!shelf.kind || STOCK_KIND_OF[it.name] === shelf.kind) &&
			(!shelf.state || stockState(it) === shelf.state) &&
			(!shelf.query ||
				!window.Basalt ||
				!window.Basalt.matchesQuery ||
				window.Basalt.matchesQuery(`${it.name} ${kindName(it)} ${it.unit}`, shelf.query));
		const keys = {
			name: (it) => it.name,
			cover: (it) => it.have / it.point,
			point: (it) => it.point,
			state: (it) => ['low', 'ordered', 'fine'].indexOf(stockState(it)),
		};
		const key = keys[shelf.sort];
		const sign = shelf.ascending ? 1 : -1;
		const shown = clinic.stock.filter(fits).sort((a, b) => {
			const x = key(a);
			const y = key(b);
			const order = typeof x === 'number' ? x - y : x.localeCompare(y);
			return order * sign || a.name.localeCompare(b.name);
		});
		body.innerHTML = shown.length
			? shown.map((it) => stockRow(it, kindName(it))).join('')
			: `<tr class="basalt-empty-row"><td colspan="5">${stockEmpty()}</td></tr>`;
		if (window.Basalt.tips) window.Basalt.tips(body);
		const total = clinic.stock.length;
		pick('[data-hc-stock-count]').textContent =
			shown.length === total ? `${total} items` : `${shown.length} of ${total} items`;
		for (const head of pickAll('[data-hc-stock-th]')) {
			const on = head.dataset.hcStockTh === shelf.sort;
			if (on) head.setAttribute('aria-sort', shelf.ascending ? 'ascending' : 'descending');
			else head.removeAttribute('aria-sort');
			const arrow = shelf.ascending ? 'bi-arrow-up' : 'bi-arrow-down';
			pick('.bi', head).className = `bi ${on ? arrow : 'bi-arrow-down-up hc-list-sort-idle'}`;
		}
		drawStockChips();
	}

	/** One item: its name and kind, the shelf as a bar with the reorder
	 * point marked and the count written, the point, a status and a step. */
	function stockRow(it, kind) {
		const state = stockState(it);
		const pill = {
			low: '<span class="hc-pill hc-pill-late">Low</span>',
			ordered: `<span class="hc-pill hc-pill-info">${shelf.ordered.get(it.name)} on order</span>`,
			fine: '<span class="hc-pill hc-pill-ok">Fine</span>',
		}[state];
		const act = {
			low: `<button data-hc-stock-reorder="${it.name}" type="button" class="btn btn-outline-secondary btn-sm"><i aria-hidden="true" class="bi bi-cart-plus me-1"></i>Reorder</button>`,
			ordered: '<span class="hc-stock-note">Arrives tomorrow</span>',
			fine: '',
		}[state];
		const isDrug = STOCK_KIND_OF[it.name] === 'medicine' || STOCK_KIND_OF[it.name] === 'vaccine';
		const name = isDrug
			? `<a href="prescriptions.html" class="hc-cell-link">${it.name}</a>`
			: `<span class="hc-stock-name">${it.name}</span>`;
		return `
			<tr class="hc-stock-row is-${state}">
				<td class="hc-stock-item">${name}<span class="hc-who-meta">${kind} · in ${it.unit}</span></td>
				<td class="hc-stock-shelf"><span class="hc-stock-meter"><span data-basalt-no-grow role="img" aria-label="${it.have} of ${it.max} ${it.unit}, reorder point ${it.point}" class="hc-stock-bar"><i style="--share: ${Math.round((it.have / it.max) * 100)}%"></i><b style="--at: ${Math.round((it.point / it.max) * 100)}%"></b></span><span class="hc-stock-have">${it.have}<small>of ${it.max}</small></span></span></td>
				<td class="hc-stock-point">${it.point}</td>
				<td class="hc-stock-state">${pill}</td>
				<td class="hc-stock-act">${act}</td>
			</tr>`;
	}

	function stockEmpty() {
		const blank = window.Basalt && window.Basalt.emptyState;
		if (!blank) return 'Nothing matches.';
		if (shelf.query) return blank({ query: shelf.query, noun: 'items' });
		return blank({
			title: 'No item fits these filters',
			text: 'Clear a filter to see the rest of the shelf.',
			icon: 'box-seam',
		}).replace(
			/<\/div>$/,
			'<button data-hc-stock-clear type="button" class="btn btn-sm btn-outline-secondary">Clear filters</button></div>',
		);
	}

	function drawStockChips() {
		const facets = {
			kind: [{ id: '', name: 'Every kind' }, ...STOCK_KINDS],
			state: [{ id: '', name: 'Any' }, ...STOCK_STATES],
		};
		for (const [facet, options] of Object.entries(facets)) {
			pick(`[data-hc-stock-chips="${facet}"]`).innerHTML = options
				.map(
					(o, i) =>
						`<input id="hc-sf-${facet}-${i}" type="radio" name="hc-sf-${facet}" value="${o.id}" class="btn-check"${shelf[facet] === o.id ? ' checked' : ''} /><label for="hc-sf-${facet}-${i}" class="hc-list-chip">${o.name}</label>`,
				)
				.join('');
		}
		const inUse = Object.keys(facets).filter((facet) => shelf[facet]);
		const badge = pick('[data-hc-stock-filter-count]');
		const button = pick('[data-hc-stock-filter-btn]');
		badge.hidden = inUse.length === 0;
		badge.textContent = inUse.length;
		button.classList.toggle('is-on', inUse.length > 0);
		if (!window.Basalt.drawer || !window.Basalt.drawer.applied) return;
		window.Basalt.drawer.applied(
			pick('[data-hc-stock-applied]'),
			inUse.map((facet) => ({
				label: facets[facet].find((o) => o.id === shelf[facet]).name,
				remove: () => {
					shelf[facet] = '';
					drawStock();
				},
			})),
			clearStockFilters,
			button,
		);
	}

	function clearStockFilters() {
		shelf.kind = '';
		shelf.state = '';
		drawStock();
	}

	/** Opens the reorder dialog with every item under its point listed;
	 * from a row only that item starts ticked, from the header all of them. */
	function openReorder(name) {
		const dialog = document.getElementById('hc-reorder');
		if (!dialog || !window.bootstrap) return;
		const low = clinic.stock.filter((it) => stockState(it) === 'low');
		const list = pick('[data-hc-reorder-items]', dialog);
		pick('#hc-reorder-err', dialog).hidden = true;
		pick('#hc-reorder-title', dialog).textContent = name ? `Reorder ${name}` : 'Reorder low stock';
		if (!low.length) {
			toast('info', 'Nothing to reorder', 'Every item is above its reorder point or already on order.');
			return;
		}
		list.innerHTML = low
			.map(
				(it, i) =>
					`<li class="hc-reorder-item"><div class="form-check"><input id="hc-ro-${i}" type="checkbox" name="item" value="${it.name}" class="form-check-input"${!name || name === it.name ? ' checked' : ''} /><label for="hc-ro-${i}" class="form-check-label">${it.name}<small>${it.have} on the shelf, reorder at ${it.point}</small></label></div><label for="hc-ro-q-${i}" class="visually-hidden">Quantity of ${it.name}</label><div class="input-group input-group-sm hc-reorder-qty"><input id="hc-ro-q-${i}" type="number" min="1" max="999" step="1" inputmode="numeric" value="${it.max - it.have}" class="form-control" required /><span class="input-group-text">${it.unit}</span></div></li>`,
			)
			.join('');
		window.bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	function wireReorder() {
		const dialog = document.getElementById('hc-reorder');
		if (!dialog) return;
		const form = pick('[data-hc-reorder]', dialog);
		form.addEventListener('input', (event) => {
			if (event.target.type === 'number') event.target.classList.remove('is-invalid');
			if (event.target.type === 'checkbox') pick('#hc-reorder-err', dialog).hidden = true;
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const picked = [...pickAll('.hc-reorder-item', form)].filter(
				(row) => pick('input[type="checkbox"]', row).checked,
			);
			if (!picked.length) {
				pick('#hc-reorder-err', dialog).hidden = false;
				return;
			}
			const wrong = picked
				.map((row) => pick('input[type="number"]', row))
				.filter((box) => !box.checkValidity() || !box.value);
			for (const box of wrong) box.classList.add('is-invalid');
			if (wrong.length) {
				wrong[0].focus();
				return;
			}
			const lines = picked.map((row) => {
				const it = clinic.stock.find((x) => x.name === pick('input[type="checkbox"]', row).value);
				return [it, Number(pick('input[type="number"]', row).value)];
			});
			for (const [it, qty] of lines) shelf.ordered.set(it.name, `${qty} ${it.unit}`);
			window.bootstrap.Modal.getOrCreateInstance(dialog).hide();
			drawStock();
			const when = pick('input[name="when"]:checked', form).value;
			const from = pick('select', form).value;
			toast(
				'success',
				lines.length === 1 ? `${lines[0][0].name} ordered` : `${lines.length} items ordered`,
				`From ${from}, arriving ${when}.`,
				[
					{
						label: 'Undo',
						onClick: () => {
							for (const [it] of lines) shelf.ordered.delete(it.name);
							drawStock();
						},
					},
				],
			);
		});
	}

	function openCount() {
		const dialog = document.getElementById('hc-count');
		if (!dialog || !window.bootstrap) return;
		const select = pick('#hc-count-item', dialog);
		select.innerHTML = clinic.stock.map((it) => `<option value="${it.name}">${it.name}</option>`).join('');
		const form = pick('[data-hc-count]', dialog);
		form.reset();
		form.classList.remove('was-validated');
		fillCount(dialog);
		window.bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	/** Puts the picked item's current count and unit into the count field. */
	function fillCount(dialog) {
		const it = clinic.stock.find((x) => x.name === pick('#hc-count-item', dialog).value);
		pick('#hc-count-have', dialog).value = it.have;
		pick('[data-hc-count-unit]', dialog).textContent = it.unit;
	}

	function wireCount() {
		const dialog = document.getElementById('hc-count');
		if (!dialog) return;
		const form = pick('[data-hc-count]', dialog);
		const have = pick('#hc-count-have', dialog);
		pick('#hc-count-item', dialog).addEventListener('change', () => fillCount(dialog));
		dialog.addEventListener('shown.bs.modal', () => have.select());
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) {
				have.focus();
				return;
			}
			const it = clinic.stock.find((x) => x.name === pick('#hc-count-item', dialog).value);
			const before = it.have;
			it.have = Number(have.value);
			window.bootstrap.Modal.getOrCreateInstance(dialog).hide();
			drawStock();
			toast(
				'success',
				`${it.name} counted`,
				`${it.have} ${it.unit} on the shelf, ${before === it.have ? 'as expected' : `${before} before the count`}.`,
				[
					{
						label: 'Undo',
						onClick: () => {
							it.have = before;
							drawStock();
						},
					},
				],
			);
		});
	}

	/** Moves a prescription on: ready to collect, collected, or a renewal
	 * request sent to whoever wrote it. */
	function stepPrescription(button) {
		const row = button.closest('[data-hc-rx]');
		const pill = pick('[data-hc-rx-state]', row);
		const cell = button.parentElement;
		const step = button.dataset.hcRxStep;
		const patient = pick('.hc-person-link span:last-child', row).textContent;
		if (step === 'ready') {
			pill.className = 'hc-pill hc-pill-info';
			pill.textContent = 'Ready to collect';
			button.dataset.hcRxStep = 'collected';
			button.textContent = 'Mark collected';
			toast('success', `Ready for ${patient}`, 'A text tells them it can be collected.');
		} else if (step === 'collected') {
			pill.className = 'hc-pill hc-pill-ok';
			pill.textContent = 'Dispensed';
			cell.innerHTML = '<span class="hc-rx-done">Collected just now</span>';
			toast('success', `${patient} collected it`, 'The prescription is closed.');
		} else {
			pill.textContent = 'Renewal asked';
			cell.innerHTML = `<span class="hc-rx-done">Sent to ${button.dataset.hcRxWho}</span>`;
			toast('success', `Renewal sent to ${button.dataset.hcRxWho}`, `It shows on their list for ${patient}.`);
		}
	}

	/** Wards & Beds: Mission Bay Hospital's two wards, every bed a button that opens
	 * the same dialog the front desk uses. */
	/** Admit a patient: a wizard like triage. Find them (or add them), say
	 * where they come from and why, then pick a free bed; the bed fills on
	 * the page, with Undo. */
	function wireAdmit(paint) {
		const form = pick('[data-hc-admit]', document);
		if (!form) return;
		const withBox = pick('[data-hc-ad="with"]', form);
		withBox.innerHTML = `<option value="">On-call hospitalist</option>${clinic.hospital.staff
			.filter((p) => p.unit === 'ward')
			.map((p) => `<option value="${p.id}">${p.name}</option>`)
			.join('')}`;
		const bedBox = pick('[data-hc-ad-beds]', form);
		const fillBeds = () => {
			const free = desk.beds.filter((b) => b.state === 'free');
			bedBox.innerHTML = free.length
				? free
						.map(
							(b, i) =>
								`<input id="hc-ad-b${i}" type="radio" name="bed" value="${b.id}" data-hc-ad="bed" class="btn-check"${i === 0 ? ' checked' : ''}><label for="hc-ad-b${i}" class="hc-tr-spot"><i aria-hidden="true" class="bi bi-hospital"></i>Bed ${b.id}<small>Free</small></label>`,
						)
						.join('')
				: '<p class="hc-quiet mb-0">No bed is free right now; the bed manager can open one.</p>';
		};
		const who = patientStep(form, () => {});
		form.closest('.modal').addEventListener('show.bs.modal', fillBeds);
		form.addEventListener('basalt:steps-done', () => {
			const bedId = pick('[data-hc-ad="bed"]:checked', form)?.value;
			const bed = desk.beds.find((b) => b.id === bedId);
			if (!bed) return;
			const name = who.chosen()?.name || pick('[data-hc-ci-find]', form).value.trim();
			const why = pick('[data-hc-ad="why"]', form).value.trim();
			const from = pick('[data-hc-ad="from"]:checked', form)?.value ?? 'the ER';
			const before = { ...bed };
			Object.assign(bed, { state: 'taken', patient: name, note: why });
			window.bootstrap.Modal.getOrCreateInstance(form.closest('.modal')).hide();
			paint();
			toast('success', `${name} admitted to bed ${bed.id}`, `${why}, from ${from}.`, [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(bed, before);
						paint();
					},
				},
			]);
		});
		form.closest('.modal').addEventListener('hidden.bs.modal', () => {
			who.clear();
			form.basaltSteps?.reset();
			form.classList.remove('was-validated');
			pick('[data-hc-ad="why"]', form).value = '';
		});
	}

	function startWards() {
		const host = pick('[data-hc-wards]');
		if (!host) return;
		const paint = () => {
			const wards = [
				['4 West · medical', desk.beds.slice(0, 6)],
				['5 West · surgical', desk.beds.slice(6)],
			];
			host.innerHTML = wards
				.map(
					([name, beds]) => `
						<section class="hc-ward">
							<h3 class="hc-ward-name">${name}<small>${beds.filter((b) => b.state !== 'free' && b.state !== 'clean').length} of ${beds.length} taken</small></h3>
							<div class="hc-ward-beds">${beds
								.map(
									(b) =>
										`<button data-hc-spot="bed:${b.id}" type="button" class="hc-bed-card is-${b.state}"><b>${b.id}</b><span>${b.patient || (b.state === 'clean' ? 'Being cleaned' : 'Free')}</span><small>${b.patient ? b.note : ''}</small></button>`,
								)
								.join('')}</div>
						</section>`,
				)
				.join('');
		};
		paint();
		host.addEventListener('click', (event) => {
			const spot = event.target.closest('[data-hc-spot]');
			if (spot) openSpot(spot.dataset.hcSpot);
		});
		wireAdmit(paint);
		const dialog = pick('[data-hc-spot-dialog]', document);
		if (dialog) {
			dialog.addEventListener('click', (event) => {
				const button = event.target.closest('[data-hc-act]');
				if (!button) return;
				act(button.dataset.hcAct, button.dataset.hcArg);
				paint();
			});
		}
	}

	/* Emergency: the five triage levels with their target waits in minutes. */
	const TRIAGE = {
		1: { word: 'Resuscitation', tone: 'var(--basalt-danger)', target: 0 },
		2: {
			word: 'Emergency',
			tone: 'color-mix(in srgb, var(--basalt-danger) 50%, var(--basalt-warning))',
			target: 15,
		},
		3: { word: 'Urgent', tone: 'var(--basalt-warning)', target: 30 },
		4: { word: 'Less urgent', tone: 'var(--basalt-success)', target: 60 },
		5: { word: 'Not urgent', tone: 'var(--basalt-flare)', target: 120 },
	};
	const LANE_MINUTES = 64;

	/** The emergency queue and the wait lanes above it, both ticking with
	 * the clock. The queue searches, filters by level from the tiles and
	 * sorts by its heads; a row opens the patient's quick view. Triage adds
	 * a patient, Assign gives one a doctor, Take through removes them. */
	function startEmergency() {
		const body = pick('[data-hc-er]');
		const lanes = pick('[data-hc-lanes]');
		if (!body) return;
		let added = 0;
		const waiting = [...clinic.emergency]
			.sort((a, b) => a.level - b.level || b.waited - a.waited)
			.map((r, at) => ({ ...r, key: `er-${at}` }));
		const started = Date.now();
		const minutes = (r) => r.waited + (Date.now() - started) / 60000;
		const late = (r) => minutes(r) > TRIAGE[r.level].target;
		const across = (m) => `${(Math.min(m, LANE_MINUTES) / LANE_MINUTES) * 100}%`;
		const table = body.closest('table');
		const search = pick('[data-hc-er-search]');
		const count = pick('[data-hc-er-shown]');
		const tiles = pick('[data-hc-er-levels]');
		const state = { query: '', level: 0, sort: 'pos', asc: true, shown: [] };
		const keys = {
			pos: (r) => waiting.indexOf(r),
			name: (r) => r.name.split(' ').pop(),
			wait: (r) => minutes(r),
		};
		const ordered = () =>
			waiting.sort((a, b) => a.level - b.level || minutes(b) - minutes(a) || a.key.localeCompare(b.key));

		function draw() {
			ordered();
			const key = keys[state.sort];
			state.shown = waiting
				.filter(
					(r) =>
						(!state.level || r.level === state.level) &&
						window.Basalt.matchesQuery(
							`${r.name} ${r.why} ${r.where} ${TRIAGE[r.level].word} ${r.with ? clinic.provider(r.with).name : ''}`,
							state.query,
						),
				)
				.sort((x, y) => (key(x) > key(y) ? 1 : key(x) < key(y) ? -1 : 0) * (state.asc ? 1 : -1));
			body.innerHTML = state.shown.length
				? state.shown.map(erRow).join('')
				: `<tr class="basalt-empty-row"><td colspan="6">${window.Basalt.emptyState({
						query: state.query,
						noun: 'patients',
						icon: state.query ? 'search' : 'check2-circle',
						title: state.query ? '' : `Nobody waiting at level ${state.level}`,
						text: state.query ? '' : 'Pick another level, or show every level.',
					})}</td></tr>`;
			count.textContent = `${state.shown.length} of ${waiting.length} waiting`;
			paintAvatars(body);
			if (window.Basalt.tips) window.Basalt.tips(body);
			recount();
			drawDots();
			paint();
		}

		function erRow(r, at) {
			const t = TRIAGE[r.level];
			const who = r.with
				? personLink(clinic.provider(r.with).name, 'providers.html')
				: `<button data-hc-er-assign="${r.key}" type="button" class="btn btn-link btn-sm hc-er-assign">Assign a doctor</button>`;
			return `<tr data-hc-er-row="${at}" class="hc-er-row" style="--tone: ${t.tone}">
				<td class="hc-er-levelcell"><span class="hc-er-level"><b>${r.level}</b><small>${t.word}</small></span></td>
				<td class="hc-er-no">${waiting.indexOf(r) + 1}</td>
				<td>${personLink(r.name, 'patient-chart.html')}<span class="hc-who-meta hc-er-why">${r.why} · ${r.where}</span></td>
				<td class="hc-er-with">${who}</td>
				<td data-hc-er-wait="${r.key}" class="hc-er-wait">${r.waited}:00</td>
				<td><div class="hc-rest-acts"><button data-hc-er-take="${r.key}" type="button" class="btn btn-outline-secondary btn-sm">Take through</button><div class="basalt-row-actions"><button data-hc-er-peek="${at}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view" aria-label="Quick view: ${r.name}" type="button" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-layout-sidebar-inset-reverse"></i></button><a href="patient-chart.html" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page" aria-label="Open full page: ${r.name}" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-arrows-angle-expand"></i></a></div></div></td>
			</tr>`;
		}

		/** One waiting patient for the quick view, read fresh each time. */
		function peekOf(r) {
			const t = TRIAGE[r.level];
			const m = Math.floor(minutes(r));
			const over = m - t.target;
			return {
				name: r.name,
				sub: `Level ${r.level} · ${t.word} · ${r.where}`,
				href: 'patient-chart.html',
				lead: over > 0 ? `${over} minutes past the ${t.target}-minute target.` : 'Within the target wait.',
				facts: [
					['Complaint', r.why],
					['Where', r.where],
					[
						'Seeing',
						r.with ? personLink(clinic.provider(r.with).name, 'providers.html') : 'Not yet assigned',
					],
					['Waiting', `${m} min`],
					['Target', t.target >= 120 ? '2 hours' : `${t.target} min`],
				],
				action: waiting.includes(r) ? { label: 'Take through', run: () => takeThrough(r) } : null,
			};
		}

		function takeThrough(r) {
			waiting.splice(waiting.indexOf(r), 1);
			draw();
			toast(
				'success',
				'Taken through',
				`${r.name}${r.with ? ` is with ${clinic.short(r.with)}` : ' is on the way in'}.`,
			);
		}

		/* The count above the queue and the one on each level's tile. */
		function recount() {
			const words = ['No one', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
			const sub = pick('[data-hc-er-count]');
			if (sub) sub.textContent = `${words[waiting.length] ?? waiting.length} waiting, most urgent first.`;
			for (const tile of pickAll('[data-hc-er-level]', tiles)) {
				const level = Number(tile.dataset.hcErLevel);
				pick('em', tile).textContent = waiting.filter((r) => r.level === level).length;
				tile.setAttribute('aria-pressed', String(state.level === level));
			}
		}

		function drawDots() {
			if (!lanes) return;
			for (const dot of pickAll('[data-hc-dot]', lanes)) dot.remove();
			for (const r of waiting) {
				const dot = document.createElement('button');
				dot.type = 'button';
				dot.className = 'hc-lane-dot';
				dot.dataset.hcDot = r.key;
				dot.textContent = r.name
					.split(' ')
					.map((w) => w[0])
					.join('');
				dot.setAttribute('aria-label', `${r.name}, ${TRIAGE[r.level].word}`);
				pick(`[data-hc-lane="${r.level}"]`, lanes).append(dot);
			}
		}

		if (lanes) {
			lanes.innerHTML =
				Object.entries(TRIAGE)
					.map(([level, t]) => {
						const mark =
							t.target < LANE_MINUTES
								? `<span class="hc-lane-target" style="left: ${across(t.target)}"></span><span class="hc-lane-late" style="left: ${across(t.target)}"></span>`
								: '';
						return `<div class="hc-lane" style="--tone: ${t.tone}"><div class="hc-lane-name"><span>${level}</span><div>${t.word}<small>target ${t.target >= 120 ? '2 h' : `${t.target} min`}</small></div></div><div data-hc-lane="${level}" class="hc-lane-track">${mark}<span class="hc-lane-none">No one waiting</span></div></div>`;
					})
					.join('') +
				`<div class="hc-lane-axis"><div></div><div>${[0, 15, 30, 45, 60].map((m) => `<span style="left: ${across(m)}">${m} min</span>`).join('')}</div></div>`;
			const read = pick('[data-hc-lane-read]');
			const say = (r) => {
				const m = Math.floor(minutes(r));
				const over = m - TRIAGE[r.level].target;
				read.innerHTML = `<b>${r.name}</b> · ${r.why} · waiting ${m} min${over > 0 ? `, <b class="hc-lane-over">${over} over</b>` : ''}`;
			};
			const whose = (event) =>
				waiting.find((r) => r.key === event.target.closest?.('[data-hc-dot]')?.dataset.hcDot);
			lanes.addEventListener('pointerover', (event) => whose(event) && say(whose(event)));
			lanes.addEventListener('focusin', (event) => whose(event) && say(whose(event)));
			lanes.addEventListener('click', (event) => {
				const r = whose(event);
				if (!r) return;
				if (!state.shown.includes(r)) {
					state.query = '';
					state.level = 0;
					search.value = '';
					draw();
				}
				const row = pick(`[data-hc-er-row="${state.shown.indexOf(r)}"]`, body);
				row.scrollIntoView({ behavior: 'smooth', block: 'center' });
				row.classList.remove('is-found');
				void row.offsetWidth;
				row.classList.add('is-found');
			});
		}

		search.addEventListener('input', () => {
			state.query = search.value.trim();
			draw();
		});
		tiles.addEventListener('click', (event) => {
			const tile = event.target.closest('[data-hc-er-level]');
			if (!tile) return;
			const level = Number(tile.dataset.hcErLevel);
			state.level = state.level === level ? 0 : level;
			draw();
		});
		sortHeads(table, state, draw);
		body.addEventListener('click', (event) => {
			const take = event.target.closest('[data-hc-er-take]');
			if (take) {
				takeThrough(waiting.find((r) => r.key === take.dataset.hcErTake));
				return;
			}
			const assign = event.target.closest('[data-hc-er-assign]');
			if (assign) {
				openAssign(waiting.find((r) => r.key === assign.dataset.hcErAssign));
				return;
			}
			const peekButton = event.target.closest('[data-hc-er-peek]');
			const row = event.target.closest('[data-hc-er-row]');
			if (!peekButton && (!row || event.target.closest('a, button'))) return;
			const at = Number(peekButton ? peekButton.dataset.hcErPeek : row.dataset.hcErRow);
			openPeek(
				state.shown.map((r) => () => peekOf(r)),
				at,
			);
		});

		/* Assign a doctor: the hospital's doctors on today, ER first. */
		const assignForm = pick('[data-hc-assign]', document);
		let assigning = null;
		function openAssign(r) {
			if (!assignForm || !window.bootstrap) return;
			assigning = r;
			pick('[data-hc-assign-who]', assignForm).textContent = `${r.name} · ${r.why}`;
			const select = pick('[data-hc-assign-doc]', assignForm);
			select.innerHTML = `<option value="">Choose a doctor</option>${clinic.hospital.staff
				.map((p) => `<option value="${p.id}">${p.name}, ${p.role}</option>`)
				.join('')}`;
			window.bootstrap.Modal.getOrCreateInstance(assignForm.closest('.modal')).show();
		}
		if (assignForm) {
			assignForm.addEventListener('submit', (event) => {
				event.preventDefault();
				assignForm.classList.add('was-validated');
				if (!assignForm.checkValidity() || !assigning) return;
				assigning.with = pick('[data-hc-assign-doc]', assignForm).value;
				window.bootstrap.Modal.getOrCreateInstance(assignForm.closest('.modal')).hide();
				draw();
				toast(
					'success',
					`${clinic.short(assigning.with)} has ${assigning.name}`,
					'Paged with the complaint and the triage level.',
				);
			});
			assignForm.closest('.modal').addEventListener('hidden.bs.modal', () => {
				assignForm.classList.remove('was-validated');
				assignForm.reset();
			});
		}

		/* Triage a patient: a wizard like check-in. Find them (or add them),
		   say what brought them in and the level, then where they wait and
		   who sees them. */
		const triageForm = pick('[data-hc-triage]', document);
		if (triageForm) {
			const withBox = pick('[data-hc-tr="with"]', triageForm);
			withBox.innerHTML = `<option value="">Whoever is free first</option>${clinic.hospital.staff
				.filter((p) => p.unit === 'er')
				.map((p) => `<option value="${p.id}">${p.name}</option>`)
				.join('')}`;
			const who = patientStep(triageForm, () => {});
			triageForm.addEventListener('basalt:steps-done', () => {
				const picked = (name) => pick(`[data-hc-tr="${name}"]:checked`, triageForm)?.value;
				added += 1;
				const r = {
					name: who.chosen()?.name || pick('[data-hc-ci-find]', triageForm).value.trim(),
					why: pick('[data-hc-tr="why"]', triageForm).value.trim(),
					level: Number(picked('level')),
					where: picked('where'),
					with: withBox.value || null,
					waited: -Math.floor((Date.now() - started) / 60000),
					key: `er-new-${added}`,
				};
				waiting.push(r);
				window.bootstrap.Modal.getOrCreateInstance(triageForm.closest('.modal')).hide();
				draw();
				toast(
					r.level <= 2 ? 'warning' : 'success',
					`${r.name} is in the queue`,
					`Level ${r.level}, ${TRIAGE[r.level].word.toLowerCase()}, in ${r.where}: seen within ${TRIAGE[r.level].target >= 120 ? 'two hours' : `${TRIAGE[r.level].target} minutes`}.`,
				);
			});
			triageForm.closest('.modal').addEventListener('hidden.bs.modal', () => {
				who.clear();
				triageForm.basaltSteps?.reset();
				pick('[data-hc-tr="level"][value="3"]', triageForm).checked = true;
				pick('[data-hc-tr="where"]', triageForm).checked = true;
			});
		}

		function paint() {
			for (const r of waiting) {
				const total = Math.max(0, Math.floor(minutes(r) * 60));
				const clock = pick(`[data-hc-er-wait="${r.key}"]`, body);
				if (clock) {
					clock.textContent = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
					clock.classList.toggle('is-late', late(r));
				}
				const dot = lanes && !held && pick(`[data-hc-dot="${r.key}"]`, lanes);
				if (dot) {
					dot.style.left = across(Math.max(0, minutes(r)));
					dot.classList.toggle('is-late', late(r));
				}
			}
			for (const track of pickAll('[data-hc-lane]')) {
				track.classList.toggle('is-empty', !pick('[data-hc-dot]', track));
			}
		}
		/* On first sight each dot runs out along its lane from no wait to
		   its own while the time past the target fills in behind, and a
		   dot over its target turns red as it lands. */
		let held = Boolean(lanes) && !motionStill();
		draw();
		if (held) {
			for (const dot of pickAll('[data-hc-dot]', lanes)) dot.style.left = '0%';
			enter(lanes, pickAll('.hc-lane', lanes), 'draw', () =>
				requestAnimationFrame(() => {
					for (const r of waiting) {
						const dot = pick(`[data-hc-dot="${r.key}"]`, lanes);
						if (!dot) continue;
						dot.style.left = across(Math.max(0, minutes(r)));
						dot.addEventListener('transitionend', () => dot.classList.toggle('is-late', late(r)), {
							once: true,
						});
					}
					setTimeout(() => {
						held = false;
						paint();
					}, 1400);
				}),
			);
		}
		if (motionStill()) return;
		setInterval(paint, 1000);
	}

	/* Lists: sortable heads and the quick view */

	/** Sortable column heads: each th[data-hc-sort] holds a .hc-sort button.
	 * A click sorts by that column, a second click flips the order; the
	 * head carries aria-sort and an arrow, the idle ones a faint two-way
	 * arrow. `state` holds sort and asc; `redraw` paints the rows. */
	function sortHeads(table, state, redraw) {
		const mark = () => {
			for (const th of pickAll('[data-hc-sort]', table)) {
				const on = th.dataset.hcSort === state.sort;
				if (on) th.setAttribute('aria-sort', state.asc ? 'ascending' : 'descending');
				else th.removeAttribute('aria-sort');
				pick('.bi', th).className =
					`bi ${on ? (state.asc ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up hc-sort-idle'}`;
			}
		};
		table.tHead.addEventListener('click', (event) => {
			const button = event.target.closest('.hc-sort');
			if (!button) return;
			const key = button.closest('[data-hc-sort]').dataset.hcSort;
			state.asc = state.sort === key ? !state.asc : true;
			state.sort = key;
			mark();
			redraw();
		});
		mark();
	}

	/* The quick view steps through whatever list opened it last; each
	   entry is a function that returns the record as it stands now. */
	const peek = { list: [], stepper: null };

	/** Opens the quick view on entry `at` of `list`, with previous and
	 * next stepping through the same list. */
	function openPeek(list, at) {
		const drawer = pick('[data-hc-peek]', document);
		if (!drawer || !window.bootstrap) return;
		peek.list = list;
		if (!peek.stepper && window.Basalt.drawer) {
			peek.stepper = window.Basalt.drawer.recordNav(drawer, { valueOf: () => peek.list.length }, (index) =>
				fillPeek(drawer, peek.list[index]()),
			);
			pick('[data-hc-peek-act]', drawer).addEventListener('click', () => {
				const record = peek.list[peek.stepper.at]();
				if (!record.action) return;
				window.bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
				record.action.run();
			});
		}
		if (peek.stepper) peek.stepper.go(at, 0);
		else fillPeek(drawer, list[at]());
		window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	/** Writes one record into the quick view: the face, name and line
	 * under it, the way to the full page, a sentence, the facts, a short
	 * list and the one action that fits. */
	function fillPeek(drawer, record) {
		const face = pick('[data-hc-peek-face]', drawer);
		face.dataset.name = record.name.replace(/^Dr\.? /, '');
		face.textContent = '';
		pick('[data-hc-peek-title]', drawer).textContent = record.name;
		pick('[data-hc-peek-sub]', drawer).textContent = record.sub;
		pick('[data-hc-peek-page]', drawer).href = record.href;
		const lead = pick('[data-hc-peek-lead]', drawer);
		lead.hidden = !record.lead;
		lead.textContent = record.lead || '';
		pick('[data-hc-peek-facts]', drawer).innerHTML = record.facts
			.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
			.join('');
		const more = pick('[data-hc-peek-more]', drawer);
		more.hidden = !record.list || !record.list.length;
		if (!more.hidden) {
			pick('[data-hc-peek-list-title]', more).textContent = record.listTitle;
			pick('[data-hc-peek-list]', more).innerHTML = record.list.map((item) => `<li>${item}</li>`).join('');
			const foot = pick('[data-hc-peek-list-foot]', more);
			foot.hidden = !record.more;
			foot.textContent = record.more || '';
		}
		const button = pick('[data-hc-peek-act]', drawer);
		button.hidden = !record.action;
		if (record.action) button.textContent = record.action.label;
		paintAvatars(drawer);
	}

	/** Buttons that only need to say what they would do, quick filter
	 * chips, the inbox threads, and the find box on list pages. */
	function wireSmallThings() {
		root.addEventListener('click', (event) => {
			const button = event.target.closest('[data-hc-toast]');
			if (button) settle(button);
			const quick = event.target.closest('[data-hc-quick]');
			if (quick) {
				for (const other of pickAll('[data-hc-quick]', quick.parentElement))
					other.setAttribute('aria-pressed', String(other === quick));
				const want = quick.firstChild.textContent.trim().toLowerCase();
				for (const tr of pickAll('.hc-table tbody tr')) {
					const text = tr.textContent.toLowerCase();
					tr.hidden = want !== 'all' && !text.includes(want.split(' ')[0]);
				}
			}
		});
		const find = pick('[data-hc-find]');
		if (find) {
			find.addEventListener('input', () => {
				const q = find.value.trim().toLowerCase();
				for (const tr of pickAll('.hc-table tbody tr'))
					tr.hidden = q !== '' && !tr.textContent.toLowerCase().includes(q);
			});
		}
	}

	/* Patients: the twelve seen most lately, as a list that searches,
	   filters and sorts like the template's other lists. `next` is when
	   the next visit is (for sorting) and how it reads. */
	const PATIENT_LIST = [
		{
			name: 'Heidi Fairley',
			id: '#10427',
			age: 47,
			doctor: 'ev',
			last: '2026-10-02',
			next: ['2026-10-23T09:00', 'Oct 23, spirometry'],
			balance: 0,
		},
		{
			name: 'Harold Merritt',
			id: '#09802',
			age: 70,
			doctor: 'ev',
			last: '2026-08-19',
			next: ['2026-10-09T10:45', 'Today, stress test'],
			balance: 120,
		},
		{
			name: 'Jake Mann',
			id: '#12033',
			age: 29,
			doctor: 'ev',
			last: null,
			next: ['2026-10-09T11:30', 'Today, 11:30 am'],
			balance: 0,
		},
		{
			name: 'Lisa Talley',
			id: '#10715',
			age: 58,
			doctor: 'km',
			last: '2026-09-30',
			next: ['2026-12-02T10:00', 'Dec 2, diabetes review'],
			balance: 0,
		},
		{
			name: 'Walter Buckley',
			id: '#09654',
			age: 72,
			doctor: 'km',
			home: 'Nob Hill Clinic',
			last: '2026-09-30',
			next: ['2026-11-11T09:30', 'Nov 11, follow-up'],
			balance: 340,
		},
		{
			name: 'Joan Allen',
			id: '#09730',
			age: 74,
			doctor: 'pn',
			last: '2026-10-05',
			next: ['2026-10-12T08:30', 'Oct 12, blood draw'],
			balance: 0,
		},
		{
			name: 'Peter Owens',
			id: '#11840',
			age: 43,
			doctor: 'km',
			last: '2026-06-02',
			next: ['2026-10-09T09:00', 'Missed today'],
			balance: 85,
		},
		{
			name: 'Ian Porter',
			id: '#10102',
			age: 66,
			doctor: 'ev',
			last: '2026-05-22',
			next: ['2026-10-09T15:10', 'Today, 3:10 pm'],
			balance: 0,
		},
		{
			name: 'Courtney Thorne',
			id: '#11390',
			age: 31,
			doctor: 'ev',
			last: '2026-08-04',
			next: ['2026-10-09T16:30', 'Today, 4:30 pm'],
			balance: 0,
		},
		{
			name: 'Clayton Bryce',
			id: '#12264',
			age: 5,
			doctor: 'ao',
			last: null,
			next: ['2026-10-09T15:50', 'Today, 3:50 pm'],
			balance: 0,
		},
		{
			name: 'Oliver Hart',
			id: '#10988',
			age: 52,
			doctor: 'ev',
			last: '2025-06-18',
			next: [null, 'None booked'],
			balance: 0,
		},
		{
			name: 'Nancy Benson',
			id: '#10689',
			age: 55,
			doctor: 'km',
			last: '2026-10-01',
			next: ['2026-10-09T16:50', 'Today, 4:50 pm'],
			balance: 60,
		},
	];
	const PATIENT_SHOWS = [
		['', 'All'],
		['today', 'In today'],
		['new', 'New patients'],
		['lapsed', 'No visit in a year'],
		['owing', 'Owing'],
	];
	const patientList = {
		rows: [...PATIENT_LIST],
		shown: [],
		text: '',
		show: '',
		doctor: '',
		sortKey: 'last',
		ascending: false,
		stepper: null,
		stepRows: [],
		fresh: '',
	};

	/** Patients: search, the Filters menu, sortable heads, a quick view per
	 * row and the New patient dialog. */
	function startPatients() {
		const body = pick('[data-hc-pt-rows]');
		if (!body) return;
		const search = pick('[data-hc-pt-search]');
		let typing = 0;
		search.addEventListener('input', () => {
			clearTimeout(typing);
			typing = setTimeout(() => {
				patientList.text = search.value.trim();
				paintPatients();
			}, 120);
		});
		const doctors = [...new Set(PATIENT_LIST.map((p) => p.doctor))];
		pick('[data-hc-pt-chips="show"]').innerHTML = PATIENT_SHOWS.map(([value, label]) =>
			filterChip('show', value, label),
		).join('');
		pick('[data-hc-pt-chips="doctor"]').innerHTML = [['', 'Anyone'], ...doctors.map((id) => [id, doctorShort(id)])]
			.map(([value, label]) => filterChip('doctor', value, label))
			.join('');
		const panel = pick('#hc-pt-filters', document);
		panel.addEventListener('change', (event) => {
			const facet = event.target.name?.replace('hc-pt-f-', '');
			if (facet !== 'show' && facet !== 'doctor') return;
			patientList[facet] = event.target.value;
			paintPatients();
		});
		pick('[data-hc-pt-filter-clear]').addEventListener('click', () => clearPatientFilters(false));
		pick('[data-hc-pt-filter-done]').addEventListener('click', () => {
			window.bootstrap?.Dropdown.getInstance(pick('[data-hc-pt-filter-btn]'))?.hide();
		});
		root.addEventListener('click', (event) => {
			const sorter = event.target.closest('[data-hc-pt-sort]');
			if (sorter) {
				const key = sorter.dataset.hcPtSort;
				if (patientList.sortKey === key) patientList.ascending = !patientList.ascending;
				else {
					patientList.sortKey = key;
					patientList.ascending = key === 'name' || key === 'next';
				}
				paintPatients();
				return;
			}
			if (event.target.closest('[data-hc-pt-clear-all]')) {
				clearPatientFilters(true);
				return;
			}
			const peek = event.target.closest('[data-hc-pt-open]');
			if (peek) {
				openPatient(peek.dataset.hcPtOpen);
				return;
			}
			const row = event.target.closest('[data-hc-pt-row]');
			if (row && !event.target.closest('a, button')) openPatient(row.dataset.hcPtRow);
		});
		wireNewPatient();
		paintPatients();
	}

	function filterChip(facet, value, label) {
		const id = `hc-pt-f-${facet}-${value || 'any'}`;
		return `<input type="radio" class="btn-check" name="hc-pt-f-${facet}" id="${id}" value="${value}"${value === patientList[facet] ? ' checked' : ''}><label class="hc-list-chip" for="${id}">${label}</label>`;
	}

	function clearPatientFilters(withText) {
		patientList.show = '';
		patientList.doctor = '';
		for (const radio of pickAll('#hc-pt-filters input[value=""]', document)) radio.checked = true;
		if (withText) {
			const search = pick('[data-hc-pt-search]');
			search.value = '';
			patientList.text = '';
			search.focus();
		}
		paintPatients();
	}

	function patientShows(p, show) {
		if (show === 'today') return Boolean(p.next[0]?.startsWith(clinic.asOf)) && !p.next[1].startsWith('Missed');
		if (show === 'new') return !p.last;
		if (show === 'lapsed') return Boolean(p.last) && p.last < '2025-10-09';
		if (show === 'owing') return p.balance > 0;
		return true;
	}

	function patientFits(p) {
		const doctor = clinic.provider(p.doctor)?.name || '';
		return (
			patientShows(p, patientList.show) &&
			(!patientList.doctor || p.doctor === patientList.doctor) &&
			window.Basalt.matchesQuery(`${p.name} ${p.id} ${doctor} ${p.next[1]}`, patientList.text)
		);
	}

	/** Missing dates sort last whichever way the column runs. */
	function patientOrder(a, b) {
		const key = patientList.sortKey;
		const way = patientList.ascending ? 1 : -1;
		if (key === 'name') return way * a.name.localeCompare(b.name);
		if (key === 'balance') return way * (a.balance - b.balance) || a.name.localeCompare(b.name);
		const left = key === 'last' ? a.last || (patientList.ascending ? '' : '9999') : a.next[0];
		const right = key === 'last' ? b.last || (patientList.ascending ? '' : '9999') : b.next[0];
		if (!left || !right) return left ? -1 : right ? 1 : 0;
		return way * left.localeCompare(right);
	}

	function paintPatients() {
		const body = pick('[data-hc-pt-rows]');
		patientList.shown = patientList.rows.filter(patientFits).sort(patientOrder);
		const filtered = patientList.show || patientList.doctor;
		if (patientList.shown.length) body.innerHTML = patientList.shown.map(patientRow).join('');
		else {
			const blank = patientList.text
				? window.Basalt.emptyState({
						query: patientList.text,
						noun: 'patients',
						text: filtered
							? 'Check the spelling, or clear the filters as well.'
							: 'Check the spelling, or search by register id.',
					})
				: window.Basalt.emptyState({
						icon: 'funnel',
						title: 'No patient fits these filters',
						text: 'Clear one to see more of the list.',
					});
			const clear = filtered
				? '<div class="hc-list-empty-more"><button type="button" class="btn btn-sm btn-outline-secondary" data-hc-pt-clear-all><i class="bi bi-x-lg me-1" aria-hidden="true"></i>Clear search and filters</button></div>'
				: '';
			body.innerHTML = `<tr class="basalt-empty-row"><td colspan="7">${blank}${clear}</td></tr>`;
		}
		const all = patientList.rows.length;
		const count = patientList.shown.length;
		pick('[data-hc-pt-count]').textContent =
			count === all ? `${all} patients` : `${count} of ${all} ${all === 1 ? 'patient' : 'patients'}`;
		paintSortHeads('[data-hc-pt-th]', 'hcPtTh', patientList);
		paintPatientFilters();
		paintAvatars(body);
		window.Basalt.tips?.(body);
		patientList.fresh = '';
	}

	/** Marks the sorted column and swaps its arrow; the others show the idle pair. */
	function paintSortHeads(selector, key, state) {
		for (const head of pickAll(selector)) {
			const on = head.dataset[key] === state.sortKey;
			if (on) head.setAttribute('aria-sort', state.ascending ? 'ascending' : 'descending');
			else head.removeAttribute('aria-sort');
			pick('.bi', head).className = on
				? `bi ${state.ascending ? 'bi-arrow-up' : 'bi-arrow-down'}`
				: 'bi bi-arrow-down-up hc-sort-idle';
		}
	}

	function paintPatientFilters() {
		const on = [
			patientList.show && {
				label: PATIENT_SHOWS.find(([v]) => v === patientList.show)[1],
				remove: () => {
					patientList.show = '';
					pick('#hc-pt-f-show-any', document).checked = true;
					paintPatients();
				},
			},
			patientList.doctor && {
				label: doctorShort(patientList.doctor),
				remove: () => {
					patientList.doctor = '';
					pick('#hc-pt-f-doctor-any', document).checked = true;
					paintPatients();
				},
			},
		].filter(Boolean);
		const badge = pick('[data-hc-pt-filter-count]');
		badge.hidden = !on.length;
		badge.textContent = on.length;
		pick('[data-hc-pt-filter-btn]').classList.toggle('is-on', on.length > 0);
		window.Basalt.drawer?.applied(
			pick('[data-hc-pt-applied]'),
			on,
			() => clearPatientFilters(false),
			pick('[data-hc-pt-filter-btn]'),
		);
	}

	function patientStatus(p) {
		if (p.balance > 0) return '<span class="hc-pill hc-pill-wait">Owing</span>';
		if (!p.last) return '<span class="hc-pill hc-pill-info">New</span>';
		if (patientShows(p, 'lapsed')) return '<span class="hc-pill">No visit in a year</span>';
		return '<span class="hc-pill hc-pill-ok">Active</span>';
	}

	function shortDate(iso) {
		if (!iso) return 'New patient';
		const date = new Date(`${iso}T12:00`);
		const options = { month: 'short', day: 'numeric' };
		if (iso.slice(0, 4) !== clinic.asOf.slice(0, 4)) options.year = 'numeric';
		return date.toLocaleDateString('en-US', options);
	}

	function patientRow(p) {
		const name = safeText(p.name);
		const doctor = clinic.provider(p.doctor);
		const peek = `<button class="btn btn-icon btn-sm" type="button" data-hc-pt-open="${p.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view" aria-label="Quick view: ${name}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const expand = `<a class="btn btn-icon btn-sm" href="patient-chart.html" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page" aria-label="Open full page: ${name}"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
		return `<tr class="hc-list-row${patientList.fresh === p.id ? ' is-fresh' : ''}" data-hc-pt-row="${p.id}">
			<td><div class="hc-who">${avatar(name, 'sm')}<div><a href="patient-chart.html" class="hc-who-name hc-cell-link">${name}</a><span class="hc-who-meta">${p.id} · ${p.age}</span></div></div></td>
			<td class="hc-pt-col-doctor">${doctor ? personLink(doctor.name, 'providers.html', doctorShort(p.doctor)) : ''}</td>
			<td class="hc-pt-col-last">${shortDate(p.last)}</td>
			<td class="hc-pt-col-next">${p.next[1]}</td>
			<td class="hc-num hc-pt-col-balance">$${p.balance}</td>
			<td class="hc-pt-col-status">${patientStatus(p)}</td>
			<td class="hc-list-col-actions"><div class="basalt-row-actions">${peek}${expand}</div></td>
		</tr>`;
	}

	/** Opens the quick view on one patient; previous and next follow the list as shown. */
	function openPatient(id) {
		const drawer = pick('[data-hc-pt-drawer]', document);
		if (!drawer || !window.bootstrap) return;
		patientList.stepRows = [...patientList.shown];
		let at = patientList.stepRows.findIndex((p) => p.id === id);
		if (at < 0) {
			patientList.stepRows = patientList.rows.filter((p) => p.id === id);
			at = 0;
		}
		if (!patientList.stepper && window.Basalt.drawer) {
			const length = { valueOf: () => Math.max(1, patientList.stepRows.length) };
			patientList.stepper = window.Basalt.drawer.recordNav(drawer, length, (index) =>
				fillPatient(drawer, patientList.stepRows[index]),
			);
		}
		if (patientList.stepper) patientList.stepper.go(at, 0);
		else fillPatient(drawer, patientList.stepRows[at]);
		pick('.basalt-drawer-nav', drawer).hidden = patientList.stepRows.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	function fillPatient(drawer, p) {
		if (!p) return;
		const part = (name) => pick(`[data-hc-pt-d="${name}"]`, drawer);
		const record = clinic.patientRecord(p.name);
		const plan = PLANS.find((x) => x.id === record.plan);
		const doctor = clinic.provider(p.doctor);
		const name = safeText(p.name);
		const first = name.split(' ')[0];
		part('face').innerHTML = avatar(name, 'lg');
		part('name').textContent = p.name;
		part('sub').textContent = `${p.id} · ${p.age} ${p.age === 1 ? 'year' : 'years'}`;
		const owes = p.balance ? ` ${first} owes <strong>$${p.balance}</strong>.` : '';
		const missed = p.next[1].startsWith('Missed');
		part('lead').innerHTML = p.next[0]
			? `${missed ? `${first} <strong>missed today’s visit</strong>.` : `Next visit: <strong>${p.next[1]}</strong>.`}${owes}`
			: `${first} has <strong>nothing booked</strong>; the last visit was ${shortDate(p.last)}.${owes}`;
		const allergy =
			record.allergies && record.allergies !== 'None known'
				? `<span class="hc-pill hc-pill-late">${record.allergies}</span>`
				: 'None known';
		const cover = !plan
			? 'Self-pay'
			: `${plan.name}${lapsed(record) ? ' <span class="hc-pill hc-pill-late">Lapsed</span>' : `, until ${longDate(record.until)}`}`;
		const facts = [
			['Born', longDate(record.born)],
			['Phone', `<a href="tel:${record.phone.replace(/[^+\d]/g, '')}">${record.phone}</a>`],
			['Primary care', doctor ? personLink(doctor.name, 'providers.html') : '—'],
			['Insurance', cover],
			['Allergies', allergy],
			['Home office', p.home || 'Broadway Street Clinic'],
			['Last visit', shortDate(p.last)],
			['Balance', p.balance ? `<a href="invoices.html">$${p.balance} to pay</a>` : 'Nothing owed'],
		];
		part('facts').innerHTML = facts
			.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
			.join('');
		part('actions').innerHTML = [
			'<a href="chat.html" class="btn btn-outline-secondary btn-sm"><i class="bi bi-chat-left-text me-1" aria-hidden="true"></i>Message</a>',
			'<a href="appointments.html" class="btn btn-outline-secondary btn-sm"><i class="bi bi-calendar-plus me-1" aria-hidden="true"></i>Book a visit</a>',
			p.balance
				? '<a href="invoices.html" class="btn btn-outline-secondary btn-sm"><i class="bi bi-credit-card me-1" aria-hidden="true"></i>Take payment</a>'
				: '',
		].join('');
		paintAvatars(drawer);
	}

	/** New patient: they join the register and the top of the list. */
	function wireNewPatient() {
		const form = pick('[data-hc-pt-new]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		pick('[data-hc-pt-new-doctor]', form).innerHTML = clinic.providers
			.filter((p) => p.dept === 'gp' || p.dept === 'ent')
			.map((p) => `<option value="${p.id}">${p.name}</option>`)
			.join('');
		pick('[data-hc-pt-new-plan]', form).innerHTML = planOptions('hhp');
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const data = new FormData(form);
			const name = String(data.get('name')).trim().replace(/\s+/g, ' ');
			const born = String(data.get('born'));
			const age =
				Number(clinic.asOf.slice(0, 4)) -
				Number(born.slice(0, 4)) -
				(born.slice(5) > clinic.asOf.slice(5) ? 1 : 0);
			const id = `HSC-${12400 + patientList.rows.length}`;
			const plan = String(data.get('plan'));
			clinic.register[name] = {
				id,
				age,
				born,
				plan: plan === 'self' ? null : plan,
				member: plan === 'self' ? '' : `${plan.toUpperCase()}-${id.slice(4)}0`,
				until: '2027-09-30',
				phone: String(data.get('phone')).trim(),
				allergies: 'None known',
				last: 'New patient',
			};
			patientList.rows.unshift({
				name,
				id,
				age,
				doctor: String(data.get('doctor')),
				last: null,
				next: [null, 'None booked'],
				balance: 0,
			});
			patientList.fresh = id;
			patientList.sortKey = 'last';
			patientList.ascending = false;
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			clearPatientFilters(false);
			toast('success', 'Patient added', `${name} is on the register as ${id}.`);
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
		});
	}

	/** "Dr. Pearce" for a doctor, the whole name for anyone else. */
	function doctorShort(id) {
		const person = clinic.provider(id);
		return person && !person.name.startsWith('Dr.') ? person.name : clinic.short(id);
	}

	function safeText(value) {
		return String(value ?? '').replace(
			/[&<>"']/g,
			(mark) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[mark],
		);
	}

	/* The analytics band */

	/* Every chart on the page, so a theme change can redraw them in the
	   new colors. */
	const charts = [];

	/** The analytics band: three or four tiles from clinic.insights for
	 * this page, each a small chart with its takeaway written above it. */
	function drawInsights(page) {
		const host = pick('[data-hc-insights]');
		const tiles = clinic.insights[page];
		if (!host || !tiles || !window.Chart) return;
		if (tiles.length === 1 && tiles[0].facts) {
			drawWideInsight(host, tiles[0]);
			return;
		}
		const cols = tiles.length >= 4 ? 'col-12 col-md-6 col-xl-3' : 'col-12 col-md-6 col-xl-4';
		host.innerHTML = tiles
			.map(
				(t, i) => `
					<div class="${cols}">
						<section aria-labelledby="hc-ins-${i}" class="card basalt-box hc-card hc-insight h-100">
							<div class="hc-insight-head">
								<h2 id="hc-ins-${i}" class="hc-insight-title">${t.title}</h2>
								<p class="hc-insight-take">${t.take}</p>
							</div>
							<div class="hc-insight-chart${t.kind === 'ring' ? ' is-ring' : ''}"><canvas data-hc-chart="${i}" role="img" aria-label="${t.title}: ${t.take}"></canvas></div>
							${t.kind === 'ring' ? `<ul class="hc-insight-key">${t.labels.map((l, k) => `<li><span class="hc-legend-key tone-series-${k + 1}"></span>${l}<b>${t.series[0].data[k]}</b></li>`).join('')}</ul>` : ''}
						</section>
					</div>`,
			)
			.join('');
		tiles.forEach((t, i) => {
			const canvas = pick(`[data-hc-chart="${i}"]`, host);
			const draw = () => insightChart(canvas, t, i);
			charts.push({ draw, chart: draw() });
		});
	}

	/** One wide card: a single chart with its takeaway, and beside it the
	 * few figures that matter most, in plain type. */
	function drawWideInsight(host, t) {
		host.innerHTML = `
			<div class="col-12">
				<section aria-labelledby="hc-ins-0" class="card basalt-box hc-card hc-insight hc-insight-wide">
					<div class="hc-insight-wide-main">
						<div class="hc-insight-head">
							<h2 id="hc-ins-0" class="hc-insight-title">${t.title}</h2>
							<p class="hc-insight-take">${t.take}</p>
						</div>
						<div class="hc-insight-chart"><canvas data-hc-chart="0" role="img" aria-label="${t.title}: ${t.take}"></canvas></div>
						<ul class="hc-insight-key">${t.series.map((x, k) => `<li><span class="hc-legend-key tone-series-${k + 1}"></span>${x.name}<b>${x.data.reduce((sum, v) => sum + v, 0)}</b></li>`).join('')}</ul>
					</div>
					<dl class="hc-insight-facts">${t.facts
						.map(
							([label, value, note]) =>
								`<div><dt>${label}</dt><dd class="hc-insight-fact">${value}</dd><dd class="hc-insight-note">${note}</dd></div>`,
						)
						.join('')}</dl>
				</section>
			</div>`;
		const canvas = pick('[data-hc-chart="0"]', host);
		const draw = () => insightChart(canvas, t, 0);
		charts.push({ draw, chart: draw() });
	}

	function tokens() {
		const token = (n, f) => (window.Basalt.token ? window.Basalt.token(n, f) : f);
		const text = token('--basalt-copy', '#12233a');
		const rgb = /^#([0-9a-f]{6})$/i.exec(text.trim());
		const n = rgb ? parseInt(rgb[1], 16) : 0x12233a;
		return {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => token(`--basalt-series-${k}`, '#2b6fd4')),
			text,
			quiet: token('--basalt-copy-muted', '#5f7186'),
			surface: token('--basalt-plane', '#ffffff'),
			hue: token('--basalt-hue', '#6d3fe0'),
			danger: token('--basalt-danger', '#c0395b'),
			border: token('--basalt-edge-strong', '#d0d7e2'),
			grid: `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, .08)`,
		};
	}

	/* Each tile in the band starts on its own step of the chart ramp, so
	   neighbors never share a color; a ranked bar list gives every bar its
	   own step. */
	const TILE_TONES = [0, 4, 2, 6];

	/** One small chart in the template's colors; at is the tile's place in the band. */
	function insightChart(canvas, t, at = 0) {
		const c = tokens();
		const font = { family: "'Schibsted Grotesk', sans-serif", size: 11 };
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const unit = t.unit || '';
		const fmt = (v) => (unit === '$' ? `$${v}` : unit === 'k' ? `$${v}k` : `${v}${unit}`);
		const ring = t.kind === 'ring';
		const horizontal = t.kind === 'hbar';
		const line = t.kind === 'line';
		const datasets = t.series.map((s, i) => {
			const base = TILE_TONES[at % TILE_TONES.length] + i;
			const color = t.colors
				? t.colors.map((k) => (k === 'danger' ? c.danger : c.hue))
				: ring || (horizontal && t.series.length === 1)
					? t.labels.map((_, k) => c.series[k % c.series.length])
					: c.series[base % c.series.length];
			if (line) {
				return {
					label: s.name,
					data: s.data,
					borderColor: color,
					backgroundColor: color,
					borderWidth: 2,
					pointRadius: 2.5,
					pointHoverRadius: 4,
					tension: 0.35,
					fill: false,
				};
			}
			return {
				label: s.name,
				data: s.data,
				backgroundColor: color,
				borderColor: ring ? c.surface : c.surface,
				borderWidth: ring ? 2 : 0,
				hoverOffset: ring ? 8 : 0,
				borderRadius: ring ? 0 : 4,
				maxBarThickness: 26,
			};
		});
		const scale = {
			grid: { color: c.grid, drawBorder: false },
			ticks: { color: c.quiet, font },
			border: { display: false },
		};
		return new window.Chart(canvas, {
			type: ring ? 'doughnut' : line ? 'line' : 'bar',
			data: { labels: t.labels, datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				indexAxis: horizontal ? 'y' : 'x',
				animation: reduced ? false : { duration: 500, easing: 'easeOutQuart' },
				cutout: ring ? '68%' : undefined,
				interaction: { mode: ring ? 'nearest' : 'index', intersect: ring },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: c.surface,
						titleColor: c.text,
						bodyColor: c.text,
						borderColor: c.border,
						borderWidth: 1,
						padding: 8,
						cornerRadius: 8,
						usePointStyle: true,
						titleFont: { family: font.family, size: 12, weight: '600' },
						bodyFont: { family: font.family, size: 12 },
						callbacks: { label: (item) => `${item.dataset.label || item.label}: ${fmt(item.raw)}` },
					},
				},
				scales: ring
					? {}
					: horizontal
						? {
								x: {
									...scale,
									beginAtZero: true,
									ticks: { ...scale.ticks, callback: (v) => fmt(v), maxTicksLimit: 5 },
								},
								y: { ...scale, grid: { ...scale.grid, display: false } },
							}
						: {
								x: { ...scale, stacked: Boolean(t.stacked), grid: { ...scale.grid, display: false } },
								y: {
									...scale,
									stacked: Boolean(t.stacked),
									beginAtZero: !line,
									ticks: { ...scale.ticks, callback: (v) => fmt(v), maxTicksLimit: 5 },
								},
							},
			},
		});
	}

	document.addEventListener('basalt:appearance', () => {
		for (const entry of charts) {
			if (entry.chart) entry.chart.destroy();
			entry.chart = entry.draw();
		}
	});

	/* Entrances */

	/* What plays once as a list or detail page opens. rise: [block, items]
	   pairs whose items rise in one after another; draw: pairs whose
	   block draws itself in by its own styles, each item told its place
	   as --enter-i; count: the headline figures that run up from zero. */
	const ENTRANCES = {
		patients: { rise: [['[data-hc-pt-rows]', ':scope > tr']], count: '.hc-insight-key b' },
		'visit-notes': { rise: [['[data-hco-body]', ':scope > tr']], count: '.hc-insight-key b' },
		prescriptions: {
			rise: [
				['[data-hco-renewals]', ':scope > tr'],
				['[data-hco-body]', ':scope > tr'],
			],
			count: '.hc-insight-key b',
		},
		referrals: {
			rise: [
				['[data-hco-stages]', ':scope > li'],
				['[data-hco-body]', ':scope > tr'],
			],
			count: '.hc-insight-key b, .hco-stage-value',
		},
		providers: {
			rise: [['[data-hc-providers]', ':scope > tr']],
			draw: [
				['[data-hc-dept-stats]', '.hc-stat-days > span'],
				['[data-hc-stage]', '.hc-orb'],
			],
			count: '[data-hc-dept-stats] .hc-stat-value',
		},
		'provider-schedule': { draw: [['[data-hc-week]', '.fc-timegrid-event-harness']], count: '.hc-insight-key b' },
		telehealth: {
			rise: [
				['[data-hc-vl-body]', ':scope > tr'],
				['[aria-labelledby="hc-th-wait-title"]', '.hc-th-waits > li'],
			],
			draw: [['[data-hc-call]', '.hc-call-stage > *']],
		},
		'claim-details': {
			rise: [
				['.hc-cd-lines tbody', ':scope > tr'],
				['[data-hc-cd-fix]', ':scope > li'],
			],
			draw: [['.hc-cd-path', ':scope > li']],
			count: '.hc-tile > dd:not(.hc-tile-sub)',
		},
		supplies: {
			rise: [
				['[data-hc-stock]', ':scope > tr'],
				['[aria-labelledby="hc-sup-rx-title"] tbody', ':scope > tr'],
			],
			count: '.hc-insight-key b',
		},
		wards: {
			rise: [
				['[data-hc-wards]', '.hc-bed-card'],
				['[aria-labelledby="hc-wd-look-title"]', '.hc-waits > li'],
				['[aria-labelledby="hc-wd-home-title"]', '.hc-next > li'],
			],
		},
		emergency: {
			rise: [
				['[data-hc-er-levels]', ':scope > button'],
				['[data-hc-er]', ':scope > tr'],
			],
			count: '[data-hc-er-levels] em',
		},
	};

	function playEntrances(page) {
		const plan = ENTRANCES[page];
		if (!plan || motionStill()) return;
		for (const [block, items] of plan.rise || []) {
			const host = pick(block);
			if (host) enter(host, pickAll(items, host), 'rise');
		}
		for (const [block, items] of plan.draw || []) {
			const host = pick(block);
			if (host) enter(host, pickAll(items, host), 'draw');
		}
		/* Only an amount or a count runs up; a date like "Oct 16" stays. */
		for (const figure of plan.count ? pickAll(plan.count) : []) {
			if (/^\$?[0-9]/.test(figure.textContent.trim())) onSight(figure, () => window.Basalt.countUp?.([figure]));
		}
		/* A week runs left to right, each day top to bottom. */
		for (const event of page === 'provider-schedule' ? pickAll('[data-hc-week] .fc-timegrid-event-harness') : []) {
			const day = event.closest('.fc-timegrid-col');
			const top = event.offsetTop / Math.max(1, event.offsetParent?.offsetHeight || 1);
			event.style.setProperty(
				'--enter-i',
				[...day.parentElement.children].indexOf(day) * 3 + Math.round(top * 6),
			);
		}
	}

	/**
	 * Plays a block's entrance once. The block carries is-entering, and
	 * is-unseen holds it on its first frame until it scrolls into view;
	 * each item gets its place as --enter-i (the first twelve), and with
	 * 'rise' the class that lifts it in. Everything is cleared once it
	 * has landed, so a later redraw arrives as it is.
	 * @param {Element} host
	 * @param {Element[]} items
	 * @param {'rise' | 'draw'} how
	 * @param {Function} [seen] called as the block comes into view
	 */
	function enter(host, items, how, seen) {
		const moving = items.slice(0, 12);
		moving.forEach((el, i) => {
			el.style.setProperty('--enter-i', i);
			if (how === 'rise') el.classList.add('hc-rise');
		});
		host.classList.add('is-entering', 'is-unseen');
		onSight(host, () => {
			host.classList.remove('is-unseen');
			if (seen) seen();
			setTimeout(() => {
				host.classList.remove('is-entering');
				for (const el of moving) el.classList.remove('hc-rise');
			}, 1800);
		});
	}

	/** Runs once the element first shows above the bottom edge of the screen. */
	function onSight(el, run) {
		if (!window.IntersectionObserver) {
			run();
			return;
		}
		const sight = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				sight.disconnect();
				run();
			},
			{ rootMargin: '0px 0px -12% 0px' },
		);
		sight.observe(el);
	}

	function motionStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/* The wave: a host's items lift and light up in their tone one after
	   another, 45ms apart, then settle back. Used when the monitor first
	   comes into view and when the rest of today is filtered or sorted. */
	function wave(host, items) {
		if (!host || !items.length || motionStill()) return;
		items.forEach((item, i) => item.style.setProperty('--wave-i', i));
		host.classList.remove('is-waving');
		void host.offsetWidth;
		host.classList.add('is-waving');
		clearTimeout(host.waveTimer);
		host.waveTimer = setTimeout(() => host.classList.remove('is-waving'), items.length * 45 + 500);
	}

	/* The monitor's first look, once the page has settled and a quarter
	   of the card is in view: every trace draws in with what is still to
	   come already in place, one quick wave runs down the rows and the
	   rest of today follows. A pointer, focus or key on the monitor or the
	   table ends it at once and leaves everything finished, so a reader who
	   reaches for it never waits on it or sees it fight back. */
	function introWhenSeen(host) {
		if (!host) return;
		const table = pick('[data-hc-rest]')?.closest('table');
		const hosts = [host, table].filter(Boolean);
		const timers = [];
		const quit = new AbortController();
		let over = false;
		function done() {
			over = true;
			timers.forEach(clearTimeout);
			quit.abort();
		}
		function finish() {
			if (over) return;
			done();
			for (const node of hosts) {
				clearTimeout(node.waveTimer);
				node.classList.remove('is-waving', 'is-waiting', 'is-drawing-in');
			}
		}
		for (const node of hosts) {
			for (const type of ['pointerover', 'pointerdown', 'focusin', 'keydown']) {
				node.addEventListener(type, finish, { signal: quit.signal, passive: true });
			}
		}
		function start() {
			if (over) return;
			host.classList.remove('is-waiting');
			if (motionStill()) return done();
			const rows = pickAll('.hc-trace', host);
			const lines = table ? pickAll('tbody tr:not(.basalt-empty-row)', table) : [];
			timers.push(
				setTimeout(() => {
					wave(host, rows);
					if (table) timers.push(setTimeout(() => wave(table, lines), 250));
				}, 650),
				setTimeout(done, 650 + 250 + lines.length * 45 + 600),
			);
		}
		(window.Basalt.settled || Promise.resolve()).then(() => {
			if (over) return;
			if (!window.IntersectionObserver) return start();
			const sight = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					sight.disconnect();
					start();
				},
				{ threshold: 0.25 },
			);
			sight.observe(host);
			quit.signal.addEventListener('abort', () => sight.disconnect());
		});
	}

	/* Small helpers */

	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function svgNode(name, attrs, parent) {
		const node = document.createElementNS(SVG, name);
		for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
		if (parent) parent.appendChild(node);
		return node;
	}

	function svgText(parent, x, y, cls, value, extra = {}) {
		const node = svgNode('text', { x, y, class: cls, ...extra }, parent);
		node.textContent = value;
		return node;
	}

	/** A person as the template shows people: a small avatar and the name,
	 * one link. Patients go to their chart, staff to Providers. Call
	 * paintAvatars on the container once the markup is in. */
	function personLink(name, href, short = name) {
		/* A provider's link opens their own page. */
		const provider = href === 'providers.html' && clinic.providers.find((p) => p.name === name);
		if (provider) href = `provider-details.html?id=${provider.id}`;
		return `<a href="${href}" class="hc-person-link">${avatar(name.replace(/^Dr\.? /, ''), 'xs')}<span>${short}</span></a>`;
	}

	function avatar(name, size) {
		return `<span data-basalt-avatar data-name="${name}" aria-hidden="true" class="basalt-avatar basalt-avatar-${size}"></span>`;
	}

	/** A result's normal range and its value travel as data-lo, data-hi and
      data-at (percents along the bar) and become the bar's variables. */
	function placeRanges(scope) {
		for (const bar of pickAll('.hc-range[data-lo]', scope)) {
			for (const key of ['lo', 'hi', 'at']) bar.style.setProperty(`--${key}`, `${bar.dataset[key]}%`);
		}
	}

	/** Paints the generated avatars this script wrote, through the same
	 * routine basalt.js runs on load. */
	function paintAvatars(scope) {
		if (typeof window.Basalt.avatar !== 'function') return;
		for (const face of pickAll('[data-basalt-avatar]', scope)) window.Basalt.avatar(face);
		wearFaces(scope || root);
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

	/** A plain action button: it says what happened and leaves its mark. A
	 * toggle (mute, camera) flips; any other action becomes a pill saying
	 * what was done, its row goes quiet, and Undo in the toast puts it back. */
	function settle(button) {
		if (button.dataset.hcToggle) {
			const on = button.getAttribute('aria-pressed') !== 'true';
			const label = button.lastChild;
			[button.dataset.hcToggle, label.textContent] = [label.textContent.trim(), button.dataset.hcToggle];
			button.setAttribute('aria-pressed', String(on));
			return;
		}
		const row = button.closest('li, tr');
		const mark = document.createElement('span');
		mark.className = 'hc-pill hc-pill-ok';
		mark.textContent = button.dataset.hcDone || 'Done';
		button.replaceWith(mark);
		row?.classList.add('is-settled');
		toast('success', mark.textContent, button.dataset.hcToast, [
			{
				label: 'Undo',
				onClick: () => {
					mark.replaceWith(button);
					row?.classList.remove('is-settled');
				},
			},
		]);
	}

	function toast(tone, title, text, actions) {
		if (!window.Basalt.toasts) return;
		window.Basalt.toasts.push({ tone, title, text, duration: actions ? 6000 : 4500, actions });
	}

	function trendText(diff, against = 'vs last week') {
		if (diff === 0) return `same ${against.replace('vs ', 'as ')}`;
		return `${diff > 0 ? '↗' : '↘'} ${Math.abs(diff)} ${against}`;
	}

	/** "Dr. Pearce + 1" for a list of provider ids. */
	function peopleLine(ids) {
		const first = clinic.short(ids[0]);
		return ids.length === 1 ? first : `${first} + ${ids.length - 1}`;
	}

	/** Polyline points for a sparkline in a 100 by 28 box. */
	function sparkline(series) {
		const min = Math.min(...series);
		const max = Math.max(...series);
		const span = max - min || 1;
		return series
			.map(
				(v, i) =>
					`${((i / (series.length - 1)) * 100).toFixed(1)},${(24 - ((v - min) / span) * 20).toFixed(1)}`,
			)
			.join(' ');
	}

	start();
})();
