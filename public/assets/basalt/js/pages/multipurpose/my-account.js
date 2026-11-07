/**
 * Runs the account settings page (my-account.html): tabs that follow
 * the address bar, rows and profile cards edited in place, the security
 * checkup, signed-in devices, password and two-factor dialogs, backup
 * codes, notification channels, billing, the team list and the controls
 * for exporting, pausing or deleting the account.
 *
 * Nothing here talks to a server. A save only changes what is on screen,
 * and card numbers, codes and passwords are judged by their form alone.
 * Replace the bodies of the save calls with your own requests to go live.
 */
(() => {
	'use strict';

	const page = pick('[data-account-root]');
	if (!page) return;

	const bootstrapApi = window.bootstrap;
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const openingHash = (location.hash || '').slice(1);

	const TOAST_ICONS = {
		info: 'bi-info-circle-fill',
		done: 'bi-check-circle-fill',
		warn: 'bi-exclamation-triangle-fill',
		problem: 'bi-exclamation-octagon-fill',
	};
	const CHECKUP_STORE = 'basalt-account-checkup-hidden';
	const HOLD_DURATION = 1500;
	const PASSWORD_FLOOR = 12;
	const GUESSABLE = [
		/(.)\1{2,}/,
		/(?:0123|1234|2345|3456|4567|5678|6789)/,
		/(?:abc|bcd|cde|def|qwe|wer|ert|asd)/i,
		/^(?:19|20)\d{2}$/,
	];
	const STRENGTH_NAMES = ['Nothing typed yet', 'Weak', 'Fair', 'Strong'];
	const COUNT_WORDS = ['No', 'One thing', 'Two things', 'Three things', 'Four things', 'Five things'];
	const CHECK_PROBLEMS = {
		password: 'your password is 7 months old',
		twofa: 'two-factor sign-in is off',
		codes: 'you have no backup codes left to spare',
		phone: 'there is no recovery phone',
		devices: 'a sign-in from Akron has not been confirmed',
	};
	const CARD_BRANDS = [
		[/^4/, 'Visa'],
		[/^(5[1-5]|2[2-7])/, 'Mastercard'],
		[/^3[47]/, 'Amex'],
		[/^6(011|5)/, 'Discover'],
	];
	const ADDRESS_SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
	const AVATAR_TONES = ['2', '3', '4', '5', '6', '1'];
	const SEAT_LIMIT = 60;
	const COPY_REFUSED = 'Your browser blocked copying. Select the text instead.';
	const TWO_FACTOR_COPY = {
		on: {
			title: 'Set up two-factor sign-in',
			lead: 'Scan the code with an authenticator app, then type the six digits it shows.',
			icon: 'bi-shield-lock',
			prompt: 'Six-digit code from the app',
			dismiss: 'Not now',
			action: 'Turn on',
			tone: 'btn-primary',
		},
		off: {
			title: 'Turn off two-factor sign-in?',
			lead: 'After this, anyone who learns your password can sign in as you.',
			icon: 'bi-shield-exclamation',
			prompt: 'To confirm, enter the code from your authenticator app',
			dismiss: 'Keep it on',
			action: 'Turn off',
			tone: 'btn-danger',
		},
	};

	/* Elements the page already has, looked up once and shared below. */
	const ui = {
		saveBadge: pick('[data-account-savestate]'),
		saveBadgeText: pick('[data-account-savestate-text]'),
		saveBadgeShort: pick('[data-account-savestate-short]'),
		avatar: pick('[data-account-avatar]'),
		photoRow: pick('[data-account-row="photo"]'),
		photoTools: pick('[data-account-photo-tools]'),
		photoPick: pick('[data-account-photo-pick]'),
		photoFile: pick('[data-account-photo-input]'),
		photoClear: pick('[data-account-photo-remove]'),
		photoHint: pick('[data-account-photo-hint]'),
		addressPill: pick('[data-account-email-status]'),
		clock: pick('[data-account-clock]'),
		checkupCard: pick('[data-account-checkup]'),
		checkupBar: pick('[data-account-checkup-bar]'),
		checkupBarText: pick('[data-account-checkup-bar-text]'),
		checkupTitle: pick('[data-account-checkup-title]'),
		checkupText: pick('[data-account-checkup-text]'),
		ring: pick('[data-account-ring]'),
		ringCount: pick('[data-account-ring-count]'),
		securityBadge: pick('[data-account-tab-warn]'),
		devices: pick('[data-account-sessions]'),
		signOutOthers: pick('[data-account-signout-all]'),
		signOutDialog: document.getElementById('account-signout-dialog'),
		holdButton: pick('[data-account-hold]'),
		holdLabel: pick('[data-account-hold-text]'),
		passwordDialog: document.getElementById('account-password-dialog'),
		passwordForm: pick('[data-account-password-form]'),
		passwordNow: pick('#account-pw-current'),
		passwordNext: pick('[data-account-pw-new]'),
		passwordAgain: pick('[data-account-pw-confirm]'),
		passwordSubmit: pick('[data-account-pw-submit]'),
		strengthBar: pick('[data-account-strength]'),
		strengthName: pick('[data-account-strength-label]'),
		matchNote: pick('[data-account-match]'),
		twoFactorSwitch: pick('[data-account-twofa]'),
		twoFactorDialog: document.getElementById('account-twofa-dialog'),
		twoFactorCode: pick('[data-account-twofa-code]'),
		twoFactorSubmit: pick('[data-account-twofa-submit]'),
		twoFactorDismiss: pick('[data-account-twofa-cancel]'),
		codesSummary: pick('[data-account-codes-left]'),
		codesList: pick('[data-account-codes]'),
		codesConfirm: pick('[data-account-codes-confirm]'),
		codesMeta: pick('[data-account-codes-meta]'),
		channelNote: pick('[data-account-notify-saved]'),
		usageBars: pickAll('[data-account-meter]'),
		payNow: pick('[data-account-pay]'),
		cardForm: pick('[data-account-card-form]'),
		cardNumber: pick('[data-account-card-number]'),
		cardHolder: pick('[data-account-card-name]'),
		cardExpiry: pick('[data-account-card-exp]'),
		faceBrand: pick('[data-account-cardface-brand]'),
		faceNumber: pick('[data-account-cardface-number]'),
		faceHolder: pick('[data-account-cardface-name]'),
		faceExpiry: pick('[data-account-cardface-exp]'),
		members: pick('[data-account-members]'),
		seats: pick('[data-account-seats]'),
		inviteForm: pick('[data-account-invite-form]'),
		inviteInput: pick('[data-account-invite-emails]'),
		inviteChips: pick('[data-account-invitees]'),
		inviteSubmit: pick('[data-account-invite-submit]'),
		inviteLabel: pick('[data-account-invite-label]'),
		inviteSeats: pick('[data-account-invite-seats]'),
		roleNote: pick('[data-account-role-desc]'),
		exportButton: pick('.account-row [data-account-export]'),
		exportText: pick('[data-account-export-text]'),
		exportMeta: pick('[data-account-export-meta]'),
		exportOffer: pick('[data-account-export-first]'),
		pauseDialog: document.getElementById('account-deactivate-dialog'),
		pauseForm: pick('[data-account-deactivate-form]'),
		pausePassword: pick('[data-account-deactivate-pw]'),
		pauseSubmit: pick('[data-account-deactivate-submit]'),
		eraseDialog: document.getElementById('account-delete-dialog'),
		eraseForm: pick('[data-account-delete-form]'),
		eraseInput: pick('[data-account-delete-input]'),
		eraseSubmit: pick('[data-account-delete-confirm]'),
		eraseRow: pick('[data-account-row="delete"]'),
		eraseOpen: pick('[data-account-delete-open]'),
		eraseUndo: pick('[data-account-delete-cancel]'),
		eraseText: pick('[data-account-delete-text]'),
		eraseMeta: pick('[data-account-delete-meta]'),
	};

	/* What the page looked like on arrival, so later states can return to it. */
	const firstPhotoHint = ui.photoHint.textContent.trim();
	const verifiedPill = { className: ui.addressPill.className, markup: ui.addressPill.innerHTML };
	const firstEraseCopy = { text: ui.eraseText.textContent.trim(), meta: ui.eraseMeta.textContent.trim() };
	const eraseWord = ui.eraseDialog.getAttribute('data-account-expected');

	/* A photo only joins the page while there is one; an img with no src is invalid. */
	const portraitImage = document.createElement('img');
	portraitImage.className = 'account-avatar-img';
	portraitImage.alt = '';

	const tabButtons = {};
	const editors = {};
	const profileCards = {};
	const zoneNames = {};
	const portrait = { stored: null, preview: null };
	const checkStatus = { password: 'warn', twofa: 'ok', codes: 'ok', phone: 'ok', devices: 'warn' };
	const checkNotes = {};
	const flagTimers = new WeakMap();
	const leftFields = new WeakSet();
	const savedTools = new WeakMap();

	let toastStack = null;
	let savedAt = null;
	let pendingAddress = null;
	let passedBefore = null;
	let openBefore = null;
	let holdHandle = null;
	let twoFactorOn = true;
	let codesDate = 'Jun 4, 2026';
	let channelTimer = null;
	let paymentCard = 'Visa ending 7318';
	let seatsTaken = 57;
	let readyInvites = [];
	let exportStage = 'none';

	/*
	 * Stands in for the back end. Each call returns a promise, so a fetch()
	 * can take its place unchanged; a rejection puts the old values back.
	 */
	const backend = {
		/**
		 * Saves one Profile card at once.
		 * @param {string} card 'about', 'contact' or 'region'.
		 * @param {object} changes Only the changed rows, keyed by row name,
		 *   e.g. { name: { first, last }, email: { email }, photo: dataUrl|null }.
		 * A new email is not applied here: the server mails a link to it, and
		 * the current address keeps working until that link is followed.
		 */
		saveProfileCard(card, changes) {
			return new Promise((resolve) => {
				setTimeout(() => resolve({ section: card, changes }), 300);
			});
		},
	};

	/* Text a row shows once saved, built from the values in its form. */
	const shownValue = {
		name(v) {
			return `${v.first.trim()} ${v.last.trim()}`;
		},
		title(v) {
			return v.title.trim();
		},
		bio(v) {
			return v.bio.trim() || 'Nothing yet.';
		},
		location(v) {
			return v.location.trim() || 'Not set';
		},
		timezone(v) {
			return zoneNames[v.timezone] || v.timezone;
		},
		format(v) {
			return `${v.date} · weeks start on ${v.week}`;
		},
		quiet(v) {
			return v.on ? `${v.from} to ${v.to}, ${v.days}` : 'Off. Everything arrives as it happens.';
		},
		billemail(v) {
			return v.billemail.trim();
		},
		phone(v) {
			return `${v.country} ${v.phone.trim()}`;
		},
	};

	/* Profile rows whose saved value also changes something elsewhere. */
	const knockOn = {
		name: showInitials,
		phone: spreadPhone,
		timezone: tickClock,
	};

	start();

	/* The order below matches what each part reads from the ones before it. */
	function start() {
		mountToastStack();
		mountTabs();
		mountSaveBadge();
		mountInlineRows();
		mountCounters();
		mountQuietHours();
		for (const card of pickAll('[data-account-section]', page)) buildProfileCard(card);
		tickClock();
		setInterval(() => {
			if (!document.hidden) tickClock();
		}, 30000);
		mountPhotoPicker();
		mountCheckup();
		mountDevices();
		mountPasswordDialog();
		mountTwoFactor();
		countCodes();
		mountBackupCodes();
		mountChannels();
		mountUsageBars();
		mountInvoices();
		mountCardDialog();
		mountTeam();
		mountInviteDialog();
		mountExport();
		mountPause();
		mountErase();
		syncDevices();
		syncSaveBadge();
	}

	/* Small helpers the rest of the file leans on. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function clockTime() {
		return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function dialog(id) {
		const node = document.getElementById(id);
		if (!node || !bootstrapApi) return null;
		return bootstrapApi.Modal.getOrCreateInstance(node);
	}

	/* Restarts a one-shot CSS animation by forcing a reflow between states. */
	function replay(node, className) {
		node.classList.remove(className);
		void node.offsetWidth;
		node.classList.add(className);
	}

	function devicesWord(count) {
		return count === 1 ? ' device' : ' devices';
	}

	function mountToastStack() {
		toastStack = pick('.account-toasts');
		if (toastStack) return;
		toastStack = document.createElement('div');
		toastStack.className = 'account-toasts';
		toastStack.setAttribute('aria-live', 'polite');
		document.body.appendChild(toastStack);
	}

	/**
	 * Shows a short note in the corner of the screen.
	 * @param {string} text What happened.
	 * @param {string} tone info while something runs, done once it has,
	 *   warn for a heads-up, problem when something was removed or refused.
	 * @param {{label: string, run: Function}} [followUp] Adds a button such
	 *   as Undo, and leaves the note up long enough to reach it.
	 */
	function notify(text, tone, followUp) {
		const kind = TOAST_ICONS[tone] ? tone : 'info';
		const note = document.createElement('div');
		const icon = document.createElement('i');
		const words = document.createElement('span');
		let closed = false;

		note.className = `account-toast account-toast-${kind}`;
		icon.className = `bi ${TOAST_ICONS[kind]}`;
		words.textContent = text;
		note.append(icon, words);

		if (followUp) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'account-toast-action';
			button.textContent = followUp.label;
			button.addEventListener('click', () => {
				close();
				followUp.run();
			});
			note.appendChild(button);
		}

		toastStack.appendChild(note);
		setTimeout(close, followUp ? 8000 : 3600);

		function close() {
			if (closed) return;
			closed = true;
			note.classList.add('is-out');
			setTimeout(() => note.remove(), 220);
		}
	}

	/* Tabs follow the address bar: #security, #billing and the rest open their own tab. */
	function mountTabs() {
		for (const button of pickAll('[data-account-tab]')) {
			tabButtons[button.getAttribute('data-account-tab')] = button;
		}
		for (const [name, button] of Object.entries(tabButtons)) {
			button.addEventListener('shown.bs.tab', () => {
				if (history.replaceState) history.replaceState(null, '', `#${name}`);
			});
		}
		if (tabButtons[openingHash]) revealTab(openingHash);
		window.addEventListener('hashchange', () => {
			const wanted = location.hash.slice(1);
			if (tabButtons[wanted]) revealTab(wanted);
		});
	}

	function revealTab(name) {
		const button = tabButtons[name];
		if (button && bootstrapApi) bootstrapApi.Tab.getOrCreateInstance(button).show();
	}

	/**
	 * Scrolls an element into view, first switching to its tab when that
	 * tab is hidden, then runs the optional follow-up.
	 */
	function bringIntoView(target, afterwards) {
		const pane = target.closest('.tab-pane');
		const tabName = pane ? pane.id.replace('account-', '') : null;

		if (!pane || pane.classList.contains('active')) {
			land();
			return;
		}
		tabButtons[tabName].addEventListener('shown.bs.tab', land, { once: true });
		revealTab(tabName);

		function land() {
			target.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth', block: 'center' });
			if (afterwards) afterwards();
		}
	}

	/* The section bar counts unsaved rows and jumps to the first one. */
	function mountSaveBadge() {
		ui.saveBadge.addEventListener('click', () => {
			const [firstDirty] = unsavedRows();
			if (!firstDirty) return;
			bringIntoView(firstDirty, () => {
				const field = pick(
					'.account-row-form input:not([type=hidden]), .account-row-form select, .account-row-form textarea, .account-row-form button[type=submit]',
					firstDirty,
				);
				field?.focus({ preventScroll: true });
			});
		});

		window.addEventListener('beforeunload', (event) => {
			if (!unsavedRows().length) return;
			event.preventDefault();
			event.returnValue = '';
		});
	}

	function unsavedRows() {
		return pickAll('.account-row.is-dirty', page);
	}

	function syncSaveBadge() {
		const count = unsavedRows().length;
		const badge = ui.saveBadge;

		badge.classList.toggle('is-dirty', count > 0);
		pick('.bi', badge).className = `bi ${count ? 'bi-pencil-square' : 'bi-check2-circle'}`;
		ui.saveBadgeShort.textContent = count ? `${count} unsaved` : 'Saved';

		if (!count) {
			ui.saveBadgeText.textContent = savedAt ? `All saved at ${savedAt}` : 'All changes saved';
			badge.removeAttribute('aria-label');
		} else {
			ui.saveBadgeText.textContent = count === 1 ? '1 unsaved change' : `${count} unsaved changes`;
			badge.setAttribute('aria-label', `${ui.saveBadgeText.textContent}. Go to it.`);
		}

		for (const [name, button] of Object.entries(tabButtons)) {
			const dot = pick('[data-account-tab-dot]', button);
			const pane = document.getElementById(`account-${name}`);
			if (dot && pane) dot.hidden = !pick('.account-row.is-dirty', pane);
		}
	}

	function stampSaved() {
		savedAt = clockTime();
		syncSaveBadge();
	}

	/* Form values are read, written back and compared as plain objects. */
	function collectValues(form) {
		const values = {};
		for (const field of pickAll('input, select, textarea', form)) {
			if (!field.name) continue;
			if (field.type === 'checkbox') values[field.name] = field.checked;
			else if (field.type !== 'radio') values[field.name] = field.value;
			else if (field.checked) values[field.name] = field.value;
		}
		return values;
	}

	/* Writes values back and tells each field, so counters and switches follow. */
	function applyValues(form, values) {
		for (const field of pickAll('input, select, textarea', form)) {
			if (!field.name || !(field.name in values)) continue;
			const value = values[field.name];
			if (field.type === 'radio') field.checked = field.value === value;
			else if (field.type === 'checkbox') field.checked = value;
			else field.value = value;
			field.dispatchEvent(new Event('account:sync'));
		}
	}

	/* Text is stored and compared with the outer spaces cut off. */
	function trimmed(values) {
		return Object.fromEntries(
			Object.entries(values).map(([name, value]) => [name, typeof value === 'string' ? value.trim() : value]),
		);
	}

	function sameValues(left, right) {
		return JSON.stringify(left) === JSON.stringify(right);
	}

	/** Sets a row's small status word: 'unsaved', 'saved' (fades away) or null. */
	function setRowFlag(row, state) {
		const flag = pick('[data-account-flag]', row);
		if (!flag) return;
		clearTimeout(flagTimers.get(flag));
		flag.className = 'account-row-flag';
		flag.textContent = '';

		if (state === 'unsaved') {
			flag.classList.add('is-unsaved');
			flag.textContent = 'Unsaved';
			return;
		}
		if (state !== 'saved') return;

		flag.classList.add('is-saved');
		flag.innerHTML = '<i class="bi bi-check2"></i>Saved';
		flagTimers.set(
			flag,
			setTimeout(() => {
				flag.classList.add('is-leaving');
				flagTimers.set(
					flag,
					setTimeout(() => setRowFlag(row, null), 420),
				);
			}, 2600),
		);
	}

	function rowNamed(name) {
		return pick(`[data-account-row="${name}"]`, page);
	}

	/* Rows on the Notifications and Billing tabs open in place, one at a time. */
	function mountInlineRows() {
		for (const option of pickAll('#account-timezone option')) {
			zoneNames[option.value] = option.textContent.trim();
		}
		for (const row of pickAll('[data-account-row]', page)) wireInlineRow(row);
	}

	function wireInlineRow(row) {
		const form = pick('[data-account-form]', row);
		if (!form) return;
		const name = row.getAttribute('data-account-row');
		const toggle = pick('[data-account-edit]', row);
		const readout = pick('[data-account-value]', row);
		const entry = { row, fields: form, stored: collectValues(form) };
		editors[name] = entry;

		toggle?.addEventListener('click', (event) => {
			expand();
			if (event.detail > 0) toggle.blur();
		});
		form.addEventListener('input', recheck);
		form.addEventListener('change', recheck);
		form.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			discard();
		});
		pick('[data-account-cancel]', form)?.addEventListener('click', discard);

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) {
				pick(':invalid', form)?.focus();
				return;
			}
			const values = collectValues(form);
			if (readout && shownValue[name]) readout.textContent = shownValue[name](values);
			entry.stored = values;
			collapse(false);
			setRowFlag(row, 'saved');
			stampSaved();
			toggle?.focus({ preventScroll: true });
		});

		function expand() {
			form.hidden = false;
			row.classList.add('is-editing');
			toggle?.setAttribute('aria-expanded', 'true');
			pick('input:not([type=radio]):not([type=checkbox]), select, textarea', form)?.focus({
				preventScroll: true,
			});
		}

		function collapse(restore) {
			if (restore) applyValues(form, entry.stored);
			form.classList.remove('was-validated');
			form.hidden = true;
			row.classList.remove('is-editing', 'is-dirty');
			toggle?.setAttribute('aria-expanded', 'false');
			syncSaveBadge();
		}

		function recheck() {
			const changed = !sameValues(collectValues(form), entry.stored);
			row.classList.toggle('is-dirty', changed);
			setRowFlag(row, changed ? 'unsaved' : null);
			syncSaveBadge();
		}

		function discard() {
			collapse(true);
			setRowFlag(row, null);
			toggle?.focus();
		}
	}

	function mountCounters() {
		for (const area of pickAll('[data-account-count]')) {
			const output = document.getElementById(area.getAttribute('data-account-count'));
			const limit = parseInt(area.getAttribute('maxlength'), 10) || 280;
			area.addEventListener('input', () => paintCounter(area, output, limit));
			area.addEventListener('account:sync', () => paintCounter(area, output, limit));
			paintCounter(area, output, limit);
		}
	}

	function paintCounter(area, output, limit) {
		const used = area.value.length;
		output.textContent = `${used} of ${limit} characters`;
		output.classList.toggle('is-near', used > limit - 30);
	}

	/* Quiet hours: the times can only be picked while the switch is on. */
	function mountQuietHours() {
		const toggle = pick('#account-quiet-on');
		const times = pick('[data-account-quiet-times]');
		if (!toggle) return;
		toggle.addEventListener('change', follow);
		toggle.addEventListener('account:sync', follow);

		function follow() {
			for (const select of pickAll('select', times)) select.disabled = !toggle.checked;
		}
	}

	/*
	 * A Profile card opens whole from one Edit button. Save checks every field,
	 * sends only the changed rows in a single call, and its Undo restores the
	 * card at once. Opening a card closes any other open one without changes.
	 */
	function buildProfileCard(card) {
		const key = card.getAttribute('data-account-section');
		const heading = pick('.account-card-title', card).textContent.trim();
		const form = pick('[data-account-section-form]', card);
		const editButton = pick('[data-account-section-edit]', card);
		const footer = pick('[data-account-section-foot]', card);
		const status = pick('[data-account-section-status]', card);
		const fieldGroups = pickAll('[data-account-fields]', card);
		const ownRows = fieldGroups.map((group) => group.closest('[data-account-row]'));
		const ownsPhoto = card.contains(ui.photoRow);
		const trackedRows = ownsPhoto ? [...ownRows, ui.photoRow] : ownRows;
		const profile = { editing: false, tried: false, pendingChanges, refresh, open, close };
		let pointerHeld = false;

		profileCards[key] = profile;
		for (const [index, row] of ownRows.entries()) {
			editors[row.getAttribute('data-account-row')] = {
				row,
				fields: fieldGroups[index],
				stored: trimmed(collectValues(fieldGroups[index])),
			};
		}

		editButton.addEventListener('click', () => open());
		pick('[data-account-section-cancel]', card).addEventListener('click', discard);
		form.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape' || !profile.editing) return;
			event.preventDefault();
			discard();
		});
		form.addEventListener('input', onEdit);
		form.addEventListener('change', onEdit);

		/*
		 * Leaving a field on the way to Save or Cancel shows no error yet: one
		 * appearing mid-click would move the button out from under the pointer.
		 * Save checks every field anyway, and Cancel clears them.
		 */
		footer.addEventListener('pointerdown', () => {
			pointerHeld = true;
			document.addEventListener(
				'pointerup',
				() =>
					setTimeout(() => {
						pointerHeld = false;
					}, 0),
				{ once: true },
			);
		});
		form.addEventListener('focusout', (event) => {
			const field = event.target;
			if (!field.name || field.type === 'file' || !profile.editing) return;
			leftFields.add(field);
			if (pointerHeld || footer.contains(event.relatedTarget)) return;
			showFieldError(field);
			describeStatus(pendingChanges());
		});

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			profile.tried = true;
			const broken = editableFields().filter((field) => !showFieldError(field));
			const changes = pendingChanges();
			describeStatus(changes);
			if (broken.length) {
				broken[0].focus();
				return;
			}
			if (!Object.keys(changes).length) {
				close();
				editButton.focus();
				return;
			}
			commit(changes);
		});

		function editableFields() {
			return pickAll('input, select, textarea', form).filter((field) => field.name && field.type !== 'file');
		}

		/* The rows whose values differ from what was last saved. */
		function pendingChanges() {
			const changes = {};
			for (const row of ownRows) {
				const name = row.getAttribute('data-account-row');
				const current = trimmed(collectValues(editors[name].fields));
				const stored = editors[name].stored;
				const unchanged =
					name === 'email'
						? current.email.toLowerCase() === stored.email.toLowerCase()
						: sameValues(current, stored);
				if (!unchanged) changes[name] = current;
			}
			if (ownsPhoto && portrait.preview !== portrait.stored) changes.photo = portrait.preview;
			return changes;
		}

		function describeStatus(changes) {
			const broken = profile.tried
				? editableFields().filter((field) => field.classList.contains('is-invalid')).length
				: 0;
			const count = Object.keys(changes).length;
			let line = `${count} changes to save`;
			if (broken) line = broken === 1 ? 'Fix 1 field to save.' : `Fix ${broken} fields to save.`;
			else if (count === 0) line = 'No changes yet';
			else if (count === 1) line = '1 change to save';
			status.textContent = line;
			status.classList.toggle('is-bad', broken > 0);
		}

		function refresh() {
			const changes = pendingChanges();
			for (const row of trackedRows) {
				const changed = row.getAttribute('data-account-row') in changes;
				const flag = pick('[data-account-flag]', row);
				row.classList.toggle('is-dirty', changed);
				if (changed) setRowFlag(row, 'unsaved');
				else if (flag?.classList.contains('is-unsaved')) setRowFlag(row, null);
			}
			describeStatus(changes);
			syncSaveBadge();
		}

		function open(focusTarget) {
			if (!profile.editing) {
				for (const other of Object.values(profileCards)) {
					if (other !== profile && other.editing && !Object.keys(other.pendingChanges()).length)
						other.close();
				}
				profile.editing = true;
				profile.tried = false;
				card.classList.add('is-editing');
				for (const group of fieldGroups) group.hidden = false;
				if (ownsPhoto) ui.photoTools.hidden = false;
				footer.hidden = false;
				editButton.setAttribute('aria-expanded', 'true');
				editButton.hidden = true;
				refresh();
			}
			(focusTarget || editableFields()[0])?.focus({ preventScroll: true });
		}

		function close() {
			profile.editing = false;
			profile.tried = false;
			card.classList.remove('is-editing');
			for (const group of fieldGroups) group.hidden = true;
			if (ownsPhoto) ui.photoTools.hidden = true;
			footer.hidden = true;
			editButton.hidden = false;
			editButton.setAttribute('aria-expanded', 'false');
			for (const field of editableFields()) clearFieldError(field);
			for (const row of trackedRows) {
				const flag = pick('[data-account-flag]', row);
				row.classList.remove('is-dirty');
				if (flag?.classList.contains('is-unsaved')) setRowFlag(row, null);
			}
			syncSaveBadge();
		}

		function discard() {
			for (const row of ownRows) {
				const entry = editors[row.getAttribute('data-account-row')];
				applyValues(entry.fields, entry.stored);
			}
			if (ownsPhoto) {
				portrait.preview = portrait.stored;
				showPortrait(portrait.stored);
			}
			close();
			editButton.focus();
		}

		/* Errors wait until a field is left or Save is pressed, then track each key. */
		function onEdit(event) {
			const field = event.target;
			if (field.name && (leftFields.has(field) || profile.tried)) showFieldError(field);
			refresh();
		}

		function commit(changes) {
			const previous = valuesBefore(changes);
			const oldAddress = editors.email ? editors.email.stored.email : '';
			putOnScreen(changes);
			close();
			for (const name of Object.keys(changes)) setRowFlag(rowNamed(name), 'saved');
			stampSaved();
			editButton.focus({ preventScroll: true });

			backend.saveProfileCard(key, changes).then(
				() => {
					let message = `${heading} saved.`;
					if (changes.email) {
						message = `Link sent to ${changes.email.email}. ${oldAddress} keeps working until you click it.`;
						if (changes.phone) message = `Phone saved. ${message}`;
					}
					notify(message, changes.email ? 'info' : 'done', {
						label: 'Undo',
						run: () => revert(previous, changes),
					});
				},
				() => {
					/* The server kept the old values, so the page goes back to them too. */
					putOnScreen(previous);
					for (const name of Object.keys(changes)) setRowFlag(rowNamed(name), null);
					notify(`Could not save ${heading}. The old details are back.`, 'problem');
				},
			);
		}

		function revert(previous, applied) {
			putOnScreen(previous);
			stampSaved();
			backend.saveProfileCard(key, previous).then(
				() => {
					notify(`${heading} is back to how it was.`, 'done');
				},
				() => {
					putOnScreen(applied);
					notify(`Could not undo. ${heading} keeps the new details.`, 'problem');
				},
			);
		}
	}

	/* The browser's own rules, plus: a required field of only spaces is empty. */
	function passesChecks(field) {
		if (field.type === 'radio' || field.type === 'checkbox') return true;
		field.setCustomValidity(field.required && !field.value.trim() ? 'empty' : '');
		return field.validity.valid;
	}

	/** Draws or clears one field's error, keeping aria-invalid and aria-describedby in step. */
	function showFieldError(field) {
		const valid = passesChecks(field);
		field.classList.toggle('is-invalid', !valid);
		if (valid) field.removeAttribute('aria-invalid');
		else field.setAttribute('aria-invalid', 'true');
		pointToError(field, !valid);
		return valid;
	}

	function clearFieldError(field) {
		leftFields.delete(field);
		field.setCustomValidity('');
		field.classList.remove('is-invalid');
		field.removeAttribute('aria-invalid');
		pointToError(field, false);
	}

	/* Adds the field's error message to aria-describedby, or takes it out. */
	function pointToError(field, linked) {
		const message = pick('.invalid-feedback', field.parentElement);
		if (!message?.id) return;
		const ids = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== message.id);
		if (linked) ids.push(message.id);
		if (ids.length) field.setAttribute('aria-describedby', ids.join(' '));
		else field.removeAttribute('aria-describedby');
	}

	/**
	 * Shows saved values row by row, along with whatever each one touches
	 * elsewhere on the page. Save, Undo and a failed save all go through here.
	 */
	function putOnScreen(changes) {
		for (const [name, value] of Object.entries(changes)) {
			if (name === 'photo') {
				portrait.stored = portrait.preview = value;
				showPortrait(value);
				continue;
			}
			if (name === 'email') {
				/* The address itself only changes once the emailed link is used. */
				pendingAddress = 'pending' in value ? value.pending : value.email;
				applyValues(editors.email.fields, editors.email.stored);
				showAddressPill();
				continue;
			}
			const entry = editors[name];
			entry.stored = value;
			applyValues(entry.fields, value);
			const readout = pick('[data-account-value]', entry.row);
			if (readout && shownValue[name]) readout.textContent = shownValue[name](value);
			knockOn[name]?.(value);
		}
	}

	/* The stored values for the same rows, so a save can be taken back. */
	function valuesBefore(changes) {
		const previous = {};
		for (const name of Object.keys(changes)) {
			if (name === 'photo') previous.photo = portrait.stored;
			else if (name === 'email') previous.email = { email: editors.email.stored.email, pending: pendingAddress };
			else previous[name] = editors[name].stored;
		}
		return previous;
	}

	function showInitials(value) {
		const letters = `${value.first[0] || ''}${value.last[0] || ''}`;
		pick('.account-avatar-initials', ui.avatar).textContent = letters.toUpperCase();
	}

	function spreadPhone(value) {
		for (const mirror of pickAll('[data-account-mirror="phone"]')) {
			mirror.textContent = shownValue.phone(value);
		}
		checkNotes.phone = `Verified, ending ${value.phone.replace(/\D/g, '').slice(-4)}`;
		drawCheckup();
	}

	function showPortrait(source) {
		if (source) {
			portraitImage.src = source;
			ui.avatar.appendChild(portraitImage);
			ui.avatar.classList.add('has-image');
		} else {
			portraitImage.remove();
			portraitImage.removeAttribute('src');
			ui.avatar.classList.remove('has-image');
		}
		ui.photoClear.hidden = !source;
		ui.photoHint.textContent =
			portrait.preview === portrait.stored
				? firstPhotoHint
				: 'This is how it will look. Save to use it everywhere.';
	}

	function showAddressPill() {
		const pill = ui.addressPill;
		if (!pendingAddress) {
			pill.className = verifiedPill.className;
			pill.innerHTML = verifiedPill.markup;
			return;
		}
		pill.className = 'account-pill account-pill-warn';
		pill.innerHTML = '<i class="bi bi-hourglass-split"></i>';
		pill.appendChild(document.createTextNode(`Waiting on ${pendingAddress}`));
	}

	/* A running clock beside the time zone, as a quick check that it is right. */
	function tickClock() {
		if (!ui.clock) return;
		const zone = editors.timezone ? editors.timezone.stored.timezone : 'America/Chicago';
		try {
			const there = new Date().toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				timeZone: zone,
			});
			ui.clock.textContent = `It is ${there} there now`;
		} catch {
			ui.clock.textContent = '';
		}
	}

	/* The chosen photo is only a preview until its card is saved. */
	function mountPhotoPicker() {
		ui.photoPick.addEventListener('click', () => ui.photoFile.click());

		ui.photoFile.addEventListener('change', () => {
			const chosen = ui.photoFile.files?.[0];
			if (!chosen) return;
			if (!chosen.type.startsWith('image/')) {
				notify('That file is not an image. Try a PNG or JPG.', 'warn');
				return;
			}
			if (chosen.size > 2 * 1024 * 1024) {
				notify('That image is over 2 MB. Try a smaller one.', 'warn');
				return;
			}
			const loader = new FileReader();
			loader.addEventListener('load', () => {
				portrait.preview = loader.result;
				showPortrait(portrait.preview);
				profileCards.about.refresh();
			});
			loader.readAsDataURL(chosen);
			ui.photoFile.value = '';
		});

		ui.photoClear.addEventListener('click', () => {
			portrait.preview = null;
			showPortrait(null);
			profileCards.about.refresh();
			ui.photoPick.focus();
		});
	}

	/*
	 * The security checkup starts folded to one line and opens on request,
	 * stored as '0'. That choice is remembered, but a check that newly fails
	 * opens the card again: a fresh problem should not hide behind it.
	 */
	function mountCheckup() {
		for (const item of pickAll('[data-account-check]')) {
			checkNotes[item.getAttribute('data-account-check')] = pick(
				'[data-account-check-meta]',
				item,
			).textContent.trim();
		}

		pick('[data-account-checkup-close]').addEventListener('click', () =>
			window.Basalt.slide(ui.checkupCard, () => setCheckupOpen(false, true, true)),
		);
		pick('[data-account-checkup-open]').addEventListener('click', () =>
			window.Basalt.slide(ui.checkupCard, () => setCheckupOpen(true, true, true)),
		);
		try {
			if (localStorage.getItem(CHECKUP_STORE) === '0') setCheckupOpen(true, false, false);
		} catch {
			/* Storage can be blocked; the card simply stays folded. */
		}

		/* With motion allowed, the ring fills in from empty once the page shows. */
		if (calmMotion) {
			drawCheckup(true);
		} else {
			for (const arc of pickAll('.account-ring-fill circle', ui.ring)) arc.classList.remove('is-done');
			requestAnimationFrame(() => requestAnimationFrame(() => drawCheckup(true)));
		}

		const remedies = {
			password() {
				dialog('account-password-dialog').show();
			},
			twofa() {
				openTwoFactor('on');
			},
			codes() {
				if (checkStatus.twofa !== 'ok') openTwoFactor('on');
				else dialog('account-codes-dialog').show();
			},
			phone() {
				bringIntoView(rowNamed('phone'), () => profileCards.contact.open(pick('#account-phone')));
			},
			devices() {
				const flagged = pick('[data-account-flagged]');
				if (!flagged) return;
				bringIntoView(flagged, () => {
					replay(flagged, 'is-highlight');
					pick('button', flagged)?.focus({ preventScroll: true });
				});
			},
		};
		for (const button of pickAll('[data-account-fix]')) {
			button.addEventListener('click', () => {
				const remedy = button.getAttribute('data-account-fix');
				if (Object.hasOwn(remedies, remedy)) remedies[remedy]();
			});
		}
	}

	function setCheckupOpen(open, remember, moveFocus) {
		ui.checkupCard.hidden = !open;
		ui.checkupBar.hidden = open;
		if (remember) {
			try {
				localStorage.setItem(CHECKUP_STORE, open ? '0' : '1');
			} catch {
				/* Not remembered when storage is unavailable. */
			}
		}
		if (moveFocus) pick(open ? '[data-account-checkup-close]' : '[data-account-checkup-open]').focus();
	}

	/** Redraws the list, the ring, the summary and the tab badge from checkStatus. */
	function drawCheckup(initial) {
		const names = Object.keys(checkStatus);
		const passed = names.filter((name) => checkStatus[name] === 'ok');
		const waiting = names.filter((name) => checkStatus[name] !== 'ok');
		const failing = waiting.filter((name) => checkStatus[name] === 'bad').length;

		for (const item of pickAll('[data-account-check]')) {
			const name = item.getAttribute('data-account-check');
			if (!initial && item.getAttribute('data-state') !== checkStatus[name]) replay(item, 'is-changed');
			item.setAttribute('data-state', checkStatus[name]);
			pick('[data-account-check-meta]', item).textContent = checkNotes[name];
		}

		/* Passed arcs come first, then the open ones, with failures at the end. */
		for (const [index, arc] of pickAll('.account-ring-fill circle', ui.ring).entries()) {
			arc.classList.toggle('is-done', index < passed.length);
		}
		for (const [index, arc] of pickAll('.account-ring-track circle', ui.ring).entries()) {
			arc.classList.toggle('is-pending', index >= passed.length && index < names.length - failing);
			arc.classList.toggle('is-bad', index >= names.length - failing);
		}
		ui.ringCount.textContent = passed.length;
		ui.ring.setAttribute('aria-label', `${passed.length} of 5 security checks passed`);
		if (passedBefore !== null && passedBefore !== passed.length) replay(ui.ring, 'is-bump');
		passedBefore = passed.length;

		if (waiting.length) {
			const problems = waiting.map((name) => CHECK_PROBLEMS[name]);
			const sentence =
				problems.length > 1
					? `${problems.slice(0, -1).join(', ')} and ${problems[problems.length - 1]}`
					: problems[0];
			ui.checkupTitle.textContent = `${COUNT_WORDS[waiting.length]} to look at`;
			ui.checkupText.textContent = `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}. Each takes a minute.`;
		} else {
			ui.checkupTitle.textContent = 'Your account is in good shape';
			ui.checkupText.textContent =
				'Everything on the list is done. If anything slips, like an unfamiliar sign-in or an old password, it shows up here first.';
		}

		const extra = waiting.length ? ` · ${COUNT_WORDS[waiting.length].toLowerCase()} to look at` : '';
		ui.checkupBarText.textContent = `${passed.length} of 5 passed${extra}`;
		ui.checkupBar.classList.toggle('is-open-items', waiting.length > 0);
		ui.checkupBar.classList.toggle('is-bad', failing > 0);
		if (!initial && openBefore !== null && waiting.length > openBefore && ui.checkupCard.hidden) {
			setCheckupOpen(true, true, false);
		}
		openBefore = waiting.length;

		if (!ui.securityBadge) return;
		ui.securityBadge.textContent = waiting.length;
		ui.securityBadge.hidden = !waiting.length;
		ui.securityBadge.classList.toggle('account-tab-count-danger', failing > 0);
	}

	/* Signed-in devices can be confirmed, signed out one by one, or all at once. */
	function mountDevices() {
		ui.devices.addEventListener('click', (event) => {
			const signOut = event.target.closest('[data-account-session-out]');
			const itsMe = event.target.closest('[data-account-session-mine]');
			if (signOut) signOutDevice(signOut.closest('.account-session'));
			if (itsMe) confirmDevice(itsMe);
		});

		/* Sign out everywhere else: the dialog lists what goes, then asks for a long press. */
		ui.signOutDialog.addEventListener('show.bs.modal', listLeavingDevices);
		ui.signOutDialog.addEventListener('hidden.bs.modal', () => endHold());

		const button = ui.holdButton;
		button.addEventListener('pointerdown', beginHold);
		button.addEventListener('keydown', beginHold);
		for (const type of ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur']) {
			button.addEventListener(type, endHold);
		}
		button.addEventListener('click', (event) => event.preventDefault());
		button.addEventListener('contextmenu', (event) => event.preventDefault());
	}

	function otherDevices() {
		return pickAll('.account-session:not(.is-current)', ui.devices);
	}

	function syncDevices() {
		const others = otherDevices().length;
		const passwordCount = pick('[data-account-pw-signout-count]');
		const passwordLine = passwordCount?.closest('.account-check-line');

		ui.signOutOthers.disabled = others === 0;
		if (passwordCount) passwordCount.textContent = others === 1 ? '(1 of them)' : `(${others} of them)`;
		if (passwordLine) passwordLine.hidden = others === 0;

		if (pick('[data-account-flagged]', ui.devices) || checkStatus.devices === 'ok') return;
		checkStatus.devices = 'ok';
		checkNotes.devices = `Every device checked on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
		drawCheckup();
	}

	function signOutDevice(device, silent) {
		const label = pick('.account-session-title', device).textContent.trim();
		device.classList.add('is-leaving');
		setTimeout(
			() => {
				device.remove();
				syncDevices();
			},
			calmMotion ? 0 : 260,
		);
		if (!silent) notify(`${label} is signed out.`, 'done');
	}

	function confirmDevice(trigger) {
		const device = trigger.closest('.account-session');
		device.classList.remove('is-flagged', 'is-highlight');
		device.removeAttribute('data-account-flagged');
		const reason = pick('.account-session-why', device);
		if (reason) reason.textContent = 'confirmed by you';
		pick('[data-account-session-out]', device).className = 'btn btn-sm btn-outline-secondary';
		trigger.remove();
		syncDevices();
		notify('Thanks. That sign-in is marked as yours.', 'done');
	}

	function listLeavingDevices() {
		const list = pick('[data-account-signout-list]');
		const leaving = otherDevices();
		list.innerHTML = '';
		for (const device of leaving) {
			const item = document.createElement('li');
			item.innerHTML =
				'<span class="account-goinglist-icon"><i></i></span><span><b></b><small></small></span><i class="bi bi-box-arrow-right" aria-hidden="true"></i>';
			pick('.account-goinglist-icon i', item).className = pick('.account-session-icon i', device).className;
			pick('b', item).textContent = pick('.account-session-title', device).textContent.trim();
			pick('small', item).textContent = pick('.account-session-meta', device).textContent.trim();
			list.appendChild(item);
		}
		pick('[data-account-signout-cli]').hidden = !pick('[data-account-cli]', ui.devices);
		ui.holdLabel.textContent = `Hold to sign out ${leaving.length}${devicesWord(leaving.length)}`;
	}

	function beginHold(event) {
		if (event.type === 'keydown') {
			if ((event.key !== 'Enter' && event.key !== ' ') || event.repeat) return;
			event.preventDefault();
		}
		if (holdHandle) return;
		ui.holdButton.classList.add('is-holding');
		holdHandle = setTimeout(finishHold, HOLD_DURATION);
	}

	function endHold(event) {
		if (event?.type === 'keyup' && event.key !== 'Enter' && event.key !== ' ') return;
		clearTimeout(holdHandle);
		holdHandle = null;
		ui.holdButton.classList.remove('is-holding');
	}

	function finishHold() {
		const leaving = otherDevices();
		holdHandle = null;
		for (const device of leaving) signOutDevice(device, true);
		dialog('account-signout-dialog').hide();
		ui.holdButton.classList.remove('is-holding');
		notify(
			`Signed out of ${leaving.length}${devicesWord(leaving.length)}. Only this MacBook is still signed in.`,
			'done',
		);
	}

	/* The password dialog grades the new password as it is typed. */
	function mountPasswordDialog() {
		for (const field of [ui.passwordNow, ui.passwordNext, ui.passwordAgain]) {
			field.addEventListener('input', paintPasswordForm);
		}

		for (const button of pickAll('[data-account-reveal]')) {
			button.addEventListener('click', () => {
				const input = pick('input', button.parentElement);
				const reveal = input.type === 'password';
				input.type = reveal ? 'text' : 'password';
				button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
				pick('i', button).className = `bi ${reveal ? 'bi-eye-slash' : 'bi-eye'}`;
			});
		}

		ui.passwordForm.addEventListener('submit', (event) => {
			event.preventDefault();
			paintPasswordForm();
			if (ui.passwordSubmit.disabled) return;
			const leaving = pick('[data-account-pw-signout]').checked ? otherDevices() : [];
			for (const device of leaving) signOutDevice(device, true);

			const age = pick('[data-account-password-age]');
			age.innerHTML = '<i class="bi bi-check2-circle"></i>Changed just now';
			age.classList.add('is-ok');
			checkStatus.password = 'ok';
			checkNotes.password = 'Changed today';
			drawCheckup();
			dialog('account-password-dialog').hide();

			const tail = leaving.length === 1 ? ' other device is' : ' other devices are';
			notify(
				leaving.length ? `Password changed, and ${leaving.length}${tail} signed out.` : 'Password changed.',
				'done',
			);
			stampSaved();
		});

		ui.passwordDialog.addEventListener('hidden.bs.modal', () => {
			ui.passwordForm.reset();
			for (const input of pickAll('input', ui.passwordForm)) {
				if (input.type === 'text') input.type = 'password';
			}
			for (const icon of pickAll('[data-account-reveal] i', ui.passwordForm)) icon.className = 'bi bi-eye';
			paintPasswordForm();
		});
		ui.passwordDialog.addEventListener('shown.bs.modal', () => ui.passwordNow.focus());
	}

	function looksGuessable(candidate) {
		return GUESSABLE.some((pattern) => pattern.test(candidate));
	}

	/**
	 * Grades a password from 1 (weak) to 3 (strong), or 0 when empty. The
	 * sign-up and reset screens (sign-in.js) use the same rules, so a password
	 * gets the same grade on every screen.
	 */
	function gradePassword(candidate) {
		if (!candidate) return 0;
		const length = candidate.length;
		let grade = 1;
		if (length >= PASSWORD_FLOOR) grade = 3;
		else if (length >= 9) grade = 2;
		if (new Set(candidate.split('')).size < Math.ceil(length / 2)) grade -= 1;
		if (looksGuessable(candidate)) grade -= 1;
		if (length >= 20) grade += 1;
		return Math.min(3, Math.max(1, grade));
	}

	/* Bits of the person's own name and address a password should avoid. */
	function personalWords() {
		const person = editors.name ? editors.name.stored : { first: 'John', last: 'Armstrong' };
		const mailbox = editors.email ? editors.email.stored.email.split('@')[0] : 'john';
		return [person.first, person.last, mailbox]
			.map((word) => word.toLowerCase())
			.filter((word) => word.length >= 3);
	}

	function paintPasswordForm() {
		const typed = ui.passwordNext.value;
		const again = ui.passwordAgain.value;
		const grade = gradePassword(typed);
		const rules = {
			length: typed.length >= PASSWORD_FLOOR,
			mixed: typed.length > 0 && !looksGuessable(typed),
			name: typed.length > 0 && !personalWords().some((word) => typed.toLowerCase().includes(word)),
		};

		ui.strengthBar.setAttribute('data-score', grade);
		ui.strengthName.textContent = STRENGTH_NAMES[grade];
		for (const item of pickAll('[data-rule]', ui.passwordForm)) {
			item.classList.toggle('is-met', rules[item.getAttribute('data-rule')]);
		}

		/* Stay quiet while the second entry is still a correct start of the first. */
		let verdict = ['', 'account-match'];
		if (again && again === typed) verdict = ['Both match.', 'account-match is-ok'];
		else if (again && !typed.startsWith(again)) verdict = ['These do not match yet.', 'account-match is-off'];
		[ui.matchNote.textContent, ui.matchNote.className] = verdict;

		const ready =
			rules.length &&
			rules.mixed &&
			rules.name &&
			grade >= 2 &&
			again === typed &&
			ui.passwordNow.value.length > 0;
		ui.passwordSubmit.disabled = !ready;
	}

	/* Two-factor sign-in only changes through its dialog. */
	function mountTwoFactor() {
		const toggle = ui.twoFactorSwitch;
		const code = ui.twoFactorCode;

		/* The switch never changes by itself; the dialog's answer does that. */
		toggle.addEventListener('change', () => {
			toggle.checked = twoFactorOn;
			openTwoFactor(twoFactorOn ? 'off' : 'on');
		});
		code.addEventListener('input', () => {
			code.value = code.value.replace(/\D/g, '').slice(0, 6);
			ui.twoFactorSubmit.disabled = code.value.length !== 6;
		});
		ui.twoFactorDialog.addEventListener('shown.bs.modal', () => code.focus());
		ui.twoFactorDialog.addEventListener('hidden.bs.modal', () => {
			code.value = '';
			ui.twoFactorSubmit.disabled = true;
			toggle.checked = twoFactorOn;
		});
		pick('[data-account-copy-key]').addEventListener('click', () => {
			putOnClipboard(pick('[data-account-key]').textContent.replace(/\s/g, ''), 'Setup key copied.');
		});

		pick('[data-account-twofa-form]').addEventListener('submit', (event) => {
			event.preventDefault();
			if (code.value.length !== 6) return;
			const enabling = ui.twoFactorDialog.getAttribute('data-mode') === 'on';
			applyTwoFactor(enabling);
			dialog('account-twofa-dialog').hide();
			if (enabling) notify('Two-factor is on, with eight fresh backup codes.', 'done');
			else notify('Two-factor is off. Your password is now the only lock.', 'warn');
			stampSaved();
		});
	}

	function openTwoFactor(mode) {
		const copy = TWO_FACTOR_COPY[mode === 'on' ? 'on' : 'off'];
		const remaining = freshCodes().length;
		ui.twoFactorDialog.setAttribute('data-mode', mode);
		pick('[data-account-twofa-title]').textContent = copy.title;
		pick('[data-account-twofa-sub]').textContent = copy.lead;
		pick('[data-account-twofa-icon] i').className = `bi ${copy.icon}`;
		pick('[data-account-twofa-label]').textContent = copy.prompt;
		ui.twoFactorDismiss.textContent = copy.dismiss;
		ui.twoFactorSubmit.textContent = copy.action;
		ui.twoFactorSubmit.className = `btn ${copy.tone}`;
		if (mode === 'on') drawFakeQr();
		pick('[data-account-twofa-codes]').textContent =
			remaining === 1
				? 'Your last unused backup code stops working.'
				: `Your ${remaining} unused backup codes stop working.`;
		dialog('account-twofa-dialog').show();
	}

	function applyTwoFactor(enabled) {
		const pill = pick('[data-account-twofa-pill]');
		twoFactorOn = enabled;
		ui.twoFactorSwitch.checked = enabled;
		pill.textContent = enabled ? 'On' : 'Off';
		pill.className = `account-pill ${enabled ? 'account-pill-ok' : 'account-pill-danger'}`;
		pick('[data-account-twofa-text]').textContent = enabled
			? 'A code from your authenticator app on every new device or browser.'
			: 'Only your password stands between someone and your account.';
		checkStatus.twofa = enabled ? 'ok' : 'bad';
		checkNotes.twofa = enabled ? 'Authenticator app, on since today' : `Off since ${clockTime()}`;
		if (enabled) {
			issueCodes();
		} else {
			for (const item of pickAll('li', ui.codesList)) item.classList.add('is-used');
			countCodes();
		}
		drawCheckup();
	}

	/*
	 * A pretend scannable code for the setup step, drawn once. It has the
	 * three corner squares of the real thing and encodes nothing at all.
	 */
	function drawFakeQr() {
		const holder = pick('[data-account-qr]');
		if (holder.firstChild) return;
		const size = 25;
		const corners = [
			[0, 0],
			[size - 7, 0],
			[0, size - 7],
		];
		const squares = [];
		let seed = 7;

		for (let y = 0; y < size; y += 1) {
			for (let x = 0; x < size; x += 1) {
				const cell = cellAt(x, y);
				if (cell === 'dark' || (cell === 'random' && nextRandom() > 0.52)) {
					squares.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
				}
			}
		}
		holder.innerHTML = `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${squares.join('')}</svg>`;

		function nextRandom() {
			seed = (seed * 16807) % 2147483647;
			return seed / 2147483647;
		}

		function cellAt(x, y) {
			for (const [left, top] of corners) {
				const across = x - left;
				const down = y - top;
				if (across < 0 || across > 6 || down < 0 || down > 6) continue;
				const border = across === 0 || across === 6 || down === 0 || down === 6;
				const center = across >= 2 && across <= 4 && down >= 2 && down <= 4;
				return border || center ? 'dark' : 'light';
			}
			const margin = (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
			return margin ? 'light' : 'random';
		}
	}

	/* Backup codes can be copied, downloaded or replaced with a fresh set. */
	function mountBackupCodes() {
		const makeButton = pick('[data-account-codes-make]');

		pick('[data-account-codes-regen]').addEventListener('click', () => {
			ui.codesConfirm.hidden = false;
			makeButton.focus();
		});
		pick('[data-account-codes-keep]').addEventListener('click', () => {
			ui.codesConfirm.hidden = true;
		});
		makeButton.addEventListener('click', () => {
			ui.codesConfirm.hidden = true;
			issueCodes();
			drawCheckup();
			notify('Eight new codes are ready. The old ones no longer work.', 'done');
		});
		document.getElementById('account-codes-dialog').addEventListener('hidden.bs.modal', () => {
			ui.codesConfirm.hidden = true;
		});

		pick('[data-account-codes-copy]').addEventListener('click', () => {
			putOnClipboard(freshCodes().join('\n'), 'Unused codes copied.');
		});
		pick('[data-account-codes-download]').addEventListener('click', downloadCodes);
	}

	function freshCodes() {
		return pickAll('li:not(.is-used) code', ui.codesList).map((code) => code.textContent.trim());
	}

	function countCodes() {
		const unused = freshCodes().length;
		const total = pickAll('li', ui.codesList).length;
		ui.codesSummary.textContent = twoFactorOn ? `${unused} of ${total} unused` : 'None, while two-factor is off';
		ui.codesMeta.textContent = `Issued ${codesDate} · ${unused} of ${total} unused`;
		pick('[data-account-codes-unused]').textContent = unused;
		if (twoFactorOn) {
			checkStatus.codes = unused >= 3 ? 'ok' : 'warn';
			checkNotes.codes = `${unused} of ${total} still unused`;
		} else {
			checkStatus.codes = 'warn';
			checkNotes.codes = 'None, while two-factor is off';
		}
	}

	function issueCodes() {
		ui.codesList.innerHTML = '';
		for (let position = 0; position < 8; position += 1) {
			const item = document.createElement('li');
			const code = document.createElement('code');
			code.textContent = `${fourDigits()}-${fourDigits()}`;
			item.appendChild(code);
			item.style.animationDelay = `${position * 40}ms`;
			ui.codesList.appendChild(item);
		}
		replay(ui.codesList, 'is-fresh');
		codesDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		countCodes();
	}

	function fourDigits() {
		return String(Math.floor(1000 + Math.random() * 9000));
	}

	function downloadCodes() {
		const text = `Basalt backup codes for john.armstrong@fieldline.app\nIssued ${codesDate}\nEach code works once.\n\n${freshCodes().join('\n')}\n`;
		const address = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
		const link = document.createElement('a');
		link.href = address;
		link.download = 'basalt-backup-codes.txt';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(address), 1000);
		notify('Saved as basalt-backup-codes.txt.', 'done');
	}

	function putOnClipboard(text, message) {
		if (!navigator.clipboard?.writeText) {
			notify(COPY_REFUSED, 'warn');
			return;
		}
		navigator.clipboard.writeText(text).then(
			() => notify(message, 'done'),
			() => notify(COPY_REFUSED, 'warn'),
		);
	}

	/* Each notification box saves the moment it is ticked. */
	function mountChannels() {
		for (const row of pickAll('[data-account-notify]')) {
			const topic = row.getAttribute('data-account-notify');
			const minimum = parseInt(row.getAttribute('data-account-notify-min') || '0', 10);
			for (const box of pickAll('input', row)) {
				box.addEventListener('change', () => onChannelChange(row, box, topic, minimum));
			}
		}
	}

	function onChannelChange(row, box, topic, minimum) {
		if (pickAll('input:checked', row).length < minimum) {
			box.checked = true;
			replay(box.closest('.account-chan'), 'is-refused');
			notify(`${topic} need at least one channel, so this one stays on.`, 'warn');
			return;
		}
		const channel = box.getAttribute('aria-label').replace(`${topic} `, '');
		const note = ui.channelNote;
		note.innerHTML = '<i class="bi bi-check2-circle"></i>';
		note.appendChild(document.createTextNode(`Saved: ${topic} ${channel}${box.checked ? ', on' : ', off'}`));
		clearTimeout(channelTimer);
		channelTimer = setTimeout(() => {
			note.textContent = '';
		}, 3200);
		stampSaved();
	}

	/* The usage bars grow in once, the first time Billing is shown. */
	function mountUsageBars() {
		if (calmMotion) {
			growBars();
			return;
		}
		const billingTab = tabButtons.billing;
		if (!billingTab) return;
		billingTab.addEventListener('shown.bs.tab', () => requestAnimationFrame(growBars), { once: true });
		if (openingHash === 'billing') requestAnimationFrame(growBars);
	}

	function growBars() {
		for (const bar of ui.usageBars) bar.style.width = `${bar.getAttribute('data-account-meter')}%`;
	}

	function mountInvoices() {
		ui.payNow?.addEventListener('click', payOverdue);

		for (const button of pickAll('[data-account-invoice]')) {
			button.addEventListener('click', () => {
				const invoice = button.getAttribute('data-account-invoice');
				notify(
					invoice === 'all' ? 'Putting five invoices into one ZIP…' : `Downloading ${invoice}.pdf…`,
					'info',
				);
			});
		}
	}

	function payOverdue() {
		const button = ui.payNow;
		const invoice = button.getAttribute('data-account-pay');
		button.disabled = true;
		button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Paying…';

		setTimeout(() => {
			const alert = pick('[data-account-overdue]');
			alert.classList.add('is-cleared');
			pick('.account-alert-icon i', alert).className = 'bi bi-check-circle-fill';
			pick('.account-alert-title', alert).textContent = "August's invoice is paid.";
			pick('.account-alert-note', alert).textContent = `$3,190 went on the ${paymentCard} at ${clockTime()}.`;
			button.remove();

			const state = pick(`[data-account-invoice-row="${invoice}"] [data-account-invoice-status]`);
			if (state) {
				state.className = 'account-pill account-pill-ok';
				state.textContent = 'Paid';
			}
			const billingBadge = pick('[data-account-tab-billing]');
			if (billingBadge) billingBadge.hidden = true;
			notify(`${invoice} is paid.`, 'done');
		}, 900);
	}

	/* Replacing the card: a card face on screen follows what is typed. */
	function mountCardDialog() {
		const form = ui.cardForm;
		const cardDialog = document.getElementById('account-card-dialog');

		ui.cardNumber.addEventListener('input', paintCardFace);
		ui.cardHolder.addEventListener('input', paintCardFace);
		ui.cardExpiry.addEventListener('input', tidyExpiry);
		paintCardFace();
		ui.cardExpiry.setCustomValidity('bad');

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) {
				pick(':invalid', form)?.focus();
				return;
			}
			const digits = ui.cardNumber.value.replace(/\D/g, '');
			const brand = cardBrand(digits) || 'Card';
			paymentCard = `${brand} ending ${digits.slice(-4)}`;
			pick('[data-account-card-text]').textContent = paymentCard;
			pick('[data-account-card-meta]').textContent =
				`Expires ${ui.cardExpiry.value} · ${ui.cardHolder.value.trim()}`;
			pick('[data-account-card-brand]').textContent = brand === 'Mastercard' ? 'MC' : brand.toUpperCase();
			dialog('account-card-dialog').hide();
			notify(`The ${paymentCard} is now on file. The old card is removed.`, 'done');
			stampSaved();
		});

		cardDialog.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
			ui.cardExpiry.setCustomValidity('bad');
			paintCardFace();
		});
		cardDialog.addEventListener('shown.bs.modal', () => ui.cardNumber.focus());
	}

	function cardBrand(digits) {
		const match = CARD_BRANDS.find(([pattern]) => pattern.test(digits));
		return match ? match[1] : '';
	}

	/* The Luhn checksum every real card number passes. */
	function passesLuhn(digits) {
		let total = 0;
		for (const [place, digit] of digits.split('').reverse().entries()) {
			let value = parseInt(digit, 10);
			if (place % 2) {
				value *= 2;
				if (value > 9) value -= 9;
			}
			total += value;
		}
		return digits.length >= 13 && total % 10 === 0;
	}

	/* Amex reads 4-6-5; every other brand reads in fours. */
	function spaceDigits(digits) {
		if (cardBrand(digits) !== 'Amex') return digits.replace(/(.{4})/g, '$1 ').trim();
		return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
	}

	function paintCardFace() {
		const digits = ui.cardNumber.value.replace(/\D/g, '').slice(0, 19);
		const padded = `${digits}${'•'.repeat(Math.max(0, 16 - digits.length))}`.slice(0, Math.max(16, digits.length));
		ui.cardNumber.value = spaceDigits(digits);
		ui.faceNumber.textContent = spaceDigits(padded);
		ui.faceBrand.textContent = cardBrand(digits) || 'Card';
		ui.faceHolder.textContent = ui.cardHolder.value.trim() || 'Name on card';
		ui.faceExpiry.textContent = ui.cardExpiry.value || 'MM/YY';
		ui.cardNumber.setCustomValidity(passesLuhn(digits) ? '' : 'bad');
	}

	/* Adds the slash as the month is typed and refuses a date already past. */
	function tidyExpiry(event) {
		const field = ui.cardExpiry;
		let text = field.value.replace(/\D/g, '').slice(0, 4);
		if (text.length >= 3 || (text.length === 2 && event.inputType !== 'deleteContentBackward')) {
			text = `${text.slice(0, 2)}/${text.slice(2)}`;
		}
		field.value = text;

		const parts = /^(\d{2})\/(\d{2})$/.exec(text);
		let current = false;
		if (parts) {
			const month = parseInt(parts[1], 10);
			const year = 2000 + parseInt(parts[2], 10);
			const today = new Date();
			const thisYear = today.getFullYear();
			current =
				month >= 1 && month <= 12 && (year > thisYear || (year === thisYear && month >= today.getMonth() + 1));
		}
		field.setCustomValidity(current ? '' : 'bad');
		paintCardFace();
	}

	/* Team members can change role, get a fresh invite or be removed. */
	function mountTeam() {
		for (const member of pickAll('.account-member', ui.members)) wireMember(member);
	}

	function showSeats() {
		ui.seats.textContent = `${seatsTaken} of ${SEAT_LIMIT} seats in use`;
	}

	function wireMember(member) {
		const rolePicker = pick('[data-account-role]', member);
		const tools = pick('.account-member-tools', member);

		if (rolePicker) {
			let previousRole = rolePicker.value;
			rolePicker.addEventListener('change', () => {
				const article = /^[AEIOU]/.test(rolePicker.value) ? 'an ' : 'a ';
				notify(`${memberName()} is now ${article}${rolePicker.value} (was ${previousRole}).`, 'done');
				previousRole = rolePicker.value;
				stampSaved();
			});
		}
		if (!tools) return;

		const actions = {
			'data-account-resend'(button) {
				button.disabled = true;
				button.textContent = 'Sent';
				notify(`Sent the invite to ${pick('.account-member-who > span', member).textContent} again.`, 'done');
			},
			'data-account-remove'() {
				savedTools.set(member, tools.innerHTML);
				member.classList.add('is-confirming');
				tools.innerHTML =
					'<div class="account-member-confirm"><span></span><button type="button" class="btn btn-sm btn-outline-secondary" data-account-keep>Keep</button><button type="button" class="btn btn-sm btn-danger" data-account-remove-yes>Remove</button></div>';
				pick('span', tools).textContent = `Remove ${memberName().split(' ')[0]}?`;
				pick('[data-account-keep]', tools).focus();
			},
			'data-account-keep'() {
				member.classList.remove('is-confirming');
				tools.innerHTML = savedTools.get(member);
				pick('[data-account-remove]', tools)?.focus();
			},
			'data-account-remove-yes'() {
				const who = memberName();
				const onlyInvited = /Invited/.test(member.textContent.trim());
				member.classList.add('is-leaving');
				setTimeout(() => member.remove(), calmMotion ? 0 : 260);
				if (!onlyInvited) {
					seatsTaken -= 1;
					showSeats();
				}
				notify(
					onlyInvited
						? `The invite for ${who} is canceled.`
						: `${who} no longer has access. Their seat is free.`,
					'problem',
				);
			},
		};
		const anyAction = Object.keys(actions)
			.map((attribute) => `[${attribute}]`)
			.join(', ');

		tools.addEventListener('click', (event) => {
			const button = event.target.closest(anyAction);
			if (!button) return;
			const attribute = Object.keys(actions).find((name) => button.hasAttribute(name));
			actions[attribute](button);
		});

		function memberName() {
			return pick('.account-member-who p', member).firstChild.textContent.trim();
		}
	}

	/* Invite dialog: addresses become chips as they are typed or pasted. */
	function mountInviteDialog() {
		const inviteDialog = document.getElementById('account-invite-dialog');
		const form = ui.inviteForm;

		ui.inviteInput.addEventListener('input', readInvitees);
		for (const option of pickAll('input[name="inviteRole"]', form)) {
			option.addEventListener('change', () => {
				ui.roleNote.textContent = option.getAttribute('data-desc');
			});
		}
		readInvitees();

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			readInvitees();
			if (ui.inviteSubmit.disabled) return;
			const role = pick('input[name="inviteRole"]:checked', form).value;
			for (const address of readyInvites) addInvitedMember(address, role);
			const count = readyInvites.length;
			dialog('account-invite-dialog').hide();
			notify(count === 1 ? `Invite sent to ${readyInvites[0]}.` : `${count} invites sent.`, 'done');
		});

		inviteDialog.addEventListener('hidden.bs.modal', () => {
			form.reset();
			ui.roleNote.textContent = pick('input[name="inviteRole"]:checked', form).getAttribute('data-desc');
			readInvitees();
		});
		inviteDialog.addEventListener('shown.bs.modal', () => ui.inviteInput.focus());
	}

	function memberAddresses() {
		return pickAll('.account-member-who > span', ui.members).map((span) => span.textContent.trim().toLowerCase());
	}

	/** Turns the typed text into chips, marking bad and repeated addresses. */
	function readInvitees() {
		const typed = ui.inviteInput.value
			.split(/[\s,;]+/)
			.map((part) => part.trim())
			.filter(Boolean);
		const onTeam = memberAddresses();
		const seen = new Set();
		let invalid = 0;

		ui.inviteChips.innerHTML = '';
		readyInvites = [];

		for (const address of typed) {
			const lower = address.toLowerCase();
			const chip = document.createElement('span');
			let icon = 'bi-envelope';
			let suffix = '';
			chip.className = 'account-invitee';

			if (!ADDRESS_SHAPE.test(address)) {
				chip.classList.add('is-bad');
				icon = 'bi-exclamation-circle';
				suffix = ' (not an address)';
				invalid += 1;
			} else if (seen.has(lower) || onTeam.includes(lower)) {
				chip.classList.add('is-dupe');
				icon = 'bi-person-check';
				suffix = onTeam.includes(lower) ? ' (already here)' : ' (twice)';
			} else {
				readyInvites.push(address);
			}
			seen.add(lower);
			chip.innerHTML = `<i class="bi ${icon}"></i>`;
			chip.appendChild(document.createTextNode(`${address}${suffix}`));
			ui.inviteChips.appendChild(chip);
		}

		if (!typed.length) {
			const hint = document.createElement('span');
			hint.className = 'account-invitees-hint';
			hint.textContent = 'Paste a whole list if you like. Commas, spaces or new lines all work.';
			ui.inviteChips.appendChild(hint);
		}

		const count = readyInvites.length;
		const open = SEAT_LIMIT - seatsTaken;
		ui.inviteSubmit.disabled = count === 0 || invalid > 0 || count > open;
		ui.inviteLabel.textContent = count > 1 ? `Send ${count} invites` : 'Send invite';
		if (count > open) ui.inviteSeats.textContent = `Only ${open} seats free. Remove someone or upgrade first.`;
		else if (count) ui.inviteSeats.textContent = `${open - count} of ${open} free seats left once they accept`;
		else ui.inviteSeats.textContent = `${open} seats free`;
	}

	function addInvitedMember(address, role) {
		const handle = address.split('@')[0];
		const member = document.createElement('div');
		member.className = 'account-member is-new';
		member.setAttribute('data-account-member', '');
		member.innerHTML = `<span class="basalt-avatar basalt-avatar-sm account-member-avatar"></span><div class="account-member-who"><p></p><span></span></div><select class="form-select form-select-sm account-member-role" data-account-role><option>Super Admin</option><option>Admin</option><option>Editor</option><option>Viewer</option><option>Guest</option><option>Finance Manager</option></select><span class="account-pill account-pill-info">Invited</span><div class="account-member-tools"><button type="button" class="btn btn-sm btn-outline-secondary" data-account-resend>Resend</button><button type="button" class="btn btn-sm btn-outline-danger" data-account-remove>Remove</button></div>`;

		const badge = pick('.basalt-avatar', member);
		badge.textContent =
			handle
				.replace(/[^a-z]/gi, '')
				.slice(0, 2)
				.toUpperCase() || '?';
		badge.setAttribute('data-tone', AVATAR_TONES[address.length % AVATAR_TONES.length]);
		pick('.account-member-who p', member).textContent = handle;
		pick('.account-member-who > span', member).textContent = address;

		const rolePicker = pick('select', member);
		rolePicker.value = role;
		rolePicker.setAttribute('aria-label', `Role for ${address}`);
		ui.members.appendChild(member);
		wireMember(member);
	}

	/* Your data: an export, a pause and a deletion, each behind its own step. */
	function mountExport() {
		for (const button of pickAll('[data-account-export]')) {
			button.addEventListener('click', () => {
				if (exportStage === 'ready' && button === ui.exportButton)
					notify('Downloading basalt-export-john-armstrong.zip…', 'info');
				else requestExport();
			});
		}
	}

	function requestExport() {
		if (exportStage !== 'none') return;
		const button = ui.exportButton;

		exportStage = 'working';
		button.disabled = true;
		button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Preparing…';
		ui.exportText.textContent = 'Putting your export together.';
		ui.exportMeta.textContent =
			'We will email john.armstrong@fieldline.app when it is ready. You can leave this page.';
		const focusInside = ui.exportOffer.contains(document.activeElement);
		ui.exportOffer.classList.add('is-done');
		ui.exportOffer.innerHTML =
			'<span><i class="bi bi-check2-circle me-1"></i>Export requested. The link goes to john.armstrong@fieldline.app.</span>';
		/* The pressed button has just been replaced, so focus stays in the dialog. */
		if (focusInside) ui.eraseInput.focus();
		notify('Export started. Usually ready within the hour.', 'info');

		/* For the demo, the archive is "ready" a few seconds later. */
		setTimeout(() => {
			exportStage = 'ready';
			button.disabled = false;
			button.innerHTML = '<i class="bi bi-file-earmark-zip me-1"></i>Download ZIP';
			ui.exportText.textContent = 'basalt-export-john-armstrong.zip is ready, 148 MB.';
			ui.exportMeta.textContent = 'The link works for seven days. We emailed it to you as well.';
		}, 4000);
	}

	/* Deactivating asks for the password first. */
	function mountPause() {
		const field = ui.pausePassword;
		field.addEventListener('input', () => {
			ui.pauseSubmit.disabled = field.value.length === 0;
		});
		ui.pauseForm.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!field.value) return;
			dialog('account-deactivate-dialog').hide();
			/* A live build would sign the person out at this point. */
			notify('Deactivated. Sign in any time to pick up where you left off.', 'warn');
		});
		ui.pauseDialog.addEventListener('hidden.bs.modal', () => {
			ui.pauseForm.reset();
			ui.pauseSubmit.disabled = true;
		});
		ui.pauseDialog.addEventListener('shown.bs.modal', () => field.focus());
	}

	/* Deleting asks for the account name to be typed out. */
	function mountErase() {
		const field = ui.eraseInput;

		field.addEventListener('input', () => {
			const typedRight = field.value.trim() === eraseWord;
			ui.eraseSubmit.disabled = !typedRight;
			field.classList.toggle('is-match', typedRight);
		});

		ui.eraseForm.addEventListener('submit', (event) => {
			event.preventDefault();
			if (field.value.trim() !== eraseWord) return;
			dialog('account-delete-dialog').hide();
			ui.eraseRow.classList.add('is-scheduled');
			ui.eraseText.textContent = 'Your account is set to be deleted on Oct 26, 2026.';
			ui.eraseMeta.textContent = 'Cancel before then and nothing is lost. After that date it cannot be undone.';
			ui.eraseOpen.hidden = true;
			ui.eraseUndo.hidden = false;
			ui.eraseUndo.focus();
			notify('Deletion scheduled for Oct 26, 2026. You can still cancel it.', 'problem');
		});

		ui.eraseUndo.addEventListener('click', () => {
			ui.eraseRow.classList.remove('is-scheduled');
			ui.eraseText.textContent = firstEraseCopy.text;
			ui.eraseMeta.textContent = firstEraseCopy.meta;
			ui.eraseUndo.hidden = true;
			ui.eraseOpen.hidden = false;
			ui.eraseOpen.focus();
			notify('Deletion canceled. Your account stays as it is.', 'done');
		});

		ui.eraseDialog.addEventListener('hidden.bs.modal', () => {
			field.value = '';
			field.classList.remove('is-match');
			ui.eraseSubmit.disabled = true;
		});
		ui.eraseDialog.addEventListener('shown.bs.modal', () => field.focus());
	}
})();
