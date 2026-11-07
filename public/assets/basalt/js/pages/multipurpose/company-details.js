/**
 * company-details.html: everything about one company on one screen.
 * A paying or trialing customer shows what is still open with them, the
 * account facts, recent one-off purchases, the account folder, a timeline
 * of calls, emails, meetings and notes, and the people on both sides with
 * their roles. A prospect, or a customer who has left, has no account to
 * show, so the page lists its deals, the company facts, the timeline and
 * the people instead.
 *
 * ?id= names the company, as every company link on companies.html does,
 * and the records come from assets/basalt/js/data/multipurpose/companies.js; an id it does not
 * recognize falls back to Highpoint Outfitters. For real data, build the
 * profile below from GET /api/companies/:id and send the two forms to your
 * server; the rendering does not change. The demo's clock reads
 * October 8, 2026.
 */
(() => {
	'use strict';

	const screen = pick('[data-cd-root]', document);
	if (!screen || typeof bootstrap === 'undefined') return;

	/* Which company, and its account if it has one. A prospect in talks, a
     new customer not yet live or a former customer has none. */
	const LEDGER = window.Basalt.data.accounts;
	const requestedId = new URLSearchParams(location.search).get('id');
	const accountHit = LEDGER.find(requestedId);
	const FIRM =
		window.Basalt.data.companies.find(accountHit ? accountHit.id : requestedId) ||
		window.Basalt.data.companies.find('highpoint');
	const ACCOUNT = FIRM.kind === 'account' ? LEDGER.find(FIRM.id) : null;
	const DEMO_TODAY = '2026-10-08';
	const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const LONG_MONTHS = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];
	const PLAN_LABEL = LEDGER.plans[FIRM.plan].name;
	/* The end of the current term: the renewal date, the end of a trial or
     the last day before a cancellation takes hold. */
	const TERM_ENDS = ACCOUNT ? ACCOUNT.renews || ACCOUNT.statusOn : null;
	const FEED_PAGE = 5;

	const TRADE_LABEL = {
		homecare: 'Home care',
		petcare: 'Pet care',
		photography: 'Photography',
		cleaning: 'Cleaning',
		landscaping: 'Landscaping',
		property: 'Property care',
		moving: 'Movers',
	};
	const DEAL_STAGE_LABEL = {
		discovery: 'Discovery',
		proposal: 'Proposal',
		negotiation: 'Negotiation',
		signature: 'Out for signature',
		signed: 'Signed',
		lost: 'Lost',
	};
	const ACCOUNT_STATUS = {
		active: ['success', 'Active'],
		trial: ['info', 'Trial'],
		pastdue: ['danger', 'Past due'],
		canceling: ['warning', 'Canceling'],
	};
	/* A purchase's state: its status pill, then what happens next. */
	const PURCHASE_STATE = {
		placed: [['warning', 'Waiting for payment'], 'Card to be updated'],
		paid: [['warning', 'Not started'], 'Starts this week'],
		picking: [['info', 'Booked'], 'Date set with them'],
		dispatched: [['primary', 'Started'], 'Under way'],
		delivered: [['success', 'Completed'], ''],
		canceled: [['secondary', 'Canceled'], ''],
	};
	/* Icon, label and tile tone for each kind of open item. */
	const ITEM_KIND = {
		quote: { icon: 'bi-file-earmark-text', label: 'Quote', tone: 1 },
		order: { icon: 'bi-bag-check', label: 'Order', tone: 2 },
		training: { icon: 'bi-mortarboard', label: 'Training', tone: 5 },
		invoice: { icon: 'bi-receipt', label: 'Invoice', tone: 4 },
		trial: { icon: 'bi-hourglass-split', label: 'Subscription', tone: 2 },
		deal: { icon: 'bi-briefcase', label: 'Deal', tone: 3 },
	};
	/* The same for each kind of timeline entry, with its headline. */
	const ENTRY_KIND = {
		call: { icon: 'bi-telephone', title: (entry) => `Call with ${entry.with}`, tone: 1 },
		email: { icon: 'bi-envelope', title: (entry) => `Email to ${entry.with}`, tone: 2 },
		meeting: { icon: 'bi-people', title: (entry) => `Meeting with ${entry.with}`, tone: 5 },
		note: { icon: 'bi-sticky', title: (entry) => `Note from ${entry.by}`, tone: 3 },
		update: { icon: 'bi-arrow-repeat', title: (entry) => `Update from ${entry.by}`, tone: 4 },
	};
	const FILE_ICON = {
		pdf: 'bi-file-earmark-pdf',
		sheet: 'bi-file-earmark-spreadsheet',
		slides: 'bi-file-earmark-slides',
	};
	const FILE_TONE = { pdf: 4, sheet: 2 };
	const OPEN_COUNT_WORDS = [
		'Nothing open right now.',
		'One thing still to come.',
		'Two things still to come.',
		'Three things still to come.',
		'Four things still to come.',
	];

	/* Everything the page draws, worked out once from the records. The facts
     carry the keys the edit drawer reads and writes; the feed runs newest
     first, and "with" names who an entry involved (the company itself for
     a note or an update). Contact roles are Owner, Billing, Admin, Member
     or Contact, and key links a person to their own page. */
	const profile = {
		open: pendingRows(),
		facts: ACCOUNT ? accountFacts() : { industry: TRADE_LABEL[FIRM.trade] },
		orders: ACCOUNT
			? ACCOUNT.orders.slice(0, 3).map(([id, on, items, total, state]) => ({
					id,
					date: fullDay(on),
					items,
					status: PURCHASE_STATE[state][0],
					total: withCents(total),
				}))
			: [],
		files: folderFiles(),
		feed: FIRM.activity.map(([date, by, text, kind, involved]) => ({
			kind,
			date,
			time: '',
			by,
			with: involved || FIRM.name,
			text,
		})),
		contacts: FIRM.people.map(({ name, key, title, role, email, phone }) => ({
			name,
			key,
			title,
			role,
			email,
			phone,
		})),
		team: ourTeam().map(([name, role]) => ({ name, role })),
		me: 'John Armstrong',
		today: DEMO_TODAY,
	};

	/* Timeline state: the kind shown, whether it is unfolded past the first
     page, and which entry was just logged. */
	let feedFilter = 'all';
	let feedExpanded = false;
	let highlightIndex = -1;

	const logPanel = document.getElementById('cd-log');
	const activityForm = pick('[data-cd-log]', document);
	const editPanel = document.getElementById('cd-edit');
	const factsForm = pick('[data-cd-edit]', document);

	function start() {
		wireFeed();
		wireLogDrawer();
		wireEditDrawer();
		wireMenu();
		renderMasthead();
		renderFigures();
		wireFigureTips();
		countUpFigures();
		renderPending();
		renderFacts();
		renderPurchases();
		renderFiles();
		renderPeople();
		renderTimeline();
	}

	/* Wiring. */

	function wireFeed() {
		hook('chips').addEventListener('click', (event) => {
			const chipBtn = event.target.closest('[data-cd-kind]');
			if (!chipBtn) return;
			feedFilter = chipBtn.dataset.cdKind;
			feedExpanded = false;
			pressOnly((chipNode) => chipNode === chipBtn);
			renderTimeline();
			const matching = feedMatches().length;
			hook('feed-status').textContent =
				`Showing ${feedFilter === 'all' ? 'all activity' : chipBtn.textContent.trim().toLowerCase()}, ${matching} in all.`;
		});
		hook('feed-more').addEventListener('click', () => {
			const shownCount = pickAll('.cd-feed-item', hook('feed')).length;
			window.Basalt.slide(hook('feed'), () => {
				feedExpanded = true;
				renderTimeline();
			});
			/* The keyboard lands where the new entries begin. */
			const firstNew = pickAll('.cd-feed-item', hook('feed'))[shownCount];
			if (!firstNew) return;
			firstNew.setAttribute('tabindex', '-1');
			firstNew.focus({ preventScroll: true });
		});
	}

	function wireLogDrawer() {
		const logInputs = activityForm.elements;
		pick('[data-cd-with]', document).innerHTML = profile.contacts
			.map((person) => `<option>${escapeText(person.name)}</option>`)
			.join('');
		activityForm.addEventListener('change', (event) => {
			if (event.target.name === 'kind') toggleWithRow();
		});
		logPanel.addEventListener('show.bs.offcanvas', () => {
			activityForm.reset();
			activityForm.classList.remove('was-validated');
			for (const flagged of pickAll('.is-invalid', activityForm)) flagged.classList.remove('is-invalid');
			toggleWithRow();
		});
		logPanel.addEventListener('shown.bs.offcanvas', () => logInputs.text.focus());
		activityForm.addEventListener('submit', onLogSubmit);
		logInputs.text.addEventListener('input', (event) => {
			if (event.target.value.trim()) event.target.classList.remove('is-invalid');
		});
		logInputs.date.addEventListener('change', (event) => {
			if (event.target.value && event.target.value <= profile.today) event.target.classList.remove('is-invalid');
		});
	}

	function wireEditDrawer() {
		/* Every time zone any account works in, so this account's own is listed. */
		const zoneNames = [...new Set(LEDGER.list().map((acct) => LEDGER.zoneName(acct.tz)))].sort();
		factsForm.elements.zone.innerHTML = zoneNames.map((zone) => `<option>${escapeText(zone)}</option>`).join('');
		editPanel.addEventListener('show.bs.offcanvas', fillEditForm);
		factsForm.addEventListener('input', (event) => {
			if (event.target.classList.contains('is-invalid')) event.target.classList.remove('is-invalid');
		});
		factsForm.addEventListener('submit', onEditSubmit);
	}

	function wireMenu() {
		pick('[data-cd-export]').addEventListener('click', () => {
			pop({
				tone: 'info',
				icon: 'bi-download',
				title: 'Export under way',
				text: `${ACCOUNT ? 'Orders, activity' : 'Deals, activity'} and people as one CSV file.`,
			});
		});

		const badgeRow = hook('tags');
		const archiveMenuItem = pick('[data-cd-archive-item]');
		const archivedBadge = document.createElement('span');
		archivedBadge.className = 'basalt-status basalt-status-warning';
		archivedBadge.textContent = 'Archived';
		pick('[data-cd-archive]', document).addEventListener('click', () => {
			bootstrap.Modal.getOrCreateInstance(document.getElementById('cd-archive')).hide();
			badgeRow.prepend(archivedBadge);
			archiveMenuItem.disabled = true;
			pop({
				tone: 'warning',
				icon: 'bi-archive',
				title: `${FIRM.name} archived`,
				text: 'Open quotes were withdrawn.',
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							archivedBadge.remove();
							archiveMenuItem.disabled = false;
							pop({ tone: 'success', title: `${FIRM.name} restored` });
						},
					},
				],
			});
		});

		hook('files').addEventListener('click', (event) => {
			const clicked = event.target.closest('[data-cd-file]');
			if (clicked)
				pop({
					tone: 'info',
					icon: 'bi-download',
					title: 'Downloading',
					text: profile.files[Number(clicked.dataset.cdFile)].name,
				});
		});
	}

	/* DOM, text, money and date helpers. */

	function pick(selector, scope = screen) {
		return scope.querySelector(selector);
	}
	function pickAll(selector, scope = screen) {
		return [...scope.querySelectorAll(selector)];
	}
	function hook(name) {
		return pick(`[data-cd="${name}"]`);
	}
	function pop(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function escapeText(value) {
		const ENTITY = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value == null ? '' : value).replace(/[&<>"']/g, (mark) => ENTITY[mark]);
	}

	function shortDay(iso) {
		return `${SHORT_MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
	}
	function fullDay(iso) {
		return `${shortDay(iso)}, ${iso.slice(0, 4)}`;
	}
	function longMonth(iso) {
		return LONG_MONTHS[Number(iso.slice(5, 7)) - 1];
	}
	function daysAhead(iso) {
		return Math.round((Date.parse(iso) - Date.parse(DEMO_TODAY)) / 864e5);
	}
	function daysSince(iso) {
		return Math.round((Date.parse(profile.today) - Date.parse(iso)) / 864e5);
	}
	function withCents(amount) {
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}
	function roundDollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}
	function plainDollars(amount) {
		return `$${amount.toLocaleString('en-US')}`;
	}
	function plural(howMany, single, several) {
		return `${howMany}${howMany === 1 ? single : several}`;
	}

	/** "Today", "Yesterday" or a short date, with the time when there is one. */
	function whenLabel(entry) {
		const gap = daysSince(entry.date);
		const dayText =
			{ 0: 'Today', 1: 'Yesterday' }[gap] ||
			`${SHORT_MONTHS[Number(entry.date.slice(5, 7)) - 1]} ${Number(entry.date.slice(8))}`;
		return entry.time ? `${dayText}, ${entry.time}` : dayText;
	}

	function statePill([tone, text]) {
		return `<span class="basalt-status basalt-status-${tone} basalt-status-dot">${escapeText(text)}</span>`;
	}

	/** On a narrow card, the line under the name that stands in for the
      hidden columns. */
	function narrowLine(pill, text) {
		return `<span class="cd-fold"><span class="cd-fold-status">${statePill(pill)}</span>${escapeText(text)}</span>`;
	}

	function avatarSlot(name) {
		return `<span class="basalt-avatar basalt-avatar-sm" aria-hidden="true" data-basalt-avatar data-name="${escapeText(name)}"></span>`;
	}

	function fillAvatars(container) {
		for (const avatarNode of pickAll('[data-basalt-avatar]', container))
			window.Basalt.avatar && window.Basalt.avatar(avatarNode);
	}

	/** The same seed always gives the same sequence, so the small charts look
      the same on every visit. */
	function randomFrom(seed) {
		let rngState = seed;
		return () => {
			rngState = (rngState * 16807) % 2147483647;
			return rngState / 2147483647;
		};
	}

	/* Building the profile. */

	function personName(key) {
		return FIRM.people.find((person) => person.key === key)?.name;
	}

	function accountFacts() {
		return {
			industry: TRADE_LABEL[ACCOUNT.trade],
			branches: ACCOUNT.branches || ACCOUNT.city.split(',')[0],
			terms: ACCOUNT.pay && ACCOUNT.pay.indexOf('Bank transfer') === 0 ? 'Net 30' : 'Due on receipt',
			limit: ACCOUNT.limit || { starter: 5000, growth: 10000, enterprise: 25000 }[ACCOUNT.plan],
			address: ACCOUNT.address.join(', '),
			zone: LEDGER.zoneName(ACCOUNT.tz),
		};
	}

	/** Our side of the relationship: the account's own team, a default
      trio, or the one person who owns the company. */
	function ourTeam() {
		if (!ACCOUNT) return [[FIRM.owner, FIRM.stage === 'prospect' ? 'Deal owner' : 'Account owner']];
		return (
			ACCOUNT.team || [
				[ACCOUNT.owner, 'Account owner'],
				['Andrea Riggs', 'Support'],
				['Neal Carson', 'Billing'],
			]
		);
	}

	/** What is still in progress, at most four rows: the trial or the
      cancellation, an unpaid bill, the renewal quote, other quotes, open
      deals, unfinished purchases and a booked training. kind picks the
      icon and href is where the full record lives. */
	function pendingRows() {
		if (!ACCOUNT) return dealRows();
		const queue = [];
		const subscriptionHref = `subscription-details.html?id=${encodeURIComponent(ACCOUNT.sub)}`;
		const { status, renewal } = ACCOUNT;
		if (status === 'trial') {
			queue.push({
				kind: 'trial',
				title: `Free trial of ${PLAN_LABEL}`,
				ref: '',
				meta: `${ACCOUNT.seats} seats, started ${shortDay(ACCOUNT.since)}`,
				status: ['info', 'Trial'],
				next: `Ends ${shortDay(ACCOUNT.statusOn)}`,
				amount: `${roundDollars(LEDGER.listMrr(ACCOUNT) * 12)}/yr after`,
				href: subscriptionHref,
			});
		}
		if (status === 'canceling') {
			queue.push({
				kind: 'trial',
				title: 'Cancellation',
				ref: '',
				meta: `Not renewing ${ACCOUNT.seats} seats`,
				status: ['warning', 'Canceling'],
				next: `Ends ${shortDay(ACCOUNT.statusOn)}`,
				amount: '',
				href: subscriptionHref,
			});
		}
		if (status === 'pastdue') {
			const bill = LEDGER.bills(ACCOUNT).find((invoice) => invoice.state === 'unpaid');
			queue.push({
				kind: 'invoice',
				title: 'Yearly renewal',
				ref: bill.no,
				meta: bill.what,
				status: ['danger', 'Overdue'],
				next: `Due ${shortDay(bill.at)}`,
				amount: withCents(bill.amount),
				href: `invoice-details.html?id=${encodeURIComponent(bill.no)}`,
			});
		}
		if (renewal) {
			const renewalYear = LEDGER.listMrr({ ...ACCOUNT, seats: renewal.seats }) * 12;
			queue.push({
				kind: 'quote',
				title: `Renewal, ${renewal.seats} seats`,
				ref: renewal.quote,
				meta: `${PLAN_LABEL}, yearly`,
				status: renewal.signed ? ['success', 'Signed'] : ['info', 'Sent'],
				next: `Renews ${shortDay(ACCOUNT.renews)}`,
				amount: withCents(Math.round(renewalYear)),
				href: `quote-details.html?id=${encodeURIComponent(renewal.quote)}`,
			});
		}
		for (const quote of ACCOUNT.quotes || []) {
			queue.push({
				kind: 'quote',
				title: quote.title,
				ref: quote.id,
				meta: quote.meta,
				status: ['info', 'Sent'],
				next: `Expires ${shortDay(quote.expires)}`,
				amount: withCents(quote.amount),
				href: `quote-details.html?id=${encodeURIComponent(quote.id)}`,
			});
		}
		/* Open deals come before purchases: they are still being agreed. */
		for (const opportunity of ACCOUNT.deals) {
			queue.push({
				kind: 'deal',
				title: opportunity.name,
				ref: '',
				meta: `Deal with ${personName(opportunity.people[0][0])}`,
				status: ['primary', DEAL_STAGE_LABEL[opportunity.stage]],
				next: `Closes ${shortDay(opportunity.closes)}`,
				amount: `+${roundDollars(opportunity.value)}/yr`,
				href: `deal-details.html?id=${encodeURIComponent(LEDGER.slug(opportunity.name))}`,
			});
		}
		const unfinished = ['placed', 'paid', 'picking', 'dispatched'];
		for (const [number, bought, items, total, stateKey] of ACCOUNT.orders.filter((purchase) =>
			unfinished.includes(purchase[4]),
		)) {
			const [statePair, after] = PURCHASE_STATE[stateKey];
			queue.push({
				kind: 'order',
				title: items.charAt(0).toUpperCase() + items.slice(1),
				ref: number,
				meta: `Bought ${shortDay(bought)}`,
				status: statePair,
				next: after,
				amount: withCents(total),
				href: 'invoices.html',
			});
		}
		const { booking } = ACCOUNT;
		if (booking)
			queue.push({
				kind: 'training',
				title: booking.title,
				ref: '',
				meta: booking.meta,
				status: ['primary', 'Booked'],
				next: fullDay(booking.on),
				amount: withCents(booking.amount),
				href: 'schedule.html',
			});
		return queue.slice(0, 4);
	}

	/** For a company without an account: each deal, followed by the quote
      it went out on. */
	function dealRows() {
		const queue = [];
		const contact = FIRM.people[0] ? FIRM.people[0].name : FIRM.name;
		const firstName = contact.split(' ')[0];
		const TONE = { signed: 'success', lost: 'danger' };
		const VERB = { signed: 'Starts', lost: 'Lost' };
		const QUOTE_PILL = { signed: ['success', 'Accepted'], lost: ['danger', 'Declined'] };
		for (const opportunity of FIRM.deals) {
			queue.push({
				kind: 'deal',
				title: opportunity.name,
				ref: opportunity.id,
				meta: `Deal with ${contact}`,
				status: [TONE[opportunity.stage] || 'primary', DEAL_STAGE_LABEL[opportunity.stage]],
				next: `${VERB[opportunity.stage] || 'Closes'} ${shortDay(opportunity.closes)}`,
				amount: `+${roundDollars(opportunity.value)}/yr`,
				href: opportunity.href,
			});
			if (!opportunity.quote) continue;
			queue.push({
				kind: 'quote',
				title: `Quote for ${FIRM.name}`,
				ref: opportunity.quote,
				meta: 'First year',
				status: QUOTE_PILL[opportunity.stage] || ['info', 'Sent'],
				next: opportunity.stage === 'lost' ? 'Closed' : `With ${firstName}`,
				amount: roundDollars(opportunity.value),
				href: `quote-details.html?id=${encodeURIComponent(opportunity.quote)}`,
			});
		}
		return queue.slice(0, 4);
	}

	/** The papers in the account folder, at most four. */
	function folderFiles() {
		if (!ACCOUNT) return [];
		const big = ACCOUNT.plan === 'enterprise';
		const paperList = [
			{
				name: `${big ? 'Max agreement' : 'Order form'}.pdf`,
				type: 'pdf',
				meta: `${big ? '640 KB' : '180 KB'} · Signed ${fullDay(ACCOUNT.since)}`,
			},
		];
		if (ACCOUNT.renewal)
			paperList.unshift({
				name: `Quote ${ACCOUNT.renewal.quote}.pdf`,
				type: 'pdf',
				meta: `210 KB · ${shortDay(ACCOUNT.renewal.sent)}`,
			});
		for (const quote of ACCOUNT.quotes || [])
			paperList.unshift({ name: `Quote ${quote.id}.pdf`, type: 'pdf', meta: `210 KB · ${shortDay(quote.sent)}` });
		if (ACCOUNT.orders.length)
			paperList.push({
				name: 'Staff register.xlsx',
				type: 'sheet',
				meta: `88 KB · ${shortDay(ACCOUNT.orders[0][1])}`,
			});
		const review = ACCOUNT.activity.find((logged) => logged[3] === 'meeting' && /review/i.test(logged[2]));
		if (review)
			paperList.push({
				name: `${longMonth(review[0])} review.pptx`,
				type: 'slides',
				meta: `3.1 MB · ${shortDay(review[0])}`,
			});
		return paperList.slice(0, 4);
	}

	/* The header and the four figures under it. */

	/** When the relationship began, in a few words. */
	function relationshipLine() {
		if (ACCOUNT)
			return ACCOUNT.status === 'trial'
				? `Trial since ${shortDay(ACCOUNT.since)}`
				: `Customer since ${ACCOUNT.since.slice(0, 4)}`;
		if (FIRM.stage === 'former') return `Customer ${FIRM.since.slice(0, 4)} to ${FIRM.left.slice(0, 4)}`;
		if (FIRM.stage === 'customer') return `Customer since ${FIRM.since.slice(0, 4)}`;
		return `In talks since ${longMonth(FIRM.since)}`;
	}

	function headerSubline() {
		return `${profile.facts.industry} · ${FIRM.city.split(',')[0]} · ${relationshipLine()}`;
	}

	function renderMasthead() {
		hook('mark').textContent = FIRM.name
			.replace(/&/g, '')
			.split(/\s+/)
			.filter(Boolean)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
		hook('name').textContent = FIRM.name;
		document.title = `${FIRM.name} · Basalt`;
		hook('sub').textContent = headerSubline();
		hook('tags').innerHTML = ACCOUNT ? accountBadges() : companyBadges();
		if (ACCOUNT) {
			hook('menu-sub').href = `subscription-details.html?id=${encodeURIComponent(ACCOUNT.sub)}`;
		} else {
			for (const menuKey of ['menu-sub', 'menu-edit']) hook(menuKey).closest('li').hidden = true;
		}
		hook('theirs').textContent = `At ${FIRM.name}`;
		pick('[data-cd-archive-title]', document).textContent = `Archive ${FIRM.name}?`;
	}

	function accountBadges() {
		const statePair = ACCOUNT_STATUS[ACCOUNT.status];
		const statusTag =
			ACCOUNT.status !== 'active'
				? `<span class="basalt-status basalt-status-${statePair[0]}">${statePair[1]}</span>`
				: '';
		const flagBadge = ACCOUNT.flag
			? `<span class="basalt-status basalt-status-info">${escapeText(ACCOUNT.flag)}</span>`
			: '';
		return `<span class="basalt-status basalt-status-primary">${escapeText(PLAN_LABEL)}</span>${statusTag}${flagBadge}`;
	}

	function companyBadges() {
		const stageInfo = window.Basalt.data.companies.stages[FIRM.stage];
		const planBadge =
			FIRM.stage === 'customer'
				? `<span class="basalt-status basalt-status-primary">${escapeText(PLAN_LABEL)}</span>`
				: '';
		return `<span class="basalt-status basalt-status-${FIRM.stage === 'former' ? 'warning' : stageInfo.tone}">${escapeText(stageInfo.name)}</span>${planBadge}`;
	}

	/** Subscription, add-on spend, renewal and health, each with a figure, a
      small picture and a note. Without an account there is nothing to show
      and the band is hidden. */
	function renderFigures() {
		if (!ACCOUNT) {
			hook('band').hidden = true;
			hook('band-title').hidden = true;
			return;
		}
		const nextRandom = randomFrom(Number(ACCOUNT.no.replace(/\D/g, '')));
		const onTrial = ACCOUNT.status === 'trial';
		const monthly = onTrial ? LEDGER.listMrr(ACCOUNT) : LEDGER.mrr(ACCOUNT);

		/* The spark is drawn before the health line: both take numbers from the
       same seeded sequence, in this order. */
		const spend = addonSpend(nextRandom);
		const health = healthFigure(nextRandom);
		const termInfo = renewalFigure(onTrial);

		hook('band').innerHTML = [
			figure(
				1,
				'bi-arrow-repeat',
				'Subscription',
				`${roundDollars(monthly)}<span class="cd-band-unit"> a month${onTrial ? ' after trial' : ''}</span>`,
				seatsBar(),
				`${ACCOUNT.used} of ${ACCOUNT.seats} seats in use`,
			),
			figure(2, 'bi-bag', 'Add-on Spend', roundDollars(spend.total), spend.picture, spend.note),
			figure(3, 'bi-calendar-check', termInfo.label, shortDay(TERM_ENDS), termInfo.picture, termInfo.note),
			figure(4, 'bi-heart-pulse', 'Health', health.value, health.picture, health.note),
		].join('');
	}

	function figure(position, icon, caption, value, picture, note) {
		return `<div class="cd-band-item cd-band-item-${position}"><dt class="cd-band-label"><i class="bi ${icon}" aria-hidden="true"></i>${caption}</dt><dd class="cd-band-value">${value}</dd><dd class="cd-band-pic">${picture}</dd><dd class="cd-band-note">${escapeText(note)}</dd></div>`;
	}

	/** One segment per seat, or per few seats on a big account, lit while
      the seat is in use. */
	function seatsBar() {
		const perSegment = Math.ceil(ACCOUNT.seats / 40);
		const segCount = Math.ceil(ACCOUNT.seats / perSegment);
		const lit = Math.round(ACCOUNT.used / perSegment);
		const seatCells = Array.from({ length: segCount }, (_, index) => {
			const first = index * perSegment + 1;
			const last = Math.min(ACCOUNT.seats, first + perSegment - 1);
			const seats = first === last ? `Seat ${first}` : `Seats ${first} to ${last}`;
			return `<span${index < lit ? ' class="is-on"' : ''} data-cd-tip="${seats} · ${index < lit ? 'in use' : 'free'}" style="--i: ${index}"></span>`;
		}).join('');
		return `<span class="cd-seats" role="img" aria-label="${ACCOUNT.used} of ${ACCOUNT.seats} seats in use">${seatCells}</span>`;
	}

	/** Add-on spend over the twelve months that end this month. */
	function addonSpend(nextRandom) {
		const { orders, store } = ACCOUNT;
		let spendTotal = 0;
		for (const purchase of orders) spendTotal += purchase[4] === 'canceled' ? 0 : purchase[3];
		if (store) spendTotal = store[0];
		const orderCount = store ? store[1] : orders.length;
		const monthBars = Array.from({ length: 12 }, () => (orders.length || store ? 10 + nextRandom() * 60 : 4));
		for (const [, bought, , amount] of orders) {
			const back = (2026 - Number(bought.slice(0, 4))) * 12 + 9 - Number(bought.slice(5, 7));
			if (back >= 0 && back < 12) monthBars[11 - back] = Math.min(100, monthBars[11 - back] + amount / 40);
		}
		const peak = Math.max(...monthBars);
		const barSum = monthBars.reduce((sum, bar) => sum + bar, 0);
		const thisMonth = Number(DEMO_TODAY.slice(5, 7)) - 1;
		const sparkBars = monthBars
			.map((bar, index) => {
				const month = SHORT_MONTHS[(thisMonth - 11 + index + 12) % 12];
				const tip = spendTotal
					? `${month} · ${roundDollars((spendTotal * bar) / barSum)}`
					: `${month} · nothing`;
				return `<span data-cd-tip="${tip}" style="--cd-h: ${spendTotal ? Math.round((bar / peak) * 100) : 8}%; --i: ${index}"></span>`;
			})
			.join('');
		return {
			total: spendTotal,
			picture: `<span class="cd-spark" role="img" aria-label="Add-on spend by month over the last year">${sparkBars}</span>`,
			note: orderCount
				? `${plural(orderCount, ' order', ' orders')} since ${ACCOUNT.since.slice(0, 4)}`
				: 'Nothing bought yet',
		};
	}

	/** How far through the trial or the contract year the account is. */
	function renewalFigure(onTrial) {
		const daysLeftInTerm = daysAhead(TERM_ENDS);
		const termFill = onTrial
			? Math.round(((14 - daysLeftInTerm) / 14) * 100)
			: Math.max(0, Math.min(100, Math.round(((365 - daysLeftInTerm) / 365) * 100)));
		const yearlyList = roundDollars(LEDGER.listMrr(ACCOUNT) * 12);
		let note = `In ${daysLeftInTerm} days, ${yearlyList} a year`;
		if (ACCOUNT.status === 'pastdue') note = `Unpaid since ${shortDay(ACCOUNT.statusOn)}`;
		else if (onTrial)
			note =
				daysLeftInTerm <= 0
					? 'Ends today'
					: `In ${plural(daysLeftInTerm, ' day', ' days')}, then ${yearlyList} a year`;
		else if (ACCOUNT.status === 'canceling') note = `Not renewing, in ${daysLeftInTerm} days`;
		const termLabel = onTrial ? 'Trial Ends' : ACCOUNT.status === 'canceling' ? 'Access Ends' : 'Renewal';
		return {
			label: termLabel,
			note,
			picture: `<span class="cd-term" role="img" aria-label="${onTrial ? 'Trial' : 'Contract year'} ${termFill}% through" data-cd-tip="${termFill}% through the ${onTrial ? 'trial' : 'contract year'}" style="--cd-fill: ${termFill}%"></span>`,
		};
	}

	/** The weekly health score over ten weeks, ending at today's score. A
      new account has none until its first full week. */
	function healthFigure(nextRandom) {
		const healthNow = ACCOUNT.health;
		if (healthNow == null)
			return {
				value: '<span class="cd-band-unit">First score on Monday</span>',
				picture: '',
				note: 'After a week of use',
			};
		const drift = healthNow >= 70 ? 2.8 : 1.4;
		const points = [];
		let drifting = healthNow;
		for (let week = 0; week < 10; week++) {
			points.unshift(drifting);
			drifting = Math.max(5, Math.min(100, drifting + (nextRandom() * 4 - drift)));
		}
		points[9] = healthNow;
		const low = Math.min(...points) - 4;
		const high = Math.max(...points) + 4;
		const polyPoints = points
			.map(
				(point, week) =>
					`${((week * 100) / 9).toFixed(1)},${(28 - ((point - low) / (high - low)) * 28).toFixed(1)}`,
			)
			.join(' ');
		const swing = Math.round(healthNow - points[0]);
		const note =
			swing === 0 ? 'Level over ten weeks' : `${swing > 0 ? 'Up' : 'Down'} ${Math.abs(swing)} in ten weeks`;
		return {
			value: `${healthNow}<span class="cd-band-unit"> of 100</span>`,
			picture: `<span class="cd-line-box"><svg class="cd-line" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label="Weekly health score over ten weeks, from ${Math.round(points[0])} to ${healthNow}"><polyline points="${polyPoints}"/></svg>${healthStops(points, low, high)}</span>`,
			note,
		};
	}

	/** One stop per week along the health line, each holding that week's
      score for the note under it and a dot that shows on hover. */
	function healthStops(points, low, high) {
		return points
			.map((point, week) => {
				const weekOf = new Date(Date.parse(DEMO_TODAY) - (9 - week) * 7 * 864e5).toISOString().slice(0, 10);
				const left = (week * 100) / 9;
				const top = 100 - ((point - low) / (high - low)) * 100;
				return `<span class="cd-line-stop" data-cd-tip="Week of ${shortDay(weekOf)} · ${Math.round(point)}" style="--x: ${left.toFixed(1)}%; --y: ${top.toFixed(1)}%"></span>`;
			})
			.join('');
	}

	/** Pointing at a seat, a month, a week or the term shows its detail in
      the figure's note; leaving puts the note back. */
	function wireFigureTips() {
		const band = hook('band');
		let shown = null;
		const settle = () => {
			if (!shown) return;
			shown.tip.classList.remove('is-pointed');
			shown.item.classList.remove('is-pointing');
			shown.note.textContent = shown.rest;
			shown = null;
		};
		band.addEventListener('pointerover', (event) => {
			const tip = event.target.closest('[data-cd-tip]');
			if (tip === shown?.tip) return;
			settle();
			if (!tip) return;
			const item = tip.closest('.cd-band-item');
			const note = pick('.cd-band-note', item);
			shown = { tip, item, note, rest: note.textContent };
			tip.classList.add('is-pointed');
			item.classList.add('is-pointing');
			note.textContent = tip.dataset.cdTip;
		});
		band.addEventListener('pointerleave', settle);
	}

	/** Each figure that is a plain number or dollar amount counts up from
      zero when the page opens. */
	function countUpFigures() {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		for (const value of pickAll('.cd-band-value', hook('band'))) {
			const text = value.firstChild;
			if (text?.nodeType !== Node.TEXT_NODE || !/^\$?[\d,]+$/.test(text.textContent.trim())) continue;
			const target = Number(text.textContent.replace(/\D/g, ''));
			const money = text.textContent.trim().startsWith('$');
			const started = performance.now();
			const step = (now) => {
				const progress = Math.min(1, (now - started) / 500);
				const shownValue = Math.round(target * (1 - (1 - progress) ** 3));
				text.textContent = money ? roundDollars(shownValue) : String(shownValue);
				if (progress < 1) requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		}
	}

	/* The open items table. */

	function openSummary() {
		if (ACCOUNT) return OPEN_COUNT_WORDS[profile.open.length];
		if (FIRM.stage === 'former') return `They left on ${fullDay(FIRM.left)}.`;
		if (FIRM.status === 'lost') return 'The deal we lost.';
		return FIRM.deals.some((deal) => deal.quote)
			? 'Their deal and the quote that went with it.'
			: 'Their deal, before a quote goes out.';
	}

	function ticketLine() {
		if (!ACCOUNT) return '';
		if (!ACCOUNT.tickets) return 'No open support tickets.';
		return plural(ACCOUNT.tickets, ' open support ticket.', ' open support tickets.');
	}

	function renderPending() {
		const howMany = profile.open.length;
		const rowList = hook('open');
		hook('open-desc').textContent = openSummary();
		hook('tickets').textContent = ticketLine();
		/* With no rows, the column headings would label nothing. */
		rowList.closest('table').tHead.hidden = !howMany;
		if (!howMany) {
			const emptyText =
				FIRM.stage === 'former'
					? `Nothing open since they left: ${escapeText(FIRM.reason.toLowerCase())}.`
					: 'No quotes, orders or deals in progress.';
			rowList.innerHTML = `<tr><td colspan="4" class="cd-none-row">${emptyText}</td></tr>`;
			return;
		}
		rowList.innerHTML = profile.open.map(pendingRowMarkup).join('');
	}

	function pendingRowMarkup(row) {
		const kindInfo = ITEM_KIND[row.kind];
		const metaLine = [row.ref ? `${kindInfo.label} ${row.ref}` : '', row.meta].filter(Boolean).join(' · ');
		const amountCell = row.amount
			? escapeText(row.amount)
			: '<span class="cd-none"><span aria-hidden="true">–</span><span class="visually-hidden">No amount</span></span>';
		return `<tr><td><div class="cd-item"><span class="cd-tile cd-tone-${kindInfo.tone}" aria-hidden="true"><i class="bi ${kindInfo.icon}"></i></span><div class="cd-item-text"><a class="cd-item-title" href="${escapeText(row.href)}">${escapeText(row.title)}</a><span class="cd-item-meta">${escapeText(metaLine)}</span>${narrowLine(row.status, row.amount ? `${row.next} · ${row.amount}` : row.next)}</div></div></td><td class="cd-col-status">${statePill(row.status)}</td><td class="cd-col-due">${escapeText(row.next)}</td><td class="cd-col-num">${amountCell}</td></tr>`;
	}

	/* The facts list. */

	/** For a company without an account: who they are and where things stand. */
	function prospectFacts() {
		const { stage: stageKey, status: stageStatus } = FIRM;
		const website = `<a class="cd-link" href="https://${escapeText(FIRM.site)}" target="_blank" rel="noopener">${escapeText(FIRM.site)}</a>`;
		const cityHtml = `${escapeText(FIRM.city)}<span class="cd-facts-note">${escapeText(FIRM.region)}</span>`;
		const tail = [
			['Industry', escapeText(profile.facts.industry)],
			['City', cityHtml],
			['Website', website],
		];
		if (stageKey === 'former') {
			return [
				[
					'Plan',
					`${escapeText(PLAN_LABEL)}, ${FIRM.seats} seats<span class="cd-facts-note">Paid ${roundDollars(FIRM.worth)} a year</span>`,
				],
				['Customer', `${fullDay(FIRM.since)}<span class="cd-facts-note">to ${fullDay(FIRM.left)}</span>`],
				['Why they left', escapeText(FIRM.reason)],
				...tail,
			];
		}
		const isCustomer = stageKey === 'customer';
		const isLost = stageStatus === 'lost';
		const starts = isCustomer ? `, starts ${fullDay(FIRM.deals[0].closes)}` : '';
		return [
			[
				isCustomer ? 'Plan' : isLost ? 'Talked about' : 'Talking about',
				`${escapeText(PLAN_LABEL)}, ${FIRM.seats} seats<span class="cd-facts-note">${roundDollars(FIRM.worth)} a year${starts}</span>`,
			],
			[isCustomer ? 'Used before' : 'Uses today', escapeText(FIRM.today)],
			['Found us', escapeText(FIRM.source)],
			[isLost ? 'Why we lost' : 'Next step', escapeText(isLost ? FIRM.reason : FIRM.next)],
			...tail,
		];
	}

	function accountFactRows() {
		const facts = profile.facts;
		const termNote =
			{ trial: `Trial, ends ${fullDay(TERM_ENDS)}`, canceling: `Yearly, ends ${fullDay(TERM_ENDS)}` }[
				ACCOUNT.status
			] || `Yearly, renews ${fullDay(TERM_ENDS)}`;
		return [
			[
				'Plan',
				`<a class="cd-link" href="subscription-details.html?id=${encodeURIComponent(ACCOUNT.sub)}">${escapeText(PLAN_LABEL)}, ${ACCOUNT.seats} seats</a><span class="cd-facts-note">${termNote}</span>`,
			],
			['Industry', escapeText(facts.industry)],
			['Branches', escapeText(facts.branches)],
			['Invoice terms', escapeText(facts.terms)],
			['Credit limit', plainDollars(facts.limit)],
			['Billing address', escapeText(facts.address)],
			['Time zone', escapeText(facts.zone)],
		];
	}

	function renderFacts() {
		if (!ACCOUNT) {
			hook('account-title').textContent = 'Company';
			hook('account-desc').textContent =
				FIRM.stage === 'former'
					? 'What they had and why they left.'
					: 'Who they are and where the deal stands.';
			hook('account-edit').hidden = true;
			hook('people-desc').textContent = 'Who we talk to there, and our team.';
		}
		const factRows = ACCOUNT ? accountFactRows() : prospectFacts();
		hook('facts').innerHTML = factRows
			.map(([caption, detail]) => `<div><dt>${caption}</dt><dd>${detail}</dd></div>`)
			.join('');
	}

	/* Purchases, files and people. */

	function renderPurchases() {
		if (!ACCOUNT) {
			hook('orders-card').hidden = true;
			return;
		}
		const listed = profile.orders.length;
		const beyond = (ACCOUNT.store ? ACCOUNT.store[1] : ACCOUNT.orders.length) - listed;
		let footnote = 'Nothing bought from us yet.';
		if (beyond > 0) footnote = `And ${beyond} more orders since ${ACCOUNT.since.slice(0, 4)}.`;
		else if (listed) footnote = 'Every order is listed.';
		hook('orders-more').textContent = footnote;
		hook('orders').innerHTML = listed
			? profile.orders
					.map(
						(purchase) =>
							`<tr><td><div class="cd-item-text"><a class="cd-item-title" href="invoices.html">${escapeText(purchase.id)}</a><span class="cd-item-meta">${escapeText(purchase.items)}</span>${narrowLine(purchase.status, `${purchase.date} · ${purchase.total}`)}</div></td><td class="cd-col-date">${escapeText(purchase.date)}</td><td class="cd-col-status">${statePill(purchase.status)}</td><td class="cd-col-num">${escapeText(purchase.total)}</td></tr>`,
					)
					.join('')
			: '<tr><td colspan="4" class="cd-none-row">No purchases yet.</td></tr>';
	}

	function renderFiles() {
		if (!ACCOUNT) {
			hook('files-card').hidden = true;
			return;
		}
		const older = Math.max(1, 2026 - Number(ACCOUNT.since.slice(0, 4)) + 1);
		hook('files-more').textContent = `And ${older} more in the account folder.`;
		hook('files').innerHTML = profile.files
			.map(
				(paper, fileIndex) =>
					`<li class="cd-file"><span class="cd-tile cd-tile-sm cd-tone-${FILE_TONE[paper.type] || 5}" aria-hidden="true"><i class="bi ${FILE_ICON[paper.type]}"></i></span><div class="cd-item-text"><span class="cd-file-name">${escapeText(paper.name)}</span><span class="cd-item-meta">${escapeText(paper.meta)}</span></div><button type="button" class="btn btn-icon cd-icon-btn" data-cd-file="${fileIndex}" aria-label="Download ${escapeText(paper.name)}"><i class="bi bi-download" aria-hidden="true"></i></button></li>`,
			)
			.join('');
	}

	function renderPeople() {
		const roleHelp = window.Basalt.data.companies.roles;
		hook('contacts').innerHTML = profile.contacts.map((person) => contactMarkup(person, roleHelp)).join('');
		hook('team').innerHTML = profile.team
			.map(
				(member) =>
					`<li class="cd-person">${avatarSlot(member.name)}<div class="cd-item-text"><a class="cd-person-name cd-link" href="employee-user-details.html">${escapeText(member.name)}</a><span class="cd-item-meta">${escapeText(member.role)}</span></div></li>`,
			)
			.join('');
		fillAvatars(hook('contacts'));
		fillAvatars(hook('team'));
	}

	function contactMarkup(person, roleHelp) {
		const nameHtml = person.key
			? `<a class="cd-link" href="person-details.html?id=${encodeURIComponent(person.key)}">${escapeText(person.name)}</a>`
			: escapeText(person.name);
		const callLink = person.phone
			? `<a class="btn btn-icon cd-icon-btn" href="tel:${escapeText(person.phone.replace(/\s/g, ''))}" aria-label="Call ${escapeText(person.name)}, ${escapeText(person.phone)}"><i class="bi bi-telephone" aria-hidden="true"></i></a>`
			: '';
		return `<li class="cd-person">${avatarSlot(person.name)}<div class="cd-item-text"><span class="cd-person-name">${nameHtml} <span class="cd-role cd-role-${person.role.toLowerCase()}" title="${escapeText(roleHelp[person.role])}">${escapeText(person.role)}</span></span><span class="cd-item-meta">${escapeText(person.title)}</span></div><div class="cd-person-acts"><a class="btn btn-icon cd-icon-btn" href="mailto:${escapeText(person.email)}" aria-label="Email ${escapeText(person.name)}"><i class="bi bi-envelope" aria-hidden="true"></i></a>${callLink}</div></li>`;
	}

	/* The timeline: one kind at a time, five entries until unfolded. */

	function feedMatches() {
		return profile.feed.filter((entry) => feedFilter === 'all' || entry.kind === feedFilter);
	}

	function pressOnly(isPressed) {
		for (const chipNode of pickAll('[data-cd-kind]'))
			chipNode.setAttribute('aria-pressed', String(isPressed(chipNode)));
	}

	function renderTimeline() {
		const matching = feedMatches();
		const onScreen = feedExpanded ? matching : matching.slice(0, FEED_PAGE);
		hook('feed').innerHTML = onScreen.map(timelineItem).join('');
		const moreButton = hook('feed-more');
		const hiddenCount = matching.length - onScreen.length;
		moreButton.hidden = hiddenCount <= 0;
		moreButton.textContent = `Show ${hiddenCount} more`;
		highlightIndex = -1;
	}

	function timelineItem(entry) {
		const kindMeta = ENTRY_KIND[entry.kind];
		const metaLine = [entry.kind === 'note' ? null : entry.by, whenLabel(entry), entry.length]
			.filter(Boolean)
			.join(' · ');
		const fresh = profile.feed.indexOf(entry) === highlightIndex ? ' is-fresh' : '';
		return `<li class="cd-feed-item${fresh}"><span class="cd-feed-icon cd-tone-${kindMeta.tone}" aria-hidden="true"><i class="bi ${kindMeta.icon}"></i></span><div class="cd-feed-text"><p class="cd-feed-title">${escapeText(kindMeta.title(entry))}</p><p class="cd-feed-body">${escapeText(entry.text)}</p><span class="cd-feed-meta">${escapeText(metaLine)}</span></div></li>`;
	}

	/* The log activity drawer. */

	function toggleWithRow() {
		pick('[data-cd-with-wrap]', document).hidden = activityForm.elements.kind.value === 'note';
	}

	function onLogSubmit(event) {
		event.preventDefault();
		const logInputs = activityForm.elements;
		const noteText = logInputs.text.value.trim();
		const loggedOn = logInputs.date.value;
		const dateWrong = !loggedOn || loggedOn > profile.today;
		logInputs.text.classList.toggle('is-invalid', !noteText);
		logInputs.date.classList.toggle('is-invalid', dateWrong);
		if (dateWrong || !noteText) {
			(dateWrong ? logInputs.date : logInputs.text).focus();
			return;
		}
		const kindValue = logInputs.kind.value;
		const clock =
			loggedOn === profile.today
				? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()
				: '';
		const newEntry = { kind: kindValue, date: loggedOn, time: clock, by: profile.me, text: noteText };
		if (kindValue !== 'note') newEntry.with = logInputs.with.value;
		/* Newest first, so it goes after any entries from a later day. */
		let insertAt = profile.feed.findIndex((logged) => logged.date <= loggedOn);
		if (insertAt < 0) insertAt = profile.feed.length;
		profile.feed.splice(insertAt, 0, newEntry);
		highlightIndex = insertAt;
		feedFilter = 'all';
		feedExpanded = insertAt >= FEED_PAGE;
		pressOnly((chipNode) => chipNode.dataset.cdKind === 'all');
		renderTimeline();
		bootstrap.Offcanvas.getOrCreateInstance(logPanel).hide();
		pop({
			tone: 'success',
			title: kindValue === 'note' ? 'Note added' : `${ENTRY_KIND[kindValue].title(newEntry)} logged`,
			text: `It is in the ${FIRM.name} activity.`,
		});
	}

	/* The edit account drawer, which saves every editable fact at once. */

	function chooseOption(select, value) {
		select.value = value;
		select.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function fillEditForm() {
		const editInputs = factsForm.elements;
		const facts = profile.facts;
		chooseOption(editInputs.industry, facts.industry);
		chooseOption(editInputs.zone, facts.zone);
		editInputs.branches.value = facts.branches;
		editInputs.limit.value = String(facts.limit);
		editInputs.address.value = facts.address;
		for (const radio of pickAll('input[name="terms"]', factsForm)) radio.checked = radio.value === facts.terms;
		for (const flagged of pickAll('.is-invalid', factsForm)) flagged.classList.remove('is-invalid');
	}

	function onEditSubmit(event) {
		event.preventDefault();
		const editInputs = factsForm.elements;
		const limitText = editInputs.limit.value.replace(/[\s,$]/g, '');
		const checks = new Map([
			[editInputs.branches, !editInputs.branches.value.trim()],
			[editInputs.limit, !/^\d{1,7}$/.test(limitText)],
			[editInputs.address, !editInputs.address.value.trim()],
		]);
		let firstBad = null;
		for (const [input, wrong] of checks) {
			input.classList.toggle('is-invalid', wrong);
			if (wrong && !firstBad) firstBad = input;
		}
		if (firstBad) {
			firstBad.focus();
			return;
		}
		Object.assign(profile.facts, {
			industry: editInputs.industry.value,
			branches: editInputs.branches.value.trim(),
			terms: editInputs.terms.value,
			limit: Number(limitText),
			address: editInputs.address.value.trim(),
			zone: editInputs.zone.value,
		});
		renderFacts();
		hook('sub').textContent = headerSubline();
		bootstrap.Offcanvas.getOrCreateInstance(editPanel).hide();
		pop({ tone: 'success', title: 'Account details saved' });
	}

	start();
})();
