/**
 * Access requests, used by access-requests.html. Everyone in the Fieldline
 * workspace who wants more than their role allows (a different role, one
 * raised permission, or either of those for a fixed span) lands in a queue.
 * An approver sees the exact difference first, then approves, denies with a
 * note, or approves until a chosen moment. Live time-boxed grants tick down
 * and can be cut short.
 *
 * Bringing your own data: swap SAMPLE for what your backend returns, or let
 * server.fetchAll() request it, since every row, count and figure is derived
 * from it. Then fill in the server methods, one per call. The page updates
 * first and reverts, with an error toast, whenever a call rejects.
 * Demo switches: ?state=empty, ?state=error (the first fetch fails and Try
 * again recovers) and ?state=offline (every save fails, to show the revert).
 * Parts borrowed from basalt.js: the Headers block, tabs, segmented controls,
 * styled selects, choice tiles, the tag input, avatars, the drawer, hold and
 * two-step confirms, typed confirmation, undo toasts, copy and loading
 * buttons, pagination, skeletons and empty states.
 */
(() => {
	'use strict';

	const host = pick('[data-ar-root]');
	if (!host) return;

	/* The whole sample workspace. Times read "YYYY-MM-DD HH:MM" in the
     viewer's zone; replace the object with your own of the same shape. */
	const SAMPLE = {
		/* The moment the sample treats as the present. A live page reads the
       real clock instead (see currentTime). */
		now: '2026-10-02 10:20',
		me: 'ja',
		requestLink: 'https://app.fieldline.app/admin/access-requests/',

		/* Areas a permission can reach, and the depth of reach by index:
       0 None, 1 View, 2 Edit, 3 Manage. */
		resources: [
			['customers', 'Customers'],
			['billing', 'Billing and invoices'],
			['dispatch', 'Online store'],
			['reports', 'Reports'],
			['integrations', 'Integrations'],
			['apikeys', 'API keys'],
			['settings', 'Settings'],
			['users', 'Users'],
		],
		levels: ['None', 'View', 'Edit', 'Manage'],

		/* Every role's depth on each area, listed in the area order above. */
		roles: {
			Owner: [3, 3, 3, 3, 3, 3, 3, 3],
			Administrator: [3, 2, 3, 3, 3, 3, 3, 3],
			Accountant: [1, 3, 0, 1, 0, 0, 1, 0],
			'Support agent': [2, 1, 1, 1, 0, 0, 0, 0],
			'Store manager': [2, 0, 3, 2, 1, 0, 1, 1],
			Engineer: [1, 0, 1, 1, 3, 2, 2, 0],
			'Read-only': [1, 0, 1, 1, 0, 0, 0, 0],
		},

		/* Rows of [id, name, job title, team, region, role, sign-in (password, google or okta)]. */
		people: [
			['ja', 'John Armstrong', 'Chief Technology Officer', 'Engineering', 'Northeast', 'Administrator', 'okta'],
			['lb', 'Laura Ellery', 'Chief executive', 'Operations', 'Northeast', 'Owner', 'okta'],
			['ka', 'Jim Atkins', 'Security lead', 'Engineering', 'Midwest', 'Administrator', 'okta'],
			['pr', 'Connie Reese', 'Support lead', 'Support', 'Northeast', 'Support agent', 'password'],
			['hs', 'Hope Stout', 'Billing specialist', 'Finance', 'West', 'Accountant', 'okta'],
			['th', 'Todd Hatcher', 'Backend engineer', 'Engineering', 'Midwest', 'Engineer', 'okta'],
			['mb', 'Quentin Cook', 'Account executive', 'Sales', 'Northeast', 'Read-only', 'google'],
			['ab', 'Alexis Boone', 'Operations manager', 'Operations', 'South', 'Store manager', 'google'],
			['lf', 'Francis Franklin', 'Support specialist', 'Support', 'South', 'Read-only', 'password'],
			['ne', 'Norma Eaton', 'Scheduling operations lead', 'Operations', 'Midwest', 'Store manager', 'google'],
			['dm', 'Randall Manning', 'Onboarding specialist', 'Success', 'South', 'Support agent', 'google'],
			['do', 'Marshall Nugent', 'Site reliability engineer', 'Engineering', 'Midwest', 'Engineer', 'okta'],
			['sl', 'Pamela Leach', 'Accountant', 'Finance', 'Midwest', 'Read-only', 'okta'],
			['rk', 'Edith Kendall', 'Support specialist', 'Support', 'West', 'Support agent', 'password'],
			['ed', 'Erica Davis', 'Lifecycle marketing', 'Marketing', 'Midwest', 'Read-only', 'google'],
			['oh', 'Isaac Hanson', 'Platform engineer', 'Engineering', 'Midwest', 'Engineer', 'okta'],
			['gl', 'Courtney Lowry', 'Product manager', 'Product', 'West', 'Read-only', 'google'],
			['ir', 'Beverly Ramsey', 'Support specialist', 'Support', 'South', 'Support agent', 'password'],
			['ta', 'Terry Mead', 'Support specialist', 'Support', 'Midwest', 'Support agent', 'password'],
			['rm', 'Russ Patton', 'Sales operations', 'Sales', 'West', 'Read-only', 'google'],
			['ym', 'Audrey Mack', 'Data engineer', 'Engineering', 'West', 'Engineer', 'okta'],
			['fn', 'Felicia Norton', 'Head of Customer Success', 'Success', 'Midwest', 'Support agent', 'google'],
			['ms', 'Elsie Schneider', 'Content lead', 'Marketing', 'Midwest', 'Read-only', 'google'],
			['bc', 'Ben Pearce', 'Sales manager', 'Sales', 'Northeast', 'Read-only', 'google'],
		],

		/* Still undecided. ask holds { res, from, to } for a single permission
       or { role, from } for a new role; hours is filled only when the
       access was asked for a limited span. risk is low, medium or high,
       and riskWhy spells out what the access would let them do.
       approvals lists [person id, time] pairs given so far. */
		requests: [
			{
				id: '#1052',
				who: 'th',
				ask: { res: 'apikeys', from: 2, to: 3 },
				hours: 4,
				sent: '2026-10-02 09:30',
				reason: 'Rotating the Stripe and QuickBooks keys after Tuesday’s vendor notice.',
				risk: 'high',
				riskWhy: 'Manage on API keys can create and revoke the keys that customers’ integrations depend on.',
				approvals: [['ka', '2026-10-02 09:41']],
			},
			{
				id: '#1051',
				who: 'ab',
				ask: { role: 'Administrator', from: 'Store manager' },
				hours: null,
				sent: '2026-10-02 07:55',
				reason: 'Taking over workspace setup for the rollout in the South.',
				risk: 'high',
				riskWhy: 'Administrators can change settings, users and API keys for the whole workspace.',
				approvals: [],
			},
			{
				id: '#1050',
				who: 'pr',
				ask: { res: 'billing', from: 1, to: 2 },
				hours: 24,
				sent: '2026-10-02 08:12',
				reason: 'Clearing the refund backlog from the September 29 outage.',
				risk: 'medium',
				riskWhy: 'Edit on billing lets her issue credits and refunds, up to the account limit.',
				approvals: [],
			},
			{
				id: '#1049',
				who: 'mb',
				ask: { res: 'customers', from: 1, to: 2 },
				hours: null,
				sent: '2026-10-01 15:47',
				reason: 'Fixing company details on trial workspaces without a ticket.',
				risk: 'medium',
				riskWhy: 'Edit on customers covers every account, not only his trials.',
				approvals: [],
			},
			{
				id: '#1048',
				who: 'lf',
				ask: { role: 'Support agent', from: 'Read-only' },
				hours: null,
				sent: '2026-10-01 11:02',
				reason: 'Onboarding done. Ready for the Spanish queue on Monday.',
				risk: 'low',
				riskWhy: 'Support agent is the standard role for his team.',
				approvals: [],
			},
			{
				id: '#1047',
				who: 'hs',
				ask: { res: 'reports', from: 1, to: 2 },
				hours: null,
				sent: '2026-09-30 23:15',
				reason: 'Saving the monthly board revenue report as a custom report.',
				risk: 'low',
				riskWhy: 'Edit on reports only changes saved reports, not the data under them.',
				approvals: [],
			},
			{
				id: '#1046',
				who: 'ne',
				ask: { res: 'integrations', from: 1, to: 3 },
				hours: null,
				sent: '2026-09-30 14:20',
				reason: 'Connecting Google Calendar so the team sees its visits.',
				risk: 'medium',
				riskWhy: 'Manage on integrations can connect outside apps that read visit and customer data.',
				approvals: [],
			},
		],

		/* Time-boxed access running right now; by names whoever approved it. */
		grants: [
			{
				id: '#1044',
				who: 'dm',
				ask: { res: 'settings', from: 0, to: 2 },
				from: '2026-10-02 09:05',
				until: '2026-10-02 11:05',
				by: ['ja'],
				reason: 'New visit forms for Brightline Photography’s onboarding.',
			},
			{
				id: '#1043',
				who: 'do',
				ask: { res: 'apikeys', from: 2, to: 3 },
				from: '2026-10-02 08:00',
				until: '2026-10-02 14:00',
				by: ['ka', 'ja'],
				reason: 'Rotating webhook signing keys after Wednesday’s incident.',
			},
			{
				id: '#1039',
				who: 'sl',
				ask: { res: 'billing', from: 0, to: 1 },
				from: '2026-09-30 17:00',
				until: '2026-10-03 17:00',
				by: ['lb'],
				reason: 'Matching invoices to the ledger for quarter-end.',
			},
			{
				id: '#1036',
				who: 'rk',
				ask: { res: 'dispatch', from: 1, to: 2 },
				from: '2026-09-28 09:00',
				until: '2026-10-05 09:00',
				by: ['ja'],
				reason: 'Covering Bellingham bookings during their scheduler’s leave.',
			},
		],

		/* Past outcomes, in no set order. decision is one of approved,
       temporary, denied, revoked (cut short) or expired (ran its
       course); hours is the span a temporary grant was given. */
		history: [
			{
				id: '#1044',
				who: 'dm',
				ask: { res: 'settings', from: 0, to: 2 },
				decision: 'temporary',
				hours: 2,
				at: '2026-10-02 09:05',
				by: ['ja'],
				note: 'Ends after the onboarding call.',
			},
			{
				id: '#1043',
				who: 'do',
				ask: { res: 'apikeys', from: 2, to: 3 },
				decision: 'temporary',
				hours: 6,
				at: '2026-10-02 08:00',
				by: ['ka', 'ja'],
				note: '',
			},
			{
				id: '#1042',
				who: 'ed',
				ask: { res: 'customers', from: 1, to: 2 },
				decision: 'denied',
				at: '2026-10-01 16:30',
				by: ['ja'],
				note: 'Customer records belong to Success. Ask Felicia for an export.',
			},
			{
				id: '#1041',
				who: 'oh',
				ask: { role: 'Administrator', from: 'Engineer' },
				decision: 'denied',
				at: '2026-10-01 10:12',
				by: ['lb'],
				note: 'Ask for Manage on Settings for the SSO change window instead.',
			},
			{
				id: '#1040',
				who: 'gl',
				ask: { res: 'reports', from: 1, to: 2 },
				decision: 'approved',
				at: '2026-09-30 18:20',
				by: ['ka'],
				note: '',
			},
			{
				id: '#1039',
				who: 'sl',
				ask: { res: 'billing', from: 0, to: 1 },
				decision: 'temporary',
				hours: 72,
				at: '2026-09-30 17:00',
				by: ['lb'],
				note: 'For the quarter-end close.',
			},
			{
				id: '#1038',
				who: 'ir',
				ask: { role: 'Support agent', from: 'Read-only' },
				decision: 'approved',
				at: '2026-09-30 09:30',
				by: ['ja'],
				note: 'Welcome to the queue.',
			},
			{
				id: '#1037',
				who: 'ta',
				ask: { res: 'billing', from: 1, to: 2 },
				decision: 'revoked',
				hours: 24,
				at: '2026-09-29 15:10',
				by: ['ja'],
				note: 'Refunds done, so access ended early.',
			},
			{
				id: '#1036',
				who: 'rk',
				ask: { res: 'dispatch', from: 1, to: 2 },
				decision: 'temporary',
				hours: 168,
				at: '2026-09-28 09:00',
				by: ['ja'],
				note: '',
			},
			{
				id: '#1035',
				who: 'rm',
				ask: { res: 'integrations', from: 0, to: 3 },
				decision: 'denied',
				at: '2026-09-26 14:05',
				by: ['ka'],
				note: 'Engineering runs the Salesforce sync. Ask Todd.',
			},
			{
				id: '#1034',
				who: 'ym',
				ask: { res: 'apikeys', from: 2, to: 3 },
				decision: 'expired',
				hours: 4,
				at: '2026-09-25 06:00',
				by: ['ka', 'lb'],
				note: '',
			},
			{
				id: '#1033',
				who: 'fn',
				ask: { res: 'customers', from: 2, to: 3 },
				decision: 'approved',
				at: '2026-09-24 11:40',
				by: ['ja'],
				note: 'Needed to merge duplicate accounts.',
			},
			{
				id: '#1032',
				who: 'ms',
				ask: { res: 'users', from: 0, to: 1 },
				decision: 'denied',
				at: '2026-09-22 10:15',
				by: ['ja'],
				note: 'Announcements already lists the team. Users shows sign-in details.',
			},
			{
				id: '#1031',
				who: 'bc',
				ask: { res: 'reports', from: 1, to: 2 },
				decision: 'approved',
				at: '2026-09-21 16:50',
				by: ['lb'],
				note: '',
			},
		],

		/* Rules for requests. The Owner may approve whatever the flags say. */
		policy: {
			approverAdmin: true,
			approverBilling: true,
			approverDispatch: false,
			defaultHours: 24,
			maxHours: 168,
			warnBeforeEnd: true,
			twoAdminRole: true,
			twoApiKeys: true,
			twoBillingManage: true,
			twoUsers: false,
			twoHighRisk: false,
			notify: ['#it-access', 'security@fieldline.app'],
			remindHours: 24,
		},
	};

	/* Each server method stands for one request to your backend. In the demo
     they resolve after a short pause; replace a body with fetch() and keep
     what it resolves to. */
	const scenario = new URLSearchParams(location.search).get('state');
	let loadShouldFail = scenario === 'error';

	const server = {
		/** GET /api/access-requests: requests, grants, history, people and policy in one payload. */
		fetchAll() {
			if (loadShouldFail) {
				loadShouldFail = false;
				return pause(600).then(() => {
					throw new Error('The server did not answer');
				});
			}
			const payload = structuredClone(SAMPLE);
			if (scenario === 'empty') Object.assign(payload, { requests: [], grants: [], history: [] });
			return pause(500, payload);
		},
		/** POST /api/access-requests/:id/approve with { hours or until, note }. */
		approveRequest(id, terms) {
			return settle(350);
		},
		/** POST /api/access-requests/:id/approvals, the first of two sign-offs. */
		recordFirstApproval(id) {
			return settle(300);
		},
		/** POST /api/access-requests/:id/deny with { note }. */
		denyRequest(id, note) {
			return settle(300);
		},
		/** DELETE /api/access-requests/:id/decision */
		reopenRequest(id) {
			return settle(300);
		},
		/** POST /api/access-requests/:id/reminders with { people }. */
		nudgeApprovers(id, people) {
			return settle(700);
		},
		/** DELETE /api/access-grants/:id */
		endGrant(id) {
			return settle(300);
		},
		/** POST /api/access-grants/:id/restore */
		reinstateGrant(id) {
			return settle(300);
		},
		/** POST /api/access-grants/revoke-all */
		endAllGrants(ids) {
			return settle(500);
		},
		/** PUT /api/access-requests/policy with { policy }. */
		storePolicy(rules) {
			return settle(600);
		},
	};

	/* What the page is showing right now, and the payload it came from. */
	let workspace = null;
	const view = {
		pending: true,
		broken: false,
		requests: [],
		grants: [],
		decisions: [],
		rules: null,
		queueText: '',
		queueKind: 'all',
		queueOrder: 'risk',
		historyText: '',
		historyVerdict: 'all',
		historyPage: 1,
		openId: null,
	};

	/* The sample's clock starts at SAMPLE.now and then runs in real time.
     A live page would simply return new Date() from currentTime. */
	const sampleStart = readStamp(SAMPLE.now);
	const bootedAt = Date.now();

	const ROWS_PER_PAGE = 8;
	const HOUR = 3600000;
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const RISK_LOOK = {
		high: { rank: 3, tone: 'danger', icon: 'bi-shield-exclamation', label: 'High risk' },
		medium: { rank: 2, tone: 'warning', icon: 'bi-shield', label: 'Medium risk' },
		low: { rank: 1, tone: 'success', icon: 'bi-shield-check', label: 'Low risk' },
	};
	const VERDICT_LOOK = {
		approved: { tone: 'success', icon: 'bi-check2-circle', label: 'Approved' },
		temporary: { tone: 'info', icon: 'bi-hourglass-split', label: 'Approved for a while' },
		denied: { tone: 'danger', icon: 'bi-x-circle', label: 'Denied' },
		revoked: { tone: 'warning', icon: 'bi-x-octagon', label: 'Revoked early' },
		expired: { tone: '', icon: 'bi-clock', label: 'Ended on time' },
	};
	/* The history word for each choice in the drawer. */
	const HISTORY_WORD = { approve: 'approved', temporary: 'temporary', deny: 'denied' };
	const QUEUE_ORDERS = {
		risk(a, b) {
			return RISK_LOOK[b.risk].rank - RISK_LOOK[a.risk].rank || readStamp(a.sent) - readStamp(b.sent);
		},
		oldest(a, b) {
			return readStamp(a.sent) - readStamp(b.sent);
		},
		newest(a, b) {
			return readStamp(b.sent) - readStamp(a.sent);
		},
	};
	/* Areas that weigh more when the review drawer picks which rows to show. */
	const SENSITIVE_AREAS = ['apikeys', 'users', 'settings', 'billing'];
	const POLICY_SWITCHES = [
		'approverAdmin',
		'approverBilling',
		'approverDispatch',
		'warnBeforeEnd',
		'twoAdminRole',
		'twoApiKeys',
		'twoBillingManage',
		'twoUsers',
		'twoHighRisk',
	];

	const ui = {
		figures: {
			waiting: pick('[data-ar-fig="waiting"]'),
			high: pick('[data-ar-fig="high"]'),
			grants: pick('[data-ar-fig="grants"]'),
		},
		tabCounts: { queue: pick('[data-ar-count="queue"]'), grants: pick('[data-ar-count="grants"]') },
		queue: pick('[data-ar-queue]'),
		queueEmpty: pick('[data-ar-queue-empty]'),
		queueStatus: pick('[data-ar-queue-status]'),
		queueSearch: pick('[data-ar-queue-search]'),
		queueKind: pick('[data-ar-queue-type]'),
		queueOrder: pick('[data-ar-queue-sort]'),
		grants: pick('[data-ar-grants]'),
		grantsEmpty: pick('[data-ar-grants-empty]'),
		revokeAllButton: pick('[data-ar-revoke-all-btn]'),
		history: pick('[data-ar-history]'),
		historyEmpty: pick('[data-ar-history-empty]'),
		historyStatus: pick('[data-ar-history-status]'),
		historySearch: pick('[data-ar-history-search]'),
		historyVerdict: pick('[data-ar-history-decision]'),
		historyScroller: pick('.ar-table-wrap', host),
		pagerBar: pick('[data-ar-pager-wrap]'),
		pagerList: pick('[data-ar-pager]'),
		pagerRange: pick('[data-ar-history-range]'),
		policy: pick('[data-ar-policy]'),
		policyState: pick('[data-ar-policy-state]'),
		policySave: pick('[data-ar-policy-save]'),
		policyReset: pick('[data-ar-policy-reset]'),
		notify: pick('[data-ar-notify]'),
		sheet: document.getElementById('ar-review'),
		revokeAll: document.getElementById('ar-revoke-all'),
	};
	const decisionForm = pick('[data-ar-decide]', ui.sheet);
	const drawerFoot = pick('.basalt-drawer-foot', ui.sheet);
	const choice = {
		set: pick('[data-ar-decide-set]', ui.sheet),
		expiry: pick('[data-ar-expiry]', ui.sheet),
		custom: pick('[data-ar-custom]', ui.sheet),
		until: pick('[data-ar-until]', ui.sheet),
		ends: pick('[data-ar-ends]', ui.sheet),
		note: pick('[data-ar-note]', ui.sheet),
		noteLabel: pick('[data-ar-note-label]', ui.sheet),
		waiting: pick('[data-ar-waiting]', ui.sheet),
		go: pick('[data-ar-go]', ui.sheet),
		hold: pick('[data-ar-hold]', ui.sheet),
		holdLabel: pick('[data-ar-hold-label]', ui.sheet),
	};
	const columnLabels = {};
	let pager = null;
	let shadowFrame = 0;
	let ticker = 0;

	start();

	/** Builds the column labels, wires every control, starts the clocks and fetches the data. */
	function start() {
		columnLabels.queue = addColumnLabels(ui.queue, 'ar-head-as-req', {
			who: 'Person',
			acc: 'Access',
			chg: 'Change',
			req: 'Request',
			flags: 'Risk',
			end: 'Waiting',
		});
		columnLabels.grants = addColumnLabels(ui.grants, 'ar-head-grant', {
			who: 'Person',
			acc: 'Access',
			chg: 'Change',
			req: 'Request',
			time: 'Time left',
		});

		for (const [target, type, handler, options] of listeners()) target.addEventListener(type, handler, options);
		wireRevokeAll();
		wireClocks();
		loadAll();
	}

	/* Listeners, as [target, event, handler, options] rows. Search boxes
     wait 110ms after the last key; the selects apply at once. The drawer
     rows cover the reminder button, toasts that make way for it, and the
     shadow on whichever part stays pinned while the rest scrolls. */
	function listeners() {
		const passive = { passive: true };
		return [
			[
				ui.queueSearch,
				'input',
				afterTyping(() => {
					view.queueText = ui.queueSearch.value;
					paintQueue();
				}),
			],
			[
				ui.queueKind,
				'change',
				() => {
					view.queueKind = ui.queueKind.value;
					paintQueue();
				},
			],
			[
				ui.queueOrder,
				'change',
				() => {
					view.queueOrder = ui.queueOrder.value;
					paintQueue();
				},
			],
			[
				ui.historySearch,
				'input',
				afterTyping(() => {
					view.historyText = ui.historySearch.value;
					view.historyPage = 1;
					paintHistory();
				}),
			],
			[
				ui.historyVerdict,
				'change',
				() => {
					view.historyVerdict = ui.historyVerdict.value;
					view.historyPage = 1;
					paintHistory();
				},
			],
			[host, 'click', onHostClick],
			[ui.grants, 'basalt:confirm', onRevokeConfirm],

			[decisionForm, 'change', onDecisionChange],
			[
				choice.until,
				'input',
				() => {
					choice.until.classList.remove('is-invalid');
					syncChoice();
				},
			],
			[
				choice.note,
				'input',
				() => {
					if (choice.note.value.trim().length >= 3) choice.note.classList.remove('is-invalid');
				},
			],
			[
				decisionForm,
				'submit',
				(event) => {
					event.preventDefault();
					if (!choice.go.hidden) decide();
				},
			],
			[choice.go, 'click', decide],
			[choice.hold, 'basalt:confirm', () => setTimeout(decide, prefersStill() ? 0 : 250)],

			[ui.sheet, 'click', onRemindClick],
			[ui.sheet, 'show.bs.offcanvas', () => moveToasts('top-center')],
			[sheetPart('body'), 'scroll', syncShadows, passive],
			[ui.sheet, 'scroll', syncShadows, passive],
			[ui.sheet, 'shown.bs.offcanvas', syncShadows],
			[ui.sheet, 'change', syncShadows],
			[window, 'resize', syncShadows],
			[ui.sheet, 'hidden.bs.offcanvas', onDrawerHidden],

			[ui.policy, 'input', syncPolicyFooter],
			[ui.policy, 'change', syncPolicyFooter],
			[
				ui.policy,
				'submit',
				(event) => {
					event.preventDefault();
					commitPolicy();
				},
			],
			[
				ui.policyReset,
				'click',
				() => {
					writePolicyForm(view.rules);
					say('Changes discarded.');
				},
			],
		];
	}

	/** Wraps a handler so it runs once typing has paused for 120ms. */
	function afterTyping(run) {
		let delay = 0;
		return () => {
			clearTimeout(delay);
			delay = setTimeout(run, 120);
		};
	}

	/**
	 * One listener for every button the page draws, tried in order. A click
	 * anywhere on a queue row opens it as well, unless it landed on a control
	 * inside the row; the row's Review button is the keyboard route.
	 */
	function onHostClick({ target }) {
		const routes = [
			['[data-ar-open]', (node) => openReview(node.dataset.arOpen)],
			[
				'.ar-req[data-ar-id]',
				(node) => (target.closest('button, a, input') ? false : openReview(node.dataset.arId)),
			],
			['[data-ar-retry]', () => loadAll()],
			['[data-ar-clear]', (node) => clearFilters(node.dataset.arClear)],
			['[data-ar-goto]', (node) => showTab(pick(node.dataset.arGoto))],
			['[data-ar-next]', () => reviewNext()],
		];
		for (const [selector, act] of routes) {
			const node = target.closest(selector);
			if (node && act(node) !== false) return;
		}
	}

	function showTab(tab) {
		bootstrap.Tab.getOrCreateInstance(tab).show();
		tab.focus();
	}

	function clearFilters(list) {
		const [search, select, paint] =
			list === 'queue'
				? [ui.queueSearch, ui.queueKind, paintQueue]
				: [ui.historySearch, ui.historyVerdict, paintHistory];
		search.value = '';
		select.value = 'all';
		if (list === 'queue') Object.assign(view, { queueText: '', queueKind: 'all' });
		else Object.assign(view, { historyText: '', historyVerdict: 'all', historyPage: 1 });
		paint();
		search.focus();
	}

	/** The header's Review next button, also bound to the N key. */
	function reviewNext() {
		if (view.pending || view.broken) return;
		const next = nextForMe();
		if (next) return openReview(next.id);
		const text = view.requests.length ? 'The requests left need someone else’s approval.' : 'The queue is empty.';
		notify({ tone: 'info', icon: 'bi-inbox', title: 'Nothing waiting for you', text });
	}

	function onRevokeConfirm({ target }) {
		const trigger = target.closest('[data-ar-revoke]');
		if (trigger) revokeOne(trigger.dataset.arRevoke);
	}

	function onDecisionChange({ target }) {
		if (target === choice.until) choice.until.classList.remove('is-invalid');
		syncChoice();
	}

	/** Focus goes back to the Review button of the request that was open, when it is still listed. */
	function onDrawerHidden() {
		moveToasts('bottom-end');
		const button = view.openId ? pick(`[data-ar-open="${view.openId}"]`, ui.queue) : null;
		view.openId = null;
		button?.focus();
	}

	function wireRevokeAll() {
		const dialog = ui.revokeAll;
		dialog.addEventListener('show.bs.modal', () => {
			const lines = view.grants.map(
				({ who, ask }) =>
					`<li><i class="bi bi-x-circle" aria-hidden="true"></i>${htmlSafe(profile(who).name)}: ${htmlSafe(askHeadline(ask))}</li>`,
			);
			pick('[data-ar-revoke-all-list]', dialog).innerHTML = lines.join('');
			pick('[data-ar-revoke-all-sub]', dialog).textContent =
				`${countOf(view.grants.length, 'person goes', 'people go')} back to their own role straight away.`;
			pick('[data-basalt-type-confirm]', dialog).basaltTyped?.reset();
		});
		dialog.addEventListener('shown.bs.modal', () => pick('input', dialog).focus());
		pick('[data-ar-revoke-all-go]', dialog).addEventListener('click', revokeEverything);
	}

	/**
	 * Countdowns tick each second and rest while the tab is hidden. Waiting
	 * ages in the queue move once a minute, unless focus is inside the list.
	 */
	function wireClocks() {
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) return clearInterval(ticker);
			countDown();
			runCountdown();
		});
		runCountdown();
		setInterval(() => {
			const idle = workspace && !view.pending && !document.hidden;
			if (idle && !ui.queue.contains(document.activeElement)) paintQueue();
		}, 60000);
	}

	function runCountdown() {
		clearInterval(ticker);
		ticker = setInterval(countDown, 1000);
	}

	/* Fetching the data and drawing the lists and figures from it. */

	function loadAll() {
		view.pending = true;
		view.broken = false;
		repaint();
		ui.policy.setAttribute('aria-busy', 'true');
		server
			.fetchAll()
			.then((payload) => {
				workspace = payload;
				const { requests, grants, history: decisions, policy: rules } = payload;
				Object.assign(view, { requests, grants, decisions, rules, pending: false });
				writePolicyForm(view.rules);
				ui.policy.setAttribute('aria-busy', 'false');
				repaint();
			})
			.catch(() => {
				view.pending = false;
				view.broken = true;
				repaint();
			});
	}

	/** Redraws every list and figure. The policy form waits for data and says so when none arrives. */
	function repaint() {
		const unavailable = view.pending || view.broken;
		for (const group of pickAll('fieldset', ui.policy)) group.disabled = unavailable;
		if (unavailable) {
			ui.policyState.textContent = view.pending
				? 'Loading the policy…'
				: 'The policy did not load. Try again from the Waiting tab.';
		}
		paintFigures();
		paintQueue();
		paintGrants();
		paintHistory();
	}

	/** A dash stands in until the numbers are known, so a failed load never reads as zero. */
	function paintFigures() {
		const known = !view.pending && !view.broken;
		const pairs = [
			[ui.figures.waiting, view.requests.length],
			[ui.figures.high, view.requests.filter((request) => request.risk === 'high').length],
			[ui.figures.grants, view.grants.length],
			[ui.tabCounts.queue, view.requests.length],
			[ui.tabCounts.grants, view.grants.length],
		];
		for (const [node, amount] of pairs) node.textContent = known ? String(amount) : '–';
	}

	function paintQueue() {
		ui.queue.setAttribute('aria-busy', String(view.pending));
		columnLabels.queue.hidden = true;
		if (view.pending) {
			ui.queue.innerHTML = placeholderRows(4, 'ar-req');
			ui.queueEmpty.hidden = true;
			ui.queueStatus.textContent = 'Loading requests…';
			return;
		}
		if (view.broken) {
			ui.queue.innerHTML = '';
			ui.queueStatus.textContent = '';
			return showNote(ui.queueEmpty, loadFailure('requests'));
		}
		const shown = orderRequests(view.requests.filter(requestFits));
		ui.queue.innerHTML = shown.map(requestRow).join('');
		columnLabels.queue.hidden = !shown.length;
		showNote(ui.queueEmpty, queueEmptyState(shown));

		const narrowed = view.queueText.trim() || view.queueKind !== 'all';
		ui.queueStatus.textContent =
			shown.length && narrowed ? `Showing ${shown.length} of ${countOf(view.requests.length, 'request')}.` : '';
		window.Basalt.avatars?.(ui.queue);
	}

	function queueEmptyState(shown) {
		if (!view.requests.length) {
			return blankNote({
				icon: 'bi-inbox',
				title: 'Nothing waiting for review',
				text: 'When someone asks for more access, the request lands here and approvers get a message at the addresses in Policy.',
				actions: view.grants.length
					? '<button type="button" class="btn btn-sm btn-outline-secondary" data-ar-goto="#ar-tab-grants">See temporary access</button>'
					: '',
			});
		}
		if (shown.length) return '';
		const needle = view.queueText.trim();
		if (needle) {
			return blankNote({
				icon: 'bi-search',
				title: `No requests match “${htmlSafe(needle)}”`,
				text: `Search looks at names, teams, roles, the access asked for and the reasons${view.queueKind === 'all' ? '' : ', in this kind of request only'}.`,
				actions:
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-ar-clear="queue">Clear the search</button>',
			});
		}
		return blankNote({
			icon: 'bi-funnel',
			title: 'None of this kind waiting',
			text: `There are ${countOf(view.requests.length, 'other request')} in the queue.`,
			actions:
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-ar-clear="queue">Show every kind</button>',
		});
	}

	function requestFits(request) {
		if (view.queueKind !== 'all' && requestKind(request) !== view.queueKind) return false;
		const needle = view.queueText.trim().toLowerCase();
		if (!needle) return true;
		const asker = profile(request.who);
		const haystack = [
			asker.name,
			asker.title,
			asker.team,
			asker.role,
			askHeadline(request.ask),
			request.ask.from,
			request.reason,
			request.id,
		];
		return haystack.join(' ').toLowerCase().includes(needle);
	}

	function orderRequests(requests) {
		return [...requests].sort(QUEUE_ORDERS[view.queueOrder]);
	}

	/** The next request the viewer can act on, in the queue's current order. */
	function nextForMe() {
		return orderRequests(view.requests).find(
			(request) => mayDecide(request) && !(wantsSecondApprover(request) && alreadySigned(request)),
		);
	}

	function paintGrants() {
		const unavailable = view.pending || view.broken;
		ui.grants.setAttribute('aria-busy', String(view.pending));
		ui.revokeAllButton.disabled = unavailable || !view.grants.length;
		columnLabels.grants.hidden = unavailable || !view.grants.length;
		if (view.pending) {
			ui.grants.innerHTML = placeholderRows(3, 'ar-grant');
			ui.grantsEmpty.hidden = true;
			return;
		}
		if (view.broken) {
			ui.grants.innerHTML = '';
			return showNote(ui.grantsEmpty, loadFailure('temporary access'));
		}
		const soonestFirst = [...view.grants].sort((a, b) => readStamp(a.until) - readStamp(b.until));
		ui.grants.innerHTML = soonestFirst.map(grantRow).join('');
		showNote(
			ui.grantsEmpty,
			soonestFirst.length
				? ''
				: blankNote({
						icon: 'bi-hourglass',
						title: 'No temporary access in use',
						text: 'Approve a request “For a while” and it shows here with the time it has left. It ends on its own.',
					}),
		);
		window.Basalt.avatars?.(ui.grants);
		window.Basalt.buttons?.(ui.grants);
		countDown();
	}

	/** Runs every second: grants past their end lapse, the rest update their countdown and bar. */
	function countDown() {
		if (!workspace || view.pending || view.broken) return;
		const moment = currentTime();
		const lapsed = view.grants.filter((grant) => readStamp(grant.until) <= moment);
		if (lapsed.length) {
			for (const grant of lapsed) lapse(grant);
			return;
		}
		for (const { id, from, until } of view.grants) {
			const row = pick(`[data-ar-grant="${id}"]`, ui.grants);
			if (row) paintCountdown(row, readStamp(from), readStamp(until), moment);
		}
	}

	/** Time left as text, the bar's fill and spoken value, and the warning tint in the last hour. */
	function paintCountdown(row, opened, closes, moment) {
		const remaining = closes - moment;
		const spent = Math.min(100, Math.max(0, Math.round(((moment - opened) / (closes - opened)) * 100)));
		const meter = pick('[data-ar-bar]', row);
		pick('[data-ar-left]', row).textContent = remainingText(remaining);
		meter.style.setProperty('--ar-used', `${spent}%`);
		for (const [name, value] of Object.entries({
			'aria-valuenow': String(spent),
			'aria-valuetext': `${remainingSpoken(remaining)} left`,
		}))
			meter.setAttribute(name, value);
		row.classList.toggle('is-ending', remaining < HOUR);
	}

	/** A grant that reached its end moves to the history as expired. */
	function lapse(grant) {
		const slot = view.grants.indexOf(grant);
		if (slot < 0) return;
		const { id, who, ask, until, by } = grant;
		view.grants.splice(slot, 1);
		view.decisions.push({
			id,
			who,
			ask,
			decision: 'expired',
			hours: grantHours(grant),
			at: until,
			by: [...by],
			note: '',
		});
		repaint();
		const { name, role } = profile(who);
		notify({
			tone: 'info',
			icon: 'bi-clock',
			title: 'Temporary access ended',
			text: `${name} is back to ${role} access.`,
		});
	}

	function paintHistory() {
		ui.history.closest('table').setAttribute('aria-busy', String(view.pending));
		if (view.pending) {
			ui.history.innerHTML =
				`<tr aria-hidden="true">${'<td><span class="basalt-skeleton basalt-skeleton-text"></span></td>'.repeat(5)}</tr>`.repeat(
					5,
				);
			ui.historyEmpty.hidden = true;
			ui.pagerBar.hidden = true;
			ui.historyScroller.hidden = false;
			return;
		}
		if (view.broken) {
			ui.history.innerHTML = '';
			ui.historyStatus.textContent = '';
			ui.historyScroller.hidden = true;
			ui.pagerBar.hidden = true;
			return showNote(ui.historyEmpty, loadFailure('history'));
		}
		const matches = view.decisions.filter(decisionFits).sort((a, b) => readStamp(b.at) - readStamp(a.at));
		const pageCount = Math.max(1, Math.ceil(matches.length / ROWS_PER_PAGE));
		view.historyPage = Math.min(view.historyPage, pageCount);
		const offset = (view.historyPage - 1) * ROWS_PER_PAGE;
		ui.history.innerHTML = matches
			.slice(offset, offset + ROWS_PER_PAGE)
			.map(decisionRow)
			.join('');
		ui.historyScroller.hidden = !matches.length;
		ui.pagerBar.hidden = matches.length <= ROWS_PER_PAGE;
		ui.pagerRange.innerHTML = matches.length
			? `<strong>${offset + 1}–${Math.min(matches.length, offset + ROWS_PER_PAGE)}</strong> of ${countOf(matches.length, 'decision')}`
			: '';
		syncPager(pageCount);

		showNote(ui.historyEmpty, historyEmptyState(matches));
		const narrowed = view.historyText.trim() || view.historyVerdict !== 'all';
		ui.historyStatus.textContent =
			matches.length && narrowed ? `${countOf(matches.length, 'decision')} found.` : '';
		window.Basalt.avatars?.(ui.history);
	}

	/** Creates the shared pagination control on first use and keeps it in step after that. */
	function syncPager(pageCount) {
		if (!window.Basalt.pagination) return;
		if (pager) {
			pager.setTotal(pageCount);
			if (pager.get() !== view.historyPage) pager.set(view.historyPage);
			return;
		}
		function onChange(page) {
			view.historyPage = page;
			paintHistory();
		}
		pager = window.Basalt.pagination(ui.pagerList, {
			label: 'History page',
			total: pageCount,
			current: view.historyPage,
			onChange,
		});
	}

	function historyEmptyState(matches) {
		if (!view.decisions.length) {
			return blankNote({
				icon: 'bi-clock-history',
				title: 'No decisions yet',
				text: 'Every approval, denial and early revoke is kept here, with the note sent to the person.',
			});
		}
		if (matches.length) return '';
		const needle = view.historyText.trim();
		if (needle) {
			return blankNote({
				icon: 'bi-search',
				title: `No decisions match “${htmlSafe(needle)}”`,
				text: 'Search looks at names, teams, the access asked for, notes and approvers.',
				actions:
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-ar-clear="history">Clear the search</button>',
			});
		}
		return blankNote({
			icon: 'bi-funnel',
			title: 'No decisions of this kind',
			text: 'Try another decision, or show them all.',
			actions:
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-ar-clear="history">Show every decision</button>',
		});
	}

	function decisionFits(entry) {
		if (view.historyVerdict !== 'all' && entry.decision !== view.historyVerdict) return false;
		const needle = view.historyText.trim().toLowerCase();
		if (!needle) return true;
		const asker = profile(entry.who);
		const approvers = entry.by.map((id) => profile(id).name).join(' ');
		return [asker.name, asker.team, askHeadline(entry.ask), entry.ask.from, entry.note, entry.id, approvers]
			.join(' ')
			.toLowerCase()
			.includes(needle);
	}

	/* The review drawer shows one request at a time, with the decision pinned under it. */

	function openReview(id) {
		const request = findRequest(id);
		if (!request) return;
		view.openId = id;
		const { name, title, team } = profile(request.who);
		const portrait = sheetPart('avatar');
		portrait.setAttribute('data-name', name);
		window.Basalt.avatar?.(portrait);
		sheetPart('name').textContent = name;
		sheetPart('sub').textContent = `${title} · ${team}`;
		sheetPart('copy').setAttribute('data-basalt-copy', `${workspace.requestLink}${request.id}`);
		const details = sheetPart('body');
		details.innerHTML = reviewBody(request);
		details.scrollTop = 0;
		window.Basalt.avatars?.(details);

		/* A clean decision each time, preset to the length the request asked for, if any. */
		decisionForm.classList.remove('was-validated');
		for (const field of [choice.note, choice.until]) field.classList.remove('is-invalid');
		choice.note.value = '';

		const ceiling = view.rules.maxHours;
		for (const option of pickAll('input[name="arLength"]', ui.sheet)) {
			option.disabled = option.value !== 'custom' && Number(option.value) > ceiling;
		}
		const wanted = request.hours || view.rules.defaultHours;
		const isPreset = ['4', '24', '72', '168'].includes(String(wanted)) && wanted <= ceiling;
		choose('arLength', isPreset ? String(wanted) : 'custom');
		const suggestedEnd = new Date(currentTime().getTime() + Math.min(wanted, ceiling) * HOUR);
		choice.until.value = inputValue(suggestedEnd);
		choice.until.min = inputValue(currentTime());
		choice.until.max = inputValue(new Date(currentTime().getTime() + ceiling * HOUR));
		choose('arDecision', request.hours ? 'temporary' : 'approve');
		syncChoice();
		drawer().show();
	}

	/** Keeps the end time, the note and the action button in step with the picked decision. */
	function syncChoice() {
		const request = findRequest(view.openId);
		if (!request) return;
		const blocked = !mayDecide(request) || (wantsSecondApprover(request) && alreadySigned(request));
		choice.set.hidden = blocked;
		choice.waiting.hidden = !blocked;
		choice.waiting.innerHTML = blocked ? blockedNotice(request) : '';
		if (blocked) {
			choice.go.hidden = true;
			choice.hold.hidden = true;
			return;
		}

		const verdict = pickedVerdict();
		const denying = verdict === 'deny';
		const firstOfTwo = !denying && wantsSecondApprover(request) && !request.approvals.length;
		const firstName = profile(request.who).name.split(' ')[0];
		choice.expiry.hidden = verdict !== 'temporary';
		choice.custom.hidden = pickedLength() !== 'custom';
		choice.noteLabel.textContent = denying ? `Why not? ${firstName} sees this` : `Note to ${firstName}`;
		choice.note.placeholder = denying
			? 'For example: use a temporary grant for the change window instead'
			: 'Optional';
		choice.note.required = denying;
		if (!denying) choice.note.classList.remove('is-invalid');

		let label = 'Approve';
		if (denying) label = 'Deny request';
		else if (verdict === 'temporary') label = temporaryLabel(firstOfTwo, firstName);
		else if (firstOfTwo) label = 'Add my approval (1 of 2)';

		const needsHold = !denying && request.risk === 'high';
		choice.go.hidden = needsHold;
		choice.hold.hidden = !needsHold;
		choice.go.textContent = label;
		choice.go.classList.toggle('btn-danger', denying);
		choice.go.classList.toggle('btn-primary', !denying);
		choice.holdLabel.textContent = `Hold to ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
		rearmHold();
		syncShadows();
	}

	/** Writes the "Access ends" line and returns the button label for a time-boxed approval. */
	function temporaryLabel(firstOfTwo, firstName) {
		const length = pickedLength();
		const ends = endsAt();
		const warning = view.rules.warnBeforeEnd ? ` ${firstName} gets a warning an hour before.` : '';
		choice.ends.textContent =
			endProblem(ends) && length === 'custom' ? '' : `Access ends ${ends ? longWhen(ends) : ''}.${warning}`;
		if (firstOfTwo) return 'Add my approval (1 of 2)';
		if (length !== 'custom') return `Approve for ${spanText(Number(length))}`;
		return `Approve until ${ends ? `${monthDay(ends)}, ${clockText(ends)}` : 'then'}`;
	}

	function rearmHold() {
		choice.hold.classList.remove('is-done', 'is-holding');
		choice.hold.style.setProperty('--basalt-hold', '0');
	}

	function pickedVerdict() {
		return pick('input[name="arDecision"]:checked', ui.sheet)?.value ?? 'approve';
	}

	function pickedLength() {
		return pick('input[name="arLength"]:checked', ui.sheet)?.value ?? String(view.rules.defaultHours);
	}

	/** Checks a radio in the drawer and lets its listeners know. */
	function choose(name, value) {
		const radio = pick(`input[name="${name}"][value="${value}"]`, ui.sheet);
		if (!radio) return;
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/** When time-boxed access would end, or null when the custom field is empty or unreadable. */
	function endsAt() {
		const length = pickedLength();
		if (length !== 'custom') return new Date(currentTime().getTime() + Number(length) * HOUR);
		if (!choice.until.value) return null;
		const typed = new Date(choice.until.value);
		return Number.isNaN(typed.getTime()) ? null : typed;
	}

	function endProblem(ends) {
		if (!ends) return 'Pick a date and time.';
		if (ends <= currentTime()) return 'Pick a time in the future.';
		const ceiling = view.rules.maxHours;
		return (ends - currentTime()) / HOUR > ceiling + 0.01 ? `The policy allows ${spanText(ceiling)} at most.` : '';
	}

	/** Re-checks, after a frame, which pinned part has content under it and should cast a shadow. */
	function syncShadows() {
		cancelAnimationFrame(shadowFrame);
		shadowFrame = requestAnimationFrame(() => {
			const wholeScrolls = getComputedStyle(ui.sheet).overflowY === 'auto';
			decisionForm.classList.toggle('is-over', !wholeScrolls && hasMoreBelow(sheetPart('body')));
			drawerFoot.classList.toggle('is-over', wholeScrolls && hasMoreBelow(ui.sheet));
		});
	}

	function hasMoreBelow(box) {
		return box.scrollHeight - box.scrollTop - box.clientHeight > 1;
	}

	/** Toasts sit where the drawer's buttons are, so they move to the top while it is open. */
	function moveToasts(corner) {
		window.Basalt.toasts?.position?.(corner);
	}

	function onRemindClick(event) {
		const button = event.target.closest('[data-ar-remind]');
		if (!button) return;
		const request = findRequest(view.openId);
		if (!request || button.getAttribute('aria-busy') === 'true') return;
		const outstanding = stillToSign(request);
		window.Basalt.buttonState?.(button, 'loading');
		server
			.nudgeApprovers(
				request.id,
				outstanding.map((person) => person.id),
			)
			.then(() => {
				window.Basalt.buttonState?.(button, 'success');
				say(
					`Reminder sent to ${joinWords(
						outstanding.map((person) => person.name),
						'or',
					)}.`,
				);
			})
			.catch(() => {
				window.Basalt.buttonState?.(button, 'error');
				notify({
					tone: 'danger',
					title: 'The reminder was not sent',
					text: 'Nobody was notified. Try again in a moment.',
				});
			});
	}

	function drawer() {
		return bootstrap.Offcanvas.getOrCreateInstance(ui.sheet);
	}

	function sheetPart(name) {
		return pick(`[data-ar-r="${name}"]`, ui.sheet);
	}

	function findRequest(id) {
		return view.requests.find((request) => request.id === id);
	}

	/* Decisions and revokes land on the page before the server answers and
     hand back an undo, which serves both the toast's Undo button and the
     revert after a failed call. */

	function decide() {
		const request = findRequest(view.openId);
		if (!request) return;
		const verdict = pickedVerdict();
		const note = choice.note.value.trim();
		if (verdict === 'deny' && note.length < 3) return refuse(choice.note);
		const until = verdict === 'temporary' ? endsAt() : null;
		const problem = verdict === 'temporary' ? endProblem(until) : '';
		if (problem) {
			choose('arLength', 'custom');
			choice.custom.hidden = false;
			pick('[data-ar-until-error]', ui.sheet).textContent = problem;
			return refuse(choice.until);
		}

		const asker = profile(request.who);
		const firstOfTwo = verdict !== 'deny' && wantsSecondApprover(request) && !request.approvals.length;
		const terms = { kind: verdict, until, note };
		const undo = recordVerdict(request, terms);
		repaint();

		const outcome = firstOfTwo
			? firstApprovalOutcome(request)
			: verdict === 'deny'
				? denialOutcome(request, asker, note)
				: approvalOutcome(request, asker, terms);
		outcome.call.catch(rollbackOn(outcome.failure, undo));
		const { tone, icon, title, text } = outcome;
		offerUndo({ tone, icon, title, text }, () => {
			undo();
			repaint();
			server.reopenRequest(request.id).catch(() => {
				recordVerdict(request, terms);
				repaint();
				notify({
					tone: 'danger',
					title: 'Could not undo',
					text: 'The decision stands. Try again in a moment.',
				});
			});
			say(`Undone. ${asker.name}’s request is back in the queue.`);
		});

		/* A first sign-off keeps the drawer on this request; otherwise move
       straight to the next one, or close once nothing is left. */
		if (firstOfTwo) {
			syncChoice();
			sheetPart('body').innerHTML = reviewBody(request);
			window.Basalt.avatars?.(sheetPart('body'));
			return;
		}
		const next = nextForMe();
		if (!next) {
			drawer().hide();
			say('That was the last request waiting for you.');
			return;
		}
		openReview(next.id);
		say(`Next: ${profile(next.who).name}’s request.`);
		sheetPart('name').focus();
	}

	function firstApprovalOutcome(request) {
		const others = eligibleApprovers(request)
			.filter((person) => person.id !== workspace.me)
			.map((person) => person.name);
		const call = server.recordFirstApproval(request.id);
		return {
			call,
			failure: 'save your approval',
			tone: 'success',
			icon: 'bi-person-check',
			title: 'Your approval is in',
			text: `One more is needed, from ${joinWords(others, 'or')}.`,
		};
	}

	function denialOutcome(request, asker, note) {
		const call = server.denyRequest(request.id, note);
		return {
			call,
			failure: 'deny the request',
			tone: 'info',
			icon: 'bi-x-circle',
			title: 'Request denied',
			text: `${asker.name} gets your note by email.`,
		};
	}

	function approvalOutcome(request, asker, terms) {
		const timed = terms.kind === 'temporary';
		const { until, note } = terms;
		const hours = timed ? Math.round((until - currentTime()) / HOUR) : null;
		const call = server.approveRequest(request.id, { hours, until: until ? writeStamp(until) : null, note });
		const icon = timed ? 'bi-hourglass-split' : 'bi-check2-circle';
		const title = timed ? 'Approved for a while' : 'Approved';
		const text = `${asker.name} now has ${askSentence(request.ask)}${until ? ` until ${longWhen(until)}` : ''}.`;
		return { call, failure: 'approve the request', tone: 'success', icon, title, text };
	}

	/**
	 * Applies a decision to the page state and returns its undo. The first
	 * of two required approvals only adds a sign-off and keeps the request
	 * queued; anything else moves it into the history.
	 * @param {object} request  the queued request
	 * @param {{kind: string, until: ?Date, note: string}} terms
	 * @returns {Function}
	 */
	function recordVerdict(request, terms) {
		const me = workspace.me;
		const at = writeStamp(currentTime());
		if (terms.kind !== 'deny' && wantsSecondApprover(request) && !request.approvals.length) {
			request.approvals.push([me, at]);
			return () => {
				request.approvals = request.approvals.filter((pair) => pair[0] !== me);
			};
		}

		const { id, who, ask, reason } = request;
		const slot = view.requests.indexOf(request);
		view.requests.splice(slot, 1);
		const signers = [...request.approvals.map((pair) => pair[0]), me];
		const denied = terms.kind === 'deny';
		const entry = {
			id,
			who,
			ask,
			at,
			by: denied ? [me] : signers,
			note: terms.note,
			decision: HISTORY_WORD[terms.kind] ?? 'approved',
		};
		let grant = null;
		let formerRole = null;

		if (terms.kind === 'temporary') {
			entry.hours = Math.max(1, Math.round((terms.until - currentTime()) / HOUR));
			grant = { id, who, ask, from: at, until: writeStamp(terms.until), by: signers, reason };
			view.grants.push(grant);
		} else if (!denied && ask.role) {
			formerRole = profile(who).role;
			assignRole(who, ask.role);
		}
		view.decisions.push(entry);

		return () => {
			view.requests.splice(Math.min(slot, view.requests.length), 0, request);
			view.decisions = view.decisions.filter((item) => item !== entry);
			if (grant) view.grants = view.grants.filter((item) => item !== grant);
			if (formerRole) assignRole(who, formerRole);
		};
	}

	/** Marks a field as wrong, puts focus on it and lets the hold button start over. */
	function refuse(field) {
		field.classList.add('is-invalid');
		field.focus();
		rearmHold();
	}

	/** A catch handler: undo the optimistic change, redraw and say what failed. */
	function rollbackOn(action, undo) {
		return () => {
			undo();
			repaint();
			notify({
				tone: 'danger',
				title: `Could not ${action}`,
				text: 'Nothing was changed. Check your connection and try again.',
			});
		};
	}

	function revokeOne(id) {
		const grant = view.grants.find((item) => item.id === id);
		if (!grant) return;
		const undo = endGrants([grant]);
		server.endGrant(id).catch(rollbackOn('revoke the access', undo));
		const holder = profile(grant.who);
		offerUndo(
			{
				tone: 'success',
				icon: 'bi-x-octagon',
				title: 'Access revoked',
				text: `${holder.name} is back to ${holder.role} access.`,
			},
			() => {
				undo();
				repaint();
				server.reinstateGrant(id).catch(() => {
					endGrants([grant]);
					notify({
						tone: 'danger',
						title: 'Could not put the access back',
						text: 'Approve a new request if it is still needed.',
					});
				});
			},
		);
	}

	/** Behind the typed confirmation in the Revoke all dialog. */
	function revokeEverything() {
		const ending = [...view.grants];
		if (!ending.length) return;
		bootstrap.Modal.getOrCreateInstance(ui.revokeAll).hide();
		const undo = endGrants(ending);
		server.endAllGrants(ending.map((grant) => grant.id)).catch(rollbackOn('revoke the access', undo));
		const summary = `${countOf(ending.length, 'person is', 'people are')} back to their own role.`;
		offerUndo(
			{ tone: 'success', icon: 'bi-x-octagon', title: 'All temporary access revoked', text: summary },
			() => {
				undo();
				repaint();
				for (const grant of ending) server.reinstateGrant(grant.id).catch(() => {});
			},
		);
	}

	/** Ends the given grants now, logs each as revoked, redraws, and returns the undo. */
	function endGrants(ending) {
		const at = writeStamp(currentTime());
		view.grants = view.grants.filter((grant) => !ending.includes(grant));
		const entries = ending.map((grant) => ({
			id: grant.id,
			who: grant.who,
			ask: grant.ask,
			decision: 'revoked',
			hours: grantHours(grant),
			at,
			by: [workspace.me],
			note: '',
		}));
		view.decisions.push(...entries);
		repaint();
		return () => {
			for (const grant of ending) {
				if (!view.grants.includes(grant)) view.grants.push(grant);
			}
			view.decisions = view.decisions.filter((item) => !entries.includes(item));
		};
	}

	function grantHours(grant) {
		return Math.round((readStamp(grant.until) - readStamp(grant.from)) / HOUR);
	}

	/* The policy form is read and written field by field. */

	function policyField(name) {
		return ui.policy.elements[name];
	}

	function writePolicyForm(rules) {
		for (const name of POLICY_SWITCHES) policyField(name).checked = Boolean(rules[name]);
		for (const radio of pickAll('input[name="defaultHours"]', ui.policy))
			radio.checked = Number(radio.value) === rules.defaultHours;
		pick('input[name="defaultHours"]:checked', ui.policy)?.dispatchEvent(new Event('change', { bubbles: true }));
		policyField('maxHours').value = String(rules.maxHours);
		policyField('remindHours').value = String(rules.remindHours);
		ui.notify.basaltTags?.set(rules.notify);
		syncPolicyFooter();
	}

	/** Reads the form back. Keys follow the stored policy's order, since the two are compared as JSON. */
	function readPolicyForm() {
		const suggested = pick('input[name="defaultHours"]:checked', ui.policy);
		function ticked(name) {
			return policyField(name).checked;
		}
		return {
			approverAdmin: ticked('approverAdmin'),
			approverBilling: ticked('approverBilling'),
			approverDispatch: ticked('approverDispatch'),
			defaultHours: suggested ? Number(suggested.value) : 24,
			maxHours: Number(policyField('maxHours').value),
			warnBeforeEnd: ticked('warnBeforeEnd'),
			twoAdminRole: ticked('twoAdminRole'),
			twoApiKeys: ticked('twoApiKeys'),
			twoBillingManage: ticked('twoBillingManage'),
			twoUsers: ticked('twoUsers'),
			twoHighRisk: ticked('twoHighRisk'),
			notify: ui.notify.basaltTags ? ui.notify.basaltTags.get() : view.rules.notify,
			remindHours: Number(policyField('remindHours').value),
		};
	}

	function policiesMatch(a, b) {
		return JSON.stringify(a) === JSON.stringify(b);
	}

	/** Save and Discard follow the form; the footer line says what saving would change. */
	function syncPolicyFooter() {
		if (!view.rules) return;
		const draft = readPolicyForm();
		const dirty = !policiesMatch(draft, view.rules);
		/* The suggested length may never exceed the longest one allowed. */
		for (const radio of pickAll('input[name="defaultHours"]', ui.policy))
			radio.disabled = Number(radio.value) > draft.maxHours;

		const tooLong = draft.defaultHours > draft.maxHours;
		const shifted = view.requests.filter(
			(request) => wantsSecondApprover(request, draft) !== wantsSecondApprover(request),
		).length;
		ui.policySave.disabled = !dirty || tooLong;
		ui.policyReset.disabled = !dirty;
		ui.policyState.classList.toggle('is-dirty', dirty);
		if (tooLong) {
			ui.policyState.textContent = 'The suggested length is longer than the longest allowed.';
		} else if (!dirty) {
			ui.policyState.textContent = 'No changes';
		} else {
			const impact = shifted
				? `. ${countOf(shifted, 'waiting request')} would change how many approvers ${shifted === 1 ? 'it needs' : 'they need'}`
				: '';
			ui.policyState.textContent = `Unsaved changes${impact}.`;
		}
	}

	function commitPolicy() {
		const draft = readPolicyForm();
		const previous = view.rules;
		if (policiesMatch(draft, previous) || draft.defaultHours > draft.maxHours) return;
		view.rules = draft;
		repaint();
		syncPolicyFooter();
		window.Basalt.buttonState?.(ui.policySave, 'loading');
		server
			.storePolicy(draft)
			.then(() => {
				window.Basalt.buttonState?.(ui.policySave, 'success');
				notify({
					tone: 'success',
					icon: 'bi-shield-check',
					title: 'Policy saved',
					text: 'New requests follow it from now on. Waiting requests are checked again.',
				});
				settleSaveButton();
			})
			.catch(() => {
				view.rules = previous;
				repaint();
				window.Basalt.buttonState?.(ui.policySave, 'error');
				notify({
					tone: 'danger',
					title: 'Could not save the policy',
					text: 'The old policy still applies. Your changes are still in the form.',
				});
				settleSaveButton();
			});
	}

	function settleSaveButton() {
		setTimeout(() => {
			window.Basalt.buttonState?.(ui.policySave, 'idle');
			syncPolicyFooter();
		}, 1600);
	}

	/* Who people are, what a request changes and who may sign it off. */

	function profile(id) {
		const row = workspace.people.find((entry) => entry[0] === id);
		if (!row)
			return { id, name: 'Someone', title: '', team: '', region: '', role: 'Read-only', signIn: 'password' };
		const [, name, title, team, region, role, signIn] = row;
		return { id, name, title, team, region, role, signIn };
	}

	function assignRole(id, role) {
		const row = workspace.people.find((entry) => entry[0] === id);
		if (row) row[5] = role;
	}

	function displayName(id) {
		return id === workspace.me ? `${profile(id).name} (you)` : profile(id).name;
	}

	function areaLabel(key) {
		return workspace.resources.find((area) => area[0] === key)?.[1] ?? key;
	}

	function levelName(depth) {
		return workspace.levels[depth];
	}

	/** The areas a request moves, as [{ key, from, to }]; a role change lists every area that differs. */
	function changedAreas(ask) {
		if (!ask.role) return [{ key: ask.res, from: ask.from, to: ask.to }];
		const before = workspace.roles[ask.from] || [];
		const after = workspace.roles[ask.role] || [];
		return workspace.resources
			.map(([key], index) => ({ key, from: before[index] || 0, to: after[index] || 0 }))
			.filter((change) => change.from !== change.to);
	}

	function requestKind(request) {
		if (request.hours) return 'temporary';
		return request.ask.role ? 'role' : 'permission';
	}

	/**
	 * True when the policy asks for a second approver on this request.
	 * @param {object} request
	 * @param {object} [rules] a draft policy to test against; the saved one by default
	 */
	function wantsSecondApprover(request, rules = view.rules) {
		const { ask } = request;
		const changes = changedAreas(ask);
		function raises(key, test) {
			return changes.some((change) => change.key === key && test(change));
		}
		const triggers = {
			twoAdminRole: () =>
				Boolean(ask.role) && ['Owner', 'Administrator'].some((role) => role === ask.role || role === ask.from),
			twoApiKeys: () => raises('apikeys', (change) => change.to > 1 && change.to > change.from),
			twoBillingManage: () => raises('billing', (change) => change.to === 3 && change.from < 3),
			twoUsers: () => raises('users', (change) => change.to > 1 && change.to > change.from),
			twoHighRisk: () => request.risk === 'high',
		};
		return Object.entries(triggers).some(([flag, test]) => rules[flag] && test());
	}

	/** Everyone the policy lets decide this request, in workspace order. Nobody decides their own. */
	function eligibleApprovers(request) {
		const rules = view.rules;
		const areas = changedAreas(request.ask).map((change) => change.key);
		function onlyArea(key) {
			return !request.ask.role && areas.every((area) => area === key);
		}
		const roleMay = {
			Owner: () => true,
			Administrator: () => rules.approverAdmin,
			Accountant: () => rules.approverBilling && onlyArea('billing'),
			'Store manager': () => rules.approverDispatch && onlyArea('dispatch'),
		};
		return workspace.people
			.map((row) => profile(row[0]))
			.filter((person) => person.id !== request.who && Boolean(roleMay[person.role]?.()));
	}

	function stillToSign(request) {
		return eligibleApprovers(request).filter((person) => !request.approvals.some((pair) => pair[0] === person.id));
	}

	function mayDecide(request) {
		return eligibleApprovers(request).some((person) => person.id === workspace.me);
	}

	function alreadySigned(request) {
		return request.approvals.some((pair) => pair[0] === workspace.me);
	}

	function askHeadline(ask) {
		return ask.role ? `${ask.role} role` : `${areaLabel(ask.res)}: ${levelName(ask.to)}`;
	}

	function askSentence(ask) {
		return ask.role ? `the ${ask.role} role` : `${levelName(ask.to)} on ${areaLabel(ask.res)}`;
	}

	/* Markup builders. Classes and attributes here are what the stylesheet targets. */

	/** "Before → after" as markup, with the arrow spoken as "to". */
	function askArrow(ask) {
		const [before, after] = ask.role ? [ask.from, ask.role] : [levelName(ask.from), levelName(ask.to)];
		return `${htmlSafe(before)} <i class="bi bi-arrow-right" aria-hidden="true"></i><span class="visually-hidden"> to </span> ${htmlSafe(after)}`;
	}

	function askArea(ask) {
		return ask.role ? 'Role' : htmlSafe(areaLabel(ask.res));
	}

	function avatarTag(id, size = 'basalt-avatar-sm') {
		return `<span class="basalt-avatar ${size}" data-basalt-avatar data-name="${htmlSafe(profile(id).name)}" aria-hidden="true"></span>`;
	}

	function riskBadge(request) {
		const look = RISK_LOOK[request.risk];
		return `<span class="basalt-status basalt-status-${look.tone}"><i class="bi ${look.icon}" aria-hidden="true"></i>${look.label}</span>`;
	}

	/** The Access column: an icon and the area's name. The change itself sits in the next column. */
	function areaCell(ask) {
		return `<p class="ar-col-access"><i class="bi ${ask.role ? 'bi-person-badge' : 'bi-key'}" aria-hidden="true"></i><span>${askArea(ask)}</span></p>`;
	}

	function whoCell(variant, person) {
		return `<div class="${variant}"><p class="ar-req-name">${htmlSafe(person.name)}</p><p class="ar-req-meta">${htmlSafe(person.title)} · ${htmlSafe(person.role)}</p></div>`;
	}

	/**
	 * A label row above a list, on the rows' own grid. Screen readers hear
	 * each row in order anyway, so the labels are for the eye only.
	 */
	function addColumnLabels(list, variant, labels) {
		const row = document.createElement('div');
		row.className = `ar-head ${variant}`;
		row.setAttribute('aria-hidden', 'true');
		row.innerHTML = Object.entries(labels)
			.map(([slot, text]) => `<span class="ar-head-${slot}">${text}</span>`)
			.join('');
		row.hidden = true;
		list.before(row);
		return row;
	}

	function placeholderRows(count, variant) {
		const row = `<li class="${variant} ar-skel" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-circle ar-skel-av"></span><span class="ar-skel-lines"><span class="basalt-skeleton basalt-skeleton-text ar-skel-short"></span><span class="basalt-skeleton basalt-skeleton-text"></span></span><span class="basalt-skeleton basalt-skeleton-btn ar-skel-btn"></span></li>`;
		return row.repeat(count);
	}

	/** Fills a message box under a list and shows it, or empties and hides it. */
	function showNote(box, html) {
		Object.assign(box, { innerHTML: html, hidden: !html });
	}

	function blankNote({ tone, icon, title, text, actions }) {
		const toneClass = tone ? ` basalt-empty-${tone}` : '';
		const role = tone === 'danger' ? ' role="alert"' : '';
		const buttons = actions ? `<div class="basalt-empty-actions">${actions}</div>` : '';
		return `<div class="basalt-empty basalt-empty-compact${toneClass} ar-empty"${role}><span class="ar-empty-icon" aria-hidden="true"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${buttons}</div>`;
	}

	function loadFailure(subject) {
		return blankNote({
			tone: 'danger',
			icon: 'bi-cloud-slash',
			title: `${capitalize(subject)} did not load`,
			text: 'The server did not answer. Nothing was changed; this only affects what you can see here.',
			actions:
				'<button type="button" class="btn btn-sm btn-primary" data-ar-retry><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button>',
		});
	}

	function requestRow(request) {
		const { id, who, ask, reason } = request;
		const asker = profile(who);
		const sent = readStamp(request.sent);
		const overdue = view.rules.remindHours && (currentTime() - sent) / HOUR > view.rules.remindHours;
		const span =
			requestKind(request) === 'temporary' ? `<p class="ar-fact">For ${spanText(request.hours)}</p>` : '';
		const tally = wantsSecondApprover(request)
			? `<p class="ar-fact">${Math.min(request.approvals.length, 2)} of 2 approvals</p>`
			: '';
		const [alarm, spoken] = overdue
			? [
					'<i class="bi bi-alarm" aria-hidden="true"></i>',
					'<span class="visually-hidden">, past the reminder time</span>',
				]
			: ['', ''];
		const age = `<span class="ar-req-age${overdue ? ' is-late' : ''}">${alarm}<span class="ar-req-agepre">Waiting </span>${waitedText(sent)}${spoken}</span>`;
		const label = `Review ${htmlSafe(asker.name)}’s request for ${htmlSafe(askSentence(ask))}`;
		const button = `<button type="button" class="btn btn-sm btn-outline-primary" data-ar-open="${htmlSafe(id)}" aria-label="${label}">${alreadySigned(request) ? 'Open' : 'Review'}</button>`;
		return [
			`<li class="ar-req" data-ar-id="${htmlSafe(id)}">${avatarTag(who)}${whoCell('ar-req-who', asker)}${areaCell(ask)}`,
			`<div class="ar-col-change"><p class="ar-chg">${askArrow(ask)}</p>${span}<p class="ar-req-why">${htmlSafe(reason)}</p></div>`,
			`<div class="ar-req-flags">${riskBadge(request)}${tally}</div><div class="ar-req-end">${age}${button}</div></li>`,
		].join('');
	}

	function grantRow({ id, who, ask, by, reason, until: endStamp }) {
		const holder = profile(who);
		const until = readStamp(endStamp);
		const name = htmlSafe(holder.name);
		const bar = `<div class="ar-grant-bar" role="progressbar" aria-label="Time used of ${name}’s grant" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-ar-bar><span></span></div>`;
		const revoke = `<button type="button" class="btn btn-outline-secondary btn-sm btn-confirm" data-basalt-confirm data-ar-revoke="${htmlSafe(id)}" aria-label="Revoke ${name}’s access now"><span class="btn-confirm-idle"><i class="bi bi-x-lg" aria-hidden="true"></i>Revoke now</span><span class="btn-confirm-ask">Click again to revoke</span></button>`;
		return [
			`<li class="ar-grant" data-ar-grant="${htmlSafe(id)}">${avatarTag(who)}${whoCell('ar-grant-who', holder)}${areaCell(ask)}`,
			`<div class="ar-col-change"><p class="ar-chg">${askArrow(ask)}</p><p class="ar-req-why" title="Approved by ${htmlSafe(joinWords(by.map(displayName), 'and'))}">${htmlSafe(reason)}</p></div>`,
			`<div class="ar-grant-time"><p class="ar-grant-left"><i class="bi bi-stopwatch" aria-hidden="true"></i><span data-ar-left>${remainingText(until - currentTime())}</span> left</p>${bar}<p class="ar-grant-ends">Ends ${longWhen(until)}</p></div>`,
			`<div class="ar-grant-end">${revoke}</div></li>`,
		].join('');
	}

	function decisionRow({ id, who, ask, decision, hours, at, by, note }) {
		const { name, team } = profile(who);
		const { tone, icon, label } = VERDICT_LOOK[decision];
		const when = htmlSafe(shortWhen(readStamp(at)));
		const spanPrefix = { temporary: 'For', revoked: 'Had', expired: 'After' }[decision];
		const span = spanPrefix ? `${spanPrefix} ${spanText(hours)}` : '';
		const deciders = htmlSafe(joinWords(by.map(displayName), 'and'));
		const foot = [when, htmlSafe(id), `Decided by ${deciders}`, span].filter(Boolean).join(' · ');
		const cells = {
			When: `<span class="ar-hist-when">${when}</span><span class="ar-hist-id">${htmlSafe(id)}</span>`,
			Person: `<span class="ar-hist-person">${avatarTag(who, 'basalt-avatar-xs')}<span><span class="ar-hist-name">${htmlSafe(name)}</span><span class="ar-hist-team">${htmlSafe(team)}</span></span></span>`,
			'Asked for': `<span class="ar-hist-ask">${askArea(ask)} <span class="ar-chg">${askArrow(ask)}</span></span>${note ? `<span class="ar-hist-note">“${htmlSafe(note)}”</span>` : ''}`,
			Decision: `<span class="basalt-status${tone ? ` basalt-status-${tone}` : ''}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</span>${span ? `<span class="ar-hist-sub">${span}</span>` : ''}`,
			'Decided by': `<span class="ar-hist-by">${deciders}</span><span class="ar-hist-foot">${foot}</span>`,
		};
		return `<tr>${Object.entries(cells)
			.map(([column, html]) => `<td data-label="${column}">${html}</td>`)
			.join('')}</tr>`;
	}

	/** The drawer's details: the ask, the reason, what changes, the risk and who must approve. */
	function reviewBody(request) {
		const { ask, reason, riskWhy, hours } = request;
		const twoNeeded = wantsSecondApprover(request);
		const kindLine = {
			role: 'Role change',
			permission: 'One permission',
			temporary: `Temporary access, asked for ${hours ? spanText(hours) : ''}`,
		}[requestKind(request)];
		const byline = `${htmlSafe(profile(request.who).name)}, ${longWhen(readStamp(request.sent))}`;
		const single = `<p class="ar-sheet-text">One approval is enough. ${htmlSafe(
			joinWords(
				eligibleApprovers(request).map((person) => displayName(person.id)),
				'or',
			),
		)} can decide.</p>`;
		return [
			`<p class="ar-sheet-eyebrow">${htmlSafe(kindLine)}</p><p class="ar-sheet-ask">${askArea(ask)} <span class="ar-chg">${askArrow(ask)}</span></p>`,
			`<figure class="ar-reason"><blockquote class="ar-reason-text"><p>${htmlSafe(reason)}</p></blockquote><figcaption class="ar-reason-by">${byline}</figcaption></figure>`,
			sheetSection('What changes', changeTable(request)),
			sheetSection('Risk', `<p class="ar-sheet-risk">${riskBadge(request)}<span>${htmlSafe(riskWhy)}</span></p>`),
			sheetSection(twoNeeded ? 'Needs two approvers' : 'Approval', twoNeeded ? approvalSteps(request) : single),
		].join('');
	}

	function sheetSection(heading, content) {
		return `<h3 class="ar-sheet-h">${heading}</h3>${content}`;
	}

	/**
	 * At most three rows, biggest jumps first and sensitive areas breaking
	 * ties; whatever is left gets one quiet summary line under the table.
	 */
	function changeTable(request) {
		const changes = changedAreas(request.ask);
		const unchanged = request.ask.role ? workspace.resources.length - changes.length : 0;
		function weight(change) {
			const sensitivity = SENSITIVE_AREAS.indexOf(change.key);
			return Math.abs(change.to - change.from) * 10 + (sensitivity < 0 ? 0 : 5 - sensitivity);
		}
		const shown = [...changes].sort((a, b) => weight(b) - weight(a)).slice(0, 3);
		const rest = changes.filter((change) => !shown.includes(change));
		const rows = shown
			.map((change) => {
				const up = change.to > change.from;
				const cue = up
					? ['is-up', 'bi-arrow-up', ', more access']
					: ['is-down', 'bi-arrow-down', ', less access'];
				return `<tr class="${cue[0]}"><th scope="row">${htmlSafe(areaLabel(change.key))}</th><td>${htmlSafe(levelName(change.from))}</td><td><span class="ar-diff-to"><i class="bi ${cue[1]}" aria-hidden="true"></i>${htmlSafe(levelName(change.to))}<span class="visually-hidden">${cue[2]}</span></span></td></tr>`;
			})
			.join('');

		const summary = [];
		if (rest.length) {
			const single = rest.length === 1;
			const sharedTarget = rest.every((change) => change.to > change.from && change.to === rest[0].to)
				? levelName(rest[0].to)
				: '';
			const tail = sharedTarget
				? `${single ? ' also goes up to ' : ' also go up to '}${sharedTarget}`
				: single
					? ' also changes'
					: ' also change';
			summary.push(`${countOf(rest.length, 'more area')}${tail}`);
		}
		if (unchanged)
			summary.push(`${countOf(unchanged, 'other area')}${unchanged === 1 ? ' stays' : ' stay'} the same`);
		const note = summary.length ? `<p class="ar-sheet-note">${summary.join('. ')}.</p>` : '';
		return `<div class="ar-diff-wrap"><table class="ar-diff"><caption class="visually-hidden">Access now and after approval</caption><thead><tr><th scope="col">Area</th><th scope="col">Now</th><th scope="col">After</th></tr></thead><tbody>${rows}</tbody></table></div>${note}`;
	}

	/**
	 * Two numbered steps that read as status, never as controls: a step
	 * becomes a check once given, and each ends with a status word.
	 */
	function approvalSteps(request) {
		const me = workspace.me;
		const open = stillToSign(request)
			.sort((a, b) => (b.id === me) - (a.id === me))
			.map((person) => (person.id === me ? 'you' : person.name));
		const steps = ['First', 'Second'].map((ordinal, index) => {
			const given = request.approvals[index];
			if (!given) {
				return `<li><span class="ar-step" aria-hidden="true">${index + 1}</span><span class="ar-approvals-what">${ordinal} approval, from ${htmlSafe(joinWords(open, 'or'))}</span><span class="ar-approvals-state">Waiting</span></li>`;
			}
			const [signer, at] = given;
			return `<li class="is-done"><span class="ar-step" aria-hidden="true"><i class="bi bi-check-lg"></i></span><span class="ar-approvals-what">${ordinal} approval, ${longWhen(readStamp(at))}</span><span class="ar-approvals-state">Approved by ${htmlSafe(signer === me ? 'you' : profile(signer).name)}</span></li>`;
		});
		return `<ol class="ar-approvals">${steps.join('')}</ol>`;
	}

	/** Shown in place of the decision when the viewer cannot act, or has already signed. */
	function blockedNotice(request) {
		if (!mayDecide(request)) {
			const names = eligibleApprovers(request).map((person) => person.name);
			return `<div class="ar-waiting"><i class="bi bi-lock" aria-hidden="true"></i><div><p class="ar-waiting-title">Your role can’t decide this one</p><p class="ar-waiting-text">Under the current policy ${htmlSafe(joinWords(names, 'or'))} can approve or deny it.</p></div></div>`;
		}
		const mine = request.approvals.find((pair) => pair[0] === workspace.me);
		const others = stillToSign(request).map((person) => person.name);
		const remind =
			'<button type="button" class="btn btn-outline-secondary btn-sm btn-loading" data-ar-remind><span class="btn-loading-state btn-loading-idle"><i class="bi bi-bell" aria-hidden="true"></i>Remind them</span><span class="btn-loading-state btn-loading-busy"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Sending</span><span class="btn-loading-state btn-loading-done"><i class="bi bi-check2" aria-hidden="true"></i>Reminder sent</span><span class="btn-loading-state btn-loading-fail"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Not sent</span></button>';
		return `<div class="ar-waiting"><i class="bi bi-hourglass-split" aria-hidden="true"></i><div><p class="ar-waiting-title">You approved this ${longWhen(readStamp(mine[1]))}</p><p class="ar-waiting-text">It needs one more approval, from ${htmlSafe(joinWords(others, 'or'))}.</p>${remind}</div></div>`;
	}

	/* Clock, dates and the wording of counts and spans. */

	function currentTime() {
		return new Date(sampleStart.getTime() + (Date.now() - bootedAt));
	}

	/** Parses "YYYY-MM-DD HH:MM" as local time. */
	function readStamp(text) {
		const [datePart, timePart] = String(text).split(' ');
		const [year, month, day] = datePart.split('-').map(Number);
		const [hour, minute] = (timePart || '00:00').split(':').map(Number);
		return new Date(year, month - 1, day, hour, minute);
	}

	function writeStamp(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	/** The value a datetime-local input expects. */
	function inputValue(date) {
		return writeStamp(date).replace(' ', 'T');
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	/** Whole calendar days between the date and today; negative for days ahead. */
	function agoDays(date) {
		function midnight(moment) {
			return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()).getTime();
		}
		return Math.round((midnight(currentTime()) - midnight(date)) / 86400000);
	}

	/** "9:15 am" */
	function clockText(date) {
		const hour = date.getHours();
		return `${hour % 12 || 12}:${twoDigits(date.getMinutes())} ${hour < 12 ? 'am' : 'pm'}`;
	}

	/** "Sep 15" */
	function monthDay(date) {
		return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
	}

	/** Compact: "9:15 am", "Yesterday", "Tomorrow", "Tue" within the week, else "Sep 15". */
	function shortWhen(date) {
		const gap = agoDays(date);
		if (gap === 0) return clockText(date);
		if (gap === 1) return 'Yesterday';
		if (gap === -1) return 'Tomorrow';
		return gap > 1 && gap < 7 ? WEEKDAY_SHORT[date.getDay()] : monthDay(date);
	}

	/** In a sentence: "today at 9:15 am", "Tue, Sep 29 at 3:00 pm". */
	function longWhen(date) {
		const near = { 0: 'today', 1: 'yesterday', [-1]: 'tomorrow' }[agoDays(date)];
		return `${near ?? `${WEEKDAY_SHORT[date.getDay()]}, ${monthDay(date)}`} at ${clockText(date)}`;
	}

	/** How long a request has waited: "35 min", "6 h", "2 days". */
	function waitedText(since) {
		const minutes = Math.max(0, Math.round((currentTime() - since) / 60000));
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		return hours < 24 ? `${hours} h` : countOf(Math.floor(hours / 24), 'day');
	}

	/** Time left on a grant: "2 days 4 h", "3 h 12 min", then a "41:07" clock in the last hour. */
	function remainingText(ms) {
		const total = Math.max(0, Math.floor(ms / 1000));
		const days = Math.floor(total / 86400);
		const hours = Math.floor((total % 86400) / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		if (days) return `${countOf(days, 'day')}${hours ? ` ${hours} h` : ''}`;
		if (hours) return `${hours} h ${minutes} min`;
		return `${minutes}:${twoDigits(total % 60)}`;
	}

	/** The same, worded for the progress bar's spoken value. */
	function remainingSpoken(ms) {
		const minutes = Math.max(0, Math.round(ms / 60000));
		if (minutes < 60) return countOf(minutes, 'minute');
		const hours = Math.floor(minutes / 60);
		return hours < 48 ? countOf(hours, 'hour') : countOf(Math.floor(hours / 24), 'day');
	}

	/** A span in hours, said in days when it divides evenly. */
	function spanText(hours) {
		return hours % 24 === 0 ? countOf(hours / 24, 'day') : countOf(hours, 'hour');
	}

	function countOf(amount, one, many = `${one}s`) {
		return `${amount} ${amount === 1 ? one : many}`;
	}

	/** "A, B and C" or "A, B or C". */
	function joinWords(items, conjunction) {
		if (items.length < 2) return items.join('');
		return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`;
	}

	function capitalize(text) {
		return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
	}

	/* Thin wrappers over the DOM and the shared basalt.js helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	/** A toast whose single Undo action runs the given function. */
	function offerUndo(message, onUndo) {
		notify({ ...message, actions: [{ label: 'Undo', onClick: onUndo }] });
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function pause(ms, value) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms, value);
		});
	}

	/** A save call: resolves after the delay, or, with ?state=offline, rejects a little later. */
	function settle(ms) {
		if (scenario !== 'offline') return pause(ms);
		return pause(ms + 250).then(() => {
			throw new Error('offline');
		});
	}
})();
