/**
 * Storefront content for the Marlo shop, published as
 * window.Basalt.data.shopSite and read by Banners and Landing Pages.
 *
 * Products, prices and photos belong to the catalog (catalog.js and
 * store.js); each `photo` below is the photo the catalog already
 * uses for that SKU, so a banner and its product always look alike.
 *
 * BANNERS hold id, title, text, cta, link, placement, start, end (null
 * means open ended), sku, views and clicks since launch, plus `collection`
 * on collection headers and `state` only when a banner is a draft or
 * paused; live, scheduled and ended are worked out from the dates. A
 * banner may carry its own `photo` instead of its product's.
 *
 * PAGES hold id, title, path, state, visits and orders for the last 30
 * days, edited and by for the latest change, sku and skus, sources as
 * [channel, percent of visits], blocks as [type, label] from the top down,
 * and `publish` (scheduled) or `ended` (ended) when the state has a date.
 *
 * A real site builder only has to hand back this same shape.
 */
(() => {
	'use strict';

	/* The demo runs as if it were this day, on this storefront domain. */
	const TODAY = '2026-10-09',
		DOMAIN = 'marlo.shop';

	/* The photo for every SKU the site shows: clothing, shoes, eyewear, then services and gifts. */
	const PHOTOS = {
		'ML-BLAZ': 'assets/basalt/images/multipurpose/sculpted-blazer.svg',
		'ML-SUIT': 'assets/basalt/images/multipurpose/chalk-stripe-suit.svg',
		'ML-ORGZ': 'assets/basalt/images/multipurpose/organza-dress.svg',
		'ML-SHLD': 'assets/basalt/images/multipurpose/shield-sunglasses.svg',
		'ML-OXFD': 'assets/basalt/images/multipurpose/two-tone-oxfords.svg',
		'ML-CATE': 'assets/basalt/images/multipurpose/cat-eye-sunglasses.svg',
		'ML-GOWN': 'assets/basalt/images/multipurpose/draped-gown.svg',
		'ML-TRCH': 'assets/basalt/images/multipurpose/leather-trench.svg',
		'ML-LOAF': 'assets/basalt/images/multipurpose/bar-loafers.svg',
		'ML-MTM': 'assets/basalt/images/multipurpose/made-to-measure.svg',
		'ML-STYLE': 'assets/basalt/images/multipurpose/styling-session.svg',
		'ML-CARE': 'assets/basalt/images/multipurpose/aftercare-plan.svg',
		'ML-PASS': 'assets/basalt/images/multipurpose/delivery-pass.svg',
		'ML-GIFT250': 'assets/basalt/images/multipurpose/gift-card.svg',
	};

	/* Spots on the storefront that take a banner; tone picks the chart ramp step. */
	const PLACEMENTS = {
		hero: { tone: 1, name: 'Home hero', note: 'Full width, top of the home page' },
		strip: { tone: 5, name: 'Promo strip', note: 'A thin bar above the menu on every page' },
		collection: { tone: 3, name: 'Collection header', note: 'Top of one collection page' },
		cart: { tone: 4, name: 'Cart note', note: 'Beside the cart total' },
	};

	/* Section kinds a campaign page is assembled from, with their icon. */
	const BLOCKS = {
		hero: { icon: 'bi-image', name: 'Hero' },
		products: { icon: 'bi-grid', name: 'Product grid' },
		text: { icon: 'bi-text-paragraph', name: 'Story' },
		quote: { icon: 'bi-chat-quote', name: 'Review' },
		signup: { icon: 'bi-envelope', name: 'Email signup' },
		booking: { icon: 'bi-calendar-check', name: 'Booking form' },
		faq: { icon: 'bi-question-circle', name: 'Questions' },
	};

	/* The two people who edit campaign pages, keyed by the handle the records use. */
	const EDITORS = { hope: 'Hope Stout', john: 'John Armstrong' };

	/* Banners in the order the list shows them before any sorting. */
	const BANNERS = [
		banner('#124', 'hero', 'ML-BLAZ', ['2026-10-01', '2026-10-31'], [9840, 512], {
			title: 'Autumn/Winter 26 is here',
			cta: 'Shop the collection',
			link: '/collections/autumn-winter',
			text: 'Sculpted tailoring and silk, made in Maine and Oregon.',
			photo: 'assets/basalt/images/multipurpose/social-new-season.svg',
		}),
		banner('#123', 'strip', 'ML-SUIT', ['2026-09-15', '2026-10-31'], [21400, 268], {
			title: 'Free returns, always',
			cta: 'How returns work',
			link: '/help/returns',
			text: 'Free returns on all ready-to-wear until October 31.',
		}),
		banner('#120', 'collection', 'ML-SUIT', ['2026-10-04', '2026-10-18'], [3120, 214], {
			title: 'The suit, $300 off',
			cta: 'Shop the suit',
			link: '/products/chalk-stripe-suit',
			text: 'The Chalk-Stripe Suit is $2,450 until October 18.',
			collection: 'Tailoring',
		}),
		banner('#121', 'collection', 'ML-GOWN', ['2026-10-01', '2026-10-31'], [2860, 147], {
			title: 'Column gown event',
			cta: 'Shop the gown',
			link: '/products/draped-column-gown',
			text: 'The Draped Column Gown is $2,150, down from $2,390.',
			collection: 'Dresses',
		}),
		banner('#122', 'cart', 'ML-PASS', ['2026-09-01', null], [1940, 96], {
			title: 'Express Delivery Pass',
			cta: 'Add the pass',
			link: '/products/express-delivery-pass',
			text: 'Free next-day delivery for $15 a month.',
		}),
		banner('#117', 'collection', 'ML-ORGZ', ['2026-09-20', '2026-11-30'], [1210, 58], {
			title: 'The organza edit',
			cta: 'See the edit',
			link: '/organza-edit',
			text: 'Hand-pleated organza for the evenings ahead.',
			collection: 'Dresses',
			state: 'paused',
		}),
		banner('#125', 'hero', 'ML-MTM', ['2026-11-01', '2026-11-12'], [0, 0], {
			title: 'Made to measure',
			cta: 'Book a fitting',
			link: '/made-to-measure',
			text: 'Two fittings, six weeks, one suit cut for you.',
		}),
		banner('#127', 'hero', 'ML-GIFT250', ['2026-11-13', '2026-12-23'], [0, 0], {
			title: 'The gift guide',
			cta: 'See the guide',
			link: '/gift-guide',
			text: 'Tailoring, eyewear and gift cards for everyone you love.',
		}),
		banner('#128', 'strip', 'ML-GIFT250', ['2026-11-20', '2026-12-31'], [0, 0], {
			title: 'Gift cards never expire',
			cta: 'Buy a gift card',
			link: '/products/e-gift-card',
			text: 'Send a Marlo gift card by email, any day.',
		}),
		banner('#126', 'collection', 'ML-SHLD', ['2026-10-26', '2026-11-22'], [0, 0], {
			title: 'The shield returns',
			cta: 'Shop the shield',
			link: '/products/shield-sunglasses',
			text: 'Shield sunglasses, back from the waiting list.',
			collection: 'Eyewear',
			state: 'draft',
		}),
		banner('#118', 'hero', 'ML-GOWN', ['2026-08-15', '2026-09-30'], [14210, 588], {
			title: 'End of summer silk',
			cta: 'Shop silk',
			link: '/summer-silk',
			text: 'Last of the summer silks, up to 30% off.',
		}),
		banner('#119', 'strip', 'ML-CARE', ['2026-09-01', '2026-09-14'], [9300, 121], {
			title: 'Aftercare Plan is open',
			cta: 'Join for $25',
			link: '/aftercare',
			text: 'Pressing, repairs and shoe care, collected each month.',
		}),
	];

	/*
	 * Campaign pages. The slug gives both the id (lp-<slug>) and the path
	 * (/<slug>), and the first SKU listed is the one the page leads with.
	 */
	const PAGES = [
		campaign(
			'autumn-winter',
			'Autumn/Winter 26',
			'live',
			[640, 9],
			['2026-10-02 16:20', 'hope'],
			['ML-BLAZ', 'ML-SUIT', 'ML-CATE', 'ML-OXFD'],
			[
				['Newsletter', 41],
				['Instagram', 33],
				['Search', 15],
				['Direct', 11],
			],
			[
				['hero', 'Autumn/Winter 26 is here'],
				['products', 'Four pieces for the season'],
				['text', 'Shaped by hand in Maine'],
				['quote', 'Effortless, and remarkably warm'],
				['signup', 'Hear about new pieces first'],
			],
		),
		campaign(
			'insiders',
			'Insider Preview',
			'live',
			[180, 5],
			['2026-09-30 10:05', 'john'],
			['ML-GOWN', 'ML-BLAZ', 'ML-TRCH'],
			[
				['Newsletter', 78],
				['Direct', 14],
				['Instagram', 6],
				['Search', 2],
			],
			[
				['hero', 'Early access for Insiders'],
				['products', 'First look at winter'],
				['faq', 'How Insider pricing works'],
			],
		),
		campaign(
			'tailoring-week',
			'Tailoring Week',
			'live',
			[310, 4],
			['2026-10-03 09:40', 'hope'],
			['ML-SUIT', 'ML-CATE', 'ML-OXFD'],
			[
				['Instagram', 46],
				['Newsletter', 28],
				['Search', 16],
				['Direct', 10],
			],
			[
				['hero', 'The suit, $300 off'],
				['text', 'Cut by hand in Oregon'],
				['products', 'Wear it with'],
				['quote', 'Sharper than it looks'],
			],
		),
		campaign(
			'silk-last-call',
			'Silk Last Call',
			'live',
			[420, 3],
			['2026-09-26 14:10', 'john'],
			['ML-TRCH', 'ML-GOWN', 'ML-LOAF'],
			[
				['Search', 38],
				['Instagram', 27],
				['Newsletter', 22],
				['Direct', 13],
			],
			[
				['hero', 'Last call for silk'],
				['products', 'While sizes last'],
				['signup', 'Get the spring drop first'],
			],
		),
		campaign(
			'organza-edit',
			'The Organza Edit',
			'live',
			[260, 2],
			['2026-09-18 11:30', 'hope'],
			['ML-ORGZ', 'ML-SHLD'],
			[
				['Instagram', 52],
				['Search', 21],
				['Newsletter', 17],
				['Direct', 10],
			],
			[
				['hero', 'Organza, pleated by hand'],
				['text', 'How each tier is made'],
				['products', 'Shop the edit'],
				['faq', 'Fit and alterations'],
			],
		),
		campaign(
			'made-to-measure',
			'Made to Measure',
			'live',
			[150, 1],
			['2026-09-12 15:45', 'john'],
			['ML-MTM', 'ML-STYLE'],
			[
				['Search', 44],
				['Direct', 29],
				['Newsletter', 18],
				['Instagram', 9],
			],
			[
				['hero', 'One suit cut for you'],
				['text', 'Two fittings, six weeks'],
				['booking', 'Book a first fitting'],
			],
		),
		campaign(
			'summer-silk',
			'Summer Silk',
			'ended',
			[820, 4],
			['2026-08-14 09:20', 'hope'],
			['ML-GOWN', 'ML-TRCH', 'ML-LOAF'],
			[
				['Newsletter', 36],
				['Instagram', 31],
				['Search', 20],
				['Direct', 13],
			],
			[
				['hero', 'End of summer silk'],
				['products', 'Up to 30% off'],
				['signup', 'Hear about the next sale'],
			],
			{ ended: '2026-09-30' },
		),
		campaign(
			'gift-guide',
			'Gift Guide 2026',
			'scheduled',
			[0, 0],
			['2026-10-08 17:05', 'hope'],
			['ML-GIFT250', 'ML-SHLD', 'ML-CATE', 'ML-ORGZ'],
			[],
			[
				['hero', 'Gifts for everyone'],
				['products', 'Under $500'],
				['products', 'For the one who has it all'],
				['signup', 'Get the guide by email'],
			],
			{ publish: '2026-11-13' },
		),
		campaign(
			'aftercare',
			'Aftercare Plan',
			'draft',
			[0, 0],
			['2026-10-06 12:15', 'john'],
			['ML-CARE'],
			[],
			[
				['hero', 'We care for every piece'],
				['text', 'How it works'],
				['faq', 'What we can fix'],
			],
		),
		campaign(
			'black-friday',
			'Black Friday',
			'draft',
			[0, 0],
			['2026-10-07 10:50', 'hope'],
			['ML-LOAF', 'ML-TRCH', 'ML-OXFD', 'ML-ORGZ'],
			[],
			[
				['hero', 'Black Friday at Marlo'],
				['products', 'The week’s offers'],
			],
		),
	];

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.shopSite = { TODAY, DOMAIN, PHOTOS, PLACEMENTS, BANNERS, BLOCKS, PAGES };

	/**
	 * Builds one banner record. The copy object carries title, text, cta and
	 * link, and may add `collection` or a `state` override; those keys only
	 * exist on the record when the copy object has them.
	 */
	function banner(id, placement, sku, [start, end], [views, clicks], copy) {
		return { id, placement, sku, start, end, views, clicks, ...copy };
	}

	/**
	 * Builds one landing page record from its slug. `when` holds the
	 * `publish` or `ended` date for pages whose state is tied to a day.
	 */
	function campaign(slug, title, state, [visits, orders], [edited, editor], skus, sources, blocks, when = {}) {
		return {
			id: `lp-${slug}`,
			path: `/${slug}`,
			title,
			state,
			...when,
			visits,
			orders,
			edited,
			by: EDITORS[editor],
			sku: skus[0],
			skus,
			sources,
			blocks,
		};
	}
})();
