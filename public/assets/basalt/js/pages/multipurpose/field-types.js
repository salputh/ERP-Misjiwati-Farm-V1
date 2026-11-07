/**
 * Behavior for the field-type gallery on field-types.html: the filter chips,
 * the copyable snippets and one small controller per demo card, each of which
 * steps aside when its card is not on the page. The tag input, the searchable
 * select and the number stepper belong to basalt.js; this file only reacts to
 * what they report.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-fb-root]', document);
	if (!pageRoot) return;

	/* An address counts as complete with text on both sides of the @ and a dotted ending. */
	const ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

	const STRENGTH_WORDS = ['not set', 'too weak', 'fair', 'good', 'strong'];
	const GUESSABLE = ['password', 'qwerty', '123456', 'letmein', 'welcome', 'fieldline'];
	const AGREEMENT = {
		empty: ['', ''],
		same: ['Both passwords match.', 'is-ok'],
		different: ["These don't match yet.", 'is-bad'],
	};

	/* Read from the top: the first floor the head count reaches picks the advice. */
	const TEAM_BANDS = [
		[120, 'Large team: split it into territories and add the Travel Planner.'],
		[60, 'Growing team: give each territory its own schedule board.'],
		[20, 'Mid-size team: plan for two schedulers.'],
		[-Infinity, 'Small team: one scheduler is usually enough.'],
	];

	const CARD_BRANDS = [
		['Amex', /^3[47]/],
		['Visa', /^4/],
		['Mastercard', /^(5[1-5]|2[2-7])/],
		['Discover', /^6(011|5)/],
	];
	const CARD_LAYOUTS = {
		Amex: { length: 15, chunks: [4, 6, 5], codeLength: 4, codeSample: '1234', codeHint: '4 digits, on the front.' },
		standard: {
			length: 16,
			chunks: [4, 4, 4, 4],
			codeLength: 3,
			codeSample: '123',
			codeHint: '3 digits, on the back.',
		},
	};

	const DIALING = {
		US: {
			prefix: '+1',
			trunk: /^1/,
			lengths: [10],
			chunks: [3, 3, 4],
			sample: '(555) 014-2290',
			hint: 'US numbers have 10 digits.',
		},
		GB: {
			prefix: '+44',
			trunk: /^0/,
			lengths: [10],
			chunks: [4, 6],
			sample: '7700 900123',
			hint: 'UK mobiles have 10 digits after the 0. A leading 0 is dropped.',
		},
		IE: {
			prefix: '+353',
			trunk: /^0/,
			lengths: [9],
			chunks: [2, 3, 4],
			sample: '85 123 4567',
			hint: 'Irish mobiles have 9 digits after the 0. A leading 0 is dropped.',
		},
		DE: {
			prefix: '+49',
			trunk: /^0/,
			lengths: [10, 11],
			chunks: [3, 4, 4],
			sample: '151 2345 6789',
			hint: 'German mobiles have 10 or 11 digits after the 0. A leading 0 is dropped.',
		},
		NL: {
			prefix: '+31',
			trunk: /^0/,
			lengths: [9],
			chunks: [1, 4, 4],
			sample: '6 1234 5678',
			hint: 'Dutch mobiles have 9 digits after the 0. A leading 0 is dropped.',
		},
	};

	/* Each format names its field, shows a sample and, where it has one, where the space goes. */
	const POSTAL = {
		US: {
			name: 'ZIP code',
			sample: '10013',
			pattern: /^\d{5}(-\d{4})?$/,
			spacing: null,
			problem: 'Enter a 5-digit ZIP code, like 10013',
			hint: '5 digits, or ZIP+4 like 10013-2290. Try the UK and type se13pa.',
		},
		GB: {
			name: 'Postcode',
			sample: 'SE1 3PA',
			pattern: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
			spacing: /^(.+)(.{3})$/,
			problem: 'Enter a postcode like SE1 3PA',
			hint: 'Letters and digits, with a space before the last three.',
		},
		IE: {
			name: 'Eircode',
			sample: 'D02 X285',
			pattern: /^[A-Z]\d[\dW] [A-Z\d]{4}$/,
			spacing: /^(.{3})(.+)$/,
			problem: 'Enter an Eircode like D02 X285',
			hint: 'Seven characters, with a space after the first three.',
		},
		DE: {
			name: 'Postleitzahl',
			sample: '10115',
			pattern: /^\d{5}$/,
			spacing: null,
			problem: 'Enter a 5-digit postal code, like 10115',
			hint: '5 digits.',
		},
		NL: {
			name: 'Postcode',
			sample: '1012 AB',
			pattern: /^\d{4} [A-Z]{2}$/,
			spacing: /^(\d{4})(.+)$/,
			problem: 'Enter a postcode like 1012 AB',
			hint: '4 digits and 2 letters.',
		},
	};

	/* Common slips of the finger, filed under the domain they were meant to be. */
	const DOMAIN_SLIPS = {
		'gmail.com': ['gmial.com', 'gmai.com', 'gmal.com', 'gamil.com', 'gmail.co'],
		'hotmail.com': ['hotmial.com', 'hotmal.com'],
		'yahoo.com': ['yaho.com', 'yahooo.com'],
		'outlook.com': ['outlok.com'],
		'icloud.com': ['icloud.co'],
	};

	const DISCOUNTS = {
		WELCOME10: '10% off your first order',
		SCULPT15: '15% off the Sculpted Shoulder Blazer until Sunday',
	};
	const RETIRED_CODES = { SUMMER20: 'SUMMER20 ended on August 31.' };

	const copyTimers = new WeakMap();

	/** Wires every card in the order the gallery shows them. */
	function start() {
		wireFilterChips();
		wireSnippetCopy();
		wireCustomerPicker();
		wirePasswordCard();
		wireSliders();
		wireDayTiles();
		wirePaymentCard();
		wireMoneyFields();
		wireTagEcho();
		wirePhoneField();
		wirePostalField();
		wireEmailFields();
		wireErrorSummary();
		wireNotificationSwitches();
		wireParentCheckbox();
		wireCodeInputs();
		wireDiscountForm();
		wireSlugField();
		wireTextareas();
		wireFloatingForm();
		wireDeliveryRadios();
		wireSelects();
		wireDateTime();
		markMixedTicks();
		wireInputGroups();
	}

	/* The chips above the grid narrow it to one group of field types. */
	function wireFilterChips() {
		const grid = pick('[data-fb-grid]');
		if (!grid) return;
		const tally = pick('[data-fb-count]');
		const cards = pickAll('.fb-card', grid);
		const chips = pickAll('[data-fb-filter]');

		for (const chip of chips) {
			chip.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
				showGroup(chip.getAttribute('data-fb-filter'));
			});
		}
		showGroup('all');

		function showGroup(group) {
			const visible = [];
			for (const card of cards) {
				const tags = (card.getAttribute('data-fb-groups') || '').split(/\s+/);
				const keep = group === 'all' || tags.includes(group);
				card.classList.toggle('is-hidden', !keep);
				card.classList.remove('is-alone');
				if (keep) visible.push(card);
			}
			pairHalfCards(visible);
			if (tally) tally.textContent = countLabel(visible.length, 'field type', 'field types');
		}
	}

	/**
	 * Half-width cards sit in pairs between the full-width ones. When a run of
	 * them ends on an odd card, that last card stretches across the row.
	 * @param {HTMLElement[]} visible cards still shown, in page order
	 */
	function pairHalfCards(visible) {
		let streak = 0;
		let latest = null;
		for (const card of [...visible, null]) {
			if (card && !card.classList.contains('fb-card-full')) {
				streak += 1;
				latest = card;
				continue;
			}
			if (streak % 2) latest.classList.add('is-alone');
			streak = 0;
		}
	}

	/* Each snippet's Copy button puts the code from its own <pre> on the clipboard. */
	function wireSnippetCopy() {
		for (const button of pickAll('[data-fb-copy]')) {
			button.addEventListener('click', () => {
				const snippet = pick('pre', button.parentElement);
				if (!snippet) return;
				window.Basalt.copyText(snippet.textContent.trim()).then(() => confirmCopied(button, 'Copied'));
			});
		}
	}

	/**
	 * Swaps a copy button to a check mark and the given word, then puts the
	 * label and clipboard icon back after a short pause.
	 */
	function confirmCopied(button, word) {
		const label = pick('span', button);
		const glyph = pick('.bi', button);
		const target = label || button.lastChild;
		const original = target.textContent.trim();
		target.textContent = label ? word : ` ${word}`;
		if (glyph) glyph.className = 'bi bi-check2';
		clearTimeout(copyTimers.get(button));
		copyTimers.set(
			button,
			setTimeout(() => {
				target.textContent = original;
				if (glyph) glyph.className = 'bi bi-clipboard';
			}, 1800),
		);
	}

	/* basalt.js runs the searchable list itself; this card only repeats the choice back. */
	function wireCustomerPicker() {
		const select = pick('[data-fb-customer]');
		const readout = pick('[data-fb-pick] span');
		if (!select || !readout) return;
		select.addEventListener('change', () => {
			const chosen = select.selectedOptions[0];
			if (!chosen?.value) return;
			readout.textContent = `Picked ${chosen.textContent.trim()}: ${chosen.getAttribute('data-hint')}.`;
		});
	}

	/* New password with a reveal toggle, a four-step meter, a checklist and a repeat field. */
	function wirePasswordCard() {
		const form = pick('[data-fb-account]');
		if (!form) return;
		const secret = pick('[data-fb-acc-pass]', form);
		const repeat = pick('[data-fb-acc-confirm]', form);
		const toggle = pick('[data-fb-reveal]', form);
		const toggleText = pick('[data-fb-reveal-label]', form);
		const bars = pick('[data-fb-meter]', form);
		const barsText = pick('[data-fb-meter-label]', form);
		const agreement = pick('[data-fb-acc-match]', form);
		const outcome = pick('[data-fb-acc-status]', form);

		toggle.addEventListener('click', () => {
			const reveal = secret.type === 'password';
			secret.type = reveal ? 'text' : 'password';
			toggle.setAttribute('aria-pressed', String(reveal));
			toggleText.textContent = reveal ? 'Hide' : 'Show';
			pick('.bi', toggle).className = `bi ${reveal ? 'bi-eye-slash' : 'bi-eye'}`;
		});

		form.addEventListener('input', () => {
			outcome.textContent = '';
			outcome.className = 'fb-status';
			refresh();
		});

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const points = refresh();
			outcome.className = 'fb-status';
			const weak = points < 4;
			const blocker = weak || repeat.value !== secret.value ? (weak ? secret : repeat) : null;
			if (!blocker) outcome.textContent = 'Password saved.';
			else if (weak)
				outcome.textContent = 'Choose a stronger password first: all four points above need a check.';
			else outcome.textContent = 'The two passwords are different. Type the second one again.';
			outcome.classList.toggle('is-bad', Boolean(blocker));
			blocker?.focus();
		});

		refresh();

		/** Redraws the checklist, meter and match line; returns how many rules pass. */
		function refresh() {
			let points = 0;
			for (const [rule, met] of Object.entries(passwordChecks(secret.value))) {
				markRule(pick(`[data-fb-rule="${rule}"]`, form), met);
				if (met) points += 1;
			}
			const level = secret.value ? Math.max(1, points) : 0;
			bars.setAttribute('data-level', String(level));
			barsText.textContent = `Strength: ${STRENGTH_WORDS[level]}`;

			let verdict = 'different';
			if (!repeat.value) verdict = 'empty';
			else if (repeat.value === secret.value) verdict = 'same';
			const [text, modifier] = AGREEMENT[verdict];
			agreement.textContent = text;
			agreement.className = modifier ? `fb-match ${modifier}` : 'fb-match';
			return points;
		}
	}

	/**
	 * The four password rules, keyed the way the checklist items name them in
	 * data-fb-rule.
	 */
	function passwordChecks(value) {
		const lower = value.toLowerCase();
		return {
			len: value.length >= 10,
			mix: /[a-z]/.test(value) && /[A-Z]/.test(value),
			num: /[\d\W_]/.test(value),
			common: value.length > 0 && GUESSABLE.every((word) => !lower.includes(word)),
		};
	}

	/* A checklist item shows its state with an icon and says it aloud in hidden text. */
	function markRule(item, met) {
		item.classList.toggle('is-met', met);
		pick('.bi', item).className = `bi ${met ? 'bi-check-circle-fill' : 'bi-circle'}`;
		let spoken = pick('.visually-hidden', item);
		if (!spoken) {
			spoken = Object.assign(document.createElement('span'), { className: 'visually-hidden' });
			item.append(spoken);
		}
		spoken.textContent = met ? ' (done)' : ' (not yet)';
	}

	/* A single slider that advises on team size, and a two-thumb price range. */
	function wireSliders() {
		const card = pick('[data-fb-range]');
		if (!card) return;
		const crew = pick('[data-fb-vans]', card);
		const crewOut = pick('[data-fb-vans-out]', card);
		const crewHint = pick('[data-fb-vans-help]', card);
		const low = pick('[data-fb-dual-min]', card);
		const high = pick('[data-fb-dual-max]', card);
		const band = pick('[data-fb-dual-fill]', card);
		const span = pick('[data-fb-price-out]', card);

		crew.addEventListener('input', describeCrew);
		describeCrew();
		for (const thumb of [low, high]) thumb.addEventListener('input', () => settleRange(thumb));
		settleRange();

		function describeCrew() {
			const size = parseInt(crew.value, 10);
			crewOut.textContent = `${size} staff`;
			crew.setAttribute('aria-valuetext', `${size} staff on the road`);
			crewHint.textContent = TEAM_BANDS.find(([floor]) => size >= floor)[1];
		}

		/** Stops the thumbs from crossing (the one not being dragged gives way) and paints the band between them. */
		function settleRange(moved) {
			let from = parseInt(low.value, 10);
			let to = parseInt(high.value, 10);
			if (from > to && moved === low) {
				low.value = to;
				from = to;
			} else if (from > to) {
				high.value = from;
				to = from;
			}
			const ceiling = parseInt(low.max, 10);
			band.style.left = `${(from / ceiling) * 100}%`;
			band.style.right = `${100 - (to / ceiling) * 100}%`;
			span.textContent = `$${from} to $${to}`;
			low.setAttribute('aria-valuetext', `$${from}`);
			high.setAttribute('aria-valuetext', `$${to}`);
		}
	}

	/* Delivery-day tiles: a sentence under them lists the days picked. */
	function wireDayTiles() {
		const group = pick('[data-fb-days-set]');
		const summary = pick('[data-fb-days-note]');
		if (!group || !summary) return;
		group.addEventListener('change', describe);
		describe();

		function describe() {
			const days = pickAll('input:checked', group).map((box) => box.value);
			summary.textContent = days.length ? `Delivering on ${joinWithAnd(days)}.` : 'Pick at least one day.';
		}
	}

	/* Card number, expiry and security code, each masked as typed and checked on blur. */
	function wirePaymentCard() {
		const form = pick('[data-fb-pay]');
		if (!form) return;
		const number = pick('[data-fb-cc]', form);
		const brandLabel = pick('[data-fb-cc-brand-name]', form);
		const brandGlyph = pick('[data-fb-cc-brand] .bi', form);
		const numberHint = pick('[data-fb-cc-help]', form);
		const restingHint = numberHint.textContent.trim();
		const expiry = pick('[data-fb-exp]', form);
		const code = pick('[data-fb-cvc]', form);
		const codeHint = pick('[data-fb-cvc-help]', form);
		const receipt = pick('[data-fb-pay-status]', form);

		const numberMask = bindDigitMask(number, {
			limit: () => cardLayout(cardBrand(onlyDigits(number.value))).length,
			layout: (digits) => chunk(digits, cardLayout(cardBrand(digits)).chunks),
			onChange: reflectNumber,
		});
		number.addEventListener('blur', () => {
			const digits = numberMask.digits();
			if (digits) flagField(number, cardNumberProblem(digits));
		});

		/* A lone first digit above 1 is a month on its own, so it gains a leading zero. */
		const expiryMask = bindDigitMask(expiry, {
			limit: () => 4,
			prepare: (digits) => (/^[2-9]/.test(digits) ? `0${digits}` : digits),
			layout: (digits) => (digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits),
			onChange: () => recheckIfFlagged(expiry, expiryProblem),
		});
		expiry.addEventListener('blur', () => {
			if (expiry.value) flagField(expiry, expiryProblem());
		});

		const codeMask = bindDigitMask(code, {
			limit: () => cardLayout(cardBrand(numberMask.digits())).codeLength,
			onChange: () => recheckIfFlagged(code, codeProblem),
		});
		code.addEventListener('blur', () => {
			if (code.value) flagField(code, codeProblem());
		});

		form.addEventListener('input', () => {
			receipt.textContent = '';
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const flagged = [
				[number, cardNumberProblem(numberMask.digits())],
				[expiry, expiryProblem()],
				[code, codeProblem()],
			].filter(([field, problem]) => flagField(field, problem));
			if (flagged.length) {
				flagged[0][0].focus();
				return;
			}
			const digits = numberMask.digits();
			receipt.textContent = `${cardBrand(digits)} ending ${digits.slice(-4)} is ready to use.`;
		});

		numberMask.redo();

		/** Follows the typed number with the brand badge, the code length and a progress hint. */
		function reflectNumber(digits) {
			const brand = cardBrand(digits);
			const shape = cardLayout(brand);
			const missing = shape.length - digits.length;
			brandLabel.textContent = brand || 'Card';
			brandGlyph.className = `bi ${brand ? 'bi-credit-card-2-front' : 'bi-credit-card'}`;
			code.maxLength = shape.codeLength;
			code.placeholder = shape.codeSample;
			codeHint.textContent = shape.codeHint;

			if (!digits) {
				numberHint.textContent = restingHint;
			} else if (missing > 0) {
				numberHint.textContent = `${brand ? `${brand}, ` : ''}${countLabel(missing, 'more digit', 'more digits')} to go.`;
			} else {
				numberHint.textContent = passesLuhn(digits)
					? `${brand} ending ${digits.slice(-4)}. The number checks out.`
					: `All ${shape.length} digits are in.`;
			}

			if (number.classList.contains('is-invalid') || (missing === 0 && !passesLuhn(digits))) {
				flagField(number, cardNumberProblem(digits));
			}
		}

		function expiryProblem() {
			const digits = expiryMask.digits();
			if (digits.length < 4) return 'Enter the month and year, like 08 / 28';
			const month = parseInt(digits.slice(0, 2), 10);
			const year = 2000 + parseInt(digits.slice(2), 10);
			if (month < 1 || month > 12) return 'The month goes from 01 to 12';
			const today = new Date();
			const thisYear = today.getFullYear();
			const lapsed = year < thisYear || (year === thisYear && month < today.getMonth() + 1);
			return lapsed ? `That card expired in ${digits.slice(0, 2)} / ${digits.slice(2)}` : '';
		}

		function codeProblem() {
			const needed = cardLayout(cardBrand(numberMask.digits())).codeLength;
			return codeMask.digits().length === needed ? '' : `Enter the ${needed}-digit code`;
		}
	}

	/* Price and cost take money-style typing and report the margin between them. */
	function wireMoneyFields() {
		const card = pick('[data-fb-money]');
		if (!card) return;
		const price = pick('[data-fb-price]', card);
		const cost = pick('[data-fb-cost]', card);
		const verdict = pick('[data-fb-margin]', card);
		const symbol = pick('[data-fb-sym]', card);
		const currency = pick('[data-fb-currency]', card);

		for (const field of pickAll('[data-fb-money-field]', card)) {
			field.addEventListener('input', () => {
				rewriteKeepingCaret(field, keepAmountCharacters);
				showMargin();
			});
			field.addEventListener('blur', () => {
				const amount = readAmount(field);
				field.value = Number.isNaN(amount)
					? ''
					: amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
				showMargin();
			});
		}
		currency.addEventListener('change', () => {
			symbol.textContent = currency.value;
		});
		showMargin();

		function showMargin() {
			const [text, low] = marginReading(readAmount(price), readAmount(cost) || 0);
			verdict.textContent = text;
			verdict.classList.toggle('is-low', low);
		}
	}

	/** Words for the margin line, and whether it is thin enough (under 30%) to warn about. */
	function marginReading(sell, spend) {
		if (!(sell > 0)) return ['Enter a price to see the margin.', false];
		if (spend >= sell) return ['The cost is at or above the price, so there is no margin.', true];
		const share = Math.round(((sell - spend) / sell) * 100);
		return [`Margin ${share}% · ${asDollars(sell - spend)} a unit`, share < 30];
	}

	/* Digits, commas and a single decimal point are all an amount may hold. */
	function keepAmountCharacters(text) {
		const kept = text.replace(/[^\d.,]/g, '');
		const point = kept.indexOf('.');
		if (point < 0) return kept;
		return `${kept.slice(0, point + 1)}${kept.slice(point + 1).replaceAll('.', '')}`;
	}

	function readAmount(field) {
		return parseFloat(String(field.value).replace(/[^\d.]/g, ''));
	}

	/* basalt.js owns the tag box; this card echoes the stored value and flags repeats. */
	function wireTagEcho() {
		const card = pick('[data-fb-tagdemo]');
		if (!card) return;
		const notice = pick('[data-fb-tags-note]', card);
		const echo = pick('[data-fb-tags-out]', card);
		const store = pick('[data-basalt-tags-value]', card);
		const box = pick('[data-basalt-tags]', store.parentElement);
		box.addEventListener('basalt:tags-duplicate', (event) => {
			notice.textContent = `${event.detail.value} is already there.`;
		});
		box.addEventListener('change', () => {
			echo.textContent = store.value || '(empty)';
		});
		box.addEventListener('input', () => {
			notice.textContent = '';
		});
	}

	/* A phone number laid out for the chosen country, with the dialable form shown below. */
	function wirePhoneField() {
		const card = pick('[data-fb-phone]');
		if (!card) return;
		const region = pick('[data-fb-tel-country]', card);
		const phone = pick('[data-fb-tel]', card);
		const hint = pick('[data-fb-tel-help]', card);
		const echo = pick('[data-fb-tel-out]', card);

		const phoneMask = bindDigitMask(phone, {
			limit: () => Math.max(...dialPlan().lengths),
			prepare: (digits) => digits.replace(dialPlan().trunk, ''),
			layout: (digits) => (region.value === 'US' ? usPhone(digits) : chunk(digits, dialPlan().chunks)),
			onChange: (digits) => {
				const plan = dialPlan();
				echo.textContent = plan.lengths.includes(digits.length)
					? `${plan.prefix} ${chunk(digits, plan.chunks)}`
					: 'nothing yet';
				recheckIfFlagged(phone, phoneProblem);
			},
		});

		phone.addEventListener('blur', () => flagField(phone, phoneProblem()));
		region.addEventListener('change', () => {
			const plan = dialPlan();
			phone.placeholder = plan.sample;
			hint.textContent = plan.hint;
			phoneMask.redo();
			if (phone.value) flagField(phone, phoneProblem());
		});

		function dialPlan() {
			return DIALING[region.value];
		}

		function phoneProblem() {
			const digits = phoneMask.digits();
			const { lengths } = dialPlan();
			if (!digits || lengths.includes(digits.length)) return '';
			const verdict = digits.length < lengths[0] ? 'Too short: ' : 'Too long: ';
			return `${verdict}this needs ${lengths.join(' or ')} digits.`;
		}
	}

	/* US numbers read (555) 014-2290 at every stage of typing. */
	function usPhone(digits) {
		if (!digits) return '';
		const area = digits.slice(0, 3);
		if (digits.length <= 3) return `(${area}`;
		if (digits.length <= 6) return `(${area}) ${digits.slice(3)}`;
		return `(${area}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
	}

	/* A postal code whose label, sample and rule follow the chosen country. */
	function wirePostalField() {
		const card = pick('[data-fb-post]');
		if (!card) return;
		const region = pick('[data-fb-post-country]', card);
		const code = pick('[data-fb-post-input]', card);
		const title = pick('[data-fb-post-label]', card);
		const hint = pick('[data-fb-post-help]', card);

		code.addEventListener('blur', () => {
			code.value = normalizePostal(code.value, format());
			judge();
		});
		code.addEventListener('input', () => {
			if (!code.classList.contains('is-invalid') && !code.classList.contains('is-valid')) return;
			code.classList.remove('is-valid');
			if (format().pattern.test(normalizePostal(code.value, format()))) flagField(code, '');
		});
		region.addEventListener('change', () => {
			const rules = format();
			title.textContent = rules.name;
			code.placeholder = rules.sample;
			hint.textContent = rules.hint;
			if (!code.value) return;
			code.value = normalizePostal(code.value, rules);
			judge();
		});

		function format() {
			return POSTAL[region.value];
		}

		function judge() {
			const typed = code.value.trim();
			code.classList.remove('is-valid');
			if (!typed) {
				flagField(code, '');
				return;
			}
			const rules = format();
			const problem = flagField(code, rules.pattern.test(typed) ? '' : rules.problem);
			code.classList.toggle('is-valid', !problem);
		}
	}

	/* Upper case, no spaces, then one space wherever the country's format puts it. */
	function normalizePostal(raw, rules) {
		const compact = raw.trim().toUpperCase().replace(/\s/g, '');
		return rules.spacing ? compact.replace(rules.spacing, '$1 $2') : compact;
	}

	/* One address with a did-you-mean offer, and a comma list checked address by address. */
	function wireEmailFields() {
		const card = pick('[data-fb-email]');
		if (!card) return;
		const single = pick('[data-fb-em]', card);
		const offer = pick('[data-fb-em-suggest]', card);
		const accept = pick('[data-fb-em-fix]', card);
		const many = pick('[data-fb-em-list]', card);

		single.addEventListener('blur', () => {
			single.value = single.value.trim();
			const proposal = correctedAddress(single.value);
			flagField(single, proposal ? '' : addressProblem(single.value));
			offer.hidden = !proposal;
			accept.textContent = proposal;
		});
		single.addEventListener('input', () => {
			offer.hidden = true;
			if (single.classList.contains('is-invalid') && !addressProblem(single.value.trim())) flagField(single, '');
		});
		accept.addEventListener('click', () => {
			single.value = accept.textContent.trim();
			offer.hidden = true;
			flagField(single, '');
			single.focus();
		});

		many.addEventListener('blur', () => {
			many.value = splitAddresses(many.value).join(', ');
			flagField(many, listProblem(many.value));
		});
		many.addEventListener('input', () => {
			if (many.classList.contains('is-invalid') && !listProblem(many.value)) flagField(many, '');
		});
	}

	/* Names the missing piece of an address, so the message says what to add. */
	function addressProblem(value) {
		if (!value) return '';
		if (!value.includes('@')) return 'Add an @ and the part after it, like name@example.com';
		const [local, domain] = value.split('@');
		if (!local) return 'Add the part before the @';
		if (!domain) return 'Add the part after the @, like example.com';
		if (!/\.[^\s@.]{2,}$/.test(domain)) return 'Add the end of the address, like .com';
		return ADDRESS.test(value) ? '' : 'Enter an email address like name@example.com';
	}

	/** Returns the address with a mistyped domain put right, or '' when nothing looks off. */
	function correctedAddress(value) {
		const at = value.lastIndexOf('@');
		if (at < 1) return '';
		const domain = value.slice(at + 1).toLowerCase();
		const repaired = intendedDomain(domain) || (domain.endsWith('.con') ? `${domain.slice(0, -4)}.com` : '');
		return repaired ? `${value.slice(0, at + 1)}${repaired}` : '';
	}

	function intendedDomain(domain) {
		for (const [meant, slips] of Object.entries(DOMAIN_SLIPS)) {
			if (slips.includes(domain)) return meant;
		}
		return '';
	}

	function splitAddresses(text) {
		return text
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);
	}

	function listProblem(text) {
		const broken = splitAddresses(text).filter((address) => !ADDRESS.test(address));
		if (!broken.length) return '';
		if (broken.length === 1) return `${broken[0]} is not a full address`;
		return `${broken.length} of these are not full addresses: ${broken.join(', ')}`;
	}

	/* After the first submit, a linked list of every problem sits above the form and stays current. */
	function wireErrorSummary() {
		const form = pick('[data-fb-summary]');
		if (!form) return;
		const panel = pick('[data-fb-errors]', form);
		const heading = pick('[data-fb-errors-title]', form);
		const links = pick('[data-fb-errors-list]', form);
		const success = pick('[data-fb-done]', form);
		let attempted = false;

		links.addEventListener('click', (event) => {
			const link = event.target.closest('a');
			if (!link) return;
			event.preventDefault();
			const field = document.getElementById(link.getAttribute('href').slice(1));
			if (!field) return;
			field.focus();
			field.scrollIntoView({ block: 'center', behavior: 'smooth' });
		});
		form.addEventListener('input', () => {
			success.textContent = '';
			if (attempted) collect();
		});
		form.addEventListener('change', () => {
			if (attempted) collect();
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			attempted = true;
			if (collect()) {
				success.textContent = '';
				panel.focus();
				return;
			}
			success.textContent = 'All four fields are fine. Sent.';
		});
		form.addEventListener('reset', () => {
			attempted = false;
			panel.hidden = true;
			success.textContent = '';
			for (const field of pickAll('.is-invalid', form)) flagField(field, '');
		});

		/** Checks every field, rebuilds the linked list and returns how many failed. */
		function collect() {
			const entries = [];
			for (const field of requiredInPlay(form)) {
				const message = flagField(field, requiredProblem(field));
				if (message) entries.push(problemLink(field, message));
			}
			links.replaceChildren(...entries);
			heading.textContent =
				entries.length === 1
					? 'There is 1 problem with your details'
					: `There are ${entries.length} problems with your details`;
			panel.hidden = entries.length === 0;
			return entries.length;
		}
	}

	function problemLink(field, message) {
		const item = document.createElement('li');
		const link = document.createElement('a');
		link.href = `#${field.id}`;
		link.textContent = message;
		item.append(link);
		return item;
	}

	/* Pausing everything grays out the other switches; the SMS number shows only while texts are on. */
	function wireNotificationSwitches() {
		const card = pick('[data-fb-notif]');
		if (!card) return;
		const snooze = pick('[data-fb-n-pause]', card);
		const texts = pick('[data-fb-n-sms]', card);
		const numberRow = pick('[data-fb-n-phone-wrap]', card);
		const options = pickAll('[data-fb-n-item]', card);

		card.addEventListener('change', settle);
		settle();

		function settle() {
			const paused = snooze.checked;
			numberRow.hidden = paused || !texts.checked;
			for (const option of options) {
				option.disabled = paused;
				option.closest('.fb-switch')?.classList.toggle('is-off', paused);
			}
		}
	}

	/* A parent box that is checked, clear or half-checked depending on its children. */
	function wireParentCheckbox() {
		const card = pick('[data-fb-checks]');
		if (!card) return;
		const parent = pick('[data-fb-parent]', card);
		const children = pickAll('[data-fb-child]', card);
		const caption = pick('[data-fb-kids-note]', card);

		parent.addEventListener('change', () => {
			for (const child of children) child.checked = parent.checked;
			reflectChildren();
		});
		for (const child of children) child.addEventListener('change', reflectChildren);
		reflectChildren();

		function reflectChildren() {
			const total = children.length;
			const ticked = children.filter((child) => child.checked).length;
			parent.checked = ticked === total;
			parent.indeterminate = ticked > 0 && ticked < total;
			if (ticked === total) caption.textContent = `All ${total} picked, so the parent is checked.`;
			else if (ticked === 0) caption.textContent = 'None picked, so the parent is clear.';
			else caption.textContent = `${ticked} of ${total} picked, so the parent is half-checked.`;
		}
	}

	/* Code fields type in capitals; the strict ones also drop anything but letters, digits and dashes. */
	function wireCodeInputs() {
		for (const field of pickAll('[data-fb-upper]')) {
			const strict = field.hasAttribute('data-fb-code-chars');
			field.addEventListener('input', () => {
				rewriteKeepingCaret(field, (text) => {
					const upper = text.toUpperCase();
					return strict ? upper.replace(/[^A-Z0-9-]/g, '') : upper;
				});
			});
		}
	}

	/* A discount code checked on submit against live and retired codes. */
	function wireDiscountForm() {
		const form = pick('[data-fb-discount]');
		if (!form) return;
		const entry = pick('#fb-disc', form);
		const problemLine = pick('[data-fb-disc-err]', form);
		const appliedLine = pick('[data-fb-disc-ok]', form);

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const code = entry.value.trim().toUpperCase();
			const problem = discountProblem(code);
			entry.classList.toggle('is-invalid', Boolean(problem));
			entry.classList.toggle('is-valid', !problem);
			if (problem) entry.setAttribute('aria-invalid', 'true');
			else entry.removeAttribute('aria-invalid');
			problemLine.textContent = problem;
			appliedLine.textContent = problem ? '' : `${code} applied: ${DISCOUNTS[code]}.`;
			if (problem) entry.focus();
		});
		entry.addEventListener('input', () => {
			entry.classList.remove('is-invalid', 'is-valid');
			entry.removeAttribute('aria-invalid');
			problemLine.textContent = '';
			appliedLine.textContent = '';
		});
	}

	function discountProblem(code) {
		if (!code) return 'Enter a code first.';
		if (RETIRED_CODES[code]) return RETIRED_CODES[code];
		return DISCOUNTS[code] ? '' : "We don't recognize that code. Check it for typos.";
	}

	/* The slug follows the product name until someone edits it; clearing it hands control back. */
	function wireSlugField() {
		const card = pick('[data-fb-slug]');
		if (!card) return;
		const title = pick('[data-fb-slug-name]', card);
		const slug = pick('[data-fb-slug-input]', card);
		const hint = pick('[data-fb-slug-help]', card);
		let handEdited = false;

		title.addEventListener('input', () => {
			if (!handEdited) slug.value = toSlug(title.value);
		});
		slug.addEventListener('input', () => {
			handEdited = slug.value.trim() !== '';
			if (!handEdited) slug.value = toSlug(title.value);
			hint.textContent = handEdited
				? 'Edited by hand. Clear it to follow the name again.'
				: 'Follows the product name.';
		});
		slug.addEventListener('blur', () => {
			slug.value = toSlug(slug.value) || toSlug(title.value);
		});
	}

	/* Accents come off, then every run of other characters becomes one dash. */
	function toSlug(text) {
		return text
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	/* Textareas that grow with their text, one with a character budget, one with quick phrases. */
	function wireTextareas() {
		const card = pick('[data-fb-notes]');
		if (!card) return;
		for (const area of pickAll('[data-fb-autogrow]', card)) autoGrow(area);
		wireCharacterBudget(
			pick('[data-fb-counted]', card),
			pick('[data-fb-counter]', card),
			pick('[data-fb-counter-live]', card),
		);
		wirePhraseButtons(pick('[data-fb-deliv]', card), pickAll('[data-fb-phrase]', card));
	}

	function autoGrow(area) {
		function fit() {
			area.style.height = 'auto';
			area.style.height = `${area.scrollHeight + (area.offsetHeight - area.clientHeight)}px`;
		}
		area.addEventListener('input', fit);
		window.addEventListener('resize', fit);
		fit();
	}

	/**
	 * Counts down the characters left. Screen readers hear about it only when
	 * the count crosses into the low or empty zone, not on every key.
	 */
	function wireCharacterBudget(area, readout, announcer) {
		let lastZone = '';
		area.addEventListener('input', tally);
		tally();

		function tally() {
			const remaining = parseInt(area.getAttribute('maxlength'), 10) - area.value.length;
			readout.textContent =
				remaining === 0 ? 'No characters left' : `${countLabel(remaining, 'character', 'characters')} left`;
			readout.classList.toggle('is-low', remaining <= 20);
			let zone = 'ok';
			if (remaining === 0) zone = 'none';
			else if (remaining <= 20) zone = 'low';
			if (lastZone && zone !== lastZone) announcer.textContent = zone === 'ok' ? '' : readout.textContent.trim();
			lastZone = zone;
		}
	}

	/* Each phrase button adds its words to the note or takes them back out, and shows which are in. */
	function wirePhraseButtons(note, buttons) {
		for (const button of buttons) {
			button.addEventListener('click', () => {
				const phrase = button.getAttribute('data-fb-phrase');
				note.value = note.value.includes(phrase)
					? note.value
							.replace(phrase, '')
							.replace(/\s{2,}/g, ' ')
							.trim()
					: `${note.value.trim()} ${phrase}`.trim();
				markPhrases();
			});
		}
		note.addEventListener('input', markPhrases);
		markPhrases();

		function markPhrases() {
			for (const button of buttons) {
				button.setAttribute('aria-pressed', String(note.value.includes(button.getAttribute('data-fb-phrase'))));
			}
		}
	}

	/* Floating-label form: checks wait for the first submit, then follow each keystroke. */
	function wireFloatingForm() {
		const form = pick('[data-fb-floating]');
		if (!form) return;
		const outcome = pick('[data-fb-fl-status]', form);
		let attempted = false;

		form.addEventListener('input', (event) => {
			outcome.textContent = '';
			const field = event.target;
			if (attempted && field.hasAttribute('required')) flagField(field, requiredProblem(field));
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			attempted = true;
			const flagged = requiredInPlay(form).filter((field) => flagField(field, requiredProblem(field)));
			if (flagged.length) {
				flagged[0].focus();
				return;
			}
			outcome.textContent = 'Everything needed is filled in.';
		});
	}

	/* The time-slot select only opens up when "pick a slot" is the chosen radio. */
	function wireDeliveryRadios() {
		const card = pick('[data-fb-radios]');
		if (!card) return;
		const slot = pick('[data-fb-slot]', card);
		card.addEventListener('change', sync);
		sync();

		function sync() {
			slot.disabled = pick('input[name="fb-when"]:checked', card).value !== 'pick';
		}
	}

	/* The multi-select counts what is picked; the invalid example settles once a day is chosen. */
	function wireSelects() {
		const likes = pick('[data-fb-likes]');
		const hint = pick('[data-fb-likes-help]');
		if (!likes || !hint) return;
		likes.addEventListener('change', () => {
			const picked = likes.selectedOptions.length;
			hint.textContent = `${picked ? `${picked} picked. ` : 'None picked. '}Pick as many as you like.`;
		});
		const day = pick('[data-fb-day]');
		day?.addEventListener('change', () => {
			if (day.value) flagField(day, '');
		});
	}

	/* Date, time and billing month, read back together as one plain sentence. */
	function wireDateTime() {
		const card = pick('[data-fb-when]');
		if (!card) return;
		const day = pick('[data-fb-date]', card);
		const hour = pick('[data-fb-time]', card);
		const billing = pick('[data-fb-month]', card);
		const sentence = pick('[data-fb-when-out] span', card);

		day.min = isoDate(noonAfter(1));
		day.max = isoDate(noonAfter(90));
		day.value = isoDate(noonAfter(3));
		billing.value = isoDate(noonAfter(0)).slice(0, 7);

		day.addEventListener('change', narrate);
		day.addEventListener('blur', () => {
			if (!day.value) return;
			if (day.value < day.min) day.value = day.min;
			if (day.value > day.max) day.value = day.max;
			narrate();
		});
		hour.addEventListener('change', () => {
			recheckIfFlagged(hour, () => slotProblem(hour));
			narrate();
		});
		hour.addEventListener('blur', () => {
			flagField(hour, slotProblem(hour));
			narrate();
		});
		billing.addEventListener('change', narrate);
		narrate();

		function narrate() {
			sentence.textContent = day.value ? `${visitPhrase()}.` : 'Pick a date.';
		}

		function visitPhrase() {
			const noon = new Date(`${day.value}T12:00:00`);
			let text = noon.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
			if (hour.value && !slotProblem(hour)) text += ` at ${clockLabel(hour.value)}`;
			if (billing.value) {
				const firstOfMonth = new Date(`${billing.value}-01T12:00:00`);
				text += `, billed in ${firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
			}
			return text;
		}
	}

	/* Slots run on the hour or half hour, inside the field's own min and max. */
	function slotProblem(field) {
		const { value } = field;
		if (!value) return 'Pick a time';
		if (value < field.min || value > field.max) return 'Choose a time between 8am and 6pm';
		return parseInt(value.slice(3, 5), 10) % 30 ? 'Pick a time on the hour or half hour' : '';
	}

	/* "13:30" reads as "1:30pm" and "09:00" as "9am". */
	function clockLabel(value) {
		const [hours, minutes] = value.split(':').map(Number);
		const minutePart = minutes ? `:${String(minutes).padStart(2, '0')}` : '';
		return `${((hours + 11) % 12) + 1}${minutePart}${hours < 12 ? 'am' : 'pm'}`;
	}

	/* Noon keeps the date steady across daylight-saving shifts. */
	function noonAfter(offset) {
		const date = new Date();
		date.setHours(12, 0, 0, 0);
		date.setDate(date.getDate() + offset);
		return date;
	}

	function isoDate(date) {
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const dayOfMonth = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${month}-${dayOfMonth}`;
	}

	/* Markup cannot ask for a half-checked box, so the sample tiles get it here; a click clears it as usual. */
	function markMixedTicks() {
		for (const tick of pickAll('[data-fb-tick-mixed]')) tick.indeterminate = true;
	}

	/* Input-group extras: copy a referral link from its field, and clear a search box. */
	function wireInputGroups() {
		const card = pick('[data-fb-addons]');
		if (!card) return;
		const copyButton = pick('[data-fb-copy-field]', card);
		const copyHint = pick('[data-fb-ref-help]', card);
		const restingHint = copyHint.textContent.trim();

		copyButton.addEventListener('click', () => {
			const source = pick(copyButton.getAttribute('data-fb-copy-field'), document);
			window.Basalt.copyText(source.value).then(() => {
				confirmCopied(copyButton, 'Copied');
				copyHint.textContent = 'Link copied. Paste it anywhere.';
				setTimeout(() => {
					copyHint.textContent = restingHint;
				}, 2400);
			});
		});

		const search = pick('[data-fb-find]', card);
		const wipe = pick('[data-fb-find-clear]', card);
		search.addEventListener('input', syncWipe);
		wipe.addEventListener('click', () => {
			search.value = '';
			syncWipe();
			search.focus();
		});

		function syncWipe() {
			wipe.hidden = !search.value;
		}
	}

	/* Field errors. The message goes into the element "<id>-err", which the
     field already lists in aria-describedby. */

	/** Marks a field invalid, or clears it when the message is empty; hands the message back. */
	function flagField(field, message) {
		field.classList.toggle('is-invalid', Boolean(message));
		if (message) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
		const slot = document.getElementById(`${field.id}-err`);
		if (slot) slot.textContent = message || '';
		return message;
	}

	function recheckIfFlagged(field, judge) {
		if (field.classList.contains('is-invalid')) flagField(field, judge());
	}

	/* Required fields that are hidden or disabled are skipped. */
	function requiredInPlay(form) {
		return pickAll('[required]', form).filter((field) => !field.disabled && !field.closest('[hidden]'));
	}

	function requiredProblem(field) {
		if (field.type === 'checkbox') return field.checked ? '' : field.getAttribute('data-fb-msg');
		const typed = field.value.trim();
		if (!typed) return field.getAttribute('data-fb-msg');
		return field.type === 'email' && !ADDRESS.test(typed) ? 'Enter an email address like name@example.com' : '';
	}

	/* Typing masks. */

	/**
	 * Keeps a field to digits, lays them out with rules.layout and returns the
	 * caret to the spot after the same number of digits. Backspace over a space
	 * or bracket deletes the digit in front of it instead of doing nothing.
	 * @param {HTMLInputElement} field
	 * @param {{limit: () => number, prepare?: Function, layout?: Function, onChange?: Function}} rules
	 * @returns {{digits: () => string, redo: () => void}}
	 */
	function bindDigitMask(field, rules) {
		let lastDigits = onlyDigits(field.value);
		field.addEventListener('input', reshape);
		return {
			digits: () => onlyDigits(field.value),
			redo: () => reshape(null),
		};

		function reshape(event) {
			const caret = field.selectionStart ?? field.value.length;
			let lead = onlyDigits(field.value.slice(0, caret)).length;
			let digits = onlyDigits(field.value);
			if (event?.inputType === 'deleteContentBackward' && digits === lastDigits && lead > 0) {
				digits = `${digits.slice(0, lead - 1)}${digits.slice(lead)}`;
				lead -= 1;
			}
			if (rules.prepare) {
				const prepared = rules.prepare(digits);
				lead = Math.max(0, lead + prepared.length - digits.length);
				digits = prepared;
			}
			digits = digits.slice(0, rules.limit());
			field.value = rules.layout ? rules.layout(digits) : digits;
			if (document.activeElement === field) {
				const spot = indexAfterDigits(field.value, lead);
				field.setSelectionRange(spot, spot);
			}
			lastDigits = digits;
			rules.onChange?.(digits);
		}
	}

	function indexAfterDigits(text, count) {
		let index = 0;
		let seen = 0;
		while (index < text.length && seen < count) {
			if (/\d/.test(text[index])) seen += 1;
			index += 1;
		}
		return index;
	}

	/** Rewrites a field's value and keeps the caret where it was, minus whatever got dropped. */
	function rewriteKeepingCaret(field, transform) {
		const caret = field.selectionStart;
		const lengthBefore = field.value.length;
		const next = transform(field.value);
		field.value = next;
		const spot = Math.max(0, caret - (lengthBefore - next.length));
		field.setSelectionRange(spot, spot);
	}

	function onlyDigits(text) {
		return text.replace(/\D/g, '');
	}

	/* Splits digits into groups of the given sizes; anything past the last group trails on. */
	function chunk(digits, sizes) {
		const pieces = [];
		let cursor = 0;
		for (const size of sizes) {
			if (cursor >= digits.length) break;
			pieces.push(digits.slice(cursor, cursor + size));
			cursor += size;
		}
		if (cursor < digits.length) pieces.push(digits.slice(cursor));
		return pieces.join(' ');
	}

	/* Card arithmetic. */

	function cardBrand(digits) {
		return CARD_BRANDS.find(([, prefix]) => prefix.test(digits))?.[0] ?? '';
	}

	function cardLayout(brand) {
		return brand === 'Amex' ? CARD_LAYOUTS.Amex : CARD_LAYOUTS.standard;
	}

	function cardNumberProblem(digits) {
		if (!digits) return 'Enter the card number';
		const brand = cardBrand(digits);
		const { length } = cardLayout(brand);
		if (digits.length < length) return `${brand || 'This card'} numbers have ${length} digits`;
		return passesLuhn(digits) ? '' : 'This number has a typo in it. Check the digits.';
	}

	/* Luhn: from the right, every second digit is doubled (less 9 past 9) and the sum ends in 0. */
	function passesLuhn(digits) {
		let sum = 0;
		let doubled = false;
		for (let index = digits.length - 1; index >= 0; index -= 1) {
			let value = Number(digits[index]);
			if (doubled) {
				value *= 2;
				if (value > 9) value -= 9;
			}
			sum += value;
			doubled = !doubled;
		}
		return sum % 10 === 0;
	}

	/* Page lookups and wording. */

	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function countLabel(count, singular, pluralForm) {
		return `${count} ${count === 1 ? singular : pluralForm}`;
	}

	function asDollars(amount) {
		return `$${amount.toFixed(2)}`;
	}

	function joinWithAnd(items) {
		if (items.length < 2) return items.join('');
		return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
	}

	start();
})();
