/**
 * What the clinic asks of others, one list per page, read from
 * window.Basalt.data.clinicOrders (clinic-orders.js) and the providers in
 * window.Basalt.data.clinic (clinic.js):
 *   lab-orders-and-results.html    every lab order by where it is (at the
 *                                  lab, not seen, to act on, told), who
 *                                  has not seen theirs, the next step on
 *                                  each; New order
 *   prescriptions.html  renewals waiting and every prescription;
 *                                  write or change one
 *   referrals.html      the stages on their own and every
 *                                  referral; send or change one
 *   visit-notes.html    every visit note, unsigned first; read
 *                                  one and sign it
 * Each list carries the template's list kit: a search, a Filters menu,
 * sortable heads, a running count, an honest empty state and a quick view
 * that steps through the rows. healthcare.js still draws the analytics band
 * and answers the plain [data-hc-toast] buttons. What changes lives in
 * memory until the page reloads.
 */
(() => {
	'use strict';

	const root = pick('[data-hc-root]', document);
	const orders = window.Basalt.data?.clinicOrders;
	const clinic = window.Basalt.data?.clinic;
	const page = root?.dataset.hcPage;
	const PAGES = ['lab-results', 'prescriptions', 'referrals', 'visit-notes', 'insurance-claims', 'patient-billing'];
	if (!root || !orders || !clinic || !PAGES.includes(page)) return;

	/* The demo's today, and where each kind of reference leads. Only Rhiannon
	   has a chart written out; every patient links to hers. */
	const TODAY = '2026-10-09';
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
	const CHART = 'patient-chart.html';
	const PROVIDERS = 'providers.html';
	const REPORTS = 'imaging-and-reports.html';
	const STOCK = 'stock-levels.html';
	const MESSAGES = 'chat.html';
	/* New orders are written by the signed-in doctor unless another is picked. */
	const ME = 'ev';
	/* A referral sent this many days ago with no reply is stuck. */
	const STUCK_DAYS = 7;

	const RX_STATUS = {
		active: { name: 'Active', pill: 'hc-pill-ok' },
		renewal: { name: 'Renewal asked', pill: 'hc-pill-wait' },
		visit: { name: 'Needs a visit', pill: 'hc-pill-wait' },
		pharmacy: { name: 'At the pharmacy', pill: 'hc-pill-info' },
		finished: { name: 'Finished', pill: '' },
	};
	const REF_STATUS = {
		sent: { name: 'Sent', pill: 'hc-pill-wait' },
		accepted: { name: 'Accepted', pill: 'hc-pill-info' },
		scheduled: { name: 'Scheduled', pill: 'hc-pill-info' },
		seen: { name: 'Seen', pill: 'hc-pill-ok' },
	};
	const REF_STEPS = ['sent', 'accepted', 'scheduled', 'seen'];
	const NOTE_STATUS = {
		draft: { name: 'Draft', pill: 'hc-pill-info' },
		unsigned: { name: 'To sign', pill: 'hc-pill-wait' },
		signed: { name: 'Signed', pill: 'hc-pill-ok' },
	};
	const VISIT = 'appointment-details.html';

	/* Each stage tile's tone on the chart ramp's state colors. */
	const STAGE_TONES = {
		sent: 'var(--basalt-warning)',
		accepted: 'var(--basalt-flare)',
		scheduled: 'var(--basalt-hue)',
		seen: 'var(--basalt-success)',
	};

	const drawer = pick('#hco-drawer', document);
	let ids = 0;

	function start() {
		if (page === 'lab-results') startLabWork();
		if (page === 'prescriptions') startPrescriptions();
		if (page === 'referrals') startReferrals();
		if (page === 'visit-notes') startNotes();
		if (page === 'insurance-claims') startClaims();
		if (page === 'patient-billing') startBilling();
	}

	/* Lab results */

	/* What each stage of a lab order is called, and its tone. */
	const LAB_STAGE = {
		lab: { name: 'At the lab', pill: 'hc-pill-info', tone: 'var(--basalt-flare)' },
		back: { name: 'Not seen', pill: 'hc-pill-late', tone: 'var(--basalt-warning)' },
		seen: { name: 'To act on', pill: 'hc-pill-wait', tone: 'var(--basalt-hue)' },
		told: { name: 'Told', pill: 'hc-pill-ok', tone: 'var(--basalt-success)' },
	};

	/** The four steps an order moves through: ordered and collected both
	 * count as at the lab. */
	function labStep(r) {
		return r.stage === 'ordered' ? 'lab' : r.stage;
	}

	function startLabWork() {
		/* The list's after-paint runs during setup, before listKit returns. */
		let list = null;
		list = listKit({
			card: pick('[data-hco-list="labs"]'),
			records: () => orders.labWork,
			noun: 'orders',
			blank: { title: 'No lab orders', text: 'Order one from the button above.', icon: 'droplet' },
			tabs: {
				all: () => true,
				unseen: (r) => r.stage === 'back',
				call: (r) => r.stage === 'seen' && r.next === 'call',
				send: (r) => r.stage === 'seen' && r.next !== 'call',
				lab: (r) => labStep(r) === 'lab',
				told: (r) => r.stage === 'told',
			},
			facets: [
				{
					key: 'by',
					legend: 'Ordered by',
					options: () => providerOptions(orders.labWork.map((r) => r.with)),
					test: (r, value) => r.with === value,
				},
				{
					key: 'flag',
					legend: 'Result',
					options: () => [
						['abnormal', 'Needs a look'],
						['normal', 'Normal'],
					],
					test: (r, value) => r.flag === value,
				},
			],
			sorts: {
				name: (r) => r.name,
				stage: (r) => `${['back', 'seen', 'lab', 'told'].indexOf(labStep(r))}${r.back ?? r.ordered}`,
			},
			sort: { key: 'stage', ascending: true },
			text: (r) => [r.name, r.test, providerName(r.with), LAB_STAGE[labStep(r)].name].join(' '),
			count: (shown, total) => countLine(shown, total, 'order', 'orders'),
			row: labRow,
			fill: fillLab,
			after: () => {
				drawLabStages();
				drawUnseen(() => list?.paint());
			},
		});
		pick('[data-hco-stages]').addEventListener('click', (event) => {
			const tile = event.target.closest('[data-hco-stage]');
			if (!tile) return;
			const want = tile.getAttribute('aria-pressed') === 'true' ? 'all' : tile.dataset.hcoStage;
			list.setTab(want);
			if (want !== 'all') list.card.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: 'start' });
		});
		root.addEventListener('click', (event) => {
			const act = event.target.closest('[data-hco-lab-act]');
			if (act) labAct(act.dataset.hcoLabAct, act.dataset.hcoId, list);
		});
		wireDrawerActions((action, record) => {
			hideDrawer();
			labAct(action, record.id, list);
		});
		wireOrderDialog(list);
	}

	/** The one thing to do next on an order, as a button that does it. */
	function labNext(r) {
		const doctor = clinic.short(r.with);
		if (r.stage === 'back') return r.reminded ? ['', `${doctor} reminded`] : ['remind', `Remind ${doctor}`];
		if (r.stage === 'seen') {
			if (r.next === 'call') return ['call', 'Call patient'];
			if (r.next === 'forward') return ['forward', `Send to ${r.to.replace(/^Dr\. \w+ /, 'Dr. ')}`];
			return ['send', 'Send to patient'];
		}
		if (labStep(r) === 'lab') return r.due && r.due < TODAY && !r.chased ? ['chase', 'Chase the lab'] : ['', ''];
		return ['', ''];
	}

	/** Where an order is, in words: how long it has waited at this step. */
	function labWhere(r) {
		const step = labStep(r);
		if (step === 'lab') {
			if (r.stage === 'ordered') return 'Ordered today, not drawn yet';
			if (r.due && r.due < TODAY) return `Due back ${shortDay(r.due)}, late`;
			return r.due ? `Due back ${r.due === TODAY ? 'today' : shortDay(r.due)}` : 'At the lab';
		}
		const days = daysBetween(r.back.slice(0, 10), TODAY);
		const since = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
		if (step === 'back') return `Back ${since}`;
		if (step === 'seen') return `Seen, back ${since}`;
		return r.told ?? `Told ${since}`;
	}

	function labRow(r) {
		const step = labStep(r);
		const [act, label] = labNext(r);
		const name = htmlSafe(`${r.test} for ${r.name}`);
		const flag = r.flag === 'abnormal' && step !== 'lab' ? '<span class="hco-flag">Needs a look</span>' : '';
		const next = act
			? `<button type="button" class="btn btn-sm ${act === 'call' ? 'btn-primary' : 'btn-outline-secondary'}" data-hco-lab-act="${act}" data-hco-id="${r.id}">${label}</button>`
			: label
				? `<span class="hc-pill hc-pill-ok">${label}</span>`
				: '';
		return `<tr data-hco-row="${r.id}" class="hco-row">
			<td class="hco-col-who">${patientLink(r.name)}</td>
			<td class="hco-col-test"><a href="${CHART}#labs" class="hco-cell-link">${htmlSafe(r.test)}</a>${flag}</td>
			<td class="hco-col-by">${providerLink(r.with)}</td>
			<td class="hco-col-state"><span class="hc-pill ${LAB_STAGE[step].pill}">${LAB_STAGE[step].name}</span><span class="hc-who-meta">${labWhere(r)}</span></td>
			<td class="hco-col-act"><div class="basalt-row-actions">${next}${rowIcons(r.id, `${CHART}#labs`, name)}</div></td>
		</tr>`;
	}

	/** Does the next step and moves the order on; Undo puts it back. */
	function labAct(action, id, list) {
		const r = orders.labWork.find((x) => x.id === id);
		if (!r) return;
		const before = { ...r };
		const doctor = clinic.short(r.with);
		const words = {
			remind: [`${doctor} reminded`, `${doctor} has a note to look at ${r.test.toLowerCase()} for ${r.name}.`],
			seen: ['Marked seen', `${r.test} for ${r.name} is seen; the next step is on the list.`],
			call: ['Patient called', `${r.name} knows about the ${r.test.toLowerCase()}. It is noted on the chart.`],
			send: ['Sent to patient', `${r.name} has the ${r.test.toLowerCase()} in the patient app, by text.`],
			forward: ['Sent on', `${r.to} has the ${r.test.toLowerCase()} for ${r.name}.`],
			chase: ['Lab chased', `The lab has a reminder about ${r.name}'s ${r.test.toLowerCase()}.`],
		}[action];
		if (!words) return;
		if (action === 'remind') r.reminded = true;
		if (action === 'seen') r.stage = 'seen';
		if (action === 'chase') r.chased = true;
		if (action === 'call' || action === 'send' || action === 'forward') {
			r.stage = 'told';
			r.told = { call: 'Called today', send: 'Sent to the patient today', forward: `Sent to ${r.to} today` }[
				action
			];
		}
		list.paint();
		toast('success', words[0], words[1], [
			{
				label: 'Undo',
				onClick: () => {
					Object.assign(r, before);
					delete r.told;
					if (!before.reminded) delete r.reminded;
					if (!before.chased) delete r.chased;
					list.paint();
				},
			},
		]);
	}

	/* The tube each test is drawn into, by its cap color as labs use them:
	   lavender for blood counts and HbA1c, light blue for clotting, gray for
	   glucose, yellow for urine, gold for the rest of the chemistry. */
	function tubeOf(test) {
		if (/blood count|HbA1c|new patient/i.test(test)) return 'lavender';
		if (/clott|INR|coag/i.test(test)) return 'blue';
		if (/glucose/i.test(test)) return 'gray';
		if (/urine/i.test(test)) return 'yellow';
		return 'gold';
	}

	function drawLabStages() {
		const host = pick('[data-hco-stages]');
		const tab = pick('[data-hco-list="labs"] input[name="hco-view"]:checked')?.value ?? 'all';
		const of = (step) => orders.labWork.filter((r) => labStep(r) === step);
		const late = of('lab').filter((r) => r.due && r.due < TODAY).length;
		const oldest = of('back').sort((a, b) => a.back.localeCompare(b.back))[0];
		const calls = of('seen').filter((r) => r.next === 'call').length;
		const stages = [
			{ key: 'lab', tab: 'lab', meta: late ? `${late} late back` : 'all on time', live: late > 0 },
			{
				key: 'back',
				tab: 'unseen',
				meta: oldest ? `oldest back ${shortDay(oldest.back.slice(0, 10))}` : 'every result seen',
				live: Boolean(oldest),
			},
			{ key: 'seen', tab: 'call', meta: calls ? `${calls} need a call` : 'nobody to call', live: calls > 0 },
			{ key: 'told', tab: 'told', meta: 'the patient knows', calm: true },
		];
		host.innerHTML = stages
			.map(
				(
					s,
				) => `<li><button type="button" class="hco-stage" data-hco-stage="${s.tab}" aria-pressed="${tab === s.tab}" style="--tone: ${LAB_STAGE[s.key].tone}">
					<span class="hco-stage-name">${LAB_STAGE[s.key].name}${s.live ? `<span class="hco-live${s.calm ? ' is-calm' : ''}" aria-hidden="true"></span>` : ''}</span>
					<span class="hco-stage-value">${of(s.key).length}</span>
					<span class="hco-stage-meta">${s.meta}</span>
					<span class="hco-rack" aria-hidden="true">${of(s.key)
						.map(
							(r) =>
								`<span class="hco-tube cap-${tubeOf(r.test)}${s.key === 'lab' && r.due && r.due < TODAY ? ' is-late' : ''}" title="${r.name} · ${r.test}"></span>`,
						)
						.join('')}</span>
				</button></li>`,
			)
			.join('');
		const unseen = of('back').length;
		pick('[data-hco-sub]').textContent = unseen
			? `${NUMBER_WORDS[unseen] ?? unseen} back and not seen yet. Those come first.`
			: 'Every result is seen.';
	}

	/** Results back but unseen, one chip per doctor with how many and a reminder. */
	function drawUnseen(repaint) {
		const host = pick('[data-hco-unseen]');
		const unseen = orders.labWork.filter((r) => r.stage === 'back');
		const by = [...new Set(unseen.map((r) => r.with))].map((id) => ({
			id,
			count: unseen.filter((r) => r.with === id).length,
			reminded: unseen.filter((r) => r.with === id).every((r) => r.reminded),
		}));
		pick('[data-hco-unseen-sub]').textContent = unseen.length
			? `${unseen.length} ${unseen.length === 1 ? 'result' : 'results'} back that their doctor has not opened.`
			: 'Every doctor has seen their results.';
		host.innerHTML = by.length
			? by
					.sort((a, b) => b.count - a.count)
					.map(
						(d) =>
							`<li class="hco-unseen-row">${providerLink(d.id)}<span class="hco-unseen-count"><b>${d.count}</b> not seen</span>${d.reminded ? '<span class="hc-pill hc-pill-ok">Reminded</span>' : `<button type="button" class="btn btn-sm btn-outline-secondary" data-hco-remind="${d.id}">Remind</button>`}</li>`,
					)
					.join('')
			: '<li class="hco-unseen-none"><i class="bi bi-check2-circle" aria-hidden="true"></i>All caught up</li>';
		window.Basalt.avatars?.(host);
		host.onclick = (event) => {
			const button = event.target.closest('[data-hco-remind]');
			if (!button) return;
			for (const r of unseen.filter((x) => x.with === button.dataset.hcoRemind)) r.reminded = true;
			repaint();
			toast(
				'success',
				'Reminder sent',
				`${clinic.short(button.dataset.hcoRemind)} has a note listing their results to look at.`,
			);
		};
	}

	/** The order in the quick view: where it is, what comes next, the patient. */
	function fillLab(r) {
		const step = labStep(r);
		const [act, label] = labNext(r);
		fillHead({
			name: r.name,
			title: r.test,
			sub: `${r.name} · ordered ${shortDay(r.ordered)}`,
			page: `${CHART}#labs`,
		});
		fillBody(`
			<section class="basalt-drawer-section" aria-labelledby="hco-d-where">
				<h3 id="hco-d-where" class="basalt-drawer-legend">Where it is</h3>
				<p class="hco-d-figure"><span class="hc-pill ${LAB_STAGE[step].pill}">${LAB_STAGE[step].name}</span></p>
				<p class="hco-d-note">${labWhere(r)}${r.flag === 'abnormal' && step !== 'lab' ? '. The result needs a look; it is on the chart.' : '.'}</p>
			</section>
			${patientSection(r.name, [['Ordered by', providerLink(r.with)]])}`);
		const actions = [{ href: `${CHART}#labs`, label: 'See the result', icon: 'bi-droplet' }];
		if (step === 'back') actions.push({ act: 'seen', label: 'Mark seen', icon: 'bi-eye', primary: true });
		else if (act) actions.push({ act, label, icon: 'bi-arrow-right', primary: true });
		fillFoot(actions);
	}

	function openOrderDialog(from) {
		const dialog = pick('#hco-order', document);
		const form = pick('form', dialog);
		form.reset();
		clearInvalid(form);
		fillPeople(pick('[name="patient"]', form), from?.name);
		fillOptions(
			pick('[name="test"]', form),
			orders.tests.map((t) => [t, t]),
			from ? closestTest(from.test) : '',
			'Pick a test',
		);
		fillOptions(pick('[name="by"]', form), providerOptions(), from?.with ?? ME);
		pick('[data-hco-order-title]', dialog).textContent = from ? 'Order a repeat' : 'New lab order';
		window.bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	function wireOrderDialog(list) {
		const dialog = pick('#hco-order', document);
		clearAsTyped(pick('form', dialog));
		for (const button of pickAll('[data-hco-new-order]')) button.addEventListener('click', () => openOrderDialog());
		pick('form', dialog).addEventListener('submit', (event) => {
			event.preventDefault();
			const form = event.currentTarget;
			if (!checkForm(form)) return;
			const data = new FormData(form);
			const urgent = data.get('urgency') === 'urgent';
			ids += 1;
			orders.labWork.unshift({
				id: `l-new-${ids}`,
				name: data.get('patient'),
				test: data.get('test'),
				with: data.get('by'),
				ordered: TODAY,
				stage: 'ordered',
				due: urgent ? TODAY : undefined,
			});
			list?.paint();
			window.bootstrap.Modal.getInstance(dialog)?.hide();
			toast(
				'success',
				'Lab order sent',
				`${data.get('test')} for ${data.get('patient')}${urgent ? ', marked urgent' : ''}. The lab prints the labels.`,
			);
		});
	}

	/** The order form's test closest to a result's name ("ALT, liver" asks for liver tests). */
	function closestTest(name) {
		const words = name.toLowerCase();
		return (
			orders.tests.find((t) => words.includes(t.toLowerCase()) || t.toLowerCase().includes(words)) ??
			(words.includes('liver') ? 'Liver tests' : words.includes('glucose') ? 'HbA1c' : '')
		);
	}

	/* Prescriptions */

	function startPrescriptions() {
		const list = listKit({
			card: pick('[data-hco-list="prescriptions"]'),
			records: () => orders.prescriptions,
			noun: 'prescriptions',
			blank: { title: 'No prescriptions yet', text: 'Write one from the button above.', icon: 'capsule' },
			tabs: {
				all: () => true,
				active: (r) => r.status === 'active',
				renewal: (r) => r.status === 'renewal' || r.status === 'visit',
				pharmacy: (r) => r.status === 'pharmacy',
				finished: (r) => r.status === 'finished',
			},
			facets: [
				{
					key: 'by',
					legend: 'Prescriber',
					options: () => providerOptions(orders.prescriptions.map((r) => r.by)),
					test: (r, value) => r.by === value,
				},
				{
					key: 'course',
					legend: 'Kind',
					options: () => [
						['ongoing', 'Ongoing'],
						['short', 'Short course'],
					],
					test: (r, value) => r.course === value,
				},
			],
			sorts: {
				name: (r) => r.name,
				med: (r) => r.med,
				issued: (r) => r.issued,
			},
			sort: { key: 'issued', ascending: false },
			text: (r) => [r.name, r.med, r.how, providerName(r.by), RX_STATUS[r.status].name].join(' '),
			count: (shown, total) => countLine(shown, total, 'prescription', 'prescriptions'),
			row: rxRow,
			fill: fillRx,
			after: drawRenewals,
		});

		pick('[data-hco-renewals-card]').addEventListener('click', (event) => {
			const button = event.target.closest('[data-hco-renew], [data-hco-visit]');
			if (!button) return;
			const record = findRx(button.dataset.hcoRenew ?? button.dataset.hcoVisit);
			if (button.dataset.hcoRenew) renewRx(record, list);
			else askForVisit(record, list);
		});
		wireDrawerActions((action, record) => {
			if (action === 'renew') renewRx(record, list);
			if (action === 'visit') askForVisit(record, list);
			if (action === 'collected') {
				record.status = 'active';
				list.paint();
				toast('success', 'Collected', `${record.name} has picked up ${record.med}.`);
			}
			if (action === 'stop') {
				const was = record.status;
				record.status = 'finished';
				list.paint();
				toast('info', 'Prescription stopped', `${record.med} for ${record.name} is stopped.`, [
					{
						label: 'Undo',
						onClick: () => {
							record.status = was;
							list.paint();
							list.refill();
						},
					},
				]);
			}
			if (action === 'edit') {
				hideDrawer();
				openRxDialog(record);
			}
			if (action === 'again') {
				hideDrawer();
				openRxDialog({ ...record, id: null });
			}
			if (['renew', 'visit', 'collected', 'stop'].includes(action)) list.refill();
		});
		for (const button of pickAll('[data-hco-new-rx]')) button.addEventListener('click', () => openRxDialog(null));
		wireRxDialog(list);
	}

	function rxRow(r) {
		const name = htmlSafe(`${r.med} for ${r.name}`);
		return `<tr data-hco-row="${r.id}" class="hco-row">
			<td class="hco-col-who">${patientLink(r.name)}</td>
			<td class="hco-col-med"><a href="${STOCK}" class="hco-cell-link">${htmlSafe(r.med)}</a></td>
			<td class="hco-col-how">${htmlSafe(r.how)}</td>
			<td class="hco-col-by">${providerLink(r.by)}</td>
			<td class="hco-col-when">${shortDay(r.issued)}</td>
			<td class="hco-col-state">${pill(RX_STATUS[r.status])}</td>
			<td class="hco-col-act"><div class="basalt-row-actions">${rowIcons(r.id, CHART, name)}</div></td>
		</tr>`;
	}

	/** Renewals waiting, oldest ask first, each with Renew and Needs a visit. */
	function drawRenewals() {
		const waiting = orders.prescriptions
			.filter((r) => r.status === 'renewal')
			.sort((a, b) => a.asked.localeCompare(b.asked));
		const body = pick('[data-hco-renewals]');
		const table = body.closest('table');
		table.hidden = !waiting.length;
		pick('[data-hco-renewals-empty]').hidden = waiting.length > 0;
		body.innerHTML = waiting
			.map(
				(r) => `<tr>
					<td class="hco-col-who">${patientLink(r.name)}</td>
					<td class="hco-col-med"><a href="${STOCK}" class="hco-cell-link">${htmlSafe(r.med)}</a></td>
					<td class="hco-col-when">${askedText(r.asked)}</td>
					<td class="hco-col-by">${providerLink(r.by)}</td>
					<td class="hco-col-act"><div class="hco-renew-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-hco-visit="${r.id}">Needs a visit</button><button type="button" class="btn btn-sm btn-primary" data-hco-renew="${r.id}">Renew</button></div></td>
				</tr>`,
			)
			.join('');
		window.Basalt.avatars?.(body);
		const oldest = waiting.length ? daysBetween(waiting[0].asked, TODAY) : 0;
		pick('[data-hco-renewals-sub]').textContent = waiting.length
			? `${NUMBER_WORDS[waiting.length] ?? waiting.length} asked this week. The oldest has waited ${oldest === 1 ? 'a day' : `${oldest} days`}.`
			: 'Every renewal is answered.';
	}

	function renewRx(record, list) {
		const was = { status: record.status, issued: record.issued };
		record.status = 'pharmacy';
		record.issued = TODAY;
		list.paint();
		toast('success', 'Renewed', `${record.med} for ${record.name} is at the pharmacy.`, [
			{
				label: 'Undo',
				onClick: () => {
					Object.assign(record, was);
					list.paint();
				},
			},
		]);
	}

	function askForVisit(record, list) {
		record.status = 'visit';
		list.paint();
		toast(
			'info',
			'Asked to book a visit',
			`${record.name} has a message to book a review before ${record.med} is renewed.`,
		);
	}

	function fillRx(r) {
		const record = clinic.patientRecord(r.name);
		fillHead({ name: r.name, title: r.med, sub: `${r.name} · ${r.how.toLowerCase()}`, page: CHART });
		fillBody(`
			<section class="basalt-drawer-section" aria-labelledby="hco-d-rx">
				<h3 id="hco-d-rx" class="basalt-drawer-legend">Prescription</h3>
				<p class="hco-d-state">${pill(RX_STATUS[r.status])}<span>${rxLine(r)}</span></p>
				<dl class="hco-facts">
					${fact('Medicine', `<a href="${STOCK}">${htmlSafe(r.med)}</a>`)}
					${fact('How', htmlSafe(r.how))}
					${fact('Prescriber', providerLink(r.by))}
					${fact('Last written', longDay(r.issued))}
					${fact('Refills left', r.course === 'short' ? 'None, a short course' : String(r.refills))}
				</dl>
			</section>
			${patientSection(r.name, [['Allergies', htmlSafe(record.allergies)]])}`);
		const actions = {
			renewal: [
				{ act: 'visit', label: 'Needs a visit' },
				{ act: 'renew', label: 'Renew', icon: 'bi-arrow-repeat', primary: true },
			],
			visit: [
				{ act: 'edit', label: 'Edit', icon: 'bi-pencil' },
				{ act: 'renew', label: 'Renew', icon: 'bi-arrow-repeat', primary: true },
			],
			active: [
				{ act: 'stop', label: 'Stop' },
				{ act: 'edit', label: 'Edit', icon: 'bi-pencil', primary: true },
			],
			pharmacy: [
				{ act: 'edit', label: 'Edit', icon: 'bi-pencil' },
				{ act: 'collected', label: 'Mark collected', icon: 'bi-bag-check', primary: true },
			],
			finished: [{ act: 'again', label: 'Write again', icon: 'bi-arrow-repeat', primary: true }],
		};
		fillFoot(actions[r.status]);
	}

	function rxLine(r) {
		if (r.status === 'renewal') return `Asked ${askedText(r.asked).toLowerCase()}.`;
		if (r.status === 'visit') return 'Waiting for a review visit before it is renewed.';
		if (r.status === 'pharmacy') return 'Sent to the pharmacy, not picked up yet.';
		if (r.status === 'finished') return `Ended after ${shortDay(r.issued)}.`;
		return `Taken since ${shortDay(r.issued)}.`;
	}

	function openRxDialog(record) {
		const dialog = pick('#hco-rx', document);
		const form = pick('form', dialog);
		form.reset();
		clearInvalid(form);
		form.dataset.id = record?.id ?? '';
		const editing = Boolean(record?.id);
		const patient = pick('[name="patient"]', form);
		fillPeople(patient, record?.name);
		patient.disabled = editing;
		fillOptions(
			pick('[name="how"]', form),
			orders.schedules.map((s) => [s, s]),
			record ? scheduleOf(record.how) : '',
			'Pick how often',
		);
		fillOptions(pick('[name="by"]', form), providerOptions(), record?.by ?? ME);
		pick('[name="med"]', form).value = record?.med ?? '';
		pick('[name="refills"]', form).value = record ? String(record.refills) : '2';
		const course = record?.course ?? 'ongoing';
		pick(`[name="course"][value="${course}"]`, form).checked = true;
		pick('[data-hco-rx-title]', dialog).textContent = editing ? 'Edit prescription' : 'New prescription';
		pick('[data-hco-rx-sub]', dialog).textContent = editing
			? `${record.name}. The pharmacy gets the change.`
			: 'It goes to the patient’s pharmacy once saved.';
		pick('[data-hco-rx-go]', dialog).textContent = editing ? 'Save changes' : 'Send to pharmacy';
		window.bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	function wireRxDialog(list) {
		const dialog = pick('#hco-rx', document);
		clearAsTyped(pick('form', dialog));
		pick('form', dialog).addEventListener('submit', (event) => {
			event.preventDefault();
			const form = event.currentTarget;
			if (!checkForm(form)) return;
			const data = new FormData(form);
			const fields = {
				med: data.get('med').trim(),
				how: data.get('how'),
				by: data.get('by'),
				refills: Number(data.get('refills')),
				course: data.get('course'),
			};
			const editing = findRx(form.dataset.id);
			if (editing) {
				Object.assign(editing, fields);
				list.paint();
				toast('success', 'Prescription changed', `${editing.med} for ${editing.name} is updated.`);
			} else {
				ids += 1;
				const record = {
					id: `rx-new-${ids}`,
					name: pick('[name="patient"]', form).value,
					...fields,
					issued: TODAY,
					status: 'pharmacy',
				};
				orders.prescriptions.unshift(record);
				list.reset();
				list.flash(record.id);
				toast('success', 'Prescription sent', `${record.med} for ${record.name} is at the pharmacy.`);
			}
			window.bootstrap.Modal.getInstance(dialog)?.hide();
		});
	}

	function findRx(id) {
		return orders.prescriptions.find((r) => r.id === id);
	}

	/** The form's schedule that a free "how" line starts with. */
	function scheduleOf(how) {
		return orders.schedules.find((s) => how.toLowerCase().startsWith(s.toLowerCase())) ?? '';
	}

	function askedText(iso) {
		const days = daysBetween(iso, TODAY);
		if (days === 0) return 'Today';
		return `${WEEKDAYS[new Date(`${iso}T12:00`).getDay()]}, ${shortDay(iso)}`;
	}

	/* Referrals */

	function startReferrals() {
		const list = listKit({
			card: pick('[data-hco-list="referrals"]'),
			records: () => orders.referrals,
			noun: 'referrals',
			blank: { title: 'No referrals yet', text: 'Send one from the button above.', icon: 'send' },
			tabs: {
				all: () => true,
				stuck: isStuck,
				sent: (r) => r.status === 'sent',
				accepted: (r) => r.status === 'accepted',
				scheduled: (r) => r.status === 'scheduled',
				seen: (r) => r.status === 'seen',
			},
			facets: [
				{
					key: 'to',
					legend: 'Sent to',
					options: () =>
						[...new Set(orders.referrals.map((r) => r.to))].sort().map((place) => [place, place]),
					test: (r, value) => r.to === value,
				},
				{
					key: 'by',
					legend: 'Referred by',
					options: () => providerOptions(orders.referrals.map((r) => r.by)),
					test: (r, value) => r.by === value,
				},
			],
			sorts: {
				name: (r) => r.name,
				sent: (r) => r.sent,
				status: (r) => `${isStuck(r) ? 0 : REF_STEPS.indexOf(r.status) + 1}${r.sent}`,
			},
			sort: { key: 'sent', ascending: true },
			text: (r) =>
				[r.name, r.why, r.to, r.toWho ? providerName(r.toWho) : '', providerName(r.by), r.question].join(' '),
			count: (shown, total) => countLine(shown, total, 'referral', 'referrals'),
			row: referralRow,
			fill: fillReferral,
			after: drawStages,
		});

		pick('[data-hco-stages]').addEventListener('click', (event) => {
			const tile = event.target.closest('[data-hco-stage]');
			if (!tile) return;
			const want = tile.getAttribute('aria-pressed') === 'true' ? 'all' : tile.dataset.hcoStage;
			list.setTab(want);
			if (want !== 'all') list.card.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: 'start' });
		});
		wireDrawerActions((action, record) => {
			if (action === 'chase') {
				record.chased = TODAY;
				toast(
					'success',
					'Reminder sent',
					`${record.to} has a reminder about ${record.name}’s ${record.why.toLowerCase()}.`,
				);
			}
			if (action === 'seen') {
				record.status = 'seen';
				record.letter = false;
				toast('success', 'Marked seen', `${record.name} was seen. The letter shows here once it arrives.`);
			}
			if (action === 'letter') {
				record.letterAsked = true;
				toast('info', 'Letter asked for', `${record.to} has been asked to send the letter for ${record.name}.`);
			}
			if (action === 'date' || action === 'edit') {
				hideDrawer();
				openReferralDialog(record, action === 'date');
				return;
			}
			list.paint();
			list.refill();
		});
		for (const button of pickAll('[data-hco-new-ref]'))
			button.addEventListener('click', () => openReferralDialog(null));
		wireReferralDialog(list);
	}

	function referralRow(r) {
		const name = htmlSafe(`${r.why} for ${r.name}`);
		return `<tr data-hco-row="${r.id}" class="hco-row">
			<td class="hco-col-who">${patientLink(r.name)}</td>
			<td class="hco-col-why">${htmlSafe(r.why)}</td>
			<td class="hco-col-to">${placeCell(r)}</td>
			<td class="hco-col-by">${providerLink(r.by)}</td>
			<td class="hco-col-when">${shortDay(r.sent)}</td>
			<td class="hco-col-state">${referralPill(r)}</td>
			<td class="hco-col-act"><div class="basalt-row-actions">${rowIcons(r.id, CHART, name)}</div></td>
		</tr>`;
	}

	function placeCell(r) {
		if (r.toWho) return personLink(clinic.provider(r.toWho).name, PROVIDERS, clinic.short(r.toWho));
		return htmlSafe(r.to);
	}

	function referralPill(r) {
		if (isStuck(r)) return `<span class="hc-pill hc-pill-late">No reply, ${daysBetween(r.sent, TODAY)} days</span>`;
		return pill(REF_STATUS[r.status]);
	}

	function isStuck(r) {
		return r.status === 'sent' && daysBetween(r.sent, TODAY) > STUCK_DAYS;
	}

	/** The four stages on their own, each a way into the list. A stage with
	 * something waiting on the clinic carries a live dot; the rest stay quiet. */
	function drawStages() {
		const host = pick('[data-hco-stages]');
		const tab = pick('[data-hco-list="referrals"] input[name="hco-view"]:checked')?.value ?? 'all';
		const of = (status) => orders.referrals.filter((r) => r.status === status);
		const stuck = orders.referrals.filter(isStuck).length;
		const scheduled = of('scheduled').sort((a, b) => a.on.localeCompare(b.on));
		const noLetter = of('seen').filter((r) => !r.letter).length;
		const stages = [
			{ key: 'sent', meta: stuck ? `${stuck} stuck over a week` : 'all answered within a week', live: stuck > 0 },
			{ key: 'accepted', meta: 'waiting for a date' },
			{ key: 'scheduled', meta: scheduled.length ? `next on ${shortDay(scheduled[0].on)}` : 'none booked' },
			{
				key: 'seen',
				meta: noLetter ? `${noLetter} letter${noLetter === 1 ? '' : 's'} still to come` : 'every letter back',
				live: noLetter > 0,
				calm: true,
			},
		];
		host.innerHTML = stages
			.map(
				(
					s,
				) => `<li><button type="button" class="hco-stage" data-hco-stage="${s.key}" aria-pressed="${tab === s.key}" style="--tone: ${STAGE_TONES[s.key]}">
					<span class="hco-stage-name">${REF_STATUS[s.key].name}${s.live ? `<span class="hco-live${s.calm ? ' is-calm' : ''}" aria-hidden="true"></span>` : ''}</span>
					<span class="hco-stage-value">${of(s.key).length}</span>
					<span class="hco-stage-meta">${s.meta}</span>
					<span class="hco-relay" aria-hidden="true">${of(s.key)
						.map(
							(r) =>
								`<span class="hco-face${isStuck(r) ? ' is-late' : ''}" title="${r.name} · ${r.why}">${r.name
									.split(' ')
									.map((w) => w[0])
									.join('')
									.slice(0, 2)}</span>`,
						)
						.join('')}</span>
				</button></li>`,
			)
			.join('');
		pick('[data-hco-ref-sub]').textContent =
			`${orders.referrals.length} since July. ${stuck ? `${NUMBER_WORDS[stuck] ?? stuck} with no reply in a week.` : 'None stuck.'}`;
	}

	function fillReferral(r) {
		fillHead({ name: r.name, title: r.why, sub: `${r.name} · to ${r.to}`, page: CHART });
		const at = REF_STEPS.indexOf(r.status);
		const when = {
			sent: shortDay(r.sent),
			accepted: at >= 1 ? 'Done' : '',
			scheduled: r.on ? shortDay(r.on) : '',
			seen: at >= 3 ? (r.letter ? 'Letter back' : 'Letter to come') : '',
		};
		const steps = REF_STEPS.map((step, i) => {
			const state = i < at || (i === at && step === 'seen') ? 'is-done' : i === at ? 'is-now' : '';
			const mark = state === 'is-done' ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : i + 1;
			return `<li class="hco-step ${state}"><span class="hco-step-mark">${mark}</span><span class="hco-step-name">${REF_STATUS[step].name}</span><span class="hco-step-when">${when[step]}</span></li>`;
		}).join('');
		fillBody(`
			<section class="basalt-drawer-section" aria-labelledby="hco-d-ref">
				<h3 id="hco-d-ref" class="basalt-drawer-legend">Where it stands</h3>
				<p class="hco-d-state">${referralPill(r)}<span>${referralLine(r)}</span></p>
				<ol class="hco-steps">${steps}</ol>
			</section>
			<section class="basalt-drawer-section" aria-labelledby="hco-d-ask">
				<h3 id="hco-d-ask" class="basalt-drawer-legend">The question</h3>
				<p class="hco-d-quote">${htmlSafe(r.question)}</p>
				<dl class="hco-facts">
					${fact('Sent to', placeCell(r))}
					${fact('Referred by', providerLink(r.by))}
					${fact('Sent on', longDay(r.sent))}
				</dl>
			</section>
			${patientSection(r.name, [])}`);
		const main = {
			sent: { act: 'chase', label: r.chased === TODAY ? 'Chase again' : 'Chase', icon: 'bi-bell' },
			accepted: { act: 'date', label: 'Add the date', icon: 'bi-calendar-plus' },
			scheduled: { act: 'seen', label: 'Mark seen', icon: 'bi-check2' },
			seen: r.letter
				? { href: REPORTS, label: 'Read the letter', icon: 'bi-envelope-paper' }
				: { act: 'letter', label: r.letterAsked ? 'Ask again' : 'Ask for the letter', icon: 'bi-envelope' },
		}[r.status];
		fillFoot([
			{ act: 'edit', label: 'Edit', icon: 'bi-pencil' },
			{ ...main, primary: true },
		]);
	}

	function referralLine(r) {
		const days = daysBetween(r.sent, TODAY);
		if (r.status === 'sent')
			return r.chased === TODAY
				? 'Chased today, no reply yet.'
				: `No reply after ${days === 1 ? 'a day' : `${days} days`}.`;
		if (r.status === 'accepted') return 'Accepted, the visit date is not set yet.';
		if (r.status === 'scheduled') return `Booked for ${longDay(r.on)}.`;
		return r.letter ? 'Seen, and the letter is back.' : 'Seen, the letter has not arrived.';
	}

	function openReferralDialog(record, toDate) {
		const dialog = pick('#hco-ref', document);
		const form = pick('form', dialog);
		form.reset();
		clearInvalid(form);
		form.dataset.id = record?.id ?? '';
		const editing = Boolean(record);
		const patient = pick('[name="patient"]', form);
		fillPeople(patient, record?.name);
		patient.disabled = editing;
		fillOptions(
			pick('[name="to"]', form),
			orders.places.map((p) => [p, p]),
			record?.to ?? '',
			'Pick where it goes',
		);
		fillOptions(pick('[name="by"]', form), providerOptions(), record?.by ?? ME);
		pick('[name="why"]', form).value = record?.why ?? '';
		pick('[name="question"]', form).value = record?.question ?? '';
		const stage = pick('[name="stage"]', form);
		stage.value = toDate ? 'scheduled' : (record?.status ?? 'sent');
		const on = pick('[name="on"]', form);
		if (window.Basalt.datepicker && visibleDate(on)) window.Basalt.datepicker.set(on, record?.on ?? '');
		else on.value = record?.on ?? '';
		pick('[data-hco-ref-stage]', form).hidden = !editing;
		syncDateField(form);
		pick('[data-hco-ref-title]', dialog).textContent = editing ? 'Edit referral' : 'New referral';
		pick('[data-hco-ref-go]', dialog).textContent = editing ? 'Save changes' : 'Send referral';
		const modal = window.bootstrap.Modal.getOrCreateInstance(dialog);
		if (toDate) dialog.addEventListener('shown.bs.modal', () => (visibleDate(on) ?? on).focus(), { once: true });
		modal.show();
	}

	function wireReferralDialog(list) {
		const dialog = pick('#hco-ref', document);
		clearAsTyped(pick('form', dialog));
		const form = pick('form', dialog);
		pick('[name="stage"]', form).addEventListener('change', () => syncDateField(form));
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!checkForm(form)) return;
			const data = new FormData(form);
			const fields = {
				why: data.get('why').trim(),
				to: data.get('to'),
				by: data.get('by'),
				question: data.get('question').trim(),
			};
			const editing = orders.referrals.find((r) => r.id === form.dataset.id);
			if (editing) {
				Object.assign(editing, fields, { status: data.get('stage') });
				if (editing.status === 'scheduled') editing.on = data.get('on');
				if (editing.to !== 'In house') delete editing.toWho;
				list.paint();
				toast('success', 'Referral changed', `${editing.why} for ${editing.name} is updated.`);
			} else {
				ids += 1;
				const record = {
					id: `ref-new-${ids}`,
					name: pick('[name="patient"]', form).value,
					...fields,
					sent: TODAY,
					status: 'sent',
				};
				orders.referrals.push(record);
				list.reset();
				list.flash(record.id);
				toast(
					'success',
					'Referral sent',
					`${record.name} is referred to ${record.to} for ${record.why.toLowerCase()}.`,
				);
			}
			window.bootstrap.Modal.getInstance(dialog)?.hide();
		});
	}

	/** The visit date only counts once the referral is scheduled. */
	function syncDateField(form) {
		const scheduled = pick('[name="stage"]', form).value === 'scheduled';
		const field = pick('[name="on"]', form);
		pick('[data-hco-ref-date]', form).hidden = !scheduled;
		field.required = scheduled;
		if (!scheduled) for (const node of [field, visibleDate(field)]) node?.classList.remove('is-invalid');
	}

	/* The list kit */

	/**
	 * Wires one card's list: search, the Filters menu and its chips, the
	 * status tabs when the card has them, sortable heads, the running count,
	 * the empty state and the quick view. The card holds the markup; the
	 * kit says what the records are and how a row and the drawer look.
	 * @param {object} kit
	 * @returns {{ card: HTMLElement, paint(): void, refill(): void, reset(): void,
	 *   setTab(key: string): void, flash(id: string): void }}
	 */
	function listKit(kit) {
		const card = kit.card;
		const body = pick('[data-hco-body]', card);
		const search = pick('[data-hco-search]', card);
		const appliedBox = pick('[data-hco-applied]', card);
		const summary = pick('[data-hco-summary]', card);
		const filterButton = pick('[data-hco-filter-btn]', card);
		const filterCount = pick('[data-hco-filter-count]', card);
		const state = { text: '', picked: {}, tab: 'all', sort: kit.sort.key, ascending: kit.sort.ascending };
		let shown = [];
		let stepList = [];
		let stepper = null;
		let current = null;

		const api = { card, paint, refill, reset, setTab, flash };
		drawChips();
		wire();
		paint();
		return api;

		function drawChips() {
			for (const facet of kit.facets) {
				const host = pick(`[data-hco-chips="${facet.key}"]`, card);
				host.innerHTML = [['', 'Any'], ...facet.options()]
					.map(([value, label], i) => {
						const id = `hco-${facet.key}-${i}`;
						return `<input id="${id}" type="radio" name="hco-${facet.key}" value="${htmlSafe(value)}" class="btn-check"${value === (state.picked[facet.key] ?? '') ? ' checked' : ''}><label for="${id}" class="hco-chip">${htmlSafe(label)}</label>`;
					})
					.join('');
			}
		}

		function wire() {
			search.addEventListener('input', () => {
				state.text = search.value.trim();
				paint();
			});
			card.addEventListener('change', (event) => {
				const input = event.target;
				if (input.name === 'hco-view') {
					state.tab = input.value;
					paint();
					return;
				}
				const facet = kit.facets.find((f) => input.name === `hco-${f.key}`);
				if (!facet) return;
				state.picked[facet.key] = input.value;
				paint();
			});
			card.addEventListener('click', (event) => {
				const sorter = event.target.closest('[data-hco-sort]');
				if (sorter) {
					const key = sorter.dataset.hcoSort;
					state.ascending = state.sort === key ? !state.ascending : key === 'name';
					state.sort = key;
					paint();
					return;
				}
				if (event.target.closest('[data-hco-filter-clear]')) clearFacets();
				if (event.target.closest('[data-hco-filter-done]'))
					window.bootstrap.Dropdown.getOrCreateInstance(filterButton).hide();
				if (event.target.closest('[data-hco-clear]')) {
					reset();
					search.focus();
					return;
				}
				const opener = event.target.closest('[data-hco-open]');
				if (opener) {
					open(opener.dataset.hcoOpen);
					return;
				}
				const row = event.target.closest('[data-hco-row]');
				if (!row || event.target.closest('a, button, input, label')) return;
				open(row.dataset.hcoRow);
			});
		}

		function fits(record) {
			if (kit.tabs && !kit.tabs[state.tab](record)) return false;
			for (const facet of kit.facets) {
				const value = state.picked[facet.key];
				if (value && !facet.test(record, value)) return false;
			}
			if (!state.text) return true;
			const haystack = kit.text(record);
			if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, state.text);
			return haystack.toLowerCase().includes(state.text.toLowerCase());
		}

		function ordered(records) {
			const sign = state.ascending ? 1 : -1;
			const keyOf = kit.sorts[state.sort];
			return [...records].sort((left, right) => {
				const a = keyOf(left);
				const b = keyOf(right);
				if (a < b) return -sign;
				if (a > b) return sign;
				return left.name.localeCompare(right.name);
			});
		}

		function paint() {
			const all = kit.records();
			shown = ordered(all.filter(fits));
			body.innerHTML = shown.length ? shown.map(kit.row).join('') : emptyRow(all.length === 0);
			window.Basalt.avatars?.(body);
			window.Basalt.tips?.(body);
			summary.textContent = kit.count(shown.length, all.length);
			paintHeads();
			paintApplied();
			paintTabs();
			kit.after?.();
		}

		function emptyRow(none) {
			const span = body.closest('table').tHead.rows[0].cells.length;
			const options = none
				? kit.blank
				: {
						query: state.text,
						noun: kit.noun,
						clear: false,
						title: state.text ? '' : `No ${kit.noun} fit these filters`,
						text: state.text
							? 'Check the spelling, or clear the search and filters.'
							: 'Clear a filter to see more.',
						icon: state.text ? 'search' : 'funnel',
					};
			const panel = window.Basalt?.emptyState?.(options) ?? `<p>${options.title}</p>`;
			const clear = none
				? ''
				: '<button type="button" class="btn btn-sm btn-outline-secondary" data-hco-clear><i class="bi bi-x-lg me-1" aria-hidden="true"></i>Clear search and filters</button>';
			return `<tr class="basalt-empty-row"><td colspan="${span}">${panel.replace(/<\/div>$/, `${clear}</div>`)}</td></tr>`;
		}

		function paintHeads() {
			for (const column of pickAll('[data-hco-th]', card)) {
				const inUse = column.dataset.hcoTh === state.sort;
				if (inUse) column.setAttribute('aria-sort', state.ascending ? 'ascending' : 'descending');
				else column.removeAttribute('aria-sort');
				const arrow = inUse
					? state.ascending
						? 'bi-arrow-up'
						: 'bi-arrow-down'
					: 'bi-arrow-down-up hco-sort-idle';
				pick('.bi', column).className = `bi ${arrow}`;
			}
		}

		function paintApplied() {
			const items = [];
			for (const facet of kit.facets) {
				const value = state.picked[facet.key];
				if (!value) continue;
				const label = facet.options().find(([v]) => v === value)?.[1] ?? value;
				items.push({ label: `${facet.legend}: ${label}`, remove: () => setFacet(facet.key, '') });
			}
			window.Basalt.drawer?.applied(appliedBox, items, clearFacets, filterButton);
			filterCount.hidden = items.length === 0;
			filterCount.textContent = String(items.length);
			filterButton.classList.toggle('is-on', items.length > 0);
		}

		function paintTabs() {
			if (!kit.tabs) return;
			for (const [key, test] of Object.entries(kit.tabs)) {
				const count = pick(`[data-hco-count="${key}"]`, card);
				if (count) count.textContent = String(kit.records().filter(test).length);
			}
		}

		function setFacet(key, value) {
			state.picked[key] = value;
			const radio = pick(`input[name="hco-${key}"][value="${CSS.escape(value)}"]`, card);
			if (radio) radio.checked = true;
			paint();
		}

		function clearFacets() {
			for (const facet of kit.facets) {
				state.picked[facet.key] = '';
				const any = pick(`input[name="hco-${facet.key}"][value=""]`, card);
				if (any) any.checked = true;
			}
			paint();
		}

		function setTab(key) {
			const radio = pick(`input[name="hco-view"][value="${key}"]`, card);
			if (!radio) return;
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}

		/** Back to the whole list: no search, no filters, the first tab. */
		function reset() {
			search.value = '';
			state.text = '';
			for (const facet of kit.facets) {
				state.picked[facet.key] = '';
				const any = pick(`input[name="hco-${facet.key}"][value=""]`, card);
				if (any) any.checked = true;
			}
			const all = pick('input[name="hco-view"][value="all"]', card);
			if (all) all.checked = true;
			state.tab = 'all';
			pick('[data-basalt-tabs]', card)?.basaltTabs?.refresh();
			paint();
		}

		/** A row that just arrived is tinted for a moment. */
		function flash(id) {
			const row = pick(`[data-hco-row="${id}"]`, body);
			row?.classList.add('is-fresh');
			row?.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: 'center' });
		}

		function open(id) {
			const inList = shown.some((r) => r.id === id);
			stepList = inList ? [...shown] : [kit.records().find((r) => r.id === id)];
			const at = stepList.findIndex((r) => r.id === id);
			if (!stepper && window.Basalt.drawer) {
				/* The length is read on every step, so one binding keeps up with the list. */
				const length = { valueOf: () => Math.max(1, stepList.length) };
				stepper = window.Basalt.drawer.recordNav(drawer, length, (i) => show(stepList[i]));
			}
			if (stepper) stepper.go(at, 0);
			else show(stepList[at]);
			pick('.basalt-drawer-nav', drawer).hidden = stepList.length < 2;
			drawer.currentKit = api;
			window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
		}

		function show(record) {
			current = record;
			drawer.currentRecord = record;
			kit.fill(record);
			window.Basalt.avatars?.(drawer);
			window.Basalt.tips?.(drawer);
		}

		/** Draws the open record again after an action changed it. */
		function refill() {
			if (current && drawer.classList.contains('show')) show(current);
		}
	}

	/* The quick view */

	function fillHead({ name, title, sub, page: href }) {
		const face = pick('[data-hco-d="avatar"]', drawer);
		face.dataset.name = name;
		pick('[data-hco-d="title"]', drawer).textContent = title;
		pick('[data-hco-d="sub"]', drawer).textContent = sub;
		pick('[data-hco-d="page"]', drawer).href = href;
	}

	function fillBody(markup) {
		pick('.offcanvas-body', drawer).innerHTML = markup;
	}

	/** The foot's buttons: Close on the left, then the record's actions. */
	function fillFoot(actions) {
		pick('[data-hco-d="actions"]', drawer).innerHTML = actions
			.map((a) => {
				const look = a.primary ? 'btn-primary' : 'btn-outline-secondary';
				const icon = a.icon ? `<i class="bi ${a.icon} me-1" aria-hidden="true"></i>` : '';
				return a.href
					? `<a href="${a.href}" class="btn ${look}">${icon}${a.label}</a>`
					: `<button type="button" class="btn ${look}" data-hco-act="${a.act}">${icon}${a.label}</button>`;
			})
			.join('');
	}

	function wireDrawerActions(handle) {
		drawer.addEventListener('click', (event) => {
			const button = event.target.closest('[data-hco-act]');
			if (button && drawer.currentRecord) handle(button.dataset.hcoAct, drawer.currentRecord);
		});
	}

	function hideDrawer() {
		window.bootstrap.Offcanvas.getInstance(drawer)?.hide();
	}

	/** The patient block every quick view ends with, plus a few lines of its own. */
	function patientSection(name, extra) {
		const record = clinic.patientRecord(name);
		const first = name.split(' ')[0];
		return `
			<section class="basalt-drawer-section" aria-labelledby="hco-d-who">
				<h3 id="hco-d-who" class="basalt-drawer-legend">Patient</h3>
				<dl class="hco-facts">
					${fact('Name', patientLink(name, 'xs'))}
					${fact('Patient id', htmlSafe(record.id))}
					${fact('Age', `${record.age}`)}
					${extra.map(([term, value]) => fact(term, value)).join('')}
				</dl>
				<a href="${MESSAGES}" class="hco-d-more"><i class="bi bi-chat-left-text me-1" aria-hidden="true"></i>Message ${htmlSafe(first)}</a>
			</section>`;
	}

	function fact(term, value) {
		return `<div><dt>${term}</dt><dd>${value}</dd></div>`;
	}

	/* Visit notes */

	function startNotes() {
		const list = listKit({
			card: pick('[data-hco-list="notes"]'),
			records: () => orders.notes,
			noun: 'notes',
			blank: {
				title: 'No notes yet',
				text: 'A note starts on the visit, while the patient is in the room.',
				icon: 'journal-text',
			},
			facets: [
				{
					key: 'status',
					legend: 'Status',
					options: () => Object.entries(NOTE_STATUS).map(([key, s]) => [key, s.name]),
					test: (r, value) => r.status === value,
				},
				{
					key: 'by',
					legend: 'Written by',
					options: () => providerOptions(orders.notes.map((r) => r.with)),
					test: (r, value) => r.with === value,
				},
			],
			sorts: {
				name: (r) => r.name,
				at: (r) => (r.status === 'signed' ? '0' : '1') + r.at,
			},
			sort: { key: 'at', ascending: false },
			text: (r) => [r.name, r.visit, providerName(r.with), r.assessment].join(' '),
			count: (shown, total) => countLine(shown, total, 'note', 'notes'),
			row: noteRow,
			fill: fillNote,
			after: paintNotesSub,
		});
		pick('[data-hco-list="notes"]').addEventListener('click', (event) => {
			const sign = event.target.closest('[data-hco-sign]');
			if (sign) signNote(sign.dataset.hcoSign, list);
		});
		wireDrawerActions((action, record) => {
			if (action === 'sign') {
				hideDrawer();
				signNote(record.id, list);
			}
		});
	}

	function noteRow(r) {
		const status = NOTE_STATUS[r.status];
		const name = htmlSafe(`${r.visit} for ${r.name}`);
		const sign =
			r.status === 'signed'
				? ''
				: `<button type="button" class="btn btn-sm btn-outline-secondary hco-sign" data-hco-sign="${r.id}" aria-label="Sign ${name}">Sign</button>`;
		return `<tr data-hco-row="${r.id}" class="hco-row">
			<td class="hco-col-who">${patientLink(r.name)}</td>
			<td class="hco-col-test"><a href="${VISIT}" class="hco-cell-link">${htmlSafe(r.visit)}</a><span class="hc-who-meta">${htmlSafe(r.assessment)}</span></td>
			<td class="hco-col-by">${providerLink(r.with)}</td>
			<td class="hco-col-when">${noteWhen(r.at)}</td>
			<td class="hco-col-state">${pill(status)}</td>
			<td class="hco-col-act"><div class="basalt-row-actions">${sign}${rowIcons(r.id, VISIT, name)}</div></td>
		</tr>`;
	}

	function noteWhen(stamp) {
		const [day, time] = stamp.split('T');
		const [h, m] = time.split(':').map(Number);
		const clock = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
		return day === TODAY ? `Today, ${clock}` : `${shortDay(day)}, ${clock}`;
	}

	function paintNotesSub() {
		const waiting = orders.notes.filter((r) => r.status !== 'signed').length;
		pick('[data-hco-sub]').textContent = waiting
			? `${NUMBER_WORDS[waiting] ?? waiting} waiting for a signature. Those come first.`
			: 'Every note is signed.';
	}

	/** The note in the quick view, section by section, with Sign when it waits. */
	function fillNote(r) {
		fillHead({
			name: r.name,
			title: r.visit,
			sub: `${r.name} · ${noteWhen(r.at)}`,
			page: VISIT,
		});
		const part = (term, text) =>
			`<section class="basalt-drawer-section"><h3 class="basalt-drawer-legend">${term}</h3><p class="hco-d-note">${htmlSafe(text)}</p></section>`;
		fillBody(`
			${part('What the patient says', r.says)}
			${part('What was found', r.found)}
			${part('Assessment', r.assessment)}
			${part('Plan', r.plan)}
			${patientSection(r.name, [['Written by', providerLink(r.with)]])}`);
		fillFoot(
			r.status === 'signed'
				? [{ href: VISIT, label: 'Open the visit', icon: 'bi-calendar-event' }]
				: [{ act: 'sign', label: 'Sign note', icon: 'bi-check2', primary: true }],
		);
	}

	/** Signs one note; the toast can take the signature back. */
	function signNote(id, list) {
		const note = orders.notes.find((r) => r.id === id);
		if (!note || note.status === 'signed') return;
		const was = note.status;
		note.status = 'signed';
		list.paint();
		toast('success', 'Note signed', `${note.visit} for ${note.name} is in the chart.`, [
			{
				label: 'Undo',
				onClick: () => {
					note.status = was;
					list.paint();
				},
			},
		]);
	}

	/* Insurance claims */

	const CLAIM_STATUS = {
		denied: { name: 'Denied', pill: 'hc-pill-late' },
		late: { name: 'Over 30 days', pill: 'hc-pill-wait' },
		pending: { name: 'Waiting', pill: 'hc-pill-info' },
		paid: { name: 'Paid', pill: 'hc-pill-ok' },
	};
	const CLAIM_PAGE = 'approval-details.html';

	function startClaims() {
		/* Open claims past thirty days are overdue whatever the record says. */
		for (const r of orders.claims) {
			if (r.status === 'late' || r.status === 'pending')
				r.status = daysBetween(r.sent, TODAY) > 30 ? 'late' : 'pending';
		}
		let list = null;
		list = listKit({
			card: pick('[data-hco-list="claims"]'),
			records: () => orders.claims,
			noun: 'claims',
			blank: { title: 'No claims', text: 'Claims are made from signed visit notes.', icon: 'shield-check' },
			tabs: {
				all: () => true,
				denied: (r) => r.status === 'denied',
				late: (r) => r.status === 'late',
				pending: (r) => r.status === 'pending',
				paid: (r) => r.status === 'paid',
			},
			facets: [
				{
					key: 'payer',
					legend: 'Payer',
					options: () => clinic.cover.plans.map((p) => [p.id, p.name]),
					test: (r, value) => r.payer === value,
				},
			],
			sorts: {
				name: (r) => r.name,
				sent: (r) => r.sent,
				amount: (r) => String(r.amount).padStart(6, '0'),
			},
			sort: { key: 'sent', ascending: true },
			text: (r) => [r.id, r.name, payerName(r.payer), CLAIM_STATUS[r.status].name, r.reason].join(' '),
			count: (shown, total) => countLine(shown, total, 'claim', 'claims'),
			row: claimRow,
			fill: fillClaim,
			after: drawClaimAges,
		});
		root.addEventListener('click', (event) => {
			const act = event.target.closest('[data-hco-claim-act]');
			if (act) claimAct(act.dataset.hcoClaimAct, act.dataset.hcoId, () => list?.paint());
		});
		wireDrawerActions((action, record) => {
			hideDrawer();
			claimAct(action, record.id, () => list?.paint());
		});
	}

	function payerName(id) {
		return clinic.cover.plans.find((p) => p.id === id)?.name ?? '';
	}

	function claimNext(r) {
		if (r.status === 'denied') return r.resubmitted ? ['', 'Resubmitted'] : ['resubmit', 'Resubmit'];
		if (r.status === 'late')
			return r.chased ? ['', 'Chased'] : ['chase', `Chase ${payerName(r.payer).split(' ')[0]}`];
		return ['', ''];
	}

	function claimRow(r) {
		const [act, label] = claimNext(r);
		const status = CLAIM_STATUS[r.status];
		const days = daysBetween(r.sent, TODAY);
		const next = act
			? `<button type="button" class="btn btn-sm ${act === 'resubmit' ? 'btn-primary' : 'btn-outline-secondary'}" data-hco-claim-act="${act}" data-hco-id="${r.id}">${label}</button>`
			: label
				? `<span class="hc-pill hc-pill-ok">${label}</span>`
				: '';
		return `<tr data-hco-row="${r.id}" class="hco-row">
			<td class="hco-col-id"><a href="${CLAIM_PAGE}" class="hco-cell-link">${r.id}</a></td>
			<td class="hco-col-who">${patientLink(r.name)}</td>
			<td class="hco-col-extra">${payerName(r.payer)}</td>
			<td class="hco-col-when">${shortDay(r.sent)}<span class="hc-who-meta">${days} days</span></td>
			<td class="hco-num">$${r.amount.toLocaleString('en-US')}</td>
			<td class="hco-col-state">${pill(status)}${r.reason ? `<span class="hc-who-meta">${htmlSafe(r.reason)}</span>` : ''}</td>
			<td class="hco-col-act"><div class="basalt-row-actions">${next}${rowIcons(r.id, CLAIM_PAGE, `claim ${r.id}`)}</div></td>
		</tr>`;
	}

	function claimAct(action, id, repaint) {
		const r = orders.claims.find((x) => x.id === id);
		if (!r) return;
		const words = {
			resubmit: ['Claim resubmitted', `${r.id} went back to ${payerName(r.payer)} with what they asked for.`],
			chase: ['Payer chased', `${payerName(r.payer)} has a reminder about ${r.id} for ${r.name}.`],
		}[action];
		if (!words) return;
		const key = action === 'resubmit' ? 'resubmitted' : 'chased';
		r[key] = true;
		repaint();
		toast('success', words[0], words[1], [
			{
				label: 'Undo',
				onClick: () => {
					delete r[key];
					repaint();
				},
			},
		]);
	}

	/**
	 * One age group as a plain figure card: the label beside its icon in
	 * the group's tone, the amount, how many it holds, and a bar for each
	 * item from the oldest to the newest, the newest solid.
	 */
	function ageCard(name, tone, icon, value, note, rows, dateOf, amountOf) {
		const items = [...rows].sort((a, b) => dateOf(a).localeCompare(dateOf(b))).slice(-12);
		const top = Math.max(1, ...items.map(amountOf));
		const bars = items
			.map(
				(r, i) =>
					`<span class="hco-age-bar value-${Math.max(8, Math.round((amountOf(r) / top) * 100))}${i === items.length - 1 ? ' is-now' : ''}"></span>`,
			)
			.join('');
		return `<li class="card basalt-box hco-age tone-${tone}"><span class="hco-age-head"><i class="bi ${icon}" aria-hidden="true"></i>${name}</span><span class="hco-age-value">${value}</span><span class="hco-age-note">${note}</span><span class="hco-age-bars" aria-hidden="true">${bars}</span></li>`;
	}

	/** The open claims by age: under 30 days, 31 to 60, over 60, and denied. */
	function drawClaimAges() {
		const open = orders.claims.filter((r) => r.status !== 'paid');
		const age = (r) => daysBetween(r.sent, TODAY);
		const groups = [
			['Under 30 days', 'success', 'bi-hourglass-top', open.filter((r) => r.status !== 'denied' && age(r) <= 30)],
			[
				'30 to 60 days',
				'warning',
				'bi-hourglass-split',
				open.filter((r) => r.status !== 'denied' && age(r) > 30 && age(r) <= 60),
			],
			['Over 60 days', 'danger', 'bi-hourglass-bottom', open.filter((r) => r.status !== 'denied' && age(r) > 60)],
			['Denied', 'series-8', 'bi-x-octagon', open.filter((r) => r.status === 'denied')],
		];
		const sum = (rows) => rows.reduce((acc, r) => acc + r.amount, 0);
		const money = (v) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`);
		pick('[data-hco-ages]').innerHTML = groups
			.map(([name, tone, icon, rows]) =>
				ageCard(
					name,
					tone,
					icon,
					money(sum(rows)),
					`${rows.length} ${rows.length === 1 ? 'claim' : 'claims'}`,
					rows,
					(r) => r.sent,
					(r) => r.amount,
				),
			)
			.join('');
		const denied = groups[3][3].filter((r) => !r.resubmitted).length;
		pick('[data-hco-ages-sub]').textContent =
			`${money(sum(open))} open across ${open.length} claims.${denied ? ` ${NUMBER_WORDS[denied] ?? denied} denied to resubmit first.` : ''}`;
		const slow = [...open].sort((a, b) => age(b) - age(a))[0];
		pick('[data-hco-ages-foot]').textContent = slow
			? `Oldest open: ${slow.id} for ${slow.name}, ${age(slow)} days with ${payerName(slow.payer)}.`
			: 'Nothing open.';
	}

	function fillClaim(r) {
		const [act, label] = claimNext(r);
		fillHead({
			name: r.name,
			title: `Claim ${r.id}`,
			sub: `${payerName(r.payer)} · sent ${shortDay(r.sent)}`,
			page: CLAIM_PAGE,
		});
		fillBody(`
			<section class="basalt-drawer-section" aria-labelledby="hco-d-claim">
				<h3 id="hco-d-claim" class="basalt-drawer-legend">The claim</h3>
				<p class="hco-d-figure"><b>$${r.amount.toLocaleString('en-US')}</b> ${pill(CLAIM_STATUS[r.status])}</p>
				<p class="hco-d-note">${r.reason ? `${htmlSafe(r.reason)}. ` : ''}Sent ${daysBetween(r.sent, TODAY)} days ago to ${payerName(r.payer)}.</p>
			</section>
			${patientSection(r.name, [])}`);
		const actions = [{ href: CLAIM_PAGE, label: 'Open the claim', icon: 'bi-arrows-angle-expand' }];
		if (act) actions.push({ act, label, icon: 'bi-send', primary: true });
		fillFoot(actions);
	}

	/* Patient billing */

	const BILL_STATUS = {
		overdue: { name: 'Overdue', pill: 'hc-pill-late' },
		open: { name: 'Open', pill: 'hc-pill-wait' },
		part: { name: 'Part paid', pill: 'hc-pill-info' },
		paid: { name: 'Paid', pill: 'hc-pill-ok' },
	};

	/** Paid; overdue once anything is owed past thirty days; else part paid or open. */
	function billStatus(r) {
		if (r.paid >= r.amount) return 'paid';
		if (daysBetween(r.on, TODAY) > 30) return 'overdue';
		return r.paid > 0 ? 'part' : 'open';
	}

	function startBilling() {
		let list = null;
		list = listKit({
			card: pick('[data-hco-list="invoices"]'),
			records: () => orders.invoices,
			noun: 'statements',
			blank: {
				title: 'No statements',
				text: 'Statements come from visits once they are signed.',
				icon: 'receipt',
			},
			tabs: {
				all: () => true,
				overdue: (r) => billStatus(r) === 'overdue',
				open: (r) => billStatus(r) === 'open',
				part: (r) => billStatus(r) === 'part',
				paid: (r) => billStatus(r) === 'paid',
			},
			facets: [
				{
					key: 'age',
					legend: 'Age',
					options: () => [
						['new', 'This month'],
						['old', 'Older than 30 days'],
					],
					test: (r, value) => daysBetween(r.on, TODAY) > 30 === (value === 'old'),
				},
			],
			sorts: {
				name: (r) => r.name,
				on: (r) => r.on,
				due: (r) => String(r.amount - r.paid).padStart(6, '0'),
			},
			sort: { key: 'on', ascending: true },
			text: (r) => [r.id, r.name, r.what, BILL_STATUS[billStatus(r)].name].join(' '),
			count: (shown, total) => countLine(shown, total, 'statement', 'statements'),
			row: billRow,
			fill: fillBill,
			after: drawBillSummary,
		});
		const repaint = () => list?.paint();
		root.addEventListener('click', (event) => {
			const act = event.target.closest('[data-hco-bill-act]');
			if (act) billAct(act.dataset.hcoBillAct, act.dataset.hcoId, repaint);
		});
		wireDrawerActions((action, record) => {
			hideDrawer();
			billAct(action, record.id, repaint);
		});
		wirePayDialog(repaint);
	}

	function billNext(r) {
		const status = billStatus(r);
		if (status === 'overdue' && !r.reminded) return ['remind', 'Send reminder'];
		if (status !== 'paid') return ['pay', 'Take payment'];
		return ['receipt', 'Receipt'];
	}

	function billRow(r) {
		const status = billStatus(r);
		const [act, label] = billNext(r);
		const due = r.amount - r.paid;
		const next = act
			? `<button type="button" class="btn btn-sm ${act === 'pay' ? 'btn-primary' : 'btn-outline-secondary'}" data-hco-bill-act="${act}" data-hco-id="${r.id}">${label}</button>`
			: `<span class="hc-pill hc-pill-ok">${label}</span>`;
		return `<tr data-hco-row="${r.id}" class="hco-row">
			<td class="hco-col-id"><span class="hco-id">${r.id}</span></td>
			<td class="hco-col-who">${patientLink(r.name)}</td>
			<td class="hco-col-extra">${htmlSafe(r.what)}</td>
			<td class="hco-col-when">${shortDay(r.on)}<span class="hc-who-meta">${daysBetween(r.on, TODAY)} days</span></td>
			<td class="hco-num">${due ? `$${due}` : '—'}<span class="hc-who-meta">of $${r.amount}</span></td>
			<td class="hco-col-state">${pill(BILL_STATUS[status])}</td>
			<td class="hco-col-act"><div class="basalt-row-actions">${next}${rowIcons(r.id, CHART, `statement ${r.id}`)}</div></td>
		</tr>`;
	}

	/** The header's figures and the open balance by age, from the invoices. */
	function drawBillSummary() {
		const owing = orders.invoices.filter((r) => r.paid < r.amount);
		const due = (rows) => rows.reduce((acc, r) => acc + r.amount - r.paid, 0);
		const overdue = owing.filter((r) => billStatus(r) === 'overdue');
		const week = orders.invoices.filter((r) => daysBetween(r.on, TODAY) <= 7).reduce((acc, r) => acc + r.paid, 0);
		pick('[data-hco-bill-figures]').innerHTML = [
			['owed', `$${due(owing).toLocaleString('en-US')}`],
			['overdue', `$${due(overdue).toLocaleString('en-US')}`],
			['paid this week', `$${week.toLocaleString('en-US')}`],
		]
			.map(
				([label, value]) =>
					`<div class="basalt-hero-figure"><dt class="basalt-hero-label">${label}</dt><dd class="basalt-hero-value">${value}</dd></div>`,
			)
			.join('');
		const age = (r) => daysBetween(r.on, TODAY);
		const groups = [
			['This month', 'success', 'bi-hourglass-top', owing.filter((r) => age(r) <= 30)],
			['31 to 60 days', 'warning', 'bi-hourglass-split', owing.filter((r) => age(r) > 30 && age(r) <= 60)],
			['Over 60 days', 'danger', 'bi-hourglass-bottom', owing.filter((r) => age(r) > 60)],
		];
		pick('[data-hco-bill-ages]').innerHTML = groups
			.map(([name, tone, icon, rows]) =>
				ageCard(
					name,
					tone,
					icon,
					`$${due(rows).toLocaleString('en-US')}`,
					`${rows.length} ${rows.length === 1 ? 'statement' : 'statements'}`,
					rows,
					(r) => r.on,
					(r) => r.amount - r.paid,
				),
			)
			.join('');
		pick('[data-hco-bill-sub]').textContent = owing.length
			? `${owing.length} patients owe $${due(owing).toLocaleString('en-US')}; ${overdue.length} of them are past thirty days.`
			: 'Nobody owes the clinic anything.';
	}

	function billAct(action, id, repaint) {
		const r = orders.invoices.find((x) => x.id === id);
		if (!r) return;
		if (action === 'pay') {
			openPayDialog(r);
			return;
		}
		if (action === 'receipt') {
			const text = `Broadway Street Clinic\nReceipt for statement ${r.id}\n\n${r.name}\n${r.what}, ${shortDay(r.on)}\nPaid: $${r.paid}\n`;
			const link = document.createElement('a');
			link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
			link.download = `receipt-${r.id.replace('#', '')}.txt`;
			link.click();
			URL.revokeObjectURL(link.href);
			toast('info', 'Receipt downloaded', `${link.download} is in your downloads.`);
			return;
		}
		if (action === 'remind') {
			r.reminded = true;
			repaint();
			toast(
				'success',
				'Reminder sent',
				`${r.name} has a text with a link to pay $${r.amount - r.paid} for ${r.what.toLowerCase()}.`,
				[
					{
						label: 'Undo',
						onClick: () => {
							delete r.reminded;
							repaint();
						},
					},
				],
			);
		}
	}

	function openPayDialog(invoice) {
		const dialog = pick('#hco-pay', document);
		const form = pick('form', dialog);
		form.reset();
		form.classList.remove('was-validated');
		const select = pick('[name="invoice"]', form);
		select.innerHTML = orders.invoices
			.filter((r) => r.paid < r.amount)
			.map(
				(r) =>
					`<option value="${r.id}"${invoice && r.id === invoice.id ? ' selected' : ''}>${r.name} · ${r.id} · $${r.amount - r.paid} owed</option>`,
			)
			.join('');
		select.dispatchEvent(new Event('change'));
		window.bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	/** The payment dialog: picking an invoice fills what is owed; taking it
	 * pays the invoice off or in part. */
	function wirePayDialog(repaint) {
		const dialog = pick('#hco-pay', document);
		if (!dialog) return;
		const form = pick('form', dialog);
		const select = pick('[name="invoice"]', form);
		const amount = pick('[name="amount"]', form);
		const left = () => {
			const r = orders.invoices.find((x) => x.id === select.value);
			if (!r) return;
			const after = r.amount - r.paid - Number(amount.value || 0);
			pick('[data-hco-pay-left]', form).textContent =
				after > 0 ? `$${after} still owed after this.` : 'Pays the statement off.';
		};
		select.addEventListener('change', () => {
			const r = orders.invoices.find((x) => x.id === select.value);
			if (r) {
				amount.value = r.amount - r.paid;
				amount.max = r.amount - r.paid;
			}
			left();
		});
		amount.addEventListener('input', left);
		for (const button of pickAll('[data-hco-pay-open]'))
			button.addEventListener('click', () => openPayDialog(null));
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const r = orders.invoices.find((x) => x.id === select.value);
			const taken = Number(amount.value);
			const how = { card: 'by card', cash: 'in cash', plan: 'as the first of a payment plan' }[
				new FormData(form).get('how')
			];
			r.paid += taken;
			repaint();
			window.bootstrap.Modal.getInstance(dialog)?.hide();
			toast(
				'success',
				'Payment taken',
				`$${taken} from ${r.name} ${how}. ${r.paid >= r.amount ? 'The statement is paid.' : `$${r.amount - r.paid} still owed.`}`,
				[
					{
						label: 'Undo',
						onClick: () => {
							r.paid -= taken;
							repaint();
						},
					},
				],
			);
		});
	}

	function fillBill(r) {
		const status = billStatus(r);
		const [act, label] = billNext(r);
		fillHead({ name: r.name, title: `Statement ${r.id}`, sub: `${r.what} · ${shortDay(r.on)}`, page: CHART });
		fillBody(`
			<section class="basalt-drawer-section" aria-labelledby="hco-d-bill">
				<h3 id="hco-d-bill" class="basalt-drawer-legend">The bill</h3>
				<p class="hco-d-figure"><b>$${r.amount - r.paid}</b> <span>still owed of $${r.amount}</span> ${pill(BILL_STATUS[status])}</p>
				<p class="hco-d-note">${htmlSafe(r.what)}, billed ${daysBetween(r.on, TODAY)} days ago.</p>
			</section>
			${patientSection(r.name, [])}`);
		fillFoot(act ? [{ act, label, icon: act === 'pay' ? 'bi-credit-card' : 'bi-send', primary: true }] : []);
	}

	/* Dialogs */

	/** Flags the empty required fields and the out-of-range numbers, focusing
	 * the first; true when the form can be sent. */
	function checkForm(form) {
		let first = null;
		for (const field of pickAll('input, select, textarea', form)) {
			if (field.disabled || field.type === 'radio' || field.closest('[hidden]')) continue;
			if (field.closest('[data-basalt-datepicker]') && field.type !== 'hidden') continue;
			const bad = !field.checkValidity() || (field.required && !field.value.trim());
			/* A date field keeps its value in a hidden input; its text field shows the flag. */
			const shown = field.type === 'hidden' ? visibleDate(field) : field;
			field.classList.toggle('is-invalid', bad);
			shown?.classList.toggle('is-invalid', bad);
			if (bad && !first) first = shown;
		}
		first?.focus();
		return !first;
	}

	/** The text field the template's calendar puts in front of a date input. */
	function visibleDate(input) {
		return input.closest('[data-basalt-datepicker]')?.querySelector('input:not([type="hidden"])') ?? null;
	}

	/** A flagged field loses its flag as soon as it is filled in. */
	function clearAsTyped(form) {
		for (const type of ['input', 'change']) {
			form.addEventListener(type, (event) => {
				const wrap = event.target.closest('[data-basalt-datepicker]');
				const fields = wrap ? pickAll('input', wrap) : [event.target];
				if (fields.some((f) => f.value)) for (const f of fields) f.classList.remove('is-invalid');
			});
		}
	}

	function clearInvalid(form) {
		for (const field of pickAll('.is-invalid', form)) field.classList.remove('is-invalid');
	}

	/** Every patient the clinic knows, A to Z, with one picked. */
	function fillPeople(select, picked) {
		const names = new Set(Object.keys(clinic.register));
		for (const list of [orders.labWork, orders.prescriptions, orders.referrals])
			for (const r of list) names.add(r.name);
		if (picked) names.add(picked);
		fillOptions(
			select,
			[...names].sort().map((n) => [n, n]),
			picked ?? '',
			'Pick a patient',
		);
	}

	function fillOptions(select, options, picked, prompt) {
		select.innerHTML = [
			prompt ? `<option value="">${prompt}</option>` : '',
			...options.map(
				([value, label]) =>
					`<option value="${htmlSafe(value)}"${value === picked ? ' selected' : ''}>${htmlSafe(label)}</option>`,
			),
		].join('');
	}

	/* Small helpers */

	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(
			/[&<>"']/g,
			(mark) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[mark],
		);
	}

	function avatar(name, size) {
		return `<span data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true" class="basalt-avatar basalt-avatar-${size}"></span>`;
	}

	/** A person as the template shows people: a small avatar and the name, one link. */
	function personLink(name, href, short = name) {
		/* A provider's link opens their own page. */
		const provider = href === 'providers.html' && clinic.providers.find((p) => p.name === name);
		if (provider) href = `provider-details.html?id=${provider.id}`;
		return `<a href="${href}" class="hc-person-link">${avatar(name.replace(/^Dr\.? /, ''), 'xs')}<span>${htmlSafe(short)}</span></a>`;
	}

	/** A patient as a link to the chart, with a larger face in a row's first column. */
	function patientLink(name, size = 'sm') {
		return `<a href="${CHART}" class="hc-person-link hco-patient">${avatar(name, size)}<span>${htmlSafe(name)}</span></a>`;
	}

	function providerLink(id) {
		const provider = clinic.provider(id);
		return provider ? personLink(provider.name, PROVIDERS, clinic.short(id)) : '';
	}

	function providerName(id) {
		return clinic.provider(id)?.name ?? '';
	}

	/** Providers as filter or form options; only the given ids when there are some. */
	function providerOptions(only) {
		const keep = only ? new Set(only) : null;
		return clinic.providers.filter((p) => !keep || keep.has(p.id)).map((p) => [p.id, clinic.short(p.id)]);
	}

	/** The two quick-view icons that end a row: the panel, and the full page. */
	function rowIcons(id, href, name) {
		const peek = `<button type="button" class="btn btn-icon btn-sm" data-hco-open="${id}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view" aria-label="Quick view: ${name}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
		const expand = `<a href="${href}" class="btn btn-icon btn-sm" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page" aria-label="Open full page: ${name}"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`;
		return `${peek}${expand}`;
	}

	function pill(status) {
		return `<span class="hc-pill${status.pill ? ` ${status.pill}` : ''}">${status.name}</span>`;
	}

	function countLine(shown, total, one, many) {
		if (shown === total) return `${total} ${total === 1 ? one : many}`;
		return `${shown} of ${total} ${many}`;
	}

	function shortDay(iso) {
		const [, m, d] = iso.split('-').map(Number);
		return `${MONTHS[m - 1]} ${d}`;
	}

	function longDay(iso) {
		return `${WEEKDAYS[new Date(`${iso}T12:00`).getDay()]}, ${shortDay(iso)}`;
	}

	function daysBetween(from, to) {
		return Math.round((new Date(`${to}T12:00`) - new Date(`${from}T12:00`)) / 86400000);
	}

	function motionOff() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function toast(tone, title, text, actions) {
		window.Basalt.toasts?.push({
			tone,
			title,
			text,
			icon: tone === 'success' ? 'bi-check2-circle' : 'bi-info-circle',
			duration: actions ? 6000 : 4500,
			actions,
		});
	}

	start();
})();
