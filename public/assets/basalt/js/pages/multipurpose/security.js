/**
 * Runs security.html, where the signed-in person manages how they get in:
 * a new password checked against live rules, two-step sign-in with its
 * backup codes, passkeys, and the latest sign-ins, each with a detail drawer.
 *
 * Records come from assets/basalt/js/data/multipurpose/security.js. Every change goes through
 * the `backend` object, which in the demo simply resolves after a pause;
 * put real requests in those bodies and keep the promises they return.
 * Open the page with ?state=offline to watch every save fail.
 */
(() => {
	'use strict';

	const page = pick('[data-scy-root]');
	const source = window.Basalt.data?.security;
	if (!page || !source) return;

	const failEverySave = new URLSearchParams(location.search).get('state') === 'offline';

	const MONTH_ABBR = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
	const STRENGTH_WORDS = ['type a new password', 'weak', 'fair', 'good', 'strong'];
	const CHARACTER_RULES = ['length', 'case', 'number', 'symbol'];
	const SECOND_STEPS = ['app', 'sms'];
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Wording for the set-up dialog, per second step. */
	const SETUP_COPY = {
		app: {
			title: 'Set up an authenticator app',
			sub: 'Scan the code, then type the 6 digits the app shows.',
			glyph: 'bi-phone',
		},
		sms: {
			title: 'Get codes by text message',
			sub: 'We text a code to your phone each time you sign in.',
			glyph: 'bi-chat-text',
		},
	};

	/* The five bars of a QR finder pattern, as x, y, width, height from its corner. */
	const FINDER_BARS = [
		[0, 0, 7, 1],
		[0, 6, 7, 1],
		[0, 1, 1, 5],
		[6, 1, 1, 5],
		[2, 2, 3, 3],
	];

	/**
	 * Stand-ins for the server. Each one resolves after its pause, or rejects
	 * when the page runs offline. The comment above each names the real call.
	 */
	const backend = {
		/* POST /api/me/password with { current, next } */
		changePassword: () => settleAfter(700),
		/* POST /api/me/two-step with { method, code } */
		confirmMethod: () => settleAfter(600),
		/* DELETE /api/me/two-step */
		turnOff: () => settleAfter(450),
		/* POST /api/me/backup-codes, answering { codes } */
		newCodes: () => settleAfter(500),
		/* POST /api/me/passkeys, once navigator.credentials.create has finished */
		addPasskey: () => settleAfter(1100),
		/* PATCH /api/me/passkeys/:id with { name } */
		renamePasskey: () => settleAfter(400),
		/* DELETE /api/me/passkeys/:id */
		removePasskey: () => settleAfter(400),
	};

	const today = parseStamp(source.now);
	const mailbox = source.person.email.split('@')[0];
	const personalWords = [mailbox, ...source.person.name.toLowerCase().split(/\s+/), ...mailbox.split(/[._-]/)];

	/* The account as this visit has left it; copies, so the fixtures stay untouched. */
	const account = {
		passwordSetAt: parseStamp(source.password.changed),
		passwordSetNow: false,
		twoStepOn: source.twoStep.on,
		secondStep: source.twoStep.method,
		secondStepSince: parseStamp(source.twoStep.since),
		textNumber: source.twoStep.phone,
		backupCodes: source.codes.map((entry) => ({ ...entry })),
		codesMadeAt: parseStamp(source.codesIssued),
		passkeys: source.passkeys.map((entry) => ({ ...entry })),
	};

	/* What the open dialogs are working on. */
	let setupChoice = 'app';
	let codeTexted = false;
	let passkeyToRename = null;
	let passkeyToRemove = null;

	const pwForm = pick('[data-scy-password-form]', page);
	const pw = {
		current: pick('[data-scy-pw="current"]', pwForm),
		fresh: pick('[data-scy-pw="new"]', pwForm),
		repeat: pick('[data-scy-pw="confirm"]', pwForm),
		gauge: pick('[data-scy-meter]', pwForm),
		gaugeLabel: pick('[data-scy-meter-label]', pwForm),
		submit: pick('[data-scy-pw-save]', pwForm),
	};

	const twoStepCard = pick('#scy-twostep', page);
	const twoStepBadge = pick('[data-scy-twostep-pill]', twoStepCard);
	const turnOffButton = pick('[data-scy-twostep-off]', twoStepCard);
	const turnOnButton = pick('[data-scy-twostep-on]', twoStepCard);

	const setupForm = pick('[data-scy-setup-form]');
	const setupCode = pick('[data-scy-setup-code]', setupForm);
	const setupPhone = pick('[data-scy-sms-phone]', setupForm);
	const textCodeButton = pick('[data-scy-sms-send]', setupForm);

	const codeSheet = pick('[data-scy-codes]');
	const regenPanel = pick('[data-scy-regen]');
	const regenTrigger = pick('[data-scy-regen-open]');

	const keyList = pick('[data-scy-passkeys]', page);
	const keyListEmpty = pick('[data-scy-passkeys-empty]', page);
	const keyForm = pick('[data-scy-passkey-form]');
	const keyNameField = pick('[data-scy-passkey-name]', keyForm);
	const keySubmit = pick('[data-scy-passkey-save]', keyForm);

	const signinList = pick('[data-scy-signins]', page);
	const signinDrawer = document.getElementById('sec-signin');

	function start() {
		bindPassword();
		bindTwoStep();
		bindSetupDialog();
		bindBackupCodes();
		bindPasskeys();
		bindSignins();

		paintStrength();
		paintPasswordAge();
		paintTwoStep();
		paintPasskeys();
		paintSignins();
	}

	/* Password: live rule checks, the strength gauge, show/hide and saving. */

	function bindPassword() {
		pw.fresh.addEventListener('input', paintStrength);
		pw.current.addEventListener('input', () => {
			pw.current.classList.remove('is-invalid');
			paintStrength();
		});
		pw.repeat.addEventListener('input', paintStrength);

		/* A reset clears the fields only after this event, so repaint on the next turn. */
		pwForm.addEventListener('reset', () => {
			setTimeout(() => {
				unflag(pwForm);
				paintStrength();
			});
		});

		for (const toggle of pickAll('[data-scy-reveal]', page)) {
			toggle.addEventListener('click', () => flipVisibility(toggle));
		}

		pwForm.addEventListener('submit', savePassword);
	}

	/** Which rules a candidate password meets, keyed in the order the list shows them. */
	function checkRules(candidate) {
		const lowered = candidate.toLowerCase();
		const typed = candidate.length > 0;
		return {
			length: candidate.length >= 12,
			case: /[a-z]/.test(candidate) && /[A-Z]/.test(candidate),
			number: /\d/.test(candidate),
			symbol: /[^A-Za-z0-9\s]/.test(candidate),
			name: typed && personalWords.every((word) => word.length <= 2 || !lowered.includes(word)),
			new: typed && candidate !== pw.current.value,
		};
	}

	/**
	 * Scores 0 (empty) to 4. The four character rules set the base; anything
	 * that contains the person's name or repeats the current password is held
	 * at weak, and only 16 characters or more reach the top.
	 */
	function strengthOf(candidate, verdict) {
		if (!candidate.length) return 0;
		if (!verdict.name || !verdict.new) return 1;
		const met = CHARACTER_RULES.filter((rule) => verdict[rule]).length;
		if (met <= 2) return 1;
		if (met === 3) return 2;
		return candidate.length >= 16 ? 4 : 3;
	}

	function paintStrength() {
		const candidate = pw.fresh.value;
		const verdict = checkRules(candidate);

		for (const item of pickAll('[data-scy-rule]', pwForm)) {
			item.classList.toggle('is-met', Boolean(verdict[item.getAttribute('data-scy-rule')]));
		}

		const score = strengthOf(candidate, verdict);
		pw.gauge.setAttribute('data-level', String(score));
		pw.gaugeLabel.innerHTML = `Strength: ${score ? `<b>${STRENGTH_WORDS[score]}</b>` : STRENGTH_WORDS[0]}`;

		if (pw.fresh.classList.contains('is-invalid') && Object.values(verdict).every(Boolean)) {
			pw.fresh.classList.remove('is-invalid');
		}
		if (pw.repeat.classList.contains('is-invalid') && pw.repeat.value === candidate) {
			pw.repeat.classList.remove('is-invalid');
		}
	}

	function flipVisibility(toggle) {
		const field = document.getElementById(toggle.getAttribute('data-scy-reveal'));
		const reveal = field.type === 'password';
		field.type = reveal ? 'text' : 'password';
		toggle.setAttribute('aria-pressed', String(reveal));
		toggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
		pick('.bi', toggle).className = `bi ${reveal ? 'bi-eye-slash' : 'bi-eye'}`;
	}

	function paintPasswordAge() {
		pick('[data-scy-password-age]', page).textContent = account.passwordSetNow
			? 'Changed today. You stay signed in on this device.'
			: `Last changed ${longDate(account.passwordSetAt)}, ${monthsSince(account.passwordSetAt)}.`;
		setFigure('password', account.passwordSetNow ? 'Today' : shortDate(account.passwordSetAt));
	}

	/** Marks every field that blocks saving and returns them, first problem first. */
	function flagPasswordProblems() {
		const flagged = [];

		if (!pw.current.value) {
			pw.current.classList.add('is-invalid');
			flagged.push(pw.current);
		}

		const unmet = Object.entries(checkRules(pw.fresh.value))
			.filter(([, passed]) => !passed)
			.map(([rule]) => rule);
		if (unmet.length) {
			pw.fresh.classList.add('is-invalid');
			pick('[data-scy-pw-new-error]', pwForm).textContent =
				unmet.length === 1
					? `One rule left: ${pick(`[data-scy-rule="${unmet[0]}"] span`, pwForm).textContent.trim().toLowerCase()}.`
					: `Meet every rule in the list. ${unmet.length} to go.`;
			flagged.push(pw.fresh);
		}

		if (!pw.repeat.value || pw.repeat.value !== pw.fresh.value) {
			pw.repeat.classList.add('is-invalid');
			flagged.push(pw.repeat);
		}

		return flagged;
	}

	async function savePassword(event) {
		event.preventDefault();
		if (pw.submit.getAttribute('aria-busy') === 'true') return;

		const [firstProblem] = flagPasswordProblems();
		if (firstProblem) {
			firstProblem.focus();
			return;
		}

		window.Basalt.buttonState(pw.submit, 'loading');
		try {
			await backend.changePassword();
			window.Basalt.buttonState(pw.submit, 'success');
			account.passwordSetNow = true;
			paintPasswordAge();
			notify({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: 'Password changed',
				text: 'Use the new one next time you sign in.',
			});
			setTimeout(() => {
				pwForm.reset();
				window.Basalt.buttonState(pw.submit, 'idle');
			}, 1400);
		} catch {
			window.Basalt.buttonState(pw.submit, 'error');
			reportSaveFailure();
			setTimeout(() => window.Basalt.buttonState(pw.submit, 'idle'), 1800);
		}
	}

	/* Two-step sign-in: the on/off state and the row for each second step. */

	function bindTwoStep() {
		twoStepCard.addEventListener('click', (event) => {
			const switcher = event.target.closest('[data-scy-switch]');
			if (switcher) openSetup(switcher.getAttribute('data-scy-switch'));
		});
		turnOffButton.addEventListener('click', () => dialog('sec-off').show());
		turnOnButton.addEventListener('click', () => openSetup('app'));
		pick('[data-scy-off-confirm]').addEventListener('click', confirmTurnOff);
	}

	function paintTwoStep() {
		const on = account.twoStepOn;
		twoStepBadge.textContent = on ? 'On' : 'Off';
		twoStepBadge.className = `basalt-status basalt-status-dot ${on ? 'basalt-status-success' : 'basalt-status-warning'}`;
		pick('[data-scy-twostep-desc]', twoStepCard).textContent = on
			? 'After your password, a code from your phone. Asked on each new device or browser.'
			: 'Your password alone gets someone into your account. Turn it on to add a code from your phone.';
		turnOffButton.hidden = !on;
		turnOnButton.hidden = on;
		setFigure('twostep', on ? 'On' : 'Off');

		for (const step of SECOND_STEPS) paintStepRow(step);

		pick('[data-scy-codes-row]', twoStepCard).hidden = !on;
		const unused = unusedCodeCount();
		pick('[data-scy-codes-meta]', twoStepCard).textContent =
			`${unused} of ${account.backupCodes.length} left. Each works once, for when your phone isn't with you.`;
		setFigure('codes', on ? String(unused) : '0');
	}

	/** Fills one method row: its line of detail and, at the end, a badge or a switch button. */
	function paintStepRow(step) {
		const row = pick(`[data-scy-method="${step}"]`, twoStepCard);
		const active = account.twoStepOn && account.secondStep === step;
		row.classList.toggle('is-in-use', active);

		const since = longDate(account.secondStepSince);
		const detail = {
			app: active
				? `${source.twoStep.app}, since ${since}.`
				: 'A 6-digit code from an app like Google Authenticator or 1Password.',
			sms: active
				? `Codes go to the number ending ${lastFour(account.textNumber)}, since ${since}.`
				: 'A code sent by text message to your phone.',
		};
		pick(`[data-scy-method-meta="${step}"]`, row).textContent = detail[step];

		let trailing = '';
		if (active) trailing = '<span class="basalt-status basalt-status-primary">In use</span>';
		else if (account.twoStepOn)
			trailing = `<button data-scy-switch="${step}" type="button" class="btn btn-outline-secondary btn-sm">Use this instead</button>`;
		pick(`[data-scy-method-end="${step}"]`, row).innerHTML = trailing;
	}

	async function confirmTurnOff(event) {
		const button = event.currentTarget;
		button.disabled = true;
		try {
			await backend.turnOff();
			account.twoStepOn = false;
			paintTwoStep();
			dialog('sec-off').hide();
			notify({
				tone: 'warning',
				icon: 'bi-shield-exclamation',
				title: 'Two-step sign-in is off',
				text: 'Your password alone now signs you in.',
			});
		} catch {
			reportSaveFailure();
		} finally {
			button.disabled = false;
		}
	}

	/* One set-up dialog serves both second steps; the chosen one decides what it shows. */

	function bindSetupDialog() {
		textCodeButton.addEventListener('click', textTheCode);
		setupPhone.addEventListener('input', () => setupPhone.classList.remove('is-invalid'));
		setupCode.addEventListener('input', () => {
			setupCode.value = setupCode.value.replace(/\D/g, '').slice(0, 6);
			setupCode.classList.remove('is-invalid');
		});
		pick('[data-scy-copy-key]', setupForm).addEventListener('click', () => {
			window.Basalt.copyText(pick('[data-scy-setup-key]', setupForm).textContent.replace(/\s/g, ''));
			notify({ tone: 'success', icon: 'bi-copy', title: 'Key copied', duration: 2500 });
		});
		document.getElementById('sec-setup').addEventListener('hidden.bs.modal', () => {
			textCodeButton.textContent = 'Send code';
		});
		setupForm.addEventListener('submit', confirmSecondStep);
	}

	function openSetup(step) {
		setupChoice = step;
		codeTexted = false;
		setupForm.reset();
		unflag(setupForm);
		setupPhone.value = account.textNumber;

		for (const panel of pickAll('[data-scy-setup-panel]', setupForm)) {
			panel.hidden = panel.getAttribute('data-scy-setup-panel') !== step;
		}

		const copy = step === 'app' ? SETUP_COPY.app : SETUP_COPY.sms;
		pick('[data-scy-setup-title]', setupForm).textContent = copy.title;
		pick('[data-scy-setup-sub]', setupForm).textContent = copy.sub;
		pick('[data-scy-setup-icon]', setupForm).className = `bi ${copy.glyph}`;
		pick('[data-scy-code-field]', setupForm).hidden = step === 'sms';
		pick('[data-scy-sms-sent]', setupForm).textContent =
			'We text a code to this number. Message and data rates may apply.';

		if (step === 'app') drawSetupCode();
		dialog('sec-setup').show();
	}

	function textTheCode(event) {
		const number = setupPhone.value.replace(/\D/g, '');
		if (number.length < 10) {
			setupPhone.classList.add('is-invalid');
			setupPhone.focus();
			return;
		}
		setupPhone.classList.remove('is-invalid');
		codeTexted = true;
		event.currentTarget.textContent = 'Send again';
		pick('[data-scy-sms-sent]', setupForm).textContent =
			`Code sent to the number ending ${number.slice(-4)}. It works for 10 minutes.`;
		pick('[data-scy-code-field]', setupForm).hidden = false;
		setupCode.focus();
	}

	async function confirmSecondStep(event) {
		event.preventDefault();
		if (setupChoice === 'sms' && !codeTexted) {
			textCodeButton.click();
			return;
		}
		if (!/^\d{6}$/.test(setupCode.value)) {
			setupCode.classList.add('is-invalid');
			setupCode.focus();
			return;
		}

		const button = pick('[data-scy-setup-save]', setupForm);
		button.disabled = true;
		try {
			await backend.confirmMethod();
			const switching = account.twoStepOn;
			account.twoStepOn = true;
			account.secondStep = setupChoice;
			account.secondStepSince = new Date(today);
			if (setupChoice === 'sms') account.textNumber = setupPhone.value;
			if (!switching) {
				account.backupCodes = freshCodeSet();
				account.codesMadeAt = new Date(today);
			}
			paintTwoStep();
			dialog('sec-setup').hide();
			notify(secondStepToast(switching));
		} catch {
			reportSaveFailure();
		} finally {
			button.disabled = false;
		}
	}

	/**
	 * Turning two-step on from off issues a new code set, so that toast offers
	 * a link to the codes instead of stacking a second dialog on the first.
	 */
	function secondStepToast(switching) {
		if (!switching) {
			return {
				tone: 'success',
				icon: 'bi-shield-check',
				title: 'Two-step sign-in is on',
				text: 'We made 8 new backup codes. Save them somewhere safe.',
				actions: [
					{
						label: 'View codes',
						onClick: () => {
							showCodes();
						},
					},
				],
			};
		}
		return {
			tone: 'success',
			icon: 'bi-shield-check',
			title: 'Two-step method changed',
			text:
				setupChoice === 'app'
					? 'Codes now come from your authenticator app.'
					: 'Codes now come by text message.',
			actions: [],
		};
	}

	/**
	 * Paints a look-alike QR code: the three finder squares plus modules
	 * scattered from a fixed seed, so it is the same picture on every load.
	 * A real app would render the otpauth:// address here instead.
	 */
	function drawSetupCode() {
		const canvas = pick('[data-scy-qr]');
		if (!canvas || canvas.childElementCount) return;

		const size = 29;
		const far = size - 7;
		const nextRandom = seededRandom(20261002);
		const marks = [finderMarkup(0, 0), finderMarkup(far, 0), finderMarkup(0, far)];

		/* Leave the band around each finder empty, as a scanner expects. */
		function nearCorner(x, y) {
			return (x < 8 && y < 8) || (x > size - 9 && y < 8) || (x < 8 && y > size - 9);
		}

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				if (!nearCorner(x, y) && nextRandom() < 0.48) marks.push(rectMarkup(x, y, 1, 1));
			}
		}
		canvas.innerHTML = marks.join('');
	}

	function finderMarkup(left, top) {
		return FINDER_BARS.map(([x, y, width, height]) => rectMarkup(left + x, top + y, width, height)).join('');
	}

	function rectMarkup(x, y, width, height) {
		return `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`;
	}

	/** A small linear congruential generator, returning numbers in [0, 1). */
	function seededRandom(start) {
		let value = start;
		return () => {
			value = (value * 1103515245 + 12345) % 2147483648;
			return value / 2147483648;
		};
	}

	/* Backup codes: the code sheet, a fresh set on request, copy and download. */

	function bindBackupCodes() {
		pick('[data-scy-codes-open]', page).addEventListener('click', showCodes);

		regenTrigger.addEventListener('click', () => {
			regenPanel.hidden = false;
			regenTrigger.hidden = true;
			pick('[data-scy-regen-confirm]').focus();
		});
		pick('[data-scy-regen-cancel]').addEventListener('click', () => {
			regenPanel.hidden = true;
			regenTrigger.hidden = false;
			regenTrigger.focus();
		});
		pick('[data-scy-regen-confirm]').addEventListener('click', replaceCodes);

		pick('[data-scy-codes-copy]').addEventListener('click', () => {
			window.Basalt.copyText(codesAsText());
			notify({
				tone: 'success',
				icon: 'bi-copy',
				title: 'Codes copied',
				text: `The ${unusedCodeCount()} unused codes are on your clipboard.`,
				duration: 3000,
			});
		});
		pick('[data-scy-codes-download]').addEventListener('click', downloadCodes);
	}

	function showCodes() {
		paintCodeSheet();
		regenPanel.hidden = true;
		regenTrigger.hidden = false;
		dialog('sec-codes').show();
	}

	function paintCodeSheet() {
		codeSheet.innerHTML = account.backupCodes
			.map(({ code, used }) => {
				const spentTag = used ? '<span class="scy-codes-used">used</span>' : '';
				return `<li class="${used ? 'is-used' : ''}"><span class="scy-codes-code">${htmlSafe(code)}</span>${spentTag}</li>`;
			})
			.join('');
		codeSheet.setAttribute('aria-label', `${unusedCodeCount()} of ${account.backupCodes.length} codes unused`);
		pick('[data-scy-codes-sub]').textContent = `Made ${longDate(account.codesMadeAt)}. Each code works once.`;
	}

	async function replaceCodes(event) {
		const button = event.currentTarget;
		button.disabled = true;
		try {
			await backend.newCodes();
			account.backupCodes = freshCodeSet();
			account.codesMadeAt = new Date(today);
			paintCodeSheet();
			paintTwoStep();
			regenPanel.hidden = true;
			regenTrigger.hidden = false;
			window.Basalt.announce('8 new backup codes made. The old ones no longer work.');
			notify({
				tone: 'success',
				icon: 'bi-key',
				title: 'New backup codes made',
				text: 'Save them somewhere safe. The old ones no longer work.',
			});
		} catch {
			reportSaveFailure();
		} finally {
			button.disabled = false;
		}
	}

	/* Eight codes, each two groups of four digits, matching Account Settings. */
	function freshCodeSet() {
		function fourDigits() {
			return String(Math.floor(1000 + Math.random() * 9000));
		}
		return Array.from({ length: 8 }, () => ({ code: `${fourDigits()}-${fourDigits()}`, used: false }));
	}

	function unusedCodeCount() {
		return account.backupCodes.filter((entry) => !entry.used).length;
	}

	function codesAsText() {
		const unused = account.backupCodes.filter((entry) => !entry.used).map((entry) => entry.code);
		return `Fieldline backup codes for ${source.person.email}\nEach code works once.\n\n${unused.join('\n')}\n`;
	}

	function downloadCodes() {
		const href = URL.createObjectURL(new Blob([codesAsText()], { type: 'text/plain' }));
		const link = document.createElement('a');
		link.href = href;
		link.download = 'fieldline-backup-codes.txt';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(href), 1000);
	}

	/* Passkeys can be added, renamed and removed; each change round-trips the backend. */

	function bindPasskeys() {
		document.getElementById('sec-passkey').addEventListener('shown.bs.modal', () => {
			keyNameField.focus();
			keyNameField.select();
		});
		pick('[data-scy-passkey-add]', page).addEventListener('click', () => openPasskeyDialog(null));
		keyNameField.addEventListener('input', () => keyNameField.classList.remove('is-invalid'));
		keyList.addEventListener('click', onPasskeyRowClick);
		keyForm.addEventListener('submit', savePasskey);
		pick('[data-scy-remove-confirm]').addEventListener('click', confirmPasskeyRemoval);
	}

	function paintPasskeys() {
		keyList.innerHTML = account.passkeys.map(passkeyRow).join('');
		keyListEmpty.hidden = account.passkeys.length > 0;
		keyList.hidden = account.passkeys.length === 0;
		window.Basalt.tips?.(keyList);
	}

	function passkeyRow(key) {
		const lastUse = key.used
			? `last used ${lowerDayWords(dayWord(parseStamp(key.used)))}`
			: 'not used to sign in yet';
		const label = htmlSafe(key.name);
		return [
			`<li data-scy-passkey="${htmlSafe(key.id)}" class="scy-item">`,
			`<span aria-hidden="true" class="scy-item-icon"><i class="bi ${htmlSafe(key.icon)}"></i></span>`,
			'<div class="scy-item-body">',
			`<p class="scy-item-title">${label} · ${htmlSafe(key.kind)}</p>`,
			`<p class="scy-item-meta">Added ${longDate(parseStamp(key.added))}, ${lastUse}.</p>`,
			'</div>',
			'<div class="scy-item-end">',
			iconButton('data-scy-pk-rename', `Rename ${label}`, 'Rename', 'bi-pencil'),
			iconButton('data-scy-pk-remove', `Remove ${label}`, 'Remove', 'bi-trash3'),
			'</div></li>',
		].join('');
	}

	function onPasskeyRowClick(event) {
		const row = event.target.closest('[data-scy-passkey]');
		if (!row) return;
		const key = account.passkeys.find((entry) => entry.id === row.getAttribute('data-scy-passkey'));

		if (event.target.closest('[data-scy-pk-rename]')) {
			closeTooltips(row);
			openPasskeyDialog(key);
		}
		if (event.target.closest('[data-scy-pk-remove]')) {
			closeTooltips(row);
			passkeyToRemove = key;
			pick('[data-scy-remove-text]').textContent =
				account.passkeys.length === 1
					? `${key.name} is your only passkey. You can still sign in with your password and a code.`
					: `${key.name} stops working. Your other passkeys and your password still do.`;
			dialog('sec-passkey-remove').show();
		}
	}

	/** Opens the passkey dialog to rename `key`, or to add a new one when it is null. */
	function openPasskeyDialog(key) {
		passkeyToRename = key || null;
		keyForm.reset();
		keyNameField.classList.remove('is-invalid');
		keyNameField.value = key ? key.name : 'Windows laptop';
		pick('[data-scy-passkey-title]', keyForm).textContent = key ? 'Rename passkey' : 'Add a passkey';
		pick('[data-scy-passkey-sub]', keyForm).textContent = key
			? 'Only the name changes. The passkey keeps working.'
			: 'Your browser asks for your fingerprint, face or screen lock next.';
		pick('[data-scy-passkey-save-label]', keyForm).textContent = key ? 'Save' : 'Continue';
		window.Basalt.buttonState(keySubmit, 'idle');
		dialog('sec-passkey').show();
	}

	async function savePasskey(event) {
		event.preventDefault();
		const chosenName = keyNameField.value.trim();
		if (!chosenName) {
			keyNameField.classList.add('is-invalid');
			keyNameField.focus();
			return;
		}
		if (keySubmit.getAttribute('aria-busy') === 'true') return;

		window.Basalt.buttonState(keySubmit, 'loading');
		const renaming = passkeyToRename;
		try {
			await (renaming ? backend.renamePasskey() : backend.addPasskey());
			if (renaming) renaming.name = chosenName;
			else account.passkeys.push(newPasskey(chosenName));
			paintPasskeys();
			window.Basalt.buttonState(keySubmit, 'success');
			setTimeout(() => dialog('sec-passkey').hide(), 500);
			notify({
				tone: 'success',
				icon: 'bi-fingerprint',
				title: renaming ? 'Passkey renamed' : 'Passkey added',
				text: renaming ? '' : 'Next time, choose "Sign in with a passkey".',
			});
		} catch {
			window.Basalt.buttonState(keySubmit, 'error');
			reportSaveFailure();
			setTimeout(() => window.Basalt.buttonState(keySubmit, 'idle'), 1600);
		}
	}

	function newPasskey(label) {
		function pad(part) {
			return String(part).padStart(2, '0');
		}
		return {
			id: `pk-${Date.now()}`,
			name: label,
			kind: 'Windows Hello',
			icon: 'bi-pc-display',
			added: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
			used: null,
		};
	}

	async function confirmPasskeyRemoval(event) {
		if (!passkeyToRemove) return;
		const button = event.currentTarget;
		const removed = passkeyToRemove;
		button.disabled = true;
		try {
			await backend.removePasskey();
			account.passkeys = account.passkeys.filter((entry) => entry !== removed);
			paintPasskeys();
			dialog('sec-passkey-remove').hide();
			notify({
				tone: 'success',
				icon: 'bi-trash3',
				title: 'Passkey removed',
				text: `${removed.name} no longer signs you in.`,
			});
		} catch {
			reportSaveFailure();
		} finally {
			button.disabled = false;
			passkeyToRemove = null;
		}
	}

	/* Recent sign-ins, each opening a drawer with the full record. */

	function bindSignins() {
		signinList.addEventListener('click', (event) => {
			const row = event.target.closest('[data-scy-signin]');
			if (!row) return;
			closeTooltips(row);
			openSigninDrawer(row.getAttribute('data-scy-signin'));
		});

		pick('[data-scy-d-password]', signinDrawer).addEventListener('click', () => {
			const drawer = window.bootstrap.Offcanvas.getOrCreateInstance(signinDrawer);
			signinDrawer.addEventListener(
				'hidden.bs.offcanvas',
				() => {
					pick('#scy-password').scrollIntoView({ behavior: 'smooth', block: 'start' });
					pw.current.focus({ preventScroll: true });
				},
				{ once: true },
			);
			drawer.hide();
		});
	}

	/* Lookups that fall back to neutral wording when the fixtures lack a key. */
	function deviceFor(key) {
		return source.devices[key] || { name: 'Unknown device', os: '', browser: '', icon: 'bi-question-circle' };
	}

	function placeFor(key) {
		return source.places[key] || { city: 'Unknown', country: '' };
	}

	function methodFor(key) {
		return source.methods[key] || { label: key, second: '' };
	}

	function stampText(stamp) {
		const moment = parseStamp(stamp);
		return `${dayWord(moment)}, ${clockTime(moment)}`;
	}

	function sessionBadge(signin) {
		if (signin.current) return '<span class="basalt-status basalt-status-primary">This device</span>';
		return signin.session.state === 'active'
			? '<span class="basalt-status basalt-status-success basalt-status-dot">Signed in</span>'
			: '<span class="basalt-status">Signed out</span>';
	}

	function paintSignins() {
		signinList.innerHTML = source.signins
			.map((signin) => {
				const machine = deviceFor(signin.device);
				const spot = placeFor(signin.place);
				const at = stampText(signin.at);
				return [
					`<li data-scy-signin="${htmlSafe(signin.id)}" class="scy-item">`,
					`<span aria-hidden="true" class="scy-item-icon"><i class="bi ${htmlSafe(machine.icon)}"></i></span>`,
					'<div class="scy-item-body">',
					`<p class="scy-item-title">${htmlSafe(machine.name)} · ${htmlSafe(machine.browser)}</p>`,
					`<p class="scy-item-meta">${htmlSafe(spot.city)}, ${htmlSafe(spot.country)} · ${htmlSafe(at)}</p>`,
					'</div>',
					'<div class="scy-item-end">',
					`<span class="scy-item-pill">${sessionBadge(signin)}</span>`,
					iconButton(
						'data-scy-quick',
						`Quick view: ${htmlSafe(`${machine.name}, ${at}`)}`,
						'Quick view',
						'bi-layout-sidebar-inset-reverse',
					),
					'</div></li>',
				].join('');
			})
			.join('');
		window.Basalt.tips?.(signinList);
	}

	function openSigninDrawer(id) {
		const signin = source.signins.find((entry) => entry.id === id);
		if (!signin) return;
		const machine = deviceFor(signin.device);
		const spot = placeFor(signin.place);
		const how = methodFor(signin.method);

		pick('[data-scy-d="title"]', signinDrawer).textContent = `${machine.name} · ${machine.browser}`;
		pick('[data-scy-d="sub"]', signinDrawer).textContent = `${stampText(signin.at)} · ${spot.city}`;

		const signedInAt = parseStamp(signin.at);
		const facts = [
			['Signed in', `${longDate(signedInAt)}, ${clockTime(signedInAt)}`],
			['Session', sessionSummary(signin)],
			['Device', `${machine.name}, ${machine.os}`],
			['Browser', machine.browser],
			['Method', how.label],
			['Second step', how.second],
			['Where', `${spot.city}, ${spot.country}`],
			['IP address', signin.ip],
		];
		const pairs = facts
			.map(([term, detail]) => `<div><dt>${htmlSafe(term)}</dt><dd>${htmlSafe(detail)}</dd></div>`)
			.join('');
		pick('[data-scy-d="body"]', signinDrawer).innerHTML = `<dl class="scy-facts">${pairs}</dl>`;
		window.bootstrap.Offcanvas.getOrCreateInstance(signinDrawer).show();
	}

	function sessionSummary(signin) {
		if (signin.current) return 'This device, open now';
		if (signin.session.state === 'active')
			return `Still open, last seen ${lowerDayWords(stampText(signin.session.last))}`;
		return `Signed out at ${clockTime(parseStamp(signin.session.last))}`;
	}

	/* Dates are all read against the frozen demo clock in the fixtures. */

	/** Reads 'YYYY-MM-DD HH:MM' (the time is optional) as a local Date. */
	function parseStamp(stamp) {
		const [datePart, timePart] = String(stamp).split(' ');
		const [year, month, day] = datePart.split('-').map(Number);
		const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
		return new Date(year, month - 1, day, hours, minutes);
	}

	function isSameDate(one, other) {
		return one.toDateString() === other.toDateString();
	}

	function shortDate(moment) {
		return `${MONTH_ABBR[moment.getMonth()]} ${moment.getDate()}`;
	}

	function longDate(moment) {
		return `${shortDate(moment)}, ${moment.getFullYear()}`;
	}

	function clockTime(moment) {
		const hours = moment.getHours();
		const minutes = String(moment.getMinutes()).padStart(2, '0');
		return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
	}

	function dayWord(moment) {
		if (isSameDate(moment, today)) return 'Today';
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);
		return isSameDate(moment, yesterday) ? 'Yesterday' : shortDate(moment);
	}

	/* Day words sit mid-sentence in some places, so they lose the capital there. */
	function lowerDayWords(text) {
		return text.replace('Today', 'today').replace('Yesterday', 'yesterday');
	}

	/** Whole months between `moment` and today, as a phrase. */
	function monthsSince(moment) {
		const dayNotReached = today.getDate() < moment.getDate() ? 1 : 0;
		const months =
			(today.getFullYear() - moment.getFullYear()) * 12 + today.getMonth() - moment.getMonth() - dayNotReached;
		if (months <= 0) return 'this month';
		return months === 1 ? 'a month ago' : `${months} months ago`;
	}

	/* Lookups, escaping and the Bootstrap and toast calls every section shares. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	function lastFour(phone) {
		return String(phone).replace(/\D/g, '').slice(-4);
	}

	function setFigure(key, text) {
		const slot = pick(`[data-scy-fig="${key}"]`, page);
		if (slot) slot.textContent = text;
	}

	function unflag(container) {
		for (const field of pickAll('.is-invalid', container)) field.classList.remove('is-invalid');
	}

	function iconButton(hook, label, tip, glyph) {
		return `<button ${hook} type="button" aria-label="${label}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${tip}" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi ${glyph}"></i></button>`;
	}

	function closeTooltips(container) {
		for (const trigger of pickAll('[data-bs-toggle="tooltip"]', container)) {
			window.bootstrap.Tooltip.getInstance(trigger)?.hide();
		}
	}

	function dialog(id) {
		return window.bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	function reportSaveFailure() {
		notify({
			tone: 'danger',
			icon: 'bi-exclamation-circle',
			title: "That didn't save",
			text: 'Check your connection and try again.',
		});
	}

	function wait(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/** Resolves after `ms`, or rejects then when the page runs offline. */
	async function settleAfter(ms) {
		await wait(ms);
		if (failEverySave) throw new Error('offline');
	}

	start();
})();
