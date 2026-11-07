/**
 * The ways a Marlo shopper can pay, and the route their money takes to
 * Marlo's bank, published as window.Basalt.data.shopPayments.
 *
 * Payment Methods renders the methods with their fees and currencies.
 * Payouts matches card and wallet charges from the order book
 * (window.Basalt.shopBook in assets/basalt/js/data/multipurpose/store.js) to the deposits they
 * make, so every payout points at orders that also appear on Orders and
 * Order Details.
 *
 * Shape of a method record:
 *   id, name, icon, detail   identity and the one line shown under the name
 *   tone                     which chart ramp color its tile takes
 *   mode                     'live', 'test' (staff only so far) or 'off'
 *   fee                      { pct, fixed, cap } with cents, or null when free
 *   currencies               the currencies a shopper may pay in
 *   pays                     order-book payment kinds it covers: card,
 *                            ach (bank transfer), terms (invoice), check
 *                            (gift card)
 *   limits                   optional [min, max] order total in dollars
 *   payout, since            how the money lands, and the date it went live
 * WALLET lists card orders paid through a phone or browser wallet, BANK is
 * the deposit account, DELAY counts working days to payout and to arrival.
 *
 * Swap in the response from your own payment provider, kept in this shape.
 */
(() => {
	'use strict';

	/* The shop charges in dollars only, and this is its first day of trading. */
	const everywhere = ['USD'];
	const openedOn = '2022-04-05';

	const METHODS = [
		{
			id: 'card',
			icon: 'bi-credit-card-2-front',
			name: 'Card payments',
			tone: 1,
			detail: 'Visa, Mastercard, Amex and Discover',
			mode: 'live',
			since: openedOn,
			pays: ['card'],
			fee: pricing(2.9, 30),
			payout: 'Paid out each working day',
			currencies: [...everywhere],
		},
		{
			id: 'wallet',
			icon: 'bi-phone',
			name: 'Wallet pay',
			tone: 5,
			detail: 'Phone and browser wallets',
			mode: 'live',
			since: '2023-02-14',
			pays: [],
			fee: pricing(2.9, 30),
			payout: 'Paid out with card payments',
			currencies: [...everywhere],
		},
		{
			id: 'bnpl',
			icon: 'bi-calendar2-week',
			name: 'Buy now, pay later',
			tone: 8,
			detail: 'Four payments over six weeks',
			mode: 'test',
			since: '2026-09-28',
			limits: [50, 1500],
			pays: [],
			fee: pricing(5.99, 30),
			payout: 'Paid out in full, then collected from the shopper',
			currencies: ['USD'],
		},
		{
			id: 'bank',
			icon: 'bi-bank',
			name: 'Bank transfer',
			tone: 3,
			detail: 'ACH and wire, for larger orders',
			mode: 'live',
			since: openedOn,
			limits: [250, 25000],
			pays: ['ach'],
			fee: pricing(0.8, 0, 500),
			payout: 'Lands in the bank account directly',
			currencies: ['USD'],
		},
		{
			id: 'invoice',
			icon: 'bi-receipt',
			name: 'Pay by invoice',
			tone: 2,
			detail: 'Pay in 30 days, for Insider and Member tiers',
			mode: 'live',
			since: '2022-11-07',
			pays: ['terms'],
			fee: null,
			payout: 'Paid to the bank account when the invoice is paid',
			currencies: [...everywhere],
		},
		{
			id: 'gift',
			icon: 'bi-gift',
			name: 'Gift cards',
			tone: 6,
			detail: 'Marlo e-gift cards, which never expire',
			mode: 'live',
			since: openedOn,
			pays: ['check'],
			fee: null,
			payout: 'No payout: the money came in when the card was bought',
			currencies: ['USD'],
		},
		{
			id: 'local',
			icon: 'bi-people',
			name: 'Peer-to-peer payments',
			tone: 7,
			detail: 'Venmo, Cash App and Zelle',
			mode: 'off',
			since: null,
			pays: [],
			fee: pricing(0.8, 25),
			payout: 'Paid out each working day',
			currencies: ['USD'],
		},
	];

	/* Orders charged to a card that the shopper tapped in from a wallet. */
	const WALLET = [482, 476, 462, 452, 444, 441, 437, 421].map((n) => `#${n}`);

	const BANK = { holder: 'Marlo Studio LLC', name: 'Relay Business Checking', currency: 'USD', last4: '4417' };

	/* Money leaves two working days after the charge and lands one day later. */
	const DELAY = { arrive: 1, payout: 2 };

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.shopPayments = { METHODS, WALLET, BANK, DELAY };

	/**
	 * Builds a fee schedule: a percentage of the order plus a flat amount in
	 * cents, with an optional ceiling in cents. The ceiling key is left out
	 * entirely when there is none, so the record keeps its published shape.
	 */
	function pricing(pct, fixed, cap) {
		return cap === undefined ? { pct, fixed } : { pct, fixed, cap };
	}
})();
