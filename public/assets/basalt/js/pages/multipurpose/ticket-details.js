/**
 * Ticket Details (ticket-details.html). One support ticket, read from the
 * fixture the Tickets queue shares (assets/basalt/js/data/multipurpose/support.js) and chosen by
 * the ?id= in the address; an id nobody knows falls back to #20417, which
 * is also what the markup shows before this script redraws it. From there
 * the page is live: the reply clock ticks, replies and team notes land in
 * the conversation, the Ticket card edits status, priority, assignee and
 * tags together, and each change is written into the history table.
 *
 * Wiring a backend: fetch the ticket, its account and the team where DESK,
 * ticket and account are set below, and post each change where a comment
 * points it out. The screen updates first, before any server hears about
 * it. Shared pieces come from basalt.js: segmented controls, styled selects,
 * the tag box, avatars, copy buttons and toasts.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-td-root]', document);
	if (!pageRoot) return;

	const MINUTE = 60000;
	const CLOCK_TICK = 15000;
	const WARN_WINDOW = 30;
	const SIGNED_IN = 'John Armstrong';
	const FALLBACK_ID = '#20417';
	const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
	const PAUSED_STATUSES = ['pending', 'hold'];
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const NOTE_ROLE = '<i class="bi bi-lock-fill" aria-hidden="true"></i>Team note';

	const STATUS_META = {
		open: { label: 'Open', tone: 'primary' },
		pending: { label: 'Pending', tone: 'warning' },
		hold: { label: 'On hold', tone: '' },
		solved: { label: 'Solved', tone: 'success' },
	};
	const PRIORITY_LABEL = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };
	const CHANNEL_META = {
		email: { icon: 'bi-envelope', label: 'Email', opener: 'Email received' },
		chat: { icon: 'bi-chat-dots', label: 'Chat', opener: 'Chat started' },
		phone: { icon: 'bi-telephone', label: 'Phone', opener: 'Call logged' },
	};
	const CLOCK_TONE = { late: 'late', risk: 'risk', ok: '', answered: 'done', solved: 'done', paused: 'paused' };

	/* The ticket in the address, its account and the person who wrote in.
     The demo clock starts where the queue's does, Friday October 2 2026 at
     10:40am, and runs on from there in real time; a real app reads
     new Date() instead. */
	const DESK = window.Basalt.data.support;
	const requestedId = new URLSearchParams(window.location.search).get('id');
	const ticket =
		DESK.tickets.find((row) => row.id === requestedId) || DESK.tickets.find((row) => row.id === FALLBACK_ID);
	const account = DESK.customers.find((row) => row.id === ticket.customer) || null;
	const person = account ? account.contact : ticket.from;
	const planName = account ? account.plan : 'Basic';
	const REPLY_TARGETS = DESK.sla[planName];
	const DEMO_CLOCK = DESK.now;
	const pageOpenedAt = Date.now();
	const conversation = ticket.messages;
	const channel = CHANNEL_META[ticket.channel];

	/* Facts read once from the conversation: when it opened, the first ask
     and reply, the latest of each, and the message that started an
     escalation, if there was one. */
	const openedAt = minutesBack(conversation[0].ago);
	const earliestAsk = conversation.find((entry) => entry.t === 'customer');
	const earliestReply = conversation.find((entry) => entry.t === 'reply');
	const latestReply = conversation.filter((entry) => entry.t === 'reply').at(-1);
	const latestVisible = conversation.filter((entry) => entry.t === 'customer' || entry.t === 'reply').at(-1);
	const askBeforeReply = latestReply
		? conversation
				.slice(0, conversation.indexOf(latestReply))
				.filter((entry) => entry.t === 'customer')
				.at(-1)
		: null;
	const callLengthPattern = /\((\d+) minutes\)/;
	const callEvent = conversation.find((entry) => entry.t === 'event' && callLengthPattern.test(entry.text));
	const callLength = callEvent ? callEvent.text.match(callLengthPattern) : null;
	const customerWaiting = latestVisible?.t === 'customer';
	const answered = latestVisible?.t === 'reply';

	/* What can change while the page is open. The reply clock counts from
     waitingSince, the customer message with no reply after it. */
	const live = {
		status: ticket.status,
		priority: ticket.priority,
		assignee: teammateName(ticket.assignee),
		tags: [...ticket.tags],
		plan: planName,
		contact: person.name,
		waitingSince: customerWaiting && ticket.status !== 'solved' ? minutesBack(latestVisible.ago) : null,
		answeredAt: answered ? minutesBack(latestReply.ago) : null,
		answeredIn: answered && askBeforeReply ? askBeforeReply.ago - latestReply.ago : 0,
		solvedAt: ticket.status === 'solved' ? minutesBack(ticket.solvedAgo) : null,
	};

	const escalationSource = ticket.escalation
		? conversation.find((entry) => entry.t === 'note') || earliestReply || conversation[0]
		: null;
	const escalatedBy = escalationSource?.by ? teammateName(escalationSource.by) : live.assignee || 'The team';
	const escalationLogged = conversation.some((entry) => entry.t === 'event' && /escalated/i.test(entry.text));

	const cannedHtml = {};
	let ui = null;
	let solvedStepNumber = '';
	let composeMode = 'reply';

	/**
	 * Draws every section from the data, then collects the nodes the live
	 * parts need (some only exist once the sections are drawn), wires the
	 * controls and starts the clock.
	 */
	function start() {
		paintHeader();
		paintTrack();
		fillTrackOnSight(hook('track'));
		paintThread();
		paintTicketCard();
		paintCustomer();
		paintHistory();
		paintRelated();
		paintCannedMenu();

		ui = collectNodes();
		solvedStepNumber = ui.solvedStepMark.textContent.trim();
		buildCanned();

		wireTicketCard();
		wireThreadFilter();
		wireComposer();
		wireHeaderActions();

		updateComposer();
		updateTicketCard();
		summarizeThread();
		setInterval(() => {
			if (!document.hidden) updateClock();
		}, CLOCK_TICK);
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) updateClock();
		});
	}

	/* Small lookups, scoped to the page. */
	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function hook(name) {
		return pick(`[data-td="${name}"]`);
	}

	function collectNodes() {
		/* Keys here are the script's own; the values are the data-td names in the markup. */
		const slots = {
			ring: 'ring',
			ringLabel: 'ring-num',
			clockHeading: 'clock-title',
			clockBlurb: 'clock-desc',
			nextStep: 'step-next',
			nextStepIcon: 'step-next-icon',
			nextStepName: 'step-next-name',
			nextStepSub: 'step-next-sub',
			solvedStep: 'step-solved',
			solvedStepMark: 'step-solved-mark',
			solvedStepSub: 'step-solved-sub',
			statusPill: 'stp-pill',
			priorityPill: 'prio-pill',
			thread: 'thread',
			threadBlurb: 'thread-desc',
			recipient: 'to',
			editorLabel: 'text-label',
			editorFrame: 'editor',
			editor: 'text',
			emptyWarning: 'error',
			modifierKey: 'mod',
			afterSend: 'after',
			sendIcon: 'send-icon',
			sendLabel: 'send-label',
			facts: 'facts',
			factStatus: 'f-status',
			factPriority: 'f-priority',
			factAssignee: 'f-assignee',
			factTags: 'f-tags',
			statusSelect: 'status',
			prioritySelect: 'priority',
			assigneeSelect: 'assignee',
			tagBox: 'tags',
			history: 'history',
			announcer: 'live',
		};
		const nodes = Object.fromEntries(Object.entries(slots).map(([key, name]) => [key, hook(name)]));
		nodes.clockCard = pick('[data-td-clock]');
		nodes.composer = pick('[data-td-composer]');
		nodes.propsForm = pick('[data-td-props-form]');
		nodes.editButton = pick('[data-td-edit]');
		nodes.replyButton = pick('[data-td-reply]');
		nodes.formatButtons = pickAll('[data-td-cmd]');
		return nodes;
	}

	function htmlSafe(value) {
		return `${value ?? ''}`.replace(/[&<>"']/g, (mark) => ESCAPES[mark]);
	}

	function notify(message) {
		return window.Basalt.toasts?.push(message) ?? null;
	}

	function sayAloud(text) {
		ui.announcer.textContent = text;
	}

	function syncSelect(field) {
		window.Basalt.select?.refresh?.(field);
	}

	function teammateName(id) {
		return DESK.agents.find((agent) => agent.id === id)?.name || '';
	}

	/* Time: the demo clock, and the few ways a moment or a span is written. */
	function currentTime() {
		return new Date(DEMO_CLOCK.getTime() + (Date.now() - pageOpenedAt));
	}

	function minutesBack(count) {
		return new Date(DEMO_CLOCK.getTime() - count * MINUTE);
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function clockText(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())}${hours < 12 ? 'am' : 'pm'}`;
	}

	function stampText(date) {
		return `${WEEKDAY[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}, ${clockText(date)}`;
	}

	function dayText(date) {
		return stampText(date).replace(/,.*$/, '');
	}

	function localIso(date) {
		return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	function wholeMinutes(count) {
		return Math.max(0, Math.round(count));
	}

	/** 25m, 1h 30m: for step captions and the history. */
	function shortSpan(count) {
		const minutesTotal = wholeMinutes(count);
		if (minutesTotal < 60) return `${minutesTotal}m`;
		const rest = minutesTotal % 60;
		return `${Math.floor(minutesTotal / 60)}h${rest ? ` ${rest}m` : ''}`;
	}

	/** 25m, 1.3h, 12h: short enough to sit inside the ring. */
	function ringLabel(count) {
		const minutesTotal = wholeMinutes(count);
		if (minutesTotal < 60) return `${minutesTotal}m`;
		const hours = minutesTotal / 60;
		return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)}h`;
	}

	/** 25 minutes, 1.5 hours: for sentences. */
	function spokenSpan(count) {
		const minutesTotal = wholeMinutes(count);
		if (minutesTotal < 60) return `${minutesTotal} ${minutesTotal === 1 ? 'minute' : 'minutes'}`;
		const hours = minutesTotal / 60;
		return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? 'hour' : 'hours'}`;
	}

	/* Markup fragments the sections share. */
	function toParagraphs(text) {
		return `${text}`
			.split(/\n{2,}/)
			.map((para) => `<p>${htmlSafe(para).replace(/\n/g, '<br>')}</p>`)
			.join('');
	}

	function timeElement(date, className) {
		const classAttr = className ? ` class="${className}"` : '';
		return `<time${classAttr} datetime="${localIso(date)}">${htmlSafe(stampText(date))}</time>`;
	}

	function avatarMarkup(name, sizeClass) {
		return `<span class="basalt-avatar ${sizeClass}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function statusClasses(status) {
		const { tone } = STATUS_META[status];
		return `basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}`;
	}

	function statusMarkup(status) {
		return `<span class="${statusClasses(status)}">${STATUS_META[status].label}</span>`;
	}

	function priorityBadge(priority) {
		return `<span class="td-prio td-prio-${priority}">${PRIORITY_LABEL[priority]}</span>`;
	}

	function factRow(term, detail = '', ddAttrs = '') {
		return `<div><dt>${term}</dt><dd${ddAttrs}>${detail}</dd></div>`;
	}

	function historyCells({ at, icon, text, by }) {
		return `<td class="td-table-when">${timeElement(at)}</td><td><span class="td-change"><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(text)}</span></td><td class="td-table-by">${htmlSafe(by)}</td>`;
	}

	/* Drawing the page from the data, section by section. */
	function paintHeader() {
		hook('title').textContent = ticket.subject;
		document.title = `${ticket.id} ${ticket.subject} · Basalt`;
		const who = `${htmlSafe(person.name)}${account ? `, ${htmlSafe(account.name)}` : ''}`;
		hook('desc').innerHTML =
			`<span class="td-id">${htmlSafe(ticket.id)}</span> · ${who} · <span class="text-nowrap">opened ${htmlSafe(stampText(openedAt))}</span>`;
		const escalationTag = ticket.escalation
			? `<span class="td-tag td-tag-esc"><i class="bi bi-arrow-up-right-circle" aria-hidden="true"></i>With ${htmlSafe(ticket.escalation.team)} · ${htmlSafe(ticket.escalation.ref)}</span>`
			: '';
		hook('head-tags').innerHTML =
			`<span class="basalt-status basalt-status-dot" data-td="stp-pill"></span><span class="td-prio" data-td="prio-pill"></span><span class="td-tag"><i class="bi ${channel.icon}" aria-hidden="true"></i>${channel.label}</span>${escalationTag}`;
	}

	function doneStep(icon, name, caption, extraClass = '') {
		return `<li class="td-step td-step-done${extraClass}"><span class="td-step-mark" aria-hidden="true"><i class="bi ${icon}"></i></span><span class="td-step-name">${name}</span><span class="td-step-sub">${caption}</span></li>`;
	}

	function paintTrack() {
		const trail = [
			doneStep(
				channel.icon,
				channel.opener,
				`${clockText(openedAt)}${callLength ? ` · ${callLength[1]} minutes` : ''}`,
			),
		];
		/* The first reply is a step of its own unless it is also the latest,
       which the "next reply" step already covers. */
		if (earliestReply && earliestAsk && !(live.answeredAt && earliestReply === latestReply)) {
			const took = earliestAsk.ago - earliestReply.ago;
			const allowed = REPLY_TARGETS[ticket.priority];
			const verdict =
				took <= allowed ? `inside ${shortSpan(allowed).replace(/m$/, ' min')}` : `after ${spokenSpan(took)}`;
			trail.push(
				doneStep('bi-check-lg', 'First reply', `${clockText(minutesBack(earliestReply.ago))} · ${verdict}`),
			);
		}
		if (ticket.escalation) {
			trail.push(
				doneStep(
					'bi-arrow-up-right',
					'Escalated',
					`${clockText(minutesBack(escalationSource.ago))} · ${htmlSafe(ticket.escalation.ref)}`,
					' td-step-esc',
				),
			);
		}
		trail.push(
			'<li class="td-step td-step-now" data-td="step-next"><span class="td-step-mark" aria-hidden="true"><i class="bi bi-hourglass-split" data-td="step-next-icon"></i></span><span class="td-step-name" data-td="step-next-name">Next reply</span><span class="td-step-sub" data-td="step-next-sub"></span></li>',
		);
		trail.push(
			`<li class="td-step" data-td="step-solved"><span class="td-step-mark" aria-hidden="true"><span data-td="step-solved-mark">${trail.length + 1}</span></span><span class="td-step-name">Solved</span><span class="td-step-sub" data-td="step-solved-sub">Not yet</span></li>`,
		);
		hook('track').innerHTML = trail.join('');
	}

	/**
	 * Fills the track in from the start the first time it is on screen:
	 * the classes only switch the step-by-step animation in the stylesheet
	 * on, then step aside so later redraws show it as it is.
	 */
	function fillTrackOnSight(track) {
		if (!window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		track.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				track.classList.replace('is-waiting', 'is-drawing');
				setTimeout(() => track.classList.remove('is-drawing'), 1200);
			},
			{ threshold: 0.5 },
		);
		watch.observe(track);
	}

	function roleOf(entry) {
		if (entry.t === 'note') return NOTE_ROLE;
		if (entry.t !== 'customer') return 'Reply';
		return ticket.channel === 'phone' && /^Call notes/.test(entry.text) ? 'Phone call' : 'Customer';
	}

	function messageItem(entry) {
		const at = minutesBack(entry.ago);
		if (entry.t === 'event') {
			return `<li class="td-event" data-kind="event"><i class="bi ${entry.icon || 'bi-dot'}" aria-hidden="true"></i><span>${htmlSafe(entry.text)}</span>${timeElement(at)}</li>`;
		}
		const isNote = entry.t === 'note';
		const fromCustomer = entry.t === 'customer';
		const author = fromCustomer ? person.name : teammateName(entry.by);
		const flavor = fromCustomer ? 'customer' : isNote ? 'note' : 'reply';
		const fileChips = (entry.files || [])
			.map(
				(name) =>
					`<span class="td-file"><i class="bi bi-paperclip" aria-hidden="true"></i>${htmlSafe(name)}</span>`,
			)
			.join('');
		const textHtml = `${toParagraphs(entry.text)}${fileChips ? `<p class="td-files">${fileChips}</p>` : ''}`;
		return `<li class="td-msg td-msg-${flavor}" data-kind="${isNote ? 'note' : 'public'}">${avatarMarkup(author, 'basalt-avatar-sm')}<div class="td-msg-body"><div class="td-msg-head"><span class="td-msg-who">${htmlSafe(author)}</span><span class="td-msg-role">${roleOf(entry)}</span>${timeElement(at, 'td-msg-time')}</div><div class="td-msg-text">${textHtml}</div></div></li>`;
	}

	function escalationEvent(entry) {
		return `<li class="td-event" data-kind="event"><i class="bi bi-arrow-up-right-circle" aria-hidden="true"></i><span>${htmlSafe(escalatedBy)} escalated to ${htmlSafe(ticket.escalation.team)}, <span class="text-nowrap">${htmlSafe(ticket.escalation.ref)}</span></span>${timeElement(minutesBack(entry.ago))}</li>`;
	}

	/* The escalation gets its own event line after the message that raised
     it, unless the data already carries one. */
	function paintThread() {
		hook('thread').innerHTML = conversation
			.flatMap((entry) =>
				entry === escalationSource && !escalationLogged
					? [messageItem(entry), escalationEvent(entry)]
					: [messageItem(entry)],
			)
			.join('');
	}

	function paintTicketCard() {
		const route = ticket.escalation ? DESK.teams.find((team) => team.name === ticket.escalation.team) : null;
		const routeNote = !route
			? ''
			: route.who !== 'csm'
				? route.who
				: account?.csm
					? `${account.csm}, their account manager`
					: 'Their account manager';
		const arrival = {
			phone: callLength
				? `A ${callLength[1]}-minute call with ${(live.assignee || 'the team').split(' ')[0]}`
				: 'A phone call',
			email: `From ${person.email || person.name}`,
			chat: 'Live chat in the app',
		}[ticket.channel];
		const escalationRow = ticket.escalation
			? factRow(
					'Escalated to',
					`<span class="td-fact-main">${htmlSafe(ticket.escalation.team)} · ${htmlSafe(ticket.escalation.ref)}</span>${routeNote ? `<span class="td-fact-note">${htmlSafe(routeNote)}</span>` : ''}`,
				)
			: '';
		hook('facts').innerHTML = [
			factRow('Status', '', ' data-td="f-status"'),
			factRow('Priority', '', ' data-td="f-priority"'),
			factRow('Assignee', '', ' data-td="f-assignee"'),
			escalationRow,
			factRow(
				'Came in by',
				`<span class="td-fact-main">${channel.label}</span><span class="td-fact-note">${htmlSafe(arrival)}</span>`,
			),
			factRow('Tags', '', ' class="td-chips" data-td="f-tags"'),
		].join('');

		hook('status').value = ticket.status;
		hook('priority').value = ticket.priority;
		hook('assignee').value = live.assignee;
		const tagField = hook('tags');
		for (const tagPill of pickAll('.basalt-tags-tag', tagField)) tagPill.remove();
		const typing = pick('.basalt-tags-input', tagField);
		for (const tagName of ticket.tags) {
			const tagPill = document.createElement('span');
			tagPill.className = 'basalt-tags-tag';
			tagPill.dataset.value = tagName;
			tagPill.textContent = tagName;
			typing.before(tagPill);
		}
	}

	function paintCustomer() {
		const viewLink = hook('customer-link');
		const customerPanel = hook('customer');
		if (!account) {
			viewLink.hidden = true;
			customerPanel.innerHTML = `<div class="td-co">${avatarMarkup(person.name, 'basalt-avatar-lg basalt-avatar-rounded')}<div><p class="td-co-name">${htmlSafe(person.name)}</p><p class="td-co-sub">Not a Fieldline customer</p></div></div><p class="td-line"><i class="bi bi-envelope" aria-hidden="true"></i><span class="td-line-text">${htmlSafe(person.email)}</span></p><p class="td-fact-note">No account matches this address. If it is junk, delete it as spam in Tickets and the sender is blocked.</p>`;
			return;
		}
		const accountUrl = `company-details.html?id=${encodeURIComponent(account.id)}`;
		viewLink.href = accountUrl;
		const healthWord = account.health >= 75 ? 'Healthy' : account.health >= 55 ? 'Keep an eye on' : 'At risk';
		const contact = account.contact;
		const identity = `<div class="td-co">${avatarMarkup(account.name, 'basalt-avatar-lg basalt-avatar-rounded')}<div><p class="td-co-name"><a href="${accountUrl}">${htmlSafe(account.name)}</a></p><p class="td-co-sub">${htmlSafe(account.city)} · since ${htmlSafe(account.since)}</p></div></div>`;
		const accountFacts = `<dl class="td-facts td-facts-account">${[
			factRow(
				'Plan',
				`<span class="td-plan">${htmlSafe(account.plan)}</span><span class="td-fact-main">${account.seats} seats</span>`,
			),
			factRow(
				'MRR',
				`<span class="td-fact-main td-fact-strong">$${Math.round(account.mrr).toLocaleString('en-US')}</span><span class="td-fact-note">${account.billing === 'annual' ? 'Billed yearly' : 'Billed monthly'}</span>`,
			),
			factRow(
				'Health',
				`<span class="td-health"><span class="td-health-score">${account.health}</span>${healthWord}</span><span class="td-health-bar" role="img" aria-label="Health score ${account.health} out of 100"><span class="share-${Math.round(account.health)}"></span></span><span class="td-fact-note">${htmlSafe(account.healthNote)}</span>`,
			),
			factRow('Account manager', `<span class="td-fact-main">${htmlSafe(account.csm || 'Self-serve')}</span>`),
		].join('')}</dl>`;
		const contactBlock = `<section class="td-sub-block" aria-labelledby="td-contact-title"><h3 class="td-sub" id="td-contact-title">Contact</h3><div class="td-person td-person-lg">${avatarMarkup(contact.name, 'basalt-avatar-sm')}<div><p class="td-person-name">${htmlSafe(contact.name)}</p><p class="td-person-sub">${htmlSafe(contact.role)}</p></div></div><p class="td-line"><i class="bi bi-envelope" aria-hidden="true"></i><span class="td-line-text">${htmlSafe(contact.email)}</span><button type="button" class="btn btn-icon btn-sm" data-basalt-copy="${htmlSafe(contact.email)}" data-basalt-copy-done="Copied" aria-label="Copy email address" data-bs-toggle="tooltip" data-bs-title="Copy email"><i class="bi bi-copy" aria-hidden="true"></i></button></p><p class="td-line"><i class="bi bi-telephone" aria-hidden="true"></i><span class="td-line-text">${htmlSafe(contact.phone)}</span></p></section>`;
		customerPanel.innerHTML = identity + accountFacts + contactBlock;
	}

	/** Every change so far, newest first, reconstructed from the conversation. */
	function paintHistory() {
		const ledger = [];
		const owner = live.assignee || 'Triage rule';
		const openingLine = { phone: 'Created from a phone call', email: 'Created from an email' };
		const tagCount = ticket.tags.length;
		const tagNote = !tagCount
			? ''
			: `, ${tagCount === 1 ? 'one tag' : tagCount === 2 ? 'two tags' : `${tagCount} tags`} added`;

		function record(at, icon, text, by) {
			ledger.push({ at, icon, text, by });
		}

		record(
			openedAt,
			channel.icon,
			openingLine[ticket.channel] || 'Created from a chat',
			ticket.channel === 'phone' ? owner : person.name,
		);
		record(
			new Date(openedAt.getTime() + MINUTE),
			'bi-flag',
			`Priority set to ${PRIORITY_LABEL[ticket.priority]}${tagNote}`,
			owner,
		);
		let firstReplySeen = false;
		for (const entry of conversation) {
			const at = minutesBack(entry.ago);
			if (entry.t === 'reply' && !firstReplySeen && earliestAsk) {
				firstReplySeen = true;
				record(
					at,
					'bi-reply',
					`First reply, after ${spokenSpan(earliestAsk.ago - entry.ago)}`,
					teammateName(entry.by),
				);
			} else if (entry.t === 'reply') {
				record(at, 'bi-reply', `Replied to ${person.name}`, teammateName(entry.by));
			} else if (entry.t === 'note') {
				record(at, 'bi-lock', 'Added a team note', teammateName(entry.by));
			}
			if (entry === escalationSource)
				record(
					at,
					'bi-arrow-up-right-circle',
					`Escalated to ${ticket.escalation.team}, ${ticket.escalation.ref}`,
					escalatedBy,
				);
		}
		if (PAUSED_STATUSES.includes(ticket.status)) {
			const latestAuthored = conversation.filter((entry) => entry.by).at(-1) || conversation[0];
			record(
				minutesBack(latestAuthored.ago),
				'bi-circle-half',
				`Status set to ${STATUS_META[ticket.status].label}`,
				teammateName(latestAuthored.by) || owner,
			);
		}
		if (ticket.status === 'solved') record(minutesBack(ticket.solvedAgo), 'bi-check2-circle', 'Solved', owner);

		ledger.sort((a, b) => b.at - a.at);
		hook('history').innerHTML = ledger.map((entry) => `<tr>${historyCells(entry)}</tr>`).join('');
	}

	function relatedItem({ at, row, past }) {
		if (past) {
			return `<li><span class="td-related-subject">${htmlSafe(past[2])}</span><p class="td-related-meta">${htmlSafe(past[1])} · solved ${htmlSafe(dayText(at))}</p><p class="td-related-badges">${statusMarkup('solved')}</p></li>`;
		}
		const solved = row.status === 'solved';
		const slaFlag =
			!solved || row.slaMet == null
				? ''
				: row.slaMet
					? '<span class="td-flag"><i class="bi bi-check2" aria-hidden="true"></i>SLA met</span>'
					: '<span class="td-flag td-flag-bad"><i class="bi bi-x-circle" aria-hidden="true"></i>SLA missed</span>';
		const liked = row.csat?.score === 'good';
		const verdict = row.csat?.score
			? `<p class="td-rating${liked ? ' td-rating-good' : ''}"><i class="bi bi-hand-thumbs-${liked ? 'up' : 'down'}" aria-hidden="true"></i><span>Rated ${liked ? 'Good' : 'Bad'}${row.csat.comment ? `: “${htmlSafe(row.csat.comment)}”` : ''}</span></p>`
			: '';
		const ownerBit = row.assignee ? ` · ${htmlSafe(teammateName(row.assignee))}` : '';
		return `<li><a class="td-related-subject" href="ticket-details.html?id=${encodeURIComponent(row.id)}">${htmlSafe(row.subject)}</a><p class="td-related-meta">${htmlSafe(row.id)}${ownerBit} · ${solved ? 'solved ' : 'updated '}${htmlSafe(dayText(at))}</p><p class="td-related-badges">${statusMarkup(row.status)}${slaFlag}</p>${verdict}</li>`;
	}

	/** The customer's other tickets: live ones from the queue plus the archive, newest three. */
	function paintRelated() {
		const relatedList = hook('related');
		hook('related-desc').textContent = account
			? `${account.name}’s other tickets, newest first.`
			: 'Tickets from the same sender.';
		if (!account) {
			relatedList.innerHTML = noRelated('Nothing else has come from this address.');
			return;
		}
		const fromQueue = DESK.tickets
			.filter((row) => row.customer === account.id && row.id !== ticket.id)
			.map((row) => ({
				at: minutesBack(row.status === 'solved' ? row.solvedAgo : row.messages.at(-1).ago),
				row,
			}));
		const fromArchive = DESK.history
			.filter((past) => past[0] === account.id)
			.map((past) => ({ at: minutesBack(past[4] * 1440), past }));
		const newestThree = [...fromQueue, ...fromArchive].sort((a, b) => b.at - a.at).slice(0, 3);
		relatedList.innerHTML = newestThree.length
			? newestThree.map(relatedItem).join('')
			: noRelated(`This is the first ticket from ${account.name}.`);
	}

	function noRelated(text) {
		return `<li>${window.Basalt.emptyState({ icon: 'ticket-perforated', title: 'No other tickets', text })}</li>`;
	}

	/* Saved replies are the queue's macros with this ticket's names filled in. */
	function cannedReplies() {
		return DESK.macros.filter((macro) => !macro.note);
	}

	function personalize(text) {
		const fills = {
			first: person.name.split(' ')[0],
			me: SIGNED_IN,
			plan: planName,
			seat: `$${DESK.prices[planName]}`,
			customer: account ? account.name : person.name,
		};
		return text.replace(/\{(first|me|plan|seat|customer)\}/g, (whole, key) => fills[key]);
	}

	function buildCanned() {
		for (const macro of cannedReplies()) cannedHtml[macro.id] = toParagraphs(personalize(macro.body));
	}

	function paintCannedMenu() {
		hook('saved-menu').innerHTML = cannedReplies()
			.map(
				(macro) =>
					`<li><button type="button" class="dropdown-item" data-td-saved="${macro.id}"><span class="td-saved-name">${htmlSafe(macro.title)}</span><span class="td-saved-sub">${htmlSafe(macro.sub)}</span></button></li>`,
			)
			.join('');
	}

	/* The reply clock. Pending and On hold pause it; Solved stops it. */
	function readClock() {
		if (live.status === 'solved') return { kind: 'solved' };
		if (PAUSED_STATUSES.includes(live.status)) return { kind: 'paused' };
		if (!live.waitingSince) return { kind: 'answered' };
		const allowed = REPLY_TARGETS[live.priority];
		const due = new Date(live.waitingSince.getTime() + allowed * MINUTE);
		const left = (due - currentTime()) / MINUTE;
		const urgency = left < 0 ? 'late' : left <= WARN_WINDOW ? 'risk' : 'ok';
		return { kind: urgency, target: allowed, due, left };
	}

	function fillRing(percent, label) {
		const clamped = Math.max(0, Math.min(100, percent));
		ui.ring.style.setProperty('--td-off', String(100 - clamped));
		ui.ringLabel.innerHTML = label;
	}

	function setNextStep(name, caption, icon, done) {
		ui.nextStepName.textContent = name;
		ui.nextStepSub.textContent = caption;
		ui.nextStepIcon.className = `bi ${icon}`;
		ui.nextStep.className = `td-step td-step-now${done ? ' td-step-done' : ''}`;
	}

	function showCountdown(reading, firstName) {
		const late = reading.kind === 'late';
		const priorityWord = PRIORITY_LABEL[live.priority].toLowerCase();
		fillRing(
			late ? 100 : (1 - reading.left / reading.target) * 100,
			htmlSafe(ringLabel(late ? -reading.left : reading.left)),
		);
		ui.clockHeading.textContent = late
			? `Next reply is ${spokenSpan(-reading.left)} late`
			: `Next reply due in ${spokenSpan(Math.max(1, reading.left))}`;
		ui.clockBlurb.textContent = `${firstName} wrote at ${clockText(live.waitingSince)}. ${live.plan}, ${priorityWord}: we reply within ${spokenSpan(reading.target)}, so by ${clockText(reading.due)}.`;
		setNextStep(
			'Next reply',
			late ? `${shortSpan(-reading.left)} late` : `Due ${clockText(reading.due)}`,
			late ? 'bi-alarm' : 'bi-hourglass-split',
			false,
		);
	}

	function showPaused(reading, firstName) {
		const waitingOnCustomer = live.status === 'pending';
		const replied = Boolean(live.answeredAt);
		fillRing(0, '<i class="bi bi-pause-fill" aria-hidden="true"></i>');
		ui.clockHeading.textContent = waitingOnCustomer
			? `Clock paused: waiting on ${firstName}`
			: 'Clock paused: on hold';
		ui.clockBlurb.textContent = `${waitingOnCustomer ? 'Pending' : 'On hold'} pauses the reply clock. It starts again when the ticket is set back to Open.`;
		setNextStep(
			replied ? 'Replied' : 'Next reply',
			replied ? clockText(live.answeredAt) : 'Paused',
			replied ? 'bi-check-lg' : 'bi-pause-fill',
			replied,
		);
	}

	function showStopped(reading, firstName) {
		fillRing(100, '<i class="bi bi-check-lg" aria-hidden="true"></i>');
		if (reading.kind === 'solved') {
			ui.clockHeading.textContent = `Solved at ${clockText(live.solvedAt)}`;
			ui.clockBlurb.textContent = `The clock has stopped. A reply from ${firstName} opens the ticket again, with everything kept.`;
		} else {
			const allowed = REPLY_TARGETS[live.priority];
			ui.clockHeading.textContent = `Replied at ${clockText(live.answeredAt)}`;
			ui.clockBlurb.textContent = `${live.answeredIn <= allowed ? 'Inside' : 'Outside'} the ${spokenSpan(allowed)} target. The clock starts again when ${firstName} writes back.`;
		}
		const caption = live.answeredAt
			? `${clockText(live.answeredAt)} · after ${shortSpan(live.answeredIn)}`
			: 'Not needed';
		setNextStep(live.answeredAt ? 'Replied' : 'Next reply', caption, 'bi-check-lg', true);
	}

	function updateClock() {
		const reading = readClock();
		const tone = CLOCK_TONE[reading.kind];
		const painter = {
			late: showCountdown,
			risk: showCountdown,
			ok: showCountdown,
			paused: showPaused,
			solved: showStopped,
			answered: showStopped,
		}[reading.kind];
		ui.clockCard.className = `card basalt-box td-card td-clock${tone ? ` td-clock-${tone}` : ''}`;
		painter(reading, live.contact.split(' ')[0]);

		const solved = live.status === 'solved';
		ui.solvedStep.className = `td-step${solved ? ' td-step-done' : ''}`;
		ui.solvedStepMark.innerHTML = solved ? '<i class="bi bi-check-lg"></i>' : solvedStepNumber;
		ui.solvedStepSub.textContent = solved ? clockText(live.solvedAt) : 'Not yet';
	}

	/* Status, priority, assignee and tags: the header pills, the Ticket
     card and the clock all read from `live`, so one update paints all. */
	function updateTicketCard() {
		ui.statusPill.className = statusClasses(live.status);
		ui.statusPill.textContent = STATUS_META[live.status].label;
		ui.priorityPill.className = `td-prio td-prio-${live.priority}`;
		ui.priorityPill.textContent = PRIORITY_LABEL[live.priority];
		ui.factStatus.innerHTML = statusMarkup(live.status);
		ui.factPriority.innerHTML = priorityBadge(live.priority);
		ui.factAssignee.innerHTML = live.assignee
			? `<span class="td-person">${avatarMarkup(live.assignee, 'basalt-avatar-xs')}${htmlSafe(live.assignee)}${live.assignee === SIGNED_IN ? ' (you)' : ''}</span>`
			: '<span class="td-fact-main">Unassigned</span>';
		ui.factTags.innerHTML = live.tags.length
			? live.tags.map((tagName) => `<span class="td-chip">${htmlSafe(tagName)}</span>`).join('')
			: '<span class="td-chips-none">No tags</span>';
		window.Basalt.avatars?.(ui.factAssignee);
		updateClock();
	}

	function logChange(icon, text, by) {
		const row = document.createElement('tr');
		row.className = 'is-fresh';
		row.innerHTML = historyCells({ at: currentTime(), icon, text, by: by || SIGNED_IN });
		ui.history.prepend(row);
	}

	/**
	 * The one way the ticket changes, so the clock, header, card and history
	 * never disagree. Returns how many fields actually moved.
	 */
	function applyEdit(next, options = {}) {
		const changes = [];
		if (next.status && next.status !== live.status) {
			live.status = next.status;
			live.solvedAt = live.status === 'solved' ? currentTime() : null;
			changes.push(['bi-circle-half', `Status set to ${STATUS_META[live.status].label}`]);
		}
		if (next.priority && next.priority !== live.priority) {
			live.priority = next.priority;
			changes.push(['bi-flag', `Priority set to ${PRIORITY_LABEL[live.priority]}`]);
		}
		if ('assignee' in next && next.assignee !== live.assignee) {
			live.assignee = next.assignee;
			changes.push(['bi-person-check', live.assignee ? `Assigned to ${live.assignee}` : 'Unassigned']);
		}
		if (next.tags && next.tags.join(',') !== live.tags.join(',')) {
			live.tags = [...next.tags];
			changes.push(['bi-tags', live.tags.length ? `Tags set to ${live.tags.join(', ')}` : 'Tags removed']);
		}

		/* In your app: send the changed fields to the server here. */
		for (const [icon, text] of changes) logChange(icon, text);
		updateTicketCard();
		if (changes.length && !options.quiet) {
			const summary = `${changes.map(([, text]) => text).join('. ')}.`;
			notify({ tone: 'success', title: 'Ticket updated', text: summary });
			sayAloud(summary);
		}
		return changes.length;
	}

	/* Editing the Ticket card: the facts swap for a form, saved in one go. */
	function loadForm() {
		ui.statusSelect.value = live.status;
		ui.prioritySelect.value = live.priority;
		ui.assigneeSelect.value = live.assignee;
		for (const dropdown of [ui.statusSelect, ui.prioritySelect, ui.assigneeSelect]) syncSelect(dropdown);
		ui.tagBox.basaltTags?.set(live.tags);
	}

	function toggleEditor(open) {
		ui.propsForm.hidden = !open;
		ui.facts.hidden = open;
		ui.editButton.hidden = open;
		ui.editButton.setAttribute('aria-expanded', String(open));
		if (!open) {
			ui.editButton.focus({ preventScroll: true });
			return;
		}
		loadForm();
		const trigger = ui.statusSelect.nextElementSibling;
		(trigger?.matches('.basalt-select-trigger') ? trigger : ui.statusSelect).focus();
	}

	function wireTicketCard() {
		ui.editButton.addEventListener('click', () => toggleEditor(true));
		pick('[data-td-cancel]').addEventListener('click', () => toggleEditor(false));
		ui.propsForm.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && !event.target.closest('.basalt-select-trigger[aria-expanded="true"]'))
				toggleEditor(false);
		});
		ui.propsForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const changedCount = applyEdit({
				status: ui.statusSelect.value,
				priority: ui.prioritySelect.value,
				assignee: ui.assigneeSelect.value,
				tags: ui.tagBox.basaltTags?.get() ?? live.tags,
			});
			toggleEditor(false);
			if (!changedCount) notify({ tone: 'primary', title: 'Nothing changed', text: 'The ticket is as it was.' });
		});
	}

	/* The conversation: the filter above it, and the line under its title. */
	function chosenFilter() {
		return pick('[data-td-show]:checked')?.value || 'all';
	}

	function wireThreadFilter() {
		for (const radio of pickAll('[data-td-show]')) {
			radio.addEventListener('change', () => {
				const wanted = radio.value;
				for (const line of pickAll('li', ui.thread))
					line.toggleAttribute('hidden', wanted !== 'all' && line.dataset.kind !== wanted);
				const visibleCount = pickAll('li:not([hidden])', ui.thread).length;
				const noun =
					wanted === 'note'
						? ` team ${visibleCount === 1 ? 'note' : 'notes'}`
						: ' messages with the customer';
				sayAloud(wanted === 'all' ? 'Showing the whole conversation.' : `Showing ${visibleCount}${noun}.`);
			});
		}
	}

	function summarizeThread() {
		const noteCount = pickAll('li[data-kind="note"]', ui.thread).length;
		ui.threadBlurb.textContent = `Oldest first, with ${COUNT_WORDS[noteCount] || noteCount} team ${noteCount === 1 ? 'note' : 'notes'}.`;
	}

	function ownMessageMarkup(isNote, bodyHtml, at) {
		return `${avatarMarkup(SIGNED_IN, 'basalt-avatar-sm')}<div class="td-msg-body"><div class="td-msg-head"><span class="td-msg-who">${htmlSafe(SIGNED_IN)}</span><span class="td-msg-role">${isNote ? NOTE_ROLE : 'Reply'}</span>${timeElement(at, 'td-msg-time')}</div><div class="td-msg-text">${bodyHtml}</div></div>`;
	}

	/* The reply box: mode, formatting, saved replies and sending. */
	function editorBlank() {
		return !ui.editor.textContent.trim();
	}

	function flagEmpty(on) {
		ui.editorFrame.classList.toggle('is-invalid', on);
		ui.emptyWarning.hidden = !on;
		ui.editor.setAttribute('aria-invalid', String(on));
	}

	function switchToReply() {
		if (composeMode === 'reply') return;
		pick('#td-mode-reply').checked = true;
		composeMode = 'reply';
		updateComposer();
	}

	function updateComposer() {
		const isNote = composeMode === 'note';
		ui.composer.classList.toggle('is-note', isNote);
		ui.editor.dataset.placeholder = isNote ? 'Write a note for the team…' : 'Write a reply…';
		ui.editorLabel.textContent = isNote ? 'Team note, only the team sees it' : `Reply to ${live.contact}`;
		ui.recipient.innerHTML = isNote
			? '<i class="bi bi-lock" aria-hidden="true"></i>Only the team sees notes'
			: `<i class="bi bi-envelope" aria-hidden="true"></i>To ${htmlSafe(live.contact)} by email`;
		ui.sendLabel.textContent = isNote ? 'Add note' : 'Send reply';
		ui.sendIcon.className = `bi ${isNote ? 'bi-lock' : 'bi-send'} me-1`;
		ui.afterSend.hidden = isNote;
		syncSelect(ui.afterSend);
	}

	function jumpToComposer() {
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		ui.composer.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
		ui.editor.focus({ preventScroll: true });
	}

	function reflectFormatting() {
		const textSelection = document.getSelection();
		for (const button of ui.formatButtons) {
			let pressed;
			try {
				pressed =
					ui.editor.contains(textSelection.anchorNode) && document.queryCommandState(button.dataset.tdCmd);
			} catch {
				pressed = false;
			}
			button.setAttribute('aria-pressed', String(pressed));
		}
	}

	function wireFormatting() {
		for (const button of ui.formatButtons) {
			button.addEventListener('mousedown', (event) => event.preventDefault());
			button.addEventListener('click', () => {
				if (!ui.editor.contains(document.activeElement) && document.activeElement !== ui.editor)
					ui.editor.focus();
				try {
					document.execCommand(button.dataset.tdCmd, false, null);
				} catch {
					/* Nothing to do; the command is not there. */
				}
				reflectFormatting();
			});
		}
		document.addEventListener('selectionchange', () => {
			if (document.activeElement === ui.editor) reflectFormatting();
		});
	}

	function insertCanned(id) {
		switchToReply();
		ui.editor.innerHTML = cannedHtml[id];
		flagEmpty(false);
		ui.editor.focus();
		const endPoint = document.createRange();
		endPoint.selectNodeContents(ui.editor);
		endPoint.collapse(false);
		const textSelection = document.getSelection();
		textSelection.removeAllRanges();
		textSelection.addRange(endPoint);
	}

	function recordNote() {
		logChange('bi-lock', 'Added a team note');
		notify({ tone: 'success', title: 'Note added', text: 'Only the team can see it.' });
		sayAloud('Team note added.');
	}

	function recordReply(at) {
		if (live.waitingSince) {
			live.answeredIn = (at - live.waitingSince) / MINUTE;
			live.answeredAt = at;
			live.waitingSince = null;
		}
		logChange('bi-reply', `Replied to ${live.contact} by email`);
		const thenSet = ui.afterSend.value;
		if (thenSet === 'keep') updateClock();
		else applyEdit({ status: thenSet }, { quiet: true });
		const outcome = thenSet === 'keep' ? '.' : `, and the ticket is now ${STATUS_META[thenSet].label}.`;
		notify({ tone: 'success', title: 'Reply sent', text: `Emailed to ${live.contact}${outcome}` });
		sayAloud(`Reply sent to ${live.contact}.`);
		ui.afterSend.value = 'keep';
		syncSelect(ui.afterSend);
	}

	function submitMessage(event) {
		event.preventDefault();
		if (editorBlank()) {
			flagEmpty(true);
			ui.editor.focus();
			return;
		}
		const at = currentTime();
		const isNote = composeMode === 'note';
		const freshItem = document.createElement('li');
		freshItem.className = `td-msg td-msg-${isNote ? 'note' : 'reply'} is-fresh`;
		freshItem.dataset.kind = isNote ? 'note' : 'public';
		freshItem.innerHTML = ownMessageMarkup(isNote, ui.editor.innerHTML, at);
		const wanted = chosenFilter();
		freshItem.hidden = wanted !== 'all' && freshItem.dataset.kind !== wanted;
		ui.thread.append(freshItem);
		window.Basalt.avatars?.(freshItem);
		/* In your app: post the reply or note to the server here. */

		if (isNote) recordNote();
		else recordReply(at);
		ui.editor.innerHTML = '';
		summarizeThread();
		reflectFormatting();
	}

	function wireComposer() {
		if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) ui.modifierKey.textContent = '⌘';
		try {
			document.execCommand('defaultParagraphSeparator', false, 'p');
		} catch {
			/* Older engines do not know this command. */
		}
		for (const radio of pickAll('[data-td-mode]')) {
			radio.addEventListener('change', () => {
				composeMode = radio.value;
				updateComposer();
			});
		}
		wireFormatting();
		ui.editor.addEventListener('input', () => {
			/* An emptied editor keeps a stray <br>; drop it so the placeholder shows. */
			if (editorBlank() && !pick('li', ui.editor)) ui.editor.innerHTML = '';
			if (!editorBlank()) flagEmpty(false);
		});
		/* Pasted text comes in plain, so no outside styling rides along. */
		ui.editor.addEventListener('paste', (event) => {
			event.preventDefault();
			document.execCommand(
				'insertText',
				false,
				(event.clipboardData || window.clipboardData).getData('text/plain'),
			);
		});
		ui.editor.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				ui.composer.requestSubmit();
			}
			if (event.key === 'Escape') ui.editor.blur();
		});
		for (const button of pickAll('[data-td-saved]')) {
			button.addEventListener('click', () => insertCanned(button.dataset.tdSaved));
		}
		ui.composer.addEventListener('submit', submitMessage);
	}

	/* The header: Reply, the overflow menu, and the R shortcut. */
	function wireHeaderActions() {
		ui.replyButton.addEventListener('click', () => {
			switchToReply();
			jumpToComposer();
		});

		const menuActions = {
			mine() {
				if (live.assignee === SIGNED_IN)
					notify({ tone: 'primary', title: 'Already yours', text: 'This ticket is assigned to you.' });
				else applyEdit({ assignee: SIGNED_IN });
			},
			solve() {
				if (live.status === 'solved')
					notify({
						tone: 'primary',
						title: 'Already solved',
						text: 'Set it back to Open from the Ticket card.',
					});
				else applyEdit({ status: 'solved' });
			},
			copy() {
				if (!window.Basalt.copyText) return;
				window.Basalt.copyText(location.href.split('#')[0]).then(
					() =>
						notify({
							tone: 'success',
							title: 'Link copied',
							text: `Anyone on the team can open ${ticket.id} with it.`,
						}),
					() =>
						notify({
							tone: 'danger',
							title: 'Could not copy',
							text: 'Your browser blocked the clipboard.',
						}),
				);
			},
		};
		for (const button of pickAll('[data-td-act]')) {
			button.addEventListener('click', () => menuActions[button.dataset.tdAct]?.());
		}

		/* R jumps to the reply box from anywhere on the page that is not a field. */
		document.addEventListener('keydown', (event) => {
			if (event.key !== 'r' || event.ctrlKey || event.metaKey || event.altKey) return;
			if (
				event.target.closest(
					'input, textarea, select, [contenteditable="true"], .dropdown-menu, .basalt-select-popup',
				)
			)
				return;
			event.preventDefault();
			ui.replyButton.click();
		});
	}

	start();
})();
