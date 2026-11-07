/**
 * Basalt - Travel (travel.html)
 * The admin's view of an online travel agency that sells flights, stays,
 * cars, cruises and packages, drawn from TRIP below:
 *   biggest    today's largest group trip, drawn as a boarding pass over
 *              the rest of today's departures
 *   today      bookings, booking value, travelers leaving soon and
 *              cancellations, each with today's hours as bars
 *   products   the last seven days by product: bookings, value and the
 *              commission kept (the switch picks which the bars show)
 *   payouts    money owed to partners this week
 *   departures every trip leaving in the next 48 hours, searched,
 *              filtered and sorted
 *   changes    requests from Manage booking waiting on the team
 *   listings   new homes and hotels hosts have listed
 *   deals      the deals running now
 *
 * The demo is set on Thursday, October 8, 2026 at 10:40 AM. All partners,
 * travelers and properties are made up. In your app, fill TRIP from your
 * booking system in the same shape.
 */
(() => {
	'use strict';
	const root = pick('[data-trv-root]', document);
	if (!root) return;

	const TRIP = {
		/* Today's biggest trip. Its row in departures carries the same ref. */
		biggest: {
			ref: '#58204',
			from: { code: 'JFK', city: 'New York' },
			to: { code: 'LIS', city: 'Lisbon' },
			flight: '7 h 05 min nonstop',
			group: 'Harper & Co. offsite',
			departs: '10:40 PM',
			gate: 'B22',
			boarding: '10:05 PM',
			value: 41860,
			checkedIn: 17,
		},
		/* Last seven days. value and kept in thousands of dollars. */
		products: [
			{ name: 'Flights', icon: 'bi-airplane', count: 3412, value: 1420, kept: 49.7, change: 4 },
			{ name: 'Stays', icon: 'bi-building', count: 2868, value: 1180, kept: 177, change: 9 },
			{ name: 'Packages', icon: 'bi-suitcase2', count: 506, value: 940, kept: 131.6, change: 11 },
			{ name: 'Cruises', icon: 'bi-water', count: 118, value: 390, kept: 46.8, change: 22 },
			{ name: 'Cars', icon: 'bi-car-front', count: 964, value: 210, kept: 25.2, change: -3 },
		],
		payouts: [
			{ who: 'Northline Air', kind: 'Airline', amount: 112800, due: 'Oct 10', state: 'scheduled' },
			{
				who: 'Seabright Cruises',
				kind: 'Cruise line',
				amount: 64250,
				due: 'Oct 12',
				state: 'hold',
				why: 'Waiting on their September invoice',
			},
			{ who: 'Quail Hollow Inn, Akron', kind: 'Hotel', amount: 18420, due: 'Oct 9', state: 'scheduled' },
			{ who: 'Roadway Car Hire', kind: 'Car rental', amount: 9880, due: 'Oct 7', state: 'paid' },
			{ who: 'Oyster Point Hotel, Akron', kind: 'Hotel', amount: 6140, due: 'Oct 13', state: 'scheduled' },
		],
		/* when: hours from now. */
		departures: [
			{
				ref: '#58213',
				when: 1.6,
				label: 'Today, 12:15 PM',
				route: 'Boston → Akron',
				kind: 'flight',
				detail: 'Northline Air NL 241',
				who: 'Allie Lang',
				pax: 4,
				status: 'ok',
			},
			{
				ref: '#58190',
				when: 3,
				label: 'Today, 1:40 PM',
				route: 'Evanston → El Paso',
				kind: 'package',
				detail: '5 nights, beach resort',
				who: 'Jeffrey Dillon',
				pax: 2,
				status: 'late',
				note: 'Flight 45 min late',
			},
			{
				ref: '#58174',
				when: 4.4,
				label: 'Today, 3:05 PM',
				route: 'Tacoma → Juneau',
				kind: 'cruise',
				detail: 'Inside Passage, 7 nights',
				who: 'Gloria Holloway',
				pax: 2,
				status: 'ok',
			},
			{
				ref: '#58166',
				when: 5.8,
				label: 'Today, 4:30 PM',
				route: 'Boulder → Anchorage',
				kind: 'flight',
				detail: 'Northline Air NL 612',
				who: 'Isabel Clarke',
				pax: 3,
				status: 'gate',
				note: 'Gate moved to B22',
			},
			{
				ref: '#58142',
				when: 8.3,
				label: 'Today, 6:55 PM',
				route: 'Newark → Sandusky',
				kind: 'package',
				detail: '6 nights, flight and hotel',
				who: 'Jonathan Pike',
				pax: 2,
				status: 'ok',
			},
			{
				ref: '#58131',
				when: 10.5,
				label: 'Today, 9:10 PM',
				route: 'Los Angeles → Missoula',
				kind: 'flight',
				detail: 'Pacific Crest PC 18',
				who: 'Hollis Wren',
				pax: 1,
				status: 'checkin',
				note: 'Check-in open',
			},
			{
				ref: '#58204',
				when: 12,
				label: 'Today, 10:40 PM',
				route: 'New York → Lisbon',
				kind: 'flight',
				detail: 'Group trip, 7 h 05 min nonstop',
				who: 'Harper & Co. offsite',
				pax: 18,
				status: 'checkin',
			},
			{
				ref: '#58109',
				when: 19.7,
				label: 'Tomorrow, 6:20 AM',
				route: 'Waco → Chattanooga',
				kind: 'flight',
				detail: 'Pacific Crest PC 402',
				who: 'Daisy Monroe',
				pax: 5,
				status: 'ok',
			},
			{
				ref: '#58097',
				when: 22.1,
				label: 'Tomorrow, 8:45 AM',
				route: 'Tampa → Lubbock',
				kind: 'cruise',
				detail: 'Bahamas, 4 nights',
				who: 'Theo Ashford',
				pax: 4,
				status: 'docs',
				note: '2 passports missing',
			},
			{
				ref: '#58088',
				when: 23.8,
				label: 'Tomorrow, 10:30 AM',
				route: 'Atlanta → Appleton',
				kind: 'package',
				detail: '7 nights, flight and hotel',
				who: 'Jodi Hanson',
				pax: 2,
				status: 'ok',
			},
			{
				ref: '#58071',
				when: 26.6,
				label: 'Tomorrow, 1:15 PM',
				route: 'Oakland → Honolulu',
				kind: 'flight',
				detail: 'Northline Air NL 77',
				who: 'Calvin Roach',
				pax: 3,
				status: 'late',
				note: 'Flight 1 h 20 min late',
			},
			{
				ref: '#58052',
				when: 31,
				label: 'Tomorrow, 5:40 PM',
				route: 'Stamford → Eau Claire',
				kind: 'flight',
				detail: 'Pacific Crest PC 930',
				who: 'Eileen Marsh',
				pax: 2,
				status: 'ok',
			},
			{
				ref: '#58040',
				when: 33.4,
				label: 'Tomorrow, 8:05 PM',
				route: 'Phoenix → Syracuse',
				kind: 'package',
				detail: '4 nights, flight and hotel',
				who: 'Brad Kessler',
				pax: 4,
				status: 'ok',
			},
		],
		changes: [
			{
				id: 'c1',
				kind: 'cancel',
				what: 'Cancel a hotel stay',
				who: 'Leslie Nugent',
				ref: '#57980',
				detail: 'Quail Hollow Inn, Akron · free to cancel until 6 PM today',
				amount: 'Refund $642',
				urgent: true,
			},
			{
				id: 'c2',
				kind: 'change',
				what: 'Move the flight two days later',
				who: 'Tiffany Vance',
				ref: '#58011',
				detail: 'Boulder → Anchorage · new fare is $184 more',
				amount: '+$184',
			},
			{
				id: 'c3',
				kind: 'extra',
				what: 'Add two checked bags',
				who: 'Isabel Clarke',
				ref: '#58166',
				detail: 'Leaves today at 4:30 PM',
				amount: '+$120',
				urgent: true,
			},
			{
				id: 'c4',
				kind: 'other',
				what: 'Wheelchair at the gate',
				who: 'Jeffrey Dillon',
				ref: '#58190',
				detail: 'Airline still to confirm · leaves today at 1:40 PM',
				amount: 'No charge',
				urgent: true,
			},
			{
				id: 'c5',
				kind: 'other',
				what: 'Fix a name: Jon to Jonathan',
				who: 'Jonathan Pike',
				ref: '#58142',
				detail: 'Must match the passport',
				amount: 'No charge',
			},
			{
				id: 'c6',
				kind: 'cancel',
				what: 'Cancel a cruise',
				who: 'Lindsey Dahl',
				ref: '#57766',
				detail: '58 days before sailing · 25% kept by the cruise line',
				amount: 'Refund $2,310',
			},
			{
				id: 'c7',
				kind: 'extra',
				what: 'Seats together, rows 12 to 14',
				who: 'Allie Lang',
				ref: '#58213',
				detail: 'Four travelers · leaves today at 12:15 PM',
				amount: '+$96',
				urgent: true,
			},
		],
		listings: [
			{
				name: 'Moorings Inn',
				place: 'Camden, Maine',
				what: 'Hotel, 14 rooms',
				photos: 32,
				when: 'Today',
				ready: true,
			},
			{
				name: 'Lakeside cabin',
				place: 'Lake Placid, New York',
				what: 'Whole home, 2 bedrooms',
				photos: 18,
				when: '2 days ago',
				ready: true,
			},
			{
				name: 'Loft in Highland Square',
				place: 'Akron, OH',
				what: 'Apartment, 1 bedroom',
				photos: 9,
				when: 'Yesterday',
				ready: false,
				why: 'Needs 3 more photos',
			},
			{
				name: 'Valley View Inn',
				place: 'Sedona, Arizona',
				what: 'Guesthouse, 6 rooms',
				photos: 21,
				when: '3 days ago',
				ready: false,
				why: 'Tax number missing',
			},
		],
		deals: [
			{
				name: 'Fall city breaks',
				off: '25% off stays',
				bookings: 214,
				value: 186,
				ends: 'Ends Oct 20',
				goal: 300,
			},
			{
				name: 'Caribbean cruises, two for one',
				off: 'Second guest free',
				bookings: 38,
				value: 96,
				ends: 'Ends Oct 31',
				goal: 60,
			},
			{
				name: 'Ski season, book early',
				off: '15% off packages',
				bookings: 61,
				value: 72,
				ends: 'Ends Nov 15',
				goal: 150,
			},
			{
				name: 'Weekend car deal',
				off: '3 days for the price of 2',
				bookings: 122,
				value: 14,
				ends: 'Ends Oct 11',
				goal: 120,
			},
		],
	};

	const KIND = {
		flight: { label: 'Flight', icon: 'bi-airplane' },
		cruise: { label: 'Cruise', icon: 'bi-water' },
		package: { label: 'Package', icon: 'bi-suitcase2' },
	};
	const STATUS = {
		ok: { label: 'On time', tone: 'success' },
		late: { label: 'Delayed', tone: 'warning' },
		gate: { label: 'Gate change', tone: 'info' },
		checkin: { label: 'Check-in open', tone: 'primary' },
		docs: { label: 'Documents missing', tone: 'danger' },
	};
	const PAY = {
		scheduled: { label: 'Scheduled', tone: 'info' },
		hold: { label: 'On hold', tone: 'warning' },
		paid: { label: 'Paid', tone: 'success' },
	};

	const state = {
		measure: 'value',
		sort: { key: 'when', up: true },
		changes: TRIP.changes.map((c) => ({ ...c })),
	};

	function start() {
		drawPass();
		drawProducts();
		for (const input of pickAll('[data-trv-measure]')) {
			input.addEventListener('change', () => {
				if (!input.checked) return;
				state.measure = input.value;
				drawProducts();
			});
		}
		drawPayouts();
		wireDepartures();
		wireChanges();
		drawListings();
		drawDeals();
	}

	/* Helpers */
	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function dollars(n) {
		return `$${n.toLocaleString('en-US')}`;
	}

	function thousands(k) {
		return k >= 1000 ? `$${(k / 1000).toFixed(2)}M` : `$${k.toFixed(k < 100 ? 1 : 0)}k`;
	}

	function status(tone, label) {
		return `<span class="basalt-status basalt-status-${tone} basalt-status-dot">${htmlSafe(label)}</span>`;
	}

	/* Today's biggest trip as a boarding pass, then today's other departures as plain rows. */
	function drawPass() {
		const host = pick('[data-trv-pass]');
		const b = TRIP.biggest;
		const trip = TRIP.departures.find((d) => d.ref === b.ref);
		const others = TRIP.departures.filter((d) => d.ref !== b.ref && d.label.startsWith('Today'));
		const travelers = others.reduce((s, d) => s + d.pax, 0);
		const field = (label, value) =>
			`<div class="trv-pass-field"><span>${label}</span><b>${htmlSafe(value)}</b></div>`;
		const rows = others
			.map((d) => {
				const flag = d.status === 'late' || d.status === 'gate' || d.status === 'docs';
				return `<li class="trv-pass-dep"><b class="trv-pass-dep-time">${htmlSafe(d.label.replace('Today, ', ''))}</b><span class="trv-pass-dep-route">${htmlSafe(d.route)}</span><span class="trv-pass-dep-who">${htmlSafe(d.who)}</span><span class="trv-pass-dep-pax">${d.pax} ${d.pax === 1 ? 'traveler' : 'travelers'}</span><span class="trv-pass-dep-status${flag ? ' is-flag' : ''}">${STATUS[d.status].label}</span></li>`;
			})
			.join('');
		host.innerHTML =
			`<div class="trv-pass"><div class="trv-pass-main"><h2 id="trv-pass-title" class="trv-pass-kicker">Today’s biggest trip</h2>` +
			`<div class="trv-pass-route"><div><b>${b.from.code}</b><span>${htmlSafe(b.from.city)}</span></div><div class="trv-pass-flight"><svg viewBox="0 0 560 110" aria-hidden="true"><path class="trv-pass-arc" d="M20,96 Q280,-20 540,96"/><circle cx="20" cy="96" r="7"/><circle cx="540" cy="96" r="7"/></svg><span>${htmlSafe(b.flight)}</span></div><div class="text-end"><b>${b.to.code}</b><span>${htmlSafe(b.to.city)}</span></div></div>` +
			`<div class="trv-pass-fields">${field('Group', b.group)}${field('Travelers', String(trip.pax))}${field('Departs', `${b.departs} · Gate ${b.gate}`)}${field('Booking value', dollars(b.value))}</div></div>` +
			`<div class="trv-pass-stub"><span>Boarding</span><b>${htmlSafe(b.boarding)}</b><small>${b.checkedIn} of ${trip.pax} checked in</small></div></div>` +
			`<div class="trv-pass-deps"><h3 class="trv-pass-deps-title">Also leaving today <span>${others.length} trips · ${travelers} travelers</span></h3><ul class="trv-pass-list">${rows}</ul></div>`;
		/* The arc draws and the rows rise once the page has settled. */
		if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			(window.Basalt.settled || Promise.resolve()).then(() =>
				requestAnimationFrame(() => host.classList.add('is-live')),
			);
		}
	}

	/* Bookings by product: one bar per product for the measure picked. */
	function drawProducts() {
		const m = state.measure;
		const fmt = { value: thousands, count: (n) => n.toLocaleString('en-US'), kept: thousands }[m];
		const total = TRIP.products.reduce((s, p) => s + p[m], 0);
		const top = Math.max(...TRIP.products.map((p) => p[m]));
		pick('[data-trv-mix]').innerHTML = [...TRIP.products]
			.sort((a, b) => b[m] - a[m])
			.map((p, i) => {
				const share = Math.round((p[m] / total) * 100);
				const rate = `${(Math.round((p.kept / p.value) * 1000) / 10).toString()}% commission`;
				return `<li class="trv-mix-row"><span class="trv-mix-name"><i class="bi ${p.icon}" aria-hidden="true"></i>${p.name}</span><span class="trv-mix-track" aria-hidden="true"><span class="trv-mix-fill tone-series-${[1, 7, 2, 4, 1][i]} w-${Math.max(2, Math.round((p[m] / top) * 100))}"></span></span><span class="trv-mix-value">${fmt(p[m])}<span>${share}%</span></span><span class="trv-mix-sub">${p.count.toLocaleString('en-US')} bookings · ${rate} · <span class="${p.change < 0 ? 'is-down' : 'is-up'}">${p.change < 0 ? '−' : '+'}${Math.abs(p.change)}% on last week</span></span></li>`;
			})
			.join('');
		const totals = {
			value: `${thousands(total)} booked in the last seven days.`,
			count: `${total.toLocaleString('en-US')} bookings in the last seven days.`,
			kept: `${thousands(total)} in commission from the last seven days.`,
		};
		pick('[data-trv-mix-read]').textContent = totals[m];
	}

	function drawPayouts() {
		const due = TRIP.payouts.filter((p) => p.state !== 'paid').reduce((s, p) => s + p.amount, 0);
		pick('[data-trv-pay-read]').textContent = `${dollars(due)} still to pay this week.`;
		pick('[data-trv-payouts]').innerHTML = TRIP.payouts
			.map(
				(p) =>
					`<li class="trv-row"><span class="trv-row-main"><a href="payouts.html" class="trv-row-title">${htmlSafe(p.who)}</a><span class="trv-row-sub">${htmlSafe(p.kind)} · ${p.state === 'paid' ? 'paid' : 'due'} ${p.due}${p.why ? ` · ${htmlSafe(p.why)}` : ''}</span></span><span class="trv-row-end"><b class="trv-amount">${dollars(p.amount)}</b>${status(PAY[p.state].tone, PAY[p.state].label)}</span></li>`,
			)
			.join('');
	}

	/* Departures */
	function wireDepartures() {
		pick('[data-trv-dep-search]').addEventListener('input', drawDepartures);
		pick('[data-trv-dep-show]').addEventListener('change', drawDepartures);
		for (const th of pickAll('[data-trv-sort]')) {
			pick('button', th).addEventListener('click', () => {
				const key = th.dataset.trvSort;
				state.sort = { key, up: state.sort.key === key ? !state.sort.up : key !== 'pax' };
				drawDepartures();
			});
		}
		pick('[data-trv-departures]').addEventListener('click', (event) => {
			const notify = event.target.closest('[data-trv-notify]');
			if (notify) {
				notify.disabled = true;
				notify.textContent = 'Told';
				toast({ tone: 'success', title: `Travelers on ${notify.dataset.trvNotify} told by email and text` });
			}
			if (event.target.closest('[data-trv-dep-reset]')) {
				pick('[data-trv-dep-search]').value = '';
				pick('[data-trv-dep-show]').value = 'all';
				drawDepartures();
			}
		});
		drawDepartures();
	}

	function drawDepartures() {
		const q = pick('[data-trv-dep-search]').value.trim().toLowerCase();
		const show = pick('[data-trv-dep-show]').value;
		const { key, up } = state.sort;
		const rows = TRIP.departures
			.filter((d) =>
				show === 'all'
					? true
					: show === 'attention'
						? d.status !== 'ok' && d.status !== 'checkin'
						: d.kind === show,
			)
			.filter((d) => !q || `${d.ref} ${d.route} ${d.who} ${d.detail}`.toLowerCase().includes(q))
			.sort((a, b) => {
				const d = typeof a[key] === 'string' ? a[key].localeCompare(b[key]) : a[key] - b[key];
				return up ? d : -d;
			});
		const attention = TRIP.departures.filter((d) => d.status !== 'ok' && d.status !== 'checkin').length;
		const pax = TRIP.departures.reduce((s, d) => s + d.pax, 0);
		pick('[data-trv-dep-read]').textContent =
			`${TRIP.departures.length} of the 214 trips shown, ${pax} travelers. ${attention} need attention.`;
		pick('[data-trv-dep-count]').textContent = `${rows.length} of ${TRIP.departures.length}`;
		for (const th of pickAll('[data-trv-sort]')) {
			const on = th.dataset.trvSort === key;
			pick('.bi', th).className =
				`bi ${on ? (up ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up trv-sort-idle'}`;
			if (on) th.setAttribute('aria-sort', up ? 'ascending' : 'descending');
			else th.removeAttribute('aria-sort');
		}
		const body = pick('[data-trv-departures]');
		if (!rows.length) {
			body.innerHTML = `<tr><td colspan="5"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">No trips here</h3><p class="basalt-empty-text">Nothing leaving in the next 48 hours matches.</p><div class="basalt-empty-actions"><button data-trv-dep-reset type="button" class="btn btn-outline-secondary btn-sm">Show every trip</button></div></div></td></tr>`;
			return;
		}
		body.innerHTML = rows
			.map((d) => {
				const s = STATUS[d.status];
				const k = KIND[d.kind];
				const act =
					d.status === 'late' || d.status === 'gate'
						? `<button type="button" class="btn btn-outline-secondary btn-sm trv-notify" data-trv-notify="${d.ref}">Tell travelers</button>`
						: '';
				return `<tr${d.status === 'docs' ? ' class="is-alert"' : ''}><td class="trv-when">${htmlSafe(d.label)}</td><td><a href="booking-details.html" class="trv-trip"><span class="trv-trip-icon" aria-hidden="true"><i class="bi ${k.icon}"></i></span><span class="trv-trip-text"><b>${htmlSafe(d.route)}</b><span>${k.label} · ${htmlSafe(d.detail)} · ${d.ref}</span></span></a></td><td class="trv-col-who">${htmlSafe(d.who)}</td><td class="trv-num trv-col-pax">${d.pax}</td><td><div class="trv-status-cell"><span class="trv-status">${status(s.tone, s.label)}${d.note ? `<span class="trv-status-note">${htmlSafe(d.note)}</span>` : ''}</span>${act}</div></td></tr>`;
			})
			.join('');
	}

	/* Changes */
	function wireChanges() {
		pick('[data-trv-chg-search]').addEventListener('input', drawChanges);
		pick('[data-trv-chg-show]').addEventListener('change', drawChanges);
		pick('[data-trv-changes]').addEventListener('click', (event) => {
			const done = event.target.closest('[data-trv-done]');
			if (done) {
				const at = state.changes.findIndex((c) => c.id === done.dataset.trvDone);
				const [item] = state.changes.splice(at, 1);
				drawChanges();
				toast({
					tone: 'success',
					title: `Done: ${item.what} for ${item.who}`,
					actions: [
						{
							label: 'Undo',
							onClick() {
								state.changes.splice(at, 0, item);
								drawChanges();
							},
						},
					],
				});
			}
			if (event.target.closest('[data-trv-chg-reset]')) {
				pick('[data-trv-chg-search]').value = '';
				pick('[data-trv-chg-show]').value = 'all';
				drawChanges();
			}
		});
		drawChanges();
	}

	function drawChanges() {
		const q = pick('[data-trv-chg-search]').value.trim().toLowerCase();
		const show = pick('[data-trv-chg-show]').value;
		const rows = state.changes
			.filter((c) => show === 'all' || c.kind === show)
			.filter((c) => !q || `${c.who} ${c.ref} ${c.what} ${c.detail}`.toLowerCase().includes(q))
			.sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)));
		const urgent = state.changes.filter((c) => c.urgent).length;
		pick('[data-trv-chg-read]').textContent = state.changes.length
			? `${state.changes.length} requests, ${urgent} for trips leaving today.`
			: 'Every request is handled.';
		pick('[data-trv-chg-count]').textContent = `${rows.length} of ${state.changes.length}`;
		const list = pick('[data-trv-changes]');
		if (!rows.length) {
			const none = !state.changes.length;
			list.innerHTML = `<li class="trv-empty"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">${none ? 'All handled' : 'No requests here'}</h3><p class="basalt-empty-text">${none ? 'Nothing is waiting on the team.' : 'Nothing matches that search and filter.'}</p>${none ? '' : '<div class="basalt-empty-actions"><button data-trv-chg-reset type="button" class="btn btn-outline-secondary btn-sm">Show every request</button></div>'}</div></li>`;
			return;
		}
		list.innerHTML = rows
			.map(
				(c) =>
					`<li class="trv-row"><span class="trv-row-main"><a href="booking-details.html" class="trv-row-title">${htmlSafe(c.what)}</a><span class="trv-row-sub">${htmlSafe(c.who)} · ${c.ref}</span><span class="trv-row-sub">${c.urgent ? '<i class="bi bi-alarm trv-urgent" aria-hidden="true"></i>' : ''}${htmlSafe(c.detail)}</span></span><span class="trv-row-end"><b class="trv-amount">${htmlSafe(c.amount)}</b><button type="button" class="btn btn-outline-secondary btn-sm" data-trv-done="${c.id}">Mark done</button></span></li>`,
			)
			.join('');
	}

	function drawListings() {
		const ready = TRIP.listings.filter((l) => l.ready).length;
		pick('[data-trv-lst-read]').textContent = `${TRIP.listings.length} waiting, ${ready} ready to go live.`;
		pick('[data-trv-listings]').innerHTML = TRIP.listings
			.map(
				(l) =>
					`<li class="trv-row"><span class="trv-row-main"><b class="trv-row-title">${htmlSafe(l.name)}</b><span class="trv-row-sub">${htmlSafe(l.what)} · ${htmlSafe(l.place)}</span><span class="trv-row-sub">${l.photos} photos · sent ${l.when.toLowerCase()}${l.why ? ` · <span class="trv-missing">${htmlSafe(l.why)}</span>` : ''}</span></span><span class="trv-row-end">${l.ready ? `<button type="button" class="btn btn-primary btn-sm" data-trv-live="${htmlSafe(l.name)}">Approve</button>` : `<button type="button" class="btn btn-outline-secondary btn-sm" data-trv-ask="${htmlSafe(l.name)}">Ask host</button>`}</span></li>`,
			)
			.join('');
		pick('[data-trv-listings]').addEventListener('click', (event) => {
			const live = event.target.closest('[data-trv-live]');
			const ask = event.target.closest('[data-trv-ask]');
			if (live) {
				live.disabled = true;
				live.textContent = 'Live';
				toast({ tone: 'success', title: `${live.dataset.trvLive} is live` });
			}
			if (ask) {
				ask.disabled = true;
				ask.textContent = 'Asked';
				toast({ tone: 'info', title: `Host of ${ask.dataset.trvAsk} asked for what is missing` });
			}
		});
	}

	function drawDeals() {
		const total = TRIP.deals.reduce((s, d) => s + d.value, 0);
		pick('[data-trv-deal-read]').textContent =
			`${thousands(total)} booked through ${TRIP.deals.length} deals so far.`;
		pick('[data-trv-deals]').innerHTML = TRIP.deals
			.map((d) => {
				const share = Math.min(100, Math.round((d.bookings / d.goal) * 100));
				return `<li class="trv-deal"><span class="trv-deal-name"><b>${htmlSafe(d.name)}</b><span>${htmlSafe(d.off)} · ${htmlSafe(d.ends)}</span></span><span class="trv-deal-figure"><b>${d.bookings}</b><span>of ${d.goal} bookings hoped for</span></span><span class="trv-deal-track" aria-hidden="true"><span class="trv-deal-fill w-${share}${share >= 100 ? ' is-done' : ''}"></span></span><span class="trv-deal-value">${thousands(d.value)}</span></li>`;
			})
			.join('');
	}

	start();
})();
