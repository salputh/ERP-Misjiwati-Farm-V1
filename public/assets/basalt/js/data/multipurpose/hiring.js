/**
 * Fieldline's hiring pipeline: every open role with its careers-page
 * posting, and every candidate moving through it. Hiring, Role Details
 * and Candidate Details all read from here, so a person or a role never
 * says one thing on one page and another thing on the next. Everyone who
 * manages, recruits, interviews or refers is a roster member from
 * assets/basalt/js/data/multipurpose/people.js, which is how their names become links.
 *
 * Published on window.Basalt.data.hiring:
 *   roles       role records keyed by short name, posting included
 *   sources     labels for where an application came from
 *   benefits    perks printed under every posting
 *   candidates  the whole pipeline, earliest stage first
 *   find        find(id): a candidate by application number, or null
 *   rounds      rounds(c): the interview plan as this candidate sees it
 *   cv          cv(c): a short CV made up for the candidate
 *   details     details(c): contact facts and terms of employment
 *   addRole     addRole(r): stores a role created on the page, returns its key
 *
 * Swap in records from a real applicant tracker by keeping the same
 * shape. Every date is relative to the demo's fixed today, 2026-10-09.
 */
(() => {
	'use strict';

	/* An empty interviewer in a round means the role's hiring manager runs it. */
	const BY_MANAGER = '';
	const STORE_KEY = 'basalt-hiring-added-roles';

	const SOURCES = { careers: 'Careers site', referral: 'Referral', board: 'Job board', agency: 'Agency' };

	/* Perks every posting lists: [icon, heading, line]. */
	const BENEFITS = [
		['bi-graph-up-arrow', 'Share options', 'Everyone who joins owns a small part of Fieldline.'],
		['bi-sun', '25 days off', 'Plus your local public holidays and your birthday.'],
		['bi-heart-pulse', 'Health cover', 'For you and your family, wherever you live.'],
		['bi-book', 'Learning budget', '$1,500 a year for courses, books and conferences.'],
		['bi-house', 'Home office', 'A desk, a chair and a screen, paid for.'],
		['bi-people', 'Team weeks', 'Two weeks a year together, somewhere new.'],
	];

	/* Each role carries its posting alongside the hiring facts. A round is
     [title, interviewer, minutes, palette tone, what it scores]. status is
     open or paused (a paused role adds pausedOn and why); published says
     whether the careers page lists it, views counts visits to it; setup is
     remote, hybrid or onsite and start is the hoped-for first day. */
	const ROLES = {
		backend: posting({
			title: 'Senior Backend Engineer',
			team: 'Engineering',
			openings: 2,
			where: 'Remote, Midwest',
			setup: 'remote',
			manager: 'Alicia Bowen',
			recruiter: 'Cheryl Henderson',
			opened: '2026-08-21',
			start: '2027-01-11',
			views: 2140,
			band: '$95,000 to $110,000',
			skills: ['Go', 'PostgreSQL', 'Kafka'],
			extra: ['Kubernetes', 'gRPC', 'Travel planning'],
			rounds: [
				screening('Cheryl Henderson'),
				['Code review', 'Forrest Murphy', 60, 3, ['Code quality', 'Testing', 'Explaining choices']],
				systemsDesign(),
				['Final chat', 'Ruth Christensen', 30, 6, ['Team fit', 'Motivation', 'Questions for us']],
			],
			pitch: 'Schedulers book thousands of visits a day on Fieldline, and every booking runs through the services you will look after. You will join the scheduling team and help the travel planner keep up as our customers add teams and cities.',
			does: [
				'Build and run the Go services behind scheduling, travel times and live visit updates',
				'Make the travel planner faster when a customer has hundreds of staff out at once',
				'Review code, pair with other engineers and write down why we chose what we chose',
				'Take your turn on call, one week in eight, with a calm runbook and a second person',
			],
			wants: [
				'Five or more years building backend services that real customers depend on',
				'Comfortable with Go and PostgreSQL, and with event streams such as Kafka',
				'You explain your choices clearly in writing, not just in meetings',
				'You care what happens to the person at the end of the plan',
			],
		}),
		platform: posting({
			title: 'Platform Engineer',
			team: 'Engineering',
			openings: 2,
			where: 'Remote, West or Midwest',
			setup: 'remote',
			manager: 'Alicia Bowen',
			recruiter: 'Cheryl Henderson',
			opened: '2026-08-03',
			start: '2026-12-07',
			views: 1580,
			band: '$110,000 to $130,000',
			skills: ['Kubernetes', 'Terraform', 'PostgreSQL'],
			extra: ['Go', 'Observability', 'On-call'],
			rounds: [
				screening('Cheryl Henderson'),
				['Infrastructure deep dive', 'Darryl Sanders', 60, 8, ['Depth', 'Reliability', 'Explaining choices']],
				['On-call scenario', 'Jim Atkins', 45, 5, ['Calm under pressure', 'Diagnosis', 'Communication']],
				systemsDesign(),
			],
			pitch: 'Our customers start booking visits at 5 a.m. in Bellingham and finish late in California, so Fieldline never gets a quiet hour. You will keep the platform under it steady, quick to deploy and easy to understand.',
			does: [
				'Run our Kubernetes clusters and the Terraform that builds them',
				'Make deploys boring: fast, small and easy to roll back',
				'Improve alerts so the right person is woken for the right reason',
				'Help product teams own their services with good defaults and clear docs',
			],
			wants: [
				'Hands-on time running Kubernetes and PostgreSQL in production',
				'Infrastructure as code with Terraform or similar',
				'A steady head during incidents and a habit of writing them up',
				'Happy to work across time zones with a mostly async team',
			],
		}),
		designer: posting({
			title: 'Product UX Designer',
			team: 'Product',
			openings: 2,
			where: 'Toledo or remote, Midwest',
			setup: 'hybrid',
			manager: 'Leslie Whitlock',
			recruiter: 'Cheryl Henderson',
			opened: '2026-08-10',
			start: '2026-12-01',
			views: 1920,
			band: '$70,000 to $85,000',
			skills: ['Figma', 'Prototyping', 'User research'],
			extra: ['Design systems', 'Mobile apps', 'Accessibility'],
			rounds: [
				screening('Cheryl Henderson'),
				['Portfolio review', 'Sandra Franklin', 60, 6, ['Craft', 'Process', 'Storytelling']],
				['Design critique', BY_MANAGER, 60, 4, ['Product sense', 'Feedback', 'Judgment']],
			],
			pitch: 'On-site staff use Fieldline in a car, on a doorstep, sometimes with one free hand. You will design the screens they rely on all day and the schedule board their office runs on, working closely with Leslie and the mobile team.',
			does: [
				'Design new features for the staff app and the schedule board, end to end',
				'Spend days with customers and turn what you see into better screens',
				'Grow our design system with the frontend engineers',
				'Test prototypes with real schedulers before we build',
			],
			wants: [
				'A portfolio that shows how you got to the answer, not just the answer',
				'Strong in Figma and quick at prototyping',
				'Experience running your own user research',
				'Bonus if you have designed for phones used outdoors or on the move',
			],
		}),
		ae: posting({
			title: 'Enterprise Account Executive',
			team: 'Sales',
			openings: 1,
			where: 'Evanston',
			setup: 'onsite',
			manager: 'Rowan Walsh',
			recruiter: 'Kirk Mathis',
			opened: '2026-08-14',
			start: '2026-11-16',
			views: 860,
			band: '$90,000 to $100,000',
			skills: ['Enterprise sales', 'Forecasting', 'Negotiation'],
			extra: ['On-site teams', 'Salesforce', 'Multi-site rollouts'],
			rounds: [
				screening('Kirk Mathis'),
				['Discovery call role-play', 'Quentin Cook', 45, 3, ['Questions', 'Listening', 'Next steps']],
				['Sales pitch', BY_MANAGER, 60, 1, ['Story', 'Handling objections', 'Close']],
			],
			pitch: 'Businesses with fifty to five hundred people working on site are our fastest growing customers. You will look after the Midwest, from the first call to a signed contract and a rollout plan the customer believes in.',
			does: [
				'Own a patch of mid-size and enterprise prospects across the Midwest',
				'Run discovery calls, demos and site visits with a solutions engineer',
				'Build forecasts the team can trust and keep the CRM honest',
				'Hand every new customer to Success with a clear rollout plan',
			],
			wants: [
				'Three or more years closing software deals over $50,000 a year',
				'You have sold to operations or on-site teams before',
				'Comfortable with long deals that involve IT, finance and the people out on visits',
				'Based in or near Evanston, with some travel',
			],
		}),
		support: posting({
			title: 'Support Specialist',
			team: 'Support',
			openings: 2,
			where: 'Remote, South or West',
			setup: 'remote',
			manager: 'Connie Reese',
			recruiter: 'Kirk Mathis',
			opened: '2026-09-07',
			start: '2026-11-02',
			views: 1310,
			band: '$52,000 to $62,000',
			skills: ['Customer support', 'Troubleshooting', 'Clear writing'],
			extra: ['Zendesk', 'SaaS billing', 'Second language'],
			rounds: [
				screening('Kirk Mathis'),
				['Support scenario', BY_MANAGER, 45, 4, ['Empathy', 'Diagnosis', 'Writing']],
			],
			pitch: 'When a scheduler cannot book a visit, their whole morning stops. You will be the person who gets them moving again, by chat, email and the occasional phone call, and tell the product team what keeps going wrong.',
			does: [
				'Answer chats and emails from schedulers, office staff and on-site teams',
				'Find out what is really wrong, fix what you can and pass on what you cannot',
				'Write and update help articles when the same question comes up twice',
				'Share a roster that covers the Eastern and Pacific working days',
			],
			wants: [
				'Two or more years in customer support, ideally for software',
				'Clear, friendly writing, even when the customer is not',
				'Patience with troubleshooting and a habit of writing steps down',
				'A second language is a real plus',
			],
		}),
		impl: posting({
			title: 'Implementation Specialist',
			team: 'Success',
			openings: 1,
			where: 'Remote, South or Midwest',
			setup: 'remote',
			manager: 'Elise Vick',
			recruiter: 'Kirk Mathis',
			opened: '2026-09-10',
			start: '2026-11-09',
			views: 740,
			band: '$68,000 to $80,000',
			skills: ['Onboarding', 'Data imports', 'Training'],
			extra: ['On-site teams', 'Project planning', 'Spanish'],
			rounds: [
				screening('Kirk Mathis'),
				['Hiring manager interview', BY_MANAGER, 45, 7, ['Customer focus', 'Planning', 'Team fit']],
				['Onboarding role-play', 'Silas Fischer', 45, 3, ['Clarity', 'Patience', 'Follow-up']],
			],
			pitch: 'New customers buy Fieldline because they want their mornings to run better. You will get them there: importing their visits and customers, setting up their teams and training the schedulers who will live in it.',
			does: [
				'Lead new customers from signed contract to their first full week live',
				'Import customer lists, visit history and price lists',
				'Train office teams and on-site staff, on calls and on site',
				'Pass what you learn back to Product and Sales',
			],
			wants: [
				'Experience getting customers live on business software',
				'Comfortable with spreadsheets and messy data',
				'Calm, clear trainer who can run a room or a video call',
				'Spanish is a plus for our customers in the South',
			],
		}),
		growth: posting({
			title: 'Growth Marketing Manager',
			team: 'Marketing',
			openings: 1,
			where: 'Bismarck or remote',
			setup: 'hybrid',
			manager: 'Cameron Reid',
			recruiter: 'Cheryl Henderson',
			opened: '2026-09-28',
			start: '2027-01-04',
			views: 690,
			band: '$60,000 to $72,000',
			skills: ['Paid search', 'Lifecycle email', 'Experiments'],
			extra: ['SaaS', 'Analytics', 'Copywriting'],
			rounds: [
				screening('Cheryl Henderson'),
				['Growth case study', BY_MANAGER, 60, 5, ['Analysis', 'Ideas', 'Measurement']],
			],
			pitch: 'Most of our smaller customers find us, try us and buy without talking to anyone. You will own that path, from the first search to the first paid month, and work with Cameron on what we try next.',
			does: [
				'Run paid search and paid social with a clear budget and clear goals',
				'Write and test the emails people get during their free trial',
				'Plan experiments on the pricing and sign-up pages with the web team',
				'Report on what worked, what did not and what we do next',
			],
			wants: [
				'Three or more years in growth or performance marketing for software',
				'Hands-on with paid search and lifecycle email tools',
				'You set up experiments properly and read results honestly',
				'Good with words; you will write a lot of the copy yourself',
			],
		}),
		fieldtech: posting({
			title: 'On-site Setup Specialist',
			team: 'Operations',
			openings: 1,
			where: 'Evanston',
			setup: 'onsite',
			manager: 'Kirk Mathis',
			recruiter: 'Cheryl Henderson',
			opened: '2026-09-21',
			start: '2027-02-01',
			views: 310,
			status: 'paused',
			pausedOn: '2026-10-02',
			why: 'Waiting for the Evanston rollout contract to be signed.',
			published: false,
			band: '$55,000 to $64,000',
			skills: ['Training people', 'Customer visits', 'Driver’s license'],
			extra: ['Calendar apps', 'Payroll tools', 'Spanish'],
			rounds: [
				screening('Cheryl Henderson'),
				['Setup walk-through', BY_MANAGER, 60, 8, ['Care', 'Patience', 'Explaining choices']],
			],
			pitch: 'Some customers want us there on their first day. You will visit new customers across the Evanston area, set up the app on their phones, show the team how it all works and leave every office running on Fieldline.',
			does: [
				'Set up schedules, staff and price lists in new customer offices',
				'Check every phone shows the day before you leave the site',
				'Show on-site staff how to use the app on their first day',
				'Keep your visit notes and setup checklists up to date',
			],
			wants: [
				'Experience training people on software or setting up new tools',
				'Comfortable visiting customers on your own',
				'A clean driver’s license; a company car is provided',
				'Spanish is a plus for some of our customers',
			],
		}),
	};

	/* The pipeline, one group per stage in board order. Each person lists
     only the stages after applying in `reached`; the stage itself and the
     application day are filled in by atStage(). `next` is either booked
     (date, sometimes time) or still open (todo). `scores` holds the
     scorecards as [interviewer, round, verdict], and `staff` links a hire
     to their roster number. */
	const PIPELINE = [
		...atStage('applied', [
			{
				id: '#4101',
				first: 'Meghan',
				last: 'Solheim',
				city: 'Topeka, KS',
				role: 'designer',
				source: 'careers',
				applied: '2026-10-06',
				next: { text: 'Portfolio review with Sandra', date: '2026-10-12' },
				history: [['2026-10-06', 'Applied on the careers site with a portfolio link']],
			},
			{
				id: '#4102',
				first: 'Andrei',
				last: 'Volkov',
				city: 'Elkhart, IN',
				role: 'backend',
				source: 'board',
				applied: '2026-10-05',
				next: { text: 'Screening call', todo: 'To book' },
				history: [['2026-10-05', 'Applied through a job board']],
			},
			{
				id: '#4103',
				first: 'Héctor',
				last: 'Ramírez',
				city: 'Durham, NC',
				role: 'support',
				source: 'careers',
				applied: '2026-10-07',
				next: { text: 'Screening call', todo: 'To book' },
				history: [['2026-10-07', 'Applied on the careers site']],
			},
			{
				id: '#4104',
				first: 'Élodie',
				last: 'Garnier',
				city: 'Peoria, IL',
				role: 'growth',
				source: 'referral',
				referrer: 'Marshall Beck',
				applied: '2026-10-08',
				next: { text: 'CV review by Cameron', date: '2026-10-13' },
				history: [['2026-10-08', 'Referred by Marshall Beck']],
			},
			{
				id: '#4105',
				first: 'Bruno',
				last: 'Echeverría',
				city: 'Chattanooga, TN',
				role: 'impl',
				source: 'board',
				applied: '2026-10-03',
				next: { text: 'Screening call', todo: 'To book' },
				history: [['2026-10-03', 'Applied through a job board']],
			},
		]),
		...atStage('screen', [
			{
				id: '#4106',
				first: 'Adaeze',
				last: 'Bartlett',
				city: 'Evanston, IL',
				role: 'ae',
				source: 'careers',
				applied: '2026-09-24',
				reached: { screen: '2026-10-02' },
				next: { text: 'Screening call with Kirk', date: '2026-10-12' },
				history: [
					['2026-09-24', 'Applied on the careers site'],
					['2026-10-02', 'Moved to Screening by Kirk Mathis'],
				],
			},
			{
				id: '#4107',
				first: 'Daichi',
				last: 'Watkins',
				city: 'Syracuse, NY',
				role: 'support',
				source: 'board',
				applied: '2026-09-29',
				reached: { screen: '2026-10-05' },
				next: { text: 'Screening call with Kirk', date: '2026-10-09', time: '15:00' },
				history: [
					['2026-09-29', 'Applied through a job board'],
					['2026-10-05', 'Moved to Screening by Kirk Mathis'],
				],
			},
			{
				id: '#4108',
				first: 'Pavel',
				last: 'Horák',
				city: 'Lawrence, KS',
				role: 'platform',
				source: 'agency',
				agency: 'Talentbridge',
				applied: '2026-09-18',
				reached: { screen: '2026-10-01' },
				next: { text: 'Screening call with Cheryl', date: '2026-10-13' },
				history: [
					['2026-09-18', 'Put forward by Talentbridge'],
					['2026-10-01', 'Moved to Screening by Cheryl Henderson'],
				],
			},
			{
				id: '#4109',
				first: 'Wanjiru',
				last: 'Morton',
				city: 'Stamford, CT',
				role: 'impl',
				source: 'referral',
				referrer: 'Leslie Ashby',
				applied: '2026-09-22',
				reached: { screen: '2026-10-06' },
				next: { text: 'Screening call with Kirk', date: '2026-10-12' },
				history: [
					['2026-09-22', 'Referred by Leslie Ashby'],
					['2026-10-06', 'Moved to Screening by Kirk Mathis'],
				],
			},
		]),
		...atStage('interview', [
			{
				id: '#4110',
				first: 'Beatriz',
				last: 'Antunes',
				city: 'Akron, OH',
				role: 'backend',
				source: 'referral',
				referrer: 'Beverly Maxwell',
				applied: '2026-09-02',
				reached: { screen: '2026-09-04', interview: '2026-09-14' },
				next: { text: 'Systems design with Alicia', date: '2026-10-13', time: '10:00' },
				scores: [
					['Cheryl Henderson', 'Screening call', 'Strong yes'],
					['Forrest Murphy', 'Code review', 'Yes'],
				],
				history: [
					['2026-09-02', 'Referred by Beverly Maxwell'],
					['2026-09-10', 'Screening call with Cheryl Henderson'],
					['2026-09-30', 'Code review with Forrest Murphy'],
				],
			},
			{
				id: '#4111',
				first: 'Fatou',
				last: 'Dalton',
				city: 'Akron, OH',
				role: 'designer',
				source: 'careers',
				applied: '2026-09-17',
				reached: { screen: '2026-09-21', interview: '2026-09-28' },
				next: { text: 'Design critique with Leslie', date: '2026-10-14', time: '14:00' },
				scores: [
					['Cheryl Henderson', 'Screening call', 'Yes'],
					['Sandra Franklin', 'Portfolio review', 'Strong yes'],
				],
				history: [
					['2026-09-17', 'Applied on the careers site'],
					['2026-09-24', 'Screening call with Cheryl Henderson'],
					['2026-10-05', 'Portfolio review with Sandra Franklin'],
				],
			},
			{
				id: '#4112',
				first: 'Tobias',
				last: 'Engström',
				city: 'Minneapolis, MN',
				role: 'ae',
				source: 'agency',
				agency: 'Northbound Search',
				applied: '2026-08-27',
				reached: { screen: '2026-08-31', interview: '2026-09-14' },
				next: { text: 'Sales pitch to Rowan', date: '2026-10-15', time: '16:00' },
				scores: [
					['Kirk Mathis', 'Screening call', 'Yes'],
					['Quentin Cook', 'Discovery call role-play', 'Mixed'],
				],
				history: [
					['2026-08-27', 'Put forward by Northbound Search'],
					['2026-09-04', 'Screening call with Kirk Mathis'],
					['2026-09-29', 'Role-play with Quentin Cook'],
				],
			},
			{
				id: '#4113',
				first: 'Samuel',
				last: 'Nugent',
				city: 'Atlanta, GA',
				role: 'support',
				source: 'careers',
				applied: '2026-09-12',
				reached: { screen: '2026-09-16', interview: '2026-09-28' },
				next: { text: 'Support scenario with Connie', date: '2026-10-12', time: '11:00' },
				scores: [['Kirk Mathis', 'Screening call', 'Yes']],
				history: [
					['2026-09-12', 'Applied on the careers site'],
					['2026-09-25', 'Screening call with Kirk Mathis'],
				],
			},
			{
				id: '#4114',
				first: 'Ingeborg',
				last: 'Haas',
				city: 'Toledo, OH',
				role: 'platform',
				source: 'referral',
				referrer: 'Jim Atkins',
				applied: '2026-09-08',
				reached: { screen: '2026-09-10', interview: '2026-09-22' },
				next: { text: 'On-call scenario with Jim', date: '2026-10-16', time: '13:00' },
				scores: [
					['Cheryl Henderson', 'Screening call', 'Yes'],
					['Darryl Sanders', 'Infrastructure deep dive', 'Strong yes'],
				],
				history: [
					['2026-09-08', 'Referred by Jim Atkins'],
					['2026-09-15', 'Screening call with Cheryl Henderson'],
					['2026-10-01', 'Deep dive with Darryl Sanders'],
				],
			},
		]),
		...atStage('offer', [
			{
				id: '#4115',
				first: 'Sabrina',
				last: 'Keane',
				city: 'Duluth, MN',
				role: 'impl',
				source: 'referral',
				referrer: 'Tony Aldridge',
				applied: '2026-08-30',
				reached: { screen: '2026-09-02', interview: '2026-09-14', offer: '2026-10-06' },
				next: { text: 'Offer sent, reply due', date: '2026-10-13' },
				scores: [
					['Kirk Mathis', 'Screening call', 'Yes'],
					['Elise Vick', 'Hiring manager interview', 'Strong yes'],
					['Silas Fischer', 'Onboarding role-play', 'Strong yes'],
				],
				history: [
					['2026-08-30', 'Referred by Tony Aldridge'],
					['2026-09-08', 'Screening call with Kirk Mathis'],
					['2026-09-23', 'Interviews with Elise and Silas'],
					['2026-10-06', 'Offer sent by Kirk Mathis'],
				],
			},
			{
				id: '#4116',
				first: 'Devin',
				last: 'Barnett',
				city: 'Lincoln, NE',
				role: 'backend',
				source: 'agency',
				agency: 'Talentbridge',
				applied: '2026-08-28',
				reached: { screen: '2026-09-01', interview: '2026-09-10', offer: '2026-10-07' },
				next: { text: 'Offer call with Alicia', date: '2026-10-12', time: '09:30' },
				scores: [
					['Cheryl Henderson', 'Screening call', 'Yes'],
					['Forrest Murphy', 'Code review', 'Strong yes'],
					['Alicia Bowen', 'Systems design', 'Yes'],
				],
				history: [
					['2026-08-28', 'Put forward by Talentbridge'],
					['2026-09-03', 'Screening call with Cheryl Henderson'],
					['2026-09-29', 'Systems design with Alicia Bowen'],
					['2026-10-07', 'Offer approved by Ruth Christensen'],
				],
			},
			{
				id: '#4117',
				first: 'Wynn',
				last: 'Jiaying',
				city: 'Iowa City, IA',
				role: 'platform',
				source: 'referral',
				referrer: 'Darryl Sanders',
				applied: '2026-09-03',
				reached: { screen: '2026-09-07', interview: '2026-09-16', offer: '2026-10-05' },
				next: { text: 'Contract out, signature due', date: '2026-10-14' },
				scores: [
					['Cheryl Henderson', 'Screening call', 'Strong yes'],
					['Darryl Sanders', 'Infrastructure deep dive', 'Yes'],
					['Jim Atkins', 'On-call scenario', 'Strong yes'],
				],
				history: [
					['2026-09-03', 'Referred by Darryl Sanders'],
					['2026-09-09', 'Screening call with Cheryl Henderson'],
					['2026-09-30', 'On-call scenario with Jim Atkins'],
					['2026-10-08', 'Accepted the offer by phone'],
				],
			},
		]),
		...atStage('hired', [
			{
				id: '#4118',
				first: 'Sloan',
				last: 'Kirby',
				city: 'Bellingham, WA',
				role: 'platform',
				source: 'referral',
				referrer: 'Rory Beasley',
				applied: '2026-08-12',
				staff: '#215',
				reached: { screen: '2026-08-14', interview: '2026-08-20', offer: '2026-09-08', hired: '2026-09-14' },
				next: { text: 'Starts, laptop delivered', date: '2026-10-12' },
				scores: [
					['Cheryl Henderson', 'Screening call', 'Strong yes'],
					['Darryl Sanders', 'Infrastructure deep dive', 'Strong yes'],
					['Alicia Bowen', 'Systems design', 'Strong yes'],
				],
				history: [
					['2026-08-12', 'Referred by Rory Beasley'],
					['2026-09-08', 'Offer sent by Cheryl Henderson'],
					['2026-09-14', 'Signed the contract'],
				],
			},
			{
				id: '#4119',
				first: 'Tamara',
				last: 'Ives',
				city: 'Missoula, MT',
				role: 'support',
				source: 'careers',
				applied: '2026-09-08',
				staff: '#217',
				reached: { screen: '2026-09-09', interview: '2026-09-14', offer: '2026-09-22', hired: '2026-09-25' },
				next: { text: 'Starts, buddy to pick', date: '2026-10-19' },
				scores: [
					['Kirk Mathis', 'Screening call', 'Strong yes'],
					['Connie Reese', 'Support scenario', 'Yes'],
				],
				history: [
					['2026-09-08', 'Applied on the careers site'],
					['2026-09-22', 'Offer sent by Kirk Mathis'],
					['2026-09-25', 'Signed the contract'],
				],
			},
			{
				id: '#4120',
				first: 'Jacob',
				last: 'Krause',
				city: 'Toledo, OH',
				role: 'designer',
				source: 'careers',
				applied: '2026-08-17',
				staff: '#219',
				reached: { screen: '2026-08-20', interview: '2026-08-31', offer: '2026-09-28', hired: '2026-10-01' },
				next: { text: 'Starts, buddy to pick', date: '2026-11-02' },
				scores: [
					['Cheryl Henderson', 'Screening call', 'Yes'],
					['Sandra Franklin', 'Portfolio review', 'Strong yes'],
					['Leslie Whitlock', 'Design critique', 'Strong yes'],
				],
				history: [
					['2026-08-17', 'Applied on the careers site'],
					['2026-09-28', 'Offer sent by Cheryl Henderson'],
					['2026-10-01', 'Signed the contract'],
				],
			},
		]),
	];

	/* State facts behind the made-up contact details and CVs: a nearby
     university and the languages spoken. Any state missing here borrows
     the Illinois entry. */
	const STATES = {
		KS: { uni: 'Kansas State University', langs: ['English'] },
		IN: { uni: 'Indiana University', langs: ['English'] },
		NC: { uni: 'North Carolina State University', langs: ['English', 'Spanish'] },
		IL: { uni: 'University of Illinois', langs: ['English'] },
		TN: { uni: 'University of Tennessee', langs: ['English', 'Spanish'] },
		NY: { uni: 'Syracuse University', langs: ['English'] },
		CT: { uni: 'University of Connecticut', langs: ['English'] },
		OH: { uni: 'Ohio State University', langs: ['English', 'Spanish'] },
		MN: { uni: 'University of Minnesota', langs: ['English'] },
		GA: { uni: 'Georgia State University', langs: ['English'] },
		NE: { uni: 'University of Nebraska', langs: ['English'] },
		IA: { uni: 'University of Iowa', langs: ['English'] },
		WA: { uni: 'Western Washington University', langs: ['English'] },
		MT: { uni: 'University of Montana', langs: ['English'] },
	};
	/* Area codes for the candidates' home cities. */
	const AREA_CODES = {
		Topeka: '785',
		Elkhart: '574',
		Durham: '919',
		Peoria: '309',
		Chattanooga: '423',
		Evanston: '847',
		Syracuse: '315',
		Lawrence: '785',
		Stamford: '203',
		Akron: '330',
		Minneapolis: '612',
		Atlanta: '404',
		Toledo: '419',
		Duluth: '218',
		Lincoln: '402',
		'Iowa City': '319',
		Bellingham: '360',
		Missoula: '406',
	};
	const NOTICE_PERIODS = ['2 weeks', '1 month', '1 month', '2 months', '3 months'];

	/* CV material per kind of role. The summary follows a spelled-out
     number of years; past jobs run newest first as [title, highlight]. */
	const CV_BY_ROLE = {
		backend: {
			summary: 'years building backend services, the last few on scheduling and travel.',
			jobs: [
				[
					'Senior Software Engineer',
					'Rebuilt the delivery travel planner on event streams; leads a team of four.',
				],
				['Software Engineer', 'Payment APIs in Go handling two million calls a day.'],
				['Backend Developer', 'Booking systems for clinics and repair shops.'],
			],
		},
		platform: {
			summary: 'years running cloud platforms that never sleep.',
			jobs: [
				['Senior Platform Engineer', 'Moved 40 services to Kubernetes with no downtime.'],
				['Site Reliability Engineer', 'Cut pages out of hours by half with better alerts.'],
				['Systems Engineer', 'Looked after the data center for a logistics firm.'],
			],
		},
		designer: {
			summary: 'years designing apps for people who work on the move.',
			jobs: [
				['Lead Product Designer', 'Redesigned the driver app for a delivery start-up.'],
				['Product UX Designer', 'Built the design system for a booking platform.'],
				['UI Designer', 'Research and prototypes for a home services agency.'],
			],
		},
		ae: {
			summary: 'years selling software to companies with teams on the move.',
			jobs: [
				['Enterprise Account Executive', 'Closed 118% of target selling booking software.'],
				['Account Manager', 'Grew mid-market accounts in the Midwest by 40%.'],
				['Business Development Rep', 'Booked 30 meetings a month for the enterprise team.'],
			],
		},
		support: {
			summary: 'years in customer support, mostly for software businesses.',
			jobs: [
				['Support Specialist', 'Second-line support for a scheduling app, 96% happy score.'],
				['Customer Support Agent', 'Phone and chat for a telecoms company.'],
				['Front Desk Lead', 'Ran the front desk at a busy repair shop.'],
			],
		},
		impl: {
			summary: 'years getting new customers live on business software.',
			jobs: [
				['Implementation Consultant', 'Took 60 small businesses live on booking software.'],
				['Customer Onboarding Specialist', 'Ran training for schedulers and office teams.'],
				['Operations Coordinator', 'Scheduled carers for a home care agency.'],
			],
		},
		growth: {
			summary: 'years growing sign-ups for software sold online.',
			jobs: [
				['Growth Marketing Manager', 'Halved the cost of a paid sign-up in a year.'],
				['Lifecycle Marketer', 'Trial emails that lifted trial-to-paid from 12% to 17%.'],
				['Marketing Executive', 'Search and social for a home services brand.'],
			],
		},
	};
	const DEGREES = {
		designer: 'BA Interaction Design',
		ae: 'BA Business and Marketing',
		growth: 'BA Business and Marketing',
		support: 'BA Business Administration',
		impl: 'BA Business Administration',
	};
	const FALLBACK_DEGREE = 'MSc Computer Science';
	const PAST_EMPLOYERS = [
		'Rotaverde',
		'Glint Pay',
		'Ponte Digital',
		'Eastgale Logistics',
		'Brightpath',
		'Quayside Software',
		'Fleetwise',
		'Tidal Apps',
		'Corvid Systems',
		'Harborline',
		'Kinetic Labs',
		'Atlas Home Services',
	];
	const SPELLED_YEARS = ['Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
	const CV_YEAR = 2026;

	/* Scorecards: a verdict sets the three marks and the pool of remarks
     an interviewer's note is drawn from. */
	const VERDICTS = {
		'Strong yes': {
			marks: [4, 4, 4],
			remarks: [
				'Clear, specific answers and good questions back. Wants to move on quickly.',
				'Best we have seen for this role. Calm, sharp and easy to work with.',
			],
		},
		Yes: {
			marks: [3, 3, 4],
			remarks: [
				'Solid on the basics and talked through the choices well.',
				'Good fit for the team; a little thin on one area, nothing that worries me.',
			],
		},
		Mixed: {
			marks: [3, 2, 2],
			remarks: [
				'Strong on the relationship side, but the next steps were vague.',
				'Good energy, though some answers stayed general. Worth one more conversation.',
			],
		},
	};
	const INTERVIEW_SLOTS = ['10:00', '11:00', '14:00', '15:30'];

	/** Brings back roles added earlier this session, then hands everything to the pages. */
	function publish() {
		try {
			Object.assign(ROLES, readStoredRoles());
		} catch {
			/* Storage is off, so added roles only live as long as the page. */
		}
		const shelf = window.Basalt.data || (window.Basalt.data = {});
		shelf.hiring = { roles: ROLES, sources: SOURCES, benefits: BENEFITS, candidates: PIPELINE };
		Object.assign(shelf.hiring, {
			find: candidateById,
			details: contactSheet,
			cv: makeCv,
			rounds: interviewPlan,
			addRole: saveNewRole,
		});
	}

	/* Small builders the role and candidate records above are written with. */

	/** Fills in what nearly every posting shares; a role may override any of it. */
	function posting(fields) {
		return { status: 'open', published: true, type: 'Full-time', ...fields };
	}

	/** The recruiter's opening call, the same on every role. */
	function screening(recruiter) {
		return ['Screening call', recruiter, 30, 2, ['Experience', 'Communication', 'Motivation']];
	}

	/** The architecture round both engineering roles end with. */
	function systemsDesign() {
		return ['Systems design', BY_MANAGER, 60, 1, ['Architecture', 'Scaling', 'Judgment']];
	}

	/**
	 * Stamps a group of candidates with their stage and opens `reached`
	 * with the day they applied.
	 * @param {string} stage
	 * @param {object[]} people
	 */
	function atStage(stage, people) {
		return people.map((person) => ({
			...person,
			stage,
			reached: { applied: person.applied, ...person.reached },
		}));
	}

	/* Roles added on the Hiring page. They are kept in sessionStorage so
     their own page still opens; a real app would save them to a server. */

	function readStoredRoles() {
		return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}');
	}

	/**
	 * Adds a role under the first free `new-N` key and remembers it for the session.
	 * @returns {string} the key the role now lives under
	 */
	function saveNewRole(draft) {
		let slotNumber = 1;
		while (ROLES[`new-${slotNumber}`]) slotNumber += 1;
		const key = `new-${slotNumber}`;
		ROLES[key] = draft;
		try {
			const remembered = readStoredRoles();
			remembered[key] = draft;
			sessionStorage.setItem(STORE_KEY, JSON.stringify(remembered));
		} catch {
			/* Nothing is remembered, yet the role still shows on this page. */
		}
		return key;
	}

	/* A candidate is found by application number; their state comes from the city. */

	/** @returns {object|null} the candidate with application number `id` */
	function candidateById(id) {
		return PIPELINE.find((person) => person.id === id) ?? null;
	}

	function stateFacts(person) {
		return STATES[person.city.split(', ')[1]] || STATES.IL;
	}

	function areaCode(person) {
		return AREA_CODES[person.city.split(', ')[0]] || '847';
	}

	/* Invented details. Everything below is seeded by the application number,
     so a candidate shows the same phone, CV and notes on every visit. */

	/** FNV-1a: a stable unsigned 32-bit number for any string. */
	function fingerprint(text) {
		let digest = 2166136261;
		for (let at = 0; at < text.length; at += 1) {
			digest ^= text.charCodeAt(at);
			digest = Math.imul(digest, 16777619);
		}
		return digest >>> 0;
	}

	function choose(options, noise) {
		return options[fingerprint(noise) % options.length];
	}

	/** Lowercases a name and drops its accents, for building an email address. */
	function plainLetters(name) {
		return String(name)
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	/** Moves an ISO day by `days` and returns it as an ISO day again. */
	function shiftDate(iso, days) {
		const [year, month, day] = iso.split('-').map(Number);
		const shifted = new Date(year, month - 1, day + days);
		return `${shifted.getFullYear()}-${twoDigits(shifted.getMonth() + 1)}-${twoDigits(shifted.getDate())}`;
	}

	function twoDigits(part) {
		return String(part).padStart(2, '0');
	}

	/** Joins ['A', 'B', 'C'] as "A, B and C". */
	function spokenList(items) {
		if (items.length < 2) return items[0];
		return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
	}

	/** How to reach the candidate, and the terms they would join on. */
	function contactSheet(person) {
		const noise = fingerprint(person.id);
		const local = `${plainLetters(person.first)}.${plainLetters(person.last)}`.replace(/[^a-z.]/g, '');
		const hired = person.stage === 'hired';
		return {
			email: `${local}@example.com`,
			phone: `+1 ${areaCode(person)} 555 01${twoDigits(noise % 100)}`,
			city: person.city,
			notice: hired ? 'None, can start now' : choose(NOTICE_PERIODS, `${person.id}n`),
			salary: ROLES[person.role].band,
			rights: 'Authorized to work in the US',
		};
	}

	/** A three-job CV with skills and schooling, sized to the role applied for. */
	function makeCv(person) {
		const material = CV_BY_ROLE[person.role];
		const opening = ROLES[person.role];
		const noise = fingerprint(person.id);
		const career = 4 + (noise % 9);
		const latestStart = CV_YEAR - (2 + (noise % 3));
		const middleStart = latestStart - (2 + ((noise >> 3) % 3));
		const spans = [
			`${latestStart} to now`,
			`${middleStart} to ${latestStart}`,
			`${CV_YEAR - career} to ${middleStart}`,
		];
		const usedNames = new Set();

		function employerFor(slot) {
			let at = (fingerprint(`${person.id}${slot}`) + slot) % PAST_EMPLOYERS.length;
			while (usedNames.has(PAST_EMPLOYERS[at])) at = (at + 1) % PAST_EMPLOYERS.length;
			usedNames.add(PAST_EMPLOYERS[at]);
			return PAST_EMPLOYERS[at];
		}

		const facts = stateFacts(person);
		const extras = opening.extra.slice(0, 2 + (noise % 2));
		return {
			summary: `${SPELLED_YEARS[career - 4]} ${material.summary}`,
			jobs: material.jobs.map(([title, note], slot) => ({
				years: spans[slot],
				title: `${title}, ${employerFor(slot)}`,
				note,
			})),
			skills: [
				...opening.skills.map((name) => ({ name, match: true })),
				...extras.map((name) => ({ name, match: false })),
			],
			education: `${DEGREES[person.role] || FALLBACK_DEGREE}, ${facts.uni}, ${CV_YEAR - career - 1}. Speaks ${spokenList(facts.langs)}.`,
		};
	}

	/**
	 * The role's rounds as they stand for one candidate. Scored rounds come
	 * back `done` with marks and a note, the round their next step names comes
	 * back `booked`, the rest `todo`; unscored rounds are left out once an
	 * offer is made.
	 */
	function interviewPlan(person) {
		const opening = ROLES[person.role];
		const scorecards = person.scores || [];
		const closing = person.stage === 'offer' || person.stage === 'hired';
		const rounds = [];
		let bookingFound = false;
		let previousDay = '';

		for (const [index, [name, interviewer, mins, tone, looks]] of opening.rounds.entries()) {
			const round = { key: `r${index}`, name, who: interviewer || opening.manager, mins, tone };
			const card = scorecards.find(([, roundName]) => roundName === name);

			if (card) {
				const verdict = card[2];
				const { marks, remarks } = VERDICTS[verdict];
				previousDay = heldOn(person, card[0], index, previousDay);
				rounds.push({
					...round,
					state: 'done',
					date: previousDay,
					time: choose(INTERVIEW_SLOTS, `${person.id}${name}`),
					verdict,
					scores: looks.map((look, at) => [look, marks[(at + fingerprint(`${person.id}${look}`)) % 3]]),
					said: choose(remarks, `${person.id}${name}`),
				});
				continue;
			}

			const isNext = person.next.date && person.next.text.toLowerCase().startsWith(name.toLowerCase());
			if (!bookingFound && isNext) {
				bookingFound = true;
				rounds.push({
					...round,
					state: 'booked',
					date: person.next.date,
					time: person.next.time || '10:00',
					looks,
				});
				continue;
			}

			if (!closing) rounds.push({ ...round, state: 'todo', looks });
		}
		return rounds;
	}

	/**
	 * The day a scored round took place: the history entry that names the
	 * interviewer, else a weekly cadence after screening. A round never lands
	 * on or before the one scored ahead of it.
	 */
	function heldOn(person, interviewer, index, previousDay) {
		const firstName = interviewer.split(' ')[0];
		const entry = person.history.find(([, text]) => text.includes(firstName) && !/^(Offer|Referred)/.test(text));
		const day = entry?.[0] || shiftDate(person.reached.screen || person.applied, 3 + 7 * index);
		return previousDay && day <= previousDay ? shiftDate(previousDay, 5) : day;
	}

	publish();
})();
