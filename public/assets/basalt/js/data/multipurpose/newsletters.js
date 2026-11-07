/**
 * Demo data for Marlo's email program, published on
 * window.Basalt.data.newsletters. newsletters.html shows the whole run of
 * issues and newsletter-details.html?id=<id> opens a single one; both read
 * subjects, audiences, send times and results from this one place.
 *
 * An issue only names products by SKU. Names, prices and photos live in the
 * shop catalog (window.Basalt.data.catalog), so the email and the store
 * cannot drift apart.
 *
 * Published issue fields: status is draft, scheduled or sent; audience is a
 * key of AUDIENCE_BOOK; at is 'yyyy-mm-dd hh:mm' (an empty string on drafts);
 * edited is [day, person] for a draft's latest change; hero is the SKU in the
 * header photo; tiles are the products laid out in pairs; tests are
 * [address, time] test sends. A sent issue also has results (sent counts
 * deliveries, opened and clicked count people once, orders and revenue cover
 * five days after a click, unsub counts people this email lost) and links as
 * [target, clicks], the target being 'cta' or a SKU.
 *
 * For live numbers, feed the three groups in ISSUE_SHELVES from your email
 * service in the same shape.
 */
(() => {
	'use strict';

	const DEMO_DATE = '2026-10-09';
	const SHOP_SENDER = { name: 'Marlo', email: 'hello@marlo.shop' };

	/* The two people who write the emails, with the inbox their test sends
     land in. */
	const WRITERS = {
		hope: { name: 'Hope Stout', inbox: 'hope@marlo.shop' },
		john: { name: 'John Armstrong', inbox: 'john@marlo.shop' },
	};

	/* Every list an issue can target, with today's head count. Pages offer
     the keys in this order, so it must hold. */
	const AUDIENCE_BOOK = {
		all: { label: 'All subscribers', size: 18064, short: 'Everyone', note: 'Everyone on the list' },
		insiders: { label: 'Insiders', size: 1860, short: 'Insiders', note: 'Insider members, 10% off everything' },
		lapsed: { label: 'Lapsed shoppers', size: 3420, short: 'Lapsed', note: 'No order in the last 12 months' },
	};

	/* Head count when each month closed, plus movement over the past thirty
     days. */
	const LIST_HISTORY = {
		joined30: 486,
		left30: 74,
		now: 18064,
		months: [
			['Apr', 16420],
			['May', 16780],
			['Jun', 17050],
			['Jul', 17190],
			['Aug', 17420],
			['Sep', 17808],
			['Oct', 18064],
		],
	};

	/* Issues by stage, newest first inside each stage. A draft keeps the day
     of its last edit; whoever wrote it made that edit. */
	const ISSUE_SHELVES = {
		draft: [
			{
				id: 'nl-121',
				writer: 'john',
				audience: 'all',
				editedOn: '2026-10-07',
				subject: 'The shield sunglasses are back',
				preheader: 'Chrome frames and cobalt lenses, restocked.',
				headline: 'Back from the waitlist',
				cta: 'Claim a pair',
				hero: 'ML-SHLD',
				body: 'The shields sold out in a week last summer. A new run from Fairhaven Optical lands next week, and they go first to everyone reading this.',
				tiles: ['ML-SHLD', 'ML-ORGZ', 'ML-CATE', 'ML-OXFD'],
				trials: [],
			},
			{
				id: 'nl-120',
				writer: 'hope',
				audience: 'all',
				editedOn: '2026-10-08',
				subject: 'Gifts under $500',
				preheader: 'Sunglasses, loafers and gift cards.',
				headline: 'Small gifts, perfectly made',
				cta: 'Shop gifts',
				hero: 'ML-CATE',
				body: 'Four things we’d be glad to unwrap, all under $500 and all ready to send this week.',
				tiles: ['ML-OXFD', 'ML-CATE', 'ML-LOAF', 'ML-GIFT250'],
				trials: [['hope', '2026-10-08 15:40']],
			},
		],

		scheduled: [
			{
				id: 'nl-119',
				writer: 'hope',
				audience: 'insiders',
				at: '2026-10-15 09:00',
				subject: 'Insiders: book made-to-measure',
				preheader: 'Twelve fittings in November, and Insiders book first.',
				headline: 'A suit cut for you',
				cta: 'Book a fitting',
				hero: 'ML-MTM',
				body: 'We have twelve fitting slots in November. Insiders get a week to book before we open them to everyone.',
				tiles: ['ML-MTM', 'ML-STYLE', 'ML-BLAZ', 'ML-CATE'],
				trials: [['hope', '2026-10-07 11:05']],
			},
			{
				id: 'nl-118',
				writer: 'john',
				audience: 'all',
				at: '2026-10-13 08:30',
				subject: 'Cold mornings, sharp coats',
				preheader: 'The trench, the suit and the oxfords for the city.',
				headline: 'Dressed for the first frost',
				cta: 'Shop outerwear',
				hero: 'ML-ORGZ',
				body: 'Mornings are colder now. Here’s what we reach for on the way out, from the leather trench to two-tone oxfords.',
				tiles: ['ML-ORGZ', 'ML-CATE', 'ML-OXFD', 'ML-GIFT250'],
				trials: [
					['john', '2026-10-08 16:20'],
					['hope', '2026-10-08 16:21'],
				],
			},
		],

		/* Sent issues carry their scoreboard as
       [sent, opened, clicked, orders, revenue, unsub]; see scoreboard(). */
		sent: [
			{
				id: 'nl-117',
				writer: 'hope',
				audience: 'all',
				at: '2026-10-06 09:00',
				subject: 'How to care for silk, and why it lasts',
				preheader: 'Three rules, and the one thing never to do.',
				headline: 'Silk likes a light touch',
				cta: 'Read the silk guide',
				hero: 'ML-GOWN',
				body: 'Cool air, a wide hanger and a steamer, never an iron. Treated lightly, silk keeps its luster and drape for decades.',
				tiles: ['ML-GOWN', 'ML-TRCH', 'ML-LOAF', 'ML-CARE'],
				trials: [['hope', '2026-10-05 14:10']],
				score: [18012, 8033, 738, 9, 11480, 14],
				links: [
					['cta', 412],
					['ML-GOWN', 168],
					['ML-TRCH', 121],
					['ML-LOAF', 97],
					['ML-CARE', 54],
				],
			},
			{
				id: 'nl-116',
				writer: 'john',
				audience: 'lapsed',
				at: '2026-10-01 10:00',
				subject: 'We kept your size: new for fall',
				preheader: 'It’s been a while. Here’s what’s new.',
				headline: 'New since you were here',
				cta: 'See what’s new',
				hero: 'ML-SUIT',
				body: 'Fall/Winter 26 is in, with a chalk-stripe suit we think you’ll love. Free returns, as always.',
				tiles: ['ML-SUIT', 'ML-BLAZ', 'ML-OXFD', 'ML-CATE'],
				trials: [['john', '2026-09-30 17:05']],
				score: [3410, 968, 89, 6, 7630, 37],
				links: [
					['cta', 52],
					['ML-SUIT', 21],
					['ML-BLAZ', 18],
					['ML-OXFD', 11],
					['ML-CATE', 6],
				],
			},
			{
				id: 'nl-115',
				writer: 'john',
				audience: 'all',
				at: '2026-09-23 09:00',
				subject: '20% off the sculpted blazer',
				preheader: 'Use SCULPT20 at checkout until Oct 31.',
				headline: 'The blazer, for less',
				cta: 'Shop the blazer',
				hero: 'ML-BLAZ',
				body: 'Our sculpted shoulder blazer is 20% off until the end of October with the code SCULPT20. Every size is in stock.',
				tiles: ['ML-BLAZ', 'ML-OXFD', 'ML-CATE', 'ML-ORGZ'],
				trials: [['john', '2026-09-22 15:30']],
				score: [17760, 9111, 1403, 18, 48580, 22],
				links: [
					['cta', 902],
					['ML-BLAZ', 318],
					['ML-OXFD', 104],
					['ML-ORGZ', 61],
					['ML-CATE', 49],
				],
			},
			{
				id: 'nl-114',
				writer: 'hope',
				audience: 'all',
				at: '2026-09-10 09:00',
				subject: 'Fall/Winter 26 is in',
				preheader: 'Tailoring, silk and nappa, made in small runs.',
				headline: 'Fall/Winter 26 is here',
				cta: 'Shop Fall/Winter 26',
				hero: 'ML-BLAZ',
				body: 'Pieces from our ateliers in Maine, Oregon and Missouri, made in small runs. Sharp now, sharper every season.',
				tiles: ['ML-BLAZ', 'ML-SUIT', 'ML-OXFD', 'ML-CATE'],
				trials: [['hope', '2026-09-09 12:00']],
				score: [17540, 8542, 1105, 15, 29470, 19],
				links: [
					['cta', 611],
					['ML-BLAZ', 284],
					['ML-SUIT', 172],
					['ML-OXFD', 98],
					['ML-CATE', 57],
				],
			},
			{
				id: 'nl-113',
				writer: 'hope',
				audience: 'insiders',
				at: '2026-09-08 09:00',
				subject: 'Insiders: first look at Fall/Winter 26',
				preheader: 'Two days before everyone else, with your 10% off.',
				headline: 'You see it first',
				cta: 'Shop early',
				hero: 'ML-SUIT',
				body: 'The new collection opens to Insiders today, two days early. Your 10% comes off at checkout.',
				tiles: ['ML-BLAZ', 'ML-GOWN', 'ML-SUIT', 'ML-CATE'],
				trials: [['hope', '2026-09-07 10:15']],
				score: [1822, 1237, 281, 21, 37660, 2],
				links: [
					['cta', 196],
					['ML-BLAZ', 88],
					['ML-SUIT', 41],
					['ML-GOWN', 23],
					['ML-CATE', 17],
				],
			},
			{
				id: 'nl-112',
				writer: 'john',
				audience: 'all',
				at: '2026-08-27 09:00',
				subject: 'Last call: summer silk, up to 30% off',
				preheader: 'The sale ends Sunday at midnight.',
				headline: 'The last of the silk',
				cta: 'Shop the sale',
				hero: 'ML-TRCH',
				body: 'Gowns, dresses and sunglasses from summer, up to 30% off until Sunday. When a size is gone, it’s gone.',
				tiles: ['ML-GOWN', 'ML-TRCH', 'ML-LOAF', 'ML-PASS'],
				trials: [['john', '2026-08-26 16:45']],
				score: [17310, 7997, 1177, 26, 27090, 24],
				links: [
					['cta', 688],
					['ML-GOWN', 236],
					['ML-TRCH', 171],
					['ML-LOAF', 140],
					['ML-PASS', 22],
				],
			},
			{
				id: 'nl-111',
				writer: 'hope',
				audience: 'all',
				at: '2026-08-11 09:00',
				subject: 'The Aftercare Plan, explained',
				preheader: 'Pressing, repairs and shoe care, every month.',
				headline: 'Care, collected',
				cta: 'Join the plan',
				hero: 'ML-ORGZ',
				body: 'Each month we collect what needs care, press it, repair it and return it in tissue. Shoes are resoled. Pause any time.',
				tiles: ['ML-ORGZ', 'ML-GIFT250', 'ML-CARE', 'ML-LOAF'],
				trials: [['hope', '2026-08-10 11:20']],
				score: [17120, 7173, 633, 8, 8050, 11],
				links: [
					['cta', 402],
					['ML-ORGZ', 133],
					['ML-GIFT250', 48],
					['ML-CARE', 30],
					['ML-LOAF', 21],
				],
			},
		],
	};

	/* Built once in mount(): every issue in the order the pages list them. */
	let everyIssue = [];

	/** Flattens the shelves into published issues and exposes the API. */
	function start() {
		everyIssue = Object.entries(ISSUE_SHELVES).flatMap(([stage, entries]) =>
			entries.map((entry) => toIssue(entry, stage)),
		);

		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.newsletters = {
			today: DEMO_DATE,
			from: SHOP_SENDER,
			audiences: AUDIENCE_BOOK,
			subscribers: LIST_HISTORY,
			issues: () => cloneOf(everyIssue),
			find: (id) => {
				const found = everyIssue.find((issue) => issue.id === id);
				return found ? cloneOf(found) : null;
			},
		};
	}

	/**
	 * Turns a shelf entry into the record the pages read: writer keys become
	 * names and inboxes, drafts gain an empty send time and an edited pair,
	 * and a score array becomes the named results object.
	 * @param {object} entry one record from ISSUE_SHELVES
	 * @param {string} stage the shelf it sits on, used as its status
	 */
	function toIssue(entry, stage) {
		const { writer, editedOn, trials, score, ...rest } = entry;
		const author = WRITERS[writer].name;
		const issue = {
			...rest,
			status: stage,
			author,
			tests: trials.map(([who, when]) => [WRITERS[who].inbox, when]),
		};
		if (stage === 'draft') {
			issue.at = '';
			issue.edited = [editedOn, author];
		}
		if (score) issue.results = scoreboard(score);
		return issue;
	}

	/** Names the six positions of a sent issue's score array. */
	function scoreboard([sent, opened, clicked, orders, revenue, unsub]) {
		return { sent, opened, clicked, orders, revenue, unsub };
	}

	/** Deep copy of plain data, so pages can edit what they receive. */
	function cloneOf(value) {
		return JSON.parse(JSON.stringify(value));
	}

	start();
})();
