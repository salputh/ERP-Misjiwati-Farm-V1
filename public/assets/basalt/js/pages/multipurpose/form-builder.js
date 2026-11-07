/**
 * The Form Builder screen (form-builder.html), mounted on [data-fb-root].
 *
 * Fieldline keeps a handful of customer forms here: a demo booking, an
 * onboarding checklist, a first-week survey and a cancellation form. The
 * list view shows them all; choosing one opens it at #form-<id> in an
 * editor with four tabs:
 *   Build      the palette, the sheet customers will see, and the settings
 *              of whatever is picked on it
 *   Logic      rules that keep a question back until an earlier answer
 *              asks for it
 *   Share      the public link, an embed snippet, and what happens on send
 *   Responses  totals, a searchable table, one response at a time in a panel
 *
 * Every byte of content comes from SAMPLE, and every read or write passes
 * through `backend`; a real service replaces those two and nothing else.
 * Edits reach backend.putForm half a second after the last keystroke.
 *
 * Borrowed from basalt.js: toasts with undo, drawers, typed-confirm dialogs,
 * tabs, segmented controls, tag inputs, steppers, copy and busy buttons, the
 * sortable list, pagination, tooltips, skeletons and empty states.
 */
(() => {
	'use strict';

	/* A button at a limit says why in its tooltip instead of going dead. */
	const atLimit = (button, reason) => (window.Basalt?.limit || ((b, r) => (b.disabled = Boolean(r))))(button, reason);

	const host = pick('[data-fb-root]');
	if (!host) return;

	/* The sample workspace. Swap it for your own records, or empty the forms
     and let backend.fetchForms ask a server. Field kinds are the keys of
     FIELD_KINDS further down. */
	const SAMPLE = {
		brand: {
			name: 'Fieldline',
			linkRoot: 'https://forms.fieldline.example.com/',
			embedSrc: 'https://forms.fieldline.example.com/embed.js',
		},
		/* A frozen "now", so the invented response dates read the same on every visit. */
		now: '2026-09-30T15:00:00',
		forms: [
			{
				id: 'demo',
				name: 'Get a demo',
				icon: 'bi-calendar-check',
				status: 'live',
				edited: '2026-09-24T11:20:00',
				title: 'See Fieldline with your own visits',
				intro: 'Tell us a little about your team and we will set up a 30-minute walkthrough.',
				submitLabel: 'Book my demo',
				thanks: 'Thanks! Someone from sales will email you a time within one working day.',
				notify: ['sales@example.com', 'elaine@example.com'],
				limit: null,
				closeOn: '',
				fields: [
					{
						id: 'd1',
						type: 'text',
						label: 'Company name',
						placeholder: 'e.g. Lakeside Dog Walking Co',
						required: true,
						width: 'half',
					},
					{ id: 'd2', type: 'text', label: 'Your name', required: true, width: 'half' },
					{
						id: 'd3',
						type: 'email',
						label: 'Work email',
						placeholder: 'you@yourcompany.com',
						required: true,
						width: 'half',
					},
					{
						id: 'd4',
						type: 'phone',
						label: 'Phone',
						help: 'Only if you would rather we call.',
						width: 'half',
					},
					{
						id: 'd5',
						type: 'select',
						label: 'What industry are you in?',
						required: true,
						options: ['Pet care', 'Home care', 'Photography', 'Cleaning', 'Something else'],
					},
					{ id: 'd6', type: 'text', label: 'Tell us what you do', placeholder: 'e.g. property care' },
					{
						id: 'd7',
						type: 'number',
						label: 'How many cars on the road?',
						help: 'A rough guess is fine.',
						min: 1,
						max: 500,
						width: 'half',
					},
					{
						id: 'd8',
						type: 'radio',
						label: 'How do you schedule visits today?',
						required: true,
						options: ['Paper and phone', 'Spreadsheets', 'Another app', 'Not sure'],
					},
					{ id: 'd9', type: 'text', label: 'Which app?', placeholder: 'The one you use now' },
					{
						id: 'd10',
						type: 'checkbox',
						label: 'What should we fix first?',
						options: ['Scheduling', 'Booking', 'Quotes', 'Invoicing', 'Timesheets'],
					},
					{
						id: 'd11',
						type: 'textarea',
						label: 'Anything else we should know?',
						placeholder: 'Team size, service area, when you want to start',
					},
					{ id: 'd12', type: 'consent', label: 'Send me product news now and then' },
				],
				rules: [
					{ id: 'dr1', show: 'd6', when: 'd5', op: 'is', value: 'Something else' },
					{ id: 'dr2', show: 'd9', when: 'd8', op: 'is', value: 'Another app' },
				],
			},
			{
				id: 'onboarding',
				name: 'Onboarding checklist',
				icon: 'bi-list-check',
				status: 'live',
				edited: '2026-09-18T09:05:00',
				title: 'Get your account ready',
				intro: 'A few details so your onboarding call starts with your visits, not a blank screen.',
				submitLabel: 'Send checklist',
				thanks: 'Thanks. Your onboarding lead will be in touch before the call.',
				notify: ['onboarding@example.com'],
				limit: null,
				closeOn: '',
				fields: [
					{ id: 'o1', type: 'text', label: 'Company name', required: true, width: 'half' },
					{ id: 'o2', type: 'text', label: 'Main contact', required: true, width: 'half' },
					{ id: 'o3', type: 'email', label: 'Email', required: true },
					{
						id: 'o4',
						type: 'select',
						label: 'Which plan are you on?',
						required: true,
						options: ['Basic', 'Pro', 'Max'],
					},
					{
						id: 'o5',
						type: 'number',
						label: 'How many on-site staff?',
						required: true,
						min: 1,
						max: 500,
						width: 'half',
					},
					{
						id: 'o6',
						type: 'checkbox',
						label: 'What should we import?',
						help: 'Leave it blank and we will ask on the call.',
						options: ['Customers', 'Price list', 'Open bookings', 'Team members', 'Service areas'],
					},
					{
						id: 'o7',
						type: 'radio',
						label: 'Will your staff use the mobile app?',
						options: ['Yes', 'Not yet'],
					},
					{
						id: 'o8',
						type: 'select',
						label: 'Which phones do they use?',
						required: true,
						options: ['iPhone', 'Android', 'A mix'],
					},
					{ id: 'o9', type: 'date', label: 'Go-live date', width: 'half' },
				],
				rules: [{ id: 'or1', show: 'o8', when: 'o7', op: 'is', value: 'Yes' }],
			},
			{
				id: 'firstweek',
				name: 'First week check-in',
				icon: 'bi-emoji-smile',
				status: 'live',
				edited: '2026-09-02T16:40:00',
				title: 'How did your first week go?',
				intro: 'Five quick questions. Your answers shape what we build next.',
				submitLabel: 'Send answers',
				thanks: 'Thank you. Someone on the product team reads every answer.',
				notify: [],
				limit: null,
				closeOn: '2026-10-31',
				fields: [
					{ id: 'v1', type: 'rating', label: 'How was your first week with Fieldline?', required: true },
					{
						id: 'v2',
						type: 'textarea',
						label: 'Sorry to hear it. What got in the way?',
						help: 'We read every one of these.',
					},
					{
						id: 'v3',
						type: 'radio',
						label: 'Who uses Fieldline most?',
						options: ['Office staff', 'Schedulers', 'On-site staff', 'The owner', 'All of us'],
					},
					{
						id: 'v4',
						type: 'checkbox',
						label: 'What would help most next?',
						options: [
							'Travel planning',
							'Text reminders',
							'Offline mode',
							'Accounting sync',
							'Better reports',
						],
					},
					{ id: 'v5', type: 'email', label: 'Email, if you would like a reply' },
					{ id: 'v6', type: 'consent', label: 'You can quote my answers on your site' },
				],
				rules: [
					{ id: 'vr1', show: 'v2', when: 'v1', op: 'atmost', value: '2' },
					{ id: 'vr2', show: 'v5', when: 'v1', op: 'atmost', value: '3' },
				],
			},
			{
				id: 'cancel',
				name: 'Cancel your plan',
				icon: 'bi-x-circle',
				status: 'draft',
				edited: '2026-09-29T17:10:00',
				title: 'Before you cancel',
				intro: 'Your plan runs to the end of the billing month. If something is not working, we would like to fix it.',
				submitLabel: 'Cancel my plan',
				thanks: 'Your plan is canceled. You can still sign in until the end of the month.',
				notify: ['success@example.com'],
				limit: null,
				closeOn: '',
				fields: [
					{
						id: 'p1',
						type: 'select',
						label: 'Why are you canceling?',
						required: true,
						options: [
							'Too expensive',
							'Missing a feature',
							'Switching tools',
							'Business closed',
							'Something else',
						],
					},
					{
						id: 'p2',
						type: 'select',
						label: 'When should it end?',
						required: true,
						options: ['End of this month', 'Right away', 'Not sure'],
					},
					{ id: 'p3', type: 'textarea', label: 'Which feature was missing?' },
					/* Unfinished on purpose, so Publish has something to point at. */
					{ id: 'p4', type: 'radio', label: 'Would the Basic plan help?', options: ['Yes'] },
				],
				rules: [{ id: 'pr1', show: 'p3', when: 'p1', op: 'is', value: 'Missing a feature' }],
			},
		],
		/* How many responses each form gets invented for it. */
		volumes: { demo: 46, onboarding: 31, firstweek: 88, cancel: 0 },
		crowd: {
			given: [
				'Ava',
				'Ben',
				'Mallory',
				'Dev',
				'Erica',
				'Fred',
				'Courtney',
				'Hank',
				'Jean',
				'Jonah',
				'Kemi',
				'Chad',
				'Mina',
				'Silas',
				'Olu',
				'Connie',
				'Quinn',
				'Robyn',
				'Rory',
				'Tara',
				'Umar',
				'Vera',
				'Wes',
				'Yara',
				'Jill',
				'Marek',
				'Abby',
				'Lance',
			],
			family: [
				'Aldridge',
				'Brennan',
				'Castro',
				'Dunn',
				'Evans',
				'Fischer',
				'Odom',
				'Hale',
				'Ives',
				'Jensen',
				'Kaur',
				'Leach',
				'McCall',
				'Freeman',
				'Nugent',
				'Price',
				'Quist',
				'Rhodes',
				'Sexton',
				'Pemberton',
				'Usman',
				'Vick',
				'Walsh',
				'Young',
			],
			businesses: [
				'Lakeside Dog Walking Co',
				'Brightline Photography',
				'Oakhaven Studio',
				'Larchwood Optics',
				'Highpoint Field Support',
				'Northgate Studios',
				'Clearwater Pools',
				'Redwood Vision AI',
				'Moorings Logistics',
				'Oakridge House Movers',
				'Bluepeak Movers',
				'Evergreen Lawn & Tree',
				'Ironside Moving Co.',
				'Westfield Wedding Photos',
				'Keystone Labs',
				'Sparrow Home Services',
			],
		},
	};

	/* The first pattern a company name matches decides its industry, so an
     invented booking never contradicts itself. */
	const SECTOR_HINTS = [
		[/Pet|Dog/, 'Pet care'],
		[/Photo|Studios/, 'Photography'],
		[/Cleaning/, 'Cleaning'],
		[/Pool|Property/, 'Something else'],
		[/Care/, 'Home care'],
	];
	const TRADE_WORDS = {
		Pool: 'Pool care',
		Property: 'Property care',
		Movers: 'House moves',
		Removals: 'Removals',
		Lawn: 'Lawn and tree care',
		Home: 'Home services',
	};

	/* Invented answers per sample form, given one invented person and the
     seeded dice. The call order on the dice is what keeps the sample
     stable, so read these top to bottom before changing them. Remove the
     whole object once responses come from a server. */
	const INVENTED_ANSWERS = {
		demo(person, dice) {
			const business = person.company;
			const sector = (SECTOR_HINTS.find(([pattern]) => pattern.test(business)) || [null, 'Something else'])[1];
			const scheduling = dice.pick([
				'Paper and phone',
				'Spreadsheets',
				'Spreadsheets',
				'Another app',
				'Another app',
				'Not sure',
			]);
			return {
				d1: business,
				d2: person.name,
				d3: person.email,
				d4: dice.chance(0.5) ? person.phone : '',
				d5: sector,
				d6:
					sector === 'Something else'
						? Object.entries(TRADE_WORDS).find(([word]) => business.includes(word))?.[1] || 'Home services'
						: '',
				d7: dice.chance(0.8) ? String(dice.pick([2, 3, 4, 6, 8, 12, 15, 24, 40])) : '',
				d8: scheduling,
				d9:
					scheduling === 'Another app'
						? dice.pick(['Google Calendar', 'A shared inbox', 'An old desktop app', 'Our own system'])
						: '',
				d10: dice.some(['Scheduling', 'Booking', 'Quotes', 'Invoicing', 'Timesheets'], 1, 3),
				d11: dice.chance(0.6)
					? dice.pick([
							'Two offices, one shared diary.',
							'Want to switch before our busy season.',
							'Can the staff see visit photos offline?',
							'Most bookings are repeat visits.',
							'We need on-call rosters too.',
							'Opening a second office in spring.',
						])
					: '',
				d12: dice.chance(0.55),
			};
		},
		onboarding(person, dice) {
			const usesApp = dice.chance(0.7) ? 'Yes' : 'Not yet';
			return {
				o1: person.company,
				o2: person.name,
				o3: person.email,
				o4: dice.pick(['Basic', 'Pro', 'Pro', 'Pro', 'Max']),
				o5: String(dice.pick([3, 4, 6, 8, 10, 14, 20, 35])),
				o6: dice.some(['Customers', 'Price list', 'Open bookings', 'Team members', 'Service areas'], 0, 3),
				o7: usesApp,
				o8: usesApp === 'Yes' ? dice.pick(['iPhone', 'Android', 'A mix', 'A mix']) : '',
				o9: dice.chance(0.6) ? `2026-10-${String(dice.int(1, 20)).padStart(2, '0')}` : '',
			};
		},
		firstweek(person, dice) {
			const stars = dice.pick([5, 5, 5, 4, 4, 4, 4, 3, 3, 2, 1]);
			return {
				v1: String(stars),
				v2:
					stars <= 2
						? dice.pick([
								'Importing customers took ages.',
								'The app logged our staff out.',
								'Hard to move a visit to another day.',
								'Invoices did not sync.',
							])
						: '',
				v3: dice.pick(['Office staff', 'Schedulers', 'Schedulers', 'On-site staff', 'The owner', 'All of us']),
				v4: dice.some(
					['Travel planning', 'Text reminders', 'Offline mode', 'Accounting sync', 'Better reports'],
					0,
					2,
				),
				v5: stars <= 3 && dice.chance(0.6) ? person.email : '',
				v6: dice.chance(0.4),
			};
		},
	};

	/* The service layer. Each method resolves after a short pause and answers
     from `vault`; give each one a fetch() to talk to a real API instead. */
	const vault = { forms: [], responses: [] };
	const backend = {
		/* GET /api/forms */
		fetchForms() {
			return settle(copyOf(vault.forms), 450);
		},
		/* PUT /api/forms/:id, sent shortly after each edit. */
		putForm(record) {
			const slot = vault.forms.findIndex((kept) => kept.id === record.id);
			if (slot < 0) vault.forms.push(copyOf(record));
			else vault.forms[slot] = copyOf(record);
			return settle(true, 350);
		},
		/* POST /api/forms/:id/publish moves a draft to live; a server may refuse. */
		makeLive(record) {
			return settle({ ...copyOf(record), status: 'live' }, 700);
		},
		/* DELETE /api/forms/:id, responses included. */
		removeForm(formId) {
			vault.forms = vault.forms.filter((kept) => kept.id !== formId);
			return settle(true, 200);
		},
		/* GET /api/forms/:id/responses */
		fetchResponses(formId) {
			return settle(copyOf(vault.responses.filter((entry) => entry.formId === formId)), 380);
		},
		/* POST /api/forms/:id/responses, which is what the public form calls. */
		addResponse(formId, answers, isTest) {
			const entry = {
				id: `r${Date.now().toString(36)}`,
				formId,
				at: stamp(),
				answers: copyOf(answers),
				read: false,
				test: !!isTest,
			};
			vault.responses.unshift(entry);
			return settle(copyOf(entry), 500);
		},
		/* PATCH /api/responses/:id flips read and unread. */
		patchResponse(responseId, changes) {
			const entry = vault.responses.find((kept) => kept.id === responseId);
			if (entry) Object.assign(entry, changes);
			return settle(true, 120);
		},
		/* DELETE /api/responses/:id */
		removeResponse(responseId) {
			vault.responses = vault.responses.filter((kept) => kept.id !== responseId);
			return settle(true, 120);
		},
		/* Brings a deleted response back when its toast's Undo is pressed. */
		putBackResponse(entry) {
			vault.responses.push(copyOf(entry));
			return settle(true, 120);
		},
	};

	/* Everything a field can be. `shelf` is its palette group and `prompt`
     the wording a fresh one starts with. Key order is palette order. */
	const FIELD_KINDS = {
		text: { title: 'Short answer', glyph: 'bi-input-cursor-text', shelf: 'Text', prompt: 'New question' },
		textarea: { title: 'Paragraph', glyph: 'bi-textarea-t', shelf: 'Text', prompt: 'Tell us more' },
		email: { title: 'Email', glyph: 'bi-envelope', shelf: 'Text', prompt: 'Email' },
		phone: { title: 'Phone', glyph: 'bi-telephone', shelf: 'Text', prompt: 'Phone' },
		number: { title: 'Number', glyph: 'bi-123', shelf: 'Text', prompt: 'How many?' },
		select: {
			title: 'Dropdown',
			glyph: 'bi-menu-button-wide',
			shelf: 'Choices',
			prompt: 'Pick one',
			choices: ['First choice', 'Second choice'],
		},
		radio: {
			title: 'One choice',
			glyph: 'bi-ui-radios',
			shelf: 'Choices',
			prompt: 'Choose one',
			choices: ['Yes', 'No'],
		},
		checkbox: {
			title: 'Checkboxes',
			glyph: 'bi-ui-checks',
			shelf: 'Choices',
			prompt: 'Check all that apply',
			choices: ['First choice', 'Second choice'],
		},
		rating: { title: 'Rating', glyph: 'bi-star', shelf: 'Choices', prompt: 'How would you rate it?' },
		date: { title: 'Date', glyph: 'bi-calendar-event', shelf: 'Other', prompt: 'Date' },
		consent: {
			title: 'Consent box',
			glyph: 'bi-shield-check',
			shelf: 'Other',
			prompt: 'I agree to be contacted about this',
		},
		heading: { title: 'Section heading', glyph: 'bi-type-h2', shelf: 'Other', prompt: 'About your order' },
	};
	const CHOICE_KINDS = ['select', 'radio', 'checkbox'];
	const PAIRABLE_KINDS = ['text', 'email', 'phone', 'number', 'select', 'date'];

	/* Starting points offered by the New form dialog. `copies` names a sample
     form whose questions and rules come along. */
	const STARTERS = [
		{ key: 'blank', title: 'Blank', glyph: 'bi-file-earmark', blurb: 'Start from nothing' },
		{
			key: 'feature',
			title: 'Feature request',
			glyph: 'bi-lightbulb',
			blurb: 'Idea, area, impact',
			questions: [
				{ type: 'text', label: 'Your name', required: true, width: 'half' },
				{ type: 'email', label: 'Email', required: true, width: 'half' },
				{
					type: 'select',
					label: 'Which part of Fieldline?',
					options: ['Scheduling', 'Booking', 'Mobile app', 'Invoicing', 'Reports'],
				},
				{ type: 'radio', label: 'How much would it help?', options: ['A little', 'A lot', 'We need it'] },
				{ type: 'textarea', label: 'Describe the idea', required: true },
			],
		},
		{
			key: 'webinar',
			title: 'Training webinar',
			glyph: 'bi-calendar-heart',
			blurb: 'Sign-ups with a limit',
			cap: 30,
			questions: [
				{ type: 'text', label: 'Your name', required: true, width: 'half' },
				{ type: 'email', label: 'Email', required: true, width: 'half' },
				{ type: 'number', label: 'How many from your team?', required: true, min: 1, max: 4 },
				{
					type: 'radio',
					label: 'Which session?',
					required: true,
					options: ['Tuesday 10:00 am', 'Thursday 3:00 pm', 'Either'],
				},
				{ type: 'text', label: 'Anything we should cover?' },
			],
		},
		{
			key: 'demo',
			title: 'Get a demo',
			glyph: 'bi-calendar-check',
			blurb: 'Industry, size, current tool',
			copies: 'demo',
		},
		{
			key: 'onboarding',
			title: 'Onboarding checklist',
			glyph: 'bi-list-check',
			blurb: 'Plan, imports, go-live',
			copies: 'onboarding',
		},
		{
			key: 'firstweek',
			title: 'Customer survey',
			glyph: 'bi-emoji-smile',
			blurb: 'Rating and follow-ups',
			copies: 'firstweek',
		},
	];

	/* Conditions a rule can test. `wants` says what the rule's value must be:
     one of the question's choices, a number, or nothing at all. */
	const CONDITIONS = {
		is: { phrase: 'is', wants: 'option', test: (answer, target) => answer === target },
		isnot: { phrase: 'is not', wants: 'option', test: (answer, target) => !isEmpty(answer) && answer !== target },
		includes: {
			phrase: 'includes',
			wants: 'option',
			test: (answer, target) => Array.isArray(answer) && answer.includes(target),
		},
		excludes: {
			phrase: 'does not include',
			wants: 'option',
			test: (answer, target) => !Array.isArray(answer) || !answer.includes(target),
		},
		atleast: {
			phrase: 'is at least',
			wants: 'number',
			test: (answer, target) => !isEmpty(answer) && Number(answer) >= Number(target),
		},
		atmost: {
			phrase: 'is at most',
			wants: 'number',
			test: (answer, target) => !isEmpty(answer) && Number(answer) <= Number(target),
		},
		ticked: { phrase: 'is checked', wants: null, test: (answer) => answer === true },
		unticked: { phrase: 'is not checked', wants: null, test: (answer) => answer !== true },
		filled: { phrase: 'is filled in', wants: null, test: (answer) => !isEmpty(answer) },
		empty: { phrase: 'is left empty', wants: null, test: (answer) => isEmpty(answer) },
	};
	/* Which conditions make sense for each kind of question. */
	const CONDITIONS_BY_KIND = {
		select: ['is', 'isnot'],
		radio: ['is', 'isnot'],
		checkbox: ['includes', 'excludes'],
		number: ['atleast', 'atmost'],
		rating: ['atleast', 'atmost'],
		consent: ['ticked', 'unticked'],
		heading: [],
	};

	const LIFECYCLE = {
		live: { word: 'Live', tone: 'success' },
		draft: { word: 'Draft', tone: '' },
		closed: { word: 'Closed', tone: 'warning' },
	};
	const STATE_LINES = { live: 'Taking responses', draft: 'Not shared yet', closed: 'Not taking responses' };
	/* The header's main button always offers the next sensible step. */
	const NEXT_STEP = {
		draft: { text: 'Publish', glyph: 'bi-send' },
		live: { text: 'Share', glyph: 'bi-link-45deg' },
		closed: { text: 'Reopen', glyph: 'bi-play-circle' },
	};
	const NUMBER_WORDS = [
		'No',
		'One',
		'Two',
		'Three',
		'Four',
		'Five',
		'Six',
		'Seven',
		'Eight',
		'Nine',
		'Ten',
		'Eleven',
		'Twelve',
	];

	/* How each kind of question is drawn; kinds not listed get a typed <input>. */
	const QUESTION_BUILDERS = {
		heading: (field, parts) =>
			`<div class="fb-q fb-q-as-heading"><p class="fb-q-heading">${parts.label}</p>${field.help ? `<p class="fb-q-help">${htmlSafe(field.help)}</p>` : ''}</div>`,
		textarea: (field, parts) =>
			labeled(
				parts,
				`<textarea id="${parts.id}" name="${field.id}" rows="3"${parts.hint}${parts.must}${parts.describedBy} class="form-control">${htmlSafe(parts.value)}</textarea>`,
			),
		select: (field, parts) => {
			const options = (field.options || [])
				.map((choice) => `<option${choice === parts.value ? ' selected' : ''}>${htmlSafe(choice)}</option>`)
				.join('');
			return labeled(
				parts,
				`<select id="${parts.id}" name="${field.id}"${parts.must}${parts.describedBy} class="form-select"><option value="">Choose…</option>${options}</select>`,
			);
		},
		radio: choiceGroup,
		checkbox: choiceGroup,
		rating: (field, parts) => {
			const stars = [1, 2, 3, 4, 5]
				.map(
					(score) =>
						`<input id="${parts.id}-${score}" type="radio" name="${field.id}" value="${score}"${String(score) === String(parts.value) ? ' checked' : ''} class="visually-hidden fb-star-input"><label for="${parts.id}-${score}" class="fb-star"><i aria-hidden="true" class="bi bi-star-fill"></i><span class="visually-hidden">${count(score, 'star')}</span></label>`,
				)
				.join('');
			return grouped(parts, `<div class="fb-stars">${stars}</div>`);
		},
		consent: (field, parts) =>
			`<div class="fb-q"><div class="form-check"><input id="${parts.id}" type="checkbox" name="${field.id}"${parts.value === true ? ' checked' : ''}${parts.must}${parts.describedBy} class="form-check-input"><label for="${parts.id}" class="form-check-label">${parts.label}${parts.star}</label></div>${parts.help}${parts.error}</div>`,
	};

	/* Input type and extra attributes per kind; anything unlisted is plain text. */
	const INPUT_SHAPES = {
		email: { type: 'email', extra: () => ' autocomplete="email"' },
		phone: { type: 'tel', extra: () => ' autocomplete="tel"' },
		number: {
			type: 'number',
			extra: (field) => ` inputmode="numeric" min="${field.min ?? ''}" max="${field.max ?? ''}"`,
		},
		date: { type: 'date', extra: () => '' },
	};

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const CLOCK = new Date(SAMPLE.now);
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DAY_MS = 86400000;

	/* What the page is showing and holding right now. */
	const session = {
		forms: [],
		open: null /* the form in the editor */,
		picked: null /* 'form', a field id, or null */,
		stageMode: 'edit' /* 'edit' or 'preview' */,
		inbox: {} /* form id to its responses */,
		tallies: {} /* form id to { total, unread } for the list */,
	};
	/* The Responses table: its search, filter, page and the open row. */
	const table = { query: '', show: 'all', page: 1, perPage: 10, rows: [], cursor: -1 };
	const fetched = new Set();
	const ui = gatherParts();

	let shownView = '';
	let booted = false;
	/* full: palette, sheet and settings side by side; split: settings move to
     a side panel; compact: the palette moves to one as well. */
	let fit = '';
	let syncing = false;
	let pendingSave = 0;
	let draggedKind = null;
	let pagination = null;
	let typingPause = 0;
	let nameEdited = false;
	let blockerNotes = [];
	let formToDelete = null;
	let serial = 0;
	let tick = 0;

	start();

	/** Wires every control, fills the static parts, then loads the forms. */
	function start() {
		wireList();
		wirePalette();
		wireSheet();
		wireSettings();
		wireLayout();
		wireStage();
		wireTryIt();
		wireLogic();
		wireShare();
		wireHeader();
		wireNewForm();
		wireResponses();
		wireRecordPanel();
		wireRouting();

		vault.forms = copyOf(SAMPLE.forms);
		vault.responses = inventResponses();
		drawPalette();
		drawStarters();
		fitLayout();
		window.Basalt.sortable?.(ui.fields);

		/* The list needs counts for every form, so all responses arrive up front
       and the Responses tab reads them from memory afterwards. */
		const everyInbox = Promise.all(
			vault.forms.map((record) => backend.fetchResponses(record.id).then((entries) => [record.id, entries])),
		);
		Promise.all([backend.fetchForms(), everyInbox]).then(([records, inboxes]) => {
			session.forms = records;
			for (const [formId, entries] of inboxes) {
				fetched.add(formId);
				session.inbox[formId] = entries;
				tally(formId);
			}
			booted = true;
			followHash({ quiet: true });
		});
	}

	/** Looks up every element the script talks to, once. */
	function gatherParts() {
		return {
			forms: pick('[data-fb-forms]'),
			formsHint: pick('[data-fb-forms-hint]'),
			list: pick('[data-fb-list]'),
			listTitle: pick('#fb-list-title'),
			none: pick('[data-fb-none]'),
			editor: pick('[data-fb-editor]'),
			crumbName: pick('[data-fb-crumb-name]'),
			switcher: pick('[data-fb-switch]'),
			work: pick('[data-fb-work]'),
			workIcon: pick('[data-fb-work-icon]'),
			title: pick('[data-fb-name]'),
			titleRow: pick('[data-fb-name-row]'),
			renameForm: pick('[data-fb-rename-form]'),
			renameField: pick('#fb-rename-input'),
			renameError: pick('[data-fb-rename-error]'),
			badge: pick('[data-fb-status]'),
			meta: pick('[data-fb-meta]'),
			saved: pick('[data-fb-save]'),
			savedText: pick('[data-fb-save-text]'),
			primary: pick('[data-fb-main]'),
			primaryText: pick('[data-fb-main-label]'),
			primaryGlyph: pick('[data-fb-main-icon]'),
			pauseText: pick('[data-fb-toggle-label]'),
			pauseGlyph: pick('[data-fb-toggle-icon]'),
			blockers: pick('[data-fb-problems]'),
			blockerList: pick('[data-fb-problems-list]'),
			blockerTitle: pick('[data-fb-problems-title]'),
			build: pick('[data-fb-build]'),
			palette: pick('[data-fb-palette]'),
			paletteHome: pick('[data-fb-palette-home]'),
			palettePanel: pick('[data-fb-palette-panel]'),
			addPanel: pick('#fb-add-drawer'),
			addPanelBody: pick('[data-fb-add-body]'),
			stage: pick('[data-fb-stage]'),
			stageNote: pick('[data-fb-stage-note]'),
			sheet: pick('[data-fb-sheet]'),
			sheetHead: pick('[data-fb-select-form]'),
			sheetTitle: pick('[data-fb-sheet-title]'),
			sheetIntro: pick('[data-fb-sheet-intro]'),
			sheetButton: pick('[data-fb-sheet-submit]'),
			fields: pick('[data-fb-fields]'),
			dropHint: pick('[data-fb-drop-empty]'),
			tryPane: pick('[data-fb-try-pane]'),
			live: pick('[data-fb-live]'),
			settings: pick('[data-fb-settings]'),
			settingsHome: pick('[data-fb-settings-home]'),
			settingsPanel: pick('#fb-field-drawer'),
			settingsPanelBody: pick('[data-fb-drawer-body]'),
			choices: pick('[data-fb-options]'),
			rules: pick('[data-fb-rules]'),
			rulesEmpty: pick('[data-fb-rules-empty]'),
			link: pick('#fb-share-link'),
			accepting: pick('#fb-share-open'),
			shareNote: pick('[data-fb-share-note]'),
			embed: pick('[data-fb-embed]'),
			recipients: pick('[data-fb-notify]'),
			capOn: pick('#fb-limit-on'),
			cap: pick('#fb-limit'),
			capBox: pick('[data-fb-limit-box]'),
			inboxLoading: pick('[data-fb-resp-loading]'),
			inboxEmpty: pick('[data-fb-resp-empty]'),
			inboxBody: pick('[data-fb-resp-body]'),
			summary: pick('[data-fb-summary]'),
			tableHead: pick('[data-fb-thead]'),
			tableRows: pick('[data-fb-rows]'),
			noMatch: pick('[data-fb-resp-nomatch]'),
			pager: pick('[data-fb-pager]'),
			range: pick('[data-fb-range]'),
			pages: pick('[data-fb-pages]'),
			search: pick('[data-fb-resp-search]'),
			recordPanel: pick('#fb-resp-drawer'),
			newDialog: pick('#fb-new-form'),
			newName: pick('#fb-new-name'),
			deleteDialog: pick('#fb-delete-form'),
		};
	}

	/* The list of forms, the switcher and the hero figures. */

	function wireList() {
		ui.forms.addEventListener('click', (event) => {
			const inboxButton = event.target.closest('[data-fb-row-resp]');
			if (inboxButton) {
				visit(inboxButton.getAttribute('data-fb-row-resp'));
				showTab('responses');
				return;
			}
			/* The name is a real link with its own address; the rest of the row
         opens the same form by script. */
			if (event.target.closest('a')) return;
			const row = event.target.closest('[data-fb-open-form]');
			if (row) visit(row.getAttribute('data-fb-open-form'));
		});
	}

	function drawFormList() {
		const total = session.forms.length;
		ui.forms.removeAttribute('aria-busy');
		ui.forms.innerHTML = session.forms.map(formRow).join('');
		const liveCount = session.forms.filter((record) => record.status === 'live').length;
		ui.formsHint.textContent = total
			? `${spelled(total)} ${total === 1 ? 'form' : 'forms'}, ${spelled(liveCount).toLowerCase()} taking responses. Choose one to open it.`
			: '';
		ui.switcher.innerHTML = session.forms.map(switcherItem).join('');
		if (current()) ui.crumbName.textContent = current().name;
		if (shownView === 'list') {
			ui.list.hidden = !total;
			ui.none.hidden = !!total;
		}
		drawHeroFigures();
	}

	function formRow(record, position) {
		const counts = session.tallies[record.id] || { total: 0, unread: 0 };
		const safeId = htmlSafe(record.id);
		const unreadCell = counts.unread
			? `<span class="fb-unread">${counts.unread}</span>`
			: '<span class="fb-quiet">0</span>';
		const nameCell = `<div style="--fb-tone: var(--basalt-series-${(position % 8) + 1})" class="fb-fname"><span aria-hidden="true" class="fb-fname-icon"><i class="bi ${htmlSafe(record.icon || 'bi-ui-checks-grid')}"></i></span><span class="fb-fname-text"><a href="#form-${encodeURIComponent(record.id)}" class="fb-fname-name">${htmlSafe(record.name)}</a><span class="fb-fname-sub">Edited ${editedOn(record.edited)}</span><span class="fb-fname-sub fb-fname-counts">${count(counts.total, 'response')}${counts.unread ? `, ${counts.unread} unread` : ''}</span></span></div>`;
		return `<tr data-fb-open-form="${safeId}" class="fb-frow"><td>${nameCell}</td><td class="fb-col-status">${stateChip(record.status)}</td><td class="fb-num fb-col-count">${counts.total}</td><td class="fb-num fb-col-count">${unreadCell}</td><td class="fb-col-act"><button data-fb-row-resp="${safeId}" aria-label="Responses to ${htmlSafe(record.name)}" type="button" class="btn btn-sm btn-outline-secondary">Responses</button></td></tr>`;
	}

	function switcherItem(record) {
		const isCurrentForm = current()?.id === record.id;
		return `<li><a href="#form-${encodeURIComponent(record.id)}"${isCurrentForm ? ' aria-current="page"' : ''} class="dropdown-item${isCurrentForm ? ' active' : ''}"><i aria-hidden="true" class="bi ${htmlSafe(record.icon || 'bi-ui-checks-grid')}"></i>${htmlSafe(record.name)}</a></li>`;
	}

	function drawHeroFigures() {
		const everything = Object.values(session.inbox).flat();
		const unread = Object.values(session.tallies).reduce((sum, counts) => sum + counts.unread, 0);
		pick('[data-fb-fig="live"]').textContent = session.forms.filter((record) => record.status === 'live').length;
		pick('[data-fb-fig="month"]').textContent = everything.filter(
			(entry) => ageInDays(new Date(entry.at)) < 30,
		).length;
		pick('[data-fb-fig="unread"]').textContent = unread;
	}

	function stateChip(status) {
		const look = LIFECYCLE[status] || LIFECYCLE.draft;
		return `<span class="${badgeClasses(look)}">${look.word}</span>`;
	}

	function badgeClasses(look) {
		return `basalt-status basalt-status-dot${look.tone ? ` basalt-status-${look.tone}` : ''}`;
	}

	function tally(formId) {
		const entries = session.inbox[formId] || [];
		session.tallies[formId] = { total: entries.length, unread: entries.filter((entry) => !entry.read).length };
	}

	/* The editor header: name, status, the main button and its menu. */

	function drawHeader() {
		const record = current();
		if (!record) return;
		const look = LIFECYCLE[record.status] || LIFECYCLE.draft;
		const step = NEXT_STEP[record.status];
		const liveNow = record.status === 'live';
		ui.title.textContent = record.name;
		ui.badge.className = badgeClasses(look);
		ui.badge.textContent = look.word;
		ui.workIcon.innerHTML = `<i class="bi ${htmlSafe(record.icon || 'bi-ui-checks-grid')}"></i>`;
		ui.meta.textContent = `${STATE_LINES[record.status]} · edited ${editedOn(record.edited)} · `;
		ui.primaryText.textContent = step.text;
		ui.primaryGlyph.className = `bi ${step.glyph}`;
		ui.pauseText.closest('li').hidden = record.status === 'draft';
		ui.pauseText.textContent = liveNow ? 'Stop taking responses' : 'Take responses again';
		ui.pauseGlyph.className = `bi ${liveNow ? 'bi-pause-circle' : 'bi-play-circle'}`;

		const anyBroken = record.rules.some((rule) => ruleFault(rule, record));
		const counts = session.tallies[record.id] || { total: 0, unread: 0 };
		pick('[data-fb-count="fields"]').textContent = record.fields.filter((field) => field.type !== 'heading').length;
		pick('[data-fb-count="rules"]').textContent = record.rules.length;
		pick('[data-fb-logic-dot]').hidden = !anyBroken;
		pick('[data-fb-logic-sr]').textContent = anyBroken ? ', a rule needs fixing' : '';
		pick('[data-fb-count="responses"]').textContent = counts.total;
		pick('[data-fb-resp-dot]').hidden = !counts.unread;
		pick('[data-fb-resp-sr]').textContent = counts.unread ? `, ${counts.unread} not read` : '';
	}

	/** Counts an edit: stamps the form, redraws the header and saves shortly after. */
	function markEdited(options) {
		const record = current();
		if (!record) return;
		record.edited = stamp();
		ui.saved.classList.add('is-saving');
		ui.savedText.textContent = 'Saving…';
		clearTimeout(pendingSave);
		pendingSave = setTimeout(() => {
			backend.putForm(record).then(() => {
				ui.saved.classList.remove('is-saving');
				ui.savedText.textContent = 'Saved just now';
			});
		}, 500);
		if (options?.list !== false) drawFormList();
		drawHeader();
	}

	function wireHeader() {
		ui.primary.addEventListener('click', () => {
			const record = current();
			if (!record || ui.primary.getAttribute('aria-busy') === 'true') return;
			if (record.status === 'draft') tryPublish();
			else if (record.status === 'live') showTab('share');
			else setAccepting(true);
		});

		ui.blockers.addEventListener('click', (event) => {
			if (event.target.closest('[data-fb-problems-close]')) {
				ui.blockers.hidden = true;
				ui.primary.focus();
				return;
			}
			const fixButton = event.target.closest('[data-fb-fix]');
			if (!fixButton) return;
			const note = blockerNotes[Number(fixButton.getAttribute('data-fb-fix'))];
			if (note.pick === 'rule') {
				showTab('logic');
				return;
			}
			showTab('build');
			switchStage('edit');
			pickItem(note.pick, { open: true, focus: true });
			pick(`[data-id="${note.pick}"]`, ui.fields)?.scrollIntoView({
				block: 'center',
				behavior: calmMotion() ? 'auto' : 'smooth',
			});
		});

		host.addEventListener('click', (event) => {
			const item = event.target.closest('[data-fb-act]');
			if (!item) return;
			const menuActions = {
				duplicate: copyForm,
				toggle: () => setAccepting(current().status !== 'live'),
				delete: confirmRemoval,
			};
			menuActions[item.getAttribute('data-fb-act')]?.();
		});

		ui.deleteDialog.addEventListener('shown.bs.modal', () => pick('#fb-del-input')?.focus());
		ui.deleteDialog.addEventListener('click', (event) => {
			if (event.target.closest('[data-fb-del-csv]')) downloadCsv(formToDelete);
			if (event.target.closest('[data-fb-del-go]')) {
				bootstrap.Modal.getOrCreateInstance(ui.deleteDialog).hide();
				discardForm(formToDelete, false);
			}
		});

		pick('[data-fb-rename]').addEventListener('click', () => {
			ui.titleRow.hidden = true;
			ui.renameForm.hidden = false;
			ui.renameField.value = current().name;
			ui.renameField.focus();
			ui.renameField.select();
		});
		ui.renameForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const name = ui.renameField.value.trim();
			if (!name) {
				ui.renameError.hidden = false;
				ui.renameField.classList.add('is-invalid');
				ui.renameField.setAttribute('aria-invalid', 'true');
				ui.renameField.focus();
				return;
			}
			current().name = name;
			markEdited();
			fillShare();
			endRename();
			announce(`Renamed to ${name}.`);
		});
		pick('[data-fb-rename-cancel]').addEventListener('click', endRename);
		ui.renameField.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			endRename();
		});
	}

	function endRename() {
		ui.renameForm.hidden = true;
		ui.titleRow.hidden = false;
		ui.renameError.hidden = true;
		ui.renameField.classList.remove('is-invalid');
		pick('[data-fb-rename]').focus();
	}

	/** Publishes the open form, or lists what has to be fixed first. */
	function tryPublish() {
		const record = current();
		const found = blockers(record);
		listBlockers(found);
		if (found.length) {
			announce(ui.blockerTitle.textContent.trim());
			pick('[data-fb-fix]', ui.blockers)?.focus();
			return;
		}
		setBusy(ui.primary, 'loading', 'Publishing…');
		backend.makeLive(record).then(() => {
			record.status = 'live';
			setBusy(ui.primary, 'idle');
			markEdited();
			fillShare();
			raiseToast({
				tone: 'success',
				title: `“${record.name}” is live`,
				text: 'Anyone with the link can fill it in now.',
				actions: [
					{
						label: 'Copy link',
						onClick: () => {
							window.Basalt.copyText(publicLink(record));
							announce('Link copied');
						},
					},
					{ label: 'Share', ghost: true, onClick: () => showTab('share') },
				],
			});
		});
	}

	/** Everything that would stop a form going live, each with where to fix it. */
	function blockers(record) {
		const notes = [];
		if (!String(record.title || '').trim()) notes.push({ text: 'The form has no title.', pick: 'form' });
		if (!record.fields.some((field) => field.type !== 'heading'))
			notes.push({ text: 'There are no questions yet.', pick: null });
		for (const [index, field] of record.fields.entries()) {
			if (!String(field.label || '').trim()) {
				notes.push({ text: `Question ${index + 1} has no wording.`, pick: field.id });
			} else if (CHOICE_KINDS.includes(field.type) && (field.options || []).length < 2) {
				notes.push({ text: `“${wordingOf(field)}” needs at least two choices.`, pick: field.id });
			}
		}
		for (const [index, rule] of record.rules.entries()) {
			const fault = ruleFault(rule, record);
			if (fault) notes.push({ text: `Rule ${index + 1}: ${fault}`, pick: 'rule' });
		}
		return notes;
	}

	function listBlockers(notes) {
		ui.blockers.hidden = !notes.length;
		ui.blockerTitle.textContent =
			notes.length === 1
				? 'One thing to fix before publishing'
				: `${notes.length} things to fix before publishing`;
		ui.blockerList.innerHTML = notes
			.map((note, index) => {
				const fix = note.pick
					? ` <button data-fb-fix="${index}" type="button" class="btn btn-link btn-sm fb-link">${note.pick === 'rule' ? 'Open Logic' : 'Fix it'}</button>`
					: '';
				return `<li>${htmlSafe(note.text)}${fix}</li>`;
			})
			.join('');
		blockerNotes = notes;
	}

	/** Opens or closes a published form, with Undo in the toast. */
	function setAccepting(accept) {
		const record = current();
		if (record.status === 'draft') return;
		const before = record.status;
		record.status = accept ? 'live' : 'closed';
		markEdited();
		fillShare();
		raiseToast({
			tone: accept ? 'success' : 'warning',
			title: accept ? `“${record.name}” is taking responses again` : `“${record.name}” is closed`,
			text: accept ? '' : 'The link stays up and says the form is closed.',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						record.status = before;
						markEdited();
						fillShare();
					},
				},
			],
		});
	}

	function copyForm() {
		const original = current();
		const duplicate = {
			...copyOf(original),
			id: freshId('form'),
			name: `${original.name} (copy)`,
			status: 'draft',
			edited: stamp(),
		};
		session.forms.splice(session.forms.indexOf(original) + 1, 0, duplicate);
		session.inbox[duplicate.id] = [];
		tally(duplicate.id);
		backend.putForm(duplicate);
		visit(duplicate.id);
		raiseToast({ tone: 'success', title: 'Copy made', text: `“${duplicate.name}” is a draft with no responses.` });
	}

	/** Deletes an unanswered form at once; one with responses asks for its name first. */
	function confirmRemoval() {
		const record = current();
		const counts = session.tallies[record.id] || { total: 0 };
		if (!counts.total) {
			discardForm(record, true);
			return;
		}
		const phrase = htmlSafe(record.name);
		pick('[data-fb-del-sub]').textContent =
			`The link stops working and its ${count(counts.total, 'response')} are deleted too. This can't be undone.`;
		/* The typed check is built fresh each time, since the phrase is the form's name. */
		pick('[data-fb-del-body]').innerHTML =
			`<div data-basalt-type-confirm="${phrase}" class="basalt-type-confirm"><label for="fb-del-input" class="form-label">Type <span class="basalt-type-confirm-phrase">${phrase}</span> to confirm</label><input id="fb-del-input" aria-describedby="fb-del-state" type="text" autocomplete="off" spellcheck="false" class="form-control"><div aria-hidden="true" class="basalt-type-confirm-meter"><span></span></div><p id="fb-del-state" aria-live="polite" class="basalt-type-confirm-state">Nothing typed yet.</p><p class="fb-help mt-2">Want to keep the answers? <button data-fb-del-csv type="button" class="btn btn-link btn-sm fb-link p-0 align-baseline">Download them as CSV</button> first.</p></div>`;
		window.Basalt.dialog?.init(ui.deleteDialog);
		formToDelete = record;
		bootstrap.Modal.getOrCreateInstance(ui.deleteDialog).show();
	}

	function discardForm(record, canUndo) {
		const position = session.forms.indexOf(record);
		const answers = session.inbox[record.id];
		session.forms.splice(position, 1);
		backend.removeForm(record.id);
		/* The list takes over the deleted form's address. */
		session.open = null;
		history.replaceState(null, '', '#forms');
		showScreen('list');

		function restore() {
			session.forms.splice(position, 0, record);
			session.inbox[record.id] = answers;
			tally(record.id);
			backend.putForm(record);
			visit(record.id);
		}

		raiseToast({
			tone: 'primary',
			icon: 'bi-trash3',
			title: `“${record.name}” deleted`,
			text: canUndo ? '' : 'Its responses went with it.',
			actions: canUndo ? [{ label: 'Undo', onClick: restore }] : [],
		});
	}

	/* Build: the palette of field kinds. */

	function drawPalette() {
		const shelves = {};
		for (const [kind, spec] of Object.entries(FIELD_KINDS)) {
			(shelves[spec.shelf] ||= []).push(kind);
		}
		ui.palette.innerHTML = Object.entries(shelves)
			.map(([shelf, kinds], order) => {
				const tools = kinds
					.map(
						(kind) =>
							`<li><button data-fb-add="${kind}" aria-describedby="fb-palette-hint" type="button" draggable="true" class="fb-tool"><span aria-hidden="true" class="fb-tool-icon"><i class="bi ${FIELD_KINDS[kind].glyph}"></i></span><span class="fb-tool-label">${htmlSafe(FIELD_KINDS[kind].title)}</span><i aria-hidden="true" class="bi bi-plus-lg fb-tool-plus"></i></button></li>`,
					)
					.join('');
				return `<div class="fb-palette-group"><p id="fb-pal-${order}" class="fb-palette-label">${htmlSafe(shelf)}</p><ul aria-labelledby="fb-pal-${order}" class="fb-palette-list">${tools}</ul></div>`;
			})
			.join('');
	}

	function wirePalette() {
		ui.palette.addEventListener('click', (event) => {
			const tool = event.target.closest('[data-fb-add]');
			if (!tool) return;
			const addedId = insertField(tool.getAttribute('data-fb-add'));
			if (!addedId || !ui.addPanel.contains(tool)) return;
			/* Picked from the side panel: close it and land on the new question. */
			ui.addPanel.addEventListener(
				'hidden.bs.offcanvas',
				() => {
					pick(`[data-id="${addedId}"] [data-fb-field="edit"]`, ui.fields)?.focus();
				},
				{ once: true },
			);
			closePanel(ui.addPanel);
		});

		/* Dragging a kind from the palette onto the sheet. Fields already on the
       sheet move with the shared sortable list instead. */
		ui.palette.addEventListener('dragstart', (event) => {
			const tool = event.target.closest('[data-fb-add]');
			if (!tool) return;
			draggedKind = tool.getAttribute('data-fb-add');
			event.dataTransfer.effectAllowed = 'copy';
			event.dataTransfer.setData('text/plain', draggedKind);
			ui.sheet.classList.add('is-drop-target');
		});
		ui.palette.addEventListener('dragend', () => {
			draggedKind = null;
			hideSlot();
		});
		ui.sheet.addEventListener('dragover', (event) => {
			if (!draggedKind || session.stageMode !== 'edit') return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'copy';
			ui.sheet.classList.add('is-drop-target');
			showSlot(slotAt(event.clientX, event.clientY));
		});
		ui.sheet.addEventListener('dragleave', (event) => {
			if (ui.sheet.contains(event.relatedTarget)) return;
			hideSlot();
			if (draggedKind) ui.sheet.classList.add('is-drop-target');
		});
		ui.sheet.addEventListener('drop', (event) => {
			if (!draggedKind) return;
			event.preventDefault();
			const slot = slotAt(event.clientX, event.clientY);
			const kind = draggedKind;
			draggedKind = null;
			hideSlot();
			insertField(kind, slot);
		});
	}

	/** The position a dragged kind would take, from the pointer. */
	function slotAt(x, y) {
		const cards = pickAll('.fb-field', ui.fields);
		const hit = cards.findIndex((card) => {
			const box = card.getBoundingClientRect();
			if (y < box.top + box.height / 2 && (y < box.top || x < box.right)) return true;
			return y >= box.top && y <= box.bottom && x < box.left + box.width / 2;
		});
		return hit < 0 ? cards.length : hit;
	}

	function showSlot(slot) {
		const cards = pickAll('.fb-field', ui.fields);
		for (const [index, card] of cards.entries()) card.classList.toggle('is-drop-before', index === slot);
		ui.sheet.classList.toggle('is-drop-end', slot === cards.length);
	}

	function hideSlot() {
		for (const card of pickAll('.is-drop-before', ui.fields)) card.classList.remove('is-drop-before');
		ui.sheet.classList.remove('is-drop-end', 'is-drop-target');
	}

	function blankField(kind) {
		const spec = FIELD_KINDS[kind];
		const field = { id: freshId('f'), type: kind, label: spec.prompt, required: false };
		if (spec.choices) field.options = [...spec.choices];
		if (kind === 'number') Object.assign(field, { min: 0, max: 100 });
		if (kind === 'heading') field.help = '';
		return field;
	}

	/**
	 * Adds a question of the given kind and picks it.
	 * @param {string} kind a key of FIELD_KINDS
	 * @param {number} [slot] where it goes; by default under the picked field, or last
	 * @returns {string|undefined} the new field's id
	 */
	function insertField(kind, slot) {
		const record = current();
		if (!record || !FIELD_KINDS[kind]) return;
		const field = blankField(kind);
		let position = slot;
		if (position == null) {
			const picked = fieldWithId(session.picked);
			position = picked ? record.fields.indexOf(picked) + 1 : record.fields.length;
		}
		record.fields.splice(position, 0, field);
		pickItem(field.id, { quiet: true });
		markEdited();
		drawSheet();
		const card = pick(`[data-id="${field.id}"]`, ui.fields);
		if (card) {
			card.scrollIntoView({ block: 'nearest', behavior: calmMotion() ? 'auto' : 'smooth' });
			card.classList.add('is-new');
			setTimeout(() => card.classList.remove('is-new'), 1200);
		}
		announce(`${FIELD_KINDS[kind].title} added as question ${position + 1} of ${record.fields.length}.`);
		return field.id;
	}

	/* Build: the sheet and the cards on it. */

	function drawSheet() {
		const record = current();
		if (!record) return;
		ui.sheetTitle.textContent = record.title || 'Untitled form';
		ui.sheetIntro.textContent = record.intro || '';
		ui.sheetIntro.hidden = !record.intro;
		ui.sheetButton.textContent = record.submitLabel || 'Send';
		ui.sheetHead.classList.toggle('is-selected', session.picked === 'form');
		ui.fields.innerHTML = record.fields.map((field) => fieldCard(field, record)).join('');
		ui.fields.hidden = !record.fields.length;
		ui.dropHint.hidden = !!record.fields.length;
		const tallyLine =
			count(record.fields.length, 'field') +
			(record.rules.length ? `, ${count(record.rules.length, 'rule')}` : '');
		ui.stageNote.textContent = session.stageMode === 'edit' ? tallyLine : 'Rules and checks work here';
		drawHeader();
	}

	function fieldCard(field, record) {
		const spec = kindOf(field);
		const name = htmlSafe(wordingOf(field));
		const isPicked = session.picked === field.id;
		const isHalf = field.width === 'half' && PAIRABLE_KINDS.includes(field.type);
		const flag = cardFlag(field);
		const classes = `basalt-sortable-item fb-field${isHalf ? ' is-half' : ''}${isPicked ? ' is-selected' : ''}${flag ? ' is-flagged' : ''}`;
		const ruleNotes = record.rules
			.filter((rule) => rule.show === field.id)
			.map(
				(rule) =>
					`<p class="fb-field-rule${ruleFault(rule, record) ? ' is-broken' : ''}"><i aria-hidden="true" class="bi bi-signpost-split"></i>${htmlSafe(describeRule(rule, record))}</p>`,
			)
			.join('');
		const handle = `<button aria-label="Move ${name}" aria-describedby="basalt-sortable-help" aria-pressed="false" type="button" class="basalt-sortable-handle"><i aria-hidden="true" class="bi bi-grip-vertical"></i></button>`;
		const body = `<div class="fb-field-body"><p class="fb-field-kind"><i aria-hidden="true" class="bi ${spec.glyph}"></i><span class="fb-field-type">${htmlSafe(spec.title)}</span>${flag ? ` <span class="fb-flag">${flag}</span>` : ''}</p><div inert class="fb-field-preview">${questionMarkup(field, 'fbc-', null)}</div>${ruleNotes}</div>`;
		const tools = `<div class="fb-field-tools"><button data-fb-field="edit" aria-label="Change ${name}"${isPicked ? ' aria-current="true"' : ''} type="button" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-pencil"></i></button><button data-fb-field="copy" aria-label="Duplicate ${name}" type="button" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-copy"></i></button><button data-fb-field="delete" aria-label="Delete ${name}" type="button" class="btn btn-icon btn-sm fb-btn-danger"><i aria-hidden="true" class="bi bi-trash3"></i></button></div>`;
		return `<li data-id="${htmlSafe(field.id)}" class="${classes}">${handle}${body}${tools}</li>`;
	}

	/** The warning chip a card wears while its question is unfinished. */
	function cardFlag(field) {
		if (!field.label?.trim()) return 'Needs wording';
		if (CHOICE_KINDS.includes(field.type) && (field.options || []).length < 2) return 'Needs two choices';
		return '';
	}

	function wireSheet() {
		/* The sortable list reports a finished move; the data takes the new order. */
		ui.fields.addEventListener('basalt:sortable-change', (event) => {
			const record = current();
			const order = pickAll('.fb-field', ui.fields).map((card) => card.getAttribute('data-id'));
			record.fields.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
			markEdited();
			const movedId = event.detail?.item?.getAttribute('data-id');
			/* Redraw once the list has finished animating, and keep the keyboard
         on the handle that did the moving. */
			setTimeout(
				() => {
					const keyboardHere =
						ui.fields.contains(document.activeElement) || document.activeElement === document.body;
					drawSheet();
					drawRules();
					if (session.picked && session.picked !== 'form') fillSettings();
					const handle = movedId && pick(`[data-id="${movedId}"] .basalt-sortable-handle`, ui.fields);
					if (handle && keyboardHere) handle.focus();
				},
				calmMotion() ? 0 : 260,
			);
		});

		ui.fields.addEventListener('click', (event) => {
			const card = event.target.closest('.fb-field');
			if (!card || event.target.closest('.basalt-sortable-handle')) return;
			const fieldId = card.getAttribute('data-id');
			const tool = event.target.closest('[data-fb-field]');
			if (!tool) {
				pickItem(fieldId, { open: true });
				return;
			}
			const cardActions = {
				edit: () => pickItem(fieldId, { open: true, focus: true }),
				copy: () => cloneField(fieldId),
				delete: () => removeField(fieldId),
			};
			cardActions[tool.getAttribute('data-fb-field')]?.();
		});

		/* Delete, or Ctrl/Cmd+Backspace, on a card's own buttons removes the card (with Undo). */
		ui.fields.addEventListener('keydown', (event) => {
			const wantsDelete =
				event.key === 'Delete' || (event.key === 'Backspace' && (event.metaKey || event.ctrlKey));
			if (!wantsDelete || !event.target.closest('.fb-field-tools')) return;
			event.preventDefault();
			removeField(event.target.closest('.fb-field').getAttribute('data-id'));
		});

		ui.sheetHead.addEventListener('click', () => pickItem('form', { open: true, focus: true }));
	}

	/**
	 * Picks the form header, a field, or nothing, and shows its settings.
	 * @param {string|null} chosenId 'form', a field id, or null
	 * @param {{open?: boolean, focus?: boolean, quiet?: boolean}} [how]
	 */
	function pickItem(chosenId, how) {
		session.picked = chosenId;
		ui.build.classList.toggle('has-settings', !!chosenId);
		fillSettings();
		for (const card of pickAll('.fb-field', ui.fields)) {
			const isPicked = card.getAttribute('data-id') === chosenId;
			const pencil = pick('[data-fb-field="edit"]', card);
			card.classList.toggle('is-selected', isPicked);
			if (isPicked) pencil.setAttribute('aria-current', 'true');
			else pencil.removeAttribute('aria-current');
		}
		ui.sheetHead.classList.toggle('is-selected', chosenId === 'form');
		if (how?.open && !settingsInline() && window.bootstrap)
			bootstrap.Offcanvas.getOrCreateInstance(ui.settingsPanel).show();
		if (how?.focus) {
			const firstInput = pick(chosenId === 'form' ? '#fb-set-title' : '#fb-set-label');
			if (settingsInline() && firstInput) firstInput.focus();
		}
	}

	function cloneField(fieldId) {
		const record = current();
		const field = fieldWithId(fieldId);
		if (!field) return;
		const twin = { ...copyOf(field), id: freshId('f'), label: field.label ? `${field.label} (copy)` : '' };
		record.fields.splice(record.fields.indexOf(field) + 1, 0, twin);
		pickItem(twin.id);
		markEdited();
		drawSheet();
		announce('Duplicated. The copy is right under it.');
	}

	/** Removes a question and every rule that leans on it; the toast can put both back. */
	function removeField(fieldId) {
		const record = current();
		const field = fieldWithId(fieldId);
		if (!field) return;
		const position = record.fields.indexOf(field);
		const orphans = record.rules.filter((rule) => rule.show === fieldId || rule.when === fieldId);
		record.fields.splice(position, 1);
		record.rules = record.rules.filter((rule) => !orphans.includes(rule));
		if (session.picked === fieldId) pickItem(null);
		markEdited();
		drawSheet();
		drawRules();

		/* The keyboard moves to the next card's pencil, or to the palette. */
		const neighbor = ui.fields.children[Math.min(position, ui.fields.children.length - 1)];
		const landing = neighbor ? pick('[data-fb-field="edit"]', neighbor) : pick('.fb-tool');
		if (landing && !ui.settingsPanel.contains(document.activeElement)) landing.focus();

		const homeFormId = record.id;
		raiseToast({
			tone: 'primary',
			icon: 'bi-trash3',
			title: `Deleted “${wordingOf(field)}”`,
			text: orphans.length ? `And ${count(orphans.length, 'rule')} that used it.` : '',
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						const owner = session.forms.find((kept) => kept.id === homeFormId);
						if (!owner) return;
						owner.fields.splice(Math.min(position, owner.fields.length), 0, field);
						owner.rules = [...owner.rules, ...orphans];
						if (current() === owner) {
							pickItem(field.id);
							drawSheet();
							drawRules();
						}
						markEdited();
						announce('Put back.');
					},
				},
			],
		});
	}

	/* Build: the settings of whatever is picked. */

	function fillSettings() {
		const record = current();
		const field = record && fieldWithId(session.picked);
		const isHeader = session.picked === 'form';
		const icon = pick('[data-fb-set-icon]');
		syncing = true;
		pick('[data-fb-set-none]').hidden = !!(field || isHeader);
		pick('[data-fb-set-form]').hidden = !isHeader;
		pick('[data-fb-set-field]').hidden = !field;

		if (isHeader) {
			setHeading('The form', 'Title, intro and button');
			icon.className = 'bi bi-window';
			pick('#fb-set-title').value = record.title || '';
			pick('#fb-set-intro').value = record.intro || '';
			pick('#fb-set-submit').value = record.submitLabel || '';
			markInvalid('title', !String(record.title || '').trim());
		} else if (field) {
			fillFieldSettings(record, field, icon);
		} else {
			setHeading('Settings', 'Nothing picked');
			icon.className = 'bi bi-sliders';
		}
		syncing = false;
	}

	function setHeading(title, kindLine) {
		pick('[data-fb-set-title]').textContent = title;
		pick('[data-fb-set-kind]').textContent = kindLine;
	}

	function fillFieldSettings(record, field, icon) {
		const spec = kindOf(field);
		const isHeading = field.type === 'heading';
		const hasChoices = CHOICE_KINDS.includes(field.type);
		setHeading(
			wordingOf(field),
			`${spec.title}, question ${record.fields.indexOf(field) + 1} of ${record.fields.length}`,
		);
		icon.className = `bi ${spec.glyph}`;
		pick('[data-fb-label-word]').textContent = isHeading
			? 'Heading'
			: field.type === 'consent'
				? 'What they agree to'
				: 'Question';
		pick('[data-fb-help-word]').textContent = isHeading ? 'Text under it' : 'Help text';
		pick('[data-fb-help-hint]').textContent = isHeading
			? 'A line or two to introduce the next questions.'
			: 'Shown in small type under the question.';
		pick('#fb-set-label').value = field.label || '';
		pick('#fb-set-help').value = field.help || '';
		pick('#fb-set-placeholder').value = field.placeholder || '';
		pick('#fb-set-required').checked = !!field.required;
		pick('#fb-set-width-full').checked = field.width !== 'half';
		pick('#fb-set-width-half').checked = field.width === 'half';
		pick('#fb-set-min').value = field.min ?? 0;
		pick('#fb-set-max').value = field.max ?? 100;
		for (const row of pickAll('[data-fb-only]', ui.settings)) {
			row.hidden = !row.getAttribute('data-fb-only').split(' ').includes(field.type);
		}
		if (hasChoices && ui.choices.basaltTags) ui.choices.basaltTags.set(field.options || []);
		markInvalid('label', !String(field.label || '').trim());
		markInvalid('options', hasChoices && (field.options || []).length < 2);

		const ownRules = record.rules.filter((rule) => rule.show === field.id);
		pick('[data-fb-set-logic]').hidden = !ownRules.length;
		pick('[data-fb-set-logic-text]').textContent =
			`${ownRules.map((rule) => describeRule(rule, record)).join('. And ')}.`;

		/* Segmented controls only place their thumb once their row can be measured. */
		nudgeSegmented();
	}

	function nudgeSegmented() {
		for (const control of pickAll('[data-basalt-segmented]', ui.settings))
			control.dispatchEvent(new Event('change'));
	}

	/** Shows or clears one settings error, and marks its input to match. */
	function markInvalid(key, invalid) {
		const message = pick(`[data-fb-err="${key}"]`, ui.settings);
		if (!message) return;
		message.hidden = !invalid;
		const inputFor = { label: '#fb-set-label', title: '#fb-set-title', options: '#fb-set-options' }[key];
		if (!inputFor) return;
		const input = pick(inputFor);
		const outline = key === 'options' ? input.closest('.basalt-tags') : input;
		outline.classList.toggle('is-invalid', invalid);
		input.setAttribute('aria-invalid', String(invalid));
	}

	function writeField(key, value) {
		const field = fieldWithId(session.picked);
		if (!field) return;
		field[key] = key === 'min' || key === 'max' ? Number(value) : value;
		if (key === 'label') {
			markInvalid('label', !String(value).trim());
			pick('[data-fb-set-title]').textContent = wordingOf(field);
		}
		if (key === 'options') markInvalid('options', CHOICE_KINDS.includes(field.type) && value.length < 2);
		/* A rule that compared against a removed choice is left pointing at nothing. */
		markEdited();
		drawSheet();
	}

	function wireSettings() {
		/* Typing writes straight into the picked field, or into the form itself. */
		ui.settings.addEventListener('input', (event) => {
			if (syncing || !current()) return;
			const input = event.target;
			const fieldKey = input.getAttribute('data-fb-key');
			const formKey = input.getAttribute('data-fb-form-key');
			if (fieldKey && !['checkbox', 'radio', 'number'].includes(input.type)) writeField(fieldKey, input.value);
			if (!formKey) return;
			current()[formKey] = input.value;
			if (formKey === 'title') markInvalid('title', !input.value.trim());
			markEdited({ list: false });
			drawSheet();
		});

		ui.settings.addEventListener('change', (event) => {
			if (syncing || !current()) return;
			const input = event.target;
			const fieldKey = input.getAttribute('data-fb-key');
			if (fieldKey === 'required') {
				writeField('required', input.checked);
			} else if (fieldKey === 'width') {
				if (input.checked) writeField('width', input.value);
			} else if (fieldKey === 'min' || fieldKey === 'max') {
				writeField(fieldKey, input.value);
			} else if (input.id === 'fb-set-options') {
				const field = fieldWithId(session.picked);
				if (!field || !ui.choices.basaltTags) return;
				const choices = ui.choices.basaltTags.get();
				if (JSON.stringify(choices) !== JSON.stringify(field.options || [])) writeField('options', choices);
			}
		});

		pick('[data-fb-set-copy]').addEventListener('click', () => cloneField(session.picked));
		pick('[data-fb-set-del]').addEventListener('click', () => {
			const fieldId = session.picked;
			if (!settingsInline() && window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(ui.settingsPanel).hide();
			removeField(fieldId);
		});
		pick('[data-fb-goto-logic]').addEventListener('click', () => {
			if (!settingsInline() && window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(ui.settingsPanel).hide();
			showTab('logic');
		});

		/* Closing the panel puts the item down and hands its room back to the sheet. */
		pick('[data-fb-set-close]').addEventListener('click', () => {
			const chosenId = session.picked;
			pickItem(null);
			const returnTo =
				chosenId && chosenId !== 'form'
					? pick(`[data-id="${chosenId}"] [data-fb-field="edit"]`, ui.fields)
					: ui.sheetHead;
			returnTo?.focus();
		});

		ui.settingsPanel.addEventListener('shown.bs.offcanvas', nudgeSegmented);
	}

	/* Layout: where the palette and the settings live at each width. */

	function wireLayout() {
		if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(fitLayout)).observe(host);
		else window.addEventListener('resize', fitLayout);
		pick('[data-fb-add-open]').addEventListener('click', () => {
			if (window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(ui.addPanel).show();
		});
	}

	/** Picks full, split or compact from the room the page has, not the window,
      so an open or folded sidebar counts. */
	function fitLayout() {
		/* The card's side padding is taken off first. */
		const room = host.clientWidth - 50;
		let next = 'compact';
		if (room >= 1000) next = 'full';
		else if (room >= 720) next = 'split';
		if (next === fit) return;
		fit = next;
		ui.build.setAttribute('data-fb-layout', next);
		dockSettings();
		dockPalette();
	}

	function dockSettings() {
		if (settingsInline()) {
			if (ui.settings.parentElement !== ui.settingsHome) ui.settingsHome.appendChild(ui.settings);
			closePanel(ui.settingsPanel);
		} else if (ui.settings.parentElement !== ui.settingsPanelBody) {
			ui.settingsPanelBody.appendChild(ui.settings);
		}
	}

	function dockPalette() {
		if (fit === 'compact') {
			if (ui.palettePanel.parentElement !== ui.addPanelBody) ui.addPanelBody.appendChild(ui.palettePanel);
			return;
		}
		if (ui.palettePanel.parentElement !== ui.paletteHome) ui.paletteHome.appendChild(ui.palettePanel);
		closePanel(ui.addPanel);
	}

	function settingsInline() {
		return fit === 'full';
	}

	function closePanel(panel) {
		if (!window.bootstrap) return;
		bootstrap.Offcanvas.getInstance(panel)?.hide();
	}

	/* Build: Edit or Try it, computer or phone. */

	function wireStage() {
		pick('[data-fb-mode]').addEventListener('change', (event) => {
			if (event.target.name === 'fbMode') switchStage(event.target.value);
		});
		pick('[data-fb-device]').addEventListener('change', (event) => {
			if (event.target.name === 'fbDevice') ui.stage.classList.toggle('is-phone', event.target.value === 'phone');
		});
		for (const button of pickAll('[data-fb-try]')) {
			button.addEventListener('click', () => {
				showTab('build');
				switchStage('preview');
				const firstControl = pick('input, select, textarea, .fb-star', ui.live);
				setTimeout(() => {
					ui.tryPane.scrollIntoView({ block: 'nearest' });
					firstControl?.focus({ preventScroll: true });
				}, 60);
			});
		}
	}

	function switchStage(mode) {
		const trying = mode === 'preview';
		session.stageMode = mode;
		pick('#fb-mode-edit').checked = mode === 'edit';
		pick('#fb-mode-preview').checked = trying;
		pick('[data-fb-mode]').dispatchEvent(new Event('change'));
		ui.stage.closest('.fb-build').classList.toggle('is-trying', trying);
		ui.sheet.hidden = mode !== 'edit';
		ui.tryPane.hidden = !trying;
		if (trying) drawTryIt();
		drawSheet();
	}

	/* Try it: the working form, rules and checks included. */

	function drawTryIt() {
		const record = current();
		if (!record) return;
		const brand = htmlSafe(SAMPLE.brand.name);
		const questions = record.fields
			.map((field) => {
				const isHalf = field.width === 'half' && PAIRABLE_KINDS.includes(field.type);
				return `<div data-fb-q="${htmlSafe(field.id)}" class="fb-live-q${isHalf ? ' is-half' : ''}">${questionMarkup(field, 'fbl-', null)}</div>`;
			})
			.join('');
		const intro = record.intro ? `<p class="fb-sheet-intro">${htmlSafe(record.intro)}</p>` : '';
		const legend = record.fields.some((field) => field.required)
			? '<p class="fb-sheet-req"><span aria-hidden="true" class="fb-req">*</span> marks a question that must be answered</p>'
			: '';
		const emptyNote = record.fields.length
			? ''
			: '<p class="fb-q-help">This form has no questions yet. Switch to Edit and add some.</p>';
		const sendButton = `<button data-fb-live-send${record.fields.length ? '' : ' disabled'} type="submit" class="btn btn-primary btn-loading btn-loading-swap"><span aria-hidden="true" class="btn-loading-icon"><i class="bi bi-send"></i></span><span class="btn-loading-label">${htmlSafe(record.submitLabel || 'Send')}</span></button>`;
		ui.live.innerHTML = `<div class="fb-sheet-brand"><span aria-hidden="true" class="fb-sheet-mark">${htmlSafe(monogram(SAMPLE.brand.name))}</span>${brand}</div><h3 id="fb-live-title" class="fb-sheet-title">${htmlSafe(record.title || 'Untitled form')}</h3>${intro}${legend}<div class="fb-live-fields">${questions}</div>${emptyNote}<div data-fb-live-summary role="alert" class="fb-live-summary" hidden></div><div class="fb-sheet-foot">${sendButton}</div>`;
		revealQuestions();
	}

	function wireTryIt() {
		ui.live.addEventListener('input', () => revealQuestions());

		ui.live.addEventListener('change', (event) => {
			revealQuestions();
			/* A question that has been flagged checks itself again as it is fixed. */
			const wrapper = event.target.closest('[data-fb-q]');
			if (!wrapper?.querySelector('.fb-q-error:not([hidden])')) return;
			const record = current();
			validateAnswers(
				record,
				collectAnswers(record),
				revealQuestions(),
				fieldWithId(wrapper.getAttribute('data-fb-q')),
			);
		});

		ui.live.addEventListener('submit', (event) => {
			event.preventDefault();
			sendTest();
		});

		ui.live.addEventListener('click', (event) => {
			if (event.target.closest('[data-fb-again]')) {
				drawTryIt();
				pick('input, select, textarea', ui.live)?.focus();
			}
			if (event.target.closest('[data-fb-see]')) jumpToNewest(current().id);
		});
	}

	/** Checks the Try it answers and, when they pass, stores them as a test response. */
	function sendTest() {
		const record = current();
		const answers = collectAnswers(record);
		const visible = revealQuestions();
		const problems = validateAnswers(record, answers, visible);
		const summary = pick('[data-fb-live-summary]', ui.live);
		if (problems.length) {
			summary.hidden = false;
			summary.innerHTML = `<i aria-hidden="true" class="bi bi-exclamation-circle"></i><span>${problems.length === 1 ? 'One answer needs a look before this can send.' : `${problems.length} answers need a look before this can send.`}</span>`;
			const target = pick(`#fbl-${problems[0].field.id}`, ui.live);
			const focusable = target && (target.matches('input, select, textarea') ? target : pick('input', target));
			focusable?.focus();
			return;
		}
		summary.hidden = true;

		/* Questions that stayed hidden are sent empty. */
		for (const key of Object.keys(answers)) {
			if (!visible.has(key)) answers[key] = Array.isArray(answers[key]) ? [] : '';
		}

		const sendButton = pick('[data-fb-live-send]', ui.live);
		setBusy(sendButton, 'loading', 'Sending…');
		backend.addResponse(record.id, answers, true).then((entry) => {
			setBusy(sendButton, 'idle');
			if (session.inbox[record.id]) session.inbox[record.id].unshift(entry);
			else session.inbox[record.id] = [entry];
			tally(record.id);
			drawFormList();
			drawHeader();
			if (activeTabName() === 'responses') drawResponses();
			ui.live.innerHTML = `<div tabindex="-1" class="fb-thanks"><svg viewBox="0 0 52 52" aria-hidden="true" class="basalt-done-mark"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg><h3 class="fb-thanks-title">Sent</h3><p class="fb-thanks-text">${htmlSafe(record.thanks || 'Thanks, we have got it.')}</p><div class="fb-thanks-actions"><button data-fb-again type="button" class="btn btn-sm btn-outline-secondary">Send another</button><button data-fb-see type="button" class="btn btn-sm btn-primary">See it in Responses</button></div></div>`;
			pick('.fb-thanks', ui.live).focus();
			raiseToast({
				tone: 'success',
				title: 'Test response saved',
				text: 'It is in Responses, marked as a test.',
				actions: [{ label: 'View', onClick: () => jumpToNewest(record.id) }],
			});
		});
	}

	/** Reads what is entered in Try it, keyed by field id. */
	function collectAnswers(record) {
		const answers = {};
		for (const field of record.fields) {
			if (field.type === 'heading') continue;
			answers[field.id] = readAnswer(field);
		}
		return answers;
	}

	function readAnswer(field) {
		const named = `[name="${field.id}"]`;
		if (field.type === 'checkbox') return pickAll(`input${named}:checked`, ui.live).map((box) => box.value);
		if (field.type === 'radio' || field.type === 'rating')
			return pick(`input${named}:checked`, ui.live)?.value ?? '';
		if (field.type === 'consent') return !!pick(`input${named}`, ui.live)?.checked;
		const control = pick(named, ui.live);
		return control ? control.value.trim() : '';
	}

	/** Shows the questions the current answers allow and hides the rest.
      @returns {Set<string>} ids of the questions now showing */
	function revealQuestions() {
		const record = current();
		const visible = shownIds(record, collectAnswers(record));
		for (const wrapper of pickAll('[data-fb-q]', ui.live)) {
			const show = visible.has(wrapper.getAttribute('data-fb-q'));
			if (wrapper.hidden !== show) continue;
			wrapper.hidden = !show;
			if (show && !calmMotion()) {
				wrapper.classList.remove('is-appearing');
				void wrapper.offsetWidth;
				wrapper.classList.add('is-appearing');
			}
		}
		return visible;
	}

	/**
	 * Checks the showing questions and writes each message beside its question.
	 * @param {object} record the form
	 * @param {object} answers from collectAnswers
	 * @param {Set<string>} visible ids of the questions showing
	 * @param {object} [onlyField] check just this one
	 * @returns {{field: object, msg: string}[]} what failed
	 */
	function validateAnswers(record, answers, visible, onlyField) {
		const problems = [];
		for (const field of record.fields) {
			if (field.type === 'heading' || (onlyField && field !== onlyField)) continue;
			const message = visible.has(field.id) ? answerProblem(field, answers[field.id]) : '';
			flagAnswer(field, message);
			if (message) problems.push({ field, msg: message });
		}
		return problems;
	}

	function answerProblem(field, answer) {
		if (field.required && isEmpty(answer)) {
			if (field.type === 'consent') return 'Check this box to continue.';
			if (CHOICE_KINDS.includes(field.type) || field.type === 'rating') return 'Pick an answer.';
			return 'This one has to be answered.';
		}
		if (field.type === 'email' && answer && !looksLikeEmail(answer))
			return 'That email looks unfinished. It needs an @ and a domain.';
		if (field.type !== 'number' || answer === '' || answer == null) return '';
		const amount = Number(answer);
		if (isNaN(amount)) return 'Use numbers only.';
		if (field.min != null && amount < field.min) return `The lowest is ${field.min}.`;
		if (field.max != null && amount > field.max) return `The highest is ${field.max}.`;
		return '';
	}

	function flagAnswer(field, message) {
		const note = pick(`#fbl-${field.id}-err`, ui.live);
		const control = pick(`#fbl-${field.id}`, ui.live);
		if (note) {
			note.textContent = message;
			note.hidden = !message;
		}
		if (!control) return;
		control.classList.toggle('is-invalid', !!message);
		control.setAttribute('aria-invalid', String(!!message));
	}

	/** Opens Responses on the newest entry of a form, switching forms if needed. */
	function jumpToNewest(formId) {
		if (current()?.id !== formId || shownView !== 'editor') visit(formId);
		showTab('responses');
		setTimeout(() => openRecord(0), 420);
	}

	/* One question's markup, shared by the sheet (inert) and Try it (live),
     so the two can never drift apart. */

	/**
	 * @param {object} field the question
	 * @param {string} prefix id prefix that keeps the sheet and Try it apart
	 * @param {*} answer a value to show as already entered, or null
	 * @returns {string} HTML
	 */
	function questionMarkup(field, prefix, answer) {
		const id = `${prefix}${field.id}`;
		const parts = {
			id,
			label: htmlSafe(wordingOf(field)),
			star: field.required ? '<span aria-hidden="true" class="fb-req">*</span>' : '',
			must: field.required ? ' required aria-required="true"' : '',
			help: field.help ? `<p id="${id}-help" class="fb-q-help">${htmlSafe(field.help)}</p>` : '',
			describedBy: ` aria-describedby="${field.help ? `${id}-help ` : ''}${id}-err"`,
			error: `<p id="${id}-err" class="fb-q-error" hidden></p>`,
			hint: field.placeholder ? ` placeholder="${htmlSafe(field.placeholder)}"` : '',
			value: answer ?? '',
		};
		return (QUESTION_BUILDERS[field.type] || typedInput)(field, parts);
	}

	function typedInput(field, parts) {
		const shape = INPUT_SHAPES[field.type] || { type: 'text', extra: () => '' };
		return labeled(
			parts,
			`<input id="${parts.id}" type="${shape.type}" name="${field.id}" value="${htmlSafe(parts.value)}"${parts.hint}${shape.extra(field)}${parts.must}${parts.describedBy} class="form-control">`,
		);
	}

	function choiceGroup(field, parts) {
		const choices = field.options || [];
		const items =
			choices
				.map((choice, index) => {
					const isOn =
						field.type === 'radio'
							? choice === parts.value
							: Array.isArray(parts.value) && parts.value.includes(choice);
					return `<div class="form-check"><input id="${parts.id}-${index}" type="${field.type}" name="${field.id}" value="${htmlSafe(choice)}"${isOn ? ' checked' : ''} class="form-check-input"><label for="${parts.id}-${index}" class="form-check-label">${htmlSafe(choice)}</label></div>`;
				})
				.join('') || '<p class="fb-q-help">No choices yet.</p>';
		return grouped(
			parts,
			`<div class="fb-q-choices${choices.length > 4 ? ' fb-q-choices-cols' : ''}">${items}</div>`,
		);
	}

	/* A single control under a <label>. */
	function labeled(parts, control) {
		return `<div class="fb-q"><label for="${parts.id}" class="form-label fb-q-label">${parts.label}${parts.star}</label>${parts.help}${control}${parts.error}</div>`;
	}

	/* A set of controls under a <legend>. */
	function grouped(parts, inner) {
		return `<fieldset id="${parts.id}"${parts.describedBy} class="fb-q"><legend class="form-label fb-q-label">${parts.label}${parts.star}</legend>${parts.help}${inner}${parts.error}</fieldset>`;
	}

	/* Logic: rules that show a question only when an answer calls for it. */

	function conditionsFor(field) {
		if (!field) return [];
		return CONDITIONS_BY_KIND[field.type] || ['filled', 'empty'];
	}

	function holds(rule, answers) {
		const condition = CONDITIONS[rule.op];
		return condition ? condition.test(answers[rule.when], rule.value) : true;
	}

	/** What is wrong with a rule, as a sentence, or '' when nothing is. */
	function ruleFault(rule, record) {
		const target = fieldWithId(rule.show, record);
		const source = fieldWithId(rule.when, record);
		if (!target || !source) return 'One of its questions was deleted. Pick another, or delete the rule.';
		if (rule.show === rule.when) return "A question can't depend on its own answer.";
		if (record.fields.indexOf(source) > record.fields.indexOf(target)) {
			return `“${wordingOf(source)}” comes after “${wordingOf(target)}”. Move it higher, so it is answered first.`;
		}
		if (!conditionsFor(source).includes(rule.op)) return 'Pick a condition.';
		const wants = CONDITIONS[rule.op].wants;
		if (wants === 'option' && !(source.options || []).includes(rule.value))
			return `Pick one of the choices for “${wordingOf(source)}”.`;
		if (wants === 'number' && (rule.value === '' || isNaN(Number(rule.value))))
			return 'Enter a number to compare with.';
		return '';
	}

	/** Ids of the questions that show for a set of answers. Broken rules are ignored. */
	function shownIds(record, answers) {
		const visible = new Set();
		for (const field of record.fields) {
			const gates = record.rules.filter((rule) => rule.show === field.id && !ruleFault(rule, record));
			if (gates.every((rule) => visible.has(rule.when) && holds(rule, answers))) visible.add(field.id);
		}
		return visible;
	}

	function describeRule(rule, record) {
		const source = fieldWithId(rule.when, record);
		if (!source) return 'Shown when a deleted question is answered';
		const condition = CONDITIONS[rule.op];
		let compared = '';
		if (condition?.wants === 'option') compared = ` “${rule.value}”`;
		if (condition?.wants === 'number') compared = ` ${rule.value}${source.type === 'rating' ? ' stars' : ''}`;
		return `Shown when “${wordingOf(source)}” ${condition ? condition.phrase : ''}${compared}`;
	}

	/** The value a fresh or re-pointed rule starts with. */
	function startingValue(source, op) {
		const wants = CONDITIONS[op]?.wants;
		if (wants === 'option') return (source.options || [])[0] || '';
		if (wants === 'number') return source.type === 'rating' ? '3' : '1';
		return '';
	}

	function drawRules() {
		const record = current();
		if (!record) return;
		const questions = record.fields.filter((field) => field.type !== 'heading');
		const answerable = questions.filter((field) => conditionsFor(field).length);
		ui.rules.innerHTML = record.rules
			.map((rule, index) => ruleRow(rule, index, record, questions, answerable))
			.join('');
		ui.rules.hidden = !record.rules.length;
		ui.rulesEmpty.hidden = !!record.rules.length;
		pick('[data-fb-rules-empty-text]').textContent =
			answerable.length < 2
				? 'Rules need at least two questions: one to answer, one to show. Add a few on the Build tab first.'
				: 'Add a rule to ask something only when it applies, like which app they use now, asked only if they use one.';
		for (const button of pickAll('[data-fb-rule-add]'))
			atLimit(button, answerable.length < 2 ? 'Add at least two questions on the Build tab first' : '');
		drawHeader();
	}

	function ruleRow(rule, index, record, questions, answerable) {
		const number = index + 1;
		const source = fieldWithId(rule.when, record);
		const fault = ruleFault(rule, record);
		const usable = conditionsFor(source);
		const wants = CONDITIONS[rule.op]?.wants;
		let valueControl = '';
		if (source && wants === 'option') {
			valueControl = `<select data-k="value" aria-label="Answer, rule ${number}" class="form-select form-select-sm">${optionTags(
				(source.options || []).map((choice) => ({ value: choice, text: choice })),
				rule.value,
				'Pick an answer',
			)}</select>`;
		}
		if (source && wants === 'number') {
			valueControl =
				source.type === 'rating'
					? `<select data-k="value" aria-label="Stars, rule ${number}" class="form-select form-select-sm">${optionTags(
							[1, 2, 3, 4, 5].map((score) => ({ value: String(score), text: count(score, 'star') })),
							String(rule.value),
						)}</select>`
					: `<input data-k="value" value="${htmlSafe(rule.value)}" aria-label="Number, rule ${number}" type="number" class="form-control form-control-sm fb-rule-num">`;
		}
		const showPicker = `<select data-k="show" aria-label="Question to show, rule ${number}" class="form-select form-select-sm">${optionTags(
			questions.map((field) => ({ value: field.id, text: wordingOf(field) })),
			rule.show,
			fieldWithId(rule.show, record) ? '' : 'Pick a question',
		)}</select>`;
		const whenPicker = `<select data-k="when" aria-label="Question it depends on, rule ${number}" class="form-select form-select-sm">${optionTags(
			answerable.map((field) => ({ value: field.id, text: wordingOf(field) })),
			rule.when,
			source ? '' : 'Pick a question',
		)}</select>`;
		const opPicker = usable.length
			? `<select data-k="op" aria-label="Condition, rule ${number}" class="form-select form-select-sm fb-rule-op">${optionTags(
					usable.map((op) => ({ value: op, text: CONDITIONS[op].phrase })),
					rule.op,
				)}</select>`
			: '';
		const faultLine = fault
			? `<p id="fb-rule-p-${index}" class="fb-rule-problem"><i aria-hidden="true" class="bi bi-exclamation-triangle"></i>${htmlSafe(fault)}</p>`
			: '';
		return `<li data-rule="${htmlSafe(rule.id)}" class="fb-rule${fault ? ' is-broken' : ''}"><span aria-hidden="true" class="fb-rule-n">${number}</span><div class="fb-rule-body"><div class="fb-rule-line"><span class="fb-rule-word">Show</span>${showPicker}</div><div class="fb-rule-line"><span class="fb-rule-word">only when</span>${whenPicker}${opPicker}${valueControl}</div>${faultLine}</div><button data-fb-rule-del aria-label="Delete rule ${number}" type="button" class="btn btn-icon btn-sm fb-btn-danger"><i aria-hidden="true" class="bi bi-trash3"></i></button></li>`;
	}

	function optionTags(entries, selected, placeholder) {
		const lead = placeholder ? `<option value="">${placeholder}</option>` : '';
		return (
			lead +
			entries
				.map(
					(entry) =>
						`<option value="${htmlSafe(entry.value)}"${entry.value === selected ? ' selected' : ''}>${htmlSafe(entry.text)}</option>`,
				)
				.join('')
		);
	}

	/** Adds a rule on the first answerable question, showing a later one. */
	function appendRule() {
		const record = current();
		const answerable = record.fields.filter((field) => conditionsFor(field).length);
		if (answerable.length < 2) return;
		const source = answerable[0];
		const sourceAt = record.fields.indexOf(source);
		const target =
			record.fields.find(
				(field) => field !== source && record.fields.indexOf(field) > sourceAt && field.type !== 'heading',
			) || answerable[1];
		const op = conditionsFor(source)[0];
		const rule = { id: freshId('r'), show: target.id, when: source.id, op, value: startingValue(source, op) };
		record.rules.push(rule);
		markEdited();
		drawRules();
		drawSheet();
		const firstPicker = pick(`[data-rule="${rule.id}"] select`, ui.rules);
		if (firstPicker) setTimeout(() => focusPicker(firstPicker), 30);
		announce(`Rule ${record.rules.length} added. Pick the question to show and when.`);
	}

	/* The shared styled select puts a button right after the real <select>;
     focus goes there when it exists. */
	function focusPicker(control) {
		const styled =
			control.matches('select') && control.nextElementSibling?.matches('button')
				? control.nextElementSibling
				: control;
		styled.focus();
	}

	function wireLogic() {
		for (const button of pickAll('[data-fb-rule-add]')) button.addEventListener('click', appendRule);

		ui.rules.addEventListener('change', (event) => {
			const key = event.target.getAttribute('data-k');
			const row = event.target.closest('[data-rule]');
			if (!key || !row) return;
			const record = current();
			const rule = record.rules.find((kept) => kept.id === row.getAttribute('data-rule'));
			rule[key] = event.target.value;
			if (key === 'when') {
				const source = fieldWithId(rule.when, record);
				rule.op = conditionsFor(source)[0] || '';
				rule.value = startingValue(source, rule.op);
			}
			if (key === 'op' && CONDITIONS[rule.op].wants === null) rule.value = '';
			markEdited();
			/* Redraw, then give focus back to the control that changed. */
			const controlIndex = pickAll('select, input', row).indexOf(event.target);
			drawRules();
			drawSheet();
			const again = pickAll('select, input', pick(`[data-rule="${rule.id}"]`, ui.rules))[controlIndex];
			if (again) setTimeout(() => focusPicker(again), 30);
		});

		ui.rules.addEventListener('click', (event) => {
			const trash = event.target.closest('[data-fb-rule-del]');
			if (!trash) return;
			const record = current();
			const row = trash.closest('[data-rule]');
			const position = record.rules.findIndex((kept) => kept.id === row.getAttribute('data-rule'));
			const [rule] = record.rules.splice(position, 1);
			markEdited();
			drawRules();
			drawSheet();
			const nextTrash = pickAll('[data-fb-rule-del]', ui.rules)[Math.min(position, record.rules.length - 1)];
			(nextTrash || pick('[data-fb-rule-add]', ui.rulesEmpty)).focus();
			raiseToast({
				tone: 'primary',
				icon: 'bi-trash3',
				title: 'Rule deleted',
				text: `${describeRule(rule, record)}.`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							record.rules.splice(position, 0, rule);
							markEdited();
							if (current() === record) {
								drawRules();
								drawSheet();
							}
						},
					},
				],
			});
		});
	}

	/* Share: the link, the embed code and the after-send options. */

	function publicLink(record) {
		return SAMPLE.brand.linkRoot + urlName(record.name);
	}

	function embedSnippet(record, style) {
		const handle = urlName(record.name);
		const loader = `<script src="${SAMPLE.brand.embedSrc}" async></script>`;
		if (style === 'button')
			return `<button type="button" data-fieldline-form="${handle}" data-fieldline-form-popup>\n  ${record.title || record.name}\n</button>\n${loader}`;
		return `<div data-fieldline-form="${handle}"></div>\n${loader}`;
	}

	function fillShare() {
		const record = current();
		if (!record) return;
		const isDraft = record.status === 'draft';
		const notes = {
			draft: 'This form is a draft. Until it is published, the link shows a "not open yet" page.',
			closed: 'This form is closed. The link still works, but says it is not taking responses.',
		};
		syncing = true;
		ui.link.value = publicLink(record);
		ui.embed.textContent = embedSnippet(record, pick('input[name="fbEmbed"]:checked')?.value);
		ui.accepting.checked = record.status === 'live';
		ui.accepting.disabled = isDraft;
		pick('[data-fb-open-help]').textContent = isDraft
			? 'Publish the form first, then this turns on.'
			: 'Turn it off and the link says the form is closed.';
		ui.shareNote.hidden = !notes[record.status];
		pick('[data-fb-share-note-text]').textContent = notes[record.status] || '';
		pick('#fb-thanks').value = record.thanks || '';
		ui.recipients.basaltTags?.set(record.notify || []);
		pick('[data-fb-notify-err]').hidden = true;
		ui.capOn.checked = record.limit != null;
		ui.capBox.hidden = record.limit == null;
		ui.cap.value = record.limit ?? 50;
		pick('#fb-close-on').value = record.closeOn || '';
		drawCapNote();
		syncing = false;
	}

	function drawCapNote() {
		const record = current();
		const received = (session.tallies[record.id] || { total: 0 }).total;
		const left = record.limit != null ? Math.max(0, record.limit - received) : 0;
		pick('[data-fb-limit-left]').textContent =
			record.limit != null ? `${count(received, 'response')} so far, ${left} left` : '';
	}

	function wireShare() {
		pick('[data-fb-embed-kind]').addEventListener('change', () => fillShare());
		ui.accepting.addEventListener('change', () => {
			if (!syncing) setAccepting(ui.accepting.checked);
		});
		pick('#fb-thanks').addEventListener('input', (event) => {
			current().thanks = event.target.value;
			markEdited({ list: false });
		});
		pick('#fb-close-on').addEventListener('change', (event) => {
			current().closeOn = event.target.value;
			markEdited({ list: false });
		});
		ui.capOn.addEventListener('change', () => {
			if (syncing) return;
			current().limit = ui.capOn.checked ? Number(ui.cap.value) || 50 : null;
			ui.capBox.hidden = !ui.capOn.checked;
			drawCapNote();
			markEdited({ list: false });
		});
		ui.cap.addEventListener('change', () => {
			if (syncing || !ui.capOn.checked) return;
			current().limit = Number(ui.cap.value);
			drawCapNote();
			markEdited({ list: false });
		});

		/* Each address is checked as it goes in; one that is not an email is taken out again. */
		pick('#fb-notify-input').addEventListener('change', () => {
			if (syncing || !ui.recipients.basaltTags || !current()) return;
			const entered = ui.recipients.basaltTags.get();
			const valid = entered.filter(looksLikeEmail);
			const rejected = entered.filter((address) => !looksLikeEmail(address));
			const errorLine = pick('[data-fb-notify-err]');
			if (rejected.length) {
				syncing = true;
				ui.recipients.basaltTags.set(valid);
				syncing = false;
				errorLine.textContent = `“${rejected[0]}” is not an email address, so it was left off.`;
				errorLine.hidden = false;
			} else {
				errorLine.hidden = true;
			}
			const record = current();
			if (JSON.stringify(valid) !== JSON.stringify(record.notify || [])) {
				record.notify = valid;
				markEdited({ list: false });
			}
		});
		ui.recipients.addEventListener('basalt:tags-duplicate', (event) => {
			const errorLine = pick('[data-fb-notify-err]');
			errorLine.textContent = `${event.detail.value} is on the list already.`;
			errorLine.hidden = false;
		});
	}

	/* The New form dialog. */

	function drawStarters() {
		pick('[data-fb-templates]').innerHTML = STARTERS.map(
			(starter, index) =>
				`<input id="fb-tpl-${index}" type="radio" name="fbTemplate" value="${starter.key}"${index === 0 ? ' checked' : ''} class="btn-check"><label for="fb-tpl-${index}" class="fb-tpl"><span aria-hidden="true" class="fb-tpl-icon"><i class="bi ${starter.glyph}"></i></span><span class="fb-tpl-name">${htmlSafe(starter.title)}</span><span class="fb-tpl-note">${htmlSafe(starter.blurb)}</span></label>`,
		).join('');
	}

	function wireNewForm() {
		const nameError = pick('[data-fb-new-err]');
		pick('[data-fb-templates]').addEventListener('change', (event) => {
			const starter = STARTERS.find((entry) => entry.key === event.target.value);
			if (!nameEdited) ui.newName.value = starter.key === 'blank' ? '' : starter.title;
		});
		ui.newName.addEventListener('input', () => {
			nameEdited = !!ui.newName.value;
			if (!ui.newName.value.trim()) return;
			nameError.hidden = true;
			ui.newName.classList.remove('is-invalid');
			ui.newName.removeAttribute('aria-invalid');
		});
		ui.newDialog.addEventListener('show.bs.modal', () => {
			nameEdited = false;
			ui.newName.value = '';
			ui.newName.classList.remove('is-invalid');
			nameError.hidden = true;
			pick('#fb-tpl-0').checked = true;
		});
		ui.newDialog.addEventListener('shown.bs.modal', () => pick('#fb-tpl-0').focus());
		pick('[data-fb-new-form]').addEventListener('submit', (event) => {
			event.preventDefault();
			const name = ui.newName.value.trim();
			if (!name) {
				nameError.hidden = false;
				ui.newName.classList.add('is-invalid');
				ui.newName.setAttribute('aria-invalid', 'true');
				ui.newName.focus();
				return;
			}
			createForm(name);
		});
	}

	/** Builds a draft from the chosen starter and opens it on the Build tab. */
	function createForm(name) {
		const chosenKey = pick('input[name="fbTemplate"]:checked')?.value;
		const starter = STARTERS.find((entry) => entry.key === chosenKey) || STARTERS[0];
		const source = starter.copies ? SAMPLE.forms.find((sample) => sample.id === starter.copies) : null;
		const isBlank = starter.key === 'blank';
		/* Copied questions get fresh ids; the rules follow them to the new ids.
       A sample's deliberately unfinished choice question stays behind. */
		const renamed = {};
		const questions = (source ? source.fields : starter.questions || [])
			.filter((field) => !source || !CHOICE_KINDS.includes(field.type) || (field.options || []).length >= 2)
			.map((field) => {
				const fresh = { ...copyOf(field), id: freshId('f') };
				if (field.id) renamed[field.id] = fresh.id;
				if (!fresh.label) fresh.label = FIELD_KINDS[fresh.type].prompt;
				return fresh;
			});
		const rules = source
			? source.rules
					.filter((rule) => renamed[rule.show] && renamed[rule.when])
					.map((rule) => ({
						...copyOf(rule),
						id: freshId('r'),
						show: renamed[rule.show],
						when: renamed[rule.when],
					}))
			: [];
		const record = {
			id: freshId('form'),
			name,
			icon: isBlank ? 'bi-ui-checks-grid' : starter.glyph,
			status: 'draft',
			edited: stamp(),
			title: source ? source.title : isBlank ? name : starter.title,
			intro: source ? source.intro : '',
			submitLabel: source ? source.submitLabel : 'Send',
			thanks: source ? source.thanks : 'Thanks, we have got it and will be in touch.',
			notify: [],
			limit: starter.cap || null,
			closeOn: '',
			fields: questions,
			rules,
		};
		session.forms.unshift(record);
		session.inbox[record.id] = [];
		tally(record.id);
		backend.putForm(record);
		bootstrap.Modal.getOrCreateInstance(ui.newDialog).hide();
		visit(record.id);
		showTab('build');
		switchStage('edit');
		raiseToast({
			tone: 'success',
			title: `“${name}” created`,
			text: questions.length
				? 'It is a draft. Change what you need, then publish it.'
				: 'Drag a few fields onto it to begin.',
		});
		setTimeout(() => {
			const landing = questions.length ? pick('[data-fb-field="edit"]', ui.fields) : pick('.fb-tool');
			landing?.focus();
		}, 380);
	}

	/* Responses: the summary, the table and the CSV. */

	function activeTabName() {
		return pick('.fb-tabs .nav-link.active')?.getAttribute('data-fb-tab') ?? 'build';
	}

	/** The questions that make good columns: a name, an email and the first choice. */
	function keyQuestions(record) {
		const questions = record.fields.filter((field) => field.type !== 'heading');
		return {
			name:
				questions.find((field) => field.type === 'text' && /name/i.test(field.label || '')) ||
				questions.find((field) => field.type === 'text'),
			email: questions.find((field) => field.type === 'email'),
			pick: questions.find((field) => ['select', 'radio', 'rating'].includes(field.type)),
		};
	}

	function asText(answer) {
		if (Array.isArray(answer)) return answer.join(', ');
		if (answer === true) return 'Yes';
		if (answer === false) return 'No';
		return answer == null ? '' : String(answer);
	}

	function sender(record, entry) {
		const columns = keyQuestions(record);
		const name = columns.name && entry.answers[columns.name.id];
		const email = columns.email && entry.answers[columns.email.id];
		return { name: name || email || 'Someone, no name given', email: name ? email : '' };
	}

	function ensureResponses(record) {
		if (session.inbox[record.id] && fetched.has(record.id)) return Promise.resolve();
		ui.inboxLoading.hidden = false;
		ui.inboxBody.hidden = true;
		ui.inboxEmpty.hidden = true;
		return backend.fetchResponses(record.id).then((entries) => {
			fetched.add(record.id);
			session.inbox[record.id] = entries;
			tally(record.id);
			ui.inboxLoading.hidden = true;
		});
	}

	function drawResponses() {
		const record = current();
		if (!record) return;
		if (!session.inbox[record.id] || !fetched.has(record.id)) {
			ensureResponses(record).then(() => {
				if (current() === record) drawResponses();
			});
			return;
		}
		const entries = session.inbox[record.id];
		ui.inboxLoading.hidden = true;
		ui.inboxEmpty.hidden = !!entries.length;
		ui.inboxBody.hidden = !entries.length;
		pick('[data-fb-resp-empty-text]').textContent =
			record.status === 'draft'
				? 'This form is still a draft. Publish it and share the link, or send a test to see how answers arrive.'
				: 'Answers land here the moment someone sends the form. Share the link to get the first one.';
		if (entries.length) {
			drawSummary(record, entries);
			drawTable();
		}
		drawHeader();
	}

	function drawSummary(record, entries) {
		const thisWeek = entries.filter((entry) => ageInDays(new Date(entry.at)) < 7).length;
		const lastWeek = entries.filter((entry) => {
			const age = ageInDays(new Date(entry.at));
			return age >= 7 && age < 14;
		}).length;
		const unread = entries.filter((entry) => !entry.read).length;
		const change = thisWeek - lastWeek;
		const trend =
			change === 0
				? 'same as the week before'
				: `${change > 0 ? `${change} more` : `${-change} fewer`} than the week before`;
		const figures = [
			figureTile(entries.length, 'responses in all', ''),
			figureTile(thisWeek, 'in the last 7 days', trend),
			figureTile(
				unread,
				'not read yet',
				unread
					? '<button data-fb-show-new type="button" class="btn btn-link btn-sm fb-link p-0">Show them</button>'
					: 'all caught up',
			),
		].join('');
		const glance = `<section aria-labelledby="fb-glance-title" class="fb-block fb-block-glance"><h4 id="fb-glance-title" class="fb-block-title">At a glance</h4><dl class="fb-figs">${figures}</dl><p id="fb-days-title" class="fb-days-title">Responses a day, last two weeks</p><ol aria-labelledby="fb-days-title" class="fb-days">${dayBars(entries)}</ol></section>`;
		const choiceQuestions = record.fields
			.filter((field) => CHOICE_KINDS.includes(field.type) || field.type === 'rating')
			.slice(0, 3);
		ui.summary.innerHTML =
			glance + choiceQuestions.map((question, order) => choiceBreakdown(question, order, entries)).join('');
	}

	function figureTile(value, label, note) {
		return `<div class="fb-fig"><dt class="fb-fig-label">${label}</dt><dd class="fb-fig-value">${value}</dd>${note ? `<dd class="fb-fig-note">${note}</dd>` : ''}</div>`;
	}

	/* Fourteen days of bars, oldest on the left and today last. */
	function dayBars(entries) {
		const days = Array.from({ length: 14 }, (_, offset) => {
			const date = new Date(CLOCK.getTime() - (13 - offset) * DAY_MS);
			return {
				date,
				total: entries.filter((entry) => calendarKey(new Date(entry.at)) === calendarKey(date)).length,
			};
		});
		const tallest = Math.max(1, ...days.map((day) => day.total));
		return days
			.map(({ date, total }, index) => {
				const lastBar = index === 13;
				const shortLabel = lastBar ? 'Today' : index % 2 ? '' : WEEKDAY_ABBR[date.getDay()];
				const fullLabel = lastBar
					? 'today'
					: `${WEEKDAY_ABBR[date.getDay()]} ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
				return `<li class="fb-days-day${lastBar ? ' is-today' : ''}"><span class="fb-days-n">${total}</span><span aria-hidden="true" style="--h:${Math.round((total / tallest) * 100)}%" class="fb-days-bar"></span><span class="fb-days-d"><span aria-hidden="true">${shortLabel}</span><span class="visually-hidden">${fullLabel}</span></span></li>`;
			})
			.join('');
	}

	/* How the answers to one choice or rating question split. */
	function choiceBreakdown(question, order, entries) {
		const answered = entries.filter((entry) => !isEmpty(entry.answers[question.id]));
		const isRating = question.type === 'rating';
		const choices = isRating ? ['5', '4', '3', '2', '1'] : question.options || [];
		const hits = choices.map(
			(choice) =>
				answered.filter((entry) => {
					const answer = entry.answers[question.id];
					return Array.isArray(answer) ? answer.includes(choice) : String(answer) === choice;
				}).length,
		);
		const widest = Math.max(1, ...hits);
		const average =
			isRating && answered.length
				? (
						answered.reduce((sum, entry) => sum + Number(entry.answers[question.id]), 0) / answered.length
					).toFixed(1)
				: '';
		const rows = choices
			.map((choice, index) => {
				const share = answered.length ? Math.round((hits[index] / answered.length) * 100) : 0;
				return `<li class="fb-bars-row"><span class="fb-bars-label">${isRating ? count(Number(choice), 'star') : htmlSafe(choice)}</span><span aria-hidden="true" class="fb-bars-track"><span style="--w:${Math.round((hits[index] / widest) * 100)}%" class="fb-bars-fill"></span></span><span class="fb-bars-n">${hits[index]} <span class="fb-bars-pct">(${share}%)</span></span></li>`;
			})
			.join('');
		const description = `${count(answered.length, 'answer')}${question.type === 'checkbox' ? ', more than one allowed' : ''}${average ? `, ${average} stars on average` : ''}`;
		return `<section aria-labelledby="fb-q-${order}" class="fb-block fb-block-q"><h4 id="fb-q-${order}" class="fb-block-title">${htmlSafe(wordingOf(question))}</h4><p class="fb-block-desc">${description}</p><ul class="fb-bars">${rows}</ul></section>`;
	}

	/** Responses that pass the current search and the All / Not read switch. */
	function matching() {
		const needle = table.query.toLowerCase();
		return (session.inbox[current().id] || []).filter((entry) => {
			if (table.show === 'new' && entry.read) return false;
			return (
				!needle || Object.values(entry.answers).some((answer) => asText(answer).toLowerCase().includes(needle))
			);
		});
	}

	function drawTable() {
		const record = current();
		const columns = keyQuestions(record);
		table.rows = matching();
		const rows = table.rows;
		const pageCount = Math.max(1, Math.ceil(rows.length / table.perPage));
		table.page = Math.min(table.page, pageCount);
		const offset = (table.page - 1) * table.perPage;
		const nothing = !rows.length;

		ui.tableHead.innerHTML = `<tr><th scope="col">From</th>${columns.pick ? `<th scope="col" class="fb-col-pick">${htmlSafe(wordingOf(columns.pick))}</th>` : ''}<th scope="col" class="fb-col-when">Received</th><th scope="col">Status</th></tr>`;
		ui.tableRows.innerHTML = rows
			.slice(offset, offset + table.perPage)
			.map((entry, index) => responseRow(record, columns, entry, offset + index))
			.join('');
		ui.noMatch.hidden = !nothing;
		pick('[data-fb-nomatch-title]').textContent = table.query
			? `Nothing matches “${table.query}”`
			: 'Everything is read';
		ui.pager.hidden = nothing;
		ui.tableRows.closest('table').hidden = nothing;
		ui.range.innerHTML = nothing
			? ''
			: `<strong>${offset + 1}–${Math.min(rows.length, offset + table.perPage)}</strong> of ${count(rows.length, 'response')}`;

		if (pagination) {
			pagination.setTotal(pageCount);
			if (pagination.get() !== table.page) pagination.set(table.page);
		} else if (window.Basalt.pagination) {
			pagination = window.Basalt.pagination(ui.pages, {
				total: pageCount,
				current: table.page,
				label: 'Page',
				onChange: (page) => {
					table.page = page;
					drawTable();
				},
			});
		}
	}

	function responseRow(record, columns, entry, position) {
		const who = sender(record, entry);
		const pickedAnswer = columns.pick ? asText(entry.answers[columns.pick.id]) : '';
		const pickedText = columns.pick?.type === 'rating' ? count(Number(pickedAnswer), 'star') : pickedAnswer;
		const pickCell = columns.pick
			? `<td class="fb-col-pick">${pickedAnswer ? htmlSafe(pickedText) : '<span class="fb-quiet">No answer</span>'}</td>`
			: '';
		const received = htmlSafe(receivedAt(entry.at));
		const whoCell = `<div class="fb-who"><span aria-hidden="true" style="--fb-tone: var(--basalt-series-${(who.name.length % 8) + 1})" class="fb-av">${htmlSafe(monogram(who.name))}</span><span class="fb-who-text"><button data-fb-open="${position}" type="button" class="fb-who-name">${htmlSafe(who.name)}</button>${who.email ? `<span class="fb-who-sub">${htmlSafe(who.email)}</span>` : ''}<span class="fb-who-sub fb-who-when">${received}</span></span></div>`;
		return `<tr data-fb-row="${position}" class="fb-row${entry.read ? '' : ' is-unread'}"><td>${whoCell}</td>${pickCell}<td class="fb-nowrap fb-col-when">${received}</td><td class="fb-nowrap">${readBadges(entry)}</td></tr>`;
	}

	function readBadges(entry) {
		const state = entry.read
			? '<span class="basalt-status">Read</span>'
			: '<span class="basalt-status basalt-status-dot basalt-status-primary">New</span>';
		return state + (entry.test ? ' <span class="basalt-status basalt-status-warning">Test</span>' : '');
	}

	/** Sets All or Not read from script and lets the segmented thumb catch up. */
	function setInboxFilter(show) {
		pick('#fb-resp-all').checked = show !== 'new';
		pick('#fb-resp-new').checked = show === 'new';
		pick('[data-fb-resp-filter]').dispatchEvent(new Event('change'));
	}

	function wireResponses() {
		ui.search.addEventListener('input', () => {
			clearTimeout(typingPause);
			typingPause = setTimeout(() => {
				table.query = ui.search.value.trim();
				table.page = 1;
				drawTable();
				announce(table.rows.length ? `${count(table.rows.length, 'response')} found.` : 'Nothing matches.');
			}, 160);
		});
		pick('[data-fb-resp-filter]').addEventListener('change', () => {
			table.show = pick('input[name="fbRespFilter"]:checked')?.value || 'all';
			table.page = 1;
			if (current()) drawTable();
		});
		pick('[data-fb-resp-clear]').addEventListener('click', () => {
			table.query = '';
			ui.search.value = '';
			setInboxFilter('all');
			ui.search.focus();
		});
		ui.summary.addEventListener('click', (event) => {
			if (!event.target.closest('[data-fb-show-new]')) return;
			setInboxFilter('new');
			ui.tableRows
				.closest('section')
				.scrollIntoView({ block: 'start', behavior: calmMotion() ? 'auto' : 'smooth' });
			pick('[data-fb-open]', ui.tableRows)?.focus({ preventScroll: true });
		});
		/* The whole row opens the response; the name button is the keyboard route. */
		ui.tableRows.addEventListener('click', (event) => {
			const row = event.target.closest('[data-fb-row]');
			if (row) openRecord(Number(row.getAttribute('data-fb-row')));
		});
		pick('[data-fb-goto-share]').addEventListener('click', () => showTab('share'));
		pick('[data-fb-export]').addEventListener('click', () => downloadCsv(current()));

		pick('[data-fb-read-new]').addEventListener('click', () => {
			const unreadOf = (record) => session.tallies[record.id]?.unread || 0;
			let busiest = null;
			for (const record of session.forms) {
				if (!busiest || unreadOf(record) > unreadOf(busiest)) busiest = record;
			}
			if (!busiest) return;
			visit(busiest.id);
			setInboxFilter(unreadOf(busiest) ? 'new' : 'all');
			showTab('responses');
		});
	}

	/** Builds a CSV of every response to a form in the browser and downloads it. */
	function downloadCsv(record) {
		const entries = session.inbox[record.id] || [];
		const questions = record.fields.filter((field) => field.type !== 'heading');
		const quote = (value) => `"${asText(value).replace(/"/g, '""')}"`;
		const header = ['Received', 'Read', ...questions.map(wordingOf)];
		const body = entries.map((entry) => [
			entry.at.slice(0, 16).replace('T', ' '),
			entry.read ? 'Yes' : 'No',
			...questions.map((field) => entry.answers[field.id]),
		]);
		const csv = [header, ...body].map((cells) => cells.map(quote).join(',')).join('\r\n');
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		link.download = `${urlName(record.name)}-responses.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		raiseToast({
			tone: 'success',
			title: 'CSV downloaded',
			text: `${count(entries.length, 'response')} from “${record.name}”.`,
		});
	}

	/* The side panel that shows one response in full. */

	function openRecord(position) {
		const rows = table.rows.length ? table.rows : matching();
		if (!rows.length) return;
		table.cursor = Math.max(0, Math.min(position, rows.length - 1));
		drawRecord();
		bootstrap.Offcanvas.getOrCreateInstance(ui.recordPanel).show();
	}

	function drawRecord() {
		const record = current();
		const entry = table.rows[table.cursor];
		if (!entry) return;
		const who = sender(record, entry);
		const visible = shownIds(record, entry.answers);
		const emailQuestion = keyQuestions(record).email;
		const replyTo = (emailQuestion && entry.answers[emailQuestion.id]) || '';
		pick('[data-fb-r="av"]').textContent = monogram(who.name);
		pick('[data-fb-r="name"]').textContent = who.name;
		pick('[data-fb-r="sub"]').textContent = `${receivedAt(entry.at)}${entry.test ? ' · test from Try it' : ''}`;
		pick('[data-fb-r="pos"]').textContent = `${table.cursor + 1} of ${table.rows.length}`;
		const lines = record.fields
			.filter((field) => field.type !== 'heading' && visible.has(field.id))
			.map(
				(field) =>
					`<div class="fb-answers-row"><dt>${htmlSafe(wordingOf(field))}</dt><dd>${answerMarkup(field, entry.answers[field.id])}</dd></div>`,
			)
			.join('');
		pick('[data-fb-r="body"]').innerHTML = `<dl class="fb-answers">${lines}</dl>`;

		const reply = pick('[data-fb-r-reply]');
		reply.hidden = !who.email && !replyTo;
		reply.href = replyTo
			? `mailto:${replyTo}?subject=${encodeURIComponent(`Re: ${record.title || record.name}`)}`
			: '#';

		if (entry.read) return;
		entry.read = true;
		backend.patchResponse(entry.id, { read: true });
		tally(record.id);
		drawFormList();
		drawHeader();
		const row = pick(`[data-fb-row="${table.cursor}"]`, ui.tableRows);
		if (row) {
			row.classList.remove('is-unread');
			row.lastElementChild.innerHTML = readBadges(entry);
		}
	}

	function answerMarkup(field, answer) {
		if (isEmpty(answer)) return '<span class="fb-quiet">No answer</span>';
		if (field.type === 'rating') {
			const stars = [1, 2, 3, 4, 5]
				.map(
					(score) =>
						`<i aria-hidden="true" class="bi ${score <= Number(answer) ? 'bi-star-fill' : 'bi-star'}"></i>`,
				)
				.join('');
			return `<span role="img" aria-label="${count(Number(answer), 'star')} of 5" class="fb-stars-read">${stars}</span>`;
		}
		if (field.type === 'email') return `<a href="mailto:${htmlSafe(answer)}">${htmlSafe(answer)}</a>`;
		return htmlSafe(asText(answer)).replace(/\n/g, '<br>');
	}

	function stepRecord(direction) {
		const total = table.rows.length;
		if (!total) return;
		table.cursor = (table.cursor + direction + total) % total;
		drawRecord();
	}

	function wireRecordPanel() {
		for (const button of pickAll('[data-fb-r-step]')) {
			button.addEventListener('click', () => stepRecord(Number(button.getAttribute('data-fb-r-step'))));
		}
		ui.recordPanel.addEventListener('keydown', (event) => {
			if (!event.altKey) return;
			const direction = { ArrowUp: -1, ArrowDown: 1 }[event.key];
			if (!direction) return;
			event.preventDefault();
			stepRecord(direction);
		});
		ui.recordPanel.addEventListener('hidden.bs.offcanvas', () => {
			if (!current() || shownView !== 'editor' || activeTabName() !== 'responses') return;
			drawSummary(current(), session.inbox[current().id]);
			drawTable();
			const returnTo =
				pick(`[data-fb-open="${table.cursor}"]`, ui.tableRows) || pick('[data-fb-open]', ui.tableRows);
			returnTo?.focus();
		});
		pick('[data-fb-r-unread]').addEventListener('click', () => {
			const entry = table.rows[table.cursor];
			if (!entry) return;
			entry.read = false;
			backend.patchResponse(entry.id, { read: false });
			tally(current().id);
			drawFormList();
			drawHeader();
			bootstrap.Offcanvas.getOrCreateInstance(ui.recordPanel).hide();
			announce('Marked as not read.');
		});
		pick('[data-fb-r-del]').addEventListener('click', () => {
			const record = current();
			const entry = table.rows[table.cursor];
			if (!entry) return;
			const entries = session.inbox[record.id];
			const position = entries.indexOf(entry);
			entries.splice(position, 1);
			backend.removeResponse(entry.id);
			tally(record.id);
			bootstrap.Offcanvas.getOrCreateInstance(ui.recordPanel).hide();
			drawFormList();
			drawResponses();
			raiseToast({
				tone: 'primary',
				icon: 'bi-trash3',
				title: 'Response deleted',
				text: `From ${sender(record, entry).name}.`,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							entries.splice(position, 0, entry);
							backend.putBackResponse(entry);
							tally(record.id);
							drawFormList();
							if (current() === record) drawResponses();
							announce('Response put back.');
						},
					},
				],
			});
		});
	}

	/* Two screens, the list and the editor, kept in the address bar
     (#forms or #form-<id>) so Back and Forward move between them. */

	function wireRouting() {
		window.addEventListener('hashchange', () => {
			if (booted) followHash();
		});
		pick('[data-fb-tab="responses"]').addEventListener('shown.bs.tab', drawResponses);
		pick('[data-fb-tab="share"]').addEventListener('shown.bs.tab', fillShare);
		pick('[data-fb-tab="logic"]').addEventListener('shown.bs.tab', drawRules);
	}

	/** Puts a form in the editor with a clean slate: nothing picked, no search. */
	function loadIntoEditor(formId) {
		const record = session.forms.find((kept) => kept.id === formId);
		if (!record) return;
		session.open = record;
		session.picked = null;
		ui.build.classList.remove('has-settings');
		Object.assign(table, { query: '', page: 1, cursor: -1, show: 'all' });
		ui.search.value = '';
		pick('#fb-resp-all').checked = true;
		pick('#fb-resp-new').checked = false;
		ui.work.removeAttribute('aria-busy');
		ui.blockers.hidden = true;
		if (!ui.renameForm.hidden) {
			ui.renameForm.hidden = true;
			ui.titleRow.hidden = false;
		}
		ui.saved.classList.remove('is-saving');
		ui.savedText.textContent = 'All changes saved';
		drawFormList();
		drawHeader();
		drawSheet();
		fillSettings();
		drawRules();
		fillShare();
		if (session.stageMode === 'preview') drawTryIt();
		if (activeTabName() === 'responses') drawResponses();
	}

	function showScreen(next, how) {
		const previous = shownView;
		shownView = next;
		ui.editor.hidden = next !== 'editor';
		if (next === 'list') {
			for (const panel of [ui.settingsPanel, ui.addPanel, ui.recordPanel]) closePanel(panel);
			drawFormList();
		} else {
			ui.list.hidden = true;
			ui.none.hidden = true;
		}
		if (!previous || previous === next || how?.quiet) return;
		window.scrollTo({ top: 0, behavior: 'auto' });
		(next === 'list' ? ui.listTitle : ui.title).focus({ preventScroll: true });
	}

	function idFromHash() {
		const match = location.hash.match(/^#form-(.+)$/);
		return match ? decodeURIComponent(match[1]) : null;
	}

	/** Opens a form in the editor and gives it its own address. */
	function visit(formId) {
		if (!session.forms.some((kept) => kept.id === formId)) return;
		if (current()?.id !== formId) loadIntoEditor(formId);
		showScreen('editor');
		const hash = `#form-${encodeURIComponent(formId)}`;
		if (location.hash !== hash) location.hash = hash;
		announce(`Opened ${current().name}.`);
	}

	/** Shows whatever the address names: after Back, Forward, a link or a bookmark. */
	function followHash(how) {
		const formId = idFromHash();
		const record = formId && session.forms.find((kept) => kept.id === formId);
		if (!record) {
			showScreen('list', how);
			return;
		}
		if (current() !== record) loadIntoEditor(record.id);
		showScreen('editor', how);
	}

	function showTab(name) {
		const button = pick(`[data-fb-tab="${name}"]`);
		if (button && window.bootstrap) bootstrap.Tab.getOrCreateInstance(button).show();
	}

	/* Small lookups over the open form. */

	function current() {
		return session.open;
	}

	function fieldWithId(fieldId, within) {
		return (within || current())?.fields.find((field) => field.id === fieldId);
	}

	function kindOf(field) {
		return FIELD_KINDS[field.type] || FIELD_KINDS.text;
	}

	function wordingOf(field) {
		return field?.label?.trim() || 'Untitled question';
	}

	/* The invented responses. */

	/** A small seeded generator (mulberry32) with the helpers the answer makers use. */
	function seededDice(seed) {
		let state = seed >>> 0;
		function roll() {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		}
		function int(low, high) {
			return low + Math.floor(roll() * (high - low + 1));
		}
		return {
			roll,
			int,
			pick: (list) => list[Math.floor(roll() * list.length)],
			chance: (odds) => roll() < odds,
			/* Between low and high distinct items, kept in the list's own order. */
			some(list, low, high) {
				const wanted = int(low, high);
				const remaining = [...list];
				const taken = [];
				while (taken.length < wanted && remaining.length)
					taken.push(remaining.splice(Math.floor(roll() * remaining.length), 1)[0]);
				return list.filter((item) => taken.includes(item));
			},
		};
	}

	function inventResponses() {
		const dice = seededDice(20260930);
		const invented = [];
		for (const sample of SAMPLE.forms) {
			const answersFor = INVENTED_ANSWERS[sample.id];
			const howMany = SAMPLE.volumes[sample.id] || 0;
			if (!answersFor) continue;
			for (let index = 0; index < howMany; index++) {
				/* Raising to 1.6 crowds the dates toward today, as real traffic would. */
				const daysBack = Math.floor(Math.pow(dice.roll(), 1.6) * 60);
				const at = new Date(CLOCK.getTime() - daysBack * DAY_MS);
				at.setHours(dice.int(7, 21), dice.int(0, 59), 0, 0);
				if (at > CLOCK) at.setTime(CLOCK.getTime() - dice.int(10, 300) * 60000);
				const given = dice.pick(SAMPLE.crowd.given);
				const family = dice.pick(SAMPLE.crowd.family);
				const company = dice.pick(SAMPLE.crowd.businesses);
				const person = {
					name: `${given} ${family}`,
					company,
					email: `${`${given}.${family}`.toLowerCase()}@${urlName(company).replace(/-/g, '')}.com`,
					phone: `07${String(dice.int(100, 999))} ${String(dice.int(100000, 999999))}`,
				};
				const answers = answersFor(person, dice);
				invented.push({
					id: `${sample.id}-${index}`,
					formId: sample.id,
					at: at.toISOString(),
					answers,
					read: daysBack > 3 || dice.chance(0.25),
					test: false,
				});
			}
		}
		return invented.sort((a, b) => (a.at < b.at ? 1 : -1));
	}

	/* Dates, all measured from the sample's frozen clock. */

	function stamp() {
		tick += 60000;
		return new Date(CLOCK.getTime() + tick).toISOString();
	}

	function calendarKey(date) {
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	function clockTime(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}${hours < 12 ? ' am' : ' pm'}`;
	}

	function ageInDays(date) {
		const today = new Date(CLOCK.getFullYear(), CLOCK.getMonth(), CLOCK.getDate());
		const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		return Math.round((today - day) / DAY_MS);
	}

	/* "Today, 9:05 am", "Yesterday, ..." or "Sep 12, ..." */
	function receivedAt(iso) {
		const date = new Date(iso);
		const age = ageInDays(date);
		if (age <= 0) return `Today, ${clockTime(date)}`;
		if (age === 1) return `Yesterday, ${clockTime(date)}`;
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${clockTime(date)}`;
	}

	/* "today", "yesterday" or "Sep 12" */
	function editedOn(iso) {
		const date = new Date(iso);
		const age = ageInDays(date);
		if (age <= 0) return 'today';
		if (age === 1) return 'yesterday';
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/* General helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function calmMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
	}

	function copyOf(value) {
		return JSON.parse(JSON.stringify(value));
	}

	/* "1 response", "3 responses". */
	function count(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function spelled(amount) {
		return NUMBER_WORDS[amount] || String(amount);
	}

	function isEmpty(answer) {
		if (answer == null || answer === false) return true;
		return Array.isArray(answer) ? !answer.length : String(answer).trim() === '';
	}

	function looksLikeEmail(text) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text);
	}

	function monogram(name) {
		const letters = String(name || '?')
			.split(/\s+/)
			.filter(Boolean)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
		return letters || '?';
	}

	function urlName(text) {
		const slugged = String(text)
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
		return slugged || 'form';
	}

	function freshId(prefix) {
		const id = `${prefix}${Date.now().toString(36)}${serial.toString(36)}`;
		serial += 1;
		return id;
	}

	/** Resolves with `value` after `ms`, or almost at once when motion is reduced. */
	function settle(value, ms) {
		return new Promise((resolve) => {
			setTimeout(() => resolve(value), calmMotion() ? Math.min(ms, 120) : ms);
		});
	}

	function announce(text) {
		window.Basalt.announce?.(text);
	}

	function raiseToast(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function setBusy(button, mode, text) {
		window.Basalt.buttonState?.(button, mode, text);
	}
})();
