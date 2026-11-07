/**
 * Demo account-access record behind security.html. It describes how
 * John Armstrong gets into Fieldline: his password age, the second sign-in
 * step, the backup codes, his one passkey and his latest sign-ins.
 *
 * Shape of window.Basalt.data.security:
 *   now            the frozen demo clock, 'YYYY-MM-DD HH:MM'
 *   person         name, email and initials of the account owner
 *   password       { changed } - the day the password was last set
 *   twoStep        on/off, the method, the app label, its start, a phone
 *   codes          backup codes in printed order, each { code, used }
 *   codesIssued    the day those codes were generated
 *   passkeys       saved passkeys
 *   signins        latest sign-ins, most recent at the top
 *   devices, places, methods  keyed lookups the sign-ins point at
 *
 * Every fact lines up with my-account.html (password Feb 24,
 * authenticator app since Jun 4) and with John's rows on
 * sign-in-history.html, ids and addresses included. Swap in your own
 * auth service's answers using the same shape.
 */
(() => {
	'use strict';

	const DEMO_NOW = '2026-10-02 11:20';

	/* Enrolling the authenticator app on Jun 4 also produced the code set. */
	const APP_SINCE = '2026-06-04';

	/* Positions (zero-based) of the backup codes John has already spent. */
	const SPENT = new Set([0, 2, 5]);

	const CODE_LIST = [
		'4827-1930',
		'7715-0264',
		'3091-5582',
		'6620-4417',
		'1958-3306',
		'8043-7729',
		'2264-9185',
		'5391-0873',
	];

	/*
	 * Each sign-in as [id, when, device, ip, session state, last seen].
	 * All four came from Boulder with a password and an app code.
	 */
	const SIGNIN_ROWS = [
		['si-2160', '2026-10-02 08:31', 'mac-chrome', '73.14.208.91', 'active', DEMO_NOW],
		['si-2098', '2026-10-01 14:22', 'iphone-safari', '174.51.92.40', 'active', '2026-10-02 07:05'],
		['si-1815', '2026-09-04 11:00', 'mac-chrome', '73.14.208.91', 'out', '2026-09-04 17:20'],
		['si-1718', '2026-08-19 08:55', 'mac-chrome', '73.14.208.91', 'out', '2026-08-19 17:45'],
	];

	/* The sign-in this browser is using right now. */
	const THIS_SESSION = 'si-2160';

	const shared = window.Basalt.data || (window.Basalt.data = {});

	shared.security = {
		codesIssued: APP_SINCE,
		now: DEMO_NOW,
		password: { changed: '2026-02-24' },
		person: { email: 'john.armstrong@fieldline.app', initials: 'JA', name: 'John Armstrong' },
		twoStep: {
			app: 'Authenticator app on iPhone',
			method: 'app',
			on: true,
			phone: '+1 (312) 555-0125',
			since: APP_SINCE,
		},
		codes: CODE_LIST.map((code, position) => ({ code, used: SPENT.has(position) })),

		/*
		 * The passkey went on the MacBook on Sep 30 and has not signed John
		 * in yet, so each sign-in below still used a password and a code.
		 */
		passkeys: [
			{ added: '2026-09-30', icon: 'bi-laptop', id: 'pk-1', kind: 'Touch ID', name: 'MacBook Pro', used: null },
		],
		signins: SIGNIN_ROWS.map(toSignIn),

		devices: {
			'iphone-safari': { browser: 'Safari 26', icon: 'bi-phone', name: 'iPhone', os: 'iOS 26' },
			'mac-chrome': { browser: 'Chrome 141', icon: 'bi-laptop', name: 'MacBook Pro', os: 'macOS 26' },
		},
		methods: {
			password: { label: 'Password', second: 'Code from an authenticator app' },
		},
		places: {
			denver: { city: 'Boulder', country: 'United States' },
		},
	};

	/**
	 * Expands one SIGNIN_ROWS tuple into the record the page reads. Only
	 * the current session carries a `current` flag.
	 * @param {string[]} row  [id, at, device, ip, state, last]
	 * @returns {object} a successful password sign-in from Boulder
	 */
	function toSignIn([id, at, device, ip, state, last]) {
		const record = {
			at,
			device,
			id,
			ip,
			method: 'password',
			place: 'denver',
			result: 'success',
			session: { last, state },
		};
		if (id === THIS_SESSION) record.current = true;
		return record;
	}
})();
