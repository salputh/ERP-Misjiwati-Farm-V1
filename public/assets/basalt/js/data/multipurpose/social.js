/**
 * Demo data for the Marlo shop's social calendar, published as
 * window.Basalt.data.social and read by social-planner.html and
 * social-post-details.html, so both show a post with the same picture,
 * caption, time and numbers. social-post-details.html?id=<id> opens one.
 *
 * Load assets/basalt/js/data/multipurpose/catalog.js before this file: a post that names a
 * SKU borrows that product's photo from the catalog.
 *
 * What the object carries:
 *   now       the demo's frozen clock, 10:40 am on Friday, October 9, 2026
 *   me        the signed-in person, whose OK a draft is waiting for
 *   channels  one entry per network: id, name, icon (a Bootstrap Icons
 *             class), tone (chart color 1-8), limit (caption length, or
 *             null when there is none), shape (how the picture is cropped),
 *             handle, and usual (reach, likes, saves and clicks that an
 *             ordinary post gets there)
 *   people    job title by name for everyone on the team who writes posts
 *   posts()   a fresh copy of every post, earliest first. A post has id,
 *             title (its short planner label), at ('YYYY-MM-DDTHH:MM'),
 *             status (published, scheduled or draft), channels (the first
 *             is where it was planned), either sku (the product pictured)
 *             or photo (a photo path), caption, tags, by, written,
 *             then approved ({ by, on }) or waiting (when it was sent for
 *             approval), and for published posts results, keyed by
 *             channel as [reach, likes, saves, clicks]
 *   find(id)  a copy of one post, or null
 *   photoOf(post, w, h)  the post's picture URL at that size
 *   growth    followers on each network at the end of each of the last
 *             52 weeks, oldest first: { weeks: ['2025-10-12', …],
 *             instagram: [ … ], … }
 *   rhythm    posts sent, reach, engagement (likes and saves per hundred
 *             people reached) and clicks to the shop in each of those weeks
 *   slots     how well a post does by day and time of day, 0 to 100:
 *             { days: ['Mon', …], times: ['9 am', …], score: [[ … ], …] }
 *
 * Swapping in a real scheduler means returning posts in this shape and
 * setting now to the actual time.
 */
