/**
 * One person's profile in the Fieldline workspace (employee-user-details.html): who
 * they are and who they report to, their role and what it opens up, their
 * groups, how and where they sign in, the work they own, a feed of what they
 * did and a full history of changes to their access.
 *
 * The people are the directory's: employee-users.js loads first and leaves the
 * workspace sample on window.Basalt.userBook. ?id= takes a roster id (pr) or
 * a staff number (#125); anything else opens Connie Reese, the support
 * lead, whose record fills every card.
 *
 * Plugging in a backend: make server.fetchPerson(id) resolve a record in the
 * same shape as the sample's people and send the other server methods to
 * your endpoints. Add ?state=fail to watch each change roll back.
 */
(() => {
	'use strict';

	const page = pick('[data-ud-root]', document);
	const shared = window.Basalt.userBook;
	if (!page || !shared) return;

	/* A private copy, so changes made here never leak into the shared sample. */
	const FALLBACK_ID = 'pr';
	const book = JSON.parse(JSON.stringify(shared.DEMO));
	const people = book.users;
	const peopleById = new Map(people.map((person) => [person.id, person]));

	const refuseWrites = new URLSearchParams(location.search).get('state') === 'fail';
	const openedAt = Date.now();
	const DAY_MS = 86400000;
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* The areas a role can reach and how far, from assets/basalt/js/data/multipurpose/access.js
     so this page agrees with Roles and Permissions. An area is one group
     of the menu, and its level is the most the role may do inside it.
     Each row of ROLE_ACCESS lists one level per area, in ACCESS_AREAS order. */
	const ACCESS = window.Basalt.data.access;
	const WORKSPACE = ACCESS.set('general');
	const ACCESS_AREAS = WORKSPACE.groups.map((group) => ({ id: group.id, name: group.name }));
	const LEVEL_NAMES = ACCESS.levels.map((level) => level.long);
	const LEVEL_HUES = ['', 'info', 'success', 'primary'];
	const ROLE_ACCESS = Object.fromEntries(
		WORKSPACE.roles.map((role) => [
			role.id,
			ACCESS_AREAS.map((area) => ACCESS.areaLevel(WORKSPACE, WORKSPACE.access, role.id, area.id)),
		]),
	);
	const ROLE_GLYPHS = Object.fromEntries(WORKSPACE.roles.map((role) => [role.id, role.icon]));
	const STATUS_LABEL = { active: 'Active', invited: 'Invited', suspended: 'Suspended', deactivated: 'Deactivated' };
	const DEVICE_INFO = {
		mac: { label: 'Chrome on macOS', icon: 'bi-laptop' },
		win: { label: 'Edge on Windows', icon: 'bi-laptop' },
		linux: { label: 'Firefox on Ubuntu', icon: 'bi-laptop' },
		iphone: { label: 'Fieldline app on iPhone', icon: 'bi-phone' },
		android: { label: 'Fieldline app on Android', icon: 'bi-phone' },
		ipad: { label: 'Safari on iPad', icon: 'bi-tablet' },
		unknown: { label: 'Chrome on Windows', icon: 'bi-laptop' },
	};
	const SIGNIN_RESULTS = {
		ok: { hue: 'success', label: 'Signed in' },
		wrong: { hue: 'warning', label: 'Wrong password' },
		blocked: { hue: 'danger', label: 'Blocked' },
	};

	/* Owned work comes as counts; these lists give it names. A team's people
     take names from its list one after another, so nothing is shared; the
     _ list serves teams without one of their own. */
	const WORK_KINDS = {
		boards: { one: 'schedule board', many: 'schedule boards', icon: 'bi-kanban', tone: 3 },
		reports: { one: 'saved report', many: 'saved reports', icon: 'bi-graph-up', tone: 1 },
		automations: { one: 'automation', many: 'automations', icon: 'bi-lightning', tone: 5 },
		keys: { one: 'API key', many: 'API keys', icon: 'bi-key', tone: 8 },
	};
	const OWNED_NAMES = {
		boards: {
			Support: ['Escalations queue', 'Weekend on-call board', 'Boulder callbacks'],
			Success: [
				'Oakhaven Studio, Plattsburgh',
				'Coastline Surf Co. go-live',
				'Brightline Photography rollout',
				'Alder & Sons Tailors pilot',
				'Harborline AI setup',
				'Sunvale Studios go-live',
				'Brookside Books trial',
				'Larchwood Studios training',
				'Oakmont Gardens launch',
			],
			_: ['Atlanta branch schedule', 'Vacation cover board'],
		},
		reports: {
			Support: [
				'First reply time by week',
				'Late arrival complaints',
				'Escalations by customer',
				'Backlog by priority',
				'Repeat visits in 30 days',
				'Weekly on-call summary',
				'Callbacks by team member',
				'Tickets by product area',
				'Satisfaction after tickets',
				'Reopened tickets',
			],
			Success: ['Accounts still onboarding', 'Boards set up per account'],
			Sales: [
				'Pipeline by stage',
				'Trials ending this week',
				'Won deals by plan',
				'Demo to trial by rep',
				'Lost deals and why',
				'Quota by quarter',
				'Expansion by account',
			],
			Operations: [
				'Seats used by team',
				'Visits per person',
				'Weekly business review',
				'On-time arrival rate',
				'Branch hours and cover',
				'Access review, Q3',
				'License costs by team',
				'Open visits by branch',
				'Board of directors pack',
				'Hiring plan by quarter',
				'Office costs by city',
				'Contractor hours',
			],
			Finance: [
				'Overdue invoices by customer',
				'Card payments, last 30 days',
				'Refunds by month',
				'Revenue per visit',
				'Credits issued this quarter',
				'Monthly close checklist',
				'Failed card payments',
				'Tax collected by region',
				'Invoices sent in the West',
				'Payment terms by plan',
			],
			Product: [
				'Travel Planner beta use',
				'Feature requests by plan',
				'Portal bookings per week',
				'Mobile app adoption',
			],
			Engineering: [
				'API errors by endpoint',
				'Sync failures by integration',
				'Mobile app crash rate',
				'Visit import times',
				'Slow board loads',
			],
			Marketing: ['Sign-ups by channel', 'Webinar attendance', 'Trial sign-ups by region'],
		},
		automations: {
			Support: [
				'Escalate tickets idle 4 hours',
				'Tag tickets from key accounts',
				'Page on-call for urgent tickets',
			],
			Success: ['Welcome email for new accounts'],
			Operations: ['Assign new visits by service area', 'Weekly seat use email'],
			Engineering: [
				'Nightly export to the warehouse',
				'Retry failed QuickBooks syncs',
				'Alert on API error spikes',
				'Rotate expiring tokens',
				'Clean up test accounts',
				'Weekly backup check',
				'Restart stuck imports',
				'Flag slow board loads',
				'Archive old visit photos',
				'Post deploys to chat',
				'Check SSL renewals',
			],
			_: ['Monthly report email'],
		},
		keys: {
			_: [
				'Warehouse sync',
				'Status page webhook',
				'Data warehouse export',
				'Mobile build pipeline',
				'QuickBooks sync',
				'Error tracking',
				'Release bot',
				'Security checks',
				'Sales demo sandbox',
				'Load test runner',
				'Partner API sandbox',
			],
		},
	};
	const REPORT_SCHEDULES = [
		'Emailed on Mondays',
		'Emailed on Fridays',
		'Posted in the team channel',
		'Emailed each morning',
		'Kept for themselves',
	];

	/* Three ordinary tasks per team, sprinkled over the days before someone's last visit. */
	const TYPICAL_DAY = {
		Support: [
			{ icon: 'bi-chat-left-text', text: 'Answered 7 tickets in the shared inbox' },
			{ icon: 'bi-telephone', text: 'Logged a callback with Lakeside Apparel' },
			{ icon: 'bi-journal-text', text: 'Updated the help article on moving a visit' },
		],
		Success: [
			{ icon: 'bi-camera-video', text: 'Walked Cornerstone Logistics through the schedule board' },
			{ icon: 'bi-check2-square', text: 'Finished week one of the Alder & Sons Tailors trial' },
			{ icon: 'bi-envelope', text: 'Sent the onboarding survey to Brookside Books' },
		],
		Sales: [
			{ icon: 'bi-camera-video', text: 'Gave a demo to Cornerstone Logistics' },
			{ icon: 'bi-arrow-right-circle', text: 'Moved Larchwood Studios to Proposal sent' },
			{ icon: 'bi-file-earmark-text', text: 'Sent a quote for 25 staff seats' },
		],
		Product: [
			{ icon: 'bi-chat-square-text', text: 'Commented on the travel planner design review' },
			{ icon: 'bi-flag', text: 'Moved Portal payments to In progress' },
			{ icon: 'bi-megaphone', text: 'Published the October release notes' },
		],
		Engineering: [
			{ icon: 'bi-rocket-takeoff', text: 'Deployed 2.31.0 to production' },
			{ icon: 'bi-bug', text: 'Closed a bug: app logs out on Android' },
			{ icon: 'bi-git', text: 'Reviewed the QuickBooks retry change' },
		],
		Marketing: [
			{ icon: 'bi-envelope-paper', text: 'Scheduled the October newsletter' },
			{ icon: 'bi-calendar-event', text: 'Set up the Home Care Expo page' },
			{ icon: 'bi-graph-up', text: 'Shared the September sign-ups report' },
		],
		Finance: [
			{ icon: 'bi-receipt', text: 'Approved 12 refunds under $150' },
			{ icon: 'bi-bank', text: 'Matched September card payments' },
			{ icon: 'bi-download', text: 'Downloaded the September tax report' },
		],
		Operations: [
			{ icon: 'bi-calendar3', text: 'Updated the holiday hours for the Evanston branch' },
			{ icon: 'bi-people', text: 'Checked seat use by team' },
			{ icon: 'bi-clipboard-check', text: 'Signed off the Q3 access review' },
		],
	};
	/* Blocked sign-ins come from cities where nobody on the team lives. */
	const FAR_CITIES = ['Biloxi', 'Bucharest', 'Modesto', 'Minsk', 'Visalia', 'Orlando'];
	/* When the whole workspace switched to single sign-on. */
	const SSO_SWITCH = '2023-02-06T09:00';
	const ROLE_CHANGE_TEXT = /^Changed (.+)’s role from (.+) to (.+)$/;

	/* Each method stands for one request; the sample answers after a pause. */
	const server = {
		/* GET /api/users/:id, where id is a roster id (ja) or a staff number (#125). */
		fetchPerson(id) {
			const member = id ? window.Basalt.data.people.find(id) : null;
			return Promise.resolve(
				peopleById.get(id) || (member && peopleById.get(member.id)) || peopleById.get(FALLBACK_ID),
			);
		},
		/* PATCH /api/users/:id { role } */
		assignRole(userId, roleId) {
			return reply(300);
		},
		/* PUT /api/users/:id/groups { groups } */
		saveGroups(userId, groupIds) {
			return reply(250);
		},
		/* POST /api/users/:id/suspend { reason, note, signOut } */
		suspend(userId, reason, note, signOut) {
			return reply(350);
		},
		/* POST /api/users/:id/reactivate */
		reactivate(userId) {
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
		/* POST /api/invites/:userId/resend */
		resendInvite(userId) {
			return reply(500);
		},
		/* POST /api/users/:id/reset-2fa */
		resetTwoFactor(userId) {
			return reply(350);
		},
		/* POST /api/users/:id/2fa-reminder */
		nudgeTwoFactor(userId) {
			return reply(400);
		},
		/* POST /api/users/:id/password-reset */
		mailPasswordReset(userId) {
			return reply(700);
		},
		/* DELETE /api/users/:id/sessions/:sessionId */
		endSession(userId, sessionId) {
			return reply(250);
		},
		/* DELETE /api/users/:id/sessions */
		endAllSessions(userId) {
			return reply(300);
		},
		/* PUT /api/users: writes earlier copies of these records back (Undo). */
		restore(records) {
			return reply(300);
		},
	};

	/* The person on screen, and which long lists are opened past five rows. */
	const PREVIEW_COUNT = 5;
	const expanded = { activity: false, audit: false };
	let subject = null;

	/* Elements of the change-role dialog, the other dialogs' fields, and the pending confirm. */
	const roleDialog = {
		form: pick('[data-ud-role-form]'),
		choices: pick('[data-ud-role-choices]'),
		diff: pick('[data-ud-role-diff]'),
		save: pick('[data-ud-role-go]'),
	};
	const suspendForm = pick('[data-ud-suspend-form]');
	const transferDialog = {
		form: pick('[data-ud-transfer-form]'),
		heir: pick('[data-ud-transfer-to]'),
		error: pick('[data-ud-transfer-error]'),
	};
	const deactivateHeir = pick('[data-ud-deact-to]');
	const confirmDialog = { go: pick('[data-ud-confirm-go]'), run: null };

	/* Actions behind every [data-ud-act] button, keyed by its value. */
	const actions = {
		role: openRoleDialog,
		suspend: openSuspendDialog,
		deactivate: openDeactivateDialog,
		transfer: openTransferDialog,
		reset2fa: () => openConfirm('reset2fa'),
		signoutall: () => openConfirm('signoutall'),
		copy: copyEmail,
		reactivate,
		resend: resendInvite,
		password: (button) =>
			runWithButton(
				button,
				() => server.mailPasswordReset(subject.id),
				{
					icon: 'bi-key',
					title: 'Reset link sent',
					text: `It went to ${subject.email} and works for one hour.`,
				},
				'The link didn’t send',
			),
		remind2fa: (button) =>
			runWithButton(
				button,
				() => server.nudgeTwoFactor(subject.id),
				{
					icon: 'bi-bell',
					title: `Reminder sent to ${givenName(subject.name)}`,
					text: 'They get an email with the steps to add an authenticator app.',
				},
				'The reminder didn’t send',
			),
	};

	/** Wires the page, then fetches the person named in the address and paints them. */
	function start() {
		for (const toggle of pickAll('[data-ud-more]')) {
			toggle.addEventListener('click', () => {
				const list = toggle.getAttribute('data-ud-more');
				/* The audit list is table rows, which cannot clip, so its card slides. */
				const region = list === 'audit' ? slot('audit').closest('.card-body') : slot('activity');
				window.Basalt.slide(region, () => {
					expanded[list] = !expanded[list];
					if (list === 'audit') paintAudit();
					else paintActivity();
				});
			});
		}
		page.addEventListener('click', onPageClick);
		roleDialog.choices.addEventListener('change', paintRoleDiff);
		roleDialog.form.addEventListener('submit', onRoleSubmit);
		suspendForm.addEventListener('submit', onSuspendSubmit);
		transferDialog.form.addEventListener('submit', onTransferSubmit);
		pick('[data-ud-deact-go]').addEventListener('basalt:confirm', onDeactivateConfirmed);
		confirmDialog.go.addEventListener('click', () => {
			dialog('ud-confirm').hide();
			if (confirmDialog.run) confirmDialog.run();
			confirmDialog.run = null;
		});
		server.fetchPerson(new URLSearchParams(location.search).get('id')).then((person) => {
			subject = person;
			paintProfile();
		});
	}

	/* Painting the profile. */

	function paintProfile() {
		const manageable = canManage(subject);
		document.title = `${subject.name} · Basalt`;
		paintHeader(manageable);
		paintNotice();
		const sessions = openSessions(subject);
		paintGlance(sessions);
		paintAccess(manageable);
		paintSecurity(manageable, sessions);
		paintFacts();
		paintOwned(manageable);
		paintActivity();
		paintAudit();
		window.Basalt.tips?.(page);
	}

	function paintHeader(manageable) {
		const presence = presenceOf(subject);
		const dim = subject.status === 'deactivated' ? ' us-av-off' : '';
		const dot = presence
			? `<span class="basalt-avatar-status-dot${presence === 'offline' ? '' : ` basalt-avatar-status-dot-${presence}`}" aria-hidden="true"></span>`
			: '';
		slot('avatar').innerHTML =
			`<span class="basalt-avatar basalt-avatar-xl us-av basalt-avatar-tone-${hueFor(subject.id)}${dim}" aria-hidden="true">${htmlSafe(monogram(subject.name))}</span>${dot}`;
		slot('name').textContent = subject.name;
		slot('sub').textContent = [subject.title, subject.team, subject.city].filter(Boolean).join(' · ');

		const badges = [
			rolePill(subject.role),
			`<span class="us-state us-state-${subject.status}">${STATUS_LABEL[subject.status]}</span>`,
		];
		if (presence === 'online') badges.push('<span class="us-online">Online now</span>');
		if (subject.id === book.me) badges.push('<span class="us-tag">You</span>');
		if (lacksTwoFactor(subject))
			badges.push(
				'<span class="us-signin-mfa us-signin-mfa-off"><i class="bi bi-shield-exclamation" aria-hidden="true"></i>2FA off</span>',
			);
		slot('tags').innerHTML = badges.join('');

		/* The main button follows the status: role for active people, the invite
       for invited ones, and reactivation for everyone else. */
		const primary = pick('[data-ud-primary]');
		const mainAction =
			manageable &&
			({
				active: { act: 'role', icon: 'bi-person-badge', label: 'Change role' },
				invited: { act: 'resend', icon: 'bi-send', label: 'Send the invite again' },
			}[subject.status] || { act: 'reactivate', icon: 'bi-play-circle', label: 'Reactivate' });
		primary.hidden = !mainAction;
		if (mainAction) {
			primary.setAttribute('data-ud-act', mainAction.act);
			primary.innerHTML = `<i class="bi ${mainAction.icon} me-1" aria-hidden="true"></i>${mainAction.label}`;
		}

		const menuItem = (act, icon, label, extra = '') =>
			`<li><button type="button" class="dropdown-item${extra ? ` ${extra}` : ''}" data-ud-act="${act}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</button></li>`;
		const risky = [];
		if (manageable && subject.status === 'active') risky.push(menuItem('suspend', 'bi-pause-circle', 'Suspend'));
		if (manageable && (subject.status === 'active' || subject.status === 'suspended'))
			risky.push(menuItem('deactivate', 'bi-person-slash', 'Deactivate', 'us-danger-item'));
		const menu = [menuItem('copy', 'bi-copy', 'Copy email address')];
		if (risky.length) menu.push('<li><hr class="dropdown-divider"></li>', ...risky);
		slot('menu').innerHTML = menu.join('');
	}

	/* A line under the header that explains an unusual status. */
	function paintNotice() {
		const { icon, text } = noticeFor(subject);
		const notice = slot('notice');
		notice.hidden = !text;
		notice.className = `ud-notice${subject.suspended ? ' ud-notice-warning' : ''}`;
		notice.innerHTML = text ? `<i class="bi ${icon}" aria-hidden="true"></i><span>${htmlSafe(text)}</span>` : '';
	}

	function noticeFor(person) {
		if (person.suspended) {
			const { at, by, reason, note } = person.suspended;
			return {
				icon: 'bi-pause-circle',
				text: `Suspended ${monthDay(fromStamp(at))} by ${nameFor(by)}: ${reason.toLowerCase()}.${note ? ` “${note}”` : ''}`,
			};
		}
		if (person.deactivated) {
			return {
				icon: 'bi-person-slash',
				text: `Deactivated ${monthDay(fromStamp(person.deactivated.at))} by ${nameFor(person.deactivated.by)}. They can’t sign in, and their history stays in the audit trail.`,
			};
		}
		if (person.status === 'invited') {
			const sent = fromStamp(person.invited.at);
			const expires = new Date(sent.getTime() + 7 * DAY_MS);
			const link =
				expires > clockNow()
					? `The link works until ${monthDay(expires)}.`
					: `The link ran out on ${monthDay(expires)}.`;
			return { icon: 'bi-envelope', text: `Invited ${monthDay(sent)} by ${nameFor(person.invited.by)}. ${link}` };
		}
		if (person.id === book.me)
			return { icon: 'bi-person', text: 'This is you. Another administrator can change your access.' };
		if (person.role === 'owner')
			return {
				icon: 'bi-star',
				text: `${givenName(person.name)} owns the workspace. Only the owner can hand it to someone else, from Settings.`,
			};
		return { icon: 'bi-info-circle', text: '' };
	}

	/* Four figures: last active, 2FA, devices and time with the company. */
	function paintGlance(sessions) {
		const presence = presenceOf(subject);
		const twoFactor = twoFactorState(subject);
		const neverIn = subject.status === 'invited' || !subject.last;
		const joined = subject.joined ? fromStamp(`${subject.joined}T09:00`) : null;
		let deviceNote = `${STATUS_LABEL[subject.status]}, so none`;
		if (sessions.length) deviceNote = `Latest ${sinceLabel(sessions[0].at).toLowerCase()}`;
		else if (subject.status === 'active') deviceNote = 'Signed out everywhere';
		const figures = [
			{
				icon: 'bi-clock-history',
				label: 'Last active',
				value: neverIn ? 'Not yet' : presence === 'online' ? 'Online now' : sinceLabel(subject.last),
				note: neverIn ? 'Hasn’t signed in' : DEVICE_INFO[subject.device].label,
				mood: presence === 'online' ? 'ok' : '',
			},
			{
				icon: 'bi-shield-lock',
				label: '2FA',
				value: twoFactor.value,
				note: twoFactor.note,
				mood: { off: 'warn', on: 'ok' }[twoFactor.tone] || '',
			},
			{
				icon: 'bi-laptop',
				label: 'Signed in on',
				value: amount(sessions.length, 'device'),
				note: deviceNote,
				mood: '',
			},
			{
				icon: 'bi-calendar-check',
				label: 'With Fieldline',
				value: joined ? tenure(joined) : 'Invited',
				note: joined
					? `Since ${MONTH_ABBR[joined.getMonth()]} ${joined.getFullYear()}`
					: `${monthDay(fromStamp(subject.invited.at))} by ${nameFor(subject.invited.by)}`,
				mood: '',
			},
		];
		slot('figs').innerHTML = figures
			.map(
				(figure, index) =>
					`<div class="ud-fig ud-fig-${index + 1}"><dt class="ud-fig-label"><i class="bi ${figure.icon}" aria-hidden="true"></i>${htmlSafe(figure.label)}</dt><dd class="ud-fig-value${figure.mood ? ` ud-fig-value-${figure.mood}` : ''}">${htmlSafe(figure.value)}</dd><dd class="ud-fig-note">${htmlSafe(figure.note)}</dd></div>`,
			)
			.join('');
	}

	/* Role, the areas it reaches, and group membership. */
	function paintAccess(manageable) {
		const role = findRole(subject.role);
		slot('access-desc').textContent = `What ${givenName(subject.name)} can see and change in Fieldline.`;
		slot('role').innerHTML = `${rolePill(subject.role)}<p class="ud-role-about">${htmlSafe(role.about)}</p>`;
		const levels = ROLE_ACCESS[subject.role] || ROLE_ACCESS.readonly;
		const reached = [];
		const closed = [];
		for (const [index, area] of ACCESS_AREAS.entries()) {
			const level = levels[index];
			if (level > 0)
				reached.push(
					`<tr><td>${htmlSafe(area.name)}</td><td><span class="basalt-status basalt-status-${LEVEL_HUES[level]} basalt-status-dot">${LEVEL_NAMES[level]}</span></td></tr>`,
				);
			else closed.push(area.name);
		}
		if (closed.length)
			reached.push(
				`<tr class="ud-none-row"><td colspan="2">No access to ${htmlSafe(joinWords(closed))}.</td></tr>`,
			);
		slot('perms').innerHTML = reached.join('');

		const editable = manageable && subject.status !== 'deactivated';
		slot('groups').innerHTML = subject.groups.length
			? subject.groups
					.map((groupId) => {
						const label = findGroup(groupId).name;
						const remove = editable
							? `<button type="button" class="ud-group-x" data-ud-group-remove="${groupId}" aria-label="Take ${htmlSafe(givenName(subject.name))} out of ${htmlSafe(label)}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`
							: '';
						return `<li class="ud-group"><span>${htmlSafe(label)}</span>${remove}</li>`;
					})
					.join('')
			: '<li class="ud-empty">Not in any groups.</li>';
		const joinable = book.groups.filter((group) => !subject.groups.includes(group.id));
		pick('[data-ud-group-add-wrap]').hidden = !editable || !joinable.length;
		slot('groupmenu').innerHTML = joinable
			.map(
				(group) =>
					`<li><button type="button" class="dropdown-item" data-ud-group-add="${group.id}">${htmlSafe(group.name)}</button></li>`,
			)
			.join('');
	}

	/* Sign-in method, open sessions and the latest attempts. */
	function paintSecurity(manageable, sessions) {
		const method = findSignin(subject.signin);
		const usesPassword = subject.signin === 'password';
		const twoFactor = twoFactorState(subject);
		const firstName = givenName(subject.name);
		slot('scy-desc').textContent =
			subject.status === 'invited'
				? `Nothing yet. ${firstName} sets up a sign-in from the invite.`
				: `How ${firstName} signs in, where, and the last attempts.`;

		let summary = 'Email and password, with an authenticator app for 2FA.';
		if (subject.status === 'invited') summary = `Will sign in with ${method.name}.`;
		else if (!usesPassword)
			summary = `2FA and password rules come from ${subject.signin === 'okta' ? 'Fieldline’s Okta' : 'Google Workspace'}. Reset them there.`;
		else if (twoFactor.tone === 'off') summary = '2FA is off, so a password alone gets in.';
		else if (subject.mfaReset) summary = '2FA was reset. They set it up again at their next sign-in.';

		/* Resets and reminders only make sense for password sign-ins. */
		const buttons = [];
		if (manageable && usesPassword && subject.status === 'active') {
			if (subject.mfa)
				buttons.push(
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-ud-act="reset2fa"><i class="bi bi-shield-x me-1" aria-hidden="true"></i>Reset 2FA</button>',
				);
			else if (!subject.mfaReset)
				buttons.push(loadingButton('remind2fa', 'bi-bell', 'Ask them to turn on 2FA', 'Reminder sent'));
			buttons.push(loadingButton('password', 'bi-key', 'Send a password reset link', 'Link sent'));
		}
		const shield =
			{
				off: '<i class="bi bi-shield-exclamation" aria-hidden="true"></i>',
				on: '<i class="bi bi-shield-fill-check" aria-hidden="true"></i>',
			}[twoFactor.tone] || '';
		const text = `<div class="ud-method-text"><span class="ud-method-name">${htmlSafe(method.name)}<span class="us-signin-mfa us-signin-mfa-${twoFactor.tone}">${shield}2FA ${twoFactor.value.toLowerCase()}</span></span><span class="ud-method-line${twoFactor.tone === 'off' ? ' is-warn' : ''}">${htmlSafe(summary)}</span></div>`;
		slot('method').innerHTML =
			`<span class="us-signin-method us-signin-method-${htmlSafe(subject.signin)} ud-method-icon"><i class="bi ${method.icon}" aria-hidden="true"></i></span>${text}${buttons.length ? `<div class="ud-method-actions">${buttons.join('')}</div>` : ''}`;

		pick('[data-ud-act="signoutall"]').hidden = !manageable || sessions.length < 2;
		slot('sessions').innerHTML = sessions.length
			? sessions.map((session) => sessionMarkup(session, manageable)).join('')
			: `<li class="ud-empty">${noSessionsText(subject.status)}</li>`;

		const attempts = recentSignins(subject);
		slot('signins').innerHTML = attempts
			.map((attempt) => {
				const device = DEVICE_INFO[attempt.device].label;
				const result = SIGNIN_RESULTS[attempt.result];
				const flag = attempt.result === 'blocked' ? '<span class="ud-cell-note">New country</span>' : '';
				return `<tr><td><time datetime="${htmlSafe(attempt.at)}">${htmlSafe(stampLabel(attempt.at))}</time><span class="ud-fold">${htmlSafe(`${device} · ${attempt.city}`)}</span></td><td class="ud-col-device">${htmlSafe(device)}</td><td class="ud-col-place">${htmlSafe(attempt.city)}${flag}</td><td><span class="basalt-status basalt-status-${result.hue} basalt-status-dot">${result.label}</span></td></tr>`;
			})
			.join('');
		slot('signins-table').hidden = !attempts.length;
		const none = slot('signins-empty');
		none.hidden = attempts.length > 0;
		none.textContent = 'No sign-ins yet.';
	}

	function loadingButton(act, icon, idle, done) {
		return `<button type="button" class="btn btn-sm btn-outline-secondary btn-loading" data-ud-act="${act}"><span class="btn-loading-state btn-loading-idle"><i class="bi ${icon}" aria-hidden="true"></i>${idle}</span><span class="btn-loading-state btn-loading-busy"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Sending</span><span class="btn-loading-state btn-loading-done"><i class="bi bi-check2" aria-hidden="true"></i>${done}</span></button>`;
	}

	function sessionMarkup(session, manageable) {
		const device = DEVICE_INFO[session.device];
		const signOut = manageable
			? `<button type="button" class="btn btn-sm btn-outline-secondary" data-ud-signout="${session.id}" aria-label="Sign out of ${htmlSafe(device.label)}">Sign out</button>`
			: '';
		return `<li class="ud-session"><span class="ud-session-icon" aria-hidden="true"><i class="bi ${device.icon}"></i></span><div class="ud-session-text"><span class="ud-session-device">${htmlSafe(device.label)}${session.current ? ' <span class="us-tag">This device</span>' : ''}</span><span class="ud-session-meta">${htmlSafe(session.city)} · active ${htmlSafe(sinceLabel(session.at).toLowerCase())}</span></div>${signOut}</li>`;
	}

	function noSessionsText(status) {
		if (status === 'active') return 'Not signed in anywhere right now.';
		if (status === 'invited') return 'No devices until they accept the invite.';
		return `None. ${STATUS_LABEL[status]} people can’t sign in.`;
	}

	/* Contact details, team, place and manager. */
	function paintFacts() {
		const lead = leadFor(subject);
		const team = findTeam(subject.team);
		const reports =
			team && team.lead === subject.id
				? people.filter(
						(other) =>
							other.team === subject.team && other.id !== subject.id && other.status !== 'deactivated',
					).length
				: 0;
		const facts = [
			[
				'Email',
				`<span class="ud-facts-email">${htmlSafe(subject.email)}</span><button type="button" class="btn btn-icon ud-copy" data-basalt-copy="${htmlSafe(subject.email)}" data-bs-toggle="tooltip" data-bs-title="Copy the email address" aria-label="Copy the email address"><i class="bi bi-copy" aria-hidden="true"></i></button>`,
			],
			['Job title', htmlSafe(subject.title)],
			[
				'Team',
				teamChip(subject.team) +
					(reports ? `<span class="ud-facts-aside">Leads ${amount(reports, 'person', 'people')}</span>` : ''),
			],
			['Location', htmlSafe(`${subject.city}, ${subject.region}`)],
			[
				'Reports to',
				lead ? personLink(lead.id) : '<span class="ud-empty">Nobody. They own the workspace.</span>',
			],
		];
		if (subject.joined) facts.push(['Joined', htmlSafe(dayName(fromStamp(`${subject.joined}T09:00`)))]);
		const list = slot('facts');
		list.innerHTML = facts.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`).join('');
		window.Basalt.buttons?.(list);
	}

	/* The first four things they own, then a sentence for the rest. */
	function paintOwned(manageable) {
		const items = ownedItems(subject);
		pick('[data-ud-act="transfer"]', pick('.ud-card-owns')).hidden =
			!manageable || !items.length || subject.status === 'invited';
		slot('owns').innerHTML = items.length
			? items
					.slice(0, 4)
					.map((item) => {
						const kind = WORK_KINDS[item.kind];
						return `<li class="ud-own"><span class="ud-own-icon us-tone-${kind.tone}" aria-hidden="true"><i class="bi ${kind.icon}"></i></span><span class="ud-own-text"><span class="ud-own-name">${htmlSafe(item.name)}</span><span class="ud-own-meta">${htmlSafe(kind.one.charAt(0).toUpperCase() + kind.one.slice(1))} · ${htmlSafe(item.meta)}</span></span></li>`;
					})
					.join('')
			: '<li class="ud-empty">Nothing yet. Boards, reports, automations and API keys they make show up here.</li>';
		const overflow = items.slice(4);
		const more = slot('owns-more');
		more.hidden = !overflow.length;
		if (!overflow.length) return;
		const phrases = [];
		for (const [key, kind] of Object.entries(WORK_KINDS)) {
			const count = overflow.filter((item) => item.kind === key).length;
			if (count) phrases.push(amount(count, kind.one, kind.many));
		}
		more.textContent = `And ${joinWords(phrases)}.`;
	}

	function paintActivity() {
		const feed = activityFeed(subject);
		const shown = expanded.activity ? feed : feed.slice(0, PREVIEW_COUNT);
		slot('activity').innerHTML = shown.length
			? shown
					.map(
						(entry) =>
							`<li class="ud-feed-item"><span class="ud-feed-icon" aria-hidden="true"><i class="bi ${entry.icon}"></i></span><span class="ud-feed-text">${htmlSafe(entry.text)}<time class="ud-feed-time" datetime="${htmlSafe(entry.at)}">${htmlSafe(stampLabel(entry.at))}</time></span></li>`,
					)
					.join('')
			: '<li class="ud-empty">Nothing yet.</li>';
		paintMoreToggle('activity', feed.length, 'See all ', 'Show fewer');
	}

	/* Entries made on this page carry fresh for one paint, so they flash once. */
	function paintAudit() {
		const history = accessHistory(subject);
		const shown = expanded.audit ? history : history.slice(0, PREVIEW_COUNT);
		slot('audit-desc').textContent = history.length
			? 'Role, group, sign-in and status changes, newest first.'
			: 'No changes yet.';
		slot('audit').innerHTML = shown
			.map(
				(entry) =>
					`<tr${entry.fresh ? ' class="is-fresh"' : ''}><td><time datetime="${htmlSafe(entry.at)}">${htmlSafe(dayName(fromStamp(entry.at)))}</time></td><td><span class="ud-change"><i class="bi ${entry.icon}" aria-hidden="true"></i><span>${htmlSafe(entry.text)}<span class="ud-fold">By ${htmlSafe(nameFor(entry.by))}</span></span></span></td><td class="ud-col-by">${personLink(entry.by)}</td></tr>`,
			)
			.join('');
		for (const entry of history) delete entry.fresh;
		paintMoreToggle('audit', history.length, 'Show all ', 'Show fewer');
	}

	function paintMoreToggle(list, total, moreLabel, fewerLabel) {
		const toggle = pick(`[data-ud-more="${list}"]`);
		toggle.hidden = total <= PREVIEW_COUNT;
		toggle.textContent = expanded[list] ? fewerLabel : moreLabel + total;
		toggle.setAttribute('aria-expanded', String(expanded[list]));
	}

	function rolePill(roleId) {
		const role = findRole(roleId);
		const icon = { 1: 'bi-star-fill', 2: 'bi-shield-fill-check' }[role.rank];
		return `<span class="us-role us-role-${Math.min(role.rank, 9)}">${icon ? `<i class="bi ${icon}" aria-hidden="true"></i>` : ''}${htmlSafe(role.name)}</span>`;
	}

	function teamChip(teamName) {
		const position = Math.max(
			0,
			book.teams.findIndex((team) => team.id === teamName),
		);
		return `<span class="us-team us-tone-${(position % 8) + 1}">${htmlSafe(teamName)}</span>`;
	}

	function personLink(id) {
		const person = peopleById.get(id);
		if (!person) return 'An administrator';
		const you = person.id === book.me ? ' <span class="us-tag">You</span>' : '';
		return `<a class="ud-person" href="employee-user-details.html?id=${encodeURIComponent(person.id)}">${htmlSafe(person.name)}</a>${you}`;
	}

	/* What the profile works out from a record. */

	function findRole(id) {
		return book.roles.find((role) => role.id === id) || { id, name: id, rank: 99, about: '' };
	}

	function findSignin(id) {
		return book.signins.find((method) => method.id === id) || { name: id, icon: 'bi-key' };
	}

	function findGroup(id) {
		return book.groups.find((group) => group.id === id) || { name: id };
	}

	function findTeam(name) {
		return book.teams.find((team) => team.id === name);
	}

	function nameFor(id) {
		return peopleById.get(id)?.name || 'An administrator';
	}

	/* Nobody changes their own access here, and the owner is out of reach. */
	function canManage(person) {
		return person.id !== book.me && person.role !== 'owner';
	}

	function ownedTotal(person) {
		let total = 0;
		for (const count of Object.values(person.owns || {})) total += count;
		return total;
	}

	function lacksTwoFactor(person) {
		return person.status === 'active' && person.signin === 'password' && !person.mfa;
	}

	/* Members answer to their team lead, and leads to the owner. */
	function leadFor(person) {
		if (person.role === 'owner') return null;
		const lead = peopleById.get(findTeam(person.team)?.lead);
		if (lead && lead.id !== person.id) return lead;
		return people.find((other) => other.role === 'owner') || null;
	}

	/* Online means active in the last 15 minutes, away in the last two hours. */
	function presenceOf(person) {
		if (person.status !== 'active' || !person.last || person.signedOut) return '';
		const minutes = (clockNow() - fromStamp(person.last)) / 60000;
		if (minutes <= 15) return 'online';
		return minutes <= 120 ? 'away' : 'offline';
	}

	function freeSeatCount() {
		return book.workspace.seats - people.filter((person) => person.status !== 'deactivated').length;
	}

	/** The 2FA figure: value, a note under it, and a tone of on, off or wait. */
	function twoFactorState(person) {
		if (person.status === 'invited') return { value: 'Not set up', note: 'Set up at first sign-in', tone: 'wait' };
		if (person.signin !== 'password')
			return { value: 'On', note: `Through ${findSignin(person.signin).name}`, tone: 'on' };
		if (person.mfaReset) return { value: 'Reset', note: 'Sets up at next sign-in', tone: 'wait' };
		if (person.mfa) return { value: 'On', note: 'Authenticator app', tone: 'on' };
		return { value: 'Off', note: 'Password only', tone: 'off' };
	}

	/* The usual device plus any extra sessions, newest first, minus ones signed out here. */
	function openSessions(person) {
		if (person.status !== 'active' || person.signedOut) return [];
		const ended = person.closed || [];
		const sessions = [];
		if (person.device && person.last)
			sessions.push({
				id: `s-${person.id}-1`,
				device: person.device,
				city: person.city,
				at: person.last,
				current: person.id === book.me,
			});
		sessions.push(...(book.sessions[person.id] || []));
		return sessions
			.filter((session) => !ended.includes(session.id))
			.sort((a, b) => fromStamp(b.at) - fromStamp(a.at));
	}

	/**
	 * The six latest sign-in attempts: today's sessions, earlier weekday
	 * mornings on the usual device, and now and then one that failed.
	 * The same person always gets the same list.
	 */
	function recentSignins(person) {
		if (!person.last || person.status === 'invited') return [];
		const random = seededRandom(`${person.id}:signins`);
		const attempts = [{ at: person.last, device: person.device, city: person.city, result: 'ok' }];
		for (const session of book.sessions[person.id] || [])
			attempts.push({ at: session.at, device: session.device, city: session.city, result: 'ok' });
		let cursor = fromStamp(person.last);
		while (attempts.length < 8) {
			cursor = new Date(midnight(cursor) - DAY_MS);
			const weekday = cursor.getDay();
			if (weekday === 0 || weekday === 6) continue;
			cursor.setHours(7 + Math.floor(random() * 3), Math.floor(random() * 60));
			attempts.push({ at: toStamp(cursor), device: person.device, city: person.city, result: 'ok' });
		}
		const latest = fromStamp(person.last).getTime();
		const hoursBefore = (hours) => toStamp(new Date(latest - hours * 3600000));
		const farCity = () => FAR_CITIES[Math.floor(random() * FAR_CITIES.length)];
		if (person.signin === 'password' && !person.mfa) {
			const city = farCity();
			attempts.push({ at: hoursBefore(26), device: 'unknown', city, result: 'wrong' });
			attempts.push({ at: hoursBefore(26.1), device: 'unknown', city, result: 'wrong' });
		} else if (person.signin === 'password' && random() < 0.6) {
			attempts.push({ at: hoursBefore(0.05), device: person.device, city: person.city, result: 'wrong' });
		} else if (random() < 0.45) {
			attempts.push({
				at: hoursBefore(30 + Math.floor(random() * 70)),
				device: 'unknown',
				city: farCity(),
				result: 'blocked',
			});
		}
		return attempts.sort((a, b) => fromStamp(b.at) - fromStamp(a.at)).slice(0, 6);
	}

	/** Names and a detail line for every item counted in person.owns. */
	function ownedItems(person) {
		const items = [];
		for (const kind of Object.keys(WORK_KINDS)) {
			const count = person.owns?.[kind] || 0;
			if (!count) continue;
			const lists = OWNED_NAMES[kind];
			const listKey = (team) => (lists[team] ? team : '_');
			const pool = lists[listKey(person.team)];
			/* Skip the names already taken by people earlier in the same list. */
			let taken = 0;
			for (const other of shared.DEMO.users) {
				if (other.id === person.id) break;
				if (listKey(other.team) === listKey(person.team)) taken += other.owns?.[kind] || 0;
			}
			const random = seededRandom(`${person.id}:${kind}`);
			for (let n = 0; n < count; n += 1) {
				items.push({ kind, name: pool[(taken + n) % pool.length], meta: ownedDetail(kind, random) });
			}
		}
		return items;
	}

	function ownedDetail(kind, random) {
		if (kind === 'boards') return amount(6 + Math.floor(random() * 22), 'team member');
		if (kind === 'reports') return REPORT_SCHEDULES[Math.floor(random() * REPORT_SCHEDULES.length)];
		if (kind === 'automations') return `${amount(40 + Math.floor(random() * 400), 'run')} in September`;
		const daysBack = Math.floor(random() * 5) * DAY_MS;
		const used = new Date(clockNow().getTime() - daysBack - random() * 7200000);
		return `Last used ${sinceLabel(toStamp(used)).toLowerCase()}`;
	}

	/* The feed: their entries from the workspace activity, a few everyday
     tasks for their team, their latest sign-in, and when they joined. */
	function activityFeed(person) {
		const feed = book.activity
			.filter((entry) => entry.who === person.id)
			.map(({ at, icon, text }) => ({ at, icon, text }));
		if (person.last && person.status !== 'invited') {
			const method = findSignin(person.signin);
			feed.push({
				at: person.last,
				icon: method.icon,
				text: `Signed in with ${person.signin === 'password' ? 'a password' : method.name}`,
			});
			const random = seededRandom(`${person.id}:work`);
			const finalDay = midnight(fromStamp(person.last));
			const joined = person.joined ? fromStamp(`${person.joined}T09:00`) : null;
			for (const [index, task] of (TYPICAL_DAY[person.team] || []).entries()) {
				if (random() < 0.2) continue;
				const when = new Date(finalDay - (index * 2 + 1 + Math.floor(random() * 2)) * DAY_MS);
				when.setHours(9 + Math.floor(random() * 8), Math.floor(random() * 60));
				if (joined && when < joined) continue;
				feed.push({ at: toStamp(when), icon: task.icon, text: task.text });
			}
		}
		if (person.joined)
			feed.push({
				at: `${person.joined}T09:00`,
				icon: 'bi-door-open',
				text: person.role === 'owner' ? 'Set up the Fieldline workspace' : 'Joined Fieldline',
			});
		if (person.status === 'invited')
			feed.push({ at: person.invited.at, icon: 'bi-envelope', text: 'Was sent an invite to the workspace' });
		return feed.sort((a, b) => fromStamp(b.at) - fromStamp(a.at));
	}

	/* Workspace activity lines that mention someone and describe their access. */
	function mentionsOf(person) {
		return book.activity.filter((entry) => entry.who !== person.id && entry.text.includes(person.name));
	}

	/**
	 * Every change to their access, newest first: what the workspace activity
	 * says about them, what their record implies, and what was done on this
	 * page (person.changes). On the same minute, the later entry made here comes first.
	 */
	function accessHistory(person) {
		const history = [];
		let startingRole = findRole(person.role).name;
		for (const entry of mentionsOf(person)) {
			const roleChange = ROLE_CHANGE_TEXT.exec(entry.text);
			const base = { at: entry.at, by: entry.who };
			if (roleChange) {
				history.push({
					...base,
					icon: 'bi-person-badge',
					text: `Role changed from ${roleChange[2]} to ${roleChange[3]}`,
				});
				startingRole = roleChange[2];
			} else if (/^Invited /.test(entry.text)) {
				history.push({ ...base, icon: 'bi-envelope', text: `Invited as ${entry.text.split(' as ').pop()}` });
			} else if (/^Suspended /.test(entry.text)) {
				history.push({ ...base, icon: 'bi-pause-circle', text: `Suspended: ${entry.text.split(': ').pop()}` });
			} else if (/^Deactivated /.test(entry.text)) {
				history.push({ ...base, icon: 'bi-person-slash', text: 'Deactivated' });
			}
		}
		const logged = (at) => history.some((item) => item.at === at);

		/* Keep the original invite even after it was sent again. */
		const invite = person.invitedFirst || person.invited;
		if (invite && !logged(invite.at))
			history.push({ at: invite.at, by: invite.by, icon: 'bi-envelope', text: `Invited as ${startingRole}` });
		if (person.suspended && !logged(person.suspended.at)) history.push(suspendedEntry(person));
		if (person.deactivated && !logged(person.deactivated.at)) history.push(deactivatedEntry(person));
		if (person.joined) history.push(...joiningHistory(person, startingRole));
		const everything = history.concat(person.changes || []);
		return everything
			.map((entry, order) => ({ entry, order }))
			.sort((a, b) => fromStamp(b.entry.at) - fromStamp(a.entry.at) || b.order - a.order)
			.map(({ entry }) => entry);
	}

	/* The account being made, the move to single sign-on, 2FA and group adds. */
	function joiningHistory(person, startingRole) {
		const entries = [];
		const at = `${person.joined}T09:00`;
		const start = fromStamp(at).getTime();
		const admin = peopleById.get('ja');
		let creator = (people.find((other) => other.role === 'owner') || {}).id;
		if (person.role === 'owner') creator = person.id;
		else if (admin && admin.joined <= person.joined && person.id !== 'ja') creator = 'ja';
		entries.push({
			at,
			by: creator,
			icon: 'bi-person-plus',
			text: person.role === 'owner' ? 'Set up the workspace as Owner' : `Account created as ${startingRole}`,
		});
		/* People who joined before single sign-on moved over with everyone else. */
		if (person.signin !== 'password' && at < SSO_SWITCH) {
			entries.push({
				at: SSO_SWITCH,
				by: 'ja',
				icon: findSignin(person.signin).icon,
				text: `Sign-in moved to ${findSignin(person.signin).name}`,
			});
		}
		if (person.signin === 'password' && person.mfa) {
			const turnedOn = new Date(start + (2 + Math.floor(seededRandom(`${person.id}:mfa`)() * 20)) * DAY_MS);
			entries.push({ at: toStamp(turnedOn), by: person.id, icon: 'bi-shield-check', text: '2FA turned on' });
		}
		const random = seededRandom(`${person.id}:groups`);
		const earliest = start + 14 * DAY_MS;
		const latest = clockNow().getTime() - 5 * DAY_MS;
		const lead = findTeam(person.team)?.lead;
		const leadOther = lead && lead !== person.id;
		const originalGroups = (shared.DEMO.users.find((other) => other.id === person.id) || { groups: [] }).groups;
		for (const groupId of originalGroups) {
			const added = new Date(earliest + random() * Math.max(DAY_MS, latest - earliest));
			added.setHours(9 + Math.floor(random() * 8), Math.floor(random() * 60));
			const by = leadOther && peopleById.get(lead).joined <= toStamp(added) ? lead : 'ja';
			entries.push({ at: toStamp(added), by, icon: 'bi-people', text: `Added to ${findGroup(groupId).name}` });
		}
		return entries;
	}

	function suspendedEntry(person) {
		const { at, by, reason } = person.suspended;
		return { at, by, icon: 'bi-pause-circle', text: `Suspended: ${reason.toLowerCase()}` };
	}

	function deactivatedEntry(person) {
		return { at: person.deactivated.at, by: person.deactivated.by, icon: 'bi-person-slash', text: 'Deactivated' };
	}

	/* Changes paint first and the server is asked after; a refusal or Undo
     writes the saved copies back into the same objects. */

	function restoreRecords(records) {
		for (const record of records) {
			const target = peopleById.get(record.id);
			for (const key of Object.keys(target)) delete target[key];
			Object.assign(target, record);
		}
	}

	/**
	 * Applies a change to the person on screen and asks the server for it.
	 * @param {object} plan
	 * @param {string[]} [plan.others] other people touched, copied for rollback
	 * @param {Function} plan.change   edits the records in place
	 * @param {Function} plan.call     the server request, returning a promise
	 * @param {string[]} [plan.audit]  [icon, text] logged in the history as yours
	 * @param {{title: string, text: string, icon?: string}} plan.toast
	 * @param {boolean} [plan.undo]    offer Undo in the toast
	 * @param {string} [plan.fail]     toast title if the server refuses
	 */
	function applyChange(plan) {
		const ids = [subject.id, ...(plan.others || [])];
		const snapshot = () => ids.map((id) => copyOf(peopleById.get(id)));
		const before = snapshot();
		plan.change();
		if (plan.audit) logChange(plan.audit[0], plan.audit[1]);
		paintProfile();
		let undone = false;
		const undo = {
			label: 'Undo',
			onClick() {
				undone = true;
				const after = snapshot();
				restoreRecords(copyOf(before));
				paintProfile();
				say('Undone.');
				server.restore(before).catch(() => {
					restoreRecords(after);
					paintProfile();
					notify({
						tone: 'danger',
						title: 'Couldn’t undo that',
						text: 'The change is still in place. Try again in a moment.',
					});
				});
			},
		};
		const toastHandle = notify({
			tone: 'success',
			icon: plan.toast.icon || 'bi-check2-circle',
			title: plan.toast.title,
			text: plan.toast.text,
			duration: plan.undo ? 8000 : 5000,
			actions: plan.undo ? [undo] : [],
		});
		say(plan.toast.title);
		return plan.call().catch(() => {
			toastHandle?.dismiss();
			if (!undone) {
				restoreRecords(copyOf(before));
				paintProfile();
			}
			notify({
				tone: 'danger',
				title: plan.fail || 'That didn’t save',
				text: 'Nothing was changed. Check your connection and try again.',
			});
		});
	}

	function logChange(icon, text) {
		subject.changes = (subject.changes || []).concat({
			at: toStamp(clockNow()),
			by: book.me,
			icon,
			text,
			fresh: true,
		});
	}

	/* A suspension or deactivation that is about to be cleared stays in the history. */
	function preserveStatusHistory() {
		const mentioned = mentionsOf(subject).map((entry) => entry.at);
		const kept = [];
		if (subject.suspended && !mentioned.includes(subject.suspended.at)) kept.push(suspendedEntry(subject));
		if (subject.deactivated && !mentioned.includes(subject.deactivated.at)) kept.push(deactivatedEntry(subject));
		subject.changes = (subject.changes || []).concat(kept);
	}

	/* For the buttons with their own loading and done states, which change nothing on the page. */
	function runWithButton(button, call, success, failTitle) {
		setButton(button, 'loading');
		call()
			.then(() => {
				setButton(button, 'success');
				notify({ tone: 'success', ...success });
			})
			.catch(() => {
				setButton(button, 'error');
				setTimeout(() => setButton(button, 'idle'), 1600);
				notify({ tone: 'danger', title: failTitle, text: 'Try again in a moment.' });
			});
	}

	function onPageClick(event) {
		if (!subject) return;
		const actButton = event.target.closest('[data-ud-act]');
		if (actButton) {
			actions[actButton.getAttribute('data-ud-act')]?.(actButton);
			return;
		}
		const signOut = event.target.closest('[data-ud-signout]');
		if (signOut) {
			endSession(signOut.getAttribute('data-ud-signout'));
			return;
		}
		const removeButton = event.target.closest('[data-ud-group-remove]');
		const addButton = event.target.closest('[data-ud-group-add]');
		if (removeButton) changeGroups(removeButton.getAttribute('data-ud-group-remove'), false);
		else if (addButton) changeGroups(addButton.getAttribute('data-ud-group-add'), true);
	}

	function endSession(sessionId) {
		applyChange({
			change() {
				subject.closed = (subject.closed || []).concat(sessionId);
			},
			call: () => server.endSession(subject.id, sessionId),
			audit: ['bi-box-arrow-right', 'Signed out of one device'],
			toast: {
				title: 'Signed out on that device',
				text: `${givenName(subject.name)} needs to sign in again there.`,
				icon: 'bi-box-arrow-right',
			},
			fail: 'They’re still signed in',
		});
	}

	function changeGroups(groupId, joining) {
		const groups = joining ? subject.groups.concat(groupId) : subject.groups.filter((id) => id !== groupId);
		const label = findGroup(groupId).name;
		const firstName = givenName(subject.name);
		applyChange({
			change() {
				subject.groups = groups;
			},
			call: () => server.saveGroups(subject.id, groups),
			audit: ['bi-people', `${joining ? 'Added to' : 'Taken out of'} ${label}`],
			toast: {
				title: joining ? `${firstName} joined ${label}` : `${firstName} left ${label}`,
				text: joining
					? 'They get this group’s alerts and approvals from now on.'
					: 'They no longer get this group’s alerts and approvals.',
				icon: 'bi-people',
			},
			undo: true,
			fail: 'Groups didn’t change',
		});
		/* The list was rebuilt, so focus goes back to the Add button if it is still shown. */
		setTimeout(() => {
			const toggle = pick('[data-ud-group-toggle]');
			if (toggle && toggle.offsetParent) toggle.focus();
		}, 30);
	}

	function copyEmail() {
		const confirmCopy = () =>
			notify({ tone: 'success', icon: 'bi-copy', title: `Copied ${subject.email}`, duration: 2200 });
		if (window.Basalt.copyText) window.Basalt.copyText(subject.email).then(confirmCopy);
		else confirmCopy();
	}

	/* A deactivated person needs a free seat to come back. */
	function reactivate() {
		if (subject.status === 'deactivated' && freeSeatCount() < 1) {
			notify({
				tone: 'warning',
				title: 'No free seats',
				text: 'Reactivating needs a free seat. Add seats on the Employee Users page, or deactivate someone who has left.',
			});
			return;
		}
		applyChange({
			change() {
				preserveStatusHistory();
				subject.status = 'active';
				delete subject.suspended;
				delete subject.deactivated;
				subject.signedOut = true;
			},
			call: () => server.reactivate(subject.id),
			audit: ['bi-play-circle', 'Reactivated'],
			toast: {
				title: `${givenName(subject.name)} can sign in again`,
				text: 'Their role and work are as they were.',
				icon: 'bi-play-circle',
			},
			undo: true,
			fail: 'They weren’t reactivated',
		});
	}

	function resendInvite() {
		applyChange({
			change() {
				logChange('bi-send', 'Invite sent again');
				if (!subject.invitedFirst) subject.invitedFirst = subject.invited;
				subject.invited = { at: toStamp(clockNow()), by: book.me };
			},
			call: () => server.resendInvite(subject.id),
			toast: {
				title: 'Invite sent again',
				text: `A fresh link went to ${subject.email}. It works for 7 days.`,
				icon: 'bi-send',
			},
			fail: 'The invite didn’t send',
		});
	}

	/* Change role: a tile per role, and a list of what the switch changes. */

	function openRoleDialog() {
		pick('[data-ud-role-title]').textContent = `Change ${givenName(subject.name)}’s role`;
		for (const tile of pickAll('.basalt-choice', roleDialog.choices)) tile.remove();
		for (const role of book.roles.filter((option) => option.manage)) {
			roleDialog.choices.insertAdjacentHTML(
				'beforeend',
				`<label class="basalt-choice"><input type="radio" name="ud-role" value="${role.id}"${role.id === subject.role ? ' checked' : ''}><i class="bi ${ROLE_GLYPHS[role.id] || 'bi-person'}" aria-hidden="true"></i>${htmlSafe(role.name)}</label>`,
			);
		}
		paintRoleDiff();
		dialog('ud-role').show();
	}

	function chosenRole() {
		return pick('[name="ud-role"]:checked', roleDialog.form)?.value || subject.role;
	}

	function paintRoleDiff() {
		const target = chosenRole();
		const unchanged = target === subject.role;
		const lead = `<p class="ud-diff-lead">${htmlSafe(findRole(target).about)}</p>`;
		roleDialog.save.disabled = unchanged;
		if (unchanged) {
			roleDialog.diff.innerHTML = `${lead}<p class="ud-diff-same">This is ${htmlSafe(givenName(subject.name))}’s role now. Pick another to see what changes.</p>`;
			return;
		}
		const from = ROLE_ACCESS[subject.role] || ROLE_ACCESS.readonly;
		const to = ROLE_ACCESS[target] || ROLE_ACCESS.readonly;
		const lines = [];
		ACCESS_AREAS.forEach((area, index) => {
			if (from[index] === to[index]) return;
			const rising = to[index] > from[index];
			lines.push(
				`<li class="${rising ? 'is-up' : 'is-down'}"><i class="bi ${rising ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}" aria-hidden="true"></i><span class="ud-diff-area">${htmlSafe(area.name)}</span><span class="ud-diff-levels">${LEVEL_NAMES[from[index]]} <span aria-hidden="true">→</span><span class="visually-hidden"> becomes </span> ${LEVEL_NAMES[to[index]]}</span></li>`,
			);
		});
		roleDialog.diff.innerHTML = `${lead}<ul class="ud-diff-list">${lines.join('')}</ul>`;
	}

	function onRoleSubmit(event) {
		event.preventDefault();
		const target = chosenRole();
		if (target === subject.role) return;
		const previous = findRole(subject.role).name;
		const role = findRole(target);
		dialog('ud-role').hide();
		applyChange({
			change() {
				subject.role = target;
			},
			call: () => server.assignRole(subject.id, target),
			audit: ['bi-person-badge', `Role changed from ${previous} to ${role.name}`],
			toast: {
				title: `${givenName(subject.name)} is now ${withArticle(role.name)}`,
				text: role.about,
				icon: 'bi-person-badge',
			},
			undo: true,
			fail: 'The role didn’t change',
		});
	}

	/* Suspend: a reason, a note and whether to sign them out now. */

	function openSuspendDialog() {
		pick('[data-ud-suspend-title]').textContent = `Suspend ${subject.name}?`;
		pick('[data-ud-suspend-go]').textContent = `Suspend ${givenName(subject.name)}`;
		suspendForm.reset();
		dialog('ud-suspend').show();
	}

	function onSuspendSubmit(event) {
		event.preventDefault();
		const reason = pick('[name="ud-reason"]:checked', suspendForm)?.value || 'Other';
		const note = pick('[data-ud-suspend-note]').value.trim();
		const signOut = pick('[data-ud-suspend-signout]').checked;
		dialog('ud-suspend').hide();
		applyChange({
			change() {
				subject.status = 'suspended';
				subject.suspended = { at: toStamp(clockNow()), by: book.me, reason, note };
				if (signOut) subject.signedOut = true;
			},
			call: () => server.suspend(subject.id, reason, note, signOut),
			toast: {
				title: `${subject.name} is suspended`,
				text: `${reason}. ${signOut ? 'Signed out everywhere. ' : ''}Reactivate any time.`,
				icon: 'bi-pause-circle',
			},
			undo: true,
			fail: 'They weren’t suspended',
		});
	}

	/* Handing work over: who can take it, and moving the counts. */

	/** Options for every active colleague, with their manager (or you) picked. */
	function heirOptions() {
		const lead = leadFor(subject);
		const picked = lead && lead.status === 'active' ? lead.id : book.me;
		return people
			.filter((other) => other.status === 'active' && other.id !== subject.id)
			.sort((a, b) => a.name.localeCompare(b.name))
			.map(
				(other) =>
					`<option value="${other.id}"${other.id === picked ? ' selected' : ''} data-hint="${htmlSafe(other.title)}">${htmlSafe(other.name)}</option>`,
			)
			.join('');
	}

	function moveWork(giver, taker, kinds) {
		taker.owns = taker.owns || {};
		for (const kind of kinds) {
			const count = giver.owns?.[kind] || 0;
			if (!count) continue;
			taker.owns[kind] = (taker.owns[kind] || 0) + count;
			delete giver.owns[kind];
		}
	}

	function ownedPhrases(person, kinds) {
		return Object.entries(WORK_KINDS)
			.filter(([key]) => kinds.includes(key) && person.owns?.[key])
			.map(([key, kind]) => amount(person.owns[key], kind.one, kind.many));
	}

	function openTransferDialog() {
		pick('[data-ud-transfer-title]').textContent = `Transfer ${givenName(subject.name)}’s work`;
		pick('[data-ud-transfer-kinds]').innerHTML = Object.entries(WORK_KINDS)
			.filter(([key]) => subject.owns?.[key])
			.map(
				([key, kind]) =>
					`<div class="form-check"><input class="form-check-input" type="checkbox" id="ud-kind-${key}" value="${key}" checked><label class="form-check-label" for="ud-kind-${key}"><i class="bi ${kind.icon} me-1" aria-hidden="true"></i>${amount(subject.owns[key], kind.one, kind.many)}</label></div>`,
			)
			.join('');
		transferDialog.heir.innerHTML = heirOptions();
		refreshPicker(transferDialog.heir);
		transferDialog.error.hidden = true;
		dialog('ud-transfer').show();
	}

	function onTransferSubmit(event) {
		event.preventDefault();
		const kinds = pickAll('[data-ud-transfer-kinds] input:checked').map((box) => box.value);
		const heir = peopleById.get(transferDialog.heir.value);
		let problem = '';
		if (!kinds.length) problem = 'Check at least one thing to move.';
		else if (!heir) problem = 'Pick who gets them.';
		transferDialog.error.textContent = problem;
		transferDialog.error.hidden = !problem;
		if (problem) {
			pick('[data-ud-transfer-kinds] input').focus();
			return;
		}
		const moved = joinWords(ownedPhrases(subject, kinds));
		dialog('ud-transfer').hide();
		applyChange({
			others: [heir.id],
			change() {
				moveWork(subject, heir, kinds);
			},
			call: () => server.handOver(subject.id, heir.id, kinds),
			audit: ['bi-arrow-left-right', `Work moved to ${heir.name}`],
			toast: {
				title: `Moved to ${heir.name}`,
				text: `${moved.charAt(0).toUpperCase()}${moved.slice(1)} now belong to ${givenName(heir.name)}.`,
				icon: 'bi-arrow-left-right',
			},
			undo: true,
			fail: 'Nothing was moved',
		});
	}

	/* Deactivate: hold to confirm, and hand over their work on the way out. */

	function openDeactivateDialog() {
		pick('[data-ud-deact-title]').textContent = `Deactivate ${subject.name}?`;
		const owns = ownedTotal(subject);
		pick('[data-ud-deact-transfer]').hidden = !owns;
		if (owns) {
			pick('[data-ud-deact-owns]').textContent =
				`Hand their ${joinWords(ownedPhrases(subject, Object.keys(WORK_KINDS)))} to`;
			deactivateHeir.innerHTML = heirOptions();
			refreshPicker(deactivateHeir);
		}
		dialog('ud-deactivate').show();
	}

	function onDeactivateConfirmed() {
		const heir = ownedTotal(subject) ? peopleById.get(deactivateHeir.value) : null;
		setTimeout(() => dialog('ud-deactivate').hide(), 350);
		applyChange({
			others: heir ? [heir.id] : [],
			change() {
				if (heir) moveWork(subject, heir, Object.keys(WORK_KINDS));
				subject.status = 'deactivated';
				if (subject.suspended) preserveStatusHistory();
				subject.deactivated = { at: toStamp(clockNow()), by: book.me };
				delete subject.suspended;
				subject.groups = [];
				subject.signedOut = true;
			},
			call: () => server.deactivate(subject.id, heir ? heir.id : null),
			toast: {
				title: `${subject.name} is deactivated`,
				text: `Their seat is free. ${heir ? `Their work now belongs to ${heir.name}.` : 'They had nothing to hand over.'}`,
				icon: 'bi-person-slash',
			},
			undo: true,
			fail: 'They weren’t deactivated',
		});
	}

	/* One confirm dialog serves two jobs: resetting 2FA and signing out everywhere. */
	function openConfirm(job) {
		const firstName = givenName(subject.name);
		const jobs = {
			reset2fa: {
				icon: 'bi bi-shield-x',
				title: `Reset ${firstName}’s 2FA?`,
				text: 'Their authenticator stops working now, and they set up a new one the next time they sign in. Use this when a phone is lost or replaced.',
				button: 'Reset 2FA',
				plan: {
					change() {
						subject.mfa = false;
						subject.mfaReset = true;
					},
					call: () => server.resetTwoFactor(subject.id),
					audit: ['bi-shield-x', '2FA reset'],
					toast: {
						title: `${firstName}’s 2FA is reset`,
						text: 'They set it up again at their next sign-in.',
						icon: 'bi-shield-x',
					},
					fail: '2FA wasn’t reset',
				},
			},
			signoutall: {
				icon: 'bi bi-box-arrow-right',
				title: `Sign ${firstName} out everywhere?`,
				text: 'Every browser and phone they use is signed out now. Their account stays active, so they can sign in again straight away.',
				button: 'Sign out everywhere',
				plan: {
					change() {
						subject.signedOut = true;
					},
					call: () => server.endAllSessions(subject.id),
					audit: ['bi-box-arrow-right', 'Signed out everywhere'],
					toast: {
						title: `${firstName} is signed out everywhere`,
						text: 'They need to sign in again on every device.',
						icon: 'bi-box-arrow-right',
					},
					fail: 'They’re still signed in',
				},
			},
		};
		const chosen = jobs[job] || jobs.signoutall;
		pick('[data-ud-confirm-icon]').className = chosen.icon;
		pick('[data-ud-confirm-title]').textContent = chosen.title;
		pick('[data-ud-confirm-text]').textContent = chosen.text;
		confirmDialog.go.textContent = chosen.button;
		confirmDialog.run = () => applyChange(chosen.plan);
		dialog('ud-confirm').show();
	}

	/* Small tools: lookups inside the page, markup safety, wording and the sample clock. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function slot(key) {
		return pick(`[data-ud="${key}"]`);
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	function copyOf(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function setButton(button, phase) {
		if (button && window.Basalt.buttonState) window.Basalt.buttonState(button, phase);
	}

	function dialog(id) {
		return bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
	}

	function refreshPicker(select) {
		window.Basalt.select?.refresh?.(select);
	}

	function later(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	/* Under ?state=fail every write is refused after the same pause. */
	function reply(ms, value) {
		if (!refuseWrites) return later(ms, value);
		return later(ms).then(() => {
			throw new Error('The server said no');
		});
	}

	/** "3 devices", "1 run": the count with the right form of the noun. */
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

	function withArticle(word) {
		return `${/^[AEIOU]/i.test(word) ? 'an' : 'a'} ${word}`;
	}

	/* "a, b and c"; a single item stands alone. */
	function joinWords(words) {
		if (words.length < 2) return words.join('');
		return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
	}

	/** A repeatable random source: the same key always yields the same sequence. */
	function seededRandom(key) {
		let state = 2166136261;
		for (const char of key) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
		return () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* The directory's sample clock, running on from the moment this page opened. */
	function clockNow() {
		return new Date(shared.DEMO_NOW.getTime() + (Date.now() - openedAt));
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

	function midnight(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	}

	function agoDays(date) {
		return Math.round((midnight(clockNow()) - midnight(date)) / DAY_MS);
	}

	function clockTime(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())} ${hours < 12 ? 'am' : 'pm'}`;
	}

	function monthDay(date) {
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/* "Sep 28" this year, "Apr 20, 2020" for any other. */
	function dayName(date) {
		const year = date.getFullYear();
		return year === clockNow().getFullYear() ? monthDay(date) : `${monthDay(date)}, ${year}`;
	}

	/* "Today, 9:47 am", "Yesterday, 6:02 pm" or "Sep 28, 9:14 am". */
	function stampLabel(text) {
		const date = fromStamp(text);
		const prefix = { 0: 'Today', 1: 'Yesterday' }[agoDays(date)] || dayName(date);
		return `${prefix}, ${clockTime(date)}`;
	}

	/* The short form: Just now, 12 min ago, 3 h ago, Yesterday, Sep 28. */
	function sinceLabel(text) {
		const date = fromStamp(text);
		const minutes = Math.round((clockNow() - date) / 60000);
		const days = agoDays(date);
		if (minutes < 2) return 'Just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (days === 0) return `${Math.floor(minutes / 60)} h ago`;
		if (days === 1) return 'Yesterday';
		return dayName(date);
	}

	/* Time since a date in the biggest unit that fits: 6 years, 3 weeks, 4 days. */
	function tenure(date) {
		const days = Math.max(0, agoDays(date));
		if (days >= 365) return amount(Math.floor(days / 365.25), 'year');
		if (days >= 60) return amount(Math.floor(days / 30.44), 'month');
		if (days >= 14) return amount(Math.floor(days / 7), 'week');
		return amount(days, 'day');
	}

	start();
})();
