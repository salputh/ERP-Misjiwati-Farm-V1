/**
 * Draws person-details.html, the page for a single person you deal with,
 * whether they work at a paying customer or at a company still deciding.
 * The page says when and how to get hold of them, the one thing they owe
 * you next, the deals and quotes they sit on, who else works with them,
 * how they log in to Fieldline, the running history and an editable card
 * of their details. people-at-companies.html opens it as ?id=<first-last>.
 *
 * Wiring it to real data takes two changes. First, fetch the person for
 * ?id= so they arrive in the shape assets/basalt/js/data/multipurpose/members.js hands out;
 * everything shown is derived from that record plus their company in
 * assets/basalt/js/data/multipurpose/accounts.js and their deals in assets/basalt/js/data/multipurpose/deals.js
 * (an unknown id falls back to Carla Malone). Second, replace the bodies
 * in the server object below: the page changes straight away and rolls the
 * change back, with a warning toast, when a request is refused.
 * Avatars, copy buttons, styled selects, the segmented control and toasts
 * come from basalt.js.
 */
(() => {
	'use strict';

	const page = pick('[data-cnd-root]');
	if (!page) return;

	/* A frozen "now", shared with people-at-companies.html, so local times and day
     counts never drift between visits. A live app would use new Date(). */
	const NOW = new Date('2026-10-08T15:30:00Z');
	const DEMO_DAY = '2026-10-08';
	const AUTHOR = 'John Armstrong';
	const DAY_MS = 864e5;
	const FEED_PAGE = 4;

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTH_FULL = [
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

	/* Everything the history can hold, with its icon, ramp hue and label. */
	const ENTRY_KINDS = {
		email: { icon: 'bi-envelope', tone: 1, label: 'Email' },
		call: { icon: 'bi-telephone', tone: 2, label: 'Call' },
		meeting: { icon: 'bi-camera-video', tone: 5, label: 'Meeting' },
		note: { icon: 'bi-sticky', tone: 4, label: 'Note' },
		update: { icon: 'bi-eye', tone: 3, label: 'Update' },
	};

	/* Deal histories use their own icon words; this folds them into the kinds above. */
	const DEAL_ICON_KIND = {
		envelope: 'email',
		chat: 'email',
		calendar: 'meeting',
		display: 'meeting',
		check: 'call',
		flag: 'note',
		note: 'note',
		pen: 'update',
		eye: 'update',
	};

	/* How quickly someone tends to answer, by the part they play in buying. */
	const REPLY_HABITS = {
		decision: 'Usually answers email within a day.',
		champion: 'Usually answers the same day.',
		admin: 'Quickest on the phone in the morning.',
		billing: 'Answers email within a day.',
	};

	const QUOTE_STATUS = {
		draft: 'Draft',
		sent: 'Sent',
		accepted: 'Accepted',
		declined: 'Declined',
		expired: 'Expired',
	};
	const DEAL_HUES = [2, 5, 4, 1];
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const COMPOSER_HINTS = {
		note: 'Add a note for the team',
		call: 'What did you talk about?',
		email: 'What was the email about?',
		meeting: 'What was agreed?',
	};

	/* Each method is the moment a change would reach your backend; the demo
     settles after a quarter of a second, the way a request would. Routes:
     save PATCH /api/contacts/:id, logActivity POST /api/contacts/:id/activity,
     sendReminder POST /api/contacts/:id/reminders, sendInvite POST
     /api/contacts/:id/invite, resendInvite POST /api/members/:id/invite,
     resetPassword POST /api/members/:id/password-reset and removeMember
     DELETE /api/members/:id. */
	const server = {
		save: (key, changes) => settle(),
		logActivity: (key, entry) => settle(),
		sendReminder: (key, topic) => settle(),
		sendInvite: (key, role) => settle(),
		resendInvite: (key) => settle(),
		resetPassword: (key) => settle(),
		removeMember: (key) => settle(),
	};

	/* The records this page is built from. */
	const { accounts: ledger, deals: pipeline, members: roster } = window.Basalt.data;
	const ROLE_INFO = roster.roles;
	const requested = new URLSearchParams(location.search).get('id');
	const member = roster.find(requested) || roster.find('carla-malone');
	const personKey = member.key;
	const account = member.acct ? ledger.find(member.acct) : null;
	const buyer = account?.people.find((entry) => entry.key === personKey) || null;
	const leadDeal = member.deals.length ? pipeline.find(member.deals[0].id) : null;
	const zoneLabel = ledger.zoneName(member.tz);
	const openStages = pipeline.stages.filter((stage) => stage.id !== 'signed');
	const stageLabel = { ...Object.fromEntries(pipeline.stages.map((stage) => [stage.id, stage.name])), lost: 'Lost' };
	const company = describeCompany();
	const companyUrl = customerUrl(member.companyId);
	const subscriptionLink = account
		? link(
				'Open subscription',
				'bi-arrow-repeat',
				`subscription-details.html?id=${encodeURIComponent(account.sub)}`,
			)
		: null;
	const coworkers = gatherCoworkers();
	const person = coworkers.get(personKey);
	const quotes = quotesFor(person);
	const todayDate = midnight(DEMO_DAY);

	/* What the history list is showing: one kind or all, short or full,
     and the entry just added so it can flash once. */
	const feedView = { kind: '', expanded: false, latest: null };

	const ui = {
		remind: pick('[data-cnd-remind]', page),
		signin: hook('sign'),
		more: pick('[data-cnd-more]', page),
		filters: pick('[data-cnd-filters]', page),
		composer: pick('[data-cnd-composer]', page),
		note: pick('[data-cnd-note]', page),
		facts: hook('facts'),
		form: pick('[data-cnd-edit-form]', page),
		edit: pick('[data-cnd-edit]', page),
	};
	const hoursFieldset = pick('fieldset', ui.form);

	/** Connects every control on the page, then paints it for the first time. */
	function start() {
		person.task = nextTask();

		ui.remind.addEventListener('click', sendReminder);
		ui.signin.addEventListener('click', changeLogin);

		ui.more.addEventListener('click', () => {
			window.Basalt.slide(hook('feed'), () => {
				feedView.expanded = !feedView.expanded;
				paintFeed();
			});
		});
		ui.filters.addEventListener('change', ({ target }) => {
			if (target.name !== 'cnd-show') return;
			feedView.kind = target.value;
			feedView.expanded = false;
			paintFeed();
		});

		ui.composer.addEventListener('change', ({ target }) => {
			if (target.name === 'cnd-kind') ui.note.placeholder = COMPOSER_HINTS[target.value];
		});
		ui.note.addEventListener('input', () => {
			if (ui.note.value.trim()) ui.note.classList.remove('is-invalid');
		});
		ui.composer.addEventListener('submit', logActivity);
		pick('[data-cnd-log]', page).addEventListener('click', () => {
			ui.composer.scrollIntoView({ behavior: motionBehavior(), block: 'center' });
			ui.note.focus({ preventScroll: true });
		});

		field('start').innerHTML = hourChoices(5, 12);
		field('end').innerHTML = hourChoices(12, 21);
		ui.edit.addEventListener('click', showEditor);
		pick('[data-cnd-edit-cancel]', page).addEventListener('click', closeEditor);
		pick('[data-cnd-edit-from-menu]', page).addEventListener('click', editFromMenu);
		ui.form.addEventListener('input', ({ target }) => {
			if (target.classList.contains('is-invalid') && target.value.trim()) target.classList.remove('is-invalid');
		});
		ui.form.addEventListener('change', ({ target }) => {
			if (target === field('start') || target === field('end')) flagHours(false);
		});
		ui.form.addEventListener('submit', saveDetails);

		pick('[data-cnd-copy-link]', page).addEventListener('click', copyPageLink);

		paint();
		drawTrail(hook('steps'));
	}

	/** Repaints every card from the current state of the person. */
	function paint() {
		paintHeader();
		paintReach();
		paintTask();
		paintDeals();
		paintCompany();
		paintLogin();
		paintPinned();
		paintFeed();
		paintFacts();
	}

	/* The company is assembled once, at load: a customer from its own account
     record, a prospect only from what its deal knows about it. */
	function describeCompany() {
		if (account) {
			const trade = ledger.trades.find((entry) => entry.id === account.trade);
			return {
				id: account.id,
				name: account.name,
				about: trade.name,
				icon: trade.icon,
				tone: trade.tone,
				city: account.city,
				town: account.city.split(',')[0],
				plan: ledger.plans[account.plan].name,
				seats: account.seats,
				owner: account.owner,
			};
		}
		return {
			id: null,
			name: member.company,
			about: member.kind === 'new' ? 'New customer' : 'Prospect',
			icon: 'bi-buildings',
			tone: 2,
			city: member.city,
			town: member.city.split(',')[0],
			plan: ledger.plans[leadDeal.plan].name,
			seats: leadDeal.seats,
			owner: leadDeal.owner,
		};
	}

	/** Everyone at the same company, keyed by person, in the shape the cards read. */
	function gatherCoworkers() {
		const byKey = new Map();
		for (const record of roster.list()) {
			if (record.company !== member.company) continue;
			const [given, family] = splitName(record.name);
			const asBuyer = account ? account.people.find((entry) => entry.key === record.key) : null;
			byKey.set(record.key, {
				first: given,
				last: family,
				title: record.title,
				role: record.role,
				login: record.login,
				email: record.email,
				phone: record.phone,
				mobile: record.mobile,
				/* Their local working day, [start hour, end hour], Monday to Friday. */
				hours: record.hours,
				since: record.since,
				replies: (asBuyer && (asBuyer.replies || REPLY_HABITS[asBuyer.role])) || 'Answers email within a day.',
				pinned: record.note || prospectToday(),
				/* Each one is { id, title, stage, part, quote }. */
				deals: record.deals,
				/* Entries are { day, by, text, kind }, newest first. */
				activity: timelineOf(record),
			});
		}
		return byKey;
	}

	/* Surname particles ("de", "van") stay with the last name. */
	function splitName(full) {
		const words = full.split(' ');
		const particle = words.findIndex((word, index) => index > 0 && word[0] === word[0].toLowerCase());
		const cut = particle > 0 ? particle : words.length - 1;
		return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
	}

	function prospectToday() {
		if (!leadDeal || account || !leadDeal.today) return '';
		return `Today they work with: ${lowerFirst(leadDeal.today)}.`;
	}

	/** The person's history: the account log (or the deal's, for a prospect) plus their login events. */
	function timelineOf(record) {
		const given = firstWord(record.name);
		let entries = [];
		if (account) {
			entries = account.activity
				.filter((row) => row[1] === record.name || (row[4] || []).includes(record.key))
				.map(([day, by, text, kind]) => ({ day, by, text, kind }));
		} else if (leadDeal) {
			entries = leadDeal.history.map(([day, by, text, icon]) => ({
				day,
				by,
				text,
				kind: DEAL_ICON_KIND[icon] || 'note',
			}));
		}
		if (record.login) {
			entries.push({
				day: record.login.invited,
				by: company.owner,
				text: `Invited ${given} to Fieldline as ${ROLE_INFO[record.role].short.toLowerCase()}.`,
				kind: 'update',
			});
			if (record.login.accepted) {
				entries.push({
					day: record.login.accepted,
					by: record.name,
					text: 'Accepted the invite and signed in for the first time.',
					kind: 'update',
				});
			}
		}
		return entries.sort((a, b) => b.day.localeCompare(a.day));
	}

	/* Quotes addressed to them, or written for a deal they are on. */
	function quotesFor(someone) {
		const dealIds = new Set(someone.deals.map((deal) => deal.id));
		return pipeline.quotes().filter((quote) => quote.buyer?.key === personKey || dealIds.has(quote.deal));
	}

	/* The one thing the person owes you next. An open invite outranks a
     routine check-in, but nothing else a buyer owes. */
	function nextTask() {
		const owed = buyer ? buyerTask(buyer) : null;
		if (owed && owed.tag !== 'Check-in') return owed;
		if (person.login && !person.login.accepted) return inviteTask(member);
		if (owed) return owed;
		return account ? seatTask(member) : prospectTask(member);
	}

	/** Picks the first situation that fits someone buying from you at a customer. */
	function buyerTask(someone) {
		const situation = BUYER_SITUATIONS.find((entry) => entry.fits(someone));
		return situation.build(someone);
	}

	/* Checked in order; the last one always fits. */
	const BUYER_SITUATIONS = [
		{ fits: (someone) => awaitsSignature(someone), build: quoteToSign },
		{ fits: (someone) => someone.role === 'billing' && account.status === 'pastdue', build: overdueInvoice },
		{ fits: (someone) => someone.role !== 'billing' && Boolean(dealInvolving(someone)), build: dealGoAhead },
		{ fits: (someone) => someone.role === 'billing', build: upcomingPayment },
		{ fits: (someone) => someone.role === 'decision' && account.status === 'trial', build: trialCard },
		{ fits: (someone) => someone.role === 'decision' && account.status === 'canceling', build: leavingAccount },
		{ fits: (someone) => someone.role === 'decision' && Boolean(account.renews), build: renewalDecision },
		{ fits: () => true, build: checkInCall },
	];

	function awaitsSignature(someone) {
		const { renewal } = account;
		return Boolean(renewal && !renewal.signed && renewal.signer === someone.key);
	}

	function dealInvolving(someone) {
		return account.deals.find((deal) => deal.people.some((entry) => entry[0] === someone.key));
	}

	function renewalYearly(seats) {
		return Math.round(ledger.listMrr({ ...account, seats }) * 12);
	}

	function quoteToSign(someone) {
		const { renewal } = account;
		const given = firstWord(someone.name);
		const payer = account.people.find((entry) => entry.role === 'billing');
		const opened = Boolean(renewal.opened);
		return {
			summary: 'Their signature on the renewal quote.',
			due: account.renews,
			lead: 'Renews',
			tag: renewal.quote,
			what: `${renewal.seats} seats on ${company.plan}`,
			extra: `${wholeDollars(renewalYearly(renewal.seats))} a year`,
			steps: [
				milestone('Quote sent', `${monthDay(renewal.sent)} by ${account.owner}`, 'done'),
				milestone(
					'Opened',
					opened ? `${monthDay(renewal.opened)}, viewed twice` : 'Not yet',
					opened ? 'done' : 'now',
				),
				milestone('Signed', `Waiting for ${given}`, opened ? 'now' : 'next'),
				milestone('Invoice sent', `On ${monthDay(account.renews)}${payer ? `, to ${payer.name}` : ''}`, 'next'),
			],
			link: link(
				'Open quote',
				'bi-file-earmark-text',
				`quote-details.html?id=${encodeURIComponent(renewal.quote)}`,
			),
			nudge: `the renewal quote ${renewal.quote}`,
		};
	}

	function overdueInvoice(someone) {
		const unpaid = ledger.bills(account).find((bill) => bill.state === 'unpaid');
		const chasers = account.activity.filter(
			(row) => (row[4] || []).includes(someone.key) && /remind/i.test(row[2]),
		);
		const chased = chasers.length > 0;
		return {
			summary: 'Payment of the overdue renewal.',
			due: account.statusOn,
			lead: 'Due',
			tag: unpaid.no,
			what: wholeDollars(unpaid.amount),
			extra: 'for the yearly renewal',
			steps: [
				milestone('Invoice sent', monthDay(account.statusOn), 'done'),
				milestone(
					'Reminded',
					chased ? `${monthDay(chasers[0][0])} by ${chasers[0][1]}` : 'Not yet',
					chased ? 'done' : 'now',
				),
				milestone('Paid', `Waiting for ${firstWord(someone.name)}`, chased ? 'now' : 'next'),
			],
			link: link('Open invoice', 'bi-receipt', `invoice-details.html?id=${encodeURIComponent(unpaid.no)}`),
			nudge: `the unpaid invoice ${unpaid.no}`,
		};
	}

	function dealGoAhead(someone) {
		const deal = dealInvolving(someone);
		const reached = ['discovery', 'proposal', 'negotiation'].indexOf(deal.stage);
		const verb = someone.role === 'decision' ? 'Their sign-off on ' : 'Their go-ahead on ';
		return {
			summary: `${verb}${lowerFirst(deal.name)}.`,
			due: deal.closes,
			lead: 'Closes',
			tag: 'Deal',
			what: deal.name,
			extra: `+${wholeDollars(deal.value)} a year`,
			steps: [
				milestone('First call', `With ${account.owner}`, 'done'),
				milestone(
					'Proposal sent',
					reached >= 1 ? `By ${account.owner}` : 'Once the needs are clear',
					reached >= 1 ? 'done' : 'now',
				),
				milestone(
					'Terms agreed',
					reached >= 2 ? `Waiting for ${firstWord(someone.name)}` : 'After the proposal',
					reached >= 2 ? 'now' : 'next',
				),
				milestone('Signed', `By ${monthDay(deal.closes)}`, 'next'),
			],
			link: link('Open deal', 'bi-briefcase', dealUrl(accountDealId(deal.name))),
			nudge: `the ${lowerFirst(deal.name)} deal`,
		};
	}

	/* Billing contacts either wait for an unsigned renewal or for the next yearly bill. */
	function upcomingPayment() {
		const { renewal } = account;
		if (renewal && !renewal.signed) {
			const signer = account.people.find((entry) => entry.key === renewal.signer);
			const due = shiftDays(account.renews, 30);
			return {
				summary: `Payment for the renewal, once ${firstWord(signer ? signer.name : 'the buyer')} signs.`,
				due,
				lead: 'Due',
				tag: 'Renewal',
				what: wholeDollars(renewalYearly(renewal.seats)),
				extra: `for ${renewal.seats} seats on ${company.plan}`,
				steps: [
					milestone('Bank details checked', 'Before the renewal', 'done'),
					milestone('Invoice sent', `On ${monthDay(account.renews)}, once signed`, 'next'),
					milestone('Paid', `Due ${monthDay(due)}`, 'next'),
				],
				link: subscriptionLink,
				nudge: '',
			};
		}
		const [lastBill] = ledger.bills(account);
		return {
			summary: 'The next yearly invoice.',
			due: account.renews,
			lead: 'Due',
			tag: 'Renewal',
			what: wholeDollars(yearlyRevenue()),
			extra: 'billed once a year',
			steps: [
				milestone(
					'Last bill paid',
					lastBill ? `${monthDay(lastBill.at)}, ${wholeDollars(lastBill.amount)}` : 'None yet',
					lastBill ? 'done' : 'next',
				),
				milestone('Invoice sent', `On ${monthDay(account.renews)}`, 'next'),
				milestone('Paid', 'Within 30 days', 'next'),
			],
			link: subscriptionLink,
			nudge: '',
		};
	}

	function trialCard(someone) {
		return {
			summary: 'A card on file before the trial ends.',
			due: account.statusOn,
			lead: 'Trial ends',
			tag: 'Trial',
			what: `${account.seats} seats on ${company.plan}`,
			extra: `${wholeDollars(ledger.listMrr(account) * 12)} a year after`,
			steps: [
				milestone('Trial started', monthDay(account.since), 'done'),
				milestone('Card added', `Waiting for ${firstWord(someone.name)}`, 'now'),
				milestone('First bill', `On ${monthDay(account.statusOn)}`, 'next'),
			],
			link: subscriptionLink,
			nudge: 'adding a card before the trial ends',
		};
	}

	function leavingAccount(someone) {
		return {
			summary: 'Nothing more to sign: the account closes at the end of the term.',
			due: account.renews,
			lead: 'Leaves',
			tag: 'Canceled',
			what: `${account.seats} seats on ${company.plan}`,
			extra: 'not renewing',
			steps: [
				milestone('Asked to cancel', `By ${firstWord(someone.name)}`, 'done'),
				milestone('Data export', 'Sent before the last day', 'now'),
				milestone('Access ends', `On ${monthDay(account.renews)}`, 'next'),
			],
			link: subscriptionLink,
			nudge: '',
		};
	}

	/* Within sixty days of the renewal the review is booked; before that it waits. */
	function renewalDecision() {
		const { renewal } = account;
		const renewsSoon = (Date.parse(account.renews) - Date.parse(DEMO_DAY)) / DAY_MS <= 60;
		const signed = renewal && renewal.signed;
		const review = signed
			? milestone('Renewal review', 'Done', 'done')
			: milestone(
					'Renewal review',
					renewsSoon ? `Booked with ${account.owner}` : 'About two months before',
					renewsSoon ? 'now' : 'next',
				);
		let summary = 'Their renewal decision, later in the year.';
		if (signed) summary = `Nothing: they signed the renewal on ${monthDay(renewal.signed)}.`;
		else if (renewsSoon) summary = 'Their sign-off on the renewal.';
		return {
			summary,
			due: account.renews,
			lead: 'Renews',
			tag: 'Renewal',
			what: `${account.seats} seats on ${company.plan}`,
			extra: `${wholeDollars(yearlyRevenue())} a year`,
			steps: [
				review,
				milestone(
					'Quote sent',
					signed ? monthDay(renewal.sent) : 'About a month before',
					signed ? 'done' : 'next',
				),
				milestone(
					'Signed',
					signed ? monthDay(renewal.signed) : `By ${monthDay(account.renews)}`,
					signed ? 'done' : 'next',
				),
			],
			link: subscriptionLink,
			nudge: renewsSoon && !signed ? 'the renewal' : '',
		};
	}

	/* With nothing else open, the next quarterly call is due 91 days after
     the last one, or a fortnight from today if that has already passed. */
	function checkInCall() {
		const talks = account.activity.filter((row) => row[3] === 'meeting' || row[3] === 'call');
		const lastTalk = talks.length ? talks[0][0] : account.since;
		const planned = shiftDays(lastTalk, 91);
		return {
			summary: `A check-in call with ${account.owner}.`,
			due: planned <= DEMO_DAY ? shiftDays(DEMO_DAY, 14) : planned,
			lead: 'Due',
			tag: 'Check-in',
			what: `with ${account.owner}`,
			extra: 'every quarter',
			steps: [
				milestone('Last talk', monthDay(lastTalk), 'done'),
				milestone('Call booked', `With ${firstWord(account.owner)}`, 'now'),
				milestone('Notes shared', 'After the call', 'next'),
			],
			link: link('Company page', 'bi-buildings', customerUrl(account.id)),
			nudge: 'the check-in call',
		};
	}

	function inviteTask(someone) {
		const sentBy = leadDeal && !account ? leadDeal.owner : company.owner;
		return {
			summary: 'Accepting their invite to Fieldline.',
			due: shiftDays(someone.login.invited, 7),
			lead: 'Invite expires',
			tag: 'Invite',
			what: ROLE_INFO[someone.role].short,
			extra: `at ${company.name}`,
			steps: [
				milestone('Invite sent', `${monthDay(someone.login.invited)} by ${sentBy}`, 'done'),
				milestone('Accepted', `Waiting for ${firstWord(someone.name)}`, 'now'),
				milestone('First sign-in', 'Then two-step', 'next'),
			],
			link: account
				? link('Company page', 'bi-buildings', customerUrl(account.id))
				: link('Open deal', 'bi-briefcase', dealUrl(leadDeal.id)),
			nudge: 'their invite to Fieldline',
		};
	}

	/* For a prospect: the next stage of the deal, the set-up after signing,
     or a closed chapter when it was lost. */
	function prospectTask(someone) {
		const given = firstWord(someone.name);
		const shared = {
			what: leadDeal.title,
			extra: `+${wholeDollars(leadDeal.value)} a year`,
			link: link('Open deal', 'bi-briefcase', dealUrl(leadDeal.id)),
			nudge: '',
		};
		if (leadDeal.stage === 'signed') {
			return {
				...shared,
				summary: leadDeal.afterWin || 'Setting up their workspace.',
				due: leadDeal.closes,
				lead: 'Starts',
				tag: 'Signed',
				steps: [
					milestone('Signed', `${monthDay(leadDeal.signed)} by ${given}`, 'done'),
					milestone('Workspace set up', `With ${leadDeal.owner}`, 'now'),
					milestone('Owner invited', 'Then their team', 'next'),
				],
			};
		}
		if (leadDeal.stage === 'lost') {
			return {
				...shared,
				summary: `Nothing. ${leadDeal.reason}.`,
				due: leadDeal.lost,
				lead: 'Lost',
				already: true,
				tag: 'Deal',
				extra: 'not going ahead',
				steps: [
					milestone(stageLabel[leadDeal.lostFrom], 'Reached', 'done'),
					milestone('Lost', leadDeal.reason, 'done'),
				],
			};
		}
		const currentIndex = openStages.findIndex((stage) => stage.id === leadDeal.stage);
		const { part } = member.deals[0];
		return {
			...shared,
			summary: leadDeal.next ? leadDeal.next[0] : 'Their sign-off on the deal.',
			due: leadDeal.next ? leadDeal.next[1] : leadDeal.closes,
			lead: 'Due',
			tag: 'Deal',
			steps: openStages.map((stage, index) => {
				if (index < currentIndex) return milestone(stage.name, 'Done', 'done');
				if (index === currentIndex)
					return milestone(
						stage.name,
						part === 'Signs' ? `Waiting for ${given}` : `${given}: ${part.toLowerCase()}`,
						'now',
					);
				return milestone(
					stage.name,
					index === openStages.length - 1 ? `By ${monthDay(leadDeal.closes)}` : 'Next',
					'next',
				);
			}),
			nudge: `the ${leadDeal.title} deal`,
		};
	}

	/* A member who logs in but has no part in buying: only two-step can be outstanding. */
	function seatTask(someone) {
		const secured = someone.login.how === 'sso' || someone.login.twoStep;
		return {
			summary: secured ? 'Nothing. They use Fieldline day to day.' : 'Turning on two-step sign-in.',
			due: someone.login.last.slice(0, 10),
			lead: 'Signed in',
			already: true,
			tag: ROLE_INFO[someone.role].short,
			what: `${company.plan} plan`,
			extra: `one of ${company.seats} seats`,
			steps: [
				milestone('Invited', monthDay(someone.login.invited), 'done'),
				milestone('Accepted', monthDay(someone.login.accepted), 'done'),
				milestone(
					'Two-step on',
					secured ? 'Done' : `Waiting for ${firstWord(someone.name)}`,
					secured ? 'done' : 'now',
				),
			],
			link: link('Company page', 'bi-buildings', customerUrl(account.id)),
			nudge: secured ? '' : 'turning on two-step sign-in',
		};
	}

	function milestone(title, note, state) {
		return { title, note, state };
	}

	function link(label, icon, href) {
		return { label, icon, href };
	}

	function yearlyRevenue() {
		return Math.round(ledger.mrr(account) * 12);
	}

	/* The deal record matching a deal named on the account, or a slug of its name. */
	function accountDealId(name) {
		const match = pipeline.list().find((deal) => deal.acct === account.id && deal.title === name);
		return match ? match.id : ledger.slug(name);
	}

	/* The header and the Reach card read their local clock. */
	function paintHeader() {
		const status = availability();
		const portrait = hook('avatar');
		portrait.setAttribute('data-name', displayName());
		window.Basalt.avatar?.(portrait);
		hook('presence').className = status.working
			? 'basalt-avatar-status-dot basalt-avatar-status-dot-online'
			: 'basalt-avatar-status-dot';
		hook('name').textContent = displayName();
		document.title = `${displayName()} · Basalt`;
		hook('sub').innerHTML =
			`${htmlSafe(person.title || 'Job title not added')} at <a class="cnd-link" href="${companyUrl}">${htmlSafe(company.name)}</a>`;

		const tags = hook('tags');
		const presence = `<span class="cnd-presence${status.working ? ' is-on' : ''}">${status.working ? 'At work now' : 'Off work now'}</span>`;
		const owner = `<a class="cnd-owner" href="${pipeline.ownerUrl(company.owner)}" title="Looks after ${htmlSafe(company.name)}">${avatarMarkup(company.owner, 'basalt-avatar-xs')}<span>${htmlSafe(company.owner)}</span></a>`;
		tags.innerHTML = roleBadge(person.role) + presence + owner;
		hook('menu-company').href = companyUrl;
		window.Basalt.avatars?.(tags);
	}

	function paintReach() {
		const status = availability();
		const [startHour] = person.hours;
		const callWindowEnd = Math.min(startHour + 3, person.hours[1]);
		let advice = 'Outside their working day. An email will be waiting when they start.';
		if (status.working) {
			const early = status.minutes < callWindowEnd * 60;
			advice = `A good moment: it is ${early ? 'early in their day, the best time for a call.' : 'their working day.'}`;
		}
		if (person.replies) advice += ` ${person.replies}`;

		hook('reach-title').textContent = `Reach ${person.first}`;
		hook('reach-desc').textContent = advice;
		hook('clock').textContent = clockLabel(status.minutes);
		hook('clock-day').textContent = status.weekday;
		hook('where').textContent = `${company.town} · ${zoneLabel}`;
		const workState = hook('state');
		workState.className = status.working ? 'cnd-state is-on' : 'cnd-state';
		workState.textContent = status.label;

		const mailto = `mailto:${person.email}`;
		const email = hook('email');
		email.textContent = person.email;
		email.href = mailto;
		hook('email-btn').href = mailto;

		const phone = hook('phone');
		phone.textContent = person.phone || 'Not added';
		phone.href = person.phone ? dialUrl(person.phone) : '#';
		phone.closest('.cnd-way').hidden = !person.phone;

		const callButton = hook('call-btn');
		const callable = person.phone || person.mobile;
		callButton.href = callable ? dialUrl(callable) : '#';
		callButton.hidden = !callable;

		const mobile = hook('mobile');
		mobile.textContent = person.mobile;
		mobile.href = person.mobile ? dialUrl(person.mobile) : '#';
		hook('mobile-row').hidden = !person.mobile;
	}

	/**
	 * Their weekday, minutes past midnight and whether they are working, read
	 * through the browser's time zone tables so daylight saving is right.
	 * @returns {{weekday: string, minutes: number, working: boolean, label: string}}
	 */
	function availability() {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: member.tz,
			weekday: 'long',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
		}).formatToParts(NOW);
		const read = (type) => parts.find((part) => part.type === type)?.value;
		const weekday = read('weekday');
		const minutes = Number(read('hour')) * 60 + Number(read('minute'));
		const [opens, closes] = person.hours.map((hour) => hour * 60);
		const weekend = weekday === 'Saturday' || weekday === 'Sunday';
		const working = !weekend && minutes >= opens && minutes < closes;
		const backMonday = weekend || (weekday === 'Friday' && minutes >= closes);
		return {
			weekday,
			minutes,
			working,
			label: working
				? `At work until ${clockLabel(closes)}`
				: `Off work, back ${backMonday ? 'Monday ' : ''}${clockLabel(opens)}`,
		};
	}

	/* The waiting card shows that one thing; the reminder nudges them about it. */
	function paintTask() {
		const { task } = person;
		const date = midnight(task.due);
		const offset = -ageInDays(task.due);
		hook('wait-title').textContent = `Waiting on ${person.first}`;
		hook('wait-desc').textContent = task.summary;

		const calendar = `<span class="cnd-cal" aria-hidden="true"><span class="cnd-cal-month">${MONTH_ABBR[date.getMonth()]}</span><span class="cnd-cal-day">${date.getDate()}</span></span>`;
		const when = `<span class="cnd-renew-when">${countdown(task.lead, offset, task.already)}<span class="visually-hidden">, ${longDate(task.due)}</span></span>`;
		const what = `<span class="cnd-renew-what">${htmlSafe(task.tag)}: <strong>${htmlSafe(task.what)}</strong>, ${htmlSafe(task.extra)}</span>`;
		hook('renew').innerHTML = `${calendar}<span class="cnd-renew-text">${when}${what}</span>`;
		hook('steps').innerHTML = task.steps.map(stepMarkup).join('');

		const button = hook('wait-link');
		button.href = task.link.href;
		button.innerHTML = `<i class="bi ${task.link.icon} me-1" aria-hidden="true"></i>${htmlSafe(task.link.label)}`;
		ui.remind.hidden = !task.nudge;
	}

	const STEP_SPOKEN = { done: 'done', now: 'waiting' };

	/**
	 * Grows the lines under finished steps the first time the list is on
	 * screen. Later repaints show them already drawn.
	 */
	function drawTrail(trail) {
		const lines = pickAll('.cnd-step.is-done:not(:last-child)', trail);
		if (!lines.length || !window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		lines.forEach((line, at) => line.style.setProperty('--cnd-trail-at', at));
		let left = lines.length;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'cnd-trail-grow' || --left) return;
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

	function stepMarkup({ title, note, state }, index) {
		const marker = state === 'done' ? '<i class="bi bi-check-lg"></i>' : index + 1;
		const spoken = STEP_SPOKEN[state] || 'to come';
		return `<li class="cnd-step is-${state}"><span class="cnd-step-mark" aria-hidden="true">${marker}</span><span class="cnd-step-text"><span class="cnd-step-title">${htmlSafe(title)}<span class="visually-hidden">, ${spoken}</span></span><span class="cnd-step-note">${htmlSafe(note)}</span></span></li>`;
	}

	/** "Renews in 12 days", "Overdue by 3 days", or "Signed in 2 days ago" for past events. */
	function countdown(lead, days, already) {
		if (already) return `${lead} ${relativeDay(-days)}`;
		if (days < 0) return `Overdue by ${-days}${days === -1 ? ' day' : ' days'}`;
		const near = { 0: `${lead} today`, 1: `${lead} tomorrow` }[days];
		return near || `${lead} in ${days} days`;
	}

	function sendReminder() {
		const topic = person.task.nudge;
		const entry = newEntry(`Sent ${person.first} a reminder about ${topic}.`, 'email');
		ui.remind.disabled = true;
		ui.remind.innerHTML = '<i class="bi bi-check2 me-1" aria-hidden="true"></i>Reminder sent';
		addEntry(entry);
		notify({
			tone: 'success',
			icon: 'bi-bell',
			title: `Reminder sent to ${displayName()}`,
			text: `About ${topic}.`,
		});
		server.sendReminder(personKey, topic).catch(() => {
			dropEntry(entry);
			ui.remind.disabled = false;
			ui.remind.innerHTML = '<i class="bi bi-bell me-1" aria-hidden="true"></i>Send a reminder';
			notify({ tone: 'danger', title: 'The reminder didn’t go', text: 'Try again in a moment.' });
		});
	}

	/* Deals, quotes and the company card come straight from the records. */
	function paintDeals() {
		const deals = person.deals.map((deal) => ({ value: pipeline.find(deal.id).value, ...deal }));
		const open = deals.filter((deal) => deal.stage !== 'signed' && deal.stage !== 'lost');
		hook('deals-title').textContent = 'Deals and quotes';
		hook('deals-desc').textContent = dealsSummary(deals, open);
		hook('deals').innerHTML = deals.map(dealMarkup).join('');
		hook('quotes').hidden = !quotes.length;
		hook('quote-list').innerHTML = quotes
			.map((quote) => {
				const href = `quote-details.html?id=${encodeURIComponent(quote.id)}`;
				return `<li class="cnd-quote"><a class="cnd-link" href="${href}">${htmlSafe(quote.id)}</a><span class="cnd-quote-what">${htmlSafe(quote.title || 'Courses and set-up')}</span><span class="cnd-quote-state">${htmlSafe(QUOTE_STATUS[quote.status] || quote.status)}</span></li>`;
			})
			.join('');
	}

	function dealsSummary(deals, open) {
		if (!deals.length) return `${person.first} isn’t part of an open deal.`;
		if (!open.length) {
			return deals.some((deal) => deal.stage === 'signed')
				? 'Signed. Fieldline is being set up for them.'
				: 'No open deal right now.';
		}
		const total = open.reduce((sum, deal) => sum + deal.value, 0);
		const ending = ['it closes.', 'both close.'][open.length - 1] || 'they all close.';
		return `+${dollars(total)} a year if ${ending}`;
	}

	function dealMarkup(deal, index) {
		const reached =
			deal.stage === 'signed' ? openStages.length - 1 : openStages.findIndex((stage) => stage.id === deal.stage);
		const segments = openStages
			.map((stage, position) => `<span class="cnd-deal-seg${position <= reached ? ' is-on' : ''}"></span>`)
			.join('');
		const progress =
			deal.stage === 'signed'
				? ''
				: `<span class="visually-hidden">, step ${reached + 1} of ${openStages.length}</span>`;
		return `<li class="cnd-deal cnd-tone-${DEAL_HUES[index % DEAL_HUES.length]}"><a class="cnd-name" href="${dealUrl(deal.id)}">${htmlSafe(deal.title)}</a><span class="cnd-deal-amt">+${dollars(deal.value)}</span><span class="cnd-deal-track" aria-hidden="true">${segments}</span><span class="cnd-deal-meta"><span class="cnd-deal-stage">${htmlSafe(stageLabel[deal.stage])}${progress}</span><span>${htmlSafe(person.first)} ${htmlSafe(deal.part.toLowerCase())}</span></span></li>`;
	}

	const PROSPECT_STATE = { signed: 'Being set up', lost: 'Deal lost' };

	function paintCompany() {
		const tile = pick('.cnd-co-tile', page);
		tile.className = `cnd-co-tile cnd-tone-${company.tone}`;
		tile.innerHTML = `<i class="bi ${company.icon}"></i>`;
		hook('co-name').textContent = company.name;
		hook('co-sub').textContent = `${company.about} · ${company.city}`;
		const stateBadge = company.id ? '' : tonePill(PROSPECT_STATE[leadDeal.stage] || 'Not signed yet', 6);
		hook('co-tags').innerHTML =
			`${tonePill(`${company.plan} plan`, 1)}${tonePill(`${company.seats} seats`, 3)}${stateBadge}`;

		const others = [...coworkers.entries()].filter(([key]) => key !== personKey).map(([, other]) => other);
		const heading = hook('mates-title');
		heading.textContent = `Also at ${company.name}`;
		heading.hidden = !others.length;
		const overflow = hook('mates-more');
		overflow.hidden = others.length <= 4;
		overflow.textContent = `And ${others.length - 4} more on the company page.`;

		const list = hook('mates');
		list.innerHTML = others
			.slice(0, 4)
			.map((other) => {
				const name = `${other.first} ${other.last}`;
				return `<li class="cnd-mate">${avatarMarkup(name, 'basalt-avatar-sm')}<span class="cnd-mate-text"><a class="cnd-name" href="${profileUrl(name)}">${htmlSafe(name)}</a><span class="cnd-mate-sub">${htmlSafe(other.title)}</span>${roleBadge(other.role)}</span></li>`;
			})
			.join('');
		hook('co-link').href = companyUrl;
		window.Basalt.avatars?.(list);
	}

	/* The Sign-in card shows how they log in and offers what can change. */
	const NO_LOGIN_REASON = { signed: ' Their workspace is being set up.', lost: ' Their company chose not to buy.' };

	function paintLogin() {
		const { login } = person;
		hook('sign-desc').textContent = login
			? `How ${person.first} gets into Fieldline at ${company.name}.`.replace('..', '.')
			: `${person.first} doesn’t sign in to Fieldline.`;
		ui.signin.innerHTML = login ? loginDetails(login) : noLogin();
	}

	/* A contact who never logs in can be invited, unless their company already said no. */
	function noLogin() {
		const reason = company.id ? '' : NO_LOGIN_REASON[leadDeal.stage] || ' Their company hasn’t signed yet.';
		const closed = leadDeal && !account && leadDeal.stage === 'lost';
		const invite = closed
			? ''
			: '<button type="button" class="btn btn-primary btn-sm" data-cnd-sign="invite"><i class="bi bi-envelope-plus me-1" aria-hidden="true"></i>Invite to Fieldline</button>';
		return `<div class="cnd-sign-none"><span class="cnd-way-icon cnd-tone-6" aria-hidden="true"><i class="bi bi-person-lock"></i></span><p class="cnd-quiet">No login. ${htmlSafe(person.first)} is someone you talk to, not someone who uses the product.${reason}</p>${invite}</div>`;
	}

	function loginDetails(login) {
		const sso = login.how === 'sso';
		let twoStepNote = 'Ask them to turn it on';
		if (sso) twoStepNote = 'Through their company';
		else if (login.twoStep) twoStepNote = 'Code from an app';
		const method = sso
			? loginFact(
					'bi-building-lock',
					1,
					'Signs in with',
					'Company sign-in',
					`Single sign-on, set up by ${htmlSafe(company.name)}`,
				)
			: loginFact('bi-key', 1, 'Signs in with', 'Email and password', '');
		const facts = [
			method,
			loginFact(
				'bi-shield-check',
				login.twoStep || sso ? 2 : 4,
				'Two-step',
				sso || login.twoStep ? 'On' : 'Off',
				twoStepNote,
			),
			loginFact('bi-clock-history', 5, 'Last signed in', login.last ? lastLogin(login.last) : 'Not yet', ''),
			loginFact(
				'bi-envelope-check',
				3,
				'Invite',
				login.accepted ? `Accepted ${longDate(login.accepted)}` : 'Not accepted yet',
				`Sent ${longDate(login.invited)}`,
			),
		];

		const actions = [];
		if (!login.accepted) actions.push(loginButton('resend', 'secondary', 'bi-envelope-arrow-up', 'Resend invite'));
		if (!sso && login.accepted) actions.push(loginButton('reset', 'secondary', 'bi-key', 'Reset password'));
		actions.push(
			person.role === 'owner'
				? '<p class="cnd-quiet cnd-sign-note">The owner pays for the account, so they can’t be removed. Make someone else the owner first.</p>'
				: loginButton('remove', 'danger', 'bi-person-dash', 'Remove from account'),
		);
		return `<dl class="cnd-sign-grid">${facts.join('')}</dl><div class="cnd-sign-acts">${actions.join('')}</div>`;
	}

	function loginFact(icon, tone, label, value, note) {
		const aside = note ? `<span class="cnd-fact-sub">${note}</span>` : '';
		return `<div class="cnd-sign-fact"><span class="cnd-way-icon cnd-tone-${tone}" aria-hidden="true"><i class="bi ${icon}"></i></span><div><dt>${label}</dt><dd>${value}${aside}</dd></div></div>`;
	}

	function loginButton(action, look, icon, label) {
		return `<button type="button" class="btn btn-outline-${look} btn-sm" data-cnd-sign="${action}"><i class="bi ${icon} me-1" aria-hidden="true"></i>${label}</button>`;
	}

	/* Recent logins read as "Today" or "3 days ago"; older ones as a date. Times stay in UTC. */
	function lastLogin(stamp) {
		const age = ageInDays(stamp.slice(0, 10));
		const hour = Number(stamp.slice(11, 13));
		const day =
			{ 0: 'Today', 1: 'Yesterday' }[age] ?? (age < 14 ? `${age} days ago` : longDate(stamp.slice(0, 10)));
		return `${day}, ${hour % 12 || 12}${stamp.slice(13, 16)}${hour < 12 ? ' am' : ' pm'} UTC`;
	}

	/* What each login button does to the person, the line it adds to the
     history, the toast it shows and the request it sends. */
	const LOGIN_CHANGES = {
		invite() {
			person.role = 'member';
			person.login = { how: 'password', twoStep: false, last: null, invited: DEMO_DAY, accepted: null };
			return {
				line: `Invited ${person.first} to Fieldline as member.`,
				notice: () => ({
					tone: 'success',
					icon: 'bi-envelope-check',
					title: 'Invite sent',
					text: `${displayName()} can sign in once they accept it.`,
				}),
				request: () => server.sendInvite(personKey, 'member'),
			};
		},
		resend() {
			person.login = { ...person.login, invited: DEMO_DAY };
			return {
				line: `Sent the invite to ${person.first} again.`,
				notice: () => ({
					tone: 'success',
					icon: 'bi-envelope-arrow-up',
					title: 'Invite sent again',
					text: `To ${person.email}.`,
				}),
				request: () => server.resendInvite(personKey),
			};
		},
		reset() {
			return {
				line: `Sent ${person.first} a link to reset their password.`,
				notice: () => ({
					tone: 'success',
					icon: 'bi-key',
					title: 'Reset link sent',
					text: `${person.first} picks a new password from the email.`,
				}),
				request: () => server.resetPassword(personKey),
			};
		},
		remove() {
			person.role = 'contact';
			person.login = null;
			return {
				line: `Removed ${person.first} from the ${company.name} account.`,
				notice: (undo) => ({
					tone: 'success',
					icon: 'bi-person-dash',
					title: `${person.first} removed from the account`,
					text: 'Kept as a contact. Their seat is free again.',
					actions: [{ label: 'Undo', onClick: undo }],
				}),
				request: () => server.removeMember(personKey),
			};
		},
	};

	function changeLogin(event) {
		const button = event.target.closest('[data-cnd-sign]');
		if (!button) return;
		const previous = { role: person.role, login: person.login };
		const change = (LOGIN_CHANGES[button.dataset.cndSign] || LOGIN_CHANGES.remove)();
		const entry = newEntry(change.line, 'update');
		const undo = () => {
			Object.assign(person, previous);
			dropEntry(entry);
			paint();
		};
		notify(change.notice(undo));
		addEntry(entry);
		paint();
		change.request().catch(() => {
			undo();
			notify({
				tone: 'danger',
				title: 'That didn’t go through',
				text: 'Nothing was changed. Try again in a moment.',
			});
		});
	}

	/* The history card holds a pinned note, the composer, filters and the feed. */
	function paintPinned() {
		const pin = hook('pin');
		pin.hidden = !person.pinned;
		pin.innerHTML = `<i class="bi bi-pin-angle" aria-hidden="true"></i><span><span class="cnd-pin-label">Good to know</span> ${htmlSafe(person.pinned)}</span>`;
	}

	function paintFeed() {
		const matching = feedView.kind
			? person.activity.filter((entry) => entry.kind === feedView.kind)
			: person.activity;
		const visible = feedView.expanded ? matching : matching.slice(0, FEED_PAGE);
		hook('feed').innerHTML = visible.map(entryMarkup).join('');
		hook('feed-empty').hidden = matching.length > 0;
		ui.more.hidden = matching.length <= FEED_PAGE;
		ui.more.textContent = feedView.expanded ? 'Show fewer' : `Show all ${matching.length}`;
		ui.more.setAttribute('aria-expanded', String(feedView.expanded));
	}

	function entryMarkup(entry) {
		const kind = ENTRY_KINDS[entry.kind];
		const when = entry.day === DEMO_DAY ? 'Today' : compactDate(entry.day);
		const fresh = entry === feedView.latest ? ' is-fresh' : '';
		return `<li class="cnd-act${fresh}"><span class="cnd-act-icon cnd-tone-${kind.tone}" aria-hidden="true"><i class="bi ${kind.icon}"></i></span><span class="cnd-act-text"><span class="visually-hidden">${kind.label}: </span>${htmlSafe(entry.text)}<span class="cnd-act-by">${htmlSafe(entry.by)} · ${when}</span></span></li>`;
	}

	function newEntry(text, kind) {
		return { day: DEMO_DAY, by: AUTHOR, text, kind };
	}

	/* A new entry goes to the top; if the filter would hide it, the filter goes back to All. */
	function addEntry(entry) {
		person.activity.unshift(entry);
		feedView.latest = entry;
		if (feedView.kind && feedView.kind !== entry.kind) {
			feedView.kind = '';
			pick('#cnd-show-all').checked = true;
		}
		paintFeed();
	}

	function dropEntry(entry) {
		const position = person.activity.indexOf(entry);
		if (position >= 0) person.activity.splice(position, 1);
		paintFeed();
	}

	function logActivity(event) {
		event.preventDefault();
		const text = ui.note.value.trim();
		if (!text) {
			ui.note.classList.add('is-invalid');
			ui.note.focus();
			return;
		}
		ui.note.classList.remove('is-invalid');
		const kind = pick('input[name="cnd-kind"]:checked', ui.composer).value;
		const entry = newEntry(text, kind);
		ui.note.value = '';
		addEntry(entry);
		notify({
			tone: 'success',
			icon: ENTRY_KINDS[kind].icon,
			title: `${ENTRY_KINDS[kind].label} added`,
			text: `It shows first in ${person.first}’s history.`,
		});
		server.logActivity(personKey, entry).catch(() => {
			dropEntry(entry);
			ui.note.value = text;
			notify({ tone: 'danger', title: 'That didn’t save', text: 'Check your connection and add it again.' });
		});
	}

	/* The details card swaps between a read view and a form for the whole set. */
	const MISSING = '<span class="cnd-fact-sub">Not added</span>';

	function paintFacts() {
		const since = midnight(person.since);
		const role = ROLE_INFO[person.role];
		const phoneLink = (number) =>
			number ? `<a class="cnd-link" href="${dialUrl(number)}">${htmlSafe(number)}</a>` : MISSING;
		const rows = [
			['Job title', person.title ? htmlSafe(person.title) : MISSING],
			['Role', `${htmlSafe(role.label)}<span class="cnd-fact-sub">${htmlSafe(role.about)}</span>`],
			['Work email', `<a class="cnd-link" href="mailto:${htmlSafe(person.email)}">${htmlSafe(person.email)}</a>`],
			['Work phone', phoneLink(person.phone)],
			['Mobile', phoneLink(person.mobile)],
			[
				'Working day',
				`${clockLabel(person.hours[0] * 60)} – ${clockLabel(person.hours[1] * 60)}, Monday to Friday<span class="cnd-fact-sub">${htmlSafe(zoneLabel)}</span>`,
			],
			['In touch since', `${MONTH_FULL[since.getMonth()]} ${since.getFullYear()}`],
		];
		ui.facts.innerHTML = rows.map(([term, detail]) => `<div><dt>${term}</dt><dd>${detail}</dd></div>`).join('');
	}

	function field(name) {
		return pick(`[data-cnd-f="${name}"]`, ui.form);
	}

	/* Anyone with a login holds one of the four account roles; a plain
     contact stays a contact until the Sign-in card invites them. */
	function roleChoices() {
		const keys = person.login ? ['owner', 'billing', 'admin', 'member'] : ['contact'];
		return keys
			.map((key) => {
				const role = ROLE_INFO[key];
				return `<option value="${key}" data-dot="series-${role.tone}" data-hint="${htmlSafe(role.about)}">${htmlSafe(role.label)}</option>`;
			})
			.join('');
	}

	function hourChoices(first, last) {
		const options = [];
		for (let hour = first; hour <= last; hour += 1)
			options.push(`<option value="${hour}">${clockLabel(hour * 60)}</option>`);
		return options.join('');
	}

	function flagHours(invalid) {
		hoursFieldset.classList.toggle('is-bad', invalid);
		field('start').classList.toggle('is-invalid', invalid);
		field('end').classList.toggle('is-invalid', invalid);
	}

	function showEditor() {
		for (const name of ['first', 'last', 'title', 'email', 'phone', 'mobile']) field(name).value = person[name];
		field('role').innerHTML = roleChoices();
		field('role').value = person.role;
		field('start').value = String(person.hours[0]);
		field('end').value = String(person.hours[1]);
		for (const name of ['role', 'start', 'end']) window.Basalt.select?.refresh?.(field(name));
		for (const name of ['first', 'last', 'email']) field(name).classList.remove('is-invalid');
		flagHours(false);
		ui.facts.hidden = true;
		ui.edit.hidden = true;
		ui.form.hidden = false;
		field('first').focus();
	}

	function closeEditor() {
		ui.form.hidden = true;
		ui.facts.hidden = false;
		ui.edit.hidden = false;
		ui.edit.focus();
	}

	function editFromMenu() {
		if (ui.form.hidden) showEditor();
		ui.form.closest('.cnd-card').scrollIntoView({ behavior: motionBehavior(), block: 'start' });
		field('first').focus({ preventScroll: true });
	}

	function saveDetails(event) {
		event.preventDefault();
		const text = (name) => field(name).value.trim();
		const draft = {
			first: text('first'),
			last: text('last'),
			title: text('title'),
			role: field('role').value,
			email: text('email'),
			phone: text('phone'),
			mobile: text('mobile'),
			hours: [Number(field('start').value), Number(field('end').value)],
		};
		const problems = { first: !draft.first, last: !draft.last, email: !EMAIL_SHAPE.test(draft.email) };
		for (const [name, wrong] of Object.entries(problems)) field(name).classList.toggle('is-invalid', wrong);
		const hoursWrong = draft.hours[1] <= draft.hours[0];
		flagHours(hoursWrong);

		const firstProblem = Object.keys(problems).find((name) => problems[name]) || (hoursWrong && 'start');
		if (firstProblem) {
			field(firstProblem).focus();
			return;
		}

		const previous = Object.fromEntries(Object.keys(draft).map((name) => [name, person[name]]));
		Object.assign(person, draft);
		paint();
		closeEditor();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Details saved',
			text: `${displayName()} is up to date.`,
		});
		server.save(personKey, draft).catch(() => {
			Object.assign(person, previous);
			paint();
			notify({
				tone: 'danger',
				title: 'The details didn’t save',
				text: 'Nothing was changed. Try again in a moment.',
			});
		});
	}

	function copyPageLink() {
		const [address] = location.href.split('#');
		const acknowledge = () => {
			notify({ tone: 'success', icon: 'bi-link-45deg', title: 'Link copied' });
			window.Basalt.announce?.('Link copied.');
		};
		if (window.Basalt.copyText) window.Basalt.copyText(address).then(acknowledge);
		else acknowledge();
	}

	/* Small formatting helpers for markup, links, dates and money. */
	function hook(name) {
		return pick(`[data-cnd="${name}"]`, page);
	}

	function settle() {
		return new Promise((resolve) => setTimeout(resolve, 250));
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options);
	}

	function motionBehavior() {
		return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
	}

	function tonePill(text, tone) {
		return `<span class="cnd-pill cnd-tone-${tone}">${htmlSafe(text)}</span>`;
	}

	function roleBadge(key) {
		return tonePill(ROLE_INFO[key].label, ROLE_INFO[key].tone);
	}

	function avatarMarkup(name, size) {
		return `<span class="basalt-avatar ${size}" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(name)}"></span>`;
	}

	function displayName() {
		return `${person.first} ${person.last}`;
	}

	function firstWord(name) {
		return name.split(' ')[0];
	}

	function lowerFirst(text) {
		return text.charAt(0).toLowerCase() + text.slice(1);
	}

	function dealUrl(id) {
		return `deal-details.html?id=${encodeURIComponent(id)}`;
	}

	function customerUrl(id) {
		return `company-details.html?id=${encodeURIComponent(id)}`;
	}

	/* People link to each other by an accent-free, dash-joined version of their name. */
	function profileUrl(name) {
		const key = name
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		return `person-details.html?id=${encodeURIComponent(key)}`;
	}

	function dialUrl(number) {
		return `tel:${number.replace(/[^\d+]/g, '')}`;
	}

	function wholeDollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function dollars(amount) {
		return `$${amount.toLocaleString('en-US')}`;
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	/** Minutes past midnight as "9:05 am". */
	function clockLabel(minutes) {
		const hour = Math.floor(minutes / 60) % 24;
		return `${hour % 12 || 12}:${twoDigits(minutes % 60)}${hour < 12 ? ' am' : ' pm'}`;
	}

	function midnight(iso) {
		return new Date(`${iso}T00:00:00`);
	}

	/** Whole days from the given date up to today; negative when it lies ahead. */
	function ageInDays(iso) {
		return Math.round((todayDate - midnight(iso)) / DAY_MS);
	}

	function relativeDay(days) {
		if (days === 0) return 'today';
		if (days === 1) return 'yesterday';
		return `${days} days ago`;
	}

	function shiftDays(iso, days) {
		const date = midnight(iso);
		date.setDate(date.getDate() + days);
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
	}

	/* Reads the month and day straight from the text, so no time zone can move it. */
	function monthDay(iso) {
		const [month, day] = [iso.slice(5, 7), iso.slice(8, 10)].map(Number);
		return `${MONTH_ABBR[month - 1]} ${day}`;
	}

	function longDate(iso) {
		const date = midnight(iso);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
	}

	/* The year is left off for dates in the current one. */
	function compactDate(iso) {
		const date = midnight(iso);
		const year = date.getFullYear() === todayDate.getFullYear() ? '' : `, ${date.getFullYear()}`;
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}${year}`;
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
