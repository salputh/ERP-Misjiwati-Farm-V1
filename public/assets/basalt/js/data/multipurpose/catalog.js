/**
 * The Marlo product book, published as window.Basalt.data.catalog.
 *
 * One record per thing the shop sells, holding everything the shop pages
 * ask of it: Products reads prices and sales, Storefront reads badges and
 * menus, Stock Levels reads warehouse counts and recent movements, and
 * Product Details reads the lot. Because every page draws from here, a
 * blazer costs and stocks the same wherever it appears.
 *
 * Sales figures run for the 30 days ending Thursday, October 8, 2026, and
 * `before` holds the 30 days prior. Orders live in the shop book
 * (assets/basalt/js/data/multipurpose/store.js). A backend can replace this file by answering
 * with records of the same shape:
 *
 *   id, sku, name; group is devices (clothing), accessories, addons
 *   (extras) or services, and kind is hardware (clothing), addon or service
 *   unit       how a sale is counted: packs (gift cards), seats (members)
 *              or booked (bookings)
 *   icon, photo, photos   a Bootstrap icon, a photo path and extra
 *              shots for the product page
 *   maker, madeIn, warranty   the mill or workshop, its state, and how
 *              long repairs stay free
 *   price      today's price; was and ends describe a running sale
 *   fee, per   a monthly charge on top of, or instead of, the price
 *   priceNote, note, state   one-liners for the lists
 *   sold, before, buyers   last 30 days, the 30 before, top three buyers
 *   rating, ratings, stars   stars counts five stars down to one star
 *   changed    the day the listing was last edited
 *   badge      '', 'new', 'staff' or 'limited'; hidden keeps it off the shop
 *   category   the shop menu it sits under
 *   desc, review   product page copy and its featured review
 *   stock      goods only: leadDays, the tile's category, icon and tone, and
 *              at = { warehouse: [on hand, held for orders, reorder point] }
 *   variants   sized goods: [on hand, sold] per size, expanded on the way out;
 *              sizes picks the run, clothing (the default) or shoes
 *
 * Alongside the products: moves() lists recent stock changes per SKU, newest
 * first, with qty as the change to on hand; incoming() lists purchase orders
 * still on the road; front names the shop's front-page products in order.
 */
