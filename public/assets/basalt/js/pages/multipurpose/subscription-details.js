/**
 * The page for a single Fieldline subscription, used by
 * subscription-details.html. It shows what the customer pays for, the
 * term and its renewal, seat use over time, the account's billing facts,
 * recent invoices and a running history, and it lets the plan be changed
 * without leaving the page: a change can wait for the renewal or start
 * today, in which case the unused part of the term is charged or credited.
 *
 * Which subscription is shown comes from ?id=, the link each row of
 * subscriptions.html carries; with no id, Lumora AI is shown. The
 * records are built exactly as that list builds them (the shared accounts
 * from assets/basalt/js/data/multipurpose/accounts.js, then a seeded batch of everyday ones),
 * so a row and this page never disagree. Shared accounts also bring their
 * own bills and seat history; the rest derive theirs from the record. A
 * live product would fetch all of this from GET /api/subscriptions/:id.
 */
(() => {
	'use strict';

	/* Prices per seat each month, matching subscriptions.js. A yearly bill
     charges ten months and gives twelve. */
	const TIERS = {
		starter: { label: 'Basic', seatRate: 15, glyph: 'bi-send' },
		growth: { label: 'Pro', seatRate: 32, glyph: 'bi-rocket-takeoff' },
		enterprise: { label: 'Max', seatRate: 58, glyph: 'bi-buildings' },
	};
	const TIER_ORDER = Object.keys(TIERS);
	const EXTRAS = {
		route: { label: 'Travel Planner', rate: 6 },
		portal: { label: 'Customer Portal', rate: 4 },
	};
	/* Texts come in packs of a thousand a month, at most ten packs. */
	const SMS_PACK_PRICE = 25;
	const SMS_PACK_LIMIT = 10;

	/* The fixed "now" of the demo, who is signed in, and how large the
     generated batch must come out: 2,140 paying accounts bringing in about
     $880k a month, plus 64 open trials. A real page reads the clock. */
	const FIXTURE = {
		now: '2026-10-09',
		operator: 'John Armstrong',
		tierGoals: {
			starter: { headcount: 1190, monthly: 158000 },
			growth: { headcount: 790, monthly: 361000 },
			enterprise: { headcount: 160, monthly: 361000 },
		},
		openTrials: 64,
	};
	const NOW_ISO = FIXTURE.now;

	const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
	const currentYear = parseIso(NOW_ISO).getFullYear();
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Words the everyday batch is assembled from. The lists, their order and
     the seed are what make the batch the same on every visit. */
	const TOWN_WORDS = [
		'Alder',
		'Amber',
		'Aspen',
		'Bayside',
		'Beacon',
		'Birch',
		'Blackrock',
		'Bluewater',
		'Bridgewater',
		'Brookside',
		'Canyon',
		'Spillway',
		'Clearview',
		'Coastline',
		'Copper',
		'Crestline',
		'Driftwood',
		'Eastgate',
		'Elmwood',
		'Evergreen',
		'Fairway',
		'Merlin',
		'Fernhill',
		'Firstline',
		'Glacier',
		'Golden Gate',
		'Hawthorn',
		'Highland',
		'Horizon',
		'Juniper',
		'Keystone',
		'Lakeshore',
		'Larkspur',
		'Lighthouse',
		'Meadow',
		'Millstone',
		'Eastgale',
		'Oakridge',
		'Orchard',
		'Osprey',
		'Pacific',
		'Parkside',
		'Pioneer',
		'Redwood',
		'Ridgeline',
		'Riverside',
		'Rockport',
		'Sandstone',
		'Silverline',
		'Southgate',
		'Spruce',
		'Stonebridge',
		'Sunrise',
		'Timberline',
		'Trident',
		'Union',
		'Valley',
		'Westfield',
		'Wildflower',
		'Sorrel',
		'Windmill',
		'Yellowpine',
	];
	const FAMILY_NAMES = [
		'Abbott',
		'Aldridge',
		'Bauer',
		'Ellery',
		'Brennan',
		'Callahan',
		'McKay',
		'Dawson',
		'Doyle',
		'Dillon',
		'Eriksen',
		'Fischer',
		'Fletcher',
		'Odom',
		'Merritt',
		'Hale',
		'Hayes',
		'Hughes',
		'Jensen',
		'Kaur',
		'Keller',
		'Larsen',
		'MacLeod',
		'McCall',
		'Murphy',
		'Freeman',
		'Kerr',
		'Nugent',
		'Olsen',
		'Dixon',
		'Quinn',
		'Roach',
		'Fleming',
		'Stout',
		'Schmidt',
		'Singh',
		'Sullivan',
		'Morrow',
		'Turner',
		'Walsh',
		'Krause',
		'Young',
	];
	const TRADES = [
		'Care',
		'Pet Care',
		'Studios',
		'Home Care',
		'Movers',
		'Property Care',
		'Landscaping',
		'Dog Walking',
		'Pet Sitting',
		'Event Photography',
		'Senior Care',
		'Dog Grooming',
		'Cleaning',
		'Nannies',
		'Lawn & Garden',
		'Carers',
		'Gardens',
		'Portraits',
		'Lawn Care',
		'Concierge',
		'Facilities',
		'Elder Care',
		'Wedding Films',
		'Nursing Care',
		'Walkers',
		'Valeting',
		'Tutoring',
		'Home Help',
		'Tree Care',
		'House Sitting',
	];
	const GIVEN_NAMES = [
		'Adam',
		'Alice',
		'Amira',
		'Ann',
		'Ben',
		'Charles',
		'Mallory',
		'Dan',
		'Elise',
		'Becky',
		'Fred',
		'Hope',
		'Ian',
		'Jean',
		'Barnaby',
		'Jade',
		'Kip',
		'Laura',
		'Chad',
		'Lori',
		'Elaine',
		'Mohammed',
		'Nina',
		'Isaac',
		'Paul',
		'Rachel',
		'Russ',
		'Ruth',
		'Sean',
		'Pamela',
		'Terry',
		'Tess',
		'Will',
		'Jill',
	];

	/* Cities grouped by the web suffix their businesses use. Most take
     .com, a few .net, roughly the spread of Fieldline's real customers. */
	const CITY_GROUPS = Object.entries({
		com: [
			'Plano, TX',
			'Houston, TX',
			'Boulder, CO',
			'Atlanta, GA',
			'Nashville, TN',
			'Charlotte, NC',
			'Minneapolis, MN',
			'Kansas City, MO',
			'Sacramento, CA',
			'Raleigh, NC',
			'Tucson, AZ',
			'Omaha, NE',
			'Pittsburgh, PA',
			'Richmond, VA',
			'Boise, ID',
			'Stamford, CT',
			'Bangor, ME',
			'Buffalo, NY',
			'Scranton, PA',
			'Bismarck, ND',
			'Mankato, MN',
			'Oshkosh, WI',
			'Ann Arbor, MI',
			'Olympia, WA',
			'Chico, CA',
			'Flagstaff, AZ',
			'Little Rock, AR',
		],
		net: [
			'Duluth, MN',
			'Dubuque, IA',
			'Peoria, IL',
			'Des Moines, IA',
			'Kearney, NE',
			'Santa Rosa, CA',
			'Durham, NC',
		],
	}).flatMap(([suffix, cities]) => cities.map((city) => ({ city, suffix })));

	/* How each tier's generated accounts tend to look: a seat range and the
     odds of yearly billing and of each add-on. */
	const TIER_PROFILES = {
		starter: { seatsLow: 2, seatsHigh: 14, yearlyOdds: 0.3, routeOdds: 0, portalOdds: 0.1, smsOdds: 0.25 },
		growth: { seatsLow: 5, seatsHigh: 26, yearlyOdds: 0.45, routeOdds: 0.3, portalOdds: 0.25, smsOdds: 0.25 },
		enterprise: { seatsLow: 18, seatsHigh: 52, yearlyOdds: 0.7, routeOdds: 0.55, portalOdds: 0.45, smsOdds: 0.3 },
	};

	/* Status words and tones, the same ones the list prints. */
	const STATUS_LOOK = {
		active: ['Active', 'success'],
		risk: ['At risk', 'warning'],
		trial: ['Trial', 'info'],
		pastdue: ['Past due', 'danger'],
		canceling: ['Canceling', ''],
	};
	const BILL_LOOK = {
		paid: ['Paid', 'success'],
		due: ['Due', 'warning'],
		unpaid: ['Unpaid', 'danger'],
		credit: ['Credit', 'info'],
		next: ['Upcoming', ''],
	};
	const HISTORY_ICONS = {
		start: 'bi-flag',
		seats: 'bi-people',
		plan: 'bi-arrow-up-right-circle',
		addon: 'bi-plus-square',
		renew: 'bi-arrow-repeat',
		fail: 'bi-exclamation-octagon',
		quote: 'bi-file-earmark-text',
		edit: 'bi-sliders',
		cancel: 'bi-calendar-x',
		keep: 'bi-arrow-counterclockwise',
	};
	const EXTRA_ICONS = { route: 'bi-signpost-split', portal: 'bi-globe2' };
	const EXTRA_SHORT_NAMES = { route: 'Travel', portal: 'Portal' };

	/* Filled once by mount(): the page, the subscription it opened, what was
     derived from it, and what has been changed here since. */
	let pageRoot = null;
	let subscription = null;
	let derived = null;
	let customer = null;
	let session = null;
	let greetingName = '';
	let serial = 0;
	let chartHost = null;
	let chartGeometry = null;
	let chartHasRendered = false;
	let editor = null;
	let cancelDialog = null;
	let endDialog = null;

	start();

	/** Finds the subscription, builds its view and wires every control. */
	function start() {
		pageRoot = pick('[data-sd-root]');
		if (!pageRoot) return;

		const everyone = collectSubscriptions();
		const requested = new URLSearchParams(location.search).get('id');
		subscription =
			everyone.find((entry) => entry.id === requested) || everyone.find((entry) => entry.name === 'Lumora AI');
		derived = assemble(subscription, namedAccountStory(subscription));
		customer = derived.customer;
		session = {
			status: subscription.status,
			/* Why it ends: the list's note, or the reason picked when canceling here. */
			reason: subscription.status === 'canceling' ? customer.note : '',
			live: cloneSetup(derived.setup),
			/* What takes effect on the renewal date, and where that came from. */
			queued: cloneSetup(derived.quote ? derived.quote.setup : derived.setup),
			queuedSource: derived.quote ? 'quote' : '',
			reminderSent: false,
			paymentLinkSent: false,
			trialExtended: false,
			bills: derived.bills.slice(),
			history: derived.history.slice(),
			flashInvoice: null,
		};
		greetingName = customer.contact.split(' ')[0];
		serial = Number(customer.id.replace(/\D/g, ''));

		chartHost = hook('chart');
		chartHost.addEventListener('pointermove', showChartPoint);
		chartHost.addEventListener('pointerleave', hideChartPoint);

		prepareEditor();
		prepareCancelDialog();
		pageRoot.addEventListener('click', handlePageClick);

		paintEverything();
		watchChartWidth();
	}

	/* The subscription record is built below, from shared data or the seeded batch. */

	/** Every subscription the list shows: the shared accounts, then the batch. */
	function collectSubscriptions() {
		const named = namedSubscriptions();
		const withDefaults = named.map((entry) => Object.assign({ route: false, portal: false, sms: 0 }, entry));
		const all = withDefaults.concat(generateEverydaySubscriptions(named));
		/* Shared accounts bring their own ids; the batch gets numbered ones. */
		let position = 0;
		for (const entry of all) {
			if (!entry.id) entry.id = `#${10240 + position * 7 + (avatarTone(entry.name) % 7)}`;
			position += 1;
		}
		return all;
	}

	/**
	 * The accounts from assets/basalt/js/data/multipurpose/accounts.js as subscription records.
	 * An active account scoring under 45 is shown as at risk.
	 */
	function namedSubscriptions() {
		return window.Basalt.data.accounts.list().map((account) => {
			const lead = account.people.find((person) => person.main) || account.people[0];
			const flagged = account.status === 'active' && account.health != null && account.health < 45;
			return {
				id: account.sub,
				acct: account.id,
				who: lead.key,
				name: account.name,
				contact: lead.name,
				email: lead.email,
				city: account.city,
				plan: account.plan,
				cycle: 'year',
				seats: account.seats,
				used: account.used,
				route: account.route,
				portal: account.portal,
				sms: account.sms,
				since: account.since,
				next: account.status === 'active' ? account.renews : account.statusOn,
				status: flagged ? 'risk' : account.status,
				note: account.note || '',
			};
		});
	}

	/** A repeatable 0-to-1 number source, so the batch never changes. */
	function seededRandom(seed) {
		let cursor = seed;
		return () => {
			cursor = (cursor + 0x6d2b79f5) | 0;
			let mixed = Math.imul(cursor ^ (cursor >>> 15), 1 | cursor);
			mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/**
	 * The seeded everyday accounts around the shared ones. Each tier is filled
	 * up to its headcount, the remaining trials are added, and then seats are
	 * nudged until each tier's monthly total lands on its goal, so every sum
	 * the list prints adds up from its rows.
	 */
	function generateEverydaySubscriptions(named) {
		const nextRandom = seededRandom(20261009);
		const usedNames = new Set(named.map((entry) => entry.name));
		/* First paid days fall between early 2021 and late September 2026. */
		const earliest = parseIso('2021-01-04').getTime();
		const spread = parseIso('2026-09-25').getTime() - earliest;
		const batch = [];

		const choose = (list) => list[Math.floor(nextRandom() * list.length)];
		const randomInt = (low, high) => low + Math.floor(nextRandom() * (high - low + 1));

		function freshCompanyName() {
			for (;;) {
				const candidate =
					nextRandom() < 0.55
						? `${choose(TOWN_WORDS)} ${choose(TRADES)}`
						: choose(FAMILY_NAMES) + (nextRandom() < 0.2 ? ' & Sons ' : ' ') + choose(TRADES);
				if (usedNames.has(candidate)) continue;
				usedNames.add(candidate);
				return candidate;
			}
		}

		function newCustomer(tier) {
			const company = freshCompanyName();
			const place = choose(CITY_GROUPS);
			const given = choose(GIVEN_NAMES);
			const site = `${company
				.toLowerCase()
				.replace(/&/g, 'and')
				.replace(/[^a-z]/g, '')}.${place.suffix}`;
			return {
				name: company,
				contact: `${given} ${choose(FAMILY_NAMES)}`,
				email: `${given.toLowerCase()}@${site}`,
				city: place.city,
				plan: tier,
			};
		}

		for (const tier of TIER_ORDER) {
			const profile = TIER_PROFILES[tier];
			const already = named.filter((entry) => entry.plan === tier && isPaying(entry)).length;
			for (let made = 0; made < FIXTURE.tierGoals[tier].headcount - already; made++) {
				const entry = newCustomer(tier);
				entry.cycle = nextRandom() < profile.yearlyOdds ? 'year' : 'month';
				entry.seats = randomInt(profile.seatsLow, profile.seatsHigh);
				entry.used = Math.max(1, entry.seats - Math.floor(nextRandom() * (entry.seats * 0.15 + 1)));
				entry.route = nextRandom() < profile.routeOdds;
				entry.portal = nextRandom() < profile.portalOdds;
				entry.sms = nextRandom() < profile.smsOdds ? randomInt(1, 4) : 0;
				entry.since = formatIso(new Date(earliest + Math.floor(nextRandom() * spread)));
				/* Monthly accounts bill on the same date each month; yearly ones on
           the anniversary of the first bill. */
				const months = entry.cycle === 'year' ? 12 : 1;
				let upcoming = entry.since;
				while (upcoming <= NOW_ISO) upcoming = shiftMonthsClamped(upcoming, months);
				entry.next = upcoming;
				entry.status = 'active';
				batch.push(entry);
			}
		}

		/* The other trials last fourteen days and began within the past week. */
		const trialsToAdd = FIXTURE.openTrials - named.filter((entry) => entry.status === 'trial').length;
		for (let made = 0; made < trialsToAdd; made++) {
			const tier = nextRandom() < 0.5 ? 'starter' : nextRandom() < 0.8 ? 'growth' : 'enterprise';
			const entry = newCustomer(tier);
			const profile = TIER_PROFILES[tier];
			entry.cycle = 'month';
			entry.seats = randomInt(profile.seatsLow, Math.min(profile.seatsHigh, 20));
			entry.used = Math.max(1, entry.seats - randomInt(0, 2));
			entry.since = shiftDays(NOW_ISO, -randomInt(0, 6));
			entry.next = shiftDays(entry.since, 14);
			entry.status = 'trial';
			batch.push(entry);
		}

		for (const tier of TIER_ORDER) {
			const adjustable = batch.filter((entry) => entry.plan === tier && isPaying(entry));
			const goal = FIXTURE.tierGoals[tier].monthly;
			const floor = TIER_PROFILES[tier].seatsLow;
			let running = named
				.concat(adjustable)
				.filter((entry) => entry.plan === tier && isPaying(entry))
				.reduce((sum, entry) => sum + monthlyTotal(entry), 0);
			let attempts = 0;
			while (Math.abs(running - goal) > 40 && attempts++ < 200000) {
				const entry = adjustable[Math.floor(nextRandom() * adjustable.length)];
				const before = monthlyTotal(entry);
				if (running < goal) {
					entry.seats += 1;
				} else if (entry.seats > floor) {
					entry.seats -= 1;
					entry.used = Math.min(entry.used, entry.seats);
				} else {
					continue;
				}
				running += monthlyTotal(entry) - before;
			}
		}

		return batch;
	}

	/** Reads what a line of a shared account's seat history describes. */
	function historyKind(text) {
		if (/^Started/.test(text)) return 'start';
		return /^Renewed/.test(text) ? 'renew' : 'seats';
	}

	/**
	 * What a shared account already knows about itself: people, address,
	 * payment method, bills and seat history, so this page agrees with the
	 * Companies pages. An empty object means everything is derived instead.
	 */
	function namedAccountStory(entry) {
		const accountsBook = window.Basalt.data.accounts;
		const profile = entry.acct && accountsBook.find(entry.acct);
		if (!profile) return {};

		const lead = profile.people.find((person) => person.key === entry.who);
		const seatLog = accountsBook.history(profile);
		const story = {
			role: lead.title,
			billingEmail: `accounts@${profile.site}`,
			address: profile.address,
			po: profile.po || '',
		};
		if (profile.pay) {
			let terms = 'Charged on each bill date';
			if (/^Bank/.test(profile.pay)) terms = 'Invoices due in 30 days';
			else if (profile.status === 'pastdue') terms = `Declined on ${shortDate(profile.statusOn)}`;
			story.pays = [profile.pay.split(', ')[0], terms];
		}
		if (entry.status === 'trial') return story;

		story.bills = accountsBook.bills(profile);
		story.history = seatLog.map(([on, seats, text], index) => {
			const kind = historyKind(text);
			return {
				at: on,
				kind,
				text: kind === 'seats' && index ? `Seats raised from ${seatLog[index - 1][1]} to ${seats}` : text,
			};
		});

		const renewal = profile.renewal;
		if (renewal) {
			story.history.push({
				at: renewal.sent,
				kind: 'quote',
				text: `<strong>${htmlSafe(profile.owner)}</strong> sent a renewal quote for ${renewal.seats} seats`,
			});
			if (!renewal.signed) {
				const signer = profile.people.find((person) => person.key === renewal.signer);
				story.quote = {
					id: renewal.quote,
					sent: renewal.sent,
					note: `${signer ? `${signer.name.split(' ')[0]} signs it. ` : ''}Not signed yet.`,
					setup: {
						plan: profile.plan,
						cycle: 'year',
						seats: renewal.seats,
						route: profile.route,
						portal: profile.portal,
						sms: profile.sms,
					},
				};
			}
		}
		if (entry.status === 'pastdue') {
			const failed = story.bills.find((bill) => bill.state === 'unpaid');
			story.history.push({
				at: profile.statusOn,
				kind: 'fail',
				text: `The ${dollars(failed.amount)} payment for ${shortDate(profile.statusOn)} failed`,
			});
		}
		const request = profile.activity.find((event) => /cancel/i.test(event[2]));
		if (entry.status === 'canceling' && request) {
			story.history.push({
				at: request[0],
				kind: 'cancel',
				text: `<strong>${htmlSafe(request[1])}</strong> asked to cancel at the end of the term`,
			});
		}
		story.history.sort((left, right) => right.at.localeCompare(left.at));
		return story;
	}

	/**
	 * Everything the page draws for one subscription, taken from its shared
	 * story where there is one and worked out from the record where not.
	 */
	function assemble(entry, story) {
		const nextRandom = seededRandom(Number(entry.id.replace(/\D/g, '')));
		const months = entry.cycle === 'year' ? 12 : 1;
		const onTrialNow = entry.status === 'trial';
		const billFailed = entry.status === 'pastdue';
		const yearly = !onTrialNow && entry.cycle === 'year';
		/* The running term: a trial ends on its last day, a failed bill opened
       the term it paid for, and any other term closes on `next`. */
		const termStart = onTrialNow ? entry.since : billFailed ? entry.next : shiftMonthsClamped(entry.next, -months);
		const renews = onTrialNow || !billFailed ? entry.next : shiftMonthsToEnd(entry.next, months);
		const billFor = (setup) => cents(monthlyTotal(setup) * months);

		const bills = story.bills || (onTrialNow ? [] : recentBills(entry, { months, yearly, billFailed, billFor }));
		const paidSoFar = totalPaid(entry, story, { months, onTrialNow, billFailed, billFor });
		const seatTrend = seatUseOverTime(entry, nextRandom, onTrialNow);

		/* What the add-ons did in the last thirty days. */
		const extrasUse = {
			routes: Math.round(entry.used * (9 + nextRandom() * 4)),
			lessDriving: 8 + Math.floor(nextRandom() * 7),
			sms: Math.round((entry.sms || 0) * 1000 * (0.55 + nextRandom() * 0.4)),
			bookings: Math.round(entry.used * (3 + nextRandom() * 5)),
		};

		const history = story.history || derivedHistory(entry, bills, { onTrialNow, billFailed, yearly, billFor });
		const domain = entry.email.split('@')[1];
		const pays =
			story.pays ||
			(entry.cycle === 'year'
				? ['Bank transfer', 'Invoices due in 30 days']
				: [`Card ending ${String(1000 + Math.floor(nextRandom() * 9000))}`, 'Charged on each bill date']);

		return {
			customer: {
				id: entry.id,
				name: entry.name,
				city: entry.city,
				contact: entry.contact,
				role: story.role || entry.email,
				email: entry.email,
				billingEmail: story.billingEmail || `billing@${domain}`,
				pays,
				po: story.po || '',
				address: story.address || [entry.name, entry.city],
				since: entry.since,
				termStart,
				renews,
				used: entry.used,
				note: entry.note || '',
			},
			setup: setupOf(entry),
			quote: story.quote || null,
			seats: seatTrend,
			extrasUse,
			bills,
			paidSoFar,
			history,
		};
	}

	/** The latest bills, numbered the way the list's quick view numbers them.
      They have no invoice of their own, so they are marked local. */
	function recentBills(entry, { months, yearly, billFailed, billFor }) {
		const bills = [];
		const id = Number(entry.id.replace(/\D/g, ''));
		let billedOn = billFailed ? entry.next : shiftMonthsClamped(entry.next, -months);
		for (let index = 0; index < (yearly ? 3 : 4) && billedOn >= entry.since; index++) {
			const period = yearly
				? `Year ${Math.round(dayGap(entry.since, billedOn) / 365) + 1}`
				: MONTH_NAMES[parseIso(billedOn).getMonth()];
			bills.push({
				no: `#${1000 + ((id * 37 + index * 11) % 9000)}`,
				at: billedOn,
				what: `${period}, ${counted(entry.seats, 'seat')}`,
				amount: billFor(entry),
				state: billFailed && index === 0 ? 'unpaid' : 'paid',
				local: true,
			});
			billedOn = shiftMonthsClamped(billedOn, -months);
		}
		return bills;
	}

	/** The sum of every bill paid since the first one. */
	function totalPaid(entry, story, { months, onTrialNow, billFailed, billFor }) {
		if (story.bills) {
			return story.bills.filter((bill) => bill.state === 'paid').reduce((sum, bill) => sum + bill.amount, 0);
		}
		let paid = 0;
		if (onTrialNow) return paid;
		for (
			let billedOn = entry.since;
			billedOn <= NOW_ISO && !(billFailed && billedOn >= entry.next);
			billedOn = shiftMonthsClamped(billedOn, months)
		) {
			paid += billFor(entry);
		}
		return paid;
	}

	/**
	 * Seats in use at each month end over the past year, or every few days
	 * for an account younger than two months. The steps are uneven but all
	 * go one way, so the line reads as a trend.
	 */
	function seatUseOverTime(entry, nextRandom, onTrialNow) {
		const dates = [];
		const recent = onTrialNow || dayGap(entry.since, NOW_ISO) < 62;
		if (recent) {
			const span = dayGap(entry.since, NOW_ISO);
			const stride = Math.max(1, Math.ceil(span / 7));
			for (let offset = 0; offset < span; offset += stride) dates.push(shiftDays(entry.since, offset));
		} else {
			const today = parseIso(NOW_ISO);
			for (let back = 11; back >= 1; back--) {
				const monthEnd = formatIso(new Date(today.getFullYear(), today.getMonth() - back + 1, 0));
				if (monthEnd >= entry.since) dates.push(monthEnd);
			}
		}
		dates.push(NOW_ISO);

		const sliding = entry.status === 'risk' && entry.used / entry.seats < 0.8;
		let origin = 1;
		if (!onTrialNow) {
			origin = sliding
				? Math.round(entry.seats * 0.95)
				: Math.max(1, Math.round(entry.used * (0.84 + nextRandom() * 0.08)));
		}
		const strides = dates.map((_, index) => (index ? 0.4 + nextRandom() : 0));
		const length = strides.reduce((sum, stride) => sum + stride, 0) || 1;
		let traveled = 0;
		const inUse = strides.map((stride) => {
			traveled += stride;
			return Math.max(1, Math.min(entry.seats, Math.round(origin + ((entry.used - origin) * traveled) / length)));
		});

		return { dates, inUse, unit: recent ? 'day' : 'month' };
	}

	/**
	 * A plausible history, newest first, for an account without a shared
	 * one. A monthly customer of long standing grew into its tier and seat
	 * count before the bills shown on the page.
	 */
	function derivedHistory(entry, bills, { onTrialNow, billFailed, yearly, billFor }) {
		const events = [];
		const tierName = TIERS[entry.plan].label;
		const oldestBill = bills.length ? bills[bills.length - 1].at : NOW_ISO;
		let firstTier = tierName;
		let firstSeats = entry.seats;

		if (!onTrialNow && entry.cycle === 'month') {
			const lowerTier = TIER_ORDER[TIER_ORDER.indexOf(entry.plan) - 1];
			const movedOn = shiftMonthsClamped(entry.since, 13);
			if (lowerTier && movedOn < oldestBill) {
				events.push({ at: movedOn, kind: 'plan', text: `Moved from ${TIERS[lowerTier].label} to ${tierName}` });
				firstTier = TIERS[lowerTier].label;
			}
			const grewOn = shiftMonthsClamped(entry.since, 7);
			const smaller = entry.seats - Math.max(1, Math.round(entry.seats * 0.15));
			if (smaller >= 1 && grewOn < oldestBill) {
				events.push({ at: grewOn, kind: 'seats', text: `Seats raised from ${smaller} to ${entry.seats}` });
				firstSeats = smaller;
			}
		}

		events.push({
			at: entry.since,
			kind: 'start',
			text: onTrialNow
				? `Started a 14-day trial of ${tierName} with ${counted(entry.seats, 'seat')}`
				: `Started on ${firstTier} with ${counted(firstSeats, 'seat')}`,
		});

		const extraNames = Object.keys(EXTRAS)
			.filter((key) => entry[key])
			.map((key) => EXTRAS[key].label);
		if (entry.sms) extraNames.push('SMS credits');
		const addedOn = shiftMonthsClamped(entry.since, 4);
		if (!onTrialNow && extraNames.length && addedOn < NOW_ISO) {
			events.push({ at: addedOn, kind: 'addon', text: `Added ${extraNames.join(' and ')}` });
		}
		if (yearly) {
			for (
				let renewedOn = shiftMonthsClamped(entry.since, 12);
				renewedOn <= NOW_ISO && !(billFailed && renewedOn >= entry.next);
				renewedOn = shiftMonthsClamped(renewedOn, 12)
			) {
				events.push({
					at: renewedOn,
					kind: 'renew',
					text: `Renewed for a year at ${counted(entry.seats, 'seat')}`,
				});
			}
		}
		if (billFailed) {
			events.push({
				at: entry.next,
				kind: 'fail',
				text: `The ${dollars(billFor(entry))} payment for ${shortDate(entry.next)} failed`,
			});
		}
		if (entry.status === 'canceling') {
			const askedOn = shiftDays(NOW_ISO, -(2 + (Number(entry.id.replace(/\D/g, '')) % 9)));
			events.push({
				at: askedOn,
				kind: 'cancel',
				text: `<strong>${htmlSafe(entry.contact)}</strong> asked to cancel at the end of the term`,
			});
		}
		events.sort((left, right) => right.at.localeCompare(left.at));
		return events;
	}

	/* A setup is a plan, seats, billing cycle and add-ons; these price and compare them. */

	/** One seat's monthly price; yearly billing spreads ten months over twelve. */
	function monthlySeatRate(setup) {
		const rate = TIERS[setup.plan].seatRate;
		return setup.cycle === 'year' ? (rate * 10) / 12 : rate;
	}

	/** The priced lines of a setup: seats, each add-on, then text packs. */
	function chargeLines(setup) {
		const seatsNote = `${withCommas(setup.seats)} seats`;
		const result = [
			{
				name: 'Seats',
				note: `${seatsNote} × ${dollars(cents(monthlySeatRate(setup)))}`,
				amount: cents(monthlySeatRate(setup) * setup.seats),
				icon: 'bi-people',
				tone: 'plan',
			},
		];
		for (const [key, extra] of Object.entries(EXTRAS)) {
			if (!setup[key]) continue;
			result.push({
				name: extra.label,
				note: `${seatsNote} × ${wholeDollars(extra.rate)}`,
				amount: extra.rate * setup.seats,
				icon: EXTRA_ICONS[key],
				tone: key,
			});
		}
		if (setup.sms) {
			result.push({
				name: 'SMS credits',
				note: `${withCommas(setup.sms * 1000)} messages a month`,
				amount: setup.sms * SMS_PACK_PRICE,
				icon: 'bi-chat-dots',
				tone: 'sms',
			});
		}
		return result;
	}

	/* A setup's worth per month and per year; yearly billing has already
     counted its two free months, so a year is simply twelve of them. */
	function monthlyTotal(setup) {
		/* The same sum as the lines in chargeLines(), without writing their
		   labels: the seeded accounts ask for it thousands of times. */
		let total = cents(monthlySeatRate(setup) * setup.seats);
		for (const [key, extra] of Object.entries(EXTRAS)) if (setup[key]) total += extra.rate * setup.seats;
		if (setup.sms) total += setup.sms * SMS_PACK_PRICE;
		return cents(total);
	}

	function yearlyTotal(setup) {
		return cents(monthlyTotal(setup) * 12);
	}

	function billTotal(setup) {
		return setup.cycle === 'year' ? yearlyTotal(setup) : monthlyTotal(setup);
	}

	function isPaying(entry) {
		return entry.status !== 'trial';
	}

	function sameSetup(left, right) {
		return (
			left.plan === right.plan &&
			left.cycle === right.cycle &&
			left.seats === right.seats &&
			Boolean(left.route) === Boolean(right.route) &&
			Boolean(left.portal) === Boolean(right.portal) &&
			(left.sms || 0) === (right.sms || 0)
		);
	}

	function setupOf(entry) {
		const { plan, cycle, seats } = entry;
		return { plan, cycle, seats, route: Boolean(entry.route), portal: Boolean(entry.portal), sms: entry.sms || 0 };
	}

	function cloneSetup(setup) {
		return { ...setup };
	}

	/** The differences between two setups, as short phrases. */
	function describeChange(before, after) {
		const phrases = [];
		if (before.plan !== after.plan) phrases.push(`${TIERS[before.plan].label} to ${TIERS[after.plan].label}`);
		if (before.seats !== after.seats)
			phrases.push(`${withCommas(before.seats)} to ${counted(after.seats, 'seat')}`);
		if (before.cycle !== after.cycle) phrases.push(after.cycle === 'year' ? 'yearly billing' : 'monthly billing');
		for (const [key, extra] of Object.entries(EXTRAS)) {
			if (Boolean(before[key]) !== Boolean(after[key]))
				phrases.push(`${after[key] ? 'add' : 'remove'} ${extra.label}`);
		}
		if (before.sms !== after.sms)
			phrases.push(after.sms ? `${withCommas(after.sms * 1000)} SMS a month` : 'no SMS credits');
		return phrases;
	}

	function billingAdverb(setup) {
		return setup.cycle === 'year' ? 'yearly' : 'monthly';
	}

	/* Short questions about the subscription as it stands after any edits. */

	function onTrial() {
		return session.status === 'trial';
	}

	function isEnding() {
		return session.status === 'canceling';
	}

	function daysRemaining() {
		return dayGap(NOW_ISO, customer.renews);
	}

	function termLength() {
		return dayGap(customer.termStart, customer.renews);
	}

	/* Each paint function redraws one card from the session state. */

	function paintEverything() {
		paintHeader();
		paintPlan();
		paintRenewal();
		paintUsage();
		paintSeatChart();
		paintAccount();
		paintInvoices();
		paintHistory();
	}

	function statusTag(word, tone) {
		const toneClass = tone ? ` basalt-status-${tone}` : '';
		return `<span class="basalt-status basalt-status-dot${toneClass}">${word}</span>`;
	}

	/** The name, status, the "…" menu and the notice line under the header. */
	function paintHeader() {
		const mark = hook('mark');
		mark.className = `basalt-avatar basalt-avatar-xl sd-mark basalt-avatar-tone-${avatarTone(customer.name)}`;
		mark.textContent = monogram(customer.name);
		hook('name').textContent = customer.name;
		document.title = `${customer.name} subscription · Basalt`;

		const billing = onTrial() ? 'free trial' : `billed ${billingAdverb(session.live)}`;
		hook('sub').textContent = `${TIERS[session.live.plan].label} plan · ${billing} · ${customer.id}`;

		const [word, tone] = STATUS_LOOK[session.status];
		const tenure = onTrial()
			? `Trial since ${longDate(customer.since)}`
			: `Customer since ${monthAndYear(customer.since)}`;
		hook('tags').innerHTML = `${statusTag(word, tone)}<span class="sd-tag">${tenure}</span>`;

		for (const button of pickAll('[data-sd-edit]', pageRoot)) button.hidden = isEnding();

		hook('menu').innerHTML = menuItems().join('');
		paintNotice();
	}

	function menuItems() {
		const item = (inner) => `<li>${inner}</li>`;
		const items = [
			item(
				`<a class="dropdown-item" href="mailto:${htmlSafe(customer.email)}"><i class="bi bi-envelope" aria-hidden="true"></i>Email ${htmlSafe(greetingName)}</a>`,
			),
		];
		if (subscription.acct) {
			items.push(
				item(
					`<a class="dropdown-item" href="company-details.html?id=${encodeURIComponent(subscription.acct)}"><i class="bi bi-person-vcard" aria-hidden="true"></i>View customer</a>`,
				),
			);
		}
		if (session.bills.length && !session.bills[0].local) {
			items.push(
				item(
					`<a class="dropdown-item" href="invoice-details.html?id=${encodeURIComponent(session.bills[0].no)}"><i class="bi bi-receipt" aria-hidden="true"></i>Latest invoice</a>`,
				),
			);
		}
		if (onTrial()) return items;

		items.push(item('<hr class="dropdown-divider">'));
		items.push(
			isEnding()
				? item(
						'<button type="button" class="dropdown-item" data-sd-act="keep"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>Keep subscription</button>',
					)
				: item(
						'<button type="button" class="dropdown-item sd-danger-item" data-sd-act="cancel"><i class="bi bi-calendar-x" aria-hidden="true"></i>Cancel subscription</button>',
					),
		);
		return items;
	}

	/**
	 * A single slim line when something wants attention: the subscription
	 * ends, a bill failed, or the account is at risk. Hidden otherwise.
	 */
	function paintNotice() {
		const notice = hook('notice');
		let tone = '';
		let content = '';

		if (isEnding()) {
			tone = 'end';
			content = `<i class="bi bi-calendar-x" aria-hidden="true"></i><span>Ends on <strong>${longDate(customer.renews)}</strong>. ${htmlSafe(session.reason)}</span><button type="button" class="btn btn-link sd-link sd-notice-btn" data-sd-act="keep">Keep subscription</button>`;
		} else if (session.status === 'pastdue') {
			const unpaid = session.bills.find((bill) => bill.state === 'unpaid');
			const sentNote = session.paymentLinkSent ? ' Payment link sent today.' : '';
			const sendButton = session.paymentLinkSent
				? ''
				: '<button type="button" class="btn btn-link sd-link sd-notice-btn" data-sd-act="link">Send payment link</button>';
			tone = 'danger';
			content = `<i class="bi bi-credit-card" aria-hidden="true"></i><span><strong>${dollars(unpaid.amount)}</strong> unpaid since ${longDate(unpaid.at)}. ${htmlSafe(customer.note)}${sentNote}</span>${sendButton}`;
		} else if (session.status === 'risk') {
			content = `<i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${htmlSafe(customer.note)}</span><a class="btn btn-link sd-link sd-notice-btn" href="mailto:${htmlSafe(customer.email)}">Email ${htmlSafe(greetingName)}</a>`;
		}

		notice.hidden = !content;
		notice.className = `sd-notice${tone ? ` sd-notice-${tone}` : ''}`;
		notice.innerHTML = content;
	}

	/** The tier band and its priced lines. */
	function paintPlan() {
		const setup = session.live;
		const tier = TIERS[setup.plan];
		const yearlyBilling = setup.cycle === 'year';

		hook('plan-desc').textContent = onTrial()
			? `What ${customer.name} is trying, and what it costs after the trial.`
			: `What ${customer.name} pays for, billed ${yearlyBilling ? 'once a year.' : 'every month.'}`;

		let footnote = `Next bill on ${shortDate(customer.renews)}`;
		if (onTrial()) footnote = `Free until ${shortDate(customer.renews)}`;
		else if (isEnding()) footnote = `Last day ${shortDate(customer.renews)}`;
		else if (yearlyBilling) footnote = `${wholeDollars(yearlyTotal(setup))} billed each year`;

		const band = hook('band');
		band.className = `sd-planband sd-tone-${setup.plan}`;
		band.innerHTML = [
			'<div class="sd-planband-who">',
			`<span class="sd-planband-icon" aria-hidden="true"><i class="bi ${tier.glyph}"></i></span>`,
			`<div><p class="sd-planband-name">${tier.label}</p><p class="sd-planband-note">$${tier.seatRate} a seat each month${yearlyBilling ? ', two months free yearly' : ''}</p></div>`,
			'</div>',
			'<div class="sd-planband-money">',
			`<p class="sd-planband-value">${wholeDollars(monthlyTotal(setup))}<span class="sd-planband-unit"> a month</span></p>`,
			`<p class="sd-planband-note">${footnote}</p>`,
			'</div>',
		].join('');

		/* Basic cannot take Travel Planner, so it is not listed as missing. */
		const absent = Object.keys(EXTRAS).filter(
			(key) => !setup[key] && !(key === 'route' && setup.plan === 'starter'),
		);
		const rows = chargeLines(setup).map((line) => {
			const tierClass = line.tone === 'plan' ? ` sd-tone-${setup.plan}` : '';
			return `<li class="sd-line sd-line-${line.tone}${tierClass}"><span class="sd-line-icon" aria-hidden="true"><i class="bi ${line.icon}"></i></span><span class="sd-line-text"><span class="sd-line-name">${htmlSafe(line.name)}</span><span class="sd-line-note">${htmlSafe(line.note)}</span></span><span class="sd-line-amt">${dollars(line.amount)}<span class="sd-line-per"> a month</span></span></li>`;
		});
		if (absent.length) {
			rows.push(
				`<li class="sd-line sd-line-missing"><span class="sd-line-note">Not on this plan: ${absent.map((key) => EXTRAS[key].label).join(' and ')}.</span></li>`,
			);
		}
		hook('lines').innerHTML = rows.join('');
	}

	/** A ring filled by how much of the term has passed, days left inside. */
	function termRing(elapsed, remaining) {
		const percent = Math.max(0, Math.min(100, elapsed * 100));
		const unit = remaining === 1 ? 'day left' : 'days left';
		return `<div class="sd-ring sd-tone-${session.live.plan}${isEnding() ? ' is-ending' : ''}" role="img" aria-label="${counted(remaining, 'day')} left in this term"><svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle class="sd-ring-track" cx="50" cy="50" r="42"/><path class="sd-ring-fill" d="M92 50a42 42 0 1 1-84 0a42 42 0 1 1 84 0" pathLength="100" style="--sd-ring: ${percent.toFixed(1)}"/></svg><span class="sd-ring-label"><span class="sd-ring-num">${remaining}</span><span class="sd-ring-unit">${unit}</span></span></div>`;
	}

	function comparisonRow(label, before, after) {
		const arrow =
			before === after
				? ''
				: `<i class="bi bi-arrow-right" aria-hidden="true"></i><span class="sd-compare-to">${after}</span>`;
		return `<div class="sd-compare-row"><dt>${label}</dt><dd><span class="sd-compare-from">${before}</span>${arrow}</dd></div>`;
	}

	function extrasSummary(setup) {
		const names = Object.keys(EXTRAS)
			.filter((key) => setup[key])
			.map((key) => EXTRA_SHORT_NAMES[key]);
		if (setup.sms) names.push('SMS');
		return names.join(', ') || 'None';
	}

	function footNote(text) {
		return text ? `<p class="sd-renew-foot-note">${htmlSafe(text)}</p>` : '';
	}

	/** The term ring and dates, what renews, and the action that fits. */
	function paintRenewal() {
		const live = session.live;
		const queued = session.queued;
		const yearlyBilling = live.cycle === 'year';

		let heading = 'Renewal';
		if (onTrial()) heading = 'Trial';
		else if (isEnding()) heading = `Ends on ${shortDate(customer.renews)}`;
		hook('renew-title').textContent = heading;

		let summary = yearlyBilling
			? 'A yearly contract that renews by itself.'
			: 'Billed every month, on the same day.';
		if (onTrial()) summary = `Free to try, then billed ${billingAdverb(live)}.`;
		else if (isEnding()) summary = 'Nothing more is billed. Their data is kept for 90 days.';
		hook('renew-desc').textContent = summary;

		let dates;
		if (onTrial()) {
			dates = [
				['Trial started', shortDate(customer.termStart)],
				['First bill', longDate(customer.renews)],
			];
		} else {
			const termYear = Math.round(dayGap(customer.since, customer.termStart) / 365) + 1;
			const endLabel = isEnding() ? 'Last day' : yearlyBilling ? 'Renews' : 'Next bill';
			dates = [
				[
					yearlyBilling ? 'This term' : 'This month',
					yearlyBilling
						? `Year ${termYear}, since ${shortDate(customer.termStart)}`
						: `Since ${shortDate(customer.termStart)}`,
				],
				[endLabel, longDate(customer.renews)],
			];
		}
		const elapsed = dayGap(customer.termStart, NOW_ISO) / termLength();
		const facts = dates.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
		hook('term').innerHTML = `${termRing(elapsed, daysRemaining())}<dl class="sd-term-facts">${facts}</dl>`;

		const upcoming = hook('change');
		const foot = hook('renew-foot');

		if (isEnding()) {
			upcoming.innerHTML = `<p class="sd-change-same">${htmlSafe(customer.name)} keeps every seat and add-on until then. Keeping the subscription renews it as it is now.</p>`;
			foot.innerHTML = '';
			return;
		}

		if (onTrial()) {
			upcoming.innerHTML = `<p class="sd-change-same">After the trial: <strong>${dollars(billTotal(queued))} a ${yearlyBilling ? 'year' : 'month'}</strong> for ${TIERS[queued.plan].label} with ${counted(queued.seats, 'seat')}.</p>`;
			const extendControl = session.trialExtended
				? '<p class="sd-renew-foot-done"><i class="bi bi-check2" aria-hidden="true"></i>Extended by a week today</p>'
				: '<button type="button" class="btn btn-outline-secondary btn-sm" data-sd-act="extend"><i class="bi bi-hourglass-split me-1" aria-hidden="true"></i>Extend trial</button>';
			foot.innerHTML = footNote(customer.note) + extendControl;
			return;
		}

		if (sameSetup(live, queued)) {
			upcoming.innerHTML = yearlyBilling
				? `<p class="sd-change-same">Renews at the same size: <strong>${wholeDollars(yearlyTotal(queued))}</strong> for another year.</p>`
				: `<p class="sd-change-same">The next bill is <strong>${dollars(monthlyTotal(queued))}</strong>, at the same size as now.</p>`;
			foot.innerHTML =
				session.queuedSource === 'edit'
					? `<p class="sd-renew-foot-note">Changed by ${htmlSafe(FIXTURE.operator)} today.</p>`
					: footNote(session.status === 'active' ? customer.note : '');
			return;
		}

		const delta = yearlyTotal(queued) - yearlyTotal(live);
		const cycleWord = (setup) => (setup.cycle === 'year' ? 'Yearly' : 'Monthly');
		const rows = [];
		if (live.plan !== queued.plan)
			rows.push(comparisonRow('Plan', TIERS[live.plan].label, TIERS[queued.plan].label));
		rows.push(comparisonRow('Seats', withCommas(live.seats), withCommas(queued.seats)));
		if (live.cycle !== queued.cycle) rows.push(comparisonRow('Billing', cycleWord(live), cycleWord(queued)));
		if (extrasSummary(live) !== extrasSummary(queued))
			rows.push(comparisonRow('Add-ons', extrasSummary(live), extrasSummary(queued)));
		rows.push(comparisonRow('Per year', wholeDollars(yearlyTotal(live)), wholeDollars(yearlyTotal(queued))));
		upcoming.innerHTML = `<div class="sd-change-head"><h3 class="sd-sub">From ${shortDate(customer.renews)}</h3><span class="sd-delta ${delta >= 0 ? 'sd-delta-up' : 'sd-delta-down'}">${delta >= 0 ? '+' : ''}${wholeDollars(delta)} a year</span></div><dl class="sd-compare">${rows.join('')}</dl>`;

		if (session.queuedSource !== 'quote') {
			foot.innerHTML = `<p class="sd-renew-foot-note">Changed by ${htmlSafe(FIXTURE.operator)} today.</p><button type="button" class="btn btn-outline-secondary btn-sm" data-sd-act="undo-renewal"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Renew as it is now</button>`;
			return;
		}
		const quote = derived.quote;
		const reminder = session.reminderSent
			? '<p class="sd-renew-foot-done"><i class="bi bi-check2" aria-hidden="true"></i>Reminder sent today</p>'
			: `<button type="button" class="btn btn-outline-secondary btn-sm" data-sd-act="remind"><i class="bi bi-bell me-1" aria-hidden="true"></i>Remind ${htmlSafe(greetingName)}</button>`;
		foot.innerHTML = `<p class="sd-renew-foot-note">From quote <a class="sd-link" href="quote-details.html?id=${encodeURIComponent(quote.id)}">${quote.id}</a>, sent ${shortDate(quote.sent)}. ${htmlSafe(quote.note)}</p>${reminder}`;
	}

	/* Seats in use against seats paid for, drawn as an inline SVG line. */

	function pointLabel(index, spelledOut) {
		const { dates, unit } = derived.seats;
		if (index === dates.length - 1) return 'Today';
		if (unit === 'day') return spelledOut ? longDate(dates[index]) : shortDate(dates[index]);
		return (spelledOut ? MONTH_NAMES : SHORT_MONTH_NAMES)[parseIso(dates[index]).getMonth()];
	}

	/** Paid seats held steady; a change made today shows on the last point. */
	function paidSeats() {
		const last = derived.seats.inUse.length - 1;
		return derived.seats.inUse.map((_, index) => (index === last ? session.live.seats : derived.setup.seats));
	}

	/** A round gridline spacing that yields three or four lines. */
	function gridStep(range) {
		const target = range / 3;
		const scale = Math.pow(10, Math.floor(Math.log10(Math.max(target, 1))));
		return [1, 2, 5, 10].map((factor) => factor * scale).find((step) => step >= target);
	}

	function paintSeatChart() {
		const inUse = derived.seats.inUse;
		if (inUse.length < 2) {
			chartHost.innerHTML =
				'<p class="sd-chart-none">The trial started today. Seats in use show from tomorrow.</p>';
			hook('chart-table').innerHTML = '';
			return;
		}

		const paid = paidSeats();
		const width = Math.max(240, Math.round(chartHost.clientWidth));
		const height = width < 480 ? 190 : 220;
		const inset = { l: 34, r: 14, t: 14, b: 30 };
		const values = inUse.concat(paid);
		const lowest = Math.min(...values);
		const highest = Math.max(...values);
		const step = gridStep(Math.max(3, highest - lowest));
		const floor = Math.max(0, Math.floor((lowest - step / 2) / step) * step);
		const ceiling = Math.ceil((highest + step / 3) / step) * step;
		const lastIndex = inUse.length - 1;

		const xAt = (index) => inset.l + (index / lastIndex) * (width - inset.l - inset.r);
		const yAt = (value) => inset.t + (1 - (value - floor) / (ceiling - floor)) * (height - inset.t - inset.b);
		const trace = (series) =>
			series
				.map((value, index) => `${index ? 'L' : 'M'}${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`)
				.join(' ');

		let gridlines = '';
		for (let value = floor; value <= ceiling; value += step) {
			const lineY = yAt(value).toFixed(1);
			gridlines += `<line class="sd-chart-grid" x1="${inset.l}" x2="${width - inset.r}" y1="${lineY}" y2="${lineY}"/><text class="sd-chart-axis" x="${inset.l - 8}" y="${(yAt(value) + 4).toFixed(1)}" text-anchor="end">${value}</text>`;
		}
		/* Narrow charts label every other point, counting back from today. */
		const labelEvery = width < 520 ? 2 : 1;
		const ticks = derived.seats.dates
			.map((_, index) => {
				if ((lastIndex - index) % labelEvery) return '';
				const anchor = index === lastIndex ? 'end' : index === 0 ? 'start' : 'middle';
				return `<text class="sd-chart-axis" x="${xAt(index).toFixed(1)}" y="${height - 8}" text-anchor="${anchor}">${pointLabel(index)}</text>`;
			})
			.join('');

		const endX = xAt(lastIndex);
		const endY = yAt(inUse[lastIndex]);
		const entering = !chartHasRendered && !calmMotion;
		const used = trace(inUse);
		chartHost.innerHTML = [
			`<svg class="sd-chart-svg${entering ? ' is-entering' : ''}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">`,
			gridlines,
			ticks,
			`<path class="sd-chart-area" d="${used} L${endX.toFixed(1)} ${yAt(floor)} L${xAt(0)} ${yAt(floor)} Z"/>`,
			`<path class="sd-chart-paid" d="${trace(paid)}"/>`,
			`<path class="sd-chart-line" pathLength="1" d="${used}"/>`,
			`<circle class="sd-chart-dot" cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="5"/>`,
			`<line class="sd-chart-cursor" x1="0" x2="0" y1="${inset.t}" y2="${height - inset.b}"/>`,
			'</svg><p class="sd-chart-tip" hidden></p>',
		].join('');
		chartHasRendered = true;
		chartGeometry = { xAt, width, inset, points: inUse.length };

		hook('chart-table').innerHTML = derived.seats.dates
			.map(
				(_, index) =>
					`<tr><th scope="row">${pointLabel(index, true)}</th><td>${inUse[index]}</td><td>${paid[index]}</td></tr>`,
			)
			.join('');
	}

	/** With a mouse, the point nearest the pointer shows its numbers. */
	function showChartPoint(event) {
		const geometry = chartGeometry;
		if (!geometry || event.pointerType !== 'mouse' || !pick('.sd-chart-tip', chartHost)) return;
		const bounds = chartHost.getBoundingClientRect();
		const plotted = geometry.width - geometry.inset.l - geometry.inset.r;
		const nearest = Math.round(
			((event.clientX - bounds.left - geometry.inset.l) / plotted) * (geometry.points - 1),
		);
		const index = Math.max(0, Math.min(geometry.points - 1, nearest));
		const tip = pick('.sd-chart-tip', chartHost);
		const cursor = pick('.sd-chart-cursor', chartHost);

		tip.innerHTML = `<strong>${pointLabel(index, true)}</strong>${derived.seats.inUse[index]} of ${paidSeats()[index]} seats in use`;
		tip.hidden = false;
		const left = Math.max(0, Math.min(bounds.width - tip.offsetWidth, geometry.xAt(index) - tip.offsetWidth / 2));
		tip.style.left = `${left}px`;
		cursor.setAttribute('x1', geometry.xAt(index));
		cursor.setAttribute('x2', geometry.xAt(index));
		cursor.classList.add('is-on');
	}

	function hideChartPoint() {
		const tip = pick('.sd-chart-tip', chartHost);
		if (tip) tip.hidden = true;
		pick('.sd-chart-cursor', chartHost)?.classList.remove('is-on');
	}

	/** Redraws the chart when its box changes width by two pixels or more. */
	function watchChartWidth() {
		if (!('ResizeObserver' in window)) return;
		let drawnWidth = chartHost.clientWidth;
		const sizeWatcher = new ResizeObserver(() => {
			if (Math.abs(chartHost.clientWidth - drawnWidth) < 2) return;
			drawnWidth = chartHost.clientWidth;
			requestAnimationFrame(paintSeatChart);
		});
		sizeWatcher.observe(chartHost);
	}

	/** The seat sentence over the chart and the add-on use list. */
	function paintUsage() {
		const setup = session.live;
		const { inUse, dates, unit } = derived.seats;
		const opening = inUse[0];
		const spare = setup.seats - customer.used;
		const since = unit === 'day' ? `on ${shortDate(dates[0])}` : `in ${MONTH_NAMES[parseIso(dates[0]).getMonth()]}`;

		let trend = `, the same as ${since}.`;
		if (onTrial()) trend = ' since the trial started.';
		else if (opening < customer.used) trend = `, up from ${opening} ${since}.`;
		else if (opening > customer.used) trend = `, down from ${opening} ${since}.`;

		let room = '';
		if (spare === 0) room = ' None spare.';
		else if (spare <= 5) room = ` Only ${counted(spare, 'seat')} spare.`;
		hook('usage-desc').textContent =
			`${withCommas(customer.used)} of ${counted(setup.seats, 'seat')} in use${trend}${room}`;

		const use = derived.extrasUse;
		const justAdded = 'Added today. Use shows from tomorrow.';
		const entry = (tone, icon, name, note, extra = '') =>
			`<li class="sd-use sd-use-${tone}"><span class="sd-use-icon" aria-hidden="true"><i class="bi ${icon}"></i></span><span class="sd-use-text"><span class="sd-use-name">${name}</span><span class="sd-use-note">${note}</span></span>${extra}</li>`;
		const entries = [];
		if (setup.route) {
			entries.push(
				entry(
					'route',
					'bi-signpost-split',
					'Travel Planner',
					derived.setup.route
						? `${withCommas(use.routes)} day plans made, ${use.lessDriving}% less driving`
						: justAdded,
				),
			);
		}
		if (setup.portal) {
			entries.push(
				entry(
					'portal',
					'bi-globe2',
					'Customer Portal',
					derived.setup.portal ? `${withCommas(use.bookings)} visits booked by their customers` : justAdded,
				),
			);
		}
		if (setup.sms) {
			const allowance = setup.sms * 1000;
			const sent = derived.setup.sms ? use.sms : 0;
			const share = Math.min(100, Math.round((sent / allowance) * 100));
			const meter = `<span class="sd-meter${share >= 90 ? ' is-high' : ''}" role="img" aria-label="${share}% used"><span class="sd-meter-fill" style="width: ${share}%"></span></span>`;
			entries.push(
				entry(
					'sms',
					'bi-chat-dots',
					'SMS credits',
					`${withCommas(sent)} of ${withCommas(allowance)} messages`,
					meter,
				),
			);
		}
		hook('uses').innerHTML = entries.join('') || '<li class="sd-use sd-use-none">No add-ons on this plan.</li>';
	}

	/** The account facts, with copy buttons on the values people paste. */
	function paintAccount() {
		const copyButton = (text, label) =>
			`<button type="button" class="btn btn-icon btn-sm sd-copy" data-sd-copy="${htmlSafe(text)}" aria-label="Copy ${label}"><i class="bi bi-copy" aria-hidden="true"></i></button>`;
		const withNote = (main, note) => `${main}<span class="sd-fact-sub">${htmlSafe(note)}</span>`;
		const linkOr = (target, href, text) =>
			target
				? `<a class="sd-link" href="${href}?id=${encodeURIComponent(target)}">${htmlSafe(text)}</a>`
				: htmlSafe(text);

		const rows = [
			['Customer', withNote(linkOr(subscription.acct, 'company-details.html', customer.name), customer.city)],
			['Owner', withNote(linkOr(subscription.who, 'person-details.html', customer.contact), customer.role)],
			[
				'Invoices to',
				`<span class="sd-fact-line"><span>${htmlSafe(customer.billingEmail)}</span>${copyButton(customer.billingEmail, 'billing email')}</span>`,
			],
			['Pays by', withNote(htmlSafe(customer.pays[0]), customer.pays[1])],
		];
		if (customer.po) rows.push(['Purchase order', withNote(htmlSafe(customer.po), 'Quoted on every invoice')]);
		rows.push(['Bill to', withNote(htmlSafe(customer.address[0]), customer.address[1])]);
		rows.push([
			'Subscription',
			`<span class="sd-fact-line">${htmlSafe(customer.id)}${copyButton(customer.id, 'subscription ID')}</span>`,
		]);
		hook('facts').innerHTML = rows
			.map(([label, value]) => `<div class="sd-fact"><dt>${label}</dt><dd>${value}</dd></div>`)
			.join('');
	}

	/** The upcoming bill, then the four newest; All invoices has the rest. */
	function paintInvoices() {
		const rows = [];
		if (!isEnding()) {
			const queued = session.queued;
			const yearlyBilling = queued.cycle === 'year';
			let period = MONTH_NAMES[parseIso(customer.renews).getMonth()];
			if (onTrial()) period = yearlyBilling ? 'First year' : 'First month';
			else if (yearlyBilling) period = `Year ${Math.round(dayGap(customer.since, customer.renews) / 365) + 1}`;
			rows.push({
				next: true,
				at: customer.renews,
				what: `${period}, ${counted(queued.seats, 'seat')}`,
				amount: billTotal(queued),
				state: 'next',
			});
		}
		rows.push(...session.bills.slice(0, 4));

		const anyUnpaid = session.bills.some((bill) => bill.state === 'unpaid');
		hook('whs-desc').textContent = onTrial()
			? 'Nothing billed yet: the trial is free.'
			: `${dollars(derived.paidSoFar)} paid since ${monthAndYear(customer.since)}${anyUnpaid ? '. One bill is unpaid.' : ', every bill on time.'}`;

		hook('invoices').innerHTML = rows
			.map((bill) => {
				const [word, tone] = BILL_LOOK[bill.state];
				const dueBy = bill.state === 'due' ? ` by ${shortDate(shiftDays(bill.at, 30))}` : '';
				const flash = bill.no && bill.no === session.flashInvoice ? ' is-fresh' : '';
				const reference = bill.next
					? `<span class="sd-inv-no">${onTrial() ? 'First invoice' : 'Next invoice'}</span>`
					: bill.local
						? `<span class="sd-inv-no">${bill.no}</span>`
						: `<a class="sd-link sd-inv-no" href="invoice-details.html?id=${encodeURIComponent(bill.no)}">${bill.no}</a>`;
				return `<tr class="${bill.next ? 'sd-inv-next' : ''}${flash}"><td>${reference}<span class="sd-inv-date">${longDate(bill.at)}</span></td><td class="sd-col-for">${htmlSafe(bill.what)}</td><td class="sd-col-amt">${dollars(bill.amount)}</td><td>${statusTag(word + dueBy, tone)}</td></tr>`;
			})
			.join('');
		/* A new invoice flashes the one time it appears, not on later redraws. */
		session.flashInvoice = null;
	}

	function paintHistory() {
		hook('changes').innerHTML = session.history
			.map((event, index) => {
				const flash = index === 0 && event.fresh ? ' is-fresh' : '';
				const when = event.at === NOW_ISO ? 'Today' : longDate(event.at);
				return `<li class="sd-feed-item sd-feed-item-${event.kind}${flash}"><span class="sd-feed-icon" aria-hidden="true"><i class="bi ${HISTORY_ICONS[event.kind]}"></i></span><span class="sd-feed-text"><span>${event.text}</span><span class="sd-feed-time">${when}</span></span></li>`;
			})
			.join('');
	}

	/** Puts a new event on top of the history, the only one marked fresh. */
	function recordEvent(kind, text) {
		for (const event of session.history) event.fresh = false;
		session.history.unshift({ at: NOW_ISO, kind, text, fresh: true });
	}

	/* The plan editor replaces the plan band while it is open. */

	function prepareEditor() {
		const form = pick('[data-sd-editor]', pageRoot);
		editor = {
			card: pick('[data-sd-plan-card]', pageRoot),
			summary: pick('[data-sd-plan-view]', pageRoot),
			form,
			inlineButton: pick('[data-sd-edit-inline]', pageRoot),
			tiers: pick('[data-sd-plans]', form),
			seats: pick('[data-sd-seats]', form),
			seatsHint: pick('[data-sd-seats-hint]', form),
			seatsError: pick('[data-sd-seats-error]', form),
			route: pick('[data-sd-addon="route"]', form),
			routeHint: pick('[data-sd-route-hint]', form),
			portal: pick('[data-sd-addon="portal"]', form),
			sms: pick('[data-sd-sms]', form),
			timingField: pick('[data-sd-when-field]', form),
			timingError: pick('[data-sd-when-error]', form),
			preview: pick('[data-sd-preview]', form),
		};

		editor.tiers.innerHTML = TIER_ORDER.map((key) => {
			const tier = TIERS[key];
			return `<label class="basalt-choice-card sd-plan-tile sd-tone-${key}"><input class="basalt-choice-card-input" type="radio" name="sd-plan" value="${key}"><span class="basalt-choice-card-icon" aria-hidden="true"><i class="bi ${tier.glyph}"></i></span><span class="basalt-choice-card-title">${tier.label}</span><span class="basalt-choice-card-text">$${tier.seatRate} a seat each month</span></label>`;
		}).join('');
		const packs = [];
		for (let packCount = 0; packCount <= SMS_PACK_LIMIT; packCount++) {
			const label = packCount
				? `${withCommas(packCount * 1000)} a month, ${wholeDollars(packCount * SMS_PACK_PRICE)}`
				: 'None';
			packs.push(`<option value="${packCount}">${label}</option>`);
		}
		editor.sms.innerHTML = packs.join('');
		pick('[data-sd-when-renewal]', form).textContent = `At renewal, ${shortDate(customer.renews)}`;

		for (const button of pickAll('[data-sd-edit]', pageRoot)) button.addEventListener('click', beginEditing);
		pick('[data-sd-cancel-edit]', form).addEventListener('click', () => {
			endEditing();
			editor.inlineButton.focus();
		});
		form.addEventListener('change', refreshDraft);
		editor.seats.addEventListener('input', paintPreview);
		form.addEventListener('submit', saveDraft);
	}

	function checkedInput(name) {
		return pick(`input[name="${name}"]:checked`, editor.form);
	}

	/** The setup as the form currently describes it. */
	function readDraft() {
		const tier = checkedInput('sd-plan')?.value ?? session.live.plan;
		return {
			plan: tier,
			cycle: checkedInput('sd-cycle')?.value ?? session.live.cycle,
			seats: parseInt(editor.seats.value, 10),
			route: editor.route.checked && tier !== 'starter',
			portal: editor.portal.checked,
			sms: parseInt(editor.sms.value, 10) || 0,
		};
	}

	/** When a saved change applies; a trial changes at once, free of charge. */
	function effectiveTiming() {
		if (onTrial()) return 'now';
		return checkedInput('sd-when')?.value ?? 'renewal';
	}

	function loadDraft(setup) {
		for (const input of pickAll('input[name="sd-plan"]', editor.form)) input.checked = input.value === setup.plan;
		for (const input of pickAll('input[name="sd-cycle"]', editor.form)) input.checked = input.value === setup.cycle;
		editor.seats.value = setup.seats;
		editor.route.checked = Boolean(setup.route);
		editor.portal.checked = Boolean(setup.portal);
		editor.sms.value = String(setup.sms || 0);
		pick('#sd-when-renewal', editor.form).checked = true;
		editor.timingField.hidden = onTrial();
		editor.seatsError.hidden = true;
		editor.timingError.hidden = true;
		editor.seats.removeAttribute('aria-invalid');
		refreshDraft();
	}

	/** Basic has no Travel Planner: the switch stays put but says why it is off. */
	function refreshDraft() {
		const basic = readDraft().plan === 'starter';
		editor.route.disabled = basic;
		if (basic) editor.route.checked = false;
		editor.routeHint.textContent = basic ? 'Needs Pro or Max' : '$6 a seat each month';
		editor.seatsHint.textContent = `${withCommas(session.live.seats)} now, ${withCommas(customer.used)} in use`;
		paintPreview();
	}

	/** The rest of the term priced on the new setup, less the current one. */
	function proratedCharge(setup) {
		if (onTrial()) return 0;
		return cents(((billTotal(setup) - billTotal(session.live)) * daysRemaining()) / termLength());
	}

	function paintPreview() {
		const draft = readDraft();
		if (!(draft.seats >= 1)) {
			editor.preview.innerHTML = '';
			return;
		}
		const immediate = effectiveTiming() === 'now';
		const baseline = immediate ? session.live : session.queued;
		if (sameSetup(baseline, draft)) {
			const rest = onTrial()
				? `After the trial it costs ${wholeDollars(monthlyTotal(draft))} a month.`
				: `${immediate ? 'Today’s plan' : 'The renewal'} stays at ${wholeDollars(yearlyTotal(draft))} a year.`;
			editor.preview.innerHTML = `<p class="sd-preview-line">No change yet. ${rest}</p>`;
			return;
		}

		const delta = yearlyTotal(draft) - yearlyTotal(baseline);
		let tail = `, from ${shortDate(customer.renews)}.`;
		if (onTrial()) {
			tail = '. Nothing is charged during the trial.';
		} else if (immediate && draft.cycle === session.live.cycle) {
			const owed = proratedCharge(draft);
			const charge = owed >= 0 ? `Charged ${dollars(owed)}` : `A credit of ${dollars(-owed)}`;
			tail = `. ${charge} today for the ${counted(daysRemaining(), 'day')} left.`;
		}
		editor.preview.innerHTML = `<p class="sd-preview-line"><strong>${wholeDollars(monthlyTotal(draft))} a month</strong>, ${wholeDollars(yearlyTotal(draft))} a year (${delta >= 0 ? '+' : ''}${wholeDollars(delta)})${tail}</p>`;
	}

	function beginEditing() {
		loadDraft(session.queued);
		editor.summary.hidden = true;
		editor.form.hidden = false;
		editor.inlineButton.hidden = true;
		editor.card.classList.add('is-editing');
		editor.card.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth', block: 'start' });
		(checkedInput('sd-plan') || editor.seats).focus({ preventScroll: true });
	}

	function endEditing() {
		editor.form.hidden = true;
		editor.summary.hidden = false;
		editor.inlineButton.hidden = isEnding();
		editor.card.classList.remove('is-editing');
	}

	/**
	 * Returns the first control holding a problem, after showing the
	 * message beside it, or null when the draft can be saved.
	 */
	function validateDraft(draft, immediate) {
		let culprit = null;
		editor.seatsError.hidden = true;
		editor.timingError.hidden = true;
		editor.seats.removeAttribute('aria-invalid');

		if (!(draft.seats >= 1) || draft.seats > 2000) {
			editor.seatsError.textContent = 'Enter a number of seats from 1 to 2,000.';
			culprit = editor.seats;
		} else if (draft.seats < customer.used) {
			editor.seatsError.textContent = `${withCommas(customer.used)} people use Fieldline now. Keep at least ${withCommas(customer.used)} seats, or remove people from Users first.`;
			culprit = editor.seats;
		}
		if (culprit) {
			editor.seatsError.hidden = false;
			editor.seats.setAttribute('aria-invalid', 'true');
		}
		if (immediate && !onTrial() && draft.cycle !== session.live.cycle) {
			editor.timingError.textContent = `Billing can only switch at the renewal. Choose “At renewal”, or keep ${billingAdverb(session.live)} billing.`;
			editor.timingError.hidden = false;
			culprit = culprit || checkedInput('sd-when');
		}
		return culprit;
	}

	function saveDraft(event) {
		event.preventDefault();
		const draft = readDraft();
		const immediate = effectiveTiming() === 'now';
		const culprit = validateDraft(draft, immediate);
		if (culprit) {
			culprit.focus();
			return;
		}

		const baseline = immediate ? session.live : session.queued;
		if (sameSetup(baseline, draft)) {
			endEditing();
			editor.inlineButton.focus();
			return;
		}

		const phrases = htmlSafe(describeChange(baseline, draft).join(', '));
		const signedBy = `<strong>${htmlSafe(FIXTURE.operator)}</strong>`;
		if (onTrial()) {
			session.live = cloneSetup(draft);
			session.queued = cloneSetup(draft);
			recordEvent('edit', `${signedBy} changed the trial: ${phrases}`);
			notify(
				'Trial updated',
				'bi-check2-circle',
				`After the trial, ${customer.name} pays ${wholeDollars(monthlyTotal(draft))} a month.`,
			);
		} else if (immediate) {
			const owed = proratedCharge(draft);
			const charged = owed >= 0;
			const number = `#${1000 + ((serial * 37 + 97 + session.bills.length) % 9000)}`;
			session.bills.unshift({
				no: number,
				at: NOW_ISO,
				what: `${charged ? 'Change to ' : 'Credit to '}${shortDate(customer.renews)}`,
				amount: Math.abs(owed),
				state: charged ? 'due' : 'credit',
			});
			session.flashInvoice = number;
			session.live = cloneSetup(draft);
			session.queued = cloneSetup(draft);
			session.queuedSource = 'edit';
			recordEvent('edit', `${signedBy} changed the plan today: ${phrases}`);
			notify(
				'Plan changed',
				'bi-check2-circle',
				`${charged ? `${dollars(owed)} invoiced` : `${dollars(-owed)} credited`} for the days left. It renews at ${wholeDollars(yearlyTotal(draft))} a year.`,
			);
		} else {
			session.queued = cloneSetup(draft);
			session.queuedSource = 'edit';
			recordEvent('edit', `${signedBy} set the renewal to ${phrases}`);
			notify(
				'Renewal updated',
				'bi-check2-circle',
				`From ${longDate(customer.renews)}, ${customer.name} pays ${wholeDollars(yearlyTotal(draft))} a year.`,
			);
		}
		endEditing();
		paintEverything();
		window.Basalt.announce?.('Saved');
		editor.inlineButton.focus({ preventScroll: true });
	}

	/* Cancellation, the notice buttons and the other one-click actions. */

	function prepareCancelDialog() {
		cancelDialog = document.getElementById('sd-cancel');
		endDialog = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(cancelDialog) : null;
		pick('[data-sd-cancel-sub]', cancelDialog).textContent =
			`${customer.name} keeps Fieldline until ${longDate(customer.renews)}. Nothing more is billed after that.`;
		pick('[data-sd-cancel-notify-label]', cancelDialog).textContent = `Email ${greetingName} a confirmation`;
		pick('[data-sd-cancel-form]', cancelDialog).addEventListener('submit', confirmCancel);
		cancelDialog.addEventListener('hidden.bs.modal', () => {
			const target = isEnding()
				? pick('.sd-notice-btn', pageRoot)
				: pick('.basalt-hero-actions [data-bs-toggle="dropdown"]', pageRoot);
			target?.focus();
		});
	}

	function confirmCancel(event) {
		event.preventDefault();
		const reason = pick('input[name="sd-reason"]:checked', cancelDialog).value.toLowerCase();
		session.status = 'canceling';
		session.reason = `Canceled by ${FIXTURE.operator}: ${reason}.`;
		recordEvent(
			'cancel',
			`<strong>${htmlSafe(FIXTURE.operator)}</strong> canceled at renewal: ${htmlSafe(reason)}`,
		);
		endEditing();
		paintEverything();
		endDialog?.hide();
		const emailed = pick('[data-sd-cancel-notify]', cancelDialog).checked
			? ` ${greetingName} has been emailed.`
			: '';
		notify('Subscription canceled', 'bi-calendar-x', `It ends on ${longDate(customer.renews)}.${emailed}`);
	}

	/* What each data-sd-act button does. */
	const PAGE_ACTIONS = {
		cancel() {
			endDialog?.show();
		},
		keep() {
			session.status = subscription.status === 'canceling' ? 'active' : subscription.status;
			session.reason = '';
			recordEvent('keep', `<strong>${htmlSafe(FIXTURE.operator)}</strong> kept the subscription`);
			paintEverything();
			const lead = session.live.cycle === 'year' ? 'It renews on ' : 'The next bill is on ';
			notify('Subscription kept', 'bi-arrow-counterclockwise', `${lead}${longDate(customer.renews)}.`);
			pick('[data-sd-edit]', pageRoot).focus();
		},
		link() {
			session.paymentLinkSent = true;
			recordEvent(
				'edit',
				`<strong>${htmlSafe(FIXTURE.operator)}</strong> sent a payment link to ${htmlSafe(customer.email)}`,
			);
			paintHeader();
			paintHistory();
			notify(
				'Payment link sent',
				'bi-link-45deg',
				`${greetingName} can pay by card or bank transfer from ${customer.email}.`,
			);
			pick('.basalt-hero-actions [data-bs-toggle="dropdown"]', pageRoot).focus();
		},
		extend() {
			customer.renews = shiftDays(customer.renews, 7);
			session.trialExtended = true;
			recordEvent(
				'edit',
				`<strong>${htmlSafe(FIXTURE.operator)}</strong> extended the trial to ${htmlSafe(longDate(customer.renews))}`,
			);
			paintEverything();
			notify(
				'Trial extended',
				'bi-hourglass-split',
				`${customer.name} can try Fieldline until ${longDate(customer.renews)}.`,
			);
			pick('[data-sd-edit]', pageRoot).focus();
		},
		remind() {
			session.reminderSent = true;
			paintRenewal();
			notify('Reminder sent', 'bi-bell', `${greetingName} gets the quote again at ${customer.email}.`);
			pick('.sd-renew-foot-note .sd-link', pageRoot).focus();
		},
		'undo-renewal'() {
			session.queued = cloneSetup(session.live);
			recordEvent(
				'edit',
				`<strong>${htmlSafe(FIXTURE.operator)}</strong> set the renewal back to the plan as it is now`,
			);
			paintEverything();
			notify(
				'Renewal reset',
				'bi-arrow-counterclockwise',
				`It renews at ${wholeDollars(yearlyTotal(session.live))} a year.`,
			);
			pick('[data-sd-edit]', pageRoot).focus();
		},
	};

	function handlePageClick(event) {
		const copyButton = event.target.closest('[data-sd-copy]');
		if (copyButton) {
			const text = copyButton.getAttribute('data-sd-copy');
			window.Basalt.copyText?.(text);
			notify('Copied', 'bi-clipboard-check', text);
			return;
		}
		const trigger = event.target.closest('[data-sd-act]');
		if (!trigger) return;
		const action = PAGE_ACTIONS[trigger.getAttribute('data-sd-act')];
		if (action) action();
	}

	/* Dates are ISO strings throughout; these parse, shift and print them. */

	function parseIso(text) {
		const [year, month, date] = text.slice(0, 10).split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function formatIso(date) {
		const pad = (value) => String(value).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function shiftDays(text, days) {
		const date = parseIso(text);
		date.setDate(date.getDate() + days);
		return formatIso(date);
	}

	/** The same date some months away, capped at the 28th so it always exists. */
	function shiftMonthsClamped(text, months) {
		const date = parseIso(text);
		return formatIso(new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), 28)));
	}

	/** The same date some months away, or that month's last day if it is short. */
	function shiftMonthsToEnd(text, months) {
		const date = parseIso(text);
		const monthLength = new Date(date.getFullYear(), date.getMonth() + months + 1, 0).getDate();
		return formatIso(new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), monthLength)));
	}

	function dayGap(start, end) {
		return Math.round((parseIso(end) - parseIso(start)) / 86400000);
	}

	/* Dates leave the year off when it is the current one. */
	function yearSuffix(date) {
		return date.getFullYear() !== currentYear ? `, ${date.getFullYear()}` : '';
	}

	function shortDate(text) {
		const date = parseIso(text);
		return `${SHORT_MONTH_NAMES[date.getMonth()]} ${date.getDate()}${yearSuffix(date)}`;
	}

	function longDate(text) {
		const date = parseIso(text);
		return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}${yearSuffix(date)}`;
	}

	function monthAndYear(text) {
		const date = parseIso(text);
		return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
	}

	function cents(amount) {
		return Math.round(amount * 100) / 100;
	}

	/* Negative amounts take a true minus sign rather than a hyphen. */
	function dollars(amount) {
		const digits = Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return `${amount < 0 ? '−' : ''}$${digits}`;
	}

	function wholeDollars(amount) {
		return `${amount < 0 ? '−' : ''}$${Math.abs(Math.round(amount)).toLocaleString('en-US')}`;
	}

	function withCommas(value) {
		return value.toLocaleString('en-US');
	}

	function counted(value, singular, pluralForm) {
		return `${withCommas(value)} ${value === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function monogram(name) {
		const words = name
			.replace(/[^A-Za-z ]/g, '')
			.split(' ')
			.filter(Boolean);
		return words
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase();
	}

	/** The avatar tone the list gives the same account, from 1 to 6. */
	function avatarTone(name) {
		let sum = 0;
		for (const character of name) sum += character.charCodeAt(0);
		return (sum % 6) + 1;
	}

	/* Lookups, escaping and toasts. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function hook(name) {
		return pick(`[data-sd="${name}"]`, pageRoot);
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
	}

	function notify(title, icon, text) {
		return window.Basalt.toasts?.push({ tone: 'success', icon, title, text }) ?? null;
	}
})();
