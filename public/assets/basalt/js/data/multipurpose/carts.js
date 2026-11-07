/**
 * Checkouts the Marlo shop lost this month, published as
 * window.Basalt.data.carts for the Abandoned Carts page.
 *
 * A signed-in shopper is referenced by the CST- id from store.js, so
 * Store Customers supplies their name, email and city; a guest leaves
 * only the address typed at checkout. Lines point at catalog SKUs, and
 * catalog.js supplies the price and photo. A cart that turned into a
 * sale carries the shop order number and the time it was placed.
 *
 * Each published cart has: id, customer (CST- id or null), email (guests
 * only), items as [sku, quantity, size or ''], left (local time the
 * checkout was abandoned), sent (reminder times, oldest first) and, once
 * won back, order and ordered. The page derives the status itself.
 * The demo clock reads Friday, October 9, 2026, 10:40.
 */
(() => {
	'use strict';

	const clock = '2026-10-09T10:40';

	/*
	 * The reminder schedule. Both delays count minutes from the moment the
	 * cart was left; carts are cleared after keep days. A promo code, when
	 * set, rides along with the second email only.
	 */
	const schedule = {
		on: true,
		first: 60,
		second: 1440,
		keep: 3,
		code: '',
	};

	/*
	 * Newest first, the order the page receives them in. Every reminder went
	 * out exactly on schedule, so a row records how many were sent rather
	 * than when. A shopper starting with CST- was signed in; anything else
	 * is a guest's email. Lines omit a quantity of one and an empty size.
	 */
	const abandoned = [
		entry('#2614', '#88067', '2026-10-09T10:05', 0, [
			['ML-GOWN', 1, 'M'],
			['ML-LOAF', 1, 'S'],
		]),
		entry('#2613', 'olga.mccall@yahoo.com', '2026-10-09T07:50', 1, [['ML-SUIT']]),
		entry(
			'#2612',
			'#88063',
			'2026-10-08T21:40',
			1,
			[['ML-BLAZ', 1, 'M'], ['ML-OXFD']],
			['#484', '2026-10-09T10:12'],
		),
		entry('#2611', '#88064', '2026-10-08T19:20', 1, [['ML-CATE'], ['ML-OXFD']]),
		entry('#2610', '#88059', '2026-10-08T12:30', 1, [['ML-OXFD', 2], ['ML-CATE']], ['#481', '2026-10-08T16:50']),
		entry('#2609', 'tom.becker@outlook.com', '2026-10-07T14:30', 2, [['ML-ORGZ']]),
		entry('#2608', '#88070', '2026-10-07T09:10', 2, [
			['ML-BLAZ', 1, 'S'],
			['ML-TRCH', 1, 'S'],
		]),
		entry('#2607', 'rory.obiora@gmail.com', '2026-10-06T21:00', 2, [['ML-MTM']]),
		entry('#2606', '#88044', '2026-10-06T18:05', 1, [['ML-STYLE'], ['ML-GIFT250']], ['#475', '2026-10-07T10:20']),
		entry('#2605', '#88077', '2026-10-05T08:30', 2, [['ML-GOWN', 1, 'L']]),
		entry('#2604', '#88065', '2026-10-04T20:15', 1, [['ML-BLAZ', 2, 'M']], ['#470', '2026-10-05T16:10']),
		entry('#2603', '#88046', '2026-10-04T11:00', 2, [['ML-ORGZ'], ['ML-OXFD']], ['#469', '2026-10-05T13:30']),
		entry('#2602', 'elsie.leach@comcast.net', '2026-10-03T16:00', 2, [['ML-GIFT250', 2]]),
		entry('#2601', '#88049', '2026-10-02T12:10', 2, [['ML-LOAF', 2, 'L'], ['ML-TRCH', 1, 'L'], ['ML-OXFD']]),
	];

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.carts = {
		now: clock,
		rules() {
			return detached(schedule);
		},
		carts() {
			return detached(abandoned);
		},
		find(id) {
			const wanted = abandoned.find((cart) => cart.id === id);
			return wanted ? detached(wanted) : null;
		},
	};

	/**
	 * Builds one published cart record.
	 * @param {string} id cart number
	 * @param {string} shopper CST- id, or the guest's checkout email
	 * @param {string} left local time the checkout was abandoned
	 * @param {number} reminders how many scheduled emails have gone out
	 * @param {Array} lines [sku, quantity?, size?] per product
	 * @param {Array} [won] [order number, time ordered] for a recovered cart
	 */
	function entry(id, shopper, left, reminders, lines, won) {
		const signedIn = shopper.startsWith('#');
		const record = signedIn ? { id, customer: shopper } : { id, customer: null, email: shopper };
		const delays = [schedule.first, schedule.second].slice(0, reminders);

		Object.assign(record, {
			items: lines.map(([sku, quantity = 1, size = '']) => [sku, quantity, size]),
			left,
			sent: delays.map((minutes) => later(left, minutes)),
		});
		if (won) [record.order, record.ordered] = won;
		return record;
	}

	/* Adds minutes to a zone-less timestamp without the browser's zone shifting it. */
	function later(stamp, minutes) {
		const shifted = Date.parse(`${stamp}:00Z`) + minutes * 60000;
		return new Date(shifted).toISOString().slice(0, 16);
	}

	/* Hands out a deep copy so a page can mutate its carts freely. */
	function detached(value) {
		return JSON.parse(JSON.stringify(value));
	}
})();
