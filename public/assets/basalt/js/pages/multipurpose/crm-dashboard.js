/**
 * Basalt - CRM (crm-dashboard.html)
 * Draws this week's winners from the signed deals in
 * assets/basalt/js/data/multipurpose/deals.js, then the open pipeline,
 * today's follow-ups, the closing-soon table and the new-business chart
 * from the demo data below, and runs the
 * deal quick view and the Add a deal form. Swap STAGES, DEALS, TASKS and WON
 * for your own API responses; the rendering does not change.
 * Today is fixed at Thursday, October 8, 2026 so the demo reads the same
 * on any day.
 */

(() => {
	'use strict';
	function start() {
		drawPodium();
		drawStages();
		drawToday();
		drawDeals();
		drawChart(true);
		document.addEventListener('basalt:appearance', () => requestAnimationFrame(() => drawChart(false)));
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function ampm(t) {
		const [h, m] = t.split(':').map(Number);
		return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? ' am' : ' pm'}`;
	}

	function htmlSafe(s) {
		return String(s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const TODAY = new Date(2026, 9, 8);
	const PRICE = { Basic: 15, Pro: 32, Max: 58 };

	/* Billed once a year, and a year of seats costs ten months. */
	function yearly(plan, seats) {
		return PRICE[plan] * seats * 10;
	}

	/* Open deals by stage. value is annual revenue in dollars; rate is how
     often a deal at that stage ends up signed. */
	const STAGES = [
		{ key: 'qualified', name: 'Qualified', deals: 46, value: 412000, rate: 0.1 },
		{ key: 'demo', name: 'Demo', deals: 31, value: 356000, rate: 0.25 },
		{ key: 'trial', name: 'Trial', deals: 24, value: 318000, rate: 0.4 },
		{ key: 'proposal', name: 'Proposal', deals: 15, value: 264000, rate: 0.6 },
		{ key: 'negotiation', name: 'Negotiation', deals: 9, value: 188000, rate: 0.8 },
	];

	function stageOf(key) {
		return STAGES.find((s) => s.key === key);
	}

	/* The deals at Proposal or Negotiation that close first: more seats
     and add-ons for customer accounts (from assets/basalt/js/data/multipurpose/accounts.js,
     the same deals Company Details lists) and new business still being
     won. value is the extra yearly revenue. */
	const BOOK = window.Basalt.data.accounts;
	const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function shortDay(iso) {
		return `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
	}

	const fromAccounts = [];
	BOOK.list().forEach((a) =>
		a.deals
			.filter((d) => d.stage === 'proposal' || d.stage === 'negotiation')
			.forEach((d) => {
				const who = a.people.find((x) => x.key === d.people[0][0]);
				fromAccounts.push({
					id: BOOK.slug(d.name),
					acct: a.id,
					title: d.name,
					company: a.name,
					city: a.city,
					plan: BOOK.plans[d.plan].name,
					seats: d.seats,
					stage: d.stage,
					closes: d.closes,
					owner: a.owner,
					value: d.value,
					contact: { name: who.name, role: who.title, email: who.email, key: who.key },
					next: d.next,
					log: a.activity.slice(0, 3).map((e) => [shortDay(e[0]), e[2], e[1]]),
				});
			}),
	);
	const NEW_BUSINESS = [
		{
			id: 'bluewater-electrical',
			title: 'Bluewater Photography, new customer',
			company: 'Bluewater Photography',
			city: 'Minot, ND',
			plan: 'Max',
			seats: 82,
			stage: 'proposal',
			closes: '2026-10-19',
			owner: 'Elise Vick',
			contact: { name: 'Tom Nugent', role: 'Studio manager', email: 'tom.nugent@bluewaterphotography.com' },
			next: 'Send the single sign-on set-up guide their IT asked for.',
			log: [
				['Oct 6', 'Sent the Max proposal for 82 seats', 'Elise Vick'],
				['Sep 28', 'Trial finished across both studios', 'Tom Nugent'],
				['Sep 10', 'Started a 30-day trial', 'Elise Vick'],
			],
		},
		{
			id: 'ironbark-roofing',
			title: 'Ironbark Bikes, new customer',
			company: 'Ironbark Bikes',
			city: 'Olympia, WA',
			plan: 'Pro',
			seats: 26,
			stage: 'negotiation',
			closes: '2026-10-28',
			owner: 'Thomas Morrison',
			contact: { name: 'Elsie Kerr', role: 'Operations manager', email: 'elsie@ironbarkbikes.com' },
			next: 'Confirm the seat count before the contract goes out.',
			log: [
				['Oct 7', 'Agreed a start date of November 2', 'Thomas Morrison'],
				['Oct 1', 'Proposal accepted', 'Elsie Kerr'],
				['Sep 21', 'Demo for the office team', 'Thomas Morrison'],
			],
		},
	];

	for (const d of NEW_BUSINESS) {
		d.value = yearly(d.plan, d.seats);
	}

	const DEALS = fromAccounts
		.concat(NEW_BUSINESS)
		.sort((x, y) => x.closes.localeCompare(y.closes))
		.slice(0, 6);

	for (const d of DEALS) {
		d.date = new Date(
			Number(d.closes.slice(0, 4)),
			Number(d.closes.slice(5, 7)) - 1,
			Number(d.closes.slice(8, 10)),
		);
	}

	/* Today's follow-ups. done and overdue are as of late morning. */
	const TASKS = [
		{
			time: '09:00',
			how: 'Call',
			deal: DEALS[0].id,
			note: 'Chase the signed order form',
			done: false,
			overdue: true,
		},
		{ time: '10:30', how: 'Email', deal: DEALS[1].id, note: 'Send the quote to sign', done: true },
		{ time: '13:00', how: 'Video', deal: DEALS[2].id, note: 'Go through the proposal', done: false },
		{ time: '14:30', how: 'Call', deal: DEALS[3].id, note: 'Answer questions on the numbers', done: false },
		{ time: '16:00', how: 'Email', deal: DEALS[4].id, note: 'Confirm the seat count', done: false },
		{ time: '17:00', how: 'Email', deal: DEALS[5].id, note: 'Send the order form', done: false },
	];
	const HOW = { Call: 'bi-telephone', Email: 'bi-envelope', Video: 'bi-camera-video' };

	/* New annual revenue won each month, in thousands, by plan. */
	const WON = {
		months: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
		years: ['2025', '', '', '2026', '', '', '', '', '', '', '', ''],
		plans: [
			{ name: 'Basic', data: [18, 16, 12, 21, 19, 24, 22, 25, 28, 23, 26, 31] },
			{ name: 'Pro', data: [64, 58, 49, 71, 66, 78, 74, 83, 91, 80, 88, 97] },
			{ name: 'Max', data: [92, 110, 76, 98, 121, 134, 118, 142, 168, 139, 151, 176] },
		],
	};

	/* Formatting */
	function fmtFull(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function fmtShort(n) {
		if (n >= 1e6) return `$${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
		return `$${Math.round(n / 1000)}k`;
	}

	function dateText(d) {
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function fromToday(d) {
		const days = Math.round((d - TODAY) / 864e5);
		if (days === 0) return 'Today';
		if (days === 1) return 'Tomorrow';
		return `In ${days} days`;
	}

	/* A stage reads the same everywhere: its color from the pipeline bar, then its name. */
	function stageMark(key) {
		const i = STAGES.findIndex((s) => s.key === key);
		return `<span class="pipe-stage"><span class="pipe-stage-dot pipe-tone-${i + 1}" aria-hidden="true"></span>${STAGES[i].name}</span>`;
	}

	function dealById(id) {
		return DEALS.find((d) => d.id === id);
	}

	function avatars(root) {
		return pickAll('[data-basalt-avatar]', root).forEach((el) => window.Basalt.avatar && window.Basalt.avatar(el));
	}

	/* Open pipeline */
	/* One tile per stage, as wide as its share of the open value. */
	function drawStages() {
		const deals = STAGES.reduce((a, s) => a + s.deals, 0);
		const value = STAGES.reduce((a, s) => a + s.value, 0);
		const likely = STAGES.reduce((a, s) => a + s.value * s.rate, 0);
		pick('[data-pipe-stages]').innerHTML = STAGES.map(
			(s, i) =>
				`<li class="pipe-flow-stage pipe-tone-${i + 1}" style="--pipe-share: ${(s.value / value).toFixed(4)}; --pipe-i: ${i}"><span class="pipe-flow-name"><span class="pipe-stage-dot" aria-hidden="true"></span>${s.name}</span><span class="pipe-flow-value">${fmtShort(s.value)}</span><span class="pipe-flow-meta">${s.deals} deals · ${Math.round(s.rate * 100)}% close</span><span class="pipe-flow-share" role="img" aria-label="${Math.round((s.value / value) * 100)}% of the open value"><span></span></span></li>`,
		).join('');
		pick('[data-pipe-stages-sub]').textContent =
			`${deals} deals worth ${fmtShort(value)}, from first call to contract.`;
		const early = (STAGES[0].value + STAGES[1].value) / value;
		pick('[data-pipe-stages-note]').textContent =
			`${Math.round(early * 100)}% of the value is still at Qualified or Demo. Forecast: ${fmtShort(likely)}, from each stage’s close rate.`;
		pick('[data-pipe-fig="weighted"]').textContent = fmtShort(likely);
	}

	/* This week's winners */
	/* The deals signed since Monday, added up per rep; the top three stand
	   on the podium with the winner in the middle. */
	const SALES = window.Basalt.data.deals;
	const PLACE = ['1st', '2nd', '3rd'];

	function isoDay(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function fmtK(n) {
		return `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
	}

	function drawPodium() {
		const monday = new Date(TODAY);
		monday.setDate(TODAY.getDate() - ((TODAY.getDay() + 6) % 7));
		const from = isoDay(monday);
		const to = isoDay(TODAY);
		const wins = SALES.list().filter((d) => d.stage === 'signed' && d.signed >= from && d.signed <= to);
		const reps = new Map();
		for (const d of wins) {
			const rep = reps.get(d.owner) || { name: d.owner, value: 0, deals: [] };
			rep.value += d.value;
			rep.deals.push(d);
			reps.set(d.owner, rep);
		}
		const top = [...reps.values()].sort((a, b) => b.value - a.value).slice(0, 3);
		const total = wins.reduce((a, d) => a + d.value, 0);
		const podium = pick('[data-pipe-podium]');
		podium.innerHTML = top
			.map(
				(r, i) =>
					`<li class="pipe-pod pipe-pod-${i + 1}"><span class="basalt-avatar pipe-pod-face" data-basalt-avatar data-name="${htmlSafe(r.name)}" aria-hidden="true"></span><a class="pipe-pod-name" href="${SALES.ownerUrl(r.name)}"><span class="visually-hidden">${PLACE[i]} place: </span>${htmlSafe(r.name)}</a><span class="pipe-pod-value">${fmtK(r.value)}</span><span class="pipe-pod-meta">${r.deals.length} ${r.deals.length === 1 ? 'deal' : 'deals'} won</span><span class="pipe-pod-step" aria-hidden="true"><span>${i + 1}</span></span></li>`,
			)
			.join('');
		avatars(podium);
		pick('[data-pipe-wins-total]').textContent = fmtK(total);
		pick('[data-pipe-wins-count]').textContent = String(wins.length);
		const best = wins.reduce((a, d) => (d.value > a.value ? d : a), wins[0]);
		pick('[data-pipe-wins-note]').textContent = best
			? `Biggest win: ${best.company}, ${best.title}, ${fmtFull(best.value)} a year.`
			: '';
	}

	/* Today's follow-ups */
	const todayList = pick('[data-pipe-today]');
	function drawToday() {
		todayList.innerHTML = TASKS.map((t, i) => {
			const d = dealById(t.deal);
			const id = `pipe-task-${i}`;
			return `<li class="pipe-task${t.done ? ' is-done' : ''}${t.overdue && !t.done ? ' is-late' : ''}"><input class="form-check-input" type="checkbox" id="${id}"${t.done ? ' checked' : ''} data-pipe-task="${i}" aria-label="Done: ${htmlSafe(`${t.how.toLowerCase()} ${d.company}`)}"><span class="pipe-task-time"><span class="pipe-task-clock">${ampm(t.time)}</span><span class="pipe-task-how"><i class="bi ${HOW[t.how]}" aria-hidden="true"></i>${t.overdue && !t.done ? 'Overdue' : t.how}</span></span><div class="pipe-task-what"><button type="button" class="pipe-task-deal" data-pipe-open="${d.id}">${htmlSafe(d.company)}</button><p class="pipe-task-note">${htmlSafe(t.note)}</p></div><span class="pipe-task-side"><span class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${htmlSafe(d.owner)}" title="${htmlSafe(d.owner)}" aria-label="Owner: ${htmlSafe(d.owner)}" role="img"></span></span></li>`;
		}).join('');
		avatars(todayList);
		const left = TASKS.filter((t) => !t.done).length;
		const late = TASKS.filter((t) => !t.done && t.overdue).length;
		pick('[data-pipe-today-sub]').textContent =
			`Thursday, October 8 · ${left ? `${left} to do${late ? `, ${late} overdue` : ''}` : 'all done'}`;
	}
	todayList.addEventListener('change', (e) => {
		const box = e.target.closest('[data-pipe-task]');
		if (!box) return;
		const i = Number(box.getAttribute('data-pipe-task'));
		TASKS[i].done = box.checked;
		drawToday();
		const again = pick(`[data-pipe-task="${i}"]`, todayList);
		if (again) again.focus({ preventScroll: true });
	});

	/* Closing soon */
	const dealsBody = pick('[data-pipe-deals]');
	function drawDeals() {
		const open = DEALS.filter((d) => !d.won);
		dealsBody.innerHTML = open
			.map(
				(d) =>
					`<tr data-pipe-row="${d.id}"><td><a class="pipe-deal-name" href="deal-details.html?id=${encodeURIComponent(d.id)}">${htmlSafe(d.company)}</a><span class="pipe-deal-plan">${d.plan} · ${d.seats} seats</span></td><td class="pipe-deal-stage">${stageMark(d.stage)}</td><td class="pipe-deal-owner"><span class="pipe-owner" title="${htmlSafe(d.owner)}"><span class="basalt-avatar basalt-avatar-xs" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(d.owner)}"></span><span class="pipe-owner-name">${htmlSafe(d.owner)}</span></span></td><td class="pipe-deal-close"><span class="pipe-deal-date">${dateText(d.date)}</span><span class="pipe-deal-when">${fromToday(d.date)}</span></td><td class="pipe-num">${fmtFull(d.value)}</td><td class="pipe-deal-go"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-pipe-open="${d.id}" aria-label="Quick view: ${htmlSafe(d.company)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="btn btn-icon btn-sm" href="deal-details.html?id=${encodeURIComponent(d.id)}" aria-label="Open full page: ${htmlSafe(d.company)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a></span></td></tr>`,
			)
			.join('');
		avatars(dealsBody);
		if (window.Basalt.tips) window.Basalt.tips(dealsBody);
		const empty = pick('[data-pipe-deals-empty]');
		const table = pick('.pipe-deals-table');
		table.hidden = !open.length;
		empty.hidden = !!open.length;
		empty.innerHTML = open.length
			? ''
			: `<div class="basalt-empty basalt-empty-compact"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-trophy"></i></span><h3 class="basalt-empty-title">Nothing left closing soon</h3><p class="basalt-empty-text">Every deal on this list is signed. The next ones are in the deal pipeline.</p><div class="basalt-empty-actions"><a class="btn btn-sm btn-primary" href="deal-pipeline.html">Open the deal pipeline</a></div></div>`;
		const late = STAGES[3].deals + STAGES[4].deals;
		const rest = late - open.length;
		pick('[data-pipe-deals-sub]').textContent = open.length
			? `The ${open.length} soonest of ${late} deals at Proposal or Negotiation.`
			: `${late} more deals at Proposal or Negotiation are in the deal pipeline.`;
		pick('[data-pipe-deals-foot]').hidden = !open.length;
		pick('[data-pipe-deals-rest]').textContent =
			rest > 0
				? `${rest} more are due to close by the end of the year.`
				: 'All the deals at these stages are listed.';
	}
	/* A click anywhere on a row goes to the deal's own page, like its name
     (Cmd/Ctrl or middle click: a new tab); the panel icon opens the quick
     view. */
	function openRowPage(e) {
		if (e.target.closest('a, button')) return;
		const row = e.target.closest('[data-pipe-row]');
		if (!row) return;
		const href = pick('.pipe-deal-name', row).href;
		if (e.metaKey || e.ctrlKey || e.button === 1) window.open(href, '_blank', 'noopener');
		else location.href = href;
	}
	dealsBody.addEventListener('click', openRowPage);
	dealsBody.addEventListener('auxclick', (e) => {
		if (e.button === 1) openRowPage(e);
	});
	document.addEventListener('click', (e) => {
		const btn = e.target.closest('[data-pipe-open]');
		if (btn) openDeal(btn.getAttribute('data-pipe-open'));
	});

	/* Deal quick view */
	const sheet = pick('#pipe-deal');

	function d$(k) {
		return pick(`[data-pipe-d="${k}"]`, sheet);
	}

	let current = null;
	function drawDeal(d) {
		current = d;
		const s = stageOf(d.stage);
		const at = d.won ? STAGES.length : STAGES.indexOf(s);
		d$('avatar').setAttribute('data-name', d.company);
		avatars(sheet);
		d$('name').textContent = d.company;
		d$('sub').textContent = `${d.plan} · ${d.seats} seats · ${d.city}`;
		d$('body').innerHTML =
			`<section class="pipe-sum" aria-label="Summary"><p class="pipe-sum-value">${fmtFull(d.value)}<span>a year</span></p>${d.won ? `<p class="pipe-sum-line"><span class="basalt-status basalt-status-dot basalt-status-success">Won</span></p><p class="pipe-sum-line">Signed today. ${d.acct ? `${htmlSafe(d.title)} starts on ${htmlSafe(d.company)}’s plan.` : `${htmlSafe(d.company)} is now a customer account.`}</p>` : `<p class="pipe-sum-line">${stageMark(d.stage)}</p><p class="pipe-sum-line">Closes ${dateText(d.date)} (${fromToday(d.date).toLowerCase()}). Deals at ${s.name} close ${Math.round(s.rate * 100)}% of the time.</p>`}</section><section aria-labelledby="pipe-deal-stage"><h3 class="pipe-sec-title" id="pipe-deal-stage">Where it stands</h3><ol class="pipe-track" aria-hidden="true">${STAGES.map((x, i) => `<li class="${i <= at ? 'is-done' : ''}"></li>`).join('')}</ol><p class="pipe-track-text">${d.won ? 'Through all five stages and signed.' : `Stage ${at + 1} of ${STAGES.length}: <strong>${s.name}</strong>${STAGES[at + 1] ? `. Next is ${STAGES[at + 1].name}.` : '. Next is the signature.'}`}</p></section><section aria-labelledby="pipe-deal-next"><h3 class="pipe-sec-title" id="pipe-deal-next">Next step</h3><p class="pipe-next">${htmlSafe(d.won ? 'Book the kick-off call to set up their workspace.' : d.next)}</p></section><section class="pipe-contact" aria-label="Contact"><span class="basalt-avatar" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(d.contact.name)}"></span><span class="pipe-contact-text">${d.contact.key ? `<a class="pipe-contact-name" href="person-details.html?id=${encodeURIComponent(d.contact.key)}">${htmlSafe(d.contact.name)}</a>` : `<span class="pipe-contact-name">${htmlSafe(d.contact.name)}</span>`}<span class="pipe-contact-role">${htmlSafe(d.contact.role)} · Contact</span></span><a class="btn btn-outline-secondary btn-sm pipe-contact-mail" href="mailto:${htmlSafe(d.contact.email)}" aria-label="Email ${htmlSafe(d.contact.name)} at ${htmlSafe(d.contact.email)}"><i class="bi bi-envelope me-1" aria-hidden="true"></i>Email</a></section><section aria-labelledby="pipe-deal-log"><div class="pipe-sec-head"><h3 class="pipe-sec-title" id="pipe-deal-log">Recent activity</h3>${d.won ? '' : '<button type="button" class="btn btn-outline-secondary btn-sm" data-pipe-log><i class="bi bi-telephone me-1" aria-hidden="true"></i>Log a call</button>'}</div><ul class="pipe-log">${d.log.map((l) => `<li><span class="pipe-log-date">${l[0]}</span><span class="pipe-log-what">${htmlSafe(l[1])}<span class="pipe-log-who">${htmlSafe(l[2])}</span></span></li>`).join('')}</ul></section>`;
		avatars(d$('body'));
		pick('[data-pipe-full]', sheet).href = `deal-details.html?id=${encodeURIComponent(d.id)}`;
		pick('[data-pipe-account]', sheet).href =
			`company-details.html${d.acct ? `?id=${encodeURIComponent(d.acct)}` : ''}`;
		pick('[data-pipe-won]', sheet).hidden = !!d.won;
		pick('[data-pipe-account]', sheet).hidden = !d.won;
	}
	function openDeal(id) {
		const d = dealById(id);
		if (!d) return;
		drawDeal(d);
		bootstrap.Offcanvas.getOrCreateInstance(sheet).show();
	}
	sheet.addEventListener('shown.bs.offcanvas', () => d$('name').focus({ preventScroll: true }));

	sheet.addEventListener('click', (e) => {
		if (!current || !e.target.closest('[data-pipe-log]')) return;
		toast({ tone: 'success', title: 'Call logged', text: `Added to ${current.company}’s activity.` });
		current.log.unshift(['Oct 8', 'Call logged', 'John Armstrong']);
		drawDeal(current);
		pick('[data-pipe-log]', sheet).focus({ preventScroll: true });
	});

	pick('[data-pipe-won]', sheet).addEventListener('click', () => {
		const d = current;
		if (!d) return;
		const s = stageOf(d.stage);
		s.deals -= 1;
		s.value -= d.value;
		d.won = true;
		d.log.unshift(['Oct 8', 'Marked as won', 'John Armstrong']);

		for (const t of TASKS) {
			if (t.deal === d.id) t.done = true;
		}

		/* Its row is gone, so focus goes back to the list it left. */
		sheet.addEventListener('hidden.bs.offcanvas', () => pick('#pipe-deals-title').focus({ preventScroll: true }), {
			once: true,
		});
		bootstrap.Offcanvas.getOrCreateInstance(sheet).hide();
		drawStages();
		drawDeals();
		drawToday();
		toast({
			tone: 'success',
			title: `${d.company} signed`,
			text: `${fmtFull(d.value)} a year${d.acct ? ` more on ${d.company}’s ${d.plan} plan.` : ` on ${d.plan}. It is now a customer account.`}`,
			actions: d.acct
				? [
						{
							label: 'Open account',
							onClick: () => {
								window.location.href = `company-details.html?id=${encodeURIComponent(d.acct)}`;
							},
						},
					]
				: [],
		});
	});

	/* Add a deal */
	const addDialog = pick('#pipe-add');
	const form = pick('[data-pipe-add]');
	const seats = pick('#pipe-add-seats');
	const company = pick('#pipe-add-company');
	const closes = pick('#pipe-add-close');

	function plan() {
		return (pick('input[name="plan"]:checked', form) || {}).value || 'Pro';
	}

	function seatCount() {
		const n = Number(seats.value);
		return Number.isInteger(n) && n >= 1 && n <= 2000 ? n : 0;
	}

	function showValue() {
		const n = seatCount();
		pick('[data-pipe-add-value]').innerHTML = n
			? `Worth <strong>${fmtFull(yearly(plan(), n))}</strong> a year.`
			: '';
	}
	form.addEventListener('input', (e) => {
		showValue();
		if (e.target.classList.contains('is-invalid'))
			e.target.classList.toggle('is-invalid', !e.target.checkValidity());
	});
	form.addEventListener('change', showValue);
	addDialog.addEventListener('shown.bs.modal', () => company.focus());
	addDialog.addEventListener('hidden.bs.modal', () => {
		form.reset();

		for (const el of pickAll('.is-invalid', form)) {
			el.classList.remove('is-invalid');
		}

		showValue();
	});
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		company.value = company.value.trim();
		const bad = [company, seats, closes].filter((el) => !el.checkValidity() || (el === seats && !seatCount()));

		for (const el of [company, seats, closes]) {
			el.classList.toggle('is-invalid', bad.includes(el));
		}

		if (bad.length) {
			bad[0].focus();
			return;
		}
		const value = yearly(plan(), seatCount());
		STAGES[0].deals += 1;
		STAGES[0].value += value;
		drawStages();
		const name = company.value;
		const owner = pick('#pipe-add-owner').value;
		const iso = window.Basalt.datepicker.get(closes);
		const closeDay = new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
		bootstrap.Modal.getOrCreateInstance(addDialog).hide();
		toast({
			tone: 'success',
			title: 'Deal added',
			text: `${name}, ${fmtFull(value)} a year, is in Qualified with ${owner}, expected to close ${dateText(closeDay)}.`,
		});
	});

	/* New business won */
	const canvas = pick('[data-pipe-chart]');
	let chart = null;
	function colors() {
		function token(n, f) {
			return window.Basalt.token ? window.Basalt.token(n, f) : f;
		}

		const text = token('--basalt-copy', '#12233a');
		/* Canvas needs a plain color: the text color at low alpha for the grid. */
		const rgb = /^#([0-9a-f]{6})$/i.exec(text.trim());
		const n = rgb ? parseInt(rgb[1], 16) : 0x12233a;
		const grid = `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, .08)`;
		return {
			series: [1, 2, 7].map((n) => token(`--basalt-series-${n}`, '#6d3fe0')),
			text,
			quiet: token('--basalt-copy-muted', '#5f7186'),
			surface: token('--basalt-plane', '#ffffff'),
			border: token('--basalt-edge-strong', '#d0d7e2'),
			grid,
		};
	}
	function drawChart(animate) {
		if (!window.Chart || !canvas) return;
		if (chart) chart.destroy();
		const c = colors();
		const font = { family: "'Schibsted Grotesk', sans-serif", size: 11.5 };
		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels: WON.months.map((m, i) => (WON.years[i] ? [m, WON.years[i]] : m)),
				datasets: WON.plans.map((p, i) => ({
					label: p.name,
					data: p.data,
					backgroundColor: c.series[i],
					borderColor: c.surface,
					borderWidth: { top: i < WON.plans.length - 1 ? 2 : 0 },
					borderRadius: i === WON.plans.length - 1 ? { topLeft: 5, topRight: 5 } : 0,
					borderSkipped: false,
					maxBarThickness: 34,
				})),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !reduceMotion ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: c.surface,
						titleColor: c.text,
						bodyColor: c.text,
						footerColor: c.text,
						borderColor: c.border,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
						titleFont: { family: font.family, size: 12, weight: '600' },
						bodyFont: { family: font.family, size: 12 },
						footerFont: { family: font.family, size: 12, weight: '600' },
						callbacks: {
							title: (items) =>
								`${WON.months[items[0].dataIndex]} ${items[0].dataIndex < 3 ? '2025' : '2026'}`,
							label: (item) => `${item.dataset.label}: $${item.raw}k`,
							footer: (items) => `Total: $${items.reduce((a, it) => a + it.raw, 0)}k`,
						},
					},
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: { color: c.quiet, font, maxRotation: 0, autoSkipPadding: 8 },
					},
					y: {
						stacked: true,
						grid: { color: c.grid },
						border: { display: false },
						ticks: { color: c.quiet, font, maxTicksLimit: 5, callback: (v) => `$${v}k` },
					},
				},
			},
		});
	}

	start();
})();
