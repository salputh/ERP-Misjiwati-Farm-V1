/**
 * The company directory: one record for every business on Fieldline's
 * books, shown on Companies (companies.html), Company Details
 * (company-details.html), Contacts, Contact Details and Activities.
 *
 * Nothing here is typed twice. Paying and trialing accounts come from
 * accounts.js, new-business deals from deals.js, so names, plans, seats,
 * owners, people and dates agree wherever a company appears. Only the
 * businesses that have canceled are written out below. Both of those
 * files must load first; members.js, loaded after, adds the people who
 * sign in to each company.
 *
 * Every company sits at one stage:
 *   customer   an account in accounts.js, or a new deal marked signed
 *   prospect   a trial account, or an open or lost new-business deal
 *   former     a business that paid once and canceled
 *
 * Published as window.Basalt.data.companies:
 *   stages     label and pill tone per stage
 *   roles      one line on each role a person can hold
 *   list()     every company, as a fresh copy
 *   find(id)   a company by id or by one of its deal numbers, else null
 *   roleOf(p)  Owner, Billing, Admin, Member or Contact for an account person
 */
(() => {
	'use strict';

	const accounts = window.Basalt.data && window.Basalt.data.accounts;
	const pipeline = window.Basalt.data && window.Basalt.data.deals;
	if (!(accounts && pipeline)) return;

	const STAGE_PILLS = {
		customer: { name: 'Customer', tone: 'success' },
		prospect: { name: 'Prospect', tone: 'info' },
		former: { name: 'Former', tone: 'neutral' },
	};

	/* Owner, Billing, Admin and Member all sign in to Fieldline. A Contact
     never does; they are simply the person we speak with. */
	const ROLE_NOTES = {
		Owner: 'Pays for Fieldline and owns the account.',
		Billing: 'Gets the invoices and pays them.',
		Admin: 'Runs the workspace: people, settings and sign-in.',
		Member: 'Signs in and uses Fieldline every day.',
		Contact: 'Doesn’t sign in. We talk to them about the account.',
	};

	/* An account person's sales role, translated into a workspace role.
     Decision makers approve the purchase but rarely sign in. */
	const ROLE_BY_SALES_ROLE = {
		billing: 'Billing',
		admin: 'Admin',
		champion: 'Member',
		decision: 'Contact',
	};

	/* States grouped by the sales region that covers them. */
	const STATES_BY_REGION = {
		Northeast: ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA'],
		Midwest: ['OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'IA', 'MO', 'ND', 'SD', 'NE', 'KS'],
		South: ['DE', 'MD', 'DC', 'VA', 'WV', 'NC', 'SC', 'GA', 'FL', 'KY', 'TN', 'AL', 'MS', 'AR', 'LA', 'OK', 'TX'],
		West: ['MT', 'ID', 'WY', 'CO', 'NM', 'AZ', 'UT', 'NV', 'CA', 'OR', 'WA', 'AK', 'HI'],
	};

	/* Deal numbers of the new-business deals, grouped by the trade of the
     company behind each one. Anything missing counts as home care. */
	const TRADES = {
		homecare: ['#2041', '#2038', '#2036', '#2043', '#2047', '#2050', '#2034', '#2025'],
		property: ['#2031', '#2040', '#2045', '#2014'],
		petcare: ['#2033', '#2037', '#2018'],
		moving: ['#2046', '#2012'],
		photography: ['#2035', '#2048', '#2044'],
		landscaping: ['#2039', '#2020'],
		cleaning: ['#2042', '#2049', '#2022'],
	};

	/* Deal history is drawn with an icon; these icons mean a conversation
     with the customer, and the rest read as internal updates. */
	const TOUCH_BY_ICON = { envelope: 'email', calendar: 'meeting', display: 'meeting' };

	/* Canceled customers. The plan and seat count are as they stood on
     the final day; their yearly worth is worked out from those. */
	const CANCELED = [
		{
			id: 'stonebridge',
			name: 'Stonebridge Capital',
			trade: 'homecare',
			owner: 'Tony Aldridge',
			city: 'Youngstown, OH',
			site: 'stonebridgecapital.com',
			plan: 'growth',
			seats: 14,
			since: '2023-04-11',
			left: '2026-04-11',
			reason: 'Moved to a cheaper tool',
			people: [
				{ name: 'Helen Pryce', title: 'Registered manager' },
				{ name: 'Gerald Clarke', title: 'Office manager' },
			],
			log: [
				{
					on: '2026-04-11',
					by: 'Tony Aldridge',
					kind: 'update',
					text: 'The subscription ended. Sent Helen the export of their visits.',
				},
				{
					on: '2026-03-02',
					by: 'Helen Pryce',
					kind: 'email',
					with: 'Helen Pryce',
					text: 'Gave notice: moving to a cheaper tool to cut costs.',
				},
				{
					on: '2026-02-10',
					by: 'Tony Aldridge',
					kind: 'call',
					with: 'Helen Pryce',
					text: 'Offered fewer seats at the renewal to bring the price down.',
				},
			],
		},
		{
			id: 'maplefield',
			name: 'Maplefield Movers',
			trade: 'moving',
			owner: 'Quentin Cook',
			city: 'Lewiston, ME',
			site: 'maplefieldmovers.com',
			plan: 'starter',
			seats: 9,
			since: '2024-06-03',
			left: '2026-06-03',
			reason: 'Closed the business',
			people: [{ name: 'Glen Hutchins', title: 'Owner' }],
			log: [
				{
					on: '2026-06-03',
					by: 'Quentin Cook',
					kind: 'update',
					text: 'The subscription ended on the renewal day.',
				},
				{
					on: '2026-05-12',
					by: 'Glen Hutchins',
					kind: 'call',
					with: 'Glen Hutchins',
					text: 'Retiring and closing the firm at the end of May.',
				},
			],
		},
		{
			id: 'costaluz',
			name: 'McKay Orr Photography',
			trade: 'photography',
			owner: 'Elise Vick',
			city: 'Rockford, IL',
			site: 'mckayorrphoto.com',
			plan: 'growth',
			seats: 7,
			since: '2025-01-20',
			left: '2026-07-20',
			reason: 'Joined a bigger studio',
			people: [{ name: 'Gwen Newman', title: 'Studio director' }],
			log: [
				{
					on: '2026-07-20',
					by: 'Elise Vick',
					kind: 'update',
					text: 'The subscription ended. Their shoots moved to the new studio’s tools.',
				},
				{
					on: '2026-06-24',
					by: 'Gwen Newman',
					kind: 'email',
					with: 'Gwen Newman',
					text: 'The studio is joining a bigger group that has its own booking tool.',
				},
			],
		},
	];

	const regionOfState = invert(STATES_BY_REGION);
	const tradeOfDeal = invert(TRADES);

	/* Accounts first, then deals for businesses not yet on the books,
     then the canceled ones. Pages depend on this order. */
	const directory = [
		...accounts.list().map(fromAccount),
		...pipeline
			.list()
			.filter((deal) => !deal.customer)
			.map(fromDeal),
		...CANCELED.map(fromCanceled),
	];

	window.Basalt.data.companies = {
		stages: STAGE_PILLS,
		roles: ROLE_NOTES,
		list: () => withSignIns(directory.map(deepCopy)),
		find: lookup,
		roleOf: workspaceRole,
	};

	/**
	 * A company by its own id, or the company whose deal carries that
	 * number. Returns a copy that includes its signed-in members.
	 * @param {string} id
	 * @returns {object|null}
	 */
	function lookup(id) {
		if (!id) return null;
		const wanted = directory.find((entry) => entry.id === id || entry.deals.some((deal) => deal.id === id));
		if (!wanted) return null;
		return withSignIns([deepCopy(wanted)])[0];
	}

	/**
	 * The workspace role of a person on an account. The main contact owns
	 * the account; anyone else follows their sales role.
	 * @param {{main?: boolean, role?: string}} person
	 * @returns {string}
	 */
	function workspaceRole(person) {
		return person.main ? 'Owner' : ROLE_BY_SALES_ROLE[person.role] || 'Contact';
	}

	/* Record builders, one for each place a company can come from. Every
     record lists its fields in the same order: identity, place, terms,
     money, dates, then people, deals and the activity log. */

	function fromAccount(account) {
		const onTrial = account.status === 'trial';
		const nameOfKey = (key) => account.people.find((person) => person.key === key)?.name;
		return {
			id: account.id,
			kind: 'account',
			stage: onTrial ? 'prospect' : 'customer',
			status: account.status,
			name: account.name,
			trade: account.trade,
			city: account.city,
			region: account.region,
			site: account.site,
			owner: account.owner,
			plan: account.plan,
			seats: account.seats,
			health: account.health,
			yearly: Math.round(accounts.mrr(account) * 12),
			worth: Math.round(accounts.listMrr(account) * 12),
			since: account.since,
			renews: account.renews,
			statusOn: account.statusOn || null,
			people: account.people.map((person) => ({
				name: person.name,
				title: person.title,
				role: workspaceRole(person),
				email: person.email,
				phone: person.phone || '',
				key: person.key,
			})),
			deals: account.deals.map((deal) => ({
				name: deal.name,
				stage: deal.stage,
				value: deal.value,
				closes: deal.closes,
				href: `deal-details.html?id=${encodeURIComponent(accounts.slug(deal.name))}`,
			})),
			activity: account.activity.map(([on, by, text, kind, keys]) => [
				on,
				by,
				text,
				kind,
				(keys || []).map(nameOfKey).filter(Boolean).join(' and '),
			]),
		};
	}

	function fromDeal(deal) {
		const won = deal.stage === 'signed';
		const contact = deal.people[0];
		const closes = deal.lost || deal.closes;
		return {
			id: accounts.slug(deal.company),
			kind: 'deal',
			stage: won ? 'customer' : 'prospect',
			status: deal.stage,
			name: deal.company,
			trade: tradeOfDeal[deal.id] || 'homecare',
			city: deal.city,
			region: regionOfState[stateOf(deal.city)] || 'Northeast',
			site: contact.email.split('@')[1],
			owner: deal.owner,
			plan: deal.plan,
			seats: deal.seats,
			health: null,
			yearly: won ? deal.value : 0,
			worth: deal.value,
			since: won ? deal.signed : deal.created,
			renews: won ? oneYearOn(deal.closes) : null,
			closes,
			reason: deal.reason || '',
			source: deal.source,
			today: deal.today || '',
			next: deal.next ? deal.next[0] : deal.afterWin || '',
			people: deal.people.map((person) => ({
				name: person.name,
				title: person.title,
				role: 'Contact',
				part: person.part,
				email: person.email,
				phone: '',
				key: accounts.personKey(person.name),
			})),
			deals: [
				{
					id: deal.id,
					name: deal.title,
					stage: deal.stage,
					value: deal.value,
					closes,
					quote: deal.quote || null,
					href: `deal-details.html?id=${encodeURIComponent(deal.id)}`,
				},
			],
			activity: deal.history.map(([on, by, text, icon]) => {
				const touch = TOUCH_BY_ICON[icon];
				return [on, by, text, touch || 'update', touch ? contact.name : ''];
			}),
		};
	}

	function fromCanceled(record) {
		const { plan, seats, site } = record;
		return {
			id: record.id,
			kind: 'former',
			stage: 'former',
			status: 'former',
			name: record.name,
			trade: record.trade,
			city: record.city,
			region: regionOfState[stateOf(record.city)] || 'Midwest',
			site,
			owner: record.owner,
			plan,
			seats,
			health: null,
			yearly: 0,
			worth: accounts.plans[plan].price * 10 * seats,
			since: record.since,
			left: record.left,
			reason: record.reason,
			people: record.people.map(({ name, title }) => ({
				name,
				title,
				role: 'Contact',
				email: `${accounts.slug(name.split(' ')[0])}@${site}`,
				phone: '',
				key: null,
			})),
			deals: [],
			activity: record.log.map((entry) => [entry.on, entry.by, entry.text, entry.kind, entry.with || '']),
		};
	}

	/* Members who sign in without being a sales contact are kept in
     members.js. When that file is on the page, each company gains its
     members after the people it already lists. */

	/**
	 * Appends signed-in members to each company's people, skipping anyone
	 * already listed. Changes the given companies and returns the array.
	 * @param {object[]} companies
	 * @returns {object[]}
	 */
	function withSignIns(companies) {
		const roster = window.Basalt.data.members;
		if (!roster) return companies;
		const everyone = roster.list();
		for (const business of companies) {
			const listed = new Set(business.people.map((person) => person.key));
			for (const member of everyone) {
				if (member.acct !== business.id || listed.has(member.key)) continue;
				listed.add(member.key);
				business.people.push({
					name: member.name,
					title: member.title,
					role: member.role.replace(/^./, (letter) => letter.toUpperCase()),
					email: member.email,
					phone: '',
					key: member.key,
				});
			}
		}
		return companies;
	}

	/* Small helpers. */

	/** Turns { group: [keys] } into { key: group }. */
	function invert(groups) {
		const index = {};
		for (const [group, items] of Object.entries(groups)) {
			for (const key of items) index[key] = group;
		}
		return index;
	}

	/** The state code at the end of a "City, ST" label. */
	function stateOf(place) {
		return place.split(', ').pop();
	}

	/** The same ISO date a year later. */
	function oneYearOn(iso) {
		return `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
	}

	function deepCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}
})();
