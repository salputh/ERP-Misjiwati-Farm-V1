/**
 * The Employee Users directory (employee-users.html): everybody who can sign in to
 * the Fieldline workspace, with saved views, search, filters, a table or
 * card layout, bulk role changes, suspensions, 2FA resets, invites, seat
 * purchases and CSV exports. Every change shows at once and is rolled back,
 * with a toast, if the server refuses it; most of them offer Undo.
 *
 * The same file also feeds employee-user-details.html. Before it looks for the
 * directory it publishes the workspace sample as window.Basalt.userBook,
 * which the profile script reads; names, titles, teams and cities come from
 * the shared roster in assets/basalt/js/data/multipurpose/people.js.
 *
 * Plugging in a backend: return your workspace from server.fetchWorkspace()
 * in the shape of `sample`, and point each other server method at its
 * endpoint. Add ?state=empty for a workspace of one, ?state=error for a
 * first load that fails, or ?state=fail to see every change undone.
 */
(() => {
	'use strict';

	/* The sample's clock reads Friday, October 9, 2026, 10:42 am. A live
     app would start from new Date() instead. Times below are local and
     written YYYY-MM-DDTHH:MM. */
	const sampleNow = new Date(2026, 9, 9, 10, 42);

	const sample = {
		workspace: { name: 'Fieldline', plan: 'Max plan', seats: 60, pricePerSeat: 58, renews: '2027-01-14' },

		/* Whoever is signed in: John Armstrong, an administrator. */
		me: 'ja',

		/* The roles come from assets/basalt/js/data/multipurpose/access.js, shared with Roles,
       Permissions and each user's page. Rank 1 holds the most access,
       and a role with manage set can be handed out here; ownership only
       changes hands from Settings. */
		roles: window.Basalt.data.access
			.set('general')
			.roles.map(({ id, name, rank, manage, about }) => ({ id, name, rank, manage, about })),

		/* A team's lead is who its members report to; the leads answer to the owner. */
		teams: [
			{ id: 'Support', lead: 'pr' },
			{ id: 'Success', lead: 'ev' },
			{ id: 'Sales', lead: 'ew' },
			{ id: 'Product', lead: 'hw' },
			{ id: 'Engineering', lead: 'as' },
			{ id: 'Marketing', lead: 'cr' },
			{ id: 'Finance', lead: 'rd' },
			{ id: 'Operations', lead: 'km' },
		],

		signins: [
			{ id: 'okta', name: 'Okta SSO', icon: 'bi-shield-lock' },
			{ id: 'google', name: 'Google SSO', icon: 'bi-google' },
			{ id: 'password', name: 'Password', icon: 'bi-key' },
		],

		groups: [
			{ id: 'security', name: 'Security reviewers' },
			{ id: 'release', name: 'Release approvers' },
			{ id: 'oncall', name: 'On-call roster' },
			{ id: 'escalations', name: 'Support escalations' },
			{ id: 'onboarding', name: 'Customer onboarding' },
			{ id: 'invoices', name: 'Invoice approvers' },
			{ id: 'beta', name: 'Beta testers' },
			{ id: 'west', name: 'West Coast desk' },
		],

		/* The kinds of work that follow a person when it is transferred. */
		ownable: [
			{ id: 'boards', one: 'schedule board', many: 'schedule boards', icon: 'bi-kanban' },
			{ id: 'reports', one: 'saved report', many: 'saved reports', icon: 'bi-graph-up' },
			{ id: 'automations', one: 'automation', many: 'automations', icon: 'bi-lightning' },
			{ id: 'keys', one: 'API key', many: 'API keys', icon: 'bi-key' },
		],

		/* The tabs above the list. A filter may name status, role, team,
       region, signin or mfa. */
		views: [
			{ id: 'everyone', name: 'Everyone', filter: { status: ['active', 'invited', 'suspended'] } },
			{
				id: 'admins',
				name: 'Admins',
				filter: { status: ['active', 'invited', 'suspended'], role: ['owner', 'admin'] },
			},
			{ id: 'invited', name: 'Invited', filter: { status: ['invited'] } },
			{ id: 'no2fa', name: '2FA off', filter: { status: ['active'], mfa: false } },
			{ id: 'suspended', name: 'Suspended', filter: { status: ['suspended'] } },
			{ id: 'deactivated', name: 'Deactivated', filter: { status: ['deactivated'] } },
			{
				id: 'v-support-midwest',
				name: 'Support in the Midwest',
				custom: true,
				filter: { status: ['active', 'invited', 'suspended'], team: 'Support', region: 'Midwest' },
			},
		],

		/* Every roster member's sign-in, keyed by their roster id. status is
       active, invited, suspended or deactivated; last is the latest thing
       they did, and device is where they usually work from. */
		users: [
			{
				id: 'rc',
				role: 'owner',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T08:15',
				device: 'mac',
				groups: ['release'],
				owns: { reports: 3 },
			},
			{
				id: 'ja',
				role: 'admin',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:41',
				device: 'mac',
				groups: ['security', 'release'],
				owns: { reports: 4, automations: 2, keys: 1 },
			},
			{
				id: 'km',
				role: 'admin',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T09:30',
				device: 'win',
				groups: ['security'],
				owns: { reports: 5 },
			},
			{
				id: 'ih',
				role: 'hr',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T16:50',
				device: 'mac',
				groups: ['onboarding'],
			},
			{
				id: 'lo',
				role: 'warehouse',
				status: 'active',
				signin: 'password',
				mfa: true,
				last: '2026-10-07T14:10',
				device: 'win',
				groups: [],
				owns: { reports: 2 },
			},
			{
				id: 'wa',
				role: 'warehouse',
				status: 'invited',
				signin: 'okta',
				mfa: false,
				last: null,
				invited: { at: '2026-10-06T11:20', by: 'ja' },
				groups: [],
			},

			{
				id: 'pr',
				role: 'support',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:31',
				device: 'mac',
				groups: ['escalations', 'oncall'],
				owns: { boards: 2, reports: 6, automations: 3 },
			},
			{
				id: 'ab',
				role: 'support',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:38',
				device: 'win',
				groups: ['escalations'],
			},
			{
				id: 'sl',
				role: 'support',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T09:12',
				device: 'linux',
				groups: ['oncall'],
			},
			{
				id: 'cm',
				role: 'support',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T07:55',
				device: 'mac',
				groups: [],
			},
			{
				id: 'yh',
				role: 'support',
				status: 'active',
				signin: 'password',
				mfa: true,
				last: '2026-10-09T10:05',
				device: 'win',
				groups: ['escalations'],
				owns: { reports: 1 },
			},
			{
				id: 'nd',
				role: 'support',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T17:40',
				device: 'mac',
				groups: [],
			},
			{
				id: 'rk',
				role: 'support',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T06:20',
				device: 'win',
				groups: ['west', 'oncall'],
			},
			{
				id: 'jt',
				role: 'support',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T23:48',
				device: 'mac',
				groups: ['west'],
			},
			{
				id: 'ms',
				role: 'support',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:02',
				device: 'win',
				groups: [],
			},
			{
				id: 'bc',
				role: 'support',
				status: 'active',
				signin: 'password',
				mfa: false,
				last: '2026-10-09T09:47',
				device: 'win',
				groups: [],
			},
			{
				id: 'dr',
				role: 'support',
				status: 'suspended',
				signin: 'okta',
				mfa: true,
				last: '2026-08-28T15:30',
				device: 'mac',
				groups: ['escalations'],
				owns: { boards: 1, reports: 3 },
				suspended: {
					at: '2026-08-31T09:00',
					by: 'ja',
					reason: 'Leave of absence',
					note: 'Parental leave, back on December 7.',
				},
			},
			{
				id: 'si',
				role: 'support',
				status: 'invited',
				signin: 'okta',
				mfa: false,
				last: null,
				invited: { at: '2026-10-07T18:05', by: 'pr' },
				groups: [],
			},

			{
				id: 'ev',
				role: 'store',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T09:18',
				device: 'mac',
				groups: ['onboarding'],
				owns: { boards: 4, reports: 2 },
			},
			{
				id: 'gl',
				role: 'store',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T08:44',
				device: 'mac',
				groups: ['onboarding', 'beta'],
				owns: { boards: 3 },
			},
			{
				id: 'ta',
				role: 'store',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T17:45',
				device: 'win',
				groups: [],
			},
			{
				id: 'cd',
				role: 'store',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T19:22',
				device: 'mac',
				groups: ['onboarding'],
			},
			{
				id: 'nf',
				role: 'store',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-06T13:05',
				device: 'linux',
				groups: ['onboarding'],
				owns: { boards: 2, automations: 1 },
			},
			{
				id: 'hb',
				role: 'store',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:26',
				device: 'mac',
				groups: [],
			},
			{
				id: 'am',
				role: 'store',
				status: 'deactivated',
				signin: 'okta',
				mfa: true,
				last: '2026-08-28T17:10',
				device: 'win',
				groups: [],
				deactivated: { at: '2026-08-31T09:30', by: 'ja' },
			},

			{
				id: 'ew',
				role: 'sales',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-09T09:55',
				device: 'mac',
				groups: [],
				owns: { reports: 7 },
			},
			{
				id: 'mb',
				role: 'sales',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-09T10:40',
				device: 'mac',
				groups: [],
			},
			{
				id: 'op',
				role: 'sales',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-09T10:09',
				device: 'win',
				groups: [],
			},
			{
				id: 'mk',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T19:20',
				device: 'mac',
				groups: ['west'],
				owns: { keys: 1 },
			},
			{
				id: 'lf',
				role: 'sales',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-09T08:30',
				device: 'mac',
				groups: [],
			},
			{
				id: 'za',
				role: 'sales',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-07T16:45',
				device: 'win',
				groups: [],
			},
			{
				id: 'rf',
				role: 'sales',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-09T09:40',
				device: 'mac',
				groups: [],
			},
			{
				id: 'tn',
				role: 'sales',
				status: 'deactivated',
				signin: 'google',
				mfa: true,
				last: '2026-09-11T17:02',
				device: 'mac',
				groups: [],
				deactivated: { at: '2026-09-12T10:00', by: 'km' },
			},

			{
				id: 'hw',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T08:55',
				device: 'mac',
				groups: ['release', 'beta'],
				owns: { reports: 4 },
			},
			{
				id: 'nfe',
				role: 'readonly',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:20',
				device: 'mac',
				groups: ['beta'],
			},
			{
				id: 'og',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T07:31',
				device: 'mac',
				groups: ['release'],
			},
			{
				id: 'lg',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T18:12',
				device: 'mac',
				groups: ['beta'],
			},
			{
				id: 'ao',
				role: 'readonly',
				status: 'active',
				signin: 'password',
				mfa: true,
				last: '2026-10-07T11:25',
				device: 'mac',
				groups: [],
			},
			{
				id: 'jw',
				role: 'readonly',
				status: 'invited',
				signin: 'okta',
				mfa: false,
				last: null,
				invited: { at: '2026-10-02T10:00', by: 'ja' },
				groups: [],
			},

			{
				id: 'as',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T07:05',
				device: 'linux',
				groups: ['release', 'security'],
				owns: { automations: 4, keys: 2 },
			},
			{
				id: 'th',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:22',
				device: 'mac',
				groups: ['oncall', 'release'],
				owns: { keys: 1 },
			},
			{
				id: 'ds',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T08:15',
				device: 'linux',
				groups: ['oncall'],
				owns: { automations: 2, keys: 2 },
			},
			{
				id: 'so',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T09:58',
				device: 'linux',
				groups: ['oncall'],
			},
			{
				id: 'yt',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T22:40',
				device: 'mac',
				groups: [],
			},
			{
				id: 'fr',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:11',
				device: 'win',
				groups: ['beta'],
			},
			{
				id: 'ka',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-07T17:20',
				device: 'linux',
				groups: ['oncall', 'security'],
				owns: { automations: 3, keys: 1 },
			},
			{
				id: 'lm',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T09:20',
				device: 'mac',
				groups: [],
			},
			{
				id: 'jp',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-08T21:05',
				device: 'mac',
				groups: [],
			},
			{
				id: 'im',
				role: 'engineer',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T09:02',
				device: 'linux',
				groups: [],
				owns: { reports: 5, automations: 1 },
			},
			{
				id: 'pd',
				role: 'admin',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T10:28',
				device: 'linux',
				groups: ['security', 'oncall'],
				owns: { keys: 2 },
			},
			{
				id: 'np',
				role: 'engineer',
				status: 'suspended',
				signin: 'password',
				mfa: true,
				last: '2026-09-04T16:15',
				device: 'linux',
				groups: [],
				owns: { automations: 1, keys: 1 },
				suspended: {
					at: '2026-09-07T08:30',
					by: 'as',
					reason: 'Contract paused',
					note: 'Contract restarts in Q1 2027.',
				},
			},
			{
				id: 'ak',
				role: 'engineer',
				status: 'invited',
				signin: 'okta',
				mfa: false,
				last: null,
				invited: { at: '2026-10-08T09:40', by: 'as' },
				groups: [],
			},

			{
				id: 'cr',
				role: 'marketing',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-09T09:35',
				device: 'mac',
				groups: [],
				owns: { reports: 3 },
			},
			{
				id: 'sr',
				role: 'marketing',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-02T15:10',
				device: 'mac',
				groups: [],
			},
			{
				id: 'dk',
				role: 'marketing',
				status: 'active',
				signin: 'google',
				mfa: true,
				last: '2026-10-09T08:05',
				device: 'mac',
				groups: [],
			},
			{
				id: 'pm',
				role: 'marketing',
				status: 'active',
				signin: 'password',
				mfa: false,
				last: '2026-10-05T12:40',
				device: 'win',
				groups: [],
			},

			{
				id: 'rd',
				role: 'accountant',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T09:07',
				device: 'win',
				groups: ['invoices'],
				owns: { reports: 8 },
			},
			{
				id: 'hs',
				role: 'accountant',
				status: 'active',
				signin: 'okta',
				mfa: true,
				last: '2026-10-09T05:50',
				device: 'mac',
				groups: ['invoices', 'west'],
				owns: { reports: 2 },
			},
			{
				id: 'mo',
				role: 'accountant',
				status: 'active',
				signin: 'password',
				mfa: false,
				last: '2026-10-08T14:30',
				device: 'win',
				groups: [],
			},
			{
				id: 'cdu',
				role: 'accountant',
				status: 'deactivated',
				signin: 'okta',
				mfa: true,
				last: '2026-07-30T16:00',
				device: 'mac',
				groups: [],
				deactivated: { at: '2026-07-31T17:30', by: 'ja' },
			},
		],

		/* Extra open sessions on top of the usual device, which comes from
       device, city and last. The profile page lists them. */
		sessions: {
			ja: [{ id: 's-ja-2', device: 'iphone', city: 'Evanston', at: '2026-10-09T07:58' }],
			rc: [{ id: 's-rc-2', device: 'iphone', city: 'Waco', at: '2026-10-08T21:14' }],
			pr: [{ id: 's-pr-2', device: 'android', city: 'Boulder', at: '2026-10-09T08:02' }],
			km: [{ id: 's-km-2', device: 'iphone', city: 'Atlanta', at: '2026-10-08T18:30' }],
			ev: [{ id: 's-ev-2', device: 'ipad', city: 'Akron', at: '2026-10-07T20:10' }],
			pd: [
				{ id: 's-pd-2', device: 'iphone', city: 'Evanston', at: '2026-10-09T06:45' },
				{ id: 's-pd-3', device: 'mac', city: 'Evanston', at: '2026-10-06T15:20' },
			],
			mb: [{ id: 's-mb-2', device: 'iphone', city: 'Milwaukee', at: '2026-10-08T12:05' }],
			bc: [{ id: 's-bc-2', device: 'android', city: 'Stamford', at: '2026-10-08T19:40' }],
		},

		/* A feed of recent work across the workspace, read by the profile page. */
		activity: [
			{
				who: 'ja',
				at: '2026-10-09T10:12',
				icon: 'bi-person-badge',
				text: 'Changed Ben Pearce’s role from Read-only to Support agent',
			},
			{ who: 'ja', at: '2026-10-08T15:40', icon: 'bi-key', text: 'Created the API key “Warehouse sync”' },
			{ who: 'ja', at: '2026-10-06T11:20', icon: 'bi-envelope', text: 'Invited Wren Abbott as Read-only' },
			{ who: 'ja', at: '2026-10-02T10:00', icon: 'bi-envelope', text: 'Invited Jacob Krause as Read-only' },
			{ who: 'rc', at: '2026-10-08T16:05', icon: 'bi-receipt', text: 'Approved the October invoice run' },
			{
				who: 'km',
				at: '2026-10-09T09:24',
				icon: 'bi-sliders',
				text: 'Changed working hours for the Atlanta branch',
			},
			{ who: 'km', at: '2026-09-12T10:00', icon: 'bi-person-slash', text: 'Deactivated Tyler Hogan' },
			{
				who: 'pr',
				at: '2026-10-09T10:29',
				icon: 'bi-ticket',
				text: 'Escalated the Lumora AI sync ticket to Engineering',
			},
			{ who: 'pr', at: '2026-10-09T09:58', icon: 'bi-paperclip', text: 'Attached device logs to ticket #8812' },
			{ who: 'pr', at: '2026-10-07T18:05', icon: 'bi-envelope', text: 'Invited Tamara Ives as Support agent' },
			{
				who: 'ab',
				at: '2026-10-09T10:35',
				icon: 'bi-telephone',
				text: 'Logged a call with the Lumora AI scheduler',
			},
			{
				who: 'bc',
				at: '2026-10-09T09:45',
				icon: 'bi-ticket',
				text: 'Closed 6 tickets about arrival-window texts',
			},
			{
				who: 'ev',
				at: '2026-10-09T09:15',
				icon: 'bi-kanban',
				text: 'Set up a schedule board for Oakhaven Studio’s Plattsburgh branch',
			},
			{
				who: 'gl',
				at: '2026-10-09T08:40',
				icon: 'bi-person-check',
				text: 'Finished onboarding for Coastline Surf Co.',
			},
			{ who: 'th', at: '2026-10-09T10:20', icon: 'bi-rocket', text: 'Shipped hotfix 2.31.1 to the beta channel' },
			{ who: 'ds', at: '2026-10-09T08:10', icon: 'bi-plug', text: 'Rotated the QuickBooks integration secret' },
			{ who: 'as', at: '2026-10-08T09:40', icon: 'bi-envelope', text: 'Invited Sloan Kirby as Engineer' },
			{
				who: 'as',
				at: '2026-09-07T08:30',
				icon: 'bi-pause-circle',
				text: 'Suspended Nina Bledsoe: contract paused',
			},
			{
				who: 'pd',
				at: '2026-10-09T10:25',
				icon: 'bi-shield-check',
				text: 'Turned on 2FA reminders for password sign-ins',
			},
			{
				who: 'hw',
				at: '2026-10-09T08:50',
				icon: 'bi-graph-up',
				text: 'Shared the Travel Planner beta report with Sales',
			},
			{
				who: 'rd',
				at: '2026-10-09T09:05',
				icon: 'bi-receipt',
				text: 'Issued a 20% credit to Lumora AI',
			},
			{
				who: 'hs',
				at: '2026-10-09T05:45',
				icon: 'bi-receipt',
				text: 'Sent 14 overdue invoice reminders in the West',
			},
			{
				who: 'mb',
				at: '2026-10-09T10:38',
				icon: 'bi-person-lines-fill',
				text: 'Updated the Brightline Photography account',
			},
			{ who: 'mo', at: '2026-10-08T14:28', icon: 'bi-download', text: 'Exported September payments' },
			{
				who: 'dr',
				at: '2026-08-28T15:25',
				icon: 'bi-ticket',
				text: 'Handed over 9 open tickets to Ike Parsons',
			},
		],
	};

	/* Sign-ins only carry ids; the roster supplies the rest of the person.
     People who are still invited have no start date yet. */
	const roster = window.Basalt.data.people;
	sample.users = sample.users.map((account) => {
		const member = roster.recordWithId(account.id);
		const profile = {
			name: roster.nameOf(member),
			email: roster.emailOf(member),
			title: member.title,
			team: member.team,
			region: roster.cityOf(member).region,
			city: member.city,
			joined: account.status === 'invited' ? null : member.start,
		};
		return Object.assign(profile, account);
	});

	window.Basalt.userBook = { DEMO: sample, DEMO_NOW: sampleNow };

	/* employee-user-details.html loads this file only for the sample above. */
	const page = pick('[data-us-root]');
	if (!page) return;

	const demoMode = new URLSearchParams(location.search).get('state');
	const prefersStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const openedAt = Date.now();

	const VIEW_KEY = 'basalt-users-view';
	const LAYOUT_KEY = 'basalt-users-layout';
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const STATE_INFO = {
		active: { label: 'Active', rank: 1 },
		invited: { label: 'Invited', rank: 2 },
		suspended: { label: 'Suspended', rank: 3 },
		deactivated: { label: 'Deactivated', rank: 4 },
	};
	const PRESENCE_WORDS = { online: 'Online now', away: 'Away', offline: 'Offline' };
	const SORT_CHOICES = [
		{ id: 'name', name: 'Name' },
		{ id: 'recent', name: 'Last active' },
		{ id: 'role', name: 'Role' },
		{ id: 'team', name: 'Team' },
		{ id: 'status', name: 'Status' },
	];

	/* Storage can be switched off; the page then simply forgets. */
	const memory = {
		read(key) {
			try {
				return localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		write(key, value) {
			try {
				localStorage.setItem(key, value);
			} catch {
				/* Nothing to keep it in. */
			}
		},
	};

	/* Each method stands for one request. The sample answers after a short
     pause; replace a body with a fetch() that resolves the same way. */
	let fetchCount = 0;
	const server = {
		/* GET /api/workspace/users: people, roles, teams, groups and views. */
		fetchWorkspace() {
			fetchCount += 1;
			if (demoMode === 'error' && fetchCount === 1)
				return later(700).then(() => {
					throw new Error('The server took too long to answer.');
				});
			const workspace = copyOf(sample);
			if (demoMode === 'empty') {
				workspace.users = workspace.users.filter((account) => account.id === workspace.me);
				workspace.activity = [];
				workspace.sessions = {};
				workspace.views = workspace.views.filter((tab) => !tab.custom);
			}
			return later(450, workspace);
		},
		/* POST /api/invites { people: [{ email, role, team }], note } */
		sendInvites(invitees, note) {
			return reply(
				600,
				invitees.map((invitee) => ({
					email: invitee.email,
					id: `u-${Math.random().toString(36).slice(2, 8)}`,
				})),
			);
		},
		/* POST /api/invites/:userId/resend */
		resendInvite(userId) {
			return reply(500);
		},
		/* DELETE /api/invites { ids } */
		withdrawInvites(userIds) {
			return reply(250);
		},
		/* PATCH /api/users { ids, role } */
		assignRole(userIds, roleId) {
			return reply(300);
		},
		/* POST /api/users/suspend { ids, reason, note, signOut } */
		suspend(userIds, reason, note, signOut) {
			return reply(350);
		},
		/* POST /api/users/reactivate { ids } */
		reactivate(userIds) {
			return reply(300);
		},
		/* POST /api/users/:id/deactivate { transferTo } */
		deactivate(userId, heirId) {
			return reply(400);
		},
		/* POST /api/users/:id/transfer { to, kinds } */
		handOver(fromId, toId, kinds) {
			return reply(400);
		},
		/* POST /api/users/reset-2fa { ids } */
		resetTwoFactor(userIds) {
			return reply(350);
		},
		/* PUT /api/users: writes earlier copies of these records back (Undo). */
		restore(records) {
			return reply(300);
		},
		/* POST /api/views { name, filter } */
		saveView(tab) {
			return reply(200, tab);
		},
		/* DELETE /api/views/:id */
		dropView(viewId) {
			return reply(200);
		},
		/* POST /api/billing/seats { add } */
		buySeats(extra) {
			return reply(800, { seats: extra });
		},
		/* POST /api/users/export { ids }. The sample writes the CSV itself. */
		logExport(userIds) {
			return later(250);
		},
	};

	/* What the server sent, and a lookup into its people by id. */
	let book = null;
	let people = [];
	let peopleById = new Map();

	/* What the list shows right now. team, role, signin and sort share their
     names with the filter panel's radio groups. */
	const listing = {
		view: memory.read(VIEW_KEY) || 'everyone',
		query: '',
		team: '',
		role: '',
		signin: '',
		sort: 'name',
		direction: 1,
		layout: memory.read(LAYOUT_KEY) === 'cards' ? 'cards' : 'table',
		checked: new Set(),
		visible: [],
		range: [1, 20],
	};

	const ui = {
		figures: pickAll('[data-us-fig]'),
		figureBand: pick('[data-us-kpis]'),
		seatTotal: pick('[data-us-seats-of]'),
		seatButton: pick('[data-us-seats-open]'),
		attention: pick('[data-us-attn]'),
		attentionList: pick('[data-us-attn-list]'),
		directory: pick('[data-us-dir]'),
		viewRadios: pick('[data-us-views]'),
		viewTabs: pick('.us-views-tabs'),
		saveView: pick('[data-us-view-save]'),
		dropView: pick('[data-us-view-delete]'),
		search: pick('[data-us-search]'),
		filterToggle: pick('[data-us-filter-btn]'),
		filterBadge: pick('[data-us-filter-count]'),
		filterPanel: pick('[data-us-filter-panel]'),
		filterDone: pick('[data-us-filter-done]'),
		chips: pick('[data-us-applied]'),
		summary: pick('[data-us-summary]'),
		bulkBar: pick('[data-us-bulk]'),
		bulkCount: pick('[data-us-bulk-count]'),
		bulkRoles: pick('[data-us-bulk-roles]'),
		tableWrap: pick('[data-us-table-wrap]'),
		table: pick('[data-us-table]'),
		rows: pick('[data-us-body]'),
		pageCheck: pick('[data-us-check-page]'),
		cards: pick('[data-us-cards]'),
		noMatch: pick('[data-us-noresults]'),
		noMatchText: pick('[data-us-noresults-text]'),
		emptyState: pick('[data-us-empty]'),
		failure: pick('[data-us-error]'),
		failureText: pick('[data-us-error-text]'),
		retry: pick('[data-us-retry]'),
		pager: pick('[data-us-pager]'),
		perPage: pick('#us-per'),
	};

	/* The pager keeps this object and reads total from it on every change. */
	const pagerSetup = { total: 0, noun: 'people', render: paintSlice };
	let pagerControl = null;

	/* Each dialog remembers who it was opened for until it is submitted. */
	const suspendDialog = { form: pick('[data-us-suspend-form]'), ids: [] };
	const deactivateDialog = { go: pick('[data-us-deact-go]'), heir: pick('[data-us-deact-to]'), id: null };
	const transferDialog = {
		form: pick('[data-us-transfer-form]'),
		heir: pick('[data-us-transfer-to]'),
		error: pick('[data-us-transfer-error]'),
		id: null,
	};
	const confirmDialog = { go: pick('[data-us-confirm-go]'), run: null };
	const inviteDialog = {
		form: pick('[data-us-invite-form]'),
		tags: pick('#us-invite .basalt-tags'),
		typed: pick('#us-invite-emails'),
		error: pick('[data-us-invite-error]'),
		send: pick('[data-us-invite-go]'),
		role: pick('[data-us-invite-role]'),
		team: pick('[data-us-invite-team]'),
		seats: pick('[data-us-invite-seats]'),
	};
	const seatDialog = {
		form: pick('[data-us-seats-form]'),
		extra: pick('[data-us-seats-add]'),
		buy: pick('[data-us-seats-go]'),
	};
	const viewDialog = {
		form: pick('[data-us-view-form]'),
		name: pick('[data-us-view-name]'),
		error: pick('[data-us-view-error]'),
	};
	let searchDelay = 0;

	/** Wires every control on the page, then asks for the workspace. */
	function start() {
		ui.rows.addEventListener('click', onListClick);
		ui.cards.addEventListener('click', onListClick);
		ui.pageCheck.addEventListener('change', onPageCheck);
		ui.bulkBar.addEventListener('click', onBulkClick);
		suspendDialog.form.addEventListener('submit', onSuspendSubmit);
		deactivateDialog.go.addEventListener('basalt:confirm', onDeactivateConfirmed);
		document.getElementById('us-transfer').addEventListener('shown.bs.modal', () => transferDialog.heir.focus());
		transferDialog.form.addEventListener('submit', onTransferSubmit);
		confirmDialog.go.addEventListener('click', onConfirmGo);
		wireInvites();
		wireSeats();
		wireSavedViews();
		wireToolbar();
		ui.retry.addEventListener('click', () => {
			setButton(ui.retry, 'loading');
			loadWorkspace(true);
		});
		loadWorkspace(false);
	}

	/* Loading, and what the page shows when it cannot. */

	/** Draws the placeholder rows, fetches, then paints everything or the error card. */
	function loadWorkspace(isRetry) {
		paintSkeleton();
		ui.tableWrap.hidden = false;
		ui.cards.hidden = true;
		return server
			.fetchWorkspace()
			.then((workspace) => {
				book = workspace;
				people = workspace.users;
				peopleById = new Map(people.map((person) => [person.id, person]));
				markFailed(false);
				paintFilterPanel();
				paintFigures();
				paintSeatTotal();
				paintAttention();
				paintViews();
				refreshList();
				if (isRetry) {
					setButton(ui.retry, 'success');
					say('People loaded.');
				}
			})
			.catch((problem) => {
				ui.failureText.textContent = `${problem?.message ? `${problem.message} ` : ''}Nothing has changed.`;
				ui.summary.textContent = 'Couldn’t load people';
				markFailed(true);
				if (!isRetry) return;
				setButton(ui.retry, 'idle');
				pick('.basalt-empty-title', ui.failure).focus();
			});
	}

	/* A failed load leaves nothing to count, filter or page through. */
	function markFailed(failed) {
		ui.failure.hidden = !failed;
		page.classList.toggle('is-failed', failed);
		ui.figureBand.hidden = failed;
		if (!failed) return;
		for (const part of [ui.attention, ui.tableWrap, ui.cards, ui.pager, ui.noMatch, ui.emptyState, ui.bulkBar])
			part.hidden = true;
	}

	function paintSkeleton() {
		const still = prefersStill ? ' basalt-skeleton-still' : '';
		const bar = (extra) => `<span class="basalt-skeleton basalt-skeleton-text ${extra}${still}"></span>`;
		const ghosts = [];
		for (let line = 0; line < 8; line += 1) {
			const person = `<div class="us-person"><span class="basalt-skeleton basalt-skeleton-circle us-sk-avatar${still}"></span><div class="us-person-text">${bar(`us-sk-w${line % 3}`)}<span class="basalt-skeleton basalt-skeleton-sm us-sk-w3${still}"></span></div></div>`;
			ghosts.push(
				`<tr class="us-row us-row-ghost" aria-hidden="true"><td class="us-col-check">${bar('us-sk-check')}</td><td class="us-col-person">${person}</td><td class="us-col-role">${bar('us-sk-w4')}</td><td class="us-col-team">${bar('us-sk-w5')}</td><td class="us-col-status">${bar('us-sk-w5')}</td><td class="us-col-signin">${bar('us-sk-w5')}</td><td class="us-col-last">${bar('us-sk-w5')}</td><td class="us-col-menu"></td></tr>`,
			);
		}
		ui.rows.innerHTML = ghosts.join('');
		ui.table.setAttribute('aria-busy', 'true');
	}

	/* The list: what matches, in which order, and the page of it on screen. */

	/**
	 * Re-filters, re-sorts and re-pages the list, then brings every control
	 * that describes it up to date.
	 * @param {boolean} [stayOnPage] keep the current page after an edit
	 */
	function refreshList(stayOnPage) {
		listing.visible = ordered(matchingPeople());
		const total = listing.visible.length;
		const inView = people.filter((person) => fitsFilter(person, findView(listing.view).filter)).length;
		const alone = people.length <= 1 && demoMode === 'empty';
		ui.emptyState.hidden = !alone;
		ui.noMatch.hidden = alone || total > 0;
		ui.tableWrap.hidden = alone || !total || listing.layout !== 'table';
		ui.cards.hidden = alone || !total || listing.layout !== 'cards';
		ui.pager.hidden = alone || !total;
		if (!total && !alone) {
			const narrowed = hasToolbarFilters();
			ui.noMatchText.textContent = narrowed
				? `No one in “${findView(listing.view).name}” matches ${listing.query ? `“${listing.query}”` : 'these filters'}. Try another spelling, or clear the filters.`
				: 'Nobody is in this view right now.';
			pick('[data-us-clear]').hidden = !narrowed;
		}
		if (alone) ui.summary.textContent = 'Just you so far';
		else if (total === inView) ui.summary.textContent = amount(total, 'person', 'people');
		else ui.summary.textContent = `${total} of ${amount(inView, 'person', 'people')} match`;

		pagerSetup.total = total;
		if (pagerControl) {
			const pageSize = parseInt(ui.perPage.value, 10) || 20;
			const lastPage = Math.max(1, Math.ceil(total / pageSize));
			const landing = stayOnPage ? Math.min(pagerControl.get(), lastPage) : 1;
			pagerControl.setTotal(lastPage);
			pagerControl.set(landing);
			ui.perPage.dispatchEvent(new Event('change'));
		} else {
			pagerControl = window.Basalt.pager ? window.Basalt.pager(ui.pager, pagerSetup) : null;
			if (!pagerControl) paintSlice(1, total);
		}
		paintChips();
		paintSortHeads();
		syncFilterPanel();
		paintBulkBar();
		paintViewButtons();
	}

	/** Paints rows `from` to `to` (1-based) as table rows or cards. */
	function paintSlice(from, to) {
		listing.range = [from, to];
		const slice = listing.visible.slice(from - 1, to);
		const asTable = listing.layout === 'table';
		if (asTable) {
			ui.rows.innerHTML = slice.map((person) => rowMarkup(person)).join('');
			ui.table.setAttribute('aria-busy', 'false');
		} else {
			ui.cards.innerHTML = slice.map((person) => cardMarkup(person)).join('');
		}
		for (const person of people) delete person.fresh;
		window.Basalt.tips?.(asTable ? ui.rows : ui.cards);
		paintPageCheck();
	}

	function matchingPeople() {
		const tabFilter = findView(listing.view).filter;
		const toolbar = {
			team: listing.team || undefined,
			role: listing.role || undefined,
			signin: listing.signin || undefined,
		};
		return people.filter(
			(person) =>
				fitsFilter(person, tabFilter) && fitsFilter(person, toolbar) && fitsQuery(person, listing.query),
		);
	}

	/* A filter names the values a person must have; any key left out lets everyone through. */
	function fitsFilter(person, filter) {
		if (filter.status && !filter.status.includes(person.status)) return false;
		if (filter.role) {
			const roles = Array.isArray(filter.role) ? filter.role : [filter.role];
			if (!roles.includes(person.role)) return false;
		}
		if (filter.team && filter.team !== person.team) return false;
		if (filter.region && filter.region !== person.region) return false;
		if (filter.signin === '2faoff') {
			if (!lacksTwoFactor(person)) return false;
		} else if (filter.signin && filter.signin !== person.signin) {
			return false;
		}
		return !(filter.mfa === false && !lacksTwoFactor(person));
	}

	/* Every word typed has to appear in the name, email or job title. */
	function fitsQuery(person, query) {
		if (!query) return true;
		const haystack = `${person.name} ${person.email} ${person.title || ''}`.toLowerCase();
		return query
			.toLowerCase()
			.split(/\s+/)
			.every((word) => haystack.includes(word));
	}

	function ordered(list) {
		const byName = (a, b) => a.name.localeCompare(b.name);
		const comparers = {
			name: byName,
			role: (a, b) => findRole(a.role).rank - findRole(b.role).rank || byName(a, b),
			team: (a, b) => a.team.localeCompare(b.team) || byName(a, b),
			status: (a, b) => STATE_INFO[a.status].rank - STATE_INFO[b.status].rank || byName(a, b),
			recent: (a, b) => (fromStamp(b.last) || 0) - (fromStamp(a.last) || 0) || byName(a, b),
		};
		const compare = comparers[listing.sort];
		return list.sort((a, b) => compare(a, b) * listing.direction);
	}

	function hasToolbarFilters() {
		return Boolean(listing.query || listing.team || listing.role || listing.signin);
	}

	function findView(id) {
		return book.views.find((tab) => tab.id === id) || book.views[0];
	}

	/* Facts about people and the workspace. */

	function findRole(id) {
		return book.roles.find((role) => role.id === id) || { name: id, rank: 99 };
	}

	function findSignin(id) {
		return book.signins.find((method) => method.id === id) || { name: id, icon: 'bi-key' };
	}

	function self() {
		return peopleById.get(book.me);
	}

	/* Nobody changes their own access here, and the owner is out of reach. */
	function canManage(person) {
		return person && person.id !== book.me && person.role !== 'owner';
	}

	function ownedTotal(person) {
		let total = 0;
		for (const count of Object.values(person.owns || {})) total += count;
		return total;
	}

	/* Anyone not deactivated is paying for a seat, suspended people included. */
	function seatTally() {
		const tally = { active: 0, invited: 0, suspended: 0 };
		for (const person of people) {
			if (person.status in tally) tally[person.status] += 1;
		}
		const used = tally.active + tally.invited + tally.suspended;
		const total = book.workspace.seats;
		return Object.assign(tally, { used, total, free: Math.max(0, total - used) });
	}

	/* Members answer to their team lead, and leads to the owner. */
	function leadFor(person) {
		if (person.role === 'owner') return null;
		const lead = peopleById.get(book.teams.find((team) => team.id === person.team)?.lead);
		if (lead && lead.id !== person.id) return lead;
		return people.find((other) => other.role === 'owner') || null;
	}

	function lacksTwoFactor(person) {
		return person.status === 'active' && person.signin === 'password' && !person.mfa;
	}

	/** The 2FA wording for one person; ok is null while that is still unknown. */
	function twoFactorLine(person) {
		if (person.status === 'invited') return { text: 'Not set up yet', ok: null };
		if (person.signin !== 'password')
			return { text: `2FA by ${person.signin === 'okta' ? 'Okta' : 'Google'}`, ok: true };
		if (person.mfaReset) return { text: '2FA reset, sets up at next sign-in', ok: false };
		return person.mfa ? { text: '2FA on', ok: true } : { text: '2FA off', ok: false };
	}

	/* Online means active in the last 15 minutes, away in the last two hours. */
	function presenceOf(person) {
		if (person.status !== 'active' || !person.last || person.signedOut) return '';
		const minutes = (clockNow() - fromStamp(person.last)) / 60000;
		if (minutes <= 15) return 'online';
		return minutes <= 120 ? 'away' : 'offline';
	}

	function profileHref(person) {
		return `employee-user-details.html?id=${encodeURIComponent(person.id)}`;
	}

	/* The figures, seat count, shortcuts and view tabs above the list. */

	function paintFigures() {
		const tally = seatTally();
		const values = {
			active: tally.active,
			invited: tally.invited,
			no2fa: people.filter(lacksTwoFactor).length,
			seats: tally.used,
		};
		for (const figure of ui.figures) figure.textContent = values[figure.getAttribute('data-us-fig')];
	}

	function paintSeatTotal() {
		ui.seatTotal.textContent = ` / ${seatTally().total}`;
	}

	/* Shortcuts into the views that need someone to do something. */
	function paintAttention() {
		const tally = seatTally();
		const nudges = [
			{
				view: 'no2fa',
				count: people.filter(lacksTwoFactor).length,
				hue: 'warning',
				icon: 'bi-shield-exclamation',
				words: (n) => `${amount(n, 'person', 'people')} on a password without 2FA`,
				cta: 'See who',
			},
			{
				view: 'invited',
				count: tally.invited,
				hue: 'info',
				icon: 'bi-envelope-paper',
				words: (n) => `${amount(n, 'invite')} not accepted yet`,
				cta: 'Follow up',
			},
			{
				view: 'suspended',
				count: tally.suspended,
				hue: 'accent',
				icon: 'bi-pause-circle',
				words: (n) => `${n} suspended`,
				cta: 'Review',
			},
		].filter((nudge) => nudge.count && book.views.some((tab) => tab.id === nudge.view));
		ui.attention.hidden = !nudges.length;
		ui.attentionList.innerHTML = nudges
			.map(
				(nudge) =>
					`<button type="button" class="us-attn-chip us-attn-chip-${nudge.hue}" data-us-attn-view="${nudge.view}"><i class="bi ${nudge.icon}" aria-hidden="true"></i><span>${htmlSafe(nudge.words(nudge.count))}</span><span class="us-attn-go">${nudge.cta}<i class="bi bi-arrow-right" aria-hidden="true"></i></span></button>`,
			)
			.join('');
	}

	/* The tabs keep their sliding ink; only their radios and labels are rebuilt. */
	function paintViews() {
		if (!book.views.some((tab) => tab.id === listing.view)) listing.view = 'everyone';
		for (const old of pickAll('.btn-check, .nav-link', ui.viewRadios)) old.remove();
		const ink = pick('.basalt-tabs-ink', ui.viewRadios);
		for (const tab of book.views) {
			const radio = document.createElement('input');
			Object.assign(radio, {
				type: 'radio',
				className: 'btn-check',
				name: 'us-view',
				id: `us-view-${tab.id}`,
				value: tab.id,
				checked: tab.id === listing.view,
			});
			const label = document.createElement('label');
			label.className = 'nav-link';
			label.htmlFor = radio.id;
			const members = people.filter((person) => fitsFilter(person, tab.filter)).length;
			const mark = tab.custom ? '<i class="bi bi-bookmark me-1" aria-hidden="true"></i>' : '';
			label.innerHTML = `${mark}${htmlSafe(tab.name)} <span class="basalt-tabs-count">${members}</span>`;
			ui.viewRadios.insertBefore(radio, ink);
			ui.viewRadios.insertBefore(label, ink);
		}
		refreshTabInk();
		paintViewButtons();
	}

	function refreshTabInk() {
		const tabs = window.Basalt.tabs ? window.Basalt.tabs(ui.viewTabs) : null;
		tabs?.refresh?.();
	}

	/* Save appears once the toolbar narrows the list; Delete only for a clean custom view. */
	function paintViewButtons() {
		const narrowed = hasToolbarFilters();
		ui.saveView.hidden = !narrowed;
		ui.dropView.hidden = narrowed || !findView(listing.view).custom;
	}

	function switchView(id) {
		listing.view = id;
		memory.write(VIEW_KEY, id);
		const radio = document.getElementById(`us-view-${id}`);
		if (radio) radio.checked = true;
		refreshTabInk();
		refreshList();
	}

	/* The filter panel and the chips that echo it. */

	function paintFilterPanel() {
		const groups = {
			team: [{ id: '', name: 'Any team' }, ...book.teams.map((team) => ({ id: team.id, name: team.id }))],
			role: [{ id: '', name: 'Any role' }, ...book.roles.map((role) => ({ id: role.id, name: role.name }))],
			signin: [{ id: '', name: 'Any sign-in' }, ...book.signins, { id: '2faoff', name: 'Password, 2FA off' }],
			sort: SORT_CHOICES,
		};
		for (const [group, options] of Object.entries(groups)) {
			pick(`[data-us-chips="${group}"]`, ui.filterPanel).innerHTML = chipRadios(group, options, listing[group]);
		}
		ui.bulkRoles.innerHTML = assignableRoles()
			.map(
				(role) =>
					`<li><button type="button" class="dropdown-item" data-us-bulk-role="${role.id}">${htmlSafe(role.name)}</button></li>`,
			)
			.join('');
	}

	function chipRadios(group, options, current) {
		return options
			.map((option) => {
				const id = `us-f-${group}-${option.id || 'any'}`;
				return `<input type="radio" class="btn-check" name="us-f-${group}" id="${htmlSafe(id)}" value="${htmlSafe(option.id)}"${option.id === current ? ' checked' : ''}><label class="us-chip" for="${htmlSafe(id)}">${htmlSafe(option.name)}</label>`;
			})
			.join('');
	}

	/* Puts the panel's radios, the button's badge and the Done label in step with the list. */
	function syncFilterPanel() {
		for (const group of ['team', 'role', 'signin', 'sort']) {
			const radio = pick(`input[name="us-f-${group}"][value="${CSS.escape(listing[group])}"]`, ui.filterPanel);
			if (radio) radio.checked = true;
		}
		const inUse = [listing.team, listing.role, listing.signin].filter(Boolean).length;
		ui.filterBadge.hidden = !inUse;
		ui.filterBadge.innerHTML = `${inUse}<span class="visually-hidden"> in use</span>`;
		ui.filterToggle.classList.toggle('is-on', inUse > 0);
		const found = listing.visible.length;
		ui.filterDone.textContent = found ? `Show ${amount(found, 'person', 'people')}` : 'Nobody matches';
	}

	function paintChips() {
		const chips = [];
		if (listing.query) {
			chips.push({
				label: `Search: ${listing.query}`,
				remove() {
					ui.search.value = '';
					listing.query = '';
					refreshList();
				},
			});
		}
		if (listing.team)
			chips.push({
				label: `Team: ${listing.team}`,
				remove() {
					dropFilter('team');
				},
			});
		if (listing.role)
			chips.push({
				label: `Role: ${findRole(listing.role).name}`,
				remove() {
					dropFilter('role');
				},
			});
		if (listing.signin) {
			const method = listing.signin === '2faoff' ? 'Password, 2FA off' : findSignin(listing.signin).name;
			chips.push({
				label: `Sign-in: ${method}`,
				remove() {
					dropFilter('signin');
				},
			});
		}
		window.Basalt.drawer?.applied(ui.chips, chips, clearFilters, ui.search);
		ui.chips.hidden = !chips.length;
	}

	function dropFilter(group) {
		listing[group] = '';
		refreshList();
	}

	function clearFilters() {
		Object.assign(listing, { query: '', team: '', role: '', signin: '' });
		ui.search.value = '';
		refreshList();
	}

	function paintSortHeads() {
		for (const head of pickAll('[data-us-th]', ui.table)) {
			const active = head.getAttribute('data-us-th') === listing.sort;
			if (active) head.setAttribute('aria-sort', listing.direction > 0 ? 'ascending' : 'descending');
			else head.removeAttribute('aria-sort');
			const arrow = active
				? listing.direction > 0
					? 'bi-arrow-up'
					: 'bi-arrow-down'
				: 'bi-arrow-down-up us-sort-idle';
			pick('.bi', head).className = `bi ${arrow}`;
		}
	}

	/* Markup for one person, shared by the table rows and the cards. */

	function rowMarkup(person) {
		const isChecked = listing.checked.has(person.id);
		const flags = `${isChecked ? ' is-selected' : ''}${person.fresh ? ' is-fresh' : ''}`;
		const who = `<div class="us-person">${avatarMarkup(person)}<div class="us-person-text"><a class="us-person-name" href="${profileHref(person)}">${htmlSafe(person.name)}</a>${youMarkup(person)}<span class="us-person-sub" title="${htmlSafe(person.email)}">${htmlSafe(person.email)}</span></div></div>`;
		const lastTitle = person.last ? ` title="${htmlSafe(fullWhen(person.last))}"` : '';
		const cells = [
			`<td class="us-col-check">${checkMarkup(person, isChecked)}</td>`,
			`<td class="us-col-person">${who}</td>`,
			`<td class="us-col-role">${rolePill(person)}<span class="us-fold">${teamChip(person)}</span></td>`,
			`<td class="us-col-team">${teamChip(person)}</td>`,
			`<td class="us-col-status">${statePill(person)}<span class="us-fold us-fold-signin">${signinMarkup(person)}</span><span class="us-fold us-fold-last">${lastMarkup(person)}</span></td>`,
			`<td class="us-col-signin">${signinMarkup(person)}</td>`,
			`<td class="us-col-last"${lastTitle}>${lastMarkup(person)}</td>`,
			`<td class="us-col-menu">${quickMarkup(person)}</td>`,
		];
		return `<tr class="us-row${flags}" data-us-id="${person.id}">${cells.join('')}</tr>`;
	}

	function cardMarkup(person) {
		const isChecked = listing.checked.has(person.id);
		const flags = `${person.status === 'deactivated' ? ' is-off' : ''}${isChecked ? ' is-selected' : ''}${person.fresh ? ' is-fresh' : ''}`;
		const top = `<div class="us-card-top">${checkMarkup(person, isChecked)}${quickMarkup(person)}</div>`;
		const who = `<div class="us-card-who">${avatarMarkup(person, 'basalt-avatar-xl')}<span class="us-card-name"><a class="us-person-name" href="${profileHref(person)}">${htmlSafe(person.name)}</a>${youMarkup(person)}</span><span class="us-card-title">${htmlSafe(person.title || findRole(person.role).name)}</span></div>`;
		const tags = `<div class="us-card-tags">${rolePill(person)}${teamChip(person)}</div>`;
		const foot = `<div class="us-card-foot">${statePill(person)}<span class="us-card-last">${lastMarkup(person)}</span>${signinMarkup(person)}</div>`;
		return `<li class="us-card us-tone-${hueFor(person.id)}${flags}" data-us-id="${person.id}">${top}${who}${tags}${foot}</li>`;
	}

	function avatarMarkup(person, size = 'basalt-avatar-sm') {
		const presence = presenceOf(person);
		const dim = person.status === 'deactivated' ? ' us-av-off' : '';
		const dotHue = presence === 'offline' ? '' : ` basalt-avatar-status-dot-${presence}`;
		const dot = presence
			? `<span class="basalt-avatar-status-dot${dotHue}" title="${PRESENCE_WORDS[presence]}" aria-hidden="true"></span>`
			: '';
		return `<span class="basalt-avatar-status us-av-wrap"><span class="basalt-avatar ${size} us-av basalt-avatar-tone-${hueFor(person.id)}${dim}" aria-hidden="true">${htmlSafe(monogram(person.name))}</span>${dot}</span>`;
	}

	/* Hue follows rank; the owner and administrators carry an icon as well. */
	function rolePill(person) {
		const role = findRole(person.role);
		const icon = { 1: 'bi-star-fill', 2: 'bi-shield-fill-check' }[role.rank];
		return `<span class="us-role us-role-${Math.min(role.rank, 9)}">${icon ? `<i class="bi ${icon}" aria-hidden="true"></i>` : ''}${htmlSafe(role.name)}</span>`;
	}

	function teamChip(person) {
		const position = Math.max(
			0,
			book.teams.findIndex((team) => team.id === person.team),
		);
		return `<span class="us-team us-tone-${(position % 8) + 1}">${htmlSafe(person.team)}</span>`;
	}

	function statePill(person) {
		return `<span class="us-state us-state-${person.status}">${STATE_INFO[person.status].label}</span>`;
	}

	function lastMarkup(person) {
		if (presenceOf(person) === 'online') return '<span class="us-online">Online now</span>';
		if (person.status === 'invited') return htmlSafe(`Invited ${monthDay(fromStamp(person.invited.at))}`);
		return htmlSafe(person.last ? sinceLabel(person.last) : 'Never');
	}

	/* Two small badges for the method and 2FA; the tooltip says it in words. */
	function signinMarkup(person) {
		const method = findSignin(person.signin);
		const twoFactor = twoFactorLine(person);
		const mood = twoFactor.ok === false ? 'off' : twoFactor.ok ? 'on' : 'wait';
		const shield = { off: 'bi-shield-exclamation', on: 'bi-shield-fill-check', wait: 'bi-hourglass-split' }[mood];
		const words = htmlSafe(`${method.name}, ${twoFactor.text}`);
		return `<span class="us-signin" role="img" tabindex="0" aria-label="${words}" data-bs-toggle="tooltip" data-bs-title="${words}"><span class="us-signin-method us-signin-method-${htmlSafe(person.signin)}"><i class="bi ${method.icon}" aria-hidden="true"></i></span><span class="us-signin-mfa us-signin-mfa-${mood}"><i class="bi ${shield}" aria-hidden="true"></i>${mood === 'off' ? '2FA off' : ''}</span></span>`;
	}

	function youMarkup(person) {
		return person.id === book.me ? ' <span class="us-tag">You</span>' : '';
	}

	function checkMarkup(person, isChecked) {
		if (canManage(person))
			return `<input class="form-check-input" type="checkbox" data-us-check${isChecked ? ' checked' : ''} aria-label="Check ${htmlSafe(person.name)}">`;
		const why =
			person.id === book.me ? 'You can’t change your own access' : 'Only the owner can change their own access';
		return `<span class="us-nocheck" data-bs-toggle="tooltip" data-bs-title="${why}" tabindex="0" role="img" aria-label="${htmlSafe(person.name)} can’t be checked"><i class="bi bi-lock" aria-hidden="true"></i></span>`;
	}

	/* Open and Change role show on hover or focus; the menu is always there. */
	function quickMarkup(person) {
		let roleSlot = '<span class="us-quick-gap" aria-hidden="true"></span>';
		if (canManage(person) && person.status !== 'deactivated') {
			const choices = assignableRoles()
				.map((role) => {
					const current = role.id === person.role;
					return `<li><button type="button" class="dropdown-item us-roleitem" data-us-role-set="${role.id}"${current ? ' aria-current="true"' : ''}><span class="us-roleitem-dot us-role-${Math.min(role.rank, 9)}" aria-hidden="true"></span>${htmlSafe(role.name)}${current ? '<i class="bi bi-check2 us-roleitem-on" aria-hidden="true"></i>' : ''}</button></li>`;
				})
				.join('');
			roleSlot = `<div class="dropdown us-quick-role"><button type="button" class="btn btn-icon us-quick-btn us-quick-hover" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="Change ${htmlSafe(person.name)}’s role" title="Change role"><i class="bi bi-person-badge" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><span class="dropdown-header">Role for ${htmlSafe(givenName(person.name))}</span></li>${choices}</ul></div>`;
		}
		const open = `<a class="btn btn-icon us-quick-btn us-quick-hover" href="${profileHref(person)}" aria-label="Open ${htmlSafe(person.name)}’s profile" title="Open profile"><i class="bi bi-arrow-up-right-square" aria-hidden="true"></i></a>`;
		return `<div class="us-quick">${open}${roleSlot}${menuMarkup(person)}</div>`;
	}

	/* The ⋯ menu offers only what fits the person's status. */
	function menuMarkup(person) {
		const entry = (act, icon, label, extra = '') =>
			`<li><button type="button" class="dropdown-item${extra}" data-us-act="${act}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</button></li>`;
		const entries = [
			`<li><a class="dropdown-item" href="${profileHref(person)}"><i class="bi bi-person-vcard" aria-hidden="true"></i>Open profile</a></li>`,
		];
		if (canManage(person)) {
			const { status } = person;
			if (status === 'invited')
				entries.push(
					entry('resend', 'bi-send', 'Send the invite again'),
					entry('cancel', 'bi-x-circle', 'Cancel the invite'),
				);
			if (status === 'active') entries.push(entry('suspend', 'bi-pause-circle', 'Suspend'));
			if (status === 'suspended' || status === 'deactivated')
				entries.push(entry('reactivate', 'bi-play-circle', 'Reactivate'));
			if (status === 'active' && person.signin === 'password' && (person.mfa || person.mfaReset))
				entries.push(entry('reset2fa', 'bi-shield-x', 'Reset 2FA'));
			if (ownedTotal(person)) entries.push(entry('transfer', 'bi-arrow-left-right', 'Transfer their work'));
			if (status === 'active' || status === 'suspended')
				entries.push(
					`<li><hr class="dropdown-divider"></li>${entry('deactivate', 'bi-person-slash', 'Deactivate', ' us-danger-item')}`,
				);
		}
		return `<div class="dropdown us-menu"><button type="button" class="btn btn-icon us-quick-btn" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More actions for ${htmlSafe(person.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${entries.join('')}</ul></div>`;
	}

	function assignableRoles() {
		return book.roles.filter((role) => role.manage);
	}

	/* Clicks inside the list, and the checkboxes. */

	function onListClick(event) {
		const holder = event.target.closest('[data-us-id]');
		const person = holder && peopleById.get(holder.getAttribute('data-us-id'));
		if (!person) return;
		const box = event.target.closest('[data-us-check]');
		if (box) {
			setChecked(person.id, box.checked);
			return;
		}
		const roleItem = event.target.closest('[data-us-role-set]');
		if (roleItem) {
			changeRole([person.id], roleItem.getAttribute('data-us-role-set'));
			return;
		}
		const actItem = event.target.closest('[data-us-act]');
		if (actItem) {
			rowActions[actItem.getAttribute('data-us-act')]?.(person);
			return;
		}
		/* Blank space in a row or card opens the profile too, in a new tab
       with Ctrl or Cmd held, the way the name link does. */
		if (event.target.closest('button, a, input, .dropdown, .us-nocheck') || window.getSelection().toString())
			return;
		if (event.metaKey || event.ctrlKey) window.open(profileHref(person), '_blank', 'noopener');
		else location.href = profileHref(person);
	}

	const rowActions = {
		resend: (person) => swallow(resendInvite(person)),
		cancel: (person) => withdrawInvites([person.id]),
		suspend: (person) => openSuspend([person.id]),
		reactivate: (person) => reactivate([person.id]),
		deactivate: (person) => openDeactivate(person),
		transfer: (person) => openTransfer(person),
		reset2fa: (person) => openResetConfirm([person.id]),
	};

	function onPageCheck() {
		const on = ui.pageCheck.checked;
		for (const id of idsOnPage()) setChecked(id, on);
		say(on ? 'Checked everyone on this page.' : 'Unchecked everyone on this page.');
	}

	function idsOnPage() {
		const [from, to] = listing.range;
		return listing.visible
			.slice(from - 1, to)
			.filter(canManage)
			.map((person) => person.id);
	}

	function paintPageCheck() {
		const ids = idsOnPage();
		const ticked = ids.filter((id) => listing.checked.has(id)).length;
		ui.pageCheck.checked = ids.length > 0 && ticked === ids.length;
		ui.pageCheck.indeterminate = ticked > 0 && ticked < ids.length;
		ui.pageCheck.disabled = !ids.length;
	}

	/* Checks on people who are no longer in the workspace are dropped here. */
	function paintBulkBar() {
		for (const id of listing.checked) {
			if (!peopleById.has(id)) listing.checked.delete(id);
		}
		const total = listing.checked.size;
		ui.bulkBar.hidden = !total;
		ui.bulkCount.textContent = `${amount(total, 'person', 'people')} checked`;
	}

	function setChecked(id, on) {
		if (on) listing.checked.add(id);
		else listing.checked.delete(id);
		for (const holder of pickAll(`[data-us-id="${id}"]`, page)) {
			holder.classList.toggle('is-selected', on);
			const box = pick('[data-us-check]', holder);
			if (box) box.checked = on;
		}
		paintPageCheck();
		paintBulkBar();
	}

	function onBulkClick(event) {
		const roleItem = event.target.closest('[data-us-bulk-role]');
		const button = event.target.closest('[data-us-bulk]');
		const ids = [...listing.checked];
		if (roleItem) {
			changeRole(ids, roleItem.getAttribute('data-us-bulk-role'));
			return;
		}
		const task = button?.getAttribute('data-us-bulk');
		if (task === 'clear') {
			for (const id of ids) setChecked(id, false);
			ui.search.focus();
			say('Unchecked everyone.');
		} else if (task === 'suspend') {
			openSuspend(ids);
		} else if (task === 'reset2fa') {
			openResetConfirm(ids);
		} else if (task === 'export') {
			downloadCsv(ids.map((id) => peopleById.get(id)).filter(Boolean), 'The people you checked');
		}
	}

	/* Changes show straight away; a refused call puts the records back. */

	function recordsFor(ids) {
		return ids.map((id) => copyOf(peopleById.get(id))).filter(Boolean);
	}

	/** Swaps saved copies back in, after dropping any records listed in `dropIds`. */
	function restoreRecords(records, dropIds = []) {
		for (const id of dropIds) {
			const at = people.findIndex((person) => person.id === id);
			if (at >= 0) people.splice(at, 1);
		}
		for (const record of records) {
			const at = people.findIndex((person) => person.id === record.id);
			if (at >= 0) people[at] = record;
			else people.push(record);
		}
		peopleById = new Map(people.map((person) => [person.id, person]));
	}

	function repaintAll() {
		peopleById = new Map(people.map((person) => [person.id, person]));
		paintFigures();
		paintSeatTotal();
		paintAttention();
		paintViews();
		refreshList(true);
	}

	/**
	 * Applies a change locally, tells the server, and undoes it if the server says no.
	 * @param {object} plan
	 * @param {string[]} plan.ids      people touched; their records are copied first
	 * @param {Function} plan.change   edits those records in place
	 * @param {Function} plan.call     the server request, returning a promise
	 * @param {{title: string, text: string, icon?: string}} [plan.toast] shown at once
	 * @param {boolean} [plan.undo]    offer Undo in the toast
	 * @param {string} [plan.fail]     toast title if the server refuses
	 * @param {string[]} [plan.added]  new records to remove again on rollback
	 * @returns {Promise} rejects after a rollback
	 */
	function applyChange(plan) {
		const before = recordsFor(plan.ids);
		plan.change();
		repaintAll();
		let toastHandle = null;
		let undone = false;
		if (plan.toast) {
			const undoAction = {
				label: 'Undo',
				onClick() {
					undone = true;
					const after = recordsFor(plan.ids.filter((id) => peopleById.has(id)));
					restoreRecords(copyOf(before), plan.added);
					repaintAll();
					say('Undone.');
					server.restore(before).catch(() => {
						restoreRecords(after);
						repaintAll();
						notify({
							tone: 'danger',
							title: 'Couldn’t undo that',
							text: 'The change is still in place. Try again in a moment.',
						});
					});
				},
			};
			toastHandle = notify({
				tone: 'success',
				icon: plan.toast.icon || 'bi-check2-circle',
				title: plan.toast.title,
				text: plan.toast.text,
				duration: plan.undo ? 8000 : 5000,
				actions: plan.undo ? [undoAction] : [],
			});
		}
		say(plan.toast ? plan.toast.title : 'Saved.');
		return plan.call().catch(() => {
			toastHandle?.dismiss();
			if (!undone) {
				restoreRecords(copyOf(before), plan.added);
				repaintAll();
			}
			notify({
				tone: 'danger',
				title: plan.fail || 'That didn’t save',
				text: 'Nothing was changed. Check your connection and try again.',
			});
			throw new Error('rolled back');
		});
	}

	/* The rollback already told the user; the rejection needs no handler. */
	function swallow(promise) {
		return promise.catch(() => {});
	}

	function changeRole(ids, roleId) {
		const targets = ids
			.map((id) => peopleById.get(id))
			.filter((person) => canManage(person) && person.role !== roleId);
		if (!targets.length) {
			notify({ tone: 'info', title: 'Nothing to change', text: 'They already have that role.' });
			return;
		}
		const role = findRole(roleId);
		const targetIds = targets.map((person) => person.id);
		const title =
			targets.length === 1
				? `${givenName(targets[0].name)} is now ${withArticle(role.name)}`
				: `${amount(targets.length, 'person', 'people')} now have the ${role.name} role`;
		swallow(
			applyChange({
				ids: targetIds,
				change() {
					for (const person of targets) person.role = roleId;
				},
				call: () => server.assignRole(targetIds, roleId),
				toast: { title, text: role.about, icon: 'bi-person-badge' },
				undo: true,
				fail: 'The role didn’t change',
			}),
		);
	}

	function withArticle(word) {
		return `${/^[AEIOU]/i.test(word) ? 'an' : 'a'} ${word}`;
	}

	/* Bringing back a deactivated person needs a free seat for each. */
	function reactivate(ids) {
		const targets = ids
			.map((id) => peopleById.get(id))
			.filter(
				(person) => canManage(person) && (person.status === 'suspended' || person.status === 'deactivated'),
			);
		if (!targets.length) return;
		const seatsNeeded = targets.filter((person) => person.status === 'deactivated').length;
		if (seatsNeeded > seatTally().free) {
			notify({
				tone: 'warning',
				title: 'Not enough free seats',
				text: `Reactivating needs ${amount(seatsNeeded, 'free seat')}. Add seats first, or deactivate someone who has left.`,
				actions: [
					{
						label: 'Add seats',
						onClick() {
							openSeats(seatsNeeded - seatTally().free);
						},
					},
				],
			});
			return;
		}
		const targetIds = targets.map((person) => person.id);
		const who = targets.length === 1 ? givenName(targets[0].name) : amount(targets.length, 'person', 'people');
		swallow(
			applyChange({
				ids: targetIds,
				change() {
					for (const person of targets) {
						person.status = 'active';
						delete person.suspended;
						delete person.deactivated;
						person.signedOut = false;
					}
				},
				call: () => server.reactivate(targetIds),
				toast: {
					title: `${who} can sign in again`,
					text: 'Their role, groups and work are as they were.',
					icon: 'bi-play-circle',
				},
				undo: true,
				fail: 'They weren’t reactivated',
			}),
		);
	}

	function resendInvite(person) {
		return applyChange({
			ids: [person.id],
			change() {
				person.invited = { at: toStamp(clockNow()), by: book.me };
			},
			call: () => server.resendInvite(person.id),
			toast: {
				title: 'Invite sent again',
				text: `A fresh link went to ${person.email}. It works for 7 days.`,
				icon: 'bi-send',
			},
			fail: 'The invite didn’t send',
		});
	}

	/* Canceled invites leave the list at once; Undo writes them back. */
	function withdrawInvites(ids) {
		const targets = ids.map((id) => peopleById.get(id)).filter((person) => person && person.status === 'invited');
		if (!targets.length) return;
		const before = recordsFor(targets.map((person) => person.id));
		for (const person of targets) {
			listing.checked.delete(person.id);
			people.splice(people.indexOf(person), 1);
		}
		repaintAll();
		let undone = false;
		const toastHandle = notify({
			tone: 'success',
			icon: 'bi-x-circle',
			title:
				targets.length === 1
					? `Invite for ${targets[0].email} canceled`
					: `${amount(targets.length, 'invite')} canceled`,
			text: 'The link stops working and the seat is free again.',
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick() {
						undone = true;
						restoreRecords(copyOf(before));
						repaintAll();
						swallow(
							server.restore(before).catch(() => {
								restoreRecords(
									[],
									before.map((record) => record.id),
								);
								repaintAll();
								notify({
									tone: 'danger',
									title: 'Couldn’t undo that',
									text: 'The invite is still canceled.',
								});
							}),
						);
					},
				},
			],
		});
		server.withdrawInvites(targets.map((person) => person.id)).catch(() => {
			toastHandle?.dismiss();
			if (!undone) {
				restoreRecords(copyOf(before));
				repaintAll();
			}
			notify({
				tone: 'danger',
				title: 'The invite wasn’t canceled',
				text: 'Nothing was changed. Try again in a moment.',
			});
		});
	}

	/* Moves the counts of the chosen kinds of work from one person to another. */
	function moveWork(giver, taker, kinds) {
		taker.owns = taker.owns || {};
		for (const kind of kinds) {
			const count = giver.owns?.[kind] || 0;
			if (!count) continue;
			taker.owns[kind] = (taker.owns[kind] || 0) + count;
			delete giver.owns[kind];
		}
	}

	/* Active people, by name, who could take over someone's work. */
	function possibleHeirs(person) {
		return people
			.filter((other) => other.status === 'active' && other.id !== person.id)
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	function ownedWords(person, kinds) {
		return book.ownable
			.filter((kind) => kinds.includes(kind.id) && person.owns[kind.id])
			.map((kind) => amount(person.owns[kind.id], kind.one, kind.many))
			.join(', ');
	}

	/** Builds the CSV in the browser and hands it to the download folder. */
	function downloadCsv(list, who) {
		if (!list.length) return;
		const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
		const header = [
			'Name',
			'Email',
			'Job title',
			'Team',
			'Region',
			'Role',
			'Status',
			'Sign-in',
			'2FA',
			'Last active',
			'Joined',
		];
		const lines = [header.map(quote).join(',')];
		for (const person of list) {
			const fields = [
				person.name,
				person.email,
				person.title,
				person.team,
				person.region,
				findRole(person.role).name,
				STATE_INFO[person.status].label,
				findSignin(person.signin).name,
				twoFactorLine(person).text,
				person.last ? person.last.replace('T', ' ') : '',
				person.joined || '',
			];
			lines.push(fields.map(quote).join(','));
		}
		const file = new Blob([lines.join('\r\n')], { type: 'text/csv' });
		const link = document.createElement('a');
		link.href = URL.createObjectURL(file);
		link.download = `fieldline-users-${toStamp(clockNow()).slice(0, 10)}.csv`;
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		server.logExport(list.map((person) => person.id));
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: `Exported ${amount(list.length, 'person', 'people')}`,
			text: `${who} are in a CSV file in your downloads.`,
		});
	}

	/* Suspend: a reason, an optional note, and whether to sign them out. */

	function openSuspend(ids) {
		const targets = ids
			.map((id) => peopleById.get(id))
			.filter((person) => canManage(person) && person.status === 'active');
		if (!targets.length) {
			notify({
				tone: 'info',
				title: 'Nobody to suspend',
				text: 'Only active people can be suspended. Invites can be canceled instead.',
			});
			return;
		}
		const single = targets.length === 1;
		suspendDialog.ids = targets.map((person) => person.id);
		pick('[data-us-suspend-title]').textContent = single
			? `Suspend ${targets[0].name}?`
			: `Suspend ${amount(targets.length, 'person', 'people')}?`;
		pick('[data-us-suspend-go]').textContent = single
			? `Suspend ${givenName(targets[0].name)}`
			: `Suspend ${targets.length}`;
		suspendDialog.form.reset();
		dialog('us-suspend').show();
	}

	function onSuspendSubmit(event) {
		event.preventDefault();
		const reason = pick('[name="us-reason"]:checked', suspendDialog.form)?.value || 'Other';
		const note = pick('[data-us-suspend-note]').value.trim();
		const signOut = pick('[data-us-suspend-signout]').checked;
		const ids = suspendDialog.ids;
		const targets = ids.map((id) => peopleById.get(id)).filter(Boolean);
		dialog('us-suspend').hide();
		const title =
			targets.length === 1
				? `${targets[0].name} is suspended`
				: `${amount(targets.length, 'person', 'people')} suspended`;
		swallow(
			applyChange({
				ids: ids.slice(),
				change() {
					for (const person of targets) {
						person.status = 'suspended';
						person.suspended = { at: toStamp(clockNow()), by: book.me, reason, note };
						if (signOut) person.signedOut = true;
					}
					for (const person of targets) listing.checked.delete(person.id);
				},
				call: () => server.suspend(ids, reason, note, signOut),
				toast: {
					title,
					text: `${reason}. ${signOut ? 'Signed out everywhere. ' : ''}Reactivate any time.`,
					icon: 'bi-pause-circle',
				},
				undo: true,
				fail: 'Nobody was suspended',
			}),
		);
	}

	/* Deactivate: hold to confirm, handing any work they own to someone else first. */

	function openDeactivate(person) {
		deactivateDialog.id = person.id;
		pick('[data-us-deact-title]').textContent = `Deactivate ${person.name}?`;
		const owns = ownedTotal(person);
		pick('[data-us-deact-transfer]').hidden = !owns;
		if (owns) {
			const { heir } = deactivateDialog;
			pick('[data-us-deact-owns]').textContent = `Hand their ${ownedWords(person, Object.keys(person.owns))} to`;
			heir.innerHTML = possibleHeirs(person)
				.map(
					(other) =>
						`<option value="${other.id}" data-hint="${htmlSafe(other.title)}">${htmlSafe(other.name)}</option>`,
				)
				.join('');
			const lead = leadFor(person);
			heir.value = lead && lead.status === 'active' ? lead.id : book.me;
			window.Basalt.select?.refresh?.(heir);
		}
		dialog('us-deactivate').show();
	}

	function onDeactivateConfirmed() {
		const person = peopleById.get(deactivateDialog.id);
		if (!person) return;
		const heir = ownedTotal(person) ? peopleById.get(deactivateDialog.heir.value) : null;
		const freesSeat = person.status !== 'deactivated';
		setTimeout(() => dialog('us-deactivate').hide(), 350);
		const seatWords = freesSeat ? 'Their seat is free. ' : '';
		const workWords = heir ? `Their work now belongs to ${heir.name}.` : 'They had nothing to hand over.';
		swallow(
			applyChange({
				ids: heir ? [person.id, heir.id] : [person.id],
				change() {
					if (heir) moveWork(person, heir, Object.keys(person.owns || {}));
					person.status = 'deactivated';
					person.deactivated = { at: toStamp(clockNow()), by: book.me };
					delete person.suspended;
					person.groups = [];
					person.signedOut = true;
					listing.checked.delete(person.id);
				},
				call: () => server.deactivate(person.id, heir ? heir.id : null),
				toast: { title: `${person.name} is deactivated`, text: seatWords + workWords, icon: 'bi-person-slash' },
				undo: true,
				fail: 'They weren’t deactivated',
			}),
		);
	}

	/* Transfer: tick the kinds of work, then name an active colleague. */

	function openTransfer(person) {
		transferDialog.id = person.id;
		pick('[data-us-transfer-title]').textContent = `Transfer ${givenName(person.name)}’s work`;
		pick('[data-us-transfer-kinds]').innerHTML = book.ownable
			.filter((kind) => person.owns?.[kind.id])
			.map(
				(kind) =>
					`<div class="form-check"><input class="form-check-input" type="checkbox" id="us-kind-${kind.id}" value="${kind.id}" checked><label class="form-check-label" for="us-kind-${kind.id}"><i class="bi ${kind.icon} me-1" aria-hidden="true"></i>${amount(person.owns[kind.id], kind.one, kind.many)}</label></div>`,
			)
			.join('');
		pick('[data-us-transfer-people]').innerHTML = possibleHeirs(person)
			.map((other) => `<option value="${htmlSafe(other.name)}">`)
			.join('');
		const { heir, error } = transferDialog;
		heir.value = '';
		heir.classList.remove('is-invalid');
		error.hidden = true;
		dialog('us-transfer').show();
	}

	function onTransferSubmit(event) {
		event.preventDefault();
		const { heir: field, error } = transferDialog;
		const person = peopleById.get(transferDialog.id);
		const kinds = pickAll('[data-us-transfer-kinds] input:checked').map((box) => box.value);
		const typed = field.value.trim().toLowerCase();
		const heir = possibleHeirs(person).find((other) => other.name.toLowerCase() === typed);
		let problem = '';
		if (!kinds.length) problem = 'Check at least one thing to move.';
		else if (!heir) problem = 'Pick an active person from the list.';
		error.textContent = problem;
		error.hidden = !problem;
		field.classList.toggle('is-invalid', !heir);
		field.setAttribute('aria-invalid', String(!heir));
		if (problem) {
			(heir ? pick('[data-us-transfer-kinds] input') : field).focus();
			return;
		}
		dialog('us-transfer').hide();
		const moved = ownedWords(person, kinds);
		swallow(
			applyChange({
				ids: [person.id, heir.id],
				change() {
					moveWork(person, heir, kinds);
				},
				call: () => server.handOver(person.id, heir.id, kinds),
				toast: {
					title: `Moved to ${heir.name}`,
					text: `${moved.charAt(0).toUpperCase()}${moved.slice(1)} now belong to ${givenName(heir.name)}.`,
					icon: 'bi-arrow-left-right',
				},
				undo: true,
				fail: 'Nothing was moved',
			}),
		);
	}

	/* Reset 2FA: only password sign-ins have one to reset here. */

	function openResetConfirm(ids) {
		const managed = ids.map((id) => peopleById.get(id)).filter(canManage);
		const leftOut = managed.filter((person) => person.signin !== 'password').length;
		const targets = managed.filter(
			(person) => person.signin === 'password' && person.status === 'active' && (person.mfa || person.mfaReset),
		);
		if (!targets.length) {
			notify({
				tone: 'info',
				title: 'No 2FA to reset',
				text: 'Okta and Google handle 2FA for people who sign in with them. Reset it there.',
			});
			return;
		}
		const single = targets.length === 1;
		const aside = leftOut
			? ` ${amount(leftOut, 'person', 'people')} who sign in with Okta or Google ${leftOut === 1 ? 'is' : 'are'} left out.`
			: '';
		pick('[data-us-confirm-icon]').className = 'bi bi-shield-x';
		pick('[data-us-confirm-title]').textContent = single
			? `Reset ${givenName(targets[0].name)}’s 2FA?`
			: `Reset 2FA for ${amount(targets.length, 'person', 'people')}?`;
		pick('[data-us-confirm-text]').textContent =
			`Their authenticator stops working now, and they set up a new one the next time they sign in. Use this when a phone is lost or replaced.${aside}`;
		confirmDialog.go.textContent = 'Reset 2FA';
		const targetIds = targets.map((person) => person.id);
		confirmDialog.run = () =>
			swallow(
				applyChange({
					ids: targetIds,
					change() {
						for (const person of targets) {
							person.mfa = false;
							person.mfaReset = true;
						}
					},
					call: () => server.resetTwoFactor(targetIds),
					toast: {
						title: single
							? `${givenName(targets[0].name)}’s 2FA is reset`
							: `2FA reset for ${amount(targets.length, 'person', 'people')}`,
						text: 'They set it up again at their next sign-in.',
						icon: 'bi-shield-x',
					},
					fail: '2FA wasn’t reset',
				}),
			);
		dialog('us-confirm').show();
	}

	function onConfirmGo() {
		dialog('us-confirm').hide();
		const run = confirmDialog.run;
		confirmDialog.run = null;
		run?.();
	}

	/* Invite: addresses as tags, a role and team, and a check on free seats. */

	function wireInvites() {
		const { form, tags, typed, error, seats } = inviteDialog;
		for (const opener of pickAll('[data-us-invite-open]')) opener.addEventListener('click', openInvite);
		document.getElementById('us-invite').addEventListener('shown.bs.modal', () => typed.focus());
		tags.addEventListener('change', paintInviteSeats);
		typed.addEventListener('input', paintInviteSeats);
		tags.addEventListener('basalt:tags-duplicate', (event) => {
			error.textContent = `${event.detail.value} is already in the list.`;
			error.hidden = false;
		});
		seats.addEventListener('click', (event) => {
			if (!event.target.closest('[data-us-invite-addseats]')) return;
			const shortBy = inviteAddresses().length - seatTally().free;
			dialog('us-invite').hide();
			openSeats(shortBy);
		});
		form.addEventListener('submit', onInviteSubmit);
	}

	/* Tags plus whatever is still typed, without repeats in any letter case. */
	function inviteAddresses() {
		const { tags, typed } = inviteDialog;
		const tagged = tags.basaltTags ? tags.basaltTags.get() : [];
		const loose = typed.value
			.split(/[,\s]+/)
			.map((part) => part.trim())
			.filter(Boolean);
		const seen = new Set();
		return [...tagged, ...loose].filter((address) => {
			const key = address.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	/** Updates the seat note and send label; false when the invites would not fit. */
	function paintInviteSeats() {
		if (!book) return false;
		const wanted = inviteAddresses().length;
		const free = seatTally().free;
		const tooMany = wanted > free;
		const { seats } = inviteDialog;
		seats.classList.toggle('is-warn', tooMany);
		if (tooMany) {
			const left = free ? `only ${free}${free === 1 ? ' is' : ' are'}` : 'none are';
			seats.innerHTML = `<i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${amount(wanted, 'invite')} need ${amount(wanted, 'seat')}, and ${left} free. <button type="button" class="us-inline-link" data-us-invite-addseats>Add seats</button></span>`;
		} else {
			const line = wanted
				? `Uses ${wanted} of your ${amount(free, 'free seat')}.`
				: `${amount(free, 'seat')} free on the ${htmlSafe(book.workspace.plan)}.`;
			seats.innerHTML = `<i class="bi bi-person-check" aria-hidden="true"></i><span>${line}</span>`;
		}
		pick('[data-us-invite-label]').textContent = wanted > 1 ? `Send ${wanted} invites` : 'Send invite';
		return !tooMany;
	}

	function openInvite() {
		if (!book) return;
		const { form, tags, error, role, team, send } = inviteDialog;
		form.reset();
		tags.basaltTags?.set([]);
		error.hidden = true;
		tags.classList.remove('is-invalid');
		role.innerHTML = assignableRoles()
			.map(
				(option) =>
					`<option value="${option.id}" data-hint="${htmlSafe(option.about)}">${htmlSafe(option.name)}</option>`,
			)
			.join('');
		role.value = 'readonly';
		team.innerHTML = book.teams
			.map((option) => `<option value="${htmlSafe(option.id)}">${htmlSafe(option.id)}</option>`)
			.join('');
		team.value = self() ? self().team : book.teams[0].id;
		for (const select of [role, team]) window.Basalt.select?.refresh?.(select);
		setButton(send, 'idle');
		paintInviteSeats();
		dialog('us-invite').show();
	}

	function inviteProblem(addresses) {
		if (!addresses.length) return 'Add at least one email address.';
		const malformed = addresses.filter((address) => !EMAIL_SHAPE.test(address));
		if (malformed.length)
			return `Check ${malformed.join(', ')}. ${malformed.length === 1 ? 'It doesn’t' : 'They don’t'} look like an email address.`;
		const known = addresses.filter((address) =>
			people.some((person) => person.email.toLowerCase() === address.toLowerCase()),
		);
		if (known.length)
			return `${known.join(', ') + (known.length === 1 ? ' already has' : ' already have')} a sign-in.`;
		return paintInviteSeats() ? '' : 'Add seats first, or invite fewer people.';
	}

	function onInviteSubmit(event) {
		event.preventDefault();
		const { tags, typed, error, send } = inviteDialog;
		const addresses = inviteAddresses();
		const problem = inviteProblem(addresses);
		error.textContent = problem;
		error.hidden = !problem;
		tags.classList.toggle('is-invalid', Boolean(problem));
		typed.setAttribute('aria-invalid', String(Boolean(problem)));
		if (problem) {
			typed.focus();
			return;
		}
		const roleId = inviteDialog.role.value;
		const teamName = inviteDialog.team.value;
		const note = pick('[data-us-invite-note]').value.trim();
		const me = self();
		const region = me ? me.region : 'Northeast';
		const invitees = addresses.map((address) => ({
			id: `u-${Math.random().toString(36).slice(2, 9)}`,
			name: guessName(address),
			email: address.toLowerCase(),
			title: findRole(roleId).name,
			team: teamName,
			region,
			city: me ? me.city : '',
			role: roleId,
			status: 'invited',
			signin: 'okta',
			mfa: false,
			last: null,
			joined: null,
			invited: { at: toStamp(clockNow()), by: book.me },
			groups: [],
			fresh: true,
		}));
		const inviteeIds = invitees.map((invitee) => invitee.id);
		setButton(send, 'loading');
		/* The new rows appear now; the dialog stays open until the server answers. */
		people.push(...invitees);
		repaintAll();
		server
			.sendInvites(
				invitees.map((invitee) => ({ email: invitee.email, role: roleId, team: teamName })),
				note,
			)
			.then(() => {
				setButton(send, 'success');
				setTimeout(() => dialog('us-invite').hide(), 500);
				let undone = false;
				notify({
					tone: 'success',
					icon: 'bi-send',
					title:
						invitees.length === 1
							? `Invite sent to ${invitees[0].email}`
							: `${amount(invitees.length, 'invite')} sent`,
					text: `They join as ${findRole(roleId).name} in ${teamName}. Links work for 7 days.`,
					duration: 8000,
					actions: [
						{
							label: 'Undo',
							onClick() {
								if (undone) return;
								undone = true;
								restoreRecords([], inviteeIds);
								repaintAll();
								server.withdrawInvites(inviteeIds).catch(() => {
									people.push(...invitees);
									repaintAll();
									notify({
										tone: 'danger',
										title: 'Couldn’t undo that',
										text: 'The invites are still out.',
									});
								});
							},
						},
					],
				});
			})
			.catch(() => {
				restoreRecords([], inviteeIds);
				repaintAll();
				setButton(send, 'error');
				setTimeout(() => setButton(send, 'idle'), 1600);
				error.textContent = 'The invites didn’t send. Nothing was changed; try again.';
				error.hidden = false;
			});
	}

	/* Seats: a stepper from 1 to 100 and the monthly cost it adds. */

	function wireSeats() {
		ui.seatButton.addEventListener('click', () => openSeats(5));
		seatDialog.extra.addEventListener('input', paintSeatCost);
		seatDialog.extra.addEventListener('change', paintSeatCost);
		seatDialog.form.addEventListener('submit', onSeatSubmit);
	}

	function seatsRequested() {
		return Math.max(1, Math.min(100, parseInt(seatDialog.extra.value, 10) || 1));
	}

	function paintSeatCost() {
		const extra = seatsRequested();
		const { pricePerSeat, seats } = book.workspace;
		pick('[data-us-seats-cost]').innerHTML =
			`<i class="bi bi-receipt" aria-hidden="true"></i><span>${amount(extra, 'seat')} add <strong>$${(extra * pricePerSeat).toLocaleString('en-US')} a month</strong>, $${pricePerSeat} each. You’ll have ${seats + extra} seats; the next invoice covers the part of this month that’s left.</span>`;
	}

	function openSeats(suggested) {
		if (!book) return;
		seatDialog.extra.value = String(Math.max(1, suggested || 5));
		pick('[data-us-seats-sub]').textContent =
			`You have ${book.workspace.seats} seats and ${amount(seatTally().free, 'free one')}. Suspended people keep their seat; deactivating frees it.`;
		setButton(seatDialog.buy, 'idle');
		paintSeatCost();
		dialog('us-seats-modal').show();
	}

	function onSeatSubmit(event) {
		event.preventDefault();
		const extra = seatsRequested();
		const { buy } = seatDialog;
		setButton(buy, 'loading');
		server
			.buySeats(extra)
			.then(() => {
				book.workspace.seats += extra;
				setButton(buy, 'success');
				repaintAll();
				setTimeout(() => dialog('us-seats-modal').hide(), 500);
				notify({
					tone: 'success',
					icon: 'bi-person-plus',
					title: `${amount(extra, 'seat')} added`,
					text: `You now have ${book.workspace.seats} seats, ${seatTally().free} of them free.`,
				});
			})
			.catch(() => {
				setButton(buy, 'error');
				setTimeout(() => setButton(buy, 'idle'), 1600);
				notify({
					tone: 'danger',
					title: 'No seats were added',
					text: 'Your card wasn’t charged. Try again in a moment.',
				});
			});
	}

	/* Saved views: keep the current filters as a tab, or delete a custom one. */

	function wireSavedViews() {
		const { form, name } = viewDialog;
		ui.saveView.addEventListener('click', openSaveView);
		document.getElementById('us-view-modal').addEventListener('shown.bs.modal', () => {
			name.focus();
			name.select();
		});
		form.addEventListener('submit', onSaveViewSubmit);
		ui.dropView.addEventListener('click', deleteCurrentView);
	}

	function openSaveView() {
		const { form, name, error } = viewDialog;
		form.reset();
		error.hidden = true;
		name.classList.remove('is-invalid');
		const methodName = listing.signin === '2faoff' ? '2FA off' : findSignin(listing.signin).name;
		const suggestion = [
			listing.team,
			listing.role && findRole(listing.role).name,
			listing.signin && methodName,
		].filter(Boolean);
		name.value = suggestion.join(', ').slice(0, 32);
		const current = findView(listing.view);
		pick('[data-us-view-sub]').textContent =
			`Keeps ${current.id === 'everyone' ? 'these filters' : `“${current.name}” with these filters`} one click away.`;
		dialog('us-view-modal').show();
	}

	function onSaveViewSubmit(event) {
		event.preventDefault();
		const { name: field, error } = viewDialog;
		const name = field.value.trim();
		let problem = '';
		if (!name) problem = 'Give the view a name.';
		else if (book.views.some((tab) => tab.name.toLowerCase() === name.toLowerCase()))
			problem = `There is already a view called “${name}”.`;
		error.textContent = problem;
		error.hidden = !problem;
		field.classList.toggle('is-invalid', Boolean(problem));
		field.setAttribute('aria-invalid', String(Boolean(problem)));
		if (problem) {
			field.focus();
			return;
		}
		const filter = copyOf(findView(listing.view).filter);
		for (const group of ['team', 'role', 'signin']) {
			if (listing[group]) filter[group] = listing[group];
		}
		const tab = { id: `v-${Date.now().toString(36)}`, name, custom: true, filter };
		book.views.push(tab);
		listing.view = tab.id;
		memory.write(VIEW_KEY, tab.id);
		dialog('us-view-modal').hide();
		/* The new tab holds the filters now, so the toolbar is cleared. */
		clearFilters();
		paintViews();
		server
			.saveView(tab)
			.then(() => {
				notify({
					tone: 'success',
					icon: 'bi-bookmark-check',
					title: 'View saved',
					text: `“${name}” is in the row of views.`,
				});
			})
			.catch(() => {
				book.views.splice(book.views.indexOf(tab), 1);
				listing.view = 'everyone';
				paintViews();
				refreshList();
				notify({ tone: 'danger', title: 'The view wasn’t saved', text: 'Try again in a moment.' });
			});
	}

	function deleteCurrentView() {
		const tab = findView(listing.view);
		if (!tab.custom) return;
		const position = book.views.indexOf(tab);
		const putTabBack = () => book.views.splice(position, 0, tab);
		book.views.splice(position, 1);
		listing.view = 'everyone';
		memory.write(VIEW_KEY, 'everyone');
		paintViews();
		refreshList();
		pick('#us-view-everyone')?.focus();
		let undone = false;
		const toastHandle = notify({
			tone: 'success',
			icon: 'bi-bookmark-x',
			title: `View “${tab.name}” deleted`,
			text: 'Nobody’s access changed; only the shortcut is gone.',
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick() {
						undone = true;
						putTabBack();
						listing.view = tab.id;
						paintViews();
						refreshList();
						swallow(server.saveView(tab));
					},
				},
			],
		});
		server.dropView(tab.id).catch(() => {
			toastHandle?.dismiss();
			if (!undone) {
				putTabBack();
				paintViews();
				refreshList();
			}
			notify({ tone: 'danger', title: 'The view wasn’t deleted', text: 'Try again in a moment.' });
		});
	}

	/* The toolbar: search, filters, sorting, tabs, layout and export. */

	function wireToolbar() {
		ui.search.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => {
				listing.query = ui.search.value.trim();
				refreshList();
			}, 140);
		});
		ui.search.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !ui.search.value) return;
			event.preventDefault();
			ui.search.value = '';
			listing.query = '';
			refreshList();
		});

		/* Filter chips apply as they are picked; the list changes behind the panel. */
		ui.filterPanel.addEventListener('change', (event) => {
			const radio = event.target;
			if (!radio.matches('.btn-check')) return;
			const group = radio.name.replace('us-f-', '');
			listing[group] = radio.value;
			if (group === 'sort') listing.direction = 1;
			refreshList();
		});
		ui.filterToggle.addEventListener('shown.bs.dropdown', focusPickedChip);
		ui.filterDone.addEventListener('click', () => {
			bootstrap.Dropdown.getOrCreateInstance(ui.filterToggle).hide();
			ui.filterToggle.focus();
		});
		pick('[data-us-filter-clear]').addEventListener('click', () => {
			clearFilters();
			focusPickedChip();
		});

		ui.attentionList.addEventListener('click', (event) => {
			const nudge = event.target.closest('[data-us-attn-view]');
			if (!nudge) return;
			clearFilters();
			switchView(nudge.getAttribute('data-us-attn-view'));
			ui.directory.scrollIntoView({ behavior: prefersStill ? 'auto' : 'smooth', block: 'start' });
			say(`Showing ${findView(listing.view).name}: ${ui.summary.textContent}.`);
		});

		for (const header of pickAll('[data-us-sort-by]', ui.table)) {
			header.addEventListener('click', () => {
				const column = header.getAttribute('data-us-sort-by');
				if (listing.sort === column) {
					listing.direction = -listing.direction;
				} else {
					listing.sort = column;
					listing.direction = 1;
				}
				refreshList();
				say(
					`Sorted by ${header.textContent.trim().toLowerCase()}${listing.direction > 0 ? '' : ', reversed'}.`,
				);
			});
		}

		ui.viewRadios.addEventListener('change', (event) => {
			if (!event.target.matches('.btn-check')) return;
			listing.view = event.target.value;
			memory.write(VIEW_KEY, listing.view);
			refreshList();
		});

		for (const option of pickAll('input[name="us-layout"]')) {
			option.checked = option.value === listing.layout;
			option.addEventListener('change', () => {
				if (!option.checked) return;
				listing.layout = option.value;
				memory.write(LAYOUT_KEY, option.value);
				refreshList(true);
			});
		}

		pick('[data-us-clear]').addEventListener('click', () => {
			clearFilters();
			ui.search.focus();
		});
		pick('[data-us-export-all]').addEventListener('click', () => {
			if (!book) return;
			downloadCsv(
				listing.visible,
				listing.visible.length === people.length ? 'Everyone' : 'The people in this list',
			);
		});

		/* A slash anywhere outside a field or open dialog jumps to the search box. */
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
			if (
				event.target.closest?.(
					'input, textarea, select, [contenteditable="true"], .modal.show, .offcanvas.show',
				)
			)
				return;
			event.preventDefault();
			ui.search.focus();
		});
	}

	function focusPickedChip() {
		pick('.btn-check:checked', ui.filterPanel)?.focus();
	}

	/* Small tools: lookups, markup safety, wording and the sample clock. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function copyOf(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function setButton(button, phase) {
		if (button && window.Basalt.buttonState) window.Basalt.buttonState(button, phase);
	}

	function dialog(id) {
		return bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
	}

	function later(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	/* Under ?state=fail every write is refused after the same pause. */
	function reply(ms, value) {
		if (demoMode !== 'fail') return later(ms, value);
		return later(ms).then(() => {
			throw new Error('The server said no');
		});
	}

	/** "3 people", "1 invite": the count with the right form of the noun. */
	function amount(count, one, many) {
		return `${count} ${count === 1 ? one : many || `${one}s`}`;
	}

	function givenName(wholeName) {
		return String(wholeName).split(' ')[0];
	}

	function monogram(wholeName) {
		return wholeName
			.split(/\s+/)
			.filter(Boolean)
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	/* The same id always lands on the same of the eight avatar hues. */
	function hueFor(id) {
		let hash = 0;
		for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
		return (hash % 8) + 1;
	}

	/* jo.krause@x.com becomes "Jo Krause", until the person fills in their name. */
	function guessName(address) {
		return address
			.split('@')[0]
			.split(/[._-]+/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	/* The sample clock starts at sampleNow and runs on from the page load. */
	function clockNow() {
		return new Date(sampleNow.getTime() + (Date.now() - openedAt));
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function toStamp(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	function fromStamp(text) {
		if (!text) return null;
		const [datePart, timePart] = text.split('T');
		const [year, month, day] = datePart.split('-').map(Number);
		const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
		return new Date(year, month - 1, day, hours, minutes);
	}

	function agoDays(date) {
		const midnight = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
		return Math.round((midnight(clockNow()) - midnight(date)) / 86400000);
	}

	function clockTime(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())} ${hours < 12 ? 'am' : 'pm'}`;
	}

	function monthDay(date) {
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/* The short "last active" used in the list: Just now, 12 min ago, Yesterday, Tue, Oct 6. */
	function sinceLabel(text) {
		const date = fromStamp(text);
		if (!date) return '';
		const minutes = Math.round((clockNow() - date) / 60000);
		const days = agoDays(date);
		if (minutes < 2) return 'Just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (days === 0) return `${Math.floor(minutes / 60)} h ago`;
		if (days === 1) return 'Yesterday';
		if (days < 7) return `${WEEKDAY_ABBR[date.getDay()]}, ${monthDay(date)}`;
		return monthDay(date);
	}

	/* The longer form for tooltips: Today at 9:47 am, Oct 2 at 3:10 pm. */
	function fullWhen(text) {
		const date = fromStamp(text);
		if (!date) return '';
		const prefix = { 0: 'Today', 1: 'Yesterday' }[agoDays(date)] || monthDay(date);
		return `${prefix} at ${clockTime(date)}`;
	}

	start();
})();
