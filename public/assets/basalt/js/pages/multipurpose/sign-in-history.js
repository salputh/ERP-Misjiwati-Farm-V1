/**
 * Sign-in history for the Fieldline workspace, used by sign-in-history.html.
 *
 * The page lists who signed in, at what time, by which method, on which
 * device and from where, and whether they were let in. Above the list sit
 * the flagged patterns someone should review; below it, the sessions still
 * open and a breakdown of the places sign-ins arrive from.
 *
 * Bringing your own data takes two steps. Put your records where DEMO is
 * (or let api.load() fetch them), since every panel is built from them.
 * Then give each api method a real request: the screen changes first and
 * is put back, with a toast, whenever a request fails.
 *
 * For trying it out, ?state=empty shows a brand-new workspace, ?state=error
 * makes the first load fail, and ?state=offline fails every action.
 */
(() => {
	'use strict';

	const host = pick('[data-lh-root]');
	if (!host) return;

	/* The records behind every panel. Times are local to the viewer and
     written as 'YYYY-MM-DD HH:MM'; replace the whole object with yours. */
	const DEMO = {
		/* A frozen "now" so the demo always reads the same; use the clock in a real app. */
		now: '2026-10-02 11:20',
		/* Who is viewing, and which of the sign-ins below is their own session. */
		me: 'ja',
		mySession: 'si-2160',

		/* Everyone in the workspace. role is their Fieldline permission level,
       job their title, and home the place they normally sign in from. */
		people: {
			ja: {
				name: 'John Armstrong',
				email: 'john.armstrong@fieldline.app',
				role: 'Administrator',
				team: 'Operations',
				job: 'Operations director',
				home: 'denver',
				tone: 1,
			},
			md: {
				name: 'Megan Doyle',
				email: 'megan.doyle@fieldline.app',
				role: 'Owner',
				team: 'Operations',
				job: 'Chief executive',
				home: 'austin',
				tone: 2,
			},
			pr: {
				name: 'Connie Reese',
				email: 'connie.reese@fieldline.app',
				role: 'Support agent',
				team: 'Support',
				job: 'Support lead',
				home: 'trenton',
				tone: 3,
			},
			hs: {
				name: 'Hope Stout',
				email: 'hope.stout@fieldline.app',
				role: 'Billing admin',
				team: 'Finance',
				job: 'Billing specialist',
				home: 'sedona',
				tone: 4,
			},
			th: {
				name: 'Todd Hatcher',
				email: 'trent.hatcher@fieldline.app',
				role: 'Engineer',
				team: 'Engineering',
				job: 'Backend engineer',
				home: 'mexico',
				tone: 5,
			},
			mb: {
				name: 'Quentin Cook',
				email: 'quentin.cook@fieldline.app',
				role: 'Read-only',
				team: 'Sales',
				job: 'Account executive',
				home: 'chicago',
				tone: 6,
			},
			ab: {
				name: 'Alexis Boone',
				email: 'alexis.boone@fieldline.app',
				role: 'Schedule manager',
				team: 'Success',
				job: 'Customer success manager',
				home: 'decatur',
				tone: 7,
			},
			ln: {
				name: 'Dawn Fischer',
				email: 'dawn.fischer@fieldline.app',
				role: 'Read-only',
				team: 'Product',
				job: 'Product manager',
				home: 'toledo',
				tone: 8,
			},
			dp: {
				name: 'Marshall Roe',
				email: 'marshall.roe@fieldline.app',
				role: 'Engineer',
				team: 'Engineering',
				job: 'Mobile engineer',
				home: 'seattle',
				tone: 1,
			},
			wt: {
				name: 'Walt Lutz Tan',
				email: 'weiling.tan@fieldline.app',
				role: 'Support agent',
				team: 'Support',
				job: 'Support specialist',
				home: 'flagstaff',
				tone: 2,
			},
			cr: {
				name: 'Carrie Rankin',
				email: 'carrie.rankin@fieldline.app',
				role: 'Support agent',
				team: 'Support',
				job: 'Support specialist',
				home: 'durham',
				tone: 3,
			},
			ms: {
				name: 'Melvin Parsons',
				email: 'melvin.parsons@fieldline.app',
				role: 'Read-only',
				team: 'Sales',
				job: 'Account executive',
				home: 'lexington',
				tone: 4,
			},
			nl: {
				name: 'Shelby Leach',
				email: 'shelby.leach@fieldline.app',
				role: 'Billing admin',
				team: 'Finance',
				job: 'Finance manager',
				home: 'stcloud',
				tone: 5,
			},
			km: {
				name: 'Kirk Mathis',
				email: 'kirk.mathis@fieldline.app',
				role: 'Read-only',
				team: 'Marketing',
				job: 'Marketing manager',
				home: 'grandrapids',
				tone: 6,
			},
		},

		/* Ways in, in the order the method menu and the donut list them.
       second describes the extra step after the first factor. */
		methods: {
			okta: { label: 'Okta SSO', icon: 'bi-shield-check', second: 'Handled by Okta Verify' },
			google: { label: 'Google SSO', icon: 'bi-google', second: 'Handled by Google' },
			password: { label: 'Password + 2FA', icon: 'bi-key', second: 'Code from an authenticator app' },
			plain: { label: 'Password only', icon: 'bi-asterisk', second: 'None' },
		},

		devices: {
			'mac-chrome': { name: 'MacBook Pro', os: 'macOS 26', browser: 'Chrome 141', icon: 'bi-laptop' },
			'mac-safari': { name: 'MacBook Air', os: 'macOS 26', browser: 'Safari 26', icon: 'bi-laptop' },
			'win-chrome': { name: 'Windows laptop', os: 'Windows 11', browser: 'Chrome 141', icon: 'bi-laptop' },
			'win-edge': { name: 'Windows desktop', os: 'Windows 11', browser: 'Edge 141', icon: 'bi-pc-display' },
			'win-firefox': { name: 'Windows PC', os: 'Windows 10', browser: 'Firefox 143', icon: 'bi-pc-display' },
			'linux-firefox': { name: 'ThinkPad', os: 'Ubuntu 24.04', browser: 'Firefox 144', icon: 'bi-laptop' },
			'iphone-safari': { name: 'iPhone', os: 'iOS 26', browser: 'Safari 26', icon: 'bi-phone' },
			'android-chrome': { name: 'Pixel phone', os: 'Android 16', browser: 'Chrome 141', icon: 'bi-phone' },
			script: { name: 'No browser', os: 'Linux server', browser: 'A script, not a browser', icon: 'bi-terminal' },
		},

		/* Rough locations derived from each IP address. */
		regions: ['Northeast', 'Midwest', 'West', 'South'],
		places: {
			denver: { city: 'Boulder', state: 'Colorado', st: 'CO', region: 'West' },
			austin: { city: 'Waco', state: 'Texas', st: 'TX', region: 'South' },
			chicago: { city: 'Evanston', state: 'Illinois', st: 'IL', region: 'Midwest' },
			seattle: { city: 'Tacoma', state: 'Washington', st: 'WA', region: 'West' },
			trenton: { city: 'Stamford', state: 'Connecticut', st: 'CT', region: 'Northeast' },
			decatur: { city: 'Bismarck', state: 'North Dakota', st: 'ND', region: 'Midwest' },
			toledo: { city: 'Toledo', state: 'Ohio', st: 'OH', region: 'Midwest' },
			cedarrapids: { city: 'Kalamazoo', state: 'Michigan', st: 'MI', region: 'Midwest' },
			grandrapids: { city: 'Duluth', state: 'Minnesota', st: 'MN', region: 'Midwest' },
			stcloud: { city: 'St. Cloud', state: 'Minnesota', st: 'MN', region: 'Midwest' },
			grandforks: { city: 'Lincoln', state: 'Nebraska', st: 'NE', region: 'Midwest' },
			aberdeen: { city: 'Aberdeen', state: 'South Dakota', st: 'SD', region: 'Midwest' },
			sedona: { city: 'Missoula', state: 'Montana', st: 'MT', region: 'West' },
			flagstaff: { city: 'Flagstaff', state: 'Arizona', st: 'AZ', region: 'West' },
			mexico: { city: 'Chattanooga', state: 'Tennessee', st: 'TN', region: 'South' },
			durham: { city: 'Durham', state: 'North Carolina', st: 'NC', region: 'South' },
			lexington: { city: 'Sarasota', state: 'Florida', st: 'FL', region: 'South' },
		},

		results: {
			success: { label: 'Success', tone: 'success', icon: 'bi-check2-circle' },
			failed: { label: 'Failed', tone: 'warning', icon: 'bi-x-circle' },
			blocked: { label: 'Blocked', tone: 'danger', icon: 'bi-slash-circle' },
			challenged: { label: '2FA challenged', tone: 'info', icon: 'bi-shield-exclamation' },
		},

		/* One entry per attempt: id, at, who (a people key), method, device,
       place, ip and result. Turned-away attempts carry a reason; the ones
       that got in carry session: { state: 'active' | 'out' | 'expired', last },
       last being the moment that session was most recently used. */
		signins: [
			{
				id: 'si-2190',
				at: '2026-10-02 11:12',
				who: 'pr',
				method: 'okta',
				device: 'win-edge',
				place: 'trenton',
				ip: '24.46.18.40',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 11:19' },
			},
			{
				id: 'si-2188',
				at: '2026-10-02 11:04',
				who: 'wt',
				method: 'okta',
				device: 'android-chrome',
				place: 'flagstaff',
				ip: '68.2.41.77',
				result: 'success',
				session: { state: 'out', last: '2026-10-02 11:15' },
			},
			{
				id: 'si-2185',
				at: '2026-10-02 10:58',
				who: 'mb',
				method: 'google',
				device: 'mac-chrome',
				place: 'chicago',
				ip: '73.45.120.9',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 11:17' },
			},
			{
				id: 'si-2183',
				at: '2026-10-02 10:44',
				who: 'nl',
				method: 'password',
				device: 'win-chrome',
				place: 'aberdeen',
				ip: '71.33.12.201',
				result: 'challenged',
				reason: 'Password was right; the 2FA code was never entered',
			},
			{
				id: 'si-2182',
				at: '2026-10-02 10:37',
				who: 'nl',
				method: 'password',
				device: 'win-chrome',
				place: 'aberdeen',
				ip: '71.33.12.201',
				result: 'challenged',
				reason: 'Password was right; the 2FA code was never entered',
			},
			{
				id: 'si-2180',
				at: '2026-10-02 10:31',
				who: 'nl',
				method: 'password',
				device: 'win-chrome',
				place: 'aberdeen',
				ip: '71.33.12.201',
				result: 'challenged',
				reason: 'Password was right; the 2FA code was never entered',
			},
			{
				id: 'si-2177',
				at: '2026-10-02 10:12',
				who: 'ab',
				method: 'okta',
				device: 'win-chrome',
				place: 'decatur',
				ip: '64.89.44.130',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 11:10' },
			},
			{
				id: 'si-2171',
				at: '2026-10-02 09:40',
				who: 'th',
				method: 'google',
				device: 'linux-firefox',
				place: 'mexico',
				ip: '76.29.66.14',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 11:02' },
			},
			{
				id: 'si-2166',
				at: '2026-10-02 09:02',
				who: 'hs',
				method: 'okta',
				device: 'win-chrome',
				place: 'lexington',
				ip: '97.104.140.36',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 10:48' },
			},
			{
				id: 'si-2163',
				at: '2026-10-02 08:47',
				who: 'dp',
				method: 'google',
				device: 'mac-chrome',
				place: 'seattle',
				ip: '50.47.210.3',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 11:05' },
			},
			{
				id: 'si-2160',
				at: '2026-10-02 08:31',
				who: 'ja',
				method: 'password',
				device: 'mac-chrome',
				place: 'denver',
				ip: '73.14.208.91',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 11:20' },
			},
			{
				id: 'si-2158',
				at: '2026-10-02 08:10',
				who: 'hs',
				method: 'okta',
				device: 'mac-safari',
				place: 'sedona',
				ip: '69.146.31.208',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 08:12' },
			},
			{
				id: 'si-2155',
				at: '2026-10-02 07:48',
				who: 'mb',
				method: 'password',
				device: 'win-firefox',
				place: 'cedarrapids',
				ip: '68.43.101.47',
				result: 'blocked',
				reason: 'Account paused after 5 wrong passwords',
			},
			{
				id: 'si-2154',
				at: '2026-10-02 07:47',
				who: 'mb',
				method: 'password',
				device: 'win-firefox',
				place: 'cedarrapids',
				ip: '68.43.101.47',
				result: 'blocked',
				reason: 'Account paused after 5 wrong passwords',
			},
			{
				id: 'si-2152',
				at: '2026-10-02 07:46',
				who: 'mb',
				method: 'password',
				device: 'win-firefox',
				place: 'cedarrapids',
				ip: '68.43.101.47',
				result: 'failed',
				reason: 'Wrong password',
			},
			{
				id: 'si-2151',
				at: '2026-10-02 07:45',
				who: 'mb',
				method: 'password',
				device: 'win-firefox',
				place: 'cedarrapids',
				ip: '68.43.101.47',
				result: 'failed',
				reason: 'Wrong password',
			},
			{
				id: 'si-2150',
				at: '2026-10-02 07:44',
				who: 'mb',
				method: 'password',
				device: 'win-firefox',
				place: 'cedarrapids',
				ip: '68.43.101.47',
				result: 'failed',
				reason: 'Wrong password',
			},
			{
				id: 'si-2149',
				at: '2026-10-02 07:43',
				who: 'mb',
				method: 'password',
				device: 'win-firefox',
				place: 'cedarrapids',
				ip: '68.43.101.47',
				result: 'failed',
				reason: 'Wrong password',
			},
			{
				id: 'si-2148',
				at: '2026-10-02 07:42',
				who: 'mb',
				method: 'password',
				device: 'win-firefox',
				place: 'cedarrapids',
				ip: '68.43.101.47',
				result: 'failed',
				reason: 'Wrong password',
			},
			{
				id: 'si-2144',
				at: '2026-10-02 07:20',
				who: 'ln',
				method: 'okta',
				device: 'mac-chrome',
				place: 'toledo',
				ip: '75.186.150.22',
				result: 'success',
				session: { state: 'out', last: '2026-10-02 10:55' },
			},
			{
				id: 'si-2140',
				at: '2026-10-02 06:55',
				who: 'km',
				method: 'google',
				device: 'mac-safari',
				place: 'grandrapids',
				ip: '73.94.33.118',
				result: 'success',
				session: { state: 'out', last: '2026-10-02 09:30' },
			},
			{
				id: 'si-2136',
				at: '2026-10-02 05:32',
				who: 'cr',
				method: 'okta',
				device: 'win-chrome',
				place: 'durham',
				ip: '174.99.12.90',
				result: 'success',
				session: { state: 'expired', last: '2026-10-02 09:32' },
			},
			{
				id: 'si-2135',
				at: '2026-10-02 05:30',
				who: 'cr',
				method: 'okta',
				device: 'win-chrome',
				place: 'durham',
				ip: '174.99.12.90',
				result: 'failed',
				reason: 'Okta turned down the password',
			},

			{
				id: 'si-2121',
				at: '2026-10-01 22:31',
				who: 'ms',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'blocked',
				reason: 'Address is on the block list',
			},
			{
				id: 'si-2120',
				at: '2026-10-01 22:30',
				who: 'km',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'blocked',
				reason: 'Address is on the block list',
			},
			{
				id: 'si-2119',
				at: '2026-10-01 22:28',
				who: 'wt',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2118',
				at: '2026-10-01 22:27',
				who: 'cr',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2117',
				at: '2026-10-01 22:26',
				who: 'ab',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2116',
				at: '2026-10-01 22:25',
				who: 'pr',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2115',
				at: '2026-10-01 22:24',
				who: 'ms',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2114',
				at: '2026-10-01 22:22',
				who: 'km',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2113',
				at: '2026-10-01 22:20',
				who: 'wt',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2112',
				at: '2026-10-01 22:18',
				who: 'cr',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2111',
				at: '2026-10-01 22:16',
				who: 'ab',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2110',
				at: '2026-10-01 22:14',
				who: 'pr',
				method: 'plain',
				device: 'script',
				place: 'grandforks',
				ip: '24.252.87.12',
				result: 'failed',
				reason: 'Password sign-in is off for this person',
			},
			{
				id: 'si-2104',
				at: '2026-10-01 17:05',
				who: 'ms',
				method: 'google',
				device: 'android-chrome',
				place: 'lexington',
				ip: '174.48.77.150',
				result: 'success',
				session: { state: 'out', last: '2026-10-01 18:40' },
			},
			{
				id: 'si-2101',
				at: '2026-10-01 16:40',
				who: 'md',
				method: 'google',
				device: 'mac-chrome',
				place: 'austin',
				ip: '70.112.9.63',
				result: 'success',
				session: { state: 'expired', last: '2026-10-01 20:40' },
			},
			{
				id: 'si-2098',
				at: '2026-10-01 14:22',
				who: 'ja',
				method: 'password',
				device: 'iphone-safari',
				place: 'denver',
				ip: '174.51.92.40',
				result: 'success',
				session: { state: 'active', last: '2026-10-02 07:05' },
			},
			{
				id: 'si-2093',
				at: '2026-10-01 13:10',
				who: 'th',
				method: 'google',
				device: 'linux-firefox',
				place: 'mexico',
				ip: '76.29.66.14',
				result: 'success',
				session: { state: 'out', last: '2026-10-01 19:02' },
			},
			{
				id: 'si-2090',
				at: '2026-10-01 09:15',
				who: 'pr',
				method: 'okta',
				device: 'win-edge',
				place: 'trenton',
				ip: '24.46.18.40',
				result: 'success',
				session: { state: 'out', last: '2026-10-01 17:30' },
			},
			{
				id: 'si-2087',
				at: '2026-10-01 08:02',
				who: 'hs',
				method: 'okta',
				device: 'mac-safari',
				place: 'sedona',
				ip: '69.146.31.208',
				result: 'success',
				session: { state: 'out', last: '2026-10-01 10:12' },
			},
			{
				id: 'si-2084',
				at: '2026-10-01 06:45',
				who: 'ab',
				method: 'okta',
				device: 'win-chrome',
				place: 'decatur',
				ip: '64.89.44.130',
				result: 'success',
				session: { state: 'out', last: '2026-10-01 15:05' },
			},
			{
				id: 'si-2083',
				at: '2026-10-01 06:44',
				who: 'ab',
				method: 'okta',
				device: 'win-chrome',
				place: 'decatur',
				ip: '64.89.44.130',
				result: 'failed',
				reason: 'Wrong Okta Verify code',
			},

			{
				id: 'si-2071',
				at: '2026-09-30 19:20',
				who: 'mb',
				method: 'google',
				device: 'iphone-safari',
				place: 'chicago',
				ip: '172.58.20.14',
				result: 'success',
				session: { state: 'active', last: '2026-10-01 21:40' },
			},
			{
				id: 'si-2066',
				at: '2026-09-30 15:02',
				who: 'dp',
				method: 'google',
				device: 'mac-chrome',
				place: 'seattle',
				ip: '50.47.210.3',
				result: 'success',
				session: { state: 'out', last: '2026-09-30 18:10' },
			},
			{
				id: 'si-2060',
				at: '2026-09-30 11:30',
				who: 'nl',
				method: 'password',
				device: 'win-chrome',
				place: 'stcloud',
				ip: '50.81.70.14',
				result: 'success',
				session: { state: 'out', last: '2026-09-30 16:45' },
			},
			{
				id: 'si-2047',
				at: '2026-09-29 10:15',
				who: 'wt',
				method: 'okta',
				device: 'android-chrome',
				place: 'flagstaff',
				ip: '68.2.41.77',
				result: 'success',
				session: { state: 'out', last: '2026-09-29 11:40' },
			},
			{
				id: 'si-2041',
				at: '2026-09-29 08:50',
				who: 'ln',
				method: 'okta',
				device: 'mac-chrome',
				place: 'toledo',
				ip: '75.186.150.22',
				result: 'success',
				session: { state: 'out', last: '2026-09-29 12:20' },
			},
			{
				id: 'si-2031',
				at: '2026-09-28 12:41',
				who: 'km',
				method: 'google',
				device: 'mac-safari',
				place: 'grandrapids',
				ip: '73.94.33.118',
				result: 'success',
				session: { state: 'out', last: '2026-09-28 17:00' },
			},
			{
				id: 'si-2030',
				at: '2026-09-28 12:40',
				who: 'km',
				method: 'google',
				device: 'mac-safari',
				place: 'grandrapids',
				ip: '73.94.33.118',
				result: 'failed',
				reason: 'Picked a Google account outside Fieldline',
			},
			{
				id: 'si-2024',
				at: '2026-09-28 09:05',
				who: 'cr',
				method: 'okta',
				device: 'win-chrome',
				place: 'durham',
				ip: '174.99.12.90',
				result: 'success',
				session: { state: 'out', last: '2026-09-28 16:20' },
			},
			{
				id: 'si-2009',
				at: '2026-09-26 14:12',
				who: 'th',
				method: 'google',
				device: 'linux-firefox',
				place: 'mexico',
				ip: '76.29.66.14',
				result: 'success',
				session: { state: 'out', last: '2026-09-26 15:00' },
			},

			{
				id: 'si-1962',
				at: '2026-09-24 16:30',
				who: 'md',
				method: 'google',
				device: 'mac-chrome',
				place: 'austin',
				ip: '70.112.9.63',
				result: 'success',
				session: { state: 'out', last: '2026-09-24 18:05' },
			},
			{
				id: 'si-1940',
				at: '2026-09-22 07:55',
				who: 'hs',
				method: 'okta',
				device: 'mac-safari',
				place: 'sedona',
				ip: '69.146.31.208',
				result: 'success',
				session: { state: 'out', last: '2026-09-22 09:30' },
			},
			{
				id: 'si-1911',
				at: '2026-09-18 10:10',
				who: 'ab',
				method: 'okta',
				device: 'win-chrome',
				place: 'decatur',
				ip: '64.89.44.130',
				result: 'success',
				session: { state: 'out', last: '2026-09-18 17:45' },
			},
			{
				id: 'si-1890',
				at: '2026-09-16 13:45',
				who: 'ms',
				method: 'google',
				device: 'android-chrome',
				place: 'lexington',
				ip: '174.48.77.150',
				result: 'failed',
				reason: 'Picked a Google account outside Fieldline',
			},
			{
				id: 'si-1872',
				at: '2026-09-14 09:20',
				who: 'pr',
				method: 'okta',
				device: 'win-edge',
				place: 'trenton',
				ip: '24.46.18.40',
				result: 'success',
				session: { state: 'out', last: '2026-09-14 17:10' },
			},
			{
				id: 'si-1851',
				at: '2026-09-10 18:04',
				who: 'nl',
				method: 'password',
				device: 'win-chrome',
				place: 'stcloud',
				ip: '50.81.70.14',
				result: 'success',
				session: { state: 'expired', last: '2026-09-10 22:04' },
			},
			{
				id: 'si-1850',
				at: '2026-09-10 18:02',
				who: 'nl',
				method: 'password',
				device: 'win-chrome',
				place: 'stcloud',
				ip: '50.81.70.14',
				result: 'challenged',
				reason: "The 2FA code wasn't entered in time",
			},
			{
				id: 'si-1833',
				at: '2026-09-08 08:40',
				who: 'dp',
				method: 'google',
				device: 'mac-chrome',
				place: 'seattle',
				ip: '50.47.210.3',
				result: 'success',
				session: { state: 'out', last: '2026-09-08 12:15' },
			},
			{
				id: 'si-1815',
				at: '2026-09-04 11:00',
				who: 'ja',
				method: 'password',
				device: 'mac-chrome',
				place: 'denver',
				ip: '73.14.208.91',
				result: 'success',
				session: { state: 'out', last: '2026-09-04 17:20' },
			},

			/* Past the 30-day mark the list stops, but the chart still needs a
         previous month to measure this one against, so these stay. */
			{
				id: 'si-1806',
				at: '2026-09-02 09:12',
				who: 'pr',
				method: 'okta',
				device: 'win-edge',
				place: 'trenton',
				ip: '24.46.18.40',
				result: 'success',
				session: { state: 'out', last: '2026-09-02 17:05' },
			},
			{
				id: 'si-1798',
				at: '2026-09-01 15:40',
				who: 'md',
				method: 'google',
				device: 'mac-chrome',
				place: 'austin',
				ip: '70.112.9.63',
				result: 'success',
				session: { state: 'out', last: '2026-09-01 18:30' },
			},
			{
				id: 'si-1790',
				at: '2026-08-31 10:05',
				who: 'ab',
				method: 'okta',
				device: 'win-chrome',
				place: 'decatur',
				ip: '64.89.44.130',
				result: 'success',
				session: { state: 'out', last: '2026-08-31 16:50' },
			},
			{
				id: 'si-1789',
				at: '2026-08-31 10:04',
				who: 'ab',
				method: 'okta',
				device: 'win-chrome',
				place: 'decatur',
				ip: '64.89.44.130',
				result: 'failed',
				reason: 'Wrong Okta Verify code',
			},
			{
				id: 'si-1771',
				at: '2026-08-28 08:30',
				who: 'hs',
				method: 'okta',
				device: 'mac-safari',
				place: 'sedona',
				ip: '69.146.31.208',
				result: 'success',
				session: { state: 'out', last: '2026-08-28 10:15' },
			},
			{
				id: 'si-1760',
				at: '2026-08-26 13:20',
				who: 'th',
				method: 'google',
				device: 'linux-firefox',
				place: 'mexico',
				ip: '76.29.66.14',
				result: 'success',
				session: { state: 'out', last: '2026-08-26 18:40' },
			},
			{
				id: 'si-1744',
				at: '2026-08-24 09:45',
				who: 'nl',
				method: 'password',
				device: 'win-chrome',
				place: 'stcloud',
				ip: '50.81.70.14',
				result: 'success',
				session: { state: 'out', last: '2026-08-24 15:10' },
			},
			{
				id: 'si-1731',
				at: '2026-08-21 11:10',
				who: 'dp',
				method: 'google',
				device: 'mac-chrome',
				place: 'seattle',
				ip: '50.47.210.3',
				result: 'success',
				session: { state: 'out', last: '2026-08-21 16:25' },
			},
			{
				id: 'si-1718',
				at: '2026-08-19 08:55',
				who: 'ja',
				method: 'password',
				device: 'mac-chrome',
				place: 'denver',
				ip: '73.14.208.91',
				result: 'success',
				session: { state: 'out', last: '2026-08-19 17:45' },
			},
			{
				id: 'si-1702',
				at: '2026-08-17 14:30',
				who: 'ms',
				method: 'google',
				device: 'android-chrome',
				place: 'lexington',
				ip: '174.48.77.150',
				result: 'success',
				session: { state: 'out', last: '2026-08-17 15:20' },
			},
			{
				id: 'si-1695',
				at: '2026-08-14 09:00',
				who: 'cr',
				method: 'okta',
				device: 'win-chrome',
				place: 'durham',
				ip: '174.99.12.90',
				result: 'success',
				session: { state: 'out', last: '2026-08-14 16:35' },
			},
			{
				id: 'si-1681',
				at: '2026-08-12 16:15',
				who: 'km',
				method: 'google',
				device: 'mac-safari',
				place: 'grandrapids',
				ip: '73.94.33.118',
				result: 'success',
				session: { state: 'out', last: '2026-08-12 18:00' },
			},
			{
				id: 'si-1670',
				at: '2026-08-10 10:40',
				who: 'wt',
				method: 'okta',
				device: 'android-chrome',
				place: 'flagstaff',
				ip: '68.2.41.77',
				result: 'success',
				session: { state: 'out', last: '2026-08-10 12:10' },
			},
			{
				id: 'si-1664',
				at: '2026-08-07 12:05',
				who: 'ln',
				method: 'okta',
				device: 'mac-chrome',
				place: 'toledo',
				ip: '75.186.150.22',
				result: 'success',
				session: { state: 'out', last: '2026-08-07 17:30' },
			},
			{
				id: 'si-1650',
				at: '2026-08-05 09:30',
				who: 'mb',
				method: 'google',
				device: 'mac-chrome',
				place: 'chicago',
				ip: '73.45.120.9',
				result: 'success',
				session: { state: 'out', last: '2026-08-05 13:40' },
			},
		],

		/* Patterns the backend raised. kind is burst (one person, many misses),
       travel (two places impossibly close in time), challenge (2FA prompts
       left unanswered) or spray (one address working through many people).
       action is the single fix on offer, or null:
         { type: 'block' }               blocks alert.ip
         { type: 'signout', session }    ends that session
         { type: 'reset', who }          forces a new password on that person */
		alerts: [
			{
				id: 'al-31',
				kind: 'travel',
				at: '2026-10-02 09:02',
				ip: '97.104.140.36',
				title: 'Hope Stout signed in from Sarasota, 52 minutes after Missoula',
				text: "Nobody travels that far that fast, and it was a Windows laptop she hasn't used before. That session is still open.",
				action: {
					type: 'signout',
					session: 'si-2166',
					label: 'Sign out that session',
					done: "Hope's Sarasota session was signed out.",
				},
			},
			{
				id: 'al-30',
				kind: 'burst',
				at: '2026-10-02 07:48',
				ip: '68.43.101.47',
				title: '7 wrong passwords for Quentin Cook in 6 minutes',
				text: 'From Kalamazoo, MI, between 7:42 am and 7:48 am. Quentin signs in with Google, so nobody should be typing his password. His account was paused after the fifth try.',
				action: { type: 'block', label: 'Block this address', done: '68.43.101.47 is blocked.' },
			},
			{
				id: 'al-32',
				kind: 'challenge',
				at: '2026-10-02 10:44',
				ip: '71.33.12.201',
				title: 'Three 2FA prompts for Shelby Leach went unanswered',
				text: 'From Aberdeen, SD, between 10:31 am and 10:44 am. The password was right each time, so someone else may know it.',
				action: {
					type: 'reset',
					who: 'nl',
					label: 'Make Shelby pick a new password',
					done: "Shelby has to pick a new password at her next sign-in. She's been emailed.",
				},
			},
			{
				id: 'al-29',
				kind: 'spray',
				at: '2026-10-01 22:31',
				ip: '24.252.87.12',
				title: '12 tries on 6 accounts from one address',
				text: 'Lincoln, NE, last night between 10:14 pm and 10:31 pm. Password sign-in is off for all six people, so nobody got in. The address was blocked after the tenth try.',
				action: null,
			},
		],

		/* IP addresses kept away from the sign-in page. */
		blocked: [
			{
				ip: '24.252.87.12',
				place: 'grandforks',
				at: '2026-10-01 22:28',
				by: 'Blocked on its own after 10 failed tries',
			},
		],
	};

	/* Every server call lives here, one method each. The demo answers after a
     short delay; put a fetch() in each body and return what it resolves to. */
	const query = new URLSearchParams(location.search);
	const scenario = query.get('state');
	let loadAttempts = 0;

	const api = {
		/* GET /api/security/sign-ins?days=60 resolves to { signins, alerts, blocked }.
       Thirty days fill the list; the thirty before feed the chart's comparison. */
		load() {
			loadAttempts += 1;
			if (scenario === 'error' && loadAttempts === 1)
				return pause(700).then(() => {
					throw new Error('The server did not answer');
				});
			if (scenario === 'empty') return pause(500, { signins: [], alerts: [], blocked: [] });
			return pause(500, { signins: DEMO.signins, alerts: DEMO.alerts, blocked: DEMO.blocked });
		},
		/* DELETE /api/sessions/:id */
		signOutSession(sessionKey) {
			return reply(350);
		},
		/* DELETE /api/people/:id/sessions, sparing the caller's own session. */
		signOutPerson(personKey, sparedSession) {
			return reply(450);
		},
		/* DELETE /api/sessions?except=:id */
		signOutEveryone(sparedSession) {
			return reply(700);
		},
		/* POST /api/security/blocked with { ip } */
		blockAddress(address) {
			return reply(300);
		},
		/* DELETE /api/security/blocked/:ip */
		unblockAddress(address) {
			return reply(300);
		},
		/* POST /api/security/alerts/:id/resolve with { how }: 'checked', 'blocked', 'signed-out' or 'reset'. */
		resolveAlert(alertKey, outcome) {
			return reply(250);
		},
		/* POST /api/security/alerts/:id/reopen */
		reopenAlert(alertKey) {
			return reply(250);
		},
		/* POST /api/people/:id/require-password-reset */
		requirePasswordReset(personKey) {
			return reply(400);
		},
		/* GET /api/security/sign-ins.csv with the current filters resolves to CSV text. */
		exportCsv(entries) {
			return reply(900, csvText(entries));
		},
	};

	/* Calendar names and the frozen clock every relative time is measured from. */
	const CLOCK = readStamp(DEMO.now);
	const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Alert kinds pick their glyph and severity from one table. */
	const ALERT_LOOK = {
		burst: { icon: 'bi-exclamation-octagon', tone: 'danger' },
		travel: { icon: 'bi-geo-alt', tone: 'danger' },
		challenge: { icon: 'bi-shield-exclamation', tone: 'warning' },
		spray: { icon: 'bi-bullseye', tone: 'warning' },
	};
	const ALERT_FALLBACK = { icon: 'bi-exclamation-triangle', tone: 'warning' };

	/* The six table columns, left to right, with the ghost width each shows while loading. */
	const TABLE_COLUMNS = [
		{ key: 'who', ghost: null },
		{ key: 'when', ghost: 2 },
		{ key: 'method', ghost: 1 },
		{ key: 'device', ghost: 0 },
		{ key: 'where', ghost: 1 },
		{ key: 'result', ghost: 2 },
	];

	/* Chart settings. Region tones sit far apart on the ramp so adjacent bands stay distinct. */
	const CHART_FONT = "'Schibsted Grotesk', sans-serif";
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const OUTCOMES = ['success', 'challenged', 'failed', 'blocked'];
	const OUTCOME_TOKENS = {
		success: '--basalt-success',
		challenged: '--basalt-info',
		failed: '--basalt-warning',
		blocked: '--basalt-danger',
	};
	const REGION_TONES = [1, 3, 4, 8];

	/* Loaded records, the view the visitor picked, and the rows that survive it. */
	const records = { signins: [], alerts: [], blocked: [] };
	const view = {
		loading: true,
		error: false,
		result: '',
		period: 7,
		method: '',
		q: '',
		ip: '',
		who: '',
		state: '',
	};
	let shown = [];

	const ui = {
		figures: {
			today: pick('[data-lh-fig="today"]', host),
			refused: pick('[data-lh-fig="refused"]', host),
			active: pick('[data-lh-fig="active"]', host),
		},
		exportButton: pick('[data-lh-export]', host),
		alerts: pick('[data-lh-alerts]', host),
		alertBadge: pick('[data-lh-alert-count]', host),
		alertsHeading: pick('#lh-alerts-title', host),
		blockedBox: pick('[data-lh-blocked-wrap]', host),
		blockedList: pick('[data-lh-blocked]', host),
		outcomeTabs: pickAll('input[name="lh-result"]', host),
		tabCounts: pickAll('[data-lh-count]', host),
		search: pick('[data-lh-search]', host),
		methodMenu: pick('[data-lh-method]', host),
		periodTabs: pickAll('input[name="lh-period"]', host),
		chips: pick('[data-lh-applied]', host),
		summary: pick('[data-lh-summary]', host),
		table: pick('[data-lh-table]', host),
		tbody: pick('[data-lh-body]', host),
		pager: pick('[data-lh-pager]', host),
		sessions: pick('[data-lh-sessions]', host),
		sessionsHeading: pick('#lh-sessions-title', host),
		everyoneButton: pick('[data-lh-everyone]', host),
		places: pick('[data-lh-places]', host),
		placesLead: pick('[data-lh-places-desc]', host),
		drawer: pick('#lh-record', host),
		personDialog: pick('#lh-person-out', host),
		everyoneDialog: pick('#lh-everyone', host),
	};

	const chartParts = {
		trend: {
			canvas: pick('[data-lh-chart="trend"]', host),
			frame: pick('[data-lh-chart-box="trend"]', host),
			message: pick('[data-lh-chart-state="trend"]', host),
			lead: pick('[data-lh-trend-desc]', host),
			headline: pick('[data-lh-trend-total]', host),
			key: pick('[data-lh-trend-legend]', host),
			caption: pick('[data-lh-trend-note]', host),
		},
		methods: {
			canvas: pick('[data-lh-chart="methods"]', host),
			frame: pick('[data-lh-chart-box="methods"]', host),
			message: pick('[data-lh-chart-state="methods"]', host),
			lead: pick('[data-lh-methods-desc]', host),
			key: pick('[data-lh-methods-legend]', host),
			caption: pick('[data-lh-methods-note]', host),
		},
	};
	const CHART_RECIPES = { trend: trendSetup, methods: methodSetup };
	const charts = new Map();
	const revealed = new Set();

	/* Basalt.pager keeps this object and rereads total, so it is mutated, never replaced. */
	const pagerSettings = { total: 0, perPage: 10, noun: 'sign-ins', render: paintRows };
	let pagerControl = null;

	/* Drawer and dialog bookkeeping. recordNav expects a number; this one
     reports the live length of the filtered list each time it is read. */
	const followCount = { valueOf: () => Math.max(1, shown.length) };
	let stepper = null;
	let openId = null;
	let drawerShown = false;
	let pendingPerson = null;
	let pendingTrigger = null;
	let typingPause = 0;

	/* The donut's center reads its total in the card's own text colors. */
	const ringTotal = {
		id: 'lhRingTotal',
		afterDraw(chart, args, settings) {
			const area = chart.chartArea;
			if (!settings || !area) return;
			const pen = chart.ctx;
			const midX = (area.left + area.right) / 2;
			const midY = (area.top + area.bottom) / 2;
			pen.save();
			pen.textAlign = 'center';
			pen.textBaseline = 'alphabetic';
			pen.fillStyle = settings.text;
			pen.font = `700 26px ${CHART_FONT}`;
			pen.fillText(String(settings.total), midX, midY + 4);
			pen.fillStyle = settings.quiet;
			pen.font = `500 12px ${CHART_FONT}`;
			pen.fillText(settings.total === 1 ? 'sign-in' : 'sign-ins', midX, midY + 22);
			pen.restore();
		},
	};

	/* Pass the clicked element to the first route whose selector it sits in.
     A route that returns false lets the click fall through to the next one. */
	const CLICK_ROUTES = [
		['[data-lh-reload]', () => fetchAll()],
		[
			'[data-lh-clear]',
			() => {
				resetFilters();
				repaint(true);
				ui.search.focus();
			},
		],
		['[data-lh-open]', (hit) => showRecord(hit.getAttribute('data-lh-open'))],
		[
			'.lh-row[data-id]',
			(hit, target) => {
				if (target.closest('button, a')) return false;
				showRecord(hit.getAttribute('data-id'));
			},
		],
		['[data-lh-signout]', (hit) => quietly(endOneSession(hit.getAttribute('data-lh-signout'), true))],
		['[data-lh-person-out]', (hit) => askPersonOut(hit.getAttribute('data-lh-person-out'), hit)],
		['[data-lh-country]', (hit) => toggleState(hit.getAttribute('data-lh-country'))],
		['[data-lh-alert-act]', (hit) => withAlert(hit.getAttribute('data-lh-alert-act'), applyAlertFix)],
		[
			'[data-lh-alert-check]',
			(hit) =>
				withAlert(hit.getAttribute('data-lh-alert-check'), (alert) =>
					settleAlert(alert, 'checked', 'Marked as checked'),
				),
		],
		['[data-lh-alert-show]', (hit) => withAlert(hit.getAttribute('data-lh-alert-show'), focusAlertSignins)],
		[
			'[data-lh-unblock]',
			(hit) => {
				unblockIp(hit.getAttribute('data-lh-unblock'));
				ui.alertsHeading.focus();
			},
		],
	];

	start();

	/** Wires every control once, then asks for the data. */
	function start() {
		fillMethodMenu();
		watchCharts();
		document.addEventListener('basalt:appearance', () => {
			/* The palette swaps with the attribute, so read tokens on the next frame. */
			requestAnimationFrame(() => {
				for (const name of charts.keys()) mountChart(name, true);
			});
		});
		bindDrawer();
		bindPersonDialog();
		bindEveryoneDialog();
		ui.exportButton.addEventListener('click', exportShown);
		bindFilters();
		host.addEventListener('click', routeClick);
		fetchAll();
	}

	function routeClick(event) {
		const target = event.target;
		for (const [selector, action] of CLICK_ROUTES) {
			const hit = target.closest(selector);
			if (hit && action(hit, target) !== false) return;
		}
	}

	/* A load fills every panel; a filter change redraws only the panels it feeds. */

	function fetchAll() {
		view.loading = true;
		view.error = false;
		paintAll();
		api.load()
			.then((payload) => {
				records.signins = payload.signins.map((entry) => ({
					...entry,
					...(entry.session ? { session: { ...entry.session } } : {}),
				}));
				records.alerts = payload.alerts.map((alert) => ({ ...alert }));
				records.blocked = payload.blocked.map((block) => ({ ...block }));
				view.loading = false;
				paintAll();
				say(`${quantity(records.signins.filter(withinWindow).length, 'sign-in')} loaded.`);
			})
			.catch(() => {
				view.loading = false;
				view.error = true;
				paintAll();
			});
	}

	/** Redraws every panel and puts focus back on the control that had it. */
	function paintAll() {
		const focusedKey = rememberFocus();
		paintFigures();
		paintCharts();
		paintAlerts();
		paintLog();
		paintChips();
		paintSessions();
		paintPlaces();
		keepDrawerInSync();
		if (focusedKey) returnFocus(focusedKey);
	}

	/**
	 * Redraws only what the filters feed.
	 * @param {boolean} [rewind] jump back to page one first, as any new filter should
	 */
	function repaint(rewind) {
		if (rewind && pagerControl && pagerControl.get() !== 1) pagerControl.set(1);
		paintLog();
		paintChips();
		paintCharts();
		paintPlaces();
	}

	/* Controls carry data-lh-key so focus can find its way back after innerHTML is replaced. */
	function rememberFocus() {
		const focused = document.activeElement;
		return focused && host.contains(focused) && focused.dataset ? focused.dataset.lhKey || null : null;
	}

	function returnFocus(key, fallback) {
		const match = key && pick(`[data-lh-key="${key}"]`, host);
		if (match) match.focus();
		else if (fallback) fallback.focus();
	}

	/* The tabs, menu and search box write into view and ask for a redraw. */

	function bindFilters() {
		for (const tab of ui.outcomeTabs) {
			tab.addEventListener('change', () => {
				if (!tab.checked) return;
				view.result = tab.value;
				repaint(true);
			});
		}
		for (const tab of ui.periodTabs) {
			tab.addEventListener('change', () => {
				if (!tab.checked) return;
				const days = parseInt(tab.value, 10);
				if (days === view.period && !view.loading) return;
				view.period = days;
				repaint(true);
			});
		}
		ui.methodMenu.addEventListener('change', () => {
			view.method = ui.methodMenu.value;
			repaint(true);
		});
		ui.search.addEventListener('input', () => {
			clearTimeout(typingPause);
			typingPause = setTimeout(() => {
				view.q = ui.search.value.trim();
				repaint(true);
			}, 150);
		});
	}

	/* The method menu takes its options from DEMO.methods. */
	function fillMethodMenu() {
		for (const [key, method] of Object.entries(DEMO.methods)) {
			const option = document.createElement('option');
			option.value = key;
			option.textContent = method.label;
			option.setAttribute('data-icon', method.icon);
			ui.methodMenu.appendChild(option);
		}
		if (window.Basalt.select?.refresh) window.Basalt.select.refresh(ui.methodMenu);
	}

	/* Drops every filter and puts the controls back to match; the period stays. */
	function resetFilters() {
		Object.assign(view, { result: '', q: '', method: '', ip: '', who: '', state: '' });
		ui.search.value = '';
		ui.methodMenu.value = '';
		ui.outcomeTabs[0].checked = true;
	}

	function choosePeriod(days) {
		view.period = days;
		for (const tab of ui.periodTabs) {
			tab.checked = parseInt(tab.value, 10) === days;
			tab.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}

	function toggleState(state) {
		view.state = view.state === state ? '' : state;
		repaint(true);
		returnFocus(`state-${state}`);
		say(view.state ? `Showing ${quantity(shown.length, 'sign-in')} from ${state}.` : 'Showing every state.');
	}

	function withinWindow(signin) {
		return dayGap(readStamp(signin.at)) < view.period;
	}

	/**
	 * Whether a sign-in survives the period and the filters.
	 * @param {boolean} [ignoreOutcome] leave the result tab out, for counts that show every result
	 * @param {boolean} [ignoreMethod] leave the method menu out, for the donut
	 */
	function fitsView(signin, ignoreOutcome, ignoreMethod) {
		return withinWindow(signin) && fitsFilters(signin, ignoreOutcome, ignoreMethod);
	}

	/* The same test with the period left out. */
	function fitsFilters(signin, ignoreOutcome, ignoreMethod) {
		const checks = [
			() => ignoreOutcome || !view.result || signin.result === view.result,
			() => ignoreMethod || !view.method || signin.method === view.method,
			() => !view.ip || signin.ip === view.ip,
			() => !view.who || signin.who === view.who,
			() => !view.state || locate(signin.place).state === view.state,
			() => !view.q || matchesSearch(signin),
		];
		return checks.every((check) => check());
	}

	/* Every word typed must appear in the name, email, address, city or state. */
	function matchesSearch(signin) {
		const owner = ownerOf(signin);
		const spot = locate(signin.place);
		const haystack = `${owner.name} ${owner.email} ${signin.ip} ${spot.city} ${spot.state}`.toLowerCase();
		return view.q
			.toLowerCase()
			.split(/\s+/)
			.every((word) => haystack.includes(word));
	}

	/* The three header figures count today's sign-ins, refusals and open sessions. */

	function paintFigures() {
		const blank = view.loading || view.error;
		const todays = records.signins.filter((entry) => dayGap(readStamp(entry.at)) === 0);
		const figures = {
			today: todays.length,
			refused: todays.filter((entry) => entry.result === 'failed' || entry.result === 'blocked').length,
			active: records.signins.filter(stillOpen).length,
		};
		for (const [name, value] of Object.entries(figures)) {
			ui.figures[name].textContent = blank ? '0' : String(value);
		}
	}

	/* Flagged patterns wait in Needs a look until someone acts on them or marks them checked. */

	function pendingAlerts() {
		return records.alerts.filter((alert) => !alert.resolved);
	}

	function newestFirst(list) {
		return list.sort((left, right) => readStamp(right.at) - readStamp(left.at));
	}

	function paintAlerts() {
		ui.alerts.setAttribute('aria-busy', String(view.loading));
		if (view.loading) {
			ui.alerts.innerHTML = placeholderRows(3);
			ui.alertBadge.textContent = 'Loading';
			return;
		}
		if (view.error) {
			ui.alerts.innerHTML = failureMarkup('Alerts');
			ui.alertBadge.hidden = true;
			ui.blockedBox.hidden = true;
			return;
		}
		const pending = newestFirst(pendingAlerts());
		const anyPending = pending.length > 0;
		ui.alertBadge.hidden = false;
		ui.alertBadge.className = `basalt-status basalt-status-dot basalt-status-${anyPending ? 'danger' : 'success'}`;
		ui.alertBadge.textContent = anyPending ? `${pending.length} to check` : 'All clear';
		ui.alerts.innerHTML = anyPending
			? `<ul class="lh-alerts">${pending.map(alertMarkup).join('')}</ul>`
			: messageMarkup({
					tone: 'success',
					icon: 'bi-shield-check',
					title: 'Nothing needs a look',
					text: 'Bursts of failed tries and unusual sign-ins will show up here.',
				});

		ui.blockedBox.hidden = !records.blocked.length;
		ui.blockedList.innerHTML = records.blocked.map(blockedMarkup).join('');
	}

	function alertMarkup(alert) {
		const look = ALERT_LOOK[alert.kind] || ALERT_FALLBACK;
		const fix = alert.action
			? `<button type="button" data-lh-key="act-${alert.id}" class="btn btn-sm btn-primary" data-lh-alert-act="${alert.id}">${htmlSafe(alert.action.label)}</button>`
			: '';
		const meta =
			`<p class="lh-alert-meta"><time datetime="${isoAttr(alert.at)}">${htmlSafe(stamp(readStamp(alert.at)))}</time>` +
			`<button type="button" data-lh-key="show-${alert.id}" class="lh-link" data-lh-alert-show="${alert.id}">Show these sign-ins</button></p>`;
		const body = `<div class="lh-alert-body"><p class="lh-alert-title">${htmlSafe(alert.title)}</p><p class="lh-alert-text">${htmlSafe(alert.text)}</p>${meta}</div>`;
		const actions = `<div class="lh-alert-actions">${fix}<button type="button" data-lh-key="check-${alert.id}" class="btn btn-sm btn-outline-secondary" data-lh-alert-check="${alert.id}">Mark as checked</button></div>`;
		return `<li data-alert="${alert.id}" class="lh-alert"><span aria-hidden="true" class="lh-alert-icon lh-tone-${look.tone}"><i class="bi ${look.icon}"></i></span>${body}${actions}</li>`;
	}

	function blockedMarkup(block) {
		const address = htmlSafe(block.ip);
		return (
			`<li class="lh-blocked-item"><code class="lh-code">${address}</code>` +
			`<span class="lh-blocked-meta">${htmlSafe(placeName(block.place))}. ${htmlSafe(block.by)}, ${htmlSafe(stampInSentence(readStamp(block.at)))}.</span>` +
			`<button type="button" aria-label="Unblock ${address}" data-lh-key="unblock-${address}" data-lh-unblock="${address}" class="btn btn-sm btn-outline-secondary">Unblock</button></li>`
		);
	}

	/* Calls the given handler with the alert whose id was clicked, when it still exists. */
	function withAlert(alertKey, handler) {
		const alert = records.alerts.find((candidate) => candidate.id === alertKey);
		if (alert) handler(alert);
	}

	function applyAlertFix(alert) {
		const fix = alert.action;
		if (!fix) return;
		const fixes = {
			block() {
				quietly(blockIp(alert.ip, { quiet: true }));
				settleAlert(alert, 'blocked', fix.done);
			},
			signout() {
				const target = findSignin(fix.session);
				if (target && stillOpen(target)) {
					closeSessions([target], () => api.signOutSession(target.id)).then(
						() => {},
						() => {
							alert.resolved = null;
							paintAll();
						},
					);
				}
				settleAlert(alert, 'signed-out', fix.done);
			},
			reset() {
				settleAlert(alert, 'reset', fix.done);
				api.requirePasswordReset(fix.who).catch(() => {
					alert.resolved = null;
					paintAll();
					reportFailure("Shelby wasn't asked to pick a new password.");
				});
			},
		};
		fixes[fix.type]?.();
	}

	/**
	 * Takes an alert off the list at once, with an Undo, then tells the server.
	 * @param {string} how what the reviewer did, as the server records it
	 * @param {string} heading the toast title
	 */
	function settleAlert(alert, how, heading) {
		const order = newestFirst(pendingAlerts()).map((candidate) => candidate.id);
		const position = order.indexOf(alert.id);
		const neighbor = order[position + 1] || order[position - 1];
		const focusNext = neighbor ? `check-${neighbor}` : null;

		alert.resolved = how;
		paintAll();
		returnFocus(focusNext, ui.alertsHeading);
		notify({
			tone: 'success',
			title: heading,
			text: 'Moved out of Needs a look.',
			actions: [{ label: 'Undo', onClick: () => reopen(alert, how) }],
		});
		return api.resolveAlert(alert.id, how).catch(() => {
			alert.resolved = null;
			paintAll();
			reportFailure('The alert is still open.');
		});
	}

	function reopen(alert, how) {
		alert.resolved = null;
		paintAll();
		api.reopenAlert(alert.id).catch(() => {
			alert.resolved = how;
			paintAll();
			reportFailure('The alert stayed checked.');
		});
	}

	/* Narrows the list to one alert's address and scrolls it into view. */
	function focusAlertSignins(alert) {
		Object.assign(view, { ip: alert.ip, who: '', state: '', result: '', q: '' });
		ui.search.value = '';
		ui.outcomeTabs[0].checked = true;
		if (dayGap(readStamp(alert.at)) >= view.period) choosePeriod(7);
		repaint(true);
		pick('#lh-log', host).scrollIntoView({
			behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
			block: 'start',
		});
		pick('[data-lh-open]', ui.tbody)?.focus({ preventScroll: true });
		say(`Showing ${quantity(shown.length, 'sign-in')} from ${alert.ip}.`);
	}

	/* Blocking and unblocking show at once and roll back if the server refuses. */

	function addressBlocked(address) {
		return records.blocked.some((block) => block.ip === address);
	}

	/**
	 * Blocks an address on screen, then on the server, undoing it on failure.
	 * @param {{quiet?: boolean}} [options] quiet skips the confirmation toast
	 */
	function blockIp(address, options) {
		if (addressBlocked(address)) return Promise.resolve();
		const source = records.signins.find((entry) => entry.ip === address);
		const added = {
			ip: address,
			place: source ? source.place : '',
			at: DEMO.now,
			by: `Blocked by ${DEMO.people[DEMO.me].name}`,
		};
		records.blocked.unshift(added);
		paintAll();
		if (!options?.quiet) {
			notify({
				tone: 'success',
				title: `${address} is blocked`,
				text: 'It can no longer reach the Fieldline sign-in page.',
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							unblockIp(address, { quiet: true });
						},
					},
				],
			});
		}
		return api.blockAddress(address).catch(() => {
			records.blocked = records.blocked.filter((block) => block !== added);
			paintAll();
			reportFailure("The address wasn't blocked.");
			throw new Error('block failed');
		});
	}

	function unblockIp(address, options) {
		const index = records.blocked.findIndex((block) => block.ip === address);
		if (index < 0) return Promise.resolve();
		const [removed] = records.blocked.splice(index, 1);
		paintAll();
		if (options?.quiet) say(`${address} is unblocked.`);
		else
			notify({
				tone: 'info',
				title: `${address} is unblocked`,
				text: 'It can reach the sign-in page again.',
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							blockIp(address, { quiet: true });
						},
					},
				],
			});
		return api.unblockAddress(address).catch(() => {
			records.blocked.splice(index, 0, removed);
			paintAll();
			reportFailure('The address is still blocked.');
		});
	}

	/* The table pages through the filtered sign-ins, newest first, grouped by day. */

	function paintLog() {
		ui.table.setAttribute('aria-busy', String(view.loading));
		if (view.loading) {
			ui.pager.hidden = true;
			ui.tbody.innerHTML = [0, 1, 2, 3, 4, 5].map(ghostRowMarkup).join('');
			ui.summary.textContent = 'Loading sign-ins';
			return;
		}
		if (view.error) {
			ui.pager.hidden = true;
			ui.tbody.innerHTML = fullWidthRow(failureMarkup('Sign-ins'));
			ui.summary.textContent = '';
			return;
		}

		/* Tab counts honor every filter but the result tab itself. */
		const pool = records.signins.filter((entry) => fitsView(entry, true));
		for (const badge of ui.tabCounts) {
			const outcome = badge.getAttribute('data-lh-count');
			badge.textContent = String(outcome ? pool.filter((entry) => entry.result === outcome).length : pool.length);
		}

		shown = newestFirst(records.signins.filter((entry) => fitsView(entry)));
		ui.summary.textContent = summaryText();

		const blankMessage = !records.signins.length
			? messageMarkup({
					tone: 'muted',
					icon: 'bi-door-open',
					title: 'No sign-ins yet',
					text: 'Once people on your team sign in to Fieldline, each sign-in shows up here with its device and place.',
				})
			: !shown.length
				? messageMarkup({
						tone: 'muted',
						icon: 'bi-funnel',
						title: 'No sign-ins match',
						text: view.q
							? `Nothing matches “${view.q}” with these filters.`
							: 'Nothing matches these filters in this period.',
						button: ['Clear filters', 'data-lh-clear'],
					})
				: '';
		if (blankMessage) {
			ui.pager.hidden = true;
			ui.tbody.innerHTML = fullWidthRow(blankMessage);
			return;
		}

		ui.pager.hidden = false;
		pagerSettings.total = shown.length;
		if (pagerControl) {
			redrawCurrentPage();
			return;
		}
		pagerControl = window.Basalt.pager ? window.Basalt.pager(ui.pager, pagerSettings) : null;
		if (!pagerControl) paintRows(1, shown.length);
	}

	function summaryText() {
		const narrowed = view.q || view.method || view.ip || view.who || view.state || view.result;
		const span = view.period === 1 ? ' today' : ` in the last ${view.period} days`;
		const verb = narrowed ? ` match${shown.length === 1 ? 'es' : ''}` : '';
		return `${quantity(shown.length, 'sign-in')}${span}${verb}`;
	}

	/* Basalt.pager repaints only when the page number changes, so the page in view is drawn here. */
	function redrawCurrentPage() {
		const pageSize = parseInt(pick('[data-basalt-pager-size]', ui.pager).value, 10) || 10;
		const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
		const wasOn = pagerControl.get();
		pagerControl.setTotal(pageCount);
		const onPage = Math.min(wasOn, pageCount);
		const first = (onPage - 1) * pageSize + 1;
		const last = Math.min(shown.length, onPage * pageSize);
		const range = pick('[data-basalt-pager-range]', ui.pager);
		if (range) range.innerHTML = `<strong>${first}–${last}</strong> of ${shown.length} sign-ins`;
		paintRows(first, last);
	}

	/** Pager callback: writes rows first..last (1-based), with a heading row per day. */
	function paintRows(first, last) {
		if (view.loading || view.error) return;
		let markup = '';
		let previousHeading = null;
		for (const entry of shown.slice(first - 1, last)) {
			const at = readStamp(entry.at);
			const label = dayName(at);
			if (label !== previousHeading) {
				previousHeading = label;
				const heading = label === 'Today' || label === 'Yesterday' ? `${label}, ${calendarDay(at)}` : label;
				markup += `<tr class="lh-day"><th colspan="6" scope="rowgroup">${htmlSafe(heading)}</th></tr>`;
			}
			markup += rowMarkup(entry);
		}
		ui.tbody.innerHTML = markup;
	}

	function rowMarkup(entry) {
		const owner = ownerOf(entry);
		const hardware = hardwareOf(entry);
		const method = methodInfo(entry);
		const browser = htmlSafe(browserLine(entry));
		const unfamiliar = entry.result === 'success' && isUnfamiliarPlace(entry);
		const cells = {
			who:
				`<span class="lh-who">${avatarMarkup(owner)}<span class="lh-who-text">` +
				`<button type="button" data-lh-open="${entry.id}" class="lh-open">${htmlSafe(owner.name)}</button>` +
				`<span class="lh-sub lh-sub-role">${htmlSafe(owner.job)}</span>` +
				`<span class="lh-sub lh-sub-device">${browser}, ${htmlSafe(method.label)}</span></span></span>`,
			when: `<time datetime="${isoAttr(entry.at)}">${clockTime(readStamp(entry.at))}</time>`,
			method: `<span class="lh-method"><i aria-hidden="true" class="bi ${method.icon}"></i>${htmlSafe(method.label)}</span>`,
			device: `<span class="lh-line">${browser}</span><span class="lh-sub"><i aria-hidden="true" class="bi ${hardware.icon}"></i>${htmlSafe(hardware.name)}</span>`,
			where:
				`<span class="lh-line">${htmlSafe(placeName(entry.place))}${unfamiliar ? ' <span class="lh-new">New place</span>' : ''}</span>` +
				`<span class="lh-sub lh-mono">${htmlSafe(entry.ip)}${addressBlocked(entry.ip) ? ' <span class="lh-flag">blocked</span>' : ''}</span>`,
			result: outcomeCell(entry),
		};
		const tds = TABLE_COLUMNS.map((column) => `<td class="lh-col-${column.key}">${cells[column.key]}</td>`).join(
			'',
		);
		return `<tr data-id="${entry.id}" class="lh-row">${tds}</tr>`;
	}

	function outcomeCell(entry) {
		let markup = outcomePill(entry);
		if (entry.reason) markup += `<span class="lh-sub lh-reason">${htmlSafe(entry.reason)}</span>`;
		if (stillOpen(entry)) {
			const note = isOwnSession(entry) ? 'You, signed in now' : 'Still signed in';
			markup += `<span class="lh-sub lh-live"><span aria-hidden="true" class="lh-live-dot"></span>${note}</span>`;
		}
		return markup;
	}

	function ghostRowMarkup(index) {
		const bar = (width) => `<span class="basalt-skeleton basalt-skeleton-line lh-skel-w${width}"></span>`;
		const tds = TABLE_COLUMNS.map((column) => {
			const inner =
				column.ghost === null
					? `<span class="lh-who"><span class="basalt-skeleton basalt-skeleton-circle"></span>${bar(index % 3)}</span>`
					: bar(column.ghost);
			return `<td class="lh-col-${column.key}">${inner}</td>`;
		}).join('');
		return `<tr aria-hidden="true" class="lh-row lh-row-ghost">${tds}</tr>`;
	}

	function fullWidthRow(inner) {
		return `<tr class="lh-empty-row"><td colspan="6">${inner}</td></tr>`;
	}

	/* Chips for the filters that have no control of their own: person, address and state. */
	function paintChips() {
		const chips = [
			view.who && { label: `Person: ${DEMO.people[view.who].name}`, field: 'who' },
			view.ip && { label: `Address: ${view.ip}`, field: 'ip' },
			view.state && { label: `State: ${view.state}`, field: 'state' },
		]
			.filter(Boolean)
			.map(({ label, field }) => ({
				label,
				remove: () => {
					view[field] = '';
					repaint(true);
				},
			}));
		window.Basalt.drawer?.applied(
			ui.chips,
			chips,
			() => {
				view.who = '';
				view.ip = '';
				view.state = '';
				repaint(true);
			},
			ui.search,
		);
	}

	/* Open sessions are grouped by person so one person can be signed out everywhere. */

	function paintSessions() {
		ui.sessions.setAttribute('aria-busy', String(view.loading));
		if (view.loading || view.error) {
			ui.sessions.innerHTML = view.loading ? placeholderRows(4) : failureMarkup('Sessions');
			ui.everyoneButton.disabled = true;
			return;
		}
		const open = records.signins.filter(stillOpen);
		ui.everyoneButton.disabled = !open.some((entry) => !isOwnSession(entry));
		if (!open.length) {
			ui.sessions.innerHTML = messageMarkup({
				tone: 'muted',
				icon: 'bi-person-check',
				title: 'No open sessions',
				text: 'When people sign in, their sessions show up here until they sign out or the session times out.',
			});
			return;
		}

		/* One group per person, most recently used first, with the viewer pinned to the top. */
		const byPerson = new Map();
		const recentFirst = open
			.slice()
			.sort((left, right) => readStamp(right.session.last) - readStamp(left.session.last));
		for (const entry of recentFirst) {
			if (!byPerson.has(entry.who)) byPerson.set(entry.who, []);
			byPerson.get(entry.who).push(entry);
		}
		const viewerFirst = [...byPerson.keys()].sort((left, right) => {
			if (left === DEMO.me) return -1;
			return right === DEMO.me ? 1 : 0;
		});
		ui.sessions.innerHTML = `<ul class="lh-people">${viewerFirst.map((key) => personGroupMarkup(key, byPerson.get(key))).join('')}</ul>`;
	}

	function personGroupMarkup(key, entries) {
		const owner = DEMO.people[key];
		const viewer = key === DEMO.me;
		const elsewhere = entries.filter((entry) => !isOwnSession(entry)).length;
		const everywhere =
			elsewhere > 1 || (viewer && elsewhere)
				? `<button type="button" data-lh-key="all-${key}" data-lh-person-out="${key}" class="btn btn-sm btn-outline-secondary lh-person-all">${viewer ? 'Sign out my other devices' : 'Sign out everywhere'}</button>`
				: '';
		const heading =
			`<div class="lh-person-head">${avatarMarkup(owner, 'basalt-avatar-sm')}<div class="lh-person-name">` +
			`<p class="mb-0"><strong>${htmlSafe(owner.name)}</strong>${viewer ? ' <span class="lh-you">You</span>' : ''}</p>` +
			`<p class="lh-sub mb-0">${htmlSafe(owner.job)}, ${quantity(entries.length, 'open session')}</p></div>${everywhere}</div>`;
		const items = entries.map((entry) => sessionMarkup(entry, owner)).join('');
		return `<li data-person="${key}" class="lh-person">${heading}<ul class="lh-sessions">${items}</ul></li>`;
	}

	function sessionMarkup(entry, owner) {
		const hardware = hardwareOf(entry);
		const spot = locate(entry.place);
		const away = entry.place !== owner.home;
		const browser = htmlSafe(browserLine(entry));
		const placeClass = away ? 'lh-session-place is-odd' : 'lh-session-place';
		const warning = away ? '<i class="bi bi-exclamation-triangle" aria-hidden="true"></i>' : '';
		const awayNote = away
			? `<span class="visually-hidden"> (not where ${htmlSafe(givenName(owner))} usually signs in)</span>`
			: '';
		const trailing = isOwnSession(entry)
			? '<span class="lh-this">This device</span>'
			: `<button type="button" aria-label="Sign out ${htmlSafe(owner.name)} on ${browser} in ${htmlSafe(spot.city)}" data-lh-key="out-${entry.id}" data-lh-signout="${entry.id}" class="btn btn-sm btn-outline-secondary">Sign out</button>`;
		return (
			`<li data-session="${entry.id}" class="lh-session"><span aria-hidden="true" class="lh-session-icon"><i class="bi ${hardware.icon}"></i></span>` +
			`<div class="lh-session-body"><p class="lh-session-title">` +
			`<button type="button" data-lh-key="open-${entry.id}" data-lh-open="${entry.id}" class="lh-open">${browser}</button>` +
			`<span class="${placeClass}">${warning}${htmlSafe(spot.city)}${awayNote}</span></p>` +
			`<p class="lh-sub mb-0">Signed in ${htmlSafe(stampInSentence(readStamp(entry.at)))}. Last active ${htmlSafe(sinceText(readStamp(entry.session.last)))}.</p></div>` +
			`${trailing}</li>`
		);
	}

	/**
	 * Ends sessions on screen right away, then asks the server.
	 * @param {Function} request returns the server call's promise
	 * @param {Function} [onDone] runs once the server agrees
	 */
	function closeSessions(entries, request, onDone) {
		const snapshots = entries.map((entry) => [entry, { ...entry.session }]);
		for (const entry of entries) {
			entry.session.state = 'out';
			entry.session.last = DEMO.now;
		}
		paintAll();
		return request()
			.then(() => {
				onDone?.();
			})
			.catch(() => {
				for (const [entry, saved] of snapshots) entry.session = saved;
				paintAll();
				reportFailure(entries.length === 1 ? 'The session is still open.' : 'Those sessions are still open.');
				throw new Error('sign-out failed');
			});
	}

	/**
	 * Signs one session out. With moveFocus, focus goes to the neighboring
	 * Sign out button, or the section heading when none is left.
	 */
	function endOneSession(sessionKey, moveFocus) {
		const entry = findSignin(sessionKey);
		if (!entry || !stillOpen(entry) || isOwnSession(entry)) return Promise.resolve();
		const owner = ownerOf(entry);
		const focusNext = neighborSessionKey(sessionKey);
		const viewer = entry.who === DEMO.me;
		const pending = closeSessions(
			[entry],
			() => api.signOutSession(entry.id),
			() => {
				notify({
					tone: 'success',
					title: viewer ? `Your ${hardwareOf(entry).name} is signed out` : `${owner.name} is signed out`,
					text: `${browserLine(entry)} in ${locate(entry.place).city}. ${viewer ? "You'll" : "They'll"} need to sign in again on that device.`,
				});
			},
		);
		if (moveFocus) returnFocus(focusNext, ui.sessionsHeading);
		return pending;
	}

	function neighborSessionKey(sessionKey) {
		const order = pickAll('[data-lh-signout]', ui.sessions).map((button) => button.getAttribute('data-lh-signout'));
		const position = order.indexOf(sessionKey);
		const neighbor = order[position + 1] || order[position - 1];
		return neighbor ? `out-${neighbor}` : null;
	}

	/* Places break the period down by region, then by state. */

	function paintPlaces() {
		ui.places.setAttribute('aria-busy', String(view.loading));
		ui.placesLead.textContent = `${view.period === 1 ? 'Today' : `The last ${view.period} days`}, by region and state. Pick a state to see only its sign-ins.`;
		if (view.loading) {
			ui.places.innerHTML = placeholderRows(4);
			return;
		}
		if (view.error) {
			ui.places.innerHTML = failureMarkup('Places');
			return;
		}
		const inWindow = records.signins.filter(withinWindow);
		if (!inWindow.length) {
			ui.places.innerHTML = messageMarkup({
				tone: 'muted',
				icon: 'bi-globe2',
				title: 'No places yet',
				text: 'Each region your team signs in from will be counted here.',
			});
			return;
		}

		/* A single bar splits sign-ins by region; under it each state, busiest
       first, shows how many were let in and how many were refused. */
		const regions = DEMO.regions
			.map((name, index) => ({
				name,
				tone: REGION_TONES[index % REGION_TONES.length],
				n: inWindow.filter((entry) => locate(entry.place).region === name).length,
			}))
			.filter((region) => region.n);
		const states = stateTally(inWindow);
		const busiest = states[0].n;
		const toneFor = (regionName) => (regions.find((region) => region.name === regionName) || { tone: 1 }).tone;

		const band = `<div class="lh-mix" aria-hidden="true">${regions.map((region) => `<span data-grow="${region.n}" class="lh-mix-seg lh-tone-${region.tone}"></span>`).join('')}</div>`;
		const key = `<ul class="lh-mix-key">${regions.map((region) => `<li><span aria-hidden="true" class="lh-mix-dot lh-tone-${region.tone}"></span>${htmlSafe(region.name)} <strong>${region.n}</strong></li>`).join('')}</ul>`;
		const list = `<ol class="lh-places">${states.map((state) => stateMarkup(state, busiest, toneFor(state.region))).join('')}</ol>`;
		ui.places.innerHTML = band + key + list;

		/* Sizes go on through script so the markup carries no inline styles. */
		for (const segment of pickAll('[data-grow]', ui.places))
			segment.style.flexGrow = segment.getAttribute('data-grow');
		for (const bar of pickAll('[data-w]', ui.places)) bar.style.width = `${bar.getAttribute('data-w')}%`;
	}

	function stateTally(entries) {
		const names = [...new Set(entries.map((entry) => locate(entry.place).state))];
		return names
			.map((name) => {
				const own = entries.filter((entry) => locate(entry.place).state === name);
				return {
					name,
					region: locate(own[0].place).region,
					n: own.length,
					ok: own.filter((entry) => entry.result === 'success').length,
				};
			})
			.sort((left, right) => right.n - left.n || left.name.localeCompare(right.name));
	}

	function stateMarkup(state, busiest, tone) {
		const name = htmlSafe(state.name);
		const refused = state.n - state.ok;
		const refusedNote = refused ? ` <span class="lh-country-out">· ${refused} turned away</span>` : '';
		const spoken = refused && !state.ok ? ', nobody got in' : '';
		return (
			`<li><button type="button" data-lh-key="state-${name}" data-lh-country="${name}" aria-pressed="${view.state === state.name}" class="lh-country">` +
			`<span class="lh-country-name"><span aria-hidden="true" class="lh-mix-dot lh-tone-${tone}"></span>${name}</span>` +
			`<span class="lh-country-n">${state.n}${refusedNote}</span>` +
			`<span data-w="${Math.round((state.n / busiest) * 100)}" aria-hidden="true" class="lh-country-bar"><span data-w="${Math.round((state.ok / state.n) * 100)}" class="lh-country-in"></span></span>` +
			`<span class="visually-hidden">, ${htmlSafe(state.region)}${spoken}</span></button></li>`
		);
	}

	/* Charts. Both read the same sign-ins and filters as the table, so their
     totals agree with the tab counts. The bars keep every result and light
     the chosen tab; the donut keeps every method and lights the chosen one.
     Colors come from the --basalt-* tokens on each build, and a theme
     change rebuilds both. */

	function paintCharts() {
		paintTrend();
		paintMethods();
	}

	/* Each chart waits until its card scrolls near the viewport before building. */
	function watchCharts() {
		for (const [name, parts] of Object.entries(chartParts)) {
			if (!parts.canvas) continue;
			if (!('IntersectionObserver' in window)) {
				revealed.add(name);
				continue;
			}
			const observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					observer.disconnect();
					revealed.add(name);
					mountChart(name);
				},
				{ rootMargin: '80px 0px' },
			);
			observer.observe(parts.canvas.closest('.lh-card') || parts.frame);
		}
	}

	/**
	 * Builds a chart, or feeds an existing one the new numbers.
	 * @param {boolean} [fresh] destroy and rebuild, as a theme change needs
	 */
	function mountChart(name, fresh) {
		const parts = chartParts[name];
		if (
			typeof Chart === 'undefined' ||
			!parts.canvas ||
			!revealed.has(name) ||
			view.loading ||
			view.error ||
			!records.signins.length
		)
			return;
		const existing = charts.get(name);
		const setup = CHART_RECIPES[name](chartPalette(), !existing);
		if (existing && !fresh) {
			existing.data = setup.data;
			existing.options = setup.options;
			existing.update(calmMotion ? 'none' : undefined);
			return;
		}
		existing?.destroy();
		charts.set(
			name,
			new Chart(parts.canvas, {
				type: setup.type,
				data: setup.data,
				options: setup.options,
				plugins: setup.plugins || [],
			}),
		);
	}

	/* Shows a message in place of the canvas, or the canvas again when markup is empty. */
	function toggleChartMessage(parts, markup) {
		parts.message.innerHTML = markup || '';
		parts.message.hidden = !markup;
		parts.frame.hidden = !!markup;
	}

	/* Clears the legend and caption; the trend card also hides its headline total. */
	function clearChartText(parts) {
		if (parts.headline) parts.headline.hidden = true;
		parts.key.innerHTML = '';
		parts.caption.textContent = '';
	}

	/* Covers loading, failure and no data; returns true when one of them applied. */
	function chartPlaceholder(parts, skeleton, empty) {
		let markup = '';
		if (view.loading) markup = `${skeleton}<p class="visually-hidden">Loading</p>`;
		else if (view.error) markup = failureMarkup('The chart');
		else if (!records.signins.length)
			markup = messageMarkup({ tone: 'muted', title: 'Nothing to chart yet', ...empty });
		if (!markup) return false;
		toggleChartMessage(parts, markup);
		clearChartText(parts);
		return true;
	}

	function paintTrend() {
		const parts = chartParts.trend;
		parts.lead.textContent = `${view.period === 1 ? 'Today, hour by hour' : `The last ${view.period} days, day by day`}, split by result. Follows the filters on the list below.`;
		if (
			chartPlaceholder(parts, '<span class="basalt-skeleton lh-chart-skel" aria-hidden="true"></span>', {
				icon: 'bi-bar-chart',
				text: 'Sign-ins will be counted here, day by day.',
			})
		)
			return;
		toggleChartMessage(parts, '');

		const slots = timeSlots();
		const sums = Object.fromEntries(
			OUTCOMES.map((outcome) => [outcome, slots.reduce((sum, slot) => sum + slot.counts[outcome], 0)]),
		);
		const total = slots.reduce((sum, slot) => sum + slot.total, 0);

		/* The headline total, set against the stretch of equal length just before it. */
		const earlier = records.signins.filter((entry) => {
			const gap = dayGap(readStamp(entry.at));
			return gap >= view.period && gap < view.period * 2 && fitsFilters(entry, true);
		}).length;
		const comparedWith = view.period === 1 ? 'yesterday' : `the ${view.period} days before`;
		const change = total - earlier;
		const arrow = change > 0 ? 'bi-arrow-up-right' : change < 0 ? 'bi-arrow-down-right' : 'bi-dash';
		const changeText =
			change === 0
				? `Same as ${comparedWith}`
				: `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} on ${comparedWith}`;
		parts.headline.hidden = false;
		parts.headline.innerHTML = `<span class="lh-total-n">${total}</span><span class="lh-total-label">${total === 1 ? 'sign-in' : 'sign-ins'}</span><span class="lh-total-change"><i aria-hidden="true" class="bi ${arrow}"></i>${changeText}</span>`;

		parts.key.innerHTML = OUTCOMES.map(
			(outcome) =>
				`<li${view.result && view.result !== outcome ? ' class="is-dim"' : ''}><span aria-hidden="true" class="lh-sw lh-sw-${outcome}"></span>${htmlSafe(DEMO.results[outcome].label)} <strong>${sums[outcome]}</strong></li>`,
		).join('');

		const unit = view.period === 1 ? 'hour' : 'day';
		const peak = slots.reduce((best, slot) => (slot.total > best.total ? slot : best), slots[0]);
		const refusedAtPeak = peak ? peak.counts.failed + peak.counts.blocked : 0;
		const caption = total
			? `Busiest ${unit}: ${peak.title}, with ${quantity(peak.total, 'sign-in')}${refusedAtPeak ? `, ${refusedAtPeak} of them failed or blocked.` : '.'}`
			: `No sign-ins ${windowPhrase()} match the filters.`;
		parts.caption.textContent = caption;
		const breakdown = OUTCOMES.map(
			(outcome) => `${sums[outcome]} ${DEMO.results[outcome].label.toLowerCase()}`,
		).join(', ');
		parts.canvas.setAttribute(
			'aria-label',
			`Bar chart of ${quantity(total, 'sign-in')} ${windowPhrase()} by ${unit}: ${breakdown}. ${total ? caption : ''}`,
		);
		mountChart('trend');
	}

	function paintMethods() {
		const parts = chartParts.methods;
		parts.lead.textContent = `Share of sign-ins ${windowPhrase()}, by method. Follows the filters on the list below.`;
		if (
			chartPlaceholder(
				parts,
				'<span class="basalt-skeleton basalt-skeleton-circle lh-chart-skel lh-chart-skel-ring" aria-hidden="true"></span>',
				{ icon: 'bi-pie-chart', text: 'Each way people sign in will get its share here.' },
			)
		)
			return;
		toggleChartMessage(parts, '');

		const tally = methodTally();
		const total = tally.reduce((sum, method) => sum + method.n, 0);
		parts.key.innerHTML = tally
			.map((method, index) => {
				const dim = view.method && view.method !== method.key ? ' is-dim' : '';
				return `<li class="lh-split-row${dim}"><span aria-hidden="true" class="lh-sw lh-sw-m${index + 1}"></span><span class="lh-split-label">${htmlSafe(method.label)}</span><span class="lh-split-n">${method.n}</span><span class="lh-split-pct">${percent(method.n, total)}%</span></li>`;
			})
			.join('');

		let caption = `No sign-ins ${windowPhrase()} match the filters.`;
		if (total) {
			const leader = tally.slice().sort((left, right) => right.n - left.n)[0];
			caption = `${leader.label} is the most used, ${percent(leader.n, total)}% of sign-ins.`;
			/* Worth pointing out only while every result is on the chart. */
			const shutOut = view.result ? [] : tally.filter((method) => method.n > 1 && method.ok === 0);
			if (shutOut.length) caption += ` None of the ${shutOut[0].n} tries with ${shutOut[0].label} got in.`;
		}
		parts.caption.textContent = caption;
		parts.canvas.setAttribute(
			'aria-label',
			`Donut chart of ${quantity(total, 'sign-in')} ${windowPhrase()} by method: ${tally.map((method) => `${method.label} ${method.n} (${percent(method.n, total)}%)`).join(', ')}.`,
		);
		mountChart('methods');
	}

	/* An hourly slot for each hour so far today, or a daily slot for each day in the period. */
	function timeSlots() {
		const hourly = view.period === 1;
		const length = hourly ? CLOCK.getHours() + 1 : view.period;
		const slots = Array.from({ length }, (_, index) => {
			const counts = { success: 0, challenged: 0, failed: 0, blocked: 0 };
			if (hourly)
				return {
					label: `${twoDigits(index)}:00`,
					title: `Today, ${twoDigits(index)}:00 to ${twoDigits(index)}:59`,
					counts,
				};
			const day = new Date(CLOCK.getFullYear(), CLOCK.getMonth(), CLOCK.getDate() - (length - 1 - index));
			const label =
				view.period === 7
					? `${WEEKDAY_NAMES[day.getDay()]} ${day.getDate()}`
					: `${MONTH_NAMES[day.getMonth()]} ${day.getDate()}`;
			const title = dayName(day) === calendarDay(day) ? calendarDay(day) : `${dayName(day)}, ${calendarDay(day)}`;
			return { label, title, counts };
		});

		for (const entry of records.signins.filter((candidate) => fitsView(candidate, true))) {
			const at = readStamp(entry.at);
			const slot = slots[hourly ? at.getHours() : length - 1 - dayGap(at)];
			if (slot) slot.counts[entry.result] += 1;
		}
		for (const slot of slots) slot.total = OUTCOMES.reduce((sum, outcome) => sum + slot.counts[outcome], 0);
		return slots;
	}

	function trendSetup(palette, animate) {
		const slots = timeSlots();
		const crowded = slots.length > 12;
		const tickFont = { family: CHART_FONT, size: 11.5 };
		return {
			type: 'bar',
			data: {
				labels: slots.map((slot) => slot.label),
				datasets: OUTCOMES.map((outcome, index) => {
					const color =
						view.result && view.result !== outcome
							? fade(palette.result[outcome], 0.2)
							: palette.result[outcome];
					/* Bars that got in shade toward their base; with gradients off they stay solid. */
					const shaded = index === 0 && !view.result && !gradientsOff();
					return {
						label: DEMO.results[outcome].label,
						data: slots.map((slot) => slot.counts[outcome]),
						backgroundColor: shaded ? (context) => barShade(context, color, palette.surface) : color,
						hoverBackgroundColor: color,
						borderRadius: 3,
						borderSkipped: false,
						borderWidth: 0,
						barPercentage: crowded ? 0.8 : 0.62,
						categoryPercentage: 0.9,
						maxBarThickness: 34,
						stack: 'result',
					};
				}),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !calmMotion ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 4, right: 4 } },
				plugins: {
					legend: { display: false },
					tooltip: {
						...tooltipLook(palette),
						filter: (item) => item.parsed.y > 0,
						callbacks: {
							title: (items) => (items.length ? slots[items[0].dataIndex].title : ''),
							label: (item) => ` ${item.dataset.label}: ${item.parsed.y}`,
							footer: (items) => (items.length ? `Total: ${slots[items[0].dataIndex].total}` : ''),
						},
					},
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: {
							color: palette.quiet,
							font: tickFont,
							maxRotation: 0,
							autoSkipPadding: 14,
							maxTicksLimit: crowded ? 8 : 12,
						},
					},
					y: {
						stacked: true,
						beginAtZero: true,
						suggestedMax: 4,
						grid: { color: palette.grid },
						border: { display: false },
						ticks: {
							color: palette.quiet,
							font: { ...tickFont },
							precision: 0,
							maxTicksLimit: 5,
							padding: 8,
						},
					},
				},
			},
		};
	}

	function barShade(context, color, surface) {
		const fill = window.Basalt.chartFill([
			[0, color],
			[1, blend(color, surface, 0.72)],
		]);
		return fill(context);
	}

	function methodTally() {
		const pool = records.signins.filter((entry) => fitsView(entry, false, true));
		return Object.entries(DEMO.methods).map(([key, method]) => {
			const used = pool.filter((entry) => entry.method === key);
			return {
				key,
				label: method.label,
				n: used.length,
				ok: used.filter((entry) => entry.result === 'success').length,
			};
		});
	}

	function methodSetup(palette, animate) {
		const tally = methodTally();
		const total = tally.reduce((sum, method) => sum + method.n, 0);
		const colors = tally.map((method, index) =>
			view.method && view.method !== method.key ? fade(palette.method[index], 0.2) : palette.method[index],
		);
		const dataset = total
			? {
					data: tally.map((method) => method.n),
					backgroundColor: colors,
					hoverBackgroundColor: colors,
					borderColor: palette.surface,
					borderWidth: 2,
					hoverBorderColor: palette.surface,
					hoverOffset: 4,
				}
			: { data: [1], backgroundColor: [palette.track], hoverBackgroundColor: [palette.track], borderWidth: 0 };
		return {
			type: 'doughnut',
			data: { labels: total ? tally.map((method) => method.label) : ['None'], datasets: [dataset] },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '74%',
				animation:
					animate && !calmMotion ? { duration: 500, easing: 'easeOutQuart', animateRotate: true } : false,
				layout: { padding: 6 },
				plugins: {
					legend: { display: false },
					lhRingTotal: { text: palette.text, quiet: palette.quiet, total },
					tooltip: {
						...tooltipLook(palette),
						enabled: total > 0,
						callbacks: {
							label: (item) => ` ${item.label}: ${item.parsed} (${percent(item.parsed, total)}%)`,
						},
					},
				},
			},
			plugins: [ringTotal],
		};
	}

	function chartPalette() {
		const text = readToken('--basalt-copy', '#12233a');
		const muted = readToken('--basalt-copy-muted', '#5f7186');
		return {
			text,
			surface: readToken('--basalt-plane', '#ffffff'),
			/* Mixed by the same recipe as --lh-quiet in sign-in-history.css. */
			quiet: blend(muted, text, 0.72),
			grid: fade(text, 0.07),
			track: fade(text, 0.09),
			border: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			result: Object.fromEntries(
				OUTCOMES.map((outcome) => [outcome, readToken(OUTCOME_TOKENS[outcome], '#2b6fd4')]),
			),
			method: Object.keys(DEMO.methods).map((key, index) => readToken(`--basalt-series-${index + 1}`, '#2b6fd4')),
		};
	}

	function tooltipLook(palette) {
		return {
			backgroundColor: palette.surface,
			titleColor: palette.text,
			bodyColor: palette.text,
			footerColor: palette.text,
			borderColor: palette.border,
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			pointStyle: 'rectRounded',
			titleFont: { family: CHART_FONT, size: 12, weight: '600' },
			bodyFont: { family: CHART_FONT, size: 12 },
			footerFont: { family: CHART_FONT, size: 12, weight: '600' },
		};
	}

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/* Tokens arrive as #rgb, #rrggbb or rgb(a)(); Chart.js wants finished
     color strings, so mixing happens here instead of in CSS color-mix(). */
	function rgbParts(color) {
		const text = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return short[1].split('').map((digit) => parseInt(digit + digit, 16));
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional)
			return functional[1]
				.split(',')
				.slice(0, 3)
				.map((part) => parseFloat(part));
		return [128, 128, 128];
	}

	function fade(color, alpha) {
		const [red, green, blue] = rgbParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors; share is the weight given to the first. */
	function blend(first, second, share) {
		const from = rgbParts(first);
		const to = rgbParts(second);
		const channel = (index) => Math.round(from[index] * share + to[index] * (1 - share));
		return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
	}

	function gradientsOff() {
		return document.documentElement.getAttribute('data-basalt-gradients') === 'off';
	}

	function windowPhrase() {
		return view.period === 1 ? 'today' : `in the last ${view.period} days`;
	}

	function percent(part, whole) {
		return whole ? Math.round((part / whole) * 100) : 0;
	}

	/* The drawer shows one sign-in in full and steps through the filtered list. */

	function bindDrawer() {
		const drawer = ui.drawer;
		stepper = window.Basalt.drawer
			? window.Basalt.drawer.recordNav(drawer, followCount, paintRecord)
			: { go: paintRecord, at: 0 };
		drawer.addEventListener('show.bs.offcanvas', () => moveToasts('bottom-center'));
		drawer.addEventListener('shown.bs.offcanvas', () => {
			drawerShown = true;
		});
		drawer.addEventListener('hidden.bs.offcanvas', () => {
			drawerShown = false;
			moveToasts('bottom-end');
		});

		const signOutButton = pick('[data-lh-r-signout]', drawer);
		const blockButton = pick('[data-lh-r-block]', drawer);
		signOutButton.addEventListener('click', () => {
			const entry = findSignin(openId);
			if (!entry) return;
			quietly(endOneSession(entry.id));
			(blockButton.hidden ? pick('.btn-close', drawer) : blockButton).focus();
		});
		blockButton.addEventListener('click', () => {
			const entry = findSignin(openId);
			if (!entry) return;
			quietly(addressBlocked(entry.ip) ? unblockIp(entry.ip) : blockIp(entry.ip));
			blockButton.focus();
		});
	}

	function moveToasts(corner) {
		window.Basalt.toasts?.position(corner);
	}

	function drawerField(name) {
		return pick(`[data-lh-r="${name}"]`, ui.drawer);
	}

	/** recordNav callback: fills the drawer with the sign-in at that index of the filtered list. */
	function paintRecord(index) {
		const entry = shown[index];
		if (!entry) return;
		openId = entry.id;
		const owner = ownerOf(entry);
		const hardware = hardwareOf(entry);
		const method = methodInfo(entry);
		const spot = locate(entry.place);
		const blocked = addressBlocked(entry.ip);

		const initialsBox = drawerField('initials');
		initialsBox.className = `basalt-avatar basalt-avatar-sm basalt-avatar-tone-${owner.tone}`;
		initialsBox.textContent = monogram(owner.name);
		drawerField('title').textContent = owner.name;
		drawerField('sub').textContent = stamp(readStamp(entry.at));
		drawerField('result').innerHTML = recordOutcome(entry, owner, spot);

		drawerField('ip').textContent = entry.ip;
		pick('[data-lh-r-copy]', ui.drawer).setAttribute('data-basalt-copy', entry.ip);
		drawerField('place').innerHTML =
			`${htmlSafe(placeName(entry.place))} <span class="lh-sub-inline">${htmlSafe(spot.region)}</span>${blocked ? ' <span class="basalt-status basalt-status-danger">Blocked</span>' : ''}`;
		drawerField('device').innerHTML =
			`<i aria-hidden="true" class="bi ${hardware.icon}"></i>${htmlSafe(hardware.name)}, ${htmlSafe(hardware.os)}`;
		drawerField('browser').textContent = hardware.browser;
		drawerField('method').innerHTML =
			`<i aria-hidden="true" class="bi ${method.icon}"></i>${htmlSafe(method.label)}`;
		drawerField('second').textContent =
			{ challenged: 'Asked for, not answered', success: method.second }[entry.result] ?? "Didn't get that far";
		drawerField('session').textContent = sessionSentence(entry);
		drawerField('email').textContent = owner.email;
		drawerField('role').textContent = owner.role;
		drawerField('job').textContent = `${owner.job}, ${owner.team}`;
		drawerField('home').textContent = placeName(owner.home);

		/* In the footer, signing the session out leads whenever there is a session to end. */
		const signOutButton = pick('[data-lh-r-signout]', ui.drawer);
		const blockButton = pick('[data-lh-r-block]', ui.drawer);
		signOutButton.hidden = !(stillOpen(entry) && !isOwnSession(entry));
		blockButton.hidden = records.signins.some((other) => isOwnSession(other) && other.ip === entry.ip);
		blockButton.textContent = blocked ? 'Unblock this address' : 'Block this address';
		const blockLeads = signOutButton.hidden && !blocked && entry.result !== 'success';
		blockButton.className = `btn ${blockLeads ? 'btn-danger' : 'btn-outline-secondary'}`;
	}

	function recordOutcome(entry, owner, spot) {
		let markup = outcomePill(entry);
		if (entry.reason) markup += `<p class="lh-r-note">${htmlSafe(entry.reason)}.</p>`;
		else if (entry.result === 'success' && isUnfamiliarPlace(entry)) {
			markup += `<p class="lh-r-note"><i aria-hidden="true" class="bi bi-exclamation-triangle"></i>The first time ${htmlSafe(givenName(owner))} has signed in from ${htmlSafe(spot.city)}.</p>`;
		}
		const linked = records.alerts.find((alert) => !alert.resolved && alert.ip === entry.ip);
		if (linked)
			markup += `<p class="lh-r-note lh-r-note-alert"><i aria-hidden="true" class="bi bi-flag"></i>Part of an alert: ${htmlSafe(linked.title)}.</p>`;
		return markup;
	}

	function sessionSentence(entry) {
		const session = entry.session;
		if (!session) return "None. This attempt didn't get in.";
		if (isOwnSession(entry)) return "Open. This is the session you're using now.";
		const since = sinceText(readStamp(session.last));
		if (session.state === 'active') return `Open, last active ${since}.`;
		if (session.state === 'expired') return `Timed out ${since}.`;
		return `Signed out ${since}.`;
	}

	/* Opens the drawer on one sign-in. When the filters hide it (as for a
     session row), they are cleared first so it can be found. */
	function showRecord(signinKey) {
		let index = shown.findIndex((entry) => entry.id === signinKey);
		if (index < 0) {
			resetFilters();
			if (dayGap(readStamp(findSignin(signinKey).at)) >= view.period) choosePeriod(30);
			repaint(true);
			index = shown.findIndex((entry) => entry.id === signinKey);
		}
		if (index < 0) return;
		stepper.go(index, 0);
		bootstrap.Offcanvas.getOrCreateInstance(ui.drawer).show();
	}

	/* When the data shifts under an open drawer, keep it on the same sign-in. */
	function keepDrawerInSync() {
		if (!drawerShown || !openId) return;
		const index = shown.findIndex((entry) => entry.id === openId);
		if (index >= 0) stepper.go(index, 0);
	}

	/* Two confirmations guard the bulk sign-outs: one person everywhere, and everyone else. */

	function othersOpenFor(personKey) {
		return records.signins.filter((entry) => entry.who === personKey && stillOpen(entry) && !isOwnSession(entry));
	}

	function everyoneElseOpen() {
		return records.signins.filter((entry) => stillOpen(entry) && !isOwnSession(entry));
	}

	function askPersonOut(personKey, trigger) {
		const owner = DEMO.people[personKey];
		const entries = othersOpenFor(personKey);
		if (!entries.length) return;
		pendingPerson = personKey;
		pendingTrigger = trigger;
		const viewer = personKey === DEMO.me;
		const dialog = ui.personDialog;
		pick('[data-lh-po="title"]', dialog).textContent = viewer
			? 'Sign out your other devices?'
			: `Sign ${owner.name} out everywhere?`;
		pick('[data-lh-po="text"]', dialog).textContent = viewer
			? 'You stay signed in here. Each of these has to sign in again.'
			: `Every open session ends now. ${givenName(owner)} can sign straight back in on a device they trust.`;
		pick('[data-lh-po="list"]', dialog).innerHTML = entries
			.map(
				(entry) =>
					`<li><i aria-hidden="true" class="bi ${hardwareOf(entry).icon}"></i>${htmlSafe(browserLine(entry))}, ${htmlSafe(locate(entry.place).city)}</li>`,
			)
			.join('');
		bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	function bindPersonDialog() {
		const dialog = ui.personDialog;
		pick('[data-lh-po-hold]', dialog).addEventListener('basalt:confirm', () => {
			const personKey = pendingPerson;
			const owner = DEMO.people[personKey];
			const entries = othersOpenFor(personKey);
			bootstrap.Modal.getOrCreateInstance(dialog).hide();
			quietly(
				closeSessions(
					entries,
					() => api.signOutPerson(personKey, DEMO.mySession),
					() => {
						notify({
							tone: 'success',
							title:
								personKey === DEMO.me
									? 'Your other devices are signed out'
									: `${owner.name} is signed out everywhere`,
							text: `${quantity(entries.length, 'session')} ended.`,
						});
					},
				),
			);
		});
		dialog.addEventListener('hidden.bs.modal', () => {
			const stillThere = pendingTrigger && document.body.contains(pendingTrigger);
			(stillThere ? pendingTrigger : ui.sessionsHeading).focus();
		});
	}

	function bindEveryoneDialog() {
		const dialog = ui.everyoneDialog;
		ui.everyoneButton.addEventListener('click', () => {
			const count = everyoneElseOpen().length;
			pick('[data-lh-ev="sub"]', dialog).textContent =
				`${quantity(count, 'open session')} end${count === 1 ? 's' : ''}, for everyone but you. You stay signed in on this device.`;
			pick('[data-basalt-type-confirm]', dialog).basaltTyped?.reset();
			bootstrap.Modal.getOrCreateInstance(dialog).show();
		});
		dialog.addEventListener('shown.bs.modal', () => pick('#lh-everyone-input', dialog).focus());
		dialog.addEventListener('hidden.bs.modal', () => {
			(ui.everyoneButton.disabled ? ui.sessionsHeading : ui.everyoneButton).focus();
		});
		pick('[data-lh-ev-go]', dialog).addEventListener('click', () => {
			const entries = everyoneElseOpen();
			const people = new Set(entries.map((entry) => entry.who)).size;
			bootstrap.Modal.getOrCreateInstance(dialog).hide();
			quietly(
				closeSessions(
					entries,
					() => api.signOutEveryone(DEMO.mySession),
					() => {
						notify({
							tone: 'success',
							title: 'Everyone else is signed out',
							text: `${quantity(entries.length, 'session')} ended for ${quantity(people, 'person', 'people')}. You're still signed in here.`,
						});
					},
				),
			);
		});
	}

	/* Export hands over the filtered rows as a CSV file. */

	function exportShown() {
		const button = ui.exportButton;
		if (button.getAttribute('aria-busy') === 'true' || view.loading || view.error) return;
		const entries = shown.slice();
		if (!entries.length) {
			notify({ tone: 'info', title: 'Nothing to export', text: 'No sign-ins match the filters in use.' });
			return;
		}
		window.Basalt.buttonState(button, 'loading');
		api.exportCsv(entries)
			.then((csv) => {
				const filename = `fieldline-sign-ins-${DEMO.now.slice(0, 10)}.csv`;
				saveFile(csv, filename);
				window.Basalt.buttonState(button, 'success');
				notify({
					tone: 'success',
					title: 'Export ready',
					text: `${filename}, ${quantity(entries.length, 'sign-in')}.`,
				});
			})
			.catch(() => {
				window.Basalt.buttonState(button, 'error');
				reportFailure("The CSV wasn't made.");
			})
			.then(() => setTimeout(() => window.Basalt.buttonState(button, 'idle'), 2000));
	}

	function saveFile(csv, filename) {
		const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = href;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(href), 1000);
	}

	function csvText(entries) {
		const header = [
			'Time',
			'Person',
			'Email',
			'Role',
			'Result',
			'Reason',
			'Method',
			'Device',
			'Operating system',
			'Browser',
			'IP address',
			'City',
			'State',
			'Region',
			'Session',
		];
		const lines = entries.map((entry) => {
			const owner = ownerOf(entry);
			const hardware = hardwareOf(entry);
			const spot = locate(entry.place);
			return [
				entry.at,
				owner.name,
				owner.email,
				owner.role,
				outcomeOf(entry).label,
				entry.reason || '',
				methodInfo(entry).label,
				hardware.name,
				hardware.os,
				hardware.browser,
				entry.ip,
				spot.city,
				spot.state,
				spot.region,
				entry.session ? entry.session.state : '',
			]
				.map(csvField)
				.join(',');
		});
		return `${[header.join(','), ...lines].join('\r\n')}\r\n`;
	}

	function csvField(value) {
		const text = String(value ?? '');
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	/* Each sign-in points at people, places, devices and methods by key; these resolve them. */

	function findSignin(signinKey) {
		return records.signins.find((entry) => entry.id === signinKey);
	}

	function ownerOf(entry) {
		return DEMO.people[entry.who];
	}

	function locate(placeKey) {
		return DEMO.places[placeKey] || { city: 'Unknown', state: 'Unknown', st: '', region: '' };
	}

	/* "City, ST", the way a US address writes it. */
	function placeName(placeKey) {
		const spot = locate(placeKey);
		return spot.st ? `${spot.city}, ${spot.st}` : spot.city;
	}

	function hardwareOf(entry) {
		return (
			DEMO.devices[entry.device] || { name: 'Unknown device', os: '', browser: '', icon: 'bi-question-circle' }
		);
	}

	/* "Chrome on macOS", with version numbers dropped; scripts are named as such. */
	function browserLine(entry) {
		const hardware = hardwareOf(entry);
		if (entry.device === 'script') return hardware.browser;
		const unversioned = (text) => text.replace(/\s[\d.]+$/, '');
		return `${unversioned(hardware.browser)} on ${unversioned(hardware.os)}`;
	}

	function methodInfo(entry) {
		return DEMO.methods[entry.method] || { label: entry.method, icon: 'bi-key', second: '' };
	}

	function outcomeOf(entry) {
		return DEMO.results[entry.result];
	}

	function stillOpen(entry) {
		return entry.session && entry.session.state === 'active';
	}

	function isOwnSession(entry) {
		return entry.id === DEMO.mySession;
	}

	/* True when this person has never got in from this place before, and it is not their home. */
	function isUnfamiliarPlace(entry) {
		if (entry.place === ownerOf(entry).home) return false;
		const at = readStamp(entry.at);
		return !records.signins.some(
			(other) =>
				other.who === entry.who &&
				other.place === entry.place &&
				other.result === 'success' &&
				readStamp(other.at) < at,
		);
	}

	/* Empty states, skeletons, avatars and pills look the same in every panel. */

	/**
	 * An empty or failed state card.
	 * @param {{tone: string, icon: string, title: string, text: string, alert?: boolean, button?: [string, string]}} options
	 *   button is [label, attribute] for a single action
	 */
	function messageMarkup(options) {
		const action = options.button
			? `<div class="basalt-empty-actions"><button type="button" class="btn btn-sm btn-outline-secondary" ${options.button[1]}>${htmlSafe(options.button[0])}</button></div>`
			: '';
		return (
			`<div class="basalt-empty basalt-empty-compact basalt-empty-${options.tone}"${options.alert ? ' role="alert"' : ''}>` +
			`<span aria-hidden="true" class="basalt-empty-badge"><i class="bi ${options.icon}"></i></span>` +
			`<p class="basalt-empty-title">${htmlSafe(options.title)}</p><p class="basalt-empty-text">${htmlSafe(options.text)}</p>${action}</div>`
		);
	}

	function failureMarkup(subject) {
		return messageMarkup({
			tone: 'danger',
			alert: true,
			icon: 'bi-wifi-off',
			title: `${subject} didn't load`,
			text: "The server didn't answer. Nothing has been lost.",
			button: ['Try again', 'data-lh-reload'],
		});
	}

	function placeholderRows(count) {
		const rows = Array.from(
			{ length: count },
			(_, index) =>
				'<div class="lh-skel-row"><span class="basalt-skeleton basalt-skeleton-circle"></span>' +
				`<span class="lh-skel-lines"><span class="basalt-skeleton basalt-skeleton-line lh-skel-w${index % 3}"></span><span class="basalt-skeleton basalt-skeleton-line lh-skel-w${(index + 1) % 3}"></span></span></div>`,
		);
		return `<div aria-hidden="true" class="lh-skel">${rows.join('')}</div><p class="visually-hidden">Loading</p>`;
	}

	function avatarMarkup(owner, size) {
		return `<span aria-hidden="true" class="basalt-avatar ${size || 'basalt-avatar-xs'} basalt-avatar-tone-${owner.tone}">${htmlSafe(monogram(owner.name))}</span>`;
	}

	function outcomePill(entry) {
		const outcome = outcomeOf(entry);
		return `<span class="basalt-status basalt-status-${outcome.tone}"><i aria-hidden="true" class="bi ${outcome.icon}"></i>${htmlSafe(outcome.label)}</span>`;
	}

	function isoAttr(text) {
		return htmlSafe(text.replace(' ', 'T'));
	}

	/* Relative dates and times are all measured against CLOCK. */

	function readStamp(text) {
		const parts = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(text || '');
		if (!parts) return null;
		const [, year, month, day, hour, minute] = parts.map(Number);
		return new Date(year, month - 1, day, hour, minute);
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	function clockTime(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())}${hours < 12 ? ' am' : ' pm'}`;
	}

	function calendarDay(date) {
		return `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	/* Whole calendar days between a date and CLOCK, ignoring the time of day. */
	function dayGap(date) {
		const then = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		const today = new Date(CLOCK.getFullYear(), CLOCK.getMonth(), CLOCK.getDate());
		return Math.round((today - then) / 86400000);
	}

	function dayName(date) {
		return ['Today', 'Yesterday'][dayGap(date)] || calendarDay(date);
	}

	function stamp(date) {
		return `${dayName(date)} at ${clockTime(date)}`;
	}

	/* The stamp with Today and Yesterday lowercased, for use mid-sentence. */
	function stampInSentence(date) {
		return stamp(date).replace(/^(Today|Yesterday)/, (word) => word.toLowerCase());
	}

	function sinceText(date) {
		const minutes = Math.round((CLOCK - date) / 60000);
		if (minutes < 2) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (dayGap(date) === 0) return `${quantity(Math.floor(minutes / 60), 'hour')} ago`;
		return stampInSentence(date).replace(' at ', ', ');
	}

	/* DOM lookups, escaping, wording and the demo's fake network delay. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(text) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(text ?? '').replace(/[&<>"']/g, (character) => entities[character]);
	}

	function quantity(count, singular, pluralForm) {
		return `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function monogram(name) {
		return name
			.split(/\s+/)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function givenName(owner) {
		return owner.name.split(' ')[0];
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function reportFailure(text) {
		return notify({
			tone: 'danger',
			title: "That didn't go through",
			text: `${text} Nothing was changed. Check your connection and try again.`,
		});
	}

	/* Lets a promise fail without an unhandled rejection; the failure was already shown. */
	function quietly(promise) {
		promise.then(
			() => {},
			() => {},
		);
	}

	function pause(delay, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), delay));
	}

	/* Demo replies: they resolve after the delay, or reject when ?state=offline. */
	function reply(delay, value) {
		return scenario === 'offline'
			? pause(delay).then(() => {
					throw new Error('offline');
				})
			: pause(delay, value);
	}
})();
