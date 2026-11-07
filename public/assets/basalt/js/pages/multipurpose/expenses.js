/**
 * The claims desk on expenses.html. A manager works through the claims
 * staff have sent in, questions or turns down the doubtful ones, and
 * releases the approved total in the payout that leaves every Friday.
 * The board, the category bars, the payout card and both side drawers
 * are drawn here on top of the shared pills, avatars, pager and toasts.
 */
(() => {
	'use strict';

	/* Everything below reads from the shared expense ledger in
     assets/basalt/js/data/multipurpose/expenses.js, the same one the claim detail page uses.
     A real install would fetch it and take the date from the clock. */
	const ledger = window.Basalt.data.expenses;
	const todayIso = ledger.today;
	const payoutIso = ledger.nextPayout;
	const viewer = ledger.me;
	const viewerApprover = ledger.myApprover;
	const kinds = ledger.categories;
	const stages = ledger.statuses;
	const staff = ledger.people;
	const decider = ledger.approverOf;
	const ROWS_PER_PAGE = 8;
	const STAGE_KEYS = ['waiting', 'queried', 'approved', 'paid', 'all'];
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const NUMBER_WORDS = [
		'no',
		'one',
		'two',
		'three',
		'four',
		'five',
		'six',
		'seven',
		'eight',
		'nine',
		'ten',
		'eleven',
		'twelve',
		'thirteen',
		'fourteen',
		'fifteen',
		'sixteen',
		'seventeen',
		'eighteen',
		'nineteen',
		'twenty',
	];
	const CLOSE_BUTTON =
		'<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="offcanvas">Close</button>';

	/* How the table describes each stage, both in its caption and in the
     line that screen readers hear. */
	const ORDER_NOTES = {
		waiting: 'oldest first',
		queried: 'sent back with a question, newest first',
		approved: 'going out in Friday’s payout',
		paid: 'paid in the weekly payouts, newest first',
		all: 'from the last 30 days, newest first',
	};

	/* The page works on its own copy so undo can put a claim back exactly. */
	const ledgerRows = ledger.claims.map((claim) => ({ ...claim }));
	const view = {
		stage: 'waiting',
		query: '',
		kind: '',
		pageNo: 1,
		ticked: new Set(),
		openId: null,
		prompt: null,
	};
	let claimSerial = 462;
	let pager = null;
	let browseOrder = [];
	let attachedName = '';

	const ui = {
		board: pick('.outlay-table'),
		body: pick('[data-outlay-rows]'),
		blank: pick('[data-outlay-empty]'),
		live: pick('[data-outlay-status]'),
		caption: pick('[data-outlay-caption]'),
		pagerNav: pick('[data-outlay-pager-wrap]'),
		pagerList: pick('[data-outlay-pager]'),
		span: pick('[data-outlay-range]'),
		finder: pick('[data-outlay-search]'),
		kindPicker: pick('[data-outlay-category]'),
		stageGroup: pick('[data-outlay-tabs]'),
		tray: pick('[data-outlay-bulk]'),
		trayLabel: pick('[data-outlay-bulk-count]'),
		tickAll: pick('[data-outlay-check-all]'),
		record: pick('#outlay-record'),
		noteForm: pick('[data-outlay-ask]'),
		noteField: pick('[data-outlay-ask-text]'),
		noteLabel: pick('[data-outlay-ask-label]'),
		claimForm: pick('[data-outlay-form]'),
		composer: pick('#outlay-new'),
	};

	/** Wires every control on the page, then draws it once. */
	function start() {
		bindFilters();
		bindBoard();
		bindPayoutAndExport();
		bindRecord();
		bindComposer();
		redrawAll();
	}

	/* Wiring, one area of the page at a time. */

	function bindFilters() {
		ui.stageGroup.addEventListener('change', (event) => {
			if (!event.target.matches('input[name="expView"]')) return;
			view.stage = event.target.value;
			view.pageNo = 1;
			view.ticked.clear();
			drawBoard();
		});

		let pause;
		ui.finder.addEventListener('input', () => {
			clearTimeout(pause);
			pause = setTimeout(() => {
				view.query = ui.finder.value.trim();
				view.pageNo = 1;
				drawBoard();
			}, 150);
		});

		ui.kindPicker.addEventListener('change', () => {
			view.kind = ui.kindPicker.value;
			view.pageNo = 1;
			drawBoard();
		});

		ui.blank.addEventListener('click', (event) => {
			if (!event.target.closest('[data-outlay-reset]')) return;
			ui.finder.value = '';
			ui.kindPicker.value = '';
			ui.kindPicker.dispatchEvent(new Event('change', { bubbles: true }));
			view.query = '';
			view.kind = '';
			drawBoard();
			ui.finder.focus();
		});
	}

	function bindBoard() {
		ui.body.addEventListener('click', followRow);
		ui.body.addEventListener('auxclick', (event) => {
			if (event.button === 1 && !event.target.closest('button')) followRow(event);
		});

		ui.body.addEventListener('change', (event) => {
			const box = event.target.closest('[data-outlay-pick]');
			if (!box) return;
			const id = box.getAttribute('data-outlay-pick');
			view.ticked[box.checked ? 'add' : 'delete'](id);
			box.closest('tr').classList.toggle('is-picked', box.checked);
			syncTray();
		});

		ui.tickAll.addEventListener('change', () => {
			const verb = ui.tickAll.checked ? 'add' : 'delete';
			for (const id of tickableIds()) view.ticked[verb](id);
			drawBoard();
		});

		pick('[data-outlay-bulk-clear]').addEventListener('click', () => {
			view.ticked.clear();
			drawBoard();
			ui.finder.focus();
		});

		pick('[data-outlay-bulk-approve]').addEventListener('click', () => {
			approveClaims(ledgerRows.filter((claim) => view.ticked.has(claim.id)));
			view.ticked.clear();
			redrawAll();
		});
	}

	/**
	 * A click on a row behaves like a click on its description link, so a
	 * modifier key or the middle button opens a new tab. The panel icon in
	 * the last cell opens the side drawer instead.
	 */
	function followRow(event) {
		const peek = event.target.closest('[data-outlay-open]');
		if (peek) {
			browseOrder = currentList();
			showClaim(peek.getAttribute('data-outlay-open'), 0);
			return;
		}
		if (event.target.closest('.outlay-col-check, a[href], button')) return;
		const row = event.target.closest('tr[data-id]');
		if (!row) return;
		const target = pick('.outlay-claim-desc', row).href;
		if (event.metaKey || event.ctrlKey || event.button === 1) {
			window.open(target, '_blank', 'noopener');
			return;
		}
		location.href = target;
	}

	function bindPayoutAndExport() {
		pick('[data-outlay-pay]').addEventListener('click', () => {
			const due = ledgerRows.filter((claim) => claim.status === 'approved');
			if (!due.length) return;
			const before = keepCopies(due);
			const total = sumOf(due);
			const headcount = new Set(due.map((claim) => claim.who)).size;
			for (const claim of due) {
				claim.status = 'paid';
				claim.paid = todayIso;
			}
			redrawAll();
			notify({
				tone: 'success',
				icon: 'bi-bank',
				title: 'Payout sent',
				text: `${dollars(total)} to ${spell(headcount, 'person', 'people')}. It reaches their accounts in one to two days.`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							putBack(before);
						},
					},
				],
			});
		});

		pick('[data-outlay-export]').addEventListener('click', () => {
			const size = currentList().length;
			notify({
				tone: 'success',
				icon: 'bi-download',
				title: 'Export started',
				text: `${upperFirst(spell(size, 'claim'))} from this view, as a CSV file.`,
			});
		});
	}

	function bindRecord() {
		for (const arrow of pickAll('[data-outlay-r-step]', ui.record)) {
			arrow.addEventListener('click', () => moveBy(Number(arrow.getAttribute('data-outlay-r-step'))));
		}

		const arrowSteps = { ArrowUp: -1, ArrowDown: 1 };
		ui.record.addEventListener('keydown', (event) => {
			const by = event.altKey && arrowSteps[event.key];
			if (!by) return;
			event.preventDefault();
			moveBy(by);
		});

		ui.record.addEventListener('hidden.bs.offcanvas', () => {
			view.openId = null;
			view.prompt = null;
		});

		ui.record.addEventListener('click', (event) => {
			const file = event.target.closest('[data-outlay-download]');
			if (file) {
				notify({
					tone: 'success',
					icon: 'bi-download',
					title: 'Downloading',
					text: file.getAttribute('data-outlay-download'),
				});
				return;
			}
			const button = event.target.closest('[data-outlay-act]');
			if (!button) return;
			const claim = ledgerRows.find((item) => item.id === view.openId);
			recordActions[button.getAttribute('data-outlay-act')]?.(claim);
		});

		ui.noteField.addEventListener('input', () => {
			if (ui.noteField.value.trim()) markField(ui.noteField, false);
		});
	}

	function bindComposer() {
		ui.claimForm.addEventListener('submit', sendNewClaim);
		ui.composer.addEventListener('hidden.bs.offcanvas', clearComposer);
		ui.claimForm.addEventListener('input', (event) => {
			if (event.target.classList.contains('is-invalid')) markField(event.target, false);
		});
		pick('[data-outlay-drop]').addEventListener('basalt:files', (event) => {
			attachFile(event.detail.files[0].name);
		});
		pick('[data-outlay-file-remove]').addEventListener('click', () => {
			attachFile('');
			pick('[data-basalt-drop-browse]', ui.claimForm).focus();
		});
	}

	/* Choosing and ordering the claims the board lists. */

	function inStage(claim, stage) {
		return stage === 'all' || claim.status === stage;
	}

	function passesFilters(claim) {
		if (view.kind && claim.cat !== view.kind) return false;
		if (!view.query) return true;
		const words = [claim.desc, claim.who, claim.id, claim.customer, kinds[claim.cat].label].join(' ');
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(words, view.query);
		return words.toLowerCase().includes(view.query.toLowerCase());
	}

	/* The approval queue is served in the order claims arrived; every
     other stage shows the most recent spending at the top. */
	function currentList() {
		const picked = ledgerRows.filter((claim) => inStage(claim, view.stage) && passesFilters(claim));
		if (view.stage === 'waiting') {
			return picked.sort((one, two) => one.sent.localeCompare(two.sent) || one.id.localeCompare(two.id));
		}
		return picked.sort((one, two) => two.spent.localeCompare(one.spent) || two.id.localeCompare(one.id));
	}

	/* Drawing the page. */

	function redrawAll() {
		drawStageTiles();
		drawBoard();
		drawCategoryBars();
		drawPayout();
	}

	/* Every tile carries its claim count and, under it, the money involved. */
	function drawStageTiles() {
		for (const stage of STAGE_KEYS) {
			const held = ledgerRows.filter((claim) => inStage(claim, stage));
			const amount = dollars(sumOf(held));
			const lines = held.length
				? {
						waiting: `${amount} to check`,
						queried: `${amount} sent back`,
						approved: `${amount} on ${shortDate(payoutIso)}`,
						paid: `${amount} paid out`,
					}
				: {
						waiting: 'All caught up',
						queried: 'No open questions',
						approved: 'Nothing to pay',
						paid: 'Nothing paid yet',
					};
			pick(`[data-outlay-count="${stage}"]`).textContent = held.length;
			pick(`[data-outlay-note="${stage}"]`).textContent = stage === 'all' ? 'Last 30 days' : lines[stage];
		}
	}

	function drawBoard() {
		const list = currentList();
		const pageCount = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
		view.pageNo = Math.min(view.pageNo, pageCount);
		const offset = (view.pageNo - 1) * ROWS_PER_PAGE;
		const slice = list.slice(offset, offset + ROWS_PER_PAGE);
		const any = slice.length > 0;

		ui.board.classList.toggle('is-plain', view.stage !== 'waiting');
		ui.body.innerHTML = slice.map(rowMarkup).join('');
		if (window.Basalt.tips) window.Basalt.tips(ui.body);
		if (window.Basalt.avatars) window.Basalt.avatars(ui.body);
		ui.board.closest('.outlay-table-wrap').hidden = !any;
		ui.blank.hidden = any;
		ui.blank.innerHTML = any ? '' : blankStageMarkup();
		ui.caption.textContent = `Expense claims, ${ORDER_NOTES[view.stage]}`;
		ui.live.textContent = list.length ? spokenSummary(list) : '';

		const paged = list.length > ROWS_PER_PAGE;
		ui.pagerNav.hidden = !paged;
		if (paged) {
			ui.span.innerHTML = `<strong>${offset + 1}–${offset + slice.length}</strong> of ${list.length} claims`;
			syncPager(pageCount);
		}
		syncTray();
	}

	function spokenSummary(list) {
		const lead = `${upperFirst(spell(list.length, 'claim'))}, ${ORDER_NOTES[view.stage]}.`;
		const missing = view.stage === 'waiting' ? list.filter((claim) => !claim.receipt).length : 0;
		if (!missing) return lead;
		return `${lead} ${upperFirst(spell(missing, 'claim'))}${missing === 1 ? ' has' : ' have'} no receipt yet.`;
	}

	function syncPager(pageCount) {
		if (pager) {
			pager.setTotal(pageCount);
			if (pager.get() !== view.pageNo) pager.set(view.pageNo);
			return;
		}
		pager = window.Basalt.pagination(ui.pagerList, {
			total: pageCount,
			current: view.pageNo,
			label: 'Claims page',
			onChange(next) {
				view.pageNo = next;
				drawBoard();
			},
		});
	}

	/* The checkboxes on screen decide what can stay ticked; anything that
     has scrolled or filtered away is dropped from the selection. */
	function tickableIds() {
		return Array.from(pickAll('[data-outlay-pick]', ui.body), (box) => box.getAttribute('data-outlay-pick'));
	}

	function syncTray() {
		const onScreen = tickableIds();
		for (const id of [...view.ticked]) {
			if (!onScreen.includes(id)) view.ticked.delete(id);
		}
		const chosen = view.ticked.size;
		ui.tray.hidden = !chosen;
		ui.trayLabel.textContent = `${upperFirst(spell(chosen, 'claim'))} selected`;
		ui.tickAll.checked = onScreen.length > 0 && chosen === onScreen.length;
		ui.tickAll.indeterminate = chosen > 0 && chosen < onScreen.length;
		ui.tickAll.disabled = !onScreen.length;
	}

	function drawCategoryBars() {
		const counted = ledgerRows.filter((claim) => claim.status !== 'rejected');
		const bars = Object.keys(kinds)
			.map((key) => {
				const share = counted.filter((claim) => claim.cat === key);
				return { key, claims: share.length, total: sumOf(share) };
			})
			.filter((bar) => bar.claims)
			.sort((one, two) => two.total - one.total);
		const widest = bars.length ? bars[0].total : 1;
		const list = pick('[data-outlay-cats]');

		pick('[data-outlay-cat-sub]').textContent =
			`${dollars(sumOf(counted))} claimed in the last 30 days, across ${spell(counted.length, 'claim')}.`;
		list.innerHTML = bars.map((bar) => categoryBarMarkup(bar, widest)).join('');

		/* Two frames, so the bars are on screen at zero before they grow. */
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				for (const fill of pickAll('[data-share]', list)) {
					fill.style.setProperty('--outlay-share', fill.getAttribute('data-share'));
				}
			}),
		);
	}

	function drawPayout() {
		const due = ledgerRows.filter((claim) => claim.status === 'approved');
		const perPerson = new Map();
		for (const claim of due) {
			const entry = perPerson.get(claim.who) ?? { who: claim.who, claims: 0, total: 0 };
			entry.claims += 1;
			entry.total += claim.amount;
			perPerson.set(claim.who, entry);
		}
		const payees = [...perPerson.values()].sort((one, two) => two.total - one.total);
		const list = pick('[data-outlay-payees]');
		const blank = pick('[data-outlay-pay-empty]');

		pick('[data-outlay-pay-sub]').textContent = due.length
			? `${dollars(sumOf(due))} for ${spell(payees.length, 'person', 'people')}, paid on ${shortDate(payoutIso)}.`
			: 'Approved claims are paid every Friday.';
		list.innerHTML = payees.map(payeeMarkup).join('');
		if (window.Basalt.avatars) window.Basalt.avatars(list);

		blank.hidden = due.length > 0;
		blank.innerHTML = due.length
			? ''
			: emptyCard({
					tone: 'success',
					icon: 'bi-check2-circle',
					title: 'Everyone is paid',
					text: `Claims you approve from now on go out on Friday, ${shortDate(payoutIso)}.`,
				});
		pick('[data-outlay-pay-foot]').hidden = !due.length;
	}

	/* Markup for the board and the two summary cards. */

	function rowMarkup(claim) {
		const ticked = view.ticked.has(claim.id);
		const canTick = view.stage === 'waiting' && isMine(claim);
		const label = htmlSafe(claim.desc);
		const kind = kinds[claim.cat];
		const tick = canTick
			? `<input type="checkbox" class="form-check-input" data-outlay-pick="${claim.id}" aria-label="Select ${label}"${ticked ? ' checked' : ''}>`
			: '';
		const warning =
			claim.receipt || claim.status === 'paid'
				? ''
				: '<span class="outlay-claim-flag"><i class="bi bi-paperclip" aria-hidden="true"></i>No receipt</span>';
		const person = `<span class="outlay-who">${avatarMarkup(claim.who)}<span><span class="outlay-who-name">${htmlSafe(claim.who)}</span><span class="outlay-who-role">${htmlSafe(staff[claim.who].role)}</span></span></span>`;
		const summary = `<a href="${detailHref(claim)}" class="outlay-claim-desc">${label}</a><span class="outlay-claim-meta"><span>${claim.id}</span><span>${shortDate(claim.spent)}</span><span class="outlay-claim-cat">${kind.label}</span>${warning}</span>`;
		const tools = `<span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" aria-label="Quick view: ${label}" data-outlay-open="${claim.id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a href="${detailHref(claim)}" class="btn btn-icon btn-sm" aria-label="Open full page: ${label}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span>`;
		const cells = [
			`<td class="outlay-col-check">${tick}</td>`,
			`<td>${person}</td>`,
			`<td>${summary}</td>`,
			`<td>${kindBadge(claim)}</td>`,
			`<td class="outlay-amount">${dollars(claim.amount)}</td>`,
			`<td>${stateTag(claim)}</td>`,
			`<td>${tools}</td>`,
		];
		return `<tr${ticked ? ' class="is-picked"' : ''} data-id="${claim.id}">${cells.join('')}</tr>`;
	}

	function blankStageMarkup() {
		if (view.query || view.kind) {
			const what = view.query ? `“${htmlSafe(view.query)}”` : 'that category';
			return emptyCard({
				tone: 'muted',
				icon: 'bi-search',
				title: 'No claims match',
				text: `Nothing here matches ${what}. Try another word, or look in All claims.`,
				actions:
					'<button type="button" class="btn btn-sm btn-outline-secondary" data-outlay-reset>Clear the search</button>',
			});
		}
		const quiet = {
			waiting: {
				tone: 'success',
				icon: 'bi-check2-all',
				title: 'Nothing waiting for you',
				text: 'New claims show up here as people send them.',
			},
			queried: {
				tone: 'muted',
				icon: 'bi-chat-left-text',
				title: 'No open questions',
				text: 'Claims you send back with a question wait here for an answer.',
			},
			approved: {
				tone: 'muted',
				icon: 'bi-wallet2',
				title: 'Nothing to pay',
				text: 'Claims you approve go out in the next Friday payout.',
			},
			paid: {
				tone: 'muted',
				icon: 'bi-wallet2',
				title: 'Nothing paid yet',
				text: 'Paid claims are listed here after each payout.',
			},
			all: {
				tone: 'muted',
				icon: 'bi-receipt',
				title: 'No claims yet',
				text: 'Claims from the last 30 days show up here.',
			},
		};
		return emptyCard(quiet[view.stage]);
	}

	/** Builds the shared compact empty state; `actions` is optional markup. */
	function emptyCard({ tone, icon, title, text, actions }) {
		const toneClass = tone ? ` basalt-empty-${tone}` : '';
		const footer = actions ? `<div class="basalt-empty-actions">${actions}</div>` : '';
		return `<div class="basalt-empty basalt-empty-compact${toneClass} outlay-empty"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi ${icon}"></i></span><h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${footer}</div>`;
	}

	function categoryBarMarkup(bar, widest) {
		const kind = kinds[bar.key];
		return `<li class="outlay-cats-row" data-cat="${bar.key}"><p class="outlay-cats-name">${kindIcon(kind)}<span>${kind.label}<span class="outlay-cats-n">${spell(bar.claims, 'claim')}</span></span></p><span class="outlay-cats-bar" aria-hidden="true"><span data-share="${((bar.total / widest) * 100).toFixed(1)}%"></span></span><p class="outlay-cats-amount">${dollars(bar.total)}</p></li>`;
	}

	function payeeMarkup(payee) {
		return `<li class="outlay-payee">${avatarMarkup(payee.who)}<span><span class="outlay-payee-name">${htmlSafe(payee.who)}</span><span class="outlay-payee-what">${spell(payee.claims, 'claim')}</span></span><span class="outlay-payee-amount">${dollars(payee.total)}</span></li>`;
	}

	function avatarMarkup(name) {
		return `<span class="basalt-avatar basalt-avatar-sm" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(name)}"></span>`;
	}

	function kindIcon(kind) {
		return `<span class="outlay-cat-icon" aria-hidden="true"><i class="bi ${kind.icon}"></i></span>`;
	}

	function kindBadge(claim) {
		const kind = kinds[claim.cat];
		return `<span class="outlay-cat" data-cat="${claim.cat}">${kindIcon(kind)}${kind.label}</span>`;
	}

	function stateTag(claim) {
		const { tone, label } = stages[claim.status];
		return `<span class="basalt-status basalt-status-dot basalt-status-${tone}">${label}</span>`;
	}

	/* Decisions, and putting them back. */

	function keepCopies(list) {
		return list.map((claim) => ({ claim, copy: { ...claim } }));
	}

	/* Undo rewrites each claim in place, so every list that holds it sees
     the old values again. */
	function putBack(saved) {
		for (const { claim, copy } of saved) {
			for (const key of Object.keys(claim)) delete claim[key];
			Object.assign(claim, copy);
		}
		redrawAll();
		if (view.openId) paintRecord();
	}

	/**
	 * Approves the claims that have a receipt and leaves the rest alone.
	 * Returns false when none of them could be approved.
	 */
	function approveClaims(list) {
		const ready = list.filter((claim) => claim.receipt);
		const stuck = list.filter((claim) => !claim.receipt);
		if (!ready.length) {
			notify({
				tone: 'warning',
				icon: 'bi-paperclip',
				title: 'A receipt is needed first',
				text: `Ask ${firstName(stuck[0].who)} for the receipt, then approve the claim.`,
			});
			return false;
		}
		const before = keepCopies(ready);
		for (const claim of ready) {
			claim.status = 'approved';
			claim.approved = todayIso;
			delete claim.queried;
		}
		const heading = ready.length === 1 ? 'Claim approved' : `${upperFirst(spell(ready.length, 'claim'))} approved`;
		const leftover = stuck.length ? ` ${upperFirst(spell(stuck.length, 'claim'))} still need a receipt.` : '';
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: heading,
			text: `${dollars(sumOf(ready))} goes out in Friday’s payout.${leftover}`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						putBack(before);
						window.Basalt.announce?.('Undone. Back in the queue.');
					},
				},
			],
		});
		return true;
	}

	/* A question and a rejection both go back with a note; only the stage
     and the toast differ. */
	const RETURN_KINDS = {
		reject: { status: 'rejected', tone: 'danger', icon: 'bi-x-circle', title: 'Claim rejected' },
		query: { status: 'queried', tone: 'info', icon: 'bi-chat-left-text', title: 'Question sent' },
	};

	function returnClaim(claim, kind, note) {
		const before = keepCopies([claim]);
		const how = RETURN_KINDS[kind];
		claim.status = how.status;
		claim[how.status] = { on: todayIso, text: note };
		notify({
			tone: how.tone,
			icon: how.icon,
			title: how.title,
			text: `${firstName(claim.who)} gets an email with your note.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						putBack(before);
					},
				},
			],
		});
	}

	/* The claim drawer. */

	/* What each footer button in the drawer does with the open claim. */
	const recordActions = {
		approve(claim) {
			if (approveClaims([claim])) advancePast(claim);
		},
		query(claim) {
			askFor('query', claim);
		},
		receipt(claim) {
			askFor('receipt', claim);
		},
		reject(claim) {
			askFor('reject', claim);
		},
		cancel() {
			window.Basalt.slide(ui.noteForm, () => {
				view.prompt = null;
				repaintRecord();
			});
		},
		send(claim) {
			const note = ui.noteField.value.trim();
			if (markField(ui.noteField, !note)) {
				ui.noteField.focus();
				return;
			}
			returnClaim(claim, view.prompt === 'reject' ? 'reject' : 'query', note);
			view.prompt = null;
			advancePast(claim);
		},
		unapprove(claim) {
			const before = keepCopies([claim]);
			claim.status = 'waiting';
			delete claim.approved;
			notify({
				tone: 'info',
				icon: 'bi-arrow-counterclockwise',
				title: 'Back in the queue',
				text: 'It won’t be paid on Friday unless you approve it again.',
				actions: [
					{
						label: 'Undo',
						onClick() {
							putBack(before);
						},
					},
				],
			});
			redrawAll();
			repaintRecord();
		},
		reopen(claim) {
			claim.status = 'waiting';
			delete claim.rejected;
			notify({
				tone: 'info',
				icon: 'bi-arrow-counterclockwise',
				title: 'Claim reopened',
				text: 'It is back in your queue.',
			});
			redrawAll();
			repaintRecord();
		},
	};

	function recordPart(name) {
		return pick(`[data-outlay-r="${name}"]`, ui.record);
	}

	function recordPanel() {
		return bootstrap.Offcanvas.getOrCreateInstance(ui.record);
	}

	/** Opens a claim in the drawer; `direction` replays the slide-in when stepping. */
	function showClaim(id, direction) {
		view.openId = id;
		view.prompt = null;
		ui.noteField.value = '';
		ui.noteField.classList.remove('is-invalid');
		ui.record.classList.toggle('is-back', direction < 0);
		paintRecord();
		if (direction) {
			for (const block of pickAll(':scope > *', recordPart('body'))) {
				block.style.animation = 'none';
				void block.offsetWidth;
				block.style.animation = '';
			}
		}
		recordPanel().show();
	}

	function paintRecord() {
		const claim = ledgerRows.find((item) => item.id === view.openId);
		if (!claim) return;
		const place = browseOrder.findIndex((item) => item.id === claim.id);
		const lone = place < 0 || browseOrder.length < 2;

		recordPart('title').textContent = claim.desc;
		recordPart('sub').textContent = `${claim.id} · ${shortDate(claim.spent)}`;
		recordPart('full').href = detailHref(claim);
		recordPart('pos').textContent = place < 0 ? '' : `${place + 1} of ${browseOrder.length}`;
		for (const arrow of pickAll('[data-outlay-r-step]', ui.record)) arrow.disabled = lone;

		const sections = [
			['expRReceipt', 'Receipt', receiptMarkup(claim)],
			['expRDetails', 'Details', factsMarkup(claim)],
			['expRHistory', 'History', historyMarkup(claim)],
		].map(
			([id, heading, inner]) =>
				`<section aria-labelledby="${id}"><h3 class="outlay-r-h" id="${id}">${heading}</h3>${inner}</section>`,
		);
		recordPart('body').innerHTML = stageMarkup(claim) + sections.join('');
		ui.noteForm.hidden = !view.prompt;
		recordPart('foot').innerHTML = footerMarkup(claim);
	}

	/* The buttons that were pressed are replaced, so focus returns to the
     drawer title rather than dropping to the page. */
	function repaintRecord() {
		paintRecord();
		recordPart('title').focus();
	}

	function moveBy(direction) {
		const size = browseOrder.length;
		if (size < 2) return;
		const place = browseOrder.findIndex((item) => item.id === view.openId);
		showClaim(browseOrder[(place + direction + size) % size].id, direction);
	}

	/* After a decision the drawer moves on to whatever now sits in the same
     place in the list, and closes once the list has run out. All claims
     keeps every claim, so there the drawer simply redraws. */
	function advancePast(claim) {
		const place = browseOrder.findIndex((item) => item.id === claim.id);
		redrawAll();
		browseOrder = currentList();
		if (view.stage === 'all') {
			view.prompt = null;
			repaintRecord();
			return;
		}
		if (!browseOrder.length) {
			recordPanel().hide();
			return;
		}
		const nextAt = Math.min(Math.max(place, 0), browseOrder.length - 1);
		showClaim(browseOrder[nextAt].id, 1);
		recordPart('title').focus();
	}

	function askFor(kind, claim) {
		const who = firstName(claim.who);
		const prompts = {
			query: `What do you need from ${who}?`,
			receipt: `Message to ${who}`,
			reject: 'Why is it rejected?',
		};
		ui.noteLabel.textContent = prompts[kind];
		ui.noteField.value = kind === 'receipt' ? 'Please attach the receipt so I can approve this.' : '';
		ui.noteField.classList.remove('is-invalid');
		window.Basalt.slide(ui.noteForm, () => {
			view.prompt = kind;
			paintRecord();
		});
		ui.noteField.focus();
	}

	/* The sentence under the status pill, and the note left with it when
     the claim went back. */
	function stageMarkup(claim) {
		const who = firstName(claim.who);
		const byWhom = decider(claim) === viewer ? 'You' : decider(claim);
		const explain = {
			waiting() {
				const sentence = isMine(claim)
					? `Sent by ${who} on ${shortDate(claim.sent)}. Waiting for you.`
					: `Sent on ${shortDate(claim.sent)}. Waiting for ${decider(claim)}.`;
				return [
					claim.receipt ? sentence : `${sentence} It can’t be approved until the receipt is attached.`,
					'',
				];
			},
			queried: () => [
				`${byWhom} sent it back on ${shortDate(claim.queried.on)}. It comes back here once ${who} answers.`,
				claim.queried.text,
			],
			approved: () => [
				`${byWhom} approved it on ${shortDate(claim.approved)}. It goes out in Friday’s payout on ${shortDate(payoutIso)}.`,
				'',
			],
			paid: () => [`Paid to ${who} on ${shortDate(claim.paid)}, in the weekly payout.`, ''],
			rejected: () => [`${byWhom} rejected it on ${shortDate(claim.rejected.on)}.`, claim.rejected.text],
		};
		const [sentence, note] = (explain[claim.status] ?? explain.rejected)();
		const noteMarkup = note
			? `<p class="outlay-r-note">${htmlSafe(note)}<span class="outlay-r-note-by">${htmlSafe(decider(claim))}</span></p>`
			: '';
		return `<div class="outlay-r-state">${stateTag(claim)}<p class="outlay-r-state-text">${htmlSafe(sentence)}</p>${noteMarkup}</div>`;
	}

	function receiptMarkup(claim) {
		const slip = claim.receipt;
		if (!slip) {
			const subject = claim.who === viewer ? 'You haven’t' : `${htmlSafe(firstName(claim.who))} hasn’t`;
			return `<div class="outlay-r-missing"><i class="bi bi-paperclip" aria-hidden="true"></i><div><p class="outlay-r-missing-title">No receipt yet</p><p class="outlay-r-missing-text">${subject} attached one. Claims over $25 need a receipt.</p></div></div>`;
		}
		const download = `<div class="outlay-slip-file"><span>${htmlSafe(slip.file)}</span><button type="button" class="btn btn-sm btn-outline-secondary" data-outlay-download="${htmlSafe(slip.file)}"><i class="bi bi-download me-1" aria-hidden="true"></i>Download</button></div>`;
		if (!slip.lines) return download;
		const items = slip.lines
			.map(([item, price]) => `<li><span>${htmlSafe(item)}</span><span>${dollars(price)}</span></li>`)
			.join('');
		return `<div class="outlay-slip"><p class="outlay-slip-shop">${htmlSafe(slip.shop)}</p><p class="outlay-slip-where">${htmlSafe(slip.where)} · ${shortDate(claim.spent)}</p><ul class="outlay-slip-lines">${items}</ul><p class="outlay-slip-total"><span>Total</span><span>${dollars(claim.amount)}</span></p></div>${download}`;
	}

	function factsMarkup(claim) {
		const person = staff[claim.who];
		const facts = [
			['Amount', `<span class="outlay-amount">${dollars(claim.amount)}</span>`],
			['Spent on', `${shortDate(claim.spent)}, 2026`],
			['Category', kindBadge(claim)],
			[
				'Person',
				person.staff
					? `<a href="employee-details.html?id=${encodeURIComponent(person.staff)}">${htmlSafe(claim.who)}</a>`
					: htmlSafe(claim.who),
			],
			[
				'Customer',
				claim.customer
					? `<a href="company-details.html?id=${encodeURIComponent(ledger.customers[claim.customer])}">${htmlSafe(claim.customer)}</a>`
					: '',
			],
			['Paid with', htmlSafe(claim.paidWith)],
			['Approver', htmlSafe(decider(claim))],
			['Note', htmlSafe(claim.note)],
		];
		const pairs = facts.filter(([, value]) => value).map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`);
		return `<dl class="outlay-r-facts">${pairs.join('')}</dl>`;
	}

	function historyMarkup(claim) {
		const events = [{ icon: 'bi-send', label: `Sent by ${claim.who}`, on: claim.sent }];
		if (claim.queried)
			events.push({
				icon: 'bi-chat-left-text',
				tone: 'warning',
				label: 'Sent back with a question',
				on: claim.queried.on,
			});
		if (claim.approved)
			events.push({
				icon: 'bi-check2',
				tone: 'success',
				label: `Approved by ${decider(claim)}`,
				on: claim.approved,
			});
		if (claim.paid)
			events.push({
				icon: 'bi-wallet2',
				tone: 'success',
				label: `Paid in the ${shortDate(claim.paid)} payout`,
				on: claim.paid,
			});
		if (claim.rejected)
			events.push({
				icon: 'bi-x-lg',
				tone: 'danger',
				label: `Rejected by ${decider(claim)}`,
				on: claim.rejected.on,
			});
		const items = events.map(({ icon, tone, label, on }) => {
			const mark = `<span class="outlay-trail-mark${tone ? ` is-${tone}` : ''}" aria-hidden="true"><i class="bi ${icon}"></i></span>`;
			return `<li>${mark}<div><p class="outlay-trail-what">${htmlSafe(label)}</p><p class="outlay-trail-when">${shortDate(on)}</p></div></li>`;
		});
		return `<ol class="outlay-trail">${items.join('')}</ol>`;
	}

	/* The drawer footer: the note's send and cancel while a note is open,
     otherwise the decisions that fit the claim's stage. */
	function footerMarkup(claim) {
		if (view.prompt) {
			const sendLabels = { query: 'Send question', receipt: 'Ask for it', reject: 'Reject claim' };
			return `<button type="button" class="btn btn-outline-secondary" data-outlay-act="cancel">Cancel</button><button type="button" class="btn btn-primary" data-outlay-act="send">${sendLabels[view.prompt]}</button>`;
		}
		const open = claim.status === 'waiting' || claim.status === 'queried';
		if (open && !isMine(claim)) {
			return `<p class="outlay-r-own">${htmlSafe(decider(claim))} approves your claims.</p>${CLOSE_BUTTON}`;
		}
		if (open) {
			const decide = claim.receipt
				? '<button type="button" class="btn btn-outline-secondary" data-outlay-act="query">Ask a question</button><button type="button" class="btn btn-primary" data-outlay-act="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>'
				: '<button type="button" class="btn btn-primary" data-outlay-act="receipt"><i class="bi bi-paperclip me-1" aria-hidden="true"></i>Ask for the receipt</button>';
			return `<button type="button" class="btn btn-outline-secondary me-auto" data-outlay-act="reject">Reject</button>${decide}`;
		}
		const leading = {
			approved: isMine(claim)
				? '<button type="button" class="btn btn-outline-secondary me-auto" data-outlay-act="unapprove">Undo approval</button>'
				: '',
			rejected:
				'<button type="button" class="btn btn-outline-secondary me-auto" data-outlay-act="reopen">Reopen</button>',
		};
		return (leading[claim.status] ?? '') + CLOSE_BUTTON;
	}

	/* The new claim drawer. */

	function attachFile(name) {
		attachedName = name;
		pick('[data-outlay-drop]').hidden = Boolean(name);
		pick('[data-outlay-file]').hidden = !name;
		pick('[data-outlay-file-name]').textContent = name;
	}

	/** Flags or clears one field and hands back the flag, for chaining. */
	function markField(field, wrong) {
		field.classList.toggle('is-invalid', wrong);
		field.setAttribute('aria-invalid', String(wrong));
		field.closest('.input-group')?.classList.toggle('has-validation', wrong);
		return wrong;
	}

	function sendNewClaim(event) {
		event.preventDefault();
		const { desc, amount, date, category, customer, note } = ui.claimForm;
		const value = parseFloat(String(amount.value).replace(/[$,\s]/g, ''));
		/* Every field is checked, so each one shows its own message at once. */
		const checks = [
			[desc, !desc.value.trim()],
			[amount, !(value >= 1 && value <= 5000)],
			[date, !date.value || date.value > date.max || date.value < date.min],
		];
		const wrong = checks.filter(([field, failed]) => markField(field, failed)).map(([field]) => field);
		pick('.invalid-feedback', amount.closest('.outlay-field-amount')).classList.toggle(
			'd-block',
			wrong.includes(amount),
		);
		if (wrong.length) {
			wrong[0].focus();
			return;
		}

		const claim = {
			id: `#${claimSerial++}`,
			spent: date.value,
			sent: todayIso,
			who: viewer,
			cat: category.value,
			amount: Math.round(value * 100) / 100,
			status: 'waiting',
			desc: desc.value.trim(),
			customer: customer.value,
			paidWith: 'Personal card',
			note: note.value.trim(),
			receipt: attachedName ? { file: attachedName } : null,
		};
		ledgerRows.push(claim);
		bootstrap.Offcanvas.getOrCreateInstance(ui.composer).hide();
		redrawAll();
		notify({
			tone: 'success',
			icon: 'bi-send',
			title: 'Claim sent',
			text: `${viewerApprover} will look at it. ${dollars(claim.amount)} for ${claim.desc}.`,
		});
	}

	function clearComposer() {
		ui.claimForm.reset();
		attachFile('');
		for (const field of pickAll('.is-invalid', ui.claimForm)) {
			field.classList.remove('is-invalid');
			field.removeAttribute('aria-invalid');
		}
		for (const message of pickAll('.invalid-feedback.d-block', ui.claimForm)) {
			message.classList.remove('d-block');
		}
	}

	/* Small formatting and lookup helpers. */

	function isMine(claim) {
		return decider(claim) === viewer;
	}

	function detailHref(claim) {
		return `expense-details.html?id=${encodeURIComponent(claim.id)}`;
	}

	function sumOf(list) {
		let total = 0;
		for (const claim of list) total += claim.amount;
		return total;
	}

	function dollars(value) {
		return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	/** "2026-10-08" becomes "Oct 8". */
	function shortDate(iso) {
		const [, month, dayOfMonth] = iso.split('-');
		return `${MONTH_NAMES[Number(month) - 1]} ${Number(dayOfMonth)}`;
	}

	/** Writes small counts as words: spell(3, 'claim') gives "three claims". */
	function spell(total, singular, plural = `${singular}s`) {
		const number = total < NUMBER_WORDS.length ? NUMBER_WORDS[total] : String(total);
		return `${number} ${total === 1 ? singular : plural}`;
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function firstName(wholeName) {
		return wholeName.split(' ')[0];
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (mark) => entities[mark]);
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options) ?? null;
	}

	document.addEventListener('DOMContentLoaded', start);

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
