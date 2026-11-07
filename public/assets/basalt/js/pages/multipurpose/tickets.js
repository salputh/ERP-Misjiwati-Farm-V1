/**
 * The Fieldline helpdesk on tickets.html, the only page that loads
 * it: a queue where every ticket counts down to its promised reply time, the
 * open conversation with replies, notes, saved answers, owner, escalation and
 * status, and the customer's account alongside.
 *
 * To go live, make api.load() return what assets/basalt/js/data/multipurpose/support.js holds and
 * point the other api methods at your endpoints. The screen changes before a
 * call answers and reverts with a toast if it fails. Try ?state=empty,
 * ?state=error or ?state=offline to see those cases.
 */
(() => {
	'use strict';

	const host = pick('[data-hd-root]');
	if (!host) return;

	/* Queue, staff and accounts; Ticket Details reads the same file. */
	const fixture = window.Basalt.data.support;

	const MINUTE = 60000;
	const PAGE_SIZE = 10;
	const AT_RISK_MINUTES = 30;
	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	const CHANNEL_INFO = {
		email: { label: 'Email', icon: 'bi-envelope' },
		chat: { label: 'Chat', icon: 'bi-chat-dots' },
		phone: { label: 'Phone', icon: 'bi-telephone' },
	};
	const PRIORITY_LABEL = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };
	const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };
	const STATUS_INFO = {
		open: { tone: 'primary', label: 'Open' },
		pending: { tone: 'warning', label: 'Pending' },
		hold: { tone: '', label: 'On hold' },
		solved: { tone: 'success', label: 'Solved' },
	};
	const PAUSE_REASONS = { pending: 'Waiting on the customer', hold: 'On hold' };

	const QUEUE_VIEWS = {
		unassigned: { label: 'Unassigned', test: (ticket) => ticket.status !== 'solved' && !ticket.assignee },
		mine: { label: 'Mine', test: (ticket) => ticket.status !== 'solved' && ticket.assignee === fixture.me },
		open: { label: 'All open', test: (ticket) => ticket.status !== 'solved' },
		breaching: { label: 'Breaching SLA', test: (ticket) => ['late', 'risk'].includes(slaFor(ticket).state) },
		solved: { label: 'Solved', test: (ticket) => ticket.status === 'solved' },
	};

	/* Each clock state as a chip: tone, icon and wording. */
	const CHIP_LOOK = {
		late: ['late', 'bi-alarm', (sla) => `${timeSpan(-sla.left)} late`],
		risk: ['risk', 'bi-hourglass-split', (sla) => `${timeSpan(sla.left)} left`],
		ok: ['ok', 'bi-clock', (sla) => timeSpan(sla.left)],
		paused: ['paused', 'bi-pause-circle', () => 'Paused'],
		answered: ['ok', 'bi-reply', () => 'Replied'],
		met: ['met', 'bi-check2', () => 'SLA met'],
		missed: ['missed', 'bi-x-circle', () => 'SLA missed'],
	};

	const COMPARE = {
		due: (a, b) =>
			a.status === 'solved' && b.status === 'solved'
				? b.solvedAt - a.solvedAt
				: urgencyScore(a) - urgencyScore(b),
		newest: (a, b) => lastActivity(b) - lastActivity(a),
		priority: (a, b) =>
			PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || urgencyScore(a) - urgencyScore(b),
	};

	const SAMPLE_RATINGS = [
		{ score: 'good', comment: 'Clear answer and quick. Thank you.' },
		{ score: 'good', comment: '' },
		{ score: 'bad', comment: 'Fixed in the end, but it took a few goes.' },
	];

	const scenario = new URLSearchParams(location.search).get('state');
	let loadShouldFail = scenario === 'error';

	/**
	 * One method per request, as on the other app pages. The demo answers after
	 * a short pause; a fetch() that resolves the same way can replace any body.
	 */
	const api = {
		load() {
			/* GET /api/support: the queue and everything drawn around it */
			if (!loadShouldFail) return pause(500, scenario === 'empty' ? { ...fixture, tickets: [] } : fixture);
			return pause(600).then(() => {
				loadShouldFail = false;
				throw new Error('The server did not answer');
			});
		},
		createTicket(ticket) {
			return persist(250);
		} /* POST /api/tickets */,
		sendReply(id, message) {
			return persist(700);
		} /* POST /api/tickets/:id/replies, which emails or chats the customer */,
		addNote(id, message) {
			return persist(300);
		} /* POST /api/tickets/:id/notes */,
		setStatus(ids, status) {
			return persist(200);
		} /* PATCH /api/tickets with { ids, status } */,
		assign(ids, agentId) {
			return persist(200);
		} /* PATCH /api/tickets with { ids, assignee } */,
		setPriority(ids, priority) {
			return persist(200);
		} /* PATCH /api/tickets with { ids, priority } */,
		setTags(id, tags) {
			return persist(200);
		} /* PUT /api/tickets/:id/tags */,
		escalate(id, escalation) {
			return persist(300);
		} /* POST /api/tickets/:id/escalations with { team, text } */,
		markRead(id, isRead) {
			return persist(100);
		} /* PUT or DELETE /api/tickets/:id/read */,
		deleteSpam(id) {
			return persist(250);
		} /* DELETE /api/tickets/:id, blocking the sender as well */,
	};

	const bootedAt = Date.now();
	let desk = null;
	let queue = [];
	const accounts = new Map();
	const team = new Map();
	let ticketSerial = 20419;
	let ratingIndex = 0;
	let tagsSyncing = false;
	let searchDelay = 0;
	let tagsDelay = 0;

	const ui = {
		busy: true,
		failure: null,
		viewKey: 'open',
		search: '',
		facets: { channel: [], priority: [], plan: [] },
		order: 'due',
		pageNo: 1,
		visibleIds: [],
		currentId: null,
		/* The row with keyboard focus, which may not be the open ticket. */
		focusId: null,
		checked: new Set(),
		composeMode: 'reply',
		pendingMacro: null,
		unsent: new Map(),
	};

	const dom = {
		app: pick('[data-hd-app]'),
		teamLine: pick('[data-hd-team-line]'),
		levelsLine: pick('[data-hd-levels-sub]'),
		themeToggle: pick('[data-hd-theme]'),
		metrics: pick('[data-hd-metrics]'),
		tabs: pick('[data-hd-views]'),
		pane: pick('#hd-queue-pane'),
		search: pick('[data-hd-search]'),
		facetForm: pick('[data-hd-filter]'),
		facetBadge: pick('[data-hd-filter-n]'),
		order: pick('[data-hd-sort]'),
		checkAll: pick('[data-hd-all]'),
		summary: pick('[data-hd-count-line]'),
		bulkBar: pick('[data-hd-bulk]'),
		bulkCount: pick('[data-hd-bulk-count]'),
		bulkOwners: pick('[data-hd-bulk-assign]'),
		rows: pick('[data-hd-list]'),
		listEmpty: pick('[data-hd-list-empty]'),
		pager: pick('[data-hd-qfoot]'),
		pagerPos: pick('[data-hd-page-pos]'),
		placeholder: pick('[data-hd-none]'),
		placeholderTitle: pick('[data-hd-title]'),
		placeholderText: pick('[data-hd-none-text]'),
		ticket: pick('[data-hd-view-box]'),
		position: pick('[data-hd-pos]'),
		ownerButton: pick('[data-hd-assign-btn]'),
		ownerMenu: pick('[data-hd-assign-menu]'),
		scroller: pick('[data-hd-tscroll]'),
		heading: pick('[data-hd-thead]'),
		slaBox: pick('[data-hd-sla]'),
		thread: pick('[data-hd-thread]'),
		typing: pick('[data-hd-typing]'),
		typingName: pick('[data-hd-typing-who]'),
		composer: pick('[data-hd-composer]'),
		draft: pick('[data-hd-text]'),
		draftLabel: pick('[data-hd-text-label]'),
		recipient: pick('[data-hd-to]'),
		afterSend: pick('[data-hd-after]'),
		sendButton: pick('[data-hd-send]'),
		macroNote: pick('[data-hd-applied]'),
		solvedBar: pick('[data-hd-solvedbar]'),
		solvedLine: pick('[data-hd-solved-text]'),
		sidePanel: pick('#hd-side'),
		sideBody: pick('[data-hd-side]'),
		props: pick('[data-hd-props]'),
		prioritySelect: pick('[data-hd-priority]'),
		tagBox: pick('.hd-tags'),
		macroList: pick('[data-hd-macro-list]'),
		macroMenu: pick('[data-hd-macros]'),
		macroButton: pick('[data-hd-macros-btn]'),
	};

	const dialogs = {
		escalate: pick('#hd-esc-dialog'),
		escalateForm: pick('[data-hd-esc-form]'),
		spam: pick('#hd-spam-dialog'),
		create: pick('#hd-new-dialog'),
		createForm: pick('[data-hd-new-form]'),
		customerField: pick('[data-hd-new-customer]'),
	};

	/* Wires the page, draws what basalt.js expects on load, then asks for the queue. */
	function start() {
		bindDialogs();
		bindQueueControls();
		bindRows();
		bindPageClicks();
		bindTicketControls();
		bindComposer();
		drawMacroList();
		document.addEventListener('keydown', handleShortcut);
		setInterval(refreshClocks, 30000);
		document.addEventListener('basalt:appearance', reflectTheme);
		reflectTheme();
		loadDesk();
	}

	function loadDesk() {
		ui.busy = true;
		ui.failure = null;
		paintEverything();
		api.load()
			.then((payload) => {
				importDesk(payload);
				pick('[data-hd-customer-list]').innerHTML = payload.customers
					.map(
						(account) =>
							`<li data-value="${htmlSafe(account.name)}" data-hint="${htmlSafe(`${account.plan} · ${account.region}`)}">${htmlSafe(account.name)}</li>`,
					)
					.join('');
				const ownerField = pick('[data-hd-new-assignee]');
				ownerField.innerHTML = `<option value="">Unassigned</option>${payload.agents
					.map((agent) => {
						const mine = agent.id === payload.me;
						return `<option value="${agent.id}"${mine ? ' selected' : ''}>${htmlSafe(agent.name)}${mine ? ' (you)' : ''}</option>`;
					})
					.join('')}`;
				refreshSelect(ownerField);
				ui.busy = false;
				paintMetrics();
				paintFigures();
				paintList();
				openFirstTicket();
				/* New counts change the tab widths, so the marker measures again. */
				const tabs = dom.tabs.closest('[data-basalt-tabs]');
				if (tabs && tabs.basaltTabs) tabs.basaltTabs.refresh();
				planIncomingMessage();
			})
			.catch((problem) => {
				ui.busy = false;
				ui.failure = problem;
				paintMetrics();
				paintEverything();
				say('The support queue did not load.');
			});
	}

	function openFirstTicket() {
		const fromAddress = ticketById(decodeURIComponent(location.hash.slice(1)));
		if (fromAddress) {
			if (!QUEUE_VIEWS[ui.viewKey].test(fromAddress))
				switchView(fromAddress.status === 'solved' ? 'solved' : 'open');
			showTicket(fromAddress.id, { focus: false });
			return;
		}
		if (!isNarrow() && ui.visibleIds.length) {
			showTicket(ui.visibleIds[0], { focus: false, quiet: true });
			showPane('list');
			return;
		}
		paintTicket();
	}

	/* Working copies of the tickets, with dates in place of "minutes ago". */
	function importDesk(payload) {
		desk = payload;
		accounts.clear();
		team.clear();
		for (const account of payload.customers) accounts.set(account.id, account);
		for (const agent of payload.agents) team.set(agent.id, agent);
		const base = payload.now.getTime();

		function minutesBefore(minutes) {
			return new Date(base - minutes * MINUTE);
		}

		queue = payload.tickets.map((source) => {
			const ticket = {
				...source,
				tags: [...(source.tags || [])],
				messages: source.messages.map((message) => ({ ...message, at: minutesBefore(message.ago) })),
			};
			ticket.created = ticket.messages[0].at;
			if (source.solvedAgo != null) ticket.solvedAt = minutesBefore(source.solvedAgo);
			if (source.csat) ticket.csat = { ...source.csat, sentAt: minutesBefore(source.csat.sentAgo) };
			return ticket;
		});
	}

	function bindQueueControls() {
		dom.tabs.addEventListener('shown.bs.tab', (event) => {
			const key = event.target.dataset.hdView;
			if (key && key !== ui.viewKey) switchView(key);
			/* Every tab shows the same pane, so it stays visible. */
			dom.pane.classList.add('active');
		});

		dom.search.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => {
				ui.search = dom.search.value;
				ui.pageNo = 1;
				paintList();
				paintTicket({ keepScroll: true });
			}, 140);
		});
		dom.search.addEventListener('keydown', handleSearchKey);

		dom.facetForm.addEventListener('change', readFacets);
		dom.facetForm.addEventListener('reset', () => setTimeout(readFacets, 0));
		dom.facetForm.addEventListener('submit', (event) => event.preventDefault());

		dom.order.addEventListener('change', () => {
			ui.order = dom.order.value;
			paintList();
			paintTicket({ keepScroll: true });
		});

		for (const button of pickAll('[data-hd-page]')) {
			button.addEventListener('click', () => {
				ui.pageNo += Number(button.dataset.hdPage);
				ui.focusId = null;
				paintList();
				focusRow();
			});
		}

		dom.checkAll.addEventListener('change', () => {
			const onPage = pickAll('.hd-row', dom.rows).map((row) => row.dataset.id);
			for (const id of onPage) {
				if (dom.checkAll.checked) ui.checked.add(id);
				else ui.checked.delete(id);
			}
			paintList();
			say(dom.checkAll.checked ? `${tally(onPage.length, 'ticket')} selected` : 'Selection cleared');
		});

		dom.bulkOwners.innerHTML = '';
		dom.bulkBar.addEventListener('click', handleBulkClick);
		dom.bulkBar.addEventListener('show.bs.dropdown', (event) => {
			if (!event.target.nextElementSibling || event.target.nextElementSibling !== dom.bulkOwners) return;
			dom.bulkOwners.innerHTML = agentMenuHtml(null, 'bulk-assign-to');
			drawAvatars(dom.bulkOwners);
		});
	}

	function handleSearchKey(event) {
		if (event.key === 'Escape' && dom.search.value) {
			event.preventDefault();
			event.stopPropagation();
			dom.search.value = '';
			ui.search = '';
			paintList();
		}
		if (event.key === 'ArrowDown' || event.key === 'Enter') {
			event.preventDefault();
			clearTimeout(searchDelay);
			ui.search = dom.search.value;
			paintList();
			showPane('list');
			focusRow();
		}
	}

	function handleBulkClick(event) {
		const ids = [...ui.checked];
		const owner = event.target.closest('[data-hd-bulk-assign-to]');
		if (owner) return void handOver(ids, owner.dataset.hdBulkAssignTo, { clearSelection: true });
		const level = event.target.closest('[data-hd-bulk-priority]');
		if (level) return void changePriority(ids, level.dataset.hdBulkPriority, { clearSelection: true, toast: true });
		if (event.target.closest('[data-hd-bulk-solve]'))
			return void updateStatus(ids, 'solved', { clearSelection: true });
		if (event.target.closest('[data-hd-bulk-clear]')) {
			ui.checked.clear();
			paintList();
			say('Selection cleared');
		}
	}

	const ROW_KEYS = new Map([
		['ArrowDown', (index) => index + 1],
		['ArrowUp', (index) => index - 1],
		['Home', () => 0],
		['End', (index, total) => total - 1],
	]);

	function bindRows() {
		dom.rows.addEventListener('click', (event) => {
			const row = event.target.closest('.hd-row[data-id]');
			if (!row) return;
			if (event.target.closest('.hd-row-check')) return void toggleChecked(row.dataset.id, event.target.checked);
			if (event.shiftKey || event.metaKey || event.ctrlKey) {
				event.preventDefault();
				toggleChecked(row.dataset.id);
				return;
			}
			showTicket(row.dataset.id);
		});

		dom.rows.addEventListener('keydown', (event) => {
			const row = event.target.closest('.hd-row[data-id]');
			const nextIndex = ROW_KEYS.get(event.key);
			if (!row || !nextIndex) return;
			event.preventDefault();
			const all = pickAll('.hd-row', dom.rows);
			const target = all[nextIndex(all.indexOf(row), all.length)];
			if (target) moveRowFocus(target.dataset.id, true);
		});

		dom.rows.addEventListener('focusin', (event) => {
			const row = event.target.closest('.hd-row[data-id]');
			if (row && ui.focusId !== row.dataset.id) moveRowFocus(row.dataset.id, false);
		});
	}

	const TICKET_ACTIONS = {
		mine: (ticket) => handOver([ticket.id], fixture.me),
		spam: () => {
			closeSidePanel();
			confirmSpam();
		},
		unread: (ticket) => {
			ticket.unread = true;
			api.markRead(ticket.id, false).catch(
				rollbackWith(`mark ${ticket.id} as unread`, () => {
					ticket.unread = false;
				}),
			);
			if (isNarrow()) returnToQueue();
			else paintList();
			say(`${ticket.id} marked as unread`);
		},
		copy: (ticket) => {
			const link = `${location.href.split('#')[0]}#${ticket.id}`;
			const copying = window.Basalt.copyText ? window.Basalt.copyText(link) : Promise.resolve();
			copying.then(() =>
				notify({ tone: 'success', icon: 'bi-link-45deg', title: 'Link copied', text: link, duration: 3000 }),
			);
		},
	};

	/* Clicks are matched in this order; the first hit wins. */
	const CLICK_ROUTES = [
		['[data-hd-retry]', () => loadDesk()],
		['[data-hd-new]', () => openNewTicket()],
		['[data-hd-keys-open]', () => showModal(pick('#hd-keys'))],
		['[data-hd-levels-open]', () => showModal(pick('#hd-levels'))],
		['[data-hd-theme]', () => window.Basalt.setTheme(window.Basalt.getTheme() === 'dark' ? 'light' : 'dark')],
		[
			'[data-hd-clear-search]',
			() => {
				dom.search.value = '';
				ui.search = '';
				paintList();
				dom.search.focus();
			},
		],
		['[data-hd-clear-filters]', () => dom.facetForm.reset()],
		['[data-hd-go]', (match) => switchView(match.dataset.hdGo)],
		[
			'[data-hd-open]',
			(match) => {
				closeSidePanel();
				showTicket(match.dataset.hdOpen);
			},
		],
		['[data-hd-step]', (match) => stepBy(Number(match.dataset.hdStep))],
		['[data-hd-back]', () => returnToQueue()],
		['[data-hd-escalate]', () => openEscalation()],
		[
			'[data-hd-reopen]',
			() => {
				updateStatus([ui.currentId], 'open');
				focusWriting('reply');
			},
		],
		[
			'[data-hd-macro-drop]',
			() => {
				ui.pendingMacro = null;
				paintMacroNote();
				dom.draft.focus();
				say('Macro removed. The text stays.');
			},
		],
		[
			'[data-hd-assign]',
			(match) => {
				handOver([ui.currentId], match.dataset.hdAssign || null);
				dom.ownerButton.focus();
			},
		],
		[
			'[data-hd-act]',
			(match) => {
				const ticket = ticketById(ui.currentId);
				if (ticket) TICKET_ACTIONS[match.dataset.hdAct]?.(ticket);
			},
		],
	];

	function bindPageClicks() {
		host.addEventListener('click', (event) => {
			for (const [selector, run] of CLICK_ROUTES) {
				const match = event.target.closest(selector);
				if (match) return void run(match);
			}
		});
	}

	function bindTicketControls() {
		/* After a status pick the menu is redrawn, so its pill gets focus back. */
		host.addEventListener('basalt:statuschange', (event) => {
			const menu = event.target.closest('[data-hd-status-host]');
			if (!menu) return;
			const chosen = pick('[aria-current="true"][data-hd-st]', menu);
			if (chosen) updateStatus([ui.currentId], chosen.dataset.hdSt);
			setTimeout(() => pick('[data-hd-status-host] .basalt-status')?.focus(), 0);
		});

		dom.prioritySelect.addEventListener('change', () => {
			if (!ui.currentId || dom.prioritySelect.value === ticketById(ui.currentId).priority) return;
			changePriority([ui.currentId], dom.prioritySelect.value);
		});

		dom.tagBox.addEventListener('change', () => {
			if (tagsSyncing || !dom.tagBox.basaltTags) return;
			const ticket = ticketById(ui.currentId);
			if (!ticket) return;
			const previous = ticket.tags.slice();
			ticket.tags = dom.tagBox.basaltTags.get();
			clearTimeout(tagsDelay);
			tagsDelay = setTimeout(() => {
				api.setTags(ticket.id, ticket.tags).catch(
					rollbackWith(`save the tags on ${ticket.id}`, () => {
						ticket.tags = previous;
					}),
				);
			}, 400);
			paintList();
		});
	}

	function bindComposer() {
		for (const radio of pickAll('[data-hd-mode]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				ui.composeMode = radio.value;
				const macro = ui.pendingMacro;
				if (macro && Boolean(macro.note) !== (ui.composeMode === 'note')) ui.pendingMacro = null;
				paintComposer();
			});
		}

		dom.composer.addEventListener('submit', (event) => {
			event.preventDefault();
			submitMessage();
		});

		dom.draft.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				submitMessage();
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				dom.draft.blur();
				if (isNarrow()) pick('[data-hd-back]').focus();
				else focusRow();
			}
		});

		dom.macroMenu.addEventListener('basalt:command', (event) => insertMacro(event.detail.value));
	}

	function bindDialogs() {
		const { escalate, escalateForm, create, createForm, customerField } = dialogs;

		escalateForm.addEventListener('change', (event) => {
			if (event.target.name === 'hd-esc-team') describeTeamOwner();
		});
		escalate.addEventListener('shown.bs.modal', () => pick('[data-hd-esc-why]').focus());
		escalateForm.addEventListener('submit', submitEscalation);

		pick('[data-hd-spam-go]').addEventListener('basalt:confirm', deleteAsSpam);

		create.addEventListener('shown.bs.modal', () => customerField.focus());
		customerField.addEventListener('change', () => {
			const account = findAccountByName(customerField.value);
			const contactField = pick('[data-hd-new-who]');
			if (account && !contactField.value.trim()) contactField.value = account.contact.name;
			previewNewSla();
		});
		pick('[data-hd-new-priority]').addEventListener('change', previewNewSla);
		createForm.addEventListener('submit', submitNewTicket);
	}

	/* The list must exist before the shared command menu binds on load. */
	function drawMacroList() {
		const macroGroups = [
			['reply', 'Replies'],
			['macro', 'Macros: reply and change the ticket'],
		];
		dom.macroList.innerHTML = macroGroups
			.map(([kind, heading]) => {
				const items = fixture.macros
					.filter((macro) => macro.kind === kind)
					.map(macroItemHtml)
					.join('');
				return `<div class="basalt-command-group" role="group" aria-labelledby="hd-macro-g-${kind}"><div class="basalt-command-heading" id="hd-macro-g-${kind}">${heading}</div>${items}</div>`;
			})
			.join('');
	}

	function macroItemHtml(macro) {
		const keywords = (macro.tags || []).join(' ') + (macro.note ? ' note internal' : '');
		const iconClasses =
			macro.kind === 'macro' ? 'basalt-command-icon basalt-command-icon-primary' : 'basalt-command-icon';
		return `<div class="basalt-command-item" role="option" id="hd-macro-${macro.id}" aria-selected="false" data-value="${macro.id}" data-keywords="${htmlSafe(keywords)}"><span class="${iconClasses}" aria-hidden="true"><i class="bi ${macro.icon}"></i></span><span class="basalt-command-text"><span class="basalt-command-title">${htmlSafe(macro.title)}</span><span class="basalt-command-sub">${htmlSafe(macro.sub)}</span></span></div>`;
	}

	function caseless(entries) {
		const table = new Map();
		for (const [letter, run] of entries) {
			table.set(letter, run);
			table.set(letter.toUpperCase(), run);
		}
		return table;
	}

	const QUEUE_KEYS = caseless([
		[
			'/',
			() => {
				dom.search.focus();
				dom.search.select();
			},
		],
		['?', () => showModal(pick('#hd-keys'))],
		['c', () => openNewTicket()],
		['j', () => stepBy(1)],
		['k', () => stepBy(-1)],
	]);

	/* These need an open ticket on screen; M also needs the composer. */
	const TICKET_KEYS = caseless(
		[
			['r', () => focusWriting('reply')],
			['n', () => focusWriting('note')],
			['m', () => bootstrap.Dropdown.getOrCreateInstance(dom.macroButton).show(), () => !dom.composer.hidden],
			['a', () => handOver([ui.currentId], fixture.me)],
		].map(([letter, run, allowed]) => [letter, { run, allowed }]),
	);

	/** Single-key shortcuts, ignored while typing, in a dialog or menu, or before the queue loads. */
	function handleShortcut(event) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
		if (pick('.modal.show, .dropdown-menu.show')) return;
		/* Side sheets keep their own keys, Escape included. */
		if (pick('.offcanvas.show') || dom.sidePanel.contains(event.target)) return;
		if (isTextEntry(event.target) || ui.busy || ui.failure) return;

		const key = event.key;
		const queueKey = QUEUE_KEYS.get(key);
		if (queueKey) {
			event.preventDefault();
			queueKey();
			return;
		}
		if (key === 'x' || key === 'X') {
			const id = browsingListOnPhone() ? ui.focusId : ui.currentId || ui.focusId;
			if (id) {
				event.preventDefault();
				toggleChecked(id);
			}
			return;
		}
		const readingTicket = !isNarrow() || dom.app.dataset.view === 'ticket';
		if (key === 'Escape' && isNarrow() && dom.app.dataset.view === 'ticket') {
			event.preventDefault();
			returnToQueue();
			return;
		}
		if (!ui.currentId || !readingTicket) return;
		const ticketKey = TICKET_KEYS.get(key);
		if (ticketKey && (!ticketKey.allowed || ticketKey.allowed())) {
			event.preventDefault();
			ticketKey.run();
		}
	}

	function isTextEntry(target) {
		return target?.closest?.('input, textarea, select, [contenteditable="true"]');
	}

	function switchView(key) {
		if (!QUEUE_VIEWS[key]) return;
		ui.viewKey = key;
		ui.pageNo = 1;
		ui.checked.clear();
		const tab = pick(`[data-hd-view="${key}"]`, dom.tabs);
		if (tab && !tab.classList.contains('active')) bootstrap.Tab.getOrCreateInstance(tab).show();
		dom.pane.setAttribute('aria-labelledby', `hd-view-${key}`);
		paintEverything({ keepScroll: true });
	}

	function readFacets() {
		for (const facet of Object.keys(ui.facets)) {
			ui.facets[facet] = pickAll(`input[name="${facet}"]:checked`, dom.facetForm).map((box) => box.value);
		}
		const active = facetCount();
		dom.facetBadge.hidden = !active;
		dom.facetBadge.textContent = active;
		pick('[data-hd-filter-btn]').setAttribute(
			'aria-label',
			active ? `Filter, ${tally(active, 'filter')} on` : 'Filter',
		);
		ui.pageNo = 1;
		paintList();
		paintTicket({ keepScroll: true });
	}

	function facetCount() {
		return Object.values(ui.facets).reduce((sum, chosen) => sum + chosen.length, 0);
	}

	const FACET_VALUE = {
		channel: (ticket) => ticket.channel,
		priority: (ticket) => ticket.priority,
		plan: (ticket) => (accountOf(ticket) ? planFor(ticket) : ''),
	};

	function visibleTickets() {
		const query = ui.search.trim();
		const view = QUEUE_VIEWS[ui.viewKey];
		return queue
			.filter((ticket) => view.test(ticket) && passesFacets(ticket) && (!query || fitsSearch(ticket, query)))
			.sort(COMPARE[ui.order]);
	}

	function passesFacets(ticket) {
		return Object.entries(ui.facets).every(
			([facet, chosen]) => !chosen.length || chosen.includes(FACET_VALUE[facet](ticket)),
		);
	}

	/* Every word typed must appear somewhere in the ticket. */
	function fitsSearch(ticket, query) {
		const account = accountOf(ticket);
		const person = personFor(ticket);
		const haystack = [
			ticket.id,
			ticket.subject,
			account ? account.name : '',
			person.name,
			person.email,
			ticket.tags.join(' '),
			agentLabel(ticket.assignee),
		]
			.join(' ')
			.toLowerCase();
		return query
			.toLowerCase()
			.split(/\s+/)
			.filter(Boolean)
			.every((word) => haystack.includes(word));
	}

	/** Lower sorts first: minutes left, then answered, then paused tickets. */
	function urgencyScore(ticket) {
		const sla = slaFor(ticket);
		if (sla.left != null) return sla.left;
		return { answered: 1e6, paused: 2e6 }[sla.state] ?? 3e6;
	}

	/* The reply clock runs from the first customer message with no public reply
     after it. Pending and On hold pause it; Solved stops it. */
	function slaFor(ticket) {
		if (ticket.status === 'solved') return { state: ticket.slaMet === false ? 'missed' : 'met' };
		if (PAUSE_REASONS[ticket.status]) return { state: 'paused', why: PAUSE_REASONS[ticket.status] };
		let startedAt = null;
		let repliedBefore = false;
		for (const message of ticket.messages) {
			if (message.t === 'reply') {
				startedAt = null;
				repliedBefore = true;
			}
			if (message.t === 'customer' && !startedAt) startedAt = message.at;
		}
		if (!startedAt) return { state: 'answered' };
		const target = fixture.sla[planFor(ticket)][ticket.priority];
		const due = new Date(startedAt.getTime() + target * MINUTE);
		const left = (due - clock()) / MINUTE;
		let state = 'ok';
		if (left < 0) state = 'late';
		else if (left <= AT_RISK_MINUTES) state = 'risk';
		return { state, due, left, target, since: startedAt, kind: repliedBefore ? 'Next reply' : 'First reply' };
	}

	function slaChipHtml(ticket) {
		const sla = slaFor(ticket);
		const [tone, icon, wording] = CHIP_LOOK[sla.state];
		const tip = sla.due ? `${sla.kind} due ${stampLong(sla.due)}` : sla.why || '';
		const tipAttr = tip ? ` title="${htmlSafe(tip)}"` : '';
		const spoken = sla.due ? `<span class="visually-hidden">${htmlSafe(sla.kind)} </span>` : '';
		return `<span class="hd-chip hd-chip-${tone}"${tipAttr}><i class="bi ${icon}" aria-hidden="true"></i>${spoken}${htmlSafe(wording(sla))}</span>`;
	}

	function paintEverything(options) {
		paintFigures();
		paintList();
		paintTicket(options);
	}

	function paintFigures() {
		const openCount = queue.filter(QUEUE_VIEWS.open.test).length;
		const breachingCount = queue.filter(QUEUE_VIEWS.breaching.test).length;
		const solvedToday = queue.filter(
			(ticket) => ticket.status === 'solved' && ticket.solvedAt && calendarGap(ticket.solvedAt) === 0,
		).length;
		const ready = !ui.busy && !ui.failure;
		dom.teamLine.textContent = ready ? `${openCount} open · ${breachingCount} breaching SLA` : 'Support';
		const today = ready
			? ` Right now: ${openCount} open, ${breachingCount} breaching SLA, ${solvedToday} solved today.`
			: '';
		dom.levelsLine.textContent = `The last 7 days, against the reply times we promise.${today}`;

		for (const [key, view] of Object.entries(QUEUE_VIEWS)) {
			const badge = pick(`[data-hd-count="${key}"]`);
			if (badge) badge.textContent = ui.busy || ui.failure ? '' : queue.filter(view.test).length;
		}
		pick('[data-hd-count="breaching"]')?.classList.toggle('is-zero', !breachingCount);
	}

	function paintMetrics() {
		if (ui.busy) return;
		dom.metrics.setAttribute('aria-busy', 'false');
		if (ui.failure) {
			dom.metrics.innerHTML = '<p class="hd-metrics-none">Service levels show once the support queue loads.</p>';
			return;
		}
		const figures = desk.metrics;
		const satisfaction = Math.round((figures.csat.good / (figures.csat.good + figures.csat.bad)) * 100);
		const slaShift = figures.slaMet - figures.slaMetBefore;
		const firstShift = figures.firstReply - figures.firstReplyBefore;
		const solveShift = figures.toSolve - figures.toSolveBefore;
		const csatShift = satisfaction - figures.csatBefore;

		const tiles = [
			{
				key: 'sla',
				icon: 'bi-shield-check',
				label: 'SLA met',
				value: `${figures.slaMet.toFixed(1)}%`,
				trend: trendBadge(
					slaShift,
					true,
					`${figures.slaMet >= figures.slaMetBefore ? '+' : ''}${slaShift.toFixed(1)} pts`,
				),
				sub: `Target ${figures.slaTarget}%`,
				meter: { value: figures.slaMet, target: figures.slaTarget },
			},
			{
				key: 'first',
				icon: 'bi-reply',
				label: 'First reply, median',
				value: timeSpan(figures.firstReply),
				trend: trendBadge(
					firstShift,
					false,
					`${timeSpan(Math.abs(firstShift))}${figures.firstReply <= figures.firstReplyBefore ? ' faster' : ' slower'}`,
				),
				sub: `Was ${timeSpan(figures.firstReplyBefore)}`,
			},
			{
				key: 'solve',
				icon: 'bi-check2-circle',
				label: 'Time to solve, median',
				value: timeSpan(figures.toSolve),
				trend: trendBadge(
					solveShift,
					false,
					`${timeSpan(Math.abs(solveShift))}${figures.toSolve <= figures.toSolveBefore ? ' faster' : ' slower'}`,
				),
				sub: `Was ${timeSpan(figures.toSolveBefore)}`,
			},
			{
				key: 'csat',
				icon: 'bi-emoji-smile',
				label: 'Satisfaction, 30 days',
				value: `${satisfaction}%`,
				trend: trendBadge(csatShift, true, `${satisfaction >= figures.csatBefore ? '+' : ''}${csatShift} pts`),
				sub: `${figures.csat.good} good of ${figures.csat.good + figures.csat.bad} ratings`,
			},
		];
		dom.metrics.innerHTML = tiles.map(metricTileHtml).join('');
		applyBarWidths(dom.metrics);
	}

	function metricTileHtml(tile) {
		const meter = tile.meter
			? `<div role="img" aria-label="${htmlSafe(`${tile.value} of tickets answered inside the SLA, target ${tile.meter.target}%`)}" class="hd-meter"><span class="hd-meter-fill" data-w="${tile.meter.value}"></span><span class="hd-meter-target" data-l="${tile.meter.target}"></span></div>`
			: '';
		const label = `<p class="hd-metric-label"><i class="bi ${tile.icon}" aria-hidden="true"></i>${htmlSafe(tile.label)}<span class="visually-hidden">, last 7 days</span></p>`;
		return `<div class="hd-metric" data-hd-metric="${tile.key}">${label}<p class="hd-metric-value">${htmlSafe(tile.value)}</p><p class="hd-metric-sub">${tile.trend}<span>${htmlSafe(tile.sub)}</span></p>${meter}</div>`;
	}

	/** Lower-is-better figures use the inverted colors, so a drop reads green. */
	function trendBadge(delta, higherIsBetter, text) {
		const rising = delta > 0;
		let tone = 'basalt-trend-flat';
		let icon = 'bi-dash';
		if (delta !== 0) {
			tone = `basalt-trend-${rising ? 'up' : 'down'}${higherIsBetter ? '' : ' basalt-trend-invert'}`;
			icon = rising ? 'bi-arrow-up-right' : 'bi-arrow-down-right';
		}
		return `<span class="basalt-trend ${tone}"><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(text)}</span>`;
	}

	/* Sizes travel as data-w / data-l and become CSS variables here. */
	function applyBarWidths(scope) {
		for (const bar of pickAll('[data-w]', scope)) bar.style.setProperty('--w', `${bar.dataset.w}%`);
		for (const mark of pickAll('[data-l]', scope)) mark.style.setProperty('--l', `${mark.dataset.l}%`);
	}

	function paintList() {
		if (ui.busy) return void showListLoading();
		dom.rows.setAttribute('aria-busy', 'false');
		if (ui.failure) return void showListFailure();

		const matching = visibleTickets();
		const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
		ui.pageNo = Math.min(ui.pageNo, pageCount);
		const firstIndex = (ui.pageNo - 1) * PAGE_SIZE;
		const onPage = matching.slice(firstIndex, ui.pageNo * PAGE_SIZE);
		ui.visibleIds = matching.map((ticket) => ticket.id);
		if (!onPage.some((ticket) => ticket.id === ui.focusId)) {
			ui.focusId = (onPage.find((ticket) => ticket.id === ui.currentId) || onPage[0])?.id || null;
		}

		const listHadFocus = dom.rows.contains(document.activeElement);
		dom.rows.innerHTML = onPage.map(rowHtml).join('');
		for (const ticket of onPage) delete ticket.fresh;
		drawAvatars(dom.rows);

		const searching = Boolean(ui.search.trim());
		if (matching.length) {
			dom.listEmpty.hidden = true;
		} else {
			let emptyReason = ui.viewKey;
			if (searching) emptyReason = 'search';
			else if (facetCount()) emptyReason = 'filters';
			dom.listEmpty.innerHTML = emptyStateHtml(emptyReason);
			dom.listEmpty.hidden = false;
		}

		dom.pager.hidden = !matching.length;
		dom.pagerPos.textContent = matching.length
			? `${firstIndex + 1}–${Math.min(matching.length, ui.pageNo * PAGE_SIZE)} of ${matching.length}`
			: '';
		pick('[data-hd-page="-1"]').disabled = ui.pageNo <= 1;
		pick('[data-hd-page="1"]').disabled = ui.pageNo >= pageCount;
		dom.summary.textContent = `${tally(matching.length, 'ticket')}${searching ? ' found' : ''}${facetCount() ? ', filtered' : ''}`;

		const checkedHere = onPage.filter((ticket) => ui.checked.has(ticket.id)).length;
		dom.checkAll.disabled = !onPage.length;
		dom.checkAll.checked = onPage.length > 0 && checkedHere === onPage.length;
		dom.checkAll.indeterminate = checkedHere > 0 && checkedHere < onPage.length;
		paintBulkBar();
		if (listHadFocus) focusRow();
	}

	function showListLoading() {
		dom.rows.setAttribute('aria-busy', 'true');
		dom.rows.innerHTML =
			'<li class="hd-row hd-row-skeleton" aria-hidden="true"><span class="basalt-skeleton basalt-skeleton-text hd-skel-a"></span><span class="basalt-skeleton basalt-skeleton-text"></span><span class="basalt-skeleton basalt-skeleton-text hd-skel-b"></span></li>'.repeat(
				6,
			);
		dom.listEmpty.hidden = true;
		dom.pager.hidden = true;
		dom.summary.textContent = 'Loading tickets…';
		dom.checkAll.disabled = true;
	}

	function showListFailure() {
		dom.rows.innerHTML = '';
		dom.listEmpty.innerHTML = emptyStateHtml('error');
		dom.listEmpty.hidden = false;
		dom.pager.hidden = true;
		dom.summary.textContent = '';
		dom.checkAll.disabled = true;
	}

	/* Checked tickets that left the queue are forgotten first. */
	function paintBulkBar() {
		for (const id of ui.checked) {
			if (!ticketById(id)) ui.checked.delete(id);
		}
		dom.bulkBar.hidden = !ui.checked.size;
		dom.bulkCount.textContent = `${ui.checked.size} selected`;
	}

	function rowHtml(ticket) {
		const account = accountOf(ticket);
		const person = personFor(ticket);
		const channel = CHANNEL_INFO[ticket.channel];
		const isCurrent = ticket.id === ui.currentId;
		const isChecked = ui.checked.has(ticket.id);
		const rowClass = classNames('hd-row', {
			'is-unread': ticket.unread,
			'is-active': isCurrent,
			'is-selected': isChecked,
			'is-fresh': ticket.fresh,
		});
		const plan = account
			? `<span class="hd-plan hd-plan-${account.plan.toLowerCase()}">${htmlSafe(account.plan)}</span>`
			: '<span class="hd-plan">Not a customer</span>';

		const top = `<span class="hd-row-top"><span class="hd-prio hd-prio-${ticket.priority}" aria-hidden="true"></span><span class="visually-hidden">${PRIORITY_LABEL[ticket.priority]} priority, </span><span class="hd-row-cust">${htmlSafe(account ? account.name : person.name)}</span>${plan}<span class="hd-row-time"><span class="visually-hidden">, updated </span>${htmlSafe(stampShort(lastActivity(ticket)))}</span></span>`;
		const subject = `<span class="hd-row-subject">${ticket.unread ? '<span class="visually-hidden">Unread: </span>' : ''}${htmlSafe(ticket.subject)}</span>`;
		const meta = `<span class="hd-row-meta"><span class="hd-row-ch" title="${channel.label}"><i class="bi ${channel.icon}" aria-hidden="true"></i><span class="visually-hidden">${channel.label}, </span>${htmlSafe(ticket.id)}</span>${statusPillHtml(ticket)}${slaChipHtml(ticket)}<span class="hd-row-end">${ownerBadgeHtml(ticket.assignee)}</span></span>`;

		const checkbox = `<input class="form-check-input hd-row-check" type="checkbox" tabindex="-1"${isChecked ? ' checked' : ''} aria-label="Select ${htmlSafe(ticket.id)}">`;
		const opener = `<button type="button" class="hd-row-open" tabindex="${ticket.id === ui.focusId ? '0' : '-1'}"${isCurrent ? ' aria-current="true"' : ''}>${top}${subject}${meta}</button>`;
		return `<li class="${rowClass}" data-id="${htmlSafe(ticket.id)}">${checkbox}${opener}</li>`;
	}

	function statusPillHtml(ticket) {
		const status = STATUS_INFO[ticket.status];
		return `<span class="basalt-status basalt-status-dot${status.tone ? ` basalt-status-${status.tone}` : ''}">${htmlSafe(status.label)}</span>`;
	}

	function ownerBadgeHtml(agentId) {
		const agent = team.get(agentId);
		if (!agent)
			return '<span class="hd-row-nobody" title="Unassigned"><i class="bi bi-person-dash" aria-hidden="true"></i><span class="visually-hidden">Unassigned</span></span>';
		return `<span class="hd-row-agent" title="${htmlSafe(agent.name)}">${avatarHtml(agent.name, 'basalt-avatar-xs')}<span class="visually-hidden">Assigned to ${htmlSafe(agent.name)}</span></span>`;
	}

	function avatarHtml(name, size, extra) {
		const classes = ['basalt-avatar', size || 'basalt-avatar-sm', extra].filter(Boolean).join(' ');
		return `<span class="${classes}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	/* Copy for an empty list, by reason; search gets the escaped term. */
	const EMPTY_STATES = {
		error: () => ({
			tone: 'danger',
			icon: 'bi-cloud-slash',
			title: 'Tickets could not load the queue',
			text: 'The helpdesk server did not answer. No tickets are lost; this only affects what you can see here.',
			actions:
				'<button type="button" class="btn btn-sm btn-primary" data-hd-retry><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button>',
		}),
		search: (term) => ({
			icon: 'bi-search',
			title: `No tickets match “${term}”`,
			text: 'Search looks at subjects, ticket numbers, customers, contacts and tags in this view.',
			actions: `<button type="button" class="btn btn-sm btn-outline-secondary" data-hd-clear-search>Clear the search</button>${ui.viewKey !== 'open' ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-hd-go="open">Search all open</button>' : ''}`,
		}),
		filters: () => ({
			icon: 'bi-funnel',
			title: 'Nothing matches these filters',
			text: `No ticket in ${QUEUE_VIEWS[ui.viewKey].label} fits every filter you picked.`,
			actions:
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-hd-clear-filters>Clear filters</button>',
		}),
		unassigned: () => ({
			tone: 'success',
			icon: 'bi-person-check',
			title: 'Every ticket has an owner',
			text: 'New tickets from email, chat and phone land here until someone picks them up.',
		}),
		mine: () => ({
			icon: 'bi-person',
			title: 'Nothing assigned to you',
			text: 'Pick something up from Unassigned, or press A on a ticket to take it.',
			actions:
				'<button type="button" class="btn btn-sm btn-outline-secondary" data-hd-go="unassigned">Show unassigned</button>',
		}),
		open: () => ({
			tone: 'success',
			icon: 'bi-inbox',
			title: 'The queue is clear',
			text: 'No open tickets. New ones arrive here as customers write in or call.',
			actions:
				'<button type="button" class="btn btn-sm btn-primary" data-hd-new><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>New ticket</button>',
		}),
		breaching: () => ({
			tone: 'success',
			icon: 'bi-shield-check',
			title: 'Nothing is breaching',
			text: `Every open ticket is more than ${AT_RISK_MINUTES} minutes inside its SLA.`,
		}),
		solved: () => ({
			icon: 'bi-check2-circle',
			title: 'Nothing solved yet',
			text: "Solved tickets stay here, with the customer's rating once they give one.",
		}),
	};

	function emptyStateHtml(emptyReason) {
		const copy = EMPTY_STATES[emptyReason](htmlSafe(ui.search.trim()));
		const panelClass = classNames('basalt-empty basalt-empty-compact', {
			[`basalt-empty-${copy.tone}`]: copy.tone,
			'hd-empty': true,
		});
		const buttons = copy.actions ? `<div class="basalt-empty-actions">${copy.actions}</div>` : '';
		return `<div class="${panelClass}"${emptyReason === 'error' ? ' role="alert"' : ''}><span class="hd-empty-icon" aria-hidden="true"><i class="bi ${copy.icon}"></i></span><h3 class="basalt-empty-title">${copy.title}</h3><p class="basalt-empty-text">${copy.text}</p>${buttons}</div>`;
	}

	/* Only one row sits in the tab order; arrows reach the rest. */
	function moveRowFocus(id, giveFocus) {
		ui.focusId = id;
		for (const opener of pickAll('.hd-row-open', dom.rows)) {
			opener.tabIndex = opener.closest('.hd-row').dataset.id === id ? 0 : -1;
		}
		if (giveFocus) focusRow();
	}

	function focusRow() {
		const row = ui.focusId && pick(`.hd-row[data-id="${ui.focusId}"]`, dom.rows);
		if (row) pick('.hd-row-open', row).focus();
	}

	function paintTicket(options = {}) {
		const ticket = ticketById(ui.currentId);
		if (!ticket) return void paintNoTicket();

		dom.placeholderTitle.removeAttribute('id');
		dom.placeholder.hidden = true;
		dom.ticket.hidden = false;
		for (const link of pickAll('[data-hd-full]'))
			link.href = `ticket-details.html?id=${encodeURIComponent(ticket.id)}`;

		const index = ui.visibleIds.indexOf(ticket.id);
		dom.position.textContent = index >= 0 ? `${index + 1} of ${ui.visibleIds.length}` : '';
		pick('[data-hd-step="-1"]').disabled = index <= 0;
		pick('[data-hd-step="1"]').disabled = index < 0 || index >= ui.visibleIds.length - 1;

		paintOwnerControl(ticket);
		swapStatusMenu(ticket);

		dom.heading.innerHTML = headingHtml(ticket);
		dom.slaBox.innerHTML = slaPanelHtml(ticket);
		applyBarWidths(dom.slaBox);

		const savedScroll = options.keepScroll ? dom.scroller.scrollTop : null;
		dom.thread.innerHTML =
			ticket.messages.map((message, position) => messageHtml(ticket, message, position)).join('') +
			ratingHtml(ticket);
		for (const message of ticket.messages) delete message.fresh;
		if (window.Basalt.avatars) {
			for (const scope of [dom.thread, dom.ownerButton, dom.ownerMenu]) window.Basalt.avatars(scope);
		}
		window.Basalt.buttons?.(dom.heading);
		window.Basalt.tips?.(dom.heading);
		if (savedScroll != null) dom.scroller.scrollTop = savedScroll;
		else dom.scroller.scrollTop = options.toEnd ? dom.scroller.scrollHeight : 0;

		const solved = ticket.status === 'solved';
		dom.composer.hidden = solved;
		dom.solvedBar.hidden = !solved;
		if (solved)
			dom.solvedLine.textContent = `Solved ${stampInline(ticket.solvedAt)} by ${agentLabel(ticket.assignee)}. A reply from the customer opens it again.`;
		paintComposer();
		paintCustomer(ticket);
	}

	function paintNoTicket() {
		dom.ticket.hidden = true;
		dom.placeholder.hidden = false;
		dom.props.hidden = true;
		if (!dom.placeholderTitle.isConnected) dom.placeholder.prepend(dom.placeholderTitle);
		dom.placeholderTitle.id = 'hd-ticket-title';
		let title = 'Pick a ticket';
		let text = queue.length
			? 'Choose a ticket from the list to read it and reply. Press <kbd>J</kbd> and <kbd>K</kbd> to move through the queue.'
			: 'There are no tickets yet. They arrive here from email, chat and phone.';
		if (ui.failure) {
			title = 'Nothing to show yet';
			text = 'Once the queue loads, pick a ticket to read it and reply.';
		} else if (ui.busy) {
			title = 'Loading the queue';
			text = 'One moment.';
		}
		dom.placeholderTitle.textContent = title;
		dom.placeholderText.innerHTML = text;
		dom.sideBody.innerHTML = '<p class="hd-side-none">The customer behind the open ticket shows here.</p>';
	}

	function paintOwnerControl(ticket) {
		const owner = team.get(ticket.assignee);
		dom.ownerButton.innerHTML = owner
			? `${avatarHtml(owner.name, 'basalt-avatar-xs')}<span class="hd-hide-sm">${htmlSafe(givenName(owner.name))}</span>`
			: '<i class="bi bi-person-plus" aria-hidden="true"></i><span class="hd-hide-sm">Assign</span>';
		dom.ownerButton.setAttribute(
			'aria-label',
			owner ? `Assigned to ${owner.name}. Change` : 'Unassigned. Assign someone',
		);
		dom.ownerMenu.innerHTML = agentMenuHtml(ticket.assignee, 'assign');
	}

	/* The shared status menu binds once per element, so each ticket gets a fresh one. */
	function swapStatusMenu(ticket) {
		const scratch = document.createElement('template');
		scratch.innerHTML = statusMenuHtml(ticket);
		const menu = scratch.content.firstElementChild;
		pick('[data-hd-status-host]').replaceWith(menu);
		window.Basalt.badges?.(menu.parentElement);
	}

	function headingHtml(ticket) {
		const account = accountOf(ticket);
		const channel = CHANNEL_INFO[ticket.channel];
		const copyButton = `<button type="button" class="btn btn-icon btn-sm hd-copy" data-basalt-copy="${htmlSafe(ticket.id)}" aria-label="Copy ticket number" data-bs-toggle="tooltip" data-bs-title="Copy number" data-basalt-copy-done="Copied"><i class="bi bi-copy" aria-hidden="true"></i></button>`;
		const escalation = ticket.escalation
			? `<span class="hd-esc-flag"><i class="bi bi-arrow-up-right-circle" aria-hidden="true"></i>With ${htmlSafe(ticket.escalation.team)}${ticket.escalation.ref ? ` · ${htmlSafe(ticket.escalation.ref)}` : ''}</span>`
			: '';
		const facts = [
			`<span class="hd-thead-id">${htmlSafe(ticket.id)}${copyButton}</span>`,
			`<span><i class="bi ${channel.icon}" aria-hidden="true"></i>${channel.label}</span>`,
			`<span>${htmlSafe(personFor(ticket).name)}${account ? `, ${htmlSafe(account.name)}` : ''}</span>`,
			`<span>Opened ${htmlSafe(stampLong(ticket.created))}</span>`,
			`<span class="hd-prio-label hd-prio-label-${ticket.priority}">${PRIORITY_LABEL[ticket.priority]}</span>`,
			escalation,
		];
		return `<h2 class="hd-thead-title" id="hd-ticket-title">${htmlSafe(ticket.subject)}</h2><p class="hd-thead-meta">${facts.join('')}</p>`;
	}

	const STOPPED_CLOCK = {
		met: (ticket) =>
			`<p class="hd-sla-line hd-sla-line-met"><i class="bi bi-check2-circle" aria-hidden="true"></i><span>Solved inside the SLA · ${htmlSafe(stampLong(ticket.solvedAt))}</span></p>`,
		missed: (ticket) =>
			`<p class="hd-sla-line hd-sla-line-missed"><i class="bi bi-x-circle" aria-hidden="true"></i><span>Solved, but a reply came after the SLA · ${htmlSafe(stampLong(ticket.solvedAt))}</span></p>`,
		paused: (ticket, sla) =>
			`<p class="hd-sla-line hd-sla-line-paused"><i class="bi bi-pause-circle" aria-hidden="true"></i><span>SLA paused: ${htmlSafe(sla.why.toLowerCase())}. It starts again when the ticket is set back to Open.</span></p>`,
		answered: (ticket) =>
			`<p class="hd-sla-line"><i class="bi bi-reply" aria-hidden="true"></i><span>Replied. The SLA starts again when ${htmlSafe(givenName(personFor(ticket).name))} writes back.</span></p>`,
	};

	/* The clock is one quiet line: what is due or late, then its target; a running clock adds a short bar. */
	function slaPanelHtml(ticket) {
		const sla = slaFor(ticket);
		if (STOPPED_CLOCK[sla.state]) return STOPPED_CLOCK[sla.state](ticket, sla);
		const used = Math.max(0, Math.min(100, (1 - sla.left / sla.target) * 100));
		const late = sla.state === 'late';
		const headline = late
			? `${sla.kind} is ${timeSpan(-sla.left)} late`
			: `${sla.kind} due in ${timeSpan(sla.left)}`;
		const detail = `${timeSpan(sla.target)} target, due ${clockTime(sla.due)}`;
		/* Late needs no bar: the words say it. While time is left, a short bar shows how much is used. */
		const bar = late
			? ''
			: `<span role="progressbar" aria-label="SLA time used" aria-valuenow="${Math.round(used)}" aria-valuemin="0" aria-valuemax="100" class="hd-sla-bar"><span data-w="${used.toFixed(1)}"></span></span>`;
		return `<p class="hd-sla-line hd-sla-row-${sla.state}"><i class="bi ${late ? 'bi-alarm' : 'bi-clock'}" aria-hidden="true"></i><strong>${htmlSafe(headline)}</strong><span class="hd-sla-due">${htmlSafe(detail)}</span>${bar}</p>`;
	}

	/* Anything not matched here gets the PDF icon. */
	const FILE_ICONS = [
		[/\.png|\.jpg/, 'bi-file-earmark-image'],
		[/\.csv/, 'bi-file-earmark-spreadsheet'],
	];

	function messageHtml(ticket, message, index) {
		const person = personFor(ticket);
		if (message.t === 'event') {
			return `<li class="hd-event"><i class="bi ${htmlSafe(message.icon || 'bi-info-circle')}" aria-hidden="true"></i><span>${htmlSafe(message.text)}</span><time datetime="${message.at.toISOString()}">${htmlSafe(stampLong(message.at))}</time></li>`;
		}
		const fromCustomer = message.t === 'customer';
		const author = fromCustomer ? person.name : agentLabel(message.by);
		let role = message.t === 'note' ? 'Internal note' : 'Reply';
		if (fromCustomer)
			role = ticket.channel === 'phone' && /^Call notes/.test(message.text) ? 'Phone call' : 'Customer';

		const attachments = (message.files || [])
			.map((file) => {
				const icon = FILE_ICONS.find(([pattern]) => pattern.test(file))?.[1] || 'bi-file-earmark-pdf';
				return `<li><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(file)}</li>`;
			})
			.join('');

		const itemClass = classNames(`hd-msg hd-msg-${message.t}`, {
			'is-pending': message.pending,
			'is-fresh': message.fresh,
		});
		const lock = message.t === 'note' ? '<i class="bi bi-lock-fill" aria-hidden="true"></i>' : '';
		const when = message.pending ? 'Sending…' : htmlSafe(stampLong(message.at));
		const head = `<div class="hd-msg-head"><span class="hd-msg-who">${htmlSafe(author)}</span><span class="hd-msg-role">${lock}${htmlSafe(role)}</span><time class="hd-msg-time" datetime="${message.at.toISOString()}">${when}</time></div>`;
		const files = attachments ? `<ul class="hd-msg-files" aria-label="Attachments">${attachments}</ul>` : '';
		return `<li class="${itemClass}" data-msg="${index}">${avatarHtml(author, 'basalt-avatar-sm')}<div class="hd-msg-body">${head}<div class="hd-msg-text">${paragraphs(message.text)}</div>${files}</div></li>`;
	}

	function ratingHtml(ticket) {
		const survey = ticket.csat;
		if (ticket.status !== 'solved' || !survey) return '';
		const name = htmlSafe(personFor(ticket).name);
		let icon = 'bi-hourglass';
		let body = `<p class="hd-csat-title">Waiting for a rating</p><p class="hd-csat-text">Satisfaction survey sent to ${name} ${htmlSafe(stampInline(survey.sentAt))}.</p>`;
		if (survey.score) {
			const good = survey.score === 'good';
			icon = good ? 'bi-hand-thumbs-up' : 'bi-hand-thumbs-down';
			const remark = survey.comment
				? `<p class="hd-csat-text">“${htmlSafe(survey.comment)}”</p>`
				: '<p class="hd-csat-text">No comment left.</p>';
			body = `<p class="hd-csat-title">${name} rated this ${good ? 'Good' : 'Bad'}</p>${remark}`;
		}
		return `<li class="hd-csat hd-csat-${survey.score || 'waiting'}"><span class="hd-csat-icon" aria-hidden="true"><i class="bi ${icon}"></i></span><div>${body}</div></li>`;
	}

	function statusMenuHtml(ticket) {
		const current = STATUS_INFO[ticket.status];
		const options = Object.entries(STATUS_INFO)
			.map(([key, info]) => {
				const chosen = key === ticket.status;
				return `<li><button type="button" class="dropdown-item${chosen ? ' active' : ''}"${chosen ? ' aria-current="true"' : ''} data-status="${info.tone || 'none'}" data-hd-st="${key}"><span class="basalt-status-menu-dot${info.tone ? ` basalt-status-${info.tone}` : ''}"></span>${info.label}<i class="bi bi-check2 basalt-status-menu-check" aria-hidden="true"></i></button></li>`;
			})
			.join('');
		const toggle = `<button type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="${htmlSafe(ticket.id)} status: ${current.label}. Change status" class="basalt-status basalt-status-dot${current.tone ? ` basalt-status-${current.tone}` : ''}"><span data-basalt-status-label>${current.label}</span><i class="bi bi-chevron-down basalt-status-menu-caret" aria-hidden="true"></i></button>`;
		return `<div class="dropdown basalt-status-menu hd-status" data-basalt-status-menu data-hd-status-host>${toggle}<ul class="dropdown-menu dropdown-menu-end">${options}</ul></div>`;
	}

	/**
	 * Staff with presence and open-ticket counts, for the owner menu and bulk
	 * assign; `scope` names the data-hd-* attribute the clicks look for.
	 */
	function agentMenuHtml(activeId, scope) {
		const people = fixture.agents
			.map((agent) => {
				const chosen = agent.id === activeId;
				const holding = queue.filter(
					(ticket) => ticket.status !== 'solved' && ticket.assignee === agent.id,
				).length;
				const dot = agent.presence !== 'offline' ? ` basalt-avatar-status-dot-${agent.presence}` : '';
				const presence = agent.presence.charAt(0).toUpperCase() + agent.presence.slice(1);
				return `<li><button type="button" class="dropdown-item hd-agent${chosen ? ' active' : ''}"${chosen ? ' aria-current="true"' : ''} data-hd-${scope}="${agent.id}"><span class="basalt-avatar-status">${avatarHtml(agent.name, 'basalt-avatar-xs')}<span class="basalt-avatar-status-dot${dot}"></span></span><span class="hd-agent-name">${htmlSafe(agent.name)}${agent.id === fixture.me ? ' (you)' : ''}<span class="hd-agent-sub">${htmlSafe(agent.title)} · ${presence}</span></span><span class="hd-agent-n" title="Open tickets">${holding}<span class="visually-hidden"> open tickets</span></span></button></li>`;
			})
			.join('');
		const nobodyChosen = !activeId && scope === 'assign';
		return `${people}<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item${nobodyChosen ? ' active' : ''}" data-hd-${scope}=""><i class="bi bi-person-dash" aria-hidden="true"></i>Unassigned</button></li>`;
	}

	function paintComposer() {
		const ticket = ticketById(ui.currentId);
		if (!ticket) return;
		const isNote = ui.composeMode === 'note';
		dom.composer.classList.toggle('is-note', isNote);
		pick(`#hd-mode-${ui.composeMode}`).checked = true;
		dom.draft.placeholder = isNote ? 'Write a note for the team…' : 'Write a reply…';
		dom.draftLabel.textContent = isNote ? 'Internal note, only the team sees it' : 'Reply to the customer';
		if (isNote) {
			dom.recipient.innerHTML = '<i class="bi bi-lock" aria-hidden="true"></i>Only the team sees notes';
		} else {
			const replyChannel = CHANNEL_INFO[ticket.channel === 'phone' ? 'email' : ticket.channel];
			dom.recipient.innerHTML = `<i class="bi ${replyChannel.icon}" aria-hidden="true"></i>To ${htmlSafe(personFor(ticket).name)}${ticket.channel === 'chat' ? ' in chat' : ' by email'}`;
		}
		dom.afterSend.hidden = isNote;
		/* A send in flight owns the button's label. */
		if (!/\bis-(loading|success|error)\b/.test(dom.sendButton.className)) {
			pick('.btn-loading-label', dom.sendButton).textContent = isNote ? 'Add note' : 'Send reply';
			pick('.btn-loading-icon', dom.sendButton).innerHTML =
				`<i class="bi ${isNote ? 'bi-lock' : 'bi-send'}"></i>`;
			window.Basalt.buttonState?.forget?.(dom.sendButton);
		}
		paintMacroNote();
	}

	function paintMacroNote() {
		const macro = ui.pendingMacro;
		if (!macro) {
			dom.macroNote.hidden = true;
			dom.macroNote.innerHTML = '';
			return;
		}
		const effects = [
			macro.status && `set to ${STATUS_INFO[macro.status].label}`,
			macro.assignee && `assign to ${agentLabel(macro.assignee)}`,
			macro.tags && macro.tags.length && `tag ${macro.tags.join(', ')}`,
		].filter(Boolean);
		dom.macroNote.hidden = false;
		dom.macroNote.innerHTML = `<i class="bi bi-lightning-charge" aria-hidden="true"></i><span><strong>${htmlSafe(macro.title)}</strong>${effects.length ? `: on send, ${htmlSafe(effects.join(', '))}` : ''}</span><button type="button" class="btn btn-sm btn-link" data-hd-macro-drop>Remove</button>`;
	}

	function paintCustomer(ticket) {
		const account = accountOf(ticket);
		const person = personFor(ticket);
		dom.props.hidden = false;
		dom.prioritySelect.value = ticket.priority;
		refreshSelect(dom.prioritySelect);
		syncTags(ticket.tags);

		if (!account) {
			dom.sideBody.innerHTML = strangerHtml(person);
			drawAvatars(dom.sideBody);
			return;
		}
		dom.sideBody.innerHTML = `${
			accountHeadHtml(account) + factsHtml(account)
		}<a class="btn btn-sm btn-outline-secondary w-100 mb-3" href="company-details.html?id=${encodeURIComponent(account.id)}"><i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>Open the account</a>${contactCardHtml(
			person,
			account,
		)}${recentTicketsHtml(account, ticket)}`;
		applyBarWidths(dom.sideBody);
		drawAvatars(dom.sideBody);
		window.Basalt.buttons?.(dom.sideBody);
		window.Basalt.tips?.(dom.sideBody);
	}

	function strangerHtml(person) {
		return `<div class="hd-co">${avatarHtml(person.name, 'basalt-avatar-lg', 'basalt-avatar-rounded')}<div><h3 class="hd-co-name">${htmlSafe(person.name)}</h3><p class="hd-co-sub">Not a Fieldline customer</p></div></div><div class="hd-card"><p class="hd-card-line">${htmlSafe(person.email)}</p><p class="hd-card-muted">No account matches this address. If it is junk, delete it as spam and the sender is blocked.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-hd-act="spam"><i class="bi bi-shield-x me-1" aria-hidden="true"></i>Delete as spam</button></div>`;
	}

	function accountHeadHtml(account) {
		return `<div class="hd-co">${avatarHtml(account.name, 'basalt-avatar-lg', 'basalt-avatar-rounded')}<div><h3 class="hd-co-name">${htmlSafe(account.name)}</h3><p class="hd-co-sub">${htmlSafe(account.city)} · ${htmlSafe(account.region)}</p></div></div>`;
	}

	/* Health of 75 or more is good, 55 or more needs watching. */
	function factsHtml(account) {
		let tone = 'risk';
		if (account.health >= 75) tone = 'good';
		else if (account.health >= 55) tone = 'watch';
		const healthWord = { good: 'Healthy', watch: 'Keep an eye on', risk: 'At risk' }[tone];
		const addons = account.addons.length
			? `<div class="hd-facts-wide"><dt>Add-ons</dt><dd class="hd-addons">${account.addons.map((name) => `<span class="hd-addon">${htmlSafe(name)}</span>`).join('')}</dd></div>`
			: '';
		return (
			'<dl class="hd-facts">' +
			`<div><dt>Plan</dt><dd><span class="hd-plan hd-plan-${account.plan.toLowerCase()}">${htmlSafe(account.plan)}</span> ${account.seats} seats</dd></div>` +
			`<div><dt>MRR</dt><dd class="hd-facts-num">${dollars(account.mrr)}<span class="hd-facts-note">${account.billing === 'annual' ? 'billed yearly' : 'billed monthly'}</span></dd></div>` +
			`<div class="hd-facts-wide"><dt>Health</dt><dd><span class="hd-health hd-health-${tone}"><span class="hd-health-score">${account.health}</span>${healthWord}</span><span class="hd-health-bar" role="img" aria-label="Health score ${account.health} out of 100"><span data-w="${account.health}"></span></span><span class="hd-facts-note">${htmlSafe(account.healthNote)}</span></dd></div>` +
			`<div><dt>Customer since</dt><dd>${htmlSafe(account.since)}</dd></div>` +
			`<div><dt>Account manager</dt><dd>${account.csm ? htmlSafe(account.csm) : 'Self-serve'}</dd></div>` +
			`${addons}</dl>`
		);
	}

	function contactCardHtml(person, account) {
		let localTime;
		try {
			localTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: account.tz })
				.format(clock())
				.toLowerCase()
				.replace(' ', '');
		} catch {
			localTime = '';
		}
		const email = person.email
			? `<p class="hd-card-line hd-card-copy"><i class="bi bi-envelope" aria-hidden="true"></i><span class="text-truncate">${htmlSafe(person.email)}</span><button type="button" class="btn btn-icon btn-sm" data-basalt-copy="${htmlSafe(person.email)}" aria-label="Copy email address" data-bs-toggle="tooltip" data-bs-title="Copy email" data-basalt-copy-done="Copied"><i class="bi bi-copy" aria-hidden="true"></i></button></p>`
			: '<p class="hd-card-muted">No email or phone on file for this contact yet.</p>';
		const phone = person.phone
			? `<p class="hd-card-line"><i class="bi bi-telephone" aria-hidden="true"></i>${htmlSafe(person.phone)}</p>`
			: '';
		const role = `${htmlSafe(person.role || '')}${localTime ? ` · ${htmlSafe(localTime)} there` : ''}`;
		return `<h3 class="hd-side-title">Contact</h3><div class="hd-card"><div class="hd-person">${avatarHtml(person.name, 'basalt-avatar-sm')}<div><p class="hd-person-name">${htmlSafe(person.name)}</p><p class="hd-person-sub">${role}</p></div></div>${email}${phone}</div>`;
	}

	/* Up to four earlier tickets; only live ones are buttons. */
	function recentTicketsHtml(account, ticket) {
		const live = queue
			.filter((other) => other.customer === account.id && other.id !== ticket.id)
			.sort((a, b) => b.created - a.created)
			.map((other) => ({
				id: other.id,
				subject: other.subject,
				status: other.status,
				when: stampShort(other.created),
				live: true,
			}));
		const archived = desk.history
			.filter(([accountId]) => accountId === account.id)
			.map(([, id, subject, status, agoDays]) => ({ id, subject, status, when: `${agoDays}d ago`, live: false }));
		const recent = [...live, ...archived].slice(0, 4);
		if (!recent.length)
			return '<h3 class="hd-side-title">Recent tickets</h3><p class="hd-card-muted">This is their first ticket.</p>';
		const items = recent
			.map((entry) => {
				const inner = `<span class="hd-recent-subject">${htmlSafe(entry.subject)}</span><span class="hd-recent-meta">${htmlSafe(entry.id)} · ${htmlSafe(STATUS_INFO[entry.status].label)} · ${htmlSafe(entry.when)}</span>`;
				return entry.live
					? `<li><button type="button" class="hd-recent-item" data-hd-open="${htmlSafe(entry.id)}">${inner}</button></li>`
					: `<li><div class="hd-recent-item">${inner}</div></li>`;
			})
			.join('');
		return `<h3 class="hd-side-title">Recent tickets</h3><ul class="hd-recent">${items}</ul>`;
	}

	/* Filling the tag input this way is not an edit. */
	function syncTags(tags) {
		if (!dom.tagBox.basaltTags) return;
		tagsSyncing = true;
		dom.tagBox.basaltTags.set(tags.slice());
		tagsSyncing = false;
	}

	/**
	 * Keeps the draft of the ticket being left and restores the new one's.
	 * `focus: 'reply'` lands in the composer, `false` leaves focus alone, and
	 * `quiet` leaves the address bar alone.
	 */
	function showTicket(id, options = {}) {
		const ticket = ticketById(id);
		if (!ticket) return;
		if (ui.currentId !== id) {
			keepDraft();
			const kept = ui.unsent.get(id);
			dom.draft.value = kept ? kept.text : '';
			ui.composeMode = kept ? kept.mode : 'reply';
			ui.pendingMacro = kept ? kept.macro : null;
		}
		ui.currentId = id;
		ui.focusId = id;
		if (ticket.unread) {
			ticket.unread = false;
			api.markRead(id, true).catch(() => {});
		}
		if (!options.quiet) {
			try {
				history.replaceState(null, '', `#${id}`);
			} catch {
				/* file:// pages cannot rewrite the address. */
			}
		}
		const index = ui.visibleIds.indexOf(id);
		if (index >= 0) ui.pageNo = Math.floor(index / PAGE_SIZE) + 1;
		paintList();
		paintTicket();
		showPane('ticket');
		if (options.focus === 'reply') focusWriting('reply');
		else if (options.focus !== false && isNarrow()) pick('[data-hd-back]').focus();
	}

	function keepDraft() {
		if (ui.currentId)
			ui.unsent.set(ui.currentId, { text: dom.draft.value, mode: ui.composeMode, macro: ui.pendingMacro });
	}

	/* Narrow screens show one pane: "list" or "ticket". */
	function showPane(name) {
		dom.app.dataset.view = name;
	}

	function returnToQueue() {
		showPane('list');
		paintList();
		focusRow();
	}

	/** J and K; on a phone's list they only move the row focus. */
	function stepBy(offset) {
		const ids = ui.visibleIds;
		if (!ids.length) return;
		const onPhoneList = browsingListOnPhone();
		const from = ids.indexOf(ui.currentId != null && !onPhoneList ? ui.currentId : ui.focusId);
		const target = ids[Math.max(0, Math.min(ids.length - 1, from + offset))] || ids[0];
		if (browsingListOnPhone()) {
			ui.pageNo = Math.floor(ids.indexOf(target) / PAGE_SIZE) + 1;
			ui.focusId = target;
			paintList();
			focusRow();
			return;
		}
		showTicket(target, { focus: false });
		pick(`.hd-row[data-id="${target}"]`, dom.rows)?.scrollIntoView({ block: 'nearest' });
	}

	function isNarrow() {
		return window.matchMedia('(max-width: 991.98px)').matches;
	}

	function browsingListOnPhone() {
		return isNarrow() && dom.app.dataset.view === 'list';
	}

	function toggleChecked(id, force) {
		const checking = force == null ? !ui.checked.has(id) : force;
		if (checking) ui.checked.add(id);
		else ui.checked.delete(id);
		paintList();
		say(checking ? `Selected ${id}. ${tally(ui.checked.size, 'ticket')} selected.` : `Deselected ${id}.`);
	}

	function focusWriting(mode) {
		if (!ticketById(ui.currentId) || dom.composer.hidden) return;
		if (mode && mode !== ui.composeMode) {
			ui.composeMode = mode;
			paintComposer();
		}
		dom.draft.focus();
	}

	function closeSidePanel() {
		const sheet = bootstrap.Offcanvas.getInstance(dom.sidePanel);
		if (sheet && dom.sidePanel.classList.contains('show')) sheet.hide();
	}

	/* Changes show at once and are sent after; a failed send restores the
     saved copy and says so. */
	function rollbackWith(action, undo) {
		return () => {
			if (undo) undo();
			paintEverything({ keepScroll: true });
			notify({
				tone: 'danger',
				title: `Could not ${action}`,
				text: 'Nothing was changed. Check your connection and try again.',
			});
		};
	}

	function logEvent(ticket, icon, text) {
		ticket.messages.push({ t: 'event', icon, text, at: clock(), fresh: true });
	}

	function capture(ids) {
		return ids.map((id) => {
			const ticket = ticketById(id);
			return {
				id,
				status: ticket.status,
				assignee: ticket.assignee,
				priority: ticket.priority,
				solvedAt: ticket.solvedAt,
				slaMet: ticket.slaMet,
				csat: ticket.csat,
				messageCount: ticket.messages.length,
			};
		});
	}

	function rewind(saved) {
		for (const copy of saved) {
			const ticket = ticketById(copy.id);
			if (!ticket) continue;
			Object.assign(ticket, {
				status: copy.status,
				assignee: copy.assignee,
				priority: copy.priority,
				solvedAt: copy.solvedAt,
				slaMet: copy.slaMet,
				csat: copy.csat,
			});
			ticket.messages.length = copy.messageCount;
		}
	}

	/**
	 * Status, owner and priority changes share this path. Tickets already in the
	 * wanted state drop out; returns null when none are left.
	 */
	function changeMany(ids, { differs, apply, send, failure }, options = {}) {
		const targets = ids.filter((id) => ticketById(id) && differs(ticketById(id)));
		if (!targets.length) return null;
		const saved = capture(targets);
		for (const id of targets) apply(ticketById(id));
		const label = targets.length === 1 ? targets[0] : tally(targets.length, 'ticket');
		send(targets).catch(rollbackWith(failure(label), () => rewind(saved)));
		if (options.clearSelection) ui.checked.clear();
		paintEverything({ toEnd: true });
		return { targets, saved, label };
	}

	function updateStatus(ids, status, options = {}) {
		const change = changeMany(
			ids,
			{
				differs: (ticket) => ticket.status !== status,
				apply: (ticket) => moveToStatus(ticket, status),
				send: (targets) => api.setStatus(targets, status),
				failure: (label) => `change the status of ${label}`,
			},
			options,
		);
		if (!change || options.quiet) return;
		const { targets, saved, label } = change;
		const solving = status === 'solved';
		notify({
			tone: solving ? 'success' : 'primary',
			icon: solving ? 'bi-check2-circle' : 'bi-arrow-repeat',
			title: solving ? `Solved ${label}` : `${label} set to ${STATUS_INFO[status].label}`,
			text: solving ? 'The customer gets a short satisfaction survey.' : '',
			actions: [
				{
					label: 'Undo',
					onClick() {
						rewind(saved);
						api.setStatus(targets, saved[0].status);
						paintEverything({ keepScroll: true });
						say('Status put back');
					},
				},
			],
		});
	}

	function handOver(ids, agentId, options = {}) {
		const owner = agentId || null;
		const change = changeMany(
			ids,
			{
				differs: (ticket) => ticket.assignee !== owner,
				apply: (ticket) => {
					ticket.assignee = owner;
					const whom = agentId === fixture.me ? 'himself' : agentLabel(agentId);
					logEvent(
						ticket,
						'bi-person-check',
						agentId
							? `John Armstrong assigned the ticket to ${whom}`
							: 'John Armstrong unassigned the ticket',
					);
				},
				send: (targets) => api.assign(targets, owner),
				failure: (label) => `assign ${label}`,
			},
			options,
		);
		if (!change) return;
		const { targets, saved, label } = change;
		notify({
			tone: 'primary',
			icon: 'bi-person-check',
			title: agentId
				? `${label} assigned to ${agentId === fixture.me ? 'you' : agentLabel(agentId)}`
				: `${label} unassigned`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						rewind(saved);
						api.assign(targets, saved[0].assignee);
						paintEverything({ keepScroll: true });
						say('Assignment put back');
					},
				},
			],
		});
	}

	/* A single change from the panel is announced; bulk ones get a toast. */
	function changePriority(ids, priority, options = {}) {
		const change = changeMany(
			ids,
			{
				differs: (ticket) => ticket.priority !== priority,
				apply: (ticket) => {
					ticket.priority = priority;
					logEvent(ticket, 'bi-flag', `John Armstrong changed the priority to ${PRIORITY_LABEL[priority]}`);
				},
				send: (targets) => api.setPriority(targets, priority),
				failure: (label) => `change the priority of ${label}`,
			},
			options,
		);
		if (!change) return;
		const { targets, saved, label } = change;
		if (targets.length > 1 || options.toast) {
			notify({
				tone: 'primary',
				icon: 'bi-flag',
				title: `${label} set to ${PRIORITY_LABEL[priority]}`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							rewind(saved);
							api.setPriority(targets, saved[0].priority);
							paintEverything({ keepScroll: true });
						},
					},
				],
			});
			return;
		}
		const due = slaFor(ticketById(targets[0])).due;
		say(
			`${label} priority is now ${PRIORITY_LABEL[priority]}. ${due ? `SLA due ${clockTime(slaFor(ticketById(targets[0])).due)}.` : ''}`,
		);
	}

	function moveToStatus(ticket, status) {
		if (ticket.status === status) return;
		if (status === 'solved') {
			ticket.slaMet = slaFor(ticket).state !== 'late';
			ticket.solvedAt = clock();
			ticket.csat = { sentAt: clock(), score: null };
			logEvent(
				ticket,
				'bi-check2-circle',
				`John Armstrong solved the ticket. Satisfaction survey sent to ${personFor(ticket).name}`,
			);
			expectRating(ticket.id);
		} else {
			logEvent(ticket, 'bi-arrow-repeat', `John Armstrong set the status to ${STATUS_INFO[status].label}`);
			if (ticket.status === 'solved') {
				ticket.solvedAt = null;
				ticket.csat = null;
			}
		}
		ticket.status = status;
	}

	function fillPlaceholders(text, ticket) {
		const account = accountOf(ticket);
		const values = {
			first: givenName(personFor(ticket).name),
			me: 'John',
			plan: account ? account.plan : 'your plan',
			seat: account ? `$${fixture.prices[account.plan]}` : 'the seat price',
			customer: account ? account.name : personFor(ticket).name,
		};
		return Object.entries(values).reduce(
			(result, [token, value]) => result.replace(new RegExp(`\\{${token}\\}`, 'g'), value),
			text,
		);
	}

	/* Saved replies append; macros replace the text and act on send. */
	function insertMacro(id) {
		const macro = fixture.macros.find((entry) => entry.id === id);
		const ticket = ticketById(ui.currentId);
		if (!macro || !ticket) return;
		ui.composeMode = macro.note ? 'note' : 'reply';
		ui.pendingMacro = macro.kind === 'macro' ? macro : null;
		const body = fillPlaceholders(macro.body, ticket);
		const written = dom.draft.value.trim();
		dom.draft.value = written && macro.kind === 'reply' ? `${written}\n\n${body}` : body;
		paintComposer();
		dom.draft.focus();
		dom.draft.setSelectionRange(dom.draft.value.length, dom.draft.value.length);
		say(
			`${macro.kind === 'macro' ? 'Macro' : 'Reply'} ${macro.title} added to the ${ui.composeMode === 'note' ? 'note' : 'reply'}`,
		);
	}

	/**
	 * The message shows as "Sending…" with any status change at once; on
	 * failure the text goes back in the box and the ticket is restored.
	 */
	function submitMessage() {
		const ticket = ticketById(ui.currentId);
		if (!ticket || dom.sendButton.classList.contains('is-loading')) return;
		const text = dom.draft.value.trim();
		const isNote = ui.composeMode === 'note';
		if (!text) {
			dom.draft.focus();
			notify({
				tone: 'warning',
				title: isNote ? 'The note is empty' : 'The reply is empty',
				text: 'Write something first, or pick a reply from Macros.',
				duration: 3500,
			});
			return;
		}
		const macro = ui.pendingMacro;
		const message = { t: isNote ? 'note' : 'reply', by: fixture.me, text, at: clock(), pending: true, fresh: true };
		const saved = capture([ticket.id]);
		const tagsBefore = ticket.tags.slice();
		ticket.messages.push(message);
		ticket.unread = false;

		const nextStatus = statusAfterSend(macro, isNote ? null : dom.afterSend.value);
		if (macro && macro.assignee) ticket.assignee = macro.assignee;
		for (const tag of (macro && macro.tags) || []) {
			if (!ticket.tags.includes(tag)) ticket.tags.push(tag);
		}
		if (!isNote && !ticket.assignee) ticket.assignee = fixture.me;
		if (nextStatus) moveToStatus(ticket, nextStatus);

		dom.draft.value = '';
		ui.pendingMacro = null;
		ui.unsent.delete(ticket.id);
		dom.afterSend.value = 'keep';
		refreshSelect(dom.afterSend);
		window.Basalt.buttonState(dom.sendButton, 'loading', isNote ? 'Saving' : 'Sending');
		paintEverything({ toEnd: true });

		const request = isNote ? api.addNote(ticket.id, message) : api.sendReply(ticket.id, message);
		request
			.then(() => {
				message.pending = false;
				flashSendButton('success', isNote ? 'Added' : 'Sent', 1200);
				if (ui.currentId === ticket.id) {
					const stamp = pick('.hd-msg.is-pending .hd-msg-time', dom.thread);
					if (stamp) {
						stamp.textContent = stampLong(message.at);
						stamp.closest('.hd-msg').classList.remove('is-pending');
					}
				}
				paintList();
				say(
					isNote
						? `Note added to ${ticket.id}`
						: `Reply sent to ${personFor(ticket).name}${nextStatus ? `. Ticket set to ${STATUS_INFO[nextStatus].label}` : ''}`,
				);
				if (nextStatus !== 'solved') return;
				notify({
					tone: 'success',
					icon: 'bi-check2-circle',
					title: `Sent and solved ${ticket.id}`,
					text: 'The customer gets a short satisfaction survey.',
					actions: [
						{
							label: 'Reopen',
							onClick() {
								updateStatus([ticket.id], 'open', { quiet: true });
								say(`${ticket.id} is open again`);
							},
						},
					],
				});
			})
			.catch(() => {
				rewind(saved);
				ticket.tags = tagsBefore;
				dom.draft.value = text;
				ui.pendingMacro = macro;
				flashSendButton('error', 'Not sent', 1600);
				paintEverything({ toEnd: true });
				notify({
					tone: 'danger',
					title: isNote ? 'The note was not saved' : 'The reply was not sent',
					text: 'Your text is back in the box. Check your connection and send it again.',
				});
			});
	}

	function statusAfterSend(macro, menuChoice) {
		if (macro && macro.status) return macro.status;
		return menuChoice && menuChoice !== 'keep' ? menuChoice : null;
	}

	function flashSendButton(state, label, holdFor) {
		window.Basalt.buttonState(dom.sendButton, state, label);
		setTimeout(() => {
			window.Basalt.buttonState(dom.sendButton, 'idle');
			paintComposer();
		}, holdFor);
	}

	/* Demo only: a rating arrives nine seconds after solving. Real ones come from the survey webhook. */
	function expectRating(id) {
		setTimeout(() => {
			const ticket = ticketById(id);
			if (!ticket || ticket.status !== 'solved' || !ticket.csat || ticket.csat.score) return;
			const verdict = SAMPLE_RATINGS[ratingIndex++ % SAMPLE_RATINGS.length];
			const good = verdict.score === 'good';
			ticket.csat = { ...ticket.csat, ...verdict, ratedAt: clock() };
			desk.metrics.csat[good ? 'good' : 'bad'] += 1;
			paintMetrics();
			if (ui.currentId === id) paintTicket({ keepScroll: true });
			const headline = `${personFor(ticket).name} rated ${id} ${good ? 'Good' : 'Bad'}`;
			say(headline);
			notify({
				tone: good ? 'success' : 'warning',
				icon: good ? 'bi-hand-thumbs-up' : 'bi-hand-thumbs-down',
				title: headline,
				text: verdict.comment ? `“${verdict.comment}”` : '',
				actions:
					ui.currentId === id
						? []
						: [
								{
									label: 'Open',
									onClick() {
										showTicket(id);
									},
								},
							],
			});
		}, 9000);
	}

	function openEscalation() {
		const ticket = ticketById(ui.currentId);
		if (!ticket) return;
		const account = accountOf(ticket);
		pick('[data-hd-esc-sub]').textContent = `${ticket.id} · ${account ? account.name : personFor(ticket).name}`;
		const choices = fixture.teams.map(
			(group, index) =>
				`<label class="basalt-choice"><input type="radio" name="hd-esc-team" value="${group.id}"${index === 0 ? ' checked' : ''}><i class="bi ${group.icon}" aria-hidden="true"></i>${htmlSafe(group.name)}<span class="basalt-choice-hint">${htmlSafe(group.hint)}</span></label>`,
		);
		pick('[data-hd-esc-teams]').innerHTML = `<legend class="form-label">Hand it to</legend>${choices.join('')}`;
		dialogs.escalateForm.classList.remove('was-validated');
		pick('[data-hd-esc-why]').value = '';
		const urgent = pick('[data-hd-esc-urgent]');
		urgent.checked = false;
		urgent.disabled = ticket.priority === 'urgent';
		pick('[data-hd-esc-hold]').checked = true;
		describeTeamOwner();
		showModal(dialogs.escalate);
	}

	function chosenTeam() {
		const value = pick('input[name="hd-esc-team"]:checked', dialogs.escalateForm)?.value;
		return fixture.teams.find((group) => group.id === value) || fixture.teams[0];
	}

	/* Success escalations go to the account's own manager. */
	function describeTeamOwner() {
		const group = chosenTeam();
		const account = accountOf(ticketById(ui.currentId));
		let line = `${group.who}.`;
		if (group.who === 'csm') {
			line =
				account && account.csm
					? `${account.csm} looks after ${account.name}.`
					: "No account manager on this account, so it goes to the Success team's queue.";
		}
		pick('[data-hd-esc-who]').textContent = line;
	}

	function submitEscalation(event) {
		event.preventDefault();
		const reasonField = pick('[data-hd-esc-why]');
		if (!reasonField.value.trim()) {
			dialogs.escalateForm.classList.add('was-validated');
			reasonField.focus();
			return;
		}
		const ticket = ticketById(ui.currentId);
		const group = chosenTeam();
		const saved = capture([ticket.id]);
		const before = { escalation: ticket.escalation, tags: ticket.tags.slice() };
		ticket.escalation = { team: group.name, ref: null };
		ticket.messages.push({
			t: 'note',
			by: fixture.me,
			text: `Escalated to ${group.name}: ${reasonField.value.trim()}`,
			at: clock(),
			fresh: true,
		});
		logEvent(ticket, 'bi-arrow-up-right-circle', `John Armstrong escalated to ${group.name}`);
		const tag = group.id === 'eng' ? 'engineering' : group.id;
		if (!ticket.tags.includes(tag)) ticket.tags.push(tag);
		if (pick('[data-hd-esc-urgent]').checked) ticket.priority = 'urgent';
		if (pick('[data-hd-esc-hold]').checked && ticket.status !== 'hold') ticket.status = 'hold';

		function undoEscalation() {
			rewind(saved);
			ticket.escalation = before.escalation;
			ticket.tags = before.tags;
		}

		api.escalate(ticket.id, { team: group.id, text: reasonField.value.trim() }).catch(
			rollbackWith(`escalate ${ticket.id}`, undoEscalation),
		);
		hideModal(dialogs.escalate);
		paintEverything({ toEnd: true });
		notify({
			tone: 'primary',
			icon: 'bi-arrow-up-right-circle',
			title: `${ticket.id} escalated to ${group.name}`,
			text: ticket.status === 'hold' ? 'On hold while they look. The SLA is paused.' : '',
			actions: [
				{
					label: 'Undo',
					onClick() {
						undoEscalation();
						paintEverything({ keepScroll: true });
						say('Escalation undone');
					},
				},
			],
		});
	}

	function confirmSpam() {
		const ticket = ticketById(ui.currentId);
		if (!ticket) return;
		const person = personFor(ticket);
		pick('[data-hd-spam-text]').textContent =
			`${ticket.id} from ${person.name}${person.email ? ` (${person.email})` : ''} is deleted and the sender is blocked. This cannot be undone.`;
		showModal(dialogs.spam);
	}

	/* After the hold completes, the neighbor opens, or the list on a phone. */
	function deleteAsSpam() {
		const ticket = ticketById(ui.currentId);
		if (!ticket) return;
		const position = queue.indexOf(ticket);
		const listIndex = ui.visibleIds.indexOf(ticket.id);
		queue.splice(position, 1);
		ui.checked.delete(ticket.id);
		hideModal(dialogs.spam);
		api.deleteSpam(ticket.id).catch(() => {
			queue.splice(position, 0, ticket);
			paintEverything();
			notify({
				tone: 'danger',
				title: `Could not delete ${ticket.id}`,
				text: 'It is back in the queue. Try again in a moment.',
			});
		});
		const othersLeft = ui.visibleIds.filter((id) => id !== ticket.id);
		const neighbor = othersLeft[Math.max(0, Math.min(listIndex, ui.visibleIds.length - 2))];
		ui.currentId = null;
		paintEverything();
		if (neighbor && !isNarrow()) showTicket(neighbor, { focus: false });
		else returnToQueue();
		notify({
			tone: 'success',
			icon: 'bi-shield-x',
			title: 'Deleted as spam',
			text: `${ticket.id} is gone and ${personFor(ticket).email || 'the sender'} is blocked.`,
		});
	}

	function findAccountByName(name) {
		return desk?.customers.find((account) => account.name === name.trim());
	}

	function openNewTicket() {
		if (ui.busy || ui.failure) return;
		dialogs.createForm.reset();
		dialogs.createForm.classList.remove('was-validated');
		pick('[data-hd-new-sla]').textContent = '';
		pick('[data-hd-new-assignee]').value = fixture.me;
		for (const selector of ['[data-hd-new-priority]', '[data-hd-new-assignee]']) refreshSelect(pick(selector));
		showModal(dialogs.create);
	}

	function previewNewSla() {
		const account = findAccountByName(dialogs.customerField.value);
		const level = pick('[data-hd-new-priority]').value;
		let preview = '';
		if (account) {
			const minutes = fixture.sla[account.plan][level];
			const due = new Date(clock().getTime() + minutes * MINUTE);
			preview = `${account.plan}, ${PRIORITY_LABEL[level].toLowerCase()}: first reply due by ${clockTime(due)} (${timeSpan(minutes)}).`;
		}
		pick('[data-hd-new-sla]').textContent = preview;
	}

	function submitNewTicket(event) {
		event.preventDefault();
		const form = dialogs.createForm;
		const account = desk.customers.find((entry) => entry.name === dialogs.customerField.value.trim());
		dialogs.customerField.setCustomValidity(account ? '' : 'Pick a customer');
		if (!form.checkValidity()) {
			form.classList.add('was-validated');
			pick(':invalid', form)?.focus();
			return;
		}
		const channel = pick('input[name="hd-new-channel"]:checked', form).value;
		const byPhone = channel === 'phone';
		const contactName = pick('[data-hd-new-who]').value.trim();
		const ticket = {
			id: `#${ticketSerial++}`,
			customer: account.id,
			subject: pick('[data-hd-new-subject]').value.trim(),
			channel,
			priority: pick('[data-hd-new-priority]').value,
			status: 'open',
			assignee: pick('[data-hd-new-assignee]').value || null,
			tags: [],
			fresh: true,
			created: clock(),
			messages: [
				{
					t: 'event',
					icon: byPhone ? 'bi-telephone' : 'bi-plus-lg',
					text: `John Armstrong created the ticket${byPhone ? ' from a phone call' : ''}`,
					at: clock(),
				},
				{
					t: 'customer',
					text: `${byPhone ? 'Call notes: ' : ''}${pick('[data-hd-new-body]').value.trim()}`,
					at: clock(),
				},
			],
		};
		/* A different contact keeps their name; nothing else is on file yet. */
		if (contactName !== account.contact.name)
			ticket.contact = { name: contactName, role: `Contact at ${account.name}`, email: '', phone: '' };

		function withdraw() {
			queue.splice(queue.indexOf(ticket), 1);
			if (ui.currentId === ticket.id) ui.currentId = null;
		}

		queue.unshift(ticket);
		api.createTicket(ticket).catch(rollbackWith('create the ticket', withdraw));
		hideModal(dialogs.create);
		switchView('open');
		showTicket(ticket.id, { focus: false });
		notify({
			tone: 'success',
			icon: 'bi-plus-lg',
			title: `${ticket.id} created`,
			text: ticket.subject,
			actions: [
				{
					label: 'Undo',
					onClick() {
						withdraw();
						paintEverything();
						say(`${ticket.id} removed`);
					},
				},
			],
		});
	}

	/* The demo has one customer write in after the delay the data file sets. */
	function planIncomingMessage() {
		const incoming = desk && desk.incoming;
		if (!incoming || scenario) return;
		let delivered = false;

		function deliver() {
			if (delivered) return;
			/* A hidden tab waits to be seen first. */
			if (document.hidden) {
				document.addEventListener('visibilitychange', deliver, { once: true });
				return;
			}
			delivered = true;
			const ticket = ticketById(incoming.ticket);
			if (!ticket || ticket.status === 'solved') return;
			const watching = ui.currentId === ticket.id;
			if (watching) {
				dom.typingName.textContent = `${personFor(ticket).name} is typing`;
				dom.typing.hidden = false;
			}
			setTimeout(() => arrive(ticket), watching ? 2600 : 0);
		}

		function arrive(ticket) {
			dom.typing.hidden = true;
			ticket.messages.push({ t: 'customer', text: incoming.text, at: clock(), fresh: true });
			ticket.unread = ui.currentId !== ticket.id || browsingListOnPhone();
			ticket.fresh = true;
			paintFigures();
			paintList();
			const isCurrent = ui.currentId === ticket.id;
			if (isCurrent) {
				const { scrollHeight, scrollTop, clientHeight } = dom.scroller;
				paintTicket(scrollHeight - scrollTop - clientHeight < 120 ? { toEnd: true } : { keepScroll: true });
			}
			const account = accountOf(ticket);
			const sender = personFor(ticket).name;
			say(`New message from ${sender}${account ? `, ${account.name}` : ''} on ${ticket.id}: ${incoming.text}`);
			if (ui.currentId === ticket.id) return;
			notify({
				tone: 'info',
				icon: 'bi-chat-dots',
				title: `New message on ${ticket.id}`,
				text: `${sender}: ${incoming.text}`,
				actions: [
					{
						label: 'Open',
						onClick() {
							showTicket(ticket.id, { focus: 'reply' });
						},
					},
				],
			});
		}

		setTimeout(deliver, incoming.after * 1000);
	}

	/* Every 30s the clocks catch up, leaving focus and the composer alone. */
	function refreshClocks() {
		if (ui.busy || ui.failure || document.hidden) return;
		paintFigures();
		paintList();
		const ticket = ticketById(ui.currentId);
		if (!ticket) return;
		dom.slaBox.innerHTML = slaPanelHtml(ticket);
		applyBarWidths(dom.slaBox);
	}

	function reflectTheme() {
		dom.themeToggle.setAttribute('aria-pressed', String(window.Basalt.getTheme() === 'dark'));
	}

	function pause(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}

	/* Under ?state=offline every save fails. */
	function persist(ms) {
		if (scenario !== 'offline') return pause(ms);
		return pause(ms).then(() => {
			throw new Error('offline');
		});
	}

	function ticketById(id) {
		return queue.find((ticket) => ticket.id === id) || null;
	}

	function accountOf(ticket) {
		return ticket && ticket.customer ? accounts.get(ticket.customer) : null;
	}

	function planFor(ticket) {
		const account = accountOf(ticket);
		return account ? account.plan : 'Basic';
	}

	/* The ticket's own contact, else the account's, else the raw sender. */
	function personFor(ticket) {
		if (ticket.contact) return ticket.contact;
		const account = accountOf(ticket);
		if (account) return account.contact;
		return ticket.from || { name: 'Unknown sender', email: '' };
	}

	function agentLabel(id) {
		return team.get(id)?.name || 'Someone';
	}

	function givenName(wholeName) {
		return String(wholeName || '').split(' ')[0];
	}

	function lastActivity(ticket) {
		return ticket.messages.at(-1)?.at || ticket.created;
	}

	/* The demo's fixed "now", moving with the real clock since load. */
	function clock() {
		return new Date(fixture.now.getTime() + (Date.now() - bootedAt));
	}

	function midnightOf(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	}

	/** Calendar days back from now: 0 today, 1 yesterday. */
	function calendarGap(date) {
		return Math.round((midnightOf(clock()) - midnightOf(date)) / 86400000);
	}

	function clockTime(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')}${hours < 12 ? 'am' : 'pm'}`;
	}

	function weekdayAndDate(date) {
		return `${WEEKDAYS[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/** "Today, 9:48am", "Yesterday, 3:10pm" or "Tue, Sep 29, 4:02pm". */
	function stampLong(date) {
		const day = { 0: 'Today', 1: 'Yesterday' }[calendarGap(date)] || weekdayAndDate(date);
		return `${day}, ${clockTime(date)}`;
	}

	/** "at 9:48am", "yesterday at 3:10pm" or "on Tue, Sep 29". */
	function stampInline(date) {
		const gap = calendarGap(date);
		if (gap === 0) return `at ${clockTime(date)}`;
		return gap === 1 ? `yesterday at ${clockTime(date)}` : `on ${weekdayAndDate(date)}`;
	}

	/** "now", "4m", "2h", "Yesterday" or "Sep 29". */
	function stampShort(date) {
		const minutes = Math.max(0, Math.round((clock() - date) / MINUTE));
		if (minutes < 1) return 'now';
		if (minutes < 60) return `${minutes}m`;
		const gap = calendarGap(date);
		if (gap === 0) return `${Math.floor(minutes / 60)}h`;
		return gap === 1 ? 'Yesterday' : `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/** 75 gives "1h 15m", 1500 gives "1d 1h". */
	function timeSpan(minutes) {
		const whole = Math.max(0, Math.round(minutes));
		if (whole < 60) return `${whole}m`;
		const [large, largeUnit, rest, restUnit] =
			whole < 1440
				? [Math.floor(whole / 60), 'h', whole % 60, 'm']
				: [Math.floor(whole / 1440), 'd', Math.floor((whole % 1440) / 60), 'h'];
		return rest ? `${large}${largeUnit} ${rest}${restUnit}` : `${large}${largeUnit}`;
	}

	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function paragraphs(text) {
		return htmlSafe(text)
			.split(/\n{2,}/)
			.map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
			.join('');
	}

	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	function tally(amount, word, pluralWord) {
		return `${amount} ${amount === 1 ? word : pluralWord || `${word}s`}`;
	}

	function classNames(base, flags) {
		return [base, ...Object.keys(flags).filter((name) => flags[name])].join(' ');
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function say(text) {
		window.Basalt.announce?.(text);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function drawAvatars(scope) {
		window.Basalt.avatars?.(scope);
	}

	function refreshSelect(select) {
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(select);
	}

	function showModal(element) {
		bootstrap.Modal.getOrCreateInstance(element).show();
	}

	function hideModal(element) {
		bootstrap.Modal.getOrCreateInstance(element).hide();
	}

	start();
})();