(() => {
	'use strict';

	/* Four distribution centers, in the order every warehouse column uses. */
	const DEPOTS = [
		{ id: 'reno', name: 'Elko DC', region: 'West', tone: 1 },
		{ id: 'columbus', name: 'Columbus DC', region: 'Midwest', tone: 3 },
		{ id: 'annarbor', name: 'Ann Arbor DC', region: 'Midwest', tone: 8 },
		{ id: 'medford', name: 'Bellingham DC', region: 'West', tone: 7 },
	];

	const DEPARTMENTS = {
		devices: { name: 'Clothing', tone: 1 },
		accessories: { name: 'Accessories', tone: 5 },
		addons: { name: 'Extras', tone: 3 },
		services: { name: 'Services', tone: 8 },
	};

	/* Each size a garment is cut in; plug is the letter printed on its badge
     and suffix closes the size's SKU. */
	const SIZE_RUN = [
		{ name: 'Small', plug: 'S', tone: 1, note: 'US 4–6, bust 34–35 in', suffix: 'S' },
		{ name: 'Medium', plug: 'M', tone: 8, note: 'US 8–10, bust 36–37 in', suffix: 'M' },
		{ name: 'Large', plug: 'L', tone: 3, note: 'US 12–14, bust 38–40 in', suffix: 'L' },
		{ name: 'Extra large', plug: 'XL', tone: 7, note: 'US 16–18, bust 41–43 in', suffix: 'XL' },
	];

	/* Shoes come in US whole sizes instead; eyewear and extras are one size. */
	const SHOE_RUN = [7, 8, 9, 10, 11].map((size, index) => ({
		name: `US ${size}`,
		plug: String(size),
		tone: [1, 8, 3, 7, 5][index],
		note: `US ${size}, EU ${size + 33}`,
		suffix: String(size),
	}));
	const RUNS = { clothing: SIZE_RUN, shoes: SHOE_RUN };

	/* Records below write warehouse counts as plain rows in DEPOTS order
     (levels) and leave out what the department already settles. */
	const CATALOG = [
		...shelve({ group: 'devices', kind: 'hardware' }, [
			{
				sku: 'ML-BLAZ',
				id: 'p-4101',
				name: 'Sculpted Shoulder Blazer',
				category: 'Tailoring',
				badge: 'staff',
				changed: '2026-10-02',
				icon: 'bi-briefcase',
				photo: 'assets/basalt/images/multipurpose/sculpted-blazer.svg',
				photos: [
					'assets/basalt/images/multipurpose/blazer-detail.svg',
					'assets/basalt/images/multipurpose/blazer-movement.svg',
					'assets/basalt/images/multipurpose/blazer-styled.svg',
				],
				maker: 'Hollis Atelier',
				madeIn: 'Maine',
				warranty: '2 years',
				price: 1290,
				priceNote: 'each, before tax. Comes with spare buttons and a garment bag.',
				sold: 68,
				before: 18,
				buyers: [
					['Candace Carpenter', 2],
					['Rochelle Fairbanks', 2],
					['Sandra Franklin', 2],
				],
				rating: 4.6,
				ratings: 214,
				stars: [152, 42, 17, 2, 1],
				desc: [
					'A blazer in deep violet grain de poudre wool with sculpted, lifted shoulders and a nipped waist. Built by hand to hold its line.',
					'Half canvassed, with a silk satin lining',
					'Jet buttons, a spare set and a garment bag',
				],
				review: {
					who: 'Sandra Franklin',
					date: '2026-09-24',
					title: 'Architecture you can wear',
					body: 'The shoulders are dramatic without shouting and the waist is perfect. I wore it to a gallery opening and it did all the talking.',
				},
				stock: {
					tone: 1,
					leadDays: 21,
					levels: [
						[64, 10, 20],
						[52, 0, 20],
						[46, 0, 15],
						[22, 0, 10],
					],
				},
				variants: [
					[46, 20],
					[70, 31],
					[46, 13],
					[22, 4],
				],
			},
			{
				sku: 'ML-GOWN',
				id: 'p-4102',
				name: 'Draped Column Gown',
				category: 'Dresses',
				badge: '',
				changed: '2026-09-29',
				icon: 'bi-stars',
				photo: 'assets/basalt/images/multipurpose/draped-gown.svg',
				maker: 'Hollis Atelier',
				madeIn: 'Maine',
				warranty: '2 years',
				price: 2150,
				was: 2390,
				ends: '2026-10-31',
				priceNote: 'each, before tax. Silk jersey, fully lined.',
				sold: 28,
				before: 8,
				buyers: [
					['Gabriela McIntyre', 2],
					['Josephine Albright', 2],
					['Cheryl Schultz', 1],
				],
				rating: 4.4,
				ratings: 131,
				stars: [77, 33, 18, 2, 1],
				desc: [
					'A one-shoulder column gown in cobalt silk jersey, draped by hand so it falls in one clean line to the floor.',
					'Hand-draped at the shoulder and the hip',
					'Dry clean only, sent on a padded hanger',
				],
				review: {
					who: 'Gabriela McIntyre',
					date: '2026-10-06',
					title: 'Pure, liquid elegance',
					body: 'The jersey has a weight you only find at this level. I wore it to two galas this autumn and it drew a crowd at both.',
				},
				stock: {
					tone: 1,
					leadDays: 21,
					levels: [
						[88, 0, 25],
						[70, 0, 25],
						[50, 4, 15],
						[28, 0, 10],
					],
				},
				variants: [
					[52, 7],
					[88, 12],
					[64, 7],
					[32, 2],
				],
			},
			{
				sku: 'ML-ORGZ',
				id: 'p-4103',
				name: 'Tiered Organza Dress',
				category: 'Dresses',
				badge: '',
				changed: '2026-10-06',
				icon: 'bi-flower1',
				photo: 'assets/basalt/images/multipurpose/organza-dress.svg',
				maker: 'Calder Couture',
				madeIn: 'Illinois',
				warranty: '2 years',
				price: 1680,
				priceNote: 'each, before tax. Silk organza over a boned bodice.',
				sold: 39,
				before: 13,
				buyers: [
					['Rochelle Fairbanks', 2],
					['Sabrina Kavanagh', 2],
					['Natalie Tanner', 2],
				],
				rating: 4.7,
				ratings: 176,
				stars: [137, 29, 7, 2, 1],
				desc: [
					'Pale sky-blue silk organza in tiers of hand-pleated ruffles over a corset bodice. Light as air, impossible to overlook.',
					'Every ruffle is pleated and set by hand',
					'Boned bodice with a hidden side zip',
				],
				review: {
					who: 'Sabrina Kavanagh',
					date: '2026-10-04',
					title: 'A showstopper, beautifully made',
					body: 'It arrived in tissue in a box the size of a suitcase. The bodice fits like it was made for me and the ruffles hold their shape.',
				},
				stock: {
					tone: 2,
					leadDays: 10,
					levels: [
						[150, 18, 50],
						[168, 0, 50],
						[64, 6, 25],
						[30, 0, 20],
					],
				},
			},
			{
				sku: 'ML-SUIT',
				id: 'p-4104',
				name: 'Chalk-Stripe Suit',
				category: 'Tailoring',
				badge: '',
				changed: '2026-09-24',
				icon: 'bi-person-standing',
				photo: 'assets/basalt/images/multipurpose/chalk-stripe-suit.svg',
				maker: 'Willamette Tailors',
				madeIn: 'Oregon',
				warranty: '2 years',
				price: 2450,
				was: 2750,
				ends: '2026-10-18',
				priceNote: 'each, before tax. Indigo wool with an ivory chalk stripe.',
				sold: 18,
				before: 5,
				buyers: [
					['Jackie Blackburn', 1],
					['Jasmine Whitaker', 1],
					['Phyllis Delaney', 1],
				],
				rating: 4.2,
				ratings: 48,
				stars: [23, 15, 8, 1, 1],
				desc: [
					'An indigo suit with an ivory chalk stripe, wide peak lapels and wide, high-waisted trousers. Power, cut with a light hand.',
					'Wide peak lapels and working cuffs',
					'Trousers hemmed free in store',
				],
				review: {
					who: 'Jackie Blackburn',
					date: '2026-10-08',
					title: 'Tailoring at its very best',
					body: 'The lapels are bold, the stripe is subtle and the cut is flawless. I had the sleeves taken in a touch and it fits like bespoke.',
				},
				stock: {
					tone: 3,
					leadDays: 14,
					levels: [
						[34, 0, 12],
						[30, 0, 12],
						[24, 0, 10],
						[8, 0, 8],
					],
				},
			},
			{
				sku: 'ML-TRCH',
				id: 'p-4105',
				name: 'Leather Trench Coat',
				category: 'Outerwear',
				badge: '',
				changed: '2026-09-21',
				icon: 'bi-cloud-drizzle',
				photo: 'assets/basalt/images/multipurpose/leather-trench.svg',
				maker: 'Willamette Tailors',
				madeIn: 'Oregon',
				warranty: '2 years',
				price: 3200,
				priceNote: 'each, before tax. Black nappa, belted, fully lined.',
				sold: 23,
				before: 6,
				buyers: [
					['Phyllis Delaney', 2],
					['Gabriela McIntyre', 1],
					['Haley Freeman', 1],
				],
				rating: 4.5,
				ratings: 67,
				stars: [44, 15, 6, 1, 1],
				desc: [
					'A belted trench in black nappa leather, soft as a glove, with storm flaps and a long, sweeping skirt to the calf.',
					'Buffalo horn buttons',
					'Softens with every wear',
				],
				review: {
					who: 'Phyllis Delaney',
					date: '2026-09-24',
					title: 'Supple, sharp, runs generous',
					body: 'The nappa is beautiful and it moves like cloth. It runs a size large, so I exchanged mine for a small with no fuss at all.',
				},
				stock: {
					tone: 3,
					leadDays: 14,
					levels: [
						[40, 0, 12],
						[38, 0, 12],
						[36, 0, 12],
						[14, 0, 6],
					],
				},
			},
		]),

		...shelve({ group: 'accessories', kind: 'hardware' }, [
			{
				sku: 'ML-LOAF',
				id: 'p-4106',
				name: 'Bar Loafers',
				category: 'Shoes',
				badge: 'staff',
				changed: '2026-09-18',
				icon: 'bi-gem',
				sizes: 'shoes',
				photo: 'assets/basalt/images/multipurpose/bar-loafers.svg',
				maker: 'Marlo',
				madeIn: 'Ohio',
				warranty: '2 years',
				price: 790,
				priceNote: 'a pair, before tax. Deep violet suede with a gold bar.',
				sold: 49,
				before: 18,
				buyers: [
					['Natalie Tanner', 2],
					['Debbie Gardner', 2],
					['Christopher Vance', 2],
				],
				rating: 4.8,
				ratings: 241,
				stars: [202, 33, 4, 1, 1],
				desc: [
					'Loafers in deep violet suede with a slim gold bar across the vamp, hand-sewn and finished with a leather sole.',
					'Hand-sewn in Akron, Ohio',
					'In deep violet and black',
				],
				review: {
					who: 'Christopher Vance',
					date: '2026-10-08',
					title: 'The pair I reach for daily',
					body: 'Soft, light and comfortable from day one. I bought the violet, then went back for the black the same week.',
				},
				stock: {
					tone: 4,
					leadDays: 7,
					levels: [
						[190, 0, 50],
						[170, 0, 50],
						[120, 4, 30],
						[60, 12, 20],
					],
				},
				variants: [
					[70, 5],
					[128, 11],
					[160, 15],
					[122, 12],
					[60, 6],
				],
			},
			{
				sku: 'ML-OXFD',
				id: 'p-4107',
				name: 'Two-Tone Oxfords',
				category: 'Shoes',
				badge: '',
				changed: '2026-10-01',
				icon: 'bi-award',
				sizes: 'shoes',
				photo: 'assets/basalt/images/multipurpose/two-tone-oxfords.svg',
				maker: 'Marlo',
				madeIn: 'Ohio',
				warranty: '2 years',
				price: 850,
				priceNote: 'a pair, before tax. Goodyear welted, resoled in Akron.',
				sold: 70,
				before: 20,
				buyers: [
					['Jasmine Whitaker', 2],
					['Sandra Franklin', 2],
					['Claire Donnelly', 2],
				],
				rating: 4.3,
				ratings: 88,
				stars: [46, 25, 15, 1, 1],
				desc: [
					'Full brogue oxfords in black calf and ivory suede, Goodyear welted and burnished by hand in Akron.',
					'Leather sole with a stacked heel',
					'Black calf and ivory suede',
				],
				review: {
					who: 'Sandra Franklin',
					date: '2026-10-05',
					title: 'Striking, a little narrow on me',
					body: 'Beautiful leather and the two tones are perfect. They felt a little narrow at first, so the store stretched them overnight.',
				},
				stock: {
					tone: 5,
					leadDays: 7,
					levels: [
						[110, 28, 30],
						[96, 0, 30],
						[72, 0, 20],
						[32, 0, 15],
					],
				},
				variants: [
					[40, 9],
					[74, 16],
					[92, 21],
					[70, 16],
					[34, 8],
				],
			},
			{
				sku: 'ML-CATE',
				id: 'p-4108',
				name: 'Cat-Eye Sunglasses',
				category: 'Eyewear',
				badge: 'limited',
				changed: '2026-10-07',
				icon: 'bi-sunglasses',
				photo: 'assets/basalt/images/multipurpose/cat-eye-sunglasses.svg',
				maker: 'Fairhaven Optical',
				madeIn: 'Missouri',
				warranty: '1 year',
				price: 465,
				priceNote: 'each, before tax. Hand-polished acetate, UV400 lenses.',
				sold: 14,
				before: 4,
				buyers: [
					['Jasmine Whitaker', 2],
					['Christopher Vance', 1],
					['Jackie Blackburn', 1],
				],
				rating: 4.1,
				ratings: 29,
				stars: [12, 10, 5, 2, 0],
				desc: [
					'Oversized cat-eye frames in ivory acetate with sharp, lifted wings. Hand-polished in Missouri and made in a short run.',
					'One size, five-barrel hinges',
					'Gray gradient lenses',
				],
				review: {
					who: 'Christopher Vance',
					date: '2026-10-07',
					title: 'Bought two, one as a gift',
					body: 'The wings are sharper than on screen and the acetate is weighty. I would buy a pair for my sister if they were in stock.',
				},
				stock: {
					tone: 6,
					leadDays: 18,
					levels: [
						[10, 3, 12],
						[8, 0, 10],
						[4, 0, 10],
						[0, 0, 8],
					],
				},
			},
			{
				sku: 'ML-SHLD',
				id: 'p-4109',
				name: 'Shield Sunglasses',
				category: 'Eyewear',
				badge: '',
				hidden: true,
				changed: '2026-10-05',
				icon: 'bi-eyeglasses',
				photo: 'assets/basalt/images/multipurpose/shield-sunglasses.svg',
				maker: 'Fairhaven Optical',
				madeIn: 'Missouri',
				warranty: '1 year',
				price: 520,
				priceNote: 'each, before tax. Chrome frame, cobalt lens.',
				waiting: 31,
				sold: 39,
				before: 20,
				buyers: [
					['Candace Carpenter', 2],
					['Phyllis Delaney', 2],
					['Rebecca MacKinnon', 2],
				],
				rating: 4.4,
				ratings: 54,
				stars: [33, 14, 4, 2, 1],
				desc: [
					'A chrome wraparound shield with one cobalt lens. Bold, featherweight and unmistakably ours.',
					'One size, featherweight',
					'Back in stock in November',
				],
				review: {
					who: 'Rebecca MacKinnon',
					date: '2026-10-03',
					title: 'Worth the waiting list',
					body: 'I bought a pair for me and a pair for my sister. Strangers stop us to ask about them.',
				},
				stock: {
					tone: 6,
					leadDays: 18,
					levels: [
						[0, 0, 25],
						[0, 0, 25],
						[0, 0, 20],
						[0, 0, 10],
					],
				},
			},
		]),

		/* Extras are emailed or billed, so nothing here carries stock. */
		...shelve({ group: 'addons', kind: 'addon', maker: 'Marlo' }, [
			{
				sku: 'ML-GIFT250',
				id: 'p-4110',
				name: 'E-Gift Card, $250',
				unit: 'packs',
				category: 'Extras',
				badge: '',
				changed: '2026-09-26',
				icon: 'bi-gift',
				photo: 'assets/basalt/images/multipurpose/gift-card.svg',
				price: 250,
				priceNote: 'per card, sent by email. Cards never expire.',
				state: 'Always available',
				note: 'Sent by email the moment it is paid, so there is nothing to stock. Customers hold $286,000 unspent.',
				sold: 412,
				before: 380,
				buyers: [
					['Iva Blackwood', 2],
					['Christopher Vance', 1],
					['Cheryl Sorensen', 1],
				],
				rating: 4.6,
				ratings: 63,
				stars: [46, 12, 3, 1, 1],
				desc: [
					'A $250 Marlo gift card in violet with a gold edge, sent by email with your message on the day you pick.',
					'Cards never expire',
					'Sent by email the moment it is paid for',
				],
				review: {
					who: 'Iva Blackwood',
					date: '2026-10-06',
					title: 'The perfect last-minute gift',
					body: 'I sent four to friends out of state on their birthdays. The email is beautifully made and each arrived on the right morning.',
				},
			},
			{
				sku: 'ML-CARE',
				id: 'p-4111',
				name: 'Aftercare Plan, monthly',
				unit: 'seats',
				per: true,
				category: 'Extras',
				badge: '',
				changed: '2026-09-22',
				icon: 'bi-scissors',
				photo: 'assets/basalt/images/multipurpose/aftercare-plan.svg',
				price: 25,
				priceNote: 'per member each month, billed to the card.',
				state: '1,840 members active',
				note: 'Joined online and billed each month, so there is nothing to stock.',
				sold: 310,
				before: 260,
				buyers: [
					['Phyllis Delaney', 1],
					['Patricia Pemberton', 1],
					['Fiona MacAllister', 1],
				],
				rating: 4.7,
				ratings: 22,
				stars: [17, 4, 1, 0, 0],
				desc: [
					'Pressing, repairs and shoe care for everything Marlo you own, collected and returned.',
					'Collected from your door, any time',
					'Billed monthly, stop any time',
				],
				review: {
					who: 'Phyllis Delaney',
					date: '2026-09-30',
					title: 'My blazer, as good as new',
					body: 'Pressed, a cuff repaired and my loafers resoled. Back in a week, in tissue.',
				},
			},
			{
				sku: 'ML-PASS',
				id: 'p-4112',
				name: 'Express Delivery Pass',
				unit: 'seats',
				per: true,
				category: 'Extras',
				badge: 'new',
				changed: '2026-10-03',
				icon: 'bi-truck',
				photo: 'assets/basalt/images/multipurpose/delivery-pass.svg',
				price: 15,
				priceNote: 'per member each month, billed to the card.',
				state: '2,960 members active',
				note: 'Joined online and billed each month, so there is nothing to stock.',
				sold: 520,
				before: 410,
				buyers: [
					['Claire Donnelly', 1],
					['Jasmine Whitaker', 1],
					['Cheryl Sorensen', 1],
				],
				rating: 4.8,
				ratings: 31,
				stars: [27, 2, 1, 1, 0],
				desc: [
					'Free next-day delivery on every order, and free returns collected from your door, for one small monthly fee.',
					'Next-day delivery on every order',
					'Billed monthly, stop any time',
				],
				review: {
					who: 'Claire Donnelly',
					date: '2026-09-28',
					title: 'Pays for itself in a month',
					body: 'Everything arrives the next day, even out here in Boulder, and the returns pickup saves me a trip to the post office.',
				},
			},
		]),

		...shelve({ group: 'services', kind: 'service', unit: 'booked', maker: 'Marlo' }, [
			{
				sku: 'ML-MTM',
				id: 'p-4113',
				name: 'Made-to-Measure Tailoring',
				category: 'Services',
				badge: '',
				changed: '2026-09-30',
				icon: 'bi-rulers',
				photo: 'assets/basalt/images/multipurpose/made-to-measure.svg',
				price: 4800,
				priceNote: 'per piece. Two fittings and six weeks of making, in the cloth you pick.',
				state: 'Next fitting Oct 19',
				note: 'Made in the Akron workshop. Two new pieces can start each week.',
				sold: 9,
				before: 7,
				buyers: [
					['Benjamin Hartley', 1],
					['Maureen Fitzgerald', 1],
					['Abigail Montgomery', 1],
				],
				rating: 4.9,
				ratings: 12,
				stars: [11, 1, 0, 0, 0],
				desc: [
					'A jacket, suit or coat cut to your measurements in our Akron workshop: two fittings, your cloth and lining.',
					'Fittings in store or on video',
					'Ready in six weeks',
				],
				review: {
					who: 'Benjamin Hartley',
					date: '2026-10-05',
					title: 'Worth every week',
					body: 'The second fitting perfected the sleeves, and the suit arrived a few days early. It is the finest thing I own.',
				},
			},
			{
				sku: 'ML-STYLE',
				id: 'p-4114',
				name: 'Private Styling Session',
				category: 'Services',
				badge: '',
				changed: '2026-09-19',
				icon: 'bi-person-standing-dress',
				photo: 'assets/basalt/images/multipurpose/styling-session.svg',
				price: 650,
				priceNote: 'per session. 90 minutes, in store or on video.',
				state: 'Next free Oct 13',
				note: 'Run by the styling team, Monday to Thursday.',
				sold: 23,
				before: 19,
				buyers: [
					['Cheryl Sorensen', 1],
					['Rochelle Fairbanks', 1],
					['Iva Blackwood', 1],
				],
				rating: 4.7,
				ratings: 10,
				stars: [8, 1, 1, 0, 0],
				desc: [
					'Ninety minutes with a Marlo stylist, in store or on video, to build a season’s wardrobe around what you own.',
					'For one or two people',
					'A written list to keep',
				],
				review: {
					who: 'Iva Blackwood',
					date: '2026-09-12',
					title: 'I finally know what goes with what',
					body: 'Ninety minutes with a stylist who truly listened. I left with a considered list and no pressure at all.',
				},
			},
		]),
	];

	/* Recent movements per SKU, newest first. Shipments cite the shop order
     and the buyer's Store Customers id; a transfer between warehouses
     leaves the overall count unchanged. */
	const MOVEMENTS = {
		'ML-BLAZ': [
			shipped('2026-10-06', 'medford', 2, '#470', 'Patricia Pemberton', '#88065'),
			shipped('2026-10-05', 'reno', 2, '#468', 'Candace Carpenter', '#88064'),
			shipped('2026-10-04', 'annarbor', 1, '#464', 'Faith van der Linden', '#88062'),
			transferred('2026-10-01', 'reno', 'medford', 12, '#208'),
			received('2026-09-29', 'columbus', 120, '#1033', 'Hollis Atelier'),
		],
		'ML-GOWN': [
			shipped('2026-09-29', 'medford', 1, '#453', 'Georgia Webster', '#88072'),
			received('2026-09-26', 'reno', 90, '#1031', 'Hollis Atelier'),
			shipped('2026-09-26', 'reno', 1, '#445', 'Debbie Gardner', '#88069'),
			recounted('2026-09-22', 'annarbor', -1, 'Damaged in the warehouse'),
		],
		'ML-ORGZ': [
			shipped('2026-10-06', 'reno', 1, '#469', 'Benjamin Hartley', '#88046'),
			shipped('2026-10-01', 'annarbor', 2, '#457', 'Sabrina Kavanagh', '#88053'),
			received('2026-09-30', 'columbus', 200, '#1035', 'Calder Couture'),
			shipped('2026-09-28', 'reno', 2, '#450', 'Ramona Davenport', '#88071'),
		],
		'ML-SUIT': [
			shipped('2026-10-05', 'annarbor', 1, '#467', 'Jackie Blackburn', '#88066'),
			shipped('2026-10-04', 'reno', 1, '#465', 'Jasmine Whitaker', '#88059'),
			recounted('2026-09-28', 'columbus', 2, 'Found during a recount'),
			received('2026-09-18', 'columbus', 60, '#1028', 'Willamette Tailors'),
		],
		'ML-TRCH': [
			shipped('2026-10-07', 'reno', 1, '#474', 'Phyllis Delaney', '#88042'),
			shipped('2026-10-06', 'annarbor', 1, '#472', 'Eleanor Fairweather', '#88043'),
			received('2026-09-21', 'annarbor', 64, '#1029', 'Willamette Tailors'),
			transferred('2026-09-15', 'columbus', 'medford', 8, '#199'),
		],
		'ML-LOAF': [
			shipped('2026-10-08', 'reno', 2, '#476', 'Debbie Gardner', '#88069'),
			shipped('2026-10-07', 'reno', 1, '#473', 'Christopher Vance', '#88050'),
			shipped('2026-10-06', 'annarbor', 1, '#472', 'Eleanor Fairweather', '#88043'),
			received('2026-09-30', 'reno', 300, '#1036', 'Marlo'),
		],
		'ML-OXFD': [
			shipped('2026-10-06', 'reno', 1, '#469', 'Benjamin Hartley', '#88046'),
			shipped('2026-10-03', 'medford', 1, '#462', 'Maureen Fitzgerald', '#88080'),
			shipped('2026-09-30', 'reno', 2, '#455', 'Sandra Franklin', '#88041'),
			received('2026-09-27', 'columbus', 150, '#1034', 'Marlo'),
		],
		'ML-CATE': [
			shipped('2026-09-30', 'reno', 1, '#454', 'Christopher Vance', '#88050'),
			shipped('2026-09-23', 'annarbor', 1, '#438', 'Jackie Blackburn', '#88066'),
			shipped('2026-09-17', 'reno', 1, '#428', 'Cheryl Sorensen', '#88044'),
			received('2026-08-21', 'reno', 80, '#1019', 'Fairhaven Optical'),
		],
		'ML-SHLD': [
			shipped('2026-09-29', 'reno', 2, '#451', 'Rebecca MacKinnon', '#88074'),
			shipped('2026-09-27', 'reno', 2, '#448', 'Phyllis Delaney', '#88042'),
			shipped('2026-09-24', 'reno', 2, '#439', 'Penelope Bradford', '#88075'),
			received('2026-07-29', 'columbus', 240, '#1012', 'Fairhaven Optical'),
		],
	};

	/* Purchase orders in transit, matching the Purchase Orders page. */
	const ON_ORDER = [
		{ po: '#1039', due: '2026-10-12', supplier: 'Fairhaven Optical', sku: 'ML-SHLD', qty: 160, site: 'columbus' },
		{ po: '#1041', due: '2026-10-19', supplier: 'Hollis Atelier', sku: 'ML-BLAZ', qty: 80, site: 'annarbor' },
	];

	const FRONT_PAGE = ['ML-BLAZ', 'ML-PASS', 'ML-LOAF'];

	publish();

	function publish() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.catalog = {
			today: '2026-10-09',
			sites: DEPOTS,
			groups: DEPARTMENTS,
			front: FRONT_PAGE,
			products: listProducts,
			find: findProduct,
			moves: () => structuredClone(MOVEMENTS),
			incoming: () => structuredClone(ON_ORDER),
		};
	}

	/** A fresh, freely editable copy of every product, in catalog order. */
	function listProducts() {
		return CATALOG.map(handOut);
	}

	/**
	 * One product by SKU, or null when no product carries it.
	 * @param {string} sku  for example 'ML-LOAF'
	 */
	function findProduct(sku) {
		const product = CATALOG.find((entry) => entry.sku === sku);
		return product ? handOut(product) : null;
	}

	/* Callers may change what they get, so each one receives its own copy,
     topped up with the warehouse totals and one row per size. */
	function handOut(product) {
		const own = structuredClone(product);
		own.totals = warehouseTotals(product);
		own.variants = sizeRows(product);
		return own;
	}

	/** Sums on hand, held and reorder points across warehouses; null without stock. */
	function warehouseTotals(product) {
		if (!product.stock) return null;
		const sum = { onHand: 0, held: 0, reorder: 0 };
		for (const [onHand, held, reorder] of Object.values(product.stock.at)) {
			sum.onHand += onHand;
			sum.held += held;
			sum.reorder += reorder;
		}
		return sum;
	}

	/** Turns the [on hand, sold] pairs of a sized garment or shoe into variant rows. */
	function sizeRows(product) {
		const run = RUNS[product.sizes ?? 'clothing'];
		return (product.variants ?? []).map(([onHand, sold], index) => ({
			sku: `${product.sku}-${run[index].suffix}`,
			price: null,
			onHand,
			sold,
			listed: true,
			...run[index],
		}));
	}

	/**
	 * Applies a department's shared fields to its records and expands each
	 * stock entry's levels into the per-warehouse map the pages read.
	 * @param {object} shared   fields every record in the department carries
	 * @param {object[]} records
	 */
	function shelve(shared, records) {
		return records.map((record) => {
			const product = { ...shared, ...record };
			if (record.stock) product.stock = stockEntry(record);
			return product;
		});
	}

	function stockEntry({ category, icon, stock }) {
		return {
			leadDays: stock.leadDays,
			category,
			icon: icon.replace(/^bi-/, ''),
			tone: stock.tone,
			at: Object.fromEntries(DEPOTS.map((house, index) => [house.id, stock.levels[index]])),
		};
	}

	/* Movement builders, one per kind; qty always records the change to on hand. */
	function shipped(date, site, units, order, customer, account) {
		return { date, kind: 'out', qty: -units, site, order, customer, account };
	}

	function received(date, site, qty, ref, supplier) {
		return { date, kind: 'in', qty, site, ref, supplier };
	}

	function transferred(date, site, to, qty, ref) {
		return { date, kind: 'move', qty, site, to, ref };
	}

	function recounted(date, site, qty, note) {
		return { date, kind: 'count', qty, site, note };
	}
})();
