/**
 * Who has been asked to join the workspace, and how they answered.
 * Loaded by invitations.html and wakes up only where [data-whs-root]
 * exists. It draws the waiting, accepted and expired invitations, the
 * shared invite links, the seat meter and the accept rate, and runs the
 * invite drawer (typed addresses or a CSV file) and its dialogs.
 *
 * Wiring in a real backend takes two steps. First, SAMPLE_REPLY is what the
 * server would send back; return your own from server.fetchAll(), since
 * every row, link and number on the page comes from it and none is in
 * the markup. Second, each method on `server` is one request: the page
 * updates itself straight away, then waits for the answer and restores
 * the previous values with an error toast if the request fails.
 *
 * Add ?state= to the address to try the other cases: empty shows no
 * invitations and no links, error fails the first load (the retry
 * works), and fail rejects every change so the rollback can be seen.
 *
 * The header, tabs, segmented controls, selects, tag inputs, stepper,
 * drop zone, drawer, dialogs, hold to confirm, toasts with undo,
 * avatars, pager, skeletons, empty states, loading buttons, copy and
 * the live region all come from basalt.js.
 */
(() => {
	'use strict';
	const pageRoot = pick('[data-whs-root]');
	if (!pageRoot) return;

	/*
	 * Sample answer from the server. `today` stands in for the real date,
	 * `me` is the signed-in person (an id from `people`), and `workspace`
	 * holds the plan's seats and the members already using them; every
	 * waiting invitation holds one more. Owner is missing from `roles` on
	 * purpose: ownership moves through Settings, never by invitation.
	 * Invitations are pending, accepted or expired, with plain YYYY-MM-DD
	 * dates; `name` is known only after someone accepts, and `method` is
	 * how they first signed in. On a link, limit 0 and expires null mean
	 * no cap and no end, and an empty `domains` lets any address in. The
	 * reminder setting emails people 2 days before an invitation lapses.
	 */
	const SAMPLE_REPLY = {
		today: '2026-10-02',
		me: 'ja',
		workspace: {
			name: 'Fieldline',
			domain: 'fieldline.app',
			plan: 'Pro',
			seats: 60,
			members: 52,
			inviteDays: 7,
			joinUrl: 'https://app.fieldline.app/join/',
		},
		people: [
			{ id: 'ja', name: 'John Armstrong', title: 'Chief Technology Officer' },
			{ id: 'pr', name: 'Connie Reese', title: 'Support lead' },
			{ id: 'hs', name: 'Hope Stout', title: 'Billing' },
			{ id: 'th', name: 'Todd Hatcher', title: 'Engineering' },
			{ id: 'mb', name: 'Quentin Cook', title: 'Sales' },
			{ id: 'ab', name: 'Alexis Boone', title: 'Operations' },
		],
		/* Addresses that already belong to members, so inviting one again is flagged. */
		memberEmails: [
			'john.armstrong@fieldline.app',
			'connie.reese@fieldline.app',
			'hope.stout@fieldline.app',
			'trent.hatcher@fieldline.app',
			'quentin.cook@fieldline.app',
			'alexis.boone@fieldline.app',
			'elise.vasquez@fieldline.app',
			'cameron.reid@fieldline.app',
			'leslie.weiss@fieldline.app',
		],
		roles: [
			{
				id: 'admin',
				name: 'Administrator',
				icon: 'bi-shield-lock',
				can: 'Customers, the schedule board, reports, integrations, API keys, settings and users. Not billing.',
			},
			{
				id: 'billing',
				name: 'Billing admin',
				icon: 'bi-receipt',
				can: 'Billing and invoices, the plan and seats. Can view customers and reports.',
			},
			{
				id: 'support',
				name: 'Support agent',
				icon: 'bi-headset',
				can: 'Customers and the schedule board. Can view reports.',
			},
			{
				id: 'dispatch',
				name: 'Scheduling manager',
				icon: 'bi-calendar-week',
				can: 'The schedule board, customers and reports for their region.',
			},
			{
				id: 'engineer',
				name: 'Engineer',
				icon: 'bi-code-slash',
				can: 'Integrations, API keys and settings. Can view reports.',
			},
			{
				id: 'readonly',
				name: 'Read-only',
				icon: 'bi-eye',
				can: 'Sees customers, the schedule board and reports. Changes nothing.',
			},
		],
		teams: ['Support', 'Success', 'Sales', 'Product', 'Engineering', 'Marketing', 'Finance', 'Operations'],
		invites: [
			{
				id: 'i-101',
				email: 'lori.rhodes@fieldline.app',
				role: 'support',
				team: 'Support',
				by: 'pr',
				sent: '2026-09-30',
				expires: '2026-10-07',
				status: 'pending',
				resent: 0,
			},
			{
				id: 'i-102',
				email: 'dev.dixon@fieldline.app',
				role: 'dispatch',
				team: 'Operations',
				by: 'ab',
				sent: '2026-10-01',
				expires: '2026-10-08',
				status: 'pending',
				resent: 0,
			},
			{
				id: 'i-103',
				email: 'pamela.quigley@fieldline.app',
				role: 'readonly',
				team: 'Sales',
				by: 'mb',
				sent: '2026-09-29',
				expires: '2026-10-06',
				status: 'pending',
				resent: 0,
			},
			{
				id: 'i-104',
				email: 'jim.mathis@fieldline.app',
				role: 'engineer',
				team: 'Engineering',
				by: 'th',
				sent: '2026-09-28',
				expires: '2026-10-05',
				status: 'pending',
				resent: 0,
			},
			{
				id: 'i-105',
				email: 'audit@harrowpartners.com',
				role: 'readonly',
				team: 'Finance',
				by: 'hs',
				sent: '2026-09-26',
				expires: '2026-10-03',
				status: 'pending',
				resent: 0,
			},
			{
				id: 'i-106',
				email: 'cheryl.larsen@fieldline.app',
				role: 'billing',
				team: 'Finance',
				by: 'hs',
				sent: '2026-09-25',
				expires: '2026-10-02',
				status: 'pending',
				resent: 1,
			},
			{
				id: 'i-090',
				email: 'mae.curry@fieldline.app',
				name: 'Mae Loy Curry',
				role: 'support',
				team: 'Support',
				by: 'pr',
				sent: '2026-09-21',
				accepted: '2026-09-22',
				method: 'Google SSO',
				status: 'accepted',
			},
			{
				id: 'i-088',
				email: 'jeffrey.mckay@fieldline.app',
				name: 'Jeffrey McKay',
				role: 'engineer',
				team: 'Engineering',
				by: 'th',
				sent: '2026-09-14',
				accepted: '2026-09-15',
				method: 'Okta SSO',
				status: 'accepted',
			},
			{
				id: 'i-086',
				email: 'allie.osgood@fieldline.app',
				name: 'Allie Osgood',
				role: 'dispatch',
				team: 'Operations',
				by: 'ab',
				sent: '2026-09-09',
				accepted: '2026-09-11',
				method: 'Password and 2FA',
				status: 'accepted',
			},
			{
				id: 'i-084',
				email: 'jacob.krause@fieldline.app',
				name: 'Jacob Krause',
				role: 'engineer',
				team: 'Engineering',
				by: 'th',
				sent: '2026-08-31',
				accepted: '2026-09-01',
				method: 'Okta SSO',
				status: 'accepted',
			},
			{
				id: 'i-081',
				email: 'lacey.hanson@fieldline.app',
				name: 'Lacey Hanson',
				role: 'support',
				team: 'Success',
				by: 'pr',
				sent: '2026-08-24',
				accepted: '2026-08-24',
				method: 'Google SSO',
				status: 'accepted',
			},
			{
				id: 'i-079',
				email: 'silas.beck@fieldline.app',
				name: 'Silas Beck',
				role: 'readonly',
				team: 'Sales',
				by: 'mb',
				sent: '2026-08-17',
				accepted: '2026-08-19',
				method: 'Google SSO',
				status: 'accepted',
			},
			{
				id: 'i-077',
				email: 'courtney.morton@fieldline.app',
				name: 'Courtney Morton',
				role: 'billing',
				team: 'Finance',
				by: 'hs',
				sent: '2026-08-12',
				accepted: '2026-08-13',
				method: 'Password and 2FA',
				status: 'accepted',
			},
			{
				id: 'i-074',
				email: 'ike.parsons@fieldline.app',
				name: 'Ike Parsons',
				role: 'dispatch',
				team: 'Operations',
				by: 'ab',
				sent: '2026-08-04',
				accepted: '2026-08-07',
				method: 'Okta SSO',
				status: 'accepted',
			},
			{
				id: 'i-070',
				email: 'marshall.kerr@fieldline.app',
				name: 'Marshall Kerr',
				role: 'readonly',
				team: 'Marketing',
				by: 'ja',
				sent: '2026-07-21',
				accepted: '2026-07-22',
				method: 'Google SSO',
				status: 'accepted',
			},
			{
				id: 'i-068',
				email: 'ashley.steele@fieldline.app',
				name: 'Ashley Steele',
				role: 'admin',
				team: 'Product',
				by: 'ja',
				sent: '2026-07-14',
				accepted: '2026-07-14',
				method: 'Okta SSO',
				status: 'accepted',
			},
			{
				id: 'i-087',
				email: 'charles.mosley@fieldline.app',
				role: 'support',
				team: 'Support',
				by: 'pr',
				sent: '2026-09-10',
				expires: '2026-09-17',
				status: 'expired',
				resent: 0,
			},
			{
				id: 'i-083',
				email: 'candace.brennan@fieldline.app',
				role: 'readonly',
				team: 'Marketing',
				by: 'ja',
				sent: '2026-08-27',
				expires: '2026-09-03',
				status: 'expired',
				resent: 1,
			},
			{
				id: 'i-080',
				email: 'tuan.hogan@brightpath.dev',
				role: 'engineer',
				team: 'Engineering',
				by: 'th',
				sent: '2026-08-20',
				expires: '2026-08-27',
				status: 'expired',
				resent: 0,
			},
		],
		links: [
			{
				id: 'l-12',
				name: 'Support new starters',
				code: 'k7Q2-wd9X',
				role: 'support',
				team: 'Support',
				domains: ['fieldline.app'],
				uses: 4,
				limit: 10,
				expires: '2026-10-16',
				by: 'pr',
				on: true,
			},
			{
				id: 'l-11',
				name: 'Brightpath contractors',
				code: 'B3rt-77Lm',
				role: 'engineer',
				team: 'Engineering',
				domains: ['brightpath.dev'],
				uses: 2,
				limit: 5,
				expires: '2026-12-31',
				by: 'th',
				on: true,
			},
			{
				id: 'l-09',
				name: 'Sales kickoff',
				code: 'Qp8s-Kd2v',
				role: 'readonly',
				team: 'Sales',
				domains: ['fieldline.app'],
				uses: 12,
				limit: 12,
				expires: '2026-10-09',
				by: 'mb',
				on: true,
			},
			{
				id: 'l-04',
				name: 'Okta pilot',
				code: 'Zx1o-Pp4t',
				role: 'readonly',
				team: 'Product',
				domains: [],
				uses: 3,
				limit: 0,
				expires: null,
				by: 'ja',
				on: false,
			},
		],
		settings: { reminder: true },
		/* The file behind "Use the sample file"; four of its rows are wrong on purpose. */
		sampleCsv: `email,role,team\nnadia.rahman@fieldline.app,Support agent,Support\nezra.fenwick@fieldline.app,Support agent,Support\nchloe.larson@fieldline.app,Engineer,Engineering\nravi.iyer@fieldline,Engineer,Engineering\npriya.reese@fieldline.app,Support agent,Support\noscar.leach@fieldline.app,Scheduling lead,Operations\nfatima.zahra@fieldline.app,Read-only,Marketing\nnadia.rahman@fieldline.app,Support agent,Support\n`,
	};

	const demoMode = new URLSearchParams(location.search).get('state');
	const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const stillClass = calm ? ' basalt-skeleton-still' : '';
	const ADDRESS_SHAPE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i;
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAY_MS = 86400000;
	const LOADING_FACES = ['idle', 'busy', 'done', 'fail'];

	/* Header text of the last column, and the hidden table caption, for each status tab. */
	const DATE_HEADING = { pending: 'Expires', accepted: 'Joined', expired: 'Ran out' };
	const TABLE_CAPTION = {
		pending: 'Invitations waiting for an answer',
		accepted: 'Invitations that were accepted',
		expired: 'Invitations that ran out without an answer',
	};

	/* How each tab orders its rows: soonest deadline first, or newest first. */
	const ROW_ORDER = {
		pending: (a, b) => dayNumber(a.expires) - dayNumber(b.expires) || a.email.localeCompare(b.email),
		accepted: (a, b) => dayNumber(b.accepted) - dayNumber(a.accepted),
		expired: (a, b) => dayNumber(b.expires) - dayNumber(a.expires),
	};

	/* What a tab says when it has nothing in it at all. */
	const EMPTY_TAB = {
		pending: {
			icon: 'bi-inbox',
			title: 'No one is waiting',
			text: 'Every invitation has been answered. New ones show here until people accept.',
			action: '<button type="button" class="btn btn-sm btn-outline-secondary" data-whs-invite><i class="bi bi-person-plus" aria-hidden="true"></i>Invite people</button>',
		},
		accepted: {
			icon: 'bi-person-check',
			title: 'Nobody has accepted yet',
			text: 'People show here once they accept and sign in for the first time.',
			action: '',
		},
		expired: {
			icon: 'bi-hourglass',
			title: 'Nothing has run out',
			text: "Invitations that aren't accepted within 7 days move here, so you can send them again.",
			action: '',
		},
	};

	/*
	 * Every request the page makes. The demo answers each after a short
	 * pause; put a fetch() to your own endpoint in each body and resolve
	 * with the same shape.
	 */
	let fetchCount = 0;
	const server = {
		/** GET /api/invitations?include=links,seats,settings, the whole page. */
		fetchAll() {
			fetchCount += 1;
			if (demoMode === 'error' && fetchCount === 1)
				return later(700).then(() => {
					throw new Error('The server did not answer');
				});
			if (demoMode === 'empty') return later(500, { ...SAMPLE_REPLY, invites: [], links: [] });
			return later(600, SAMPLE_REPLY);
		},
		/** POST /api/invitations { invites: [{ email, role, team }], note, addSeats }, buying seats first when asked. */
		invite(batch, note, addSeats) {
			return settle(700, { sent: batch.length });
		},
		/** POST /api/invitations/:id/resend, which also restarts the 7 days. */
		resendInvite(id) {
			return settle(400);
		},
		/** DELETE /api/invitations/:id, to cancel a waiting one or clear an expired one. */
		withdraw(id) {
			return settle(300);
		},
		/** POST /api/invitations/:id/restore, behind the Undo on a withdrawal. */
		reinstate(id) {
			return settle(300);
		},
		/** PATCH /api/invitations/:id { role } */
		setRole(id, roleId) {
			return settle(300);
		},
		/** POST /api/invite-links { name, role, team, expires, limit, domains } */
		addLink(draft) {
			return settle(500, { id: draft.id, code: draft.code });
		},
		/** PATCH /api/invite-links/:id { on }, to switch a link on or off. */
		toggleLink(id, on) {
			return settle(250);
		},
		/** DELETE /api/invite-links/:id */
		removeLink(id) {
			return settle(300);
		},
		/** PATCH /api/invitations/settings { reminder } */
		saveReminder(prefs) {
			return settle(250);
		},
	};

	/* Working data. `snapshot` is a private copy of what the server sent and is edited in place. */
	let snapshot = null;
	const listQuery = { status: 'pending', text: '', role: '' };
	let shownRows = [];
	let paging = null;
	const pageSetup = { total: 0, perPage: 10, noun: 'invitations', render: (from, to) => paintRows(from, to) };
	let roleTarget = null;
	let linkToDelete = null;
	let pendingCode = '';
	let entryMode = 'email';
	let fileRows = [];
	let searchDelay = 0;

	const ui = {
		cards: pick('.whs-grid', pageRoot),
		tbody: pick('[data-whs-body]', pageRoot),
		listTable: pick('[data-whs-table]', pageRoot),
		caption: pick('[data-whs-caption]', pageRoot),
		dateHead: pick('[data-whs-col-last]', pageRoot),
		pagerBox: pick('[data-whs-pager]', pageRoot),
		pageSize: pick('#whs-per'),
		searchBox: pick('[data-whs-search]', pageRoot),
		roleSelect: pick('[data-whs-role-filter]', pageRoot),
		countLine: pick('[data-whs-summary]', pageRoot),
		linkList: pick('[data-whs-links]', pageRoot),
		reminderSwitch: pick('[data-whs-remind]', pageRoot),
	};

	const roleDialog = document.getElementById('inv-role-modal');
	const deleteDialog = document.getElementById('inv-link-delete');
	const linkDialog = document.getElementById('inv-link-modal');
	const linkForm = pick('[data-whs-link-form]');
	const linkNameField = pick('[data-whs-link-name]');
	const domainBox = pick('[data-whs-link-domains]');

	const inviteDrawer = document.getElementById('inv-drawer');
	const inviteForm = pick('[data-whs-form]', inviteDrawer);
	const addressBox = pick('[data-whs-tags]', inviteDrawer);
	const addressInput = pick('.basalt-tags-input', addressBox);
	const rolePick = pick('[data-whs-role]', inviteDrawer);
	const teamPick = pick('[data-whs-team]', inviteDrawer);
	const sendButton = pick('[data-whs-send]', inviteDrawer);
	const seatWarning = pick('[data-whs-over]', inviteDrawer);
	const seatConsent = pick('[data-whs-over-ok]', inviteDrawer);
	const dropArea = pick('[data-whs-drop]', inviteDrawer);
	const fileReview = pick('[data-whs-csv]', inviteDrawer);

	start();

	/**
	 * Fills the pickers before basalt.js styles the selects, binds every
	 * control on the page and its dialogs, then asks for the first load.
	 */
	function start() {
		fillPickers();
		bindRoleDialog();
		bindList();
		bindLinks();
		bindLinkDialog();
		bindPanel();
		bindFileImport();
		document.addEventListener('click', (event) => {
			if (event.target.closest('[data-whs-invite]')) {
				event.preventDefault();
				openPanel();
				return;
			}
			if (event.target.closest('[data-whs-link-new]')) {
				event.preventDefault();
				openLinkDialog();
			}
		});
		fetchAndDraw();
	}

	/* Small shared tools. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	/** Escapes text for use inside generated markup; null and undefined become empty. */
	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	/** "1 seat", "3 seats", or the irregular form when one is given. */
	function howMany(amount, single, several) {
		return `${amount} ${amount === 1 ? single : several || `${single}s`}`;
	}

	function later(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	/** A write request: resolves after `ms`, or rejects when the demo runs with ?state=fail. */
	function settle(ms, value) {
		if (demoMode !== 'fail') return later(ms, value);
		return later(ms).then(() => {
			throw new Error('The server did not answer');
		});
	}

	function pickOption(select, value) {
		select.value = value;
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(select);
	}

	/* Dates are YYYY-MM-DD strings, compared as whole days since 1970. A
     live page would take today from new Date().toISOString().slice(0, 10). */

	function dayNumber(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return Date.UTC(year, month - 1, day) / DAY_MS;
	}

	function todayNumber() {
		return dayNumber(SAMPLE_REPLY.today);
	}

	function shiftDate(iso, days) {
		return new Date((dayNumber(iso) + days) * DAY_MS).toISOString().slice(0, 10);
	}

	function daysAhead(iso) {
		return dayNumber(iso) - todayNumber();
	}

	/** "Oct 7", with the year added only when it is not the current one. */
	function shortDate(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		const yearPart = year !== Number(SAMPLE_REPLY.today.slice(0, 4)) ? `, ${year}` : '';
		return `${MONTH_NAMES[month - 1]} ${day}${yearPart}`;
	}

	function sentWhen(iso) {
		const offset = daysAhead(iso);
		if (offset === 0) return 'Today';
		if (offset === -1) return 'Yesterday';
		return shortDate(iso);
	}

	function timeTag(iso, label) {
		return `<time datetime="${iso}">${htmlSafe(label || shortDate(iso))}</time>`;
	}

	/** Turns "mae.loy-curry@..." into "Mae Loy Curry" for the avatar initials. */
	function guessName(address) {
		const local = address.split('@')[0];
		return local
			.split(/[._-]+/)
			.filter(Boolean)
			.map((word) => word[0].toUpperCase() + word.slice(1))
			.join(' ');
	}

	function domainPart(address) {
		return (address.split('@')[1] || '').toLowerCase();
	}

	/* Lookups into the loaded snapshot. */

	function roleById(id) {
		return SAMPLE_REPLY.roles.find((entry) => entry.id === id) || { id, name: id, can: '' };
	}

	function memberById(id) {
		const people = snapshot ? snapshot.people : SAMPLE_REPLY.people;
		return people.find((entry) => entry.id === id) || { id, name: 'Someone', title: '' };
	}

	function findInvite(id) {
		return snapshot.invites.find((entry) => entry.id === id);
	}

	function findLink(id) {
		return snapshot.links.find((entry) => entry.id === id);
	}

	function waitingInvites() {
		return snapshot.invites.filter((entry) => entry.status === 'pending');
	}

	/** Seats on the plan, split into members, waiting invitations and what is still free. */
	function seatCount() {
		const { seats, members } = snapshot.workspace;
		const waiting = waitingInvites().length;
		return {
			total: seats,
			members,
			waiting,
			used: members + waiting,
			free: Math.max(0, seats - members - waiting),
		};
	}

	/* Role and team options come from configuration, so they are written
     into every picker here, while basalt.js has yet to style the selects. */
	function fillPickers() {
		const roleOptions = SAMPLE_REPLY.roles
			.map((entry) => `<option value="${entry.id}" data-icon="${entry.icon}">${htmlSafe(entry.name)}</option>`)
			.join('');
		const teamOptions = SAMPLE_REPLY.teams
			.map((team) => `<option value="${htmlSafe(team)}">${htmlSafe(team)}</option>`)
			.join('');
		ui.roleSelect.insertAdjacentHTML('beforeend', roleOptions);
		for (const hook of ['[data-whs-role]', '[data-whs-link-role]']) pick(hook).innerHTML = roleOptions;
		for (const hook of ['[data-whs-team]', '[data-whs-link-team]']) pick(hook).innerHTML = teamOptions;
		pick('[data-whs-role-choices]').innerHTML = SAMPLE_REPLY.roles
			.map(
				(entry) =>
					`<label class="basalt-choice"><input type="radio" name="whs-role-pick" value="${entry.id}"><i class="bi ${entry.icon}" aria-hidden="true"></i>${htmlSafe(entry.name)}</label>`,
			)
			.join('');
	}

	/* Shared pieces of generated markup. */

	/** One shimmering placeholder bar, circle or block. */
	function bone(shape, sizeClass) {
		return `<span class="basalt-skeleton basalt-skeleton-${shape} ${sizeClass}${stillClass}"></span>`;
	}

	/** The four labeled faces of a .btn-loading button; a face without an icon gets the spinner. */
	function loadingFaces(faces) {
		return faces
			.map(([icon, words], at) => {
				const mark = icon
					? `<i class="bi ${icon}" aria-hidden="true"></i>`
					: '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>';
				return `<span class="btn-loading-state btn-loading-${LOADING_FACES[at]}">${mark}${words}</span>`;
			})
			.join('');
	}

	function emptyBlock({ icon, title, text, action }) {
		const actions = action ? `<div class="basalt-empty-actions">${action}</div>` : '';
		return `<div class="basalt-empty basalt-empty-compact"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${actions}</div>`;
	}

	/* First load, its placeholders, and the error card when it fails. */

	function fetchAndDraw() {
		drawPlaceholders();
		server.fetchAll().then(adopt).catch(showLoadError);
	}

	/** Takes a copy of the server's answer, so Undo and rollbacks never touch SAMPLE_REPLY. */
	function adopt(payload) {
		snapshot = JSON.parse(JSON.stringify(payload));
		ui.listTable.setAttribute('aria-busy', 'false');
		ui.linkList.setAttribute('aria-busy', 'false');
		ui.reminderSwitch.checked = !!snapshot.settings.reminder;
		redraw();
	}

	function redraw(keepPage) {
		drawHeroFigures();
		drawList(keepPage);
		drawSeats();
		drawOutcomes();
		drawLinks();
	}

	function drawPlaceholders() {
		ui.listTable.setAttribute('aria-busy', 'true');
		ui.linkList.setAttribute('aria-busy', 'true');
		ui.pagerBox.hidden = true;
		ui.countLine.textContent = 'Loading invitations';
		const ghostRows = [0, 1, 2, 3, 4].map((at) => {
			const person = `<span class="whs-person">${bone('circle', 'whs-sk-avatar')}<span class="whs-person-text">${bone('text', `whs-sk-${at % 3}`)}${bone('text', 'whs-sk-short')}</span></span>`;
			return `<tr class="whs-row whs-row-ghost" aria-hidden="true"><td>${person}</td><td class="whs-col-role">${bone('text', 'whs-sk-short')}</td><td class="whs-col-by">${bone('text', 'whs-sk-short')}</td><td class="whs-col-date">${bone('text', 'whs-sk-tiny')}</td><td class="whs-col-act">${bone('btn', 'whs-sk-btn')}</td></tr>`;
		});
		ui.tbody.innerHTML = ghostRows.join('');
		const ghostLink = `<li class="whs-link whs-link-ghost" aria-hidden="true">${bone('block', 'whs-sk-tile')}<span class="whs-link-main">${bone('title', 'whs-sk-1')}${bone('text', 'whs-sk-0')}</span></li>`;
		ui.linkList.innerHTML = ghostLink + ghostLink;
	}

	/* The error card is built once, then only shown or hidden again. */
	function showLoadError() {
		ui.cards.hidden = true;
		const errorCard = pick('[data-whs-error]', pageRoot) || buildErrorCard();
		errorCard.hidden = false;
		ui.countLine.textContent = '';
	}

	function buildErrorCard() {
		const errorCard = document.createElement('section');
		errorCard.className = 'card basalt-box whs-error';
		errorCard.setAttribute('data-whs-error', '');
		errorCard.setAttribute('aria-labelledby', 'whs-error-title');
		const retry = `<button type="button" class="btn btn-sm btn-outline-secondary btn-loading" data-whs-retry>${loadingFaces(
			[
				['bi-arrow-clockwise', 'Try again'],
				[null, 'Trying'],
				['bi-check2', 'Loaded'],
				['bi-exclamation-circle', 'Still not loading'],
			],
		)}</button>`;
		errorCard.innerHTML = `<div class="basalt-empty basalt-empty-danger"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-cloud-slash"></i></span><h2 class="basalt-empty-title" id="whs-error-title" tabindex="-1">Invitations didn't load</h2><p class="basalt-empty-text">The server didn't answer. No invitation was changed; this page just couldn't reach them.</p><div class="basalt-empty-actions">${retry}</div></div>`;
		ui.cards.before(errorCard);
		pick('[data-whs-retry]', errorCard).addEventListener('click', (event) => {
			const button = event.currentTarget;
			window.Basalt.buttonState(button, 'loading');
			server
				.fetchAll()
				.then((payload) => {
					window.Basalt.buttonState(button, 'idle');
					errorCard.hidden = true;
					ui.cards.hidden = false;
					adopt(payload);
					say('Invitations loaded');
				})
				.catch(() => window.Basalt.buttonState(button, 'error'));
		});
		return errorCard;
	}

	/* Header figures, the seat meter and the accept rate. */

	/** Invitations sent in the last 90 days: how many were accepted, ran out or still wait, the rate and the median days to accept. */
	function outcomeStats() {
		const cutoff = todayNumber() - 90;
		const windowed = snapshot.invites.filter((entry) => dayNumber(entry.sent) >= cutoff);
		const tally = (kind) => windowed.filter((entry) => entry.status === kind);
		const accepted = tally('accepted');
		const expired = tally('expired').length;
		const waiting = tally('pending').length;
		const answered = accepted.length + expired;
		const waits = accepted.map((entry) => dayNumber(entry.accepted) - dayNumber(entry.sent)).sort((a, b) => a - b);
		const middle = Math.floor(waits.length / 2);
		let median = null;
		if (waits.length) median = waits.length % 2 ? waits[middle] : (waits[middle - 1] + waits[middle]) / 2;
		const acceptRate = answered ? Math.round((accepted.length / answered) * 100) : null;
		return { accepted: accepted.length, expired, waiting, rate: acceptRate, median };
	}

	function drawHeroFigures() {
		const seatsNow = seatCount();
		const figures = { pending: seatsNow.waiting, rate: `${outcomeStats().rate || 0}%`, seats: seatsNow.free };
		for (const [key, value] of Object.entries(figures))
			pick(`[data-whs-fig="${key}"]`, pageRoot).textContent = value;
	}

	function drawSeats() {
		const seatsNow = seatCount();
		const { plan, seats } = snapshot.workspace;
		const share = (part) => `${(part / seatsNow.total) * 100}%`;
		pick('[data-whs-plan]', pageRoot).textContent =
			`${plan} plan, ${howMany(seats, 'seat')}. A waiting invitation holds a seat until it is answered.`;
		pick('[data-whs-seats-used]', pageRoot).textContent = seatsNow.used;
		pick('[data-whs-seats-of]', pageRoot).textContent = `of ${seatsNow.total} in use`;
		pick('[data-whs-meter-members]', pageRoot).style.width = share(seatsNow.members);
		pick('[data-whs-meter-pending]', pageRoot).style.width = share(seatsNow.waiting);
		pick('[data-whs-meter]', pageRoot).setAttribute(
			'aria-label',
			`${seatsNow.members} members and ${seatsNow.waiting} waiting invitations use ${seatsNow.used} of ${seatsNow.total} seats`,
		);
		pick('[data-whs-seat="members"]', pageRoot).textContent = seatsNow.members;
		pick('[data-whs-seat="pending"]', pageRoot).textContent = seatsNow.waiting;
		pick('[data-whs-seat="free"]', pageRoot).textContent = seatsNow.free;
		drawSeatNote(seatsNow.free);
	}

	/** The callout under the meter: calm while there is room, louder as seats run out. */
	function drawSeatNote(free) {
		const note = pick('[data-whs-seat-note]', pageRoot);
		if (free === 0) {
			note.className = 'whs-callout whs-callout-danger';
			note.innerHTML =
				'<i class="bi bi-exclamation-octagon" aria-hidden="true"></i><span>Every seat is taken. New invitations ask you to add seats first, and invite links stop letting people in.</span>';
			return;
		}
		if (free <= 3) {
			const left = free === 1 ? 'One seat is left.' : `Only ${free} seats are left.`;
			note.className = 'whs-callout whs-callout-warning';
			note.innerHTML = `<i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${left} Invite more people than that and you'll be asked to add seats before anything is sent.</span>`;
			return;
		}
		note.className = 'whs-callout';
		note.innerHTML = `<i class="bi bi-check2-circle" aria-hidden="true"></i><span>Room for ${howMany(free, 'more person', 'more people')} on this plan.</span>`;
	}

	function drawOutcomes() {
		const stats = outcomeStats();
		const medianValue = pick('[data-whs-median]', pageRoot);
		pick('[data-whs-rate]', pageRoot).textContent = stats.rate == null ? '0%' : `${stats.rate}%`;
		/* Until someone accepts there is no typical wait, so that figure hides. */
		medianValue.closest('.whs-rate-stat').hidden = stats.median == null;
		medianValue.textContent = stats.median == null ? '' : String(stats.median);
		pick('[data-whs-median-label]', pageRoot).textContent =
			stats.median === 1 ? 'day to accept, typically' : 'days to accept, typically';
		const sum = stats.accepted + stats.waiting + stats.expired;
		const outcomeRows = [
			['accepted', 'Accepted', stats.accepted],
			['waiting', 'Still waiting', stats.waiting],
			['expired', 'Ran out', stats.expired],
		];
		const barList = pick('[data-whs-rate-bars]', pageRoot);
		barList.setAttribute(
			'aria-label',
			`What happened to the ${howMany(sum, 'invitation')} sent in the last 90 days`,
		);
		barList.innerHTML = outcomeRows
			.map(
				([key, label, amount]) =>
					`<li class="whs-bar whs-bar-${key}"><span class="whs-bar-label">${label}</span><span class="whs-bar-track" aria-hidden="true"><span class="whs-bar-fill" data-w="${sum ? (amount / sum) * 100 : 0}"></span></span><span class="whs-bar-num basalt-num">${amount}</span></li>`,
			)
			.join('');
		sizeBars('.whs-bar-fill', barList);
	}

	/** Copies each bar's data-w into its width, since the markup carries no inline styles. */
	function sizeBars(selector, scope) {
		for (const bar of pickAll(selector, scope)) bar.style.width = `${bar.getAttribute('data-w')}%`;
	}

	/* The invitation table: filtering, paging and the markup of a row. */

	function passesFilters(entry) {
		if (listQuery.role && entry.role !== listQuery.role) return false;
		if (!listQuery.text) return true;
		const needle = listQuery.text.toLowerCase();
		const haystack = [entry.email, entry.name, entry.team, roleById(entry.role).name, memberById(entry.by).name];
		return haystack.some((field) => field && field.toLowerCase().includes(needle));
	}

	function drawList(keepPage) {
		for (const tabName of ['pending', 'accepted', 'expired']) {
			pick(`[data-whs-count="${tabName}"]`, pageRoot).textContent = snapshot.invites.filter(
				(entry) => entry.status === tabName,
			).length;
		}
		ui.dateHead.textContent = DATE_HEADING[listQuery.status];
		ui.caption.textContent = TABLE_CAPTION[listQuery.status];
		const tabEntries = snapshot.invites.filter((entry) => entry.status === listQuery.status);
		shownRows = tabEntries.filter(passesFilters).sort(ROW_ORDER[listQuery.status]);
		ui.countLine.textContent =
			tabEntries.length === shownRows.length
				? howMany(shownRows.length, 'invitation')
				: `${shownRows.length} of ${howMany(tabEntries.length, 'invitation')}`;

		if (!shownRows.length) {
			ui.pagerBox.hidden = true;
			const blank = tabEntries.length
				? emptyBlock({
						icon: 'bi-search',
						title: 'No invitations match',
						text: 'Check the spelling, or try every role.',
						action: '<button type="button" class="btn btn-sm btn-outline-secondary" data-whs-clear>Clear the search</button>',
					})
				: emptyBlock(EMPTY_TAB[listQuery.status]);
			ui.tbody.innerHTML = `<tr class="basalt-empty-row"><td colspan="5">${blank}</td></tr>`;
			return;
		}

		ui.pagerBox.hidden = shownRows.length <= 5;
		pageSetup.total = shownRows.length;
		if (!paging) {
			paging = window.Basalt.pager ? window.Basalt.pager(ui.pagerBox, pageSetup) : null;
			if (!paging) paintRows(1, shownRows.length);
			return;
		}
		const wanted = keepPage ? paging.get() : 1;
		const rowsPerPage = parseInt(ui.pageSize.value, 10) || 10;
		const lastPage = Math.max(1, Math.ceil(shownRows.length / rowsPerPage));
		paging.setTotal(lastPage);
		paging.set(1);
		/* The size select's own handler redraws the range line and the rows on screen. */
		ui.pageSize.dispatchEvent(new Event('change'));
		if (wanted > 1) paging.set(Math.min(wanted, lastPage));
	}

	function paintRows(from, to) {
		ui.tbody.innerHTML = shownRows
			.slice(from - 1, to)
			.map(rowMarkup)
			.join('');
		if (window.Basalt.avatars) window.Basalt.avatars(ui.tbody);
	}

	function rowMarkup(entry) {
		const { domain } = snapshot.workspace;
		const roleName = htmlSafe(roleById(entry.role).name);
		const awayNote =
			domainPart(entry.email) !== domain ? ` · <span class="whs-outside">Outside ${htmlSafe(domain)}</span>` : '';
		const emailLead = entry.name ? `${htmlSafe(entry.email)} · ` : '';
		const resentNote = entry.resent && entry.status === 'pending' ? ', resent' : '';
		const avatar = `<span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(entry.name || guessName(entry.email))}" aria-hidden="true"></span>`;
		const who = `<span class="whs-person">${avatar}<span class="whs-person-text"><span class="whs-person-name">${htmlSafe(entry.name || entry.email)}</span><span class="whs-sub">${emailLead}${htmlSafe(entry.team)}<span class="whs-role-inline"> · ${roleName}</span>${awayNote}</span></span></span>`;
		const invitedBy = `<span class="whs-by">${htmlSafe(memberById(entry.by).name)}</span><span class="whs-sub">${timeTag(entry.sent, sentWhen(entry.sent))}${resentNote}</span>`;
		return `<tr class="whs-row" data-id="${entry.id}"><td class="whs-col-person">${who}</td><td class="whs-col-role" data-label="Role">${roleName}</td><td class="whs-col-by" data-label="Invited">${invitedBy}</td><td class="whs-col-date" data-label="${DATE_HEADING[entry.status]}">${dateCell(entry)}</td><td class="whs-col-act"><div class="whs-actions">${rowButtons(entry)}</div></td></tr>`;
	}

	/** Joined date and sign-in method, the lapse date, or a countdown to the deadline. */
	function dateCell(entry) {
		if (entry.status === 'accepted')
			return `${timeTag(entry.accepted)}<span class="whs-sub">${htmlSafe(entry.method)}</span>`;
		if (entry.status === 'expired')
			return `${timeTag(entry.expires)}${entry.resent ? '<span class="whs-sub">after a resend</span>' : ''}`;
		const left = daysAhead(entry.expires);
		let countdown = `In ${left} days`;
		if (left <= 0) countdown = 'Today';
		else if (left === 1) countdown = 'Tomorrow';
		const tone = left <= 1 ? 'basalt-status-warning' : 'basalt-status-info';
		return `<span class="basalt-status basalt-status-dot ${tone}">${timeTag(entry.expires, countdown)}</span><span class="whs-sub">${shortDate(entry.expires)}</span>`;
	}

	function menuItem(hook, icon, label, danger) {
		return `<li><button type="button" class="dropdown-item${danger ? ' whs-danger-item' : ''}" ${hook}><i class="bi ${icon}" aria-hidden="true"></i>${label}</button></li>`;
	}

	/** Open for accepted people; Resend plus a menu for waiting and expired invitations. */
	function rowButtons(entry) {
		const who = htmlSafe(entry.name || entry.email);
		if (entry.status === 'accepted') {
			return `<a class="btn btn-sm btn-outline-secondary" href="employee-users.html" aria-label="Open ${who} in Employee Users"><i class="bi bi-person" aria-hidden="true"></i><span class="whs-act-label">Open</span></a>`;
		}
		const tag = (words) => `<span class="whs-act-label">${words}</span>`;
		const resendButton = `<button type="button" class="btn btn-sm btn-outline-secondary btn-loading" data-whs-resend aria-label="Send again to ${who}">${loadingFaces(
			[
				['bi-send', tag('Resend')],
				[null, tag('Sending')],
				['bi-check2', tag('Sent')],
				['bi-exclamation-circle', tag('Not sent')],
			],
		)}</button>`;
		const menuItems = [menuItem('data-whs-role-open', 'bi-person-badge', 'Change the role')];
		if (entry.status === 'pending')
			menuItems.push(menuItem('data-whs-copy', 'bi-copy', 'Copy the invitation link'));
		menuItems.push('<li><hr class="dropdown-divider"></li>');
		menuItems.push(
			entry.status === 'expired'
				? menuItem('data-whs-revoke', 'bi-x-circle', 'Remove from the list', true)
				: menuItem('data-whs-revoke', 'bi-x-circle', 'Revoke', true),
		);
		const menuToggle = `<button type="button" class="btn btn-sm whs-iconbtn" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${who}"><i class="bi bi-three-dots" aria-hidden="true"></i></button>`;
		return `${resendButton}<div class="dropdown whs-more">${menuToggle}<ul class="dropdown-menu dropdown-menu-end">${menuItems.join('')}</ul></div>`;
	}

	/** Replays the short tint on a row that just changed. */
	function pulseRow(id) {
		const row = pick(`[data-id="${id}"]`, ui.tbody);
		if (!row || calm) return;
		row.classList.remove('is-fresh');
		void row.offsetWidth;
		row.classList.add('is-fresh');
	}

	function switchTab(tabName) {
		listQuery.status = tabName;
		const radio = pick(`#whs-status-${tabName}`);
		if (!radio || radio.checked) return;
		radio.checked = true;
		radio.dispatchEvent(new Event('change', { bubbles: true }));
	}

	/* Wiring for the table, its tabs and filters, and the reminder switch. */

	function bindList() {
		ui.tbody.addEventListener('click', onListClick);

		for (const radio of pickAll('input[name="whs-status"]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked || !snapshot) return;
				listQuery.status = radio.value;
				drawList();
			});
		}

		ui.searchBox.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => {
				listQuery.text = ui.searchBox.value.trim();
				if (snapshot) drawList();
			}, 150);
		});
		ui.roleSelect.addEventListener('change', () => {
			listQuery.role = ui.roleSelect.value;
			if (snapshot) drawList();
		});

		ui.reminderSwitch.addEventListener('change', saveReminderChoice);
	}

	function onListClick(event) {
		const row = event.target.closest('tr[data-id]');
		if (event.target.closest('[data-whs-clear]')) {
			ui.searchBox.value = '';
			listQuery.text = '';
			pickOption(ui.roleSelect, '');
			listQuery.role = '';
			drawList();
			ui.searchBox.focus();
			return;
		}
		const entry = row && findInvite(row.getAttribute('data-id'));
		if (!entry) return;
		const resendButton = event.target.closest('[data-whs-resend]');
		if (resendButton) sendAgain(entry, resendButton);
		else if (event.target.closest('[data-whs-revoke]')) withdrawInvite(entry);
		else if (event.target.closest('[data-whs-role-open]')) openRoleDialog(entry);
		else if (event.target.closest('[data-whs-copy]')) copyInviteLink(entry);
	}

	function saveReminderChoice() {
		const on = ui.reminderSwitch.checked;
		snapshot.settings.reminder = on;
		server
			.saveReminder(snapshot.settings)
			.then(() => {
				notify({
					tone: 'success',
					title: on ? 'Reminders on' : 'Reminders off',
					text: on
						? 'People get one reminder 2 days before their invitation runs out.'
						: 'No reminder emails will be sent.',
					duration: 3500,
				});
			})
			.catch(() => {
				snapshot.settings.reminder = !on;
				ui.reminderSwitch.checked = !on;
				notify({
					tone: 'danger',
					title: "Couldn't save the reminder setting",
					text: 'It is back how it was. Try again in a moment.',
				});
			});
	}

	/* Changes to single invitations. Each one shows first, then asks the
     server, and rolls back with a toast when the server says no. */

	/** Builds the catch handler that runs `restore`, redraws and explains what failed. */
	function rollbackWith(action, restore) {
		return () => {
			restore?.();
			redraw(true);
			notify({
				tone: 'danger',
				title: `Couldn't ${action}`,
				text: 'Nothing was changed. Try again in a moment.',
			});
		};
	}

	/* A resend waits for the server before touching the screen, so a failure has nothing to undo. */
	function sendAgain(entry, button) {
		if (entry.status === 'expired' && seatCount().free < 1) {
			notify({
				tone: 'warning',
				title: 'No free seats',
				text: 'Add seats, or revoke a waiting invitation, before sending this again.',
			});
			return;
		}
		if (button) window.Basalt.buttonState(button, 'loading');
		server
			.resendInvite(entry.id)
			.then(() => {
				const revived = entry.status === 'expired';
				Object.assign(entry, {
					sent: SAMPLE_REPLY.today,
					expires: shiftDate(SAMPLE_REPLY.today, snapshot.workspace.inviteDays),
					status: 'pending',
					resent: (entry.resent || 0) + 1,
				});
				if (button) window.Basalt.buttonState(button, 'success');
				setTimeout(
					() => {
						redraw(!revived);
						if (!revived) pulseRow(entry.id);
					},
					button && !calm ? 700 : 0,
				);
				notify({
					tone: 'success',
					title: `Sent again to ${entry.email}`,
					text: `It now works until ${shortDate(entry.expires)}.${revived ? ' It is back under Waiting.' : ''}`,
				});
			})
			.catch(() => {
				if (button) window.Basalt.buttonState(button, 'error');
				notify({
					tone: 'danger',
					title: "Couldn't send it again",
					text: `The invitation to ${entry.email} hasn't changed. Try again in a moment.`,
				});
			});
	}

	function withdrawInvite(entry) {
		const slot = snapshot.invites.indexOf(entry);
		const clearing = entry.status === 'expired';
		const putBack = () => {
			if (!findInvite(entry.id)) snapshot.invites.splice(Math.min(slot, snapshot.invites.length), 0, entry);
		};
		snapshot.invites.splice(slot, 1);
		redraw(true);
		say(`${clearing ? 'Removed ' : 'Revoked the invitation to '}${entry.email}`);
		server
			.withdraw(entry.id)
			.then(() => {
				notify({
					tone: 'info',
					icon: 'bi-x-circle',
					title: clearing ? 'Removed from the list' : 'Invitation revoked',
					text: clearing
						? `${entry.email} is off the Expired list.`
						: `The link sent to ${entry.email} no longer works, and the seat is free again.`,
					actions: [{ label: 'Undo', onClick: undoWithdraw }],
				});
			})
			.catch(rollbackWith(clearing ? 'remove it' : 'revoke the invitation', putBack));

		function undoWithdraw() {
			putBack();
			redraw(true);
			pulseRow(entry.id);
			say(`Put back the invitation to ${entry.email}`);
			server.reinstate(entry.id).catch(
				rollbackWith('put the invitation back', () => {
					snapshot.invites = snapshot.invites.filter((other) => other !== entry);
				}),
			);
		}
	}

	/* Each pending invitation has its own copyable link; only the invited address can use it. */
	function copyInviteLink(entry) {
		const url = `${snapshot.workspace.joinUrl.replace('/join/', '/invite/')}${entry.id.replace('i-', 'FL')}x${entry.email.length}`;
		const confirm = () =>
			notify({
				tone: 'success',
				icon: 'bi-copy',
				title: 'Invitation link copied',
				text: `Only ${entry.email} can use it.`,
				duration: 3000,
			});
		(window.Basalt.copyText ? window.Basalt.copyText(url) : Promise.resolve()).then(confirm).catch(confirm);
	}

	/* The change role dialog. */

	function bindRoleDialog() {
		roleDialog.addEventListener('change', describePickedRole);
		roleDialog.addEventListener('shown.bs.modal', () => pick('input:checked', roleDialog)?.focus());
		pick('[data-whs-role-form]').addEventListener('submit', (event) => {
			event.preventDefault();
			const picked = pick('input[name="whs-role-pick"]:checked', roleDialog);
			const entry = roleTarget;
			bootstrap.Modal.getOrCreateInstance(roleDialog).hide();
			if (picked && entry && picked.value !== entry.role) applyRole(entry, picked.value);
		});
	}

	function openRoleDialog(entry) {
		roleTarget = entry;
		pick('[data-whs-role-who]', roleDialog).textContent =
			`For ${entry.email}. The invitation keeps its dates; they join with the role you pick.`;
		const matching = pick(`input[value="${entry.role}"]`, roleDialog);
		if (matching) matching.checked = true;
		describePickedRole();
		bootstrap.Modal.getOrCreateInstance(roleDialog).show();
	}

	function describePickedRole() {
		const picked = pick('input[name="whs-role-pick"]:checked', roleDialog);
		const chosen = picked && roleById(picked.value);
		pick('[data-whs-role-desc]', roleDialog).textContent = chosen ? `${chosen.name}: ${chosen.can}` : '';
	}

	function applyRole(entry, roleId) {
		const oldRole = entry.role;
		entry.role = roleId;
		redraw(true);
		pulseRow(entry.id);
		server
			.setRole(entry.id, entry.role)
			.then(() => {
				notify({
					tone: 'success',
					title: `${entry.email} will join as ${roleById(entry.role).name}`,
					text: `Was ${roleById(oldRole).name}.`,
					actions: [
						{
							label: 'Undo',
							onClick() {
								const undone = entry.role;
								entry.role = oldRole;
								redraw(true);
								server.setRole(entry.id, oldRole).catch(
									rollbackWith('change the role back', () => {
										entry.role = undone;
									}),
								);
							},
						},
					],
				});
			})
			.catch(
				rollbackWith('change the role', () => {
					entry.role = oldRole;
				}),
			);
	}

	/* Invite links: the list, its on and off switches, and deleting one. */

	/** Off wins over everything; then a passed end date; then a reached limit. */
	function linkStatus(entry) {
		if (!entry.on) return { key: 'off', label: 'Off', tone: '' };
		if (entry.expires && daysAhead(entry.expires) < 0)
			return { key: 'expired', label: 'Ran out', tone: 'basalt-status-danger' };
		if (entry.limit && entry.uses >= entry.limit)
			return { key: 'full', label: 'Used up', tone: 'basalt-status-warning' };
		return { key: 'on', label: 'Working', tone: 'basalt-status-success' };
	}

	/** Role and team, the allowed domains and the end date, as list items. */
	function linkFactItems(entry) {
		const fact = (icon, body) => `<li><i class="bi ${icon}" aria-hidden="true"></i><span>${body}</span></li>`;
		const grant = roleById(entry.role);
		const reach = entry.domains.length ? `${htmlSafe(entry.domains.join(', '))} only` : 'Any email address';
		let ending = 'No end date';
		if (entry.expires) ending = `${daysAhead(entry.expires) < 0 ? 'Ran out ' : 'Until '}${timeTag(entry.expires)}`;
		return (
			fact(grant.icon, `${htmlSafe(grant.name)}, ${htmlSafe(entry.team)}`) +
			fact('bi-at', reach) +
			fact('bi-calendar3', ending)
		);
	}

	function drawLinks() {
		const holder = ui.linkList;
		if (!snapshot.links.length) {
			holder.innerHTML = `<li class="whs-links-empty">${emptyBlock({ icon: 'bi-link-45deg', title: 'No invite links yet', text: 'A link is handy for a group, like a new support cohort. Each one has its own role and limits.', action: '<button type="button" class="btn btn-sm btn-outline-secondary" data-whs-link-new><i class="bi bi-plus-lg" aria-hidden="true"></i>New link</button>' })}</li>`;
			return;
		}
		holder.innerHTML = snapshot.links.map(linkMarkup).join('');
		sizeBars('.whs-link-fill', holder);
		if (window.Basalt.buttons) window.Basalt.buttons(holder);
	}

	function linkMarkup(entry) {
		const badge = linkStatus(entry);
		const url = snapshot.workspace.joinUrl + entry.code;
		const nameHtml = htmlSafe(entry.name);
		const switchId = `whs-link-on-${entry.id}`;
		const filled = entry.limit ? Math.min(100, (entry.uses / entry.limit) * 100) : 0;
		const usedWords = entry.limit ? `of ${entry.limit} used` : entry.uses === 1 ? 'person joined' : 'people joined';
		const gauge = entry.limit
			? `<span class="whs-link-track" aria-hidden="true"><span class="whs-link-fill" data-w="${filled}"></span></span>`
			: '<span class="whs-sub">No limit</span>';
		const copyButton = `<button type="button" class="btn btn-sm whs-iconbtn" data-basalt-copy="${htmlSafe(url)}" aria-label="Copy the link for ${nameHtml}"${entry.on ? '' : ' disabled'}><i class="bi bi-copy" aria-hidden="true"></i></button>`;
		const mainBlock = `<div class="whs-link-main"><p class="whs-link-name"><span>${nameHtml}</span><span class="basalt-status ${badge.tone}">${badge.label}</span></p><p class="whs-link-url"><span class="whs-link-code">${htmlSafe(url)}</span>${copyButton}</p><ul class="whs-link-facts">${linkFactItems(entry)}</ul></div>`;
		const uses = `<div class="whs-link-uses"><p class="whs-link-count"><strong class="basalt-num">${entry.uses}</strong> ${usedWords}</p>${gauge}</div>`;
		const onSwitch = `<div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" role="switch" id="${switchId}" data-whs-link-on${entry.on ? ' checked' : ''}><label class="form-check-label" for="${switchId}">On<span class="visually-hidden">: ${nameHtml}</span></label></div>`;
		const controls = `<div class="whs-link-acts">${onSwitch}<button type="button" class="btn btn-sm whs-iconbtn" data-whs-link-del aria-label="Delete ${nameHtml}"><i class="bi bi-trash3" aria-hidden="true"></i></button></div>`;
		return `<li class="whs-link whs-link-${badge.key}" data-link="${entry.id}"><span class="whs-link-icon" aria-hidden="true"><i class="bi bi-link-45deg"></i></span>${mainBlock}${uses}${controls}</li>`;
	}

	function linkOf(control) {
		return findLink(control.closest('[data-link]').getAttribute('data-link'));
	}

	function bindLinks() {
		ui.linkList.addEventListener('change', (event) => {
			const flip = event.target.closest('[data-whs-link-on]');
			if (flip) switchLink(linkOf(flip), flip.checked, true);
		});
		ui.linkList.addEventListener('click', (event) => {
			const trash = event.target.closest('[data-whs-link-del]');
			if (!trash) return;
			linkToDelete = linkOf(trash);
			pick('[data-whs-del-title]', deleteDialog).textContent = `Delete "${linkToDelete.name}"?`;
			bootstrap.Modal.getOrCreateInstance(deleteDialog).show();
		});
		pick('[data-whs-del-go]', deleteDialog).addEventListener('basalt:confirm', deleteChosenLink);
	}

	/** Flips a link on or off. Only a change the person made offers Undo; the Undo itself does not. */
	function switchLink(entry, on, offerUndo) {
		entry.on = on;
		drawLinks();
		pick(`[data-link="${entry.id}"] [data-whs-link-on]`, ui.linkList)?.focus();
		say(`${entry.name}${on ? ' turned on' : ' turned off'}`);
		server
			.toggleLink(entry.id, on)
			.then(() => {
				if (!offerUndo) return;
				notify({
					tone: on ? 'success' : 'info',
					icon: on ? 'bi-link-45deg' : 'bi-slash-circle',
					title: on ? `${entry.name} works again` : `${entry.name} turned off`,
					text: on
						? 'People can join with it until it runs out or reaches its limit.'
						: 'Anyone who opens it now sees that it no longer works.',
					actions: [
						{
							label: 'Undo',
							onClick() {
								switchLink(entry, !on, false);
							},
						},
					],
				});
			})
			.catch(() => {
				entry.on = !on;
				drawLinks();
				notify({
					tone: 'danger',
					title: `Couldn't turn ${on ? 'on ' : 'off '}${entry.name}`,
					text: 'Nothing was changed. Try again in a moment.',
				});
			});
	}

	/* Runs once the hold-to-confirm button has been held long enough. */
	function deleteChosenLink() {
		const entry = linkToDelete;
		if (!entry) return;
		bootstrap.Modal.getOrCreateInstance(deleteDialog).hide();
		const slot = snapshot.links.indexOf(entry);
		snapshot.links.splice(slot, 1);
		drawLinks();
		say(`${entry.name} deleted`);
		server
			.removeLink(entry.id)
			.then(() => {
				notify({
					tone: 'info',
					icon: 'bi-trash3',
					title: `${entry.name} deleted`,
					text: 'People who joined with it keep their accounts.',
				});
			})
			.catch(
				rollbackWith('delete the link', () => {
					snapshot.links.splice(slot, 0, entry);
				}),
			);
	}

	/* The new link dialog, with a preview that follows every field. */

	function bindLinkDialog() {
		linkDialog.addEventListener('shown.bs.modal', () => linkNameField.focus());
		for (const eventName of ['input', 'change']) linkDialog.addEventListener(eventName, drawLinkPreview);
		linkForm.addEventListener('submit', createLink);
	}

	/** Eight characters from an alphabet without look-alikes, split 4-4. */
	function randomCode() {
		const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
		const picks = Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
		return `${picks.slice(0, 4)}-${picks.slice(4)}`;
	}

	/** The link as the form describes it right now. */
	function linkFromForm() {
		const lifetime = parseInt(pick('input[name="whs-link-exp"]:checked', linkDialog)?.value || '7', 10);
		const domains = domainBox.basaltTags
			? domainBox.basaltTags.get().map((domain) => domain.toLowerCase().replace(/^@/, ''))
			: [];
		return {
			name: linkNameField.value.trim(),
			role: pick('[data-whs-link-role]').value,
			team: pick('[data-whs-link-team]').value,
			expires: lifetime ? shiftDate(SAMPLE_REPLY.today, lifetime) : null,
			limit: Math.max(0, parseInt(pick('[data-whs-link-limit]').value, 10) || 0),
			domains,
		};
	}

	function drawLinkPreview() {
		const draft = { ...linkFromForm(), code: pendingCode, uses: 0 };
		const reach = draft.limit ? `Up to ${howMany(draft.limit, 'person', 'people')}` : 'No limit on people';
		pick('[data-whs-link-url]').textContent =
			(snapshot ? snapshot.workspace.joinUrl : SAMPLE_REPLY.workspace.joinUrl) + pendingCode;
		pick('[data-whs-link-facts]').innerHTML =
			`${linkFactItems(draft)}<li><i class="bi bi-people" aria-hidden="true"></i><span>${reach}</span></li>`;
		pick('[data-whs-link-warn]').hidden = !!(draft.domains.length || draft.limit);
	}

	function openLinkDialog() {
		if (!snapshot) return;
		const weekOption = pick('#whs-link-exp-7');
		linkForm.classList.remove('was-validated');
		linkNameField.value = '';
		pickOption(pick('[data-whs-link-role]'), 'support');
		pickOption(pick('[data-whs-link-team]'), 'Support');
		weekOption.checked = true;
		weekOption.dispatchEvent(new Event('change', { bubbles: true }));
		pick('[data-whs-link-limit]').value = '10';
		if (domainBox.basaltTags) domainBox.basaltTags.set([snapshot.workspace.domain]);
		pendingCode = randomCode();
		drawLinkPreview();
		window.Basalt.buttonState(pick('[data-whs-link-save]'), 'idle');
		bootstrap.Modal.getOrCreateInstance(linkDialog).show();
	}

	function createLink(event) {
		event.preventDefault();
		linkForm.classList.add('was-validated');
		if (!linkNameField.value.trim()) {
			linkNameField.focus();
			return;
		}
		const draft = Object.assign(linkFromForm(), {
			id: `l-${Date.now().toString(36)}`,
			code: pendingCode,
			uses: 0,
			by: snapshot.me,
			on: true,
		});
		const saveButton = pick('[data-whs-link-save]');
		window.Basalt.buttonState(saveButton, 'loading');
		server
			.addLink(draft)
			.then(() => {
				window.Basalt.buttonState(saveButton, 'success');
				snapshot.links.unshift(draft);
				drawLinks();
				const url = snapshot.workspace.joinUrl + draft.code;
				setTimeout(() => bootstrap.Modal.getOrCreateInstance(linkDialog).hide(), calm ? 0 : 450);
				const sayReady = (copied) =>
					notify({
						tone: 'success',
						icon: 'bi-link-45deg',
						title: `${draft.name} is ready`,
						text: copied ? 'The link is copied, ready to paste.' : url,
					});
				(window.Basalt.copyText ? window.Basalt.copyText(url) : Promise.reject())
					.then(() => sayReady(true))
					.catch(() => sayReady(false));
			})
			.catch(() => {
				window.Basalt.buttonState(saveButton, 'error');
				notify({
					tone: 'danger',
					title: "Couldn't create the link",
					text: 'Nothing was saved. Try again in a moment.',
				});
			});
	}

	/* The invite drawer: typed addresses or a CSV file, the seat check and sending. */

	function bindPanel() {
		for (const radio of pickAll('input[name="whs-mode"]', inviteDrawer)) {
			radio.addEventListener('change', () => {
				if (radio.checked) useEntryMode(radio.value);
			});
		}
		inviteDrawer.addEventListener('shown.bs.offcanvas', () => {
			if (entryMode === 'email') addressInput.focus();
		});

		/* A pasted list turns into one tag per address. */
		addressInput.addEventListener('paste', (event) => {
			const pasted = (event.clipboardData || window.clipboardData).getData('text');
			const pastedAddresses = pasted
				.split(/[\s,;]+/)
				.map((piece) => piece.replace(/^<|>$/g, '').trim())
				.filter(Boolean);
			if (pastedAddresses.length < 2 || !addressBox.basaltTags) return;
			event.preventDefault();
			addressBox.basaltTags.set(addressBox.basaltTags.get().concat(pastedAddresses));
		});
		/* Space ends an address the same way a comma does. */
		addressInput.addEventListener('keydown', (event) => {
			if (event.key !== ' ' || !addressInput.value.trim() || !addressBox.basaltTags) return;
			event.preventDefault();
			addressBox.basaltTags.set(addressBox.basaltTags.get().concat(addressInput.value.trim()));
			addressInput.value = '';
		});
		addressBox.addEventListener('basalt:tags-duplicate', (event) =>
			say(`${event.detail.value} is already in the list`),
		);

		inviteForm.addEventListener('change', syncPanel);
		inviteForm.addEventListener('input', (event) => {
			if (event.target === seatConsent) syncPanel();
		});
		inviteForm.addEventListener('submit', sendInvitations);
	}

	function openPanel() {
		if (!snapshot) return;
		const emailOption = pick('#whs-mode-email');
		window.Basalt.buttonState(sendButton, 'idle');
		if (addressBox.basaltTags) addressBox.basaltTags.set([]);
		addressInput.value = '';
		pick('[data-whs-note]', inviteDrawer).value = '';
		pickOption(rolePick, 'support');
		pickOption(teamPick, 'Support');
		seatConsent.checked = false;
		resetCsv();
		emailOption.checked = true;
		emailOption.dispatchEvent(new Event('change', { bubbles: true }));
		bootstrap.Offcanvas.getOrCreateInstance(inviteDrawer).show();
	}

	function useEntryMode(nextMode) {
		const fromFile = nextMode === 'csv';
		entryMode = nextMode;
		for (const pane of pickAll('[data-whs-pane]', inviteDrawer))
			pane.hidden = pane.getAttribute('data-whs-pane') !== nextMode;
		pick('[data-whs-role-label]', inviteDrawer).textContent = fromFile ? 'Default role' : 'Role';
		pick('[data-whs-team-label]', inviteDrawer).textContent = fromFile ? 'Default team' : 'Team';
		syncPanel();
	}

	/**
	 * Judges one address. Returns { bad } when it cannot be sent, { warn }
	 * when it is outside the workspace domain, or {} when it is fine.
	 * `seen` collects the addresses earlier in a file, to catch repeats.
	 */
	function vetAddress(address, seen) {
		const lower = address.toLowerCase();
		const inWorkspace = new Set((snapshot.memberEmails || []).map((known) => known.toLowerCase()));
		const awaiting = new Set(waitingInvites().map((entry) => entry.email.toLowerCase()));
		if (!ADDRESS_SHAPE.test(address)) return { bad: 'Not an email address' };
		if (inWorkspace.has(lower)) return { bad: 'Already in the workspace' };
		if (awaiting.has(lower)) return { bad: 'Already invited. Resend it from the list instead' };
		if (seen?.has(lower)) return { bad: 'Listed twice in the file' };
		if (domainPart(lower) !== snapshot.workspace.domain) return { warn: `Outside ${snapshot.workspace.domain}` };
		return {};
	}

	/** The invitations that would go out from whichever tab is open, problems left out. */
	function toSend() {
		if (entryMode !== 'email') {
			return fileRows
				.filter((row) => !row.bad)
				.map((row) => ({
					email: row.email.toLowerCase(),
					role: row.role || rolePick.value,
					team: row.team || teamPick.value,
				}));
		}
		const typed = addressBox.basaltTags ? addressBox.basaltTags.get() : [];
		return typed
			.filter((address) => !vetAddress(address).bad)
			.map((address) => ({ email: address.toLowerCase(), role: rolePick.value, team: teamPick.value }));
	}

	/* Marks each typed address, explains the problems, and keeps the seat
     warning and the send button in step with what would be sent. */
	function syncPanel() {
		if (!snapshot) return;
		if (entryMode === 'email') markTypedAddresses();
		const chosenRole = roleById(rolePick.value);
		pick('[data-whs-role-help]', inviteDrawer).textContent =
			`${entryMode === 'csv' ? 'Used for rows with no role or team. ' : ''}${chosenRole.name}: ${chosenRole.can}`;

		const batch = toSend();
		const free = seatCount().free;
		const shortBy = Math.max(0, batch.length - free);
		seatWarning.hidden = !shortBy;
		if (shortBy) {
			const room = free ? `Only ${howMany(free, 'seat is', 'seats are')} free` : 'Every seat is taken';
			pick('[data-whs-over-title]', inviteDrawer).textContent = `This needs ${howMany(shortBy, 'more seat')}`;
			pick('[data-whs-over-text]', inviteDrawer).textContent =
				`${room} on the ${snapshot.workspace.plan} plan, and ${howMany(batch.length, 'invitation')} would need ${batch.length}. Added seats show on the next invoice.`;
			pick('[data-whs-over-label]', inviteDrawer).textContent =
				`Add ${howMany(shortBy, 'seat')} to the plan (${snapshot.workspace.seats + shortBy} in all)`;
		} else {
			seatConsent.checked = false;
		}
		sendButton.disabled = !batch.length || (shortBy > 0 && !seatConsent.checked);
		pick('[data-whs-send-label]', inviteDrawer).textContent = batch.length
			? `Send ${howMany(batch.length, 'invitation')}`
			: 'Email invitations';
	}

	function markTypedAddresses() {
		const problemLines = [];
		for (const tag of pickAll('.basalt-tags-tag', addressBox)) {
			const address = tag.getAttribute('data-value');
			const verdict = vetAddress(address);
			tag.classList.toggle('whs-tag-bad', !!verdict.bad);
			tag.classList.toggle('whs-tag-warn', !!verdict.warn);
			if (verdict.bad) {
				problemLines.push(
					`<li class="whs-check whs-check-bad"><i class="bi bi-x-circle" aria-hidden="true"></i><span><strong>${htmlSafe(address)}</strong>: ${htmlSafe(verdict.bad)}. It won't be sent.</span></li>`,
				);
			} else if (verdict.warn) {
				problemLines.push(
					`<li class="whs-check"><i class="bi bi-globe2" aria-hidden="true"></i><span><strong>${htmlSafe(address)}</strong> is outside ${htmlSafe(snapshot.workspace.domain)}. Check it is someone you mean to let in.</span></li>`,
				);
			}
		}
		pick('[data-whs-checks]', inviteDrawer).innerHTML = problemLines.join('');
	}

	function sendInvitations(event) {
		event.preventDefault();
		if (sendButton.disabled || sendButton.classList.contains('is-loading')) return;
		const batch = toSend();
		if (!batch.length) return;
		const addSeats = Math.max(0, batch.length - seatCount().free);
		const note = pick('[data-whs-note]', inviteDrawer).value.trim();
		window.Basalt.buttonState(sendButton, 'loading');
		server
			.invite(batch, note, addSeats)
			.then(() => {
				const stamp = Date.now().toString(36);
				const expires = shiftDate(SAMPLE_REPLY.today, snapshot.workspace.inviteDays);
				const newInvites = batch.map(({ email, role, team }, at) => ({
					id: `i-${stamp}${at}`,
					email,
					role,
					team,
					by: snapshot.me,
					sent: SAMPLE_REPLY.today,
					expires,
					status: 'pending',
					resent: 0,
				}));
				snapshot.invites = newInvites.concat(snapshot.invites);
				snapshot.workspace.seats += addSeats;
				window.Basalt.buttonState(sendButton, 'success');
				setTimeout(() => bootstrap.Offcanvas.getOrCreateInstance(inviteDrawer).hide(), calm ? 0 : 500);
				listQuery.text = '';
				ui.searchBox.value = '';
				listQuery.role = '';
				pickOption(ui.roleSelect, '');
				switchTab('pending');
				redraw();
				for (const entry of newInvites) pulseRow(entry.id);
				const [first] = newInvites;
				const recipients =
					newInvites.length === 1 ? first.email : `${first.email} and ${newInvites.length - 1} more`;
				notify({
					tone: 'success',
					icon: 'bi-send',
					title: `${howMany(newInvites.length, 'invitation')} sent`,
					text: `${recipients}. ${addSeats ? `${howMany(addSeats, 'seat')} added to the plan.` : `They work until ${shortDate(first.expires)}.`}`,
					actions: [{ label: 'Undo', onClick: () => takeBack(newInvites, addSeats) }],
				});
			})
			.catch(() => {
				window.Basalt.buttonState(sendButton, 'error');
				notify({
					tone: 'danger',
					title: 'Invitations not sent',
					text: 'Nobody was emailed. Your list is still here, so you can try again.',
				});
				setTimeout(() => window.Basalt.buttonState(sendButton, 'idle'), 2000);
			});
	}

	/** Undo for a send: drops the new invitations and any seats bought for them. */
	function takeBack(newInvites, addSeats) {
		const ids = new Set(newInvites.map((entry) => entry.id));
		snapshot.invites = snapshot.invites.filter((entry) => !ids.has(entry.id));
		snapshot.workspace.seats -= addSeats;
		redraw(true);
		say('Invitations taken back');
		Promise.all(newInvites.map((entry) => server.withdraw(entry.id))).catch(
			rollbackWith('take every invitation back', () => {
				snapshot.invites = newInvites.concat(snapshot.invites);
				snapshot.workspace.seats += addSeats;
			}),
		);
	}

	/* CSV import: reading the file, checking each row, and the template. */

	function bindFileImport() {
		dropArea.addEventListener('basalt:files', (event) => {
			const chosen = event.detail.files && event.detail.files[0];
			if (!chosen) return;
			if (!/\.csv$/i.test(chosen.name) && chosen.type !== 'text/csv') {
				notify({
					tone: 'warning',
					title: "That isn't a CSV file",
					text: 'Save the sheet as CSV (comma separated) and add it again.',
				});
				return;
			}
			const loader = new FileReader();
			loader.onload = () => loadCsv(chosen.name, String(loader.result));
			loader.onerror = () =>
				notify({ tone: 'danger', title: `Couldn't read ${chosen.name}`, text: 'Try saving it again as CSV.' });
			loader.readAsText(chosen);
		});
		pick('[data-whs-sample]', inviteDrawer).addEventListener('click', () =>
			loadCsv('fieldline-new-starters.csv', SAMPLE_REPLY.sampleCsv),
		);
		pick('[data-whs-csv-clear]', inviteDrawer).addEventListener('click', () => {
			resetCsv();
			syncPanel();
			pick('[data-basalt-drop-browse]', dropArea)?.focus();
		});
		pick('[data-whs-template]', inviteDrawer).addEventListener('click', downloadTemplate);
	}

	function downloadTemplate() {
		const sheet = new Blob([`email,role,team\nname@${SAMPLE_REPLY.workspace.domain},Support agent,Support\n`], {
			type: 'text/csv',
		});
		const fileUrl = URL.createObjectURL(sheet);
		const anchor = Object.assign(document.createElement('a'), {
			href: fileUrl,
			download: 'fieldline-invitations-template.csv',
		});
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
	}

	/** Splits CSV text into trimmed fields per non-blank line; quotes may hold commas, and "" is a literal quote. */
	function splitCsv(text) {
		const table = [];
		for (const line of text.replace(/\r/g, '').split('\n')) {
			if (!line.trim()) continue;
			const fields = [''];
			let quoted = false;
			for (let at = 0; at < line.length; at += 1) {
				const char = line[at];
				if (char === '"' && quoted && line[at + 1] === '"') {
					fields[fields.length - 1] += '"';
					at += 1;
				} else if (char === '"') {
					quoted = !quoted;
				} else if (char === ',' && !quoted) {
					fields.push('');
				} else {
					fields[fields.length - 1] += char;
				}
			}
			table.push(fields.map((cell) => cell.trim()));
		}
		return table;
	}

	/* Reads a file into rows, checks each one, and swaps the drop zone for the review table. */
	function loadCsv(fileName, text) {
		const table = splitCsv(text);
		if (!table.length) {
			notify({ tone: 'warning', title: 'That file is empty', text: 'Add one person a row, then try again.' });
			return;
		}
		const titles = table[0].map((cell) => cell.toLowerCase());
		const headed = titles.includes('email');
		const columnFor = (heading, spot) => (headed ? titles.indexOf(heading) : spot);
		const columns = { email: columnFor('email', 0), role: columnFor('role', 1), team: columnFor('team', 2) };
		const seen = new Set();
		fileRows = table.slice(headed ? 1 : 0).map((fields, at) => {
			const cellAt = (column) => (column >= 0 ? (fields[column] || '').trim() : '');
			const address = (fields[columns.email] || '').trim();
			const roleText = cellAt(columns.role);
			const teamText = cellAt(columns.team);
			const knownRole = roleText
				? SAMPLE_REPLY.roles.find((entry) => entry.name.toLowerCase() === roleText.toLowerCase())
				: null;
			const knownTeam = teamText
				? SAMPLE_REPLY.teams.find((team) => team.toLowerCase() === teamText.toLowerCase())
				: null;
			const verdict = vetAddress(address, seen);
			let bad = verdict.bad;
			if (!bad && roleText && !knownRole) bad = `No role called "${roleText}"`;
			if (!bad && teamText && !knownTeam) bad = `No team called "${teamText}"`;
			if (ADDRESS_SHAPE.test(address)) seen.add(address.toLowerCase());
			return {
				line: at + (headed ? 2 : 1),
				email: address,
				roleText,
				role: knownRole ? knownRole.id : '',
				team: knownTeam || '',
				bad,
				warn: verdict.warn,
			};
		});

		const usable = fileRows.filter((row) => !row.bad).length;
		const skipped = fileRows.length - usable;
		const summary = pick('[data-whs-csv-sum]', inviteDrawer);
		pick('[data-whs-csv-name]', inviteDrawer).textContent = fileName;
		pick('[data-whs-csv-rows]', inviteDrawer).innerHTML = fileRows.map(fileRowMarkup).join('');
		summary.innerHTML = `<strong>${howMany(usable, 'person', 'people')}</strong> ready to invite.${skipped ? ` ${howMany(skipped, 'row has', 'rows have')} a problem and will be skipped; fix the file and add it again to include them.` : ' Every row checks out.'}`;
		const focusWasInside = dropArea.contains(document.activeElement);
		dropArea.hidden = true;
		fileReview.hidden = false;
		syncPanel();
		/* The button that was pressed has just been hidden, so focus goes to the summary. */
		if (focusWasInside || document.activeElement === document.body) summary.focus();
		say(`${usable} ready, ${skipped} with problems`);
	}

	function fileRowMarkup(row) {
		const roleShown = row.role ? roleById(row.role).name : row.roleText || 'From the picker';
		let verdictCell =
			'<span class="basalt-status basalt-status-success"><i class="bi bi-check2" aria-hidden="true"></i>Ready</span>';
		if (row.bad)
			verdictCell = `<span class="basalt-status basalt-status-danger"><i class="bi bi-x-circle" aria-hidden="true"></i>${htmlSafe(row.bad)}</span>`;
		else if (row.warn)
			verdictCell = `<span class="basalt-status basalt-status-warning"><i class="bi bi-globe2" aria-hidden="true"></i>Ready, ${htmlSafe(row.warn.toLowerCase())}</span>`;
		return `<tr class="${row.bad ? 'is-bad' : ''}"><td class="basalt-num">${row.line}</td><td class="whs-csv-email">${htmlSafe(row.email || '(empty)')}</td><td>${htmlSafe(roleShown)}</td><td>${verdictCell}</td></tr>`;
	}

	function resetCsv() {
		fileRows = [];
		dropArea.hidden = false;
		fileReview.hidden = true;
		const browseInput = pick('[data-basalt-drop-input]', dropArea);
		if (browseInput) browseInput.value = '';
	}
})();
