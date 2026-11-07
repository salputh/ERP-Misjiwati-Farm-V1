/**
 * Behavior for the sign-in family of pages: login, register, password reset,
 * magic link, SSO, two-factor, email confirmation, lock screen, session
 * expiry and suspension. It checks fields as they are typed, rates a new
 * password, steps through one-time-code boxes, counts down resend buttons,
 * raises small notices, and drives the two backdrops: the Daylight sky that
 * tracks the visitor's clock and the Threshold door that opens with progress.
 */
(() => {
	'use strict';

	/* Twelve characters is the floor for a new password and for the strength
     meter's top mark; twenty earns a bonus step. */
	const PASSWORD_FLOOR = 12;

	/* Structures an attacker tries first. Any one of them costs a step:
     a character repeated three times, an ascending digit run, a short
     keyboard run, or nothing but a year. */
	const GUESSABLE_SHAPES = [
		/(.)\1{2,}/,
		/(?:0123|1234|2345|3456|4567|5678|6789)/,
		/(?:abc|bcd|cde|def|qwe|wer|ert|asd)/i,
		/^(?:19|20)\d{2}$/,
	];

	const ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	const NOTICE_ICONS = {
		success: 'bi-check-circle-fill',
		danger: 'bi-exclamation-triangle-fill',
	};

	const STRENGTH_WORDS = { 1: 'Weak', 2: 'Fair', 3: 'Strong' };

	/* Hours used when the address carries ?sky=dawn|day|dusk|night, so a
     reviewer can see another time of day without waiting for it. */
	const SKY_PREVIEWS = { dawn: 6.5, day: 12.5, dusk: 18.3, night: 23.2 };

	/* Each band is [from, until, name]; an hour outside every band falls to
     the fallback passed alongside. */
	const SKY_PHASES = [
		[5, 8, 'dawn'],
		[8, 17, 'day'],
		[17, 20, 'dusk'],
	];
	const SALUTATIONS = [
		[5, 11, 'Selamat pagi'],
		[11, 15, 'Selamat siang'],
		[15, 18, 'Selamat sore'],
		[18, 22, 'Selamat malam'],
	];

	/* What each data-signin-validate kind demands of a filled-in field. Every
     rule returns its complaint, or '' when the value passes. */
	const FIELD_RULES = {
		email: (typed) => (ADDRESS_PATTERN.test(typed) ? '' : 'That address is missing something. Check it over.'),
		password: (typed) => (typed.length >= PASSWORD_FLOOR ? '' : `Use ${PASSWORD_FLOOR} characters or more.`),
		name: (typed) => (typed.length >= 2 ? '' : 'First and last name, please.'),
		confirm: (typed, field) => {
			const original = field.dataset.signinMatch ? document.getElementById(field.dataset.signinMatch) : null;
			const agrees = original && field.value && original.value === field.value;
			return agrees ? '' : 'The two entries are different.';
		},
	};

	const threshold = pick('[data-signin-door]');

	/**
	 * The sky is painted right away so the daytime default never flashes; the
	 * script is deferred, so the markup is already there. Everything else
	 * waits for the document to finish loading.
	 */
	function start() {
		mountSky();
		document.addEventListener('DOMContentLoaded', () => {
			for (const mount of [
				mountRevealButtons,
				mountStrengthMeters,
				mountForms,
				mountCodeBoxes,
				mountBackupCode,
				mountResendButtons,
				mountProviderButtons,
				mountActionLinks,
				mountCopyButtons,
				mountAlternatives,
				mountThreshold,
			]) {
				mount();
			}
		});
	}

	/* Notices: a single polite live region collects every message. */

	function noticeTray() {
		const existing = pick('.signin-toast-wrap');
		if (existing) return existing;
		const tray = document.createElement('div');
		tray.className = 'signin-toast-wrap';
		tray.setAttribute('aria-atomic', 'true');
		tray.setAttribute('aria-live', 'polite');
		document.body.appendChild(tray);
		return tray;
	}

	/**
	 * Shows a short message, then plays the exit animation and removes it.
	 * @param {string} text  Plain text; never parsed as markup.
	 * @param {'info'|'success'|'danger'} [tone]
	 * @param {number} [lifetime]  Milliseconds before the exit starts.
	 */
	function notify(text, tone = 'info', lifetime = 3200) {
		const note = document.createElement('div');
		note.setAttribute('role', 'status');
		note.className = `signin-toast signin-toast-${tone}`;
		note.innerHTML = `<i class="bi ${NOTICE_ICONS[tone] ?? 'bi-info-circle-fill'}"></i><span></span>`;
		pick('span', note).textContent = text;
		noticeTray().appendChild(note);

		setTimeout(() => {
			note.classList.add('is-leaving');
			note.addEventListener('animationend', () => note.remove(), { once: true });
		}, lifetime);
	}

	/** Swaps a button's label for a spinner and returns a function that undoes it. */
	function showBusy(button, caption) {
		const label = button.innerHTML;
		button.disabled = true;
		button.innerHTML = `<span class="spinner-border" role="status" aria-hidden="true"></span><span>${caption}</span>`;
		return () => {
			button.disabled = false;
			button.innerHTML = label;
		};
	}

	function goLater(address, delay) {
		setTimeout(() => {
			window.location.href = address;
		}, delay);
	}

	/* Passwords: the eye button and the strength meter. */

	function mountRevealButtons() {
		for (const eye of pickAll('[data-signin-password-toggle]')) {
			const secret = document.getElementById(eye.getAttribute('data-signin-password-toggle'));
			if (!secret) continue;
			eye.addEventListener('click', () => {
				const revealing = secret.type === 'password';
				secret.type = revealing ? 'text' : 'password';
				const glyph = pick('i', eye);
				glyph?.classList.toggle('bi-eye', !revealing);
				glyph?.classList.toggle('bi-eye-slash', revealing);
				eye.setAttribute('aria-label', revealing ? 'Sembunyikan password' : 'Tampilkan password');
			});
		}
	}

	function mountStrengthMeters() {
		for (const gauge of pickAll('[data-signin-strength-for]')) {
			const source = document.getElementById(gauge.getAttribute('data-signin-strength-for'));
			if (!source) continue;
			const caption = pick('.signin-strength-label-text', gauge);

			function refresh() {
				const rating = source.value ? ratePassword(source.value) : 0;
				gauge.toggleAttribute('data-level', rating > 0);
				if (rating > 0) gauge.setAttribute('data-level', String(rating));
				if (caption) caption.textContent = STRENGTH_WORDS[rating] ?? 'Nothing typed yet';
			}

			source.addEventListener('input', refresh);
			refresh();
		}
	}

	/**
	 * Rates a password from 1 to 3 (0 when empty). Length sets the starting
	 * point; few distinct characters or a guessable shape each take a step
	 * away, because that is how passwords actually fall. A rule that counted
	 * character classes would call "Passw0rd!" strong.
	 */
	function ratePassword(candidate) {
		if (!candidate) return 0;
		const { length } = candidate;
		let rating = 1;
		if (length >= PASSWORD_FLOOR) rating = 3;
		else if (length >= 9) rating = 2;
		if (new Set(candidate).size < Math.ceil(length / 2)) rating -= 1;
		if (GUESSABLE_SHAPES.some((shape) => shape.test(candidate))) rating -= 1;
		if (length >= 20) rating += 1;
		return Math.max(1, Math.min(3, rating));
	}

	/* Forms: field checks, the required boxes and the pretend submit. */

	function mountForms() {
		for (const form of pickAll('[data-signin-form]')) {
			const checked = pickAll('[data-signin-validate]', form);

			for (const field of checked) {
				field.addEventListener('blur', () => judge(field));
				field.addEventListener('input', () => {
					if (field.classList.contains('is-invalid')) judge(field);
				});
			}

			form.addEventListener('submit', (event) => {
				event.preventDefault();
				const verdicts = Array.from(checked, judge);
				for (const box of pickAll('[data-signin-required-check]', form)) {
					box.classList.toggle('is-invalid', !box.checked);
					verdicts.push(box.checked);
				}

				if (verdicts.includes(false)) {
					notify('A couple of fields still need work.', 'danger');
					return;
				}
				pretendSubmit(form);
			});
		}
	}

	/**
	 * Waits as a server would, then reports success. A form that names a
	 * success panel swaps itself for that panel and leaves the button busy;
	 * any other form gets its button back.
	 */
	function pretendSubmit(form) {
		const button = pick('[data-signin-submit]', form);
		if (!button) return;
		const restore = showBusy(button, button.dataset.busyLabel || 'Working on it…');

		setTimeout(() => {
			const { signinSuccess, signinRedirect, signinSuccessState } = form.dataset;
			notify(signinSuccess || 'That worked.', 'success');
			openThreshold(1);

			const panel = signinSuccessState && document.getElementById(signinSuccessState);
			if (panel) {
				form.classList.add('signin-hidden');
				panel.classList.remove('signin-hidden');
				if (signinRedirect) goLater(signinRedirect, 1600);
				return;
			}

			if (signinRedirect) goLater(signinRedirect, 900);
			restore();
		}, 1200);
	}

	/** Marks the field and returns false when it fails, clears it and returns true otherwise. */
	function judge(field) {
		const complaint = fieldComplaint(field);
		if (!complaint) {
			field.classList.remove('is-invalid');
			return true;
		}
		field.classList.add('is-invalid');
		const slot = (field.closest('.signin-field') || field.closest('.form-check, .mb-3, div'))?.querySelector(
			'.invalid-feedback',
		);
		if (slot) slot.textContent = complaint;
		return false;
	}

	/**
	 * Names what is wrong with a field, or returns '' when nothing is. It has
	 * no side effects, so the Threshold door can ask after every keystroke
	 * without flagging fields the visitor has not reached.
	 */
	function fieldComplaint(field) {
		const typed = field.value.trim();
		if (!typed && field.hasAttribute('required')) return 'Fill this in to continue.';

		const kind = field.dataset.signinValidate;
		return Object.hasOwn(FIELD_RULES, kind) ? FIELD_RULES[kind](typed, field) : '';
	}

	/* One-time codes: six single-digit boxes, then a pretend check. */

	function mountCodeBoxes() {
		for (const group of pickAll('[data-signin-otp]')) {
			const boxes = Array.from(pickAll('.signin-otp-input', group));
			const confirmButton = pick(group.dataset.signinOtpSubmit || '') || null;

			function syncConfirm() {
				if (confirmButton) confirmButton.disabled = !boxes.every((box) => box.value.length === 1);
			}

			for (const [position, box] of boxes.entries()) {
				wireCodeBox(box, position, boxes, syncConfirm);
			}
			syncConfirm();

			confirmButton?.addEventListener('click', (event) => {
				event.preventDefault();
				checkCode(group, boxes, confirmButton);
			});
		}
	}

	function wireCodeBox(box, position, boxes, syncConfirm) {
		const before = boxes[position - 1];
		const after = boxes[position + 1];
		box.setAttribute('autocomplete', 'one-time-code');
		box.setAttribute('maxlength', '1');
		box.setAttribute('inputmode', 'numeric');

		box.addEventListener('input', () => {
			box.value = box.value.replace(/\D/g, '').slice(0, 1);
			const filled = Boolean(box.value);
			box.classList.toggle('is-filled', filled);
			if (filled) {
				box.classList.remove('is-invalid');
				after?.focus();
			}
			syncConfirm();
		});

		const keyMoves = {
			Backspace() {
				if (box.value || !before) return;
				before.focus();
				before.value = '';
				before.classList.remove('is-filled');
				syncConfirm();
			},
			ArrowLeft() {
				before?.focus();
			},
			ArrowRight() {
				after?.focus();
			},
		};
		box.addEventListener('keydown', (event) => keyMoves[event.key]?.());

		box.addEventListener('paste', (event) => {
			event.preventDefault();
			const pasted = (event.clipboardData || window.clipboardData).getData('text');
			const numerals = pasted.replace(/\D/g, '').slice(0, boxes.length);
			if (!numerals) return;
			for (const [slot, numeral] of [...numerals].entries()) {
				boxes[slot].value = numeral;
				boxes[slot].classList.add('is-filled');
			}
			boxes[Math.min(numerals.length, boxes.length - 1)].focus();
			syncConfirm();
		});

		box.addEventListener('focus', () => box.select());
	}

	function checkCode(group, boxes, confirmButton) {
		const entered = boxes.map((box) => box.value).join('');
		if (entered.length !== boxes.length) {
			notify(`All ${boxes.length} digits are needed.`, 'danger');
			return;
		}
		const restore = showBusy(confirmButton, 'Checking the code…');

		setTimeout(() => {
			if (isImplausibleCode(entered)) {
				for (const box of boxes) box.classList.add('is-invalid');
				notify('Invalid code, try again', 'danger');
				restore();
				return;
			}
			notify('Code accepted.', 'success');
			openThreshold(1);
			const destination = group.dataset.signinOtpRedirect;
			setTimeout(() => {
				notify('Opening your dashboard…', 'info');
				if (destination) goLater(destination, 700);
			}, 900);
		}, 1200);
	}
	/* Two-factor fallback: the link swaps the six boxes for one backup-code
	   field, which signs in the same way when the code looks right. */

	function mountBackupCode() {
		const toggle = pick('[data-signin-backup-toggle]');
		const form = pick('[data-signin-backup]');
		if (!toggle || !form) return;
		const codeParts = pickAll('[data-signin-code-part]');
		const field = pick('input', form);
		const label = pick('span', toggle);

		toggle.addEventListener('click', () => {
			const showBackup = form.hidden;
			form.hidden = !showBackup;
			for (const part of codeParts) part.hidden = showBackup;
			toggle.setAttribute('aria-expanded', String(showBackup));
			label.textContent = showBackup ? 'Use the app code' : 'Use a backup code';
			(showBackup ? field : codeParts[0]?.querySelector('input'))?.focus();
		});

		field.addEventListener('input', () => field.classList.remove('is-invalid'));

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const code = field.value.trim().toUpperCase();
			if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) {
				field.classList.add('is-invalid');
				field.focus();
				return;
			}
			const button = pick('button[type="submit"]', form);
			const restore = showBusy(button, 'Checking the code…');
			setTimeout(() => {
				restore();
				notify('Backup code accepted. It will not work again.', 'success');
				openThreshold(1);
				goLater(form.dataset.signinOtpRedirect || 'index.html', 1200);
			}, 1000);
		});
	}

	/**
	 * The demo has to fail on something. Instead of one magic number it
	 * refuses what no authenticator app would ever show: a single digit
	 * repeated, or digits climbing one by one.
	 */
	function isImplausibleCode(entered) {
		if (/^(\d)\1+$/.test(entered)) return true;
		return [...entered].every((digit, index, all) => index === 0 || Number(digit) === Number(all[index - 1]) + 1);
	}

	/* Resend buttons stay locked while a countdown runs, then unlock. */

	function mountResendButtons() {
		for (const resend of pickAll('[data-signin-resend]')) {
			const configured = parseInt(resend.dataset.signinResend, 10);
			const span = isNaN(configured) ? 45 : configured;
			const readout = pick(resend.dataset.signinResendTimer || '');
			/* Pages that resend an email rather than a code supply their own wording. */
			const pattern = resend.dataset.signinResendWait || 'Another code in {s}s';
			let left = span;
			let ticker = null;

			function show() {
				if (!readout) return;
				readout.textContent = left > 0 ? pattern.replace('{s}', left) : 'Nothing arrived yet?';
			}

			function lock() {
				resend.disabled = true;
				left = span;
				show();
				clearInterval(ticker);
				ticker = setInterval(() => {
					left -= 1;
					show();
					if (left > 0) return;
					clearInterval(ticker);
					resend.disabled = false;
				}, 1000);
			}

			resend.addEventListener('click', (event) => {
				event.preventDefault();
				if (resend.disabled) return;
				notify(resend.dataset.signinResendMessage || 'Fresh code on its way.', 'success');
				lock();
			});
			lock();
		}
	}

	/* Smaller controls: identity providers, action links, copy, other methods. */

	function mountProviderButtons() {
		for (const provider of pickAll('[data-signin-social]')) {
			provider.addEventListener('click', (event) => {
				event.preventDefault();
				notify(`Handing you over to ${provider.dataset.signinSocial}…`, 'info');
			});
		}
	}

	function mountActionLinks() {
		for (const action of pickAll('[data-signin-action]')) {
			action.addEventListener('click', (event) => {
				event.preventDefault();
				const { signinMessage, signinRedirect } = action.dataset;
				notify(signinMessage || 'One moment…', 'info');
				if (signinRedirect) goLater(signinRedirect, 900);
			});
		}
	}

	function mountCopyButtons() {
		for (const copier of pickAll('[data-signin-copy]')) {
			copier.addEventListener('click', () => {
				const reference = copier.dataset.signinCopy;
				if (!(navigator.clipboard && window.isSecureContext)) {
					notify('Copy needs a secure page. Select the code instead.', 'info');
					return;
				}
				navigator.clipboard.writeText(reference).then(
					() => notify(`Copied ${reference}`, 'success'),
					() => notify('Copy failed. Select the code instead.', 'danger'),
				);
			});
		}
	}

	function mountAlternatives() {
		for (const opener of pickAll('[data-signin-others]')) {
			const drawer = document.getElementById(opener.getAttribute('aria-controls'));
			if (!drawer) continue;
			opener.addEventListener('click', () => {
				const expanding = opener.getAttribute('aria-expanded') !== 'true';
				opener.setAttribute('aria-expanded', String(expanding));
				foldDrawer(drawer, expanding);
			});
		}
	}

	/**
	 * Slides the drawer of other sign-in methods open or shut. These pages
	 * load without basalt.js, so the fold is eased here, with the same timing
	 * as the shared slide; reduced motion just shows or hides it.
	 * @param {HTMLElement} drawer
	 * @param {boolean} open
	 */
	function foldDrawer(drawer, open) {
		for (const motion of drawer.getAnimations()) motion.cancel();
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
			drawer.hidden = !open;
			return;
		}
		const from = drawer.hidden ? 0 : drawer.getBoundingClientRect().height;
		drawer.hidden = false;
		const full = drawer.getBoundingClientRect().height;
		const gap = getComputedStyle(drawer).marginTop;
		const shape = (height) => ({
			height: `${height}px`,
			marginTop: height ? gap : '0px',
			opacity: height ? 1 : 0,
			overflow: 'hidden',
		});
		const motion = drawer.animate([shape(from), shape(open ? full : 0)], {
			duration: 260,
			easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
		});
		if (!open)
			motion.addEventListener('finish', () => {
				drawer.hidden = true;
			});
	}

	/* Threshold: [data-signin-door] keeps how far the door stands open, 0 to 1,
     in --signin-open. The value "form" ties it to progress through the form,
     and success swings it wide; a number pins it (ajar when a session
     expires, shut for a suspended account). */

	function openThreshold(amount) {
		threshold?.style.setProperty('--signin-open', Math.min(1, Math.max(0, amount)).toFixed(3));
	}

	function mountThreshold() {
		if (!threshold) return;
		const setting = threshold.dataset.signinDoor;
		if (setting !== 'form') {
			openThreshold(parseFloat(setting) || 0);
			return;
		}
		document.addEventListener('input', gaugeProgress);
		document.addEventListener('change', gaugeProgress);
		gaugeProgress();
	}

	function gaugeProgress() {
		const steps = [];
		const form = pick('[data-signin-form]:not(.signin-hidden)');
		if (form) {
			for (const field of pickAll('[data-signin-validate]', form)) steps.push(fieldComplaint(field) === '');
			for (const box of pickAll('[data-signin-required-check]', form)) steps.push(box.checked);
		}
		for (const box of pickAll('.signin-otp-input')) steps.push(box.value.length === 1);
		if (steps.length) openThreshold(steps.filter(Boolean).length / steps.length);
	}

	/* Daylight: the sky, the sun and the greeting follow the visitor's clock. */

	function mountSky() {
		const sky = pick('[data-signin-sky]');
		if (!sky) return;
		let pinnedHour = null;
		try {
			pinnedHour = SKY_PREVIEWS[new URLSearchParams(window.location.search).get('sky')] || null;
		} catch {
			/* No address bar to read (a sandboxed frame): the live sky shows. */
		}

		function render() {
			const now = new Date();
			const hour = pinnedHour === null ? now.getHours() + now.getMinutes() / 60 : pinnedHour;
			placeSun(sky, hour);
			writeClock(now, hour);
			writeGreeting(hour);
		}

		render();
		setInterval(render, 30000);
	}

	function bandFor(hour, bands, fallback) {
		const match = bands.find(([from, until]) => hour >= from && hour < until);
		return match ? match[2] : fallback;
	}

	/**
	 * Sets the phase and moves the sun (the moon after dark) along its arc.
	 * The arc peaks high enough to clear the clock and the greeting.
	 */
	function placeSun(sky, hour) {
		const phase = bandFor(hour, SKY_PHASES, 'night');
		const travel = phase === 'night' ? ((hour - 20 + 24) % 24) / 9 : Math.max(0, Math.min(1, (hour - 5) / 15));
		sky.dataset.phase = phase;
		sky.style.setProperty('--sun-x', `${(9.7 + travel * 80.5).toFixed(1)}%`);
		sky.style.setProperty('--sun-y', `${(84.5 - Math.sin(Math.PI * travel) * 72).toFixed(1)}%`);
	}

	function writeClock(now, hour) {
		const wholeHour = Math.floor(hour);
		const minutes = String(Math.floor((hour - wholeHour) * 60)).padStart(2, '0');
		const meridiem = '';
		const stamp = `${String(wholeHour).padStart(2, '0')}:${minutes}`;
		const day = now.toLocaleDateString('id-ID', { weekday: 'long', month: 'long', day: 'numeric' });
		for (const clock of pickAll('[data-signin-clock]')) {
			clock.textContent = `${stamp} · ${day}`;
		}
	}

	function writeGreeting(hour) {
		const opening = bandFor(hour, SALUTATIONS, 'Masih bekerja');
		const ending = hour >= 5 && hour < 22 ? '.' : '?';
		for (const line of pickAll('[data-signin-greeting]')) {
			const person = line.dataset.signinGreeting;
			line.textContent = `${opening}${person ? `, ${person}` : ''}${ending}`;
		}
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
