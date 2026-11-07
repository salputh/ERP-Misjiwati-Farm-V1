/**
 * Refund claims raised against Marlo shop orders from September 24 on,
 * published as window.Basalt.data.refunds. The Refunds list and Refund
 * Details (refund-details.html?id=<claim>) both read them, so one claim
 * shows the same buyer, items, sum and outcome wherever it appears;
 * Payouts, Shipments and the shopper pages pick up the card refunds and
 * prepaid return labels from here too.
 *
 * Orders, buyers and prices live in the shop book (window.Basalt.shopBook,
 * assets/basalt/js/data/multipurpose/store.js). A claim only points at its order number and
 * lists the SKUs and quantities it covers.
 *
 * Fields beyond the obvious ones:
 *   status  new (nobody has answered), inspecting (the item came back and
 *           was checked, an answer is due), refunded or declined
 *   said    the buyer's own words
 *   files   attachments as [file name, size]
 *   check   what the warehouse found when it tested a returned item
 *   ret     the way back for the goods, when there is one:
 *             { label, by, sent, back }  prepaid label number, who sent
 *               it and when; `back` is set once the parcel arrived
 *             { kept }  why nothing has to travel back
 *           An open claim without `ret` has no return set up yet.
 *   paid    where the money went: card, bank or credit (with `credit`)
 *
 * Swap CLAIMS for your own API response in the same shape to go live.
 */
