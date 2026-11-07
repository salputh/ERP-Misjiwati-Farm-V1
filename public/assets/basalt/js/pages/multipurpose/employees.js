/**
 * Staff directory behavior for employees.html.
 * Paints the four "Right now" snapshots, the team chips, the directory
 * (table or cards, grouped by team), the quick-view panel and the Add
 * employee dialog. Everyone comes from the shared roster in
 * assets/basalt/js/data/multipurpose/people.js; swap that for your HR feed and the painting
 * code stays as it is.
 */
(() => {
	'use strict';
	const shell = pick('[data-em-root]', document);
	if (!shell) return;

	/* The demo pretends it is this day for start dates and time off. Local
     clocks still use the viewer's real time, so "Working now" is live. */
	const DEMO_DAY = new Date(2026, 9, 9);
	const DEMO_DAY_ISO = isoDate(DEMO_DAY);
	const SETTLING_IN_DAYS = 56;
	const FACE_LIMIT = 4;
	const REPORTS_SHOWN = 5;
	const LAYOUT_KEY = 'basalt-employees-view';
	const MAIL_DOMAIN = 'fieldline.app';
	const VOID_TAGS = new Set(['input']);

	const STATUS_META = {
		active: { label: 'Active', tone: 'success' },
		onboarding: { label: 'Onboarding', tone: 'info' },
		leave: { label: 'Away', tone: 'warning' },
		leaving: { label: 'Leaving', tone: 'danger' },
	};
	const CONTRACTS = ['Full-time', 'Part-time', 'Fixed-term', 'Contract'];
	const DATE_STYLES = {
		long: { day: 'numeric', month: 'short', year: 'numeric' },
		short: { day: 'numeric', month: 'short' },
		weekday: { weekday: 'short', day: 'numeric', month: 'short' },
	};

	/* Teams keep one chart color each (basalt-avatar-tone-1..8), so an avatar
     always says which team someone is in. A person's id is their staff
     number; mgr is the staff number they report to. */
	const roster = window.Basalt.data.people;
	const teams = roster.teams.map((team) => ({
		id: team.id,
		name: team.id,
		tone: team.tone,
		lead: roster.recordWithId(team.lead).staff,
	}));
	const staff = roster.staff.map(toPerson);
	const countryNames = Object.fromEntries(Object.values(roster.cities).map((town) => [town.cc, town.country]));

	const MENU_CHIPS = {
		status: [['', 'Any status'], ...Object.entries(STATUS_META).map(([key, item]) => [key, item.label])],
		type: [['', 'Any contract'], ...CONTRACTS.map((kind) => [kind, kind])],
	};

	/* Each snapshot card knows who belongs in it, how to show the count and
     what its one line says. */
	const SNAPSHOTS = {
		now: {
			people: () => staff.filter(onTheClock),
			count: (list) => `${list.length} <span>of ${staff.length}</span>`,
			line: (list) =>
				list.length
					? `In working hours in ${new Set(list.map(countryCode)).size} of ${new Set(staff.map(countryCode)).size} states.`
					: 'Everyone is outside working hours.',
		},
		leave: {
			people: () =>
				staff
					.filter((person) => person.status === 'leave')
					.sort((a, b) => (a.back || '').localeCompare(b.back || '')),
			count: (list) => String(list.length),
			line: (list) =>
				list.length
					? `${listNames(list.map((person) => person.first + (person.back ? ` back ${formatDate(person.back, 'short')}` : '')))}.`
					: 'Nobody is away.',
		},
		onboarding: {
			people: () =>
				staff.filter((person) => person.status === 'onboarding').sort((a, b) => b.start.localeCompare(a.start)),
			count: (list) => String(list.length),
			line: (list) =>
				list.length
					? `Latest: ${displayName(list[0])}, ${parseIso(list[0].start) > DEMO_DAY ? 'starts ' : 'joined '}${formatDate(list[0].start, 'short')}.`
					: 'No one is onboarding.',
		},
		leaving: {
			people: () =>
				staff
					.filter((person) => person.status === 'leaving')
					.sort((a, b) => (a.lastDay || '').localeCompare(b.lastDay || '')),
			count: (list) => String(list.length),
			line: (list) =>
				list.length
					? `${listNames(list.map((person) => displayName(person) + (person.lastDay ? `, last day ${formatDate(person.lastDay, 'short')}` : '')))}.`
					: 'Nobody is leaving.',
		},
	};

	/* What the visitor asked for, and who that currently shows. */
	const wanted = { team: '', text: '', status: '', contract: '', workingOnly: false };
	let onScreen = [];
	let layout = rememberedLayout() === 'grid' ? 'grid' : 'table';
	let typingPause;

	const ui = {
		teams: pick('[data-em-teams]'),
		search: pick('[data-em-search]'),
		groups: pick('[data-em-groups]'),
		empty: pick('[data-em-empty]'),
		emptyText: pick('[data-em-empty-text]'),
		summary: pick('[data-em-summary]'),
		applied: pick('[data-em-applied]'),
		filterButton: pick('[data-em-filter-btn]'),
		filterCount: pick('[data-em-filter-count]'),
		layout: pick('[data-em-view]'),
		directory: document.getElementById('em-dir'),
	};

	const quickView = document.getElementById('em-record');
	let quickViewList = [];
	let stepper = null;

	const addModal = document.getElementById('em-add');
	const newHireForm = pick('[data-em-add-form]', addModal);
	const teamField = pick('[data-em-add-team]', newHireForm);
	const managerField = pick('[data-em-add-mgr]', newHireForm);
	const emailField = pick('[data-em-add-email]', newHireForm);
	const startField = pick('#em-add-start', newHireForm);
	let emailEdited = false;

	/**
	 * Wires every widget once, then paints the first view.
	 */
	function start() {
		pick(`input[name="emView"][value="${layout}"]`, ui.layout).checked = true;
		ui.layout.addEventListener('change', (event) => {
			if (event.target.name !== 'emView') return;
			layout = event.target.value;
			rememberLayout(layout);
			paintDirectory();
		});

		ui.teams.addEventListener('change', (event) => {
			if (!event.target.matches('input[name="emTeam"]')) return;
			wanted.team = event.target.value;
			paintDirectory();
		});

		shell.addEventListener('change', (event) => {
			const hit = /^emF-(status|type)$/.exec(event.target.name || '');
			if (!hit) return;
			wanted[hit[1] === 'type' ? 'contract' : 'status'] = event.target.value;
			paintDirectory();
		});
		pick('[data-em-filter-clear]').addEventListener('click', () => {
			Object.assign(wanted, { status: '', contract: '' });
			paintMenuChips();
			paintDirectory();
		});
		pick('[data-em-filter-done]').addEventListener('click', () => {
			window.bootstrap?.Dropdown.getInstance(ui.filterButton)?.hide();
			ui.filterButton.focus();
		});

		ui.search.addEventListener('input', () => {
			clearTimeout(typingPause);
			typingPause = setTimeout(() => {
				wanted.text = ui.search.value;
				paintDirectory();
			}, 150);
		});
		pick('[data-em-clear]').addEventListener('click', () => {
			resetQuery();
			ui.search.focus();
		});

		shell.addEventListener('click', onSnapshotFilter);
		document.addEventListener('click', onOpenPerson);
		ui.groups.addEventListener('click', followRecord);
		ui.groups.addEventListener('auxclick', (event) => {
			if (event.button === 1) followRecord(event);
		});
		pick('[data-em-export]').addEventListener('click', downloadCsv);

		teamField.innerHTML = teams.map((team) => tag('option', { value: team.id }, guard(team.name))).join('');
		teamField.addEventListener('change', refreshManagers);
		newHireForm.elements.first.addEventListener('input', proposeEmail);
		newHireForm.elements.last.addEventListener('input', proposeEmail);
		emailField.addEventListener('input', () => {
			emailEdited = emailField.value !== '';
		});
		newHireForm.addEventListener('input', (event) => {
			/* A field drops its error the moment it is fixed. */
			const widget = event.target;
			if (widget.classList.contains('is-invalid') && widget.checkValidity())
				widget.classList.remove('is-invalid');
		});
		addModal.addEventListener('show.bs.modal', blankForm);
		addModal.addEventListener('shown.bs.modal', () => newHireForm.elements.first.focus());
		newHireForm.addEventListener('basalt:steps-done', onAddSubmit);

		/* Clocks move on: every minute the local times and "Working now" are
       painted again. */
		setInterval(() => {
			for (const clock of pickAll('[data-em-clock]')) {
				const person = personById(clock.getAttribute('data-em-clock'));
				if (person) clock.outerHTML = clockMarkup(person);
			}
			paintSnapshots();
			if (wanted.workingOnly) paintDirectory();
		}, 60000);

		paintMenuChips();
		paintDirectory();
		paintSnapshots();
	}

	/* Small DOM, markup and text helpers. */

	function pick(selector, scope = shell) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = shell) {
		return [...scope.querySelectorAll(selector)];
	}

	/**
	 * Builds one element's markup. Attribute values go in as given (escape
	 * them first); true gives a bare attribute, false or null leaves it out.
	 */
	function tag(name, attrs = {}, inner = '') {
		let opening = `<${name}`;
		for (const [key, value] of Object.entries(attrs)) {
			if (value === false || value == null) continue;
			opening += value === true ? ` ${key}` : ` ${key}="${value}"`;
		}
		return VOID_TAGS.has(name) ? `${opening}>` : `${opening}>${inner}</${name}>`;
	}

	function glyph(name) {
		return tag('i', { 'aria-hidden': 'true', class: `bi bi-${name}` });
	}

	function guard(value) {
		const swap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => swap[char]);
	}

	function plainText(value) {
		return String(value || '')
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	function countOf(n, singular, pluralForm = `${singular}s`) {
		return `${n} ${n === 1 ? singular : pluralForm}`;
	}

	function listNames(names) {
		if (names.length < 2) return names.join('');
		const tail = names[names.length - 1];
		return `${names.slice(0, -1).join(', ')} and ${tail}`;
	}

	function notify(options) {
		window.Basalt.toasts?.push(options);
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	/* The visitor's table-or-cards choice lives in this browser. A blocked
     storage simply means nothing is remembered. */

	function rememberedLayout() {
		try {
			return localStorage.getItem(LAYOUT_KEY);
		} catch {
			return null;
		}
	}

	function rememberLayout(value) {
		try {
			localStorage.setItem(LAYOUT_KEY, value);
		} catch {
			/* private window */
		}
	}

	/* Dates. */

	function isoDate(date) {
		const two = (n) => String(n).padStart(2, '0');
		return [date.getFullYear(), two(date.getMonth() + 1), two(date.getDate())].join('-');
	}

	function parseIso(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	function formatDate(iso, style) {
		return parseIso(iso).toLocaleDateString('en-US', DATE_STYLES[style]);
	}

	/** The first weekday after the given day, as ISO. */
	function nextWorkday(iso) {
		const day = parseIso(iso);
		do day.setDate(day.getDate() + 1);
		while (day.getDay() === 0 || day.getDay() === 6);
		return isoDate(day);
	}

	/** How long someone has been here, in the shortest honest unit. */
	function tenure(iso) {
		const startedOn = parseIso(iso);
		if (startedOn > DEMO_DAY) return `Starts ${formatDate(iso, 'short')}`;
		let monthSpan =
			(DEMO_DAY.getFullYear() - startedOn.getFullYear()) * 12 + DEMO_DAY.getMonth() - startedOn.getMonth();
		if (DEMO_DAY.getDate() < startedOn.getDate()) monthSpan -= 1;
		if (monthSpan < 1) return 'New this month';
		if (monthSpan < 12) return countOf(monthSpan, 'month');
		return countOf(Math.floor(monthSpan / 12), 'year');
	}

	/* People. */

	/**
	 * Shapes one roster entry into the record this page paints, working out
	 * the status from last days, start dates and time off. New starters stay
	 * in Onboarding for their first eight weeks.
	 */
	function toPerson(entry) {
		const town = roster.cityOf(entry);
		const person = {
			id: entry.staff,
			first: entry.first,
			last: entry.last,
			email: roster.emailOf(entry),
			team: entry.team,
			role: entry.title,
			city: `${entry.city}, ${town.cc}`,
			tz: town.tz,
			type: entry.type,
			start: entry.start,
			mgr: entry.mgr ? roster.recordWithId(entry.mgr).staff : '',
			phone: roster.contactOf(entry).phone,
			status: 'active',
		};
		const away = roster.awayOn(entry, DEMO_DAY_ISO);
		const settlingIn = DEMO_DAY - parseIso(entry.start) < SETTLING_IN_DAYS * 864e5;
		const nameOf = (id) => roster.nameOf(roster.recordWithId(id));

		if (entry.lastDay) {
			const successor = entry.id === 'op' ? 'Quentin Cook takes over his open leads.' : '';
			return Object.assign(person, {
				status: 'leaving',
				lastDay: entry.lastDay,
				note: `Last day is ${formatDate(entry.lastDay, 'weekday')}. ${successor}`.trim(),
			});
		}
		if (entry.start > DEMO_DAY_ISO) {
			const buddy = entry.buddy ? ` ${nameOf(entry.buddy)} is ${entry.g === 'she' ? 'her' : 'his'} buddy.` : '';
			return Object.assign(person, {
				status: 'onboarding',
				note: `Starts ${formatDate(entry.start, 'weekday')}.${buddy}`,
			});
		}
		if (away) {
			const request = away.request && roster.timeOff.find((item) => item.id === away.request);
			const standIn = request?.cover ? ` ${nameOf(request.cover)} covers.` : '';
			const until = away.from === away.to ? ' today.' : ` until ${formatDate(away.to, 'weekday')}.`;
			return Object.assign(person, {
				status: 'leave',
				back: nextWorkday(away.to),
				note: away.reason + until + standIn,
			});
		}
		if (settlingIn) {
			return Object.assign(person, {
				status: 'onboarding',
				note: `Started ${formatDate(entry.start, 'weekday')}. Probation check-ins with ${nameOf(entry.mgr)}.`,
			});
		}
		return person;
	}

	function teamNamed(id) {
		return teams.find((team) => team.id === id);
	}

	function personById(id) {
		return staff.find((person) => person.id === id);
	}

	function displayName(person) {
		return `${person.first} ${person.last}`;
	}

	function monogram(person) {
		return (person.first.charAt(0) + person.last.charAt(0)).toUpperCase();
	}

	function emailFor(person) {
		if (person.email) return person.email;
		const handle = plainText(`${person.first}.${person.last}`).replace(/[^a-z.]/g, '');
		return `${handle}@${MAIL_DOMAIN}`;
	}

	function countryCode(person) {
		return (person.city.split(',')[1] || '').trim();
	}

	function cityName(person) {
		return person.city.split(',')[0];
	}

	function directReports(person) {
		return staff.filter((other) => other.mgr === person.id);
	}

	function recordUrl(person) {
		return `employee-details.html?id=${encodeURIComponent(person.id)}`;
	}

	/** Steps from a person up to their team lead: 0 for the lead itself. */
	function stepsToLead(person) {
		let hops = 0;
		let cursor = person;
		while (hops < 10) {
			const boss = cursor.mgr && personById(cursor.mgr);
			if (!boss || boss.team !== person.team) break;
			cursor = boss;
			hops += 1;
		}
		return hops;
	}

	/** Lead first, then each layer below, alphabetical within a layer. */
	function leadFirst(list) {
		return [...list].sort(
			(a, b) => stepsToLead(a) - stepsToLead(b) || displayName(a).localeCompare(displayName(b)),
		);
	}

	/* Local clocks: the time where the person sits, from the viewer's own
     clock, and whether that is inside Monday-to-Friday, 9 to 6. */

	function clockFor(timeZone) {
		try {
			const pieces = {};
			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone,
				hour: '2-digit',
				minute: '2-digit',
				weekday: 'short',
				hourCycle: 'h23',
			});
			for (const piece of formatter.formatToParts(new Date())) pieces[piece.type] = piece.value;
			const hour = Number(pieces.hour);
			const offDay = ['Sat', 'Sun'].includes(pieces.weekday);
			return {
				time: `${hour % 12 || 12}:${pieces.minute}${hour < 12 ? ' am' : ' pm'}`,
				working: hour >= 9 && hour < 18 && !offDay,
			};
		} catch {
			return { time: '', working: false };
		}
	}

	function onTheClock(person) {
		return person.status !== 'leave' && clockFor(person.tz).working;
	}

	/* Markup fragments shared by cards, rows and the panel. */

	function clockMarkup(person) {
		const clock = clockFor(person.tz);
		if (!clock.time) return '';
		const srOnly = (text) => tag('span', { class: 'visually-hidden' }, text);
		return tag(
			'span',
			{ 'data-em-clock': person.id, class: `em-clock${clock.working ? ' is-day' : ''}` },
			glyph(clock.working ? 'sun' : 'moon-stars') +
				srOnly('Local time ') +
				clock.time +
				srOnly(clock.working ? ', working hours' : ', after hours'),
		);
	}

	function avatarMarkup(person, size) {
		const sizeClass = size ? `basalt-avatar-${size} ` : '';
		return tag(
			'span',
			{
				'aria-hidden': 'true',
				class: `basalt-avatar ${sizeClass}basalt-avatar-tone-${teamNamed(person.team).tone}`,
			},
			guard(monogram(person)),
		);
	}

	/** Cards and the panel only flag a status other than Active; the table's
      Status column names every one (pass always). */
	function statusMarkup(person, always) {
		if (person.status === 'active' && !always) return '';
		const { tone, label } = STATUS_META[person.status];
		return tag('span', { class: `basalt-status basalt-status-dot basalt-status-${tone}` }, label);
	}

	function rowTools(person, extraClass) {
		const who = guard(displayName(person));
		const tip = { 'data-bs-toggle': 'tooltip', 'data-bs-trigger': 'hover' };
		const quick = tag(
			'button',
			{
				'data-em-open': person.id,
				...tip,
				'data-bs-title': 'Quick view',
				'aria-label': `Quick view: ${who}`,
				type: 'button',
				class: 'btn btn-icon btn-sm',
			},
			glyph('layout-sidebar-inset-reverse'),
		);
		const fullPage = tag(
			'a',
			{
				href: recordUrl(person),
				...tip,
				'data-bs-title': 'Open full page',
				'aria-label': `Open full page: ${who}`,
				class: 'btn btn-icon btn-sm',
			},
			glyph('arrows-angle-expand'),
		);
		return tag('span', { class: `basalt-row-actions ${extraClass}` }, quick + fullPage);
	}

	function faceMarkup(person) {
		const who = guard(displayName(person));
		return tag(
			'button',
			{
				'data-em-open': person.id,
				'data-bs-toggle': 'tooltip',
				'data-bs-title': who,
				'aria-label': who,
				type: 'button',
				class: `basalt-avatar basalt-avatar-sm basalt-avatar-tone-${teamNamed(person.team).tone}`,
			},
			guard(monogram(person)),
		);
	}

	function radioChip(id, name, value, isOn, chipClass, inner) {
		return (
			tag('input', { id, type: 'radio', name, value, class: 'btn-check', checked: isOn }) +
			tag('label', { for: id, class: chipClass }, inner)
		);
	}

	/* Filtering. */

	/** Whether a person fits what was asked; ignoreTeam leaves the team chip
      out so the chips can count what each would show. */
	function fitsQuery(person, ignoreTeam) {
		if (!ignoreTeam && wanted.team && person.team !== wanted.team) return false;
		if (wanted.status && person.status !== wanted.status) return false;
		if (wanted.contract && person.type !== wanted.contract) return false;
		if (wanted.workingOnly && !onTheClock(person)) return false;
		if (!wanted.text) return true;
		const haystack = plainText(
			[
				displayName(person),
				person.role,
				person.city,
				countryNames[countryCode(person)] || '',
				emailFor(person),
			].join(' '),
		);
		return plainText(wanted.text)
			.trim()
			.split(/\s+/)
			.every((word) => haystack.includes(word));
	}

	function resetQuery() {
		Object.assign(wanted, { team: '', text: '', status: '', contract: '', workingOnly: false });
		ui.search.value = '';
		paintMenuChips();
		paintDirectory();
	}

	/* Painting the directory card. */

	/** Team chips count what each would show under the current search and
      menu filters. */
	function paintTeamChips() {
		const countFor = (teamId) =>
			staff.filter((person) => fitsQuery(person, true) && (!teamId || person.team === teamId)).length;
		const choices = [{ id: '', name: 'Everyone' }, ...teams];
		ui.teams.innerHTML = choices
			.map((team) => {
				const inner = guard(team.name) + tag('span', { class: 'em-team-count' }, countFor(team.id));
				return radioChip(
					`em-team-${team.id || 'all'}`,
					'emTeam',
					team.id,
					wanted.team === team.id,
					'em-team',
					inner,
				);
			})
			.join('');
	}

	function paintMenuChips() {
		for (const [group, choices] of Object.entries(MENU_CHIPS)) {
			const picked = group === 'type' ? wanted.contract : wanted.status;
			pick(`[data-em-chips="${group}"]`).innerHTML = choices
				.map(([value, words], index) =>
					radioChip(
						`em-f-${group}-${index}`,
						`em-f-${group}`,
						guard(value),
						picked === value,
						'em-chip',
						guard(words),
					),
				)
				.join('');
		}
	}

	function paintApplied() {
		const pills = [];
		if (wanted.workingOnly)
			pills.push({
				label: 'Working now',
				remove: () => {
					wanted.workingOnly = false;
					paintDirectory();
				},
			});
		if (wanted.status)
			pills.push({
				label: STATUS_META[wanted.status].label,
				remove: () => {
					wanted.status = '';
					paintMenuChips();
					paintDirectory();
				},
			});
		if (wanted.contract)
			pills.push({
				label: wanted.contract,
				remove: () => {
					wanted.contract = '';
					paintMenuChips();
					paintDirectory();
				},
			});
		window.Basalt.drawer?.applied(
			ui.applied,
			pills,
			() => {
				Object.assign(wanted, { status: '', contract: '', workingOnly: false });
				paintMenuChips();
				paintDirectory();
			},
			ui.filterButton,
		);

		const inMenu = (wanted.status ? 1 : 0) + (wanted.contract ? 1 : 0);
		ui.filterCount.hidden = !inMenu;
		ui.filterCount.textContent = String(inMenu);
		ui.filterButton.classList.toggle('is-on', inMenu > 0);
	}

	function emptyMessage() {
		if (wanted.text) return `No one matches "${wanted.text.trim()}". Try another spelling, or clear the filters.`;
		if (wanted.workingOnly) return 'No one in that mix is in working hours right now.';
		return 'No one has that mix of team, status and contract.';
	}

	/**
	 * Paints everyone who fits the query, team by team with the lead first,
	 * as one table or as a card section per team.
	 */
	function paintDirectory() {
		const matched = staff.filter((person) => fitsQuery(person));
		const blocks = [];
		onScreen = [];

		for (const team of teams) {
			const crew = leadFirst(matched.filter((person) => person.team === team.id));
			if (!crew.length) continue;
			onScreen = onScreen.concat(crew);
			if (layout === 'table') continue;
			const headcount = staff.filter((person) => person.team === team.id).length;
			const lead = personById(team.lead);
			const subline =
				countOf(headcount, 'person', 'people') + (lead ? ` · led by ${guard(displayName(lead))}` : '');
			const heading =
				tag('h3', { id: `em-group-${team.id}`, class: 'em-group-title' }, guard(team.name)) +
				tag('p', { class: 'em-group-meta' }, subline);
			blocks.push(
				tag(
					'section',
					{ 'aria-labelledby': `em-group-${team.id}`, class: `em-group em-tone-${team.tone}` },
					tag('header', { class: 'em-group-head' }, heading) +
						tag('ul', { class: 'em-grid' }, crew.map(cardMarkup).join('')),
				),
			);
		}

		if (layout === 'table') ui.groups.innerHTML = onScreen.length ? tableMarkup(onScreen) : '';
		else ui.groups.innerHTML = blocks.join('');
		ui.groups.classList.toggle('is-table', layout === 'table');
		window.Basalt.tips?.(ui.groups);
		ui.groups.hidden = !matched.length;
		ui.empty.hidden = matched.length > 0;
		if (!matched.length) ui.emptyText.textContent = emptyMessage();

		const everyone = countOf(staff.length, 'person', 'people');
		ui.summary.textContent = matched.length === staff.length ? everyone : `${matched.length} of ${everyone}`;
		paintTeamChips();
		paintApplied();
	}

	/** A card: the name links to the full record, the panel icon opens the
      quick view, and the rest of the card follows the name. */
	function cardMarkup(person) {
		const flag = person.status === 'active' ? '' : tag('span', { class: 'em-person-status' }, statusMarkup(person));
		const inner =
			tag('a', { href: recordUrl(person), class: 'em-person-name' }, guard(displayName(person))) +
			tag('span', { class: 'em-person-role' }, guard(person.role)) +
			flag;
		const foot =
			tag('span', { class: 'em-person-city' }, glyph('geo-alt') + guard(cityName(person))) + clockMarkup(person);
		return tag(
			'li',
			{ 'data-em-id': person.id, class: 'em-person' },
			avatarMarkup(person) +
				tag('div', { class: 'em-person-text' }, inner) +
				tag('div', { class: 'em-person-foot' }, foot) +
				rowTools(person, 'em-person-actions'),
		);
	}

	/** One table row, one line per cell. The stylesheet folds Team and
      Started under the name on narrow cards and stacks rows on phones. */
	function rowMarkup(person) {
		const team = teamNamed(person.team);
		const cellOf = (cls, inner) => tag('td', { class: cls }, inner);
		const who =
			tag('a', { href: recordUrl(person), class: 'em-person-name' }, guard(displayName(person))) +
			tag(
				'span',
				{ class: 'em-cell-person-sub' },
				guard(person.role) + tag('span', { class: 'em-fold' }, ` · ${guard(team.name)}`),
			);
		const where = tag('span', { class: 'em-cell-where-city' }, guard(cityName(person))) + clockMarkup(person);
		const rowCells = [
			cellOf(
				'em-col-person',
				tag(
					'div',
					{ class: 'em-cell-person' },
					avatarMarkup(person, 'sm') + tag('span', { class: 'em-cell-person-text' }, who),
				),
			),
			cellOf('em-col-team', tag('span', { class: 'em-team-dot' }, guard(team.name))),
			cellOf('em-col-where', tag('span', { class: 'em-cell-where' }, where)),
			cellOf('em-col-status', statusMarkup(person, true)),
			cellOf('em-col-start', guard(formatDate(person.start, 'long'))),
			cellOf('em-col-actions', rowTools(person, 'em-row-actions')),
		];
		return tag('tr', { 'data-em-id': person.id, class: `em-row em-tone-${team.tone}` }, rowCells.join(''));
	}

	function tableMarkup(people) {
		const columns = {
			person: 'Name',
			team: 'Team',
			where: 'Location',
			status: 'Status',
			start: 'Started',
			actions: tag('span', { class: 'visually-hidden' }, 'Actions'),
		};
		const headRow = Object.entries(columns)
			.map(([key, wording]) => tag('th', { scope: 'col', class: `em-col-${key}` }, wording))
			.join('');
		const caption = tag(
			'caption',
			{ class: 'visually-hidden' },
			'Employees by team, lead first. Each row opens the full record.',
		);
		const table = tag(
			'table',
			{ class: 'table align-middle em-table' },
			caption + tag('thead', {}, tag('tr', {}, headRow)) + tag('tbody', {}, people.map(rowMarkup).join('')),
		);
		return tag('div', { class: 'em-table-wrap' }, table);
	}

	/* The "Right now" snapshots. */

	function paintSnapshots() {
		for (const board of pickAll('[data-em-now]')) {
			const which = SNAPSHOTS[board.getAttribute('data-em-now')];
			const people = which.people();
			const faces = pick('[data-em-now-faces]', board);

			for (const tipped of pickAll('[data-bs-toggle="tooltip"]', faces)) {
				window.bootstrap?.Tooltip.getInstance(tipped)?.dispose();
			}

			const extra = people.length - FACE_LIMIT;
			const overflow =
				extra > 0
					? tag('span', { class: 'basalt-avatar basalt-avatar-sm basalt-avatar-more' }, `+${extra}`)
					: '';
			pick('[data-em-now-count]', board).innerHTML = which.count(people);
			faces.innerHTML = people.slice(0, FACE_LIMIT).map(faceMarkup).join('') + overflow;
			pick('[data-em-now-line]', board).textContent = which.line(people);
			window.Basalt.tips?.(faces);
		}
	}

	/** A snapshot title narrows the directory to that group and scrolls
      down to it. */
	function onSnapshotFilter(event) {
		const button = event.target.closest('[data-em-now-filter]');
		if (!button) return;
		const which = button.getAttribute('data-em-now-filter');
		wanted.team = '';
		wanted.workingOnly = which === 'now';
		wanted.status = which === 'now' ? '' : which;
		paintMenuChips();
		paintDirectory();
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		ui.directory.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
		sayAloud(`${ui.summary.textContent} shown.`);
	}

	/* The quick-view panel. */

	function panelPart(key) {
		return pick(`[data-em-r="${key}"]`, quickView);
	}

	function factMarkup(label, value) {
		return tag('div', { class: 'em-facts-row' }, tag('dt', {}, label) + tag('dd', {}, value));
	}

	function panelSection(legend, inner) {
		return tag(
			'section',
			{ class: 'basalt-drawer-section' },
			tag('h3', { class: 'basalt-drawer-legend' }, legend) + inner,
		);
	}

	function personButton(person) {
		return tag(
			'button',
			{ 'data-em-open': person.id, type: 'button', class: 'em-who' },
			avatarMarkup(person, 'xs') + tag('span', {}, guard(displayName(person))),
		);
	}

	function reportMarkup(person) {
		const lines =
			tag('span', { class: 'em-report-name' }, guard(displayName(person))) +
			tag('span', { class: 'em-report-role' }, guard(person.role));
		return tag(
			'li',
			{},
			tag(
				'button',
				{ 'data-em-open': person.id, type: 'button', class: 'em-report' },
				avatarMarkup(person, 'sm') + tag('span', { class: 'em-report-text' }, lines) + glyph('chevron-right'),
			),
		);
	}

	/**
	 * Fills the panel header and body for one person: contact facts, job
	 * facts and their direct reports.
	 */
	function fillPanel(person) {
		const team = teamNamed(person.team);
		const avatar = panelPart('avatar');
		avatar.className = `basalt-avatar basalt-avatar-lg basalt-avatar-tone-${team.tone}`;
		avatar.textContent = monogram(person);
		panelPart('name').textContent = displayName(person);
		panelPart('sub').textContent = person.role;
		panelPart('mail').href = `mailto:${emailFor(person)}`;
		panelPart('profile').href = recordUrl(person);

		const manager = personById(person.mgr);
		const reports = leadFirst(directReports(person));
		const cc = countryCode(person);
		const clock = clockFor(person.tz);
		const address = guard(emailFor(person));
		const blocks = [];

		if (person.status !== 'active') {
			const note = person.note ? tag('p', { class: 'em-state-note' }, guard(person.note)) : '';
			blocks.push(tag('div', { class: 'em-state' }, statusMarkup(person) + note));
		}

		const contact = [
			factMarkup('Email', tag('a', { href: `mailto:${address}`, class: 'em-link' }, address)),
			factMarkup(
				'Phone',
				tag(
					'a',
					{ href: `tel:${guard(person.phone.replace(/\s/g, ''))}`, class: 'em-link' },
					guard(person.phone),
				),
			),
			factMarkup('Works from', `${guard(cityName(person))}, ${guard(countryNames[cc] || cc)}`),
		];
		if (clock.time) {
			const hours = clock.working ? 'working hours' : 'after hours';
			contact.push(
				factMarkup(
					'Local time',
					tag(
						'span',
						{ class: `em-clock${clock.working ? ' is-day' : ''}` },
						`${glyph(clock.working ? 'sun' : 'moon-stars')}${clock.time} · ${hours}`,
					),
				),
			);
		}
		blocks.push(panelSection('Contact', tag('dl', { class: 'em-facts' }, contact.join(''))));

		const job = [
			factMarkup('Team', guard(team.name)),
			factMarkup('Reports to', manager ? personButton(manager) : `Leads ${guard(team.name)}`),
			factMarkup('Contract', guard(person.type)),
			factMarkup(
				'Started',
				`${guard(formatDate(person.start, 'long'))} ${tag('span', { class: 'em-quiet' }, `· ${guard(tenure(person.start))}`)}`,
			),
			factMarkup('Staff number', tag('span', { class: 'em-mono' }, guard(person.id))),
		];
		blocks.push(panelSection('Job', tag('dl', { class: 'em-facts' }, job.join(''))));

		if (reports.length) {
			const rest = reports.length - REPORTS_SHOWN;
			const overflowNote =
				rest > 0
					? tag(
							'p',
							{ class: 'em-quiet em-reports-more' },
							`and ${countOf(rest, 'more person', 'more people')}`,
						)
					: '';
			const legend = `Direct reports ${tag('span', { class: 'basalt-drawer-count' }, reports.length)}`;
			blocks.push(
				panelSection(
					legend,
					tag('ul', { class: 'em-reports' }, reports.slice(0, REPORTS_SHOWN).map(reportMarkup).join('')) +
						overflowNote,
				),
			);
		}
		panelPart('body').innerHTML = blocks.join('');
	}

	/** Opens the panel on one person. The arrows step through whoever the
      directory is showing; someone outside it stands alone. */
	function showPerson(id) {
		const person = personById(id);
		if (!person) return;
		quickViewList = onScreen.some((shown) => shown.id === id) ? [...onScreen] : [person];
		if (!stepper && window.Basalt.drawer) {
			/* The length is read on every step, so one binding fits any list. */
			stepper = window.Basalt.drawer.recordNav(
				quickView,
				{ valueOf: () => Math.max(1, quickViewList.length) },
				(index) => fillPanel(quickViewList[index]),
			);
		}
		if (stepper) stepper.go(quickViewList.indexOf(person), 0);
		else fillPanel(person);
		pick('.basalt-drawer-nav', quickView).hidden = quickViewList.length < 2;
		window.bootstrap.Offcanvas.getOrCreateInstance(quickView).show();
	}

	function onOpenPerson(event) {
		const button = event.target.closest('[data-em-open]');
		if (!button) return;
		const id = button.getAttribute('data-em-open');
		if (!quickView.contains(button)) {
			if (shell.contains(button)) showPerson(id);
			return;
		}
		/* A manager or report named inside the panel swaps in place. */
		const person = personById(id);
		const index = quickViewList.indexOf(person);
		if (index >= 0 && stepper) {
			stepper.go(index, 1);
		} else {
			quickViewList = [person];
			if (stepper) stepper.go(0, 1);
			else fillPanel(person);
			pick('.basalt-drawer-nav', quickView).hidden = true;
		}
		pick('.btn-close', quickView).focus();
	}

	/** A click on a card or row outside its links and buttons behaves like
      the name link; Cmd/Ctrl or a middle click opens a new tab. */
	function followRecord(event) {
		if (event.target.closest('a, button')) return;
		const hit = event.target.closest('[data-em-id]');
		if (!hit) return;
		const url = pick('.em-person-name', hit).href;
		const newTab = event.metaKey || event.ctrlKey || event.button === 1;
		if (newTab) window.open(url, '_blank', 'noopener');
		else location.href = url;
	}

	/* Export: the people on screen, as a CSV download. */

	function downloadCsv() {
		const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
		const columnNames = [
			'Staff number',
			'Name',
			'Email',
			'Job title',
			'Team',
			'Reports to',
			'Works from',
			'Contract',
			'Status',
			'Started',
		];
		const rows = onScreen.map((person) => [
			person.id,
			displayName(person),
			emailFor(person),
			person.role,
			teamNamed(person.team).name,
			person.mgr ? displayName(personById(person.mgr)) : '',
			person.city,
			person.type,
			STATUS_META[person.status].label,
			person.start,
		]);
		const csv = [columnNames, ...rows].map((row) => row.map(quote).join(',')).join('\r\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		const anchor = Object.assign(document.createElement('a'), { href: url, download: 'fieldline-employees.csv' });
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		notify({
			tone: 'success',
			title: 'Export ready',
			text: `${countOf(onScreen.length, 'person', 'people')} saved to fieldline-employees.csv.`,
		});
	}

	/* The Add employee dialog. */

	function refreshManagers() {
		const candidates = leadFirst(
			staff.filter((person) => person.team === teamField.value && person.status !== 'leaving'),
		);
		managerField.innerHTML = candidates
			.map((person) => tag('option', { value: person.id }, guard(displayName(person))))
			.join('');
		window.Basalt.select?.refresh?.(managerField);
	}

	/** Suggests first.last@ until the visitor types an address of their own. */
	function proposeEmail() {
		if (emailEdited) return;
		const given = plainText(newHireForm.elements.first.value).replace(/[^a-z]/g, '');
		const family = plainText(newHireForm.elements.last.value).replace(/[^a-z]/g, '');
		emailField.value = given && family ? `${given}.${family}@${MAIL_DOMAIN}` : '';
	}

	function blankForm() {
		if (newHireForm.basaltSteps) newHireForm.basaltSteps.reset();
		else newHireForm.reset();
		emailEdited = false;
		for (const widget of pickAll('.is-invalid', newHireForm)) widget.classList.remove('is-invalid');
		teamField.value = teams[0].id;
		refreshManagers();
	}

	function nextStaffNumber() {
		const highest = Math.max(...staff.map((person) => Number(person.id.replace(/\D/g, ''))));
		return `#${highest + 1}`;
	}

	/**
	 * Checks the required fields, then adds the person as a new starter,
	 * paints them in and offers a way to open their record.
	 */
	function onAddSubmit(event) {
		event.preventDefault();
		const controls = newHireForm.elements;
		const required = [controls.first, controls.last, emailField, controls.role, startField];
		let firstBad = null;

		for (const widget of required) {
			const fine = widget.checkValidity() && widget.value.trim() !== '';
			widget.classList.toggle('is-invalid', !fine);
			if (!fine) firstBad = firstBad || widget;
		}
		if (firstBad) {
			firstBad.focus();
			return;
		}

		const firstDay = window.Basalt.datepicker.get(startField);
		const cityInput = controls.city.value.trim();
		const cc = (cityInput.split(',')[1] || '').trim().toUpperCase();
		const person = {
			id: nextStaffNumber(),
			first: controls.first.value.trim(),
			last: controls.last.value.trim(),
			email: emailField.value.trim(),
			team: teamField.value,
			role: controls.role.value.trim(),
			city: cityInput ? cityInput.split(',')[0].trim() + (cc ? `, ${cc}` : '') : 'Remote',
			tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
			type: pick('input[name="type"]:checked', newHireForm).value,
			status: 'onboarding',
			start: firstDay,
			mgr: managerField.value,
			phone: 'Not added yet',
			note: `First day is ${formatDate(firstDay, 'long')}. Their welcome email goes out that morning.`,
		};
		staff.push(person);
		window.bootstrap.Modal.getOrCreateInstance(addModal).hide();
		paintDirectory();
		paintSnapshots();
		pick(`[data-em-id="${person.id}"]`, ui.groups)?.classList.add('is-fresh');

		const teamName = teamNamed(person.team).name;
		sayAloud(`${displayName(person)} added to ${teamName}.`);
		notify({
			tone: 'success',
			title: `${displayName(person)} added`,
			text: `In ${teamName}, starting ${formatDate(person.start, 'long')}.`,
			actions: [
				{
					label: 'View',
					onClick: () => {
						if (!onScreen.some((shown) => shown.id === person.id)) resetQuery();
						showPerson(person.id);
					},
				},
			],
		});
	}

	start();
})();
