/**
 * The people directory behind Fieldline's sales side: everyone at a
 * customer, trial or prospect company, merged into one alphabetical
 * list whether they buy from us, use the product, or both. Read by
 * people-at-companies.html and person-details.html, and through companies.js by
 * companies.html and company-details.html.
 *
 * No person is described twice. Names, titles and phone numbers are taken
 * from accounts.js (customers and trials) and deals.js (prospects and
 * fresh signings), and the workspace role from companies.js, so Company
 * Details and Person Details always agree. This file only contributes
 * how people sign in, plus the product users who are never a sales
 * contact. All three of those scripts have to load before this one.
 *
 * window.Basalt.data.members
 *   roles      { owner, billing, admin, member, contact }, each
 *              { label, short, tone, about }
 *   list()     a fresh copy of every person, sorted by name
 *   find(key)  a fresh copy of one person, or null
 *
 *   person   { key, name, title, email, phone, mobile, hours, note,
 *              acct (accounts.js id, or null), companyId (the id for
 *              company-details.html), company, city, region, tz,
 *              kind: customer | trial | new | prospect, role,
 *              login (null for contacts), since, deals }
 *   login    { how: sso | password, twoStep, last ('YYYY-MM-DD HH:MM'
 *              in UTC, or null), invited, accepted (null until accepted) }
 *   deal     { id, title, stage, part, quote }
 */
