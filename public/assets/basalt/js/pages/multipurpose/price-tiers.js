/**
 * Runs the pricing page (price-tiers.html). The visitor describes the team in a
 * sentence; from that one description the script prices every tier, rings
 * the cheapest tier that covers it, itemizes a monthly bill and a year of
 * costs, trims the comparison table and drives the trial, sales and demo
 * dialogs. Only the comparison table carries prices in markup. Yearly
 * rates are written out in whole dollars, each a fifth under its monthly rate.
 */
(() => {
	'use strict';

	const page = pick('[data-pricing]', document);
	if (!page) return;

	/* The catalog. A tier's terms say, per feature, whether it is part of
     the tier ('yes'), sold on top of it ('addon') or not offered ('no'). */
	const FRESHNESS = { 1: 'once a day', 2: 'every hour', 3: 'every 15 minutes', 4: 'on demand' };

	const TIERS = [
		{
			slug: 'free',
			label: 'Free',
			seatCap: 3,
			sourceCap: 1,
			freshness: 1,
			rates: { monthly: 0, yearly: 0 },
			terms: { alerts: 'no', po: 'no', sso: 'no', anomaly: 'no', region: 'no', engineer: 'no', connector: 'no' },
		},
		{
			slug: 'basic',
			label: 'Basic',
			seatCap: 15,
			sourceCap: 6,
			freshness: 2,
			rates: { monthly: 35, yearly: 28 },
			terms: {
				alerts: 'yes',
				po: 'no',
				sso: 'no',
				anomaly: 'addon',
				region: 'addon',
				engineer: 'addon',
				connector: 'addon',
			},
		},
		{
			slug: 'pro',
			label: 'Pro',
			seatCap: 75,
			sourceCap: Infinity,
			freshness: 3,
			rates: { monthly: 60, yearly: 48 },
			terms: {
				alerts: 'yes',
				po: 'yes',
				sso: 'no',
				anomaly: 'yes',
				region: 'addon',
				engineer: 'addon',
				connector: 'addon',
			},
		},
		{
			slug: 'max',
			label: 'Max',
			seatCap: Infinity,
			sourceCap: Infinity,
			freshness: 4,
			byQuote: true,
			terms: {
				alerts: 'yes',
				po: 'yes',
				sso: 'yes',
				anomaly: 'yes',
				region: 'yes',
				engineer: 'yes',
				connector: 'yes',
			},
		},
	];

	/* Key order here is the order add-ons are billed and listed in. */
	const EXTRAS = {
		anomaly: { title: 'Anomaly detection', rates: { monthly: 30, yearly: 24 } },
		region: { title: 'Region pinning', rates: { monthly: 45, yearly: 36 } },
		engineer: { title: 'Named support engineer', rates: { monthly: 140, yearly: 112 } },
		connector: { title: 'Private connector', rates: { monthly: 210, yearly: 168 } },
	};

	/* Key order here is the order the fit list reads in. */
	const MUSTS = {
		alerts: 'Alert rules',
		anomaly: 'Anomaly detection',
		po: 'Paying by purchase order',
		sso: 'SSO and SCIM',
		region: 'Data kept in one region',
	};

	/* These two musts are also sold as add-ons, so ticking one in the
     sentence and switching it on in the estimate are the same act. */
	const SOLD_AS_EXTRA = new Set(['anomaly', 'region']);

	const COUNT_RANGE = { seats: [1, 500], sources: [1, 99] };
	const TRIAL_LENGTH = 21;
	const GLIDE_MS = 420;
	const TOAST_MS = 3600;

	const FIT_MARK = { yes: 'bi-check-circle-fill', addon: 'bi-plus-circle-fill', no: 'bi-x-circle' };
	const FIT_SPOKEN = { yes: ' (covered)', addon: ' (as an add-on)', no: ' (not covered)' };

	/* Three ways an add-on row can read, keyed by the tier's terms. */
	const EXTRA_ROW_STATES = {
		no: () => ({ on: false, locked: true, price: 'Paid plans only' }),
		yes: (tier) => ({ on: true, locked: true, price: `Included in ${tier.label}` }),
		addon: (tier, key) => ({
			on: billedExtras(tier).includes(key),
			locked: false,
			price: `${dollars.format(EXTRAS[key].rates[team.cadence])} a month`,
		}),
	};

	/* What the sales dialog can put in a contract, each with the smallest
     tier that can carry it, and the seat bands it offers. */
	const CONTRACT_TERMS = {
		sso: { line: 'SSO and SCIM provisioning', floor: 'max' },
		region: { line: 'All data kept in one region', floor: 'basic' },
		po: { line: 'Invoiced against a purchase order', floor: 'pro' },
		sla: { line: '99.99% uptime commitment', floor: 'max' },
		connector: { line: 'One private connector, built and maintained', floor: 'basic' },
		term: { line: 'Two-year term, a further 10% off', floor: 'basic' },
	};
	const SEAT_BANDS = {
		15: { line: 'for under 15 seats', floor: 'basic' },
		75: { line: 'for 15 to 75 seats', floor: 'pro' },
		250: { line: 'for 75 to 250 seats', floor: 'max' },
		251: { line: 'for over 250 seats', floor: 'max' },
	};

	/* Demo calls start at these UTC hours and minutes. */
	const DEMO_SLOTS = [
		[8, 30],
		[11, 0],
		[14, 0],
		[16, 30],
		[19, 0],
	];

	/* The team as described. A shared link in the address bar replaces the
     demo values below before the first paint. */
	const team = {
		seats: 24,
		sources: 4,
		freshness: 2,
		musts: ['alerts'],
		extras: [],
		cadence: 'monthly',
		pinnedTier: null,
		heldTier: null,
		sideA: null,
		sideB: null,
		sidesSetByHand: false,
	};

	/* The tier currently ringed, and the tier a trial button asked for. */
	let leader = null;
	let trialAsk = null;

	const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
	const fullDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	const brieflyDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	const clockTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
	const counters = new WeakMap();

	const fields = {
		seats: pick('[data-tarf-input="seats"]'),
		sources: pick('[data-tarf-input="sources"]'),
		freshness: pick('[data-tarf-input="refresh"]'),
	};
	const stepButtons = pickAll('.tarf-stepper-btn');
	const mustBoxes = pickAll('[data-tarf-need]');
	const cadenceRadios = pickAll('[data-tarf-billing]');
	const briefPanel = pick('[data-tarf-brief]');
	const tierGrid = pick('.tarf-plans');
	const ring = pick('[data-tarf-frame]');
	const tierCards = pickAll('[data-tarf-plan]');
	const estimatePanel = pick('[data-tarf-estimate]');
	const estimateRadios = pickAll('input[name="pricingEstimatePlan"]');
	const extraRows = pickAll('[data-tarf-addon]', estimatePanel);
	const comparePanel = pick('[data-tarf-compare]');
	const featureTable = pick('[data-tarf-table]');
	const differencesOnly = pick('[data-tarf-diff]');
	const dock = pick('[data-tarf-dock]');

	start();

	/** Wires every control, reads a shared link if there is one, then paints. */
	function start() {
		wireSentence();
		wireTierCards();
		wireEstimate();
		wireComparison();
		wireDock();
		wireTrialDialog();
		wireSalesDialog();
		wireDemoDialog();

		loadSharedLink();
		for (const [order, block] of pickAll('.tarf-rise').entries()) block.style.setProperty('--tarf-i', order);
		repaint(false);
		page.classList.add('is-ready');
	}

	/* Small helpers used throughout. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function tierBySlug(slug) {
		return TIERS.find((tier) => tier.slug === slug) || null;
	}

	function word(count, one, many) {
		return count === 1 ? one : many;
	}

	function counted(count, one, many) {
		return `${count} ${word(count, one, many)}`;
	}

	function within(value, [low, high]) {
		return Math.min(high, Math.max(low, value));
	}

	/** Adds or drops a value in a list in place, keeping the order it was added in. */
	function setMembership(list, value, present) {
		const at = list.indexOf(value);
		if (present && at < 0) list.push(value);
		else if (!present && at >= 0) list.splice(at, 1);
	}

	/* Prices and fit, worked out from the catalog and the team. */

	/** Add-ons billed on a tier: the musts and extras it sells rather than includes. */
	function billedExtras(tier) {
		return Object.keys(EXTRAS).filter((key) => {
			if (tier.terms[key] !== 'addon') return false;
			return (SOLD_AS_EXTRA.has(key) && team.musts.includes(key)) || team.extras.includes(key);
		});
	}

	/**
	 * A month of a tier on one billing cadence.
	 * @returns {{lines: Array<{label: string, amount: number, kind: string}>, perMonth: number, addons: number}|null}
	 *   null for a tier priced by quote.
	 */
	function monthlyBill(tier, cadence, seats = team.seats) {
		if (tier.byQuote) return null;
		const seatRate = tier.rates[cadence];
		const seatTotal = seats * seatRate;
		const lines = [
			{
				label: `${counted(seats, 'seat', 'seats')} × ${dollars.format(seatRate)}`,
				amount: seatTotal,
				kind: 'seats',
			},
			...billedExtras(tier).map((key) => ({
				label: EXTRAS[key].title,
				amount: EXTRAS[key].rates[cadence],
				kind: 'addon',
			})),
		];
		let perMonth = 0;
		for (const line of lines) perMonth += line.amount;
		return { lines, perMonth, addons: perMonth - seatTotal };
	}

	/** Twelve months of a tier paid each way, and the gap between them. */
	function twelveMonths(tier) {
		const monthly = monthlyBill(tier, 'monthly');
		if (!monthly) return null;
		const yearly = monthlyBill(tier, 'yearly');
		return {
			monthly: monthly.perMonth * 12,
			yearly: yearly.perMonth * 12,
			saved: (monthly.perMonth - yearly.perMonth) * 12,
		};
	}

	/**
	 * Checks a tier against the sentence, one row per limit and per must.
	 * @returns {{rows: Array<{key: string, status: string, text: string, note: string}>, gaps: Array, fits: boolean}}
	 */
	function checkTier(tier) {
		const seatsOk = team.seats <= tier.seatCap;
		const sourcesOk = team.sources <= tier.sourceCap;
		const freshOk = tier.freshness >= team.freshness;

		const rows = [
			{
				key: 'seats',
				status: seatsOk ? 'yes' : 'no',
				text:
					tier.seatCap === Infinity
						? 'Any number of seats'
						: `Up to ${counted(tier.seatCap, 'person', 'seats')}`,
				note: seatsOk ? '' : `you need ${team.seats}`,
			},
			{
				key: 'sources',
				status: sourcesOk ? 'yes' : 'no',
				text:
					tier.sourceCap === Infinity
						? 'Unlimited data sources'
						: counted(tier.sourceCap, 'data source', 'data sources'),
				note: sourcesOk ? '' : `you need ${team.sources}`,
			},
			{
				key: 'refresh',
				status: freshOk ? 'yes' : 'no',
				text: `Refreshed ${FRESHNESS[tier.freshness]}`,
				note: freshOk ? '' : `you need ${FRESHNESS[team.freshness]}`,
			},
		];

		const mustNotes = {
			yes: () => '',
			addon: (key) => `+${dollars.format(EXTRAS[key].rates[team.cadence])} a month`,
			no: () => `not on ${tier.label}`,
		};
		for (const [key, label] of Object.entries(MUSTS)) {
			if (!team.musts.includes(key)) continue;
			const status = tier.terms[key];
			rows.push({ key, status, text: label, note: mustNotes[status](key) });
		}

		const gaps = rows.filter((row) => row.status === 'no');
		return { rows, gaps, fits: !gaps.length };
	}

	/** The cheapest priced tier that covers the sentence; Max when none does. */
	function cheapestFit() {
		let winner = null;
		let winnerCost = Infinity;
		for (const tier of TIERS) {
			if (tier.byQuote || !checkTier(tier).fits) continue;
			const price = monthlyBill(tier, team.cadence).perMonth;
			if (price < winnerCost) {
				winner = tier;
				winnerCost = price;
			}
		}
		return winner || tierBySlug('max');
	}

	/** What the main button for a tier says and does. */
	function nextStepFor(tier) {
		if (tier.slug === 'free') {
			return { label: 'Create a workspace', go: () => window.open('sign-up.html', '_blank', 'noopener') };
		}
		if (tier.byQuote) return { label: 'Talk to sales', go: () => showDialog('tarf-contact-modal') };
		return { label: 'Start a 21-day trial', go: () => askForTrial(tier.slug) };
	}

	/* Painting. One pass redraws every part of the page from the state. */

	/** Redraws the page; a change made by the visitor is also written to the address bar. */
	function repaint(byVisitor) {
		let held = team.heldTier && tierBySlug(team.heldTier);
		if (held && !checkTier(held).fits) {
			team.heldTier = null;
			held = null;
		}
		leader = held || cheapestFit();

		paintSentence();
		for (const card of tierCards) paintCard(card);
		moveRing();
		paintEstimate();
		paintComparison();
		paintDock();
		if (byVisitor) saveSharedLink();
	}

	function paintSentence() {
		fields.seats.value = team.seats;
		fields.sources.value = team.sources;
		fields.freshness.value = String(team.freshness);
		for (const box of mustBoxes) box.checked = team.musts.includes(box.value);
		for (const radio of cadenceRadios) radio.checked = radio.value === team.cadence;
		pick('[data-tarf-word="seats"]').textContent = word(team.seats, 'person', 'people');
		pick('[data-tarf-word="sources"]').textContent = word(team.sources, 'data source', 'data sources');

		for (const button of stepButtons) {
			const key = button.dataset.tarfStep;
			const [low, high] = COUNT_RANGE[key];
			button.disabled = Number.parseInt(button.dataset.tarfBy, 10) < 0 ? team[key] <= low : team[key] >= high;
		}
	}

	function paintCard(card) {
		const tier = tierBySlug(card.dataset.tarfPlan);
		const check = checkTier(tier);
		const leads = tier === leader;

		card.classList.toggle('is-best', leads);
		card.classList.toggle('is-short', !check.fits);

		const badge = pick('[data-tarf-badge]', card);
		if (badge) {
			const mark = document.createElement('i');
			mark.className = `bi ${team.heldTier ? 'bi-check2-circle' : 'bi-stars'}`;
			mark.setAttribute('aria-hidden', 'true');
			badge.replaceChildren(mark, team.heldTier ? 'Your plan' : 'Best fit');
		}

		paintCardPrice(card, tier);

		pick('[data-tarf-fit-title]', card).textContent = check.fits
			? 'Covers everything you asked for'
			: `Short on ${check.gaps.length} of your ${word(check.rows.length, 'need', 'needs')}`;
		pick('[data-tarf-fit]', card).replaceChildren(...check.rows.map(fitRow));

		const button = pick('.tarf-plan-cta', card);
		const isFree = tier.slug === 'free';
		button.classList.toggle('btn-primary', leads);
		button.classList.toggle('btn-outline-primary', !leads && !isFree);
		button.classList.toggle('btn-outline-secondary', !leads && isFree);
	}

	/** The big number on a card, the words beside it and the line below. */
	function paintCardPrice(card, tier) {
		const figure = pick('[data-tarf-amount]', card);
		const unit = pick('[data-tarf-per]', card);
		const detail = pick('[data-tarf-rate]', card);
		const yearly = team.cadence === 'yearly';

		if (tier.slug === 'free') {
			countTo(figure, 0);
			unit.textContent = 'free, for good';
			detail.textContent = 'Up to 3 people';
			return;
		}
		if (tier.byQuote) {
			showWords(figure, 'Quoted');
			unit.textContent = 'per contract';
			detail.textContent = 'Any number of seats';
			return;
		}
		const seatRate = tier.rates[team.cadence];
		if (team.seats > tier.seatCap) {
			countTo(figure, seatRate);
			unit.textContent = yearly ? 'per seat a month, billed yearly' : 'per seat a month';
			detail.textContent = `Up to ${tier.seatCap} seats, so not for a team of ${team.seats}`;
			return;
		}
		const bill = monthlyBill(tier, team.cadence);
		countTo(figure, bill.perMonth);
		unit.textContent = yearly ? 'a month, billed yearly' : 'a month for your team';
		const onTop = bill.addons ? `, plus ${dollars.format(bill.addons)} in add-ons` : '';
		detail.textContent = `${team.seats} × ${dollars.format(seatRate)} per seat${onTop}`;
	}

	/** One line of a card's fit list: a mark, the feature, an optional note, then words for screen readers. */
	function fitRow({ status, text, note }) {
		const item = document.createElement('li');
		item.className = `tarf-fit-row is-${status}`;

		const mark = document.createElement('i');
		mark.className = `bi ${FIT_MARK[status]}`;
		mark.setAttribute('aria-hidden', 'true');
		const feature = textSpan('tarf-fit-text', text);
		item.append(mark, feature);

		if (note) item.append(textSpan('tarf-fit-note', note));
		item.append(textSpan('visually-hidden', FIT_SPOKEN[status]));
		return item;
	}

	function textSpan(className, text) {
		const span = document.createElement('span');
		span.className = className;
		span.textContent = text;
		return span;
	}

	/* The ring sits behind the cards and glides to whichever one leads. */
	function moveRing() {
		if (!ring || !leader) return;
		const card = pick(`[data-tarf-plan="${leader.slug}"]`);
		if (!card) return;

		Object.assign(ring.style, {
			width: `${card.offsetWidth}px`,
			height: `${card.offsetHeight}px`,
			transform: `translate(${card.offsetLeft}px, ${card.offsetTop}px)`,
		});
		if (ring.classList.contains('is-placed')) return;

		/* The first placement lands without a glide; the glide is switched on
       two frames later, once the landing has painted. */
		ring.classList.add('is-placed');
		requestAnimationFrame(() => requestAnimationFrame(() => ring.classList.add('is-gliding')));
	}

	/** The tier the estimate is for: one the visitor pinned while it still holds the team, otherwise the leader. */
	function estimatedTier() {
		if (!team.pinnedTier) return leader;
		const pinned = tierBySlug(team.pinnedTier);
		if (pinned && team.seats <= pinned.seatCap) return pinned;
		team.pinnedTier = null;
		return leader;
	}

	function paintEstimate() {
		const tier = estimatedTier();

		for (const radio of estimateRadios) {
			const option = tierBySlug(radio.value);
			radio.checked = option === tier;
			radio.disabled = team.seats > option.seatCap;
			const label = radio.closest('.tarf-planpick-option');
			label.classList.toggle('is-best', option === leader);
			label.title = radio.disabled
				? `${option.label} holds up to ${counted(option.seatCap, 'person', 'seats')}`
				: '';
		}

		for (const row of extraRows) paintExtraRow(row, tier);

		pick('[data-tarf-priced]', estimatePanel).hidden = Boolean(tier.byQuote);
		pick('[data-tarf-quoted]', estimatePanel).hidden = !tier.byQuote;

		const action = pick('[data-tarf-bill-cta]', estimatePanel);
		action.textContent = nextStepFor(tier).label;
		action.setAttribute('data-plan', tier.slug);

		if (tier.byQuote) return;
		paintBill(tier);
		paintYear(tier);
	}

	function paintExtraRow(row, tier) {
		const key = row.dataset.tarfAddon;
		const offer = tier.terms[key];
		const look = EXTRA_ROW_STATES[offer](tier, key);
		const toggle = pick('[data-tarf-addon-toggle]', row);

		row.classList.toggle('is-off', offer === 'no');
		row.classList.toggle('is-included', offer === 'yes');
		toggle.disabled = look.locked;
		toggle.checked = look.on;
		pick('[data-tarf-addon-price]', row).textContent = look.price;
	}

	function paintBill(tier) {
		const bill = monthlyBill(tier, team.cadence);
		const lines = bill.lines.map(({ label, amount, kind }) => {
			const item = document.createElement('li');
			const name = document.createElement('span');
			name.textContent = kind === 'seats' ? `${tier.label}, ${label}` : label;
			const sum = document.createElement('strong');
			sum.textContent = tier.slug === 'free' ? 'Free' : dollars.format(amount);
			item.append(name, sum);
			return item;
		});
		pick('[data-tarf-lines]', estimatePanel).replaceChildren(...lines);
		pick('[data-tarf-total-label]', estimatePanel).textContent =
			team.cadence === 'yearly' ? 'A month, billed yearly' : 'A month';
		countTo(pick('[data-tarf-total]', estimatePanel), bill.perMonth);
	}

	/** The two bars for a year paid monthly and yearly, and the line about the gap. */
	function paintYear(tier) {
		const isFree = tier.slug === 'free';
		pick('.tarf-year', estimatePanel).hidden = isFree;
		if (isFree) return;

		const year = twelveMonths(tier);
		for (const cadence of ['monthly', 'yearly']) {
			const row = pick(`[data-tarf-year="${cadence}"]`, estimatePanel);
			row.classList.toggle('is-current', team.cadence === cadence);
			countTo(pick('[data-tarf-year-amount]', row), year[cadence]);
			const share = year.monthly ? (year[cadence] / year.monthly) * 100 : 0;
			pick('[data-tarf-year-bar]', row).style.width = `${share}%`;
		}

		const saved = dollars.format(year.saved);
		pick('[data-tarf-year-note]', estimatePanel).textContent =
			team.cadence === 'yearly'
				? `Paying yearly saves you ${saved} over twelve months.`
				: `Switch to yearly billing and keep ${saved} over twelve months.`;
	}

	/** Until the visitor picks, the narrow table pairs the leader with the tier above it (or below, for the top tier). */
	function defaultSides() {
		if (team.sidesSetByHand && team.sideA && team.sideB) return;
		const at = TIERS.indexOf(leader);
		const isTop = at === TIERS.length - 1;
		team.sideA = isTop ? TIERS[at - 1].slug : leader.slug;
		team.sideB = isTop ? leader.slug : TIERS[at + 1].slug;
	}

	function paintComparison() {
		defaultSides();
		for (const radio of pickAll('input[name="pricingCompareA"]', comparePanel))
			radio.checked = radio.value === team.sideA;
		for (const radio of pickAll('input[name="pricingCompareB"]', comparePanel))
			radio.checked = radio.value === team.sideB;

		for (const cell of pickAll('[data-plan]', featureTable)) {
			const slug = cell.getAttribute('data-plan');
			cell.classList.toggle('is-best', slug === leader.slug);
			cell.classList.toggle('is-picked', slug === team.sideA || slug === team.sideB);
		}

		const narrow = comparePanel.hasAttribute('data-narrow');
		const trimSame = differencesOnly.checked;
		const rows = pickAll('tbody tr', featureTable);
		const isHeading = (row) => row.classList.contains('tarf-table-group');

		for (const row of rows) {
			if (isHeading(row)) continue;
			const shown = pickAll('td', row)
				.filter((cell) => !narrow || cell.classList.contains('is-picked'))
				.map((cell) => cell.textContent.trim());
			row.hidden = trimSame && shown.every((text) => text === shown[0]);
		}

		/* A group heading hides when every row under it is hidden. */
		for (const [at, row] of rows.entries()) {
			if (!isHeading(row)) continue;
			let visible = false;
			for (const below of rows.slice(at + 1)) {
				if (isHeading(below)) break;
				if (!below.hidden) {
					visible = true;
					break;
				}
			}
			row.hidden = !visible;
		}
	}

	function paintDock() {
		const nextStep = { free: 'Create a workspace', max: 'Talk to sales' };
		pick('[data-tarf-dock-plan]', dock).textContent = leader.label;
		pick('[data-tarf-dock-detail]', dock).textContent = dockSummary();
		pick('[data-tarf-dock-cta]', dock).textContent = nextStep[leader.slug] || 'Start a trial';
	}

	function dockSummary() {
		if (leader.byQuote) return `${team.seats} seats, quoted per contract`;
		if (leader.slug === 'free') return 'free for up to 3 people';
		const total = dollars.format(monthlyBill(leader, team.cadence).perMonth);
		const tail = team.cadence === 'yearly' ? ', billed yearly' : '';
		return `${counted(team.seats, 'seat', 'seats')}, ${total} a month${tail}`;
	}

	/* Numbers count from what they showed last to the new value. */

	/** Eases an element's number to a new value over GLIDE_MS, or sets it outright when motion is unwanted. */
	function countTo(element, target) {
		if (!element) return;
		const record = counters.get(element) || {};
		const origin = typeof record.value === 'number' ? record.value : target;
		if (record.frame) cancelAnimationFrame(record.frame);
		record.value = target;
		record.frame = 0;
		counters.set(element, record);

		if (calm || origin === target || document.hidden) {
			element.textContent = dollars.format(target);
			return;
		}
		let began = null;
		const frame = (now) => {
			began ??= now;
			const progress = Math.min(1, (now - began) / GLIDE_MS);
			const eased = 1 - (1 - progress) ** 3;
			element.textContent = dollars.format(Math.round(origin + (target - origin) * eased));
			if (progress < 1) record.frame = requestAnimationFrame(frame);
		};
		record.frame = requestAnimationFrame(frame);
	}

	/** Puts words where a number was, stopping any count in flight. */
	function showWords(element, text) {
		if (!element) return;
		const record = counters.get(element);
		if (record?.frame) cancelAnimationFrame(record.frame);
		counters.delete(element);
		element.textContent = text;
	}

	/* The address bar carries the sentence, so an estimate can be shared. */

	function loadSharedLink() {
		let query;
		try {
			query = new URLSearchParams(window.location.search);
		} catch {
			return;
		}
		for (const key of ['seats', 'sources']) {
			const typed = Number.parseInt(query.get(key), 10);
			if (!Number.isNaN(typed)) team[key] = within(typed, COUNT_RANGE[key]);
		}
		const freshness = Number.parseInt(query.get('refresh'), 10);
		if (FRESHNESS[freshness]) team.freshness = freshness;
		if (query.has('need')) team.musts = listParam(query, 'need').filter((key) => Object.hasOwn(MUSTS, key));
		if (query.has('addons'))
			team.extras = listParam(query, 'addons').filter(
				(key) => Object.hasOwn(EXTRAS, key) && !SOLD_AS_EXTRA.has(key),
			);
		if (query.get('billing') === 'yearly') team.cadence = 'yearly';
		if (tierBySlug(query.get('plan'))) team.pinnedTier = query.get('plan');
	}

	function listParam(query, name) {
		return (query.get(name) || '').split(',');
	}

	function sharedLink() {
		const query = new URLSearchParams();
		query.set('seats', team.seats);
		query.set('sources', team.sources);
		query.set('refresh', team.freshness);
		query.set('need', team.musts.join(','));
		if (team.extras.length) query.set('addons', team.extras.join(','));
		query.set('billing', team.cadence);
		if (team.pinnedTier) query.set('plan', team.pinnedTier);
		return `${window.location.pathname}?${query}`;
	}

	function saveSharedLink() {
		try {
			window.history.replaceState(null, '', sharedLink());
		} catch {
			/* Some browsers refuse this on file:// pages; the page works without it. */
		}
	}

	/* Wiring for the controls inside the page. */

	function wireSentence() {
		for (const button of stepButtons) {
			button.addEventListener('click', () => {
				const key = button.dataset.tarfStep;
				applyCount(key, team[key] + Number.parseInt(button.dataset.tarfBy, 10));
				repaint(true);
			});
		}

		for (const key of ['seats', 'sources']) {
			const field = fields[key];
			field.addEventListener('input', () => {
				/* A field emptied mid-edit is left alone until it loses focus. */
				if (field.value === '' || !applyCount(key, field.value)) return;
				const typed = field.value;
				repaint(true);
				if (String(team[key]) !== typed) field.value = team[key];
			});
			field.addEventListener('blur', () => {
				field.value = team[key];
			});
		}

		fields.freshness.addEventListener('change', () => {
			team.freshness = Number.parseInt(fields.freshness.value, 10) || 2;
			repaint(true);
		});

		for (const box of mustBoxes) {
			box.addEventListener('change', () => {
				setMembership(team.musts, box.value, box.checked);
				repaint(true);
			});
		}

		for (const radio of cadenceRadios) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				team.cadence = radio.value;
				repaint(true);
			});
		}
	}

	/** Stores a typed or stepped count inside its range; false when it is not a number. */
	function applyCount(key, raw) {
		const count = Number.parseInt(raw, 10);
		if (Number.isNaN(count)) return false;
		team[key] = within(count, COUNT_RANGE[key]);
		return true;
	}

	function wireTierCards() {
		for (const card of tierCards) {
			card.setAttribute('data-tarf-choosable', '');
			card.setAttribute('tabindex', '0');
			const choose = () => holdTier(tierBySlug(card.dataset.tarfPlan));
			card.addEventListener('click', (event) => {
				if (!event.target.closest('a, button, input, label, select')) choose();
			});
			card.addEventListener('keydown', (event) => {
				if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
				event.preventDefault();
				choose();
			});
		}
	}

	/* Holding a tier rewrites the sentence to fit it: counts and freshness
     come down to its limits and musts it cannot offer are dropped. */
	function holdTier(tier) {
		team.seats = Math.min(team.seats, tier.seatCap);
		team.sources = Math.min(team.sources, tier.sourceCap);
		team.freshness = Math.min(team.freshness, tier.freshness);
		team.musts = team.musts.filter((key) => tier.terms[key] !== 'no');
		team.heldTier = tier.slug;
		repaint(true);
		if (briefPanel?.getBoundingClientRect().top < 0) {
			briefPanel.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
		}
	}

	function wireEstimate() {
		for (const radio of estimateRadios) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				team.pinnedTier = radio.value === leader.slug ? null : radio.value;
				repaint(true);
			});
		}

		for (const row of extraRows) {
			const key = row.dataset.tarfAddon;
			const toggle = pick('[data-tarf-addon-toggle]', row);
			toggle.addEventListener('change', () => {
				setMembership(SOLD_AS_EXTRA.has(key) ? team.musts : team.extras, key, toggle.checked);
				repaint(true);
			});
		}

		pick('[data-tarf-bill-cta]', estimatePanel).addEventListener('click', (event) => {
			nextStepFor(tierBySlug(event.currentTarget.getAttribute('data-plan'))).go();
		});

		pick('[data-tarf-copy]', estimatePanel).addEventListener('click', () => {
			const link = window.location.origin + sharedLink();
			const fallBack = () => toast(link);
			if (!navigator.clipboard?.writeText) {
				fallBack();
				return;
			}
			navigator.clipboard
				.writeText(link)
				.then(() => toast('Link copied. It opens this page with your team filled in.'), fallBack);
		});
	}

	function wireComparison() {
		for (const side of ['A', 'B']) {
			for (const radio of pickAll(`input[name="tarf-compare-${side}"]`, comparePanel)) {
				radio.addEventListener('change', () => {
					if (radio.checked) chooseSide(side, radio.value);
				});
			}
		}
		differencesOnly.addEventListener('change', paintComparison);
		pick('[data-tarf-download]', comparePanel).addEventListener('click', downloadPriceList);

		if (!('ResizeObserver' in window)) {
			window.addEventListener('resize', moveRing);
			return;
		}
		/* The table drops to two columns when its own box is narrow, whatever the window does. */
		new ResizeObserver(([entry]) => {
			const narrow = entry.contentRect.width < 700;
			if (narrow === comparePanel.hasAttribute('data-narrow')) return;
			requestAnimationFrame(() => {
				comparePanel.toggleAttribute('data-narrow', narrow);
				paintComparison();
			});
		}).observe(comparePanel);
		new ResizeObserver(() => requestAnimationFrame(moveRing)).observe(tierGrid);
	}

	/** Puts a tier on one side of the narrow table; picking the other side's tier swaps them. */
	function chooseSide(side, slug) {
		const own = `side${side}`;
		const opposite = side === 'A' ? 'sideB' : 'sideA';
		if (team[opposite] === slug) team[opposite] = team[own];
		team[own] = slug;
		team.sidesSetByHand = true;
		paintComparison();
	}

	function downloadPriceList() {
		const quote = (text) => `"${String(text).replace(/\s+/g, ' ').trim().replace(/"/g, '""')}"`;
		const records = pickAll('thead tr, tbody tr', featureTable).map((row) =>
			pickAll('th, td', row)
				.map((cell) => quote(cell.textContent.trim()))
				.join(','),
		);
		const file = new Blob([`${records.join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });

		const anchor = document.createElement('a');
		anchor.href = URL.createObjectURL(file);
		anchor.download = 'basalt-price-list.csv';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
		toast('Price list saved as basalt-price-list.csv.');
	}

	/* The dock appears once the sentence has scrolled up out of view. */
	function wireDock() {
		if ('IntersectionObserver' in window) {
			new IntersectionObserver(([entry]) => {
				const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
				dock.classList.toggle('is-shown', scrolledPast);
				dock.inert = !scrolledPast;
			}).observe(briefPanel);
		}
		pick('[data-tarf-edit]', dock).addEventListener('click', () => {
			briefPanel.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
			fields.seats.focus({ preventScroll: true });
		});
		pick('[data-tarf-dock-cta]', dock).addEventListener('click', () => nextStepFor(leader).go());
	}

	/** Shows a short dark notice in the corner and clears it after TOAST_MS. */
	function toast(message) {
		let shelf = pick('.tarf-toast-region', document);
		if (!shelf) {
			shelf = document.createElement('div');
			shelf.className = 'tarf-toast-region';
			shelf.setAttribute('aria-live', 'polite');
			shelf.setAttribute('aria-atomic', 'true');
			document.body.append(shelf);
		}

		const note = document.createElement('div');
		note.className = 'toast align-items-center border-0 text-bg-dark';
		note.setAttribute('role', 'status');
		const line = document.createElement('div');
		line.className = 'd-flex';
		const words = document.createElement('div');
		words.className = 'toast-body';
		words.textContent = message;
		const dismiss = document.createElement('button');
		dismiss.type = 'button';
		dismiss.className = 'btn-close btn-close-white me-2 m-auto';
		dismiss.setAttribute('data-bs-dismiss', 'toast');
		dismiss.setAttribute('aria-label', 'Close');
		line.append(words, dismiss);
		note.append(line);
		shelf.append(note);

		const Toast = window.bootstrap?.Toast;
		if (!Toast) {
			setTimeout(() => note.remove(), TOAST_MS);
			return;
		}
		note.addEventListener('hidden.bs.toast', () => note.remove());
		new Toast(note, { delay: TOAST_MS }).show();
	}

	/* The three dialogs share one shape: a form step, then a done step,
     and a fresh form every time the dialog opens. */

	function showDialog(id) {
		const element = document.getElementById(id);
		if (element && window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(element).show();
	}

	/**
	 * Gives a dialog its open, check and confirm behavior.
	 * @param {{modal: Element, form: HTMLFormElement, prepare: Function, confirm: () => string, check?: () => boolean}} parts
	 *   prepare fills the form on open, check validates what the browser cannot,
	 *   and confirm returns the sentence for the done step.
	 */
	function bindTwoStepDialog({ modal, form, prepare, confirm, check = () => true }) {
		const showStep = (finished) => {
			pick('[data-tarf-step-form]', modal).hidden = finished;
			pick('[data-tarf-foot-form]', modal).hidden = finished;
			pick('[data-tarf-step-done]', modal).hidden = !finished;
			pick('[data-tarf-foot-done]', modal).hidden = !finished;
		};

		modal.addEventListener('show.bs.modal', (event) => {
			form.reset();
			form.classList.remove('was-validated');
			for (const message of pickAll('[data-tarf-error]', modal)) message.hidden = true;
			showStep(false);
			prepare(event);
		});

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const extrasPass = check();
			if (!form.checkValidity() || !extrasPass) {
				form.classList.add('was-validated');
				pick(':invalid', form)?.focus();
				return;
			}
			pick('[data-tarf-done-text]', modal).textContent = confirm();
			showStep(true);
			pick('[data-tarf-foot-done] .btn', modal)?.focus();
		});
	}

	function checkedValue(form, name) {
		return pick(`input[name="${name}"]:checked`, form)?.value || '';
	}

	/** Fills a preview list with ticked lines. */
	function tickList(list, lines) {
		list.replaceChildren(
			...lines.map((text) => {
				const item = document.createElement('li');
				const tick = document.createElement('i');
				tick.className = 'bi bi-check2';
				tick.setAttribute('aria-hidden', 'true');
				const words = document.createElement('span');
				words.textContent = text;
				item.append(tick, words);
				return item;
			}),
		);
	}

	function dayAfter(date, count) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate() + count);
	}

	function nextBusinessDay(date) {
		let day = dayAfter(date, 1);
		while ([0, 6].includes(day.getDay())) day = dayAfter(day, 1);
		return day;
	}

	function askForTrial(slug) {
		trialAsk = slug;
		showDialog('tarf-trial-modal');
	}

	function wireTrialDialog() {
		document.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-tarf-trial]');
			if (!trigger) return;
			event.preventDefault();
			askForTrial(trigger.getAttribute('data-tarf-trial'));
		});

		const modal = document.getElementById('tarf-trial-modal');
		const form = modal && pick('[data-tarf-trial-form]', modal);
		if (!form) return;

		const seatField = pick('[data-tarf-trial-seats]', modal);
		const finalDay = dayAfter(new Date(), TRIAL_LENGTH);

		/* The preview restates the trial and what it would cost after. */
		const preview = () => {
			const tier = tierBySlug(checkedValue(form, 'trialPlan')) || tierBySlug('pro');
			seatField.max = tier.seatCap;
			pick('[data-tarf-trial-seats-error]', modal).textContent =
				`${tier.label} holds 1 to ${tier.seatCap} seats.`;
			pick('[data-tarf-trial-today]', modal).textContent =
				`Your workspace opens with everything in ${tier.label}.`;
			pick('[data-tarf-trial-end-date]', modal).textContent = brieflyDay.format(finalDay);

			const after = pick('[data-tarf-trial-after]', modal);
			const seats = Number.parseInt(seatField.value, 10);
			if (Number.isNaN(seats) || seats < 1 || seats > tier.seatCap) {
				after.textContent = `Set a seat count between 1 and ${tier.seatCap} to see the price.`;
				return;
			}
			const monthly = monthlyBill(tier, 'monthly', seats);
			const yearly = monthlyBill(tier, 'yearly', seats);
			const extras = billedExtras(tier).map((key) => EXTRAS[key].title.toLowerCase());
			const withExtras = extras.length ? ` with ${extras.join(' and ')}` : '';
			after.textContent = `${tier.label} for ${counted(seats, 'seat', 'seats')}${withExtras} is ${dollars.format(monthly.perMonth)} a month, or ${dollars.format(yearly.perMonth)} a month billed yearly.`;
		};

		bindTwoStepDialog({
			modal,
			form,
			prepare: () => {
				const leaderIsTrial = leader && !leader.byQuote && leader.slug !== 'free';
				const slug = trialAsk || (leaderIsTrial ? leader.slug : 'pro');
				trialAsk = null;
				for (const radio of pickAll('input[name="trialPlan"]', modal)) radio.checked = radio.value === slug;
				seatField.value = Math.min(team.seats, tierBySlug(slug).seatCap);
				preview();
			},
			confirm: () => {
				const tier = tierBySlug(checkedValue(form, 'trialPlan'));
				const workspace = pick('[data-tarf-trial-workspace]', modal).value.trim();
				const email = form.elements.email.value.trim();
				return `We sent a sign-in link for ${workspace} to ${email}. Your ${tier.label} trial runs until ${fullDay.format(finalDay)}.`;
			},
		});

		form.addEventListener('input', preview);
		form.addEventListener('change', preview);
	}

	function wireSalesDialog() {
		const modal = document.getElementById('tarf-contact-modal');
		const form = modal && pick('[data-tarf-contact-form]', modal);
		if (!form) return;

		const replyDay = nextBusinessDay(new Date());
		const seatError = pick('[data-tarf-error="contactSeats"]', modal);
		const tierRank = (slug) => TIERS.indexOf(tierBySlug(slug));

		/* The preview names the smallest tier that can carry every ticked term. */
		const preview = () => {
			const band = checkedValue(form, 'contactSeats');
			const terms = pickAll('input[name="contactNeed"]:checked', form).map((box) => box.value);
			const floor = terms.reduce(
				(lowest, key) =>
					tierRank(CONTRACT_TERMS[key].floor) > tierRank(lowest) ? CONTRACT_TERMS[key].floor : lowest,
				band ? SEAT_BANDS[band].floor : 'basic',
			);
			const lines = terms.map((key) => CONTRACT_TERMS[key].line);

			pick('[data-tarf-quote-plan]', modal).textContent = tierBySlug(floor).label;
			pick('[data-tarf-quote-seats]', modal).textContent = band ? SEAT_BANDS[band].line : 'pick a seat range';
			tickList(pick('[data-tarf-quote-list]', modal), lines.length ? lines : ['Standard terms, nothing extra']);
			pick('[data-tarf-quote-for]', modal).textContent =
				`In your inbox by the end of ${fullDay.format(replyDay)}.`;
			if (band) seatError.hidden = true;
		};

		bindTwoStepDialog({
			modal,
			form,
			prepare: () => {
				const { seats } = team;
				const band = seats < 15 ? '15' : seats <= 75 ? '75' : seats <= 250 ? '250' : '251';
				for (const radio of pickAll('input[name="contactSeats"]', modal)) radio.checked = radio.value === band;
				for (const box of pickAll('input[name="contactNeed"]', modal)) {
					box.checked = team.musts.includes(box.value) || team.extras.includes(box.value);
				}
				preview();
			},
			confirm: () => {
				const [firstName] = pick('[data-tarf-contact-name]', modal).value.trim().split(/\s+/);
				const email = form.elements.email.value.trim();
				const tierName = pick('[data-tarf-quote-plan]', modal).textContent.trim();
				return `Thanks, ${firstName}. Reid will send a written quote for ${tierName} to ${email} by the end of ${fullDay.format(replyDay)}.`;
			},
			check: () => {
				const picked = Boolean(checkedValue(form, 'contactSeats'));
				seatError.hidden = picked;
				return picked;
			},
		});

		form.addEventListener('change', preview);
	}

	function wireDemoDialog() {
		const modal = document.getElementById('tarf-demo-modal');
		const form = modal && pick('[data-tarf-demo-form]', modal);
		if (!form) return;

		const dayGrid = pick('[data-tarf-demo-days]', modal);
		const timeGrid = pick('[data-tarf-demo-times]', modal);
		const dayError = pick('[data-tarf-error="demoDay"]', modal);
		const timeError = pick('[data-tarf-error="demoTime"]', modal);
		const viewerIsOnUtc = new Date().getTimezoneOffset() === 0;

		/* The next five business days, starting tomorrow. */
		const days = [];
		for (let day = new Date(); days.length < 5;) {
			day = nextBusinessDay(day);
			days.push(day);
		}

		const slotStart = (dayAt, slotAt) => {
			const day = days[dayAt];
			const [hour, minute] = DEMO_SLOTS[slotAt];
			return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute));
		};
		const utcClock = ([hour, minute]) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC`;

		for (const [at, day] of days.entries()) {
			dayGrid.append(
				choiceTile('demoDay', String(at), [
					[day.toLocaleDateString('en-US', { weekday: 'short' }), true],
					[day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), false],
				]),
			);
		}

		/* Time tiles are rebuilt for each day, since the viewer's own clock can differ by date. */
		const fillTimes = () => {
			const dayAt = Number.parseInt(checkedValue(form, 'demoDay') || '0', 10);
			const kept = checkedValue(form, 'demoTime');
			timeGrid.replaceChildren(
				...DEMO_SLOTS.map((slot, at) => {
					const local = viewerIsOnUtc ? 'same for you' : clockTime.format(slotStart(dayAt, at));
					const tile = choiceTile('demoTime', String(at), [
						[utcClock(slot), false],
						[local, true],
					]);
					if (String(at) === kept) pick('input', tile).checked = true;
					return tile;
				}),
			);
		};

		const preview = () => {
			const dayValue = checkedValue(form, 'demoDay');
			const timeValue = checkedValue(form, 'demoTime');
			const day = dayValue ? days[Number.parseInt(dayValue, 10)] : null;

			pick('[data-tarf-slot-month]', modal).textContent = day
				? day.toLocaleDateString('en-US', { month: 'short' })
				: '';
			pick('[data-tarf-slot-day]', modal).textContent = day ? day.getDate() : '';

			let when = 'Pick a day and a time.';
			if (day && timeValue) {
				const slotAt = Number.parseInt(timeValue, 10);
				const yours = viewerIsOnUtc
					? ''
					: ` (${clockTime.format(slotStart(Number.parseInt(dayValue, 10), slotAt))} your time)`;
				when = `${fullDay.format(day)} at ${utcClock(DEMO_SLOTS[slotAt])}${yours}`;
			} else if (day) {
				when = `${fullDay.format(day)}. Now pick a time.`;
			}
			pick('[data-tarf-slot-when]', modal).textContent = when;

			const lines = ['45 minutes on a video call', 'With a solutions engineer, not a script'];
			if (pick('[data-tarf-demo-csv]', modal).checked) lines.push('A CSV template in your inbox today');
			tickList(pick('[data-tarf-slot-list]', modal), lines);

			if (dayValue) dayError.hidden = true;
			if (timeValue) timeError.hidden = true;
		};

		bindTwoStepDialog({
			modal,
			form,
			prepare: () => {
				const firstDay = pick('input', dayGrid);
				if (firstDay) firstDay.checked = true;
				fillTimes();
				preview();
			},
			confirm: () => {
				const email = pick('[data-tarf-demo-email]', modal).value.trim();
				const when = pick('[data-tarf-slot-when]', modal).textContent.replace(
					/^(\w)/,
					(letter) => `on ${letter}`,
				);
				return `See you ${when}. The invite is on its way to ${email}.`;
			},
			check: () => {
				const hasDay = Boolean(checkedValue(form, 'demoDay'));
				const hasTime = Boolean(checkedValue(form, 'demoTime'));
				dayError.hidden = hasDay;
				timeError.hidden = hasTime;
				return hasDay && hasTime;
			},
		});

		form.addEventListener('change', (event) => {
			if (event.target.name === 'demoDay') fillTimes();
			preview();
		});
	}

	/**
	 * A radio tile in the shared .basalt-choice style.
	 * @param {Array<[string, boolean]>} parts Text spans in reading order; true marks the hint span.
	 */
	function choiceTile(name, value, parts) {
		const tile = document.createElement('label');
		tile.className = 'basalt-choice tarf-choice-slot';
		const radio = document.createElement('input');
		radio.type = 'radio';
		radio.name = name;
		radio.value = value;
		tile.append(
			radio,
			...parts.map(([text, isHint]) => {
				const span = document.createElement('span');
				if (isHint) span.className = 'basalt-choice-hint';
				span.textContent = text;
				return span;
			}),
		);
		return tile;
	}
})();
