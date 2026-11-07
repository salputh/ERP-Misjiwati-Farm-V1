/**
 * Logged hours, for two pages. timesheets.html lays out one week for the
 * whole company and lets a manager approve it row by row or in bulk;
 * timesheet-details.html follows a single person through one week, entry
 * by entry, with the decision and how it came about. Both pages read
 * data/multipurpose/timesheets.js and share the Log time and Reject dialogs, and the
 * root they carry ([data-ts-root] or [data-tsd-root]) says which one is
 * open. A real app would fetch these fields from its time tracker and
 * keep the drawing as it is.
 */
(() => {
	'use strict';

	const gridRoot = pick('[data-ts-root]');
	const sheetRoot = pick('[data-tsd-root]');
	const ledger = window.Basalt.data?.timesheets;
	const roster = window.Basalt.data?.people;
	if (!(gridRoot || sheetRoot) || !ledger || !roster) return;

	/* The signed-in manager, as the data module spells the name. */
	const VIEWER = 'John Armstrong';
	const ROWS_PER_PAGE = 15;
	const SERIES_SLOTS = 8;
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const STATUS_LOOK = {
		draft: { tone: '', label: 'Draft' },
		submitted: { tone: 'warning', label: 'Submitted' },
		approved: { tone: 'success', label: 'Approved' },
		rejected: { tone: 'danger', label: 'Rejected' },
	};
	const FEED_LOOK = {
		created: { tone: '', icon: 'bi-pencil' },
		submitted: { tone: 'info', icon: 'bi-send' },
		approved: { tone: 'success', icon: 'bi-check2' },
		rejected: { tone: 'danger', icon: 'bi-arrow-return-left' },
		logged: { tone: 'warning', icon: 'bi-clock-history' },
	};

	/* How one grid cell reads for each kind of day; anything else is a
     rest day with nothing to show. */
	const GRID_DAY_FACE = {
		work: (day) => `<span class="ts-num">${hoursText(day.hours)}</span>`,
		off: (day) =>
			`<span class="ts-off"${tooltipAttrs(day.reason)}>Off</span><span class="visually-hidden">, ${htmlSafe(day.reason)}</span>`,
		missing: () =>
			'<span class="ts-gap" aria-hidden="true">—</span><span class="visually-hidden">Not logged</span>',
	};
	const RESTING_FACE =
		'<span class="ts-rest" aria-hidden="true">–</span><span class="visually-hidden">No hours</span>';

	/* Clicks on the week grid, tried in this order; the first selector
     the target sits inside handles it. */
	const GRID_CLICKS = [
		['[data-ts-week]', stepWeek],
		['[data-ts-goto]', jumpToBacklog],
		['[data-ts-approve]', approveFromRow],
		['[data-ts-quick]', (button) => showQuickView(button.getAttribute('data-ts-quick'))],
		['[data-ts-bulk]', approveChosen],
		['tr[data-ts-row]', followRow],
		['[data-ts-all]', revealEveryone],
		['[data-ts-clear]', clearFilters],
		['[data-ts-export]', reportExport],
	];
	const DETAIL_ACTIONS = {
		approve: approveHere,
		undo: withdrawApproval,
		reject: rejectHere,
		remind: sendReminder,
	};

	const hoursText = ledger.fmtHours;
	const asDate = ledger.toDate;
	const nameFor = roster.nameOf;

	const rejectDialog = {
		modal: pick('#ts-reject'),
		form: pick('[data-ts-reject-form]'),
		reason: pick('[data-ts-reject-reason]'),
	};
	const logDialog = {
		modal: pick('#ts-log'),
		form: pick('[data-ts-log-form]'),
		person: pick('[data-ts-log-who]'),
		work: pick('[data-ts-log-work]'),
		day: pick('[data-ts-log-day]'),
		amount: pick('[data-ts-log-hours]'),
		note: pick('[data-ts-log-note]'),
		preview: pick('[data-ts-log-preview]'),
	};

	/* The dialogs serve whichever page is open: that page says what to
     redraw once they finish and whom and which day Log time opens on. */
	const dialogHooks = { rejected: null, logged: null };
	const logStart = { staffId: '', day: ledger.TODAY };
	let rejectTarget = null;
	let grid = null;
	let detail = null;

	start();

	function start() {
		if (rejectDialog.modal) wireRejectDialog();
		if (logDialog.modal) wireLogDialog();
		if (gridRoot) mountWeekGrid();
		if (sheetRoot) mountSheetDetail();
	}

	/* Small shared helpers: lookups, escaping, the page-wide services in
     basalt.js, and the wording of hours and dates. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	/** The Undo button every toast here offers, running the given reversal. */
	function undoAction(reverse) {
		return { label: 'Undo', onClick: reverse };
	}

	function speak(text) {
		window.Basalt.announce?.(text);
	}

	function armTooltips(scope) {
		window.Basalt.tips?.(scope);
	}

	function syncSelect(select) {
		window.Basalt.select?.refresh?.(select);
	}

	function tooltipAttrs(label) {
		return ` data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${htmlSafe(label)}"`;
	}

	/** "1 day", "3 days"; pass the plural when adding an s will not do. */
	function count(amount, singular, pluralForm) {
		return `${amount} ${amount === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function sumOf(items, read) {
		return items.reduce((total, item) => total + read(item), 0);
	}

	function withUnit(amount) {
		return `${hoursText(amount)} h`;
	}

	/** Commas in the leading whole number only: "1,240.5". */
	function groupThousands(text) {
		return text.replace(/^(\d+)/, (digits) => Number(digits).toLocaleString('en-US'));
	}

	function shortDate(iso) {
		const date = asDate(iso);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	/** "Oct 5 – 11, 2026", or "Sep 28 – Oct 4, 2026" across a month end. */
	function weekSpan(week) {
		const lastIso = ledger.addDays(week, 6);
		const first = asDate(week);
		const last = asDate(lastIso);
		const tail = first.getMonth() === last.getMonth() ? `${last.getDate()}` : shortDate(lastIso);
		return `${shortDate(week)} – ${tail}, ${last.getFullYear()}`;
	}

	function mondayOf(iso) {
		const sinceMonday = (asDate(iso).getDay() + 6) % 7;
		return ledger.addDays(iso, -sinceMonday);
	}

	function weekDays(week) {
		return Array.from({ length: 7 }, (_, offset) => ledger.addDays(week, offset));
	}

	/** "Today, 9:40" reads mid-sentence as "today, 9:40". */
	function relativeWhen(at) {
		return ledger.when(at).replace(/^(Today|Yesterday)/, (word) => word.toLowerCase());
	}

	function stamp() {
		return `${ledger.TODAY} ${ledger.NOW}`;
	}

	function actorName(who) {
		return who === VIEWER ? 'You' : who;
	}

	/** The actor as the object of a sentence: "by you", "by Ann Parsons". */
	function actorInline(who) {
		return actorName(who) === 'You' ? 'you' : who;
	}

	function avatarHtml(person, size = 'basalt-avatar-sm') {
		const team = roster.teamOf(person.team);
		return `<span class="basalt-avatar ${size} basalt-avatar-tone-${team ? team.tone : 1}" aria-hidden="true">${htmlSafe(roster.initials(person))}</span>`;
	}

	function sheetLink(sheet) {
		return `timesheet-details.html?id=${encodeURIComponent(sheet.id)}&week=${sheet.week}`;
	}

	function pillHtml(status) {
		const { tone, label } = STATUS_LOOK[status];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`;
	}

	function factList(pairs) {
		return pairs.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('');
	}

	function byPersonName(a, b) {
		return nameFor(a.person).localeCompare(nameFor(b.person));
	}

	function isWaiting(sheet) {
		return sheet.status === 'submitted';
	}

	/** A sent or approved week that gains an entry drops back to draft. */
	function isLocked(sheet) {
		return sheet.status === 'submitted' || sheet.status === 'approved';
	}

	/**
	 * Each project's hours over the week and the customers it was for,
	 * biggest first. Ties keep the order the work was logged in.
	 */
	function projectTotals(sheet) {
		const byName = new Map();
		for (const day of sheet.days) {
			for (const entry of day.entries) {
				const bucket = byName.get(entry.name) || { name: entry.name, clients: new Set(), hours: 0 };
				bucket.hours += entry.hours;
				bucket.clients.add(entry.client);
				byName.set(entry.name, bucket);
			}
		}
		return [...byName.values()].sort((a, b) => b.hours - a.hours);
	}

	/* Changes to a sheet. The data module holds a single object per person
     and week, so an edit made here reaches every view on the page. Each
     change hands back the function that takes it back. */

	function captureFlow(sheet) {
		return { status: sheet.status, reason: sheet.reason, history: sheet.history.slice(), sentAt: sheet.sentAt };
	}

	function rewind(sheet, saved) {
		Object.assign(sheet, saved);
	}

	function approveSheets(sheets) {
		const saved = sheets.map((sheet) => [sheet, captureFlow(sheet)]);
		for (const sheet of sheets) {
			sheet.status = 'approved';
			sheet.reason = '';
			sheet.history = [...sheet.history, { kind: 'approved', at: stamp(), who: VIEWER, text: 'approved it' }];
		}
		return () => {
			for (const [sheet, flow] of saved) rewind(sheet, flow);
		};
	}

	function rejectSheet(sheet, reason) {
		const saved = captureFlow(sheet);
		sheet.status = 'rejected';
		sheet.reason = reason;
		sheet.history = [
			...sheet.history,
			{ kind: 'rejected', at: stamp(), who: VIEWER, text: 'sent it back', reason },
		];
		return () => rewind(sheet, saved);
	}

	/** Recomputes day hours, the week total, overtime and unlogged days. */
	function retotal(sheet) {
		for (const day of sheet.days) {
			day.hours = sumOf(day.entries, (entry) => entry.hours);
			if (day.entries.length) day.kind = 'work';
		}
		sheet.total = sumOf(sheet.days, (day) => day.hours);
		sheet.overtime = Math.max(0, sheet.total - sheet.expected);
		sheet.missing = sheet.days.filter((day) => day.kind === 'missing').length;
	}

	/**
	 * Adds one entry to a day of the sheet.
	 * @returns {{reopened: boolean, undo: Function}} reopened is true when
	 *   the week had been sent or approved and is now a draft again.
	 */
	function addEntry(sheet, iso, entry) {
		const day = sheet.days.find((item) => item.iso === iso);
		const kindBefore = day.kind;
		const flowBefore = captureFlow(sheet);
		day.entries.push(entry);
		retotal(sheet);
		const reopened = isLocked(sheet);
		if (reopened) {
			sheet.status = 'draft';
			sheet.sentAt = '';
		}
		const consequence = reopened ? ', which moved it back to draft' : '';
		sheet.history = [
			...sheet.history,
			{
				kind: 'logged',
				at: stamp(),
				who: VIEWER,
				text: `logged ${withUnit(entry.hours)} on ${ledger.dayTitle(iso)}${consequence}`,
			},
		];
		return {
			reopened,
			undo() {
				const at = day.entries.indexOf(entry);
				if (at >= 0) day.entries.splice(at, 1);
				day.kind = kindBefore;
				retotal(sheet);
				rewind(sheet, flowBefore);
			},
		};
	}

	/* The Reject dialog. A note of four characters or more is required,
     because the person reads it to know what to fix. */

	function wireRejectDialog() {
		const { modal, form, reason } = rejectDialog;
		modal.addEventListener('shown.bs.modal', () => reason.focus());
		form.addEventListener('submit', submitRejection);
		reason.addEventListener('input', () => {
			if (reason.classList.contains('is-invalid') && reason.value.trim().length > 3) unflag(reason);
		});
	}

	/** Opens the dialog for one sheet; followUp redraws the page after. */
	function askToReject(sheet, followUp) {
		rejectTarget = sheet;
		dialogHooks.rejected = followUp;
		pick('[data-ts-reject-sub]').textContent =
			`${nameFor(sheet.person)}, week of ${shortDate(sheet.week)}. ${sheet.person.first} gets your note.`;
		rejectDialog.form.reset();
		unflag(rejectDialog.reason);
		bootstrap.Modal.getOrCreateInstance(rejectDialog.modal).show();
	}

	function submitRejection(event) {
		event.preventDefault();
		const field = rejectDialog.reason;
		const note = field.value.trim();
		const usable = note.length > 3;
		flagInvalid(field, !usable);
		if (!usable) {
			field.focus();
			return;
		}
		const sheet = rejectTarget;
		const undo = rejectSheet(sheet, note);
		bootstrap.Modal.getOrCreateInstance(rejectDialog.modal).hide();
		dialogHooks.rejected?.();
		notify({
			tone: 'info',
			icon: 'bi-arrow-return-left',
			title: 'Timesheet rejected',
			text: `${sheet.person.first}’s week of ${shortDate(sheet.week)} is back with them, with your note.`,
			actions: [
				undoAction(() => {
					undo();
					dialogHooks.rejected?.();
				}),
			],
		});
	}

	function flagInvalid(field, invalid) {
		field.classList.toggle('is-invalid', invalid);
		field.setAttribute('aria-invalid', String(invalid));
	}

	function unflag(field) {
		field.classList.remove('is-invalid');
		field.removeAttribute('aria-invalid');
	}

	/* The Log time dialog: a person, a day, quarter hours and the work
     they were for, with a live line on what the entry will change. */

	function wireLogDialog() {
		const { modal, form, person, day, amount } = logDialog;
		const people = everybody();
		person.innerHTML = people
			.map((member) => {
				const name = nameFor(member);
				return `<option value="${member.staff}" data-hint="${htmlSafe(member.team)}">${htmlSafe(name)}${name === VIEWER ? ' (you)' : ''}</option>`;
			})
			.join('');
		const myself = people.find((member) => nameFor(member) === VIEWER);
		logStart.staffId = myself ? myself.staff : person.options[0].value;
		person.value = logStart.staffId;
		syncSelect(person);
		listWorkFor();

		modal.addEventListener('show.bs.modal', resetLogForm);
		person.addEventListener('change', () => {
			listWorkFor();
			describeLog();
		});
		day.addEventListener('change', describeLog);
		amount.addEventListener('input', () => {
			if (amount.classList.contains('is-invalid')) checkLog();
			describeLog();
		});
		form.addEventListener('submit', submitLog);
	}

	/** Everyone with a timesheet in any week, sorted by name. */
	function everybody() {
		const byStaff = new Map();
		for (const week of ledger.weeks) {
			for (const member of ledger.people(week)) byStaff.set(member.staff, member);
		}
		return [...byStaff.values()].sort((a, b) => nameFor(a).localeCompare(nameFor(b)));
	}

	function resetLogForm() {
		const { form, person, day, preview } = logDialog;
		form.reset();
		person.value = logStart.staffId;
		syncSelect(person);
		listWorkFor();
		window.Basalt.datepicker?.set(day, logStart.day);
		for (const field of pickAll('.is-invalid', form)) unflag(field);
		preview.textContent = '';
	}

	/** Fills the work list with what the chosen person can log against. */
	function listWorkFor() {
		const member = roster.find(logDialog.person.value);
		if (!member) return;
		const jobs = ledger.work(member).all;
		logDialog.work.innerHTML = jobs
			.map(
				(job, index) =>
					`<option value="${index}" data-hint="${htmlSafe(job.client)}">${htmlSafe(job.name)}</option>`,
			)
			.join('');
		syncSelect(logDialog.work);
	}

	/** The hours typed, with a comma accepted as the decimal mark. */
	function hoursEntered() {
		const reading = parseFloat(String(logDialog.amount.value).replace(',', '.'));
		return Number.isFinite(reading) ? reading : NaN;
	}

	function pickedDay() {
		const datepicker = window.Basalt.datepicker;
		return datepicker ? datepicker.get(logDialog.day) : '';
	}

	function describeLog() {
		logDialog.preview.textContent = previewLine();
	}

	/** What the entry would do to the day, or nothing until the form is usable. */
	function previewLine() {
		const member = roster.find(logDialog.person.value);
		const iso = pickedDay();
		const amount = hoursEntered();
		if (!member || !iso || !(amount > 0)) return '';
		const sheet = ledger.sheet(member.staff, mondayOf(iso));
		if (!sheet) return `${member.first} has no timesheet that week.`;
		const day = sheet.days.find((item) => item.iso === iso);
		const change = `${ledger.dayTitle(iso)} goes from ${withUnit(day.hours)} to ${withUnit(day.hours + amount)}.`;
		return isLocked(sheet)
			? `${change} The week is ${STATUS_LOOK[sheet.status].label.toLowerCase()}, so it goes back to draft.`
			: change;
	}

	/**
	 * Marks the day and hours fields, focuses the first one that is wrong
	 * and says whether the form can be sent.
	 */
	function checkLog() {
		const amount = hoursEntered();
		const iso = pickedDay();
		const member = roster.find(logDialog.person.value);
		const hasSheet = Boolean(member && iso && ledger.sheet(member.staff, mondayOf(iso)));
		const quarters = amount * 4;
		const amountOk = amount >= 0.25 && amount <= 12 && Math.abs(quarters - Math.round(quarters)) < 1e-9;
		const dayOk = Boolean(iso) && hasSheet;
		const dayField = pick('input[type="text"]', logDialog.day);

		flagInvalid(logDialog.amount, !amountOk);
		flagInvalid(dayField, !dayOk);
		pick('#ts-log-day-error').textContent =
			iso && !hasSheet
				? `${member ? member.first : 'They'} has no timesheet that week.`
				: 'Pick a day from Aug 31 to this Sunday.';

		const firstWrong = !dayOk ? dayField : !amountOk ? logDialog.amount : null;
		if (firstWrong) firstWrong.focus();
		return !firstWrong;
	}

	function submitLog(event) {
		event.preventDefault();
		if (!checkLog()) return;
		const member = roster.find(logDialog.person.value);
		const iso = pickedDay();
		const amount = hoursEntered();
		const sheet = ledger.sheet(member.staff, mondayOf(iso));
		const job = ledger.work(member).all[parseInt(logDialog.work.value, 10)] || ledger.work(member).all[0];
		const entry = {
			name: job.name,
			client: job.client,
			note: logDialog.note.value.trim() || `Logged by ${VIEWER}`,
			hours: amount,
			added: true,
		};
		const change = addEntry(sheet, iso, entry);
		bootstrap.Modal.getOrCreateInstance(logDialog.modal).hide();
		dialogHooks.logged?.(sheet, iso);
		notify({
			tone: 'success',
			icon: 'bi-clock-history',
			title: 'Time logged',
			text: `${withUnit(amount)} on ${job.name} for ${nameFor(member)}, ${ledger.dayTitle(iso)}.${change.reopened ? ' The week is a draft again.' : ''}`,
			actions: [
				undoAction(() => {
					change.undo();
					dialogHooks.logged?.(sheet, iso);
				}),
			],
		});
	}

	/* Timesheets: the whole company's week as a grid of people by days,
     filtered, paged and approved in place, with a quick view drawer. */

	function mountWeekGrid() {
		const ui = {
			heading: pick('[data-ts-week-title]'),
			summary: pick('[data-ts-week-sub]'),
			facts: pick('[data-ts-facts]'),
			head: pick('[data-ts-head]'),
			body: pick('[data-ts-rows]'),
			foot: pick('[data-ts-foot]'),
			table: pick('.ts-table'),
			caption: pick('[data-ts-caption]'),
			empty: pick('[data-ts-empty]'),
			more: pick('[data-ts-more]'),
			tally: pick('[data-ts-range]'),
			showAll: pick('[data-ts-all]'),
			bulk: pick('[data-ts-bulk]'),
			search: pick('[data-ts-search]'),
			team: pick('[data-ts-team]'),
			status: pick('[data-ts-status]'),
			drawer: pick('#ts-sheet'),
		};
		grid = {
			ui,
			week: ledger.current,
			query: '',
			teamFilter: '',
			statusFilter: '',
			expanded: false,
			chosen: new Set(),
			drawerId: null,
			searchTimer: 0,
		};

		gridRoot.addEventListener('click', onGridClick);
		gridRoot.addEventListener('auxclick', onGridAuxClick);
		gridRoot.addEventListener('change', onGridChange);
		ui.search.addEventListener('input', () => {
			clearTimeout(grid.searchTimer);
			grid.searchTimer = setTimeout(() => {
				grid.query = ui.search.value;
				grid.expanded = false;
				drawRows();
			}, 150);
		});
		ui.team.addEventListener('change', () => {
			grid.teamFilter = ui.team.value;
			grid.expanded = false;
			redrawGrid();
		});
		ui.status.addEventListener('change', () => {
			grid.statusFilter = ui.status.value;
			grid.expanded = false;
			drawRows();
		});
		ui.drawer.addEventListener('click', onDrawerClick);

		dialogHooks.logged = (sheet, iso) => {
			if (sheet.week === grid.week) redrawGrid();
			else showWeek(sheet.week);
			speak(`Logged on ${ledger.dayTitle(iso)}.`);
		};

		redrawGrid();
	}

	function redrawGrid() {
		drawWeekHeader();
		drawRows();
		if (grid.drawerId && grid.ui.drawer.classList.contains('show')) paintQuickView();
	}

	function showWeek(week) {
		if (!ledger.weeks.includes(week)) return;
		grid.week = week;
		grid.chosen.clear();
		grid.expanded = false;
		redrawGrid();
	}

	/* What the grid shows: the week's sheets, the filters over them and
     the slice that fits before "Show all". */

	function weekSheets(week) {
		return ledger
			.people(week)
			.map((member) => ledger.sheet(member.staff, week))
			.filter(Boolean)
			.sort(byPersonName);
	}

	function inTeam(sheet) {
		return !grid.teamFilter || sheet.person.team === grid.teamFilter;
	}

	function matchingSheets() {
		const query = grid.query.trim();
		const matcher = window.Basalt && window.Basalt.matchesQuery;
		return weekSheets(grid.week).filter((sheet) => {
			if (!inTeam(sheet)) return false;
			if (grid.statusFilter && sheet.status !== grid.statusFilter) return false;
			if (!query) return true;
			const haystack = `${nameFor(sheet.person)} ${sheet.person.title} ${sheet.person.team} ${sheet.id}`;
			return matcher ? matcher(haystack, query) : haystack.toLowerCase().includes(query.toLowerCase());
		});
	}

	function pageOf(sheets) {
		return grid.expanded ? sheets : sheets.slice(0, ROWS_PER_PAGE);
	}

	/* Drawing the grid: the card header with its facts, then the table
     head, rows and footer, then the paging line and the bulk button. */

	function drawWeekHeader() {
		const { ui, week } = grid;
		const sheets = weekSheets(week).filter(inTeam);
		const isCurrent = week === ledger.current;
		ui.heading.textContent = `${isCurrent ? 'This week, ' : 'Week of '}${weekSpan(week)}`;

		const sentCount = sheets.filter((sheet) => sheet.status !== 'draft').length;
		const dueIso = ledger.addDays(week, 7);
		const opening = isCurrent
			? `Due ${WEEKDAY_ABBR[asDate(dueIso).getDay()]}, ${shortDate(dueIso)}. ${sentCount} of ${sheets.length} sent so far.`
			: `${sentCount} of ${sheets.length} sent.`;
		ui.summary.innerHTML = `${htmlSafe(opening)}${backlogButton()}`;

		const overtimePeople = sheets.filter((sheet) => sheet.overtime > 0).length;
		ui.facts.innerHTML = factList([
			['To approve', sheets.filter(isWaiting).length],
			['Hours logged', groupThousands(hoursText(sumOf(sheets, (sheet) => sheet.total)))],
			['Expected', groupThousands(hoursText(sumOf(sheets, (sheet) => sheet.expected)))],
			[
				'Overtime',
				`${hoursText(sumOf(sheets, (sheet) => sheet.overtime))} h <span class="ts-quiet">${count(overtimePeople, 'person', 'people')}</span>`,
			],
			[
				'Not logged',
				count(
					sumOf(sheets, (sheet) => sheet.missing),
					'day',
				),
			],
		]);

		const position = ledger.weeks.indexOf(week);
		pick('[data-ts-week="-1"]', gridRoot).disabled = position <= 0;
		pick('[data-ts-week="1"]', gridRoot).disabled = position >= ledger.weeks.length - 1;
		pick('[data-ts-week="now"]', gridRoot).hidden = isCurrent;
	}

	/** A link to the latest earlier week that still has sheets to approve. */
	function backlogButton() {
		const backlog = ledger.weeks
			.filter((week) => week < grid.week)
			.map((week) => ({
				week,
				waiting: weekSheets(week).filter((sheet) => isWaiting(sheet) && inTeam(sheet)).length,
			}))
			.filter((older) => older.waiting);
		if (!backlog.length) return '';
		const waiting = sumOf(backlog, (older) => older.waiting);
		return ` <button type="button" class="ts-link" data-ts-goto="${backlog[backlog.length - 1].week}">${count(waiting, 'earlier timesheet')} still waiting</button>`;
	}

	function drawRows() {
		const { ui } = grid;
		const sheets = matchingSheets();
		const onPage = pageOf(sheets);
		const approvable = onPage.filter(isWaiting);
		for (const id of grid.chosen) {
			if (!approvable.some((sheet) => sheet.id === id)) grid.chosen.delete(id);
		}

		drawGridHead();
		ui.body.innerHTML = onPage.map((sheet) => gridRow(sheet)).join('');
		drawGridFoot(sheets);
		armTooltips(ui.body);
		ui.caption.textContent = `Hours by person and day, ${weekSpan(grid.week)}`;

		const hasAny = sheets.length > 0;
		const people = count(sheets.length, 'person', 'people');
		ui.table.hidden = !hasAny;
		ui.empty.hidden = hasAny;
		ui.more.hidden = !hasAny;
		ui.tally.innerHTML =
			sheets.length > onPage.length ? `Showing <strong>${onPage.length}</strong> of ${people}` : people;
		ui.showAll.hidden = sheets.length <= onPage.length;
		ui.showAll.textContent = `Show all ${sheets.length}`;
		syncChooser(approvable);
	}

	/** Keeps the select-all box and the bulk button in step with the picks. */
	function syncChooser(approvable) {
		const master = pick('[data-ts-pick-all]', grid.ui.head);
		const picked = grid.chosen.size;
		master.disabled = !approvable.length;
		master.checked = approvable.length > 0 && picked === approvable.length;
		master.indeterminate = picked > 0 && picked < approvable.length;
		grid.ui.bulk.hidden = !picked;
		pick('[data-ts-bulk-label]', grid.ui.bulk).textContent = `Approve ${picked} selected`;
	}

	/** Column classes shared by head, body and foot: weekend and today. */
	function dayClass(index, iso) {
		return `ts-day${index >= 5 ? ' is-weekend' : ''}${iso === ledger.TODAY ? ' is-today' : ''}`;
	}

	function drawGridHead() {
		const dayHeads = weekDays(grid.week)
			.map((iso, index) => {
				const date = asDate(iso);
				const current = iso === ledger.TODAY ? ' aria-current="date"' : '';
				return `<th class="${dayClass(index, iso)}" scope="col"${current}>${WEEKDAY_ABBR[date.getDay()]} ${date.getDate()}</th>`;
			})
			.join('');
		const chooser =
			'<th class="ts-pick" scope="col"><input type="checkbox" class="form-check-input" data-ts-pick-all aria-label="Select every submitted timesheet"></th>';
		const tail =
			'<th class="ts-total" scope="col">Total</th><th class="ts-state" scope="col">Status</th><th class="ts-act" scope="col"><span class="visually-hidden">Actions</span></th>';
		grid.ui.head.innerHTML = `<tr>${chooser}<th scope="col">Person</th>${dayHeads}${tail}</tr>`;
	}

	function gridRow(sheet) {
		const member = sheet.person;
		const name = htmlSafe(nameFor(member));
		const tickBox = isWaiting(sheet)
			? `<input type="checkbox" class="form-check-input" data-ts-pick="${sheet.id}" aria-label="Select ${name}"${grid.chosen.has(sheet.id) ? ' checked' : ''}>`
			: '';
		const columns = [
			`<td class="ts-pick" data-cell="pick">${tickBox}</td>`,
			`<td data-cell="who"><span class="ts-who">${avatarHtml(member)}<a class="ts-who-name" href="${sheetLink(sheet)}">${name}</a></span></td>`,
			...sheet.days.map(gridDayCell),
			`<td class="ts-total" data-cell="total">${hoursText(sheet.total)}<span class="visually-hidden"> of ${hoursText(sheet.expected)} hours</span></td>`,
			`<td data-cell="status">${pillHtml(sheet.status)}</td>`,
			`<td class="ts-act" data-cell="act">${rowActions(sheet, name)}</td>`,
		];
		return `<tr data-ts-row="${sheet.id}">${columns.join('')}</tr>`;
	}

	function gridDayCell(day, index) {
		const face = GRID_DAY_FACE[day.kind];
		const weekdayLetter = WEEKDAY_ABBR[asDate(day.iso).getDay()].charAt(0);
		return `<td class="${dayClass(index, day.iso)}" data-dow="${weekdayLetter}">${face ? face(day) : RESTING_FACE}</td>`;
	}

	/** Approve (for sent weeks only) and the quick view button. */
	function rowActions(sheet, name) {
		const approve = isWaiting(sheet)
			? `<button type="button" class="btn btn-outline-primary btn-sm" data-ts-approve="${sheet.id}" aria-label="Approve ${name}’s timesheet">Approve</button>`
			: '';
		const peek = `<button type="button" class="btn btn-icon btn-sm" data-ts-quick="${sheet.id}"${tooltipAttrs('Quick view')} aria-label="Quick view: ${name}’s week"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		return `<span class="ts-acts">${approve}${peek}</span>`;
	}

	function drawGridFoot(sheets) {
		grid.ui.foot.innerHTML = sheets.length ? footRow(sheets) : '';
	}

	/** Per-day totals across every matching person, not only the shown page. */
	function footRow(sheets) {
		const dayTotals = weekDays(grid.week)
			.map((iso, index) => {
				const total = sumOf(sheets, (sheet) => sheet.days[index].hours);
				const figure = total
					? `<span class="ts-num">${hoursText(total)}</span>`
					: '<span class="ts-num ts-num-zero">–</span>';
				return `<td class="${dayClass(index, iso)}">${figure}</td>`;
			})
			.join('');
		const label = sheets.length > 1 ? `All ${sheets.length} people` : '1 person';
		const weekTotal = groupThousands(hoursText(sumOf(sheets, (sheet) => sheet.total)));
		return `<tr><td></td><th scope="row">${label}</th>${dayTotals}<td class="ts-total">${weekTotal}</td><td colspan="2"></td></tr>`;
	}

	/* Grid events. Clicks run through GRID_CLICKS; the rest are the
     checkboxes, middle clicks on a row and the drawer's buttons. */

	function onGridClick(event) {
		for (const [selector, handle] of GRID_CLICKS) {
			const hit = event.target.closest(selector);
			if (hit) {
				handle(hit, event);
				return;
			}
		}
	}

	function onGridAuxClick(event) {
		if (event.button !== 1) return;
		const row = event.target.closest('tr[data-ts-row]');
		if (row) followRow(row, event);
	}

	function onGridChange(event) {
		const box = event.target.closest('[data-ts-pick]');
		if (box) {
			toggleChoice(box);
			return;
		}
		if (event.target.matches('[data-ts-pick-all]')) chooseAllShown(event.target.checked);
	}

	function stepWeek(button) {
		const step = button.getAttribute('data-ts-week');
		const position = ledger.weeks.indexOf(grid.week);
		showWeek(step === 'now' ? ledger.current : ledger.weeks[position + parseInt(step, 10)]);
	}

	/** Opens the older week and narrows it to the sheets still waiting. */
	function jumpToBacklog(button) {
		const { ui } = grid;
		showWeek(button.getAttribute('data-ts-goto'));
		grid.statusFilter = 'submitted';
		ui.status.value = 'submitted';
		syncSelect(ui.status);
		drawRows();
		ui.heading.focus({ preventScroll: true });
	}

	/** Approves one row, then puts focus back on the row now in its place. */
	function approveFromRow(button) {
		const sheet = ledger.sheet(button.getAttribute('data-ts-approve'), grid.week);
		const position = pickAll('tr', grid.ui.body).indexOf(button.closest('tr'));
		approveAndReport([sheet], () => {
			const row = pickAll('tr', grid.ui.body)[position];
			const target = row ? pick('[data-ts-approve]', row) || pick('.ts-who-name', row) : null;
			target?.focus({ preventScroll: true });
		});
	}

	function approveChosen() {
		const sheets = [...grid.chosen].map((id) => ledger.sheet(id, grid.week)).filter(Boolean);
		if (sheets.length) approveAndReport(sheets, () => grid.ui.heading.focus({ preventScroll: true }));
	}

	/** A click anywhere on a row that is not a control opens the sheet. */
	function followRow(row, event) {
		if (event.target.closest('a, button, input')) return;
		const href = pick('.ts-who-name', row).href;
		if (event.metaKey || event.ctrlKey || event.button === 1) window.open(href, '_blank', 'noopener');
		else location.href = href;
	}

	/** Shows every row and moves focus to the first one that was hidden. */
	function revealEveryone() {
		const body = grid.ui.body;
		const shownBefore = body.children.length;
		window.Basalt.slide(grid.ui.table.parentElement, () => {
			grid.expanded = true;
			drawRows();
		});
		const firstNew = body.children[shownBefore];
		if (firstNew) pick('.ts-who-name', firstNew).focus({ preventScroll: true });
	}

	function clearFilters() {
		const { ui } = grid;
		grid.query = '';
		grid.teamFilter = '';
		grid.statusFilter = '';
		for (const field of [ui.search, ui.team, ui.status]) field.value = '';
		syncSelect(ui.team);
		syncSelect(ui.status);
		redrawGrid();
		ui.search.focus();
	}

	function reportExport() {
		notify({
			tone: 'success',
			icon: 'bi-file-earmark-spreadsheet',
			title: 'Export ready',
			text: `timesheets-${grid.week}.csv has one row per person and day.`,
		});
	}

	function toggleChoice(box) {
		const id = box.getAttribute('data-ts-pick');
		if (box.checked) grid.chosen.add(id);
		else grid.chosen.delete(id);
		drawRows();
		pick(`[data-ts-pick="${id}"]`, grid.ui.body)?.focus();
	}

	function chooseAllShown(checked) {
		const onPage = pageOf(matchingSheets());
		grid.chosen = new Set(checked ? onPage.filter(isWaiting).map((sheet) => sheet.id) : []);
		drawRows();
		pick('[data-ts-pick-all]', grid.ui.head).focus();
	}

	/**
	 * Approves the sheets, redraws, runs refocus if given, and raises a
	 * toast that can take the approval back.
	 */
	function approveAndReport(sheets, refocus) {
		const undo = approveSheets(sheets);
		for (const sheet of sheets) grid.chosen.delete(sheet.id);
		redrawGrid();
		refocus?.();
		const stillWaiting = weekSheets(grid.week).filter(isWaiting).length;
		const which = grid.week === ledger.current ? 'this week' : 'that week';
		const single = sheets.length === 1;
		const opener = single ? `${nameFor(sheets[0].person)}, ${withUnit(sheets[0].total)}. ` : '';
		const closer = stillWaiting ? `${stillWaiting} more to approve ${which}.` : `Nothing left to approve ${which}.`;
		const several = sheets.length > 1;
		notify({
			tone: 'success',
			icon: several ? 'bi-check2-all' : 'bi-check2-circle',
			title: several ? `${count(sheets.length, 'timesheet')} approved` : 'Timesheet approved',
			text: `${opener}${closer}`,
			actions: [
				undoAction(() => {
					undo();
					redrawGrid();
				}),
			],
		});
	}

	/* The quick view drawer: the chosen person's days and totals, with
     Approve and Reject when the week is waiting. */

	function quickViewPart(key) {
		return pick(`[data-ts-d="${key}"]`, grid.ui.drawer);
	}

	function drawerPanel() {
		return bootstrap.Offcanvas.getOrCreateInstance(grid.ui.drawer);
	}

	function showQuickView(id) {
		grid.drawerId = id;
		paintQuickView();
		drawerPanel().show();
	}

	function onDrawerClick(event) {
		const button = event.target.closest('[data-ts-d-act]');
		if (!button) return;
		const sheet = ledger.sheet(grid.drawerId, grid.week);
		if (!sheet) return;
		drawerPanel().hide();
		if (button.getAttribute('data-ts-d-act') === 'approve') approveAndReport([sheet]);
		else askToReject(sheet, redrawGrid);
	}

	/** Where the sheet stands, in one sentence for the drawer. */
	function statusLine(sheet) {
		const latest = sheet.history[sheet.history.length - 1];
		const outcomes = {
			submitted: () => `Sent ${relativeWhen(sheet.sentAt)}. Waiting for approval.`,
			approved: () => `Approved by ${actorName(latest.who)}, ${relativeWhen(latest.at)}.`,
			rejected: () => `Rejected by ${actorName(latest.who)}. Waiting for ${sheet.person.first} to fix it.`,
		};
		const line = outcomes[sheet.status];
		if (line) return line();
		return sheet.missing ? `Not sent yet. ${count(sheet.missing, 'day')} not logged.` : 'Not sent yet.';
	}

	function quickViewDay(day) {
		const looks = {
			work: () => [[...new Set(day.entries.map((entry) => entry.name))].join(', '), withUnit(day.hours)],
			off: () => [day.reason, 'Off'],
			missing: () => ['Not logged yet', '—'],
		};
		const [what, amount] = looks[day.kind] ? looks[day.kind]() : ['', withUnit(day.hours)];
		return `<li><span class="ts-d-days-day">${htmlSafe(ledger.dayTitle(day.iso))}</span><span class="ts-d-days-what">${htmlSafe(what)}</span><span class="ts-d-days-hours">${amount}</span></li>`;
	}

	function drawerSection(title, inner) {
		return `<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">${title}</h3>${inner}</section>`;
	}

	function paintQuickView() {
		const sheet = ledger.sheet(grid.drawerId, grid.week);
		if (!sheet) return;
		const member = sheet.person;
		quickViewPart('title').textContent = nameFor(member);
		quickViewPart('sub').textContent = `Week of ${weekSpan(sheet.week)} · ${member.team}`;
		quickViewPart('full').setAttribute('href', sheetLink(sheet));

		const days = sheet.days
			.filter((day) => day.kind !== 'rest' && day.kind !== 'before')
			.map(quickViewDay)
			.join('');
		const leader = projectTotals(sheet)[0];
		const figures = [
			['Logged', withUnit(sheet.total)],
			[
				'Expected',
				`${withUnit(sheet.expected)}${sheet.offDays ? `, less ${count(sheet.offDays, 'day')} off` : ''}`,
			],
			['Overtime', sheet.overtime ? withUnit(sheet.overtime) : 'None'],
		];
		if (leader) figures.push(['Most time on', `${htmlSafe(leader.name)}, ${withUnit(leader.hours)}`]);
		figures.push(['Approver', htmlSafe(nameFor(sheet.approver))]);
		const facts = figures.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join('');
		const note =
			sheet.status === 'rejected' && sheet.reason ? `<p class="ts-d-reason">${htmlSafe(sheet.reason)}</p>` : '';

		quickViewPart('body').innerHTML = [
			`<div class="ts-d-state">${pillHtml(sheet.status)}<p class="ts-d-text">${htmlSafe(statusLine(sheet))}</p>${note}</div>`,
			drawerSection('Days', `<ul class="ts-d-days">${days}</ul>`),
			drawerSection('Totals', `<dl class="ts-d-facts">${facts}</dl>`),
		].join('');
		quickViewPart('foot').innerHTML = isWaiting(sheet)
			? '<button type="button" class="btn btn-outline-secondary" data-ts-d-act="reject">Reject</button><button type="button" class="btn btn-primary" data-ts-d-act="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>'
			: '<button class="btn btn-outline-secondary" type="button" data-bs-dismiss="offcanvas">Close</button>';
	}

	/* Timesheet Details: one person's week from the address bar, or the
     first sheet waiting this week when the address names none. */

	function mountSheetDetail() {
		const params = new URLSearchParams(location.search);
		const id = params.get('id') || '';
		const sheet =
			ledger.sheet(id, params.get('week') || ledger.current) ||
			ledger.sheet(id, ledger.current) ||
			firstWaitingSheet();
		detail = { sheet, person: sheet.person, undoApproval: null, freshEntry: null };

		sheetRoot.addEventListener('click', onDetailClick);
		dialogHooks.logged = afterDetailLog;
		logStart.staffId = sheet.person.staff;
		logStart.day = sheet.week === ledger.current ? ledger.TODAY : ledger.addDays(sheet.week, 4);
		if (logDialog.person) {
			logDialog.person.value = sheet.person.staff;
			syncSelect(logDialog.person);
			listWorkFor();
		}

		redrawDetail();
	}

	function firstWaitingSheet() {
		return ledger
			.people(ledger.current)
			.map((member) => ledger.sheet(member.staff, ledger.current))
			.sort(byPersonName)
			.find(isWaiting);
	}

	function detailPart(key) {
		return pick(`[data-tsd="${key}"]`, sheetRoot);
	}

	function redrawDetail() {
		drawDetailHeader();
		drawDetailSummary();
		drawEntries();
		drawProjects();
		drawHistory();
		armTooltips(sheetRoot);
	}

	function focusWeekHeading() {
		pick('#tsd-week-title').focus({ preventScroll: true });
	}

	function drawDetailHeader() {
		const { sheet, person } = detail;
		document.title = `${nameFor(person)}, week of ${shortDate(sheet.week)} · Basalt`;
		detailPart('title').textContent = nameFor(person);
		detailPart('sub').textContent = `Week of ${weekSpan(sheet.week)} · ${person.title}, ${person.team}`;
		const partTime = sheet.partTime ? '<span class="ts-tags-text">Part-time, Mon to Wed</span>' : '';
		detailPart('tags').innerHTML =
			`${pillHtml(sheet.status)}<span class="ts-tags-text">Approver: ${htmlSafe(nameFor(sheet.approver))}</span>${partTime}`;
		detailPart('profile').setAttribute('href', roster.staffPage(person));
		const position = ledger.weeks.indexOf(sheet.week);
		pointPager(detailPart('prev'), ledger.weeks[position - 1], 'Week before');
		pointPager(detailPart('next'), ledger.weeks[position + 1], 'Week after');
	}

	/** Aims a week arrow at that week's sheet, or disables it if none. */
	function pointPager(anchor, week, label) {
		const target = week && ledger.sheet(detail.person.staff, week);
		anchor.classList.toggle('disabled', !target);
		if (!target) {
			/* With nowhere to go the link drops its href; role="link" keeps
         the aria-label allowed on it. */
			anchor.removeAttribute('href');
			anchor.setAttribute('role', 'link');
			anchor.setAttribute('aria-disabled', 'true');
			anchor.setAttribute('aria-label', label);
			return;
		}
		anchor.setAttribute('href', sheetLink(target));
		anchor.removeAttribute('role');
		anchor.removeAttribute('aria-disabled');
		anchor.setAttribute('aria-label', `${label}: ${weekSpan(week)}`);
	}

	function drawDetailSummary() {
		const { sheet } = detail;
		detailPart('week-title').textContent =
			sheet.week === ledger.current ? 'This week' : `Week of ${shortDate(sheet.week)}`;
		const worked = sheet.days.filter((day) => day.kind === 'work' && !day.weekend).length;
		const offPart = sheet.offDays ? `, ${count(sheet.offDays, 'day')} off (${sheet.offLabel.toLowerCase()})` : '';
		const missingPart = sheet.missing ? `, ${count(sheet.missing, 'day')} not logged yet` : '';
		detailPart('week-sub').textContent = `${count(worked, 'day')} worked${offPart}${missingPart}.`;
		detailPart('total').textContent = withUnit(sheet.total);
		detailPart('total-unit').textContent = `logged of ${withUnit(sheet.expected)} expected`;

		const forCustomers = sumOf(sheet.days, (day) =>
			sumOf(
				day.entries.filter((entry) => entry.client !== 'Internal'),
				(entry) => entry.hours,
			),
		);
		const gap = sheet.total - sheet.expected;
		detailPart('facts').innerHTML = factList([
			['Expected', withUnit(sheet.expected)],
			['Overtime', sheet.overtime ? withUnit(sheet.overtime) : 'None'],
			[gap < 0 ? 'Short by' : 'Difference', gapText(gap)],
			['For customers', withUnit(forCustomers)],
		]);
		detailPart('meter').innerHTML = meterHtml(sheet);
		detailPart('decide').innerHTML = decisionHtml(sheet);
	}

	function gapText(gap) {
		if (gap < 0) return withUnit(-gap);
		return gap > 0 ? `+${withUnit(gap)}` : 'None';
	}

	/** Logged hours as one bar, with overtime as a second piece past the end. */
	function meterHtml(sheet) {
		const scale = Math.max(sheet.expected, sheet.total, 1);
		const filled = (Math.min(sheet.total, sheet.expected) / scale) * 100;
		const extra = (sheet.overtime / scale) * 100;
		const overflow = extra
			? `<span class="ts-meter-over" style="left:${filled.toFixed(2)}%;width:${extra.toFixed(2)}%"></span>`
			: '';
		const caption = sheet.overtime
			? `${withUnit(sheet.expected)} expected, ${withUnit(sheet.overtime)} over`
			: `${withUnit(sheet.expected)} expected`;
		return `<div role="img" class="ts-meter-bar" aria-label="${withUnit(sheet.total)} logged of ${withUnit(sheet.expected)} expected"><span class="ts-meter-fill" style="width:${filled.toFixed(2)}%"></span>${overflow}</div><p class="ts-meter-ends"><span>0 h</span><span>${caption}</span></p>`;
	}

	/* The decision block under the summary changes with the status: a
     sent week offers Approve and Reject, an unsent one a reminder. */

	function decisionHtml(sheet) {
		const decisionFor = { submitted: waitingDecision, approved: approvedDecision, rejected: rejectedDecision };
		return (decisionFor[sheet.status] || unsentDecision)(sheet);
	}

	function waitingDecision(sheet) {
		return (
			`<p class="ts-decide-note">${htmlSafe(detail.person.first)} sent it ${htmlSafe(relativeWhen(sheet.sentAt))}. Approve it, or reject it with a note.</p>` +
			'<button type="button" class="btn btn-outline-secondary" data-tsd-act="reject"><i class="bi bi-arrow-return-left me-1" aria-hidden="true"></i>Reject</button>' +
			'<button type="button" class="btn btn-primary" data-tsd-act="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>'
		);
	}

	function approvedDecision(sheet) {
		const latest = sheet.history[sheet.history.length - 1];
		const undoable = detail.undoApproval;
		const payroll =
			sheet.week === ledger.current || undoable ? '' : ' Approved weeks go to payroll at the end of the month.';
		const undoButton = undoable
			? '<button type="button" class="btn btn-outline-secondary" data-tsd-act="undo"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Undo approval</button>'
			: '';
		return `<p class="ts-decide-note"><strong>Approved</strong> by ${htmlSafe(actorInline(latest.who))}, ${htmlSafe(relativeWhen(latest.at))}.${payroll}</p>${undoButton}`;
	}

	function rejectedDecision(sheet) {
		const latest = sheet.history[sheet.history.length - 1];
		return `<p class="ts-decide-note"><strong>Rejected</strong> by ${htmlSafe(actorInline(latest.who))}: “${htmlSafe(sheet.reason)}” Waiting for ${htmlSafe(detail.person.first)} to fix it.</p>`;
	}

	function unsentDecision(sheet) {
		const left = sheet.missing
			? `, and ${count(sheet.missing, 'day')} still ${sheet.missing === 1 ? 'needs' : 'need'} hours`
			: '';
		return (
			`<p class="ts-decide-note">${htmlSafe(detail.person.first)} hasn’t sent it yet${left}.</p>` +
			'<button type="button" class="btn btn-outline-secondary" data-tsd-act="remind"><i class="bi bi-bell me-1" aria-hidden="true"></i>Send a reminder</button>'
		);
	}

	/* The entries table: a heading row per day, then that day's entries.
     Days off and unlogged days get the heading row alone. */

	function drawEntries() {
		const { sheet, person } = detail;
		const rows = [];
		for (const day of sheet.days) {
			if (day.kind === 'before' || (day.kind === 'rest' && !day.entries.length)) continue;
			rows.push(entryDayRow(day));
			if (day.kind === 'off' || day.kind === 'missing') continue;
			for (const entry of day.entries) rows.push(entryRow(entry));
		}
		detailPart('entries').innerHTML = rows.join('');
		detailPart('entries-foot').innerHTML =
			`<tr><th scope="row" colspan="3">Week total</th><td class="ts-entries-hours">${hoursText(sheet.total)}</td></tr>`;
		const entryCount = sumOf(sheet.days, (day) => day.entries.length);
		const loggedBy = nameFor(person) === VIEWER ? 'you' : person.first;
		detailPart('entries-sub').textContent =
			`${count(entryCount, 'entry', 'entries')} by day, as ${loggedBy} logged them.`;
		detailPart('caption').textContent = `Entries by day, ${weekSpan(sheet.week)}`;
	}

	function entryDayRow(day) {
		const looks = {
			off: () => [' is-quiet', ` · ${htmlSafe(day.reason)}`, 'Off'],
			missing: () => [' is-gap', ' · Not logged yet', '—'],
		};
		const [modifier, aside, figure] = looks[day.kind] ? looks[day.kind]() : ['', '', hoursText(day.hours)];
		const today = day.iso === ledger.TODAY ? ' is-today' : '';
		return `<tr class="ts-entries-day${modifier}${today}"><th scope="row" colspan="3"><span class="ts-entries-dayname">${htmlSafe(ledger.dayTitle(day.iso))}</span>${aside}</th><td class="ts-entries-hours">${figure}</td></tr>`;
	}

	/** One entry; the one just logged carries is-new for a brief flash. */
	function entryRow(entry) {
		const fresh = entry === detail.freshEntry ? ' class="is-new"' : '';
		const note = htmlSafe(entry.note);
		return `<tr${fresh}><td class="ts-entries-work">${htmlSafe(entry.name)}</td><td class="ts-entries-client">${htmlSafe(entry.client)}</td><td class="ts-entries-note" title="${note}">${note}</td><td class="ts-entries-hours">${hoursText(entry.hours)}</td></tr>`;
	}

	function drawProjects() {
		const { sheet } = detail;
		const projects = projectTotals(sheet);
		const longest = projects.length ? projects[0].hours : 1;
		detailPart('projects-sub').textContent = projects.length
			? `Where the ${withUnit(sheet.total)} went, most first.`
			: 'No hours logged this week.';
		detailPart('projects').innerHTML = projects
			.map((project, index) => projectBar(project, index, longest))
			.join('');
		const customerHours = sumOf(
			projects.filter((project) => [...project.clients].some((client) => client !== 'Internal')),
			(project) => project.hours,
		);
		let note = '';
		if (projects.length)
			note = customerHours
				? `${withUnit(customerHours)} of it was for customers.`
				: 'All of it was internal work.';
		detailPart('projects-note').textContent = note;
	}

	/** One ranked bar, scaled against the biggest project of the week. */
	function projectBar(project, index, longest) {
		const clients = [...project.clients];
		const forWhom = clients.length === 1 ? clients[0] : count(clients.length, 'customer');
		const share = Math.round((project.hours / (detail.sheet.total || 1)) * 100);
		const width = ((project.hours / longest) * 100).toFixed(1);
		return (
			`<li class="ts-bar"><span class="ts-bar-name">${htmlSafe(project.name)} <span class="ts-bar-client">· ${htmlSafe(forWhom)}</span></span>` +
			`<span class="ts-bar-hours">${withUnit(project.hours)} <span class="ts-quiet">${share}%</span></span>` +
			`<span class="ts-bar-track" aria-hidden="true"><span class="ts-bar-fill" style="width:${width}%;--ts-tone:var(--basalt-series-${(index % SERIES_SLOTS) + 1})"></span></span></li>`
		);
	}

	function drawHistory() {
		detailPart('history').innerHTML = [...detail.sheet.history]
			.reverse()
			.map((event) => feedItem(event))
			.join('');
	}

	function feedItem(event) {
		const { tone, icon } = FEED_LOOK[event.kind] || FEED_LOOK.created;
		const reason = event.reason ? `<p class="ts-feed-reason">${htmlSafe(event.reason)}</p>` : '';
		return (
			`<li class="ts-feed-item"${tone ? ` data-tone="${tone}"` : ''}><span class="ts-feed-mark" aria-hidden="true"><i class="bi ${icon}"></i></span>` +
			`<div class="ts-feed-body"><p class="ts-feed-text"><strong>${htmlSafe(actorName(event.who))}</strong> ${htmlSafe(event.text)}</p><p class="ts-feed-when">${htmlSafe(ledger.when(event.at))}</p>${reason}</div></li>`
		);
	}

	/* Detail page events: the decision buttons, the PDF, copying the link,
     and time logged from this page. */

	function onDetailClick(event) {
		const action = event.target.closest('[data-tsd-act]');
		if (action) {
			DETAIL_ACTIONS[action.getAttribute('data-tsd-act')]?.();
			return;
		}
		if (event.target.closest('[data-tsd-download]')) {
			notify({
				tone: 'success',
				icon: 'bi-download',
				title: 'PDF downloaded',
				text: `timesheet-${detail.sheet.id.toLowerCase()}-${detail.sheet.week}.pdf`,
			});
			return;
		}
		if (event.target.closest('[data-tsd-copy]')) copySheetLink();
	}

	function approveHere() {
		const { sheet, person } = detail;
		detail.undoApproval = approveSheets([sheet]);
		redrawDetail();
		focusWeekHeading();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Timesheet approved',
			text: `${nameFor(person)}, ${withUnit(sheet.total)} for the week of ${shortDate(sheet.week)}.`,
			actions: [
				undoAction(() => {
					if (detail.undoApproval) revertApproval();
				}),
			],
		});
	}

	function revertApproval() {
		detail.undoApproval();
		detail.undoApproval = null;
		redrawDetail();
	}

	/** The Undo approval button, which also tells screen readers. */
	function withdrawApproval() {
		if (!detail.undoApproval) return;
		revertApproval();
		speak('Approval undone. The timesheet is waiting again.');
		focusWeekHeading();
	}

	function rejectHere() {
		askToReject(detail.sheet, afterDetailReject);
	}

	function afterDetailReject() {
		redrawDetail();
		focusWeekHeading();
	}

	function sendReminder() {
		notify({
			tone: 'info',
			icon: 'bi-bell',
			title: 'Reminder sent',
			text: `${detail.person.first} gets an email and a phone notification to send the week.`,
		});
	}

	function copySheetLink() {
		const address = new URL(sheetLink(detail.sheet), location.href).href;
		navigator.clipboard?.writeText(address).catch(() => {});
		notify({
			tone: 'success',
			icon: 'bi-link-45deg',
			title: 'Link copied',
			text: 'Anyone with access to Timesheets can open it.',
		});
	}

	/** Redraws after Log time, flashing the new entry on this sheet. */
	function afterDetailLog(sheet, iso) {
		/* Hours logged into someone else's week appear on their own page. */
		if (sheet !== detail.sheet) return;
		const day = sheet.days.find((item) => item.iso === iso);
		const newest = day.entries[day.entries.length - 1];
		detail.freshEntry = newest && newest.added ? newest : null;
		detail.undoApproval = null;
		redrawDetail();
		detail.freshEntry = null;
		speak(`Logged on ${ledger.dayTitle(iso)}.`);
	}
})();