(() => {
	'use strict';

	const { accounts: ledger, deals: pipeline, companies: firms } = window.Basalt.data;

	/* The five workspace roles in the order the filters list them. The
     tone picks which chart color the role pill wears. */
	const roleGuide = {
		owner: {
			short: 'Owner',
			label: 'Owner — pays',
			about: 'Owns the account and pays for it. Can do everything.',
			tone: 1,
		},
		billing: {
			short: 'Billing',
			label: 'Billing',
			about: 'Sees invoices, changes the card and buys add-ons.',
			tone: 4,
		},
		admin: { short: 'Admin', label: 'Admin', about: 'Adds people, changes settings and sets up sign-in.', tone: 3 },
		member: {
			short: 'Member',
			label: 'Member',
			about: 'Uses Fieldline day to day: the schedule and visits.',
			tone: 2,
		},
		contact: {
			short: 'Contact',
			label: 'Contact',
			about: 'Someone you talk to who doesn’t sign in to Fieldline.',
			tone: 6,
		},
	};

	/* Sign-in details for account people, filed under the method they
     use (larger customers go through their own single sign-on). Each
     entry reads [two-step on, last seen in UTC, invited, accepted], and
     accepted is left off when it fell on the invite day. A person with
     no entry is a contact who never signs in. */
	const signInsByMethod = {
		sso: {
			'hailey-zimmerman': [true, '2026-10-06 11:06', '2022-11-02'],
			'dean-whitfield': [true, '2026-10-07 10:30', '2023-02-14'],
			'ruth-boyle': [true, '2026-09-29 14:35', '2024-01-08'],
			'trent-bishop': [true, '2026-10-06 09:46', '2022-05-02'],
			'connie-nandakumar': [true, '2026-10-05 07:29', '2022-05-02'],
			'lyle-reeves': [true, '2026-10-07 12:09', '2022-05-02'],
			'connie-sexton': [true, '2026-10-08 10:57', '2020-12-08'],
			'marie-tremblay': [true, '2026-09-28 10:33', '2020-12-08'],
			'joel-fowler': [true, '2026-10-04 09:10', '2020-12-08'],
			'rachel-beck': [true, '2026-10-07 14:00', '2022-06-30'],
			'andre-mills': [true, '2026-10-06 11:26', '2022-06-30'],
			'pamela-rudd': [true, '2026-09-29 14:27', '2022-06-30'],
			'courtney-whitman': [true, '2026-10-08 14:04', '2022-09-19'],
			'neil-osborne': [true, '2026-10-08 08:18', '2022-09-19'],
			'jacob-becker': [true, '2026-10-04 13:54', '2022-12-06'],
			'dawn-harrell': [true, '2026-09-26 14:38', '2022-12-06'],
			'yui-takeda': [true, '2026-10-06 13:46', '2023-03-01'],
		},
		password: {
			'addison-brennan': [true, '2026-10-05 10:10', '2024-11-20'],
			'chester-doyle': [true, '2026-09-29 14:58', '2024-11-20'],
			'mae-morrow': [true, '2026-10-03 10:13', '2023-07-10'],
			'gerald-gallagher': [false, null, '2026-10-06', null],
			'jordan-pike': [false, '2026-10-05 09:09', '2024-10-29'],
			'sasha-klein': [false, null, '2026-10-03', null],
			'denise-quigley': [true, '2026-10-04 09:21', '2024-06-03'],
			'travis-teague': [true, '2026-10-03 08:53', '2024-06-03'],
			'leslie-price': [true, '2026-09-29 08:36', '2024-09-26'],
			'fred-andrews': [false, '2026-09-23 12:08', '2024-09-26'],
			'gail-lowe': [true, '2026-09-25 10:05', '2024-09-26'],
			'leon-marsh': [true, '2026-10-08 10:40', '2025-11-02'],
			'kerry-wade': [true, '2026-10-05 14:19', '2025-11-02'],
			'carl-jensen': [true, '2026-10-06 10:26', '2023-09-18'],
			'amy-combs': [false, '2026-10-06 10:15', '2023-09-18'],
			'martha-tate': [false, '2026-10-07 12:07', '2025-01-20'],
			'rory-whitcombe': [true, '2026-10-07 13:51', '2025-01-20'],
			'bill-hargrove': [true, '2026-10-03 14:51', '2024-05-22'],
			'tasha-reid': [false, '2026-10-05 11:01', '2024-05-22'],
			'derrick-yost': [true, '2026-10-07 09:12', '2024-11-11'],
			'li-wen-tan': [true, '2026-09-27 12:44', '2024-11-11'],
			'randall-hatcher': [true, '2026-10-03 11:28', '2024-07-25'],
			'lori-padgett': [true, '2026-10-08 13:53', '2024-07-25'],
			'ian-macleod': [false, '2026-10-07 07:09', '2025-02-27'],
			'cheryl-halden': [true, '2026-10-04 12:39', '2025-04-09'],
			'marvin-dahl': [false, '2026-10-07 13:10', '2025-04-09'],
			'angela-ashby': [true, '2026-10-08 07:01', '2023-12-09'],
			'tom-vance': [false, '2026-10-04 13:08', '2023-12-09'],
			'robyn-duffy': [true, '2026-09-27 07:16', '2023-12-09'],
			'paul-hendry': [true, '2026-10-06 07:21', '2025-03-03'],
			'jess-moana': [true, '2026-09-28 09:47', '2025-03-03'],
			'carrie-rankin': [true, '2026-10-08 08:00', '2025-11-28'],
			'alan-gates': [true, '2026-10-05 07:24', '2025-11-28'],
			'floyd-snyder': [true, '2026-10-06 10:24', '2024-09-19'],
			'valeria-munoz': [true, '2026-09-29 13:27', '2024-09-19'],
			'jean-ross': [true, '2026-10-04 09:55', '2025-07-14'],
			'cameron-fraser': [false, '2026-10-05 09:21', '2025-07-14'],
			'curtis-rowe': [true, '2026-10-08 11:26', '2022-10-11'],
			'nina-roe': [true, '2026-09-27 11:54', '2022-10-11'],
			'gerald-pruitt': [true, '2026-10-05 10:07', '2025-02-17'],
			'wade-collins': [false, '2026-09-21 12:29', '2025-10-31'],
			'pieter-van-den-dahl': [true, '2026-10-03 12:27', '2023-01-23'],
			'sanne-de-vries': [false, '2026-10-03 10:29', '2023-01-23'],
			'camille-roux': [true, '2026-09-22 10:04', '2025-10-03'],
			'erik-lawson': [true, '2026-10-03 11:39', '2023-11-02'],
			'marilyn-lynch': [true, '2026-10-05 10:52', '2024-02-26'],
			'dawn-zeller': [true, '2026-10-04 07:22', '2024-03-04'],
			'jamal-zeller': [true, '2026-10-06 14:39', '2024-02-11'],
			'shawn-norton': [true, '2026-10-08 12:10', '2025-05-16'],
			'earl-rudd': [true, '2026-10-07 11:18', '2025-04-11'],
			'dale-larsen': [false, '2026-10-08 14:30', '2022-10-26'],
			'peter-hughes': [false, '2026-10-08 10:11', '2025-10-05'],
			'conor-alder': [true, '2026-10-07 08:44', '2026-10-05'],
			'nia-edwards': [true, '2026-10-08 14:35', '2026-09-27'],
			'forrest-decker': [true, '2026-10-08 13:10', '2026-09-29'],
			'ann-lyons': [true, '2026-10-08 10:53', '2026-09-30'],
			'ray-downing': [true, '2026-10-07 07:09', '2026-10-01'],
		},
	};

	/* Product users who are nobody's sales contact, grouped by the
     account they belong to: [name, title, role, method, two-step,
     last seen, invited, accepted], accepted again optional. Their
     address is their first name at the company's domain. */
	const productUsersByAccount = {
		lumoraai: [
			['Kirk Mathis', 'Team lead', 'member', 'sso', true, '2026-10-08 13:42', '2023-05-08'],
			['Ellie Burke', 'Scheduler', 'member', 'sso', true, '2026-10-08 14:05', '2024-03-18', '2024-03-19'],
		],
		oakhaven: [['Hope Stout', 'Scheduler', 'member', 'sso', true, '2026-10-07 12:20', '2023-01-09']],
		highpoint: [['Merritt Lowry', 'Team lead', 'member', 'sso', true, '2026-10-08 09:15', '2021-04-12']],
		copperleaf: [
			['Tia Walker', 'Scheduler', 'member', 'password', false, '2026-09-30 08:40', '2024-10-02', '2024-10-03'],
		],
		brightline: [['Ben Archer', 'Studio scheduler', 'admin', 'password', true, '2026-10-08 06:10', '2023-10-02']],
		bluepeak: [
			['Jill Roe', 'Lead photographer', 'member', 'sso', true, '2026-10-06 16:25', '2022-07-13', '2022-07-14'],
		],
		millrace: [['Derek Russo', 'Team lead', 'member', 'password', true, '2026-10-08 11:02', '2024-01-15']],
		halden: [['Ola Nygaard', 'Team lead', 'member', 'password', false, '2026-10-05 07:48', '2025-04-14']],
		valleypetcare: [['Brad Bowman', 'Scheduler', 'member', 'password', true, '2026-10-08 08:30', '2023-02-06']],
		rainier: [
			['Kelsey Krause', 'Care planner', 'member', 'sso', true, '2026-10-08 07:55', '2023-01-18', '2023-01-19'],
		],
		tamara: [['Keith Mack', 'Care coordinator', 'member', 'sso', true, '2026-10-08 02:10', '2023-03-08']],
		harborline: [['Ruby Gill', 'Office scheduler', 'member', 'sso', true, null, '2026-10-07', null]],
		alder: [['Siobhan Alder', 'Office manager', 'admin', 'password', true, '2026-10-08 09:30', '2026-10-05']],
	};

	/* Prospect cities by region and IANA zone, so Person Details can
     show a prospect's local time. A city missing here falls back to
     the US east coast. */
	const zonesByRegion = {
		Northeast: {
			'America/New_York': ['Stamford, CT', 'Syracuse, NY', 'Pittsburgh, PA'],
		},
		Midwest: {
			'America/New_York': ['Cincinnati, OH', 'Columbus, OH', 'Dayton, OH'],
			'America/Detroit': ['Marquette, MI'],
			'America/Chicago': [
				'Dubuque, IA',
				'Duluth, MN',
				'La Crosse, WI',
				'Mankato, MN',
				'Minot, ND',
				'Omaha, NE',
				'Peoria, IL',
				'Rockford, IL',
				'Topeka, KS',
			],
		},
		South: {
			'America/New_York': [
				'Asheville, NC',
				'Atlanta, GA',
				'Charleston, SC',
				'Durham, NC',
				'Key West, FL',
				'Macon, GA',
				'Raleigh, NC',
			],
			'America/Chicago': ['Hattiesburg, MS', 'Memphis, TN', 'Tulsa, OK'],
		},
		West: {
			'America/Denver': ['Salt Lake City, UT', 'Provo, UT', 'Boulder, CO', 'Fort Collins, CO', 'Cheyenne, WY'],
			'America/Boise': ['Boise, ID'],
			'America/Phoenix': ['Tucson, AZ'],
			'America/Los_Angeles': [
				'Tacoma, WA',
				'Sacramento, CA',
				'Fresno, CA',
				'Olympia, WA',
				'Bellingham, WA',
				'Chico, CA',
				'Santa Cruz, CA',
			],
		},
	};
	const fallbackPlace = { region: 'Northeast', tz: 'America/New_York' };

	/* The workday given to anyone with none on file: prospects and
     product-only users. */
	const standardHours = [8, 17];

	const directory = [];

	/** Builds the directory once, then publishes the lookups pages call. */
	function start() {
		const signIns = indexSignIns();
		const places = indexPlaces();
		const allDeals = pipeline.list();

		for (const account of ledger.list()) {
			directory.push(...accountPeople(account, allDeals, signIns));
		}
		for (const deal of allDeals) {
			if (!deal.customer) directory.push(...prospectPeople(deal, places));
		}
		directory.sort((first, second) => first.name.localeCompare(second.name));

		window.Basalt.data.members = {
			roles: roleGuide,
			list: () => directory.map((person) => detach(person)),
			find(key) {
				const hit = directory.find((person) => person.key === key);
				return hit ? detach(hit) : null;
			},
		};
	}

	/* Customers and trials: their listed contacts first, then the product
     users nobody sells to. */

	/**
	 * Everyone at one account, in the order they should tie when sorted.
	 * @param {object} account  an accounts.js record
	 * @param {object[]} allDeals  every deal from deals.js
	 * @param {Map<string, object>} signIns  login records by person key
	 * @returns {object[]}
	 */
	function accountPeople(account, allDeals, signIns) {
		const where = {
			acct: account.id,
			companyId: account.id,
			company: account.name,
			city: account.city,
			region: account.region,
			tz: account.tz,
			kind: account.status === 'trial' ? 'trial' : 'customer',
		};
		const ownDeals = allDeals.filter((deal) => deal.acct === account.id);
		const extras = Object.hasOwn(productUsersByAccount, account.id) ? productUsersByAccount[account.id] : [];

		const listed = account.people.map((person) => ({
			key: person.key,
			name: person.name,
			title: person.title,
			email: person.email,
			phone: person.phone || '',
			mobile: person.mobile || '',
			note: person.note || '',
			hours: person.hours,
			...where,
			role: firms.roleOf(person).toLowerCase(),
			login: signIns.get(person.key) ?? null,
			since: person.since || account.since,
			deals: dealsNaming(person.key, ownDeals),
		}));

		const seatHolders = extras.map(([name, title, role, how, ...details]) => {
			const login = toLogin(how, details);
			return {
				key: ledger.personKey(name),
				name,
				title,
				email: `${name.split(' ')[0].toLowerCase()}@${account.site}`,
				...noContactDetails(),
				...where,
				role,
				login,
				since: login.invited,
				deals: [],
			};
		});

		return [...listed, ...seatHolders];
	}

	/**
	 * The deals at an account that list this person, each with the part
	 * they play in it.
	 * @param {string} key
	 * @param {object[]} ownDeals
	 * @returns {object[]}
	 */
	function dealsNaming(key, ownDeals) {
		const named = [];
		for (const deal of ownDeals) {
			const seat = deal.people.find((member) => member.key === key);
			if (seat) named.push(dealCard(deal, seat.part));
		}
		return named;
	}

	/* Companies still in the pipeline (or just signed) have contacts only:
     nobody there signs in until their workspace exists. */

	/**
	 * The people named on one deal for a company that is not a customer yet.
	 * @param {object} deal
	 * @param {Map<string, object>} places  region and zone by city
	 * @returns {object[]}
	 */
	function prospectPeople(deal, places) {
		const { region, tz } = places.get(deal.city) ?? fallbackPlace;
		return deal.people.map((person) => ({
			key: ledger.personKey(person.name),
			name: person.name,
			title: person.title,
			email: person.email,
			...noContactDetails(),
			acct: null,
			companyId: deal.id,
			company: deal.company,
			city: deal.city,
			region,
			tz,
			kind: deal.stage === 'signed' ? 'new' : 'prospect',
			role: 'contact',
			login: null,
			since: deal.created,
			deals: [dealCard(deal, person.part)],
		}));
	}

	/* Small builders shared by both kinds of company. */

	/** Phone, mobile and note left blank, with the standard workday. */
	function noContactDetails() {
		return { phone: '', mobile: '', note: '', hours: [...standardHours] };
	}

	/**
	 * The slice of a deal a person record carries.
	 * @param {object} deal
	 * @param {string} part  what this person does on the deal
	 */
	function dealCard(deal, part) {
		return { id: deal.id, title: deal.title, stage: deal.stage, quote: deal.quote || null, part };
	}

	/**
	 * Turns a stored sign-in row into the published login shape.
	 * @param {'sso'|'password'} how
	 * @param {Array} details  [two-step, last seen, invited, accepted?]
	 */
	function toLogin(how, [twoStep, last, invited, accepted = invited]) {
		return { how, twoStep, last, invited, accepted };
	}

	/** Flattens the per-method sign-in table into one lookup by person. */
	function indexSignIns() {
		const byPerson = new Map();
		for (const [how, people] of Object.entries(signInsByMethod)) {
			for (const [key, details] of Object.entries(people)) byPerson.set(key, toLogin(how, details));
		}
		return byPerson;
	}

	/** Turns the region and zone table into one lookup by city. */
	function indexPlaces() {
		const byCity = new Map();
		for (const [region, zones] of Object.entries(zonesByRegion)) {
			for (const [tz, cities] of Object.entries(zones)) {
				for (const city of cities) byCity.set(city, { region, tz });
			}
		}
		return byCity;
	}

	/** A deep copy, so a page can change what it gets without touching the source. */
	function detach(person) {
		return JSON.parse(JSON.stringify(person));
	}

	start();
})();
