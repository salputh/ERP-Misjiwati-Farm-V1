/**
 * Drives help-desk.html, the help desk. A single question box feeds two
 * views at once, the quick matches under it and the full guide shelf further
 * down, while the staffing card, the three ways to reach a person and the
 * request dialog all work from one shared picture of who is at the desk.
 * Every hook it touches is a [data-hd-*] attribute.
 */
(() => {
	'use strict';

	const page = pick('[data-helpdesk]');
	if (!page) return;

	const modalKit = window.bootstrap;
	const kit = window.Basalt || {};
	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Sample content. A live install would read the guides from its own help
     index and the staffing from the support queue, in these same fields. */
	const AREA_BOOK = {
		onboarding: { label: 'Onboarding', glyph: 'bi-rocket-takeoff', lead: 'Leah Martin' },
		billing: { label: 'Billing', glyph: 'bi-credit-card', lead: 'Trent Roach' },
		access: { label: 'Access Control', glyph: 'bi-person-badge', lead: 'Lindsay Kinney' },
		data: { label: 'Data Sources', glyph: 'bi-database', lead: 'Elaine Leach' },
		alerts: { label: 'Alerting', glyph: 'bi-bell', lead: 'Jacob Vance' },
		exports: { label: 'Exports', glyph: 'bi-file-earmark-arrow-down', lead: 'Erin Slater' },
		mobile: { label: 'Mobile', glyph: 'bi-phone', lead: 'Sharon Oakley' },
	};

	/* The request dialog adds one choice the shelf never shows. */
	const UNSURE_AREA = { label: 'Not sure', glyph: 'bi-question-circle', lead: '' };

	/* Guides shelved by area. Each entry reads: slug, [minutes to read, days
     since the last edit, opens in the past 30 days], title and one-line
     summary, then the steps on a line of their own. */
	const SHELVES = {
		onboarding: [
			entry(
				'first-workspace',
				[3, 12, 1340],
				'Opening your first workspace',
				'Name it, invite two people and pick the time zone every schedule will use.',
				[
					'Go to Settings, then Workspaces, and choose New workspace.',
					'Set the time zone before anything else. Exports and alerts both read it.',
					'Invite at least one other person so the first board has a second reader.',
				],
			),
			entry(
				'first-source',
				[4, 6, 980],
				'Connecting your first data source',
				'Start with a CSV if your warehouse login is still waiting on IT.',
				[
					'Open Data Sources and choose Add source.',
					'Pick Upload a file and drop in a CSV with a header row.',
					'Swap it for the warehouse connection later. Boards keep working if the column names match.',
				],
			),
			entry(
				'first-board',
				[6, 20, 860],
				'Building a board people will actually read',
				'Four tiles, one question each, and the number that matters in the top left.',
				[
					'Write down the one question the board answers before adding any tile.',
					'Put the headline number top left, where people look first.',
					'Stop at four tiles. Anything else goes on a second board.',
				],
			),
			entry(
				'invite-free',
				[3, 9, 720],
				'Inviting people without using up seats',
				'Viewers are free. Only people who edit count toward your seats.',
				[
					'Open Settings, then People, and choose Invite.',
					'Set the role to Viewer for anyone who only reads boards.',
					'Change them to Editor later if they need it. The seat is added that day.',
				],
			),
		],
		billing: [
			entry(
				'seat-count',
				[5, 4, 905],
				'Why your seat count is lower than your member count',
				'Seats count people who signed in this month, not everyone you invited.',
				[
					'Open Settings, then Billing, and look at Seats this month.',
					'Compare it with Members. The difference is people who have not signed in.',
					'Remove old invites if you want the two numbers to match.',
				],
			),
			entry(
				'purchase-order',
				[3, 15, 410],
				'Paying by purchase order',
				'Send the PO number before the invoice is issued and it prints on the PDF.',
				[
					'Open Settings, then Billing, then Payment method.',
					'Choose Purchase order and enter the PO number.',
					'Do it before the 1st of the month so it lands on the next invoice.',
				],
			),
			entry(
				'past-invoices',
				[2, 30, 650],
				'Finding past invoices as PDFs',
				'Every invoice since your first month, under Settings and Billing.',
				[
					'Open Settings, then Billing, then Invoices.',
					'Use the year filter if the list is long.',
					'Choose Download PDF, or Send to add your finance inbox.',
				],
			),
			entry(
				'change-plan',
				[4, 8, 530],
				'Changing plans partway through a month',
				'Upgrades are charged the same day for the days left. Downgrades wait for renewal.',
				[
					'Open Settings, then Billing, then Plan.',
					'Pick the new plan. The page shows what you pay today before you confirm.',
					'A downgrade keeps your current features until the renewal date.',
				],
			),
		],
		access: [
			entry(
				'session-pinning',
				[4, 7, 1120],
				'Turning off session pinning for shift staff',
				'Staff on shared laptops get signed out when their IP address changes. Here is the switch.',
				[
					'Open Settings, then Security, then Sessions.',
					'Create a group for shift staff and turn Session pinning off for it.',
					'Leave it on for everyone else. It stops stolen sessions being reused.',
				],
			),
			entry(
				'sso-okta',
				[7, 11, 880],
				'Setting up single sign-on with Okta',
				'Paste two values into Okta, one into Basalt, and test from a second browser.',
				[
					'Copy the sign-on URL and audience from Settings, then Security, then SSO.',
					'Paste them into a new SAML app in Okta, then copy its metadata URL back.',
					'Test in a private window before you turn on Require SSO.',
				],
			),
			entry(
				'scim',
				[8, 18, 640],
				'Syncing people from your identity provider',
				'New hires get access on day one, and leavers lose it the same hour.',
				[
					'Turn on SCIM under Settings, then Security, and copy the token.',
					'Add the token and base URL to your identity provider.',
					'Assign groups there. Basalt maps each group to a role.',
				],
			),
			entry(
				'audit-log',
				[5, 25, 390],
				'Reading the audit log',
				'Who changed what and when, with filters for a person or a board.',
				[
					'Open Settings, then Audit log.',
					'Filter by person, board or type of change.',
					'Export the filtered view as CSV if someone outside Basalt needs it.',
				],
			),
		],
		data: [
			entry(
				'snowflake-role',
				[6, 4, 1780],
				'Connecting Snowflake with a read-only role',
				'Create a role that can read but never write, then grant it one warehouse.',
				[
					'In Snowflake, create a role and grant it USAGE on one warehouse and SELECT on the schemas you need.',
					'Create a user for Basalt with that role as its default.',
					'Add the connection in Data Sources and choose Test.',
				],
			),
			entry(
				'refresh-queued',
				[3, 2, 1210],
				'A refresh is stuck on queued',
				'Usually the warehouse is suspended. Resume it, or raise the timeout.',
				[
					'Check the warehouse in your provider. If it is suspended, resume it.',
					'Set Auto-resume on so it wakes for the next refresh.',
					'If it still waits, raise the refresh timeout under the source settings.',
				],
			),
			entry(
				'column-mapping',
				[4, 7, 760],
				'Mapping columns after a source changes',
				'When a column is renamed, point the board at the new name instead of rebuilding it.',
				[
					'Open the source and choose Columns. Missing ones are marked in red.',
					'Pick the new column name for each missing one.',
					'Save. Every board using the old name updates at once.',
				],
			),
			entry(
				'large-upload',
				[3, 21, 420],
				'Uploading spreadsheets larger than 50 MB',
				'Split by month, or zip the file. Both go through the same upload.',
				[
					'Save the sheet as CSV, which is often half the size.',
					'Zip it. Uploads accept .zip files up to 500 MB.',
					'Or split it by month and upload each part to the same source.',
				],
			),
			entry(
				'refresh-schedule',
				[4, 13, 570],
				'Choosing a refresh schedule',
				'Hourly for the operations board, daily for the rest. Every refresh uses warehouse credits.',
				[
					'Open the source and choose Schedule.',
					'Pick hourly only for boards people watch during the day.',
					'Set the rest to daily, early in the morning.',
				],
			),
		],
		alerts: [
			entry(
				'alert-scope',
				[4, 2, 2310],
				'Scoping an alert rule to one department',
				'Add a filter to the rule itself, not the board, or everyone gets notified.',
				[
					'Open the rule and choose Add filter.',
					'Pick Department and the one you want.',
					'Save, then check the preview. It lists who will be notified.',
				],
			),
			entry(
				'cool-downs',
				[4, 0, 880],
				'Cool-downs on alert rules',
				'One setting that turns a jittery metric from forty notifications into one.',
				[
					'Open the rule and find Cool-down.',
					'Set how long to stay quiet after it fires. An hour suits most rules.',
					'The rule still records every breach. It only stops repeating the message.',
				],
			),
			entry(
				'alerts-chat',
				[3, 10, 990],
				'Sending alerts to Slack and Microsoft Teams',
				'Connect the channel once, then pick it as a destination on any rule.',
				[
					'Open Settings, then Integrations, and connect Slack or Teams.',
					'Choose which channels Basalt may post to.',
					'Add the channel as a destination on each rule.',
				],
			),
			entry(
				'alert-twice',
				[3, 16, 470],
				'Why an alert fired twice',
				'Two rules are watching the same number. The rule list marks the overlap.',
				[
					'Open Alerting and look for the overlap marker next to a rule.',
					'Open both rules and compare their filters.',
					'Merge them, or narrow one so they no longer cover the same data.',
				],
			),
		],
		exports: [
			entry(
				'weekly-pdf',
				[4, 1, 1455],
				'Scheduling a board as a weekly PDF',
				"Pick the day, the time zone and who gets it. Recipients don't need a seat.",
				[
					'Open the board and choose Share, then Schedule.',
					'Pick PDF, the day and the hour.',
					'Add recipients by email. They get the PDF without signing in.',
				],
			),
			entry(
				'split-exports',
				[6, 14, 520],
				'Split exports above a million rows',
				'What the numbered parts contain, and how to put them back together.',
				[
					'Exports over a million rows arrive as numbered parts in one zip.',
					'Each part has the same header row.',
					'Combine them in your warehouse, or in a spreadsheet one part at a time.',
				],
			),
			entry(
				'export-limits',
				[2, 27, 610],
				'CSV and XLSX limits',
				'XLSX stops at 1,048,576 rows. CSV has no row limit, but files cap at 2 GB.',
				[
					'Use XLSX for anything someone will open in a spreadsheet.',
					'Use CSV for anything bigger, or anything going into another system.',
					'Filter the board first if you only need part of the data.',
				],
			),
			entry(
				'export-hour',
				[3, 5, 840],
				'Exports arriving at the wrong hour',
				'Schedules use the workspace time zone, not yours. Change one or the other.',
				[
					'Check the time zone under Settings, then Workspace.',
					'Open the schedule and look at the hour it shows.',
					'Change the schedule hour, or ask an admin to change the workspace time zone.',
				],
			),
		],
		mobile: [
			entry(
				'home-screen',
				[2, 19, 560],
				"Adding Basalt to a phone's home screen",
				'No app store needed. Open it in the browser and add it to the home screen.',
				[
					'Open Basalt in Safari or Chrome on the phone.',
					'Choose Share, then Add to Home Screen.',
					'Sign in once. It opens full screen from then on.',
				],
			),
			entry(
				'offline',
				[3, 23, 330],
				'What works offline',
				'Boards you opened in the last day stay readable. Edits wait until you reconnect.',
				[
					'Open the boards you need before you lose signal.',
					'Offline, they show the time of the last refresh at the top.',
					'Anything you change is sent when the phone reconnects.',
				],
			),
			entry(
				'signed-out',
				[3, 9, 610],
				'Why your phone keeps signing you out',
				'Usually session pinning, or a browser that clears site data every night.',
				[
					'Ask an admin whether session pinning is on for your group.',
					'Check the browser is not set to clear data when it closes.',
					'Add Basalt to the home screen. It keeps its own sign-in.',
				],
			),
		],
	};

	/* One flat list in shelf order; the order breaks ties when two guides
     rank the same, so it has to stay as written above. */
	const LIBRARY = Object.entries(SHELVES).flatMap(([area, shelf]) => shelf.map((guide) => ({ ...guide, area })));
	const GUIDE_BY_SLUG = Object.fromEntries(LIBRARY.map((guide) => [guide.slug, guide]));

	/* Recorded walkthroughs. The dialog plays a drawn stand-in, so swapping in
     a real <video> only means feeding its currentTime into `playback.at`. */
	const CLIPS = [
		{
			slug: 'v-board',
			area: 'onboarding',
			tier: 'Beginner',
			length: 364,
			opens: 2480,
			guideSlug: 'first-board',
			heading: 'From a CSV to a board people read',
			blurb: 'Upload a spreadsheet, pick the one question the board answers, and share it before lunch.',
			chapters: [
				{
					at: 0,
					name: 'Upload the CSV',
					line: 'Drop the file on Data Sources. Basalt reads the header row as column names.',
				},
				{
					at: 80,
					name: 'Check the columns',
					line: 'Dates and money are detected; fix anything read as text before building tiles.',
				},
				{
					at: 165,
					name: 'Add the first tile',
					line: 'One tile, one question. Start with the number people ask you for most.',
				},
				{
					at: 250,
					name: 'Headline top left',
					line: 'Move the headline number to the top left, where people look first.',
				},
				{
					at: 320,
					name: 'Share it',
					line: 'Viewers are free, so share with everyone who asks for the numbers.',
				},
			],
		},
		{
			slug: 'v-alerts',
			area: 'alerts',
			tier: 'Intermediate',
			length: 712,
			opens: 1640,
			guideSlug: 'alert-scope',
			heading: 'Alert rules, scopes and cool-downs',
			blurb: '',
			chapters: [
				{
					at: 0,
					name: 'Write the rule',
					line: 'Pick the metric and the threshold that means someone should act.',
				},
				{
					at: 150,
					name: 'Scope to one team',
					line: 'Add a filter to the rule itself, not the board, so only that team is told.',
				},
				{
					at: 330,
					name: 'Pick where it goes',
					line: 'Email, Slack or Teams. Each destination is connected once and reused.',
				},
				{
					at: 480,
					name: 'Set a cool-down',
					line: 'A cool-down stops the same breach from alerting again every refresh.',
				},
				{ at: 620, name: 'Test it', line: 'Send a test alert and check it lands where people will see it.' },
			],
		},
		{
			slug: 'v-scim',
			area: 'access',
			tier: 'Advanced',
			length: 578,
			opens: 740,
			guideSlug: 'scim',
			heading: 'Syncing people from your identity provider',
			blurb: '',
			chapters: [
				{
					at: 0,
					name: 'Turn on SCIM',
					line: 'Settings, then Access, then Provisioning. Copy the token shown once.',
				},
				{ at: 120, name: 'Connect Okta', line: 'Paste the base URL and token into the Basalt app in Okta.' },
				{
					at: 260,
					name: 'Map groups to roles',
					line: 'Each identity group becomes a Basalt role; unmapped groups are ignored.',
				},
				{
					at: 400,
					name: 'Test one person',
					line: 'Assign one person first and watch them appear within a minute.',
				},
				{
					at: 500,
					name: 'Removing access',
					line: 'Unassigning in Okta signs the person out and frees their seat.',
				},
			],
		},
		{
			slug: 'v-exports',
			area: 'exports',
			tier: 'Beginner',
			length: 446,
			opens: 1210,
			guideSlug: 'export-hour',
			heading: 'Scheduled exports across time zones',
			blurb: '',
			chapters: [
				{ at: 0, name: 'Schedule an export', line: 'Open a board, choose Schedule, and pick PDF or CSV.' },
				{
					at: 95,
					name: 'The workspace time zone',
					line: 'Schedules run in the workspace time zone, not your own.',
				},
				{ at: 190, name: 'Recipients', line: 'Recipients do not need a seat. Add a list or a shared inbox.' },
				{ at: 300, name: 'Skip weekends', line: 'Turn on Weekdays only for reports nobody reads on Sunday.' },
				{
					at: 390,
					name: 'Check the first run',
					line: 'The first run is logged under Exports, with who received it.',
				},
			],
		},
		{
			slug: 'v-snowflake',
			area: 'data',
			tier: 'Intermediate',
			length: 492,
			opens: 1905,
			guideSlug: 'snowflake-role',
			heading: 'Connecting Snowflake with a read-only role',
			blurb: '',
			chapters: [
				{
					at: 0,
					name: 'Create the role',
					line: 'A role that can read but never write keeps your warehouse safe.',
				},
				{
					at: 110,
					name: 'Grant one warehouse',
					line: 'Grant usage on one warehouse so refreshes never compete with ETL.',
				},
				{ at: 220, name: 'Add the connection', line: 'Paste the account, user and role into Data Sources.' },
				{
					at: 340,
					name: 'Pick the tables',
					line: 'Only the tables you pick are read; the rest stay invisible.',
				},
				{
					at: 430,
					name: 'First refresh',
					line: 'Run the first refresh now and set the schedule after it succeeds.',
				},
			],
		},
	];

	/* Staffing, in UTC so every visitor sees the same desk. Two shifts cover
     the open hours, and calls can be booked at three fixed weekday times. */
	const DESK_HOURS = { opens: 6, closes: 22 };
	const ROTA = [
		{ start: 6, end: 14, areas: ['data', 'billing', 'access'] },
		{ start: 14, end: 22, areas: ['alerts', 'exports', 'mobile'] },
	];
	const CALL_TIMES = [
		{ hour: 9, minute: 0 },
		{ hour: 13, minute: 30 },
		{ hour: 16, minute: 0 },
	];

	/* With no area and no query the shelf only lists this many of the most
     opened guides; anything narrower lists every match. */
	const SHELF_PREVIEW = 8;
	const PROMPTS = [
		'why is my seat count lower',
		'send a board as a weekly PDF',
		'alert fired twice',
		'refresh stuck on queued',
		'phone keeps signing me out',
	];
	const CURSOR_SPOTS = [
		['8%', '30%'],
		['55%', '18%'],
		['38%', '50%'],
		['8%', '62%'],
		['78%', '78%'],
	];
	const NOTE_ICONS = { info: 'bi-info-circle-fill', done: 'bi-check-circle-fill' };
	const SUBMIT_WORDS = { ticket: 'Send the ticket', call: 'Book the call' };
	const TICKET_PROMISE = {
		blocking: 'First reply within the hour, any time of day.',
		slowing: 'First reply within 4 hours.',
		question: 'First reply within one business day.',
	};

	const dayFormat = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC',
	});
	const hourFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

	/* Live state, one object per part of the page. */
	const deskNow = { isOpen: true, chatWait: 2, minutesLeft: 0, onShift: [], morningCrew: [] };
	const browse = { text: '', area: 'all', order: 'popular' };
	const reader = { guide: null, thenRun: null };
	const request = { isOpen: false, thenRun: null, readGuide: null, pause: null };
	const playback = { clip: null, at: 0, running: false, rate: 1, ticker: null };
	const watchedSeconds = {};
	let clipTier = 'all';
	let ticketNumber = 4812;

	const box = pick('[data-hd-search]');
	const quickList = pick('[data-hd-answers]');
	const shelfList = pick('[data-hd-list]');
	const shelfNote = pick('[data-hd-summary]');
	const areaFilter = pick('[data-hd-areas]');
	const guideDialog = pick('[data-hd-guide]');
	const requestDialog = pick('[data-hd-contact-modal]');
	const requestForm = pick('[data-hd-contact-form]');
	const subjectField = pick('[data-hd-subject]');
	const detailField = pick('[data-hd-details]');
	const clipDialog = pick('[data-hd-video-modal]');
	const clipGrid = pick('[data-hd-videos]');
	const tierGroup = pick('[data-hd-video-levels]');
	const guideModal = modalKit ? modalKit.Modal.getOrCreateInstance(guideDialog) : null;
	const requestModal = modalKit ? modalKit.Modal.getOrCreateInstance(requestDialog) : null;
	const clipModal = modalKit && clipDialog ? modalKit.Modal.getOrCreateInstance(clipDialog) : null;
	const placeholderText = box.getAttribute('placeholder');
	const noteShelf = pick('.helpdesk-toast-region') || makeNoteShelf();

	/** Draws everything once, wires the controls and starts the timers. */
	function start() {
		paintAreaTiles();
		bindSearchBox();
		bindShelf();
		bindGuideDialog();
		bindRequestDialog();
		bindClips();

		readDesk();
		paintDesk();
		paintBrowse();
		paintClips();
		typePrompts();

		setInterval(nudgeChatWait, 15000);
		setInterval(refreshDesk, 30000);
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) refreshDesk();
		});
	}

	/* Content builders. */

	/** Packs one guide row; `figures` is [read minutes, days old, opens]. */
	function entry(slug, figures, heading, blurb, steps) {
		const [readMins, ageDays, opens] = figures;
		return { slug, heading, blurb, steps, readMins, ageDays, opens };
	}

	/* The desk: open or shut, who is on shift, how long chat takes. */

	function readDesk() {
		const now = new Date();
		const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
		const opensAt = DESK_HOURS.opens * 60;
		const closesAt = DESK_HOURS.closes * 60;
		deskNow.isOpen = minute >= opensAt && minute < closesAt;
		if (deskNow.isOpen) deskNow.minutesLeft = closesAt - minute;
		else if (minute < opensAt) deskNow.minutesLeft = opensAt - minute;
		else deskNow.minutesLeft = 24 * 60 - minute + opensAt;
		const shift = ROTA.find((slot) => minute >= slot.start * 60 && minute < slot.end * 60);
		deskNow.onShift = shift ? shift.areas : [];
		deskNow.morningCrew = ROTA[0].areas;
	}

	function paintDesk() {
		const open = deskNow.isOpen;
		pick('[data-hd-desk]').classList.toggle('is-closed', !open);
		pick('[data-hd-state-text]').textContent = open ? 'Open' : 'Closed';
		pick('[data-hd-hours]').textContent =
			`Live chat runs 6:00 am to 10:00 pm UTC, every day. ${open ? 'Closes' : 'Opens'} in ${spanOf(deskNow.minutesLeft)}.`;
		pick('[data-hd-people-label]').textContent = open ? 'On duty' : 'Back at 6:00 am UTC';
		pick('[data-hd-people]').innerHTML = (open ? deskNow.onShift : deskNow.morningCrew).map(personRow).join('');
		pick('[data-hd-desk-cta]').textContent = open ? 'Ask the team' : 'Leave a message';
		paintChatWait();
		paintCallRung();
	}

	function personRow(areaKey) {
		const { label, lead } = AREA_BOOK[areaKey];
		return `<li class="helpdesk-person helpdesk-area-${areaKey}"><span aria-hidden="true" class="helpdesk-person-avatar">${monogram(lead)}</span><span class="helpdesk-person-text"><strong>${htmlSafe(lead)}</strong><span>${htmlSafe(label)}</span></span></li>`;
	}

	/** Short wait wording used on the chat tile in the request dialog. */
	function waitPhrase() {
		return deskNow.isOpen ? `about ${deskNow.chatWait} min` : `opens in ${spanOf(deskNow.minutesLeft)}`;
	}

	function paintChatWait() {
		const figure = pick('[data-hd-wait]');
		const shown = deskNow.isOpen ? `${deskNow.chatWait} min` : 'Closed';
		if (figure.textContent.trim() !== shown) {
			figure.textContent = shown;
			if (!stillMotion) replayTick(figure);
		}
		pick('[data-hd-rung="chat"]').textContent = deskNow.isOpen
			? `Replies in about ${deskNow.chatWait} min`
			: `Closed now, opens in ${spanOf(deskNow.minutesLeft)}`;
		const tileHint = pick('[data-hd-channel-hint="chat"]');
		if (tileHint) tileHint.textContent = waitPhrase();
	}

	/* Dropping the class and forcing a layout lets the animation run again. */
	function replayTick(figure) {
		figure.classList.remove('is-tick');
		void figure.offsetWidth;
		figure.classList.add('is-tick');
	}

	function paintCallRung() {
		const soonest = upcomingSlots(1)[0];
		pick('[data-hd-rung="call"]').textContent = `Next free: ${slotText(soonest)} UTC`;
		const tileHint = pick('[data-hd-channel-hint="call"]');
		if (tileHint) tileHint.textContent = `from ${dayFormat.format(soonest)}`;
	}

	/** Weekday call times at least an hour out, looking two weeks ahead. */
	function upcomingSlots(howMany) {
		const found = [];
		const now = new Date();
		const notBefore = now.getTime() + 60 * 60 * 1000;
		const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
		for (let offset = 0; offset < 14 && found.length < howMany; offset += 1) {
			const day = new Date(today + offset * 86400000);
			const weekday = day.getUTCDay();
			if (weekday === 0 || weekday === 6) continue;
			for (const { hour, minute } of CALL_TIMES) {
				const stamp = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute);
				if (stamp >= notBefore && found.length < howMany) found.push(new Date(stamp));
			}
		}
		return found;
	}

	function clockText(date) {
		return hourFormat.format(date).toLowerCase();
	}

	function slotText(date) {
		return `${dayFormat.format(date)}, ${clockText(date)}`;
	}

	/* The chat wait wanders by a minute either way, like a real queue. Both
     timers sit idle while the tab is in the background. */
	function nudgeChatWait() {
		if (document.hidden || !deskNow.isOpen) return;
		const drift = Math.random() < 0.5 ? -1 : 1;
		deskNow.chatWait = Math.min(5, Math.max(1, deskNow.chatWait + drift));
		paintChatWait();
		if (request.isOpen) paintRoute();
	}

	/* Repaints on every beat, since the countdown to opening or closing keeps
     moving even while the open state holds. */
	function refreshDesk() {
		if (document.hidden) return;
		readDesk();
		paintDesk();
		if (request.isOpen) paintRoute();
	}

	/* Search, quick matches and the guide shelf. */

	function paintBrowse() {
		paintQuickMatches();
		paintAreaFilter();
		paintShelf();
	}

	function paintQuickMatches() {
		const query = browse.text.trim();
		quickList.classList.toggle('is-open', Boolean(query));
		if (!query) {
			quickList.innerHTML = '';
			return;
		}
		const found = findGuides(query);
		if (!found.length) {
			quickList.innerHTML = `<div class="helpdesk-answers-none"><span aria-hidden="true" class="helpdesk-answers-none-icon"><i class="bi bi-person-raised-hand"></i></span><div><p class="helpdesk-answers-none-title">No guide covers “${htmlSafe(query)}” yet.</p><p class="helpdesk-answers-none-text">Ask the team instead. Your words go into the request, so you don't have to type them twice.</p></div><button data-hd-ask-query type="button" class="btn btn-sm btn-primary">Ask about it</button></div>`;
			return;
		}
		const leaders = found.slice(0, 3);
		const rows = leaders
			.map(
				(guide) =>
					`<li><button data-hd-open="${guide.slug}" type="button" class="helpdesk-answer">${areaBadge(guide)}<span class="helpdesk-answer-text"><span class="helpdesk-answer-title">${markTerms(guide.heading, query)}</span><span class="helpdesk-answer-meta">${htmlSafe(AREA_BOOK[guide.area].label)} · ${guide.readMins} min read</span></span><i aria-hidden="true" class="bi bi-arrow-right helpdesk-answer-go"></i></button></li>`,
			)
			.join('');
		const more =
			found.length > 3
				? `<button data-hd-see-all type="button" class="helpdesk-answers-all">See all ${found.length} matching guides <i aria-hidden="true" class="bi bi-arrow-down"></i></button>`
				: '';
		quickList.innerHTML = `<p class="helpdesk-answers-label">Best ${leaders.length === 1 ? 'match' : 'matches'}</p><ul class="helpdesk-answers-list">${rows}</ul>${more}`;
	}

	function paintAreaFilter() {
		const query = browse.text.trim();
		const pool = query ? findGuides(query) : LIBRARY;
		const tally = { all: pool.length };
		for (const key of Object.keys(AREA_BOOK)) tally[key] = 0;
		for (const guide of pool) tally[guide.area] += 1;
		const choices = [['all', { label: 'All areas', glyph: 'bi-grid' }], ...Object.entries(AREA_BOOK)];
		areaFilter.innerHTML = choices
			.map(
				([key, area]) =>
					`<button data-hd-area="${key}" aria-pressed="${browse.area === key}"${tally[key] ? '' : ' data-empty'} type="button" class="helpdesk-areabtn helpdesk-area-${key}"><span aria-hidden="true" class="helpdesk-icon"><i class="bi ${area.glyph}"></i></span><span class="helpdesk-areabtn-name">${htmlSafe(area.label)}</span><span class="helpdesk-areabtn-count">${tally[key]}</span></button>`,
			)
			.join('');
	}

	/** Guides for the current area and query, in the chosen order. */
	function shelfGuides() {
		const query = browse.text.trim();
		const byOpens = (a, b) => b.opens - a.opens;
		const byFreshness = (a, b) => a.ageDays - b.ageDays || b.opens - a.opens;
		return LIBRARY.filter((guide) => browse.area === 'all' || guide.area === browse.area)
			.filter((guide) => !query || isMatch(guideText(guide), query))
			.sort(browse.order === 'recent' ? byFreshness : byOpens);
	}

	function paintShelf() {
		const query = browse.text.trim();
		const guides = shelfGuides();
		const previewOnly = !query && browse.area === 'all';
		const scope = browse.area === 'all' ? 'across every area' : `in ${AREA_BOOK[browse.area].label}`;
		const ordering = browse.order === 'recent' ? 'newest changes first' : 'most opened first';

		if (query)
			shelfNote.textContent = `${countOf(guides.length, 'guide')} mention “${query}” ${scope}, ${ordering}.`;
		else if (previewOnly)
			shelfNote.textContent = `The ${SHELF_PREVIEW}${browse.order === 'recent' ? ' most recently updated' : ' most opened'} of ${guides.length} guides. Pick an area to see all of its guides.`;
		else shelfNote.textContent = `${countOf(guides.length, 'guide')} ${scope}, ${ordering}.`;

		if (!guides.length) {
			shelfList.innerHTML = `<li class="helpdesk-list-empty">${emptyShelf(query)}</li>`;
			return;
		}
		const visible = previewOnly ? guides.slice(0, SHELF_PREVIEW) : guides;
		shelfList.innerHTML = visible
			.map(
				(guide, position) =>
					`<li style="--i:${position}"><button data-hd-open="${guide.slug}" type="button" class="helpdesk-guide">${areaBadge(guide)}<span class="helpdesk-guide-text"><span class="helpdesk-guide-title">${markTerms(guide.heading, query)}</span><span class="helpdesk-guide-summary">${markTerms(guide.blurb, query)}</span></span><span class="helpdesk-guide-meta"><span><i aria-hidden="true" class="bi bi-clock"></i>${guide.readMins} min read</span><span${guide.ageDays < 7 ? ' class="is-fresh"' : ''}>${ageText(guide.ageDays)}</span></span></button></li>`,
			)
			.join('');
	}

	function emptyShelf(query) {
		if (!kit.emptyState) return '<p>No guides match.</p>';
		const advice =
			browse.area === 'all'
				? 'Try one word instead of a sentence, or ask the team.'
				: `Nothing in ${htmlSafe(AREA_BOOK[browse.area].label)}. Try All areas, or ask the team.`;
		return kit.emptyState({ query, noun: 'guides', text: advice });
	}

	function areaBadge(guide) {
		return `<span aria-hidden="true" class="helpdesk-icon helpdesk-area-${guide.area}"><i class="bi ${AREA_BOOK[guide.area].glyph}"></i></span>`;
	}

	function bindSearchBox() {
		box.addEventListener('input', () => {
			browse.text = box.value;
			paintBrowse();
		});

		/* Down arrow steps into the quick matches, Enter opens the top one and
       Escape empties the box. */
		box.addEventListener('keydown', (event) => {
			const keyActions = {
				ArrowDown() {
					const target = pick('.helpdesk-answer, [data-hd-ask-query]', quickList);
					if (!target) return;
					event.preventDefault();
					target.focus();
				},
				Enter() {
					const target = pick('.helpdesk-answer', quickList);
					if (!target) return;
					event.preventDefault();
					showGuide(target.getAttribute('data-hd-open'));
				},
				Escape() {
					if (!box.value) return;
					event.preventDefault();
					setQuery('');
				},
			};
			keyActions[event.key]?.();
		});

		quickList.addEventListener('keydown', (event) => {
			const step = { ArrowDown: 1, ArrowUp: -1, Escape: 0 }[event.key];
			if (step === undefined) return;
			event.preventDefault();
			const stops = pickAll('.helpdesk-answer, [data-hd-see-all], [data-hd-ask-query]', quickList);
			const here = stops.indexOf(document.activeElement);
			if (step === 0 || (step < 0 && here <= 0)) {
				box.focus();
				return;
			}
			stops[here + step]?.focus();
		});

		/* A slash anywhere outside a text field or dialog jumps to the box. */
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
			if (event.target.closest?.('input, textarea, select, [contenteditable="true"], .modal')) return;
			event.preventDefault();
			box.focus();
			box.select();
		});

		for (const chip of pickAll('[data-hd-query]')) {
			chip.addEventListener('click', () => {
				setQuery(chip.getAttribute('data-hd-query'));
				box.focus();
			});
		}
	}

	/** Writes into the box the way typing would, so every listener hears it. */
	function setQuery(text) {
		box.value = text;
		box.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function bindShelf() {
		areaFilter.addEventListener('click', (event) => {
			const choice = event.target.closest('[data-hd-area]');
			if (!choice) return;
			browse.area = choice.getAttribute('data-hd-area');
			paintAreaFilter();
			paintShelf();
		});

		const orderButtons = pickAll('[data-hd-sort]');
		for (const button of orderButtons) {
			button.addEventListener('click', () => {
				browse.order = button.getAttribute('data-hd-sort');
				for (const other of orderButtons) other.setAttribute('aria-pressed', String(other === button));
				paintShelf();
			});
		}

		page.addEventListener('click', (event) => {
			const hit = (selector) => event.target.closest(selector);
			const opener = hit('[data-hd-open]');
			if (opener) {
				showGuide(opener.getAttribute('data-hd-open'));
			} else if (hit('[data-hd-see-all]')) {
				pick('#hd-library').scrollIntoView({ behavior: stillMotion ? 'auto' : 'smooth', block: 'start' });
			} else if (hit('[data-hd-ask-query]')) {
				openRequest({ subject: browse.text.trim(), fresh: true });
			} else {
				const channel = hit('[data-hd-contact]');
				if (channel) openRequest({ channel: channel.getAttribute('data-hd-contact'), fresh: true });
			}
		});
	}

	/* While the box sits empty it types out real questions, to show plain
     words work. Focus or any typed text stops it, a hidden tab pauses it,
     and reduced motion keeps it off entirely. */
	function typePrompts() {
		if (stillMotion) return;
		const cursor = { prompt: 0, length: 0, direction: 1 };

		function beat() {
			setTimeout(beat, advance());
		}

		/** Moves the placeholder one letter and returns the wait before the next. */
		function advance() {
			if (document.hidden || document.activeElement === box || box.value) {
				box.setAttribute('placeholder', placeholderText);
				cursor.length = 0;
				cursor.direction = 1;
				return 600;
			}
			const prompt = PROMPTS[cursor.prompt];
			cursor.length += cursor.direction;
			box.setAttribute('placeholder', prompt.slice(0, cursor.length));
			if (cursor.direction > 0 && cursor.length >= prompt.length) {
				cursor.direction = -1;
				return 1800;
			}
			if (cursor.direction < 0 && cursor.length <= 0) {
				cursor.direction = 1;
				cursor.prompt = (cursor.prompt + 1) % PROMPTS.length;
				return 400;
			}
			return cursor.direction > 0 ? 55 + Math.random() * 50 : 22;
		}

		setTimeout(beat, 1200);
	}

	/* The guide reader. */

	function loadGuide(slug) {
		const guide = GUIDE_BY_SLUG[slug];
		if (!guide) return;
		reader.guide = guide;
		const area = AREA_BOOK[guide.area];
		const badge = pick('[data-hd-guide-icon]');
		badge.className = `helpdesk-dialog-icon helpdesk-area-${guide.area}`;
		badge.innerHTML = `<i class="bi ${area.glyph}"></i>`;
		pick('[data-hd-guide-title]').textContent = guide.heading;
		pick('[data-hd-guide-meta]').textContent =
			`${area.label} · ${guide.readMins} min read · ${ageText(guide.ageDays)} by ${area.lead}`;
		pick('[data-hd-guide-summary]').textContent = guide.blurb;
		pick('[data-hd-guide-steps]').innerHTML = guide.steps.map((step) => `<li>${htmlSafe(step)}</li>`).join('');
		const neighbors = LIBRARY.filter((other) => other.area === guide.area && other.slug !== guide.slug)
			.sort((a, b) => b.opens - a.opens)
			.slice(0, 3);
		pick('[data-hd-guide-related]').innerHTML = neighbors
			.map(
				(other) =>
					`<li><button data-hd-related="${other.slug}" type="button" class="helpdesk-related"><i aria-hidden="true" class="bi bi-journal-text"></i>${htmlSafe(other.heading)}</button></li>`,
			)
			.join('');
		pick('[data-hd-verdict]').hidden = false;
		pick('[data-hd-verdict-done]').hidden = true;
		const scroller = pick('.modal-body', guideDialog);
		if (scroller) scroller.scrollTop = 0;
	}

	function showGuide(slug) {
		loadGuide(slug);
		if (request.isOpen) {
			/* Opened from a suggestion inside the request dialog: swap dialogs and
         keep the draft, so "No, ask a person" returns to it intact. */
			request.thenRun = () => guideModal.show();
			requestModal.hide();
			return;
		}
		guideModal?.show();
	}

	function bindGuideDialog() {
		guideDialog.addEventListener('click', (event) => {
			const neighbor = event.target.closest('[data-hd-related]');
			if (neighbor) {
				loadGuide(neighbor.getAttribute('data-hd-related'));
				return;
			}
			const answer = event.target.closest('[data-hd-verdict-btn]');
			if (!answer) return;
			if (answer.getAttribute('data-hd-verdict-btn') !== 'yes') {
				const { guide } = reader;
				reader.thenRun = () => openRequest({ area: guide.area, guide });
				guideModal.hide();
				return;
			}
			pick('[data-hd-verdict]').hidden = true;
			pick('[data-hd-verdict-done]').hidden = false;
			pick('[data-hd-verdict-done] .btn', guideDialog)?.focus();
		});

		guideDialog.addEventListener('hidden.bs.modal', () => {
			const next = reader.thenRun;
			reader.thenRun = null;
			next?.();
		});
	}

	/* The request dialog. */

	/* Area tiles, with a "Not sure" tile picked by default so nobody guesses. */
	function paintAreaTiles() {
		const keys = [...Object.keys(AREA_BOOK), 'unsure'];
		pick('[data-hd-area-tiles]').innerHTML = keys
			.map((key) => {
				const area = AREA_BOOK[key] || UNSURE_AREA;
				return `<label class="basalt-choice helpdesk-area-${key}"><input value="${key}" type="radio" name="area"${key === 'unsure' ? ' checked' : ''}><span class="helpdesk-tile-icon"><i aria-hidden="true" class="bi ${area.glyph}"></i></span><span>${htmlSafe(area.label)}</span></label>`;
			})
			.join('');
	}

	function paintSlots() {
		const kept = picked('slot');
		pick('[data-hd-slots]').innerHTML = upcomingSlots(4)
			.map((date) => {
				const stamp = date.toISOString();
				return `<label class="basalt-choice helpdesk-slot"><input value="${stamp}" type="radio" name="slot"${stamp === kept ? ' checked' : ''}><span>${dayFormat.format(date)}</span><span class="basalt-choice-hint">${clockText(date)}</span></label>`;
			})
			.join('');
	}

	/** Value of the checked radio in a group, or an empty string. */
	function picked(group) {
		return pick(`input[name="${group}"]:checked`, requestForm)?.value ?? '';
	}

	/** What the visitor can expect back, for the chosen channel and urgency. */
	function promiseFor(channel, urgency) {
		if (channel === 'ticket') return TICKET_PROMISE[urgency];
		if (channel === 'chat') {
			if (!deskNow.isOpen)
				return `The desk opens in ${spanOf(deskNow.minutesLeft)}. Your message is first in line.`;
			return urgency === 'blocking'
				? 'Jumps the queue. Replies in about 1 min.'
				: `Replies in about ${deskNow.chatWait} min.`;
		}
		const slot = picked('slot');
		if (!slot) return 'Pick a time and the invite goes to your email.';
		return `Call on ${slotText(new Date(slot))} UTC. The invite goes to your email.`;
	}

	function paintRoute() {
		const channel = picked('channel');
		const areaKey = picked('area');
		const area = AREA_BOOK[areaKey];
		const recipient = area ? ownerCard(channel, areaKey, area) : deskCard();
		pick('[data-hd-route]').innerHTML =
			`<div class="helpdesk-route-row">${recipient}</div><p class="helpdesk-route-when"><i aria-hidden="true" class="bi bi-clock"></i><span>${htmlSafe(promiseFor(channel, picked('urgency')))}</span></p>`;
		pick('[data-hd-slots-wrap]').hidden = channel !== 'call';
		const submitWords = { ...SUBMIT_WORDS, chat: deskNow.isOpen ? 'Start the chat' : 'Leave a message' };
		pick('[data-hd-submit-label]').textContent = submitWords[channel];
		pick('[data-hd-channel-hint="chat"]').textContent = waitPhrase();
	}

	function ownerCard(channel, areaKey, area) {
		let cover = '';
		if (channel === 'chat') {
			cover =
				deskNow.isOpen && deskNow.onShift.includes(areaKey)
					? ', on duty now'
					: ', the on-duty engineer covers for them';
		}
		return `<span aria-hidden="true" class="helpdesk-route-avatar helpdesk-area-${areaKey}">${monogram(area.lead)}</span><span class="helpdesk-route-who"><strong>${htmlSafe(area.lead)}</strong><span>Owns ${htmlSafe(area.label)}${cover}</span></span>`;
	}

	function deskCard() {
		return `<span aria-hidden="true" class="helpdesk-route-avatar helpdesk-route-avatar-desk"><i class="bi bi-headset"></i></span><span class="helpdesk-route-who"><strong>${deskNow.isOpen ? 'Whoever is on duty' : 'The morning shift'}</strong><span>They read it first and pass it to the right owner.</span></span>`;
	}

	/* Suggestions beside the form. Any one word can match, so a half-written
     sentence still turns something up. */
	function paintSuggestions() {
		const holder = pick('[data-hd-suggest]');
		const written = `${subjectField.value} ${detailField.value}`.trim();
		if (!written) {
			holder.innerHTML =
				'<li class="helpdesk-suggest-hint">Start describing it and matching guides show up here.</li>';
			return;
		}
		const terms = termsOf(written).filter((term) => term.length > 3);
		const ranked = LIBRARY.filter((guide) => guide.slug !== request.readGuide?.slug)
			.map((guide) => ({ guide, points: suggestionPoints(guide, terms) }))
			.filter((row) => row.points > 0)
			.sort((a, b) => b.points - a.points || b.guide.opens - a.guide.opens);
		/* A guide scoring under half the leader only shares a common word. */
		const ceiling = ranked[0]?.points ?? 0;
		const strong = ranked.filter((row) => row.points * 2 >= ceiling).slice(0, 3);
		if (!strong.length) {
			holder.innerHTML =
				'<li class="helpdesk-suggest-hint">No guide matches that. Send it and a person will pick it up.</li>';
			return;
		}
		holder.innerHTML = strong
			.map(
				({ guide }) =>
					`<li><button data-hd-suggest-open="${guide.slug}" type="button" class="helpdesk-answer helpdesk-answer-compact">${areaBadge(guide)}<span class="helpdesk-answer-text"><span class="helpdesk-answer-title">${htmlSafe(guide.heading)}</span><span class="helpdesk-answer-meta">${guide.readMins} min read</span></span></button></li>`,
			)
			.join('');
	}

	/** Three points for a word in the title, one for a word found elsewhere. */
	function suggestionPoints(guide, terms) {
		const everywhere = plainFold(guideText(guide));
		const title = plainFold(guide.heading);
		let points = 0;
		for (const term of terms) {
			if (!everywhere.includes(term)) continue;
			points += title.includes(term) ? 3 : 1;
		}
		return points;
	}

	function attachGuide(guide) {
		request.readGuide = guide || null;
		pick('[data-hd-context]').hidden = !guide;
		if (guide) pick('[data-hd-context-title]').textContent = guide.heading;
	}

	function clearRequest() {
		requestForm.reset();
		requestForm.classList.remove('was-validated');
		pick('[data-hd-slot-error]').hidden = true;
		attachGuide(null);
	}

	/**
	 * Opens the request dialog. `fresh` throws away the old draft, which is
	 * what the page buttons want; arriving from a guide keeps the draft and
	 * pins that guide to it instead.
	 */
	function openRequest(options = {}) {
		const { fresh, channel, area, subject, guide } = options || {};
		if (fresh) clearRequest();
		if (channel) pick(`input[name="channel"][value="${channel}"]`, requestForm).checked = true;
		if (area) pick(`input[name="area"][value="${area}"]`, requestForm).checked = true;
		if (subject) subjectField.value = subject;
		if (guide) attachGuide(guide);
		paintSlots();
		paintRoute();
		paintSuggestions();
		requestModal?.show();
	}

	function bindRequestDialog() {
		requestDialog.addEventListener('shown.bs.modal', () => {
			request.isOpen = true;
			subjectField.focus();
		});
		requestDialog.addEventListener('show.bs.modal', () => {
			request.isOpen = true;
		});
		requestDialog.addEventListener('hidden.bs.modal', () => {
			request.isOpen = false;
			const next = request.thenRun;
			request.thenRun = null;
			next?.();
		});

		requestForm.addEventListener('change', (event) => {
			if (event.target.name === 'slot') pick('[data-hd-slot-error]').hidden = true;
			window.Basalt.slide(pick('[data-hd-slots-wrap]'), paintRoute);
		});

		for (const field of [subjectField, detailField]) {
			field.addEventListener('input', () => {
				clearTimeout(request.pause);
				request.pause = setTimeout(paintSuggestions, 120);
			});
		}

		requestForm.addEventListener('click', (event) => {
			const suggestion = event.target.closest('[data-hd-suggest-open]');
			if (suggestion) {
				showGuide(suggestion.getAttribute('data-hd-suggest-open'));
				return;
			}
			if (!event.target.closest('[data-hd-context-clear]')) return;
			attachGuide(null);
			paintSuggestions();
			subjectField.focus();
		});

		requestForm.addEventListener('submit', sendRequest);
	}

	function sendRequest(event) {
		event.preventDefault();
		const channel = picked('channel');
		const noSubject = !subjectField.value.trim();
		const noSlot = channel === 'call' && !picked('slot');
		pick('[data-hd-slot-error]').hidden = !noSlot;
		if (noSubject || noSlot) {
			requestForm.classList.add('was-validated');
			if (noSubject) subjectField.focus();
			else pick('input[name="slot"]', requestForm)?.focus();
			return;
		}
		const owner = AREA_BOOK[picked('area')]?.lead ?? 'the on-duty engineer';
		const reference = `SUP-${ticketNumber}`;
		ticketNumber += 1;
		postNote(confirmation(channel, owner, reference), 'done');
		clearRequest();
		requestModal?.hide();
	}

	/* Only the chosen channel's sentence is built: the call wording formats
     the slot, and an empty slot would throw. */
	function confirmation(channel, owner, reference) {
		if (channel === 'call')
			return `Call booked with ${owner} for ${slotText(new Date(picked('slot')))} UTC. Reference ${reference}.`;
		if (channel === 'ticket') return `Ticket ${reference} sent to ${owner}. The reply comes to your email.`;
		if (deskNow.isOpen) return `Chat started with ${owner}. Reference ${reference}.`;
		return `Message left for the morning shift. Reference ${reference}.`;
	}

	/* Recorded walkthroughs and the player dialog. */

	function paintClips() {
		if (!clipGrid) return;
		const shown = CLIPS.filter((clip) => clipTier === 'all' || clip.tier === clipTier);
		if (!shown.length) {
			clipGrid.innerHTML = '<p class="helpdesk-head-sub">No videos at this level yet.</p>';
			return;
		}
		const [lead, ...rest] = shown;
		const others = rest.length
			? `<ul class="helpdesk-videos-list">${rest.map((clip) => `<li>${clipCard(clip, false)}</li>`).join('')}</ul>`
			: '';
		clipGrid.innerHTML = clipCard(lead, true) + others;
	}

	/** One video card; the featured one is larger and carries its blurb. */
	function clipCard(clip, featured) {
		const percent = Math.min(100, Math.round(((watchedSeconds[clip.slug] || 0) / clip.length) * 100));
		const bar = percent ? `<span class="helpdesk-video-seen"><span style="--seen:${percent}%"></span></span>` : '';
		const blurb = featured && clip.blurb ? `<span class="helpdesk-video-desc">${htmlSafe(clip.blurb)}</span>` : '';
		const done =
			percent >= 95 ? '<span class="helpdesk-video-watched"><i class="bi bi-check2"></i> Watched</span>' : '';
		return `<button data-hd-video="${clip.slug}" data-level="${clip.tier}" type="button" class="helpdesk-video${featured ? ' helpdesk-video-featured' : ''}"><span aria-hidden="true" class="helpdesk-video-thumb"><span class="helpdesk-video-play"><i class="bi bi-play-fill"></i></span><span class="helpdesk-video-dur">${timecode(clip.length)}</span>${bar}</span><span class="helpdesk-video-text"><span class="helpdesk-video-title">${htmlSafe(clip.heading)}</span>${blurb}<span class="helpdesk-video-meta"><span class="helpdesk-video-level">${clip.tier}</span><span>${htmlSafe(AREA_BOOK[clip.area].label)}</span><span>${clip.opens.toLocaleString('en-US')} views</span>${done}</span></span></button>`;
	}

	function timecode(seconds) {
		const whole = Math.max(0, Math.round(seconds));
		return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
	}

	/** Index of the last chapter that has started by `at` seconds. */
	function chapterIndex(clip, at) {
		let current = 0;
		for (const [index, chapter] of clip.chapters.entries()) {
			if (at >= chapter.at) current = index;
		}
		return current;
	}

	function paintPlayer() {
		const { clip, at, running } = playback;
		if (!clip) return;
		const chapter = chapterIndex(clip, at);
		const percent = (at / clip.length) * 100;
		const [cursorX, cursorY] = CURSOR_SPOTS[chapter % 5];
		const stage = pick('[data-hd-stage]', clipDialog);
		stage.setAttribute('data-step', String(chapter % 5));
		stage.classList.toggle('is-playing', running);
		stage.style.setProperty('--cx', cursorX);
		stage.style.setProperty('--cy', cursorY);
		pick('[data-hd-fill]', clipDialog).style.setProperty('--p', `${percent.toFixed(2)}%`);
		pick('[data-hd-track]', clipDialog).setAttribute('aria-valuenow', Math.round(percent));
		pick('[data-hd-time]', clipDialog).textContent = `${timecode(at)} / ${timecode(clip.length)}`;
		pick('[data-hd-caption]', clipDialog).textContent = clip.chapters[chapter].line;
		const toggle = pick('[data-hd-play]', clipDialog);
		toggle.innerHTML = `<i class="bi ${running ? 'bi-pause-fill' : 'bi-play-fill'}"></i>`;
		toggle.setAttribute('aria-label', running ? 'Pause' : 'Play');
		for (const [index, item] of pickAll('[data-hd-chapters] li', clipDialog).entries()) {
			item.classList.toggle('is-current', index === chapter);
		}
		watchedSeconds[clip.slug] = Math.max(watchedSeconds[clip.slug] || 0, at);
		const markDone = pick('[data-hd-watched]', clipDialog);
		markDone.disabled = watchedSeconds[clip.slug] >= clip.length * 0.95;
		markDone.innerHTML = `<i class="bi bi-check2-circle me-1"></i>${markDone.disabled ? 'Watched' : 'Mark as watched'}`;
	}

	/* The player advances five clip seconds every quarter second, twenty to
     one, so a whole walkthrough runs in about half a minute. */
	function play(on) {
		playback.running = on;
		clearInterval(playback.ticker);
		if (on) {
			if (playback.at >= playback.clip.length) playback.at = 0;
			playback.ticker = setInterval(() => {
				playback.at = Math.min(playback.clip.length, playback.at + 5 * playback.rate);
				if (playback.at >= playback.clip.length) play(false);
				paintPlayer();
			}, 250);
		}
		paintPlayer();
	}

	function openClip(slug) {
		const clip = CLIPS.find((candidate) => candidate.slug === slug);
		if (!clip || !clipDialog) return;
		playback.clip = clip;
		playback.at = 0;
		pick('[data-hd-video-title]', clipDialog).textContent = clip.heading;
		pick('[data-hd-video-meta]', clipDialog).textContent =
			`${AREA_BOOK[clip.area].label} · ${clip.tier} · ${timecode(clip.length)}`;
		pick('[data-hd-chapters]', clipDialog).innerHTML = clip.chapters
			.map(
				(chapter) =>
					`<li><button data-hd-seek="${chapter.at}" type="button"><span>${htmlSafe(chapter.name)}</span><time>${timecode(chapter.at)}</time></button></li>`,
			)
			.join('');
		pick('[data-hd-marks]', clipDialog).innerHTML = clip.chapters
			.slice(1)
			.map((chapter) => `<span style="--x:${((chapter.at / clip.length) * 100).toFixed(2)}%"></span>`)
			.join('');
		pick('[data-hd-video-guide]', clipDialog).hidden = !GUIDE_BY_SLUG[clip.guideSlug];
		paintPlayer();
		clipModal?.show();
	}

	function bindClips() {
		tierGroup?.addEventListener('click', (event) => {
			const choice = event.target.closest('[data-level]');
			if (!choice) return;
			clipTier = choice.getAttribute('data-level');
			for (const option of pickAll('[data-level]', tierGroup)) {
				option.setAttribute('aria-pressed', option === choice ? 'true' : 'false');
			}
			paintClips();
		});

		if (clipDialog) {
			clipDialog.addEventListener('click', playerClick);
			pick('[data-hd-track]', clipDialog).addEventListener('keydown', (event) => {
				const jump = { ArrowLeft: -10, ArrowRight: 10 }[event.key];
				if (!jump) return;
				event.preventDefault();
				playback.at = Math.max(0, Math.min(playback.clip.length, playback.at + jump));
				paintPlayer();
			});
			clipDialog.addEventListener('hide.bs.modal', () => {
				play(false);
				paintClips();
			});
		}

		clipGrid?.addEventListener('click', (event) => {
			const card = event.target.closest('[data-hd-video]');
			if (card) openClip(card.getAttribute('data-hd-video'));
		});
	}

	/** Every control inside the player dialog, handled from one listener. */
	function playerClick(event) {
		const hit = (selector) => event.target.closest(selector);
		if (hit('[data-hd-play], [data-hd-play-big]')) {
			play(!playback.running);
			return;
		}
		const seek = hit('[data-hd-seek]');
		if (seek) {
			playback.at = Number(seek.getAttribute('data-hd-seek'));
			paintPlayer();
			if (!playback.running) play(true);
			return;
		}
		const track = hit('[data-hd-track]');
		if (track) {
			const bounds = track.getBoundingClientRect();
			const share = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
			playback.at = share * playback.clip.length;
			paintPlayer();
			return;
		}
		if (hit('[data-hd-speed]')) {
			playback.rate = playback.rate === 1 ? 1.5 : 1;
			pick('[data-hd-speed]', clipDialog).textContent = `${playback.rate}×`;
			if (playback.running) play(true);
			return;
		}
		if (hit('[data-hd-watched]')) {
			watchedSeconds[playback.clip.slug] = playback.clip.length;
			paintPlayer();
			postNote('Marked as watched', 'done');
			return;
		}
		if (hit('[data-hd-video-guide]')) readClipGuide();
	}

	/* The written guide opens once the player has fully closed, so the two
     dialogs never overlap. */
	function readClipGuide() {
		const { guideSlug } = playback.clip;
		play(false);
		clipDialog.addEventListener('hidden.bs.modal', () => showGuide(guideSlug), { once: true });
		clipModal?.hide();
	}

	/* Toast notes in the corner. */

	function makeNoteShelf() {
		const shelf = document.createElement('div');
		shelf.className = 'helpdesk-toast-region';
		shelf.setAttribute('aria-live', 'polite');
		document.body.appendChild(shelf);
		return shelf;
	}

	function postNote(message, tone) {
		const note = document.createElement('div');
		note.className = `helpdesk-toast helpdesk-toast-${tone || 'info'}`;
		note.innerHTML = `<i aria-hidden="true" class="bi ${NOTE_ICONS[tone] || NOTE_ICONS.info}"></i><span></span>`;
		pick('span', note).textContent = message;
		noteShelf.appendChild(note);
		setTimeout(() => {
			note.classList.add('is-out');
			setTimeout(() => note.remove(), 250);
		}, 4200);
	}

	/* Text, matching and small formatting helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value).replace(/[&<>"']/g, (char) => entities[char]);
	}

	/** Lowercase with accents stripped, for matching only. */
	function plainFold(value) {
		return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	}

	function termsOf(query) {
		return plainFold(query).split(/\s+/).filter(Boolean);
	}

	function isMatch(text, query) {
		if (kit.matchesQuery) return kit.matchesQuery(text, query);
		const folded = plainFold(text);
		return termsOf(query).every((term) => folded.includes(term));
	}

	function guideText(guide) {
		return `${guide.heading} ${guide.blurb} ${AREA_BOOK[guide.area].label}`;
	}

	/* Ranking: each query word in the title is worth ten, and how often the
     guide is opened settles any tie. */
	function findGuides(query) {
		const terms = termsOf(query);
		const worth = (guide) => {
			const title = plainFold(guide.heading);
			return terms.filter((term) => title.includes(term)).length * 10 + guide.opens / 10000;
		};
		return LIBRARY.filter((guide) => isMatch(guideText(guide), query)).sort((a, b) => worth(b) - worth(a));
	}

	/**
	 * Escapes `text` and wraps every stretch that matches a query word in
	 * <mark>. Positions come from the folded copy of the text.
	 */
	function markTerms(text, query) {
		const terms = termsOf(query);
		if (!terms.length) return htmlSafe(text);
		const folded = plainFold(text);
		const lit = new Set();
		for (const term of terms) {
			for (let at = folded.indexOf(term); at !== -1; at = folded.indexOf(term, at + term.length)) {
				for (let index = at; index < at + term.length; index += 1) lit.add(index);
			}
		}
		let html = '';
		let inside = false;
		for (let index = 0; index < text.length; index += 1) {
			const wanted = lit.has(index);
			if (wanted !== inside) {
				html += wanted ? '<mark>' : '</mark>';
				inside = wanted;
			}
			html += htmlSafe(text[index]);
		}
		return inside ? `${html}</mark>` : html;
	}

	function ageText(days) {
		const recent = { 0: 'Updated today', 1: 'Updated yesterday' };
		if (recent[days]) return recent[days];
		if (days < 7) return `Updated ${days} days ago`;
		if (days < 14) return 'Updated last week';
		return `Updated ${Math.round(days / 7)} weeks ago`;
	}

	function countOf(count, noun) {
		return `${count} ${noun}${count === 1 ? '' : 's'}`;
	}

	function monogram(name) {
		return name
			.split(' ')
			.map((part) => part.charAt(0))
			.join('')
			.slice(0, 2);
	}

	/** Minutes as "45 min", or "3h 5m" once there is at least an hour. */
	function spanOf(minutes) {
		const hours = Math.floor(minutes / 60);
		const rest = minutes % 60;
		return hours ? `${hours}h ${rest}m` : `${rest} min`;
	}

	start();
})();
