/**
 * Marlo shop returns, published as window.Basalt.data.returns.
 *
 * Holds every request a shopper has made since September 21 to send
 * back clothing that fits badly, looks unlike the photos or is simply
 * no longer wanted. returns.html lists them, return-details.html?id=...
 * opens one, and payouts.html loads the same set, so each return keeps
 * one shopper, one set of items, one amount and one status everywhere.
 *
 * Broken, faulty or missing goods are not returns; they are refund
 * claims in assets/basalt/js/data/multipurpose/refunds.js. Orders, shoppers and prices live
 * in the shop book (window.Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js), so
 * a return carries only its order number and the pieces coming back.
 *
 * Fields on each return:
 *   status     requested, approved, received, refunded or declined
 *   lines      [sku, quantity, size], one per piece sent back
 *   condition  the state the shopper reported
 *   said       the shopper's own message
 *   approved   [when, by]
 *   label      { carrier, tracking, sent } for the prepaid label
 *   received   [when, the warehouse's finding]
 *   refunded   [when, by, method: card, bank or credit]
 *   declined   [when, by, reason given]
 *
 * Swap RETURNS for your backend's records in this shape to go live.
 */
(() => {
	'use strict';

	/* The signed-in teammate, and the colleague who shares the returns queue. */
	const ME = 'John Armstrong';
	const HANA = 'Hope Stout';

	/* Shoppers may ask up to thirty days after delivery; we answer within two working days. */
	const WINDOW_DAYS = 30;
	const APPROVE_DAYS = 2;

	/* Each reason borrows a step of the chart ramp so its dot and bar match. */
	const REASONS = {
		small: { tone: 1, label: 'Too small' },
		big: { tone: 3, label: 'Too big' },
		color: { tone: 5, label: 'Color looks off' },
		pictured: { tone: 8, label: 'Fabric or cut' },
		mind: { tone: 2, label: 'Changed my mind' },
	};

	/* Listed newest request first; the pages keep this order. */
	const RETURNS = [
		ask(
			'#231',
			'#472',
			'2026-10-09 08:40',
			'small',
			'requested',
			piece('ML-TRCH', 'M'),
			'Unworn',
			'Lovely shirt, but the medium is tight across the shoulders. Could I send it back for a refund?',
		),

		ask(
			'#230',
			'#468',
			'2026-10-08 19:15',
			'color',
			'requested',
			piece('ML-BLAZ', 'S'),
			'Unworn',
			'The oat color reads much grayer in person than on the site. I am keeping one and sending the other back.',
		),

		{
			...ask(
				'#229',
				'#467',
				'2026-10-08 16:30',
				'big',
				'approved',
				piece('ML-SUIT', 'L'),
				'Tried on',
				'The large swamps me. I would rather have the money back than wait for a medium.',
			),
			approved: ['2026-10-09 09:05', ME],
		},

		{
			...ask(
				'#228',
				'#465',
				'2026-10-07 18:10',
				'big',
				'approved',
				piece('ML-SUIT', 'M'),
				'Unworn',
				'It is a beautiful suit, just roomier than I expected. Sending it back unworn.',
			),
			approved: ['2026-10-08 09:20', HANA],
			label: shipped('UPS', '1Z4RW8170363514827', '2026-10-08 09:25'),
		},

		{
			...ask(
				'#227',
				'#464',
				'2026-10-07 20:00',
				'mind',
				'approved',
				piece('ML-BLAZ', 'M'),
				'Unworn',
				'I bought it as a gift and found out she already has one. Still in its bag.',
			),
			approved: ['2026-10-08 10:10', ME],
			label: shipped('FedEx', '778140192863', '2026-10-08 10:15'),
		},

		{
			...ask(
				'#226',
				'#461',
				'2026-10-06 14:00',
				'small',
				'received',
				piece('ML-TRCH', 'S'),
				'Unworn',
				'The small pulls at the buttons. I will order the medium separately.',
			),
			approved: ['2026-10-06 16:20', HANA],
			label: shipped('UPS', '1Z9KD2410367281956', '2026-10-06 16:25'),
			received: ['2026-10-08 13:40', 'Unworn with tags on. Folded back into stock at Elko.'],
		},

		{
			...ask(
				'#225',
				'#453',
				'2026-10-04 21:30',
				'pictured',
				'received',
				piece('ML-GOWN', 'M'),
				'Tried on',
				'The jersey is heavier than in the photos, and the drape sits higher than shown.',
			),
			approved: ['2026-10-05 09:00', ME],
			label: shipped('FedEx', '778177149023', '2026-10-05 09:10'),
			received: ['2026-10-09 09:50', 'Tried on, no marks. Steamed and back in stock at Bellingham.'],
		},

		ask(
			'#224',
			'#458',
			'2026-10-06 08:45',
			'mind',
			'requested',
			piece('ML-BLAZ', 'L'),
			'Unworn',
			'I ordered two to choose between colors and have chosen. Please take back the second one.',
		),

		{
			...ask(
				'#223',
				'#456',
				'2026-10-04 12:00',
				'big',
				'refunded',
				piece('ML-SUIT', 'L'),
				'Unworn',
				'Too big in the body and the sleeves. Could not tell from the size guide.',
			),
			approved: ['2026-10-05 09:10', ME],
			label: shipped('UPS', '1Z6FP0920369145530', '2026-10-05 09:15'),
			received: ['2026-10-07 11:00', 'Unworn with tags on. Back in stock at Elko.'],
			refunded: ['2026-10-07 15:30', ME, 'bank'],
		},

		{
			...ask(
				'#222',
				'#432',
				'2026-09-24 10:30',
				'small',
				'refunded',
				piece('ML-GOWN', 'S'),
				'Unworn',
				'I ordered two sizes to try. The small is too snug, so it is coming back.',
			),
			approved: ['2026-09-24 14:00', HANA],
			label: shipped('UPS', '1Z2HT5530364098813', '2026-09-24 14:05'),
			received: ['2026-09-29 10:20', 'Unworn with tags on. Back in stock at Elko.'],
			refunded: ['2026-09-30 09:40', HANA, 'card'],
		},

		{
			...ask(
				'#221',
				'#435',
				'2026-09-28 07:50',
				'color',
				'refunded',
				piece('ML-TRCH', 'M'),
				'Tried on',
				'The shirt is a lighter blue than the photo, closer to white. Not what I hoped for.',
			),
			approved: ['2026-09-29 09:30', ME],
			label: shipped('FedEx', '778155208731', '2026-09-29 09:35'),
			received: ['2026-10-05 14:10', 'Tried on, no marks. Back in stock at Bellingham.'],
			refunded: ['2026-10-06 10:00', ME, 'credit'],
			credit: '#61',
		},

		{
			...ask(
				'#220',
				'#438',
				'2026-09-30 18:20',
				'mind',
				'declined',
				piece('ML-CATE', ''),
				'Worn',
				'I have worn it a few times but I don’t reach for it. Could I return it?',
			),
			approved: ['2026-10-01 09:15', HANA],
			label: shipped('FedEx', '778166041872', '2026-10-01 09:20'),
			received: ['2026-10-03 12:30', 'Washed and worn, with the tag cut off. It can’t go back on sale.'],
			declined: [
				'2026-10-05 11:00',
				HANA,
				'The sunglasses came back scratched and worn, so we can’t sell them again. We have posted them back at no cost.',
			],
		},

		{
			...ask(
				'#219',
				'#416',
				'2026-10-04 09:30',
				'mind',
				'declined',
				piece('ML-SUIT', 'M'),
				'Unworn',
				'I never wore the suit. Is it too late to send it back?',
			),
			declined: [
				'2026-10-05 10:20',
				ME,
				'The order arrived on September 2, and returns close 30 days after delivery. We are happy to swap it for store credit instead.',
			],
		},

		{
			...ask(
				'#218',
				'#428',
				'2026-09-21 19:40',
				'small',
				'refunded',
				piece('ML-BLAZ', 'S'),
				'Unworn',
				'The small is short in the arms. I would like a refund, please.',
			),
			approved: ['2026-09-22 09:00', ME],
			label: shipped('UPS', '1Z3AC8800361927405', '2026-09-22 09:05'),
			received: ['2026-09-25 13:15', 'Unworn with tags on. Back in stock at Elko.'],
			refunded: ['2026-09-26 09:30', ME, 'card'],
		},

		{
			...ask(
				'#217',
				'#429',
				'2026-09-22 08:10',
				'color',
				'refunded',
				piece('ML-GOWN', 'M'),
				'Unworn',
				'The sage green looks yellow next to my skin. Sending it back unworn.',
			),
			approved: ['2026-09-22 11:40', HANA],
			label: shipped('FedEx', '778141882037', '2026-09-22 11:45'),
			received: ['2026-09-26 10:05', 'Unworn with tags on. Back in stock at Ann Arbor.'],
			refunded: ['2026-09-29 14:20', HANA, 'bank'],
		},
	];

	/* Hang the set on the shared namespace without disturbing other data files. */
	function publish() {
		const shared = window.Basalt.data || (window.Basalt.data = {});
		shared.returns = { ME, WINDOW_DAYS, APPROVE_DAYS, REASONS, RETURNS };
	}

	/**
	 * The part every return has from the moment the shopper asks.
	 * @param {string} id        return number, e.g. #231
	 * @param {string} order     the shop order it comes from
	 * @param {string} requested 'YYYY-MM-DD HH:MM' the request came in
	 * @param {string} reason    a key of REASONS
	 * @param {string} status    where the return stands now
	 * @param {Array}  lines     the pieces coming back, from piece()
	 * @param {string} condition what the shopper says about their state
	 * @param {string} said      the shopper's message, word for word
	 */
	function ask(id, order, requested, reason, status, lines, condition, said) {
		return { id, order, reason, status, requested, lines, condition, said };
	}

	/* Every return so far sends back a single piece; an unsized item passes ''. */
	function piece(sku, size) {
		return [[sku, 1, size]];
	}

	/* The prepaid label we emailed the shopper. */
	function shipped(carrier, tracking, sent) {
		return { carrier, tracking, sent };
	}

	publish();
})();
