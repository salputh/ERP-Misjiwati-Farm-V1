/**
 * Fieldline's book of SaaS subscriptions, used by subscriptions.html.
 * It shows what each tier (Basic, Pro, Max) earns a month, then lists every
 * account with its billing period, seats, monthly revenue and the next
 * date worth watching: a renewal, a trial running out, a failed bill or a
 * cancellation. Clicking a row goes to the subscription page; the panel
 * icon on a row opens a quick view drawer instead.
 *
 * The rows are the named customers shared with every account page
 * (assets/basalt/js/data/multipurpose/accounts.js) plus a seeded crowd of smaller accounts
 * from buildCrowd(), sized so the totals match the company. A live install
 * would feed both from its billing system (Stripe, Chargebee or its own)
 * and keep the record fields described beside namedAccounts().
 */
(() => {
	'use strict';

	const shell = pick('[data-sbs-root]');
	if (!shell) return;

	/* List price per seat per month. Paying yearly costs ten months for twelve. */
	const TIERS = {
		starter: { name: 'Basic', price: 15 },
		growth: { name: 'Pro', price: 32 },
		enterprise: { name: 'Max', price: 58 },
	};
	const TIER_KEYS = ['starter', 'growth', 'enterprise'];
	const EXTRAS = { route: { name: 'Travel Planner', per: 6 }, portal: { name: 'Customer Portal', per: 4 } };
	/* One SMS block is 1,000 messages a month. */
	const SMS_BLOCK_PRICE = 25;

	/* The frozen "today" of the demo; a live page would read the clock. */
	const NOW = '2026-10-09';
	/* The crowd is sized to these totals so the page matches the company:
     2,140 paying accounts bringing in $880k a month, split by tier. */
	const TIER_GOALS = {
		starter: { accounts: 1190, mrr: 158000 },
		growth: { accounts: 790, mrr: 361000 },
		enterprise: { accounts: 160, mrr: 361000 },
	};
	const TRIAL_COUNT = 64;

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTH_FULL = [
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
	const CURRENT_YEAR = parseDay(NOW).getFullYear();

	/* Month-end revenue across the past year as a fraction of today's.
     Max climbed the most; Basic hardly moved. */
	const YEAR_CURVE = {
		starter: [0.9, 0.91, 0.92, 0.93, 0.94, 0.95, 0.955, 0.965, 0.97, 0.98, 0.99, 1],
		growth: [0.8, 0.815, 0.83, 0.845, 0.86, 0.875, 0.89, 0.91, 0.93, 0.95, 0.975, 1],
		enterprise: [0.74, 0.76, 0.78, 0.8, 0.82, 0.845, 0.87, 0.895, 0.92, 0.945, 0.97, 1],
	};

	/* A yearly plan counts as renewing soon inside this many days. */
	const RENEWAL_HORIZON = 30;

	/* The tabs above the list, each a test a subscription passes or not,
     and the order each tab opens in. */
	const TABS = {
		all: () => true,
		renewing: (sub) =>
			sub.cycle === 'year' &&
			(sub.status === 'active' || sub.status === 'risk') &&
			dayGap(NOW, sub.next) <= RENEWAL_HORIZON,
		trial: (sub) => sub.status === 'trial',
		risk: (sub) => sub.status === 'risk',
		pastdue: (sub) => sub.status === 'pastdue',
		canceling: (sub) => sub.status === 'canceling',
	};
	const TAB_ORDER = {
		all: ['date', 'asc'],
		renewing: ['date', 'asc'],
		trial: ['date', 'asc'],
		risk: ['mrr', 'desc'],
		pastdue: ['date', 'asc'],
		canceling: ['date', 'asc'],
	};
	const TAB_EMPTY_TEXT = {
		renewing: 'No yearly plan renews in the next 30 days.',
		trial: 'Nobody is trying Fieldline right now.',
		risk: 'No account looks at risk right now.',
		pastdue: 'Every bill is paid.',
		canceling: 'Nobody is leaving.',
	};

	const STATUS_LOOK = {
		active: { word: 'Active', tone: 'success' },
		risk: { word: 'At risk', tone: 'warning' },
		trial: { word: 'Trial', tone: 'info' },
		pastdue: { word: 'Past due', tone: 'danger' },
		canceling: { word: 'Canceling', tone: '' },
	};

	/* Word pools for the seeded crowd of smaller accounts. */
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
	/* City and web domain ending. Customers come from all four US regions,
     the big metro areas most often, roughly as Fieldline's do. */
	const HOME_CITIES = [
		['Plano, TX', 'com'],
		['Houston, TX', 'com'],
		['Boulder, CO', 'com'],
		['Atlanta, GA', 'com'],
		['Nashville, TN', 'com'],
		['Charlotte, NC', 'com'],
		['Minneapolis, MN', 'com'],
		['Kansas City, MO', 'com'],
		['Sacramento, CA', 'com'],
		['Raleigh, NC', 'com'],
		['Tucson, AZ', 'com'],
		['Omaha, NE', 'com'],
		['Pittsburgh, PA', 'com'],
		['Richmond, VA', 'com'],
		['Boise, ID', 'com'],
		['Stamford, CT', 'com'],
		['Bangor, ME', 'com'],
		['Buffalo, NY', 'com'],
		['Scranton, PA', 'com'],
		['Bismarck, ND', 'com'],
		['Mankato, MN', 'com'],
		['Oshkosh, WI', 'com'],
		['Duluth, MN', 'com'],
		['Ann Arbor, MI', 'com'],
		['Dubuque, IA', 'com'],
		['Peoria, IL', 'com'],
		['Des Moines, IA', 'com'],
		['Kearney, NE', 'com'],
		['Olympia, WA', 'com'],
		['Chico, CA', 'com'],
		['Santa Rosa, CA', 'com'],
		['Flagstaff, AZ', 'com'],
		['Little Rock, AR', 'com'],
		['Durham, NC', 'com'],
	];
	/* How a typical account on each tier looks: seat range and the odds of
     yearly billing and of each add-on. */
	const TIER_PROFILES = {
		starter: { seats: [2, 14], yearly: 0.3, route: 0, portal: 0.1, sms: 0.25 },
		growth: { seats: [5, 26], yearly: 0.45, route: 0.3, portal: 0.25, sms: 0.25 },
		enterprise: { seats: [18, 52], yearly: 0.7, route: 0.55, portal: 0.45, sms: 0.3 },
	};

	const named = namedAccounts();
	const everyone = [...named.map((sub) => ({ route: false, portal: false, sms: 0, ...sub })), ...buildCrowd()];

	const criteria = { tab: 'all', query: '', tier: 'all', cycle: 'all', sortKey: 'date', sortDir: 'asc' };
	let matching = [];
	let onScreen = [];
	let highlightedId = null;
	let justChangedId = null;
	let inDrawer = null;
	let stepList = [];
	let typingPause;
	let paging = null;
	const pagingOptions = { total: 0, noun: 'subscriptions', render: paintRows };

	const ui = {
		tiles: pick('[data-sbs-plans]', shell),
		summary: pick('[data-sbs-list-sum]', shell),
		tbody: pick('[data-sbs-body]', shell),
		tableWrap: pick('[data-sbs-table-wrap]', shell),
		search: pick('[data-sbs-search]', shell),
		tierSelect: pick('[data-sbs-plan]', shell),
		cycleSelect: pick('[data-sbs-cycle]', shell),
		resultCount: pick('[data-sbs-count-text]', shell),
		empty: pick('[data-sbs-empty]', shell),
		pager: pick('[data-sbs-pager]', shell),
		pageSize: pick('[data-basalt-pager-size]', shell),
		drawer: document.getElementById('sbs-drawer'),
	};

	start();

	function start() {
		let index = 0;
		for (const sub of everyone) {
			/* Named accounts bring their own ids; the crowd gets numbered. */
			if (!sub.id) sub.id = `#${10240 + index * 7 + (avatarTone(sub.name) % 7)}`;
			index++;
		}

		ui.tiles.addEventListener('click', onTileClick);
		wireListControls();

		const offcanvas = window.bootstrap ? bootstrap.Offcanvas.getOrCreateInstance(ui.drawer) : null;
		const stepper = window.Basalt.drawer
			? window.Basalt.drawer.recordNav(ui.drawer, { valueOf: () => Math.max(1, stepList.length) }, (at) => {
					if (stepList[at]) fillDrawer(stepList[at]);
				})
			: null;
		wireDrawer(offcanvas, stepper);

		pick('[data-sbs-export]', shell).addEventListener('click', downloadCsv);

		paintTiles();
		paintTabCounts();
		paintList();
		(window.Basalt.settled || Promise.resolve()).then(revealSparklines);
	}

	/* The sparklines draw themselves in the first time the tiles scroll into view. */
	function revealSparklines() {
		if (!('IntersectionObserver' in window)) {
			ui.tiles.classList.add('is-drawn');
			waveTiles();
			return;
		}
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watcher.disconnect();
				ui.tiles.classList.add('is-drawn');
				waveTiles();
			},
			{ rootMargin: '0px 0px -40px 0px' },
		);
		watcher.observe(ui.tiles);
	}

	/* The rows come from two places: the named customers and a seeded crowd. */

	/**
	 * The named customers from the shared account records, reshaped into rows.
	 * Each row carries:
	 *   name, contact, email, city   who the customer is
	 *   plan       starter | growth | enterprise
	 *   cycle      month | year
	 *   seats      seats paid for; used is how many have a person on them
	 *   route, portal  per-seat add-ons; sms counts 1,000-message blocks
	 *   since      first paid day, or the first trial day
	 *   next       the date that matters next: the coming bill, the yearly
	 *              renewal, the last day of a trial or a cancellation, or
	 *              for a past-due account the bill that failed
	 *   status     active | risk | trial | pastdue | canceling
	 *   note       why the status is what it is, shown in the drawer
	 *   acct, who  the account page and the buyer's contact page
	 */
	function namedAccounts() {
		return window.Basalt.data.accounts.list().map((account) => {
			const buyer = account.people.find((person) => person.main) || account.people[0];
			/* An active account whose health score is under 45 is flagged at risk. */
			const flagged = account.status === 'active' && account.health != null && account.health < 45;
			return {
				id: account.sub,
				acct: account.id,
				who: buyer.key,
				name: account.name,
				contact: buyer.name,
				email: buyer.email,
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

	/**
	 * The seeded crowd of everyday accounts. A fixed seed means every visit
	 * gets the same rows, in the same order.
	 */
	function buildCrowd() {
		const random = seededRandom(20261009);
		const takenNames = new Set(named.map((sub) => sub.name));
		const earliest = parseDay('2021-01-04').getTime();
		const spread = parseDay('2026-09-25').getTime() - earliest;
		const crowd = [];

		function choose(pool) {
			return pool[Math.floor(random() * pool.length)];
		}

		function between(low, high) {
			return low + Math.floor(random() * (high - low + 1));
		}

		function unusedCompanyName() {
			let candidate;
			do {
				candidate =
					random() < 0.55
						? `${choose(TOWN_WORDS)} ${choose(TRADES)}`
						: `${choose(FAMILY_NAMES)}${random() < 0.2 ? ' & Sons ' : ' '}${choose(TRADES)}`;
			} while (takenNames.has(candidate));
			takenNames.add(candidate);
			return candidate;
		}

		function newcomer(tier) {
			const company = unusedCompanyName();
			const [city, domainEnd] = choose(HOME_CITIES);
			const given = choose(GIVEN_NAMES);
			const slug = company
				.toLowerCase()
				.replace(/&/g, 'and')
				.replace(/[^a-z]/g, '');
			return {
				name: company,
				contact: `${given} ${choose(FAMILY_NAMES)}`,
				email: `${given.toLowerCase()}@${slug}.${domainEnd}`,
				city,
				plan: tier,
			};
		}

		/* Paying accounts, first paid somewhere between January 2021 and late
       September 2026. Monthly ones bill on that day each month; yearly
       ones renew on its anniversary. */
		for (const tier of TIER_KEYS) {
			const profile = TIER_PROFILES[tier];
			const alreadyNamed = named.filter((sub) => sub.plan === tier && isPaying(sub)).length;
			for (let made = 0; made < TIER_GOALS[tier].accounts - alreadyNamed; made++) {
				const sub = newcomer(tier);
				sub.cycle = random() < profile.yearly ? 'year' : 'month';
				sub.seats = between(profile.seats[0], profile.seats[1]);
				sub.used = Math.max(1, sub.seats - Math.floor(random() * (sub.seats * 0.15 + 1)));
				sub.route = random() < profile.route;
				sub.portal = random() < profile.portal;
				sub.sms = random() < profile.sms ? between(1, 4) : 0;
				sub.since = isoDay(new Date(earliest + Math.floor(random() * spread)));
				sub.next = firstAfterToday(sub.since, sub.cycle === 'year' ? 12 : 1);
				sub.status = 'active';
				crowd.push(sub);
			}
		}

		/* The remaining trials last 14 days and began within the past week. */
		const trialsToAdd = TRIAL_COUNT - named.filter((sub) => sub.status === 'trial').length;
		for (let made = 0; made < trialsToAdd; made++) {
			const tier = random() < 0.5 ? 'starter' : random() < 0.8 ? 'growth' : 'enterprise';
			const sub = newcomer(tier);
			const profile = TIER_PROFILES[tier];
			sub.cycle = 'month';
			sub.seats = between(profile.seats[0], Math.min(profile.seats[1], 20));
			sub.used = Math.max(1, sub.seats - between(0, 2));
			sub.since = shiftDays(NOW, -between(0, 6));
			sub.next = shiftDays(sub.since, 14);
			sub.status = 'trial';
			crowd.push(sub);
		}

		/* Seats are nudged up or down until each tier earns its goal, so every
       figure on the page is the sum of the rows below it. */
		for (const tier of TIER_KEYS) {
			const adjustable = crowd.filter((sub) => sub.plan === tier && isPaying(sub));
			const payers = named.concat(adjustable).filter((sub) => sub.plan === tier && isPaying(sub));
			let earned = payers.reduce((sum, sub) => sum + fullMonthly(sub), 0);
			const goal = TIER_GOALS[tier].mrr;
			const fewestSeats = TIER_PROFILES[tier].seats[0];
			let tries = 0;
			while (Math.abs(earned - goal) > 40 && tries++ < 200000) {
				const sub = adjustable[Math.floor(random() * adjustable.length)];
				const before = fullMonthly(sub);
				if (earned < goal) {
					sub.seats += 1;
				} else if (sub.seats > fewestSeats) {
					sub.seats -= 1;
					sub.used = Math.min(sub.used, sub.seats);
				} else {
					continue;
				}
				earned += fullMonthly(sub) - before;
			}
		}

		return crowd;
	}

	/** A small seeded generator (mulberry32) returning numbers in [0, 1). */
	function seededRandom(seed) {
		let cursor = seed;
		return () => {
			cursor = (cursor + 0x6d2b79f5) | 0;
			let mixed = Math.imul(cursor ^ (cursor >>> 15), 1 | cursor);
			mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* Steps a billing date forward a cycle at a time until it is in the future. */
	function firstAfterToday(since, monthsPerCycle) {
		let billDay = since;
		while (billDay <= NOW) billDay = shiftMonths(billDay, monthsPerCycle);
		return billDay;
	}

	/* What one subscription is worth each month, line by line. */

	function perSeatMonthly(sub) {
		const listPrice = TIERS[sub.plan].price;
		return sub.cycle === 'year' ? (listPrice * 10) / 12 : listPrice;
	}

	/** The bill broken into lines: the plan, then any add-ons, then SMS. */
	function charges(sub) {
		const seatRate = perSeatMonthly(sub);
		const yearlyNote = sub.cycle === 'year' ? ', billed yearly' : '';
		const breakdown = [
			{
				label: `${TIERS[sub.plan].name} plan`,
				detail: `${withCommas(sub.seats)} seats × ${dollars(toCents(seatRate))}${yearlyNote}`,
				amount: toCents(seatRate * sub.seats),
			},
		];
		for (const [key, extra] of Object.entries(EXTRAS)) {
			if (sub[key])
				breakdown.push({
					label: extra.name,
					detail: `${withCommas(sub.seats)} seats × ${roundDollars(extra.per)}`,
					amount: extra.per * sub.seats,
				});
		}
		if (sub.sms)
			breakdown.push({
				label: 'SMS credits',
				detail: `${withCommas(sub.sms * 1000)} messages a month`,
				amount: sub.sms * SMS_BLOCK_PRICE,
			});
		return breakdown;
	}

	/* Monthly worth before trials are taken into account. */
	function fullMonthly(sub) {
		/* The same sum as the lines in charges(), without writing their labels:
		   the seeded crowd asks for this hundreds of thousands of times. */
		let total = toCents(perSeatMonthly(sub) * sub.seats);
		for (const [key, extra] of Object.entries(EXTRAS)) if (sub[key]) total += extra.per * sub.seats;
		if (sub.sms) total += sub.sms * SMS_BLOCK_PRICE;
		return toCents(total);
	}

	/* A trial pays nothing until it converts. */
	function monthlyRevenue(sub) {
		return sub.status === 'trial' ? 0 : fullMonthly(sub);
	}

	function isPaying(sub) {
		return sub.status !== 'trial';
	}

	function seatsInUsePercent(sub) {
		return Math.round((sub.used / sub.seats) * 100);
	}

	/* One revenue tile per tier, each with its year as a sparkline. */

	function paintTiles() {
		const perTier = TIER_KEYS.map((key) => {
			const payers = everyone.filter((sub) => sub.plan === key && isPaying(sub));
			return {
				key,
				accounts: payers.length,
				seats: payers.reduce((sum, sub) => sum + sub.seats, 0),
				revenue: payers.reduce((sum, sub) => sum + monthlyRevenue(sub), 0),
			};
		});
		const monthNow = perTier.reduce((sum, tier) => sum + tier.revenue, 0);
		const monthAgoYear = perTier.reduce((sum, tier) => sum + tier.revenue * YEAR_CURVE[tier.key][0], 0);
		const payingCount = everyone.filter(isPaying).length;

		pick('[data-sbs-mix-sum]', shell).innerHTML =
			`<strong>${compactDollars(monthNow)}</strong> a month from ${counted(payingCount, 'paying account')}, up ${Math.round((monthNow / monthAgoYear - 1) * 100)}% since last October.`;
		ui.tiles.innerHTML = perTier.map((tier) => tierTile(tier, monthNow)).join('');
	}

	function tierTile(tier, monthNow) {
		const curve = YEAR_CURVE[tier.key];
		const growth = Math.round((1 / curve[0] - 1) * 100);
		const yearlyCount = everyone.filter(
			(sub) => sub.plan === tier.key && isPaying(sub) && sub.cycle === 'year',
		).length;
		const dot = '<span class="sbs-tile-dot" aria-hidden="true">·</span>';
		return (
			`<li class="sbs-tile sbs-tone-${tier.key}">` +
			`<button type="button" class="sbs-tile-btn" aria-pressed="${criteria.tier === tier.key}" data-sbs-plan-pick="${tier.key}">` +
			`<span class="sbs-tile-top"><span class="sbs-tile-name">${TIERS[tier.key].name}</span><span class="sbs-tile-price">$${TIERS[tier.key].price} a seat</span></span>` +
			`<span class="sbs-tile-value">${compactDollars(tier.revenue)}<span class="sbs-tile-unit"> a month</span></span>` +
			`<span class="sbs-tile-change"><i class="bi bi-arrow-up-right" aria-hidden="true"></i><span>${growth}% in a year</span>${dot}<span>${Math.round((tier.revenue / monthNow) * 100)}% of MRR</span></span>${sparkline(
				curve.map((share) => tier.revenue * share),
			)}<span class="sbs-tile-foot"><span>${counted(tier.accounts, 'account')}</span>${dot}<span>${counted(tier.seats, 'seat')}</span>${dot}<span>${Math.round((yearlyCount / tier.accounts) * 100)}% yearly</span></span>` +
			`</button></li>`
		);
	}

	/**
	 * The tier's year as a small line inside a 120 by 40 box that stretches
	 * to the tile. The quietest month sits near the floor, so even a flat
	 * year still shows a shape.
	 */
	function sparkline(points) {
		const floor = Math.min(...points) * 0.97;
		const ceiling = Math.max(...points);
		const path = points
			.map((point, index) => {
				const x = (index / (points.length - 1)) * 120;
				const y = 36 - ((point - floor) / (ceiling - floor || 1)) * 32;
				return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ');
		return `<svg class="sbs-spark" viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="sbs-spark-area" d="${path} L120 40 L0 40 Z"/><path class="sbs-spark-line" d="${path}"/></svg>`;
	}

	/* The cards ripple left to right when they first come into view and
	   again each time one is pressed, so the switch is seen. */
	let waveDone = 0;
	function waveTiles() {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		ui.tiles.classList.remove('is-waving');
		void ui.tiles.offsetWidth;
		ui.tiles.classList.add('is-waving');
		clearTimeout(waveDone);
		waveDone = setTimeout(() => ui.tiles.classList.remove('is-waving'), 900);
	}

	/* A tile narrows the list to its tier; pressing it again lifts that. */
	function onTileClick(event) {
		const tile = event.target.closest('[data-sbs-plan-pick]');
		if (!tile) return;
		const key = tile.getAttribute('data-sbs-plan-pick');
		criteria.tier = criteria.tier === key ? 'all' : key;
		ui.tierSelect.value = criteria.tier;
		syncTilePressed();
		paintList();
		waveTiles();
		say(criteria.tier === 'all' ? 'Showing every plan' : `Showing ${TIERS[key].name} accounts`);
	}

	function syncTilePressed() {
		for (const tile of pickAll('[data-sbs-plan-pick]', ui.tiles)) {
			tile.setAttribute('aria-pressed', String(tile.getAttribute('data-sbs-plan-pick') === criteria.tier));
		}
	}

	/* The list itself, with its tabs, search, filters, sorting and pager. */

	function wireListControls() {
		for (const radio of pickAll('input[name="sbs-view"]', shell)) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				criteria.tab = radio.value;
				[criteria.sortKey, criteria.sortDir] = TAB_ORDER[radio.value];
				paintList();
			});
		}

		ui.search.addEventListener('input', () => {
			clearTimeout(typingPause);
			typingPause = setTimeout(() => {
				criteria.query = ui.search.value.trim();
				paintList();
			}, 160);
		});
		ui.tierSelect.addEventListener('change', () => {
			criteria.tier = ui.tierSelect.value;
			syncTilePressed();
			paintList();
		});
		ui.cycleSelect.addEventListener('change', () => {
			criteria.cycle = ui.cycleSelect.value;
			paintList();
		});
		pick('[data-sbs-clear]', shell).addEventListener('click', resetFilters);

		for (const button of pickAll('[data-sbs-sort]', shell)) {
			button.addEventListener('click', () => {
				const key = button.getAttribute('data-sbs-sort');
				if (criteria.sortKey === key) {
					criteria.sortDir = criteria.sortDir === 'asc' ? 'desc' : 'asc';
				} else {
					criteria.sortKey = key;
					criteria.sortDir = key === 'name' || key === 'date' ? 'asc' : 'desc';
				}
				paintList();
			});
		}
	}

	function resetFilters() {
		ui.search.value = '';
		ui.tierSelect.value = 'all';
		ui.cycleSelect.value = 'all';
		Object.assign(criteria, { query: '', tier: 'all', cycle: 'all' });
		syncTilePressed();
		paintList();
		ui.search.focus();
	}

	function paintTabCounts() {
		for (const [key, test] of Object.entries(TABS)) {
			pick(`[data-sbs-count="${key}"]`, shell).textContent = withCommas(everyone.filter(test).length);
		}
		const trialing = everyone.filter((sub) => sub.status === 'trial').length;
		ui.summary.textContent = `${withCommas(everyone.length)} accounts: ${withCommas(everyone.length - trialing)} paying and ${trialing} in a free trial. Soonest date first.`;
	}

	/**
	 * Filters, sorts and redraws the list.
	 * @param {boolean} [stayOnPage] keep the current page after an edit rather than going back to page 1
	 */
	function paintList(stayOnPage) {
		matching = sortRows(everyone.filter(passesFilters));
		const found = matching.length;
		const narrowed = !!(criteria.query || criteria.tier !== 'all' || criteria.cycle !== 'all');
		const tabSize = everyone.filter(TABS[criteria.tab]).length;

		ui.tableWrap.hidden = !found;
		ui.pager.hidden = !found;
		ui.empty.hidden = !!found;
		if (!found) explainEmpty(narrowed);

		if (!found) ui.resultCount.textContent = '';
		else
			ui.resultCount.textContent =
				found === tabSize
					? counted(found, 'subscription')
					: `${withCommas(found)} of ${withCommas(tabSize)} match`;

		pagingOptions.total = found;
		if (!paging) {
			paging = window.Basalt.pager ? window.Basalt.pager(ui.pager, pagingOptions) : null;
			if (!paging) paintRows(1, found);
		} else {
			const rowsPerPage = parseInt(ui.pageSize.value, 10) || 10;
			const pageCount = Math.max(1, Math.ceil(found / rowsPerPage));
			paging.setTotal(pageCount);
			paging.set(stayOnPage ? Math.min(paging.get(), pageCount) : 1);
			ui.pageSize.dispatchEvent(new Event('change'));
		}
		paintSortHeaders();
		justChangedId = null;
	}

	function explainEmpty(narrowed) {
		pick('[data-sbs-empty-title]', shell).textContent = narrowed
			? 'No subscription matches'
			: 'Nothing here right now';
		pick('[data-sbs-empty-text]', shell).textContent = narrowed
			? 'Try another name or city, or show every plan and billing period.'
			: TAB_EMPTY_TEXT[criteria.tab] || '';
		pick('[data-sbs-clear]', shell).hidden = !narrowed;
	}

	function passesFilters(sub) {
		return (
			TABS[criteria.tab](sub) &&
			(criteria.tier === 'all' || sub.plan === criteria.tier) &&
			(criteria.cycle === 'all' || sub.cycle === criteria.cycle) &&
			(!criteria.query || textMatches(searchText(sub), criteria.query))
		);
	}

	function searchText(sub) {
		return [sub.name, sub.contact, sub.email, sub.city, sub.id, TIERS[sub.plan].name].join(' ');
	}

	/* Sorts by the chosen column; ties fall back to the account name. */
	function sortRows(rows) {
		const direction = criteria.sortDir === 'asc' ? 1 : -1;
		const comparers = {
			name: (a, b) => a.name.localeCompare(b.name),
			seats: (a, b) => a.seats - b.seats,
			mrr: (a, b) => monthlyRevenue(a) - monthlyRevenue(b) || fullMonthly(a) - fullMonthly(b),
			date: (a, b) => a.next.localeCompare(b.next),
		};
		const compare = comparers[criteria.sortKey];
		return rows.slice().sort((a, b) => compare(a, b) * direction || a.name.localeCompare(b.name));
	}

	function paintSortHeaders() {
		for (const header of pickAll('[data-sbs-th]', shell)) {
			const arrow = pick('.bi', header);
			if (header.getAttribute('data-sbs-th') !== criteria.sortKey) {
				header.removeAttribute('aria-sort');
				arrow.className = 'bi bi-arrow-down-up sbs-sort-idle';
				continue;
			}
			const rising = criteria.sortDir === 'asc';
			header.setAttribute('aria-sort', rising ? 'ascending' : 'descending');
			arrow.className = `bi ${rising ? 'bi-arrow-up' : 'bi-arrow-down'}`;
		}
	}

	/* Called by the pager with the 1-based range of rows to show. */
	function paintRows(from, to) {
		onScreen = matching.slice(from - 1, to);
		ui.tbody.innerHTML = onScreen.map(subscriptionRow).join('');
		if (window.Basalt.tips) window.Basalt.tips(ui.tbody);
	}

	function subscriptionRow(sub) {
		const rowClasses = `sbs-row${sub.id === highlightedId ? ' is-selected' : ''}${sub.id === justChangedId ? ' is-fresh' : ''}`;
		const fullPage = detailUrl(sub);
		const safeName = htmlSafe(sub.name);
		const revenueCell = isPaying(sub)
			? `<span class="sbs-amt">${roundDollars(monthlyRevenue(sub))}</span>`
			: '<span class="sbs-sub sbs-sub-flat">Free</span>';
		return [
			`<tr class="${rowClasses}" data-sbs-id="${sub.id}">`,
			`<td class="sbs-col-who"><div class="sbs-who">${avatar(sub)}<div class="sbs-who-text"><a class="sbs-who-name" href="${fullPage}">${safeName}</a><span class="sbs-sub">${htmlSafe(sub.city)}</span></div></div></td>`,
			`<td class="sbs-col-plan">${tierChip(sub)}<span class="sbs-sub">${sub.status === 'trial' ? 'Free trial' : cycleLabel(sub)}</span></td>`,
			`<td class="sbs-col-seats"><span class="sbs-seats">${withCommas(sub.used)} of ${withCommas(sub.seats)}</span>${seatBar(sub)}</td>`,
			`<td class="sbs-col-mrr">${revenueCell}</td>`,
			`<td class="sbs-col-date"><span class="sbs-date">${shortDay(sub.next)}</span><span class="sbs-sub${sub.status === 'pastdue' ? ' sbs-sub-late' : ''}">${dateCaption(sub)}</span></td>`,
			`<td class="sbs-col-status">${stateChip(sub)}</td>`,
			'<td class="sbs-col-go"><span class="basalt-row-actions">',
			`<button type="button" class="btn btn-icon btn-sm" data-sbs-open="${sub.id}" aria-label="Quick view: ${safeName}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`,
			`<a class="btn btn-icon btn-sm" href="${fullPage}" aria-label="Open full page: ${safeName}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`,
			'</span></td></tr>',
		].join('');
	}

	/* Seats in use as a short bar. It turns amber below two thirds, often
     the first hint that an account is about to shrink or leave. */
	function seatBar(sub) {
		const percent = seatsInUsePercent(sub);
		return `<span class="sbs-meter${percent < 67 ? ' is-low' : ''}" aria-hidden="true"><span class="sbs-meter-fill" style="width: ${percent}%"></span></span>`;
	}

	/* The small line under a date says what kind of date it is. */
	function dateCaption(sub) {
		const days = dayGap(NOW, sub.next);
		switch (sub.status) {
			case 'pastdue':
				return days === 0 ? 'Failed today' : `${counted(-days, 'day')} overdue`;
			case 'trial':
				if (days === 0) return 'Trial ends today';
				return days === 1 ? 'Trial ends tomorrow' : `Trial ends in ${days} days`;
			case 'canceling':
				return `Ends in ${counted(days, 'day')}`;
			default: {
				const verb = sub.cycle === 'year' ? 'Renews' : 'Bills';
				return days === 1 ? `${verb} tomorrow` : `${verb} in ${days} days`;
			}
		}
	}

	function stateChip(sub) {
		const { tone, word } = STATUS_LOOK[sub.status];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${word}</span>`;
	}

	function avatar(sub) {
		return `<span class="basalt-avatar sbs-mark basalt-avatar-tone-${avatarTone(sub.name)}" aria-hidden="true">${htmlSafe(initialsOf(sub.name))}</span>`;
	}

	function tierChip(sub) {
		return `<span class="sbs-plan sbs-tone-${sub.plan}">${TIERS[sub.plan].name}</span>`;
	}

	function cycleLabel(sub) {
		return sub.cycle === 'year' ? 'Yearly' : 'Monthly';
	}

	function detailUrl(sub) {
		return `subscription-details.html?id=${encodeURIComponent(sub.id)}`;
	}

	/* The quick view drawer that opens beside the list. */

	function wireDrawer(offcanvas, stepper) {
		const { drawer, tbody } = ui;

		/* Opens on the row's panel button; stepping walks the rows on screen. */
		function openQuickView(id) {
			stepList = onScreen.slice();
			const position = stepList.findIndex((sub) => sub.id === id);
			if (position < 0 || !offcanvas) return;
			if (stepper) stepper.go(position, 0);
			else fillDrawer(stepList[position]);
			pick('.basalt-drawer-nav', drawer).hidden = stepList.length < 2;
			offcanvas.show();
		}

		/* The panel icon opens the quick view. Anywhere else on the row opens
       the full page, in a new tab on a middle click or with Cmd or Ctrl,
       the way a link behaves. */
		function onRowPress(event) {
			if (event.button > 1 || event.target.closest('a')) return;
			const quick = event.target.closest('[data-sbs-open]');
			if (quick) {
				if (event.button === 0) openQuickView(quick.getAttribute('data-sbs-open'));
				return;
			}
			const row = event.target.closest('.sbs-row');
			if (!row) return;
			const url = detailUrl({ id: row.getAttribute('data-sbs-id') });
			if (event.button === 1 || event.metaKey || event.ctrlKey) window.open(url, '_blank');
			else location.href = url;
		}

		tbody.addEventListener('click', onRowPress);
		tbody.addEventListener('auxclick', (event) => {
			if (event.button === 1) onRowPress(event);
		});
		drawer.addEventListener('show.bs.offcanvas', () => moveToasts('bottom-center'));
		drawer.addEventListener('shown.bs.offcanvas', () => drawerSlot('name').focus());
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			moveToasts('bottom-end');
			const closedId = highlightedId;
			highlightedId = null;
			for (const row of pickAll('.sbs-row.is-selected', tbody)) row.classList.remove('is-selected');
			const trigger = closedId && pick(`[data-sbs-open="${closedId}"]`, tbody);
			if (trigger) trigger.focus({ preventScroll: true });
		});
		drawerSlot('foot').addEventListener('click', onDrawerAction);
	}

	function fillDrawer(sub) {
		inDrawer = sub;
		const badge = drawerSlot('mark');
		badge.className = `basalt-avatar sbs-mark sbs-mark-lg basalt-avatar-tone-${avatarTone(sub.name)}`;
		badge.textContent = initialsOf(sub.name);
		drawerSlot('name').textContent = sub.name;
		drawerSlot('sub').textContent =
			`${TIERS[sub.plan].name} · ${sub.status === 'trial' ? 'Free trial' : cycleLabel(sub)}`;
		drawerSlot('status').innerHTML = stateChip(sub);
		drawerSlot('lead').innerHTML = drawerLead(sub);

		const breakdown = charges(sub);
		breakdown.push({
			label: sub.status === 'trial' ? 'After the trial' : 'MRR',
			detail: '',
			amount: fullMonthly(sub),
			total: true,
		});
		drawerSlot('lines').innerHTML = breakdown.map(chargeItem).join('');

		const percent = seatsInUsePercent(sub);
		const bar = drawerSlot('meter');
		bar.className = `sbs-meter sbs-meter-lg${percent < 67 ? ' is-low' : ''}`;
		pick('.sbs-meter-fill', bar).style.width = `${percent}%`;
		const spare = sub.used === sub.seats ? ', none spare.' : `, ${withCommas(sub.seats - sub.used)} spare.`;
		drawerSlot('seats').textContent = `${withCommas(sub.used)} of ${counted(sub.seats, 'seat')} in use${spare}`;

		const invoices = recentBills(sub);
		drawerSlot('bills').innerHTML = invoices.map(billItem).join('');
		drawerSlot('bills').hidden = !invoices.length;
		drawerSlot('no-bills').hidden = !!invoices.length;
		drawerSlot('no-bills').textContent =
			sub.status === 'trial' ? 'Nothing billed yet. The first bill comes when they choose a plan.' : '';
		drawerSlot('facts').innerHTML = keyFacts(sub)
			.map(([term, value]) => `<div class="sbs-fact"><dt>${term}</dt><dd>${value}</dd></div>`)
			.join('');

		const footer = drawerSlot('foot');
		for (const leftover of pickAll('[data-sbs-act], a[href^="mailto:"]', footer)) leftover.remove();
		footer.insertAdjacentHTML('afterbegin', quickAction(sub));
		footer.hidden = !footer.children.length;
		drawerSlot('page').href = detailUrl(sub);

		highlightedId = sub.id;
		for (const row of pickAll('.sbs-row', ui.tbody)) {
			row.classList.toggle('is-selected', row.getAttribute('data-sbs-id') === sub.id);
		}
	}

	function chargeItem(line) {
		const detail = line.detail ? `<span class="sbs-sub">${htmlSafe(line.detail)}</span>` : '';
		return `<li class="sbs-line${line.total ? ' sbs-line-total' : ''}"><span class="sbs-line-text"><span class="sbs-line-name">${htmlSafe(line.label)}</span>${detail}</span><span class="sbs-line-amt">${dollars(line.amount)}</span></li>`;
	}

	function billItem(bill) {
		const outcome = bill.failed
			? '<span class="basalt-status basalt-status-dot basalt-status-danger">Unpaid</span>'
			: '<span class="basalt-status basalt-status-dot basalt-status-success">Paid</span>';
		return `<li class="sbs-bill"><span class="sbs-bill-text">${bill.local ? `<span>${bill.number}</span>` : `<a class="sbs-link" href="invoice-details.html?id=${encodeURIComponent(bill.number)}">${bill.number}</a>`}<span class="sbs-sub">${shortDay(bill.date)}</span></span><span class="sbs-bill-amt">${dollars(bill.due)}</span>${outcome}</li>`;
	}

	/* One sentence on where the subscription stands, money first. */
	function drawerLead(sub) {
		const story = sub.note ? ` ${htmlSafe(sub.note)}` : '';
		const leads = {
			trial: () =>
				`Trying ${TIERS[sub.plan].name} with ${counted(sub.seats, 'seat')} until <strong>${longDay(sub.next)}</strong>.`,
			canceling: () => `Ends on <strong>${longDay(sub.next)}</strong>; nothing more will be charged.`,
			pastdue: () =>
				`<strong>${dollars(sub.cycle === 'year' ? monthlyRevenue(sub) * 12 : monthlyRevenue(sub))}</strong> unpaid since ${longDay(sub.next)}.`,
		};
		if (leads[sub.status]) return leads[sub.status]() + story;
		const billing =
			sub.cycle === 'year'
				? `Pays <strong>${dollars(monthlyRevenue(sub) * 12)}</strong> a year. Renews on <strong>${longDay(sub.next)}</strong>.`
				: `Pays <strong>${dollars(monthlyRevenue(sub))}</strong> a month. The next bill is on ${longDay(sub.next)}.`;
		return billing + story;
	}

	/**
	 * The latest bills, newest first: two for a yearly plan, three for a
	 * monthly one. Named accounts use the bills their own page shows; the
	 * rest are worked out here, have no invoice of their own and are local.
	 */
	function recentBills(sub) {
		if (sub.status === 'trial') return [];
		if (sub.acct) {
			const accounts = window.Basalt.data.accounts;
			return accounts
				.bills(accounts.find(sub.acct))
				.slice(0, 2)
				.map((bill) => ({ date: bill.at, number: bill.no, due: bill.amount, failed: bill.state === 'unpaid' }));
		}
		const months = sub.cycle === 'year' ? 12 : 1;
		const limit = months === 12 ? 2 : 3;
		const due = toCents(fullMonthly(sub) * months);
		const serial = Number(sub.id.replace(/\D/g, ''));
		const history = [];
		let billedOn = sub.status === 'pastdue' ? sub.next : shiftMonths(sub.next, -months);
		for (let back = 0; back < limit && billedOn >= sub.since; back++) {
			const number = `#${1000 + ((serial * 37 + back * 11) % 9000)}`;
			history.push({ date: billedOn, number, due, failed: sub.status === 'pastdue' && back === 0, local: true });
			billedOn = shiftMonths(billedOn, -months);
		}
		return history;
	}

	function keyFacts(sub) {
		const customer = sub.acct
			? `<a class="sbs-link" href="company-details.html?id=${encodeURIComponent(sub.acct)}">${htmlSafe(sub.name)}</a>`
			: htmlSafe(sub.name);
		const owner = sub.who
			? `<a class="sbs-link" href="person-details.html?id=${encodeURIComponent(sub.who)}">${htmlSafe(sub.contact)}</a>`
			: htmlSafe(sub.contact);
		return [
			['Customer', `${customer}<span class="sbs-sub">${htmlSafe(sub.city)}</span>`],
			['Owner', `${owner}<span class="sbs-sub">${htmlSafe(sub.email)}</span>`],
			[sub.status === 'trial' ? 'Trial started' : 'Customer since', longDay(sub.since)],
			['Subscription', htmlSafe(sub.id)],
		];
	}

	/* A single shortcut suited to the status; the rest lives on the full page. */
	function quickAction(sub) {
		if (sub.status === 'pastdue') {
			return sub.linkSent
				? ''
				: '<button type="button" class="btn btn-outline-secondary" data-sbs-act="link"><i class="bi bi-link-45deg me-1" aria-hidden="true"></i>Send payment link</button>';
		}
		if (sub.status === 'trial') {
			return sub.extended
				? ''
				: '<button type="button" class="btn btn-outline-secondary" data-sbs-act="extend"><i class="bi bi-hourglass-split me-1" aria-hidden="true"></i>Extend trial</button>';
		}
		return `<a class="btn btn-outline-secondary" href="mailto:${htmlSafe(sub.email)}"><i class="bi bi-envelope me-1" aria-hidden="true"></i>Email owner</a>`;
	}

	function onDrawerAction(event) {
		const button = event.target.closest('[data-sbs-act]');
		if (!button || !inDrawer) return;
		const sub = inDrawer;
		const earlier = sub.note ? `${sub.note} ` : '';
		if (button.getAttribute('data-sbs-act') === 'link') {
			sub.linkSent = true;
			sub.note = `${earlier}Payment link sent on ${longDay(NOW)}.`;
			notify({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Payment link sent',
				text: `${sub.contact} can pay by card or bank transfer from ${sub.email}.`,
			});
		} else {
			sub.next = shiftDays(sub.next, 7);
			sub.extended = true;
			sub.note = `${earlier}Trial extended by a week on ${longDay(NOW)}.`;
			notify({
				tone: 'success',
				icon: 'bi-hourglass-split',
				title: 'Trial extended',
				text: `${sub.name} can try Fieldline until ${longDay(sub.next)}.`,
			});
		}
		justChangedId = sub.id;
		paintList(true);
		fillDrawer(sub);
		drawerSlot('page').focus();
	}

	function drawerSlot(slotName) {
		return pick(`[data-sbs-d="${slotName}"]`, ui.drawer);
	}

	function moveToasts(corner) {
		if (window.Basalt.toasts && window.Basalt.toasts.position) window.Basalt.toasts.position(corner);
	}

	/* Export writes the rows that pass the current criteria to a CSV file. */

	function downloadCsv() {
		const header = [
			'Subscription',
			'Account',
			'Owner',
			'Email',
			'City',
			'Plan',
			'Billing',
			'Seats',
			'Seats in use',
			'MRR',
			'Next date',
			'Status',
		];
		const body = matching.map((sub) => [
			sub.id,
			sub.name,
			sub.contact,
			sub.email,
			sub.city,
			TIERS[sub.plan].name,
			cycleLabel(sub),
			sub.seats,
			sub.used,
			monthlyRevenue(sub).toFixed(2),
			sub.next,
			STATUS_LOOK[sub.status].word,
		]);
		const quoteCell = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
		const csv = [header, ...body].map((cells) => cells.map(quoteCell).join(',')).join('\r\n');

		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		link.download = `subscriptions-${NOW}.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: 'Export ready',
			text: `${counted(matching.length, 'subscription')} saved as ${link.download}.`,
		});
		say('Export ready');
	}

	/* Dates travel as YYYY-MM-DD strings and are parsed only when needed. */

	function parseDay(text) {
		const [year, month, day] = text.slice(0, 10).split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function isoDay(date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	function shiftDays(text, days) {
		const date = parseDay(text);
		date.setDate(date.getDate() + days);
		return isoDay(date);
	}

	/* Same day of the month, months later, capped at the 28th so it exists in every month. */
	function shiftMonths(text, months) {
		const date = parseDay(text);
		return isoDay(new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), 28)));
	}

	function dayGap(from, to) {
		return Math.round((parseDay(to) - parseDay(from)) / 86400000);
	}

	/* "Oct 9", with the year added only when it is not this one. A no-break
     space holds the year to the comma so a narrow column never strands it. */
	function shortDay(text) {
		const date = parseDay(text);
		const otherYear = date.getFullYear() !== CURRENT_YEAR ? `,\u00a0${date.getFullYear()}` : '';
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}${otherYear}`;
	}

	function longDay(text) {
		const date = parseDay(text);
		const otherYear = date.getFullYear() !== CURRENT_YEAR ? `, ${date.getFullYear()}` : '';
		return `${MONTH_FULL[date.getMonth()]} ${date.getDate()}${otherYear}`;
	}

	/* Formatting for money, counts and names, plus small text helpers. */

	function toCents(value) {
		return Math.round(value * 100) / 100;
	}

	function dollars(value) {
		return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function roundDollars(value) {
		return `$${Math.round(value).toLocaleString('en-US')}`;
	}

	/* $880k, $1.2M and so on, for headline figures. */
	function compactDollars(value) {
		if (value >= 1e6) return `$${(value / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
		if (value >= 1000) return `$${Math.round(value / 1000).toLocaleString('en-US')}k`;
		return roundDollars(value);
	}

	function withCommas(value) {
		return value.toLocaleString('en-US');
	}

	function counted(value, singular, pluralForm) {
		return `${withCommas(value)} ${value === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function initialsOf(company) {
		return company
			.replace(/[^A-Za-z ]/g, '')
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase();
	}

	/* A stable avatar color from 1 to 6, worked out from the name. */
	function avatarTone(company) {
		let total = 0;
		for (const char of company) total += char.charCodeAt(0);
		return (total % 6) + 1;
	}

	function textMatches(text, query) {
		if (window.Basalt && window.Basalt.matchesQuery) return window.Basalt.matchesQuery(text, query);
		return text.toLowerCase().includes(query.toLowerCase());
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => entities[char]);
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	function say(message) {
		if (window.Basalt.announce) window.Basalt.announce(message);
	}

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