(() => {
	'use strict';

	const ME = 'John Armstrong';

	/* Working-day targets: a first answer to a fresh claim, and an answer
     after a returned item has been checked. */
	const ANSWER_DAYS = 3;
	const CHECK_DAYS = 2;

	/* Anything priced under this per item costs more to ship than it is
     worth, so the buyer keeps it. */
	const COLLECT_FROM = 150;

	/* Claim reasons in the order the breakdown lists them, each tied to a
     step on the chart color ramp. */
	const REASONS = Object.fromEntries(
		[
			['faulty', 'Faulty on arrival', 1],
			['damaged', 'Damaged in transit', 2],
			['wrong', 'Wrong item sent', 3],
			['short', 'Short delivery', 4],
			['duplicate', 'Ordered twice', 5],
		].map(([key, label, tone]) => [key, { label, tone }]),
	);

	/* Product tile colors by SKU, also steps on the chart ramp. */
	const TONE = {
		'ML-BLAZ': 1,
		'ML-GOWN': 8,
		'ML-ORGZ': 3,
		'ML-SUIT': 5,
		'ML-TRCH': 2,
		'ML-LOAF': 4,
		'ML-OXFD': 6,
		'ML-CATE': 7,
		'ML-SHLD': 3,
	};

	const STAFF = 'Hope Stout';
	const CHEAP = `items under $${COLLECT_FROM} each stay with the customer.`;
	const NEVER_CAME = 'the claim is for items that never arrived.';

	/* Most recent claim first; the pages keep this order. */
	const CLAIMS = [
		claim('#148', '#450', '2026-10-08 10:15', 'faulty', 'new', [['ML-ORGZ', 2]], {
			said: 'On both dresses two of the organza tiers came loose at the bodice seam after one wear. The rest is perfect.',
			files: [
				['organza-tiers-14.jpg', '2.1 MB'],
				['order-receipt.pdf', '84 KB'],
			],
		}),
		claim('#147', '#459', '2026-10-07 16:40', 'damaged', 'new', [['ML-SUIT', 1]], {
			said: 'The parcel came with a corner torn open, and the suit inside has a long pulled thread down one sleeve. It is unworn.',
			files: [
				['torn-parcel.jpg', '1.8 MB'],
				['pulled-thread.jpg', '1.4 MB'],
			],
		}),
		claim('#146', '#449', '2026-10-05 08:50', 'faulty', 'refunded', [['ML-ORGZ', 1]], {
			...settledOn('2026-10-07', ME, 'card'),
			said: 'One ruffle has a dropped stitch at the hem that ran into a tear after one wear.',
			note: 'Sorry about this one, Natalie. The refund is on its way to your card.',
			files: [['hem-stitch.png', '640 KB']],
			ret: nothingBack(CHEAP),
		}),
		claim('#145', '#446', '2026-10-02 15:20', 'faulty', 'new', [['ML-OXFD', 2]], {
			said: 'The welt on both pairs came loose at the toe within a week, so the soles lift when we walk. We have stopped wearing them.',
			files: [['oxford-welt.mp4', '6.4 MB']],
		}),
		claim('#144', '#447', '2026-10-01 15:10', 'faulty', 'declined', [['ML-SUIT', 1]], {
			...settledOn('2026-10-05', STAFF),
			said: 'The suit trousers feel tight at the waist.',
			note: 'The waist has extra cloth inside for exactly this. Bring it to any store and our tailors will let it out for free, usually the same day.',
			files: [],
			ret: nothingBack('the suit is as it should be.'),
		}),
		claim('#143', '#440', '2026-10-01 10:00', 'short', 'declined', [['ML-BLAZ', 1]], {
			...settledOn('2026-10-02', ME),
			said: 'One blazer is missing from the delivery.',
			note: 'The delivery was signed for as complete on September 27, and missing items need reporting within 72 hours. Happy to talk it through.',
			files: [],
			ret: nothingBack(NEVER_CAME),
		}),
		claim('#142', '#448', '2026-09-30 16:20', 'short', 'refunded', [['ML-SHLD', 1]], {
			...settledOn('2026-10-02', STAFF, 'credit'),
			credit: '#58',
			said: 'The packing slip lists two pairs of sunglasses and the parcel held one. The seal was intact when it came.',
			note: 'Our packing scan shows one, so you are right. The missing pair is credited against your next order.',
			files: [['box-contents.jpg', '1.6 MB']],
			ret: nothingBack(NEVER_CAME),
		}),
		claim('#141', '#445', '2026-09-30 11:30', 'faulty', 'inspecting', [['ML-GOWN', 1]], {
			said: 'The drape at the shoulder came open after two wears. I followed the care label and only had it dry cleaned once.',
			files: [['order-note.txt', '12 KB']],
			ret: labelBack('1ZR4W82K0391746205', STAFF, '2026-10-01 09:40', '2026-10-07 11:05'),
			check: 'Short stitching at the shoulder on this gown. A workshop fault, not wear.',
		}),
		claim('#140', '#443', '2026-09-29 14:05', 'wrong', 'inspecting', [['ML-TRCH', 1]], {
			said: 'The coat that came is the short leather jacket, not the trench coat on my order. The tags are still on it.',
			files: [['coat-labels.jpg', '1.2 MB']],
			ret: labelBack('1ZH7N35P0482910376', ME, '2026-09-30 10:20', '2026-10-08 10:30'),
			check: 'It is the short LJ-110 jacket instead of the trench on the order. Picked from the wrong rail.',
		}),
		claim('#139', '#442', '2026-09-28 15:40', 'duplicate', 'refunded', [['ML-BLAZ', 1]], {
			...settledOn('2026-10-02', STAFF, 'card'),
			said: 'The order page timed out and I sent it again, so a second blazer came that I do not need. It is unworn and ready to collect.',
			note: 'The spare blazer is back with us unworn, so the full price is going back to your card.',
			files: [],
			ret: labelBack('1ZK2X94T0274581930', STAFF, '2026-09-29 09:15', '2026-10-01 14:10'),
		}),
		claim('#138', '#436', '2026-09-25 16:30', 'damaged', 'refunded', [['ML-BLAZ', 1]], {
			...settledOn('2026-09-30', ME, 'bank'),
			said: 'One blazer arrived with a mark right across the front. The outer box has a deep tear on the same side.',
			note: 'Refunded by bank transfer. We have filed the claim with the carrier, so nothing more is needed from you.',
			files: [
				['snagged-front.jpg', '2.4 MB'],
				['torn-box.jpg', '2.0 MB'],
			],
			ret: nothingBack('the damage claim is with UPS.'),
		}),
		claim('#137', '#434', '2026-09-25 13:25', 'wrong', 'refunded', [['ML-GOWN', 1]], {
			...settledOn('2026-09-29', ME, 'bank'),
			said: 'One of the two gowns is a size L, not the M I ordered. I only noticed when I went to try it on.',
			note: 'The size L is back with us. Refunded by bank transfer.',
			files: [['size-label.jpg', '980 KB']],
			ret: labelBack('1ZM8C61V0351827644', ME, '2026-09-25 15:05', '2026-09-28 11:40'),
		}),
		claim('#136', '#433', '2026-09-24 15:45', 'faulty', 'refunded', [['ML-LOAF', 1]], {
			...settledOn('2026-09-28', STAFF, 'credit'),
			credit: '#55',
			said: 'One loafer has a stitch open at the heel, straight from the box.',
			note: 'Credited against your next order, as you asked.',
			files: [],
			ret: nothingBack(CHEAP),
		}),
	];

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.refunds = { ME, ANSWER_DAYS, CHECK_DAYS, COLLECT_FROM, REASONS, TONE, CLAIMS };

	/**
	 * One claim record: the fields every claim has, followed by whatever
	 * that claim adds (its words, files, decision and return).
	 */
	function claim(id, order, opened, reason, status, lines, details) {
		return { id, order, reason, status, opened, lines, ...details };
	}

	/**
	 * The decision fields of a closed claim. `paid` is left off entirely
	 * for a decline, since no money moved.
	 */
	function settledOn(settled, by, paid) {
		return paid ? { settled, by, paid } : { settled, by };
	}

	/* A claim where the goods stay with the buyer, and the reason why. */
	function nothingBack(why) {
		return { kept: `Nothing to send back: ${why}` };
	}

	/* A prepaid return label: its tracking number, who sent it, when, and
     when the parcel reached the warehouse. */
	function labelBack(label, by, sent, back) {
		return { label, by, sent, back };
	}
})();
