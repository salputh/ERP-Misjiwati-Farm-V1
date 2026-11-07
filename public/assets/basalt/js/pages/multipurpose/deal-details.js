/**
 * The single-deal screen on deal-details.html.
 *
 * The top card answers "how is this deal doing": its yearly value, the
 * close date, the odds of signing and a five-step stage track. Below it
 * sit the to-do list, the contacts, the plan change the deal brings, an
 * editable fact sheet, the history and the attachments.
 *
 * The big header button pushes the deal one stage forward, and the
 * overflow menu opens the editor or records a loss. Each change repaints
 * everything and offers an Undo inside its toast.
 *
 * Hooking up real data takes two edits. Swap `fixture` for the payload
 * your server sends for one deal, keeping its shape, since every number
 * and sentence here is derived from it. Then point the methods of
 * `backend` at your endpoints: the screen changes first and rolls back,
 * with an error toast, when a request is rejected. Avatars, select
 * menus, the segmented switch, undo toasts and the ring all come from
 * basalt.js.
 */
(() => {
	'use strict';

	const dealView = pick('[data-dv-root]');
	if (!dealView) return;

	/*
	 * Deals, the Deal Pipeline, Quotes and every account screen open this
	 * page with ?id=%232021 or with a slug of the deal name. The record is
	 * read from assets/basalt/js/data/multipurpose/deals.js, so it matches those screens, and
	 * an id nobody knows falls back to #2021. Facts that only this screen
	 * needs (stage dates, the to-do list, attachments) are filled in from
	 * the record whenever it leaves them out.
	 */
	const dealBook = window.Basalt.data.deals;
	const accountBook = window.Basalt.data.accounts;
	const catalog = dealBook.products;
	const sourceRecord = dealBook.find(new URLSearchParams(location.search).get('id')) || dealBook.find('#2021');

	const KIND_LABELS = { new: 'New customer', seats: 'More seats', upgrade: 'Plan upgrade', addon: 'Add-on' };
	/* Each plan's display name and the tone its tile wears. */
	const PLAN_FACTS = { starter: ['Basic', 5], growth: ['Pro', 2], enterprise: ['Max', 3] };
	/* Three things a buyer gains from each catalog line, for "What they get". */
	const PERKS_GROWTH = [
		['bi-arrow-repeat', 'Recurring visits'],
		['bi-file-earmark-text', 'Quotes and invoices'],
		['bi-ui-checks', 'Custom visit forms'],
	];
	const PERKS_ENTERPRISE = [
		['bi-journal-check', 'Audit logs'],
		['bi-shield-lock', 'Single sign-on'],
		['bi-images', 'Visit photos kept 7 years'],
	];
	const PERKS_BY_SKU = {
		'FL-STA': [
			['bi-calendar3', 'Shared calendar'],
			['bi-phone', 'Visits on every phone'],
			['bi-chat-left-text', 'Visit notes and photos'],
		],
		'FL-GRO': PERKS_GROWTH,
		'FL-UPG': PERKS_GROWTH,
		'FL-ENT': PERKS_ENTERPRISE,
		'FL-UPE': PERKS_ENTERPRISE,
		'FL-ROUTE': [
			['bi-signpost-split', 'Shorter drives'],
			['bi-clock', 'Day plans in minutes'],
			['bi-geo-alt', 'Live arrival times'],
		],
		'FL-PORTAL': [
			['bi-calendar-check', 'Customers book online'],
			['bi-envelope-paper', 'Visit reports by email'],
			['bi-credit-card', 'Invoices paid online'],
		],
		'FL-SMS': [
			['bi-chat-dots', 'Visit reminders by text'],
			['bi-calendar-x', 'Fewer missed visits'],
			['bi-reply', 'Replies to confirm'],
		],
	};
	/* The move a deal normally makes once it reaches each stage. */
	const USUAL_NEXT_MOVE = {
		discovery: 'Send the proposal',
		proposal: 'Agree the terms',
		negotiation: 'Send the contract for signature',
		signature: 'Book the kick-off call',
	};
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MS_PER_DAY = 86400000;
	const MEGABYTE = 1048576;
	const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const EVENT_ICONS = {
		eye: 'bi-eye',
		envelope: 'bi-envelope',
		chat: 'bi-chat-left-text',
		flag: 'bi-flag',
		note: 'bi-sticky',
		call: 'bi-telephone',
		email: 'bi-envelope',
		stage: 'bi-signpost-split',
		lost: 'bi-x-circle',
		signed: 'bi-pen',
		edit: 'bi-pencil',
		file: 'bi-paperclip',
		check: 'bi-check2-circle',
		calendar: 'bi-calendar-event',
		display: 'bi-display',
		pen: 'bi-pen',
		arrow: 'bi-arrow-right-circle',
		x: 'bi-x-circle',
	};
	/* Pattern, icon and tone per attachment type; the last row takes the rest. */
	const FILE_TYPES = [
		[/\.pdf$/i, 'bi-file-earmark-pdf', 'danger'],
		[/\.(xlsx?|csv|numbers)$/i, 'bi-file-earmark-spreadsheet', 'success'],
		[/\.(png|jpe?g|gif|webp|heic)$/i, 'bi-file-earmark-image', 'image'],
		[/./, 'bi-file-earmark-text', 'info'],
	];
	const LOG_PREFIX = { note: '', call: 'Call: ', email: 'Email: ' };
	const STEP_STATE_WORDS = {
		'is-done': 'done',
		'is-now': 'current stage',
		'is-stopped': 'lost here',
		'is-todo': 'to come',
	};
	/* Before, after and a one-line summary per kind of deal; add-ons fall back to addonCoverage. */
	const COVERAGE_BY_KIND = { new: newCustomerCoverage, upgrade: upgradeCoverage, seats: seatCoverage };

	const fixture = {
		/* A frozen "today" keeps the demo stable; a live app uses the real date. */
		today: dealBook.today,
		me: 'John Armstrong',
		stages: dealBook.stages,
		owners: dealBook.owners,
		sources: dealBook.sources,
		lostReasons: dealBook.lostReasons,
		deal: buildDeal(sourceRecord),
	};

	/*
	 * Every write goes through one of these. The demo resolves after a
	 * brief delay, the way a network round trip would.
	 */
	const backend = {
		save(dealData) {
			return pause(250);
		},
		log(entry) {
			return pause(250);
		},
		upload(file) {
			return pause(400);
		},
	};

	const todayDate = parseDay(fixture.today);
	let active = JSON.parse(JSON.stringify(fixture.deal));

	const lostDialog = document.getElementById('dv-lost');
	const lostForm = pick('[data-dv-lost-form]');
	const editToggle = pick('[data-dv-edit]');
	const editForm = pick('[data-dv-edit-form]');
	const factList = hook('facts');
	const field = {
		count: pick('[data-dv-edit-seats]'),
		closing: pick('[data-dv-edit-close]'),
		owner: pick('[data-dv-edit-owner]'),
		source: pick('[data-dv-edit-source]'),
		worth: pick('[data-dv-edit-sum]'),
	};
	const stepForm = pick('[data-dv-todo-form]');
	const stepText = pick('[data-dv-todo-text]');
	const stepDue = pick('[data-dv-todo-due]');
	const historyForm = pick('[data-dv-log-form]');
	const historyInput = pick('[data-dv-log-text]');
	const filePicker = pick('[data-dv-file-input]');
	const dropTarget = pick('[data-dv-drop]');

	start();

	/** Fill the static choices, attach every handler, then draw the deal once. */
	function start() {
		fillChoices();
		wireLostDialog();
		wireEditor();
		wireChecklist();
		wireNotes();
		wireFiles();
		wireHeader();
		paint();
		drawTrail(hook('steps'));
	}

	function fillChoices() {
		const reasons = fixture.lostReasons.map(
			(reason, index) =>
				`<label class="basalt-choice"><input type="radio" name="dv-lost-reason" value="${htmlSafe(reason)}"${index === 0 ? ' checked' : ''}>${htmlSafe(reason)}</label>`,
		);
		pick('[data-dv-lost-reasons]').insertAdjacentHTML('beforeend', reasons.join(''));
		field.owner.innerHTML = optionsFor(fixture.owners);
		field.source.innerHTML = optionsFor(fixture.sources);
		field.closing.min = fixture.today;
		stepDue.min = fixture.today;
		stepDue.value = weekFromToday();
	}

	/**
	 * Grows the passed connectors the first time the stops are on screen.
	 * Later repaints show them already drawn.
	 */
	function drawTrail(trail) {
		const lines = pickAll('.dv-step.is-done:not(:last-child)', trail);
		if (!lines.length || !window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		lines.forEach((line, at) => line.style.setProperty('--dv-trail-at', at));
		let left = lines.length;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'dv-trail-grow' || --left) return;
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

	function optionsFor(names) {
		return names.map((label) => `<option>${htmlSafe(label)}</option>`).join('');
	}

	/* The header and its menu act through data-dv-act; one listener serves all. */
	function wireHeader() {
		const actions = {
			next: advance,
			back: stepBack,
			reopen: revive,
			unsign: withdrawSignature,
			lose: (button) => window.bootstrap.Modal.getOrCreateInstance(lostDialog).show(button),
			edit: () => {
				pick('#dv-details-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
				if (editForm.hidden) showEditor();
			},
		};
		dealView.addEventListener('click', (event) => {
			const button = event.target.closest('[data-dv-act]');
			const name = button?.getAttribute('data-dv-act');
			if (button && Object.hasOwn(actions, name)) actions[name](button);
		});
	}

	/** Turn a record from deals.js into the shape this screen reads and writes. */
	function buildDeal(raw) {
		const stageId = raw.stage === 'lost' ? raw.lostFrom : raw.stage;
		const reached = stageDates(
			raw,
			dealBook.stages.findIndex((entry) => entry.id === stageId),
		);
		const account = raw.acct ? accountBook.find(raw.acct) : null;
		const ownerCard = {
			name: raw.owner,
			role: 'Fieldline',
			part: 'Owner',
			email: teamEmail(raw.owner),
			page: dealBook.ownerUrl(raw.owner),
		};

		return {
			id: raw.id,
			acct: raw.acct,
			company: raw.company,
			city: raw.city,
			kind: KIND_LABELS[raw.kind],
			kindId: raw.kind,
			title: raw.title,
			stage: stageId,
			lost: raw.stage === 'lost' ? { on: raw.lost, reason: raw.reason } : undefined,
			reached,
			closes: raw.closes,
			renews: account ? account.renews : null,
			owner: raw.owner,
			source: raw.source,
			created: raw.created,
			plan: raw.plan,
			lines: raw.lines,
			oneOff: raw.oneOff,
			current: raw.current || null,
			today: raw.today || '',
			afterWin: raw.afterWin || '',
			quote: raw.quote || null,
			lead: raw.lead || null,
			adds: raw.why || perksFor(raw),
			people: [...raw.people.map(contactCard), ownerCard],
			todo: (raw.todo || checklistFor(raw)).map((item, index) => ({
				id: `t${index + 1}`,
				text: item.text,
				due: item.due,
				done: !!item.done,
			})),
			activity: raw.history.map((event) => event.slice()),
			files: (raw.files || attachmentsFor(raw, reached)).map(([name, bytes, day]) => ({
				name,
				size: bytes,
				by: raw.owner,
				on: day,
			})),
		};
	}

	/**
	 * The day each stage up to the current one was reached. Dates the
	 * record states win; next come the days its history shows a proposal
	 * or contract going out; any gap left is placed halfway between the
	 * nearest known days on either side.
	 */
	function stageDates(raw, upto) {
		const journey = dealBook.stages.slice(0, upto + 1);
		const known = Object.assign({}, raw.reached || {});
		const newest = raw.stage === 'signed' ? raw.signed : raw.history.length ? raw.history[0][0] : raw.created;
		const evidence = {
			discovery: raw.created,
			proposal: earliestMention(raw, /proposal|quote|order form/i),
			signature: earliestMention(raw, /contract for signature|final contract/i),
			signed: raw.signed,
		};

		for (const stage of journey) {
			if (!known[stage.id] && evidence[stage.id]) known[stage.id] = evidence[stage.id];
		}
		for (const [position, stage] of journey.entries()) {
			if (known[stage.id]) continue;
			const earlier =
				journey
					.slice(0, position)
					.map((entry) => known[entry.id])
					.filter(Boolean)
					.pop() || raw.created;
			const later =
				journey
					.slice(position + 1)
					.map((entry) => known[entry.id])
					.find(Boolean) || newest;
			known[stage.id] = position === upto ? newest : midpoint(earlier, later);
		}
		return known;
	}

	function earliestMention(raw, pattern) {
		const hit = raw.history.findLast((event) => pattern.test(event[2]));
		return hit ? hit[0] : null;
	}

	/** The default to-do list: what comes next, the usual move after it, and the owner's latest action. */
	function checklistFor(raw) {
		const items = [];
		const contactFirstName = raw.people.length ? raw.people[0].name.split(' ')[0] : '';

		if (raw.stage === 'signed') {
			items.push({ text: dropStop(raw.afterWin || 'Send the welcome email'), due: shiftDay(raw.signed, 6) });
		} else if (raw.stage !== 'lost') {
			if (raw.next) items.push({ text: dropStop(raw.next[0]), due: raw.next[1] });
			let target = raw.closes;
			if (raw.next) target = raw.next[1] > raw.closes ? raw.next[1] : midpoint(raw.next[1], raw.closes);
			const withWhom = raw.stage === 'proposal' && contactFirstName ? ` with ${contactFirstName}` : '';
			items.push({
				text: `${USUAL_NEXT_MOVE[raw.stage]}${withWhom}`,
				due: target > dealBook.today ? target : shiftDay(dealBook.today, 3),
			});
		}

		const ownersLast = raw.history.find((event) => event[1] === raw.owner);
		if (ownersLast) items.push({ text: dropStop(ownersLast[2]), due: ownersLast[0], done: true });
		return items;
	}

	/** The default attachments, one for each document the deal would have sent so far. */
	function attachmentsFor(raw, reached) {
		const leadSku = raw.lines[0][0];
		let paperwork;
		if (raw.kind === 'addon') paperwork = `${catalog[leadSku].name.replace(/, .*/, '')} order form`;
		else if (raw.kind === 'seats') paperwork = `Order form, ${raw.lines[0][1]} seats`;
		else paperwork = `${PLAN_FACTS[raw.plan][0]} proposal`;

		/* A stable, plausible byte count between floor and twice the floor. */
		const bytesFor = (label, floor) => floor + (hashText(`${label}${raw.id}`) % floor);
		const list = [];

		if (reached.signature)
			list.push([
				raw.stage === 'signed' ? 'Signed contract.pdf' : 'Contract.pdf',
				bytesFor('contract', 180000),
				reached.signature,
			]);
		if (reached.proposal) {
			list.push([`${paperwork}.pdf`, bytesFor(paperwork, 260000), reached.proposal]);
			if (raw.plan === 'enterprise' && (raw.kind === 'new' || raw.kind === 'upgrade'))
				list.push(['Security overview.pdf', 1258291, reached.proposal]);
		}
		if (list.length === 0) list.push(['Discovery notes.docx', bytesFor('notes', 24000), raw.created]);
		return list;
	}

	/* A seat deal lists what more seats bring; any other deal shows the perks of its main line. */
	function perksFor(raw) {
		if (raw.kind === 'seats')
			return [
				['bi-people', `${raw.lines[0][1]} more people on the app`],
				['bi-tag', 'The same price a seat'],
				['bi-receipt', 'On the next yearly bill'],
			];
		const mainLine = raw.kind === 'new' && raw.lines.length > 1 ? raw.lines[0] : raw.lines[raw.lines.length - 1];
		return PERKS_BY_SKU[mainLine[0]];
	}

	function contactCard(person) {
		return {
			name: person.name,
			role: person.title,
			part: person.part,
			email: person.email,
			phone: person.phone,
			page: person.key ? `person-details.html?id=${encodeURIComponent(person.key)}` : '',
		};
	}

	function teamEmail(wholeName) {
		return `${wholeName.split(' ')[0].toLowerCase()}@fieldline.app`;
	}

	function dropStop(sentence) {
		return sentence.replace(/\.$/, '');
	}

	function midpoint(fromDay, toDay) {
		return shiftDay(fromDay, Math.round(((new Date(toDay) - new Date(fromDay)) / MS_PER_DAY) * 0.5));
	}

	function hashText(text) {
		let hash = 0;
		for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
		return hash;
	}

	/* Questions the drawing code asks about the deal as it stands now. */

	function stageIndex(id) {
		return fixture.stages.findIndex((stage) => stage.id === id);
	}

	function stageById(id) {
		return fixture.stages[stageIndex(id)];
	}

	function stillOpen() {
		return !active.lost && active.stage !== 'signed';
	}

	function annualValue() {
		return dealBook.yearly(active);
	}

	/* The first line sets the count the deal is priced on: seats or SMS bundles. */
	function quantity() {
		return active.lines[0][1];
	}

	function quantityLabel() {
		if (catalog[active.lines[0][0]].unit === 'bundle') return 'Bundles a month';
		return active.kindId === 'seats' ? 'Seats added' : 'Seats';
	}

	function pricePerUnit() {
		let total = 0;
		for (const [sku, count] of active.lines) {
			if (count === quantity()) total += catalog[sku].price;
		}
		return total;
	}

	/* What the account already pays a year for its plan and add-ons. */
	function currentAnnual() {
		return active.acct ? Math.round(accountBook.listMrr(accountBook.find(active.acct)) * 12) : 0;
	}

	function winChance() {
		return active.lost ? 0 : stageById(active.stage).chance;
	}

	/* Customers and prospects alike have a company page. */
	function companyHref() {
		return `company-details.html?id=${encodeURIComponent(active.acct || dealBook.slug(active.company))}`;
	}

	/* Drawing writes every card from the deal; nothing is patched piecemeal. */

	function paint() {
		paintHeader();
		paintNotice();
		paintStanding();
		paintChecklist();
		paintPeople();
		paintCoverage();
		paintFacts();
		paintHistory();
		paintFiles();
	}

	function paintHeader() {
		const badge = hook('logo');
		badge.className = `dv-logo dv-tone-${toneFor(active.company)}`;
		badge.textContent = monogram(active.company);
		hook('company').textContent = active.company;
		hook('sub').textContent = `${active.title} · ${active.city}`;
		hook('tags').innerHTML =
			`${stageBadge()}<span class="dv-tag">${htmlSafe(active.kind)}</span><span class="dv-tag">${htmlSafe(active.id)}</span>`;
		document.title = `${active.company} deal · Basalt`;
		hook('primary').innerHTML = primaryAction();
		hook('menu').innerHTML = overflowItems().join('');
	}

	function stageBadge() {
		if (active.lost) return '<span class="basalt-status basalt-status-danger basalt-status-dot">Lost</span>';
		const stage = stageById(active.stage);
		if (stage.id === 'signed')
			return '<span class="basalt-status basalt-status-success basalt-status-dot">Signed</span>';
		return `<span class="dv-stage-pill dv-tone-${stage.tone}">${htmlSafe(stage.name)}</span>`;
	}

	/* The header carries a single main button, chosen by the deal's state. */
	function primaryAction() {
		if (active.lost)
			return '<button type="button" class="btn btn-primary btn-sm" data-dv-act="reopen"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen</button>';
		if (active.stage === 'signed')
			return '<a class="btn btn-primary btn-sm" href="invoice-details.html"><i class="bi bi-receipt me-1" aria-hidden="true"></i>First invoice</a>';
		const [icon, label] =
			active.stage === 'signature' ? ['bi-pen', 'Mark as signed'] : ['bi-arrow-right', 'Next stage'];
		return `<button type="button" class="btn btn-primary btn-sm" data-dv-act="next"><i class="bi ${icon} me-1" aria-hidden="true"></i>${label}</button>`;
	}

	function overflowItems() {
		const position = stageIndex(active.stage);
		const items = [
			'<li><button type="button" class="dropdown-item" data-dv-act="edit"><i class="bi bi-pencil" aria-hidden="true"></i>Edit details</button></li>',
		];
		if (active.quote)
			items.push(
				`<li><a class="dropdown-item" href="quote-details.html?id=${encodeURIComponent(active.quote)}"><i class="bi bi-file-earmark-text" aria-hidden="true"></i>Open quote</a></li>`,
			);
		items.push(
			`<li><a class="dropdown-item" href="${companyHref()}"><i class="bi bi-buildings" aria-hidden="true"></i>Company page</a></li>`,
		);
		if (active.lead)
			items.push(
				`<li><a class="dropdown-item" href="lead-details.html?id=${encodeURIComponent(active.lead)}"><i class="bi bi-envelope-open" aria-hidden="true"></i>The lead</a></li>`,
			);
		if (stillOpen()) {
			if (position > 0)
				items.push(
					`<li><button type="button" class="dropdown-item" data-dv-act="back"><i class="bi bi-arrow-left" aria-hidden="true"></i>Back to ${htmlSafe(fixture.stages[position - 1].name)}</button></li>`,
				);
			items.push(
				'<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item dv-danger-item" data-dv-act="lose"><i class="bi bi-x-circle" aria-hidden="true"></i>Mark as lost</button></li>',
			);
		}
		if (active.stage === 'signed')
			items.push(
				'<li><button type="button" class="dropdown-item" data-dv-act="unsign"><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>Reopen</button></li>',
			);
		return items;
	}

	/* A closed deal, won or lost, gets one line above the grid saying so. */
	function paintNotice() {
		const banner = hook('notice');
		if (!active.lost && active.stage !== 'signed') {
			banner.hidden = true;
			return;
		}
		if (active.lost) {
			banner.className = 'dv-notice dv-notice-danger';
			banner.innerHTML = `<i class="bi bi-x-circle" aria-hidden="true"></i><span>Lost on ${shortDate(active.lost.on)} at ${htmlSafe(stageById(active.stage).name)}: ${htmlSafe(uncapitalize(active.lost.reason))}. It is out of the forecast.</span>`;
		} else {
			let tail = '';
			if (active.kindId === 'upgrade')
				tail = ` ${PLAN_FACTS[active.plan][0]} starts with the renewal on ${shortDate(active.renews)}.`;
			else if (active.afterWin) tail = ` Next: ${htmlSafe(uncapitalize(active.afterWin))}`;
			banner.className = 'dv-notice dv-notice-success';
			banner.innerHTML = `<i class="bi bi-check-circle" aria-hidden="true"></i><span>Signed on ${shortDate(active.reached.signed)}.${tail}</span>`;
		}
		banner.hidden = false;
	}

	function paintStanding() {
		const stage = stageById(active.stage);
		const nextItem = active.todo.find((item) => !item.done);
		hook('stand-desc').textContent = standingSummary(stage, nextItem);

		hook('value').textContent = dollars(annualValue());
		hook('value-note').textContent = valueNote();

		/* After signing, the date tile switches from the close date to the signing day. */
		const isWon = !active.lost && active.stage === 'signed';
		const shown = parseDay(isWon ? active.reached.signed : active.closes);
		hook('close-label').textContent = isWon ? 'Signed' : active.lost ? 'Was to close' : 'Closes';
		hook('close').textContent = longDate(isoDay(shown));
		hook('cdr-month').textContent = MONTH_ABBR[shown.getMonth()];
		hook('cdr-day').textContent = shown.getDate();
		const closing = hook('close-note');
		closing.textContent = closingNote();
		closing.classList.toggle('dv-note-late', stillOpen() && daysAway(active.closes) < 0);

		/* The card's wash and the ring both pick up the stage's hue. */
		pick('.dv-card-stand', dealView).className =
			`card basalt-box dv-card dv-card-stand dv-tone-${active.lost ? 'lost' : stage.tone}`;
		const odds = winChance();
		const ring = hook('ring');
		ring.style.setProperty('--value', odds);
		ring.classList.toggle('is-empty', odds === 0);
		ring.setAttribute('aria-label', `${odds}% chance of signing`);
		hook('chance').textContent = `${odds}%`;
		hook('forecast').textContent = dollars((annualValue() * odds) / 100);
		let oddsNote = `${odds}% chance of signing`;
		if (active.lost) oddsNote = `Lost at ${stage.name}`;
		else if (active.stage === 'signed') oddsNote = 'Won in full';
		hook('chance-note').textContent = oddsNote;
		hook('owner-fact').className = `dv-fact dv-tone-${toneFor(active.owner)}`;
		hook('owner-avatar').innerHTML = avatarChip(active.owner, 'dv-fact-avatar');
		hook('owner').innerHTML =
			`<a class="dv-person-link" href="${dealBook.ownerUrl(active.owner)}"><span>${htmlSafe(active.owner)}</span></a>`;

		hook('steps').innerHTML = fixture.stages.map(stageStep).join('');
	}

	function standingSummary(stage, nextItem) {
		if (active.lost) return `Lost at ${stage.name}. Reopen it to put it back in the forecast.`;
		if (active.stage === 'signed') return 'Signed. The next job is the first invoice.';
		const upcoming = nextItem ? ` Next: ${nextItem.text}, due ${shortDate(nextItem.due)}.` : '';
		return `At ${stage.name} since ${shortDate(active.reached[active.stage])}.${upcoming}`;
	}

	function valueNote() {
		const monthly = dollars(annualValue() / 12);
		if (active.acct) return `${monthly} a month on top of the ${dollars(currentAnnual() / 12)} they pay now.`;
		if (!active.oneOff.length) return `About ${monthly} a month, billed yearly.`;
		let setup = 0;
		for (const [sku, count] of active.oneOff) setup += catalog[sku].price * count;
		return `About ${monthly} a month, plus ${dollars(setup)} one-off.`;
	}

	function closingNote() {
		if (active.lost) return `Lost on ${shortDate(active.lost.on)}`;
		if (active.stage === 'signed')
			return active.kindId === 'upgrade'
				? `Starts ${shortDate(active.renews)}, at renewal`
				: `Starts ${shortDate(active.closes)}`;
		const gap = daysAway(active.closes);
		let label = `In ${countOf(gap, 'day')}`;
		if (gap < 0) label = `${countOf(-gap, 'day')} late`;
		else if (gap === 0) label = 'Today';
		return `${label}${active.closes === active.renews ? ', at renewal' : ''}`;
	}

	/**
	 * One stop on the stage track. Finished stops show a check in their
	 * hue, the live one is ringed, later ones stay numbered and faint,
	 * and a lost deal halts with a cross where it fell through.
	 */
	function stageStep(stage, position) {
		const current = stageIndex(active.stage);
		let state = 'is-todo';
		let marker = String(position + 1);
		let note = '';

		if (position < current || (position === current && stage.id === 'signed')) {
			state = 'is-done';
			marker = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
			note = shortDate(active.reached[stage.id]);
		} else if (position === current && active.lost) {
			state = 'is-stopped';
			marker = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
			note = 'Lost here';
		} else if (position === current) {
			state = 'is-now';
			note = `Since ${shortDate(active.reached[stage.id])}`;
		} else if (stage.id === 'signed') {
			note = `Aim: ${shortDate(active.closes)}`;
		} else if (position === current + 1 && !active.lost) {
			note = 'Next';
		}

		const currentMark = state === 'is-now' ? ' aria-current="step"' : '';
		return `<li class="dv-step ${state} dv-tone-${stage.tone}"${currentMark}><span class="dv-step-marker" aria-hidden="true">${marker}</span><span class="dv-step-text"><span class="dv-step-label">${htmlSafe(stage.name)}<span class="visually-hidden">, ${STEP_STATE_WORDS[state]}</span></span><span class="dv-step-when">${htmlSafe(note)}</span></span></li>`;
	}

	function paintChecklist() {
		const pending = active.todo
			.filter((item) => !item.done)
			.sort((left, right) => left.due.localeCompare(right.due));
		const finished = active.todo.filter((item) => item.done);
		let summary = 'Nothing open. Add the next step below.';
		if (pending.length) {
			const scope = stillOpen() ? ` before ${shortDate(active.closes)}` : ' still open';
			summary = `${countOf(pending.length, 'step')}${scope}, soonest first.`;
		}
		hook('next-desc').textContent = summary;
		hook('todo').innerHTML = [...pending, ...finished].map(checklistRow).join('');
	}

	function checklistRow(item) {
		const gap = daysAway(item.due);
		let urgency = '';
		if (!item.done && gap < 0) urgency = ' dv-due-late';
		else if (!item.done && gap <= 3) urgency = ' dv-due-soon';
		const boxId = `dv-todo-${item.id}`;
		return `<li class="dv-todo-item${item.done ? ' is-done' : ''}"><input class="form-check-input" type="checkbox" id="${boxId}"${item.done ? ' checked' : ''} data-dv-todo="${item.id}"><label class="dv-todo-text" for="${boxId}">${htmlSafe(item.text)}</label><span class="dv-due${urgency}">${htmlSafe(dueWording(item))}</span></li>`;
	}

	function dueWording(item) {
		if (item.done) return 'Done';
		const gap = daysAway(item.due);
		if (gap < 0) return `${countOf(-gap, 'day')} late`;
		if (gap === 0) return 'Today';
		return gap === 1 ? 'Tomorrow' : shortDate(item.due);
	}

	function paintPeople() {
		hook('people').innerHTML = active.people.map(personRow).join('');
		const companyLink = hook('company-link');
		companyLink.href = companyHref();
		companyLink.innerHTML = `${htmlSafe(active.company)} company page<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i>`;
	}

	function personRow(person) {
		const label = htmlSafe(person.name);
		const nameTag = person.page
			? `<a class="dv-person-name" href="${person.page}">${label}</a>`
			: `<span class="dv-person-name">${label}</span>`;
		const mail = `<a class="btn btn-icon" href="mailto:${htmlSafe(person.email)}" aria-label="Email ${label}" title="${htmlSafe(person.email)}"><i class="bi bi-envelope" aria-hidden="true"></i></a>`;
		const call = person.phone
			? `<a class="btn btn-icon" href="tel:${htmlSafe(person.phone.replace(/\s/g, ''))}" aria-label="Call ${label}" title="${htmlSafe(person.phone)}"><i class="bi bi-telephone" aria-hidden="true"></i></a>`
			: '';
		return `<li class="dv-person">${avatarChip(person.name, 'basalt-avatar-sm')}<span class="dv-person-text">${nameTag}<span class="dv-note">${htmlSafe(person.role)}</span></span><span class="dv-part">${htmlSafe(person.part)}</span><span class="dv-person-reach">${mail}${call}</span></li>`;
	}

	/*
	 * "What it covers" pairs a today tile with an after tile, each showing
	 * the yearly bill, then lists the lines the deal adds and the perks.
	 */
	function paintCoverage() {
		const startsOn = active.kindId === 'upgrade' ? active.renews : active.closes;
		const change = (COVERAGE_BY_KIND[active.kindId] || addonCoverage)(
			active.current,
			`From ${shortDate(startsOn)}`,
			shortDate(startsOn),
		);
		hook('covers-desc').textContent = change.summary;
		hook('move').innerHTML =
			`${planCard(change.before)}<span class="dv-move-arrow" aria-hidden="true"><i class="bi bi-arrow-right"></i></span>${planCard(change.after)}`;
		hook('lines').innerHTML = active.lines.map(recurringLine).join('') + active.oneOff.map(oneOffLine).join('');
		hook('adds').innerHTML = active.adds
			.map(
				([icon, text], index) =>
					`<li class="dv-add dv-tone-${index + 5}"><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(text)}</li>`,
			)
			.join('');
	}

	function newCustomerCoverage(was, fromLabel, fromDay) {
		return {
			before: { when: 'Today', name: 'Not a customer yet', note: active.today, price: null, tone: 7 },
			after: planSnapshot(active.plan, quantity(), fromLabel),
			summary: `${PLAN_FACTS[active.plan][0]} for ${countOf(quantity(), 'seat')}, billed yearly from ${fromDay}.`,
		};
	}

	function upgradeCoverage(was, fromLabel, fromDay) {
		return {
			before: planSnapshot(was.plan, quantity(), 'Today'),
			after: planSnapshot(active.plan, quantity(), fromLabel),
			summary: `From ${PLAN_FACTS[was.plan][0]} to ${PLAN_FACTS[active.plan][0]}, billed yearly from ${fromDay}.`,
		};
	}

	function seatCoverage(was, fromLabel, fromDay) {
		return {
			before: planSnapshot(was.plan, was.seats, 'Today'),
			after: planSnapshot(was.plan, was.seats + quantity(), fromLabel),
			summary: `From ${was.seats} to ${was.seats + quantity()} seats on ${PLAN_FACTS[was.plan][0]}, billed yearly from ${fromDay}.`,
		};
	}

	function addonCoverage(was, fromLabel, fromDay) {
		const product = catalog[active.lines[0][0]];
		const shortName = product.name.replace(/, .*/, '');
		const amount = product.unit === 'bundle' ? `${quantity()} × 1,000 a month` : `${quantity()} seats`;
		return {
			before: planSnapshot(was.plan, was.seats, 'Today'),
			after: {
				when: fromLabel,
				name: `+ ${shortName}`,
				note: `${amount} × $${product.month} a month`,
				price: annualValue(),
				tone: product.tone,
			},
			summary: `${shortName} on top of ${PLAN_FACTS[was.plan][0]}, charged monthly from ${fromDay}.`,
		};
	}

	function planSnapshot(plan, seats, when) {
		const product = catalog[dealBook.planSku[plan]];
		return {
			when,
			name: PLAN_FACTS[plan][0],
			note: `${seats} seats × $${product.month} a month`,
			price: product.price * seats,
			tone: PLAN_FACTS[plan][1],
		};
	}

	function planCard(tile) {
		const price =
			tile.price === null
				? ''
				: `<span class="dv-plan-price">${dollars(tile.price)}<span class="dv-plan-per"> a year</span></span>`;
		return `<div class="dv-plan dv-tone-${tile.tone}"><span class="dv-plan-when">${htmlSafe(tile.when)}</span><span class="dv-plan-name">${htmlSafe(tile.name)}</span><span class="dv-note">${htmlSafe(tile.note)}</span>${price}</div>`;
	}

	function recurringLine([sku, count]) {
		const product = catalog[sku];
		return `<li class="dv-line"><span class="dv-line-what">${htmlSafe(product.name)}<span class="dv-note">${count} × $${product.month} a month, billed for ${product.months} months a year</span></span><span class="dv-line-amt">${dollars(product.price * count)}<span class="dv-note">a year</span></span></li>`;
	}

	function oneOffLine([sku, count]) {
		const product = catalog[sku];
		const multiple = count > 1 ? `${count} × ${dollars(product.price)}, ` : '';
		return `<li class="dv-line"><span class="dv-line-what">${htmlSafe(product.name)}<span class="dv-note">${multiple}one-off</span></span><span class="dv-line-amt">${dollars(product.price * count)}<span class="dv-note">once</span></span></li>`;
	}

	function paintFacts() {
		const pairs = [
			['Company', `<a class="dv-link" href="${companyHref()}">${htmlSafe(active.company)}</a>`],
			['Kind', htmlSafe(active.kind)],
			[quantityLabel(), String(quantity())],
			['Expected close', longDate(active.closes)],
			[
				'Owner',
				`<a class="dv-person-link" href="${dealBook.ownerUrl(active.owner)}">${avatarChip(active.owner)}<span>${htmlSafe(active.owner)}</span></a>`,
			],
			['Source', htmlSafe(active.source)],
			['Created', longDate(active.created)],
		];
		factList.innerHTML = pairs.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`).join('');
	}

	function paintHistory() {
		hook('activity').innerHTML = active.activity
			.map(
				([day, who, text, kind]) =>
					`<li class="dv-event dv-event-${kind}"><span class="dv-event-icon" aria-hidden="true"><i class="bi ${EVENT_ICONS[kind] || 'bi-dot'}"></i></span><span class="dv-event-text">${htmlSafe(text)}<span class="dv-note">${htmlSafe(who)} · ${shortDate(day)}</span></span></li>`,
			)
			.join('');
	}

	function paintFiles() {
		hook('files-desc').textContent = active.files.length
			? `${countOf(active.files.length, 'file')} shared on this deal.`
			: 'Nothing shared yet.';
		hook('files').innerHTML = active.files
			.map((attachment, index) => {
				const [, icon, tone] = FILE_TYPES.find(([pattern]) => pattern.test(attachment.name));
				const meta = `${readableSize(attachment.size)} · ${htmlSafe(attachment.by.split(' ')[0])} · ${shortDate(attachment.on)}`;
				return `<li class="dv-file"><span class="dv-file-icon dv-file-icon-${tone}" aria-hidden="true"><i class="bi ${icon}"></i></span><span class="dv-file-text"><span class="dv-file-name">${htmlSafe(attachment.name)}</span><span class="dv-note">${meta}</span></span><button type="button" class="btn btn-icon" data-dv-file="${index}" aria-label="Download ${htmlSafe(attachment.name)}"><i class="bi bi-download" aria-hidden="true"></i></button></li>`;
			})
			.join('');
	}

	/* Stage moves, losses and edits all copy the deal first so Undo can restore it. */

	/* A copy taken before each change lets its toast restore the deal exactly. */
	function keepCopy() {
		return JSON.stringify(active);
	}

	function rollBack(copy) {
		active = JSON.parse(copy);
		paint();
	}

	function addHistory(text, icon) {
		active.activity.unshift([fixture.today, fixture.me, text, icon]);
	}

	/** Tell the server; if it refuses, restore the copy and explain in a toast. */
	function saveOrRevert(copy, failure) {
		backend.save(active).catch(() => {
			rollBack(copy);
			notify({ tone: 'danger', title: failure, text: 'Nothing was saved. Try again in a moment.' });
		});
	}

	/* Every change toast stays eight seconds and carries an Undo button. */
	function notifyWithUndo(copy, message) {
		notify({ ...message, duration: 8000, actions: [{ label: 'Undo', onClick: () => rollBack(copy) }] });
	}

	function advance() {
		const upcoming = fixture.stages[stageIndex(active.stage) + 1];
		enterStage(
			upcoming.id,
			upcoming.id === 'signed' ? 'Marked the deal as signed.' : `Moved the deal to ${upcoming.name}.`,
		);
	}

	function enterStage(stageId, historyText) {
		const copy = keepCopy();
		const signing = stageId === 'signed';
		active.stage = stageId;
		active.reached[stageId] = fixture.today;
		addHistory(historyText, signing ? 'signed' : 'stage');
		paint();
		pick('.dv-step.is-now, .dv-step:last-child.is-done', hook('steps'))?.classList.add('is-fresh');
		const stage = stageById(stageId);
		notifyWithUndo(copy, {
			tone: 'success',
			icon: signing ? 'bi-pen' : 'bi-arrow-right-circle',
			title: signing ? 'Signed' : `Moved to ${stage.name}`,
			text: signing
				? `${dollars(annualValue())} a year is won.`
				: `It now counts ${stage.chance}% toward the forecast.`,
		});
		speak(signing ? 'Deal signed' : `Deal moved to ${stage.name}`);
		saveOrRevert(copy, 'The deal didn’t move');
	}

	function stepBack() {
		const copy = keepCopy();
		const leaving = stageById(active.stage);
		delete active.reached[active.stage];
		active.stage = fixture.stages[stageIndex(active.stage) - 1].id;
		const landing = stageById(active.stage).name;
		addHistory(`Moved the deal back to ${landing}.`, 'stage');
		paint();
		notifyWithUndo(copy, {
			tone: 'info',
			icon: 'bi-arrow-left-circle',
			title: `Back to ${landing}`,
			text: `Moved back from ${leaving.name}.`,
		});
		saveOrRevert(copy, 'The deal didn’t move');
	}

	function withdrawSignature() {
		const copy = keepCopy();
		delete active.reached.signed;
		active.stage = 'signature';
		addHistory('Reopened the deal at Out for signature.', 'stage');
		paint();
		notifyWithUndo(copy, {
			tone: 'info',
			icon: 'bi-arrow-counterclockwise',
			title: 'Reopened',
			text: 'It is back out for signature.',
		});
		saveOrRevert(copy, 'The deal didn’t reopen');
	}

	function revive() {
		const copy = keepCopy();
		delete active.lost;
		const stageName = stageById(active.stage).name;
		addHistory(`Reopened the deal at ${stageName}.`, 'stage');
		paint();
		notifyWithUndo(copy, {
			tone: 'success',
			icon: 'bi-arrow-counterclockwise',
			title: 'Reopened',
			text: `It is back in the forecast at ${stageName}.`,
		});
		saveOrRevert(copy, 'The deal didn’t reopen');
	}

	/* Recording a loss: the dialog asks for a reason first. */
	function wireLostDialog() {
		lostForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const reason = pick('input[name="dv-lost-reason"]:checked', lostForm).value;
			window.bootstrap.Modal.getOrCreateInstance(lostDialog).hide();
			const copy = keepCopy();
			active.lost = { on: fixture.today, reason };
			addHistory(`Marked the deal as lost: ${uncapitalize(reason)}.`, 'lost');
			paint();
			notifyWithUndo(copy, {
				tone: 'danger',
				icon: 'bi-x-circle',
				title: 'Marked as lost',
				text: 'It is out of the forecast.',
			});
			speak('Deal marked as lost');
			saveOrRevert(copy, 'The deal wasn’t marked as lost');
		});
	}

	/* The fact sheet swaps for a form so every field is edited and saved together. */
	function wireEditor() {
		editToggle.addEventListener('click', showEditor);
		field.count.addEventListener('input', () => {
			field.count.classList.remove('is-invalid');
			showSeatWorth();
		});
		field.closing.addEventListener('input', () => field.closing.classList.remove('is-invalid'));
		pick('[data-dv-edit-cancel]').addEventListener('click', closeEditor);
		editForm.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			event.stopPropagation();
			closeEditor();
		});
		editForm.addEventListener('submit', saveEdits);
	}

	function showEditor() {
		pick('label[for="dv-edit-seats"]').textContent = quantityLabel();
		field.count.value = quantity();
		field.closing.value = active.closes;
		field.owner.value = active.owner;
		field.source.value = active.source;
		window.Basalt.select?.refresh?.(field.owner);
		window.Basalt.select?.refresh?.(field.source);
		showSeatWorth();
		for (const flagged of pickAll('.is-invalid', editForm)) flagged.classList.remove('is-invalid');
		factList.hidden = true;
		editToggle.hidden = true;
		editForm.hidden = false;
		field.count.focus();
	}

	function closeEditor() {
		editForm.hidden = true;
		factList.hidden = false;
		editToggle.hidden = false;
		editToggle.focus({ preventScroll: true });
	}

	function showSeatWorth() {
		const count = parseInt(field.count.value, 10);
		field.worth.textContent = inSeatRange(count) ? `Worth ${dollars(count * pricePerUnit())} a year.` : '';
	}

	function inSeatRange(count) {
		return count >= 1 && count <= 500;
	}

	function saveEdits(event) {
		event.preventDefault();
		const count = parseInt(field.count.value, 10);
		const countWrong = !inSeatRange(count);
		const dateWrong = !field.closing.value || field.closing.value < fixture.today;
		field.count.classList.toggle('is-invalid', countWrong);
		field.closing.classList.toggle('is-invalid', dateWrong);
		if (countWrong || dateWrong) {
			(countWrong ? field.count : field.closing).focus();
			return;
		}

		const copy = keepCopy();
		const previous = quantity();
		const edited =
			count !== previous ||
			field.closing.value !== active.closes ||
			field.owner.value !== active.owner ||
			field.source.value !== active.source;
		closeEditor();
		if (!edited) return;

		/* Lines priced per seat take the new count, and so does a title that mentions it. */
		if (count !== previous) {
			active.lines = active.lines.map((line) => (line[1] === previous ? [line[0], count] : line));
			const retitle = {
				new: () => `${PLAN_FACTS[active.plan][0]} for ${count} seats`,
				upgrade: () => `Move to ${PLAN_FACTS[active.plan][0]} at ${count} seats`,
				seats: () => `${count} more seats`,
			}[active.kindId];
			if (retitle) active.title = retitle();
		}
		active.closes = field.closing.value;
		active.owner = field.owner.value;
		active.source = field.source.value;
		active.people = active.people.map((person) =>
			person.part === 'Owner' ? { ...person, name: active.owner, email: teamEmail(active.owner) } : person,
		);
		addHistory('Updated the deal’s details.', 'edit');
		paint();
		notifyWithUndo(copy, {
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Details saved',
			text: `Now ${dollars(annualValue())} a year, closing ${shortDate(active.closes)}.`,
		});
		saveOrRevert(copy, 'The details weren’t saved');
	}

	/* The to-do list, the note box and the attachments. */

	function wireChecklist() {
		hook('todo').addEventListener('change', (event) => {
			const box = event.target.closest('[data-dv-todo]');
			if (!box) return;
			const item = active.todo.find((entry) => entry.id === box.getAttribute('data-dv-todo'));
			const doneText = `Done: ${uncapitalize(item.text)}.`;
			item.done = box.checked;
			if (item.done) addHistory(doneText, 'check');
			else active.activity = active.activity.filter((row) => row[2] !== doneText);
			paint();
			document.getElementById(`dv-todo-${item.id}`)?.focus({ preventScroll: true });
			speak(item.done ? 'Step done' : 'Step reopened');
		});

		stepText.addEventListener('input', () => stepText.classList.remove('is-invalid'));
		stepDue.addEventListener('input', () => stepDue.classList.remove('is-invalid'));
		stepForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const text = stepText.value.trim();
			const textMissing = !text;
			const dueWrong = !stepDue.value || stepDue.value < fixture.today;
			stepText.classList.toggle('is-invalid', textMissing);
			stepDue.classList.toggle('is-invalid', dueWrong);
			if (textMissing || dueWrong) {
				(textMissing ? stepText : stepDue).focus();
				return;
			}
			const added = { id: `t${Date.now()}`, text, due: stepDue.value, done: false };
			active.todo.push(added);
			stepText.value = '';
			stepDue.value = weekFromToday();
			paint();
			speak(`Step added, due ${shortDate(added.due)}`);
			stepText.focus();
		});
	}

	/* The note box adds a note, call or email to the top of the history. */
	function wireNotes() {
		historyInput.addEventListener('input', () => historyInput.classList.remove('is-invalid'));
		historyForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const text = historyInput.value.trim();
			if (!text) {
				historyInput.classList.add('is-invalid');
				historyInput.focus();
				return;
			}
			const kind = pick('input[name="dv-log-kind"]:checked', historyForm).value;
			const entry = [fixture.today, fixture.me, `${LOG_PREFIX[kind]}${text}`, kind];
			active.activity.unshift(entry);
			historyInput.value = '';
			paintHistory();
			pick('.dv-event', hook('activity'))?.classList.add('is-fresh');
			speak('Added to the activity');
			backend.log(entry).catch(() => {
				active.activity = active.activity.filter((row) => row !== entry);
				paintHistory();
				notify({ tone: 'danger', title: 'It wasn’t added', text: 'Try again in a moment.' });
			});
		});
	}

	/* Attachments download from their row and arrive by picker or by drag and drop. */
	function wireFiles() {
		hook('files').addEventListener('click', (event) => {
			const button = event.target.closest('[data-dv-file]');
			if (!button) return;
			const attachment = active.files[Number(button.getAttribute('data-dv-file'))];
			/* A real app would link this to the stored file. */
			notify({
				tone: 'info',
				icon: 'bi-download',
				title: `Downloading ${attachment.name}`,
				text: readableSize(attachment.size),
			});
		});

		filePicker.addEventListener('change', () => {
			attach(filePicker.files);
			filePicker.value = '';
		});

		const markOver = (event) => {
			event.preventDefault();
			dropTarget.classList.add('is-over');
		};
		const unhighlight = () => dropTarget.classList.remove('is-over');
		dropTarget.addEventListener('dragenter', markOver);
		dropTarget.addEventListener('dragover', markOver);
		dropTarget.addEventListener('dragleave', unhighlight);
		dropTarget.addEventListener('drop', unhighlight);
		dropTarget.addEventListener('drop', (event) => {
			event.preventDefault();
			if (event.dataTransfer?.files.length) attach(event.dataTransfer.files);
		});
	}

	function attach(fileList) {
		const accepted = Array.from(fileList).filter((file) => file.size <= 20 * MEGABYTE);
		const rejected = fileList.length - accepted.length;
		if (rejected)
			notify({
				tone: 'warning',
				title: `${countOf(rejected, 'file')} over 20 MB`,
				text: 'Share a link to large files instead.',
			});
		if (accepted.length === 0) return;

		for (const file of accepted) {
			active.files.unshift({ name: file.name, size: file.size, by: fixture.me, on: fixture.today });
			backend.upload(file);
		}
		const single = accepted.length === 1;
		addHistory(`Added ${single ? accepted[0].name : countOf(accepted.length, 'file')}.`, 'file');
		paint();
		notify({
			tone: 'success',
			icon: 'bi-paperclip',
			title: single ? 'File added' : `${countOf(accepted.length, 'file')} added`,
		});
	}

	/* Formatting and lookup helpers shared by everything above. */

	function hook(name) {
		return pick(`[data-dv="${name}"]`, dealView);
	}

	function pause(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	function speak(text) {
		window.Basalt.announce?.(text);
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
	}

	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function readableSize(bytes) {
		if (bytes >= MEGABYTE) return `${(bytes / MEGABYTE).toFixed(1)} MB`;
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}

	function countOf(count, singular, pluralForm) {
		return `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function uncapitalize(text) {
		return text.charAt(0).toLowerCase() + text.slice(1);
	}

	function monogram(name) {
		return name
			.replace(/&/g, ' ')
			.split(/\s+/)
			.filter(Boolean)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	/* A name always maps to the same tone, matching the other CRM screens. */
	function toneFor(name) {
		return (hashText(name.toLowerCase()) % 8) + 1;
	}

	function avatarChip(name, sizeClass) {
		return `<span class="basalt-avatar ${sizeClass || 'basalt-avatar-xs'} basalt-avatar-tone-${toneFor(name)}" aria-hidden="true">${htmlSafe(monogram(name))}</span>`;
	}

	function parseDay(isoText) {
		return new Date(`${isoText}T00:00:00`);
	}

	function isoDay(date) {
		const pad = (number) => String(number).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function shiftDay(isoText, days) {
		const date = parseDay(isoText);
		date.setDate(date.getDate() + days);
		return isoDay(date);
	}

	function weekFromToday() {
		return shiftDay(fixture.today, 7);
	}

	function daysAway(isoText) {
		return Math.round((parseDay(isoText) - todayDate) / MS_PER_DAY);
	}

	function shortDate(isoText) {
		const date = parseDay(isoText);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function longDate(isoText) {
		return `${shortDate(isoText)}, ${parseDay(isoText).getFullYear()}`;
	}

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
