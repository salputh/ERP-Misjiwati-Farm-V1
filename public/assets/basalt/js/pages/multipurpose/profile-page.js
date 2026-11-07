/**
 * Behavior for the signed-in person's own page, my-profile.html. The card,
 * status, about box, contact list and working hours each open into a small
 * form right where they sit; saving redraws that part of the page and leaves
 * a toast with an Undo button. Everything it touches carries a
 * data-mine-* attribute.
 */
(() => {
	'use strict';

	const page = pick('[data-mine-page]', document);
	if (!page) return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const MINUTES_IN_DAY = 1440;
	const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
	const TIME_ZONES = {
		'America/Los_Angeles': 'Pacific Time',
		'America/Denver': 'Mountain Time',
		'America/Chicago': 'Central Time',
		'America/New_York': 'Eastern Time',
		'Europe/London': 'London',
		'Europe/Berlin': 'Berlin',
		'Asia/Kolkata': 'India',
		'Asia/Singapore': 'Singapore',
		'Australia/Sydney': 'Sydney',
	};

	/* The status a person can pick. The keys double as the radio values. */
	const MOODS = {
		available: { label: 'Available', icon: 'bi-check-circle', tone: 'success', hint: 'Around all day. Ask away.' },
		focus: { label: 'Focusing', icon: 'bi-headphones', tone: 'primary', hint: 'I reply to messages after 2 PM.' },
		meetings: { label: 'In meetings', icon: 'bi-people', tone: 'warning', hint: 'Back at my desk around 3 PM.' },
		away: { label: 'Away', icon: 'bi-clock', tone: 'muted', hint: 'Out for lunch.' },
		out: {
			label: 'Out of office',
			icon: 'bi-airplane',
			tone: 'danger',
			hint: 'Back Monday. Derek Haas covers on-call.',
		},
	};

	/* How long a status lasts; `ends` turns "now" into the moment it lapses. */
	const EXPIRY = {
		hour: { label: '1 hour', ends: (now) => now.getTime() + 3600e3 },
		four: { label: '4 hours', ends: (now) => now.getTime() + 4 * 3600e3 },
		today: { label: 'Today', ends: (now) => midnightAfter(now, 0) },
		week: { label: 'This week', ends: (now) => midnightAfter(now, (7 - now.getDay()) % 7) },
		never: { label: 'Never', ends: () => 0 },
	};

	const CHANNELS = {
		chat: { label: 'Chat', icon: 'bi-chat-dots', tone: 'primary' },
		email: { label: 'Email', icon: 'bi-envelope', tone: 'accent' },
		phone: { label: 'Phone', icon: 'bi-telephone', tone: 'success' },
	};

	const TOAST_LOOKS = {
		info: { tone: 'primary', icon: 'bi-info-circle-fill' },
		done: { tone: 'success', icon: 'bi-check-circle-fill' },
		warn: { tone: 'warning', icon: 'bi-exclamation-triangle-fill' },
	};

	const CARD_TEXT = ['name', 'pronouns', 'title', 'team', 'location'];
	const AVATAR_TINTS = [
		'is-brand',
		'is-tone-accent',
		'is-tone-success',
		'is-tone-warning',
		'is-tone-danger',
		'is-tone-primary',
	];
	const ENTRY_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const view = {
		avatar: pick('[data-mine-avatar]', page),
		pill: pick('[data-mine-status]', page),
		addStatus: pick('[data-mine-status-add]', page),
		skills: pick('[data-mine-skills]', page),
		contact: pick('[data-mine-contact]', page),
		now: pick('[data-mine-now]', page),
		time: pick('[data-mine-time]', page),
		week: pick('[data-mine-week]', page),
		extras: pick('[data-mine-extras]', page),
		localTime: pick('[data-mine-localtime]', page),
	};
	const shelf = document.createElement('div');
	const editors = {};
	let profile = null;

	start();

	function start() {
		shelf.className = 'mine-toasts';
		shelf.setAttribute('aria-live', 'polite');
		document.body.appendChild(shelf);

		profile = readProfileFromPage();

		mountCardEditor();
		mountPresenceEditor();
		mountIntroEditor();
		mountReachEditor();
		mountScheduleEditor();
		pick('[data-mine-share]', page).addEventListener('click', copyProfileLink);

		paintCard();
		paintPresence();
		paintIntro();
		paintReach();
		paintSchedule();

		/* The clock line goes stale, so it is redrawn every half minute, but only
       while the tab is on screen; coming back to the tab redraws it at once. */
		setInterval(refresh, 30000);
		document.addEventListener('visibilitychange', refresh);
	}

	/**
	 * The person as the page first shows them. A real product would fetch this
	 * from its account service; the text parts come from the markup so the
	 * script and the page always start out agreeing.
	 */
	function readProfileFromPage() {
		function shown(name) {
			return fieldNode(name).textContent.trim();
		}

		return {
			card: {
				name: shown('name'),
				pronouns: shown('pronouns'),
				title: shown('title'),
				team: shown('team'),
				location: shown('location'),
				tint: 'brand',
				picture: '',
			},
			intro: {
				bio: shown('bio'),
				topics: pickAll('[data-mine-skills] .mine-skill', page).map((chip) => chip.textContent.trim()),
			},
			reach: {
				chat: '@john.armstrong',
				email: 'john.armstrong@fieldline.app',
				phone: '+1 (503) 555-0142',
				preferred: 'chat',
			},
			presence: {
				mood: 'focus',
				note: pick('[data-mine-status-message]', page).textContent.trim(),
				expiry: 'week',
				endsAt: expiryMoment('week'),
			},
			schedule: {
				zone: 'America/Los_Angeles',
				workdays: [1, 2, 3, 4, 5],
				opens: 480,
				closes: 1020,
				focus: { enabled: true, from: 540, to: 690 },
				office: { enabled: true, weekday: 2, from: 840, to: 900 },
			},
		};
	}

	/* A lapsed status is dropped here too, unless its form is open. */
	function refresh() {
		if (document.hidden) return;
		const { endsAt } = profile.presence;
		const lapsed = endsAt && Date.now() >= endsAt;
		if (lapsed && !editors.status.isOpen) {
			profile.presence = blankPresence();
			paintPresence();
		}
		paintSchedule();
	}

	function copyProfileLink() {
		function copied() {
			return notify('Profile link copied. Anyone at Fieldline can open it.', 'done');
		}

		function blocked() {
			return notify('Your browser blocked the clipboard. Copy the address bar instead.', 'warn');
		}

		if (!navigator.clipboard?.writeText) {
			blocked();
			return;
		}
		navigator.clipboard.writeText(window.location.href).then(copied, blocked);
	}

	/* Section forms. Each one hands mountEditor a spec: how to fill the form
     from the profile, read it back, check it, and what to say once saved. */

	function mountCardEditor() {
		const form = pick('[data-mine-form="identity"]', page);
		const fileField = pick('[data-mine-photo-input]', form);
		const uploadButton = pick('[data-mine-photo-pick]', form);
		const dropButton = pick('[data-mine-photo-remove]', form);
		let draft = { tint: 'brand', picture: '' };

		mountEditor('identity', {
			noun: 'Your profile',
			focusName: 'name',
			current: () => profile.card,
			replace: (card) => {
				profile.card = deepCopy(card);
				paintCard();
			},
			load: (target) => {
				const { card } = profile;
				draft = { tint: card.tint, picture: card.picture };
				for (const key of CARD_TEXT) target.elements[key].value = card[key];
				for (const swatch of pickAll('input[name="color"]', target))
					swatch.checked = swatch.value === card.tint;
				preview();
			},
			collect: () => ({
				name: typed('name'),
				pronouns: typed('pronouns'),
				title: typed('title'),
				team: form.elements.team.value,
				location: typed('location'),
				tint: draft.tint,
				picture: draft.picture,
			}),
			afterClose: paintCard,
			confirmation: () => 'Profile saved. Mentions and the people list show it now.',
		});

		form.addEventListener('input', (event) => {
			if (event.target.name === 'name') preview();
		});
		for (const swatch of pickAll('input[name="color"]', form)) {
			swatch.addEventListener('change', () => {
				draft.tint = swatch.value;
				preview();
			});
		}
		uploadButton.addEventListener('click', () => fileField.click());
		fileField.addEventListener('change', takePhoto);
		dropButton.addEventListener('click', () => {
			draft.picture = '';
			preview();
			uploadButton.focus();
		});

		function typed(name) {
			return form.elements[name].value.trim();
		}

		/* While the form is open, the avatar next to it shows the draft. */
		function preview() {
			const name = typed('name') || profile.card.name;
			drawAvatar(name, draft.tint, draft.picture, dotTone(profile.presence));
			for (const sample of pickAll('[data-mine-swatch]', form)) sample.textContent = monogram(name);
			dropButton.hidden = !draft.picture;
		}

		function takePhoto() {
			const photo = fileField.files?.[0];
			fileField.value = '';
			if (!photo) return;
			if (!/^image\//.test(photo.type)) {
				notify('That file is not an image. Try a JPG or PNG.', 'warn');
				return;
			}
			if (photo.size > 5 * 1024 * 1024) {
				notify('Photos can be up to 5 MB.', 'warn');
				return;
			}
			const loader = new FileReader();
			loader.addEventListener('load', () => {
				draft.picture = loader.result;
				preview();
			});
			loader.readAsDataURL(photo);
		}
	}

	function mountPresenceEditor() {
		const form = pick('[data-mine-form="status"]', page);
		const noteBox = form.elements.message;
		const counter = pick('[data-mine-status-count]', form);

		pick('[data-mine-status-kinds]', form).innerHTML = Object.entries(MOODS)
			.map(
				([key, mood]) =>
					`<label class="basalt-choice is-tone-${mood.tone}"><input type="radio" name="kind" value="${key}"><span aria-hidden="true" class="mine-choice-icon"><i class="bi ${mood.icon}"></i></span>${mood.label}</label>`,
			)
			.join('');
		pick('[data-mine-status-clear]', form).innerHTML = Object.entries(EXPIRY)
			.map(
				([key, choice]) =>
					`<label class="basalt-choice"><input type="radio" name="clear" value="${key}">${choice.label}</label>`,
			)
			.join('');

		const editor = mountEditor('status', {
			noun: 'Your status',
			current: () => profile.presence,
			replace: (presence) => {
				profile.presence = deepCopy(presence);
				paintPresence();
			},
			load: (target) => {
				/* Someone with no status starts from Available, gone at midnight. */
				const { presence } = profile;
				target.elements.kind.value = presence.mood || 'available';
				target.elements.clear.value = presence.mood ? presence.expiry : 'today';
				noteBox.value = presence.note;
				updateNoteHelp();
			},
			collect: (target) => {
				const mood = target.elements.kind.value;
				const expiry = target.elements.clear.value;
				/* An untouched choice keeps its old end time, or saving an unchanged
           form would still count as a change. */
				const untouched = mood === profile.presence.mood && expiry === profile.presence.expiry;
				return {
					mood,
					note: noteBox.value.trim(),
					expiry,
					endsAt: untouched ? profile.presence.endsAt : expiryMoment(expiry),
				};
			},
			afterClose: paintPresence,
			confirmation: (presence) =>
				`Status set to ${MOODS[presence.mood].label.toLowerCase()}. ${expiryNote(presence.expiry, presence.endsAt)}`,
		});

		form.addEventListener('input', updateNoteHelp);
		form.addEventListener('change', updateNoteHelp);
		pick('[data-mine-status-reset]', form).addEventListener('click', () => {
			if (profile.presence.mood) editor.keep(blankPresence(), 'Status cleared.');
			else editor.close();
		});

		/* The placeholder suggests a note that suits the chosen status. */
		function updateNoteHelp() {
			noteBox.placeholder = MOODS[form.elements.kind.value].hint;
			counter.textContent = `${noteBox.value.length} / 80`;
		}
	}

	function mountIntroEditor() {
		const form = pick('[data-mine-form="about"]', page);
		const bioBox = form.elements.bio;
		const bioCounter = pick('[data-mine-bio-count]', form);
		/* basalt.js runs this tag box: adding, removing, the count and the cap. */
		const topicBox = pick('[data-mine-chip-input]', form);
		const topicEntry = pick('input', topicBox);

		topicBox.addEventListener('basalt:tags-duplicate', (event) =>
			notify(`${event.detail.value} is already on the list.`, 'info'),
		);

		mountEditor('about', {
			noun: 'About',
			current: () => profile.intro,
			replace: (intro) => {
				profile.intro = deepCopy(intro);
				paintIntro();
			},
			load: () => {
				bioBox.value = profile.intro.bio;
				topicEntry.value = '';
				topicBox.basaltTags.set(profile.intro.topics);
				countBio();
			},
			collect: () => ({ bio: bioBox.value.trim(), topics: topicBox.basaltTags.get() }),
			confirmation: () => 'About saved.',
		});

		bioBox.addEventListener('input', countBio);

		function countBio() {
			bioCounter.textContent = `${bioBox.value.length} / 320`;
		}
	}

	function mountReachEditor() {
		const keys = ['chat', 'email', 'phone', 'preferred'];

		mountEditor('contact', {
			noun: 'Contact details',
			current: () => profile.reach,
			replace: (reach) => {
				profile.reach = deepCopy(reach);
				paintReach();
			},
			load: (target) => {
				for (const key of keys) target.elements[key].value = profile.reach[key];
			},
			collect: (target) => {
				const { chat, email, phone, preferred } = target.elements;
				const handle = chat.value.trim().replace(/^@?/, '@');
				return {
					chat: handle === '@' ? '' : handle,
					email: email.value.trim(),
					phone: phone.value.trim(),
					preferred: preferred.value,
				};
			},
			validate: (reach) => {
				if (reach.preferred !== 'phone' || reach.phone) return null;
				return { name: 'phone', message: 'Add a phone number, or pick another way to reach you first.' };
			},
			confirmation: () => 'Contact details saved.',
		});
	}

	function mountScheduleEditor() {
		const form = pick('[data-mine-form="hours"]', page);

		pick('[data-mine-zones]', form).innerHTML = Object.entries(TIME_ZONES)
			.map(([zone, label]) => `<option value="${zone}">${label}</option>`)
			.join('');
		pick('[data-mine-office-day]', form).innerHTML = WEEK_ORDER.map(
			(day) => `<option value="${day}">${DAY_NAMES[day]}</option>`,
		).join('');
		pick('[data-mine-days]', form).innerHTML = WEEK_ORDER.map(
			(day) =>
				`<label class="basalt-choice"><input aria-label="${DAY_NAMES[day]}" type="checkbox" name="days" value="${day}">${DAY_NAMES[day].slice(0, 3)}</label>`,
		).join('');
		for (const picker of pickAll('[data-mine-times]', form))
			picker.innerHTML = halfHourOptions(picker.name.endsWith('End'));

		mountEditor('hours', {
			noun: 'Availability',
			current: () => profile.schedule,
			replace: (schedule) => {
				profile.schedule = deepCopy(schedule);
				paintSchedule();
			},
			load: (target) => {
				const { schedule } = profile;
				const fields = target.elements;
				fields.zone.value = schedule.zone;
				for (const box of fields.days) box.checked = schedule.workdays.includes(Number(box.value));
				fields.workStart.value = schedule.opens;
				fields.workEnd.value = schedule.closes;
				fields.focusOn.checked = schedule.focus.enabled;
				fields.focusStart.value = schedule.focus.from;
				fields.focusEnd.value = schedule.focus.to;
				fields.officeOn.checked = schedule.office.enabled;
				fields.officeDay.value = schedule.office.weekday;
				fields.officeStart.value = schedule.office.from;
				fields.officeEnd.value = schedule.office.to;
				showSwitchedBlocks();
			},
			collect: (target) => ({
				zone: target.elements.zone.value,
				workdays: [...target.elements.days]
					.filter((box) => box.checked)
					.map((box) => Number(box.value))
					.sort((a, b) => a - b),
				opens: chosen('workStart'),
				closes: chosen('workEnd'),
				focus: { enabled: target.elements.focusOn.checked, from: chosen('focusStart'), to: chosen('focusEnd') },
				office: {
					enabled: target.elements.officeOn.checked,
					weekday: chosen('officeDay'),
					from: chosen('officeStart'),
					to: chosen('officeEnd'),
				},
			}),
			validate: scheduleProblem,
			confirmation: () => 'Availability saved.',
		});

		form.addEventListener('change', (event) => {
			const block = event.target.closest('[data-mine-block]');
			if (!block || event.target !== pick('.form-check-input', block)) return;
			const times = pick('[data-mine-block-times]', block);
			window.Basalt.slide(times, () => {
				times.hidden = !event.target.checked;
			});
		});

		function chosen(name) {
			return parseInt(form.elements[name].value, 10);
		}

		/* A block that is switched off hides its times instead of graying them. */
		function showSwitchedBlocks() {
			for (const block of pickAll('[data-mine-block]', form)) {
				pick('[data-mine-block-times]', block).hidden = !pick('.form-check-input', block).checked;
			}
		}
	}

	/**
	 * Start times run from midnight to 11:30 PM; end times from 12:30 AM to
	 * midnight itself, written out as "Midnight".
	 */
	function halfHourOptions(forEnd) {
		const first = forEnd ? 30 : 0;
		return Array.from({ length: 48 }, (_, step) => first + step * 30)
			.map(
				(minutes) =>
					`<option value="${minutes}">${minutes === MINUTES_IN_DAY ? 'Midnight' : formatClock(minutes)}</option>`,
			)
			.join('');
	}

	/** @returns {{name: string, message: string} | null} the first rule the hours break. */
	function scheduleProblem(plan) {
		function strays(block) {
			return block.to <= block.from || block.from < plan.opens || block.to > plan.closes;
		}

		if (plan.workdays.length === 0) return { name: 'days', message: 'Pick at least one working day.' };
		if (plan.closes <= plan.opens)
			return { name: 'workEnd', message: 'Working hours have to end after they start.' };
		if (plan.focus.enabled && strays(plan.focus))
			return { name: 'focusEnd', message: 'Focus time has to sit inside your working hours.' };
		if (!plan.office.enabled) return null;
		if (!plan.workdays.includes(plan.office.weekday)) {
			return {
				name: 'officeEnd',
				message: `Office hours fall on ${DAY_NAMES[plan.office.weekday]}, which is not one of your working days.`,
			};
		}
		if (strays(plan.office))
			return { name: 'officeEnd', message: 'Office hours have to sit inside your working hours.' };
		return null;
	}

	/**
	 * Wires one section's Edit, Cancel, Escape and Save. Opening puts focus in
	 * the form; closing hands it back to the Edit button. Problems show under
	 * their field once Save has been pressed, and then update as the person
	 * types.
	 *
	 * @param {string} key the section's data-mine-form value
	 * @param {object} spec current/replace/load/collect, plus optional
	 *   validate, afterClose and focusName
	 * @returns {{isOpen: boolean, open: Function, close: Function, keep: Function}}
	 */
	function mountEditor(key, spec) {
		const form = pick(`[data-mine-form="${key}"]`, page);
		const views = pickAll(`[data-mine-view="${key}"]`, page);
		const toggles = pickAll(`[data-mine-edit="${key}"]`, page);
		const editor = { isOpen: false, attempted: false, open, close, keep };
		editors[key] = editor;

		for (const toggle of toggles) toggle.addEventListener('click', open);
		pick('[data-mine-cancel]', form).addEventListener('click', close);
		form.addEventListener('keydown', closeOnEscape);
		form.addEventListener('input', revalidate);
		form.addEventListener('change', revalidate);
		form.addEventListener('submit', save);
		return editor;

		function open() {
			if (editor.isOpen) return;
			editor.isOpen = true;
			editor.attempted = false;
			spec.load(form);
			paintProblems(form, {});
			showViews(false);
			form.hidden = false;
			const target = spec.focusName ? form.elements[spec.focusName] : firstReachableField(form);
			target?.focus();
		}

		function close() {
			editor.isOpen = false;
			form.hidden = true;
			showViews(true);
			spec.afterClose?.();
			toggles.find((toggle) => !toggle.hidden)?.focus();
		}

		/* Saving swaps the values on the page; the toast can swap them back. */
		function keep(next, message) {
			const previous = deepCopy(spec.current());
			spec.replace(next);
			close();
			notify(message, 'done', { label: 'Undo', run: () => restore(previous) });
		}

		function restore(previous) {
			if (editor.isOpen) close();
			spec.replace(previous);
			notify(`${spec.noun} is back to how it was.`, 'done');
		}

		function save(event) {
			event.preventDefault();
			editor.attempted = true;
			const problems = findProblems(form, spec);
			paintProblems(form, problems);
			if (Object.keys(problems).length) {
				editableFields(form)
					.find((control) => Object.hasOwn(problems, control.name))
					?.focus();
				return;
			}
			const next = spec.collect(form);
			/* An unchanged form simply closes, with no toast. */
			if (looksSame(next, spec.current())) close();
			else keep(next, spec.confirmation(next));
		}

		function revalidate() {
			if (editor.attempted) paintProblems(form, findProblems(form, spec));
		}

		function closeOnEscape(event) {
			if (event.key !== 'Escape' || !editor.isOpen) return;
			event.preventDefault();
			close();
		}

		/* Save and Cancel stand in for the Edit button while the form is open. */
		function showViews(visible) {
			for (const node of [...views, ...toggles]) node.hidden = !visible;
			for (const toggle of toggles) toggle.setAttribute('aria-expanded', String(!visible));
		}
	}

	/* Field checks shared by every section form. */

	function editableFields(form) {
		return [...form.elements].filter(
			(control) => ENTRY_TAGS.has(control.tagName) && control.name && control.type !== 'file',
		);
	}

	function firstReachableField(form) {
		return editableFields(form).find(
			(control) =>
				!control.disabled && control.offsetParent !== null && (control.type !== 'radio' || control.checked),
		);
	}

	/** @returns {Object<string, string>} one message per field name that needs one. */
	function findProblems(form, spec) {
		const problems = {};
		for (const control of editableFields(form)) {
			if (control.type === 'radio' || control.type === 'checkbox') continue;
			const filled = control.value.trim() !== '';
			let message = '';
			if (!filled && control.required) message = control.dataset.dmRequired || 'Fill this in.';
			if (filled && !control.validity.valid) message = control.dataset.dmFormat || 'Check this.';
			if (message) problems[control.name] = message;
		}
		const ruleBroken = spec.validate?.(spec.collect(form));
		if (ruleBroken && !problems[ruleBroken.name]) problems[ruleBroken.name] = ruleBroken.message;
		return problems;
	}

	function paintProblems(form, problems) {
		for (const slot of pickAll('[data-feedback-for]', form)) {
			const name = slot.dataset.feedbackFor;
			const message = problems[name] || '';
			slot.textContent = message;
			slot.classList.toggle('d-block', Boolean(message));
			for (const control of pickAll(`[name="${name}"]`, form)) flagControl(control, slot.id, message);
		}
	}

	/* The message is read out first, ahead of any hint the field already had. */
	function flagControl(control, slotId, message) {
		const described = (control.getAttribute('aria-describedby') || '')
			.split(/\s+/)
			.filter((id) => id && id !== slotId);
		if (message) described.unshift(slotId);

		if (described.length) control.setAttribute('aria-describedby', described.join(' '));
		else control.removeAttribute('aria-describedby');

		if (message) control.setAttribute('aria-invalid', 'true');
		else control.removeAttribute('aria-invalid');

		const isChoice = control.type === 'checkbox' || control.type === 'radio';
		if (!isChoice) control.classList.toggle('is-invalid', Boolean(message));
	}

	/* Drawing the read-only views from the profile. */

	function paintCard() {
		const { card } = profile;
		for (const key of CARD_TEXT) fieldNode(key).textContent = card[key];
		fieldNode('location').parentElement.hidden = !card.location;
		drawAvatar(card.name, card.tint, card.picture, dotTone(profile.presence));
	}

	/* With its form open, neither the status pill nor "Set a status" shows. */
	function paintPresence() {
		const { presence, card } = profile;
		const editing = editors.status?.isOpen;
		view.pill.hidden = editing || !presence.mood;
		view.addStatus.hidden = editing || Boolean(presence.mood);
		if (presence.mood) {
			const mood = MOODS[presence.mood];
			view.pill.classList.remove(...Object.values(MOODS).map((each) => `is-tone-${each.tone}`));
			view.pill.classList.add(`is-tone-${mood.tone}`);
			pick('[data-mine-status-icon]', view.pill).className = `bi ${mood.icon}`;
			pick('[data-mine-status-label]', view.pill).textContent = mood.label;
			pick('[data-mine-status-message]', view.pill).textContent = presence.note;
			view.pill.title = expiryNote(presence.expiry, presence.endsAt);
		}
		drawAvatar(card.name, card.tint, card.picture, dotTone(presence));
	}

	function paintIntro() {
		const { bio, topics } = profile.intro;
		fieldNode('bio').textContent = bio;
		view.skills.innerHTML = topics.map((topic) => `<li class="mine-skill">${htmlSafe(topic)}</li>`).join('');
		view.skills.hidden = topics.length === 0;
	}

	function paintReach() {
		view.contact.innerHTML = Object.entries(CHANNELS)
			.map(([key, channel]) => {
				const value = profile.reach[key];
				const shown = value
					? `<span class="mine-contact-value">${htmlSafe(value)}</span>`
					: '<span class="mine-contact-value is-empty">Not added</span>';
				const flag = profile.reach.preferred === key ? '<span class="mine-contact-pref">Preferred</span>' : '';
				return `<li class="mine-contact-row"><span aria-hidden="true" class="mine-icon mine-icon-sm is-tone-${channel.tone}"><i class="bi ${channel.icon}"></i></span><span class="mine-contact-main"><span class="mine-contact-label">${channel.label}</span>${shown}</span>${flag}</li>`;
			})
			.join('');
	}

	function paintSchedule() {
		const plan = profile.schedule;
		const moment = readZoneClock(plan.zone);
		const today = describeToday(plan, moment);
		const note = today.note ? `<span>${htmlSafe(today.note)}</span>` : '';
		view.now.className = `mine-avail-now is-tone-${today.tone}`;
		view.now.innerHTML = `<span aria-hidden="true" class="mine-avail-dot"></span><span><strong>${htmlSafe(today.title)}</strong>${note}</span>`;

		const theirTime = formatClock(moment.minutes);
		const gap = zoneLeadMinutes(plan.zone) + new Date().getTimezoneOffset();
		const relation =
			gap === 0
				? 'Same time zone as you'
				: `${formatDuration(Math.abs(gap))}${gap > 0 ? ' ahead of you' : ' behind you'}`;
		view.time.innerHTML = `<i aria-hidden="true" class="bi bi-clock"></i><span><strong>${theirTime}</strong> ${DAY_NAMES[moment.day]}, ${htmlSafe(TIME_ZONES[plan.zone] ?? plan.zone)}<span class="mine-avail-rel">${relation}</span></span>`;
		view.localTime.textContent = `${theirTime} local time`;

		view.week.innerHTML = WEEK_ORDER.map((day) => weekCell(plan, day, day === moment.day)).join('');

		const extras = [];
		if (plan.focus.enabled) {
			extras.push(
				`<li><span class="mine-avail-key">Focus time</span>Working days, ${htmlSafe(formatRange(plan.focus.from, plan.focus.to))}</li>`,
			);
		}
		if (plan.office.enabled) {
			extras.push(
				`<li><span class="mine-avail-key">Office hours</span>${DAY_NAMES[plan.office.weekday]}s, ${htmlSafe(formatRange(plan.office.from, plan.office.to))}</li>`,
			);
		}
		view.extras.innerHTML = extras.join('');
		view.extras.hidden = extras.length === 0;
	}

	/* Sighted readers get "Mon 8–5"; screen readers get the whole sentence. */
	function weekCell(plan, day, onToday) {
		const working = plan.workdays.includes(day);
		const name = DAY_NAMES[day];
		const spoken = `${name}${onToday ? ', today' : ''}: ${working ? formatRange(plan.opens, plan.closes) : 'off'}`;
		const classes = ['mine-week-day', !working && 'is-off', onToday && 'is-today'].filter(Boolean).join(' ');
		const current = onToday ? ' aria-current="date"' : '';
		const hours = working ? `${compactClock(plan.opens)}&ndash;${compactClock(plan.closes)}` : 'Off';
		return `<li class="${classes}"${current}><span class="visually-hidden">${htmlSafe(spoken)}</span><span aria-hidden="true" class="mine-week-name">${name.slice(0, 3)}</span><span aria-hidden="true" class="mine-week-hours">${hours}</span></li>`;
	}

	/**
	 * Where the person stands right now by their own clock: working (and
	 * whether a focus block or office hours are running), or off until the
	 * next working morning.
	 */
	function describeToday(plan, moment) {
		const { day, minutes } = moment;
		const inside = (from, to) => minutes >= from && minutes < to;

		if (plan.workdays.includes(day) && inside(plan.opens, plan.closes)) {
			let note = '';
			if (plan.focus.enabled && inside(plan.focus.from, plan.focus.to)) {
				note = `In focus time until ${formatClock(plan.focus.to)}, so replies may wait.`;
			} else if (plan.office.enabled && day === plan.office.weekday && inside(plan.office.from, plan.office.to)) {
				note = `Office hours now, until ${formatClock(plan.office.to)}. Anyone can drop in.`;
			}
			return { tone: 'success', title: `Working now, until ${formatClock(plan.closes)}`, note };
		}

		for (let ahead = 0; ahead < 8; ahead += 1) {
			const next = (day + ahead) % 7;
			const startsLater = ahead > 0 || minutes < plan.opens;
			if (!plan.workdays.includes(next) || !startsLater) continue;
			const when = ['today', 'tomorrow'][ahead] ?? DAY_NAMES[next];
			return { tone: 'muted', title: `Off until ${when}, ${formatClock(plan.opens)}`, note: '' };
		}
		return { tone: 'muted', title: 'No working hours set', note: '' };
	}

	/* Avatar and status helpers. */

	function drawAvatar(name, tint, picture, presenceTone) {
		const { avatar } = view;
		avatar.classList.remove(...AVATAR_TINTS);
		avatar.classList.add(tint === 'brand' ? 'is-brand' : `is-tone-${tint}`);
		const photo = pick('[data-mine-photo]', avatar);
		if (picture) photo.src = picture;
		photo.hidden = !picture;
		pick('[data-mine-initials]', avatar).textContent = monogram(name);
		pick('[data-mine-status-dot]', avatar).className = `mine-avatar-dot is-tone-${presenceTone}`;
	}

	/* No status at all still shows the dot as green. */
	function dotTone(presence) {
		return presence.mood ? MOODS[presence.mood].tone : 'success';
	}

	function monogram(wholeName) {
		const words = wholeName.trim().split(/\s+/).filter(Boolean);
		if (words.length === 0) return '?';
		const last = words.length > 1 ? words.at(-1)[0] : '';
		return `${words[0][0] || ''}${last}`.toUpperCase();
	}

	function blankPresence() {
		return { mood: null, note: '', expiry: 'never', endsAt: 0 };
	}

	/** @returns {number} when a status chosen now would lapse, or 0 for never. */
	function expiryMoment(key) {
		return EXPIRY[key]?.ends(new Date()) ?? 0;
	}

	function midnightAfter(now, extraDays) {
		return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + extraDays).getTime();
	}

	function expiryNote(key, endsAt) {
		if (!endsAt) return 'Stays until you change it.';
		if (key === 'today') return 'Clears at midnight tonight.';
		if (key === 'week') return 'Clears at the end of Sunday.';
		const at = new Date(endsAt);
		return `Clears at ${formatClock(at.getHours() * 60 + at.getMinutes())}.`;
	}

	/* Clock arithmetic. Times are minutes after midnight; 1440 ends the day. */

	function wrapDay(minutes) {
		return ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	/** 570 reads "9:30 AM". */
	function formatClock(minutes) {
		const wrapped = wrapDay(minutes);
		const hour = Math.floor(wrapped / 60);
		const half = hour < 12 ? 'AM' : 'PM';
		return `${hour % 12 || 12}:${twoDigits(wrapped % 60)} ${half}`;
	}

	/** Drops the first AM or PM when both ends share it: "9:00 to 11:30 AM". */
	function formatRange(from, to) {
		const start = formatClock(from);
		const finish = formatClock(to);
		const shareHalf = to < MINUTES_IN_DAY && start.slice(-2) === finish.slice(-2);
		return shareHalf ? `${start.slice(0, -3)} to ${finish}` : `${start} to ${finish}`;
	}

	/** The week strip's terse form: "8", or "8:30" off the hour. */
	function compactClock(minutes) {
		const wrapped = wrapDay(minutes);
		const hour = Math.floor(wrapped / 60) % 12 || 12;
		const rest = wrapped % 60;
		return rest ? `${hour}:${twoDigits(rest)}` : `${hour}`;
	}

	function formatDuration(total) {
		const hours = Math.floor(total / 60);
		const rest = total % 60;
		if (!hours) return `${rest} min`;
		return `${hours} ${hours === 1 ? 'hour' : 'hours'}${rest ? ` ${rest} min` : ''}`;
	}

	/** @returns {{day: number, minutes: number}} the weekday and time on a wall clock in `zone`. */
	function readZoneClock(zone) {
		const parts = zoneParts(zone, new Date(), { weekday: 'short', hour: 'numeric', minute: 'numeric' });
		return {
			day: DAY_NAMES.findIndex((name) => name.slice(0, 3) === parts.weekday),
			minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
		};
	}

	/* How far `zone` runs ahead of UTC at this minute, in minutes. */
	function zoneLeadMinutes(zone) {
		const now = new Date();
		now.setSeconds(0, 0);
		const parts = zoneParts(zone, now, {
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
		});
		const wallAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
		return Math.round((wallAsUtc - now.getTime()) / 60000);
	}

	function zoneParts(zone, date, fields) {
		const format = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', ...fields });
		return Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
	}

	/* Toasts. An action ({ label, run }) adds a button such as Undo and keeps
     the toast up longer, so there is time to reach it. */

	function notify(text, look, action) {
		const style = TOAST_LOOKS[look] ?? TOAST_LOOKS.info;
		const bubble = document.createElement('div');
		bubble.className = `mine-toast is-tone-${style.tone}`;
		bubble.innerHTML = `<i aria-hidden="true" class="bi ${style.icon}"></i><span class="mine-toast-text"></span>`;
		bubble.lastElementChild.textContent = text;

		function dismiss() {
			if (bubble.classList.contains('is-out')) return;
			bubble.classList.add('is-out');
			setTimeout(() => bubble.remove(), calmMotion ? 0 : 220);
		}

		if (action) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'mine-toast-action';
			button.textContent = action.label;
			button.addEventListener('click', () => {
				dismiss();
				action.run();
			});
			bubble.appendChild(button);
		}
		shelf.appendChild(bubble);
		setTimeout(dismiss, action ? 8000 : 3200);
	}

	/* Small DOM and data utilities. */

	function pick(selector, scope) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope) {
		return [...scope.querySelectorAll(selector)];
	}

	function fieldNode(name) {
		return pick(`[data-mine-field="${name}"]`, page);
	}

	function htmlSafe(value) {
		return String(value).replace(/[&<>"']/g, (mark) => HTML_ENTITIES[mark]);
	}

	function deepCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function looksSame(first, second) {
		return JSON.stringify(first) === JSON.stringify(second);
	}
})();
