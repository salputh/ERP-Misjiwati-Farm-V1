/**
 * Behavior for step-forms.html: eight sample multi-step forms plus the
 * chips above them that narrow the grid to one layout. Seven samples share
 * the stepFlow() engine below; the tabbed product listing runs its own
 * small tab logic. The number steppers and tag boxes are bound by basalt.js
 * before this file runs, so their element APIs are already in place.
 */
(() => {
	'use strict';

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Each sample sets itself up and quietly steps aside when its card is absent. */
	const SAMPLES = [
		setUpCheckout,
		setUpPlanBuilder,
		setUpSeatInvite,
		setUpStockistForm,
		setUpPlanFinder,
		setUpZoneForm,
		setUpReturnDialog,
		setUpListingTabs,
	];

	document.addEventListener('DOMContentLoaded', start);

	function start() {
		const showcase = pick('[data-wiz-page]');
		if (!showcase) return;
		for (const setUp of SAMPLES) setUp();
		wireLayoutChips(showcase);
	}

	/* Small DOM and text helpers used by every sample. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	/** Value of the checked radio in a named group, or '' when none is checked. */
	function chosenValue(group, scope) {
		return pick(`input[name="${group}"]:checked`, scope)?.value ?? '';
	}

	function htmlSafe(text) {
		return String(text).replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
	}

	function dollars(amount) {
		return `${amount < 0 ? '-$' : '$'}${Math.abs(amount).toFixed(2)}`;
	}

	function longDay(date) {
		return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' });
	}

	/* Field problems. The stepFlow engine and the listing tabs both report
     through these, so every sample marks fields and lists them the same way.
     A problem is { field, text } plus, when needed, slotId (where its message
     goes), where (a section name shown before it) and reveal (run before the
     field is focused). */

	/** Every control in a section that is visible, enabled and not opted out. */
	function checkableControls(section) {
		return pickAll('select, textarea, input', section).filter(
			(control) =>
				control.type !== 'hidden' &&
				!control.disabled &&
				!control.closest('[hidden]') &&
				!control.hasAttribute('data-wiz-skip'),
		);
	}

	/**
	 * The browser's own checks for a section plus any card-specific ones,
	 * returned in on-screen order. A required radio group is reported once.
	 */
	function findProblems(section, cardCheck) {
		const problems = [];
		const groupsSeen = new Set();
		for (const control of checkableControls(section)) {
			if (control.type === 'radio') {
				if (!control.required || groupsSeen.has(control.name)) continue;
				groupsSeen.add(control.name);
			}
			if (control.checkValidity()) continue;
			problems.push({
				field: control,
				text: control.getAttribute('data-wiz-msg') || control.validationMessage || 'Check this field',
			});
		}
		for (const extra of cardCheck ? cardCheck(section) : []) {
			if (extra && !problems.some((known) => known.field === extra.field)) problems.push(extra);
		}
		return problems.sort((a, b) =>
			a.field.compareDocumentPosition(b.field) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
		);
	}

	/** The paragraph that carries a problem's message under its field. */
	function messageSlotFor(problem) {
		if (problem.slotId) return document.getElementById(problem.slotId);
		if (problem.field.type === 'radio') {
			const described = problem.field.closest('fieldset')?.getAttribute('aria-describedby') ?? '';
			const slotId = described.split(' ').find((id) => id.endsWith('-error'));
			if (slotId) return document.getElementById(slotId);
		}
		return document.getElementById(`${problem.field.id}-error`);
	}

	/** Clears earlier marks inside scope, then flags each problem's field and message. */
	function markProblems(scope, problems) {
		for (const field of pickAll('[aria-invalid="true"]:not([data-wiz-skip])', scope)) {
			field.classList.remove('is-invalid');
			field.removeAttribute('aria-invalid');
		}
		for (const slot of pickAll('.wiz-error:not([data-wiz-own])', scope)) {
			slot.hidden = true;
			slot.textContent = '';
		}
		for (const problem of problems) {
			problem.field.classList.add('is-invalid');
			problem.field.setAttribute('aria-invalid', 'true');
			const slot = messageSlotFor(problem);
			if (slot?.hidden) {
				slot.hidden = false;
				slot.textContent = problem.text;
			}
		}
	}

	/**
	 * Fills the "things to fix" box with a link per problem, or empties and
	 * hides it when there is nothing left. Pass { focus: false } to update the
	 * box without moving focus, and { suffix } to extend its heading.
	 */
	function renderProblemBox(box, problems, settings) {
		if (!box) return;
		if (!problems.length) {
			box.hidden = true;
			box.innerHTML = '';
			return;
		}
		const heading = problems.length === 1 ? 'One thing to fix' : `${problems.length} things to fix`;
		const tail = settings?.suffix ? ` ${settings.suffix}` : '';
		const links = problems.map((problem, n) => {
			const where = problem.where ? `<span class="wiz-summary-where">${htmlSafe(problem.where)}:</span> ` : '';
			return `<li><a data-wiz-err="${n}" href="#${htmlSafe(problem.field.id)}">${where}${htmlSafe(problem.text)}</a></li>`;
		});
		box.innerHTML = `<p class="wiz-summary-title"><i aria-hidden="true" class="bi bi-exclamation-circle"></i>${heading}${tail}</p><ul class="wiz-summary-list">${links.join('')}</ul>`;
		box.hidden = false;

		for (const link of pickAll('[data-wiz-err]', box)) {
			link.addEventListener('click', (event) => {
				event.preventDefault();
				const problem = problems[Number(link.getAttribute('data-wiz-err'))];
				problem.reveal?.();
				focusProblemField(problem.field);
			});
		}

		if (settings?.focus === false) return;
		box.focus({ preventScroll: true });
		nudgeIntoView(box);
	}

	/** A tag box takes focus through its typing input rather than the field itself. */
	function focusProblemField(field) {
		const tagField = field.closest('.basalt-tags');
		const target = (tagField && pick('.basalt-tags-input', tagField)) || field;
		target.focus({ preventScroll: true });
		nudgeIntoView(target);
	}

	/** Scrolls only when the element sits under the top bar or below the fold. */
	function nudgeIntoView(element) {
		const box = element.getBoundingClientRect();
		if (box.top >= 80 && box.bottom <= window.innerHeight - 40) return;
		window.scrollBy({ top: box.top - 120, behavior: calmMotion ? 'auto' : 'smooth' });
	}

	/**
	 * The engine behind seven of the samples.
	 *
	 * Markup: [data-wiz-form] holding [data-wiz-panel] sections (data-wiz-label
	 * names one, data-wiz-when makes it conditional), a [data-wiz-next] submit
	 * button (data-wiz-finish is its last-step label) and optionally
	 * [data-wiz-back], [data-wiz-steps], [data-wiz-errors], [data-wiz-done],
	 * [data-wiz-live], [data-wiz-goto] and [data-wiz-restart].
	 *
	 * Settings: include(whenKey), verify { sectionKey: fn(section) -> problems },
	 * anyOrder (sections open freely and the last button checks all of them),
	 * describe(section, problems, attempted, visited), stepChanged(step),
	 * submit(finish) and cleared().
	 *
	 * Returns { syncBranches, startOver, redrawRail }.
	 */
	function stepFlow(host, settings = {}) {
		const form = pick('[data-wiz-form]', host);
		const sections = pickAll('[data-wiz-panel]', host);
		const rail = pick('[data-wiz-steps]', host);
		const problemBox = pick('[data-wiz-errors]', host);
		const backButton = pick('[data-wiz-back]', host);
		const nextButton = pick('[data-wiz-next]', host);
		const finishedView = pick('[data-wiz-done]', host);
		const announcer = pick('[data-wiz-live]', host);
		const nextButtonHtml = nextButton.innerHTML;
		const finishText = nextButton.getAttribute('data-wiz-finish') || 'Finish';
		const anyOrder = Boolean(settings.anyOrder);
		const visited = new Set();
		const attempted = new Set();
		/* Rail entries are built once per section and patched in place, so a
       click that lands while a field commits its value is never dropped. */
		const railEntries = new Map();
		let shown = sections[0];
		let furthest = 0;
		let finishing = false;

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!finishing) advance();
		});
		backButton?.addEventListener('click', () => {
			const route = sectionsInPlay();
			const at = route.indexOf(shown);
			if (at > 0) present(route[at - 1], true);
		});
		for (const button of pickAll('[data-wiz-goto]', host)) {
			button.addEventListener('click', () => {
				const wanted = sections.find((section) => sectionKey(section) === button.getAttribute('data-wiz-goto'));
				if (wanted) present(wanted, true);
			});
		}
		for (const button of pickAll('[data-wiz-restart]', host)) {
			button.addEventListener('click', () => {
				startOver();
				pick('.wiz-panel-title, [tabindex="-1"]', shown)?.focus({ preventScroll: true });
			});
		}
		form.addEventListener('input', recheckShown);
		form.addEventListener('change', recheckShown);

		present(shown, false);

		return { syncBranches, startOver, redrawRail };

		/* Which sections exist right now, and what each one is called. */

		function sectionsInPlay() {
			return sections.filter((section) => {
				const condition = section.getAttribute('data-wiz-when');
				return !condition || !settings.include || settings.include(condition);
			});
		}

		function sectionKey(section) {
			return section.getAttribute('data-wiz-panel');
		}

		function sectionName(section) {
			return section.getAttribute('data-wiz-label') || sectionKey(section);
		}

		/** A section off screen is checked with its hidden flag lifted for a moment. */
		function problemsIn(section) {
			const wasHidden = section.hidden;
			section.hidden = false;
			const problems = findProblems(section, settings.verify?.[sectionKey(section)] || null);
			section.hidden = wasHidden;
			return problems;
		}

		/* Moving between sections. */

		function present(target, moveFocus) {
			const route = sectionsInPlay();
			const leaving = route.indexOf(shown);
			const arriving = route.indexOf(target);

			for (const section of sections) section.hidden = section !== target;

			target.classList.remove('is-entering-back', 'is-entering');
			if (moveFocus && !calmMotion) {
				void target.offsetWidth;
				target.classList.add(arriving < leaving ? 'is-entering-back' : 'is-entering');
			}

			shown = target;
			visited.add(target);
			furthest = Math.max(furthest, arriving);
			if (backButton) backButton.hidden = arriving === 0;
			nextButton.innerHTML = arriving === route.length - 1 ? htmlSafe(finishText) : nextButtonHtml;
			renderProblemBox(problemBox, [], { focus: false });
			redrawRail();

			if (announcer && moveFocus)
				announcer.textContent = `Step ${arriving + 1} of ${route.length}, ${sectionName(target)}`;
			settings.stepChanged?.({
				offset: arriving,
				count: route.length,
				key: sectionKey(target),
				label: sectionName(target),
				panel: target,
				upcoming: route[arriving + 1] ? sectionName(route[arriving + 1]) : '',
			});
			if (!moveFocus) return;
			pick('.wiz-panel-title, [tabindex="-1"]', target)?.focus({ preventScroll: true });
			nudgeIntoView(host);
		}

		/** Checks a section, marks what fails and lists it. True when it passes. */
		function vet(section) {
			attempted.add(section);
			const problems = problemsIn(section);
			markProblems(section, problems);
			if (problems.length) renderProblemBox(problemBox, problems);
			return !problems.length;
		}

		/* A linear flow still checks the section you leave when you jump ahead. */
		function jumpTo(target) {
			if (target === shown) return;
			const route = sectionsInPlay();
			const ahead = route.indexOf(target) > route.indexOf(shown);
			if (!anyOrder && ahead && !vet(shown)) return;
			present(target, true);
		}

		function advance() {
			const route = sectionsInPlay();
			const at = route.indexOf(shown);
			if (anyOrder) {
				attempted.add(shown);
				const problems = problemsIn(shown);
				markProblems(shown, problems);
				if (problems.length) {
					renderProblemBox(problemBox, problems);
					redrawRail();
					return;
				}
			} else if (!vet(shown)) {
				return;
			}
			if (at < route.length - 1) present(route[at + 1], true);
			else wrapUp();
		}

		function wrapUp() {
			if (anyOrder && !openFirstUnfinished()) return;

			finishing = true;
			nextButton.disabled = true;
			nextButton.innerHTML = `<span aria-hidden="true" class="spinner-border spinner-border-sm"></span> ${htmlSafe(finishText)}`;
			setTimeout(
				() => {
					if (settings.submit) settings.submit(finish);
					else finish();
				},
				calmMotion ? 0 : 650,
			);
		}

		/** Free-order flows: every section must pass; the first that does not is opened. False when one failed. */
		function openFirstUnfinished() {
			const route = sectionsInPlay();
			for (const section of route) attempted.add(section);
			const unfinished = route.find((section) => problemsIn(section).length);
			redrawRail();
			if (!unfinished) return true;
			present(unfinished, true);
			vet(unfinished);
			if (announcer) announcer.textContent = `${sectionName(unfinished)} needs attention before you can send.`;
			return false;
		}

		/** Handed to settings.submit; swaps the form for the done view, or only announces when there is none. */
		function finish(message) {
			finishing = false;
			nextButton.disabled = false;
			nextButton.innerHTML = htmlSafe(finishText);
			if (!finishedView) {
				if (announcer && message) announcer.textContent = message;
				return;
			}
			for (const part of pickAll('[data-wiz-hide-on-done]', host)) part.hidden = true;
			finishedView.hidden = false;
			const doneHeading = pick('.wiz-done-title', finishedView);
			doneHeading?.focus({ preventScroll: true });
			if (announcer) announcer.textContent = message || (doneHeading ? doneHeading.textContent : 'Done');
		}

		function startOver() {
			form?.reset();
			visited.clear();
			attempted.clear();
			furthest = 0;
			finishing = false;
			nextButton.disabled = false;
			for (const section of sections) markProblems(section, []);
			for (const part of pickAll('[data-wiz-hide-on-done]', host)) part.hidden = false;
			if (finishedView) finishedView.hidden = true;
			settings.cleared?.();
			shown = sectionsInPlay()[0];
			present(shown, false);
		}

		/** After a branching answer: keep the shown section if it still exists and pop in any new rail entries. */
		function syncBranches() {
			const namesBefore = new Set(
				pickAll('.wiz-steps-label', rail || host).map((label) => label.textContent.trim()),
			);
			const route = sectionsInPlay();
			if (!route.includes(shown)) shown = route[0];
			furthest = Math.min(furthest, route.indexOf(shown));
			present(shown, false);
			redrawRail(route.filter((section) => !namesBefore.has(sectionName(section))));
		}

		/* Once a section has been checked, its marks follow the typing. */
		function recheckShown() {
			if (!attempted.has(shown)) {
				if (anyOrder) redrawRail();
				return;
			}
			const problems = problemsIn(shown);
			markProblems(shown, problems);
			if (problemBox && !problemBox.hidden) renderProblemBox(problemBox, problems, { focus: false });
			if (anyOrder) redrawRail();
		}

		/* The step rail. */

		function railEntryFor(section) {
			if (!railEntries.has(section)) {
				const entry = document.createElement('li');
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'wiz-steps-btn';
				button.addEventListener('click', () => jumpTo(section));
				entry.append(button);
				railEntries.set(section, entry);
			}
			return railEntries.get(section);
		}

		/** Rebuilds the rail's order when it changed and refreshes every entry; justAdded entries pop in. */
		function redrawRail(justAdded) {
			if (!rail) return;
			const route = sectionsInPlay();
			const shownAt = route.indexOf(shown);
			const entries = route.map(railEntryFor);
			const reordered =
				rail.children.length !== entries.length || entries.some((entry, n) => rail.children[n] !== entry);
			if (reordered) rail.replaceChildren(...entries);

			route.forEach((section, n) => paintRailEntry(entries[n], section, n, shownAt, justAdded));
		}

		function paintRailEntry(entry, section, n, shownAt, justAdded) {
			const button = entry.firstChild;
			const problems = anyOrder ? problemsIn(section) : [];
			const complete = anyOrder ? visited.has(section) && !problems.length : n < shownAt;
			const flagged = anyOrder && attempted.has(section) && problems.length > 0;
			const states = {
				'is-current': section === shown,
				'is-done': complete,
				'is-needs': flagged,
				'is-new': Boolean(justAdded?.includes(section)) && !calmMotion,
			};
			entry.className = 'wiz-steps-item';
			for (const [name, on] of Object.entries(states)) {
				if (on) entry.classList.add(name);
			}

			button.disabled = !anyOrder && n > furthest;
			if (section === shown) button.setAttribute('aria-current', 'step');
			else button.removeAttribute('aria-current');

			let marker = String(n + 1);
			let spoken = '';
			if (complete) {
				marker = '<i aria-hidden="true" class="bi bi-check-lg"></i>';
				spoken = 'completed';
			} else if (flagged) {
				marker = '<i aria-hidden="true" class="bi bi-exclamation-lg"></i>';
				spoken = 'needs attention';
			}
			let note = '';
			if (settings.describe) {
				note = settings.describe(section, problems, attempted.has(section), visited.has(section));
				spoken = '';
			}
			const noteHtml = note ? `<span class="wiz-steps-status">${htmlSafe(note)}</span>` : '';
			const spokenHtml = spoken ? `<span class="visually-hidden">, ${spoken}</span>` : '';
			const markup = `<span class="wiz-steps-dot">${marker}</span><span class="wiz-steps-text"><span class="wiz-steps-label">${htmlSafe(sectionName(section))}</span>${noteHtml}</span>${spokenHtml}`;
			if (button.innerHTML !== markup) button.innerHTML = markup;
		}
	}

	/* Checkout: numbered steps with a live order summary beside the form. */
	function setUpCheckout() {
		const host = pick('[data-wiz="checkout"]');
		if (!host) return;

		const FREE_DELIVERY_FROM = 500;
		const quantities = pickAll('[data-co-price]', host);
		const promoInput = pick('#co-promo', host);
		const promoError = pick('#co-promo-error', host);
		const promoApplied = pick('[data-co-promo-ok]', host);
		const cardInput = pick('#co-card', host);
		const expiryInput = pick('#co-exp', host);
		const brandChip = pick('[data-co-brand]', host);
		let discountRate = 0;

		for (const option of pickAll('input[name="co-method"]', host))
			option.addEventListener('change', syncDeliveryChoice);
		for (const quantity of quantities) {
			quantity.addEventListener('change', drawTotals);
			quantity.addEventListener('input', drawTotals);
		}
		pick('#co-same', host).addEventListener('change', (event) => {
			pick('[data-co-billing]', host).hidden = event.target.checked;
		});
		pick('[data-co-apply]', host).addEventListener('click', applyPromo);
		promoInput.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			event.stopPropagation();
			applyPromo();
		});
		cardInput.addEventListener('input', formatCardNumber);
		expiryInput.addEventListener('input', formatExpiry);

		stepFlow(host, {
			verify: {
				bag: () =>
					unitsInBag()
						? []
						: [{ field: quantities[0], text: 'Add at least one item to check out', slotId: 'co-q1-error' }],
				payment: paymentProblems,
			},
			stepChanged: (step) => {
				if (step.key === 'review') writeReview();
			},
			submit: (finish) => {
				const email = pick('#co-email', host).value.trim();
				const pickupNote = "We'll email you when it's ready to collect.";
				const postNote =
					'Every piece arrives in tissue with a care card, and your order leaves within one working day.';
				pick('[data-co-number]', host).textContent = `#${20418 + Math.floor(Math.random() * 60)}`;
				pick('[data-co-done-text]', host).textContent =
					`We've sent the receipt to ${email}. ${deliveryChoice() === 'collect' ? pickupNote : postNote}`;
				finish();
			},
			cleared: () => {
				discountRate = 0;
				promoApplied.hidden = true;
				promoError.hidden = true;
				brandChip.innerHTML = '<i class="bi bi-credit-card"></i>';
				pick('[data-co-billing]', host).hidden = true;
				for (const quantity of quantities) quantity.dispatchEvent(new Event('blur'));
				syncDeliveryChoice();
			},
		});
		drawTotals();

		function deliveryChoice() {
			return chosenValue('co-method', host);
		}

		function unitPrice(quantity) {
			return Number(quantity.getAttribute('data-co-price'));
		}

		function bagSubtotal() {
			return quantities.reduce((sum, quantity) => sum + (Number(quantity.value) || 0) * unitPrice(quantity), 0);
		}

		function unitsInBag() {
			return quantities.reduce((sum, quantity) => sum + (Number(quantity.value) || 0), 0);
		}

		function deliveryFee() {
			const fixed = { express: 24.95, collect: 0 }[deliveryChoice()];
			if (fixed !== undefined) return fixed;
			return bagSubtotal() >= FREE_DELIVERY_FROM ? 0 : 14.95;
		}

		function deliveryNote(subtotal) {
			const choice = deliveryChoice();
			if (choice === 'express') return 'Express orders placed before 2pm leave the same day.';
			if (choice !== 'standard') return 'Collect from our Ames office on Walnut St.';
			const shortfall = FREE_DELIVERY_FROM - subtotal;
			return shortfall > 0
				? `Add ${dollars(shortfall)} more for free standard delivery.`
				: 'Your order ships free.';
		}

		function drawTotals() {
			const subtotal = bagSubtotal();
			const discount = Math.round(subtotal * discountRate * 100) / 100;
			const fee = deliveryFee();

			for (const row of pickAll('.wiz-bag-item', host)) {
				const quantity = pick('[data-co-price]', row);
				pick('[data-co-line]', row).textContent = dollars((Number(quantity.value) || 0) * unitPrice(quantity));
				row.classList.toggle('is-zero', !Number(quantity.value));
			}

			const receiptLines = quantities
				.filter((quantity) => Number(quantity.value))
				.map((quantity) => {
					const label = `${quantity.value} × ${htmlSafe(quantity.getAttribute('data-co-name'))}`;
					return `<li><span>${label}</span><span>${dollars(Number(quantity.value) * unitPrice(quantity))}</span></li>`;
				});
			pick('[data-co-items]', host).innerHTML =
				receiptLines.join('') || '<li class="wiz-receipt-empty">Your bag is empty</li>';

			pick('[data-co-sub]', host).textContent = dollars(subtotal);
			pick('[data-co-disc-row]', host).hidden = !discount;
			pick('[data-co-disc]', host).textContent = `-${dollars(discount)}`;
			pick('[data-co-ship]', host).textContent = fee ? dollars(fee) : 'Free';
			pick('[data-co-total]', host).textContent = dollars(subtotal - discount + fee);
			pick('[data-co-free-note]', host).textContent = deliveryNote(subtotal);
			pick('[data-co-standard-hint]', host).textContent =
				subtotal >= FREE_DELIVERY_FROM ? 'Free, 3 to 5 days' : '$14.95, 3 to 5 days';
		}

		function syncDeliveryChoice() {
			const collecting = deliveryChoice() === 'collect';
			pick('[data-co-address]', host).hidden = collecting;
			pick('[data-co-collect-note]', host).hidden = !collecting;
			drawTotals();
		}

		function writeReview() {
			const units = unitsInBag();
			const totalText = pick('[data-co-total]', host).textContent.trim();
			pick('[data-co-rev="bag"]', host).textContent =
				`${units} ${units === 1 ? 'item' : 'items'}, ${totalText} in total`;

			const addressParts = [pick('#co-street', host).value.trim(), pick('#co-city', host).value.trim()];
			const choice = deliveryChoice();
			pick('[data-co-rev="delivery"]', host).textContent =
				choice === 'collect'
					? `Collect from the Ames office, for ${pick('#co-name', host).value.trim()}`
					: `${choice === 'express' ? 'Express' : 'Standard'} to ${addressParts.filter(Boolean).join(', ')}`;

			const cardDigits = digitsOf(cardInput.value);
			pick('[data-co-rev="payment"]', host).textContent =
				`${cardBrand(cardDigits) || 'Card'} ending ${cardDigits.slice(-4)}, expires ${expiryInput.value}`;
		}

		function applyPromo() {
			const code = promoInput.value.trim().toUpperCase();
			promoError.hidden = true;
			promoApplied.hidden = true;
			promoInput.classList.remove('is-invalid');
			promoInput.removeAttribute('aria-invalid');
			discountRate = code === 'INSIDERS' ? 0.1 : 0;

			if (code === 'INSIDERS') {
				promoApplied.hidden = false;
				pick('span', promoApplied).textContent = 'INSIDERS applied, 10% off';
			} else if (code) {
				promoInput.classList.add('is-invalid');
				promoInput.setAttribute('aria-invalid', 'true');
				promoError.hidden = false;
				promoError.textContent = `We don't recognize ${code}. Check the spelling or try another code.`;
			}
			drawTotals();
		}

		/* The card number groups itself in fours and names its brand. */
		function formatCardNumber() {
			const cardDigits = digitsOf(cardInput.value).slice(0, 19);
			const caretAtEnd = cardInput.selectionStart === cardInput.value.length;
			cardInput.value = cardDigits.replace(/(\d{4})(?=\d)/g, '$1 ');
			if (caretAtEnd) cardInput.selectionStart = cardInput.selectionEnd = cardInput.value.length;
			const brand = cardBrand(cardDigits);
			brandChip.innerHTML = brand ? `<span>${brand}</span>` : '<i class="bi bi-credit-card"></i>';
			brandChip.classList.toggle('is-known', Boolean(brand));
		}

		/* MM/YY gains its slash on the way in, but not while deleting back over it. */
		function formatExpiry(event) {
			let typed = digitsOf(expiryInput.value).slice(0, 4);
			const addSlash = typed.length >= 3 || (typed.length === 2 && event.inputType !== 'deleteContentBackward');
			if (addSlash) typed = `${typed.slice(0, 2)}/${typed.slice(2)}`;
			expiryInput.value = typed;
		}

		function paymentProblems() {
			const found = [];
			const cardDigits = digitsOf(cardInput.value);
			if (cardDigits && !passesLuhn(cardDigits)) {
				found.push({
					field: cardInput,
					text: "That card number doesn't look right. Check it against the card",
				});
			}

			const expiry = expiryInput.value;
			const parts = expiry.match(/^(\d{2})\/(\d{2})$/);
			if (!parts) {
				if (expiry) found.push({ field: expiryInput, text: 'Enter the expiry date as MM/YY' });
				return found;
			}
			const month = Number(parts[1]);
			if (month < 1 || month > 12) {
				found.push({ field: expiryInput, text: 'The month must be between 01 and 12' });
			} else if (new Date(2000 + Number(parts[2]), month, 1) <= new Date()) {
				found.push({ field: expiryInput, text: 'This card has expired' });
			}
			return found;
		}
	}

	function digitsOf(text) {
		return text.replace(/\D/g, '');
	}

	function cardBrand(cardDigits) {
		const prefixes = [
			[/^4/, 'Visa'],
			[/^(5[1-5]|2[2-7])/, 'Mastercard'],
			[/^3[47]/, 'Amex'],
		];
		return prefixes.find(([pattern]) => pattern.test(cardDigits))?.[1] ?? '';
	}

	/** The Luhn checksum, and at least 13 digits. */
	function passesLuhn(cardDigits) {
		const sum = [...cardDigits].reverse().reduce((total, digit, place) => {
			const weighted = Number(digit) * (place % 2 ? 2 : 1);
			return total + (weighted > 9 ? weighted - 9 : weighted);
		}, 0);
		return cardDigits.length >= 13 && sum % 10 === 0;
	}

	/* Maintenance plan: the garden and windows steps come and go with the first answer. */
	function setUpPlanBuilder() {
		const host = pick('[data-wiz="maintenance"]');
		if (!host) return;

		const RATE_PER_HOME = { heating: 89, cooling: 79, both: 99 };
		const COVERAGE = { heating: 'Garden', cooling: 'Windows', both: 'Garden and windows' };
		const homesInput = pick('#sb-units-count', host);

		const flow = stepFlow(host, {
			include: (key) => coverage() === key || coverage() === 'both',
			verify: {
				cooling: () =>
					windowTypes().length
						? []
						: [
								{
									field: pick('#sb-unit-central', host),
									text: 'Check at least one type of window',
									slotId: 'sb-units-error',
								},
							],
			},
			stepChanged: drawPlan,
			submit: (finish) => {
				const monthly = visitPrice() / monthsBetweenVisits();
				pick('[data-sb-done]', host).textContent =
					`The first visit is booked for ${longDay(firstVisit())}. That works out at about ${dollars(monthly)} a month, and the customer can move a visit from the customer portal.`;
				finish();
			},
			cleared: drawPlan,
		});

		for (const option of pickAll('input[name="sb-system"]', host)) {
			option.addEventListener('change', () => {
				flow.syncBranches();
				drawPlan();
			});
		}
		host.addEventListener('change', drawPlan);
		drawPlan();

		function coverage() {
			return chosenValue('sb-system', host);
		}

		function visitPrice() {
			return (Number(homesInput.value) || 1) * RATE_PER_HOME[coverage()];
		}

		function monthsBetweenVisits() {
			return Number(chosenValue('sb-every', host));
		}

		function windowTypes() {
			return pickAll('input[name="sb-unit"]:checked', host).map((box) => box.value);
		}

		/** The next Tuesday after today. */
		function firstVisit() {
			const day = new Date();
			day.setDate(day.getDate() + ((2 - day.getDay() + 7) % 7 || 7));
			return day;
		}

		function drawPlan() {
			const perVisit = visitPrice();
			const covered = coverage();
			const months = monthsBetweenVisits();
			const homes = homesInput.value;
			pick('[data-sb-price]', host).textContent = `${dollars(perVisit)} a visit`;

			const facts = [['Covers', COVERAGE[covered]]];
			if (covered !== 'cooling') facts.push(['Garden', chosenValue('sb-heat', host)]);
			if (covered !== 'heating') {
				facts.push([
					'Windows',
					`${windowTypes().join(', ') || 'None picked'}, water: ${chosenValue('sb-filters', host).toLowerCase()}`,
				]);
			}
			const rhythm = months === 12 ? 'one visit a year' : `a visit every ${months} months`;
			facts.push(['Homes', `${homes} ${Number(homes) === 1 ? 'home' : 'homes'}, ${rhythm}`]);
			facts.push(['First visit', longDay(firstVisit())]);
			facts.push(['Per visit', `${dollars(perVisit)}, supplies extra`]);
			pick('[data-sb-review]', host).innerHTML = facts
				.map(([term, detail]) => `<div><dt>${term}</dt><dd>${htmlSafe(detail)}</dd></div>`)
				.join('');
		}
	}

	/* Sponsored seat: a progress ring stands in for the step list. */
	function setUpSeatInvite() {
		const host = pick('[data-wiz="gift"]');
		if (!host) return;

		const PLAN_LENGTHS = { 3: '3 months', 6: '6 months', 12: '12 months' };
		const ring = pick('[data-gf-ring]', host);
		const noteInput = pick('#gf-msg', host);
		const dateInput = pick('#gf-date', host);

		dateInput.min = tomorrowIso();
		noteInput.addEventListener('input', showCharactersLeft);
		for (const option of pickAll('input[name="gf-when"]', host)) option.addEventListener('change', syncDatePicker);

		stepFlow(host, {
			verify: {
				note: () => {
					const scheduled = !pick('[data-gf-date-wrap]', host).hidden;
					return scheduled && dateInput.value && dateInput.value < tomorrowIso()
						? [{ field: dateInput, text: 'Choose a date from tomorrow on' }]
						: [];
				},
			},
			stepChanged: (step) => {
				const position = step.offset + 1;
				ring.style.setProperty('--value', Math.round((position / step.count) * 100));
				ring.setAttribute('aria-label', `Step ${position} of ${step.count}`);
				pick('[data-gf-ring-value]', host).textContent = `${position}/${step.count}`;
				pick('[data-gf-step]', host).textContent = step.label;
				pick('[data-gf-next]', host).textContent = step.upcoming ? `Next: ${step.upcoming}` : 'Last step';
				if (step.key === 'check') drawPreview();
			},
			submit: (finish) => {
				const recipient = pick('#gf-name', host).value.trim();
				const address = pick('#gf-email', host).value.trim();
				pick('[data-gf-done]', host).textContent =
					`${arrivalText().replace('Arrives', 'It arrives')} for ${recipient} at ${address}. We've sent your receipt too.`;
				finish();
			},
			cleared: () => {
				showCharactersLeft();
				syncDatePicker();
			},
		});
		showCharactersLeft();

		function tomorrowIso() {
			const day = new Date();
			day.setDate(day.getDate() + 1);
			return day.toISOString().slice(0, 10);
		}

		function showCharactersLeft() {
			pick('[data-gf-count]', host).textContent = `${160 - noteInput.value.length} characters left`;
		}

		function syncDatePicker() {
			pick('[data-gf-date-wrap]', host).hidden = chosenValue('gf-when', host) !== 'later';
		}

		function arrivalText() {
			if (chosenValue('gf-when', host) !== 'later' || !dateInput.value) return 'Arrives by email today';
			return `Arrives by email on ${longDay(new Date(`${dateInput.value}T12:00`))}`;
		}

		function drawPreview() {
			const note = noteInput.value.trim();
			pick('[data-gf-pv-name]', host).textContent = pick('#gf-name', host).value.trim() || 'them';
			pick('[data-gf-pv-plan]', host).textContent =
				`${PLAN_LENGTHS[chosenValue('gf-plan', host)]} of a Fieldline Basic seat`;
			pick('[data-gf-pv-msg]', host).textContent = note ? `"${note}"` : 'No message';
			pick('[data-gf-pv-when]', host).textContent = arrivalText();
		}
	}

	/* Stockist application: a side rail, sections in any order and a draft kept in this browser. */
	function setUpStockistForm() {
		const host = pick('[data-wiz="fleet"]');
		if (!host) return;

		const DRAFT_KEY = 'basalt-wizard-fleet';
		const ACCEPTED_FILE = /\.(pdf|jpe?g|png)$/i;
		const MEGABYTE = 1048576;
		/* Price tiers by pieces in the first order, smallest first. */
		const TIERS = [
			{ from: 5, name: 'Tier 1', terms: '5 to 19 pieces, list price' },
			{ from: 20, name: 'Tier 2', terms: '20 to 49 pieces, 12% off list price' },
			{ from: 50, name: 'Tier 3', terms: '50 to 99 pieces, 18% off list price' },
			{ from: 100, name: 'Tier 4', terms: '100 pieces or more, 22% off and free delivery' },
		];
		const piecesInput = pick('#ws-techs', host);
		const filePicker = pick('#ws-files', host);
		const fileRows = pick('[data-ws-files]', host);
		const dropArea = pick('[data-ws-drop]', host);
		const savedNote = pick('[data-ws-saved]', host);
		const draftBanner = pick('[data-ws-draft]', host);
		let attachments = [];

		piecesInput.addEventListener('change', showTier);
		filePicker.addEventListener('change', () => {
			if (!filePicker.files.length) return;
			addAttachments(filePicker.files);
			filePicker.value = '';
		});
		fileRows.addEventListener('click', removeAttachment);
		for (const type of ['dragenter', 'dragover']) {
			dropArea.addEventListener(type, (event) => {
				event.preventDefault();
				dropArea.classList.add('is-over');
			});
		}
		for (const type of ['dragleave', 'drop']) {
			dropArea.addEventListener(type, (event) => {
				event.preventDefault();
				dropArea.classList.remove('is-over');
			});
		}
		dropArea.addEventListener('drop', (event) => {
			if (event.dataTransfer?.files.length) addAttachments(event.dataTransfer.files);
		});
		pick('[data-ws-save-draft]', host).addEventListener('click', saveDraft);

		const flow = stepFlow(host, {
			anyOrder: true,
			describe: (section, problems, attempted, visited) => {
				if (!problems.length) return visited || attempted ? 'Done' : 'Nothing required';
				if (attempted) return 'Needs attention';
				return visited ? 'In progress' : 'Not started';
			},
			verify: {
				location: () =>
					pickAll('input[name="ws-day"]:checked', host).length
						? []
						: [
								{
									field: pick('#ws-day-mon', host),
									text: 'Pick at least one day someone can sign for it',
									slotId: 'ws-days-error',
								},
							],
				documents: () =>
					attachments.length
						? []
						: [{ field: filePicker, text: 'Add at least one document that shows the business is trading' }],
			},
			submit: (finish) => {
				forgetDraft();
				draftBanner.hidden = true;
				const contact = pick('#ws-contact', host).value.trim();
				const business = pick('#ws-name', host).value.trim();
				pick('[data-ws-done]', host).textContent =
					`Thanks, ${contact}. Our wholesale team will call ${business} within two working days, and your samples go out with the first order.`;
				finish();
			},
			cleared: () => {
				attachments = [];
				drawAttachments();
				savedNote.textContent = '';
				sampleTags().basaltTags?.set(['Sculpted Shoulder Blazer']);
				piecesInput.dispatchEvent(new Event('blur'));
				showTier();
			},
		});

		const draft = loadDraft();
		if (draft) {
			applyDraft(draft);
			draftBanner.hidden = false;
			pick('[data-ws-draft-text]', host).textContent =
				`We kept your draft from ${clockTime(draft.at)}. Files need adding again.`;
			flow.redrawRail();
		}
		pick('[data-ws-discard]', host).addEventListener('click', () => {
			forgetDraft();
			draftBanner.hidden = true;
			flow.startOver();
			pick('#ws-name', host).focus();
		});
		showTier();

		function sampleTags() {
			return pick('.basalt-tags', host);
		}

		function showTier() {
			const pieces = Number(piecesInput.value);
			const tier = TIERS.findLast((band) => pieces >= band.from);
			pick('.wiz-tier-name', host).textContent = `${tier.name} pricing`;
			pick('.wiz-tier-text', host).textContent = tier.terms;
		}

		/* Attachments: picked or dropped, then checked for type and size. */

		function readableSize(bytes) {
			return bytes > MEGABYTE
				? `${(bytes / MEGABYTE).toFixed(1)} MB`
				: `${Math.max(1, Math.round(bytes / 1024))} KB`;
		}

		function addAttachments(fileList) {
			const refused = [];
			for (const file of fileList) {
				if (!ACCEPTED_FILE.test(file.name)) refused.push(`${file.name} is not a PDF, JPG or PNG`);
				else if (file.size > 5 * MEGABYTE) refused.push(`${file.name} is over 5 MB`);
				else if (!attachments.some((kept) => kept.name === file.name)) attachments.push(file);
			}
			drawAttachments();

			/* Refused files get their own line, separate from the "add one" check. */
			const refusedNote = pick('#ws-files-bad', host);
			refusedNote.hidden = !refused.length;
			refusedNote.textContent = refused.length ? `${refused.join('. ')}.` : '';
			filePicker.dispatchEvent(new Event('input', { bubbles: true }));
		}

		function removeAttachment(event) {
			const button = event.target.closest('[data-ws-remove]');
			if (!button) return;
			attachments.splice(Number(button.getAttribute('data-ws-remove')), 1);
			drawAttachments();
			filePicker.dispatchEvent(new Event('input', { bubbles: true }));
			filePicker.focus();
		}

		function drawAttachments() {
			fileRows.innerHTML = attachments
				.map((file, n) => {
					const icon = /\.pdf$/i.test(file.name) ? 'bi-file-earmark-pdf' : 'bi-file-earmark-image';
					const name = htmlSafe(file.name);
					return `<li class="wiz-files-item"><i aria-hidden="true" class="bi ${icon}"></i><span class="wiz-files-name">${name}</span><span class="wiz-files-size">${readableSize(file.size)}</span><button data-ws-remove="${n}" type="button" class="btn btn-sm btn-outline-secondary">Remove<span class="visually-hidden"> ${name}</span></button></li>`;
				})
				.join('');
		}

		/* The draft holds the text and choice fields; attachments are not stored. */

		function draftFields() {
			return pickAll('[data-ws-save]', host);
		}

		function isToggle(field) {
			return field.type === 'checkbox' || field.type === 'radio';
		}

		function captureDraft() {
			const snapshot = {};
			for (const field of draftFields()) {
				if (isToggle(field)) snapshot[`${field.name}:${field.value}`] = field.checked;
				else snapshot[field.id] = field.value;
			}
			snapshot.trials = sampleTags().basaltTags?.get() ?? [];
			snapshot.at = Date.now();
			return snapshot;
		}

		function applyDraft(snapshot) {
			for (const field of draftFields()) {
				const toggleKey = `${field.name}:${field.value}`;
				if (isToggle(field)) {
					if (toggleKey in snapshot) field.checked = snapshot[toggleKey];
				} else if (field.id in snapshot) {
					field.value = snapshot[field.id];
				}
			}
			const tagField = sampleTags();
			if (tagField.basaltTags && snapshot.trials) tagField.basaltTags.set(snapshot.trials);
			piecesInput.dispatchEvent(new Event('blur'));
			showTier();
		}

		function clockTime(stamp) {
			return new Date(stamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
		}

		function saveDraft() {
			const snapshot = captureDraft();
			let stored = true;
			try {
				localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
			} catch {
				stored = false;
			}
			savedNote.textContent = stored
				? `Draft saved at ${clockTime(snapshot.at)}. Files need adding again next time.`
				: "This browser won't let us save a draft.";
		}

		function loadDraft() {
			try {
				return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
			} catch {
				return null;
			}
		}

		function forgetDraft() {
			try {
				localStorage.removeItem(DRAFT_KEY);
			} catch {
				/* Storage is blocked in this browser; there is nothing to forget. */
			}
		}
	}

	/* Plan finder: one lettered question per screen, ending in a recommendation. */
	function setUpPlanFinder() {
		const host = pick('[data-wiz="quiz"]');
		if (!host) return;

		const PLANS = {
			schedule: {
				title: 'Pro plan',
				reason: 'A drag-and-drop schedule board, live staff locations and SMS reminders, at $32 a seat a month.',
				perks: ['Schedule board', 'SMS reminders', 'Repeat visit plans'],
			},
			invoices: {
				title: 'Basic plan',
				reason: 'Estimates, invoices and card payments on site, at $15 a seat a month. Add seats as you hire.',
				perks: ['Estimates and invoices', 'Card payments', 'Visit checklists'],
			},
			travel: {
				title: 'Pro plan with Travel Planner',
				reason: 'Pro at $32 a seat, plus Travel Planner at $6 a seat to cut the drive between visits.',
				perks: ['Travel Planner', 'Territories', 'Live staff locations'],
			},
		};
		const TEAM_FIT = {
			solo: 'Fits a one-seat account',
			small: 'Sized for 2 to 10 seats',
			mid: 'Sized for 11 to 50 seats',
			large: 'Over 50 seats? Ask about Max',
		};
		const trialButton = pick('[data-qz-add]', host);

		stepFlow(host, {
			stepChanged: (step) => {
				pick('[data-qz-count]', host).textContent = `Question ${step.offset + 1} of ${step.count}`;
				pick('[data-qz-bar]', host).style.width = `${((step.offset + 1) / step.count) * 100}%`;
			},
			submit: (finish) => {
				const plan = PLANS[recommendation()];
				const perks = [...plan.perks.map(htmlSafe), htmlSafe(TEAM_FIT[chosenValue('qz-team', host)])];
				pick('[data-qz-name]', host).textContent = plan.title;
				pick('[data-qz-why]', host).textContent = plan.reason;
				pick('[data-qz-facts]', host).innerHTML = perks.map((perk) => `<li>${perk}</li>`).join('');
				trialButton.innerHTML = '<i aria-hidden="true" class="bi bi-rocket-takeoff"></i> Start a free trial';
				trialButton.disabled = false;
				finish();
			},
		});

		trialButton.addEventListener('click', () => {
			trialButton.innerHTML = '<i aria-hidden="true" class="bi bi-check2"></i> Trial started';
			pick('[data-wiz-live]', host).textContent =
				`14-day trial of the ${pick('[data-qz-name]', host).textContent} started`;
		});
		host.addEventListener('keydown', answerFromKeyboard);

		/* Mostly online bookings means a busy schedule, and Basic has no schedule board. */
		function recommendation() {
			const pain = chosenValue('qz-pain', host);
			return pain === 'invoices' && chosenValue('qz-booking', host) === 'most' ? 'schedule' : pain;
		}

		/** A to D choose an answer on the open question; Enter on an answer moves on. */
		function answerFromKeyboard(event) {
			if (event.key === 'Enter' && event.target.matches('input[type="radio"]')) {
				event.preventDefault();
				pick('[data-wiz-form]', host).requestSubmit();
				return;
			}
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			if (event.target.matches('input[type="text"], textarea')) return;
			const letter = 'abcd'.indexOf(event.key.toLowerCase());
			if (letter < 0) return;
			const openQuestion = pickAll('[data-wiz-panel]', host).find((section) => !section.hidden);
			const answer = openQuestion ? pickAll('input[type="radio"]', openQuestion)[letter] : undefined;
			if (!answer || pick('[data-wiz-done]:not([hidden])', host)) return;
			event.preventDefault();
			answer.checked = true;
			answer.focus();
			answer.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}

	/* Shipping zone: a segmented bar, and the form clears itself after each save. */
	function setUpZoneForm() {
		const host = pick('[data-wiz="zone"]');
		if (!host) return;

		const countryTags = pick('.basalt-tags', host);
		const quickest = pick('#sz-min', host);
		const slowest = pick('#sz-max', host);
		const freeSwitch = pick('#sz-free', host);
		const segments = pickAll('[data-sz-segments] span', host);

		freeSwitch.addEventListener('change', () => {
			pick('[data-sz-free-wrap]', host).hidden = !freeSwitch.checked;
		});

		const flow = stepFlow(host, {
			verify: {
				where: () =>
					countries().length ? [] : [{ field: pick('#sz-countries', host), text: 'Add at least one state' }],
				time: () =>
					Number(slowest.value) < Number(quickest.value)
						? [{ field: slowest, text: "The longest time can't be shorter than the quickest" }]
						: [],
			},
			stepChanged: (step) => {
				pick('[data-sz-count]', host).textContent = `Step ${step.offset + 1} of ${step.count}`;
				pick('[data-sz-label]', host).textContent = step.label;
				segments.forEach((segment, n) => segment.classList.toggle('is-on', n <= step.offset));
				if (step.key === 'confirm') drawSummary();
			},
			submit: (finish) => {
				finish();
				const zoneName = pick('#sz-name', host).value.trim();
				addSavedZone(zoneName);
				flow.startOver();
				pick('[data-wiz-live]', host).textContent =
					`${zoneName} zone saved. The form is ready for another zone.`;
				pick('#sz-name', host).focus();
			},
			cleared: () => {
				countryTags.basaltTags?.set([]);
				pick('[data-sz-free-wrap]', host).hidden = true;
				for (const stepper of [quickest, slowest]) stepper.dispatchEvent(new Event('blur'));
			},
		});

		function countries() {
			return countryTags.basaltTags?.get() ?? [];
		}

		function price(raw) {
			return dollars(parseFloat(raw) || 0);
		}

		function rateText(joiner) {
			const base = price(pick('#sz-rate', host).value);
			return freeSwitch.checked ? `${base}${joiner}free over ${price(pick('#sz-over', host).value)}` : base;
		}

		function dayRange(unit) {
			return quickest.value === slowest.value
				? `${quickest.value} ${unit}`
				: `${quickest.value} to ${slowest.value} ${unit}`;
		}

		function drawSummary() {
			const facts = [
				['Zone', pick('#sz-name', host).value.trim()],
				['States', countries().join(', ')],
				['Rate', rateText(', ')],
				['Delivery', dayRange('working days')],
			];
			pick('[data-sz-review]', host).innerHTML = facts
				.map(([term, detail]) => `<div><dt>${term}</dt><dd>${htmlSafe(detail)}</dd></div>`)
				.join('');
		}

		function addSavedZone(zoneName) {
			const row = document.createElement('li');
			row.className = 'wiz-zones-item is-new';
			row.innerHTML = `<span class="wiz-zones-name">${htmlSafe(zoneName)}</span><span class="wiz-zones-meta">${htmlSafe(`${rateText(' · ')} · ${dayRange('days')}`)}</span>`;
			pick('[data-sz-list]', host.closest('.card-body')).appendChild(row);
		}
	}

	/* Return request: a short flow inside a modal that writes its result back to the order card. */
	function setUpReturnDialog() {
		const host = pick('[data-wiz="return"]');
		if (!host) return;

		const ITEMS = {
			shades: { name: 'Shield Sunglasses', price: 520 },
			trench: { name: 'Leather Trench Coat', price: 3200 },
			oxfords: { name: 'Two-Tone Oxfords', price: 850 },
		};
		const dialog = document.getElementById('rt-modal');
		const reasonSelect = pick('#rt-reason', host);
		const detailsInput = pick('#rt-more', host);
		const itemBoxes = pickAll('.wiz-pick input[type="checkbox"]', host);
		const shadesBox = itemBoxes[0];
		const pairsInput = pick('#rt-i1-qty', host);

		reasonSelect.addEventListener('change', () => {
			const needsDetail = reasonSelect.value === 'other';
			detailsInput.required = needsDetail;
			pick('[data-rt-more-opt]', host).hidden = needsDetail;
		});
		shadesBox.addEventListener('change', syncPairCount);
		host.addEventListener('change', drawRefundNote);

		const flow = stepFlow(host, {
			verify: {
				items: () =>
					itemBoxes.some((box) => box.checked)
						? []
						: [{ field: shadesBox, text: 'Check at least one item to return', slotId: 'rt-items-error' }],
			},
			stepChanged: (step) => {
				pick('[data-rt-count]', host).textContent = `Step ${step.offset + 1} of ${step.count}`;
				pick('[data-rt-label]', host).textContent = step.label;
				pick('[data-rt-bar]', host).style.width = `${((step.offset + 1) / step.count) * 100}%`;
				if (step.key === 'refund') drawRefundNote();
			},
			submit: (finish) => {
				finish();
				markOrderCard();
				window.bootstrap?.Modal.getInstance(dialog)?.hide();
			},
			cleared: () => {
				detailsInput.required = false;
				pick('[data-rt-more-opt]', host).hidden = false;
				pairsInput.dispatchEvent(new Event('blur'));
				syncPairCount();
			},
		});

		dialog.addEventListener('show.bs.modal', () => flow.startOver());
		dialog.addEventListener('shown.bs.modal', () => pick('#rt-items-title', host)?.focus());
		syncPairCount();

		function returning() {
			return itemBoxes.filter((box) => box.checked).map((box) => box.value);
		}

		function refundAmount() {
			return returning().reduce(
				(sum, key) => sum + ITEMS[key].price * (key === 'shades' ? Number(pairsInput.value) : 1),
				0,
			);
		}

		function asCredit() {
			return chosenValue('rt-refund', host) === 'credit';
		}

		function drawRefundNote() {
			const amount = refundAmount();
			pick('[data-rt-refund-note]', host).textContent = asCredit()
				? `You get ${dollars(amount * 1.1)} to spend in the shop as soon as we scan the parcel.`
				: `We refund ${dollars(amount)} to your card within 5 days of the parcel reaching us.`;
		}

		/* The pair count only matters once the sunglasses are checked. */
		function syncPairCount() {
			const stepper = pick('.wiz-pick .basalt-stepper', host);
			for (const control of pickAll('button, input', stepper)) control.disabled = !shadesBox.checked;
			if (shadesBox.checked) pairsInput.dispatchEvent(new Event('blur'));
		}

		function markOrderCard() {
			const keys = returning();
			const card = pick('[data-wiz-kind="dialog"]');
			for (const key of keys) pick(`[data-rt-flag="${key}"]`, card).hidden = false;

			const status = pick('[data-rt-status]', card);
			status.className = 'basalt-status basalt-status-warning basalt-status-dot';
			status.textContent = 'Return open';

			const reference = `RMA-${5521 + Math.floor(Math.random() * 40)}`;
			const items = keys.map((key) => ITEMS[key].name).join(', ');
			const money = asCredit()
				? `Store credit of ${dollars(refundAmount() * 1.1)}`
				: `Refund of ${dollars(refundAmount())} to your card`;
			pick('[data-rt-note]', card).textContent =
				`${reference}: ${items}. ${money} once it reaches us. The label is in your inbox.`;
		}
	}

	/* Product listing: tabbed sections filled in any order, with a readiness meter. */
	function setUpListingTabs() {
		const host = pick('[data-wiz-product]');
		if (!host) return;

		const tabs = pickAll('[role="tab"]', host);
		const tabPanels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
		const form = pick('[data-pr-form]', host);
		const problemBox = pick('[data-pr-errors]', host);
		const featureTags = pick('#pr-story .basalt-tags', host);
		const descriptionInput = pick('#pr-desc', host);
		const segments = pickAll('[data-pr-segments] span', host);
		const stateTag = pick('[data-pr-status]', host);
		const savedNote = pick('[data-pr-saved]', host);
		const PANEL_CHECKS = {
			'pr-story': () =>
				featureTags.basaltTags?.get().length
					? []
					: [{ field: pick('#pr-notes', host), text: 'Add at least one key feature' }],
			'pr-pricing': () => {
				const { price, cost } = priceAndCost();
				return price && cost && price <= cost
					? [{ field: pick('#pr-price', host), text: 'The price is below what a unit costs you' }]
					: [];
			},
		};
		const KEY_TARGETS = {
			ArrowRight: (n) => (n + 1) % tabs.length,
			ArrowLeft: (n) => (n - 1 + tabs.length) % tabs.length,
			Home: () => 0,
			End: () => tabs.length - 1,
		};
		let submitted = false;

		tabs.forEach((tab, n) => {
			tab.addEventListener('click', () => selectTab(tab, false));
			tab.addEventListener('keydown', (event) => {
				const target = KEY_TARGETS[event.key];
				if (!target) return;
				event.preventDefault();
				selectTab(tabs[target(n)], true);
			});
		});
		form.addEventListener('input', handleEdit);
		form.addEventListener('change', handleEdit);
		form.addEventListener('submit', publish);
		drawReadiness();

		function priceAndCost() {
			return { price: parseFloat(pick('#pr-price', host).value), cost: parseFloat(pick('#pr-cost', host).value) };
		}

		/** Hidden panels still count, so each is checked with its hidden flag lifted. */
		function problemsIn(panel) {
			const wasHidden = panel.hidden;
			panel.hidden = false;
			const problems = findProblems(panel, PANEL_CHECKS[panel.id]);
			panel.hidden = wasHidden;
			return problems;
		}

		function selectTab(chosen, moveFocus) {
			tabs.forEach((tab, n) => {
				const selected = tab === chosen;
				tab.setAttribute('aria-selected', String(selected));
				tab.tabIndex = selected ? 0 : -1;
				tabPanels[n].hidden = !selected;
			});
			if (moveFocus) chosen.focus();
		}

		/** Ticks off finished tabs, fills the meter and the margin line; returns how many sections pass. */
		function drawReadiness() {
			let readyCount = 0;
			tabPanels.forEach((panel, n) => {
				const ready = !problemsIn(panel).length;
				if (ready) readyCount += 1;
				tabs[n].classList.toggle('is-ready', ready);
				pick('[data-pr-icon]', tabs[n]).className = `bi ${ready ? 'bi-check-circle-fill' : 'bi-circle'}`;
				pick('[data-pr-state]', tabs[n]).textContent = ready ? ', ready' : ', not ready';
			});
			segments.forEach((segment, n) => segment.classList.toggle('is-on', n < readyCount));
			pick('[data-pr-count]', host).textContent = `${readyCount} of ${tabPanels.length} sections ready`;

			const { price, cost } = priceAndCost();
			pick('[data-pr-margin]', host).innerHTML =
				price > 0 && cost >= 0
					? `Margin <strong>${dollars(price - cost)}</strong> a unit, ${Math.round(((price - cost) / price) * 100)}% of the price.`
					: 'Add a price to see your margin.';

			const missing = 40 - descriptionInput.value.trim().length;
			pick('[data-pr-desc-count]', host).textContent =
				missing > 0
					? `${missing} more characters needed`
					: `${descriptionInput.value.length} of 400 characters`;
			return readyCount;
		}

		/** Every problem across the tabs, each labeled with its tab and able to open it. */
		function everyProblem() {
			return tabPanels.flatMap((panel, n) =>
				problemsIn(panel).map((problem) =>
					Object.assign(problem, {
						where: panel.getAttribute('data-pr-section'),
						reveal: () => selectTab(tabs[n], false),
					}),
				),
			);
		}

		function markEveryPanel() {
			for (const panel of tabPanels) markProblems(panel, problemsIn(panel));
		}

		function handleEdit() {
			drawReadiness();
			if (stateTag.textContent.trim() === 'Live') {
				stateTag.className = 'basalt-status basalt-status-warning basalt-status-dot';
				stateTag.textContent = 'Unpublished changes';
			}
			savedNote.textContent = 'Saved as a draft';
			if (!submitted) return;
			markEveryPanel();
			renderProblemBox(problemBox, everyProblem(), { focus: false });
		}

		function publish(event) {
			event.preventDefault();
			submitted = true;
			const problems = everyProblem();
			markEveryPanel();
			if (problems.length) {
				renderProblemBox(problemBox, problems, { suffix: 'before publishing' });
				return;
			}
			renderProblemBox(problemBox, [], { focus: false });
			stateTag.className = 'basalt-status basalt-status-success basalt-status-dot';
			stateTag.textContent = 'Live';
			savedNote.textContent = `${pick('#pr-name', host).value.trim()} is live in the store`;
		}
	}

	/* Layout chips: show one kind of card, and let a lone half-width card span the row. */
	function wireLayoutChips(showcase) {
		const grid = pick('[data-wiz-grid]', showcase);
		const cards = pickAll('.wiz-card', grid);
		const tally = pick('[data-wiz-count]', showcase);
		const chips = pickAll('[data-wiz-filter]', showcase);

		for (const chip of chips) chip.addEventListener('click', () => press(chip));

		function press(pressed) {
			for (const chip of chips) chip.setAttribute('aria-pressed', String(chip === pressed));
			showKind(pressed.getAttribute('data-wiz-filter'));
		}

		function showKind(kind) {
			const everything = kind === 'all';
			const visible = cards.filter((card) => everything || card.getAttribute('data-wiz-kind') === kind);
			for (const card of cards) {
				card.classList.toggle('is-hidden', !visible.includes(card));
				card.classList.remove('is-alone');
			}

			grid.classList.toggle('is-filtered', !everything);
			if (!everything) {
				const halfWidth = visible.filter((card) => !card.classList.contains('wiz-card-full'));
				if (halfWidth.length % 2) halfWidth.at(-1).classList.add('is-alone');
			}
			tally.textContent = `${visible.length} ${visible.length === 1 ? 'wizard' : 'wizards'}`;
		}
	}
})();
