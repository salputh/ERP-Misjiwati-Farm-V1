/**
 * Broadway Street Clinic's providers as people, for the Provider details page
 * (provider-details.html): when they joined, their training and
 * board, the languages they see patients in, their hours and phone
 * extension, this month's numbers and the time off ahead. Keyed by the
 * provider ids of window.Basalt.data.clinic (clinic.js), which holds their
 * names, roles, departments and rooms. Published as
 * window.Basalt.data.clinicProviders.
 */
(() => {
	'use strict';

	/* `month` is the four weeks to Oct 9: patients seen, average minutes
	   waited, the share of visits started on time and revenue in dollars. */
	const PROFILES = {
		ev: {
			since: '2014',
			school: 'MD, University of Washington',
			board: 'Board certified, family medicine',
			languages: ['English', 'Spanish'],
			hours: 'Mon–Thu 8:00 am–5:30 pm, Fri 8:00 am–1:00 pm',
			ext: '231',
			month: { seen: 217, wait: 6, onTime: 90, revenue: 27200 },
			timeOff: [{ from: 'Oct 22', to: 'Oct 23', why: 'Conference' }],
		},
		km: {
			since: '2016',
			school: 'MD, University of Michigan',
			board: 'Board certified, internal medicine',
			languages: ['English'],
			hours: 'Mon–Fri 8:15 am–5:00 pm',
			ext: '212',
			month: { seen: 157, wait: 5, onTime: 90, revenue: 29400 },
			timeOff: [{ from: 'Nov 13', to: 'Nov 13', why: 'Training' }],
		},
		ao: {
			since: '2017',
			school: 'MD, Ohio State University',
			board: 'Board certified, pediatrics',
			languages: ['English', 'French'],
			hours: 'Mon–Fri 8:00 am–5:00 pm',
			ext: '298',
			month: { seen: 155, wait: 8, onTime: 94, revenue: 29500 },
			timeOff: [],
		},
		rc: {
			since: '2012',
			school: 'MD, Johns Hopkins University',
			board: 'Board certified, cardiology',
			languages: ['English', 'Portuguese'],
			hours: 'Mon–Fri 8:30 am–5:00 pm',
			ext: '236',
			month: { seen: 184, wait: 18, onTime: 81, revenue: 20300 },
			timeOff: [{ from: 'Nov 2', to: 'Nov 6', why: 'Vacation' }],
		},
		pn: {
			since: '2019',
			school: 'MSN, UC San Francisco',
			board: 'Family nurse practitioner',
			languages: ['English'],
			hours: 'Mon–Fri 8:00 am–4:30 pm',
			ext: '204',
			month: { seen: 206, wait: 17, onTime: 86, revenue: 18200 },
			timeOff: [{ from: 'Oct 30', to: 'Oct 30', why: 'Personal day' }],
		},
		ta: {
			since: '2018',
			school: 'MD, Duke University',
			board: 'Board certified, orthopedic surgery',
			languages: ['English'],
			hours: 'Mon–Fri 8:30 am–5:00 pm',
			ext: '240',
			month: { seen: 214, wait: 15, onTime: 89, revenue: 14900 },
			timeOff: [{ from: 'Oct 16', to: 'Oct 16', why: 'Surgery day at Mission Bay' }],
		},
		nh: {
			since: '2020',
			school: 'MD, Boston University',
			board: 'Board certified, pulmonology',
			languages: ['English', 'Arabic'],
			hours: 'Mon–Fri 9:00 am–5:00 pm',
			ext: '244',
			month: { seen: 239, wait: 13, onTime: 85, revenue: 17300 },
			timeOff: [],
		},
		mt: {
			since: '2015',
			school: 'MD, Stanford University',
			board: 'Board certified, gastroenterology',
			languages: ['English'],
			hours: 'Mon–Fri 8:00 am–4:00 pm',
			ext: '261',
			month: { seen: 211, wait: 6, onTime: 95, revenue: 21000 },
			timeOff: [],
		},
		lr: {
			since: '2021',
			school: 'DPT, University of Southern California',
			board: 'Licensed physical therapist',
			languages: ['English', 'Italian'],
			hours: 'Mon–Fri 7:30 am–4:00 pm',
			ext: '238',
			month: { seen: 286, wait: 16, onTime: 87, revenue: 28300 },
			timeOff: [],
		},
		sr: {
			since: '2016',
			school: 'MD, Columbia University',
			board: 'Board certified, psychiatry',
			languages: ['English'],
			hours: 'Mon–Fri 9:00 am–6:00 pm',
			ext: '253',
			month: { seen: 248, wait: 14, onTime: 87, revenue: 25700 },
			timeOff: [],
		},
		hm: {
			since: '2019',
			school: 'MD, Northwestern University',
			board: 'Board certified, ear, nose and throat',
			languages: ['English'],
			hours: 'Mon–Wed, Fri 8:00 am–4:00 pm',
			ext: '221',
			month: { seen: 199, wait: 9, onTime: 86, revenue: 13100 },
			timeOff: [],
		},
		co: {
			since: '2022',
			school: 'MD, Emory University',
			board: 'Board certified, dermatology',
			languages: ['English'],
			hours: 'Mon–Wed, Fri 9:00 am–5:00 pm',
			ext: '206',
			month: { seen: 258, wait: 15, onTime: 86, revenue: 28800 },
			timeOff: [],
		},
	};

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.clinicProviders = PROFILES;
})();
