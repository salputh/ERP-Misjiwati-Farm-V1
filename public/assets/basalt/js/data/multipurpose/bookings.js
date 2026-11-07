/**
 * Marlo's appointment book, published as window.Basalt.data.bookings.
 *
 * Alongside clothes, Marlo sells studio time: private styling, the three
 * fittings that come with made-to-measure tailoring, and alteration or aftercare
 * visits. The Bookings, Booking Details and Services pages all draw on this
 * one source, so a visit shows the same shopper, slot, studio and stylist
 * wherever it appears.
 *
 * Shopper ids, names and cities match store.js, and paid visits point at real
 * store.js orders. Clock times are local to the studio, and the demo treats
 * Friday, October 9, 2026 at 10:40 as the present. Swap the lists below for
 * your own API responses, in the same shapes, to run the pages on live data.
 */
(() => {
	'use strict';

	/* The frozen present, and the calendar day it falls on. */
	const CLOCK = '2026-10-09T10:40';
	const CLOCK_DAY = CLOCK.slice(0, 10);

	/* Every studio keeps the same hours: Monday through Saturday, ten until six. */
	const STUDIO_HOURS = { days: [1, 2, 3, 4, 5, 6], from: '10:00', to: '18:00' };

	const STUDIO_SITES = [
		{ id: 'chicago', address: '1652 Chestnut Ave, Evanston, IL 60201', name: 'Evanston studio' },
		{ id: 'trenton', address: '872 Hawthorne St, Trenton, NJ 08608', name: 'Trenton studio' },
		{ id: 'decatur', address: '14 Laurel St, Decatur, IL 62523', name: 'Decatur studio' },
	];

	/* Remote sessions are not a studio, but pages look them up the same way. */
	const REMOTE = { id: 'video', address: 'Link sent with the reminder', name: 'Video call' };

	/*
	 * Marlo's own stylists and tailors, kept apart from Fieldline's staff in
	 * people.js. Each person's avatar tone follows their place in this list.
	 */
	const TEAM = [
		['elaine', 'Elaine Nugent', 'Stylist', 'chicago'],
		['theo', 'Theo Barlow', 'Tailor', 'chicago'],
		['dawn', 'Dawn Middleton', 'Stylist', 'trenton'],
		['harvey', 'Harvey Reid', 'Tailor', 'decatur'],
		['carly', 'Carly Dillon', 'Stylist', 'decatur'],
	].map(([id, name, role, studio], index) => ({ id, name, role, studio, tone: index + 1 }));

	/*
	 * The three tailoring fittings differ only in length, wording and whether the
	 * customer can book them online; everything else is shared here.
	 */
	const COAT_FITTING = {
		group: 'measure',
		icon: 'bi-rulers',
		sku: 'ML-MTM',
		price: 4800,
		included: 'With the $4,800 commission',
		deposit: 0,
		buffer: 15,
		lead: 72,
		cancel: 48,
	};

	/*
	 * What can be booked. Lengths and buffers are minutes, the buffer being
	 * the gap kept after a visit to reset the fitting room. A price of 0 comes
	 * with `included` text, and `from` marks a price that depends on the work.
	 * Lead and cancel are hours: notice needed to book online, and the window
	 * for free cancellation. `where` lists 'studio', 'video' or both.
	 */
	const SERVICES = [
		{
			id: 'styling',
			name: 'Private Styling Session',
			short: 'Styling session',
			group: 'styling',
			icon: 'bi-person-standing-dress',
			sku: 'ML-STYLE',
			price: 650,
			deposit: 100,
			minutes: 90,
			buffer: 15,
			lead: 48,
			cancel: 24,
			online: true,
			where: ['studio', 'video'],
			staff: ['elaine', 'dawn', 'carly'],
			note: 'A season’s wardrobe built around what they own',
		},
		coatFitting('fit1', 'First fitting', 60, true, 'Measurements, cloth and lining for the suit'),
		coatFitting('fit2', 'Second fitting', 45, false, 'The basted suit, about three weeks later'),
		coatFitting('fit3', 'Final fitting', 30, false, 'Last checks, then the suit goes home'),
		{
			id: 'alter',
			name: 'Alteration fitting',
			short: 'Alteration',
			group: 'alter',
			icon: 'bi-scissors',
			sku: null,
			price: 25,
			from: true,
			deposit: 0,
			minutes: 20,
			buffer: 10,
			lead: 24,
			cancel: 12,
			online: true,
			where: ['studio'],
			staff: ['theo', 'harvey', 'elaine'],
			note: 'Hems, sleeves and waists, paid in the studio',
		},
		{
			id: 'care',
			name: 'Aftercare drop-off',
			short: 'Aftercare',
			group: 'alter',
			icon: 'bi-scissors',
			sku: 'ML-CARE',
			price: 25,
			included: 'Free with Aftercare Plan',
			deposit: 0,
			minutes: 15,
			buffer: 5,
			lead: 0,
			cancel: 0,
			online: true,
			where: ['studio'],
			staff: ['elaine', 'theo', 'dawn', 'harvey', 'carly'],
			note: 'Aftercare Plan members bring in a piece to repair',
		},
	];

	/* Service families in the order the Services table lists them. */
	const FAMILIES = {
		styling: { tone: 1, label: 'Styling' },
		measure: { tone: 3, label: 'Made to measure' },
		alter: { tone: 5, label: 'Alterations' },
	};

	/* The shoppers who appear below, by store.js id: name, then home city. */
	const SHOPPERS = {
		'#88031': ['Claire Donnelly', 'Boulder'],
		'#88041': ['Sandra Franklin', 'Stamford'],
		'#88042': ['Phyllis Delaney', 'Concord'],
		'#88043': ['Eleanor Fairweather', 'Minot'],
		'#88044': ['Cheryl Sorensen', 'Minneapolis'],
		'#88046': ['Benjamin Hartley', 'Boulder'],
		'#88048': ['Natalie Tanner', 'Flagstaff'],
		'#88052': ['Iva Blackwood', 'Ames'],
		'#88053': ['Sabrina Kavanagh', 'Duluth'],
		'#88059': ['Jasmine Whitaker', 'Evanston'],
		'#88060': ['Rochelle Fairbanks', 'Plano'],
		'#88062': ['Faith van der Linden', 'Lincoln'],
		'#88064': ['Candace Carpenter', 'Evanston'],
		'#88067': ['Haley Freeman', 'Provo'],
		'#88074': ['Rebecca MacKinnon', 'Buffalo'],
		'#88078': ['Jennifer McDaniel', 'Peoria'],
		'#88079': ['Beatrice Hollings', 'Ames'],
	};

	/*
	 * Every visit, oldest first. A status is requested (the studio has yet to
	 * accept), confirmed, done or canceled. `when` is the studio's local start,
	 * and each log line is a timestamp, two spaces, then what happened. A visit
	 * is paid by deposit (the rest settled in the studio), with a shop order,
	 * with a made-to-measure tailoring order, in the studio on the day (which also
	 * sets its price), or not at all for Aftercare Plan members.
	 */
	const BOOKINGS = [
		/* Finished visits from September. */
		visit({
			id: '#3079',
			status: 'done',
			customer: '#88048',
			service: 'styling',
			staff: 'carly',
			where: 'video',
			when: '2026-09-02 10:00',
			pay: { kind: 'order', order: '#415' },
			note: 'Light layers for a humid city, and one good blazer for trips.',
			log: `
        2026-08-28 10:04  Asked for this time with the order
        2026-08-28 11:20  Carly Dillon confirmed it
        2026-09-02 11:30  Session done`,
		}),
		visit({
			id: '#3087',
			status: 'done',
			customer: '#88052',
			service: 'styling',
			staff: 'carly',
			where: 'decatur',
			when: '2026-09-12 11:00',
			pay: { kind: 'order', order: '#420' },
			note: 'Paid with a gift card from my sister. Mostly silk, please.',
			log: `
        2026-09-07 10:12  Asked for this time with the order
        2026-09-07 14:02  Carly Dillon confirmed it
        2026-09-12 12:30  Session done`,
		}),
		visit({
			id: '#3091',
			status: 'done',
			customer: '#88046',
			service: 'fit1',
			staff: 'theo',
			where: 'chicago',
			when: '2026-09-21 11:00',
			pay: { kind: 'coat', order: '#426' },
			note: 'Charcoal wool. I usually wear a 40 regular.',
			log: `
        2026-09-15 09:40  Booked with the tailoring order
        2026-09-15 09:40  Confirmed automatically
        2026-09-21 12:00  Fitting done, cloth chosen`,
		}),

		/* Earlier this week. */
		visit({
			id: '#3112',
			status: 'done',
			customer: '#88044',
			service: 'alter',
			staff: 'theo',
			where: 'chicago',
			when: '2026-10-05 11:00',
			...paidInStudio(25),
			note: 'Shorten the sleeves on the Chalk-Stripe Suit.',
			log: `
        2026-10-01 18:22  Booked online
        2026-10-01 18:22  Confirmed automatically
        2026-10-05 11:20  Done, $25 paid by card`,
		}),
		visit({
			id: '#3114',
			status: 'done',
			customer: '#88074',
			service: 'styling',
			staff: 'dawn',
			where: 'trenton',
			when: '2026-10-06 14:00',
			pay: deposit('2026-09-28', 'Visa ending 2281'),
			note: 'In Trenton for a week. Looking for tailoring that packs well.',
			log: `
        2026-09-28 20:15  Asked for this time
        2026-09-28 20:15  $100 deposit paid
        2026-09-29 10:05  Dawn Middleton confirmed it
        2026-10-06 15:30  Session done, $250 paid`,
		}),
		visit({
			id: '#3115',
			status: 'done',
			customer: '#88053',
			service: 'care',
			staff: 'harvey',
			where: 'decatur',
			when: '2026-10-07 10:30',
			pay: { kind: 'club' },
			note: 'A pulled thread on a Draped Column Gown.',
			log: `
        2026-10-04 09:12  Booked online
        2026-10-04 09:12  Confirmed automatically
        2026-10-07 10:45  Dress dropped off, ready Oct 14`,
		}),
		visit({
			id: '#3117',
			status: 'done',
			customer: '#88031',
			service: 'styling',
			staff: 'elaine',
			where: 'chicago',
			when: '2026-10-08 12:00',
			pay: deposit('2026-09-24', 'Mastercard ending 0932'),
			note: 'Work clothes that are not black for once.',
			log: `
        2026-09-24 13:41  Asked for this time
        2026-09-24 13:41  $100 deposit paid
        2026-09-24 16:02  Elaine Nugent confirmed it
        2026-10-08 13:30  Session done, $250 paid`,
		}),
		visit({
			id: '#3118',
			status: 'canceled',
			customer: '#88078',
			service: 'styling',
			staff: 'carly',
			where: 'video',
			when: '2026-10-08 15:00',
			pay: { ...deposit('2026-09-30', 'Visa ending 7710'), refunded: '2026-10-06' },
			note: 'Something warm for a Peoria winter.',
			cancel: 'Asked to move it to November. Deposit refunded.',
			log: `
        2026-09-30 19:02  Asked for this time
        2026-09-30 19:02  $100 deposit paid
        2026-10-01 09:30  Carly Dillon confirmed it
        2026-10-06 08:55  Canceled by the customer, deposit refunded`,
		}),

		/* Today's book, Friday, October 9. */
		visit({
			id: '#3120',
			status: 'confirmed',
			customer: '#88064',
			service: 'styling',
			staff: 'elaine',
			where: 'chicago',
			when: '2026-10-09 10:00',
			pay: deposit('2026-09-30', 'Visa ending 4417'),
			note: 'A few pieces for a wedding weekend in the country.',
			log: `
        2026-09-30 21:10  Asked for this time
        2026-09-30 21:10  $100 deposit paid
        2026-10-01 10:02  Elaine Nugent confirmed it
        2026-10-08 10:00  Reminder email sent`,
		}),
		visit({
			id: '#3121',
			status: 'confirmed',
			customer: '#88046',
			service: 'fit2',
			staff: 'theo',
			where: 'chicago',
			when: '2026-10-09 11:00',
			pay: { kind: 'coat', order: '#426' },
			note: 'Flying in that morning, may be ten minutes late.',
			log: `
        2026-09-21 12:05  Booked by Theo Barlow after the first fitting
        2026-10-08 11:00  Reminder email sent`,
		}),
		visit({
			id: '#3122',
			status: 'confirmed',
			customer: '#88059',
			service: 'alter',
			staff: 'elaine',
			where: 'chicago',
			when: '2026-10-09 13:00',
			...paidInStudio(35),
			note: 'Shorten the sleeves on the Sculpted Shoulder Blazer.',
			log: `
        2026-10-06 08:31  Booked online
        2026-10-06 08:31  Confirmed automatically
        2026-10-08 13:00  Reminder email sent`,
		}),
		visit({
			id: '#3124',
			status: 'confirmed',
			customer: '#88042',
			service: 'styling',
			staff: 'dawn',
			where: 'video',
			when: '2026-10-09 11:00',
			pay: deposit('2026-10-01', 'Amex ending 1009'),
			note: 'Concord gets cold fast. Layers I can wear to the office.',
			log: `
        2026-10-01 17:48  Asked for this time
        2026-10-01 17:48  $100 deposit paid
        2026-10-02 09:15  Dawn Middleton confirmed it
        2026-10-08 11:00  Reminder email sent`,
		}),
		visit({
			id: '#3125',
			status: 'confirmed',
			customer: '#88041',
			service: 'styling',
			staff: 'dawn',
			where: 'trenton',
			when: '2026-10-09 14:00',
			pay: deposit('2026-10-02', 'Visa ending 3306'),
			note: 'Building a winter wardrobe around a gray coat I already own. Medium in jackets.',
			log: `
        2026-10-02 19:26  Asked for this time
        2026-10-02 19:26  $100 deposit paid
        2026-10-03 09:40  Dawn Middleton confirmed it
        2026-10-08 14:00  Reminder email sent`,
		}),
		visit({
			id: '#3126',
			status: 'confirmed',
			customer: '#88079',
			service: 'alter',
			staff: 'harvey',
			where: 'decatur',
			when: '2026-10-09 12:00',
			...paidInStudio(30),
			note: 'Take up the hem on the Draped Column Gown, about two inches.',
			log: `
        2026-10-05 12:14  Booked online
        2026-10-05 12:14  Confirmed automatically
        2026-10-08 12:00  Reminder email sent`,
		}),
		visit({
			id: '#3127',
			status: 'confirmed',
			customer: '#88043',
			service: 'care',
			staff: 'harvey',
			where: 'decatur',
			when: '2026-10-09 16:00',
			pay: { kind: 'club' },
			note: 'Two Bar Loafers with loose side seams.',
			log: `
        2026-10-07 07:50  Booked online
        2026-10-07 07:50  Confirmed automatically`,
		}),
		visit({
			id: '#3128',
			status: 'confirmed',
			customer: '#88062',
			service: 'styling',
			staff: 'carly',
			where: 'video',
			when: '2026-10-09 14:30',
			pay: deposit('2026-10-03', 'Mastercard ending 5520'),
			note: 'I cycle to work. Warm, but nothing too long.',
			log: `
        2026-10-03 21:33  Asked for this time
        2026-10-03 21:33  $100 deposit paid
        2026-10-05 09:10  Carly Dillon confirmed it
        2026-10-08 14:30  Reminder email sent`,
		}),

		/* Coming up, including requests still waiting for an answer. */
		visit({
			id: '#3129',
			status: 'requested',
			customer: '#88044',
			service: 'styling',
			staff: 'elaine',
			where: 'chicago',
			when: '2026-10-10 11:00',
			pay: { kind: 'order', order: '#475' },
			note: 'Back in Evanston on Saturday. Happy to come at noon instead.',
			log: `
        2026-10-07 10:20  Asked for this time with the order`,
		}),
		visit({
			id: '#3130',
			status: 'confirmed',
			customer: '#88052',
			service: 'alter',
			staff: 'harvey',
			where: 'decatur',
			when: '2026-10-10 12:00',
			...paidInStudio(25),
			note: 'Take in the waist on the Leather Trench Coat.',
			log: `
        2026-10-06 16:02  Booked online
        2026-10-06 16:02  Confirmed automatically`,
		}),
		visit({
			id: '#3131',
			status: 'requested',
			customer: '#88060',
			service: 'styling',
			staff: 'elaine',
			where: 'video',
			when: '2026-10-13 11:00',
			pay: { kind: 'order', order: '#480' },
			note: 'A gift from my daughter. Mornings suit me best.',
			log: `
        2026-10-08 13:15  Asked for this time with the order`,
		}),
		visit({
			id: '#3132',
			status: 'requested',
			customer: '#88067',
			service: 'styling',
			staff: 'carly',
			where: 'video',
			when: '2026-10-14 10:00',
			pay: deposit('2026-10-09', 'Visa ending 8842'),
			note: 'Evening in Provo works well. Silk for spring next year too.',
			log: `
        2026-10-09 08:15  Asked for this time
        2026-10-09 08:15  $100 deposit paid`,
		}),
	];

	/* Shop-wide settings, edited from the Services page. */
	const RULES = {
		ahead: 8 /* weeks ahead a customer may book */,
		reminder: 24 /* hours before the visit; 0 sends none */,
		expire: 48 /* hours an unanswered request waits before it is declined and refunded */,
		keepDeposit: true /* a no-show forfeits the deposit */,
	};

	const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTH_NAMES = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	const DOLLARS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

	/** Hands the records and helpers to the pages under their published names. */
	function publish() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.bookings = {
			NOW: CLOCK,
			TODAY: CLOCK_DAY,
			OPEN: STUDIO_HOURS,
			studios: STUDIO_SITES,
			video: REMOTE,
			staff: TEAM,
			services: SERVICES,
			groups: FAMILIES,
			bookings: BOOKINGS,
			rules: RULES,
			recordWithId: findBooking,
			service: findService,
			person: findTeamMember,
			place: findLocation,
			lengthOf: durationOf,
			endOf: finishTime,
			priceOf: chargeFor,
			isOpenDay: isTradingDay,
			weekStart: mondayOf,
			freeSlots: openStartTimes,
			mins: toMinutes,
			hhmm: toClock,
			addDays: shiftDay,
			toDate: parseDay,
			toISO: formatDay,
			fmtTime: timeLabel,
			fmtRange: rangeLabel,
			fmtDay: weekdayDateLabel,
			fmtLong: longDayLabel,
			fmtShort: shortDayLabel,
			fmtMinutes: durationLabel,
			money: dollars,
		};
	}

	/* Builders for the records above. Each returns fresh objects and arrays,
     because the pages edit records in place. */

	function coatFitting(id, name, minutes, online, note) {
		return {
			id,
			name,
			short: name,
			...COAT_FITTING,
			minutes,
			online,
			note,
			where: ['studio'],
			staff: ['theo', 'harvey'],
		};
	}

	/**
	 * Turns a compact entry into the booking the pages read: `when` becomes
	 * date and time, the shopper's name and city come from SHOPPERS, and the
	 * log text becomes [timestamp, text] pairs, oldest first.
	 */
	function visit({ when, log, ...record }) {
		const [date, time] = when.split(' ');
		const [name, city] = SHOPPERS[record.customer];
		const history = log
			.trim()
			.split('\n')
			.map((line) => {
				const entry = line.trim();
				return [entry.slice(0, 16), entry.slice(18)];
			});
		return { ...record, name, city, date, time, log: history };
	}

	/** A $100 deposit taken at booking; the rest is due in the studio. */
	function deposit(paid, card) {
		return { kind: 'deposit', amount: 100, paid, card };
	}

	/** Paid on the day, so the amount is also the visit's own price. */
	function paidInStudio(amount) {
		return { price: amount, pay: { kind: 'studio', amount } };
	}

	/* Lookups by id. Each answers null when nothing matches. */

	/** The booking with this id, as in "#3120". */
	function findBooking(id) {
		return BOOKINGS.find((entry) => entry.id === id) ?? null;
	}

	/** The bookable service with this id. */
	function findService(id) {
		return SERVICES.find((entry) => entry.id === id) ?? null;
	}

	/** The stylist or tailor with this id. */
	function findTeamMember(id) {
		return TEAM.find((member) => member.id === id) ?? null;
	}

	/** A studio by id, or the video-call stand-in for 'video'. */
	function findLocation(id) {
		if (id === REMOTE.id) return REMOTE;
		return STUDIO_SITES.find((location) => location.id === id) ?? null;
	}

	/* Facts about a single booking. */

	/** How many minutes the booked service runs, buffer excluded. */
	function durationOf({ service }) {
		return findService(service).minutes;
	}

	/** The "HH:MM" at which a booking ends. */
	function finishTime({ time, service }) {
		return toClock(toMinutes(time) + findService(service).minutes);
	}

	/** The booking's own price when it has one, otherwise its service's. */
	function chargeFor({ price, service }) {
		return price ?? findService(service).price;
	}

	/** Minutes [from, to) a booking keeps its person busy, buffer included. */
	function busySpan({ service, time }) {
		const { minutes, buffer } = findService(service);
		const begins = toMinutes(time);
		return [begins, begins + minutes + buffer];
	}

	/* Opening days and free time. */

	/** Whether the studios open on this date. */
	function isTradingDay(iso) {
		return STUDIO_HOURS.days.includes(parseDay(iso).getDay());
	}

	/** The Monday that starts the week containing `iso`. */
	function mondayOf(iso) {
		const sinceMonday = (parseDay(iso).getDay() + 6) % 7;
		return shiftDay(iso, -sinceMonday);
	}

	/**
	 * Half-hourly start times from opening at which `staffId` can take
	 * `serviceId` on `iso` without running into another booking or its buffer.
	 * Today, nothing earlier than half an hour from now is offered.
	 * `skipId` leaves one booking out, so it can move within its own day.
	 */
	function openStartTimes(staffId, iso, serviceId, skipId) {
		const wanted = findService(serviceId);
		if (!wanted || !isTradingDay(iso)) return [];

		const busy = BOOKINGS.filter(
			(entry) =>
				entry.staff === staffId && entry.date === iso && entry.id !== skipId && entry.status !== 'canceled',
		).map(busySpan);
		const closing = toMinutes(STUDIO_HOURS.to);
		const notBefore = iso === CLOCK_DAY ? Math.ceil((toMinutes(CLOCK.slice(11)) + 30) / 30) * 30 : 0;
		const starts = [];

		for (let candidate = toMinutes(STUDIO_HOURS.from); candidate + wanted.minutes <= closing; candidate += 30) {
			if (candidate < notBefore) continue;
			const freedAt = candidate + wanted.minutes + wanted.buffer;
			const clear = busy.every(([from, to]) => freedAt <= from || candidate >= to);
			if (clear) starts.push(toClock(candidate));
		}
		return starts;
	}

	/* Clock and calendar arithmetic. Days are parsed at noon so a daylight
     saving change never tips a date into its neighbor. */

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	/** "HH:MM" as minutes past midnight. */
	function toMinutes(clock) {
		const [hours, minutes] = clock.split(':').map(Number);
		return hours * 60 + minutes;
	}

	/** Minutes past midnight back to "HH:MM". */
	function toClock(sinceMidnight) {
		return `${twoDigits(Math.floor(sinceMidnight / 60))}:${twoDigits(sinceMidnight % 60)}`;
	}

	/** A "YYYY-MM-DD" string as a local Date at noon. */
	function parseDay(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day, 12);
	}

	/** A Date as its local "YYYY-MM-DD". */
	function formatDay(noon) {
		return `${noon.getFullYear()}-${twoDigits(noon.getMonth() + 1)}-${twoDigits(noon.getDate())}`;
	}

	/** The date `days` away from `iso`, counting backward when negative. */
	function shiftDay(iso, days) {
		const noon = parseDay(iso);
		noon.setDate(noon.getDate() + days);
		return formatDay(noon);
	}

	/* Wording the pages show. */

	/** "14:00" reads "2 pm", and "14:30" reads "2:30 pm". */
	function timeLabel(clock) {
		const sinceMidnight = toMinutes(clock);
		const hour = Math.floor(sinceMidnight / 60);
		const minute = sinceMidnight % 60;
		const meridiem = hour < 12 ? 'am' : 'pm';
		return `${hour % 12 || 12}${minute ? `:${twoDigits(minute)}` : ''} ${meridiem}`;
	}

	/** "2 to 3:30 pm" inside one half of the day, "11:30 am to 1 pm" across noon. */
	function rangeLabel(start, end) {
		const fromLabel = timeLabel(start);
		const sameHalf = toMinutes(start) < 720 === toMinutes(end) < 720;
		return `${sameHalf ? fromLabel.slice(0, -3) : fromLabel} to ${timeLabel(end)}`;
	}

	/** Short weekday, month and day: "Fri, Oct 9". */
	function weekdayDateLabel(iso) {
		const { weekday, month, day } = calendarParts(iso);
		return `${weekday.slice(0, 3)}, ${month.slice(0, 3)} ${day}`;
	}

	/** Everything spelled out: "Friday, October 9". */
	function longDayLabel(iso) {
		const { weekday, month, day } = calendarParts(iso);
		return `${weekday}, ${month} ${day}`;
	}

	/** Month and day only: "Oct 9". */
	function shortDayLabel(iso) {
		const { month, day } = calendarParts(iso);
		return `${month.slice(0, 3)} ${day}`;
	}

	/** Full weekday and month names plus the day of the month; labels trim them to three letters. */
	function calendarParts(iso) {
		const noon = parseDay(iso);
		return { weekday: WEEKDAYS[noon.getDay()], month: MONTH_NAMES[noon.getMonth()], day: noon.getDate() };
	}

	/** "45 min", "1 hr", "1 hr 30 min", "2 hrs". */
	function durationLabel(length) {
		if (length < 60) return `${length} min`;
		const hours = Math.floor(length / 60);
		const rest = length % 60;
		return `${hours} ${hours === 1 ? 'hr' : 'hrs'}${rest ? ` ${rest} min` : ''}`;
	}

	/** Whole dollars with thousands separators, such as "$1,150". */
	function dollars(amount) {
		return `$${DOLLARS.format(Number(amount))}`;
	}

	publish();
})();
