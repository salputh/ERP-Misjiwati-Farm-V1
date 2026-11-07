/**
 * Basalt - My Day (my-day.html)
 * One person's working day, drawn from DAY below:
 *   blocks  the day from 8 AM to 6 PM as meetings, focus time and free
 *           time; the ring and the agenda beside it both read it, and
 *           pointing at a block in one lights it in the other
 *   tasks   John's own tasks, searched, filtered, sorted and ticked off
 *           in place with an undo
 *   waits   approvals and mentions that need an answer from John
 *   week    Monday to Friday as strips on the same clock
 *
 * The demo is set on Thursday, October 8, 2026 at 10:40 AM, the same
 * moment as the Schedule page, and the meetings are the ones John has
 * there. In your app, use new Date() and fill DAY from your calendar
 * and task APIs in the same shape.
 */
(() => {
	'use strict';
	const root = pick('[data-myd-root]', document);
	if (!root) return;

	const NOW = 10 * 60 + 40;
	const START = 8 * 60;
	const END = 18 * 60;

	const PEOPLE = {
		ja: 'John Armstrong',
		hb: 'Leslie Ashby',
		pr: 'Connie Reese',
		gl: 'Courtney Lowry',
		lo: 'Lance Bishop',
		so: 'Rory Beasley',
		og: 'Oliver Merritt',
		ev: 'Elise Vick',
	};

	const DAY = {
		blocks: [
			{ from: '08:00', to: '09:30', kind: 'focus', title: 'Access review, finance tools' },
			{
				from: '09:30',
				to: '10:00',
				kind: 'meeting',
				title: 'Ops standup',
				people: ['hb', 'pr', 'gl', 'lo'],
				href: 'meeting-details.html',
			},
			{ from: '10:00', to: '11:00', kind: 'free', title: 'Free' },
			{
				from: '11:00',
				to: '12:00',
				kind: 'meeting',
				title: 'Lumora AI renewal',
				people: ['hb'],
				href: 'video-call.html',
			},
			{ from: '12:00', to: '13:00', kind: 'free', title: 'Lunch' },
			{ from: '13:00', to: '14:00', kind: 'focus', title: 'Laptop order and SSO notes' },
			{
				from: '14:00',
				to: '14:45',
				kind: 'meeting',
				title: 'Support interview',
				people: ['pr'],
				href: 'video-call.html',
			},
			{ from: '14:45', to: '15:00', kind: 'free', title: 'Free' },
			{ from: '15:00', to: '16:30', kind: 'focus', title: 'Interview notes and VPN plan' },
			{ from: '16:30', to: '18:00', kind: 'free', title: 'Free' },
		],
		/* due: days from today, so -1 is yesterday. done: when it was ticked. */
		tasks: [
			{
				id: 't1',
				title: 'Send Leslie the Lumora AI seat count',
				due: 0,
				priority: 3,
				where: 'Lumora AI renewal',
			},
			{
				id: 't2',
				title: 'Finish the access review for finance tools',
				due: -1,
				priority: 3,
				where: 'Q4 access review',
			},
			{
				id: 't3',
				title: 'Approve laptops for the two new support hires',
				due: 0,
				priority: 2,
				where: 'Support hiring',
			},
			{
				id: 't4',
				title: 'Write up notes from the support interview',
				due: 0,
				priority: 2,
				where: 'Support hiring',
			},
			{ id: 't5', title: 'Change the guest Wi-Fi password in Eugene', due: 1, priority: 1, where: 'Office IT' },
			{ id: 't6', title: 'Turn on single sign-on for the help desk', due: 4, priority: 2, where: 'SSO rollout' },
			{ id: 't7', title: 'Renew the code-signing certificate', due: 6, priority: 3, where: 'Release tooling' },
			{ id: 't8', title: 'Plan the move to the new VPN client', due: 8, priority: 1, where: 'Office IT' },
			{
				id: 't9',
				title: 'Post the Ops standup notes',
				due: 0,
				priority: 1,
				where: 'Ops standup',
				done: '10:02 AM',
			},
			{
				id: 't10',
				title: 'Reset Courtney Lowry’s two-step sign-in',
				due: 0,
				priority: 2,
				where: 'Help desk',
				done: '9:12 AM',
			},
		],
		waits: [
			{
				id: 'w1',
				kind: 'mention',
				who: 'hb',
				title: 'Can Lumora have 94 Max seats from November 2? I need a yes before 11.',
				where: '#customer-success',
				ago: '25 min ago',
				href: 'chat.html',
			},
			{
				id: 'w2',
				kind: 'approval',
				who: 'lo',
				title: 'Purchase order #1187: two laptops, $3,196',
				where: 'Purchase orders',
				ago: '3 hours ago',
				href: 'purchase-orders.html',
			},
			{
				id: 'w3',
				kind: 'approval',
				who: 'so',
				title: 'Read access to the production database for two weeks',
				where: 'Access requests',
				ago: '2 hours ago',
				href: 'access-requests.html',
			},
			{
				id: 'w4',
				kind: 'approval',
				who: 'pr',
				title: 'Time off, October 19 to 23 (5 days)',
				where: 'Leave',
				ago: 'Yesterday',
				href: 'time-off.html',
			},
			{
				id: 'w5',
				kind: 'mention',
				who: 'og',
				title: 'Which phones do we buy for testing the mobile app?',
				where: 'Task: test devices',
				ago: 'Yesterday',
				href: 'task-details.html',
			},
			{
				id: 'w6',
				kind: 'approval',
				who: 'ev',
				title: 'Expense claim: conference parking, $86.40',
				where: 'Expenses',
				ago: '2 days ago',
				href: 'expense-details.html',
			},
		],
		/* John's meetings this week come from the Schedule page; focus is the
       time he blocked for himself. Today and Friday are still planned. */
		week: [
			{
				day: 'Mon',
				blocks: [
					['08:30', '10:00', 'focus', 'Focus'],
					['10:00', '11:00', 'meeting', 'Q4 planning'],
					['13:00', '15:00', 'focus', 'Focus'],
				],
			},
			{
				day: 'Tue',
				blocks: [
					['09:00', '12:00', 'focus', 'Focus'],
					['13:00', '14:00', 'meeting', 'Highpoint renewal plan'],
					['14:30', '16:30', 'focus', 'Focus'],
				],
			},
			{
				day: 'Wed',
				blocks: [
					['09:00', '09:30', 'meeting', '1:1 with Connie'],
					['10:00', '12:00', 'focus', 'Focus'],
					['13:30', '15:30', 'focus', 'Focus'],
					['16:00', '17:00', 'meeting', 'Support review'],
				],
			},
			{ day: 'Thu', today: true, blocks: [] },
			{
				day: 'Fri',
				blocks: [
					['08:30', '10:00', 'focus', 'Focus'],
					['13:00', '15:30', 'focus', 'Focus'],
				],
			},
		],
	};

	/* The week's work, Monday to Friday; Thursday is today and Friday is still
	   to come. Tasks done this week include the two ticked off this morning. */
	const WORK = [
		{
			id: 'done',
			label: 'Tasks done',
			icon: 'bi-check2-circle',
			tone: 3,
			days: [3, 4, 3, 2, null],
			note: 'this week',
			href: 'to-dos.html',
		},
		{
			id: 'open',
			label: 'In progress',
			icon: 'bi-hourglass-split',
			tone: 1,
			days: [9, 8, 9, 8, null],
			note: 'open tasks today',
			last: true,
			href: 'to-dos.html',
		},
		{
			id: 'tickets',
			label: 'Help desk tickets closed',
			icon: 'bi-life-preserver',
			tone: 5,
			days: [6, 5, 8, 4, null],
			note: 'this week',
			href: 'tickets.html',
		},
		{
			id: 'approvals',
			label: 'Approvals answered',
			icon: 'bi-patch-check',
			tone: 8,
			days: [2, 3, 1, 3, null],
			note: 'this week',
			href: 'approvals.html',
		},
	];
	const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

	const PRIORITY = { 3: 'High', 2: 'Normal', 1: 'Low' };

	const state = {
		tasks: DAY.tasks.map((t) => ({ ...t })),
		waits: DAY.waits.map((w) => ({ ...w })),
		/* The demo clock: it starts at NOW and moves on a minute at a time. */
		now: NOW,
	};

	function start() {
		DAY.week[3].blocks = DAY.blocks.filter((b) => b.kind !== 'free').map((b) => [b.from, b.to, b.kind, b.title]);
		drawWork();
		drawNext();
		runClock();
		wireTasks();
		wireWaits();
		drawWeek();
		(window.Basalt.settled || Promise.resolve()).then(() => {
			/* The wave is the cards' entrance, so the shared rise steps aside. */
			for (const tile of pickAll('.myd-work-tile')) tile.classList.remove('basalt-enter');
			wave(root, 1700);
		});
	}

	/* Plays the wave once on a block: the class comes off when it is over, so
	   later redraws (the clock each minute, a ticked task) stay still. */
	const waveTimers = new Map();
	function wave(block, ms) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		block.classList.remove('is-waving');
		void block.offsetWidth;
		block.classList.add('is-waving');
		clearTimeout(waveTimers.get(block));
		waveTimers.set(
			block,
			setTimeout(() => block.classList.remove('is-waving'), ms),
		);
	}

	/* Helpers */
	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function minutes(hhmm) {
		const [h, m] = hhmm.split(':').map(Number);
		return h * 60 + m;
	}

	function clock(mins) {
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		const half = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return m ? `${h12}:${String(m).padStart(2, '0')} ${half}` : `${h12} ${half}`;
	}

	function span(mins) {
		const h = Math.floor(mins / 60);
		const m = mins % 60;
		if (!h) return `${m} min`;
		return m ? `${h} h ${m} min` : `${h} h`;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function avatar(code, size = 'sm') {
		const name = PEOPLE[code];
		return `<span data-basalt-avatar data-name="${htmlSafe(name)}" class="basalt-avatar basalt-avatar-${size} myd-face" title="${htmlSafe(name)}"></span>`;
	}

	/* Work this week: a figure per kind and a small bar for each day so far.
	   Pointing at a bar reads that day under the figure. */
	function drawWork() {
		const box = pick('[data-myd-work]');
		box.innerHTML = WORK.map((w) => {
			const days = w.days.filter((d) => d !== null);
			const figure = w.last ? days[days.length - 1] : days.reduce((a, b) => a + b, 0);
			const top = Math.max(...days);
			const bars = w.days
				.map((d, i) => {
					const today = i === 3;
					if (d === null) return `<span class="myd-work-bar is-ahead" aria-hidden="true"></span>`;
					return `<span class="myd-work-bar value-${Math.max(8, Math.round((d / top) * 100))}${today ? ' is-today' : ''}" data-myd-day="${WEEKDAYS[i]}" data-myd-n="${d}"></span>`;
				})
				.join('');
			return `<a href="${w.href}" class="card basalt-box myd-work-tile tone-series-${w.tone}"><span class="myd-work-head"><i class="bi ${w.icon}" aria-hidden="true"></i>${w.label}</span><span class="myd-work-figure">${figure}</span><span class="myd-work-note" data-myd-note="${htmlSafe(w.note)}">${w.note}</span><span class="myd-work-bars" role="img" aria-label="${htmlSafe(
				`${w.label}: ${w.days
					.map((d, i) => (d === null ? '' : `${WEEKDAYS[i]} ${d}`))
					.filter(Boolean)
					.join(', ')}`,
			)}">${bars}</span></a>`;
		}).join('');
		for (const bar of pickAll('[data-myd-day]', box)) {
			const note = pick('.myd-work-note', bar.closest('.myd-work-tile'));
			bar.addEventListener('pointerenter', () => {
				note.textContent = `${bar.dataset.mydDay === 'Thu' ? 'Today' : bar.dataset.mydDay}: ${bar.dataset.mydN}`;
			});
			bar.addEventListener('pointerleave', () => {
				note.textContent = note.dataset.mydNote;
			});
		}
	}

	/* Your day: only what comes next, as a big countdown with the people in
	   it and a way to join; the rest of the day is one quiet line. */
	function drawNext() {
		const now = state.now;
		const blocks = DAY.blocks.map((b) => ({ ...b, start: minutes(b.from), end: minutes(b.to) }));
		const lastBusy = Math.max(...blocks.filter((b) => b.kind !== 'free').map((b) => b.end));
		/* A meeting under way counts down to its end; otherwise the next one counts down to its start. */
		const current = blocks.find((b) => b.kind === 'meeting' && b.start <= now && now < b.end);
		const next = current || blocks.find((b) => b.kind === 'meeting' && b.start > now);
		pick('[data-myd-next-label]').textContent = current ? 'Now' : 'Next up';
		const num = pick('[data-myd-next-num]');
		const unit = pick('[data-myd-next-unit]');
		const title = pick('[data-myd-next-title]');
		const when = pick('[data-myd-next-when]');
		const act = pick('.myd-next-act');
		const then = pick('[data-myd-next-then]');
		if (!next) {
			/* After the last meeting the big figure turns into the time the day ends. */
			const [time, half] = clock(lastBusy).split(' ');
			num.textContent = now < lastBusy ? time : 'Free';
			unit.textContent = now < lastBusy ? half : '';
			title.textContent = 'No more meetings today';
			when.textContent =
				now < lastBusy ? 'Focus until then, and the evening is yours' : 'The rest of the day is yours';
			act.hidden = true;
			then.hidden = true;
			return;
		}
		const wait = current ? next.end - now : next.start - now;
		/* Under an hour it counts minutes; past that, hours and minutes as 1:50 h. */
		num.textContent = wait >= 60 ? `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}` : wait;
		unit.textContent = `${wait >= 60 ? 'h' : 'min'}${current ? ' left' : ''}`;
		title.textContent = next.title;
		when.textContent = `${clock(next.start)} to ${clock(next.end)} · video call with ${next.people.map((c) => PEOPLE[c]).join(', ')}`;
		const faces = pick('[data-myd-next-faces]');
		faces.innerHTML = next.people.map((c) => avatar(c, 'md')).join('');
		if (window.Basalt.avatars) window.Basalt.avatars(faces);
		pick('[data-myd-next-join]').href = next.href;
		act.hidden = false;
		const later = blocks.filter((b) => b.start > next.start && b.kind !== 'free');
		then.hidden = false;
		then.innerHTML = `<span>Then</span> ${later
			.map((b) => `<b>${htmlSafe(b.title)} <em>${clock(b.start)}</em></b>`)
			.join(
				'<i aria-hidden="true">·</i>',
			)}<i aria-hidden="true">·</i><b>free from <em>${clock(lastBusy)}</em></b>`;
	}

	/* The countdown rises in once the page has settled, then the demo clock
	   moves on each minute and the card redraws quietly. */
	function runClock() {
		(window.Basalt.settled || Promise.resolve()).then(() => root.classList.add('is-in'));
		setInterval(() => {
			state.now += 1;
			drawNext();
		}, 60000);
	}

	/* Tasks */
	function dueText(t) {
		if (t.done) return `Done ${t.done}`;
		if (t.due < 0) return t.due === -1 ? 'Overdue, was due yesterday' : `Overdue by ${plural(-t.due, 'day')}`;
		if (t.due === 0) return 'Due today';
		if (t.due === 1) return 'Due tomorrow';
		const d = new Date(2026, 9, 8 + t.due);
		return `Due ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
	}

	function wireTasks() {
		const search = pick('[data-myd-task-search]');
		const show = pick('[data-myd-task-show]');
		const sort = pick('[data-myd-task-sort]');
		search.addEventListener('input', renderTasks);
		const ripple = () => {
			renderTasks();
			wave(pick('[data-myd-tasks]'), 1100);
		};
		show.addEventListener('change', ripple);
		sort.addEventListener('change', ripple);
		pick('[data-myd-tasks]').addEventListener('change', (event) => {
			const box = event.target.closest('[data-myd-tick]');
			if (box) tick(box.dataset.mydTick, box.checked);
		});
		pick('[data-myd-tasks]').addEventListener('click', (event) => {
			if (!event.target.closest('[data-myd-task-reset]')) return;
			search.value = '';
			show.value = 'all';
			renderTasks();
		});
		renderTasks();
	}

	function tick(id, done) {
		const task = state.tasks.find((t) => t.id === id);
		task.done = done ? clock(NOW) : null;
		renderTasks();
		if (!done) return;
		toast({
			tone: 'success',
			title: `Done: ${task.title}`,
			actions: [{ label: 'Undo', onClick: () => tick(id, false) }],
		});
	}

	function renderTasks() {
		const q = pick('[data-myd-task-search]').value.trim().toLowerCase();
		const show = pick('[data-myd-task-show]').value;
		const by = pick('[data-myd-task-sort]').value;
		const fits = {
			open: (t) => !t.done,
			today: (t) => !t.done && t.due <= 0,
			late: (t) => !t.done && t.due < 0,
			done: (t) => Boolean(t.done),
			all: () => true,
		}[show];
		const rows = state.tasks
			.filter(fits)
			.filter((t) => !q || `${t.title} ${t.where}`.toLowerCase().includes(q))
			.sort((a, b) => {
				if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
				return by === 'priority'
					? b.priority - a.priority || a.due - b.due
					: a.due - b.due || b.priority - a.priority;
			});
		const open = state.tasks.filter((t) => !t.done);
		const today = open.filter((t) => t.due <= 0).length;
		pick('[data-myd-task-sum]').textContent =
			`${plural(open.length, 'open task')}, ${today} of them due today or late.`;
		pick('[data-myd-task-count]').textContent = `${rows.length} of ${state.tasks.length}`;
		const list = pick('[data-myd-tasks]');
		if (!rows.length) {
			list.innerHTML = `<li class="myd-empty"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">No tasks here</h3><p class="basalt-empty-text">Nothing matches that search and filter.</p><div class="basalt-empty-actions"><button data-myd-task-reset type="button" class="btn btn-outline-secondary btn-sm">Show all tasks</button></div></div></li>`;
			return;
		}
		list.innerHTML = rows
			.map((t) => {
				const late = !t.done && t.due < 0;
				const tone = t.done ? '' : late ? ' is-late' : t.due === 0 ? ' is-today' : '';
				const pri =
					t.priority === 3 && !t.done
						? '<span class="basalt-status basalt-status-danger">High</span>'
						: `<span class="visually-hidden">${PRIORITY[t.priority]} priority</span>`;
				return `<li class="myd-task${t.done ? ' is-done' : ''}"><input data-myd-tick="${t.id}" id="myd-${t.id}" type="checkbox" class="form-check-input myd-task-check"${t.done ? ' checked' : ''} aria-label="Done: ${htmlSafe(t.title)}" /><span class="myd-task-main"><a href="task-details.html" class="myd-task-title">${htmlSafe(t.title)}</a><span class="myd-task-meta">${htmlSafe(t.where)}</span></span><span class="myd-task-end">${pri}<span class="myd-task-due${tone}">${dueText(t)}</span></span></li>`;
			})
			.join('');
	}

	/* Waiting on you */
	function wireWaits() {
		const search = pick('[data-myd-wait-search]');
		const show = pick('[data-myd-wait-show]');
		search.addEventListener('input', renderWaits);
		show.addEventListener('change', () => {
			renderWaits();
			wave(pick('[data-myd-waits]'), 1100);
		});
		pick('[data-myd-waits]').addEventListener('click', (event) => {
			const yes = event.target.closest('[data-myd-approve]');
			if (yes) approve(yes.dataset.mydApprove);
			if (event.target.closest('[data-myd-wait-reset]')) {
				search.value = '';
				show.value = 'all';
				renderWaits();
			}
		});
		renderWaits();
	}

	function approve(id) {
		const at = state.waits.findIndex((w) => w.id === id);
		const [item] = state.waits.splice(at, 1);
		renderWaits();
		toast({
			tone: 'success',
			title: `Approved for ${PEOPLE[item.who]}`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						state.waits.splice(at, 0, item);
						renderWaits();
					},
				},
			],
		});
	}

	function renderWaits() {
		const q = pick('[data-myd-wait-search]').value.trim().toLowerCase();
		const show = pick('[data-myd-wait-show]').value;
		const rows = state.waits
			.filter((w) => show === 'all' || w.kind === show)
			.filter((w) => !q || `${PEOPLE[w.who]} ${w.title} ${w.where}`.toLowerCase().includes(q));
		const approvals = state.waits.filter((w) => w.kind === 'approval').length;
		const mentions = state.waits.length - approvals;
		pick('[data-myd-wait-sum]').textContent = state.waits.length
			? `${plural(approvals, 'approval')} and ${plural(mentions, 'question')} for you.`
			: 'Nobody is waiting on you.';
		pick('[data-myd-wait-count]').textContent = `${rows.length} of ${state.waits.length}`;
		const list = pick('[data-myd-waits]');
		if (!rows.length) {
			const all = !state.waits.length;
			list.innerHTML = `<li class="myd-empty"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">${all ? 'All answered' : 'No requests here'}</h3><p class="basalt-empty-text">${all ? 'Every approval and question has an answer.' : 'Nothing matches that search and filter.'}</p>${all ? '' : '<div class="basalt-empty-actions"><button data-myd-wait-reset type="button" class="btn btn-outline-secondary btn-sm">Show everything</button></div>'}</div></li>`;
			return;
		}
		list.innerHTML = rows
			.map((w) => {
				const action =
					w.kind === 'approval'
						? `<button data-myd-approve="${w.id}" type="button" class="btn btn-outline-secondary btn-sm">Approve</button>`
						: `<a href="${w.href}" class="btn btn-outline-secondary btn-sm">Reply</a>`;
				const text = w.kind === 'mention' ? `“${htmlSafe(w.title)}”` : htmlSafe(w.title);
				return `<li class="myd-wait">${avatar(w.who)}<span class="myd-wait-main"><span class="myd-wait-who">${htmlSafe(PEOPLE[w.who])} <span class="myd-wait-ago">· ${w.ago}</span></span><a href="${w.href}" class="myd-wait-title">${text}</a><span class="myd-wait-where">${htmlSafe(w.where)}</span></span>${action}</li>`;
			})
			.join('');
		if (window.Basalt.avatars) window.Basalt.avatars(list);
	}

	/* The week: five strips on one 8 AM to 6 PM clock. */
	function drawWeek() {
		const box = pick('[data-myd-week]');
		const pct = (m) => (((m - START) / (END - START)) * 100).toFixed(2);
		let meet = 0;
		let focus = 0;
		let busiest = { day: '', mins: 0 };
		const hours = [];
		for (let m = START; m <= END; m += 120) {
			hours.push(`<span class="myd-week-hour" data-at="${pct(m)}">${clock(m)}</span>`);
		}
		const rows = DAY.week.map((d) => {
			let dayMeet = 0;
			const blocks = d.blocks
				.map(([from, to, kind, title]) => {
					const a = minutes(from);
					const b = minutes(to);
					if (kind === 'meeting') dayMeet += b - a;
					else focus += b - a;
					const label = `${d.day}, ${clock(a)} to ${clock(b)}: ${title}`;
					return `<span class="myd-week-block is-${kind}" data-left="${pct(a)}" data-width="${(pct(b) - pct(a)).toFixed(2)}" tabindex="0" role="img" aria-label="${htmlSafe(label)}" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(label)}"></span>`;
				})
				.join('');
			meet += dayMeet;
			if (dayMeet > busiest.mins) busiest = { day: d.day, mins: dayMeet };
			const now = d.today ? `<span class="myd-week-now" data-left="${pct(NOW)}" aria-hidden="true"></span>` : '';
			return `<div class="myd-week-row${d.today ? ' is-today' : ''}"><span class="myd-week-day">${d.day}${d.today ? '<span class="visually-hidden"> (today)</span>' : ''}</span><span class="myd-week-strip">${blocks}${now}</span><span class="myd-week-total">${dayMeet ? span(dayMeet) : 'No meetings'}</span></div>`;
		});
		box.innerHTML = `${rows.join('')}<div class="myd-week-row is-axis" aria-hidden="true"><span></span><span class="myd-week-strip">${hours.join('')}</span><span></span></div>`;
		/* Positions come from the data, so they are set here rather than through classes. */
		for (const el of pickAll('[data-left]', box)) {
			el.style.setProperty('--myd-left', `${el.dataset.left}%`);
			if (el.dataset.width) el.style.setProperty('--myd-width', `${el.dataset.width}%`);
		}
		for (const el of pickAll('[data-at]', box)) el.style.setProperty('--myd-left', `${el.dataset.at}%`);
		if (window.bootstrap)
			for (const el of pickAll('[data-bs-toggle="tooltip"]', box)) new window.bootstrap.Tooltip(el);
		pick('[data-myd-week-sum]').textContent =
			`${span(meet)} in meetings and ${span(focus)} of focus. ${busiest.day === 'Thu' ? 'Today' : busiest.day} has the most meetings.`;
	}

	start();
})();
