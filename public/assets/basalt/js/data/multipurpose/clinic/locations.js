/**
 * Bayline Health, the group behind the Healthcare pages: eight sites
 * across San Francisco, as of Friday, October 9, 2026 at 11:20 (the
 * moment the clinic data uses). Broadway Street Clinic is the clinic the
 * other pages show; its figures match clinic.js (86 booked, 31 seen, 6 of
 * 8 exam rooms in use).
 *
 * window.Basalt.data.locations carries the sites with their address,
 * hours for the week, who is on site today,
 * how busy each is, what it offers and who runs it. Replace the list with
 * the same fields to run it on real sites.
 */
(() => {
	'use strict';

	const AS_OF = '2026-10-09';
	/* 11:20 in minutes after midnight; today is a Friday (index 4, Monday first). */
	const NOW = 680;
	const TODAY = 4;
	const h = (text) => {
		const [hours, minutes] = text.split(':').map(Number);
		return hours * 60 + minutes;
	};
	const span = (from, to) => [h(from), h(to)];
	const weekdays = (from, to, sat, sun) => [
		span(from, to),
		span(from, to),
		span(from, to),
		span(from, to),
		span(from, to),
		sat ? span(...sat) : null,
		sun ? span(...sun) : null,
	];

	const kinds = {
		office: { name: 'Office', plural: 'Offices' },
		urgent: { name: 'Urgent care', plural: 'Urgent care' },
		hospital: { name: 'Hospital', plural: 'Hospital' },
		lab: { name: 'Lab & imaging', plural: 'Lab & Imaging' },
	};

	const sites = [
		{
			id: 'broadway',
			name: 'Broadway Street Clinic',
			short: 'Broadway Street',
			kind: 'office',
			area: 'North Beach',
			city: 'San Francisco',
			address: '540 Broadway, San Francisco, CA 94133',
			phone: '(415) 555-0142',
			week: weekdays('7:30', '19:00', ['9:00', '13:00']),
			providers: [
				{ name: 'Dr. Emily Pearce', role: 'Family medicine', id: 'ev' },
				{ name: 'Dr. Edward Morgan', role: 'Internal medicine', id: 'km' },
				{ name: 'Dr. Laura Hughes', role: 'Pediatrics', id: 'ao' },
				{ name: 'Dr. Robert Hayes', role: 'Cardiology', id: 'rc' },
				{ name: 'Megan Price', role: 'Nurse practitioner', id: 'pn' },
				{ name: 'Dr. Russell Ashby', role: 'Orthopedics', id: 'ta' },
				{ name: 'Dr. Rachel Moore', role: 'Pulmonology', id: 'nh' },
				{ name: 'Dr. Susan Clark', role: 'Gastroenterology', id: 'mt' },
				{ name: 'Dr. Kevin Ward', role: 'Physiotherapy', id: 'lr' },
				{ name: 'Dr. Diane Ellery', role: 'Psychiatry', id: 'sr' },
				{ name: 'Dr. Paul Foster', role: 'Ear, nose & throat', id: 'hm' },
				{ name: 'Dr. Brian Lewis', role: 'Dermatology', id: 'co' },
			],
			out: [],
			rooms: { used: 6, of: 8, noun: 'exam rooms' },
			booked: 86,
			seen: 31,
			waiting: 9,
			next: { day: 'Tue, Oct 13', time: '9:40 am', with: 'Dr. Emily Pearce' },
			accepting: true,
			services: [
				'Primary care',
				'Cardiology',
				'Orthopedics',
				'Respiratory',
				'Ear, nose & throat',
				'Gastroenterology',
				'Mental health',
				'Dermatology',
				'Pharmacy',
				'Lab draws',
				'Vaccines',
				'Telehealth',
			],
			manager: 'Teresa Nolan',
			page: 'appointments.html',
		},
		{
			id: 'nobhill',
			name: 'Nob Hill Clinic',
			short: 'Nob Hill',
			kind: 'office',
			area: 'Nob Hill',
			city: 'San Francisco',
			address: '1155 Pine Street, San Francisco, CA 94109',
			phone: '(415) 555-0178',
			week: weekdays('8:00', '17:00'),
			/* Closed today for the twice-yearly staff training day. */
			closedToday: 'Staff training day. Calls go to Broadway Street.',
			providers: [],
			out: [
				{ name: 'Dr. Andrew Pham', role: 'Family medicine' },
				{ name: 'Dr. Leah Morrison', role: 'Pediatrics' },
				{ name: 'Grace Whitfield', role: 'Nurse practitioner' },
			],
			rooms: { used: 0, of: 6, noun: 'exam rooms' },
			booked: 0,
			seen: 0,
			waiting: 0,
			next: { day: 'Mon, Oct 12', time: '8:40 am', with: 'Dr. Andrew Pham' },
			accepting: true,
			services: ['Primary care', 'Pediatrics', 'Vaccines', 'Lab draws', 'Telehealth'],
			manager: 'Darnell Wilkes',
			page: 'appointments.html',
		},
		{
			id: 'marina',
			name: 'Marina Clinic',
			short: 'Marina',
			kind: 'office',
			area: 'Marina',
			city: 'San Francisco',
			address: '2185 Chestnut Street, San Francisco, CA 94123',
			phone: '(415) 555-0119',
			week: weekdays('8:00', '18:00', ['9:00', '12:00']),
			providers: [
				{ name: 'Dr. Nathan Brooks', role: 'Family medicine' },
				{ name: 'Dr. Priya Raman', role: 'Internal medicine' },
				{ name: 'Dr. Carmen Ortiz', role: 'Pediatrics' },
				{ name: 'Lauren Fisk', role: 'Nurse practitioner' },
			],
			out: [{ name: 'Dr. Owen Gallagher', role: 'Family medicine', why: 'out sick' }],
			rooms: { used: 7, of: 8, noun: 'exam rooms' },
			booked: 52,
			seen: 21,
			waiting: 6,
			next: null,
			waitlist: 23,
			accepting: false,
			services: ['Primary care', 'Pediatrics', "Women's health", 'Lab draws', 'Vaccines', 'Telehealth'],
			manager: 'Kristen Albright',
			attention: {
				why: 'Short-staffed',
				text: 'one provider out sick (Dr. Gallagher), 11 visits to move.',
				act: 'Ask for cover',
				done: 'Cover asked',
				toast: 'Broadway Street can lend Megan Price from 1:00 pm. Kristen gets a text.',
			},
			page: 'appointments.html',
		},
		{
			id: 'presidio',
			name: 'Presidio Clinic',
			short: 'Presidio',
			kind: 'office',
			area: 'Presidio Heights',
			city: 'San Francisco',
			address: '3490 California Street, San Francisco, CA 94118',
			phone: '(415) 555-0163',
			/* Friday is a half day here. */
			week: [
				span('8:00', '17:00'),
				span('8:00', '17:00'),
				span('8:00', '17:00'),
				span('8:00', '17:00'),
				span('8:00', '12:00'),
				null,
				null,
			],
			providers: [
				{ name: 'Dr. Marcus Bell', role: 'Family medicine' },
				{ name: 'Jenna Holt', role: 'Physician assistant' },
			],
			out: [],
			rooms: { used: 2, of: 5, noun: 'exam rooms' },
			booked: 14,
			seen: 11,
			waiting: 1,
			next: { day: 'Mon, Oct 12', time: '8:20 am', with: 'Dr. Marcus Bell' },
			accepting: true,
			services: ['Primary care', 'Vaccines', 'Lab draws', 'Telehealth'],
			manager: 'Miguel Serrano',
			page: 'appointments.html',
		},
		{
			id: 'embarcadero-uc',
			name: 'Embarcadero Urgent Care',
			short: 'Embarcadero UC',
			kind: 'urgent',
			area: 'Embarcadero',
			city: 'San Francisco',
			address: '88 Steuart Street, San Francisco, CA 94105',
			phone: '(415) 555-0127',
			week: [
				span('9:00', '21:00'),
				span('9:00', '21:00'),
				span('9:00', '21:00'),
				span('9:00', '21:00'),
				span('9:00', '21:00'),
				span('9:00', '21:00'),
				span('9:00', '21:00'),
			],
			providers: [
				{ name: 'Dr. Sofia Delgado', role: 'Emergency medicine' },
				{ name: 'Tyler Rhodes', role: 'Physician assistant' },
			],
			out: [],
			rooms: { used: 5, of: 6, noun: 'exam rooms' },
			/* Urgent care: online check-ins plus walk-ins; past hours are arrivals. */
			booked: 12,
			arrived: 16,
			seen: 10,
			waiting: 6,
			postedWait: 35,
			target: 30,
			next: null,
			accepting: true,
			services: [
				'Urgent care',
				'X-ray',
				'Stitches',
				'Sprains & fractures',
				'Flu & COVID tests',
				'Sports physicals',
			],
			manager: 'Miguel Serrano',
			attention: {
				why: 'Wait over target',
				text: 'posted wait 35 min, target 30; SoMa is at 15.',
				act: 'Send to SoMa',
				done: 'Sent to SoMa',
				toast: 'Online check-in now points new arrivals to SoMa Urgent Care (15 min).',
			},
			page: 'appointments.html',
		},
		{
			id: 'soma-uc',
			name: 'SoMa Urgent Care',
			short: 'SoMa UC',
			kind: 'urgent',
			area: 'SoMa',
			city: 'San Francisco',
			address: '725 Harrison Street, San Francisco, CA 94107',
			phone: '(415) 555-0185',
			week: [
				span('8:00', '20:00'),
				span('8:00', '20:00'),
				span('8:00', '20:00'),
				span('8:00', '20:00'),
				span('8:00', '20:00'),
				span('9:00', '17:00'),
				span('9:00', '17:00'),
			],
			providers: [
				{ name: 'Dr. Grant Whitaker', role: 'Emergency medicine' },
				{ name: 'Alicia Kim', role: 'Nurse practitioner' },
			],
			out: [],
			rooms: { used: 3, of: 6, noun: 'exam rooms' },
			booked: 13,
			arrived: 15,
			seen: 12,
			waiting: 3,
			postedWait: 15,
			target: 30,
			next: null,
			accepting: true,
			services: [
				'Urgent care',
				'X-ray',
				'Stitches',
				'Sprains & fractures',
				'Flu & COVID tests',
				'Sports physicals',
			],
			manager: 'Heather Lindqvist',
			page: 'appointments.html',
		},
		{
			id: 'missionbay',
			name: 'Mission Bay Hospital',
			short: 'Mission Bay Hospital',
			kind: 'hospital',
			area: 'Mission Bay',
			city: 'San Francisco',
			address: '1600 Owens Street, San Francisco, CA 94158',
			phone: '(415) 555-0100',
			week: [
				span('0:00', '24:00'),
				span('0:00', '24:00'),
				span('0:00', '24:00'),
				span('0:00', '24:00'),
				span('0:00', '24:00'),
				span('0:00', '24:00'),
				span('0:00', '24:00'),
			],
			providers: [
				{ name: 'Dr. Hannah Cho', role: 'Emergency, attending' },
				{ name: 'Dr. Claire Donovan', role: 'Emergency' },
				{ name: 'Dr. Victor Salazar', role: 'Hospitalist' },
				{ name: 'Dr. Samuel Adeyemi', role: 'Hospitalist' },
				{ name: 'Dr. Isaac Turner', role: 'General surgery' },
				{ name: 'Dr. Rebecca Lin', role: 'Anesthesiology' },
			],
			/* Physicians in the building now; nurses are counted on Staffing. */
			onSite: 31,
			out: [],
			rooms: { used: 18, of: 22, noun: 'ER bays' },
			beds: { free: 11, of: 148 },
			ors: { used: 5, of: 8 },
			/* The ER since midnight; the hours band shows it from 6:00. */
			arrived: 58,
			seen: 50,
			waiting: 8,
			postedWait: 38,
			target: 30,
			booked: 31,
			next: null,
			accepting: true,
			services: ['Emergency', 'Wards', 'Surgery', 'ICU', 'Labor & delivery', 'Imaging', 'Pharmacy'],
			manager: 'Gregory Ames',
			managerRole: 'Hospital administrator',
			attention: {
				why: 'ER wait over target',
				text: 'ER at 38 min to a provider, target 30; 11 of 148 beds free.',
				act: 'Open ER queue',
				href: 'emergency-queue.html',
			},
			page: 'wards-and-beds.html',
		},
		{
			id: 'dogpatch',
			name: 'Dogpatch Lab & Imaging',
			short: 'Dogpatch Lab',
			kind: 'lab',
			area: 'Dogpatch',
			city: 'San Francisco',
			address: '2301 3rd Street, San Francisco, CA 94107',
			phone: '(415) 555-0131',
			week: weekdays('6:30', '19:00', ['7:00', '12:00']),
			providers: [
				{ name: 'Dr. Philip Sandoval', role: 'Radiology' },
				{ name: 'Dr. Naomi Fischer', role: 'Radiology' },
			],
			out: [],
			rooms: { used: 4, of: 5, noun: 'draw chairs' },
			scanners: { used: 3, of: 5 },
			booked: 64,
			seen: 29,
			waiting: 0,
			queue: 7,
			queueWait: 18,
			next: { day: 'Tue, Oct 13', time: '7:15 am', with: 'MRI' },
			accepting: true,
			services: ['Blood draws', 'X-ray', 'Ultrasound', 'CT', 'MRI', 'Mammography'],
			manager: 'Bianca Ferraro',
			page: 'lab-orders-and-results.html',
		},
		{
			id: 'hayesvalley',
			name: 'Hayes Valley Clinic',
			short: 'Hayes Valley',
			kind: 'office',
			area: 'Hayes Valley',
			city: 'San Francisco',
			address: '415 Octavia Street, San Francisco, CA 94102',
			phone: '(415) 555-0156',
			week: weekdays('8:00', '18:00', ['9:00', '13:00']),
			opensOn: 'Nov 16',
			/* Getting ready: hires against the team it opens with, the build-out,
			   and members who signed up ahead, each week for the last six. */
			opening: {
				date: 'Monday, November 16, 2026',
				hired: [1, 2, 3, 3, 4, 5],
				team: 8,
				fitOut: [20, 32, 45, 55, 63, 70],
				signedUp: [18, 53, 105, 179, 280, 412],
				goal: 600,
			},
			providers: [],
			out: [
				{ name: 'Dr. Naomi Castellanos', role: 'Family medicine' },
				{ name: 'Dr. Julian Reyes', role: 'Pediatrics' },
				{ name: 'Priya Desai', role: 'Nurse practitioner' },
				{ name: 'Owen Whitaker', role: 'Physician assistant' },
				{ name: 'Dr. Tessa Lindqvist', role: 'Internal medicine' },
			],
			rooms: { used: 0, of: 7, noun: 'exam rooms' },
			booked: 0,
			seen: 0,
			waiting: 0,
			next: { day: 'Mon, Nov 16', time: '8:00 am', with: 'Dr. Naomi Castellanos' },
			accepting: true,
			services: ['Primary care', 'Pediatrics', 'Vaccines', 'Lab draws', 'Telehealth'],
			manager: 'Renata Okafor',
			page: 'appointments.html',
		},
	];

	/* Today hour by hour, 6 am to the 11 am hour so far: patients seen in
	   each hour, rooms (bays, chairs) in use on the hour, and the one
	   queue each kind of site watches: the waiting room, the posted wait,
	   the ER's waiting and free beds, the draw queue. alertSince is the
	   hour a site started to need the lead. The hospital's seen counts the
	   ER and scheduled cases; 25 more were seen before 6 am. */
	const byHour = {
		broadway: { seen: [0, 2, 8, 9, 8, 4], rooms: [0, 1, 5, 7, 8, 6], waiting: [0, 1, 4, 6, 8, 9] },
		nobhill: { seen: [0, 0, 0, 0, 0, 0], rooms: [0, 0, 0, 0, 0, 0], waiting: [0, 0, 0, 0, 0, 0] },
		marina: { seen: [0, 0, 6, 7, 6, 2], rooms: [0, 0, 6, 8, 8, 7], waiting: [0, 0, 3, 5, 7, 6], alertSince: 8 },
		presidio: { seen: [0, 0, 4, 4, 3, 0], rooms: [0, 0, 3, 4, 3, 2], waiting: [0, 0, 2, 3, 2, 1] },
		'embarcadero-uc': {
			seen: [0, 0, 0, 3, 4, 3],
			rooms: [0, 0, 0, 4, 5, 5],
			wait: [0, 0, 0, 15, 25, 35],
			alertSince: 10,
		},
		'soma-uc': { seen: [0, 0, 3, 4, 3, 2], rooms: [0, 0, 2, 4, 4, 3], wait: [0, 0, 10, 15, 20, 15] },
		missionbay: {
			seen: [4, 5, 7, 8, 9, 6],
			rooms: [12, 13, 15, 17, 19, 18],
			waiting: [3, 4, 6, 7, 9, 8],
			beds: [16, 15, 14, 13, 12, 11],
			alertSince: 9,
		},
		hayesvalley: { seen: [0, 0, 0, 0, 0, 0], rooms: [0, 0, 0, 0, 0, 0], waiting: [0, 0, 0, 0, 0, 0] },
		dogpatch: { seen: [3, 7, 6, 6, 5, 2], rooms: [2, 4, 5, 5, 4, 4], queue: [2, 6, 5, 4, 6, 7] },
	};
	for (const site of sites) site.byHour = byHour[site.id];

	/* The owner's scorecard: revenue this month to date against its target
	   (thousands of dollars, Oct 1 to 9), today's booked share of the
	   rooms, chairs or (at the hospital) beds, days to the next new-patient
	   slot (0 is walk in), and providers in against those needed today. */
	const scores = {
		broadway: { revenue: [93.4, 90], booked: 90, newIn: 4, staff: [12, 12] },
		nobhill: { revenue: [44.8, 46], booked: 0, newIn: 3, staff: [0, 0] },
		marina: { revenue: [61.2, 68], booked: 94, newIn: null, staff: [4, 5] },
		presidio: { revenue: [27.9, 27], booked: 70, newIn: 3, staff: [2, 2] },
		'embarcadero-uc': { revenue: [59.3, 52], booked: 88, newIn: 0, staff: [2, 2] },
		'soma-uc': { revenue: [43.1, 45], booked: 64, newIn: 0, staff: [2, 2] },
		missionbay: { revenue: [2490, 2400], booked: 93, newIn: null, staff: [31, 33] },
		dogpatch: { revenue: [40.7, 42], booked: 85, newIn: 0, staff: [2, 2] },
	};
	/* The group's month so far, a value per day from Thursday, Oct 1:
	   revenue in thousands (today is so far) and new members. */
	const month = {
		days: ['Oct 1', 'Oct 2', 'Oct 3', 'Oct 4', 'Oct 5', 'Oct 6', 'Oct 7', 'Oct 8', 'Oct 9'],
		revenue: [352, 361, 190, 176, 366, 362, 371, 384, 298.4],
		target: 2770,
		members: [14, 11, 3, 2, 16, 12, 15, 13, 6],
	};
	for (const site of sites) site.score = scores[site.id] || null;

	/* What the Location Details page adds per site: visits and revenue for
	   the last 12 weeks (oldest first, the week ending Oct 9 last), members
	   whose home office it is by plan, reviews, holiday hours, prior
	   authorizations waiting on an insurer, supplies running low, and the
	   days each provider works there. */
	const details = {
		broadway: {
			visits: [402, 418, 395, 431, 440, 426, 452, 447, 461, 438, 470, 458],
			fee: 148,
			members: [
				['Core', 2810],
				['Family', 1374],
				['Employer', 628],
			],
			rating: 4.7,
			reviewCount: 312,
			reviews: [
				['Carla Dennison', 5, 'Seen on time and Dr. Pearce actually listened.', 'Dr. Emily Pearce'],
				['Victor Mayhew', 4, 'Front desk was quick; parking on Broadway is not.', 'Dr. Edward Morgan'],
			],
		},
		nobhill: {
			visits: [221, 230, 214, 226, 238, 229, 240, 233, 244, 236, 251, 198],
			fee: 139,
			members: [
				['Core', 1320],
				['Family', 640],
				['Employer', 180],
			],
			rating: 4.6,
			reviewCount: 148,
			reviews: [
				['Janelle Okafor', 5, 'Dr. Morrison is wonderful with my two boys.', 'Dr. Leah Morrison'],
				['Bryce Holloway', 4, 'Easy booking, a short wait for a draw.', 'Grace Whitfield'],
			],
		},
		marina: {
			visits: [262, 270, 268, 281, 275, 288, 292, 286, 301, 297, 305, 248],
			fee: 144,
			members: [
				['Core', 2040],
				['Family', 905],
				['Employer', 420],
			],
			rating: 4.5,
			reviewCount: 201,
			reviews: [
				['Gloria Fenwick', 5, 'Dr. Raman explained every result in plain words.', 'Dr. Priya Raman'],
				['Trent Wexler', 3, 'Good care, but my visit moved to video twice.', 'Dr. Owen Gallagher'],
			],
		},
		presidio: {
			visits: [118, 124, 120, 129, 126, 131, 128, 135, 133, 138, 141, 136],
			fee: 139,
			members: [
				['Core', 1105],
				['Family', 512],
				['Employer', 163],
			],
			rating: 4.8,
			reviewCount: 96,
			reviews: [
				['Rosa Villanueva', 5, 'In and out in twenty minutes with a plan.', 'Dr. Marcus Bell'],
				['Dale Pritchett', 5, 'Jenna caught what two clinics missed.', 'Jenna Holt'],
			],
		},
		'embarcadero-uc': {
			visits: [176, 184, 171, 190, 198, 205, 193, 214, 226, 231, 247, 252],
			fee: 172,
			members: null,
			rating: 4.2,
			reviewCount: 188,
			reviews: [
				['Marcus Albee', 4, 'Stitches done well; the wait ran long on a Friday.', 'Dr. Sofia Delgado'],
				['Hannah Strobel', 4, 'Online check-in saved me an hour.', 'Tyler Rhodes'],
			],
		},
		'soma-uc': {
			visits: [158, 162, 155, 168, 171, 166, 174, 170, 181, 177, 183, 179],
			fee: 172,
			members: null,
			rating: 4.6,
			reviewCount: 164,
			reviews: [
				['Felix Garroway', 5, 'X-ray and a splint in under an hour.', 'Dr. Grant Whitaker'],
				['Nadia Brennan', 4, 'Kind staff, clean rooms.', 'Alicia Kim'],
			],
		},
		missionbay: {
			visits: [1288, 1305, 1279, 1322, 1340, 1318, 1356, 1349, 1372, 1366, 1391, 1408],
			fee: 1260,
			members: null,
			rating: 4.3,
			reviewCount: 522,
			reviews: [
				['Edwin Castellano', 5, 'The ER team was calm and fast with my father.', 'Dr. Hannah Cho'],
				['Lorraine Pike', 3, 'Great nurses on the ward; discharge took all day.', 'Dr. Victor Salazar'],
			],
		},
		hayesvalley: {
			visits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
			fee: 145,
			members: [
				['Core', 268],
				['Family', 109],
				['Employer', 35],
			],
			rating: 0,
			reviewCount: 0,
			reviews: [],
		},
		dogpatch: {
			visits: [301, 312, 298, 320, 318, 327, 331, 325, 338, 334, 346, 342],
			fee: 86,
			members: null,
			rating: 4.6,
			reviewCount: 233,
			reviews: [
				['Quentin Ashworth', 5, 'MRI ran on time and the tech talked me through it.', 'Dr. Naomi Fischer'],
				['Bev Lindgren', 4, 'Early draws at 6:30 before work are a lifesaver.', 'Dr. Philip Sandoval'],
			],
		},
	};
	/* Holidays the group closes or shortens hours for. */
	const holidays = [
		{ date: 'Thu, Nov 26', name: 'Thanksgiving', hours: null },
		{ date: 'Fri, Nov 27', name: 'Day after Thanksgiving', hours: [540, 780] },
		{ date: 'Fri, Dec 25', name: 'Christmas Day', hours: null },
	];
	/* Prior authorizations and low supplies, by kind of site. */
	const auths = {
		office: [
			['Rhea Calderwood', 'Ozempic, 90 days', 'Pacific Mutual', 'Waiting 4 days'],
			['Gary Tolliver', 'Sleep study', 'Sierra Crest', 'More info asked'],
		],
		urgent: [['Owen Pruitt', 'MRI, left knee', 'Broadway Health Plus', 'Waiting 2 days']],
		hospital: [
			['Iris Lockhart', 'Hip replacement', 'Pacific Mutual', 'Approved'],
			['Wendell Shaw', 'Cardiac rehab, 12 visits', 'Sierra Crest', 'Waiting 6 days'],
			['Mae Corcoran', 'Inpatient rehab stay', 'Broadway Health Plus', 'Denied, appeal due Oct 16'],
		],
		lab: [
			['Doris Kettering', 'CT abdomen with contrast', 'Sierra Crest', 'Waiting 3 days'],
			['Ray Benton', 'MRI lumbar spine', 'Pacific Mutual', 'Approved'],
		],
	};
	const supplies = {
		office: [
			['Flu vaccine, quadrivalent', '18 doses', 'Reorder at 40'],
			['Exam table paper', '6 rolls', 'Reorder at 12'],
		],
		urgent: [
			['Suture kits', '9 kits', 'Reorder at 20'],
			['Fiberglass splints', '5 rolls', 'Reorder at 10'],
		],
		hospital: [
			['IV start kits', '140 kits', 'Reorder at 200'],
			['O-negative blood', '6 units', 'Minimum 10'],
			['N95 respirators', '3 boxes', 'Reorder at 8'],
		],
		lab: [
			['Lavender-top tubes', '220 tubes', 'Reorder at 400'],
			['MRI contrast, 15 mL', '11 vials', 'Reorder at 20'],
		],
	};
	for (const site of sites) {
		site.details = details[site.id];
		site.holidays = holidays.map((day) => ({ ...day }));
		site.auths = site.opensOn ? [] : auths[site.kind];
		site.supplies = site.opensOn ? [] : supplies[site.kind];
		/* Most work every weekday; every third works three days a week. */
		site.providers.concat(site.out).forEach((person, i) => {
			person.days = i % 3 === 2 ? [0, 2, 4] : [0, 1, 2, 3, 4];
		});
	}

	window.Basalt = window.Basalt || {};
	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.locations = {
		asOf: AS_OF,
		now: NOW,
		today: TODAY,
		group: 'Bayline Health',
		metro: 'San Francisco',
		kinds,
		sites,
		month,
		/* The hours the series cover: 6 am to 11 am, the last one so far. */
		hours: [6, 7, 8, 9, 10, 11],
	};
})();
