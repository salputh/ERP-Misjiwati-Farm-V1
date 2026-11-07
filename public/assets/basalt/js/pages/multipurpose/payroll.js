/**
 * Payroll page (payroll.html): the monthly pay run. Approve the handful
 * of changes that make someone's pay differ from their usual salary,
 * approve the run itself, and look up any payslip or past run.
 *
 * Every figure on the page is worked out from the roster and from
 * OCTOBER_CHANGES below, so the run card, the people table and the
 * past runs can never disagree. In your own app, load the same fields
 * from your payroll provider and keep the drawing code as it is.
 */
(() => {
	'use strict';

	const stage = pick('[data-pr-root]');
	if (!stage) return;

	/* In a real deployment these come from the server and the clock. */
	const DEMO_DAY = '2026-10-09';
	const PAY_YEAR = 2026;
	const RUN_MONTH = 10;
	const APPROVAL_DEADLINE = '2026-10-23';
	const TRANSFER_DAY = '2026-10-26';
	const PAY_ACCOUNT = '7730';
	const SIGNED_IN = 'John Armstrong';

	/* How many rows show before "Show everyone" and "Show all runs". */
	const PAGE_SIZE = 10;
	const PAST_PAGE_SIZE = 4;

	/* Every payslip takes income tax and pension as a share of gross pay,
     plus a flat health cover premium each month. */
	const TAX_SHARE = 0.15;
	const PENSION_SHARE = 0.05;
	const HEALTH_PREMIUM = 180;

	const MONTH_NAMES = [
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
	const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	const CHANGE_KINDS = {
		starter: 'New starter',
		leaver: 'Leaving',
		raise: 'Pay rise',
		commission: 'Commission',
		oncall: 'On-call',
		bank: 'Bank details',
		bonus: 'Bonus',
		allowance: 'Allowance',
		deduction: 'Deduction',
	};

	/* Everyone comes from Fieldline's single roster (data/multipurpose/people.js), with
     the same teams, colors and staff numbers as Employees and Time Off,
     plus a monthly gross salary. `start` drives the first, part-month
     payslip and `end` (a leaver's last day) the last one; `was` is an
     earlier salary and the last month it applied. People who left
     earlier in the year stay on for their old payslips. */
	const roster = window.Basalt.data.people;
	const lastDayOfRun = `${PAY_YEAR}-${String(RUN_MONTH).padStart(2, '0')}-31`;
	const staff = roster.people
		.filter(
			(person) =>
				person.staffed !== false &&
				person.start <= lastDayOfRun &&
				(!person.left || person.left >= `${PAY_YEAR}-01-01`),
		)
		.map((person) => ({
			id: person.staff,
			first: person.first,
			last: person.last,
			team: person.team,
			role: person.title,
			start: person.start,
			end: person.left || person.lastDay || '',
			salary: person.salary,
			was: person.was,
		}));

	/* Whatever makes someone's October pay differ from the usual salary.
     `note` is the one line in the table and `line` the fuller sentence
     in the quick view. `extra` is added to gross pay (taken off when
     negative) and shows as its own payslip line. `status` is todo,
     approved, or skipped (moved to the November run). */
	const OCTOBER_CHANGES = [
		{
			id: 'c1',
			who: staffNumber('op'),
			kind: 'leaver',
			status: 'todo',
			extra: 904.62,
			extraLabel: 'Unused leave, 4 days',
			note: 'Leaves Oct 23, 4 days paid out',
			line: 'Last day Oct 23, with 4 unused leave days paid out.',
			facts: [
				['Last day', 'Fri, Oct 23, 2026'],
				['Unused leave', '4 days at $226.15 a day'],
				['Leave balance', '<a href="time-off.html">From Time Off</a>'],
				['Open leads', 'Handed to Quentin Cook'],
			],
		},
		{
			id: 'c2',
			who: staffNumber('yh'),
			kind: 'raise',
			status: 'todo',
			extra: 0,
			note: 'From $6,400 to $6,900 a month',
			line: 'Promoted to senior support specialist, from $6,400 to $6,900.',
			facts: [
				['Was', '$6,400.00 a month'],
				['Now', '$6,900.00 a month, from Oct 1'],
				['Approved by', 'Connie Reese on Sep 29'],
			],
		},
		{
			id: 'c3',
			who: staffNumber('lf'),
			kind: 'commission',
			status: 'todo',
			extra: 1840,
			extraLabel: 'Q3 commission',
			note: 'Q3 add-on sales, three accounts',
			line: 'Q3 commission on add-on sales for three accounts.',
			facts: [
				['Accounts', 'Rainier Mobility, Valley Pet Care, Northbrook Cleaning'],
				['Rate', '4% of $46,000 in add-on orders'],
				['Signed off by', 'Rowan Walsh on Oct 2'],
			],
		},
		{
			id: 'c4',
			who: staffNumber('cm'),
			kind: 'bank',
			status: 'todo',
			extra: 0,
			note: 'New account, not confirmed yet',
			line: 'New bank account added on Oct 6, not confirmed yet. Skipping it pays her to the old account this month.',
			facts: [
				['Old account', '···2291'],
				['New account', '···8054, added Oct 6'],
				['Confirmation', 'Code sent to her phone on Oct 6'],
			],
		},
		{
			id: 'c5',
			who: staffNumber('ak'),
			kind: 'starter',
			status: 'approved',
			extra: 0,
			by: SIGNED_IN,
			on: '2026-10-06',
			note: 'Starts Oct 12, paid 15 of 22 days',
			line: 'Starts Oct 12, paid for 15 of 22 working days.',
			facts: [
				['Starts', 'Mon, Oct 12, 2026'],
				['Contract', 'Full-time, $8,900.00 a month'],
				['Bank details', 'Confirmed on Oct 2'],
			],
		},
		{
			id: 'c6',
			who: staffNumber('wa'),
			kind: 'starter',
			status: 'approved',
			extra: 0,
			by: SIGNED_IN,
			on: '2026-10-07',
			note: 'Starts Oct 12, paid 15 of 22 days',
			line: 'Starts Oct 12, paid for 15 of 22 working days.',
			facts: [
				['Starts', 'Mon, Oct 12, 2026'],
				['Contract', 'Full-time, $5,800.00 a month'],
				['Bank details', 'Confirmed on Sep 30'],
			],
		},
		{
			id: 'c7',
			who: staffNumber('si'),
			kind: 'starter',
			status: 'todo',
			extra: 0,
			note: 'Starts Oct 19, paid 10 of 22 days',
			line: 'Starts Oct 19, paid for 10 of 22 working days.',
			facts: [
				['Starts', 'Mon, Oct 19, 2026'],
				['Contract', 'Full-time, $5,200.00 a month'],
				['Bank details', 'Confirmed on Oct 5'],
			],
		},
		{
			id: 'c8',
			who: staffNumber('ka'),
			kind: 'oncall',
			status: 'approved',
			extra: 540,
			extraLabel: 'On-call, 6 shifts',
			by: SIGNED_IN,
			on: '2026-10-07',
			note: 'Six weekend shifts in September',
			line: 'Six weekend on-call shifts in September, $90 each.',
			facts: [
				['Shifts', '6 weekend shifts in September'],
				['Rate', '$90.00 a shift'],
				['Logged in', '<a href="shifts.html">Shifts</a>'],
			],
		},
	];

	/* The working copy of the changes, and the number the next one gets. */
	const changeList = OCTOBER_CHANGES.map((change) => ({ ...change }));
	let changeCounter = 9;

	const view = {
		approved: false,
		selected: new Set(),
		showHandled: false,
		query: '',
		team: '',
		everyone: false,
		allRuns: false,
		changeOpen: null,
		slipOpen: null,
		runOpen: null,
	};
	let findDelay;

	const ui = {
		runBadge: pick('[data-pr-run-pill]'),
		runNote: pick('[data-pr-run-sub]'),
		approveButton: pick('[data-pr-approve]'),
		reviewRows: pick('[data-pr-review]'),
		reviewTable: pick('.pr-table-review'),
		reviewNote: pick('[data-pr-review-sub]'),
		reviewEmpty: pick('[data-pr-review-empty]'),
		selectAll: pick('[data-pr-pick-all]'),
		approveSelected: pick('[data-pr-approve-picked]'),
		handledWrap: pick('[data-pr-done-wrap]'),
		handledLine: pick('[data-pr-done-line]'),
		handledToggle: pick('[data-pr-show-done]'),
		peopleRows: pick('[data-pr-people]'),
		peopleTable: pick('.pr-table-people'),
		peopleEmpty: pick('[data-pr-people-empty]'),
		peopleMore: pick('[data-pr-people-more]'),
		peopleRange: pick('[data-pr-people-range]'),
		peopleAll: pick('[data-pr-people-all]'),
		search: pick('[data-pr-search]'),
		teamSelect: pick('[data-pr-team]'),
		pastRows: pick('[data-pr-past]'),
		pastMore: pick('[data-pr-past-more]'),
		pastRange: pick('[data-pr-past-range]'),
		pastAll: pick('[data-pr-past-all]'),
		changeDrawer: pick('#pr-change'),
		slipDrawer: pick('#pr-slip'),
		runDrawer: pick('#pr-past'),
		addDrawer: pick('#pr-add'),
		addForm: pick('[data-pr-form]'),
		approveModal: pick('#pr-approve'),
		personSelect: pick('[data-pr-add-who]'),
		amountField: pick('[data-pr-add-amount]'),
		reasonField: pick('[data-pr-add-note]'),
	};

	/**
	 * Fills the person picker, wires every control and draws the page.
	 * Called once at the bottom of the file.
	 */
	function start() {
		const payable = staff
			.filter((person) => payslipFor(person, RUN_MONTH))
			.sort((a, b) => wholeName(a).localeCompare(wholeName(b)));
		ui.personSelect.insertAdjacentHTML(
			'beforeend',
			payable
				.map(
					(person) =>
						`<option value="${person.id}" data-hint="${safe(person.team)}">${safe(wholeName(person))}</option>`,
				)
				.join(''),
		);
		refreshSelect(ui.personSelect);

		stage.addEventListener('click', onStageClick);
		stage.addEventListener('auxclick', (event) => {
			const row = event.button === 1 && event.target.closest('tr[data-person]');
			if (row && !event.target.closest('a, button')) navigateTo(pick('.pr-who-name', row).href, event);
		});
		stage.addEventListener('change', onStageChange);
		ui.changeDrawer.addEventListener('click', onChangeDrawerClick);
		ui.slipDrawer.addEventListener('click', (event) => {
			if (!event.target.closest('[data-pr-s-download]')) return;
			const person = personById(view.slipOpen);
			notify({
				tone: 'success',
				icon: 'bi-download',
				title: 'Payslip downloaded',
				text: `payslip-${person.id.toLowerCase()}-${PAY_YEAR}-${String(RUN_MONTH).padStart(2, '0')}.pdf`,
			});
		});
		ui.runDrawer.addEventListener('click', (event) => {
			if (event.target.closest('[data-pr-r-download]')) requestRunZip(view.runOpen);
		});
		ui.search.addEventListener('input', () => {
			clearTimeout(findDelay);
			findDelay = setTimeout(() => {
				view.query = ui.search.value;
				view.everyone = false;
				paintPeople();
			}, 150);
		});
		ui.teamSelect.addEventListener('change', () => {
			view.team = ui.teamSelect.value;
			view.everyone = false;
			paintPeople();
		});
		wireAddForm();
		paintAll();
	}

	/* Small helpers shared by every section. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function safe(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (ch) => swap[ch]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	function refreshSelect(select) {
		window.Basalt.select?.refresh?.(select);
	}

	function refreshTips(scope) {
		window.Basalt.tips?.(scope);
	}

	function offcanvasFor(node) {
		return bootstrap.Offcanvas.getOrCreateInstance(node);
	}

	function approveDialog() {
		return bootstrap.Modal.getOrCreateInstance(ui.approveModal);
	}

	function roundMoney(value) {
		return Math.round(value * 100) / 100;
	}

	function dollars(value) {
		const digits = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return `${value < 0 ? '−$' : '$'}${digits}`;
	}

	/** Lists round to whole dollars; the payslip itself keeps the cents. */
	function wholeDollars(value) {
		return `${value < 0 ? '−$' : '$'}${Math.round(Math.abs(value)).toLocaleString('en-US')}`;
	}

	function counted(count, singular, plural) {
		return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
	}

	function sumOf(list, read) {
		return list.reduce((total, item) => total + read(item), 0);
	}

	function toDate(iso) {
		const [year, month, dayNumber] = iso.split('-').map(Number);
		return new Date(year, month - 1, dayNumber);
	}

	function toIso(date) {
		const pad = (n) => String(n).padStart(2, '0');
		return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
	}

	function shortDate(iso) {
		const date = toDate(iso);
		return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
	}

	function weekdayDate(iso) {
		return `${WEEKDAY_ABBR[toDate(iso).getDay()]}, ${shortDate(iso)}`;
	}

	function inMonth(iso, month) {
		if (!iso) return false;
		const date = toDate(iso);
		return date.getFullYear() === PAY_YEAR && date.getMonth() === month - 1;
	}

	function tooltipAttrs(label) {
		return ` data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${label}"`;
	}

	function badge(tone, label) {
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`;
	}

	/* People. */

	function teamById(id) {
		return roster.teams.find((team) => team.id === id);
	}

	function staffNumber(shortId) {
		return roster.recordWithId(shortId).staff;
	}

	function personById(id) {
		return staff.find((person) => person.id === id);
	}

	function wholeName(person) {
		return `${person.first} ${person.last}`;
	}

	function initialsOf(person) {
		return `${person.first.charAt(0)}${person.last.charAt(0)}`.toUpperCase();
	}

	function profileHref(person) {
		return `employee-details.html?id=${encodeURIComponent(person.id)}`;
	}

	/** The last four digits of the account each person is paid into. */
	function payAccountOf(person) {
		return String(7 * Number(person.id.replace(/\D/g, '')) * 131 + 1000).slice(-4);
	}

	function avatarMarkup(person) {
		return `<span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${teamById(person.team).tone}" aria-hidden="true">${safe(initialsOf(person))}</span>`;
	}

	/** Avatar plus the name, which links to the person's full page. */
	function personMarkup(person) {
		return `<span class="pr-who">${avatarMarkup(person)}<a class="pr-who-name" href="${profileHref(person)}">${safe(wholeName(person))}</a></span>`;
	}

	/* Calendar arithmetic for pay. */

	function monthLength(month) {
		return new Date(PAY_YEAR, month, 0).getDate();
	}

	function weekdaysIn(month, fromDay, toDay) {
		let total = 0;
		for (let dayNumber = fromDay || 1; dayNumber <= (toDay || monthLength(month)); dayNumber++) {
			const weekday = new Date(PAY_YEAR, month - 1, dayNumber).getDay();
			if (weekday !== 0 && weekday !== 6) total++;
		}
		return total;
	}

	/** Payday is the 28th, or the Friday before when that is a weekend. */
	function paydayOf(month) {
		const date = new Date(PAY_YEAR, month - 1, 28);
		while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
		return toIso(date);
	}

	/* Changes, by status. */

	function openChanges() {
		return changeList.filter((change) => change.status === 'todo');
	}

	function handledChanges() {
		return changeList.filter((change) => change.status !== 'todo');
	}

	/** The changes that count toward October: all but the ones skipped. */
	function countingChanges(person) {
		return changeList.filter((change) => change.who === person.id && change.status !== 'skipped');
	}

	function changeById(id) {
		return changeList.find((change) => change.id === id);
	}

	/* Payslips: one person's pay for one month. The base salary (part of it
     in the months they start and leave), any changes in the open run,
     then the deductions. */

	function payslipFor(person, month) {
		const started = toDate(person.start);
		const ended = person.end ? toDate(person.end) : null;
		if (started > new Date(PAY_YEAR, month - 1, monthLength(month))) return null;
		if (ended && ended < new Date(PAY_YEAR, month - 1, 1)) return null;

		const raiseSkipped =
			month === RUN_MONTH &&
			changeList.some(
				(change) => change.who === person.id && change.kind === 'raise' && change.status === 'skipped',
			);
		const salary = person.was && (month <= person.was.until || raiseSkipped) ? person.was.salary : person.salary;
		const firstDay = inMonth(person.start, month) ? started.getDate() : 1;
		const finalDay = person.end && inMonth(person.end, month) ? ended.getDate() : monthLength(month);
		const earnings = [];

		if (firstDay > 1 || finalDay < monthLength(month)) {
			const worked = weekdaysIn(month, firstDay, finalDay);
			const possible = weekdaysIn(month);
			earnings.push({
				label: `Base salary, ${worked} of ${possible} days`,
				amount: roundMoney((salary * worked) / possible),
			});
		} else {
			earnings.push({ label: 'Base salary', amount: salary });
		}

		if (month === RUN_MONTH) {
			for (const change of countingChanges(person)) {
				if (change.extra)
					earnings.push({ label: change.extraLabel || CHANGE_KINDS[change.kind], amount: change.extra });
			}
		}

		const gross = roundMoney(sumOf(earnings, (line) => line.amount));
		const deductions = [
			{ label: 'Income tax, 15%', amount: roundMoney(gross * TAX_SHARE) },
			{ label: 'Pension, 5%', amount: roundMoney(gross * PENSION_SHARE) },
			{ label: 'Health cover', amount: HEALTH_PREMIUM },
		];
		const ded = roundMoney(sumOf(deductions, (line) => line.amount));
		return { p: person, m: month, earnings, gross, deductions, ded, net: roundMoney(gross - ded) };
	}

	function payslipsFor(month) {
		return staff.map((person) => payslipFor(person, month)).filter(Boolean);
	}

	function runSummary(month) {
		const slips = payslipsFor(month);
		const total = (key) => roundMoney(sumOf(slips, (slip) => slip[key]));
		return {
			slips,
			people: slips.length,
			gross: total('gross'),
			ded: total('ded'),
			net: total('net'),
			starters: slips.filter((slip) => inMonth(slip.p.start, month)).length,
			leavers: slips.filter((slip) => inMonth(slip.p.end, month)).length,
		};
	}

	/* The open run card. */

	function paintRun() {
		const summary = runSummary(RUN_MONTH);
		const left = openChanges().length;
		ui.runBadge.innerHTML = view.approved ? badge('success', 'Approved') : badge('info', 'Draft');
		ui.runNote.textContent = view.approved
			? `Approved. Transfers leave on ${shortDate(TRANSFER_DAY)} and payslips go out on payday.`
			: `Approve by ${weekdayDate(APPROVAL_DEADLINE)} so transfers leave on ${shortDate(TRANSFER_DAY)}.`;

		const facts = {
			gross: wholeDollars(summary.gross),
			pay: weekdayDate(paydayOf(RUN_MONTH)),
			period: `Oct 1 – ${monthLength(RUN_MONTH)}`,
			people: String(summary.people),
			net: wholeDollars(summary.net),
			left:
				view.approved || !left
					? 'None'
					: `<a href="#pr-review" data-pr-to-review>${counted(left, 'change')}</a>`,
		};
		for (const [key, html] of Object.entries(facts)) {
			pick(`[data-pr-run="${key}"]`).innerHTML = html;
		}

		ui.approveButton.classList.toggle('btn-primary', !view.approved);
		ui.approveButton.classList.toggle('btn-outline-secondary', view.approved);
		pick('[data-pr-approve-label]', ui.approveButton).textContent = view.approved ? 'Undo approval' : 'Approve run';
		pick('.bi', ui.approveButton).className =
			`bi ${view.approved ? 'bi-arrow-counterclockwise' : 'bi-check2-circle'} me-1`;
	}

	/* "Needs a look": the changes table. */

	function handledBadge(change) {
		return change.status === 'approved' ? badge('success', 'Approved') : badge('', 'Moved to Nov');
	}

	function reviewButtons(change) {
		const who = safe(wholeName(personById(change.who)));
		const what = safe(CHANGE_KINDS[change.kind].toLowerCase());
		if (change.status === 'todo') {
			if (view.approved) return '';
			return `<span class="pr-acts"><button type="button" class="btn btn-outline-secondary btn-sm" data-pr-act="skip" aria-label="Skip to November: ${who}, ${what}"${tooltipAttrs('Move to the November run')}>Skip</button><button type="button" class="btn btn-outline-primary btn-sm" data-pr-act="approve" aria-label="Approve: ${who}, ${what}">Approve</button></span>`;
		}
		const undo = view.approved
			? ''
			: `<button type="button" class="btn btn-icon btn-sm" data-pr-act="undo" aria-label="Undo for ${who}"${tooltipAttrs('Undo')}><i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i></button>`;
		return `<span class="pr-acts">${handledBadge(change)}${undo}</span>`;
	}

	function changeRowMarkup(change) {
		const person = personById(change.who);
		const pending = change.status === 'todo';
		const checkbox =
			pending && !view.approved
				? `<input class="form-check-input" type="checkbox" aria-label="Select ${safe(wholeName(person))}" data-pr-pick="${change.id}"${view.selected.has(change.id) ? ' checked' : ''}>`
				: '';
		const cells = [
			`<td class="pr-pick" data-cell="pick">${checkbox}</td>`,
			`<td data-cell="who">${personMarkup(person)}</td>`,
			`<td data-cell="kind"><button type="button" class="pr-open" data-pr-open-change="${change.id}">${CHANGE_KINDS[change.kind]}</button></td>`,
			`<td data-cell="note" class="pr-note" title="${safe(change.note)}">${safe(change.note)}</td>`,
			`<td data-cell="act" class="text-end">${reviewButtons(change)}</td>`,
		];
		return `<tr data-change="${change.id}"${pending ? '' : ' class="is-done"'}>${cells.join('')}</tr>`;
	}

	function drawReview() {
		const open = openChanges();
		const handled = handledChanges();

		for (const id of [...view.selected]) {
			if (view.approved || !open.some((change) => change.id === id)) view.selected.delete(id);
		}

		const rows = view.showHandled ? [...open, ...handled] : open;
		ui.reviewRows.innerHTML = rows.map(changeRowMarkup).join('');
		refreshTips(ui.reviewRows);
		ui.reviewTable.hidden = !rows.length;
		ui.reviewEmpty.hidden = Boolean(rows.length);
		pick('[data-pr-review-empty-title]').textContent = view.approved
			? 'The run is approved'
			: 'Nothing left to check';
		pick('[data-pr-review-empty-text]').textContent = view.approved
			? 'Changes are locked until payday. Undo the approval to change one.'
			: 'Every change is approved or moved to November. The run is ready to approve.';
		if (view.approved) ui.reviewNote.textContent = 'Locked while the run is approved.';
		else if (open.length)
			ui.reviewNote.textContent =
				'Pay that differs from the usual salary. Approve each one, or skip it to November.';
		else ui.reviewNote.textContent = 'Pay that differs from the usual salary, all handled.';

		const picked = view.selected.size;
		ui.selectAll.disabled = !open.length || view.approved;
		ui.selectAll.checked = Boolean(open.length) && picked === open.length;
		ui.selectAll.indeterminate = picked > 0 && picked < open.length;
		ui.approveSelected.hidden = !picked;
		pick('[data-pr-picked-label]', ui.approveSelected).textContent = `Approve ${picked} selected`;

		ui.handledWrap.hidden = !handled.length;
		ui.handledLine.textContent = `${counted(handled.length, 'change')} already handled`;
		ui.handledToggle.textContent = view.showHandled ? 'Hide them' : 'Show them';
		ui.handledToggle.setAttribute('aria-expanded', String(view.showHandled));
	}

	/* "People in this run". */

	function personBadge(person) {
		const mine = countingChanges(person);
		if (!mine.length) return '<span class="pr-quiet">As usual</span>';
		if (mine.some((change) => change.kind === 'starter')) return badge('primary', 'New starter');
		if (mine.some((change) => change.kind === 'leaver')) return badge('warning', 'Leaving');
		return badge('info', 'Changed');
	}

	function matchingSlips() {
		const query = view.query.trim();
		const matcher = window.Basalt?.matchesQuery;
		const fits = (slip) => {
			if (!query) return true;
			const haystack = `${wholeName(slip.p)} ${slip.p.role} ${slip.p.id}`;
			return matcher ? matcher(haystack, query) : haystack.toLowerCase().includes(query.toLowerCase());
		};
		return payslipsFor(RUN_MONTH)
			.filter((slip) => !view.team || slip.p.team === view.team)
			.filter(fits)
			.sort((a, b) => wholeName(a.p).localeCompare(wholeName(b.p)));
	}

	function personRowMarkup(slip) {
		const person = slip.p;
		const cells = [
			`<td data-cell="who">${personMarkup(person)}</td>`,
			`<td data-cell="team">${safe(person.team)}</td>`,
			`<td data-cell="gross" class="text-end pr-num">${wholeDollars(slip.gross)}</td>`,
			`<td data-cell="net" class="text-end pr-num">${wholeDollars(slip.net)}</td>`,
			`<td data-cell="status">${personBadge(person)}</td>`,
			`<td data-cell="go" class="text-end"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-pr-open-slip="${person.id}" aria-label="Quick view: ${safe(wholeName(person))}’s payslip"${tooltipAttrs('Quick view')}><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button></span></td>`,
		];
		return `<tr data-person="${person.id}">${cells.join('')}</tr>`;
	}

	function paintPeople() {
		const everyone = payslipsFor(RUN_MONTH);
		const matching = matchingSlips();
		const shown = view.everyone ? matching : matching.slice(0, PAGE_SIZE);
		pick('[data-pr-people-sub]').textContent = `${everyone.length} people, A to Z. Open a row for their full page.`;
		ui.peopleRows.innerHTML = shown.map(personRowMarkup).join('');
		refreshTips(ui.peopleRows);
		ui.peopleTable.hidden = !matching.length;
		ui.peopleEmpty.hidden = Boolean(matching.length);
		ui.peopleMore.hidden = !matching.length;
		ui.peopleRange.innerHTML =
			matching.length > shown.length
				? `Showing <strong>${shown.length}</strong> of ${counted(matching.length, 'person', 'people')}`
				: counted(matching.length, 'person', 'people');
		ui.peopleAll.hidden = matching.length <= shown.length;
		ui.peopleAll.textContent = `Show all ${matching.length}`;
	}

	/* "Past runs". */

	function pastRunRowMarkup(run) {
		const monthName = MONTH_NAMES[run.m - 1];
		const cells = [
			`<td data-cell="month"><button type="button" class="pr-open" data-pr-open-run="${run.m}">${monthName}</button></td>`,
			`<td data-cell="paid">${weekdayDate(paydayOf(run.m))}</td>`,
			`<td data-cell="people" class="text-end pr-num">${run.people}</td>`,
			`<td data-cell="gross" class="text-end pr-num">${wholeDollars(run.gross)}</td>`,
			`<td data-cell="net" class="text-end pr-num">${wholeDollars(run.net)}</td>`,
			`<td data-cell="go" class="text-end"><button type="button" class="btn btn-icon btn-sm" data-pr-download-run="${run.m}" aria-label="Download ${monthName} payslips"${tooltipAttrs('Download payslips')}><i class="bi bi-download" aria-hidden="true"></i></button></td>`,
		];
		return `<tr data-run="${run.m}">${cells.join('')}</tr>`;
	}

	function paintPast() {
		const runs = [];
		for (let month = RUN_MONTH - 1; month >= 1; month--) {
			runs.push({ m: month, ...runSummary(month) });
		}
		const shown = view.allRuns ? runs : runs.slice(0, PAST_PAGE_SIZE);
		const paidOut = sumOf(runs, (run) => run.gross);
		pick('[data-pr-past-sub]').textContent =
			`$${(paidOut / 1e6).toFixed(2)}M gross paid in ${runs.length} runs since January.`;
		ui.pastRows.innerHTML = shown.map(pastRunRowMarkup).join('');
		refreshTips(ui.pastRows);
		ui.pastRange.textContent =
			shown.length < runs.length ? `Showing ${shown.length} of ${runs.length} runs` : counted(runs.length, 'run');
		ui.pastAll.hidden = shown.length >= runs.length;
		ui.pastAll.textContent = `Show all ${runs.length}`;
	}

	function paintAll() {
		paintRun();
		drawReview();
		paintPeople();
		paintPast();
		if (view.changeOpen && ui.changeDrawer.classList.contains('show')) paintChangeDrawer();
	}

	/* Approving, skipping and undoing. Each action stays on its row: the
     row leaves the list, a toast offers Undo, and nothing else opens. */

	/** Sets a status on each change and returns a function that puts
      everything back. */
	function markChanges(list, status) {
		const before = list.map((change) => ({ change, status: change.status, by: change.by, on: change.on }));

		for (const change of list) {
			change.status = status;
			change.by = status === 'todo' ? undefined : SIGNED_IN;
			change.on = status === 'todo' ? undefined : DEMO_DAY;
		}

		return () => {
			for (const was of before) {
				was.change.status = was.status;
				was.change.by = was.by;
				was.change.on = was.on;
			}

			paintAll();
		};
	}

	/** Once a row has gone, focus the next open row's Approve, or the title. */
	function focusRowAfter(rowIndex) {
		const rows = pickAll('tr', ui.reviewRows);
		const next = rows[Math.min(rowIndex, rows.length - 1)];
		const button = next && pick('[data-pr-act]', next);
		(button || pick('#pr-review-title')).focus({ preventScroll: true });
	}

	function handleChange(change, action, fromDrawer) {
		const person = personById(change.who);
		const rowIndex = pickAll('tr', ui.reviewRows).findIndex((row) => row.getAttribute('data-change') === change.id);
		const statusFor = { approve: 'approved', skip: 'skipped' };
		const undo = markChanges([change], statusFor[action] ?? 'todo');
		view.selected.delete(change.id);
		if (fromDrawer) offcanvasFor(ui.changeDrawer).hide();
		paintAll();
		if (!fromDrawer) focusRowAfter(Math.max(0, rowIndex));

		const left = openChanges().length;
		const what = `${wholeName(person)}, ${CHANGE_KINDS[change.kind].toLowerCase()}`;
		if (action === 'undo') {
			sayAloud(`Back to the list: ${what}.`);
			return;
		}
		const approving = action === 'approve';
		notify({
			tone: approving ? 'success' : 'info',
			icon: approving ? 'bi-check2-circle' : 'bi-skip-forward',
			title: approving ? 'Change approved' : 'Moved to November',
			text: `${what}${approving ? '. ' : ', is off the October run. '}${left ? `${counted(left, 'change')} left to check.` : 'The run is ready to approve.'}`,
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}

	function approveSelected() {
		const list = changeList.filter((change) => view.selected.has(change.id));
		if (!list.length) return;
		const undo = markChanges(list, 'approved');
		view.selected.clear();
		paintAll();
		pick('#pr-review-title').focus({ preventScroll: true });
		const left = openChanges().length;
		notify({
			tone: 'success',
			icon: 'bi-check2-all',
			title: `${counted(list.length, 'change')} approved`,
			text: left ? `${counted(left, 'change')} left to check.` : 'The run is ready to approve.',
			actions: [{ label: 'Undo', onClick: undo }],
		});
	}

	/* The payslip block shared by the drawers. */

	function payslipMarkup(slip, withDeductions) {
		const lineItems = (list, sign) =>
			list
				.map((line) => `<li><span>${safe(line.label)}</span><span>${sign}${dollars(line.amount)}</span></li>`)
				.join('');
		let html = `<div class="pr-slip"><p class="pr-slip-group">Earnings</p><ul class="pr-slip-lines">${lineItems(slip.earnings, '')}</ul><p class="pr-slip-total"><span>Gross pay</span><span>${dollars(slip.gross)}</span></p>`;
		if (withDeductions) {
			html += `<p class="pr-slip-group">Deductions</p><ul class="pr-slip-lines">${lineItems(slip.deductions, '−')}</ul><p class="pr-slip-total"><span>Total deductions</span><span>−${dollars(slip.ded)}</span></p><p class="pr-slip-net"><span>Net pay</span><span>${dollars(slip.net)}</span></p>`;
		}
		return `${html}</div>`;
	}

	function factsMarkup(pairs) {
		return pairs
			.map(
				([term, value]) => `<dt>${safe(term)}</dt><dd>${value.indexOf('<a ') === 0 ? value : safe(value)}</dd>`,
			)
			.join('');
	}

	/* The change drawer. */

	function changeSlot(key) {
		return pick(`[data-pr-c="${key}"]`, ui.changeDrawer);
	}

	function changeStateMarkup(change) {
		let text;
		if (change.status === 'approved')
			text = `Approved by ${change.by === SIGNED_IN ? 'you' : change.by} on ${shortDate(change.on)}.`;
		else if (change.status === 'skipped') text = 'Moved to the November run. October pays as usual.';
		else text = 'Waiting for you to check it.';
		if (view.approved) text += ' The run is approved, so this is locked.';
		const status = change.status === 'todo' ? badge('warning', 'To check') : handledBadge(change);
		return `<div class="pr-d-state">${status}<p class="pr-d-text">${safe(text)}</p></div>`;
	}

	function changeButtons(change) {
		if (view.approved)
			return '<button type="button" class="btn btn-outline-secondary" data-bs-dismiss="offcanvas">Close</button>';
		if (change.status === 'todo') {
			return `<button type="button" class="btn btn-outline-secondary" data-pr-c-act="skip">Skip to November</button><button type="button" class="btn btn-primary" data-pr-c-act="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>`;
		}
		const verb = change.added ? 'remove' : 'undo';
		return `<button type="button" class="btn btn-outline-secondary" data-pr-c-act="${verb}">${change.added ? 'Remove' : 'Undo'}</button><button type="button" class="btn btn-primary" data-bs-dismiss="offcanvas">Close</button>`;
	}

	function paintChangeDrawer() {
		const change = changeById(view.changeOpen);
		if (!change) return;
		const person = personById(change.who);
		changeSlot('title').textContent = wholeName(person);
		changeSlot('sub').textContent = `${CHANGE_KINDS[change.kind]} · ${person.role}`;
		const facts = factsMarkup(change.facts || []);
		const sections = [
			changeStateMarkup(change),
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">What changed</h3><p class="pr-d-text">${safe(change.line)}</p>${facts ? `<dl class="pr-d-facts">${facts}</dl>` : ''}</section>`,
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">October pay</h3>${payslipMarkup(payslipFor(person, RUN_MONTH), false)}<p class="pr-d-note">Usual monthly salary ${dollars(person.salary)}.</p></section>`,
		];
		changeSlot('body').innerHTML = sections.join('');
		changeSlot('foot').innerHTML = changeButtons(change);
	}

	function openChangeDrawer(id) {
		view.changeOpen = id;
		paintChangeDrawer();
		offcanvasFor(ui.changeDrawer).show();
	}

	function onChangeDrawerClick(event) {
		const button = event.target.closest('[data-pr-c-act]');
		if (!button) return;
		const change = changeById(view.changeOpen);
		if (!change) return;
		const verb = button.getAttribute('data-pr-c-act');
		if (verb === 'remove') removeAddedChange(change);
		else handleChange(change, verb, true);
	}

	function removeAddedChange(change) {
		const at = changeList.indexOf(change);
		const person = personById(change.who);
		changeList.splice(at, 1);
		offcanvasFor(ui.changeDrawer).hide();
		paintAll();
		notify({
			tone: 'info',
			icon: 'bi-trash3',
			title: 'Change removed',
			text: `${CHANGE_KINDS[change.kind]} for ${wholeName(person)} is off the October run.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						changeList.splice(at, 0, change);
						paintAll();
					},
				},
			],
		});
	}

	/* The payslip drawer. */

	function slipSlot(key) {
		return pick(`[data-pr-s="${key}"]`, ui.slipDrawer);
	}

	function yearToDate(person) {
		const totals = { gross: 0, tax: 0, net: 0 };
		for (let month = 1; month <= RUN_MONTH; month++) {
			const slip = payslipFor(person, month);
			if (!slip) continue;
			totals.gross += slip.gross;
			totals.tax += slip.deductions[0].amount;
			totals.net += slip.net;
		}
		return { gross: roundMoney(totals.gross), tax: roundMoney(totals.tax), net: roundMoney(totals.net) };
	}

	function paintSlipDrawer() {
		const person = personById(view.slipOpen);
		const slip = payslipFor(person, RUN_MONTH);
		const ytd = yearToDate(person);
		slipSlot('title').textContent = wholeName(person);
		slipSlot('sub').textContent = `${person.role} · ${person.team}`;
		slipSlot('profile').setAttribute('href', `payslip-details.html?id=${encodeURIComponent(person.id)}`);
		const state = view.approved ? badge('success', 'Approved') : badge('info', 'Draft');
		const when = `Goes to account ···${payAccountOf(person)} on ${weekdayDate(paydayOf(RUN_MONTH))}${view.approved ? '.' : ', once the run is approved.'}`;
		const sections = [
			`<div class="pr-d-state">${state}<p class="pr-d-text">${when}</p></div>`,
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">October pay</h3>${payslipMarkup(slip, true)}</section>`,
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Year to date</h3><dl class="pr-d-facts"><dt>Gross pay</dt><dd>${dollars(ytd.gross)}</dd><dt>Income tax</dt><dd>${dollars(ytd.tax)}</dd><dt>Net pay</dt><dd>${dollars(ytd.net)}</dd><dt>Staff number</dt><dd>${safe(person.id)}</dd></dl></section>`,
		];
		slipSlot('body').innerHTML = sections.join('');
	}

	function openSlipDrawer(id) {
		view.slipOpen = id;
		paintSlipDrawer();
		offcanvasFor(ui.slipDrawer).show();
	}

	/* The past run drawer. */

	function runSlot(key) {
		return pick(`[data-pr-r="${key}"]`, ui.runDrawer);
	}

	function openRunDrawer(month) {
		view.runOpen = month;
		const summary = runSummary(month);
		runSlot('title').textContent = `${MONTH_NAMES[month - 1]} run`;
		runSlot('sub').textContent = `Paid on ${weekdayDate(paydayOf(month))}, ${PAY_YEAR}`;
		const sections = [
			`<div class="pr-d-state">${badge('success', 'Paid')}<p class="pr-d-text">${counted(summary.people, 'payslip')} paid from Payroll Account ···${PAY_ACCOUNT}.</p></div>`,
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">Totals</h3><dl class="pr-d-facts"><dt>Gross pay</dt><dd>${dollars(summary.gross)}</dd><dt>Deductions</dt><dd>−${dollars(summary.ded)}</dd><dt>Net pay</dt><dd>${dollars(summary.net)}</dd></dl></section>`,
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">People</h3><dl class="pr-d-facts"><dt>Paid</dt><dd>${summary.people}</dd><dt>New starters</dt><dd>${summary.starters}</dd><dt>Leavers</dt><dd>${summary.leavers}</dd></dl></section>`,
		];
		runSlot('body').innerHTML = sections.join('');
		offcanvasFor(ui.runDrawer).show();
	}

	function requestRunZip(month) {
		return notify({
			tone: 'info',
			icon: 'bi-file-earmark-zip',
			title: 'Preparing the payslips',
			text: `${counted(payslipsFor(month).length, 'PDF')} for ${MONTH_NAMES[month - 1]}. We’ll email you the zip file.`,
		});
	}

	/* Approving the whole run. */

	function paintApproveDialog() {
		const summary = runSummary(RUN_MONTH);
		const left = openChanges().length;
		pick('[data-pr-ap-sub]').textContent = `${summary.people} people, paid on ${weekdayDate(paydayOf(RUN_MONTH))}.`;
		const lines = [
			['Gross pay', dollars(summary.gross)],
			['Deductions', `−${dollars(summary.ded)}`],
			['Net to pay', dollars(summary.net)],
		];
		pick('[data-pr-ap-sum]').innerHTML = lines
			.map(
				([term, value], index) =>
					`<div${index === lines.length - 1 ? ' class="is-total"' : ''}><dt>${term}</dt><dd>${value}</dd></div>`,
			)
			.join('');
		const pendingNote = pick('[data-pr-ap-open]');
		pendingNote.hidden = !left;
		pendingNote.innerHTML = `<i class="bi bi-info-circle" aria-hidden="true"></i><span>The ${counted(left, 'open change')} will be approved with the run.</span>`;
		pick('[data-pr-ap-from]').textContent =
			`From Payroll Account ···${PAY_ACCOUNT}. Transfers leave on ${shortDate(TRANSFER_DAY)}.`;
	}

	function approveWholeRun() {
		const summary = runSummary(RUN_MONTH);
		const undoChanges = markChanges(openChanges(), 'approved');
		view.approved = true;
		approveDialog().hide();
		paintAll();
		notify({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'October run approved',
			text: `${counted(summary.people, 'transfer')} leave on ${shortDate(TRANSFER_DAY)}. Payslips go out on ${shortDate(paydayOf(RUN_MONTH))}.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						view.approved = false;
						undoChanges();
					},
				},
			],
		});
	}

	function undoRunApproval() {
		view.approved = false;
		paintAll();
		notify({
			tone: 'info',
			icon: 'bi-arrow-counterclockwise',
			title: 'Approval undone',
			text: 'The October run is a draft again.',
		});
	}

	/* The "Add a change" drawer. */

	function readAmount() {
		const value = parseFloat(String(ui.amountField.value).replace(/[$,\s]/g, ''));
		return isFinite(value) ? roundMoney(value) : NaN;
	}

	function chosenKind() {
		return pick('input[name="kind"]:checked', ui.addForm)?.value;
	}

	function wireAddForm() {
		ui.addForm.addEventListener('input', (event) => {
			if (event.target.classList.contains('is-invalid')) checkAddForm();
			paintPreview();
		});
		ui.addForm.addEventListener('change', paintPreview);
		ui.addForm.addEventListener('submit', onAddSubmit);
		ui.addDrawer.addEventListener('hidden.bs.offcanvas', () => {
			for (const control of pickAll('.is-invalid', ui.addForm)) {
				control.classList.remove('is-invalid');
				control.removeAttribute('aria-invalid');
			}
		});
	}

	function paintPreview() {
		const person = personById(ui.personSelect.value);
		const amount = readAmount();
		const out = pick('[data-pr-add-preview]');
		if (!person || !(amount > 0)) {
			out.textContent = '';
			return;
		}
		const now = payslipFor(person, RUN_MONTH).gross;
		const then = roundMoney(now + (chosenKind() === 'deduction' ? -amount : amount));
		out.textContent = `${person.first}’s October gross goes from ${dollars(now)} to ${dollars(then)}.`;
	}

	function checkAddForm() {
		const amount = readAmount();
		const checks = [
			[ui.personSelect, Boolean(ui.personSelect.value)],
			[ui.amountField, amount >= 1 && amount <= 20000],
			[ui.reasonField, ui.reasonField.value.trim().length > 2],
		];

		for (const [control, ok] of checks) {
			control.classList.toggle('is-invalid', !ok);
			control.setAttribute('aria-invalid', String(!ok));
			control.closest('.input-group')?.classList.toggle('is-invalid', !ok);
		}

		const failing = checks.find(([, ok]) => !ok);
		if (!failing) return true;
		failing[0].focus();
		return false;
	}

	function onAddSubmit(event) {
		event.preventDefault();
		if (!checkAddForm()) return;
		const person = personById(ui.personSelect.value);
		const kind = chosenKind();
		const amount = readAmount();
		const reason = ui.reasonField.value.trim();
		const change = {
			id: `c${changeCounter++}`,
			who: person.id,
			kind,
			status: 'approved',
			added: true,
			by: SIGNED_IN,
			on: DEMO_DAY,
			extra: kind === 'deduction' ? -amount : amount,
			extraLabel: reason,
			note: reason,
			line: reason,
			facts: [
				['Amount', `${kind === 'deduction' ? '−' : '+'}${dollars(amount)}`],
				['Added by', `You on ${shortDate(DEMO_DAY)}`],
			],
		};
		const wasApproved = view.approved;
		view.approved = false;
		changeList.push(change);
		offcanvasFor(ui.addDrawer).hide();
		ui.addForm.reset();
		refreshSelect(ui.personSelect);
		paintPreview();
		paintAll();
		notify({
			tone: 'success',
			icon: 'bi-plus-circle',
			title: `${CHANGE_KINDS[kind]} added`,
			text: `${dollars(amount)} for ${wholeName(person)}${wasApproved ? '. The run is back to draft, so approve it again.' : ' in the October run.'}`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						const at = changeList.indexOf(change);
						if (at >= 0) changeList.splice(at, 1);
						view.approved = wasApproved;
						paintAll();
					},
				},
			],
		});
	}

	/* Clicks anywhere on the page, tried card by card in page order. Each
     handler returns true once it has dealt with the click. */

	function navigateTo(href, event) {
		if (event.metaKey || event.ctrlKey || event.button === 1) window.open(href, '_blank', 'noopener');
		else location.href = href;
	}

	function onStageClick(event) {
		for (const handle of [runClicks, reviewClicks, peopleClicks, pastClicks, exportClicks]) {
			if (handle(event)) return;
		}
	}

	function runClicks(event) {
		const target = event.target;
		if (target.closest('[data-pr-approve]')) {
			if (view.approved) {
				undoRunApproval();
			} else {
				paintApproveDialog();
				approveDialog().show();
			}
			return true;
		}
		if (target.closest('[data-pr-ap-go]')) {
			approveWholeRun();
			return true;
		}
		if (!target.closest('[data-pr-to-review]')) return false;
		event.preventDefault();
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		pick('#pr-review').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
		pick('#pr-review-title').focus({ preventScroll: true });
		return true;
	}

	/* Row buttons act in place; the rest of a row opens the change's quick
     view, since a single change has no page of its own. */
	function reviewClicks(event) {
		const target = event.target;
		const rowButton = target.closest('[data-pr-act]');
		if (rowButton) {
			const change = changeById(rowButton.closest('tr').getAttribute('data-change'));
			if (change) handleChange(change, rowButton.getAttribute('data-pr-act'), false);
			return true;
		}
		if (target.closest('[data-pr-approve-picked]')) {
			approveSelected();
			return true;
		}
		if (target.closest('[data-pr-show-done]')) {
			window.Basalt.slide(ui.reviewTable.parentElement, () => {
				view.showHandled = !view.showHandled;
				drawReview();
			});
			return true;
		}
		const row = target.closest('tr[data-change]');
		if (!row || target.closest('a, input, button:not([data-pr-open-change])')) return false;
		openChangeDrawer(row.getAttribute('data-change'));
		return true;
	}

	/* The quick view icon opens the payslip; the row itself goes to the
     person's full page, as the name does. */
	function peopleClicks(event) {
		const target = event.target;
		const slipButton = target.closest('[data-pr-open-slip]');
		if (slipButton) {
			openSlipDrawer(slipButton.getAttribute('data-pr-open-slip'));
			return true;
		}
		const row = target.closest('tr[data-person]');
		if (row && !target.closest('a, button')) {
			navigateTo(pick('.pr-who-name', row).href, event);
			return true;
		}
		if (target.closest('[data-pr-people-all]')) {
			const hadRows = ui.peopleRows.children.length;
			window.Basalt.slide(ui.peopleTable.parentElement, () => {
				view.everyone = true;
				paintPeople();
			});
			const firstNew = ui.peopleRows.children[hadRows];
			if (firstNew) pick('.pr-who-name', firstNew).focus({ preventScroll: true });
			return true;
		}
		if (!target.closest('[data-pr-clear]')) return false;
		view.query = '';
		view.team = '';
		ui.search.value = '';
		ui.teamSelect.value = '';
		refreshSelect(ui.teamSelect);
		view.everyone = false;
		paintPeople();
		ui.search.focus();
		return true;
	}

	/* The download icon acts in place; the row opens the run's quick view. */
	function pastClicks(event) {
		const target = event.target;
		const download = target.closest('[data-pr-download-run]');
		if (download) {
			requestRunZip(parseInt(download.getAttribute('data-pr-download-run'), 10));
			return true;
		}
		const row = target.closest('tr[data-run]');
		if (row) {
			openRunDrawer(parseInt(row.getAttribute('data-run'), 10));
			return true;
		}
		if (!target.closest('[data-pr-past-all]')) return false;
		window.Basalt.slide(ui.pastRows.closest('table').parentElement, () => {
			view.allRuns = true;
			paintPast();
		});
		return true;
	}

	function exportClicks(event) {
		if (!event.target.closest('[data-pr-export]')) return false;
		notify({
			tone: 'success',
			icon: 'bi-file-earmark-spreadsheet',
			title: 'Export ready',
			text: 'payroll-2026.csv has all ten runs, one row per payslip.',
		});
		return true;
	}

	function onStageChange(event) {
		const box = event.target.closest('[data-pr-pick]');
		if (box) {
			const id = box.getAttribute('data-pr-pick');
			if (box.checked) view.selected.add(id);
			else view.selected.delete(id);
			drawReview();
			pick(`[data-pr-pick="${id}"]`, ui.reviewRows)?.focus();
			return;
		}
		if (event.target !== ui.selectAll) return;
		view.selected = new Set(ui.selectAll.checked ? openChanges().map((change) => change.id) : []);
		drawReview();
		ui.selectAll.focus();
	}

	start();
})();
