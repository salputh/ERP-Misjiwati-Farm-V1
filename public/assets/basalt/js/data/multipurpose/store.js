/**
 * Marlo's shop book, published as window.Basalt.shopBook: what the shop
 * sells, who buys it (shoppers and wholesale stockists), every order,
 * and the pricing rules that turn an order into a total. Orders, Order
 * Details, Shoppers, Shopper Details, Storefront, Product Details,
 * Refunds, Returns, Shipments, Payouts, Reviews, Coupons and the
 * dashboards all read from here, so one order carries the same buyer,
 * lines, sums, dates and state wherever it is shown.
 *
 * story(order) fills in what an order row leaves out (payment, packing,
 * shipping, delivery, card or invoice, tracking number) from a random
 * stream seeded by the order number, so it never changes between loads.
 *
 * Every date is read against NOW, the demo's fixed present. To go live,
 * feed your own catalog, buyers and orders through the same builders
 * and set NOW to the real clock. Sums are worked in whole cents.
 */
(() => {
	'use strict';

	const NOW = '2026-10-09T10:40';

	/* The shop sells inside the United States only. Each state belongs to
     a fulfillment zone, and each zone has a default shipping method. */
	const COUNTRIES = { US: 'United States' };
	const ZONE_STATES = {
		na: 'ME NH VT MA RI CT NY NJ PA',
		midwest: 'OH IN IL MI WI MN IA MO ND SD NE KS',
		south: 'DE MD DC VA WV NC SC GA FL KY TN AL MS AR LA OK TX',
		west: 'MT WY CO NM AZ UT NV CA',
		pnw: 'WA OR ID AK HI',
	};
	const REGION_OF = Object.fromEntries(
		Object.entries(ZONE_STATES).flatMap(([zone, states]) => states.split(' ').map((state) => [state, zone])),
	);
	const SHIP_BY_ZONE = {
		na: 'FedEx Ground',
		midwest: 'USPS Ground Advantage',
		south: 'UPS 3 Day Select',
		west: 'UPS Ground',
		pnw: 'USPS Priority Mail',
	};
	const SHIP_BY_COUNTRY = { US: 'UPS Ground' };

	/* Each fulfillment zone names its warehouse, the carriers it hands
     parcels to, and how many days a parcel spends on the road. The na
     zone is the Northeast. */
	const REGIONS = {
		na: { site: 'annarbor', transit: 3, carriers: ['UPS', 'FedEx'] },
		midwest: { site: 'annarbor', transit: 2, carriers: ['USPS', 'UPS'] },
		south: { site: 'annarbor', transit: 3, carriers: ['UPS', 'FedEx'] },
		west: { site: 'reno', transit: 3, carriers: ['UPS', 'FedEx'] },
		pnw: { site: 'medford', transit: 2, carriers: ['USPS', 'DHL Express'] },
	};

	/* Shipping methods as the Shipping page lists them: [method, carrier,
     flat fee in cents, free once the goods reach this many dollars]. */
	const SHIPPING = Object.fromEntries(
		[
			['UPS Ground', 'UPS', 1200, 500],
			['FedEx 2Day', 'FedEx', 2450],
			['DHL Express 9:00', 'DHL Express', 2200],
			['FedEx Ground', 'FedEx', 950, 400],
			['USPS Ground Advantage', 'USPS', 780, 300],
			['UPS 3 Day Select', 'UPS', 1560, 400],
			['FedEx Priority Overnight', 'FedEx', 2640, 600],
			['USPS Priority Mail', 'USPS', 1490, 400],
		].map(([method, carrier, cents, freeOver]) => [
			method,
			freeOver ? { carrier, cents, freeOver } : { carrier, cents },
		]),
	);

	/* Sales tax by state, written US-ST. Rates are thousandths of a percent
     (6875 means 6.875%), and the last column lists the kinds of charge
     the rate applies to. Rows mirror the Taxes page wherever it has one. */
	const TAX = Object.fromEntries(
		[
			['US-AR', 6500, 'goods', 'Arkansas sales tax 6.5%'],
			['US-AZ', 5600, 'goods', 'Arizona sales tax 5.6%'],
			['US-CA', 7250, 'goods', 'California sales tax 7.25%'],
			['US-CO', 2900, 'goods', 'Colorado sales tax 2.9%'],
			['US-CT', 6350, 'goods', 'Connecticut sales tax 6.35%'],
			['US-FL', 6000, 'goods', 'Florida sales tax 6%'],
			['US-IA', 6000, 'goods', 'Iowa sales tax 6%'],
			['US-IL', 6250, 'shipping', 'Illinois tax on shipping 6.25%'],
			['US-KS', 6500, 'goods', 'Kansas sales tax 6.5%'],
			['US-MA', 6250, 'goods', 'Massachusetts sales tax 6.25%'],
			['US-MI', 6000, 'goods shipping', 'Michigan sales tax 6%'],
			['US-MN', 6875, 'goods', 'Minnesota sales tax 6.875%'],
			['US-NC', 4750, 'goods', 'North Carolina sales tax 4.75%'],
			['US-ND', 5000, 'goods', 'North Dakota sales tax 5%'],
			['US-NE', 5500, 'goods', 'Nebraska sales tax 5.5%'],
			['US-NH', 0, '', 'New Hampshire has no sales tax'],
			['US-NJ', 6625, 'goods', 'New Jersey sales tax 6.625%'],
			['US-NM', 4875, 'goods service addon shipping', 'New Mexico gross receipts tax 4.875%'],
			['US-NV', 6850, 'goods', 'Nevada sales tax 6.85%'],
			['US-NY', 4000, 'goods shipping', 'New York sales tax 4%'],
			['US-OR', 0, '', 'Oregon has no sales tax'],
			['US-TN', 7000, 'goods', 'Tennessee sales tax 7%'],
			['US-TX', 6250, 'goods', 'Texas sales tax 6.25%'],
			['US-UT', 4850, 'goods', 'Utah sales tax 4.85%'],
			['US-VA', 5300, 'goods', 'Virginia sales tax 5.3%'],
			['US-WA', 6500, 'goods shipping', 'Washington sales tax 6.5%'],
			['US-WI', 5000, 'goods', 'Wisconsin sales tax 5%'],
			['US-WY', 4000, 'goods', 'Wyoming sales tax 4%'],
			['RESALE', 0, '', 'No tax, bought for resale'],
		].map(([region, rate, charged, label]) => [region, { label, rate, on: charged ? charged.split(' ') : [] }]),
	);

	/* Codes from the Promo Codes page. A code takes either a percentage
     (pct) or a fixed amount in cents per unit (each) off every line it
     reaches; skus and kinds narrow which lines those are. */
	const DISCOUNTS = {
		INSIDERS: { pct: 10, label: '10% Insider member rate' },
		SCULPT20: { pct: 20, skus: ['ML-BLAZ'], label: '20% off the Sculpted Shoulder Blazer' },
		FIRSTORDER: { pct: 15, label: '15% off a first order' },
		EXTRAS15: { pct: 15, kinds: ['addon', 'service'], label: '15% off extras and services' },
		TAKEBACK40: { each: 20000, skus: ['ML-GOWN'], label: '$200 off each gown traded in' },
		/* Stockists are never handed this as a code; it is how their
       wholesale price is worked out. */
		STOCKIST: { pct: 50, label: 'Wholesale price, half of retail' },
	};

	/* The catalog, matching the admin product list SKU for SKU. Each row
     reads [sku, icon, name, brand, price, stock, rating, reviews] with an
     optional { was, per } for a struck-through price or a recurring
     part. Extras and services carry no stock, hence null. */
	const CATALOG = {
		Clothing: [
			['ML-BLAZ', 'bi-briefcase', 'Sculpted Shoulder Blazer', 'Hollis Atelier', 1290, 184, 4.6, 214],
			['ML-GOWN', 'bi-stars', 'Draped Column Gown', 'Hollis Atelier', 2150, 236, 4.4, 131, { was: 2390 }],
			['ML-ORGZ', 'bi-flower1', 'Tiered Organza Dress', 'Calder Couture', 1680, 412, 4.7, 176],
			[
				'ML-SUIT',
				'bi-person-standing',
				'Chalk-Stripe Suit',
				'Willamette Tailors',
				2450,
				96,
				4.2,
				48,
				{ was: 2750 },
			],
			['ML-TRCH', 'bi-cloud-drizzle', 'Leather Trench Coat', 'Willamette Tailors', 3200, 128, 4.5, 67],
		],
		Accessories: [
			['ML-LOAF', 'bi-gem', 'Bar Loafers', 'Marlo', 790, 540, 4.8, 241],
			['ML-OXFD', 'bi-award', 'Two-Tone Oxfords', 'Marlo', 850, 310, 4.3, 88],
			['ML-CATE', 'bi-sunglasses', 'Cat-Eye Sunglasses', 'Fairhaven Optical', 465, 22, 4.1, 29],
			['ML-SHLD', 'bi-eyeglasses', 'Shield Sunglasses', 'Fairhaven Optical', 520, 0, 4.4, 54],
		],
		Extras: [
			['ML-GIFT250', 'bi-gift', 'E-Gift Card, $250', 'Marlo', 250, null, 4.6, 63],
			['ML-CARE', 'bi-scissors', 'Aftercare Plan, monthly', 'Marlo', 25, null, 4.7, 22, { per: '/member/month' }],
			['ML-PASS', 'bi-truck', 'Express Delivery Pass', 'Marlo', 15, null, 4.8, 31, { per: '/member/month' }],
		],
		Services: [
			['ML-MTM', 'bi-rulers', 'Made-to-Measure Tailoring', 'Marlo', 4800, null, 4.9, 12],
			['ML-STYLE', 'bi-person-standing-dress', 'Private Styling Session', 'Marlo', 650, null, 4.7, 10],
		],
	};
	const PRODUCTS = Object.entries(CATALOG).flatMap(([category, rows]) => rows.map((row) => toProduct(category, row)));
	const PRODUCT_BY_SKU = new Map(PRODUCTS.map((item) => [item.sku, item]));
	const KIND_BY_CATEGORY = { Extras: 'addon', Services: 'service' };

	/* Shoppers, grouped by member tier: flagship shows as Insider,
     partner as Member and trade as Standard. spent and count run from
     the day they joined; buys holds their most bought SKUs in units;
     last is their latest order where it predates every order below.
     home is [country, city, ...address lines]. These buyers are people,
     not Fieldline accounts, so their account stays null. */
	const SHOPPERS = {
		flagship: [
			{
				id: '#88041',
				name: 'Sandra Franklin',
				since: '2022-05-02',
				spent: 171840,
				count: 36,
				tone: 3,
				buys: '15 ML-GIFT250, 6 ML-LOAF, 5 ML-BLAZ',
				email: 'sandra.franklin@gmail.com',
				phone: '+1 203 555 0147',
				home: ['US', 'Stamford', '38 Juniper St', 'Stamford, CT 06901'],
			},
			{
				id: '#88042',
				name: 'Phyllis Delaney',
				since: '2020-12-08',
				spent: 135360,
				count: 29,
				tone: 1,
				buys: '11 ML-GIFT250, 5 ML-TRCH, 3 ML-BLAZ',
				email: 'phyllis.delaney@outlook.com',
				phone: '+1 603 555 0186',
				home: ['US', 'Concord', '1219 Aspen Ave', 'Concord, NH 03301'],
			},
			{
				id: '#88059',
				name: 'Jasmine Whitaker',
				since: '2024-02-11',
				spent: 122880,
				count: 24,
				tone: 2,
				buys: '10 ML-SHLD, 6 ML-BLAZ, 4 ML-CATE',
				email: 'jasmine.whitaker@icloud.com',
				phone: '+1 312 555 0174',
				home: ['US', 'Evanston', '2141 W Pierce Ave', 'Evanston, IL 60622'],
			},
		],
		partner: [
			{
				id: '#88031',
				name: 'Claire Donnelly',
				since: '2022-11-02',
				spent: 89920,
				count: 19,
				tone: 2,
				buys: '7 ML-ORGZ, 5 ML-BLAZ, 4 ML-OXFD',
				email: 'claire.donnelly@gmail.com',
				phone: '+1 303 555 0159',
				home: ['US', 'Boulder', '1835 S Pearl St', 'Boulder, CO 80210'],
			},
			{
				id: '#88060',
				name: 'Rochelle Fairbanks',
				since: '2024-05-22',
				spent: 86880,
				count: 17,
				tone: 4,
				buys: '5 ML-BLAZ, 5 ML-ORGZ, 3 ML-GIFT250',
				email: 'rochelle.fairbanks@gmail.com',
				phone: '+1 214 555 0137',
				home: ['US', 'Plano', '5817 Vickery Blvd', 'Plano, TX 75206'],
			},
			{
				id: '#88061',
				name: 'Gabriela McIntyre',
				since: '2022-10-11',
				spent: 71520,
				count: 15,
				tone: 1,
				buys: '5 ML-GOWN, 4 ML-TRCH, 3 ML-ORGZ',
				email: 'gabriela.mcintyre@outlook.com',
				phone: '+1 214 555 0166',
				home: ['US', 'Plano', '4310 Gilbert Ave', 'Plano, TX 75219'],
			},
			{
				id: '#88062',
				name: 'Faith van der Linden',
				since: '2023-01-23',
				spent: 62880,
				count: 13,
				tone: 3,
				buys: '4 ML-LOAF, 4 ML-ORGZ, 3 ML-BLAZ',
				email: 'faith.vanderlinden@gmail.com',
				phone: '+1 402 555 0148',
				home: ['US', 'Lincoln', '214 Hawthorne St', 'Lincoln, NE 68508'],
			},
			{
				id: '#88063',
				name: 'Josephine Albright',
				since: '2022-09-19',
				spent: 59840,
				count: 12,
				tone: 2,
				buys: '4 ML-GOWN, 3 ML-BLAZ, 3 ML-OXFD',
				email: 'josephine.albright@gmail.com',
				phone: '+1 617 555 0185',
				home: ['US', 'Boston', '41 Dartmouth St', 'Boston, MA 02116'],
			},
			{
				id: '#88046',
				name: 'Benjamin Hartley',
				since: '2022-06-30',
				spent: 56960,
				count: 14,
				tone: 1,
				buys: '8 ML-GIFT250, 4 ML-ORGZ, 3 ML-TRCH',
				email: 'ben.hartley@icloud.com',
				phone: '+1 303 555 0172',
				home: ['US', 'Boulder', '742 Marion St', 'Boulder, CO 80218'],
			},
			{
				id: '#88064',
				name: 'Candace Carpenter',
				since: '2023-12-09',
				spent: 53120,
				count: 11,
				tone: 3,
				buys: '4 ML-BLAZ, 3 ML-SHLD, 3 ML-LOAF',
				email: 'candace.carpenter@gmail.com',
				phone: '+1 312 555 0153',
				home: ['US', 'Evanston', '1527 N Wicker Ave', 'Evanston, IL 60622'],
			},
			{
				id: '#88065',
				name: 'Patricia Pemberton',
				since: '2023-09-18',
				spent: 49680,
				count: 10,
				tone: 4,
				buys: '4 ML-OXFD, 3 ML-BLAZ, 3 ML-GIFT250',
				email: 'patricia.pemberton@outlook.com',
				phone: '+1 360 555 0189',
				home: ['US', 'Olympia', '12 Magnolia St', 'Olympia, WA 98501'],
			},
			{
				id: '#88048',
				name: 'Natalie Tanner',
				since: '2024-11-11',
				spent: 46240,
				count: 11,
				tone: 2,
				buys: '5 ML-LOAF, 4 ML-ORGZ, 2 ML-TRCH',
				email: 'natalie.tanner@gmail.com',
				phone: '+1 928 555 0172',
				home: ['US', 'Flagstaff', '56 Chestnut Ave, Apt 302', 'Flagstaff, AZ 86001'],
			},
			{
				id: '#88066',
				name: 'Jackie Blackburn',
				since: '2022-12-06',
				spent: 40960,
				count: 9,
				tone: 1,
				buys: '3 ML-CATE, 3 ML-SUIT, 2 ML-OXFD',
				email: 'jackie.blackburn@outlook.com',
				phone: '+1 517 555 0139',
				home: ['US', 'Lansing', '47 Birch St', 'Lansing, MI 48933'],
			},
			{
				id: '#88067',
				name: 'Haley Freeman',
				since: '2023-03-01',
				spent: 34320,
				count: 7,
				tone: 3,
				buys: '3 ML-TRCH, 3 ML-LOAF, 2 ML-SUIT',
				email: 'haley.freeman@gmail.com',
				phone: '+1 801 555 0127',
				home: ['US', 'Provo', '1412 Laurel Ave', 'Provo, UT 84601'],
			},
		],
		trade: [
			{
				id: '#88044',
				name: 'Cheryl Sorensen',
				since: '2023-07-10',
				spent: 31840,
				count: 8,
				tone: 2,
				buys: '4 ML-OXFD, 3 ML-GIFT250, 2 ML-BLAZ',
				email: 'cheryl.sorensen@gmail.com',
				phone: '+1 612 555 0131',
				home: ['US', 'Minneapolis', '3412 Colfax Ave S', 'Minneapolis, MN 55408'],
			},
			{
				id: '#88053',
				name: 'Sabrina Kavanagh',
				since: '2024-11-20',
				spent: 29200,
				count: 7,
				tone: 4,
				buys: '3 ML-LOAF, 2 ML-ORGZ, 2 ML-GOWN',
				email: 'sabrina.kavanagh@icloud.com',
				phone: '+1 218 555 0164',
				home: ['US', 'Duluth', '22 Spruce St', 'Duluth, MN 55802'],
			},
			{
				id: '#88049',
				name: 'Travis Daugherty',
				since: '2024-10-29',
				spent: 28160,
				count: 8,
				tone: 1,
				buys: '5 ML-GIFT250, 5 ML-SHLD, 2 ML-SUIT',
				email: 'travis.daugherty@proton.me',
				phone: '+1 503 555 0161',
				home: ['US', 'Eugene', '2716 SE Clinton St', 'Eugene, OR 97202'],
			},
			{
				id: '#88043',
				name: 'Eleanor Fairweather',
				since: '2025-11-02',
				spent: 27280,
				count: 6,
				tone: 4,
				buys: '4 ML-LOAF, 2 ML-TRCH, 2 ML-GOWN',
				email: 'eleanor.fairweather@outlook.com',
				phone: '+1 701 555 0187',
				home: ['US', 'Minot', '17 Walnut St', 'Minot, ND 58701'],
			},
			{
				id: '#88068',
				name: 'Valerie Richards',
				since: '2024-03-04',
				spent: 24960,
				count: 6,
				tone: 1,
				buys: '2 ML-BLAZ, 2 ML-SUIT, 2 ML-LOAF',
				email: 'valerie.richards@gmail.com',
				phone: '+1 813 555 0148',
				home: ['US', 'Tampa', '2908 W Bay to Saltings Blvd', 'Tampa, FL 33629'],
			},
			{
				id: '#88050',
				name: 'Christopher Vance',
				since: '2024-06-03',
				spent: 23520,
				count: 6,
				tone: 4,
				buys: '7 ML-GIFT250, 4 ML-LOAF, 2 ML-CATE',
				email: 'chris.vance@outlook.com',
				phone: '+1 813 555 0127',
				home: ['US', 'Tampa', '512 S Sandusky Ave', 'Tampa, FL 33606'],
			},
			{
				id: '#88069',
				name: 'Debbie Gardner',
				since: '2024-02-26',
				spent: 22880,
				count: 5,
				tone: 3,
				buys: '3 ML-LOAF, 2 ML-GOWN, 2 ML-OXFD',
				email: 'debbie.gardner@gmail.com',
				phone: '+1 501 555 0132',
				home: ['US', 'Little Rock', '1782 Poplar St', 'Little Rock, AR 72201'],
			},
			{
				id: '#88052',
				name: 'Iva Blackwood',
				since: '2024-09-26',
				spent: 21920,
				count: 5,
				tone: 2,
				buys: '5 ML-GIFT250, 2 ML-LOAF, 1 ML-STYLE',
				email: 'iva.blackwood@gmail.com',
				phone: '+1 515 555 0128',
				home: ['US', 'Ames', '8 Hickory St', 'Ames, IA 50010'],
			},
			{
				id: '#88055',
				name: 'Fiona MacAllister',
				since: '2025-07-14',
				spent: 20880,
				count: 5,
				tone: 3,
				buys: '5 ML-GIFT250, 3 ML-LOAF, 3 ML-OXFD',
				email: 'fiona.macallister@outlook.com',
				phone: '+1 608 555 0119',
				home: ['US', 'La Crosse', '14 Dogwood Ave', 'La Crosse, WI 54601'],
			},
			{
				id: '#88070',
				name: 'Bonnie Byrd',
				since: '2023-11-02',
				spent: 19280,
				count: 4,
				tone: 2,
				buys: '3 ML-OXFD, 2 ML-LOAF, 1 ML-TRCH',
				email: 'bonnie.byrd@gmail.com',
				phone: '+1 515 555 0193',
				home: ['US', 'Des Moines', '31 Cypress St', 'Des Moines, IA 50309'],
			},
			{
				id: '#88071',
				name: 'Ramona Davenport',
				since: '2024-07-25',
				spent: 17440,
				count: 4,
				tone: 1,
				buys: '3 ML-ORGZ, 2 ML-LOAF, 2 ML-OXFD',
				email: 'ramona.davenport@gmail.com',
				phone: '+1 865 555 0187',
				home: ['US', 'Knoxville', '210 Sycamore Ave', 'Knoxville, TN 37902'],
			},
			{
				id: '#88072',
				name: 'Georgia Webster',
				since: '2025-01-20',
				spent: 15680,
				count: 4,
				tone: 4,
				buys: '3 ML-OXFD, 2 ML-ORGZ, 1 ML-GOWN',
				email: 'georgia.webster@gmail.com',
				phone: '+1 505 555 0164',
				home: ['US', 'Santa Fe', '27 Juniper Ave', 'Santa Fe, NM 87501'],
			},
			{
				id: '#88076',
				name: 'Caroline Flowers',
				since: '2024-09-19',
				spent: 26080,
				count: 6,
				tone: 4,
				buys: '1 ML-BLAZ, 1 ML-LOAF, 1 ML-GIFT250',
				last: '2026-06-18',
				email: 'caroline.flowers@gmail.com',
				phone: '+1 806 555 0163',
				home: ['US', 'Amarillo', '1450 Aspen St, Apt 52', 'Amarillo, TX 79101'],
			},
			{
				id: '#88077',
				name: 'Francis Pennington',
				since: '2025-10-31',
				spent: 11680,
				count: 2,
				tone: 3,
				buys: '2 ML-GOWN, 1 ML-GIFT250',
				last: '2026-05-12',
				email: 'francis.pennington@icloud.com',
				phone: '+1 615 555 0172',
				home: ['US', 'Nashville', '1504 Ashwood Ave', 'Nashville, TN 37212'],
			},
			{
				id: '#88057',
				name: 'Cheryl Schultz',
				since: '2025-04-09',
				spent: 9840,
				count: 3,
				tone: 4,
				buys: '3 ML-GIFT250, 2 ML-LOAF, 1 ML-GOWN',
				email: 'cheryl.schultz@outlook.com',
				phone: '+1 785 555 0148',
				home: ['US', 'Topeka', '22 Magnolia Ave', 'Topeka, KS 66603'],
			},
			{
				id: '#88080',
				name: 'Maureen Fitzgerald',
				since: '2025-03-03',
				spent: 9920,
				count: 2,
				tone: 3,
				buys: '2 ML-OXFD, 1 ML-LOAF, 1 ML-GIFT250',
				email: 'maureen.fitzgerald@gmail.com',
				phone: '+1 307 555 0164',
				home: ['US', 'Cheyenne', '31 Hawthorne Ave', 'Cheyenne, WY 82001'],
			},
			{
				id: '#88074',
				name: 'Rebecca MacKinnon',
				since: '2025-02-27',
				spent: 9440,
				count: 3,
				tone: 1,
				buys: '4 ML-SHLD, 2 ML-ORGZ, 2 ML-LOAF',
				email: 'rebecca.mackinnon@gmail.com',
				phone: '+1 716 555 0146',
				home: ['US', 'Buffalo', '6175 Chestnut St', 'Buffalo, NY 14202'],
			},
			{
				id: '#88073',
				name: 'Abigail Montgomery',
				since: '2025-04-11',
				spent: 7520,
				count: 2,
				tone: 3,
				buys: '2 ML-LOAF, 2 ML-GIFT250, 1 ML-OXFD',
				email: 'abigail.montgomery@gmail.com',
				phone: '+1 702 555 0158',
				home: ['US', 'Las Vegas', '1820 S 6th St', 'Las Vegas, NV 89104'],
			},
			{
				id: '#88075',
				name: 'Penelope Bradford',
				since: '2025-02-17',
				spent: 6880,
				count: 2,
				tone: 2,
				buys: '3 ML-SHLD, 2 ML-LOAF, 1 ML-OXFD',
				email: 'penny.ashworth@outlook.com',
				phone: '+1 919 555 0175',
				home: ['US', 'Raleigh', '812 Wake Forest Rd', 'Raleigh, NC 27604'],
			},
			{
				id: '#88079',
				name: 'Beatrice Hollings',
				since: '2025-10-05',
				spent: 9120,
				count: 2,
				tone: 2,
				buys: '2 ML-GOWN, 2 ML-SHLD, 1 ML-GIFT250',
				email: 'beatrice.hollings@gmail.com',
				phone: '+1 515 555 0182',
				home: ['US', 'Ames', '5 Laurel St', 'Ames, IA 50010'],
			},
			{
				id: '#88078',
				name: 'Jennifer McDaniel',
				since: '2025-10-03',
				spent: 4960,
				count: 1,
				tone: 1,
				buys: '1 ML-TRCH, 1 ML-GIFT250',
				last: '2026-07-15',
				email: 'jennifer.mcdaniel@icloud.com',
				phone: '+1 309 555 0164',
				home: ['US', 'Peoria', '27 Birch Ave', 'Peoria, IL 61602'],
			},
			{
				id: '#88081',
				name: 'Evangeline Ainsworth',
				since: '2022-10-26',
				spent: 33440,
				count: 8,
				tone: 1,
				buys: '3 ML-ORGZ, 3 ML-LOAF, 2 ML-GIFT250',
				last: '2026-06-05',
				email: 'evie.ainsworth@gmail.com',
				phone: '+1 316 555 0182',
				home: ['US', 'Wichita', '3415 E Douglas Ave', 'Wichita, KS 67218'],
			},
			{
				id: '#88082',
				name: 'Sheila Humphrey',
				since: '2025-05-16',
				spent: 15120,
				count: 4,
				tone: 4,
				buys: '2 ML-BLAZ, 2 ML-OXFD, 2 ML-LOAF',
				last: '2026-07-30',
				email: 'sheila.humphrey@gmail.com',
				phone: '+1 785 555 0167',
				home: ['US', 'Topeka', '34 Spruce Ave', 'Topeka, KS 66603'],
			},
			{
				id: '#88083',
				name: 'Marilyn Erickson',
				since: '2025-11-28',
				spent: 6080,
				count: 2,
				tone: 2,
				buys: '1 ML-GOWN, 2 ML-GIFT250, 1 ML-LOAF',
				last: '2026-07-02',
				email: 'marilyn.erickson@gmail.com',
				phone: '+1 919 555 0146',
				home: ['US', 'Durham', '523 Poplar Ave, Apt 401', 'Durham, NC 27701'],
			},
			{
				id: '#88058',
				name: 'Caitlin Fitzpatrick',
				since: '2026-10-05',
				spent: 0,
				count: 0,
				tone: 2,
				buys: '',
				email: 'caitlin.fitzpatrick@gmail.com',
				phone: '+1 218 555 0129',
				home: ['US', 'Duluth', '3 Walnut Ave', 'Duluth, MN 55802'],
			},
		],
	};

	/* Independent boutiques that buy Marlo wholesale to sell on. They
     share the shopper shape, add the person who buys for the shop, and
     stay out of CUSTOMERS: their orders live in WHOLESALE alone. */
	const STOCKIST_ROWS = [
		{
			id: '#2032',
			name: 'The Silk Room',
			buyer: 'Dana Whitfield',
			since: '2022-04-05',
			spent: 418480,
			count: 16,
			tone: 2,
			buys: '120 ML-LOAF, 96 ML-TRCH, 40 ML-GOWN',
			email: 'dana@thesilkroom.com',
			phone: '+1 201 555 0162',
			home: ['US', 'Hoboken', '214 Hickory St', 'Hoboken, NJ 07030'],
		},
		{
			id: '#2031',
			name: 'Arbor North Studio',
			buyer: 'Maren Lie',
			since: '2023-08-14',
			spent: 309120,
			count: 11,
			tone: 1,
			buys: '42 ML-BLAZ, 36 ML-SUIT, 30 ML-CATE',
			email: 'maren@arbornorthstudio.com',
			phone: '+1 785 555 0184',
			home: ['US', 'Topeka', '35 Cypress St', 'Topeka, KS 66603'],
		},
		{
			id: '#2034',
			name: 'Magnolia Lane',
			buyer: 'Camille Roux',
			since: '2023-03-27',
			spent: 238240,
			count: 9,
			tone: 4,
			buys: '44 ML-GOWN, 36 ML-LOAF, 28 ML-BLAZ',
			email: 'camille@magnolialane.com',
			phone: '+1 309 555 0137',
			home: ['US', 'Peoria', '14 Dogwood St', 'Peoria, IL 61602'],
		},
		{
			id: '#2033',
			name: 'Wren & Thistle',
			buyer: 'Jean Murray',
			since: '2024-02-19',
			spent: 147360,
			count: 7,
			tone: 3,
			buys: '60 ML-OXFD, 48 ML-CATE, 30 ML-ORGZ',
			email: 'jean@wrenandthistle.com',
			phone: '+1 608 555 0154',
			home: ['US', 'La Crosse', '61 4th St', 'La Crosse, WI 54601'],
		},
		{
			id: '#2035',
			name: 'Hartley & Briar',
			buyer: 'Courtney Hartley',
			since: '2024-08-12',
			spent: 119680,
			count: 5,
			tone: 1,
			buys: '30 ML-OXFD, 24 ML-SUIT, 18 ML-BLAZ',
			email: 'courtney@hartleyandbriar.com',
			phone: '+1 360 555 0131',
			home: ['US', 'Olympia', '218 12th Ave', 'Olympia, WA 98501'],
		},
	];

	const CUSTOMERS = Object.entries(SHOPPERS).flatMap(([tier, rows]) => rows.map((row) => toBuyer(row, tier)));
	const STOCKISTS = STOCKIST_ROWS.map((row) => toBuyer(row, 'stockist'));
	const BUYERS = [...CUSTOMERS, ...STOCKISTS];

	/* Web store orders (SO-), grouped by the day they were placed, newest
     day first; numbers climb with time. Each row reads [number, time,
     buyer, status, pay, items] plus optional extras: discount, ship
     (when not the country's usual method), declined (the day a card
     bounced), cancel (the reason) and refund (what came back after
     delivery, matching a claim on the Refunds page).

     status  placed (unpaid), paid (not yet packed), picking (packed,
             waiting on the carrier), dispatched, delivered (done when
             nothing ships) or canceled
     pay     card, terms (invoice due in 30 days), ach (bank transfer)
             or check (gift card) */
	const SHOP_DAYS = {
		'2026-10-09': [
			['#484', '10:12', 'Josephine Albright', 'placed', 'card', '1 ML-BLAZ, 1 ML-OXFD', { discount: 'SCULPT20' }],
			['#483', '09:30', 'Faith van der Linden', 'paid', 'terms', '2 ML-ORGZ'],
			['#482', '08:05', 'Gabriela McIntyre', 'paid', 'card', '2 ML-ORGZ'],
		],
		'2026-10-08': [
			['#481', '16:50', 'Jasmine Whitaker', 'paid', 'terms', '2 ML-OXFD, 1 ML-CATE'],
			['#480', '13:15', 'Rochelle Fairbanks', 'paid', 'terms', '2 ML-ORGZ, 1 ML-STYLE'],
			['#479', '10:40', 'Natalie Tanner', 'picking', 'card', '2 ML-LOAF'],
			['#478', '09:12', 'Sandra Franklin', 'picking', 'terms', '2 ML-BLAZ', { discount: 'INSIDERS' }],
		],
		'2026-10-07': [
			['#477', '15:15', 'Sabrina Kavanagh', 'picking', 'terms', '1 ML-LOAF'],
			['#476', '13:40', 'Debbie Gardner', 'dispatched', 'card', '2 ML-LOAF'],
			['#475', '10:20', 'Cheryl Sorensen', 'paid', 'card', '1 ML-STYLE, 1 ML-GIFT250', { discount: 'EXTRAS15' }],
			['#474', '08:50', 'Phyllis Delaney', 'dispatched', 'ach', '1 ML-TRCH'],
		],
		'2026-10-06': [
			['#473', '15:20', 'Christopher Vance', 'dispatched', 'card', '1 ML-LOAF, 1 ML-GIFT250'],
			['#472', '11:30', 'Eleanor Fairweather', 'delivered', 'terms', '1 ML-TRCH, 1 ML-LOAF'],
			['#471', '09:45', 'Claire Donnelly', 'placed', 'card', '2 ML-OXFD', { declined: '2026-10-06' }],
		],
		'2026-10-05': [
			['#470', '16:10', 'Patricia Pemberton', 'dispatched', 'card', '2 ML-BLAZ', { discount: 'SCULPT20' }],
			['#469', '13:30', 'Benjamin Hartley', 'dispatched', 'terms', '1 ML-ORGZ, 1 ML-OXFD'],
			['#468', '11:00', 'Candace Carpenter', 'delivered', 'terms', '2 ML-BLAZ', { discount: 'SCULPT20' }],
			['#467', '09:15', 'Jackie Blackburn', 'delivered', 'terms', '1 ML-SUIT'],
		],
		'2026-10-04': [
			['#466', '14:40', 'Cheryl Schultz', 'placed', 'check', '1 ML-GOWN'],
			['#465', '10:30', 'Jasmine Whitaker', 'delivered', 'terms', '1 ML-SUIT'],
		],
		'2026-10-03': [
			['#464', '14:05', 'Faith van der Linden', 'delivered', 'terms', '1 ML-BLAZ', { discount: 'SCULPT20' }],
			['#463', '11:20', 'Iva Blackwood', 'delivered', 'card', '2 ML-GIFT250'],
			['#462', '09:50', 'Maureen Fitzgerald', 'delivered', 'card', '1 ML-OXFD', { discount: 'FIRSTORDER' }],
		],
		'2026-10-02': [
			['#461', '15:30', 'Gabriela McIntyre', 'delivered', 'card', '1 ML-TRCH, 1 ML-SUIT'],
			['#460', '11:40', 'Fiona MacAllister', 'delivered', 'terms', '1 ML-LOAF, 1 ML-GIFT250'],
			['#459', '09:15', 'Valerie Richards', 'delivered', 'card', '1 ML-SUIT'],
		],
		'2026-10-01': [
			['#458', '14:50', 'Rochelle Fairbanks', 'delivered', 'terms', '2 ML-BLAZ', { discount: 'SCULPT20' }],
			['#457', '10:20', 'Sabrina Kavanagh', 'delivered', 'terms', '2 ML-ORGZ'],
		],
		'2026-09-30': [
			['#456', '13:40', 'Phyllis Delaney', 'delivered', 'ach', '1 ML-SUIT'],
			['#455', '09:00', 'Sandra Franklin', 'delivered', 'terms', '2 ML-OXFD', { discount: 'INSIDERS' }],
		],
		'2026-09-29': [
			['#454', '14:30', 'Christopher Vance', 'delivered', 'terms', '1 ML-CATE'],
			['#453', '09:10', 'Georgia Webster', 'delivered', 'card', '1 ML-GOWN'],
		],
		'2026-09-28': [
			['#452', '16:20', 'Patricia Pemberton', 'delivered', 'card', '2 ML-OXFD'],
			['#451', '13:00', 'Rebecca MacKinnon', 'delivered', 'card', '2 ML-SHLD'],
			['#450', '10:40', 'Ramona Davenport', 'delivered', 'card', '2 ML-ORGZ'],
			[
				'#449',
				'08:30',
				'Natalie Tanner',
				'delivered',
				'card',
				'2 ML-ORGZ',
				{
					refund: {
						on: '2026-10-07',
						items: '1 ML-ORGZ',
						reason: 'Faulty on arrival',
						note: 'One pair had a dropped stitch at the heel that ran after a single wear. Refunded to the card.',
					},
				},
			],
		],
		'2026-09-27': [
			[
				'#448',
				'11:50',
				'Phyllis Delaney',
				'delivered',
				'ach',
				'2 ML-SHLD',
				{
					refund: {
						on: '2026-10-02',
						items: '1 ML-SHLD',
						reason: 'Short delivery',
						note: 'The parcel held one pair of sunglasses, not two. Credited to her next order.',
					},
				},
			],
			['#447', '09:05', 'Travis Daugherty', 'delivered', 'card', '1 ML-SUIT'],
		],
		'2026-09-26': [
			['#446', '15:10', 'Bonnie Byrd', 'delivered', 'check', '2 ML-OXFD'],
			['#445', '12:30', 'Debbie Gardner', 'delivered', 'card', '1 ML-GOWN', { discount: 'TAKEBACK40' }],
		],
		'2026-09-25': [
			['#444', '13:20', 'Cheryl Sorensen', 'delivered', 'card', '1 ML-OXFD'],
			['#443', '10:45', 'Benjamin Hartley', 'delivered', 'terms', '1 ML-TRCH'],
		],
		'2026-09-24': [
			[
				'#442',
				'16:05',
				'Valerie Richards',
				'delivered',
				'card',
				'1 ML-BLAZ',
				{
					discount: 'SCULPT20',
					refund: {
						on: '2026-10-02',
						items: '1 ML-BLAZ',
						reason: 'Ordered twice',
						note: 'She ordered again when the page timed out. This duplicate blazer came back unworn, tags on.',
					},
				},
			],
			['#441', '12:15', 'Abigail Montgomery', 'delivered', 'card', '1 ML-LOAF', { discount: 'FIRSTORDER' }],
			['#440', '09:20', 'Jasmine Whitaker', 'delivered', 'terms', '2 ML-BLAZ', { discount: 'SCULPT20' }],
		],
		'2026-09-23': [
			['#439', '14:45', 'Penelope Bradford', 'delivered', 'card', '2 ML-SHLD'],
			['#438', '10:00', 'Jackie Blackburn', 'delivered', 'terms', '1 ML-CATE'],
		],
		'2026-09-22': [
			['#437', '15:10', 'Candace Carpenter', 'delivered', 'card', '2 ML-SHLD'],
			[
				'#436',
				'11:30',
				'Claire Donnelly',
				'delivered',
				'terms',
				'2 ML-BLAZ',
				{
					discount: 'SCULPT20',
					refund: {
						on: '2026-09-30',
						items: '1 ML-BLAZ',
						reason: 'Damaged in transit',
						note: 'One blazer arrived with a marked sleeve. Refunded by bank transfer and the claim filed with UPS.',
					},
				},
			],
			['#435', '08:55', 'Haley Freeman', 'delivered', 'terms', '1 ML-TRCH'],
		],
		'2026-09-21': [
			[
				'#434',
				'13:25',
				'Josephine Albright',
				'delivered',
				'terms',
				'2 ML-GOWN',
				{
					refund: {
						on: '2026-09-29',
						items: '1 ML-GOWN',
						reason: 'Wrong item sent',
						note: 'One of the two dresses was a size L, not M. It came back and was refunded by bank transfer.',
					},
				},
			],
			[
				'#433',
				'09:40',
				'Faith van der Linden',
				'delivered',
				'terms',
				'2 ML-LOAF',
				{
					refund: {
						on: '2026-09-28',
						items: '1 ML-LOAF',
						reason: 'Faulty on arrival',
						note: 'One loafer had a stitch loose at the heel. Credited against her next order.',
					},
				},
			],
		],
		'2026-09-20': [
			['#432', '10:15', 'Gabriela McIntyre', 'delivered', 'card', '2 ML-GOWN', { discount: 'TAKEBACK40' }],
		],
		'2026-09-19': [
			[
				'#431',
				'10:12',
				'Sandra Franklin',
				'delivered',
				'terms',
				'1 ML-BLAZ, 1 ML-OXFD, 1 ML-LOAF',
				{ discount: 'INSIDERS' },
			],
		],
		'2026-09-18': [
			['#430', '14:26', 'Natalie Tanner', 'delivered', 'terms', '1 ML-TRCH, 1 ML-SUIT, 1 ML-GIFT250'],
			['#429', '08:41', 'Eleanor Fairweather', 'delivered', 'ach', '1 ML-GOWN, 1 ML-LOAF'],
		],
		'2026-09-17': [
			[
				'#428',
				'11:05',
				'Cheryl Sorensen',
				'delivered',
				'card',
				'1 ML-BLAZ, 1 ML-OXFD, 1 ML-CATE, 1 ML-ORGZ',
				{ discount: 'SCULPT20', ship: 'FedEx 2Day' },
			],
		],
		'2026-09-16': [
			[
				'#427',
				'16:48',
				'Beatrice Hollings',
				'delivered',
				'card',
				'1 ML-GOWN, 1 ML-SHLD, 1 ML-GIFT250',
				{ ship: 'DHL Express 9:00' },
			],
		],
		'2026-09-15': [['#426', '09:30', 'Benjamin Hartley', 'delivered', 'terms', '1 ML-MTM']],
		'2026-09-14': [['#425', '13:17', 'Georgia Webster', 'delivered', 'check', '2 ML-ORGZ, 2 ML-OXFD']],
		'2026-09-13': [
			[
				'#424',
				'10:54',
				'Phyllis Delaney',
				'delivered',
				'ach',
				'1 ML-BLAZ, 1 ML-TRCH, 1 ML-SUIT',
				{ discount: 'SCULPT20' },
			],
		],
		'2026-09-12': [
			[
				'#423',
				'09:03',
				'Travis Daugherty',
				'canceled',
				'card',
				'1 ML-SHLD',
				{ cancel: 'The shield sunglasses are on backorder, and he couldn’t wait that long.' },
			],
		],
		'2026-09-11': [['#422', '15:36', 'Christopher Vance', 'delivered', 'terms', '1 ML-LOAF, 1 ML-GIFT250']],
		'2026-09-09': [['#421', '12:20', 'Jasmine Whitaker', 'delivered', 'card', '2 ML-OXFD, 1 ML-CATE']],
		'2026-09-07': [['#420', '10:08', 'Iva Blackwood', 'delivered', 'check', '1 ML-STYLE']],
		'2026-09-05': [
			[
				'#419',
				'09:47',
				'Sabrina Kavanagh',
				'delivered',
				'terms',
				'1 ML-GOWN, 1 ML-LOAF, 1 ML-OXFD, 1 ML-GIFT250',
			],
		],
		'2026-09-04': [
			[
				'#418',
				'14:02',
				'Sandra Franklin',
				'delivered',
				'terms',
				'1 ML-ORGZ, 1 ML-CATE',
				{ discount: 'INSIDERS' },
			],
		],
		'2026-09-02': [['#417', '17:15', 'Rochelle Fairbanks', 'delivered', 'card', '1 ML-GIFT250']],
		'2026-08-31': [
			[
				'#416',
				'11:22',
				'Fiona MacAllister',
				'delivered',
				'terms',
				'1 ML-TRCH, 1 ML-SUIT, 1 ML-OXFD, 1 ML-LOAF, 1 ML-GIFT250',
				{ ship: 'USPS Ground Advantage' },
			],
		],
		'2026-08-28': [['#415', '09:58', 'Natalie Tanner', 'delivered', 'terms', '1 ML-STYLE, 1 ML-LOAF']],
		'2026-08-24': [
			[
				'#414',
				'15:31',
				'Cheryl Sorensen',
				'canceled',
				'card',
				'1 ML-SUIT',
				{ ship: 'FedEx 2Day', cancel: 'Ordered by mistake; she meant the Leather Trench Coat.' },
			],
		],
	};

	/* Stockist orders (WO-): [number, placed, status, stockist, items].
     They always go on invoice at the STOCKIST price. */
	const WHOLESALE_ROWS = [
		['#36', '2026-10-08 14:05', 'paid', 'The Silk Room', '8 ML-TRCH, 12 ML-LOAF, 4 ML-GOWN'],
		['#35', '2026-10-07 09:20', 'dispatched', 'Wren & Thistle', '10 ML-OXFD, 8 ML-CATE, 6 ML-ORGZ'],
		['#34', '2026-10-06 10:05', 'picking', 'Magnolia Lane', '6 ML-GOWN, 4 ML-BLAZ'],
		['#33', '2026-09-29 14:00', 'delivered', 'Hartley & Briar', '8 ML-OXFD, 6 ML-SUIT, 4 ML-BLAZ'],
		['#32', '2026-09-22 10:30', 'delivered', 'Arbor North Studio', '6 ML-BLAZ, 6 ML-SUIT, 8 ML-CATE'],
		['#31', '2026-09-15 15:45', 'delivered', 'The Silk Room', '12 ML-LOAF, 10 ML-TRCH'],
	];

	const ORDERS = Object.entries(SHOP_DAYS).flatMap(([date, rows]) => rows.map((row) => toShopOrder(date, row)));
	const WHOLESALE = WHOLESALE_ROWS.map(toWholesaleOrder);
	const ALL_ORDERS = [...ORDERS, ...WHOLESALE];

	const CARD_BRANDS = ['Visa', 'Mastercard', 'American Express'];
	const storyCache = new Map();

	publish();

	/** Prices every order, then hands the whole book out read-only. */
	function publish() {
		for (const order of ALL_ORDERS) {
			order.total = sums(order).total / 100;
		}

		window.Basalt.shopBook = deepFreeze({
			NOW,
			PRODUCTS,
			CUSTOMERS,
			STOCKISTS,
			ORDERS,
			WHOLESALE,
			COUNTRIES,
			DISCOUNTS,
			SHIPPING,
			TAX,
			REGIONS,
			REGION_OF,
			SHIP_BY_COUNTRY,
			kind,
			line,
			shipping,
			sums,
			refund,
			story,
			seeded,
			customer: buyerNamed,
			product: productBySku,
			order: orderById,
		});
	}

	/* Turning rows into records. */

	function toProduct(category, [sku, icon, name, brand, price, stock, rating, reviews, extra = {}]) {
		return {
			sku,
			name,
			brand,
			category,
			price,
			per: extra.per ?? null,
			compareAtPrice: extra.was ?? null,
			rating,
			reviews,
			stock,
			icon,
		};
	}

	/**
	 * Builds a shopper or stockist record. The tax region is US-ST, read
	 * from the state code on the second address line; stockists buy for
	 * resale and pay none.
	 */
	function toBuyer(row, tier) {
		const forResale = tier === 'stockist';
		const [country, city, ...address] = row.home;
		const state = /, ([A-Z]{2}) /.exec(address[1])?.[1];
		const record = {
			id: row.id,
			tier,
			name: row.name,
			buyer: row.buyer ?? row.name,
			account: null,
			email: row.email,
			phone: row.phone,
			city,
			address,
			country,
			state,
			tax: forResale ? 'RESALE' : `${country}-${state}`,
			joinedOn: row.since,
			lifetimeValue: row.spent,
			orders: row.count,
			avatarTone: row.tone,
			buys: unitsOf(row.buys),
		};
		if (row.last) record.last = row.last;
		return record;
	}

	/** Reads '2 ML-ORGZ, 1 ML-OXFD' as [['ML-ORGZ', 2], ['ML-OXFD', 1]]. */
	function unitsOf(spec) {
		if (!spec) return [];
		return spec.split(', ').map((entry) => {
			const [count, sku] = entry.split(' ');
			return [sku, Number(count)];
		});
	}

	function asLines(spec) {
		return unitsOf(spec).map(([sku, qty]) => ({ sku, qty }));
	}

	function toShopOrder(date, [orderNumber, time, customer, status, pay, items, extra = {}]) {
		const { refund: returned, ...rest } = extra;
		const order = { orderNumber, customer, channel: 'online', status, date, time, lines: asLines(items), ...rest };
		if (returned) {
			order.refund = {
				date: returned.on,
				lines: asLines(returned.items),
				reason: returned.reason,
				note: returned.note,
			};
		}
		return settle(order, pay);
	}

	function toWholesaleOrder([orderNumber, placedAt, status, customer, items]) {
		const [date, time] = placedAt.split(' ');
		const order = {
			orderNumber,
			customer,
			channel: 'wholesale',
			status,
			date,
			time,
			lines: asLines(items),
			discount: 'STOCKIST',
		};
		return settle(order, 'terms');
	}

	/**
	 * Copies the buyer's country, state and tax region onto an order,
	 * records how it is paid, and gives goods the zone's usual shipping
	 * method unless the row already named one.
	 */
	function settle(order, pay) {
		const { country, state, tax } = buyerNamed(order.customer);
		Object.assign(order, { country, state, tax, paymentMethod: pay });
		if (!order.ship && hasGoods(order)) order.ship = SHIP_BY_ZONE[REGION_OF[state]] || SHIP_BY_COUNTRY[country];
		return order;
	}

	/* Lookups the pages call. */

	/** The product with this SKU, or the first one when nothing matches. */
	function productBySku(sku) {
		return PRODUCT_BY_SKU.get(sku) ?? PRODUCTS[0];
	}

	/** A shopper or stockist by display name; undefined when unknown. */
	function buyerNamed(fullName) {
		return BUYERS.find((buyer) => buyer.name === fullName);
	}

	/** A shop or wholesale order by its number, or null. */
	function orderById(id) {
		return ALL_ORDERS.find((order) => order.orderNumber === id) ?? null;
	}

	/** goods ship in a parcel; addon (extras) and service lines do not. */
	function kind(sku) {
		return KIND_BY_CATEGORY[productBySku(sku).category] ?? 'goods';
	}

	function hasGoods(order) {
		return order.lines.some((entry) => kind(entry.sku) === 'goods');
	}

	/* Money, all in cents. */

	/**
	 * One order line priced: gross before the discount, off (what the
	 * order's code takes away), net after it, and the line's kind.
	 */
	function line(order, entry) {
		const lineKind = kind(entry.sku);
		const gross = Math.round(productBySku(entry.sku).price * 100) * entry.qty;
		const promo = order.discount ? DISCOUNTS[order.discount] : null;
		const reaches =
			Boolean(promo) &&
			(!promo.skus || promo.skus.includes(entry.sku)) &&
			(!promo.kinds || promo.kinds.includes(lineKind));
		let off = 0;
		if (reaches) off = promo.each ? Math.min(gross, promo.each * entry.qty) : Math.round((gross * promo.pct) / 100);
		return { gross, off, net: gross - off, kind: lineKind };
	}

	/** Shipping in cents; free-over thresholds count goods before discounts. */
	function shipping(order) {
		if (!order.ship) return 0;
		const method = SHIPPING[order.ship];
		let goodsCents = 0;
		for (const entry of order.lines) {
			const priced = line(order, entry);
			if (priced.kind === 'goods') goodsCents += priced.gross;
		}
		const waived = method.freeOver && goodsCents >= method.freeOver * 100;
		return waived ? 0 : method.cents;
	}

	function taxes(order, charge) {
		return TAX[order.tax].on.includes(charge);
	}

	function taxFor(order, taxableCents) {
		return Math.round((taxableCents * TAX[order.tax].rate) / 100000);
	}

	/** The full bill for an order: subtotal, discount, shipping, tax, total, refunded. */
	function sums(order) {
		let subtotal = 0;
		let discount = 0;
		let taxable = 0;
		for (const entry of order.lines) {
			const priced = line(order, entry);
			subtotal += priced.gross;
			discount += priced.off;
			if (taxes(order, priced.kind)) taxable += priced.net;
		}
		const carriage = shipping(order);
		if (taxes(order, 'shipping')) taxable += carriage;
		const tax = taxFor(order, taxable);
		return {
			subtotal,
			discount,
			shipping: carriage,
			tax,
			total: subtotal - discount + carriage + tax,
			refunded: order.refund ? refund(order, order.refund.lines, false).cents : 0,
		};
	}

	/**
	 * What handing back some units costs the shop, in cents.
	 * @param {object} order the order the units came from
	 * @param {{sku: string, qty: number}[]} picks units going back, per SKU
	 * @param {boolean} withShipping also return the shipping charge
	 * @returns {{items: number, ship: number, tax: number, cents: number}}
	 */
	function refund(order, picks, withShipping) {
		let items = 0;
		let taxable = 0;
		for (const giving of picks) {
			const bought = order.lines.find((entry) => entry.sku === giving.sku);
			const priced = line(order, bought);
			const share = Math.round((priced.net * giving.qty) / bought.qty);
			items += share;
			if (taxes(order, priced.kind)) taxable += share;
		}
		const ship = withShipping ? shipping(order) : 0;
		if (ship && taxes(order, 'shipping')) taxable += ship;
		const tax = taxFor(order, taxable);
		return { items, ship, tax, cents: items + ship + tax };
	}

	/* An order's history, worked out once and cached by order number.

     Card orders are paid the moment they are placed. Invoices on terms
     start fulfillment right away and are paid 18 days later; bank
     transfers clear after an hour and gift cards within minutes.
     Goods are packed two hours after fulfillment starts (or at 9:30 the
     next morning when that is after 1 pm), leave at 3:40 pm, and land
     after the region's transit days. Services are done 4 days after the
     order. A declined card is noted on the day it bounced. */

	/**
	 * @returns {{placed: string, region: string, site: string, goods: boolean, payment: object, fulfil: object}}
	 */
	function story(order) {
		const known = storyCache.get(order.orderNumber);
		if (known) return known;

		const roll = seeded(order.orderNumber);
		const placed = `${order.date}T${order.time}`;
		const regionKey = REGION_OF[order.state] || 'na';
		const goods = hasGoods(order);
		const payment = paymentFor(order, placed, roll);
		const fulfil = fulfillmentFor(order, { placed, regionKey, goods, payment, roll });

		const told = { placed, region: regionKey, site: REGIONS[regionKey].site, goods, payment, fulfil };
		storyCache.set(order.orderNumber, told);
		return told;
	}

	function paymentFor(order, placed, roll) {
		const how = order.paymentMethod;
		const settled = order.status !== 'placed' && order.status !== 'canceled';
		const weekOut = onDay(placed, 7, '17:00');

		if (how === 'card') {
			const payment = {
				kind: 'card',
				paidAt: null,
				brand: CARD_BRANDS[Math.floor(roll() * CARD_BRANDS.length)],
				last4: randomDigits(roll, 4),
				dueAt: weekOut,
			};
			if (order.status !== 'placed') {
				payment.paidAt = placed;
				payment.ref = `#9${randomDigits(roll, 4)}`;
			}
			if (order.declined) payment.declinedAt = `${order.declined}T${order.time}`;
			return payment;
		}

		/* An order's invoice number is the order number plus 5000. */
		const serial = 5000 + Number(order.orderNumber.replace(/\D/g, ''));
		const payment = {
			kind: 'invoice',
			paidAt: null,
			invoice: `#${serial}`,
		};

		if (how === 'terms') {
			Object.assign(payment, { terms: 'Pay in 30 days', dueAt: onDay(placed, 30, '17:00') });
			const paidOn = onDay(placed, 18, '11:00');
			if (settled && notAfter(paidOn, NOW)) {
				Object.assign(payment, {
					paidAt: paidOn,
					method: 'Bank transfer',
					ref: `EFT ${randomDigits(roll, 4)}-${randomDigits(roll, 5)}`,
				});
			}
			return payment;
		}

		const byBank = how === 'ach';
		Object.assign(payment, {
			terms: 'Due on receipt',
			dueAt: weekOut,
			method: byBank ? 'Bank transfer' : 'Gift card',
		});
		if (settled) {
			payment.paidAt = afterMinutes(placed, byBank ? 60 : 2);
			payment.ref = byBank
				? `TRF ${randomDigits(roll, 4)}-${randomDigits(roll, 5)}`
				: `Gift card #${randomDigits(roll, 4)}`;
		}
		return payment;
	}

	function fulfillmentFor(order, { placed, regionKey, goods, payment, roll }) {
		const fulfil = {};
		const progress = { picking: 1, dispatched: 2, delivered: 3 }[order.status] || 0;
		const route = REGIONS[regionKey];
		const startsAt = payment.terms === 'Pay in 30 days' ? placed : payment.paidAt;

		if (goods && progress >= 1) {
			fulfil.packedAt =
				readStamp(startsAt).getHours() < 13 ? afterMinutes(startsAt, 120) : onDay(startsAt, 1, '09:30');
		}
		if (goods && progress >= 2) {
			const { carrier } = SHIPPING[order.ship];
			fulfil.shippedAt = onDay(fulfil.packedAt, readStamp(fulfil.packedAt).getHours() < 15 ? 0 : 1, '15:40');
			fulfil.carrier = carrier;
			fulfil.tracking = trackingNumber(carrier, roll);
			fulfil.expected = onDay(fulfil.shippedAt, route.transit, '12:00');
		}
		if (progress < 3) return fulfil;

		if (goods) {
			fulfil.deliveredAt = onDay(fulfil.shippedAt, route.transit, '11:20');
			return fulfil;
		}
		const isService = order.lines.some((entry) => kind(entry.sku) === 'service');
		const finished = isService ? onDay(placed, 4, '15:00') : payment.paidAt || placed;
		fulfil.deliveredAt = payment.paidAt && notAfter(finished, payment.paidAt) ? payment.paidAt : finished;
		return fulfil;
	}

	/** A carrier-shaped tracking number drawn from the order's stream. */
	function trackingNumber(carrier, roll) {
		function charsOf(count) {
			return Array.from(
				{ length: count },
				() => '0123456789ABCDEFGHJKLMNPRSTUVWXY'[Math.floor(roll() * 32)],
			).join('');
		}

		const formats = {
			UPS: () => `1Z${charsOf(6)}${randomDigits(roll, 10)}`,
			FedEx: () => `7781${randomDigits(roll, 8)}`,
			USPS: () => `9400${randomDigits(roll, 18)}`,
		};
		return Object.hasOwn(formats, carrier) ? formats[carrier]() : randomDigits(roll, 10);
	}

	/**
	 * A repeatable stream of numbers in [0, 1) for a string key: the key
	 * is hashed (FNV-1a) into the seed of a mulberry32 generator.
	 */
	function seeded(key) {
		let seedBits = 2166136261;
		for (const symbol of key) seedBits = Math.imul(seedBits ^ symbol.charCodeAt(0), 16777619);

		return function nextFloat() {
			seedBits = (seedBits + 0x6d2b79f5) >>> 0;
			let mix = seedBits;
			mix = Math.imul(mix ^ (mix >>> 15), mix | 1);
			mix ^= mix + Math.imul(mix ^ (mix >>> 7), mix | 61);
			return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
		};
	}

	function randomDigits(roll, count) {
		let numerals = '';
		for (let i = 0; i < count; i += 1) numerals += Math.floor(roll() * 10);
		return numerals;
	}

	/* Local 'YYYY-MM-DDTHH:MM' stamps. */

	function readStamp(stamp) {
		const [day, clock = '00:00'] = stamp.split('T');
		const [year, month, date] = day.split('-').map(Number);
		const [hours, minutes] = clock.split(':').map(Number);
		return new Date(year, month - 1, date, hours, minutes);
	}

	function writeStamp(when) {
		const two = (n) => String(n).padStart(2, '0');
		return `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())}T${two(when.getHours())}:${two(when.getMinutes())}`;
	}

	/** The stamp `days` calendar days on, at the clock time given. */
	function onDay(stamp, days, clock) {
		const anchor = readStamp(stamp);
		const [hours, minutes] = clock.split(':').map(Number);
		return writeStamp(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + days, hours, minutes));
	}

	function afterMinutes(stamp, minutes) {
		return writeStamp(new Date(readStamp(stamp).getTime() + minutes * 60000));
	}

	function notAfter(first, second) {
		return readStamp(first) <= readStamp(second);
	}

	/* The book is shared by every page; freezing it means a page must copy
     a record before editing it. */
	function deepFreeze(value) {
		if (value && typeof value === 'object' && !Object.isFrozen(value)) {
			Object.freeze(value);
			for (const inner of Object.values(value)) deepFreeze(inner);
		}
		return value;
	}
})();
