/**
 * Bayline Health's visit types, published as window.Basalt.data.bookings.
 *
 * Appointments book against these: each type's length and the time kept
 * free after it, its self-pay price, who can see the patient for it and
 * its booking rules. Visit Types (services.html) edits them. The fees
 * match clinic.js (follow-up $120, check-up $160, new patient $220), and
 * the providers are Broadway Street Clinic's. Swap the lists below for
 * your own API responses, in the same shapes, to run the page on live data.
 */
(() => {
	'use strict';

	/* The frozen present. */
	const CLOCK = '2026-10-09T11:20';

	const SITES = [
		{ id: 'broadway', address: '540 Broadway, San Francisco, CA 94133', name: 'Broadway Street' },
		{ id: 'marina', address: 'Chestnut Street, San Francisco, CA 94123', name: 'Marina' },
		{ id: 'nobhill', address: 'Sacramento Street, San Francisco, CA 94109', name: 'Nob Hill' },
	];

	/* Video visits are not a site, but the page looks them up the same way. */
	const REMOTE = { id: 'video', address: 'Link sent with the reminder', name: 'Video visit' };

	/*
	 * Who can see a patient for a visit type: [id, name, role, home site].
	 * Names match the providers in clinic.js. Each person's avatar tone
	 * follows their place in this list.
	 */
	const TEAM = [
		['ev', 'Dr. Emily Pearce', 'Family medicine', 'broadway'],
		['pn', 'Megan Price', 'Nurse practitioner', 'broadway'],
		['ao', 'Dr. Laura Hughes', 'Pediatrics', 'marina'],
		['km', 'Dr. Edward Morgan', 'Internal medicine', 'nobhill'],
		['gm', 'Gloria Mendez', 'Nurse', 'broadway'],
	].map(([id, name, role, studio], index) => ({ id, name, role, studio, tone: index + 1 }));

	/*
	 * What can be booked. Lengths and buffers are minutes, the buffer being
	 * the gap kept after a visit to turn the exam room around. Price is the
	 * self-pay price; a price of 0 comes with `included` text, and `from`
	 * marks a price that depends on the tests. Lead and cancel are hours:
	 * notice needed to book online, and the window for free cancellation.
	 * `where` lists 'studio' (in person), 'video' or both.
	 */
	const SERVICES = [
		{
			id: 'physical',
			name: 'Annual physical',
			short: 'Physical',
			group: 'styling',
			icon: 'bi-clipboard2-pulse',
			price: 160,
			deposit: 0,
			minutes: 45,
			buffer: 15,
			lead: 48,
			cancel: 24,
			online: true,
			where: ['studio'],
			staff: ['ev', 'pn', 'km'],
			note: 'Exam, screening and labs ordered for the year',
		},
		{
			id: 'new',
			name: 'New patient visit',
			short: 'New patient',
			group: 'styling',
			icon: 'bi-person-plus',
			price: 220,
			deposit: 0,
			minutes: 60,
			buffer: 15,
			lead: 72,
			cancel: 48,
			online: true,
			where: ['studio'],
			staff: ['ev', 'ao', 'km'],
			note: 'History, medicines and a first exam',
		},
		{
			id: 'sick',
			name: 'Sick visit',
			short: 'Sick visit',
			group: 'measure',
			icon: 'bi-thermometer-half',
			price: 120,
			deposit: 0,
			minutes: 30,
			buffer: 15,
			lead: 0,
			cancel: 0,
			online: true,
			where: ['studio', 'video'],
			staff: ['ev', 'pn', 'ao'],
			note: 'Same day for fevers, coughs and pain',
		},
		{
			id: 'video',
			name: 'Telehealth follow-up',
			short: 'Telehealth',
			group: 'measure',
			icon: 'bi-camera-video',
			price: 120,
			deposit: 0,
			minutes: 20,
			buffer: 10,
			lead: 12,
			cancel: 12,
			online: true,
			where: ['studio', 'video'],
			staff: ['ev', 'pn', 'km'],
			note: 'Results, refills and checking in by video',
		},
		{
			id: 'lab',
			name: 'Lab draw',
			short: 'Lab draw',
			group: 'alter',
			icon: 'bi-droplet',
			price: 25,
			from: true,
			deposit: 0,
			minutes: 15,
			buffer: 5,
			lead: 0,
			cancel: 0,
			online: true,
			where: ['studio'],
			staff: ['gm', 'pn'],
			note: 'Blood and urine samples, sent to Dogpatch Lab',
		},
		{
			id: 'flu',
			name: 'Flu shot',
			short: 'Flu shot',
			group: 'alter',
			icon: 'bi-shield-plus',
			price: 0,
			included: 'Covered by most plans',
			deposit: 0,
			minutes: 15,
			buffer: 5,
			lead: 0,
			cancel: 0,
			online: true,
			where: ['studio'],
			staff: ['gm', 'pn', 'ev', 'ao', 'km'],
			note: 'Walk in or book, from age six months',
		},
	];

	/* Visit families in the order the Visit Types table lists them. */
	const FAMILIES = {
		styling: { tone: 1, label: 'Checkups' },
		measure: { tone: 3, label: 'Sick and follow-up' },
		alter: { tone: 5, label: 'Labs and vaccines' },
	};

	const RULES = {
		ahead: 8 /* weeks ahead a patient may book */,
		reminder: 24 /* hours before the visit; 0 sends none */,
		expire: 48 /* hours an unanswered request waits before it is declined */,
		keepDeposit: true /* a no-show is charged the late-cancel fee */,
	};

	const DOLLARS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.bookings = {
		NOW: CLOCK,
		studios: SITES,
		video: REMOTE,
		staff: TEAM,
		services: SERVICES,
		groups: FAMILIES,
		rules: RULES,
		service: (id) => SERVICES.find((entry) => entry.id === id) ?? null,
		person: (id) => TEAM.find((member) => member.id === id) ?? null,
		place: (id) => (id === REMOTE.id ? REMOTE : (SITES.find((site) => site.id === id) ?? null)),
		fmtMinutes: durationLabel,
		money: (amount) => `$${DOLLARS.format(Number(amount))}`,
	};

	/** A length in minutes as "45 min" or "1 hr 15 min". */
	function durationLabel(length) {
		if (length < 60) return `${length} min`;
		const hours = Math.floor(length / 60);
		const rest = length % 60;
		return `${hours} ${hours === 1 ? 'hr' : 'hrs'}${rest ? ` ${rest} min` : ''}`;
	}
})();
