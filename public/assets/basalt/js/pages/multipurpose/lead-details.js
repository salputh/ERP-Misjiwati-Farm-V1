/**
 * Lead Details (lead-details.html).
 *
 * A single lead, read from the same records leads.html shows, laid out as
 * cards: their request, the next step, the stage they are at, how well they
 * fit, the plan they need, trial activity, the conversation and their contact
 * details. The plan, the contact details and the next step are edited in
 * place; converting to a deal, setting aside and deleting each open a dialog.
 *
 * Hooking it to a server: leads.html links here with ?id=%231057. Make
 * backend.load(id) return that record (the shape is documented in
 * assets/basalt/js/data/multipurpose/deals.js) and fill in the other backend methods, one per
 * change. The page updates first and rolls back with an error toast when a
 * call rejects.
 *
 * Shared pieces come from basalt.js: styled selects, segmented controls, copy
 * buttons, toasts with an Undo action and the dialog helpers.
 */
(() => {
	'use strict';

	const MS_PER_DAY = 86400000;
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
	const LEADS_PAGE = 'leads.html';
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const OPEN_STAGES = ['new', 'contacted', 'qualified', 'trial'];
	const SEAT_LIMIT = 500;
	/* Conversation entries shown before Show earlier entries opens the rest. */
	const TALK_SHOWN = 2;
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	/*
	 * Sample content. The lead records live in assets/basalt/js/data/multipurpose/deals.js next to
	 * the deals they can become; that file explains every field. A plan price
	 * is per seat per month, and a year of seats costs ten months while add-ons
	 * are billed for all twelve.
	 */
	const SAMPLE = {
		now: '2026-10-08T15:00',
		me: 'John Armstrong',
		defaultId: '#1057',
		owners: [
			'John Armstrong',
			'Leslie Ashby',
			'Quentin Cook',
			'Tony Aldridge',
			'Elise Vick',
			'Thomas Morrison',
			'Jeffrey McKay',
		],
		plans: [
			{ id: 'starter', name: 'Basic', price: 15 },
			{ id: 'growth', name: 'Pro', price: 32 },
			{ id: 'enterprise', name: 'Max', price: 58 },
		],
		addons: [
			{ id: 'route', name: 'Travel Planner', price: 6 },
			{ id: 'portal', name: 'Customer Portal', price: 4 },
		],
		sources: {
			website: { name: 'Website form', icon: 'bi-window' },
			search: { name: 'Search ads', icon: 'bi-search' },
			referral: { name: 'Customer referral', icon: 'bi-people' },
			event: { name: 'Trade show', icon: 'bi-easel' },
			partner: { name: 'Reseller partner', icon: 'bi-shop' },
			webinar: { name: 'Webinar', icon: 'bi-camera-video' },
		},
		stages: [
			{ id: 'new', name: 'New' },
			{ id: 'contacted', name: 'Contacted' },
			{ id: 'qualified', name: 'Qualified' },
			{ id: 'trial', name: 'On trial' },
			{ id: 'converted', name: 'Converted' },
		],
		notNowReasons: [
			'Too small for now',
			'Revisit next quarter',
			'Chose another tool',
			'Staying on paper or spreadsheets',
			'No reply after three tries',
		],
	};
	const today = SAMPLE.now.slice(0, 10);

	/*
	 * One method per request the page makes. The demo waits a moment, the way
	 * a network round trip would, and never fails.
	 */
	const backend = {
		load(id) {
			const records = window.Basalt.data.deals.leads();
			const hit = records.find((row) => row.id === id) || records.find((row) => row.id === SAMPLE.defaultId);
			return JSON.parse(JSON.stringify(hit));
		},
		update(id, changes) {
			return pause(250);
		},
		log(id, entry) {
			return pause(250);
		},
		convert(id, deal) {
			return pause(250);
		},
		remove(id) {
			return pause(250);
		},
	};

	/* Icon, hue and wording per kind of history entry, and per stage. */
	const KIND_ICON = {
		form: 'bi-window',
		event: 'bi-easel',
		webinar: 'bi-camera-video',
		partner: 'bi-shop',
		email: 'bi-envelope',
		call: 'bi-telephone',
		demo: 'bi-display',
		trial: 'bi-hourglass-split',
		deal: 'bi-arrow-right-circle',
		pause: 'bi-pause-circle',
		note: 'bi-pencil',
		done: 'bi-check2-circle',
	};
	const KIND_TONE = {
		partner: 'contacted',
		email: 'new',
		call: 'qualified',
		demo: 'qualified',
		trial: 'trial',
		deal: 'converted',
		pause: 'notnow',
		note: 'notnow',
		done: 'converted',
	};
	const FORWARD_STEP = {
		new: { act: 'reply', icon: 'bi-reply', label: 'Mark as replied' },
		contacted: { act: 'qualify', icon: 'bi-check2-circle', label: 'Mark as qualified' },
		qualified: { act: 'convert', icon: 'bi-arrow-right-circle', label: 'Convert to deal' },
		trial: { act: 'convert', icon: 'bi-arrow-right-circle', label: 'Convert to deal' },
	};
	const PARKED_PHRASE = {
		new: 'before a first reply',
		contacted: 'after the first reply',
		qualified: 'once qualified',
		trial: 'during the trial',
	};
	const NEXT_TITLE = { converted: 'Now a deal', notnow: 'Set aside' };
	const FIT_WORD = { strong: 'Strong fit', fair: 'Fair fit', weak: 'Weak fit' };
	const ENTRY_HINT = {
		note: 'Add a note for the team',
		call: 'What was said on the call?',
		email: 'What did the email say?',
	};

	/* Page state: the record on screen and the handles the helpers share. */
	let lead;
	let highestDeal = 0;
	let trialChart = null;
	let talkOpen = false;
	const ui = {};

	/**
	 * Finds the page, loads the record and wires every card, form and dialog,
	 * then paints the whole thing once.
	 */
	function start() {
		const stage = pick('[data-ld-root]');
		if (!stage) return;
		ui.stage = stage;
		highestDeal = Math.max(...window.Basalt.data.deals.list().map((deal) => Number(deal.id.replace(/\D/g, ''))));
		lead = enrich(backend.load(new URLSearchParams(location.search).get('id')));

		wireNextStep();
		wireNeeds();
		wireTrial();
		wireConversation();
		wireDetails();
		wireActions();
		wireConvertDialog();
		wireParkDialog();
		wireDeleteDialog();

		if (lead.trial) paintTrialFigures();
		paintFit();
		paintAll();
		drawTrail(pocket('steps'));
	}

	/**
	 * Grows the finished stretches the first time the steps are on screen.
	 * Later repaints show them already drawn.
	 */
	function drawTrail(trail) {
		const lines = pickAll('.ld-step.is-done:not(:last-child)', trail);
		if (!lines.length || !window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		lines.forEach((line, at) => line.style.setProperty('--ld-trail-at', at));
		let left = lines.length;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'ld-trail-grow' || --left) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				trail.classList.replace('is-waiting', 'is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	/* Small DOM and text helpers used by everything below. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function pocket(name) {
		return pick(`[data-ld="${name}"]`, ui.stage);
	}

	function write(name, text) {
		pocket(name).textContent = text;
	}

	function paint(name, markup) {
		pocket(name).innerHTML = markup;
	}

	function on(target, type, handler) {
		target.addEventListener(type, handler);
	}

	function reveal(...elements) {
		for (const element of elements) element.toggleAttribute('hidden', false);
	}

	function conceal(...elements) {
		for (const element of elements) element.toggleAttribute('hidden', true);
	}

	function harmless(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => swap[char]);
	}

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function speak(text) {
		window.Basalt.announce?.(text);
	}

	function syncSelect(select) {
		window.Basalt.select?.refresh?.(select);
	}

	function dialogFor(element) {
		return window.bootstrap.Modal.getOrCreateInstance(element);
	}

	function themeColor(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function counted(amount, singular, pluralForm) {
		const word = amount === 1 ? singular : pluralForm || `${singular}s`;
		return `${amount.toLocaleString('en-US')} ${word}`;
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	/* Dates: records hold "2026-10-08" or "2026-10-08T12:10", read as local time. */

	function parseLocal(text) {
		return new Date(text.length > 10 ? text : `${text}T12:00`);
	}

	function monthDay(text) {
		const when = parseLocal(text);
		return `${MONTH_SHORT[when.getMonth()]} ${when.getDate()}`;
	}

	function fullDate(text) {
		return `${monthDay(text)}, ${parseLocal(text).getFullYear()}`;
	}

	function clockTime(text) {
		const when = parseLocal(text);
		const hours = when.getHours();
		const meridiem = hours < 12 ? ' am' : ' pm';
		return `${hours % 12 || 12}:${twoDigits(when.getMinutes())}${meridiem}`;
	}

	function dayAndTime(text) {
		return `${monthDay(text)}, ${clockTime(text)}`;
	}

	function dateAndTime(text) {
		return `${fullDate(text)}, ${clockTime(text)}`;
	}

	function isoStamp(when) {
		return `${when.getFullYear()}-${twoDigits(when.getMonth() + 1)}-${twoDigits(when.getDate())}`;
	}

	function shiftDays(text, days) {
		return isoStamp(new Date(parseLocal(text).getTime() + days * MS_PER_DAY));
	}

	function dayGap(from, to) {
		return Math.round((parseLocal(to) - parseLocal(from)) / MS_PER_DAY);
	}

	function minutesSinceReceived() {
		return Math.round((parseLocal(SAMPLE.now) - parseLocal(lead.received)) / 60000);
	}

	function rightNow() {
		return SAMPLE.now;
	}

	function minutesLabel(minutes) {
		if (minutes < 60) return `${minutes} min`;
		const rest = minutes % 60 ? ` ${minutes % 60} min` : '';
		return `${Math.floor(minutes / 60)} h${rest}`;
	}

	function endsLabel(text) {
		const left = dayGap(today, text);
		if (left < 0) return `Ended ${monthDay(text)}`;
		const soon = { 0: 'Ends today', 1: 'Ends tomorrow' };
		return soon[left] || `Ends in ${left} days`;
	}

	/* Record lookups and derived facts about the lead on screen. */

	function monogram(name) {
		const words = name.replace(/&/g, ' ').split(/\s+/).filter(Boolean);
		return words
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function hueFor(name) {
		let acc = 0;
		for (const char of name.toLowerCase()) acc = (acc * 31 + char.charCodeAt(0)) >>> 0;
		return (acc % 8) + 1;
	}

	function findPlan(id) {
		return SAMPLE.plans.find((plan) => plan.id === id);
	}

	function findAddon(id) {
		return SAMPLE.addons.find((addon) => addon.id === id);
	}

	function findStage(id) {
		return SAMPLE.stages.find((item) => item.id === id);
	}

	function addonMonthly(ids) {
		return ids.reduce((sum, id) => sum + findAddon(id).price, 0);
	}

	function annualValue(record) {
		const planPrice = findPlan(record.plan)?.price || 0;
		return record.seats * (planPrice * 10 + addonMonthly(record.addons) * 12);
	}

	function stillOpen(record) {
		return OPEN_STAGES.includes(record.stage);
	}

	function givenName(record) {
		return record.name.split(' ')[0];
	}

	function seatsValid(seats) {
		return seats >= 1 && seats <= SEAT_LIMIT;
	}

	function dealLink(record) {
		return `deal-details.html?id=${encodeURIComponent(record.deal)}`;
	}

	function dealStageName(record) {
		const deal = window.Basalt.data.deals.find(record.deal);
		if (!deal) return 'Discovery';
		if (deal.stage === 'lost') return 'Lost';
		return window.Basalt.data.deals.stages.find((item) => item.id === deal.stage).name;
	}

	function phoneHref(record) {
		return `tel:${harmless(record.phone.replace(/\s+/g, ''))}`;
	}

	/**
	 * Reads the dates each stage was reached, the trial's first day and the
	 * stage a cfg-aside lead came from out of the history, and makes the
	 * lead's own message the body of its first entry.
	 */
	function enrich(record) {
		const history = record.history;
		const firstOf = (kind) => (history.find((entry) => entry[3] === kind) || [])[0];
		const order = SAMPLE.stages.map((item) => item.id);
		const depth = record.stage === 'notnow' ? 1 : order.indexOf(record.stage);
		const ourFirst = history.find((entry) => entry[1] !== record.name && entry[1] !== record.via);
		const talks = history.filter((entry) => entry[3] === 'call' || entry[3] === 'demo');
		const lastTalk = talks.length ? talks[talks.length - 1][0] : null;
		const trialAt = firstOf('trial');

		record.reached = { new: record.received };
		if (ourFirst && depth >= 1) record.reached.contacted = ourFirst[0];
		if (depth >= 2)
			record.reached.qualified = lastTalk || trialAt || firstOf('deal') || history[history.length - 1][0];
		if (trialAt) {
			record.reached.trial = trialAt;
			record.trialStarted = trialAt.slice(0, 10);
		}
		if (record.stage === 'converted') record.reached.converted = firstOf('deal') || record.converted;
		if (record.stage === 'notnow') record.parkedFrom = ourFirst ? 'contacted' : 'new';

		const opening = history[0];
		if (opening && opening[1] === record.name && !opening[4]) opening[4] = record.message;
		return record;
	}

	function freeze() {
		return JSON.parse(JSON.stringify(lead));
	}

	function thaw(frozen) {
		for (const key of Object.keys(lead)) {
			if (!(key in frozen)) delete lead[key];
		}
		Object.assign(lead, frozen);
	}

	function addHistory(line, kind, body) {
		const entry = [rightNow(), SAMPLE.me, line, kind];
		if (body !== undefined) entry.push(body);
		lead.history.push(entry);
		return lead.history.length - 1;
	}

	/**
	 * The first email or call to a brand-new lead counts as the first reply
	 * and moves it to Contacted under the current user.
	 */
	function markFirstReply() {
		if (lead.stage !== 'new') return;
		lead.owner ||= SAMPLE.me;
		lead.stage = 'contacted';
		lead.reached.contacted = rightNow();
		lead.reply = minutesSinceReceived();
	}

	/*
	 * Every change repaints the page, shows a toast with Undo, and sends the
	 * request; a rejected request puts the old record back.
	 */

	function paintAll(freshIndex) {
		paintHeader();
		paintRequest();
		paintNextStep();
		paintProgress();
		paintNeeds();
		paintConversation(freshIndex);
		paintDetails();
	}

	function focusFirst(card) {
		pick('button, a[href], input', card)?.focus();
	}

	/**
	 * @param {object} frozen   the record before the change, for Undo
	 * @param {object} message  toast icon, title, text and extra actions
	 * @param {Function} send   makes the request; returns a promise
	 * @param {string} failTitle  toast title when the request rejects
	 * @param {number} [freshIndex]  history entry to animate in
	 */
	function applyChange(frozen, message, send, failTitle, freshIndex) {
		paintAll(freshIndex);
		const undo = () => {
			thaw(frozen);
			paintAll();
			speak('Put back as it was.');
		};
		notify({
			tone: 'success',
			icon: message.icon,
			title: message.title,
			text: message.text,
			duration: 8000,
			actions: [...(message.actions || []), { label: 'Undo', onClick: undo }],
		});
		send().catch(() => {
			undo();
			notify({ tone: 'danger', title: failTitle, text: 'Nothing was saved. Try again in a moment.' });
		});
	}

	/* Header: avatar, name, stage pill, the main button and the "…" menu. */

	function stageBadge(id) {
		const label = id === 'notnow' ? 'Not now' : findStage(id).name;
		return `<span class="ld-stage ld-tone-${id}">${harmless(label)}</span>`;
	}

	function headerExtra() {
		if (lead.stage === 'trial') {
			const tone = dayGap(today, lead.trialEnds) <= 2 ? 'warning' : 'info';
			return `<span class="basalt-status basalt-status-dot basalt-status-${tone}">Trial ${endsLabel(lead.trialEnds).toLowerCase()}</span>`;
		}
		if (lead.stage === 'converted')
			return `<span class="basalt-status basalt-status-success"><i class="bi bi-file-earmark-check" aria-hidden="true"></i>Deal ${harmless(lead.deal)}</span>`;
		if (lead.stage === 'notnow') return `<span class="basalt-status">${harmless(lead.reason)}</span>`;
		return '';
	}

	function primaryButton() {
		if (lead.stage === 'converted')
			return `<a class="btn btn-primary btn-sm" href="${dealLink(lead)}"><i class="bi bi-file-earmark-check me-1" aria-hidden="true"></i>Open the deal</a>`;
		if (lead.stage === 'notnow')
			return '<button type="button" class="btn btn-primary btn-sm" data-ld-act="reopen"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen</button>';
		const step = FORWARD_STEP[lead.stage];
		return `<button type="button" class="btn btn-primary btn-sm" data-ld-act="${step.act}"><i class="bi ${step.icon} me-1" aria-hidden="true"></i>${step.label}</button>`;
	}

	function menuAction(act, icon, label, extraClass) {
		const classes = extraClass ? `dropdown-item ${extraClass}` : 'dropdown-item';
		return `<li><button type="button" class="${classes}" data-ld-act="${act}"><i class="bi ${icon}" aria-hidden="true"></i>${harmless(label)}</button></li>`;
	}

	function menuLink(href, icon, label) {
		return `<li><a class="dropdown-item" href="${href}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</a></li>`;
	}

	function menuItems() {
		const divider = '<li><hr class="dropdown-divider"></li>';
		const first = givenName(lead);
		const items = [menuLink(`mailto:${harmless(lead.email)}`, 'bi-envelope', `Email ${harmless(first)}`)];
		if (lead.phone) items.push(menuLink(phoneHref(lead), 'bi-telephone', `Call ${harmless(first)}`));
		if (stillOpen(lead)) {
			items.push(divider);
			if (lead.stage === 'trial')
				items.push(menuAction('extend', 'bi-calendar-plus', 'Extend the trial by 7 days'));
			if (lead.stage === 'qualified')
				items.push(menuAction('trial', 'bi-hourglass-split', 'Start a 14-day trial'));
			if (lead.owner !== SAMPLE.me) items.push(menuAction('mine', 'bi-person-check', 'Assign to me'));
			items.push(menuAction('notnow', 'bi-pause-circle', 'Move to Not now'));
		}
		items.push(divider, menuLink(LEADS_PAGE, 'bi-envelope-open', 'All leads'));
		if (lead.stage !== 'converted') items.push(menuAction('delete', 'bi-trash', 'Delete lead', 'ld-danger-item'));
		return items.join('');
	}

	function paintHeader() {
		const avatar = pocket('avatar');
		avatar.className = `basalt-avatar basalt-avatar-xl ld-av basalt-avatar-tone-${hueFor(lead.name)}`;
		avatar.textContent = monogram(lead.name);
		write('name', lead.name);
		write('sub', `${lead.title}, ${lead.company} · ${lead.city}`);
		paint('tags', stageBadge(lead.stage) + headerExtra());
		paint('primary', primaryButton());
		paint('menu', menuItems());
		document.title = `${lead.name}, ${lead.company} · Basalt`;
	}

	/* What they asked: the message in their words and how to reach them. */

	function paintRequest() {
		const source = SAMPLE.sources[lead.source];
		const replyNote = lead.reply != null ? `, first reply after ${minutesLabel(lead.reply)}.` : ', no reply yet.';
		const via = lead.via ? ` · ${harmless(lead.via)}` : '';
		const reach = [
			`<li><span class="ld-source"><i class="bi ${source.icon}" aria-hidden="true"></i>${harmless(source.name)}${via}</span></li>`,
			`<li><i class="bi bi-envelope" aria-hidden="true"></i><a class="ld-link" href="mailto:${harmless(lead.email)}">${harmless(lead.email)}</a></li>`,
		];
		if (lead.phone)
			reach.push(
				`<li><i class="bi bi-telephone" aria-hidden="true"></i><a class="ld-link" href="${phoneHref(lead)}">${harmless(lead.phone)}</a></li>`,
			);
		write('ask-desc', `Received ${fullDate(lead.received)} at ${clockTime(lead.received)}${replyNote}`);
		write('message', lead.message);
		paint('reach', reach.join(''));
	}

	/* Next step: the planned task, the trial clock, or where it ended up. */

	function planField(name) {
		return pick(`[data-ld-plan="${name}"]`, ui.planForm);
	}

	function wireNextStep() {
		ui.nextCard = pocket('next-card');
		ui.planForm = pick('[data-ld-plan-form]', ui.stage);
		on(ui.planForm, 'input', (event) => event.target.classList.remove('is-invalid'));
		on(pick('[data-ld-plan-cancel]', ui.planForm), 'click', () => {
			paintNextStep();
			focusFirst(ui.nextCard);
		});
		on(ui.planForm, 'submit', savePlan);
	}

	function whenLabel(step) {
		const dayName =
			step.date === today
				? 'Today'
				: dayGap(today, step.date) === 1
					? 'Tomorrow'
					: DAY_SHORT[parseLocal(step.date).getDay()];
		const atTime = step.time ? ` at ${clockTime(`${today}T${step.time}`)}` : '';
		return `${dayName}, ${monthDay(step.date)}${atTime}`;
	}

	function plannedStepMarkup() {
		const step = lead.next;
		if (!step) {
			return '<p class="ld-next-none">Nothing planned yet.</p><div class="ld-next-cta"><button type="button" class="btn btn-outline-secondary btn-sm" data-ld-act="plan"><i class="bi bi-calendar-plus me-1" aria-hidden="true"></i>Plan a next step</button></div>';
		}
		const note = step.note ? ` · ${harmless(step.note)}` : '';
		return `<div class="ld-task"><span class="ld-task-icon" aria-hidden="true"><i class="bi bi-calendar-event"></i></span><div class="ld-task-text"><p class="ld-task-what">${harmless(step.what)}</p><p class="ld-task-when">${harmless(whenLabel(step))}${note}</p></div><div class="ld-task-actions"><button type="button" class="btn btn-outline-secondary btn-sm btn-square" data-ld-act="done" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Mark done" aria-label="Mark done"><i class="bi bi-check2" aria-hidden="true"></i></button><button type="button" class="btn btn-outline-secondary btn-sm btn-square" data-ld-act="plan" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Change" aria-label="Change the step"><i class="bi bi-pencil" aria-hidden="true"></i></button></div></div>`;
	}

	function trialClockMarkup() {
		const total = dayGap(lead.trialStarted, lead.trialEnds);
		const used = Math.min(total, Math.max(0, dayGap(lead.trialStarted, today)));
		const blocks = Array.from(
			{ length: total },
			(_, index) => `<span class="basalt-segments-block${index < used ? ' is-on' : ''}"></span>`,
		).join('');
		return `<div class="ld-clock"><p class="ld-clock-line"><strong>${harmless(endsLabel(lead.trialEnds))}</strong><span>${used} of ${total} days used</span></p><div class="basalt-segments" role="img" aria-label="${used} of ${total} trial days used">${blocks}</div></div>`;
	}

	function nextStepContent() {
		const byStage = {
			converted: () => [
				`Converted on ${fullDate(lead.converted)}. It carries on as a deal.`,
				`<div class="ld-task"><span class="ld-task-icon" aria-hidden="true"><i class="bi bi-file-earmark-check"></i></span><div class="ld-task-text"><p class="ld-task-what"><a class="ld-link" href="${dealLink(lead)}">Deal ${harmless(lead.deal)}</a>, in ${harmless(dealStageName(lead))}</p><p class="ld-task-when">${dollars(annualValue(lead))} a year · ${harmless(lead.owner)} looks after it</p></div></div>`,
			],
			notnow: () => [
				`On ${fullDate(lead.parked)}: ${lead.reason.toLowerCase()}.`,
				'<p class="ld-next-none">It stays here with its history. Reopen it when the time is right.</p>',
			],
			trial: () => [
				`Convert before the trial ends on ${fullDate(lead.trialEnds)}.`,
				trialClockMarkup() + plannedStepMarkup(),
			],
			new: () => [`Waiting ${minutesLabel(minutesSinceReceived())} for a first reply.`, plannedStepMarkup()],
			contacted: () => ['Find out if they fit, then qualify them.', plannedStepMarkup()],
			qualified: () => ['Qualified. Start a trial or convert to a deal.', plannedStepMarkup()],
		};
		return byStage[lead.stage]();
	}

	function paintNextStep() {
		const [description, body] = nextStepContent();
		ui.nextCard.className = `card basalt-box ld-card ld-next ld-tone-${lead.stage}`;
		ui.nextCard.style.minHeight = '';
		conceal(ui.planForm);
		write('next-title', NEXT_TITLE[lead.stage] || 'Next step');
		write('next-desc', description);
		paint('next-body', body);
		window.Basalt.tips?.(pocket('next-body'));
	}

	function showPlanForm() {
		const draft = lead.next || { what: '', date: shiftDays(today, 1), time: '10:00' };
		planField('what').value = draft.what;
		planField('date').value = draft.date;
		planField('time').value = draft.time || '';
		for (const field of pickAll('.is-invalid', ui.planForm)) field.classList.remove('is-invalid');
		/* The row keeps its height while the step is edited, so the card
		   beside it doesn't move. */
		ui.nextCard.style.minHeight = `${ui.nextCard.offsetHeight}px`;
		paint('next-body', '');
		reveal(ui.planForm);
		planField('what').focus();
	}

	function firstInvalid(checks) {
		for (const [field, ok] of checks) field.classList.toggle('is-invalid', !ok);
		const failed = checks.find(([, ok]) => !ok);
		if (failed) failed[0].focus();
		return !!failed;
	}

	function savePlan(event) {
		event.preventDefault();
		const what = planField('what').value.trim();
		const date = planField('date').value;
		if (
			firstInvalid([
				[planField('what'), !!what],
				[planField('date'), !!date && date >= today],
			])
		)
			return;
		const frozen = freeze();
		const keepNote = lead.next && lead.next.what === what;
		lead.next = { what, note: keepNote ? lead.next.note : '', date, time: planField('time').value };
		applyChange(
			frozen,
			{ icon: 'bi-calendar-event', title: 'Next step saved', text: `${what}, ${monthDay(date)}.` },
			() => backend.update(lead.id, { next: lead.next }),
			'The next step wasn’t saved',
		);
		focusFirst(ui.nextCard);
	}

	/* Where it stands: the five stages across, each with its date. */

	function progressDescription() {
		const since = dayGap(lead.received.slice(0, 10), today);
		if (lead.stage === 'notnow') return `Set aside ${PARKED_PHRASE[lead.parkedFrom]}. Reopening picks it up there.`;
		if (lead.stage === 'converted')
			return `Converted in ${counted(dayGap(lead.received.slice(0, 10), lead.converted), 'day')} from lead to deal.`;
		const position = SAMPLE.stages.findIndex((item) => item.id === lead.stage) + 1;
		const ago = since ? `${counted(since, 'day')} since they got in touch.` : 'they got in touch today.';
		return `Step ${position} of ${SAMPLE.stages.length}, ${ago}`;
	}

	function paintProgress() {
		const current = lead.stage === 'notnow' ? -1 : SAMPLE.stages.findIndex((item) => item.id === lead.stage);
		const skipped = (item) => item.id === 'trial' && !lead.reached.trial && lead.stage === 'converted';
		const daysSince = dayGap(lead.received.slice(0, 10), today);
		const secondLine = (item) => {
			if (item.id === 'new') return SAMPLE.sources[lead.source].name;
			if (item.id === 'contacted' && lead.reply != null) return `First reply in ${minutesLabel(lead.reply)}`;
			if (item.id === 'trial')
				return lead.reached.trial ? `Until ${monthDay(lead.trialEnds)}` : skipped(item) ? '' : 'Optional';
			if (item.id === 'converted' && lead.deal) return `Deal ${lead.deal}`;
			return '';
		};
		const rows = SAMPLE.stages.map((item, index) => {
			const reachedAt = lead.reached[item.id];
			const done = !!reachedAt && (index < current || item.id === 'converted' || lead.stage === 'notnow');
			const now = index === current && item.id !== 'converted';
			const state = done ? 'is-done' : now ? 'is-now' : 'is-todo';
			const hidden = done ? ', done' : now ? ', current step' : skipped(item) ? ', skipped' : ', to do';
			const when = reachedAt ? dayAndTime(reachedAt) : skipped(item) ? 'Skipped' : 'Not yet';
			const extra = secondLine(item);
			const marker = done ? '<i class="bi bi-check-lg"></i>' : index + 1;
			const day = now ? `<span class="ld-step-day" aria-hidden="true">Day ${daysSince + 1}</span>` : '';
			return `<li class="ld-step ${state} ld-tone-${item.id}"${now ? ' aria-current="step"' : ''}>${day}<span class="ld-step-marker" aria-hidden="true">${marker}</span><span class="ld-step-label">${harmless(item.name)}<span class="visually-hidden">${hidden}</span></span><span class="ld-sub">${harmless(when)}${extra ? `<br>${harmless(extra)}` : ''}</span></li>`;
		});
		write('steps-desc', progressDescription());
		paint('steps', rows.join(''));
	}

	/* Fit: a ring that fills to the score, and the reasons under it. */

	function paintFit() {
		const grade = lead.fit >= 75 ? 'strong' : lead.fit >= 55 ? 'fair' : 'weak';
		const radius = 40;
		const circumference = (2 * Math.PI * radius).toFixed(2);
		const target = (2 * Math.PI * radius * (1 - lead.fit / 100)).toFixed(2);
		const box = pocket('fit');
		box.className = `ld-fit ld-fit-${grade}`;
		box.innerHTML = `<div class="ld-ring" role="img" aria-label="Fit ${lead.fit} out of 100"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="ld-ring-track" cx="50" cy="50" r="${radius}"></circle><circle class="ld-ring-value" cx="50" cy="50" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" data-ld-ring="${target}"></circle></svg><span class="ld-ring-num" aria-hidden="true">${lead.fit}</span></div><div><p class="ld-fit-word">${FIT_WORD[grade]}</p><p class="ld-fit-why">${harmless(lead.why)}</p></div>`;
		pocket('reasons').innerHTML = lead.reasons
			.map((reason) => {
				const flavor = reason.good ? 'good' : 'watch';
				const icon = reason.good ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
				const prefix = reason.good ? 'In their favor: ' : 'To watch: ';
				return `<li class="ld-reason ld-reason-${flavor}"><i class="bi ${icon}" aria-hidden="true"></i><span><span class="visually-hidden">${prefix}</span><strong>${harmless(reason.title)}</strong> ${harmless(reason.text)}</span></li>`;
			})
			.join('');
		const gauge = pick('[data-ld-ring]', ui.stage);
		const settle = () => {
			gauge.style.strokeDashoffset = gauge.getAttribute('data-ld-ring');
		};
		if (calmMotion.matches) settle();
		else requestAnimationFrame(() => requestAnimationFrame(settle));
	}

	/* What they need: plan, seats and add-ons, with an in-place form. */

	function addonCheckboxes(idPrefix, hookAttr) {
		return SAMPLE.addons
			.map((addon) => {
				const id = `${idPrefix}${addon.id}`;
				return `<div class="form-check"><input class="form-check-input" type="checkbox" id="${id}" value="${addon.id}" ${hookAttr}><label class="form-check-label" for="${id}">${harmless(addon.name)} <span class="ld-optional">$${addon.price} a seat</span></label></div>`;
			})
			.join('');
	}

	function totalLine(draft, tail) {
		if (!seatsValid(draft.seats)) return 'Enter the number of seats to see the yearly value.';
		return `<strong>${dollars(annualValue(draft))}</strong> a year for ${counted(draft.seats, 'seat')}.${tail || ''}`;
	}

	function wireNeeds() {
		const form = pick('[data-ld-needs-form]', ui.stage);
		ui.needsList = pocket('needs');
		ui.needsEdit = pick('[data-ld-needs-edit]', ui.stage);
		ui.needsForm = form;
		ui.needs = {
			plans: pick('[data-ld-needs-plans]', form),
			seats: pick('[data-ld-needs-seats]', form),
			addons: pick('[data-ld-needs-addons]', form),
			sum: pick('[data-ld-needs-sum]', form),
		};
		ui.needs.plans.innerHTML = SAMPLE.plans
			.map(
				(plan) =>
					`<input type="radio" class="btn-check" name="ld-needs-plan" id="ld-needs-plan-${plan.id}" value="${plan.id}"><label class="basalt-segmented-option" for="ld-needs-plan-${plan.id}">${harmless(plan.name)}</label>`,
			)
			.join('');
		ui.needs.addons.innerHTML = addonCheckboxes('ldNeedsAddon-', 'data-ld-needs-addon');

		on(ui.needsEdit, 'click', showNeedsForm);
		on(form, 'input', (event) => {
			if (event.target === ui.needs.seats) ui.needs.seats.classList.remove('is-invalid');
			paintNeedsTotal();
		});
		on(form, 'change', paintNeedsTotal);
		on(pick('[data-ld-needs-cancel]', form), 'click', () => {
			hideNeedsForm();
			ui.needsEdit.focus();
		});
		on(form, 'submit', saveNeeds);
	}

	function paintNeeds() {
		const plan = findPlan(lead.plan);
		const addonNames = lead.addons.length
			? lead.addons.map((id) => harmless(findAddon(id).name)).join(', ')
			: 'None';
		const addonPrice = lead.addons.length ? `$${addonMonthly(lead.addons)} a seat a month` : '';
		const facts = [
			['Plan', harmless(plan.name), `$${plan.price} a seat a month`],
			['Seats', counted(lead.seats, 'seat'), ''],
			['Add-ons', addonNames, addonPrice],
		];
		const rows = facts.map(
			([label, value, sub]) =>
				`<li class="ld-fact"><span class="ld-fact-label">${label}</span><span class="ld-fact-value">${value}${sub ? `<span class="ld-sub">${sub}</span>` : ''}</span></li>`,
		);
		rows.push(
			`<li class="ld-fact ld-fact-total"><span class="ld-fact-label">A year</span><span class="ld-fact-value">${dollars(annualValue(lead))}<span class="ld-sub">${dollars(annualValue(lead) / 12)} a month</span></span></li>`,
		);
		ui.needsList.innerHTML = rows.join('');
		ui.needsEdit.toggleAttribute('hidden', lead.stage === 'converted');
	}

	function readNeedsForm() {
		return {
			plan: pick('input[name="ld-needs-plan"]:checked', ui.needsForm)?.value || lead.plan,
			seats: parseInt(ui.needs.seats.value, 10) || 0,
			addons: pickAll('[data-ld-needs-addon]:checked', ui.needsForm).map((box) => box.value),
		};
	}

	function paintNeedsTotal() {
		ui.needs.sum.innerHTML = `<i class="bi bi-calculator" aria-hidden="true"></i><span>${totalLine(readNeedsForm())}</span>`;
	}

	function showNeedsForm() {
		const chosen = pick(`#ld-needs-plan-${lead.plan}`, ui.needsForm);
		chosen.checked = true;
		ui.needs.seats.value = lead.seats;
		ui.needs.seats.classList.remove('is-invalid');
		for (const box of pickAll('[data-ld-needs-addon]', ui.needsForm)) box.checked = lead.addons.includes(box.value);
		paintNeedsTotal();
		conceal(ui.needsList, ui.needsEdit);
		reveal(ui.needsForm);
		chosen.focus();
	}

	function hideNeedsForm() {
		conceal(ui.needsForm);
		reveal(ui.needsList);
		ui.needsEdit.toggleAttribute('hidden', lead.stage === 'converted');
	}

	function saveNeeds(event) {
		event.preventDefault();
		const draft = readNeedsForm();
		if (!seatsValid(draft.seats)) {
			ui.needs.seats.classList.add('is-invalid');
			ui.needs.seats.focus();
			return;
		}
		const frozen = freeze();
		Object.assign(lead, draft);
		hideNeedsForm();
		applyChange(
			frozen,
			{
				icon: 'bi-check2',
				title: 'Plan saved',
				text: `${findPlan(lead.plan).name}, ${counted(lead.seats, 'seat')}: ${dollars(annualValue(lead))} a year.`,
			},
			() => backend.update(lead.id, draft),
			'The plan wasn’t saved',
		);
		ui.needsEdit.focus();
	}

	/*
	 * Trial use: stacked bars per trial day, drawn by Chart.js once the card
	 * scrolls into view and redrawn flat on a theme change. A lead with no
	 * trial activity loses the card, and fit and needs share the row.
	 */

	function wireTrial() {
		const hasTrial = !!lead.trial;
		ui.trialCanvas = pick('[data-ld-chart]', ui.stage);
		pick('.ld-trial', ui.stage).toggleAttribute('hidden', !hasTrial);
		pick('.ld-grid', ui.stage).classList.toggle('ld-grid-no-trial', !hasTrial);
		if (hasTrial && 'IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					watcher.disconnect();
					renderTrialChart(true);
				},
				{ rootMargin: '80px 0px' },
			);
			watcher.observe(ui.trialCanvas);
		} else if (hasTrial) {
			renderTrialChart(false);
		}
		on(document, 'basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (trialChart) renderTrialChart(false);
			});
		});
	}

	function paintTrialFigures() {
		const trial = lead.trial;
		const booked = trial.days.reduce((sum, day) => sum + day[1], 0);
		const finished = trial.days.reduce((sum, day) => sum + day[2], 0);
		const perDay = trial.days.map((day) => `${monthDay(day[0])}, ${day[1]} visits, ${day[2]} done`).join('; ');
		write(
			'trial-desc',
			`${trial.active} of ${counted(lead.seats, 'person', 'people')} signed in during the trial.`,
		);
		paint(
			'trial-figs',
			`<div class="ld-figs-item ld-figs-item-jobs"><dt>Visits booked</dt><dd>${booked.toLocaleString('en-US')}</dd></div><div class="ld-figs-item ld-figs-item-signed"><dt>${harmless(trial.done)}</dt><dd>${finished.toLocaleString('en-US')}</dd></div>`,
		);
		write('legend-done', trial.done);
		ui.trialCanvas.setAttribute('aria-label', `Stacked bars, one per trial day: ${perDay}.`);
	}

	function renderTrialChart(animated) {
		if (typeof Chart === 'undefined') return;
		trialChart?.destroy();
		const ink = themeColor('--basalt-copy', '#12233a');
		const quiet = themeColor('--basalt-copy-muted', '#5f7186');
		const hues = {
			grid: themeColor('--basalt-edge', 'rgba(16, 42, 72, .1)'),
			surface: themeColor('--basalt-plane', '#ffffff'),
			border: themeColor('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			done: themeColor('--basalt-series-1', '#2a52e6'),
			open: themeColor('--basalt-series-3', '#22c3a6'),
		};
		const tickStyle = { color: quiet, font: { family: TYPEFACE, size: 11.5 }, padding: 6 };
		const barStyle = {
			borderRadius: 3,
			borderSkipped: false,
			maxBarThickness: 16,
			categoryPercentage: 0.7,
			barPercentage: 0.9,
			stack: 'jobs',
		};
		const days = lead.trial.days;
		const dataset = (label, values, color) => ({ label, data: values, backgroundColor: color, ...barStyle });
		trialChart = new Chart(ui.trialCanvas, {
			type: 'bar',
			data: {
				labels: days.map((day) => monthDay(day[0])),
				datasets: [
					dataset(
						lead.trial.done,
						days.map((day) => day[2]),
						hues.done,
					),
					dataset(
						'Still open',
						days.map((day) => day[1] - day[2]),
						hues.open,
					),
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animated && !calmMotion.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: hues.surface,
						titleColor: ink,
						bodyColor: ink,
						borderColor: hues.border,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: TYPEFACE, size: 12, weight: '600' },
						bodyFont: { family: TYPEFACE, size: 12 },
						callbacks: { label: (point) => ` ${point.dataset.label}: ${point.parsed.y}` },
					},
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: { maxRotation: 0, autoSkipPadding: 14, ...tickStyle },
					},
					y: {
						stacked: true,
						beginAtZero: true,
						grid: { color: hues.grid },
						border: { display: false },
						ticks: { maxTicksLimit: 4, precision: 0, ...tickStyle },
					},
				},
			},
		});
	}

	/* Conversation: the history newest first, and the box that adds to it. */

	function wireConversation() {
		const form = pick('[data-ld-compose]', ui.stage);
		ui.composeForm = form;
		ui.composeText = pick('[data-ld-compose-text]', form);
		ui.entryLine = {
			note: 'Added a note.',
			call: `Logged a call with ${givenName(lead)}.`,
			email: `Logged an email to ${givenName(lead)}.`,
		};
		on(form, 'change', (event) => {
			if (event.target.name === 'ld-kind') ui.composeText.placeholder = ENTRY_HINT[event.target.value];
		});
		on(ui.composeText, 'input', () => ui.composeText.classList.remove('is-invalid'));
		on(form, 'submit', saveEntry);
		on(pick('[data-ld-talk-more]'), 'click', () => {
			window.Basalt.slide(pocket('talk'), () => {
				talkOpen = true;
				paintConversation();
			});
		});
	}

	/* The two newest entries show; the button in the card's head opens the rest. */
	function paintConversation(freshIndex) {
		const entries = lead.history.map((entry, index) => ({ entry, index })).reverse();
		const more = pick('[data-ld-talk-more]');
		const earlier = entries.length - TALK_SHOWN;
		more.hidden = talkOpen || earlier <= 0;
		more.textContent = `Show ${earlier} earlier`;
		pocket('talk').innerHTML = entries
			.slice(0, talkOpen ? entries.length : TALK_SHOWN)
			.map(({ entry, index }) => {
				const [at, author, line, kind, body] = entry;
				const theirs = author === lead.name;
				const tone = theirs ? 'new' : KIND_TONE[kind] || 'notnow';
				const classes = [
					'ld-msg',
					theirs && 'ld-msg-theirs',
					index === freshIndex && 'ld-msg-fresh',
					`ld-tone-${tone}`,
				]
					.filter(Boolean)
					.join(' ');
				const who = author === SAMPLE.me ? 'You' : author;
				const text = body
					? `<p id="ld-msg-${index}" class="ld-msg-body basalt-clamp">${harmless(body)}</p><button type="button" class="basalt-clamp-toggle" data-basalt-clamp-toggle aria-controls="ld-msg-${index}" aria-expanded="false" hidden><span>Read more</span><i class="bi bi-chevron-down" aria-hidden="true"></i></button>`
					: '';
				return `<li class="${classes}"><span class="ld-msg-icon" aria-hidden="true"><i class="bi ${KIND_ICON[kind] || 'bi-dot'}"></i></span><div><p class="ld-msg-head"><strong>${harmless(who)}</strong> · ${harmless(line)}</p>${text}<p class="ld-msg-when">${harmless(dateAndTime(at))}</p></div></li>`;
			})
			.join('');
		window.Basalt.text?.(pocket('talk'));
	}

	function saveEntry(event) {
		event.preventDefault();
		const text = ui.composeText.value.trim();
		if (!text) {
			ui.composeText.classList.add('is-invalid');
			ui.composeText.focus();
			return;
		}
		const kind = pick('input[name="ld-kind"]:checked', ui.composeForm)?.value || 'note';
		const frozen = freeze();
		if (kind !== 'note') markFirstReply();
		const fresh = addHistory(ui.entryLine[kind], kind, text);
		ui.composeText.value = '';
		applyChange(
			frozen,
			{ icon: KIND_ICON[kind], title: 'Added to the conversation' },
			() => backend.log(lead.id, { kind, text }),
			'The note wasn’t saved',
			fresh,
		);
	}

	/* Details: contact facts with an in-place form, and the owner select. */

	function detailField(name) {
		return ui.detailsForm.elements[name];
	}

	function wireDetails() {
		const form = pick('[data-ld-details-form]', ui.stage);
		ui.detailsForm = form;
		ui.detailsList = pocket('details');
		ui.detailsEdit = pick('[data-ld-details-edit]', ui.stage);
		ui.ownerSelect = pick('[data-ld-owner]', ui.stage);
		ui.ownerSelect.innerHTML = `<option value="">Unassigned</option>${ownerOptions()}`;

		on(ui.detailsEdit, 'click', showDetailsForm);
		on(form, 'input', (event) => event.target.classList.remove('is-invalid'));
		on(pick('[data-ld-details-cancel]', form), 'click', () => {
			hideDetailsForm();
			ui.detailsEdit.focus();
		});
		on(form, 'submit', saveDetails);
		on(ui.ownerSelect, 'change', changeOwner);
	}

	function ownerOptions() {
		return SAMPLE.owners.map((owner) => `<option value="${harmless(owner)}">${harmless(owner)}</option>`).join('');
	}

	function paintDetails() {
		const source = SAMPLE.sources[lead.source];
		const [mailbox, ...domainParts] = lead.email.split('@');
		const emailMarkup = `<span class="ld-email">${harmless(mailbox)}@<wbr><span class="ld-email-end">${harmless(domainParts.join('@'))}<button type="button" class="btn btn-icon ld-copy" data-basalt-copy="${harmless(lead.email)}" aria-label="Copy the email address"><i class="bi bi-copy" aria-hidden="true"></i></button></span></span>`;
		const facts = [
			['Name', `${harmless(lead.name)}<span class="ld-sub">${harmless(lead.title)}</span>`],
			['Company', harmless(lead.company)],
			['Email', emailMarkup],
			['Phone', lead.phone ? harmless(lead.phone) : 'Not added'],
			['City', harmless(lead.city)],
			[
				'Came from',
				harmless(source.name) + (lead.via ? `<span class="ld-sub">${harmless(lead.via)}</span>` : ''),
			],
			['Received', harmless(dateAndTime(lead.received))],
		];
		write('details-desc', `Lead ${lead.id}.`);
		ui.detailsList.innerHTML = facts
			.map(([term, value]) => `<div class="ld-dl-row"><dt>${term}</dt><dd>${value}</dd></div>`)
			.join('');
		window.Basalt.buttons?.(ui.detailsList);
		ui.ownerSelect.value = lead.owner || '';
		ui.ownerSelect.disabled = !stillOpen(lead);
		syncSelect(ui.ownerSelect);
	}

	function showDetailsForm() {
		for (const name of ['name', 'title', 'email', 'phone', 'city']) {
			detailField(name).value = lead[name] || '';
			detailField(name).classList.remove('is-invalid');
		}
		conceal(ui.detailsList, ui.detailsEdit);
		reveal(ui.detailsForm);
		detailField('name').focus();
	}

	function hideDetailsForm() {
		conceal(ui.detailsForm);
		reveal(ui.detailsList, ui.detailsEdit);
	}

	function saveDetails(event) {
		event.preventDefault();
		const typed = (name) => detailField(name).value.trim();
		if (
			firstInvalid([
				[detailField('name'), !!typed('name')],
				[detailField('email'), EMAIL_SHAPE.test(typed('email'))],
			])
		)
			return;
		const frozen = freeze();
		const changes = {
			name: typed('name'),
			title: typed('title') || 'Contact',
			email: typed('email'),
			phone: typed('phone'),
			city: typed('city') || 'City not added',
		};
		Object.assign(lead, changes);
		hideDetailsForm();
		applyChange(
			frozen,
			{ icon: 'bi-person-check', title: 'Details saved' },
			() => backend.update(lead.id, changes),
			'The details weren’t saved',
		);
		ui.detailsEdit.focus();
	}

	function changeOwner() {
		const frozen = freeze();
		lead.owner = ui.ownerSelect.value;
		const title = !lead.owner
			? 'Nobody looks after it now'
			: lead.owner === SAMPLE.me
				? 'It’s yours'
				: `${lead.owner} looks after it now`;
		applyChange(
			frozen,
			{ icon: 'bi-person-check', title },
			() => backend.update(lead.id, { owner: lead.owner }),
			'The owner didn’t change',
		);
	}

	/*
	 * Actions from the header button, the "…" menu and the next-step card.
	 * Some open a dialog or the plan form; the rest change the record right
	 * away and describe the change for the toast.
	 */

	function wireActions() {
		on(ui.stage, 'click', (event) => {
			const trigger = event.target.closest('[data-ld-act]');
			if (trigger) performAction(trigger.getAttribute('data-ld-act'));
		});
	}

	const OPENERS = {
		convert: () => openConvertDialog(),
		notnow: () => openParkDialog(),
		delete: () => dialogFor(ui.deleteDialog).show(),
		plan: () => showPlanForm(),
	};

	const QUICK_CHANGES = {
		done() {
			const step = lead.next;
			addHistory(`${step.what}.`, 'done', step.note);
			lead.next = null;
			return {
				icon: 'bi-check2-circle',
				title: 'Next step done',
				text: 'It’s in the conversation. Plan the one after when you’re ready.',
			};
		},
		reply() {
			markFirstReply();
			addHistory(`Replied to ${givenName(lead)}.`, 'email');
			return {
				icon: 'bi-reply',
				title: `${lead.name} marked as replied`,
				text: `First reply after ${minutesLabel(lead.reply)}.`,
			};
		},
		qualify() {
			lead.stage = 'qualified';
			lead.reached.qualified = rightNow();
			addHistory('Marked as qualified.', 'note');
			return {
				icon: 'bi-check2-circle',
				title: `${lead.company} is qualified`,
				text: 'Ready to convert to a deal or start a trial.',
			};
		},
		extend() {
			lead.trialEnds = shiftDays(lead.trialEnds, 7);
			addHistory(`Extended the trial to ${monthDay(lead.trialEnds)}.`, 'trial');
			return {
				icon: 'bi-calendar-plus',
				title: 'Trial extended',
				text: `It now ends on ${fullDate(lead.trialEnds)}.`,
			};
		},
		trial() {
			lead.stage = 'trial';
			lead.trialStarted = today;
			lead.trialEnds = shiftDays(today, 14);
			lead.reached.trial = rightNow();
			addHistory(`Started a 14-day ${findPlan(lead.plan).name} trial.`, 'trial');
			return {
				icon: 'bi-hourglass-split',
				title: `${lead.company} started a trial`,
				text: `It ends on ${fullDate(lead.trialEnds)}.`,
			};
		},
		mine() {
			lead.owner = SAMPLE.me;
			return { icon: 'bi-person-check', title: 'It’s yours' };
		},
		reopen() {
			lead.stage = lead.parkedFrom || 'contacted';
			delete lead.reason;
			delete lead.parked;
			delete lead.parkedFrom;
			addHistory('Reopened the lead.', 'note');
			return {
				icon: 'bi-arrow-counterclockwise',
				title: `${lead.company} reopened`,
				text: `Back at ${findStage(lead.stage).name}.`,
			};
		},
	};

	function performAction(name) {
		if (OPENERS[name]) {
			OPENERS[name]();
			return;
		}
		const change = QUICK_CHANGES[name];
		if (!change) return;
		const frozen = freeze();
		const entriesBefore = lead.history.length;
		const message = change();
		const fresh = lead.history.length > entriesBefore ? lead.history.length - 1 : undefined;
		const send = () => backend.update(lead.id, { stage: lead.stage, owner: lead.owner, trialEnds: lead.trialEnds });
		applyChange(frozen, message, send, 'The lead didn’t change', fresh);
	}

	/* Convert dialog: plan, seats, add-ons, close date and owner for the deal. */

	function wireConvertDialog() {
		const dialog = document.getElementById('ld-convert');
		ui.convertDialog = dialog;
		ui.convertForm = pick('[data-ld-convert-form]', dialog);
		ui.convert = {
			title: pick('[data-ld-convert-title]', dialog),
			plans: pick('[data-ld-convert-plans]', dialog),
			seats: pick('[data-ld-convert-seats]', dialog),
			addons: pick('[data-ld-convert-addons]', dialog),
			close: pick('[data-ld-convert-close]', dialog),
			owner: pick('[data-ld-convert-owner]', dialog),
			sum: pick('[data-ld-convert-sum]', dialog),
		};
		ui.convert.plans.innerHTML = SAMPLE.plans
			.map(
				(plan) =>
					`<label class="basalt-choice-card"><input class="basalt-choice-card-input" type="radio" name="ld-conv-plan" value="${plan.id}"><span class="basalt-choice-card-mark" aria-hidden="true"><i class="bi bi-check-lg"></i></span><span class="basalt-choice-card-title">${harmless(plan.name)}</span><span class="basalt-choice-card-text">$${plan.price} a seat a month</span></label>`,
			)
			.join('');
		ui.convert.addons.innerHTML = addonCheckboxes('ldConvAddon-', 'data-ld-conv-addon');
		ui.convert.owner.innerHTML = ownerOptions();
		syncSelect(ui.convert.owner);

		on(ui.convertForm, 'input', (event) => {
			paintConvertTotal();
			if (event.target === ui.convert.seats || event.target === ui.convert.close)
				event.target.classList.remove('is-invalid');
		});
		on(ui.convertForm, 'change', paintConvertTotal);
		on(ui.convertForm, 'submit', convertLead);
	}

	function readConvertForm() {
		return {
			plan: pick('input[name="ld-conv-plan"]:checked', ui.convertDialog)?.value || lead.plan,
			seats: parseInt(ui.convert.seats.value, 10) || 0,
			addons: pickAll('[data-ld-conv-addon]:checked', ui.convertDialog).map((box) => box.value),
		};
	}

	function paintConvertTotal() {
		const tail = ` ${harmless(ui.convert.owner.value)} looks after it as a deal.`;
		ui.convert.sum.innerHTML = `<i class="bi bi-calculator" aria-hidden="true"></i><span>${totalLine(readConvertForm(), tail)}</span>`;
	}

	function openConvertDialog() {
		const fields = ui.convert;
		const trialRunning = lead.stage === 'trial' && lead.trialEnds > today;
		ui.convertForm.reset();
		fields.title.textContent = `Convert ${lead.company} to a deal`;
		pick(`input[name="ld-conv-plan"][value="${lead.plan}"]`, ui.convertDialog).checked = true;
		fields.seats.value = lead.seats;
		for (const box of pickAll('[data-ld-conv-addon]', ui.convertDialog))
			box.checked = lead.addons.includes(box.value);
		fields.close.value = trialRunning ? shiftDays(lead.trialEnds, 14) : '2026-11-30';
		fields.owner.value = lead.owner || SAMPLE.me;
		syncSelect(fields.owner);
		fields.seats.classList.remove('is-invalid');
		fields.close.classList.remove('is-invalid');
		paintConvertTotal();
		dialogFor(ui.convertDialog).show();
	}

	function convertLead(event) {
		event.preventDefault();
		const fields = ui.convert;
		const draft = readConvertForm();
		const seatsOk = seatsValid(draft.seats);
		const closeOk = fields.close.value && fields.close.value >= today;
		fields.seats.classList.toggle('is-invalid', !seatsOk);
		fields.close.classList.toggle('is-invalid', !closeOk);
		if (!seatsOk) {
			fields.seats.focus();
			return;
		}
		if (!closeOk) {
			fields.close.focus();
			return;
		}
		const frozen = freeze();
		Object.assign(lead, draft, {
			owner: fields.owner.value,
			stage: 'converted',
			converted: today,
			deal: `#${highestDeal + 1}`,
			next: null,
		});
		lead.reached.converted = rightNow();
		const fresh = addHistory(
			`Converted to a ${findPlan(draft.plan).name} deal for ${counted(draft.seats, 'seat')}.`,
			'deal',
		);
		dialogFor(ui.convertDialog).hide();
		const message = {
			icon: 'bi-arrow-right-circle',
			title: `${lead.company} is now a deal`,
			text: `${dollars(annualValue(lead))} a year, in Discovery.`,
			actions: [
				{
					label: 'Open the deal',
					ghost: true,
					onClick: () => {
						window.location.href = dealLink(lead);
					},
				},
			],
		};
		const payload = {
			plan: lead.plan,
			seats: lead.seats,
			addons: lead.addons,
			closes: fields.close.value,
			owner: lead.owner,
		};
		applyChange(frozen, message, () => backend.convert(lead.id, payload), 'Couldn’t convert the lead', fresh);
	}

	/* Not now dialog: pick a reason, and the lead leaves the open list. */

	function wireParkDialog() {
		const dialog = document.getElementById('ld-not-now');
		ui.parkDialog = dialog;
		ui.parkForm = pick('[data-ld-notnow-form]', dialog);
		pick('[data-ld-notnow-reasons]', dialog).innerHTML = SAMPLE.notNowReasons
			.map((reason, index) => {
				const id = `ld-not-now-r-${index}`;
				return `<input type="radio" class="btn-check" name="ld-notnow-reason" id="${id}" value="${harmless(reason)}"${index === 0 ? ' checked' : ''}><label class="ld-chip" for="${id}">${harmless(reason)}</label>`;
			})
			.join('');
		on(ui.parkForm, 'submit', parkLead);
	}

	function openParkDialog() {
		pick('[data-ld-notnow-title]', ui.parkDialog).textContent = `Move ${lead.company} to Not now?`;
		ui.parkForm.reset();
		dialogFor(ui.parkDialog).show();
	}

	function parkLead(event) {
		event.preventDefault();
		const reason = pick('input[name="ld-notnow-reason"]:checked', ui.parkDialog)?.value || SAMPLE.notNowReasons[0];
		const frozen = freeze();
		Object.assign(lead, { parkedFrom: lead.stage, stage: 'notnow', reason, parked: today, next: null });
		const fresh = addHistory(`Not now: ${reason.toLowerCase()}.`, 'pause');
		dialogFor(ui.parkDialog).hide();
		applyChange(
			frozen,
			{ icon: 'bi-pause-circle', title: `${lead.company} moved to Not now`, text: `${reason}.` },
			() => backend.update(lead.id, { stage: 'notnow', reason }),
			'Couldn’t move the lead',
			fresh,
		);
	}

	/* Delete dialog: confirm, then leave for the list. */

	function wireDeleteDialog() {
		const dialog = document.getElementById('ld-delete');
		const confirmButton = pick('[data-ld-delete-confirm]', dialog);
		ui.deleteDialog = dialog;
		on(dialog, 'show.bs.modal', () => {
			pick('[data-ld-delete-title]', dialog).textContent = `Delete ${lead.name}’s lead?`;
		});
		on(confirmButton, 'click', () => {
			confirmButton.disabled = true;
			backend
				.remove(lead.id)
				.then(() => {
					window.location.href = LEADS_PAGE;
				})
				.catch(() => {
					confirmButton.disabled = false;
					notify({ tone: 'danger', title: 'Couldn’t delete the lead', text: 'Try again in a moment.' });
				});
		});
	}

	start();
})();
