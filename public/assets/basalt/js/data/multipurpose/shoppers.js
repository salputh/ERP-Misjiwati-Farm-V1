/**
 * Profiles for the Marlo shoppers, published on window.Basalt.data.shoppers.
 * They hold everything the shop keeps besides orders: the account and its
 * last sign-in, sizes per kind of clothing, a note on fit, extra addresses,
 * marketing consent and the returns that predate the refund claims. Only
 * shopper-details.html reads them, by the customer number used in the shop
 * book (window.Basalt.shopBook in store.js), so ?id=%2388041 opens one.
 *
 * Each entry below is written in a short form and expanded by profileOf():
 *   id         the customer number; fit is a line on how they like to wear things
 *   via        'password', 'google' or 'apple'; guest: true means no account
 *   seen       [last sign-in, device]; unverified: true if the email is
 *              still unconfirmed
 *   wears      { kind: [size, note] }, one key per kind they buy
 *   elsewhere  { label: address lines }, saved addresses besides home
 *   returns    returns before September 24, newest first; outcome is
 *              'exchange' (another size), 'refund' or 'credit'
 *   mail       { email | sms | post: 'since <date>' or 'until <date>' };
 *              a channel left out was never offered to them
 *   locked     true keeps the account locked when the page opens
 *
 * To plug in a backend, fill PROFILES with records of the expanded shape.
 */
