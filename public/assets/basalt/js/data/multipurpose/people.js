/**
 * Who works at Fieldline. This is the single staff list behind Users
 * and each user's page, Team Activity, Messages, Teams, Projects, HR,
 * Employees and each employee's file, Shifts, Time Off, Payroll,
 * Performance and Hiring, so a colleague keeps one name, job, team,
 * home city and monogram wherever they turn up. Links follow two
 * keys: the short sign-in id opens employee-user-details.html?id=, and the
 * FL- staff number opens employee-details.html?id=.
 *
 * window.Basalt.data.people carries the teams, the full roster (people
 * who left included), the current staff, every time-off request, the
 * H2 2026 review cycle, the shift patterns and the leave labels, along
 * with lookups by either id, name and contact helpers, absences(person)
 * for this year's days away and workday(person, day) for a past day on
 * the time clock.
 *
 * To run it on real records, replace the roster, the leave requests
 * and the review cycle below with the same fields. AS_OF is the date
 * the demo treats as today.
 */
(() => {
	'use strict';

	const AS_OF = '2026-10-09';

	/* The chief executive reports to the board; team leads report to
     her, and everyone else reports to the lead of their team. */
	const CEO = 'rc';

	/* John Armstrong answers most leave requests; a decision names its
     approver only when somebody else made it. */
	const LEAVE_DESK = 'ja';

	/* Each team: its lead, the day of its next review session and the
     chart color (1 to 8) that tints its people's avatars on HR pages. */
	const SQUADS = [
		['Engineering', 'as', '2026-10-21', 1],
		['Product', 'hw', '2026-10-22', 2],
		['Support', 'pr', '2026-10-21', 4],
		['Success', 'ev', '2026-10-22', 7],
		['Sales', 'ew', '2026-10-22', 3],
		['Marketing', 'cr', '2026-10-22', 5],
		['Finance', 'rd', '2026-10-06', 6],
		['Operations', 'km', '2026-10-06', 8],
	].map(([id, lead, session, tone]) => ({ id, tone, lead, session }));

	/* Offices, state by state. Every office is in the United States, so
     the calling code is +1 throughout; each city adds its time zone, the
     name people give that zone and the area code a phone number opens
     with. A city where Spanish is common carries its own languages. */
	const PLACES = atlas([
		{
			cc: 'WA',
			country: 'Washington',
			region: 'West',
			code: '+1',
			speaks: ['English'],
			towns: [
				['Tacoma', 'America/Los_Angeles', 'Pacific Time', '253 555'],
				['Yakima', 'America/Los_Angeles', 'Pacific Time', '509 555'],
				['Olympia', 'America/Los_Angeles', 'Pacific Time', '360 555'],
				['Bellingham', 'America/Los_Angeles', 'Pacific Time', '360 555'],
			],
		},
		{
			cc: 'CA',
			country: 'California',
			region: 'West',
			code: '+1',
			speaks: ['English'],
			towns: [
				['Los Angeles', 'America/Los_Angeles', 'Pacific Time', '213 555', ['English', 'Spanish']],
				['Eureka', 'America/Los_Angeles', 'Pacific Time', '707 555'],
			],
		},
		{
			cc: 'MT',
			country: 'Montana',
			region: 'West',
			code: '+1',
			speaks: ['English'],
			towns: [['Missoula', 'America/Denver', 'Mountain Time', '406 555']],
		},
		{
			cc: 'CO',
			country: 'Colorado',
			region: 'West',
			code: '+1',
			speaks: ['English'],
			towns: [['Boulder', 'America/Denver', 'Mountain Time', '303 555']],
		},
		{
			cc: 'AZ',
			country: 'Arizona',
			region: 'West',
			code: '+1',
			speaks: ['English'],
			towns: [['Flagstaff', 'America/Phoenix', 'Mountain Time', '928 555']],
		},
		{
			cc: 'TX',
			country: 'Texas',
			region: 'South',
			code: '+1',
			speaks: ['English'],
			towns: [
				['Waco', 'America/Chicago', 'Central Time', '254 555'],
				['Corpus Christi', 'America/Chicago', 'Central Time', '361 555', ['English', 'Spanish']],
				['Amarillo', 'America/Chicago', 'Central Time', '806 555'],
			],
		},
		{
			cc: 'GA',
			country: 'Georgia',
			region: 'South',
			code: '+1',
			speaks: ['English'],
			towns: [['Atlanta', 'America/New_York', 'Eastern Time', '404 555']],
		},
		{
			cc: 'TN',
			country: 'Tennessee',
			region: 'South',
			code: '+1',
			speaks: ['English'],
			towns: [['Chattanooga', 'America/New_York', 'Eastern Time', '423 555']],
		},
		{
			cc: 'NC',
			country: 'North Carolina',
			region: 'South',
			code: '+1',
			speaks: ['English'],
			towns: [['Durham', 'America/New_York', 'Eastern Time', '919 555']],
		},
		{
			cc: 'FL',
			country: 'Florida',
			region: 'South',
			code: '+1',
			speaks: ['English'],
			towns: [['Sarasota', 'America/New_York', 'Eastern Time', '941 555', ['English', 'Spanish']]],
		},
		{
			cc: 'AR',
			country: 'Arkansas',
			region: 'South',
			code: '+1',
			speaks: ['English'],
			towns: [['Fayetteville', 'America/Chicago', 'Central Time', '479 555']],
		},
		{
			cc: 'KY',
			country: 'Kentucky',
			region: 'South',
			code: '+1',
			speaks: ['English'],
			towns: [['Louisville', 'America/New_York', 'Eastern Time', '502 555']],
		},
		{
			cc: 'MA',
			country: 'Massachusetts',
			region: 'Northeast',
			code: '+1',
			speaks: ['English'],
			towns: [['Boston', 'America/New_York', 'Eastern Time', '617 555']],
		},
		{
			cc: 'NJ',
			country: 'New Jersey',
			region: 'Northeast',
			code: '+1',
			speaks: ['English'],
			towns: [['Newark', 'America/New_York', 'Eastern Time', '973 555']],
		},
		{
			cc: 'CT',
			country: 'Connecticut',
			region: 'Northeast',
			code: '+1',
			speaks: ['English'],
			towns: [['Stamford', 'America/New_York', 'Eastern Time', '203 555']],
		},
		{
			cc: 'NY',
			country: 'New York',
			region: 'Northeast',
			code: '+1',
			speaks: ['English'],
			towns: [['Syracuse', 'America/New_York', 'Eastern Time', '315 555']],
		},
		{
			cc: 'IL',
			country: 'Illinois',
			region: 'Midwest',
			code: '+1',
			speaks: ['English'],
			towns: [
				['Evanston', 'America/Chicago', 'Central Time', '847 555'],
				['Peoria', 'America/Chicago', 'Central Time', '309 555'],
				['Rockford', 'America/Chicago', 'Central Time', '815 555'],
			],
		},
		{
			cc: 'OH',
			country: 'Ohio',
			region: 'Midwest',
			code: '+1',
			speaks: ['English'],
			towns: [
				['Akron', 'America/New_York', 'Eastern Time', '330 555'],
				['Canton', 'America/New_York', 'Eastern Time', '330 555'],
				['Toledo', 'America/New_York', 'Eastern Time', '419 555'],
			],
		},
		{
			cc: 'MN',
			country: 'Minnesota',
			region: 'Midwest',
			code: '+1',
			speaks: ['English'],
			towns: [
				['Duluth', 'America/Chicago', 'Central Time', '218 555'],
				['St. Cloud', 'America/Chicago', 'Central Time', '320 555'],
			],
		},
		{
			cc: 'ND',
			country: 'North Dakota',
			region: 'Midwest',
			code: '+1',
			speaks: ['English'],
			towns: [
				['Bismarck', 'America/Chicago', 'Central Time', '701 555'],
				['Minot', 'America/Chicago', 'Central Time', '701 555'],
			],
		},
		{
			cc: 'WI',
			country: 'Wisconsin',
			region: 'Midwest',
			code: '+1',
			speaks: ['English'],
			towns: [
				['Appleton', 'America/Chicago', 'Central Time', '920 555'],
				['La Crosse', 'America/Chicago', 'Central Time', '608 555'],
			],
		},
		{
			cc: 'IA',
			country: 'Iowa',
			region: 'Midwest',
			code: '+1',
			speaks: ['English'],
			towns: [['Iowa City', 'America/Chicago', 'Central Time', '319 555']],
		},
		{
			cc: 'KS',
			country: 'Kansas',
			region: 'Midwest',
			code: '+1',
			speaks: ['English'],
			towns: [['Topeka', 'America/Chicago', 'Central Time', '785 555']],
		},
	]);

	/* The roster, oldest hire first; staff numbers follow that order
     (#101, #103, ...), so they are worked out rather than typed.
     Fields a row leaves out take their usual value: a full-time
     contract, nothing booked against an allowance yet, and the
     manager the reporting line above gives them.
       name            first and last name, split on the space
       g               'she' or 'he', for sentences about the person
       start / signed  first working day, which is after AS_OF for a
                       new starter, and the day the contract came back
       salary / was    monthly gross in dollars; was keeps the salary
                       before a raise and the last month it was paid
       used            days of each allowance taken or approved so far
       shift / remote  early or late instead of the day shift; remote
                       means working from home every day
       lateRate        how often someone clocks in late
       buddy           the colleague showing a starter around, and
                       taxPending a starter whose tax forms are missing
       lastDay / left  serving notice, or already gone
       staffed         false for a contractor paid outside payroll */
	const ROSTER = [
		/* The founding years, 2018 to 2020: the chief executive and most
       of today's team leads. */
		{
			id: 'rc',
			name: 'Ruth Christensen',
			g: 'she',
			team: 'Operations',
			title: 'Chief executive',
			city: 'Waco',
			start: '2018-06-04',
			salary: 19500,
			used: { annual: 14, sick: 1 },
		},
		{
			id: 'km',
			name: 'Kirk Mathis',
			g: 'he',
			team: 'Operations',
			title: 'Head of operations',
			city: 'Atlanta',
			start: '2019-02-11',
			salary: 14200,
			used: { annual: 16, sick: 2 },
		},
		{
			id: 'as',
			name: 'Alicia Bowen',
			g: 'she',
			team: 'Engineering',
			title: 'Engineering manager',
			city: 'Yakima',
			start: '2019-08-19',
			salary: 13800,
			was: { salary: 12900, until: 3 },
			used: { annual: 17, sick: 2 },
		},
		{
			id: 'rd',
			name: 'Robyn Daniels',
			g: 'she',
			team: 'Finance',
			title: 'Finance controller',
			city: 'Waco',
			start: '2019-10-07',
			salary: 12400,
			used: { annual: 15, sick: 3 },
		},
		{
			id: 'ew',
			name: 'Rowan Walsh',
			g: 'he',
			team: 'Sales',
			title: 'Sales manager',
			city: 'Boulder',
			start: '2020-01-13',
			salary: 12100,
			used: { annual: 13, sick: 2 },
		},
		{
			id: 'pr',
			name: 'Connie Reese',
			g: 'she',
			team: 'Support',
			title: 'Support lead',
			city: 'Boulder',
			start: '2020-04-20',
			salary: 9800,
			used: { annual: 12, sick: 4 },
		},
		{
			id: 'hw',
			name: 'Leslie Whitlock',
			g: 'she',
			team: 'Product',
			title: 'Product manager, Travel Planner',
			city: 'Stamford',
			start: '2020-06-15',
			salary: 11600,
			used: { annual: 15, sick: 1 },
		},
		{
			id: 'ev',
			name: 'Elise Vick',
			g: 'she',
			team: 'Success',
			title: 'Customer success lead',
			city: 'Akron',
			start: '2020-09-28',
			salary: 10400,
			used: { annual: 18, sick: 2 },
		},
		{
			id: 'th',
			name: 'Todd Hatcher',
			g: 'he',
			team: 'Engineering',
			title: 'Senior mobile engineer',
			city: 'Chattanooga',
			start: '2020-10-05',
			salary: 10900,
			used: { annual: 14, sick: 3 },
		},
		{
			id: 'yh',
			name: 'Yvonne Hanson',
			g: 'she',
			team: 'Support',
			title: 'Senior support specialist',
			city: 'Duluth',
			start: '2020-11-02',
			salary: 6900,
			was: { salary: 6400, until: 9 },
			used: { annual: 16, sick: 5 },
		},
		/* Joined in 2021. */
		{
			id: 'ds',
			name: 'Darryl Sanders',
			g: 'he',
			team: 'Engineering',
			title: 'Platform engineer',
			city: 'Toledo',
			start: '2021-01-18',
			salary: 10200,
			used: { annual: 19, sick: 1 },
		},
		{
			id: 'mk',
			name: 'Thomas Morrison',
			g: 'he',
			team: 'Sales',
			title: 'Solutions engineer, West',
			city: 'Olympia',
			start: '2021-02-01',
			salary: 9600,
			used: { annual: 13 },
			remote: true,
		},
		{
			id: 'ja',
			name: 'John Armstrong',
			g: 'he',
			team: 'Operations',
			title: 'IT and systems manager',
			city: 'Evanston',
			start: '2021-03-08',
			salary: 10800,
			used: { annual: 14, sick: 2 },
		},
		{
			id: 'cr',
			name: 'Cameron Reid',
			g: 'he',
			team: 'Marketing',
			title: 'Marketing lead',
			city: 'La Crosse',
			start: '2021-04-12',
			salary: 10600,
			used: { annual: 17, sick: 3 },
		},
		{
			id: 'ka',
			name: 'Jim Atkins',
			g: 'he',
			team: 'Engineering',
			title: 'Site reliability engineer',
			city: 'Bismarck',
			start: '2021-05-24',
			salary: 9900,
			used: { annual: 15, sick: 2 },
			shift: 'early',
		},
		{
			id: 'dr',
			name: 'Randall Rhodes',
			g: 'he',
			team: 'Support',
			title: 'Support specialist',
			city: 'Chattanooga',
			start: '2021-06-14',
			salary: 6200,
			used: { annual: 8, sick: 2 },
		},
		{
			id: 'mb',
			name: 'Quentin Cook',
			g: 'he',
			team: 'Sales',
			title: 'Account executive',
			city: 'Evanston',
			start: '2021-07-26',
			salary: 7700,
			used: { annual: 15, sick: 1 },
		},
		{
			id: 'pd',
			name: 'Patrick Doyle',
			g: 'he',
			team: 'Engineering',
			title: 'Security engineer',
			city: 'Evanston',
			start: '2021-08-16',
			salary: 10300,
			used: { annual: 12 },
		},
		{
			id: 'sl',
			name: 'Sid Leach',
			g: 'he',
			team: 'Support',
			title: 'Support specialist',
			city: 'St. Cloud',
			start: '2021-09-06',
			salary: 6100,
			used: { annual: 18, sick: 4 },
		},
		{
			id: 'ta',
			name: 'Tony Aldridge',
			g: 'he',
			team: 'Success',
			title: 'Customer success manager',
			city: 'Bismarck',
			start: '2021-10-18',
			salary: 7900,
			used: { annual: 14, sick: 2 },
		},
		{
			id: 'og',
			name: 'Oliver Merritt',
			g: 'he',
			team: 'Product',
			title: 'Product manager, mobile app',
			city: 'Bismarck',
			start: '2021-11-29',
			salary: 10700,
			used: { annual: 16, sick: 3 },
		},
		/* Joined in 2022. */
		{
			id: 'ab',
			name: 'Alexis Boone',
			g: 'she',
			team: 'Support',
			title: 'Support specialist',
			city: 'Atlanta',
			start: '2022-01-10',
			salary: 5900,
			used: { annual: 13, sick: 6 },
			shift: 'early',
		},
		{
			id: 'nfe',
			name: 'Sandra Franklin',
			g: 'she',
			team: 'Product',
			title: 'Product designer',
			city: 'Sarasota',
			start: '2022-02-21',
			salary: 8200,
			used: { annual: 17, sick: 2 },
			remote: true,
		},
		{
			id: 'gl',
			name: 'Courtney Lowry',
			g: 'she',
			team: 'Success',
			title: 'Onboarding specialist',
			city: 'Syracuse',
			start: '2022-03-07',
			salary: 6400,
			used: { annual: 12, sick: 3 },
			birthday: '10-15',
		},
		{
			id: 'so',
			name: 'Rory Beasley',
			g: 'he',
			team: 'Engineering',
			title: 'Backend engineer',
			city: 'Duluth',
			start: '2022-04-11',
			salary: 8900,
			used: { annual: 15, sick: 4 },
		},
		{
			id: 'rk',
			name: 'Russ Kidd',
			g: 'he',
			team: 'Support',
			title: 'Support specialist',
			city: 'Yakima',
			start: '2022-05-16',
			salary: 4800,
			used: { annual: 11, study: 1, sick: 3 },
			shift: 'early',
		},
		{
			id: 'hs',
			name: 'Hope Stout',
			g: 'she',
			team: 'Finance',
			title: 'Billing specialist',
			city: 'Missoula',
			start: '2022-06-27',
			salary: 6300,
			used: { annual: 12, study: 2, sick: 1 },
		},
		{
			id: 'am',
			name: 'Ace McGee',
			g: 'he',
			team: 'Success',
			title: 'Implementation consultant',
			city: 'Flagstaff',
			start: '2022-07-04',
			salary: 7600,
			used: { annual: 15, sick: 2 },
			left: '2026-08-31',
		},
		{
			id: 'ih',
			name: 'Cheryl Henderson',
			g: 'she',
			team: 'Operations',
			title: 'People and workplace coordinator',
			city: 'Topeka',
			start: '2022-08-22',
			salary: 6600,
			used: { annual: 18, sick: 2 },
		},
		{
			id: 'fr',
			name: 'Floyd Rankin',
			g: 'he',
			team: 'Engineering',
			title: 'QA engineer',
			city: 'Amarillo',
			start: '2022-09-12',
			salary: 7400,
			was: { salary: 6900, until: 6 },
			used: { annual: 13, sick: 3 },
		},
		{
			id: 'lf',
			name: 'Luna Ferguson',
			g: 'she',
			team: 'Sales',
			title: 'Account executive',
			city: 'Rockford',
			start: '2022-10-03',
			salary: 7600,
			used: { annual: 19, sick: 2 },
		},
		{
			id: 'nf',
			name: 'Silas Fischer',
			g: 'he',
			team: 'Success',
			title: 'Implementation consultant',
			city: 'Iowa City',
			start: '2022-11-14',
			salary: 7800,
			used: { annual: 16, sick: 1 },
		},
		{
			id: 'im',
			name: 'Beverly Maxwell',
			g: 'she',
			team: 'Engineering',
			title: 'Data engineer',
			city: 'Akron',
			start: '2022-12-05',
			salary: 8800,
			used: { annual: 17, sick: 2 },
			remote: true,
		},
		/* Joined in 2023. */
		{
			id: 'ms',
			name: 'Ike Parsons',
			g: 'he',
			team: 'Support',
			title: 'Support specialist',
			city: 'Sarasota',
			start: '2023-01-09',
			salary: 5200,
			used: { annual: 10, sick: 5 },
			shift: 'late',
			lateRate: 0.12,
		},
		{
			id: 'cdu',
			name: 'Patricia Larson',
			g: 'she',
			team: 'Finance',
			title: 'Payables specialist',
			city: 'Appleton',
			start: '2023-01-23',
			salary: 5800,
			used: { annual: 12, sick: 1 },
			left: '2026-07-31',
		},
		{
			id: 'yt',
			name: 'Ashley Steele',
			g: 'she',
			team: 'Engineering',
			title: 'Frontend engineer',
			city: 'Missoula',
			start: '2023-02-27',
			salary: 8300,
			used: { annual: 13, sick: 3 },
			lateRate: 0.14,
		},
		{
			id: 'cm',
			name: 'Casey Martin',
			g: 'she',
			team: 'Support',
			title: 'Support specialist',
			city: 'Peoria',
			start: '2023-03-13',
			salary: 5800,
			used: { annual: 15, sick: 4 },
			shift: 'late',
		},
		{
			id: 'za',
			name: 'Laurie Sloan',
			g: 'she',
			team: 'Sales',
			title: 'Account executive',
			city: 'Minot',
			start: '2023-04-17',
			salary: 7300,
			used: { annual: 14, sick: 2 },
		},
		{
			id: 'cd',
			name: 'Carrie Dillon',
			g: 'she',
			team: 'Success',
			title: 'Onboarding specialist',
			city: 'Fayetteville',
			start: '2023-05-22',
			salary: 5600,
			used: { annual: 11, sick: 3 },
			remote: true,
		},
		{
			id: 'lg',
			name: 'Leah Goldberg',
			g: 'she',
			team: 'Product',
			title: 'Product manager, Customer Portal',
			city: 'Newark',
			start: '2023-07-10',
			salary: 10100,
			used: { annual: 11, sick: 2 },
		},
		{
			id: 'jt',
			name: 'Jessica Toll',
			g: 'she',
			team: 'Support',
			title: 'Support specialist',
			city: 'Olympia',
			start: '2023-08-21',
			salary: 4600,
			type: 'Part-time',
			used: { annual: 9, sick: 2 },
			remote: true,
		},
		{
			id: 'sr',
			name: 'Barbara Hahn',
			g: 'she',
			team: 'Marketing',
			title: 'Content marketer',
			city: 'Canton',
			start: '2023-09-18',
			salary: 6100,
			used: { annual: 18, sick: 3 },
		},
		{
			id: 'lm',
			name: 'Forrest Murphy',
			g: 'he',
			team: 'Engineering',
			title: 'Backend engineer',
			city: 'Waco',
			start: '2023-10-02',
			salary: 8400,
			used: { annual: 11, sick: 1 },
			remote: true,
		},
		/* Joined in 2024 and 2025, a contractor among them. */
		{
			id: 'lo',
			name: 'Lance Bishop',
			g: 'he',
			team: 'Operations',
			title: 'Operations analyst',
			city: 'Durham',
			start: '2024-01-15',
			salary: 5900,
			used: { annual: 12, sick: 3 },
		},
		{
			id: 'hb',
			name: 'Leslie Ashby',
			g: 'she',
			team: 'Success',
			title: 'Customer success manager',
			city: 'Boston',
			start: '2024-02-05',
			salary: 7200,
			used: { annual: 13, sick: 2 },
		},
		{
			id: 'rf',
			name: 'Jeffrey McKay',
			g: 'he',
			team: 'Sales',
			title: 'Account executive',
			city: 'Sarasota',
			start: '2024-03-11',
			salary: 6800,
			used: { annual: 12, sick: 4 },
		},
		{
			id: 'jp',
			name: 'Joy Roe',
			g: 'he',
			team: 'Engineering',
			title: 'Mobile engineer',
			city: 'Eureka',
			start: '2024-04-08',
			salary: 7900,
			used: { annual: 10, sick: 2 },
		},
		{
			id: 'ao',
			name: 'Allie Ott',
			g: 'she',
			team: 'Product',
			title: 'UX researcher',
			city: 'Stamford',
			start: '2024-05-13',
			salary: 7000,
			type: 'Fixed-term',
			used: { annual: 12, sick: 1 },
		},
		{
			id: 'nd',
			name: 'Nan Donovan',
			g: 'she',
			team: 'Support',
			title: 'Support specialist',
			city: 'Bismarck',
			start: '2024-06-03',
			salary: 5500,
			used: { annual: 14, sick: 3 },
			shift: 'late',
		},
		{
			id: 'dk',
			name: 'Marshall Beck',
			g: 'he',
			team: 'Marketing',
			title: 'Growth marketer',
			city: 'Los Angeles',
			start: '2024-07-22',
			salary: 6700,
			used: { annual: 9, sick: 2 },
		},
		{
			id: 'op',
			name: 'Gerald Pritchard',
			g: 'he',
			team: 'Sales',
			title: 'Sales development rep',
			city: 'Boston',
			start: '2024-09-09',
			salary: 4900,
			used: { annual: 21, sick: 6 },
			lateRate: 0.16,
			lastDay: '2026-10-23',
		},
		{
			id: 'tn',
			name: 'Tyler Hogan',
			g: 'he',
			team: 'Sales',
			title: 'Sales development rep',
			city: 'Tacoma',
			start: '2025-02-03',
			salary: 4700,
			used: { annual: 11, sick: 3 },
			left: '2026-09-11',
		},
		{
			id: 'pm',
			name: 'Paula Malone',
			g: 'she',
			team: 'Marketing',
			title: 'Events manager',
			city: 'Corpus Christi',
			start: '2025-03-10',
			salary: 4200,
			type: 'Part-time',
			used: { annual: 8, sick: 1 },
			remote: true,
		},
		{
			id: 'mo',
			name: 'Gregory Devin',
			g: 'he',
			team: 'Finance',
			title: 'Accountant',
			city: 'Stamford',
			start: '2025-08-04',
			salary: 4400,
			type: 'Part-time',
			used: { annual: 10, sick: 2 },
		},
		{
			id: 'np',
			name: 'Nina Bledsoe',
			g: 'she',
			team: 'Engineering',
			title: 'Contract engineer',
			city: 'Louisville',
			start: '2025-11-03',
			salary: 0,
			type: 'Contract',
			staffed: false,
		},
		/* This year's arrivals; four of them have not had a first day yet. */
		{
			id: 'bc',
			name: 'Ben Pearce',
			g: 'he',
			team: 'Support',
			title: 'Support specialist',
			city: 'Stamford',
			start: '2026-09-14',
			salary: 5000,
			shift: 'early',
		},
		{
			id: 'wa',
			name: 'Wren Abbott',
			g: 'she',
			team: 'Operations',
			title: 'Operations analyst',
			city: 'Evanston',
			start: '2026-10-12',
			signed: '2026-09-21',
			salary: 5800,
			buddy: 'lo',
		},
		{
			id: 'ak',
			name: 'Sloan Kirby',
			g: 'he',
			team: 'Engineering',
			title: 'Platform engineer',
			city: 'Bellingham',
			start: '2026-10-12',
			signed: '2026-09-14',
			salary: 8900,
			remote: true,
			buddy: 'ds',
		},
		{
			id: 'si',
			name: 'Tamara Ives',
			g: 'she',
			team: 'Support',
			title: 'Support specialist',
			city: 'Missoula',
			start: '2026-10-19',
			signed: '2026-09-25',
			salary: 5200,
		},
		{
			id: 'jw',
			name: 'Jacob Krause',
			g: 'he',
			team: 'Product',
			title: 'Product designer',
			city: 'Toledo',
			start: '2026-11-02',
			signed: '2026-10-01',
			salary: 7600,
			taxPending: true,
		},
	].map(enrol);

	/* Everyone still on the payroll or about to join it. */
	const CURRENT = ROSTER.filter((person) => person.staffed !== false && !person.left);

	/* Leave requests, grouped by where they stand: still waiting for an
     answer, approved, then declined. Approved days are already part of
     each person's `used` count. */
	const LEAVE_REQUESTS = [
		...filed('waiting', [
			{
				id: '#451',
				who: 'lg',
				cover: 'og',
				type: 'annual',
				sent: '2026-10-07',
				from: '2026-10-12',
				to: '2026-10-16',
				reason: 'A family wedding in Akron. Oliver runs the Customer Portal stand-ups that week.',
			},
			{
				id: '#452',
				who: 'lm',
				cover: 'so',
				type: 'annual',
				sent: '2026-10-08',
				from: '2026-12-21',
				to: '2027-01-01',
				reason: 'Visiting family in Dayton over the holidays. I will hand the billing service on-call to Rory before I go.',
			},
		]),
		...filed('approved', [
			{
				id: '#396',
				who: 'dr',
				cover: 'ms',
				type: 'parental',
				sent: '2026-06-15',
				from: '2026-08-31',
				to: '2026-12-04',
				decided: { on: '2026-06-16', by: 'pr' },
				reason: 'Parental leave for our first child.',
			},
			{
				id: '#402',
				who: 'za',
				cover: 'lf',
				type: 'unpaid',
				sent: '2026-07-06',
				from: '2026-07-27',
				to: '2026-07-31',
				decided: { on: '2026-07-07' },
				reason: 'Helping my parents move house in Lahore.',
			},
			{
				id: '#408',
				who: 'cd',
				cover: 'gl',
				type: 'bereavement',
				sent: '2026-08-10',
				from: '2026-08-10',
				to: '2026-08-12',
				decided: { on: '2026-08-10' },
				reason: 'My grandmother’s funeral in Abilene.',
			},
			{
				id: '#414',
				who: 'sl',
				cover: 'cm',
				type: 'annual',
				sent: '2026-08-24',
				from: '2026-09-14',
				to: '2026-09-18',
				decided: { on: '2026-08-25' },
				reason: 'A week walking in Lapland.',
			},
			{
				id: '#420',
				who: 'im',
				cover: 'ds',
				type: 'annual',
				sent: '2026-08-31',
				from: '2026-09-21',
				to: '2026-09-25',
				decided: { on: '2026-09-01' },
				reason: 'Sailing in the Azores, booked in the spring.',
			},
			{
				id: '#431',
				who: 'sr',
				cover: 'dk',
				type: 'annual',
				sent: '2026-09-10',
				from: '2026-10-05',
				to: '2026-10-09',
				decided: { on: '2026-09-11' },
				reason: 'Family visit in Naples.',
			},
			{
				id: '#439',
				who: 'og',
				cover: 'hw',
				type: 'annual',
				sent: '2026-09-18',
				from: '2026-10-19',
				to: '2026-10-23',
				decided: { on: '2026-09-21' },
				reason: 'Autumn break with the kids.',
			},
			{
				id: '#440',
				who: 'rf',
				cover: 'lf',
				type: 'annual',
				sent: '2026-09-22',
				from: '2026-10-13',
				to: '2026-10-14',
				decided: { on: '2026-09-23' },
				reason: 'My brother’s wedding in Roanoke.',
			},
			{
				id: '#442',
				who: 'hs',
				cover: 'rd',
				type: 'study',
				sent: '2026-09-30',
				from: '2026-10-22',
				to: '2026-10-23',
				decided: { on: '2026-10-01' },
				reason: 'Accounting exam, part two.',
			},
			{
				id: '#446',
				who: 'ka',
				cover: 'ds',
				type: 'sick',
				sent: '2026-10-08',
				from: '2026-10-08',
				to: '2026-10-09',
				decided: { on: '2026-10-08' },
				reason: 'Flu. Pager handed to Darryl.',
			},
			{
				id: '#447',
				who: 'ta',
				cover: 'hb',
				type: 'annual',
				sent: '2026-09-25',
				from: '2026-10-09',
				to: '2026-10-09',
				decided: { on: '2026-09-28' },
				reason: 'Moving house.',
			},
			{
				id: '#448',
				who: 'nd',
				cover: 'ab',
				type: 'bereavement',
				sent: '2026-10-08',
				from: '2026-10-12',
				to: '2026-10-14',
				decided: { on: '2026-10-08' },
				reason: 'Family funeral in Bozeman.',
			},
			{
				id: '#449',
				who: 'so',
				cover: 'ds',
				type: 'annual',
				sent: '2026-10-01',
				from: '2026-12-28',
				to: '2026-12-31',
				decided: { on: '2026-10-02' },
				reason: 'New Year with family in Duluth.',
			},
		]),
		...filed('declined', [
			{
				id: '#437',
				who: 'jp',
				cover: 'th',
				type: 'annual',
				sent: '2026-09-24',
				from: '2026-10-12',
				to: '2026-10-16',
				decided: {
					on: '2026-09-25',
					note: 'Version 6.5 of the staff app ships on Oct 14. Could you take the week after?',
				},
				reason: 'A week in Jeju with friends.',
			},
			{
				id: '#443',
				who: 'dk',
				cover: 'sr',
				type: 'annual',
				sent: '2026-09-28',
				from: '2026-10-12',
				to: '2026-10-16',
				decided: {
					on: '2026-09-29',
					note: 'Barbara is only back on Oct 12 and the new pricing page goes live on Oct 22. Could you pick November?',
				},
				reason: 'Half-term week, no childcare.',
			},
		]),
	];

	/* The H2 2026 review cycle, team by team. Everyone who started before
     July 1 is in it except the chief executive (the board reviews her),
     Randall Rhodes (on parental leave) and Gerald Pritchard (serving
     notice). Managers write the reviews and Ruth Christensen reviews
     the team leads; numbers #2601 onward follow this order.
       stage    self, peer, manager, calibration or signed
       peers    feedback asked for and feedback received
       due      set only when one person's deadline moved
       goals    [goal, percent done]
       said     the peers' strength and thing to work on
       rating, scores and promote arrive with the manager's review;
       scores run Execution, Expertise, Collaboration, Customer focus,
       Leadership. */
	const CYCLE = Object.values({
		Engineering: [
			{
				who: 'as',
				stage: 'calibration',
				peers: [4, 4],
				goals: [
					['Hire two platform engineers', 50],
					['Schedule API p95 under 300 ms', 80],
				],
				rating: 4.5,
				scores: [4.6, 4.4, 4.5, 4.3, 4.7],
				promote: false,
				said: [
					'Grew the team to eleven without slowing releases.',
					'Delegates the work but still keeps every decision.',
				],
			},
			{
				who: 'th',
				stage: 'calibration',
				peers: [3, 3],
				goals: [
					['Offline visit notes for on-site staff', 100],
					['App start under 1.2 seconds', 85],
				],
				rating: 4.4,
				scores: [4.5, 4.6, 4.3, 4.4, 4.2],
				promote: true,
				said: ['Runs the calmest incident calls in the company.', 'Says yes to too many roadmap requests.'],
			},
			{
				who: 'ds',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Move builds off the shared runners', 100],
					['Database copies for the EU region', 90],
				],
				said: [
					'Leaves every system easier for the next person.',
					'Writes decisions up at quarter end, not as they happen.',
				],
			},
			{
				who: 'ka',
				stage: 'self',
				due: '2026-10-16',
				peers: [3, 0],
				note: 'Out sick on Oct 8 and 9, so his self-review moved to Oct 16.',
				goals: [
					['Halve the out-of-hours pages', 52],
					['Uptime checks for the EU region', 70],
				],
			},
			{
				who: 'pd',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Security review of the Kalamazoo setup', 100],
					['Quarterly access review', 60],
				],
				said: [
					'Explains a risk in one sentence a customer understands.',
					'Reviews arrive in a batch at the end of the week.',
				],
			},
			{
				who: 'so',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Own the billing service end to end', 70],
					['Reply hooks for two-way SMS', 40],
				],
				said: [
					'Writes the clearest pull requests on the team.',
					'Takes the hard ticket instead of pairing on it.',
				],
			},
			{
				who: 'fr',
				stage: 'peer',
				peers: [3, 1],
				goals: [
					['Regression suite under ten minutes', 100],
					['Test plan for the Travel Planner beta', 65],
				],
			},
			{
				who: 'im',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Warehouse move with no reporting gap', 100],
					['Freshness targets for the top 20 tables', 60],
				],
				said: [
					'Treats data contracts like a product with owners.',
					'Plans migrations about a third too short.',
				],
			},
			{
				who: 'yt',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Invoices in the Customer Portal', 90],
					['Accessibility fixes across the portal', 80],
				],
				said: ['Ships small, tidy changes every day.', 'Waits too long to ask for design help.'],
			},
			{
				who: 'lm',
				stage: 'calibration',
				peers: [3, 3],
				goals: [
					['Traffic-aware travel times', 100],
					['Day map fast on old phones', 60],
				],
				rating: 4.1,
				scores: [4.2, 4.3, 3.9, 4.0, 3.8],
				promote: false,
				said: [
					'Fastest debugger here, and writes clear incident notes.',
					'Short review comments can read as cold.',
				],
			},
			{
				who: 'jp',
				stage: 'peer',
				peers: [3, 2],
				goals: [
					['Version 6.4 of the staff app', 100],
					['Crash-free sessions above 99.8%', 75],
				],
			},
		],
		Product: [
			{
				who: 'hw',
				stage: 'calibration',
				peers: [4, 4],
				goals: [
					['Travel Planner pilot with our schedulers', 100],
					['Beta for 20 accounts', 70],
				],
				rating: 4.6,
				scores: [4.7, 4.6, 4.5, 4.6, 4.5],
				promote: true,
				said: ['Turns a vague brief into three options and a pick.', 'Shares work late, close to sign-off.'],
			},
			{
				who: 'og',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Two-way SMS spec signed off', 40],
					['Staff app rating above 4.6', 100],
				],
				said: [
					'Brings back customer quotes, not opinions.',
					'Roadmap decks run long; the one-pager is better.',
				],
			},
			{
				who: 'nfe',
				stage: 'calibration',
				peers: [3, 3],
				goals: [
					['New day map designs', 100],
					['Pay online screens', 80],
				],
				rating: 4.3,
				scores: [4.4, 4.5, 4.2, 4.4, 3.9],
				promote: false,
				said: [
					'“Where is it?” tickets fell by a third after her redesign.',
					'Takes on too many small requests.',
				],
			},
			{
				who: 'lg',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Customer Portal redesign on time', 45],
					['Interviews with 8 customers', 100],
				],
				said: [
					'Keeps the team calm when a dependency slips.',
					'Raised the payment API delay later than she could have.',
				],
			},
			{
				who: 'ao',
				stage: 'self',
				peers: [3, 0],
				goals: [
					['Five scheduler interviews a month', 92],
					['Standing panel of 40 customers', 66],
				],
			},
		],
		Support: [
			{
				who: 'pr',
				stage: 'calibration',
				peers: [4, 4],
				goals: [
					['First reply under one hour', 100],
					['Help center rewrite', 100],
				],
				rating: 4.5,
				scores: [4.6, 4.3, 4.7, 4.8, 4.4],
				promote: false,
				said: ['Customers ask for her by name.', 'Holds too many escalations herself.'],
			},
			{
				who: 'yh',
				stage: 'calibration',
				peers: [3, 3],
				goals: [
					['Escalation playbook for Max accounts', 100],
					['Coach two new specialists', 80],
				],
				rating: 4.4,
				scores: [4.5, 4.6, 4.2, 4.6, 4.0],
				promote: false,
				said: ['The calmest voice on an angry call.', 'Ticket notes could be shorter.'],
			},
			{
				who: 'ab',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Happy score above 95%', 100],
					['Travel Planner support training', 60],
				],
				said: [
					'Logs the call before the customer has hung up.',
					'Could share what she learns in the team channel.',
				],
			},
			{
				who: 'sl',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Nordic customers answered in their language', 100],
					['On-call handbook update', 50],
				],
				said: ['Never lets a ticket go quiet.', 'Picks the easy tickets first.'],
			},
			{
				who: 'cm',
				stage: 'peer',
				peers: [3, 1],
				goals: [
					['Spanish help articles', 70],
					['Second-line training', 40],
				],
			},
			{
				who: 'nd',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Late-shift queue under 20 tickets', 85],
					['Replies for arrival-window texts', 100],
				],
				said: ['Turns repeat questions into help articles.', 'Hands over the late shift in a rush.'],
			},
			{
				who: 'rk',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Pacific time first reply under 30 minutes', 90],
					['Billing questions without escalation', 70],
				],
				said: ['Knows the billing rules better than Finance.', 'Rarely speaks up in team calls.'],
			},
			{
				who: 'jt',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Onboarding calls for new West Coast accounts', 75],
					['Help search success above 70%', 85],
				],
				said: [
					'Customers out West rate her calls the highest.',
					'Part-time hours mean handovers need more notes.',
				],
			},
			{
				who: 'ms',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Spanish-language queue under four hours', 80],
					['Take over Randall’s escalations', 100],
				],
				said: ['Took on Randall’s tickets without a single complaint.', 'Says yes to every shift swap.'],
			},
		],
		Success: [
			{
				who: 'ev',
				stage: 'calibration',
				peers: [4, 4],
				goals: [
					['Every rollout live inside 30 days', 80],
					['Onboarding playbook', 55],
				],
				rating: 4.4,
				scores: [4.5, 4.3, 4.6, 4.7, 4.0],
				promote: false,
				said: ['Customers trust her plan on the first call.', 'Books too many kick-off calls herself.'],
			},
			{
				who: 'gl',
				stage: 'calibration',
				peers: [3, 3],
				goals: [
					['Self-serve setup checklist', 90],
					['Scheduler quick-start guide', 100],
				],
				rating: 4.5,
				scores: [4.6, 4.4, 4.7, 4.6, 4.2],
				promote: true,
				said: ['Gets a new account live in record time.', 'Could hand more training to the help center.'],
			},
			{
				who: 'ta',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Renewals for 40 accounts', 85],
					['Avocet Robotics to Max', 60],
				],
				said: ['Knows every customer’s busy season.', 'Updates the account notes a week late.'],
			},
			{
				who: 'cd',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Spanish onboarding for Texas accounts', 70],
					['Training videos for schedulers', 30],
				],
				said: [
					'Patient with schedulers who are new to software.',
					'Needs to say no to custom training requests.',
				],
			},
			{
				who: 'nf',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Sunvale Studios rollout', 80],
					['Data import checks for new accounts', 100],
				],
				said: [
					'Imports that used to take a week now take a day.',
					'Leaves customer emails to the end of the day.',
				],
			},
			{
				who: 'hb',
				stage: 'peer',
				peers: [3, 2],
				goals: [
					['Health score for every account', 60],
					['Win back three paused accounts', 33],
				],
			},
		],
		Sales: [
			{
				who: 'ew',
				stage: 'manager',
				peers: [4, 4],
				goals: [
					['Q3 new business target', 100],
					['Hire an Enterprise account executive', 40],
				],
				said: ['Forecasts within 5% every quarter.', 'Runs the weekly pipeline call long.'],
			},
			{
				who: 'mb',
				stage: 'calibration',
				peers: [3, 3],
				goals: [
					['128% of the Q3 target', 100],
					['Travel Planner for Volt Film & Photo', 100],
				],
				rating: 4.6,
				scores: [4.8, 4.4, 4.5, 4.7, 4.2],
				promote: true,
				said: [
					'Closed the biggest deal of the year without a discount.',
					'Leaves the account notes until Friday.',
				],
			},
			{
				who: 'lf',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Three reseller partners in the Midwest', 67],
					['Spanish demo script', 100],
				],
				said: ['Wins the room in two languages.', 'Takes on too many small accounts.'],
			},
			{
				who: 'za',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Northeast pipeline of $400,000', 75],
					['Ten customer references', 60],
				],
				said: ['Follows up faster than anyone on the team.', 'Discounts too early in a negotiation.'],
			},
			{
				who: 'rf',
				stage: 'self',
				peers: [3, 0],
				goals: [
					['Florida pipeline of $250,000', 55],
					['Spanish pricing page', 100],
				],
			},
			{
				who: 'mk',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Security review pack for large buyers', 90],
					['Two reps running their own demos', 50],
				],
				said: [
					'Wins the technical room without upstaging the rep.',
					'Says yes to every call; his diary is the bottleneck.',
				],
			},
		],
		Marketing: [
			{
				who: 'cr',
				stage: 'manager',
				peers: [4, 4],
				goals: [
					['Website refresh', 40],
					['Trial-to-paid from 16% to 18%', 100],
				],
				said: ['Stops a channel that isn’t working, and fast.', 'Reports lead with clicks instead of signups.'],
			},
			{
				who: 'sr',
				stage: 'self',
				due: '2026-10-16',
				peers: [3, 0],
				note: 'On vacation from Oct 5 to 9, so her self-review moved to Oct 16.',
				goals: [
					['Twelve customer stories this year', 75],
					['Rewrite the top 30 help articles', 40],
				],
			},
			{
				who: 'dk',
				stage: 'manager',
				peers: [3, 3],
				goals: [
					['Paid signup cost under $180', 47],
					['Booking page campaign', 60],
				],
				said: ['Tests one thing at a time and writes it down.', 'Could share results beyond Marketing.'],
			},
			{
				who: 'pm',
				stage: 'peer',
				peers: [2, 1],
				goals: [
					['Four conferences this year', 75],
					['Customer day in Sarasota', 100],
				],
			},
		],
		Finance: [
			{
				who: 'rd',
				stage: 'signed',
				signed: '2026-10-06',
				peers: [3, 3],
				goals: [
					['Close the books in five working days', 80],
					['Annual plan pricing live', 100],
				],
				rating: 4.3,
				scores: [4.4, 4.5, 4.0, 4.1, 4.3],
				promote: false,
				said: [
					'The month-end close hasn’t slipped in two years.',
					'Still does by hand what a nightly job could do.',
				],
			},
			{
				who: 'hs',
				stage: 'signed',
				signed: '2026-10-06',
				peers: [3, 3],
				goals: [
					['Overdue invoices under 4%', 100],
					['Invoices for state agency accounts', 85],
				],
				rating: 4.2,
				scores: [4.3, 4.2, 4.1, 4.4, 3.8],
				promote: false,
				said: ['Chases an overdue invoice without losing the customer.', 'Could automate the reminder emails.'],
			},
			{
				who: 'mo',
				stage: 'signed',
				signed: '2026-10-06',
				peers: [3, 3],
				goals: [
					['September close by day five', 100],
					['Automate the revenue schedule', 35],
				],
				rating: 3.9,
				scores: [4.0, 4.1, 3.7, 3.6, 3.5],
				promote: false,
				said: ['Careful, and his numbers never need a second look.', 'Asks for help late when he is stuck.'],
			},
		],
		Operations: [
			{
				who: 'km',
				stage: 'signed',
				signed: '2026-10-06',
				peers: [4, 4],
				goals: [
					['Working hours set for every branch', 100],
					['Software spend down 10%', 75],
				],
				rating: 4.5,
				scores: [4.6, 4.4, 4.5, 4.5, 4.6],
				promote: false,
				said: ['Makes every team’s life a little easier.', 'Takes on more than one person should.'],
			},
			{
				who: 'ja',
				stage: 'signed',
				signed: '2026-10-06',
				peers: [3, 3],
				goals: [
					['Single sign-on for everyone', 100],
					['A laptop for every starter on day one', 90],
				],
				rating: 4.4,
				scores: [4.5, 4.6, 4.3, 4.2, 4.1],
				promote: false,
				said: ['Fixes the problem before most people notice it.', 'Writes the fix up later than he should.'],
			},
			{
				who: 'ih',
				stage: 'signed',
				signed: '2026-10-06',
				peers: [3, 3],
				goals: [
					['New starter checklist', 100],
					['Topeka office move', 60],
				],
				rating: 4.0,
				scores: [4.1, 3.9, 4.3, 4.0, 3.7],
				promote: false,
				said: ['New starters say their first day was easy.', 'Could say no to more one-off requests.'],
			},
			{
				who: 'lo',
				stage: 'signed',
				signed: '2026-10-06',
				peers: [3, 3],
				goals: [
					['Seat usage report every Monday', 100],
					['Support costs by region', 50],
				],
				rating: 3.8,
				scores: [3.9, 4.0, 3.8, 3.6, 3.5],
				promote: false,
				said: [
					'His Monday report is the first thing people open.',
					'Could present what he finds, not just send it.',
				],
			},
		],
	})
		.flat()
		.map((review, index) => ({ id: `#${2601 + index}`, ...review }));

	/* What each kind of leave is called on screen. */
	const LEAVE_NAMES = {
		annual: 'Vacation',
		sick: 'Out sick',
		study: 'Study leave',
		parental: 'Parental leave',
		unpaid: 'Unpaid leave',
		bereavement: 'Bereavement leave',
	};

	/* The three shift patterns, in minutes after midnight. */
	const PATTERNS = {
		early: { label: '7 am – 3 pm', start: 7 * 60, end: 15 * 60 },
		day: { label: '9 am – 5 pm', start: 9 * 60, end: 17 * 60 },
		late: { label: '1 pm – 9 pm', start: 13 * 60, end: 21 * 60 },
	};

	/* Company-wide closures; they never count against anyone's leave. */
	const HOLIDAYS = ['2026-12-25', '2027-01-01'];

	/* Mondays from early January to late September: the weeks earlier
     vacations are spread across. */
	const MONDAYS = weeksBetween('2026-01-05', '2026-09-28');

	/* First names and relationships for emergency contacts, plus the
     surnames a friend (rather than family) may have. */
	const KIN_FIRST = [
		'Jamie',
		'Rory',
		'Maria',
		'Marshall',
		'Dawn',
		'Isaac',
		'Rui',
		'Ann',
		'Chris',
		'Mina',
		'Jon',
		'Eva',
		'Tom',
		'Jodi',
	];
	const KIN_TIES = ['Partner', 'Partner', 'Parent', 'Sibling', 'Partner', 'Friend'];
	const FRIEND_SURNAMES = ['Kerr', 'Roach', 'Nugent', 'Lancaster', 'McCall', 'Haas'];

	/* Courtney Lowry is the one person with a birthday this month, so her
     date is fixed and HR shows it; the rest are drawn from the other
     eleven months. */
	const BIRTH_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12];

	const PEOPLE_BY_ID = new Map(ROSTER.map((person) => [person.id, person]));
	const PEOPLE_BY_STAFF = new Map(ROSTER.map((person) => [person.staff, person]));
	const DAYS_AWAY = new Map();

	publish();

	/** Puts the roster and its helpers on window.Basalt.data.people. */
	function publish() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.people = {
			TODAY: AS_OF,
			teams: SQUADS,
			cities: PLACES,
			people: ROSTER,
			staff: CURRENT,
			timeOff: LEAVE_REQUESTS,
			reviews: CYCLE,
			shifts: PATTERNS,
			labels: LEAVE_NAMES,
			recordWithId: personById,
			byStaff: personByStaff,
			find: lookUp,
			teamOf: squadNamed,
			nameOf: displayName,
			initials: monogram,
			emailOf: workEmail,
			cityOf: placeOf,
			toneOf: avatarTone,
			userPage: accountLink,
			staffPage: recordLink,
			contactOf: contactCard,
			hasStarted: hasJoined,
			absences: daysAway,
			awayOn: absenceOn,
			workday: clockDay,
			workdays: countWorkdays,
			shiftOf: patternOf,
			reviewOf: reviewFor,
			hash: fnv,
		};
	}

	/* Building the tables above. */

	/** Turns the country list into one record per city, keyed by city. */
	function atlas(countries) {
		const byCity = {};
		for (const { cc, country, region, code, speaks, towns } of countries) {
			for (const [city, tz, zone, local, ownSpeech] of towns) {
				byCity[city] = {
					country,
					cc,
					region,
					tz,
					zone,
					dial: `${code} ${local}`,
					langs: [...(ownSpeech || speaks)],
				};
			}
		}
		return byCity;
	}

	/**
	 * Fills in what a roster row leaves out.
	 * @param {object} row   one entry of ROSTER as written above
	 * @param {number} index its place on the roster
	 */
	function enrol(row, index) {
		const { name, ...given } = row;
		const [first, last] = name.split(' ');
		return {
			staff: `#${101 + index * 2}`,
			first,
			last,
			type: 'Full-time',
			used: {},
			mgr: reportsTo(row),
			...given,
		};
	}

	/** The manager of a roster row, from the reporting line. */
	function reportsTo({ id, team }) {
		if (id === CEO) return '';
		const lead = SQUADS.find((squad) => squad.id === team).lead;
		return lead === id ? CEO : lead;
	}

	/** Stamps a group of requests with their status and approver. */
	function filed(status, requests) {
		return requests.map(({ decided, ...request }) =>
			decided ? { ...request, status, decided: { by: LEAVE_DESK, ...decided } } : { ...request, status },
		);
	}

	/** Every Monday from the first to the last, both included. */
	function weeksBetween(first, last) {
		const mondays = [];
		for (let day = first; day <= last; day = shiftDate(day, 7)) mondays.push(day);
		return mondays;
	}

	/* Finding people and naming them. */

	function personById(id) {
		return PEOPLE_BY_ID.get(id) || null;
	}

	function personByStaff(number) {
		return PEOPLE_BY_STAFF.get(number) || null;
	}

	/** A person from a sign-in id or a staff number, whichever it is. */
	function lookUp(key) {
		return personById(key) || personByStaff(key);
	}

	function squadNamed(name) {
		return SQUADS.find((squad) => squad.id === name) || null;
	}

	function displayName(person) {
		return `${person.first} ${person.last}`;
	}

	function monogram(person) {
		return `${person.first.charAt(0)}${person.last.charAt(0)}`.toUpperCase();
	}

	/** first.last@fieldline.app, accents dropped and other marks removed. */
	function workEmail(person) {
		const local = `${plainLetters(person.first)}.${plainLetters(person.last)}`;
		return `${local.replace(/[^a-z.]/g, '')}@fieldline.app`;
	}

	function plainLetters(text) {
		return String(text)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	function placeOf(person) {
		return PLACES[person.city];
	}

	/** The avatar color (1 to 8) the Users pages give someone, from their id. */
	function avatarTone(person) {
		const sum32 = [...person.id].reduce((sum, letter) => (sum * 31 + letter.charCodeAt(0)) >>> 0, 0);
		return (sum32 % 8) + 1;
	}

	function accountLink(person) {
		return `employee-user-details.html?id=${encodeURIComponent(person.id)}`;
	}

	function recordLink(person) {
		return `employee-details.html?id=${encodeURIComponent(person.staff)}`;
	}

	function hasJoined(person) {
		return person.start <= AS_OF;
	}

	function reviewFor(person) {
		return CYCLE.find((review) => review.who === person.id) || null;
	}

	/* Contact details, made up from the city and the staff number. */

	/**
	 * Phone, languages, birthday and emergency contact for one person.
	 * Everything is derived from their ids, so it never changes.
	 */
	function contactCard(person) {
		const place = placeOf(person);
		const tie = drawFrom(KIN_TIES, `${person.id}rel`);
		const surname = tie === 'Friend' ? drawFrom(FRIEND_SURNAMES, `${person.id}fl`) : person.last;
		return {
			phone: phoneFor(person),
			languages: place.langs,
			birthday: person.birthday || birthdayFor(person),
			sos: {
				name: `${drawFrom(KIN_FIRST, `${person.id}sos`)} ${surname}`,
				rel: tie,
				phone: phoneFor(person, 4321),
			},
		};
	}

	/** MM-DD for anyone without a fixed birthday. */
	function birthdayFor(person) {
		const mm = String(drawFrom(BIRTH_MONTHS, `${person.id}m`)).padStart(2, '0');
		const day = String(1 + (fnv(`${person.id}d`) % 28)).padStart(2, '0');
		return `${mm}-${day}`;
	}

	/**
	 * A local number in the person's city. Without an offset it ends in
	 * the staff number; with one, the ending is scrambled so a second
	 * number for the same person looks unrelated.
	 */
	function phoneFor(person, offset) {
		const serial = Number(person.staff.replace(/\D/g, ''));
		const ending = offset ? (serial * 37 + offset) % 10000 : serial % 10000;
		return `${placeOf(person).dial} ${String(ending).padStart(4, '0')}`;
	}

	/* Days away from work. */

	/**
	 * Every day off this year, newest first: approved requests, then the
	 * vacation and sick or study days the person's `used` counts still
	 * owe, laid out as believable earlier bookings. The same array comes
	 * back on every call for that person.
	 */
	function daysAway(person) {
		const known = DAYS_AWAY.get(person.id);
		if (known) return known;

		const thisYear = AS_OF.slice(0, 4);
		const booked = LEAVE_REQUESTS.filter(
			(request) =>
				request.who === person.id && request.status === 'approved' && request.to.slice(0, 4) === thisYear,
		).map((request) => ({
			from: request.from,
			to: request.to,
			type: request.type,
			days: countWorkdays(request.from, request.to),
			reason: LEAVE_NAMES[request.type],
			request: request.id,
		}));
		const allowance = person.used || {};
		const daysOf = (leave) =>
			booked.filter((spell) => spell.type === leave).reduce((sum, spell) => sum + spell.days, 0);
		const overlaps = (from, to, margin = 0) =>
			booked.some((spell) => from <= shiftDate(spell.to, margin) && shiftDate(spell.from, -margin) <= to);
		const plausible = (day) => day >= person.start && day < AS_OF && (!person.left || day < person.left);

		/* Vacation goes into whole weeks, at least nine days clear of any
       other time off, in an order that is fixed for each person. */
		let owed = Math.max(0, (allowance.annual || 0) - daysOf('annual'));
		const slots = [...MONDAYS].sort((a, b) => fnv(person.id + a) - fnv(person.id + b));
		for (const monday of slots) {
			if (owed === 0) break;
			const length = Math.min(owed, owed >= 10 ? 5 : owed > 5 ? owed - 3 : owed);
			const friday = shiftDate(monday, length - 1);
			if (!plausible(monday) || friday >= AS_OF || overlaps(monday, friday, 9)) continue;
			booked.push({ from: monday, to: friday, type: 'annual', days: length, reason: LEAVE_NAMES.annual });
			owed -= length;
		}

		/* Sick and study days are single days; give up after forty tries. */
		for (const allowanceKind of ['sick', 'study']) {
			let missing = Math.max(0, (allowance[allowanceKind] || 0) - daysOf(allowanceKind));
			for (let attempt = 0; missing > 0 && attempt < 40; attempt += 1) {
				const day = shiftDate('2026-01-05', fnv(person.id + allowanceKind + attempt) % 270);
				if (!isWorkday(day) || !plausible(day) || overlaps(day, day)) continue;
				booked.push({ from: day, to: day, type: allowanceKind, days: 1, reason: LEAVE_NAMES[allowanceKind] });
				missing -= 1;
			}
		}

		booked.sort((a, b) => b.from.localeCompare(a.from));
		DAYS_AWAY.set(person.id, booked);
		return booked;
	}

	/** The absence covering one day, or null. */
	function absenceOn(person, day) {
		return daysAway(person).find((spell) => spell.from <= day && day <= spell.to) || null;
	}

	/* The time clock. */

	function patternOf(person) {
		return PATTERNS[person.shift || 'day'];
	}

	/**
	 * One past day for one person: away, or clocked in (from home or
	 * the office, on time or late) with in and out times in minutes.
	 * The draw is seeded by staff number and date, so Shifts and the
	 * person's own page always agree.
	 */
	function clockDay(person, day) {
		const absence = absenceOn(person, day);
		if (absence) return { kind: absence.type === 'sick' ? 'sick' : 'leave', reason: absence.reason };

		const roll = dice(fnv(person.staff + day));
		const pattern = patternOf(person);
		const homeOdds = calendarDay(day).getDay() === 5 ? 0.38 : 0.08;
		const remote = Boolean(person.remote) || roll() < homeOdds;
		const late = roll() < (person.lateRate || 0.035) ? 6 + Math.floor(roll() * 26) : 0;
		const inAt = late ? pattern.start + late : pattern.start - 2 - Math.floor(roll() * 21);
		const outAt = pattern.end + Math.floor(roll() * 41);
		return { kind: 'in', remote, late, inAt, outAt };
	}

	/** A repeatable stream of numbers in [0, 1) from a 32-bit seed. */
	function dice(origin) {
		let cursor = origin;
		return function nextFraction() {
			cursor |= 0;
			cursor = (cursor + 0x6d2b79f5) | 0;
			let mix = Math.imul(cursor ^ (cursor >>> 15), 1 | cursor);
			mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
			return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* Calendar arithmetic on YYYY-MM-DD strings. */

	function calendarDay(iso) {
		return new Date(`${iso}T00:00:00`);
	}

	function formatDate(when) {
		return [when.getFullYear(), when.getMonth() + 1, when.getDate()]
			.map((part) => String(part).padStart(2, '0'))
			.join('-');
	}

	/** The date a number of days after (or, if negative, before) another. */
	function shiftDate(iso, days) {
		const [y, m, d] = iso.split('-').map(Number);
		return formatDate(new Date(y, m - 1, d + days));
	}

	function isWorkday(iso) {
		const weekday = calendarDay(iso).getDay();
		return weekday > 0 && weekday < 6 && !HOLIDAYS.includes(iso);
	}

	/** Working days from one date to another, both ends included. */
	function countWorkdays(from, to) {
		let workdaysSoFar = 0;
		for (let day = from; day <= to; day = shiftDate(day, 1)) {
			if (isWorkday(day)) workdaysSoFar += 1;
		}
		return workdaysSoFar;
	}

	/* Seeded choices. */

	/** 32-bit FNV-1a hash of a string, for choices that must not change. */
	function fnv(text) {
		let digest = 2166136261;
		for (let i = 0; i < text.length; i += 1) {
			digest = Math.imul(digest ^ text.charCodeAt(i), 16777619);
		}
		return digest >>> 0;
	}

	function drawFrom(options, key) {
		return options[fnv(key) % options.length];
	}
})();
