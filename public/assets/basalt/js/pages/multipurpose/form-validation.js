/**
 * Drives the field demos on form-validation.html: the kind filter, then one
 * small form per card, each checking its own input in plain ES6. A field's
 * message is written into the element whose id is the field id plus
 * "-error", which the field already points at through aria-describedby.
 */
(() => {
	'use strict';

	const page = pick('[data-val-root]', document);
	if (!page) return;

	start();

	/** Wires the summary links, the filter and then each card's demo. */
	function start() {
		page.addEventListener('click', jumpToProblemField);
		mountKindFilter();
		mountCardPayment();
		mountPostalCode();
		mountNewPassword();
		mountShopAddress();
		mountReceiptEmail();
		mountPhoneNumber();
		mountPriceAndSale();
		mountSkillTags();
		mountFirstVisit();
		mountReorderStepper();
		mountSkuPattern();
		mountSummaryForm();
		mountPromoCode();
		mountConstraintInspector();
		mountStickerNote();
	}

	/* Lookups and small conversions every demo leans on. */

	function pick(selector, scope) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope) {
		return [...scope.querySelectorAll(selector)];
	}

	function messageSlot(field) {
		return document.getElementById(`${field.id}-error`);
	}

	function dollars(amount) {
		return `$${amount.toFixed(2)}`;
	}

	function plural(total, word) {
		return `${total} ${word}${total === 1 ? '' : 's'}`;
	}

	function onlyDigits(text) {
		return text.replace(/\D/g, '');
	}

	function isFlagged(field) {
		return field.getAttribute('aria-invalid') === 'true';
	}

	/**
	 * Shows a field as wrong and writes the reason under it. Always answers
	 * false, so a check can end with `return flagError(...)`.
	 * @param {HTMLElement} field
	 * @param {string} reason
	 * @param {HTMLElement} [frame] a wrapper that carries the red edge instead
	 */
	function flagError(field, reason, frame) {
		field.classList.remove('is-valid');
		field.classList.add('is-invalid');
		field.setAttribute('aria-invalid', 'true');
		frame?.classList.add('is-invalid');
		const slot = messageSlot(field);
		if (slot) slot.textContent = reason;
		return false;
	}

	/**
	 * Takes the error off a field; with `markValid` the green tick goes on.
	 * Always answers true.
	 */
	function clearError(field, markValid, frame) {
		field.classList.remove('is-invalid');
		field.classList.toggle('is-valid', Boolean(markValid));
		field.removeAttribute('aria-invalid');
		frame?.classList.remove('is-invalid');
		const slot = messageSlot(field);
		if (slot) slot.replaceChildren();
		return true;
	}

	/**
	 * Runs `verify` when the visitor leaves a field that holds something. Once
	 * the field is flagged it is verified on every keystroke as well, so the
	 * message clears the moment the value is right. `after` runs each time.
	 */
	function watchField(field, verify, after) {
		function rerun() {
			verify();
			after?.();
		}
		field.addEventListener('blur', () => {
			if (field.value.trim() || isFlagged(field)) rerun();
		});
		field.addEventListener('input', () => {
			if (isFlagged(field)) rerun();
		});
	}

	/**
	 * Gives a form with one main field its submit handling: verify, focus the
	 * first flagged control on failure, otherwise print the confirmation.
	 */
	function wireSingleForm(demo, statusLine, verify, mainField, confirmation) {
		demo.addEventListener('input', () => {
			statusLine.replaceChildren();
		});
		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			if (verify(true)) {
				statusLine.textContent = confirmation();
				return;
			}
			(pick('[aria-invalid="true"]', demo) || mainField).focus();
		});
	}

	function hintButton(caption, onPress) {
		const button = Object.assign(document.createElement('button'), {
			type: 'button',
			className: 'btn btn-outline-secondary btn-sm',
			textContent: caption,
		});
		button.addEventListener('click', onPress);
		return button;
	}

	/* Error summary links: a click moves focus to the field it names. */

	function jumpToProblemField(event) {
		const link = event.target.closest('[data-val-summary-list] a');
		if (!link) return;
		event.preventDefault();
		const target = document.getElementById(link.getAttribute('href').slice(1));
		if (!target) return;
		target.scrollIntoView({ block: 'center', behavior: 'smooth' });
		target.focus({ preventScroll: true });
	}

	/**
	 * Brings a summary list in line with the flagged fields. Items that are
	 * still wanted are kept and only moved when out of place: re-creating or
	 * re-inserting an item cancels a click that is landing on it, and the
	 * blur check that a click triggers would otherwise do exactly that.
	 */
	function syncSummaryLinks(panel, flagged, headline) {
		const list = pick('[data-val-summary-list]', panel);
		const targets = flagged.map((field) => `#${field.id}`);
		const hrefOf = (item) => item.firstChild.getAttribute('href');

		for (const item of [...list.children]) {
			if (!targets.includes(hrefOf(item))) item.remove();
		}

		const kept = new Map([...list.children].map((item) => [hrefOf(item), item]));
		let cursor = list.firstChild;

		for (const [index, field] of flagged.entries()) {
			const item = kept.get(targets[index]) ?? summaryItem(targets[index]);
			const reason = messageSlot(field).textContent.trim();
			if (item.firstChild.textContent.trim() !== reason) item.firstChild.textContent = reason;
			if (item === cursor) {
				cursor = cursor.nextSibling;
			} else {
				list.insertBefore(item, cursor);
			}
		}

		pick('[data-val-summary-title]', panel).textContent = headline(flagged.length);
		panel.hidden = flagged.length === 0;
	}

	function summaryItem(href) {
		const item = document.createElement('li');
		item.appendChild(Object.assign(document.createElement('a'), { href }));
		return item;
	}

	/* Kind filter: the chips above the grid narrow it to one field type. */

	function mountKindFilter() {
		const grid = pick('[data-val-grid]', page);
		const tally = pick('[data-val-count]', page);
		const toggles = pickAll('[data-val-filter]', page);

		function applyKind(pressed) {
			const wanted = pressed.getAttribute('data-val-filter');
			const showAll = wanted === 'all';
			let visible = 0;

			for (const toggle of toggles) {
				toggle.setAttribute('aria-pressed', String(toggle === pressed));
			}
			for (const card of pickAll('[data-val-kind]', grid)) {
				const hidden = !showAll && card.getAttribute('data-val-kind') !== wanted;
				card.classList.toggle('is-hidden', hidden);
				if (!hidden) visible += 1;
			}

			grid.classList.toggle('is-filtered', !showAll);
			tally.textContent = plural(visible, 'card');
		}

		for (const toggle of toggles) {
			toggle.addEventListener('click', () => applyKind(toggle));
		}
	}

	/* Card payment: number with checksum, expiry and security code. */

	function mountCardPayment() {
		const demo = pick('[data-val-card]', page);
		if (!demo) return;

		const parts = Object.fromEntries(
			pickAll('[data-val-card-field]', demo).map((box) => [box.getAttribute('data-val-card-field'), box]),
		);
		const ordered = [parts.card, parts.exp, parts.cvc];
		const network = pick('[data-val-brand]', demo);
		const statusLine = pick('[data-val-card-status]', demo);

		/* Each reader answers with what is wrong, or '' when the value holds up. */
		const readers = {
			card(value) {
				const number = onlyDigits(value);
				const length = networkOf(number) === 'Amex' ? 15 : 16;
				const missing = length - number.length;
				if (!number) return 'Enter the card number.';
				if (missing > 0) return `That card number is ${plural(missing, 'digit')} short.`;
				return passesChecksum(number) ? '' : 'That card number has a typo. Check the digits against the card.';
			},
			exp(value) {
				if (!value) return 'Enter the expiry date.';
				const parsed = /^(\d{2}) \/ (\d{2})$/.exec(value);
				if (!parsed) return 'Enter the expiry as MM / YY.';
				const [, monthText, yearText] = parsed;
				const month = Number(monthText);
				const year = 2000 + Number(yearText);
				const today = new Date();
				const thisYear = today.getFullYear();
				if (month < 1 || month > 12) return 'The month has to be between 01 and 12.';
				if (year < thisYear || (year === thisYear && month < today.getMonth() + 1)) {
					return `This card expired in ${monthText}/${yearText}.`;
				}
				return year > thisYear + 20 ? 'That expiry year is too far away.' : '';
			},
			cvc(value) {
				const onFront = networkOf(onlyDigits(parts.card.value)) === 'Amex';
				if (!value) return 'Enter the security code.';
				if (new RegExp(`^\\d{${onFront ? 4 : 3}}$`).test(value)) return '';
				return onFront
					? 'Amex codes are the 4 digits on the front.'
					: 'The security code is the 3 digits on the back.';
			},
		};

		function verifyPart(box) {
			const problem = readers[box.getAttribute('data-val-card-field')](box.value.trim());
			return problem ? flagError(box, problem) : clearError(box, true);
		}

		parts.card.addEventListener('input', () => {
			const number = onlyDigits(parts.card.value);
			parts.card.value = groupCardDigits(number);
			network.textContent = networkOf(number);
			if (parts.cvc.value && isFlagged(parts.cvc)) verifyPart(parts.cvc);
		});
		parts.exp.addEventListener('input', (event) => {
			if (event.inputType?.startsWith('delete')) return;
			parts.exp.value = slashExpiry(onlyDigits(parts.exp.value).slice(0, 4));
		});
		parts.cvc.addEventListener('input', () => {
			parts.cvc.value = onlyDigits(parts.cvc.value).slice(0, 4);
		});

		for (const box of ordered) {
			watchField(box, () => verifyPart(box));
		}

		pick('[data-val-card-fill]', demo).addEventListener('click', () => {
			const sample = {
				card: '4242424242424242',
				exp: `09${(new Date().getFullYear() % 100) + 2}`,
				cvc: '314',
			};
			for (const box of ordered) {
				box.value = sample[box.getAttribute('data-val-card-field')];
				box.dispatchEvent(new Event('input'));
				verifyPart(box);
			}
			statusLine.replaceChildren();
		});

		demo.addEventListener('input', () => {
			statusLine.replaceChildren();
		});
		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			const wrong = ordered.filter((box) => !verifyPart(box));
			if (wrong.length) {
				wrong[0].focus();
				return;
			}
			const lastFour = onlyDigits(parts.card.value).slice(-4);
			statusLine.textContent = `${network.textContent || 'Card'} ending ${lastFour} looks right.`;
		});
	}

	function networkOf(number) {
		const prefixes = [
			['Visa', /^4/],
			['Mastercard', /^(5[1-5]|2[2-7])/],
			['Amex', /^3[47]/],
			['Discover', /^6(011|5)/],
		];
		return prefixes.find(([, prefix]) => prefix.test(number))?.[0] ?? '';
	}

	/** Luhn check, walking the digits from the right. */
	function passesChecksum(number) {
		const total = number
			.split('')
			.reverse()
			.reduce((sum, char, position) => {
				const digit = position % 2 ? Number(char) * 2 : Number(char);
				return sum + (digit > 9 ? digit - 9 : digit);
			}, 0);
		return total % 10 === 0;
	}

	/** Spaces the digits in fours, or 4-6-5 for an Amex number. */
	function groupCardDigits(number) {
		if (networkOf(number) === 'Amex') {
			const trimmed = number.slice(0, 15);
			return [trimmed.slice(0, 4), trimmed.slice(4, 10), trimmed.slice(10)].filter(Boolean).join(' ');
		}
		return (number.slice(0, 16).match(/.{1,4}/g) || []).join(' ');
	}

	/** Turns up to four expiry digits into "MM / YY" as they arrive. */
	function slashExpiry(typed) {
		const digits = typed.length === 1 && Number(typed) > 1 ? `0${typed}` : typed;
		if (digits.length > 2) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
		return digits.length === 2 ? `${digits} / ` : digits;
	}

	/* Postal code: the pattern, label and help follow the chosen country. */

	function mountPostalCode() {
		const demo = pick('[data-val-post-form]', page);
		if (!demo) return;

		const countryMenu = pick('[data-val-country]', demo);
		const codeBox = pick('[data-val-post]', demo);
		const caption = pick('[data-val-post-label]', demo);
		const guidance = pick('[data-val-post-help]', demo);
		const statusLine = pick('[data-val-post-status]', demo);
		const formats = {
			US: {
				name: 'ZIP code',
				sample: '78701',
				guide: 'Five digits, or ZIP+4 like 78701-1234.',
				shape: /^\d{5}(-\d{4})?$/,
				complaint: 'A ZIP code has five digits, like 78701.',
			},
			GB: {
				name: 'Postcode',
				sample: 'SW1A 1AA',
				guide: 'Letters and digits, like SW1A 1AA.',
				shape: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
				complaint: 'Enter a UK postcode, like SW1A 1AA.',
			},
			DE: {
				name: 'Postal code',
				sample: '10115',
				guide: 'Five digits, like 10115.',
				shape: /^\d{5}$/,
				complaint: 'A German postal code has five digits, like 10115.',
			},
			CA: {
				name: 'Postal code',
				sample: 'K1A 0B1',
				guide: 'Letter, digit, letter, then digit, letter, digit.',
				shape: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i,
				complaint: 'Enter a Canadian postal code, like K1A 0B1.',
			},
		};

		function verifyCode(submitting) {
			const format = formats[countryMenu.value];
			const value = codeBox.value.trim();
			if (value)
				return format.shape.test(value) ? clearError(codeBox, true) : flagError(codeBox, format.complaint);
			return submitting ? flagError(codeBox, `Enter the ${format.name.toLowerCase()}.`) : clearError(codeBox);
		}

		watchField(codeBox, () => verifyCode());
		countryMenu.addEventListener('change', () => {
			const format = formats[countryMenu.value];
			caption.textContent = format.name;
			codeBox.placeholder = format.sample;
			guidance.textContent = format.guide;
			statusLine.replaceChildren();
			if (codeBox.value.trim()) verifyCode();
		});
		wireSingleForm(
			demo,
			statusLine,
			verifyCode,
			codeBox,
			() => `${codeBox.value.trim().toUpperCase()} is a valid ${caption.textContent.trim().toLowerCase()}.`,
		);
	}

	/* New password: four rules, a strength meter and a confirmation box. */

	function mountNewPassword() {
		const demo = pick('[data-val-password]', page);
		if (!demo) return;

		const secret = pick('[data-val-pw-new]', demo);
		const repeat = pick('[data-val-pw-confirm]', demo);
		const reveal = pick('[data-val-pw-toggle]', demo);
		const gauge = pick('[data-val-meter]', demo);
		const verdict = pick('[data-val-meter-label]', demo);
		const checklist = pick('.val-rules', demo);
		const statusLine = pick('[data-val-pw-status]', demo);
		const tests = {
			length: (value) => value.length >= 10,
			case: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value),
			digit: (value) => /[\d\W_]/.test(value),
			name: (value) => value.length > 0 && !/elaine|zeller/i.test(value),
		};
		const grades = ['Start typing to see how strong it is', 'Too weak', 'Weak', 'Good', 'Strong'];

		const passedTests = () =>
			Object.entries(tests)
				.filter(([, test]) => test(secret.value))
				.map(([key]) => key);

		reveal.addEventListener('click', () => {
			const showing = secret.type === 'password';
			secret.type = showing ? 'text' : 'password';
			repeat.type = secret.type;
			reveal.setAttribute('aria-pressed', String(showing));
			pick('.bi', reveal).className = `bi ${showing ? 'bi-eye-slash' : 'bi-eye'}`;
			pick('.val-pw-toggle-text', reveal).textContent = showing ? 'Hide' : 'Show';
		});
		secret.addEventListener('input', () => {
			redrawGauge();
			statusLine.replaceChildren();
			if (isFlagged(secret) || checklist.classList.contains('is-checked')) verifySecret();
			if (repeat.value && (isFlagged(repeat) || repeat.classList.contains('is-valid'))) verifyRepeat();
		});
		repeat.addEventListener('input', () => {
			statusLine.replaceChildren();
			/* Hold back until the copy is as long as the original, unless it was already flagged. */
			if (isFlagged(repeat) || repeat.value.length >= secret.value.length) verifyRepeat();
		});
		repeat.addEventListener('blur', () => {
			if (repeat.value) verifyRepeat();
		});
		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			const secretOk = verifySecret();
			const repeatOk = verifyRepeat();
			if (!secretOk) return secret.focus();
			if (!repeatOk) return repeat.focus();
			statusLine.textContent = "Password updated. You'll stay signed in on this device.";
		});
		redrawGauge();

		function redrawGauge() {
			const passed = passedTests();
			for (const item of pickAll('[data-val-rule]', checklist)) {
				item.classList.toggle('is-met', passed.includes(item.getAttribute('data-val-rule')));
			}

			const typed = Boolean(secret.value);
			const usesName = typed && !tests.name(secret.value);
			const level = !typed ? 0 : usesName ? 1 : Math.max(1, passed.length);
			gauge.setAttribute('data-level', String(level));
			verdict.replaceChildren();
			if (!level) {
				verdict.textContent = grades[0];
				return;
			}
			const grade = Object.assign(document.createElement('strong'), { textContent: grades[level] });
			verdict.append(grade, `, ${passed.length} of 4 rules met`);
		}

		function verifySecret() {
			if (!secret.value) return flagError(secret, 'Choose a new password.');
			const allMet = passedTests().length === 4;
			checklist.classList.toggle('is-checked', !allMet);
			return allMet
				? clearError(secret, true)
				: flagError(secret, 'The password has to meet all four rules below.');
		}

		function verifyRepeat() {
			if (!repeat.value) return flagError(repeat, 'Type the new password again.');
			if (repeat.value !== secret.value) return flagError(repeat, "The two passwords don't match yet.");
			return clearError(repeat, true);
		}
	}

	/* Shop address: format rules first, then a pretend lookup for taken names. */

	function mountShopAddress() {
		const demo = pick('[data-val-handle]', page);
		if (!demo) return;

		const slugBox = pick('[data-val-handle-input]', demo);
		const badge = pick('[data-val-handle-icon]', demo);
		const statusLine = pick('[data-val-handle-status]', demo);
		const altPanel = pick('[data-val-handle-suggest]', demo);
		const altList = pick('[data-val-handle-list]', demo);
		const preview = pick('[data-val-handle-url]', demo);
		const outcome = pick('[data-val-handle-done]', demo);
		const reserved = new Set([
			'northside',
			'oakhaven-care',
			'lakeside-pet-care',
			'avocet-pet-care',
			'larchwood',
			'care',
			'pets',
			'book',
			'admin',
			'fieldline',
			'northside-care',
			'the-northside',
		]);
		const allowedShape = /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/;
		const looks = {
			checking: { icon: '<span class="spinner-border" aria-hidden="true"></span>' },
			free: { icon: '<i class="bi bi-check-circle-fill"></i>', badge: 'is-ok', tone: 'ok', field: 'is-valid' },
			error: { icon: '<i class="bi bi-x-circle-fill"></i>', badge: 'is-bad', tone: 'error', field: 'is-invalid' },
		};
		let debounce = null;
		let pending = '';
		let phase = 'empty';

		slugBox.addEventListener('input', () => {
			/* Store-style tidy-up as you type: lower case, spaces become hyphens. */
			const tidied = slugBox.value.toLowerCase().replace(/\s+/g, '-');
			if (tidied !== slugBox.value) {
				const caret = slugBox.selectionStart;
				slugBox.value = tidied;
				slugBox.setSelectionRange(caret, caret);
			}
			evaluate();
		});
		for (const sampleButton of pickAll('[data-val-try]', demo)) {
			sampleButton.addEventListener('click', () => adopt(sampleButton.getAttribute('data-val-try')));
		}
		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			outcome.removeAttribute('data-tone');
			if (phase === 'free') {
				outcome.textContent = `fieldline.app/${slugBox.value} is yours.`;
				return;
			}
			outcome.setAttribute('data-tone', 'error');
			if (phase === 'checking') {
				outcome.textContent = 'Still checking, one moment.';
				return;
			}
			outcome.textContent = 'Pick an address that is free first.';
			slugBox.focus();
		});

		function adopt(slug) {
			slugBox.value = slug;
			evaluate();
			slugBox.focus();
		}

		function evaluate() {
			clearTimeout(debounce);
			altPanel.hidden = true;
			outcome.replaceChildren();
			const slug = slugBox.value;
			preview.textContent = `fieldline.app/${slug || 'your-company'}`;

			if (!slug) {
				pending = '';
				return paint('empty');
			}
			if (/[^a-z0-9-]/.test(slug)) return paint('error', 'Only lowercase letters, numbers and hyphens.');
			if (slug.length > 24) return paint('error', `That is ${slug.length} characters. Keep it to 24.`);
			if (slug.length < 3) return paint('hint', 'Keep going, 3 characters at least.');
			if (!allowedShape.test(slug) || slug.includes('--')) {
				return paint('error', 'Hyphens go between words, one at a time, not at the ends.');
			}

			paint('checking', `Checking fieldline.app/${slug}…`);
			debounce = setTimeout(() => {
				pending = slug;
				lookUp(slug).then((answer) => showAnswer(slug, answer));
			}, 500);
		}

		function showAnswer(slug, answer) {
			/* A slow reply for something the visitor has since changed is dropped. */
			if (pending !== slugBox.value) return;
			if (answer.free) return paint('free', `fieldline.app/${slug} is free.`);
			paint('error', `fieldline.app/${slug} is taken.`);
			altList.replaceChildren();
			for (const alternative of answer.alternatives) {
				altList.appendChild(hintButton(alternative, () => adopt(alternative)));
			}
			altPanel.hidden = answer.alternatives.length === 0;
		}

		/** Stands in for the server: replies after 400 to 900ms. */
		function lookUp(slug) {
			return new Promise((resolve) => {
				setTimeout(
					() => {
						const free = !reserved.has(slug);
						const variants = [
							`${slug}-care`,
							`${slug}-services`,
							`the-${slug}`,
							`${slug}-co`,
							`${slug}-pro`,
						];
						const alternatives = free
							? []
							: variants
									.filter((variant) => !reserved.has(variant) && allowedShape.test(variant))
									.slice(0, 3);
						resolve({ free, alternatives });
					},
					400 + Math.random() * 500,
				);
			});
		}

		/** Puts the badge, field and message line into one of the lookup phases. */
		function paint(nextPhase, message = '') {
			const look = looks[nextPhase] ?? {};
			statusLine.replaceChildren();
			statusLine.removeAttribute('data-tone');
			badge.className = 'input-group-text val-handle-state';
			if (look.badge) badge.classList.add(look.badge);
			badge.innerHTML = look.icon ?? '<i class="bi bi-at"></i>';
			slugBox.classList.remove('is-invalid', 'is-valid');
			if (look.field) slugBox.classList.add(look.field);
			if (look.tone) statusLine.setAttribute('data-tone', look.tone);
			if (nextPhase === 'error') {
				slugBox.setAttribute('aria-invalid', 'true');
			} else {
				slugBox.removeAttribute('aria-invalid');
			}
			statusLine.textContent = message;
			phase = nextPhase;
		}
	}

	/* Receipt email: format check plus a nudge when the domain looks misspelled. */

	function mountReceiptEmail() {
		const demo = pick('[data-val-mail-form]', page);
		if (!demo) return;

		const address = pick('[data-val-mail]', demo);
		const nudge = pick('[data-val-mail-hint]', demo);
		const statusLine = pick('[data-val-mail-status]', demo);
		let ignored = '';
		let offered = '';

		address.addEventListener('blur', () => verifyAddress());
		address.addEventListener('input', () => {
			if (isFlagged(address)) {
				verifyAddress();
				return;
			}
			address.classList.remove('is-valid');
			offer('');
		});
		for (const sampleButton of pickAll('[data-val-mail-try]', demo)) {
			sampleButton.addEventListener('click', () => {
				address.value = sampleButton.getAttribute('data-val-mail-try');
				ignored = '';
				statusLine.replaceChildren();
				verifyAddress();
				address.focus();
			});
		}
		wireSingleForm(
			demo,
			statusLine,
			verifyAddress,
			address,
			() => `Saved. Receipts go to ${address.value.trim()}.`,
		);

		function verifyAddress(submitting) {
			const value = address.value.trim();
			if (!value) {
				offer('');
				return submitting ? flagError(address, 'Enter an email for receipts.') : clearError(address);
			}
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
				offer('');
				return flagError(address, 'Enter an email like name@example.com.');
			}
			offer(value === ignored ? '' : likelyMeant(value));
			return clearError(address, true);
		}

		/**
		 * Shows "Did you mean" for `corrected`, or empties the hint for ''. The
		 * same hint is left alone, since leaving the field to press its button
		 * re-runs this and must not swap the button out from under the click.
		 */
		function offer(corrected) {
			if (corrected === offered && (corrected || !nudge.firstChild)) return;
			offered = corrected;
			nudge.replaceChildren();
			if (!corrected) return;

			const bulb = Object.assign(document.createElement('i'), { className: 'bi bi-lightbulb' });
			bulb.setAttribute('aria-hidden', 'true');
			const question = document.createElement('span');
			question.append(
				'Did you mean ',
				Object.assign(document.createElement('strong'), { textContent: corrected }),
				'?',
			);
			const accept = hintButton('Use this', () => {
				address.value = corrected;
				offer('');
				verifyAddress();
				address.focus();
			});
			const decline = Object.assign(document.createElement('button'), {
				type: 'button',
				className: 'val-linkish',
				textContent: 'Keep mine',
			});
			decline.addEventListener('click', () => {
				ignored = address.value;
				offer('');
				address.focus();
			});
			nudge.append(bulb, question, accept, decline);
		}
	}

	/** Suggests a corrected address when the domain is one or two letters off a common one. */
	function likelyMeant(email) {
		const knownHosts = [
			'gmail.com',
			'yahoo.com',
			'hotmail.com',
			'outlook.com',
			'icloud.com',
			'aol.com',
			'proton.me',
		];
		const endingFixes = {
			con: 'com',
			cmo: 'com',
			cm: 'com',
			comm: 'com',
			ocm: 'com',
			vom: 'com',
			nte: 'net',
			ogr: 'org',
		};
		const split = email.lastIndexOf('@');
		const mailbox = email.slice(0, split);
		const host = email.slice(split + 1).toLowerCase();
		if (knownHosts.includes(host)) return '';

		const nearHost = knownHosts.find((known) => editDistance(known, host) <= 2);
		if (nearHost) return `${mailbox}@${nearHost}`;

		const labels = host.split('.');
		const fixedEnding = endingFixes[labels.pop()];
		return fixedEnding ? `${mailbox}@${[...labels, fixedEnding].join('.')}` : '';
	}

	/** Levenshtein distance, kept to one row of the table at a time. */
	function editDistance(from, to) {
		let above = Array.from({ length: to.length + 1 }, (_, column) => column);
		for (let row = 1; row <= from.length; row++) {
			const current = [row];
			for (let column = 1; column <= to.length; column++) {
				const swap = from[row - 1] === to[column - 1] ? 0 : 1;
				current[column] = Math.min(above[column] + 1, current[column - 1] + 1, above[column - 1] + swap);
			}
			above = current;
		}
		return above[to.length];
	}

	/* Phone number: optional, US format, shaped as it is typed. */

	function mountPhoneNumber() {
		const demo = pick('[data-val-phone-form]', page);
		if (!demo) return;

		const phoneBox = pick('[data-val-phone]', demo);
		const statusLine = pick('[data-val-phone-status]', demo);

		phoneBox.addEventListener('input', (event) => {
			if (!event.inputType?.startsWith('delete'))
				phoneBox.value = shapePhone(onlyDigits(phoneBox.value).slice(0, 11));
			if (isFlagged(phoneBox)) verifyPhone();
		});
		phoneBox.addEventListener('blur', verifyPhone);
		wireSingleForm(demo, statusLine, verifyPhone, phoneBox, () =>
			nationalDigits() ? `Saved. Updates go to ${phoneBox.value}.` : 'Saved without a number. It is optional.',
		);

		/** The ten national digits, with a leading country code 1 dropped. */
		function nationalDigits() {
			const digits = onlyDigits(phoneBox.value);
			return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
		}

		function verifyPhone() {
			const digits = nationalDigits();
			if (!digits) return clearError(phoneBox);
			if (digits.length !== 10)
				return flagError(phoneBox, `That's ${plural(digits.length, 'digit')}. US numbers have ten.`);
			if (/^[01]/.test(digits)) return flagError(phoneBox, "US area codes don't start with 0 or 1.");
			return clearError(phoneBox, true);
		}
	}

	function shapePhone(typed) {
		const national = typed.length === 11 && typed.startsWith('1') ? typed.slice(1) : typed.slice(0, 10);
		const [area, exchange, line] = [national.slice(0, 3), national.slice(3, 6), national.slice(6)];
		if (national.length > 6) return `(${area}) ${exchange}-${line}`;
		return national.length > 3 ? `(${area}) ${national.slice(3)}` : national;
	}

	/* Price and sale price: money input, and the sale has to undercut the price. */

	function mountPriceAndSale() {
		const demo = pick('[data-val-money]', page);
		if (!demo) return;

		const listPrice = pick('#val-price', demo);
		const salePrice = pick('#val-sale', demo);
		const saving = pick('[data-val-sale-note]', demo);
		const statusLine = pick('[data-val-money-status]', demo);
		const amountShape = /^\d+(\.\d{1,2})?$/;

		/* Keystrokes are filtered to digits and a single point with two decimals. */
		for (const box of [listPrice, salePrice]) {
			box.addEventListener('input', () => {
				const [units, ...decimals] = box.value.replace(/[^\d.]/g, '').split('.');
				const cleaned = decimals.length ? `${units}.${decimals.join('').slice(0, 2)}` : units;
				if (cleaned !== box.value) box.value = cleaned;
			});
		}
		watchField(listPrice, () => verifyPrice());
		watchField(salePrice, verifySale);
		/* The sale is measured against the price, so changing the price re-measures it. */
		listPrice.addEventListener('input', () => {
			if (salePrice.value.trim()) verifySale();
		});
		wireSingleForm(
			demo,
			statusLine,
			() => {
				const priceOk = verifyPrice(true);
				const saleOk = verifySale();
				return priceOk && saleOk;
			},
			listPrice,
			() => {
				const onSale = salePrice.value.trim() ? `, on sale for ${dollars(Number(salePrice.value))}.` : '.';
				return `Saved at ${dollars(Number(listPrice.value))}${onSale}`;
			},
		);

		function verifyPrice(submitting) {
			const value = listPrice.value.trim();
			if (!value) return submitting ? flagError(listPrice, 'Enter a price.') : clearError(listPrice);
			if (!amountShape.test(value)) return flagError(listPrice, 'Add the cents after the point, like 19.50.');
			return Number(value) > 0 ? clearError(listPrice) : flagError(listPrice, 'The price has to be above zero.');
		}

		function verifySale() {
			const value = salePrice.value.trim();
			saving.textContent = 'Leave empty for no sale.';
			if (!value) return clearError(salePrice);
			if (!amountShape.test(value)) return flagError(salePrice, 'Add the cents after the point, like 15.00.');

			const full = Number(listPrice.value);
			const offer = Number(value);
			if (amountShape.test(listPrice.value.trim()) && full > 0) {
				if (offer >= full) return flagError(salePrice, `A sale price has to be lower than ${dollars(full)}.`);
				saving.textContent = `${dollars(full - offer)} off, ${Math.round((1 - offer / full) * 100)}% less.`;
			}
			return clearError(salePrice, true);
		}
	}

	/* Skill tags: at least one, and duplicates are called out. */

	function mountSkillTags() {
		const demo = pick('[data-val-tags-form]', page);
		if (!demo) return;

		const tagField = pick('[data-basalt-tags]', demo);
		const entry = pick('#val-tags', demo);
		const statusLine = pick('[data-val-tags-status]', demo);
		const tagCount = () => tagField.basaltTags?.get().length ?? 0;

		function settle() {
			statusLine.replaceChildren();
			if (isFlagged(entry) && tagCount()) clearError(entry, false, tagField);
		}

		tagField.addEventListener('basalt:tags-duplicate', (event) => {
			flagError(entry, `"${event.detail.value}" is already listed.`, tagField);
		});
		tagField.addEventListener('change', settle);
		entry.addEventListener('input', settle);
		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			const total = tagCount();
			if (!total) {
				flagError(entry, 'Add at least one skill.', tagField);
				entry.focus();
				return;
			}
			clearError(entry, false, tagField);
			statusLine.textContent = `${plural(total, 'skill')} saved.`;
		});
	}

	/* First visit date: a window from two days out, and no Sundays. */

	function mountFirstVisit() {
		const demo = pick('[data-val-date-form]', page);
		if (!demo) return;

		const dayBox = pick('[data-val-date]', demo);
		const statusLine = pick('[data-val-date-status]', demo);
		const soonest = shiftDays(new Date(new Date().setHours(0, 0, 0, 0)), 2);
		const furthest = shiftDays(soonest, 90);
		const inWindow = (day) => day >= soonest && day <= furthest;

		dayBox.min = isoDay(soonest);
		dayBox.max = isoDay(furthest);
		dayBox.addEventListener('change', () => {
			statusLine.replaceChildren();
			verifyDay();
		});
		wireSingleForm(
			demo,
			statusLine,
			verifyDay,
			dayBox,
			() => `First visit booked for ${shortDay(fromIso(dayBox.value))}.`,
		);

		function verifyDay(submitting) {
			if (!dayBox.value)
				return submitting ? flagError(dayBox, 'Pick a day for the first visit.') : clearError(dayBox);
			const chosen = fromIso(dayBox.value);
			if (chosen < soonest) return flagError(dayBox, `The earliest we can book is ${shortDay(soonest)}.`);
			if (chosen > furthest) return flagError(dayBox, 'Pick a day within the next three months.');
			if (chosen.getDay() !== 0) return clearError(dayBox, true);
			const nearby = [shiftDays(chosen, -1), shiftDays(chosen, 1)].filter(inWindow).map(shortDay);
			return flagError(dayBox, `Crews don't work on Sundays. Try ${nearby.join(' or ')}.`);
		}
	}

	function shortDay(day) {
		return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function isoDay(day) {
		const twoDigits = (part) => String(part).padStart(2, '0');
		return `${day.getFullYear()}-${twoDigits(day.getMonth() + 1)}-${twoDigits(day.getDate())}`;
	}

	function fromIso(text) {
		const [year, month, date] = text.split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function shiftDays(day, offset) {
		const moved = new Date(day);
		moved.setDate(moved.getDate() + offset);
		return moved;
	}

	/* Stock and reorder: a soft warning at zero, and a rule linking two inputs. */

	function mountReorderStepper() {
		const demo = pick('[data-val-sub]', page);
		if (!demo) return;

		const stockBox = pick('#val-stock', demo);
		const stockHint = pick('[data-val-stock-note]', demo);
		const unitBox = pick('[data-val-sub-units]', demo);
		const unitStepper = unitBox.closest('.basalt-stepper');
		const pairMessage = pick('[data-val-sub-cross]', demo);
		const statusLine = pick('[data-val-sub-status]', demo);
		const cadences = pickAll('input[name="valSubEvery"]', demo);
		const cadenceWords = { month: 'every month', fortnight: 'every 2 weeks', week: 'every week' };
		const cadence = () => cadences.find((radio) => radio.checked).value;

		demo.addEventListener('change', (event) => {
			statusLine.replaceChildren();
			if (event.target === stockBox) {
				noteStock();
				return;
			}
			verifyPair();
		});
		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!verifyPair()) {
				unitBox.focus();
				return;
			}
			const units = Number(unitBox.value);
			statusLine.textContent = `${stockBox.value} in stock, reorder ${plural(units, 'unit')} ${cadenceWords[cadence()]}.`;
		});
		noteStock();

		/* Zero stock is allowed, so it earns a warning rather than an error. */
		function noteStock() {
			const empty = Number(stockBox.value) === 0;
			stockHint.className = empty ? 'val-warn' : 'val-help';
			stockHint.textContent = empty
				? 'At 0 the product shows as sold out.'
				: 'Step 5, from 0 to 995. Warns at 0.';
		}

		function verifyPair() {
			pairMessage.replaceChildren();
			unitBox.removeAttribute('aria-invalid');
			unitStepper.classList.remove('is-invalid');
			if (cadence() !== 'week' || Number(unitBox.value) >= 2) return true;

			unitBox.setAttribute('aria-invalid', 'true');
			unitStepper.classList.add('is-invalid');
			pairMessage.append(
				Object.assign(document.createElement('span'), { textContent: 'A weekly reorder starts at 2 units.' }),
				hintButton('Make it 2 units', () => {
					setUnits(2);
					unitBox.focus();
				}),
				hintButton('Every 2 weeks instead', switchToFortnight),
			);
			return false;
		}

		function setUnits(total) {
			unitBox.value = total;
			unitBox.dispatchEvent(new Event('blur'));
			unitBox.dispatchEvent(new Event('change', { bubbles: true }));
		}

		function switchToFortnight() {
			const fortnight = cadences.find((radio) => radio.value === 'fortnight');
			fortnight.checked = true;
			fortnight.dispatchEvent(new Event('change', { bubbles: true }));
			fortnight.focus();
		}
	}

	/* SKU: upper-cased and hyphenated while typing, then matched to a pattern. */

	function mountSkuPattern() {
		const demo = pick('[data-val-sku-form]', page);
		if (!demo) return;

		const skuBox = pick('[data-val-sku]', demo);
		const statusLine = pick('[data-val-sku-status]', demo);
		const skuShape = /^[A-Z]{3,4}-[A-Z]{3}-\d{2,4}$/;

		skuBox.addEventListener('input', () => {
			const caret = skuBox.selectionStart;
			skuBox.value = skuBox.value.toUpperCase().replace(/\s+/g, '-');
			skuBox.setSelectionRange(caret, caret);
		});
		watchField(skuBox, () => verifySku());
		wireSingleForm(demo, statusLine, verifySku, skuBox, () => `${skuBox.value} saved.`);

		function verifySku(submitting) {
			if (!skuBox.value) return submitting ? flagError(skuBox, 'Every product needs a SKU.') : clearError(skuBox);
			return skuShape.test(skuBox.value)
				? clearError(skuBox, true)
				: flagError(skuBox, 'Use ITEM-MAKER-SIZE, like CARD-LMH-1620.');
		}
	}

	/* Booking form whose problems are listed in a summary at the top. */

	function mountSummaryForm() {
		const demo = pick('[data-val-summary-form]', page);
		if (!demo) return;

		const panel = pick('[data-val-summary]', demo);
		const statusLine = pick('[data-val-summary-status]', demo);
		const entries = pickAll('[data-val-sum]', demo);
		const readers = {
			name: (value) =>
				!value ? 'Enter your full name.' : value.length < 2 ? 'The name needs at least two letters.' : '',
			email: (value) => {
				if (!value) return 'Enter an email address.';
				return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? '' : 'Enter an email like name@example.com.';
			},
			job: (value) => (value ? '' : 'Choose a visit type.'),
			address: (value) =>
				!value ? 'Enter the street address.' : value.length < 5 ? 'That address looks too short.' : '',
		};
		const headline = (total) =>
			total === 1 ? 'There is 1 problem with this form' : `There are ${total} problems with this form`;

		function verifyEntry(entry) {
			const problem = readers[entry.getAttribute('data-val-sum')](entry.value.trim());
			return problem ? flagError(entry, problem) : clearError(entry, true);
		}

		function refreshOpenSummary() {
			if (!panel.hidden) syncSummaryLinks(panel, entries.filter(isFlagged), headline);
		}

		for (const entry of entries) {
			if (entry.tagName === 'SELECT') {
				entry.addEventListener('change', () => {
					verifyEntry(entry);
					refreshOpenSummary();
				});
			} else {
				watchField(entry, () => verifyEntry(entry), refreshOpenSummary);
			}
			entry.addEventListener('input', () => {
				statusLine.replaceChildren();
			});
		}

		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			const wrong = entries.filter((entry) => !verifyEntry(entry));
			if (!wrong.length) {
				panel.hidden = true;
				statusLine.textContent = 'Sent. Every field passed.';
				return;
			}
			syncSummaryLinks(panel, wrong, headline);
			panel.focus();
		});
		demo.addEventListener('reset', () => {
			for (const entry of entries) {
				clearError(entry, false);
			}
			panel.hidden = true;
			statusLine.replaceChildren();
		});
	}

	/* Promo code: the verdict comes back from a pretend server after a pause. */

	function mountPromoCode() {
		const demo = pick('[data-val-promo]', page);
		if (!demo) return;

		const codeBox = pick('[data-val-promo-input]', demo);
		const applyButton = pick('[data-val-promo-apply]', demo);
		const spinner = pick('.spinner-border', applyButton);
		const applyLabel = pick('[data-val-promo-label]', demo);
		const appliedNote = pick('[data-val-promo-applied]', demo);
		const appliedText = pick('[data-val-promo-applied-text]', demo);
		const discountRow = pick('[data-val-promo-line]', demo);
		const discountName = pick('[data-val-promo-line-label]', demo);
		const discountAmount = pick('[data-val-promo-line-value]', demo);
		const grandTotal = pick('[data-val-promo-total]', demo);
		const order = { subtotal: 98, shipping: 14.95, freeShippingFrom: 250 };
		const verdicts = {
			WELCOME10: () => ({ ok: true, amount: order.subtotal * 0.1, label: '10% off your first order' }),
			FREESHIP: () => ({
				ok: false,
				reason: `FREESHIP needs an order of ${dollars(order.freeShippingFrom)} or more. Add ${dollars(order.freeShippingFrom - order.subtotal)} to use it.`,
			}),
			AUTUMN15: () => ({ ok: false, reason: 'AUTUMN15 ended on September 30.' }),
			EXTRAS20: () => ({
				ok: false,
				reason: 'EXTRAS20 only works on extras, and there are no extras in this order.',
			}),
		};

		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			const code = codeBox.value.trim().toUpperCase();
			if (!code) {
				flagError(codeBox, 'Enter a code first.');
				codeBox.focus();
				return;
			}
			clearError(codeBox);
			setWaiting(true);
			askServer(code).then((reply) => {
				setWaiting(false);
				if (!reply.ok) {
					flagError(codeBox, reply.reason);
					codeBox.focus();
					return;
				}
				clearError(codeBox, false);
				codeBox.value = '';
				appliedNote.hidden = false;
				appliedText.textContent = `${code} applied, ${reply.label}.`;
				discountName.textContent = `Discount (${code})`;
				showTotals(reply.amount);
			});
		});
		codeBox.addEventListener('input', () => {
			if (isFlagged(codeBox)) clearError(codeBox);
		});
		for (const sampleButton of pickAll('[data-val-promo-try]', demo)) {
			sampleButton.addEventListener('click', () => {
				codeBox.value = sampleButton.getAttribute('data-val-promo-try');
				clearError(codeBox);
				codeBox.focus();
			});
		}
		pick('[data-val-promo-remove]', demo).addEventListener('click', () => {
			appliedNote.hidden = true;
			showTotals(0);
			codeBox.focus();
		});
		showTotals(0);

		function askServer(code) {
			const unknown = () => ({
				ok: false,
				reason: `We don't recognize ${code}. Check it against the email it came in.`,
			});
			const answer = Object.hasOwn(verdicts, code) ? verdicts[code] : unknown;
			return new Promise((resolve) => {
				setTimeout(() => resolve(answer()), 700);
			});
		}

		function showTotals(discount) {
			discountRow.hidden = !discount;
			if (discount) discountAmount.textContent = `−${dollars(discount)}`;
			grandTotal.textContent = dollars(order.subtotal - (discount || 0) + order.shipping);
		}

		function setWaiting(waiting) {
			applyButton.disabled = waiting;
			codeBox.readOnly = waiting;
			spinner.hidden = !waiting;
			applyLabel.textContent = waiting ? 'Checking' : 'Apply';
			demo.toggleAttribute('aria-busy', waiting);
		}
	}

	/* Constraint inspector: live readout of the browser's ValidityState flags. */

	function mountConstraintInspector() {
		const probe = pick('[data-val-inspect]', page);
		if (!probe) return;

		const probeLabel = pick('[data-val-inspect-label]', page);
		const attributeLine = pick('[data-val-inspect-attrs]', page);
		const browserMessage = pick('[data-val-inspect-msg]', page);
		const flagItems = pickAll('[data-val-flags] li', page);
		const presets = {
			email: {
				label: 'Billing contact email',
				attributes: { type: 'email', required: '' },
				placeholder: 'accounts@oakhavenstudio.example',
			},
			account: {
				label: 'Fieldline account number',
				attributes: { type: 'text', required: '', pattern: 'FL-\\d{5}', minlength: '8' },
				placeholder: '#10482',
			},
			url: {
				label: 'Company website',
				attributes: { type: 'url', required: '' },
				placeholder: 'https://oakhavenstudio.example',
			},
		};

		/* Each flag gets a hidden true/false word so screen readers hear its state. */
		for (const item of flagItems) {
			item.appendChild(Object.assign(document.createElement('span'), { className: 'visually-hidden' }));
		}
		for (const radio of pickAll('input[name="val-inspect"]', page)) {
			radio.addEventListener('change', () => usePreset(radio.value));
		}
		probe.addEventListener('input', readValidity);
		usePreset('email');

		function usePreset(key) {
			const { label, attributes, placeholder } = presets[key];
			for (const name of ['pattern', 'minlength', 'required']) {
				probe.removeAttribute(name);
			}
			for (const [name, value] of Object.entries(attributes)) {
				probe.setAttribute(name, value);
			}
			probe.value = '';
			probe.placeholder = placeholder;
			probeLabel.textContent = label;
			attributeLine.textContent = Object.entries(attributes)
				.map(([name, value]) => (value ? `${name}="${value}"` : name))
				.join(' ');
			readValidity();
		}

		function readValidity() {
			const validity = probe.validity;
			for (const item of flagItems) {
				const raised = Boolean(validity[item.getAttribute('data-flag')]);
				item.classList.toggle('is-on', raised);
				item.lastChild.textContent = raised ? ' true' : ' false';
			}
			browserMessage.textContent =
				probe.validationMessage || 'Nothing to report. The value passes every constraint.';
		}
	}

	/* Sticker note: a 150-character budget with a bar, and no emoji allowed. */

	function mountStickerNote() {
		const demo = pick('[data-val-sticker]', page);
		if (!demo) return;

		const noteBox = pick('[data-val-sticker-note]', demo);
		const meter = pick('.val-counter', noteBox.parentElement);
		const fill = pick('[data-val-sticker-bar]', demo);
		const readout = pick('[data-val-sticker-count]', demo);
		const statusLine = pick('[data-val-sticker-status]', demo);
		const budget = { limit: 150, warnFrom: 130 };
		const pictograph = /\p{Extended_Pictographic}/gu;

		noteBox.addEventListener('input', () => {
			statusLine.replaceChildren();
			verifyNote();
		});
		pick('[data-val-sticker-emoji]', demo).addEventListener('click', () => {
			const caret = noteBox.selectionEnd || noteBox.value.length;
			noteBox.value = `${noteBox.value.slice(0, caret)} 🔧${noteBox.value.slice(caret)}`;
			noteBox.dispatchEvent(new Event('input'));
			noteBox.focus();
		});
		demo.addEventListener('submit', (event) => {
			event.preventDefault();
			if (verifyNote()) {
				statusLine.textContent = 'Note saved. It fits on the sticker.';
				return;
			}
			noteBox.focus();
		});
		verifyNote();

		function verifyNote() {
			const used = [...noteBox.value].length;
			const excess = used - budget.limit;
			const band = excess > 0 ? 'over' : used >= budget.warnFrom ? 'near' : '';
			const readouts = {
				over: `${excess} over the limit`,
				near: `${budget.limit - used} left`,
				'': `${used} / ${budget.limit}`,
			};
			fill.style.width = `${Math.min(used / budget.limit, 1) * 100}%`;
			meter.setAttribute('data-state', band);
			readout.textContent = readouts[band];

			const pictures = noteBox.value.match(pictograph);
			if (pictures) {
				return flagError(
					noteBox,
					`The card printer can't print emoji. Remove ${[...new Set(pictures)].join(' ')} to continue.`,
				);
			}
			if (excess > 0)
				return flagError(noteBox, `Cut ${plural(excess, 'character')} so the note fits on the sticker.`);
			if (!noteBox.value.trim()) return flagError(noteBox, 'Write a note for the sticker.');
			return clearError(noteBox);
		}
	}
})();