(() => {
	'use strict';

	const CHANNELS = ['email', 'sms', 'post'];

	const SHOPPERS = [
		{
			id: '#88041',
			fit: 'Likes tailoring easy. Went up to M in the blazer after an S felt snug.',
			via: 'google',
			seen: ['2026-10-08T08:52', 'iPhone, Safari'],
			wears: { Tailoring: ['M', 'Kept 9 of 10'], Evening: ['S', 'Kept every one'] },
			elsewhere: { Work: ['200 Juniper St, Suite 1100', 'Stamford, CT 06901', 'United States'] },
			returns: [{ order: '#118', on: '2026-03-11', sku: 'ML-BLAZ', size: 'S', outcome: 'exchange' }],
			mail: { email: 'since 2022-05-02', sms: 'since 2023-11-14' },
		},
		{
			id: '#88042',
			fit: 'Petite. Shortens sleeves on jackets, so a slim cut works best.',
			via: 'password',
			seen: ['2026-10-07T07:41', 'MacBook, Chrome'],
			wears: { Tailoring: ['S', 'Kept 6 of 6'], Coats: ['S', 'Kept 4 of 5'], Shoes: ['US 7', 'Kept 3 of 3'] },
			returns: [{ order: '#204', on: '2026-05-20', sku: 'ML-TRCH', size: 'M', outcome: 'exchange' }],
			mail: { email: 'since 2020-12-08', post: 'since 2021-09-30' },
		},
		{
			id: '#88059',
			fit: 'Buys blazers a size up to layer over silk.',
			via: 'apple',
			seen: ['2026-10-08T21:14', 'iPhone, Marlo app'],
			wears: { Tailoring: ['L', 'Kept 7 of 7'], Shoes: ['US 8', 'Kept 10 of 10'] },
			elsewhere: { Parents: ['88 Lakeview Dr', 'Evanston, IL 60201', 'United States'] },
			mail: { email: 'since 2024-02-11', sms: 'since 2024-02-11' },
		},
		{
			id: '#88031',
			fit: 'Long arms. Picks the blazer for its longer sleeve.',
			via: 'password',
			seen: ['2026-10-06T09:40', 'Windows, Edge'],
			wears: { Tailoring: ['M', 'Kept 4 of 5'], Shoes: ['US 9', 'Kept 7 of 7'] },
			mail: { email: 'since 2022-11-02', sms: 'until 2024-06-03' },
		},
		{
			id: '#88060',
			fit: 'Regular fit. Booked a styling session before the winter order.',
			via: 'google',
			seen: ['2026-10-08T12:58', 'Android, Chrome'],
			wears: { Tailoring: ['M', 'Kept 5 of 5'], Shoes: ['US 8', 'Kept 5 of 5'] },
			elsewhere: { 'Lake house': ['14 Sandling Rd', 'Tyler, TX 75703', 'United States'] },
			mail: { email: 'since 2024-05-22', sms: 'since 2025-01-08', post: 'since 2024-05-22' },
		},
		{
			id: '#88061',
			fit: 'Wears coats oversized and dresses true to size.',
			via: 'password',
			seen: ['2026-10-09T07:58', 'iPhone, Safari'],
			wears: { Dresses: ['S', 'Kept 4 of 5'], Coats: ['M', 'Kept 4 of 4'], Tailoring: ['M', 'Kept 1 of 1'] },
			returns: [{ order: '#151', on: '2026-04-02', sku: 'ML-GOWN', size: 'M', outcome: 'exchange' }],
			mail: { email: 'since 2022-10-11' },
		},
		{
			id: '#88062',
			fit: 'Tall. Asks about body length before buying coats.',
			via: 'password',
			seen: ['2026-10-09T09:24', 'MacBook, Safari'],
			wears: { Evening: ['M', 'Kept 3 of 4'], Tailoring: ['M', 'Kept 3 of 3'], Shoes: ['US 8', 'Kept 4 of 4'] },
			mail: { email: 'since 2023-01-23' },
		},
		{
			id: '#88063',
			fit: 'True to size. Prefers the gown with the trench over it.',
			via: 'apple',
			seen: ['2026-10-09T10:05', 'iPad, Safari'],
			wears: { Dresses: ['M', 'Kept 3 of 4'], Tailoring: ['S', 'Kept 3 of 3'] },
			elsewhere: { Office: ['1 Federal St, Floor 9', 'Boston, MA 02110', 'United States'] },
			mail: { email: 'since 2022-09-19', sms: 'since 2022-09-19' },
		},
		{
			id: '#88046',
			fit: 'Broad shoulders. The coat was cut an inch longer in the back.',
			via: 'password',
			seen: ['2026-10-05T13:22', 'MacBook, Firefox'],
			wears: {
				Coat: ['Made to measure', 'Measured Sep 15'],
				Coats: ['L', 'Kept 3 of 3'],
				Shoes: ['US 9', 'Kept 4 of 4'],
			},
			mail: { email: 'since 2022-06-30', post: 'since 2022-06-30' },
		},
		{
			id: '#88064',
			fit: 'Slim fit. Always sizes down in silk.',
			via: 'google',
			seen: ['2026-10-05T10:47', 'Android, Chrome'],
			wears: { Tailoring: ['S', 'Kept 4 of 4'], Evening: ['S', 'Kept 3 of 3'], Shoes: ['US 7', 'Kept 3 of 3'] },
			mail: { email: 'since 2023-12-09', sms: 'since 2023-12-09' },
		},
		{
			id: '#88065',
			fit: 'Regular fit. Buys sunglasses as gifts for the family.',
			via: 'password',
			seen: ['2026-10-05T18:31', 'iPhone, Safari'],
			wears: { Tailoring: ['M', 'Kept 3 of 3'] },
			elsewhere: { 'Gift to Mom': ['6 Magnolia St', 'Greenville, SC 29601', 'United States'] },
			mail: { email: 'since 2023-09-18' },
		},
		{
			id: '#88048',
			fit: 'Petite. Gowns in XS; the trench in S for a looser look.',
			via: 'apple',
			seen: ['2026-10-08T10:12', 'iPhone, Marlo app'],
			wears: { Evening: ['XS', 'Kept 5 of 5'], Coats: ['S', 'Kept 2 of 2'], Shoes: ['US 7', 'Kept 3 of 4'] },
			mail: { email: 'since 2024-11-11', sms: 'since 2024-11-11' },
		},
		{
			id: '#88066',
			fit: 'Roomy blazers worn over silk. Has everything pressed.',
			via: 'password',
			seen: ['2026-10-05T08:50', 'Windows, Firefox'],
			wears: { Tailoring: ['L', 'Kept 3 of 3'] },
			mail: { email: 'since 2022-12-06', post: 'since 2023-10-01' },
		},
		{
			id: '#88067',
			fit: 'Regular fit. Orders loafers one pair at a time in new colors.',
			via: 'google',
			seen: ['2026-09-22T08:40', 'MacBook, Chrome'],
			wears: { Coats: ['M', 'Kept 3 of 3'], Evening: ['M', 'Kept 3 of 3'] },
			mail: { email: 'since 2023-03-01' },
		},
		{
			id: '#88044',
			fit: 'Between sizes. Kept the M blazer, sent the suit back.',
			via: 'password',
			seen: ['2026-10-07T10:15', 'iPad, Safari'],
			wears: { Tailoring: ['M', 'Kept 2 of 3'], Shoes: ['US 8', 'Kept 1 of 1'] },
			returns: [{ order: '#414', on: '2026-08-24', sku: 'ML-SUIT', size: 'M', outcome: 'refund' }],
			mail: { email: 'since 2023-07-10' },
		},
		{
			id: '#88053',
			fit: 'True to size across the range.',
			via: 'password',
			seen: ['2026-10-07T15:10', 'Android, Chrome'],
			wears: { Dresses: ['S', 'Kept 2 of 2'], Evening: ['S', 'Kept 3 of 3'], Shoes: ['US 7', 'Kept 2 of 2'] },
			mail: { email: 'since 2024-11-20' },
		},
		{
			id: '#88049',
			fit: 'Relaxed fit. Buys sunglasses as gifts each winter.',
			via: 'apple',
			seen: ['2026-10-01T15:02', 'iPhone, Safari'],
			wears: { Tailoring: ['L', 'Kept 2 of 2'], Shoes: ['US 9', 'Kept 5 of 5'] },
			mail: { email: 'until 2025-08-14' },
		},
		{
			id: '#88043',
			fit: 'True to size. Likes the dress with a belt.',
			via: 'password',
			seen: ['2026-10-06T11:26', 'MacBook, Safari'],
			wears: { Evening: ['M', 'Kept 4 of 4'], Coats: ['M', 'Kept 2 of 2'], Dresses: ['M', 'Kept 2 of 2'] },
			mail: { email: 'since 2025-11-02' },
		},
		{
			id: '#88068',
			fit: 'Petite. Ordered the blazer twice by mistake in September.',
			via: 'google',
			seen: ['2026-10-07T16:38', 'Android, Chrome'],
			wears: { Tailoring: ['S', 'Kept 2 of 4'], Evening: ['S', 'Kept 2 of 2'] },
			mail: { email: 'since 2024-03-04', sms: 'since 2024-03-04' },
		},
		{
			id: '#88050',
			fit: 'Regular fit. Mostly buys gift cards for others.',
			via: 'password',
			seen: ['2026-10-06T15:12', 'Windows, Chrome'],
			wears: { Evening: ['L', 'Kept 4 of 4'] },
			mail: { email: 'since 2024-06-03' },
		},
		{
			id: '#88069',
			fit: 'True to size. Traded in an older dress for the new wrap.',
			via: 'google',
			seen: ['2026-09-30T11:20', 'iPhone, Chrome'],
			wears: { Dresses: ['S', 'Kept 2 of 3'], Evening: ['S', 'Kept 3 of 3'] },
			mail: { email: 'since 2024-02-26' },
		},
		{
			id: '#88052',
			fit: 'Asked for a styling session before choosing a size.',
			via: 'password',
			seen: ['2026-10-03T11:15', 'MacBook, Safari'],
			wears: { Evening: ['M', 'Kept 2 of 2'] },
			mail: { email: 'since 2024-09-26', post: 'since 2024-09-26' },
		},
		{
			id: '#88055',
			fit: 'Regular fit.',
			via: 'password',
			seen: ['2026-10-02T11:31', 'iPad, Safari'],
			wears: { Tailoring: ['M', 'Kept 1 of 1'], Coats: ['M', 'Kept 1 of 1'], Evening: ['M', 'Kept 3 of 3'] },
			mail: { email: 'since 2025-07-14' },
		},
		{
			id: '#88070',
			fit: 'Regular fit. Buys loafers for the whole family.',
			via: 'apple',
			seen: ['2026-10-02T15:18', 'iPhone, Safari'],
			wears: { Evening: ['M', 'Kept 2 of 2'], Coats: ['M', 'Kept 1 of 1'] },
			mail: { email: 'since 2023-11-02' },
		},
		{
			id: '#88071',
			fit: 'Regular fit. On the Aftercare Plan since 2024.',
			via: 'password',
			seen: ['2026-10-08T10:15', 'Android, Chrome'],
			wears: { Shoes: ['US 8', 'Kept 3 of 3'], Evening: ['M', 'Kept 2 of 2'] },
			mail: { email: 'since 2024-07-25', sms: 'since 2024-07-25' },
		},
		{
			id: '#88072',
			fit: 'Relaxed fit.',
			via: 'google',
			seen: ['2026-09-29T09:02', 'MacBook, Chrome'],
			wears: { Dresses: ['L', 'Kept 1 of 1'], Shoes: ['US 8', 'Kept 2 of 2'] },
			mail: { email: 'since 2025-01-20' },
		},
		{
			id: '#88076',
			guest: true,
			fit: 'Regular fit.',
			wears: { Tailoring: ['M', 'Kept 1 of 1'], Evening: ['S', 'Kept 1 of 1'] },
			mail: { email: 'since 2024-09-19' },
		},
		{
			id: '#88077',
			guest: true,
			fit: 'Buys dresses as gifts. Swapped one for a smaller size.',
			wears: { Dresses: ['S', 'Kept 1 of 2'] },
			returns: [{ order: '#233', on: '2026-05-19', sku: 'ML-GOWN', size: 'M', outcome: 'exchange' }],
		},
		{
			id: '#88057',
			fit: 'True to size.',
			via: 'password',
			seen: ['2026-10-04T14:36', 'Android, Firefox'],
			unverified: true,
			wears: { Dresses: ['M', 'Kept 1 of 1'], Evening: ['M', 'Kept 2 of 2'] },
			mail: { email: 'since 2025-04-09' },
		},
		{
			id: '#88080',
			fit: 'Regular fit.',
			via: 'apple',
			seen: ['2026-10-03T09:46', 'iPhone, Safari'],
			wears: { Evening: ['S', 'Kept 1 of 1'] },
			mail: { email: 'since 2025-03-03' },
		},
		{
			id: '#88074',
			fit: 'Relaxed fit. Sunglasses for the whole house.',
			via: 'password',
			seen: ['2026-09-28T12:55', 'Windows, Edge'],
			wears: { Shoes: ['US 8', 'Kept 6 of 6'], Evening: ['L', 'Kept 2 of 2'] },
			mail: { email: 'since 2025-02-27' },
		},
		{
			id: '#88073',
			fit: 'Regular fit. Came in through the first order code.',
			via: 'google',
			seen: ['2026-09-24T12:10', 'Android, Chrome'],
			wears: { Evening: ['M', 'Kept 2 of 2'] },
			mail: { email: 'since 2025-04-11' },
		},
		{
			id: '#88075',
			fit: 'Slim fit.',
			via: 'password',
			seen: ['2026-09-23T14:40', 'MacBook, Safari'],
			wears: { Shoes: ['US 7', 'Kept 3 of 3'], Evening: ['S', 'Kept 2 of 2'] },
			mail: { email: 'since 2025-02-17' },
		},
		{
			id: '#88079',
			fit: 'True to size. Paid for next-day delivery once.',
			via: 'apple',
			seen: ['2026-09-16T16:44', 'iPhone, Safari'],
			wears: { Dresses: ['M', 'Kept 2 of 2'], Shoes: ['US 8', 'Kept 2 of 2'] },
			mail: { email: 'since 2025-10-05' },
		},
		{
			id: '#88078',
			guest: true,
			fit: 'Regular fit.',
			wears: { Coats: ['M', 'Kept 1 of 1'] },
		},
		{
			id: '#88081',
			fit: 'Relaxed fit.',
			via: 'password',
			seen: ['2026-08-19T20:05', 'Windows, Chrome'],
			wears: { Shoes: ['US 9', 'Kept 3 of 3'], Evening: ['L', 'Kept 3 of 3'] },
			mail: { email: 'until 2026-07-01' },
		},
		{
			id: '#88082',
			fit: 'Buys blazers a size up for winter layers.',
			via: 'google',
			seen: ['2026-08-02T09:12', 'Android, Chrome'],
			wears: { Tailoring: ['L', 'Kept 2 of 2'], Evening: ['M', 'Kept 2 of 2'] },
			mail: { email: 'since 2025-05-16' },
		},
		{
			id: '#88083',
			guest: true,
			fit: 'Regular fit.',
			wears: { Dresses: ['S', 'Kept 1 of 1'], Evening: ['S', 'Kept 1 of 1'] },
			mail: { email: 'since 2025-11-28' },
		},
		{
			id: '#88058',
			via: 'password',
			seen: ['2026-10-05T19:20', 'iPhone, Safari'],
			unverified: true,
			mail: { email: 'since 2026-10-05' },
		},
	];

	const PROFILES = {};

	publish();

	/** Expands every entry into PROFILES and exposes it on window.Basalt.data. */
	function publish() {
		for (const entry of SHOPPERS) PROFILES[entry.id] = profileOf(entry);
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.shoppers = { PROFILES };
	}

	/**
	 * Turns one short-form entry into the record Shopper Details reads:
	 * { sign, sizes, fit, more, consent, past } plus locked when set.
	 */
	function profileOf(entry) {
		const record = {
			sign: entry.guest ? null : [entry.via, !entry.unverified, ...entry.seen],
			sizes: Object.entries(entry.wears || {}).map(([kind, [size, note]]) => [kind, size, note]),
			fit: entry.fit || '',
			more: Object.entries(entry.elsewhere || {}).map(([label, lines]) => ({ label, lines })),
			consent: consentOf(entry.mail || {}),
			past: (entry.returns || []).map(({ on, sku, size, outcome, order }) => [on, sku, size, outcome, order]),
		};
		if (entry.locked) record.locked = true;
		return record;
	}

	/**
	 * Reads 'since <date>' as subscribed and 'until <date>' as unsubscribed on
	 * that day; a missing channel becomes [false, null].
	 */
	function consentOf(mail) {
		const consent = {};
		for (const channel of CHANNELS) {
			const [word, date] = (mail[channel] || '').split(' ');
			consent[channel] = [word === 'since', date || null];
		}
		return consent;
	}
})();