(() => {
	'use strict';

	const ME = 'John Armstrong';
	const CLOCK = '2026-10-09T10:40';
	const COVER_PHOTO = 'assets/basalt/images/multipurpose/social-new-season.svg';

	/* Networks are listed in the order the pages show them; the icon class
     always follows the id, so it is filled in rather than written out. */
	const NETWORKS = {
		instagram: {
			name: 'Instagram',
			tone: 8,
			limit: 2200,
			shape: 'portrait',
			handle: 'marlo.studio',
			usual: [9800, 640, 118, 84],
		},
		pinterest: {
			name: 'Pinterest',
			tone: 6,
			limit: 500,
			shape: 'tall',
			handle: 'Marlo',
			usual: [6400, 90, 410, 132],
		},
		tiktok: {
			name: 'TikTok',
			tone: 2,
			limit: 2200,
			shape: 'video',
			handle: 'marlo.studio',
			usual: [15200, 1240, 205, 48],
		},
		facebook: {
			name: 'Facebook',
			tone: 1,
			limit: null,
			shape: 'wide',
			handle: 'Marlo',
			usual: [4200, 180, 22, 61],
		},
	};

	/* Job titles by name, for everyone on the team who writes or signs off posts. */
	const JOBS = {
		'Dawn Nugent': 'Social lead',
		'Theo Marsh': 'Content writer',
		'Connie Reese': 'Shop manager',
		[ME]: 'Head of marketing',
	};

	/* Posts that have already gone out. Each one's numbers line up with its
     channels list: the first set belongs to the first channel, and so on. */
	const SENT = [
		{
			id: 'sp-201',
			status: 'published',
			at: '2026-09-29T09:00',
			title: 'Autumn/Winter 26 has arrived',
			channels: ['instagram', 'facebook'],
			photo: COVER_PHOTO,
			tags: ['#marlo', '#autumnwinter26', '#readytowear'],
			by: 'Dawn Nugent',
			written: '2026-09-24',
			approved: signedOff('2026-09-25'),
			caption:
				'Autumn/Winter 26 is in the shop. Sculpted tailoring, silk and nappa, made by hand in Maine, Oregon and Missouri.',
			numbers: [
				[14820, 1106, 231, 162],
				[5310, 214, 31, 88],
			],
		},
		{
			id: 'sp-202',
			status: 'published',
			at: '2026-10-01T12:00',
			title: 'Silk into October',
			channels: ['pinterest'],
			sku: 'ML-GOWN',
			tags: ['#silkjersey', '#eveningwear'],
			by: 'Theo Marsh',
			written: '2026-09-28',
			approved: signedOff('2026-09-29'),
			caption:
				'Our column gown in cobalt silk jersey, with the violet blazer over it once the evenings turn cool.',
			numbers: [[7120, 96, 488, 151]],
		},
		{
			id: 'sp-203',
			status: 'published',
			at: '2026-10-02T18:00',
			title: 'How the blazer is built',
			channels: ['tiktok', 'instagram'],
			photo: 'assets/basalt/images/multipurpose/blazer-detail.svg',
			tags: ['#madeinusa', '#tailoring', '#howitsmade'],
			by: 'Dawn Nugent',
			written: '2026-09-29',
			approved: signedOff('2026-09-30'),
			caption:
				'Thirty seconds at Hollis Atelier in Maine, where every blazer shoulder is shaped and finished by hand.',
			numbers: [
				[21400, 1890, 342, 57],
				[11260, 802, 164, 71],
			],
		},
		{
			id: 'sp-204',
			status: 'published',
			at: '2026-10-05T09:00',
			title: 'Organza, in motion',
			channels: ['instagram'],
			sku: 'ML-ORGZ',
			tags: ['#organza', '#couture'],
			by: 'Connie Reese',
			written: '2026-10-01',
			approved: signedOff('2026-10-02'),
			caption:
				'The tiered organza dress in motion: every ruffle pleated by hand, every tier set on a boned corset bodice.',
			numbers: [[8240, 571, 96, 118]],
		},
		{
			id: 'sp-205',
			status: 'published',
			at: '2026-10-06T12:30',
			title: 'Aftercare Plan is open',
			channels: ['facebook', 'instagram'],
			sku: 'ML-CARE',
			tags: ['#aftercare', '#buybetter'],
			by: 'Theo Marsh',
			written: '2026-10-01',
			approved: signedOff('2026-10-02'),
			caption:
				'Pressing, repairs and shoe care from your door. Aftercare Plan is $25 a month for all Marlo you own.',
			numbers: [
				[3880, 162, 19, 74],
				[9020, 688, 141, 93],
			],
		},
		{
			id: 'sp-206',
			status: 'published',
			at: '2026-10-07T19:00',
			title: 'The suit, three ways',
			channels: ['tiktok'],
			sku: 'ML-SUIT',
			tags: ['#tailoring', '#styling'],
			by: 'Dawn Nugent',
			written: '2026-10-02',
			approved: signedOff('2026-10-05'),
			caption:
				'One chalk-stripe suit, three looks: with the trench, the jacket over the gown, or worn as one. $2,450 until Oct 18.',
			numbers: [[18760, 1320, 276, 64]],
		},
		{
			id: 'sp-207',
			status: 'published',
			at: '2026-10-08T12:00',
			title: 'At the gallery opening',
			channels: ['instagram', 'facebook'],
			sku: 'ML-BLAZ',
			tags: ['#marlo', '#tailoring', '#customerstory'],
			by: 'Dawn Nugent',
			written: '2026-10-05',
			approved: signedOff('2026-10-06'),
			caption:
				'Sandra wore the sculpted shoulder blazer to a gallery opening in Stamford, and it did all the talking. Thank you, Sandra.',
			numbers: [
				[12940, 1012, 205, 97],
				[4610, 233, 28, 66],
			],
		},
		{
			id: 'sp-208',
			status: 'published',
			at: '2026-10-09T09:00',
			title: 'The trench, belted',
			channels: ['pinterest'],
			sku: 'ML-TRCH',
			tags: ['#leather', '#trenchcoat'],
			by: 'Theo Marsh',
			written: '2026-10-05',
			approved: signedOff('2026-10-06'),
			caption: 'The leather trench, belted over the suit or worn open over the gown. Black nappa, $3,200.',
			numbers: [[2140, 31, 152, 40]],
		},
	];

	/* Approved and booked, waiting for their slot. */
	const BOOKED = [
		{
			id: 'sp-209',
			status: 'scheduled',
			at: '2026-10-09T16:00',
			title: 'Cat-eye season',
			channels: ['instagram', 'facebook'],
			sku: 'ML-CATE',
			tags: ['#eyewear', '#cateye'],
			by: 'Dawn Nugent',
			written: '2026-10-06',
			approved: signedOff('2026-10-07'),
			caption:
				'Low autumn sun all weekend. The cat-eye sunglasses come in ivory acetate with sharp wings, in a short run only.',
		},
		{
			id: 'sp-210',
			status: 'scheduled',
			at: '2026-10-10T10:00',
			title: 'One oxford, five looks',
			channels: ['tiktok'],
			sku: 'ML-OXFD',
			tags: ['#oxfords', '#shoes'],
			by: 'Connie Reese',
			written: '2026-10-07',
			approved: signedOff('2026-10-08'),
			caption: 'Five ways to wear the two-tone oxfords, from the chalk-stripe suit to the organza dress.',
		},
		{
			id: 'sp-211',
			status: 'scheduled',
			at: '2026-10-12T09:00',
			title: 'Column gown, $2,150',
			channels: ['instagram', 'pinterest'],
			sku: 'ML-GOWN',
			tags: ['#gown', '#sale'],
			by: 'Theo Marsh',
			written: '2026-10-07',
			approved: signedOff('2026-10-08'),
			caption:
				'The draped column gown is $2,150 until Oct 31. Cobalt silk jersey, fully lined, hand-draped at the shoulder.',
		},
		{
			id: 'sp-213',
			status: 'scheduled',
			at: '2026-10-14T18:00',
			title: 'Made to measure',
			channels: ['facebook', 'instagram'],
			sku: 'ML-MTM',
			tags: ['#madetomeasure', '#coat'],
			by: 'Dawn Nugent',
			written: '2026-10-05',
			approved: signedOff('2026-10-06'),
			caption:
				'Two fittings, six weeks of making and a suit or coat cut for you, in your cloth. Bookings for December are open.',
		},
		{
			id: 'sp-215',
			status: 'scheduled',
			at: '2026-10-16T17:00',
			title: 'The suit, last days',
			channels: ['instagram', 'tiktok'],
			sku: 'ML-SUIT',
			tags: ['#tailoring', '#sale'],
			by: 'Dawn Nugent',
			written: '2026-10-06',
			approved: signedOff('2026-10-07'),
			caption: 'Last weekend for the chalk-stripe suit at $2,450. It goes back to $2,750 on Monday.',
		},
		{
			id: 'sp-216',
			status: 'scheduled',
			at: '2026-10-19T09:00',
			title: 'Inside the atelier',
			channels: ['tiktok'],
			photo: 'assets/basalt/images/multipurpose/atelier-workroom.svg',
			tags: ['#atelier', '#madeinoregon'],
			by: 'Theo Marsh',
			written: '2026-10-07',
			approved: signedOff('2026-10-08'),
			caption: 'A morning at Willamette Tailors in Oregon, where our suits are cut and sewn by hand.',
		},
		{
			id: 'sp-218',
			status: 'scheduled',
			at: '2026-10-23T18:00',
			title: 'Shields are coming back',
			channels: ['instagram'],
			sku: 'ML-SHLD',
			tags: ['#eyewear', '#waitlist'],
			by: 'Connie Reese',
			written: '2026-10-06',
			approved: signedOff('2026-10-07'),
			caption:
				'The shield sunglasses return in November. 31 of you are on the waitlist already; join them from the shop.',
		},
		{
			id: 'sp-219',
			status: 'scheduled',
			at: '2026-10-27T09:00',
			title: 'Express Delivery Pass',
			channels: ['facebook'],
			sku: 'ML-PASS',
			tags: ['#marlo'],
			by: 'Dawn Nugent',
			written: '2026-10-07',
			approved: signedOff('2026-10-08'),
			caption: 'Next-day delivery on every order for $15 a month. Cancel whenever you like.',
		},
		{
			id: 'sp-220',
			status: 'scheduled',
			at: '2026-10-29T12:00',
			title: 'Caring for nappa',
			channels: ['pinterest'],
			photo: 'assets/basalt/images/multipurpose/leather-trench.svg',
			tags: ['#leathercare', '#buybetter'],
			by: 'Theo Marsh',
			written: '2026-10-07',
			approved: signedOff('2026-10-08'),
			caption: 'A soft cloth, a little balm, a wide hanger. Three steps that keep nappa supple for years.',
		},
		{
			id: 'sp-221',
			status: 'scheduled',
			at: '2026-10-30T16:00',
			title: 'After dark',
			channels: ['instagram'],
			photo: 'assets/basalt/images/multipurpose/social-night-out.svg',
			tags: ['#autumnwinter26'],
			by: 'Dawn Nugent',
			written: '2026-10-08',
			approved: signedOff('2026-10-08'),
			caption:
				'Out after dark in the nappa trench and the cat-eye frames. Both are in the shop and go out the next day.',
		},
	];

	/* Drafts sit in the approval queue; waiting is when each was sent in. */
	const DRAFTS = [
		{
			id: 'sp-212',
			status: 'draft',
			at: '2026-10-13T12:00',
			title: 'Book a styling session',
			waiting: '2026-10-08T15:20',
			channels: ['instagram'],
			sku: 'ML-STYLE',
			tags: ['#styling', '#marlo'],
			by: 'Theo Marsh',
			written: '2026-10-08',
			caption:
				'Ninety minutes with one of our stylists, in store or on video, and a written list to take home. $650.',
		},
		{
			id: 'sp-214',
			status: 'draft',
			at: '2026-10-15T09:00',
			title: 'Bar loafers, two colors',
			waiting: '2026-10-08T17:05',
			channels: ['pinterest'],
			sku: 'ML-LOAF',
			tags: ['#loafers', '#essentials'],
			by: 'Connie Reese',
			written: '2026-10-08',
			caption:
				'Our bar loafers in deep violet suede or black calf, with a gold bar. $790, and they finish everything.',
		},
		{
			id: 'sp-217',
			status: 'draft',
			at: '2026-10-21T12:00',
			title: 'Gift cards',
			waiting: '2026-10-09T09:12',
			channels: ['facebook'],
			sku: 'ML-GIFT250',
			tags: ['#giftideas'],
			by: 'Theo Marsh',
			written: '2026-10-09',
			caption: 'A Marlo e-gift card arrives by email in minutes and never expires. From $250.',
		},
	];

	/* A year of Sundays, the end of each week the dashboard counts; the
	   last one is 2026-10-04. */
	const WEEKS = Array.from({ length: 52 }, (_, at) => {
		const day = new Date(Date.UTC(2026, 9, 4 - (51 - at) * 7));
		return day.toISOString().slice(0, 10);
	});

	/* Followers at the end of each week, oldest first. TikTok took off
	   with the how-it's-made videos in September; Facebook barely moves. */
	const FOLLOWERS = {
		instagram: [
			13020, 13110, 13250, 13360, 13500, 13640, 13760, 13880, 13960, 14040, 14130, 14250, 14360, 14520, 14600,
			14750, 14870, 15030, 15190, 15330, 15430, 15530, 15710, 15790, 15970, 16140, 16310, 16440, 16620, 16810,
			16970, 17110, 17280, 17380, 17550, 17730, 17830, 18000, 18120, 18240, 18420, 18610, 18790, 18950, 19180,
			19340, 19620, 19910, 20280, 20560, 20890, 21240,
		],
		pinterest: [
			4570, 4600, 4630, 4650, 4680, 4710, 4740, 4790, 4830, 4880, 4920, 4970, 5000, 5060, 5080, 5110, 5140, 5160,
			5190, 5230, 5280, 5330, 5380, 5410, 5450, 5470, 5530, 5580, 5620, 5660, 5690, 5740, 5780, 5810, 5840, 5880,
			5920, 5960, 6020, 6060, 6120, 6180, 6230, 6310, 6370, 6440, 6520, 6610, 6700, 6790, 6880, 6960,
		],
		tiktok: [
			7900, 7960, 8010, 8050, 8110, 8170, 8210, 8280, 8330, 8360, 8390, 8440, 8510, 8530, 8570, 8620, 8680, 8750,
			8800, 8870, 8890, 8940, 8990, 9020, 9040, 9100, 9130, 9160, 9180, 9230, 9270, 9320, 9340, 9370, 9440, 9490,
			9540, 9610, 9670, 9760, 9810, 9940, 10120, 10260, 10490, 10720, 11180, 11930, 12620, 13340, 14010, 14620,
		],
		facebook: [
			8910, 8870, 8870, 8900, 8910, 8890, 8870, 8870, 8860, 8860, 8870, 8870, 8910, 8870, 8890, 8860, 8930, 8920,
			8920, 8900, 8910, 8900, 8860, 8910, 8870, 8920, 8880, 8870, 8910, 8930, 8870, 8900, 8880, 8900, 8890, 8870,
			8890, 8880, 8870, 8930, 8910, 8920, 8930, 8925, 8940, 8950, 8955, 8970, 8980, 8990, 9000, 9010,
		],
	};

	/* Posts sent, reach, engagement and shop clicks across every network,
	   week by week; November and December carry the gift season. */
	const RHYTHM = {
		posts: [
			4, 5, 3, 6, 6, 7, 5, 5, 7, 5, 5, 7, 4, 5, 4, 4, 3, 4, 5, 3, 6, 3, 5, 5, 4, 4, 3, 4, 6, 5, 6, 5, 4, 5, 5, 6,
			5, 5, 4, 5, 4, 5, 3, 6, 5, 6, 6, 5, 8, 7, 9, 8,
		],
		reach: [
			38200, 46300, 27700, 65700, 63800, 79100, 58500, 59100, 80300, 47200, 57400, 74300, 26700, 39600, 26400,
			26400, 23800, 28600, 39800, 18900, 56000, 23700, 47300, 41700, 31100, 34500, 25100, 30300, 48900, 40600,
			43500, 45200, 36500, 37800, 40600, 58300, 42100, 37400, 29400, 43500, 41200, 46800, 33900, 55100, 49800,
			58300, 61700, 54200, 79600, 74800, 92300, 88100,
		],
		engaged: [
			7, 7.9, 8.1, 7.4, 7.7, 8.2, 8.2, 8.2, 8.5, 8.1, 8.1, 8.2, 7.5, 7.6, 6.8, 7.7, 8.1, 7.3, 7.7, 6.7, 7.8, 7.6,
			6.9, 8.1, 6.8, 7, 7.4, 7.6, 7.9, 7.6, 7.1, 7.7, 7.1, 6.7, 7.4, 7, 6.8, 8, 7.1, 7.5, 7.4, 7.9, 7.1, 8.2, 8,
			8.5, 8.3, 7.9, 9.1, 8.8, 9.4, 8.6,
		],
		clicks: [
			155, 172, 112, 235, 248, 299, 223, 233, 439, 265, 271, 410, 107, 146, 92, 102, 92, 104, 151, 68, 225, 85,
			174, 159, 123, 135, 104, 126, 186, 166, 174, 154, 135, 151, 163, 231, 148, 138, 114, 150, 180, 205, 150,
			240, 221, 262, 270, 238, 330, 312, 368, 352,
		],
	};

	/* How well a post does by day and time, from the last twelve weeks:
	   evenings early in the week and Sunday mornings lead. */
	const SLOTS = {
		days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		times: ['9 am', '12 pm', '3 pm', '6 pm', '9 pm'],
		score: [
			[38, 44, 31, 62, 48],
			[42, 51, 36, 88, 57],
			[35, 47, 33, 71, 52],
			[40, 55, 39, 94, 61],
			[33, 64, 41, 58, 36],
			[51, 46, 29, 37, 30],
			[82, 58, 34, 45, 49],
		],
	};

	/* The three groups merge into one calendar, ordered by publishing time. */
	const CALENDAR = [...SENT, ...BOOKED, ...DRAFTS]
		.map(attachResults)
		.sort((left, right) => left.at.localeCompare(right.at));

	publish();

	/** Hangs the finished API on window.Basalt.data without disturbing other data files. */
	function publish() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.social = {
			now: CLOCK,
			me: ME,
			channels: Object.entries(NETWORKS).map(([id, network]) => ({ id, icon: `bi-${id}`, ...copyOf(network) })),
			people: copyOf(JOBS),
			posts: () => copyOf(CALENDAR),
			find: (id) => {
				const hit = CALENDAR.find((entry) => entry.id === id);
				return hit ? copyOf(hit) : null;
			},
			photoOf: pictureUrl,
			growth: { weeks: WEEKS.slice(), ...copyOf(FOLLOWERS) },
			rhythm: copyOf(RHYTHM),
			slots: copyOf(SLOTS),
		};
	}

	/** The approval stamp every booked post carries; the head of marketing signs them all. */
	function signedOff(day) {
		return { by: ME, on: day };
	}

	/**
	 * Turns a sent post's numbers list into results keyed by channel, in the
	 * post's own channel order. Posts without numbers pass through untouched.
	 */
	function attachResults({ numbers, ...entry }) {
		if (!numbers) return entry;
		const byChannel = Object.fromEntries(entry.channels.map((channel, slot) => [channel, numbers[slot]]));
		return { ...entry, results: byChannel };
	}

	/**
	 * The address of a post's picture.
	 * @param {{photo?: string, sku?: string}} entry
	 * @param {number} width
	 * @param {number} height
	 * @returns {string}
	 */
	function pictureUrl(entry, width, height) {
		return window.Basalt.photo(photoIdFor(entry), width, height);
	}

	/** A post's own photo wins; otherwise its product's photo, then the season cover. */
	function photoIdFor(entry) {
		if (entry.photo) return entry.photo;
		const shop = (window.Basalt.data && window.Basalt.data.catalog) || null;
		const product = shop && entry.sku ? shop.find(entry.sku) : null;
		return product ? product.photo : COVER_PHOTO;
	}

	function copyOf(value) {
		return JSON.parse(JSON.stringify(value));
	}
})();
