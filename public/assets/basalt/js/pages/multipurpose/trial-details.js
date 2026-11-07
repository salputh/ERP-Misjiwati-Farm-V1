/**
 * Basalt - Trial Details (trial-details.html)
 * One team's trial: its days, the four setup steps, who signed in,
 * what happened, and the three things to do about it: convert to
 * paid, extend the trial or send a nudge.
 *
 * Opens the trial named by ?id= (trial-details.html?id=alder) and
 * falls back to Alder & Sons Tailors. ?do=convert opens the convert
 * dialog straight away, as the Trials quick view does.
 * Data: assets/basalt/js/data/multipurpose/trials.js (window.Basalt.data.trials).
 */
(() => {
	'use strict';
	const root = pick('[data-trd-root]');
	const T = window.Basalt.data && window.Basalt.data.trials;
	if (!root || !T) return;

	function start() {
		tplSelect.addEventListener('change', fillTemplate);
		forms.nudge.addEventListener('submit', (e) => {
			e.preventDefault();
			const subj = pick('[data-trd-subject]');
			const msg = pick('[data-trd-message]');
			let bad = null;

			for (const x of [msg, subj]) {
				const empty = !x.value.trim();
				x.classList.toggle('is-invalid', empty);
				if (empty) bad = x;
			}

			if (bad) {
				bad.focus();
				return;
			}
			t.nudges.push(T.today);
			t.activity.unshift([T.today, `Nudge sent: ${subj.value.trim()}.`, 'nudge']);
			modal('trd-nudge').hide();
			render();
			toast({ tone: 'success', title: `Nudge sent to ${first}`, text: `“${subj.value.trim()}”`, duration: 4000 });
		});

		root.addEventListener('click', (e) => {
			const b = e.target.closest('[data-trd-open]');
			if (!b) return;
			const what = b.dataset.trdOpen;
			if (what === 'convert') showConvert();
			else if (what === 'extend') openExtend();
			else openNudge(b.dataset.trdTemplate);
		});

		render();
		if (q.get('do') === 'convert' && t.status === 'running') {
			/* Wait for Bootstrap's own scripts before opening a dialog on load. */
			window.addEventListener('load', () => showConvert(), { once: true });
		}
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function money(n) {
		return `$${n.toLocaleString('en-US')}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const q = new URLSearchParams(location.search);
	const t = T.find(q.get('id') || '') || T.find('alder');
	if (!t) return;

	function D(k) {
		return pick(`[data-trd="${k}"]`, root);
	}

	const live = pick('[data-trd-live]', root);
	function say(text) {
		live.textContent = '';
		setTimeout(() => {
			live.textContent = text;
		}, 30);
	}
	const ind = T.industries[t.industry];
	const first = t.people[0][0].split(' ')[0];

	/* How long this trial runs (more than 14 days once extended), and
     which of those days today is. */
	function total() {
		return T.between(t.started, t.until);
	}

	function today() {
		return Math.min(total(), T.between(t.started, t.status === 'running' ? T.today : t.closed) + 1);
	}

	function left() {
		return T.between(T.today, t.until);
	}

	function when(iso) {
		return iso === T.today ? 'Today' : T.between(iso, T.today) === 1 ? 'Yesterday' : T.date(iso);
	}

	function endWords() {
		return left() <= 0 ? 'today' : left() === 1 ? 'tomorrow' : T.date(t.until, true);
	}

	/* Header */
	function paintHead() {
		document.title = `${t.name} · Basalt`;
		const mark = D('mark');
		mark.style.setProperty('--trd-tone', `var(--basalt-series-${ind.tone})`);
		mark.innerHTML = `<i class="bi ${ind.icon}"></i>`;
		D('name').textContent = t.name;
		D('sub').textContent = `${ind.name} in ${t.city} · started ${T.date(t.started, true)}`;
		const p = T.plans[t.status === 'converted' ? t.paid[0] : t.plan];
		const seats = t.status === 'converted' ? t.paid[1] : t.seats;
		const pill =
			t.status === 'converted'
				? `<span class="basalt-status basalt-status-dot basalt-status-success">Converted ${T.date(t.closed)}</span>`
				: t.status === 'ended'
					? `<span class="basalt-status basalt-status-dot">Ended ${T.date(t.closed)}</span>`
					: `<span class="basalt-status basalt-status-dot${left() <= 2 ? ' basalt-status-warning' : ' basalt-status-info'}">Day ${today()} of ${total()}</span>`;
		D('tags').innerHTML =
			`${pill}<span class="badge basalt-badge-as-dot basalt-badge-tone-${p.tone}">${p.name}</span><span class="trd-tag">${plural(seats, 'seat')}</span>`;

		let acts = '';
		if (t.status === 'running') {
			acts = `<button type="button" class="btn btn-primary btn-sm" data-trd-open="convert"><i class="bi bi-credit-card me-1" aria-hidden="true"></i>Convert to paid</button><button type="button" class="btn btn-outline-secondary btn-sm" data-trd-open="extend"><i class="bi bi-calendar-plus me-1" aria-hidden="true"></i>Extend trial</button><button type="button" class="btn btn-outline-secondary btn-sm" data-trd-open="nudge"><i class="bi bi-send me-1" aria-hidden="true"></i>Send a nudge</button>`;
		} else if (t.status === 'ended') {
			acts =
				'<button type="button" class="btn btn-outline-secondary btn-sm" data-trd-open="extend"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Reopen trial</button>';
		} else if (t.account) {
			acts = `<a class="btn btn-outline-secondary btn-sm" href="company-details.html?id=${encodeURIComponent(t.account)}"><i class="bi bi-buildings me-1" aria-hidden="true"></i>Open account</a>`;
		}
		const box = D('actions');
		box.innerHTML = acts;
		box.hidden = !acts;
	}

	/* The days */
	const STEP_ICON = {};
	T.milestones.forEach((m) => {
		STEP_ICON[m.key] = m;
	});
	/* The card's second line explains the dots under the days. */
	function renderDays() {
		const KEY = t.nudges.length
			? 'Green dots mark setup steps, amber ones nudges.'
			: 'Green dots mark the days a setup step was done.';
		const n = total();
		const now = today();
		if (t.status === 'converted') {
			D('days-title').textContent = `Converted on day ${now}`;
			D('days-desc').textContent = `Paying since ${T.date(t.closed, true)}. ${KEY}`;
		} else if (t.status === 'ended') {
			D('days-title').textContent = `Ended after ${n} days`;
			D('days-desc').textContent = `${t.reason} ${KEY}`;
		} else {
			D('days-title').textContent = `Day ${now} of ${n}`;
			D('days-desc').textContent = `Ends ${endWords()}. ${KEY}`;
		}

		/* What happened on which day: setup steps and nudges. */
		const marks = {};
		T.milestones.forEach((m) => {
			const at = t.steps[m.key];
			if (at) (marks[at] = marks[at] || []).push(m.label);
		});
		t.nudges.forEach((at) => {
			(marks[at] = marks[at] || []).push('Nudge sent');
		});

		let s = '';
		for (let i = 0; i < n; i++) {
			const iso = T.addDays(t.started, i);
			const d = new Date(`${iso}T12:00:00`);
			const cls = i + 1 < now ? 'is-past' : i + 1 === now ? 'is-today' : 'is-ahead';
			const what = marks[iso] || [];
			const label =
				T.date(iso, true) +
				(i + 1 === now && t.status === 'running' ? ', today' : '') +
				(what.length ? `: ${what.join(', ')}` : '');
			s += `<li class="trd-day ${cls}${t.status !== 'running' && i + 1 > now ? ' is-off' : ''}" aria-label="${htmlSafe(label)}"${what.length ? ` data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="${htmlSafe(what.join(' · '))}"` : ''}><span class="trd-day-wd" aria-hidden="true">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()]}</span><span class="trd-day-n" aria-hidden="true">${d.getDate()}</span><span class="trd-day-dots" aria-hidden="true">${what.map((w) => `<span class="${w === 'Nudge sent' ? 'is-nudge' : 'is-step'}"></span>`).join('')}</span></li>`;
		}
		D('days').innerHTML = s;
		if (window.Basalt.tips) window.Basalt.tips(D('days'));

		const paid = t.status === 'converted';
		const plan = paid ? t.paid[0] : t.plan;
		const seats = paid ? t.paid[1] : t.seats;
		const yearly = paid && t.paid[2] === 'yearly';
		const price = money(T.price(plan, seats, yearly));
		D('glance').innerHTML =
			`<div class="trd-glance-item"><dt>Signed in</dt><dd><strong>${t.signedIn}</strong> of ${t.seats} seats</dd></div><div class="trd-glance-item"><dt>Booked</dt><dd><strong>${t.bookings}</strong> ${T.count(t.bookings, t.industry).replace(/^\d+ /, '')}</dd></div><div class="trd-glance-item"><dt>${paid ? 'Pays' : t.status === 'ended' ? 'Would have paid' : 'If they convert'}</dt><dd><strong>${price}</strong> a month</dd></div>`;
	}

	/* Setup */
	function renderSteps() {
		const n = T.done(t);
		D('setup-desc').textContent =
			n === T.milestones.length
				? 'All four done. Teams that get this far nearly always stay.'
				: `${n} of ${T.milestones.length} done. Teams that finish all four in the first week nearly always stay.`;
		const nx = T.next(t);
		D('steps').innerHTML = T.milestones
			.map((m) => {
				const at = t.steps[m.key];
				const isNext = nx && nx.key === m.key && t.status === 'running';
				return `<li class="trd-step${at ? ' is-done' : ''}${isNext ? ' is-next' : ''}"><span class="trd-step-icon" aria-hidden="true"><i class="bi ${at ? 'bi-check-lg' : m.icon}"></i></span><div class="trd-step-text"><p class="trd-step-label">${m.label}<span class="visually-hidden">${at ? ', done' : ', not done yet'}</span></p><p class="trd-step-sub">${at ? `Done ${T.date(at, true)}` : htmlSafe(m.tip)}</p>${isNext ? '<button type="button" class="btn btn-sm btn-outline-primary trd-step-btn" data-trd-open="nudge" data-trd-template="setup">Send this tip</button>' : ''}</div></li>`;
			})
			.join('');
	}

	/* People */
	function renderPeople() {
		const unused = t.seats - t.signedIn;
		D('people-desc').textContent =
			`${t.signedIn} of ${t.seats} seats signed in${unused > 0 && t.status === 'running' ? `; ${plural(unused, 'seat')} not used yet.` : '.'}`;
		const shown = t.people.slice(0, 5);
		D('people').innerHTML =
			shown
				.map(
					(p) =>
						`<li class="trd-person"><span class="basalt-avatar" data-basalt-avatar data-name="${htmlSafe(p[0])}" aria-hidden="true"></span><div class="trd-person-text"><p class="trd-person-name">${htmlSafe(p[0])}</p>${p[2] !== p[1] ? `<p class="trd-person-title">${htmlSafe(p[2])}</p>` : ''}</div><span class="trd-role trd-role-${p[1].toLowerCase()}">${htmlSafe(p[1])}</span><span class="trd-person-when">${when(p[3])}</span></li>`,
				)
				.join('') +
			(t.signedIn > shown.length
				? `<li class="trd-person trd-person-more"><span class="trd-more" aria-hidden="true">+${t.signedIn - shown.length}</span><p class="trd-person-title">${plural(t.signedIn - shown.length, 'more team member')}, all signed in this week</p></li>`
				: '');
		if (window.Basalt.avatars) window.Basalt.avatars(D('people'));
	}

	/* Activity */
	const KIND = {
		start: 'bi-flag',
		team: 'bi-people',
		visit: 'bi-calendar-check',
		reminder: 'bi-chat-dots',
		invoice: 'bi-receipt',
		nudge: 'bi-send',
		idle: 'bi-moon',
		paid: 'bi-credit-card',
		ended: 'bi-x-circle',
		note: 'bi-chat-left-text',
		extend: 'bi-calendar-plus',
	};
	function paintFeed() {
		D('feed').innerHTML = t.activity
			.map(
				(a) =>
					`<li class="trd-feed-item trd-feed-item-${a[2]}"><span class="trd-feed-icon" aria-hidden="true"><i class="bi ${KIND[a[2]] || 'bi-dot'}"></i></span><div class="trd-feed-text"><p class="trd-feed-what">${htmlSafe(a[1])}</p><p class="trd-feed-when">${when(a[0])}</p></div></li>`,
			)
			.join('');
	}

	/* Details */
	function renderFacts() {
		const paid = t.status === 'converted';
		const plan = paid ? t.paid[0] : t.plan;
		const seats = paid ? t.paid[1] : t.seats;
		const yearly = paid && t.paid[2] === 'yearly';
		const month = T.price(plan, seats, yearly);
		D('details-desc').textContent = paid
			? 'What they pay now, and who to talk to.'
			: 'What they would pay, and who to talk to.';

		function row(k, v, sub) {
			return `<div class="trd-facts-row"><dt>${k}</dt><dd>${v}${sub ? `<span class="trd-facts-sub">${sub}</span>` : ''}</dd></div>`;
		}

		let s = row(
			'Plan',
			`${T.plans[plan].name}, ${plural(seats, 'seat')}`,
			`${money(T.plans[plan].price)} a seat a month`,
		);
		s += row(
			paid ? 'Price' : 'Price after trial',
			`${money(month)} a month`,
			yearly
				? `Billed yearly, ${money(T.plans[plan].price * seats * 10)} a year`
				: paid
					? 'Billed monthly'
					: `Or ${money(T.plans[plan].price * seats * 10)} a year, billed yearly`,
		);
		s += row(
			'Trial',
			`${T.date(t.started)} to ${T.date(paid || t.status === 'ended' ? t.closed : t.until)}`,
			plural(paid || t.status === 'ended' ? today() : total(), 'day'),
		);
		s += row(
			'Main contact',
			htmlSafe(t.people[0][0]),
			`<a href="mailto:${htmlSafe(t.email)}">${htmlSafe(t.email)}</a>`,
		);
		s += row('Region', htmlSafe(t.region));
		if (t.account)
			s += row(
				'Account',
				`<a href="company-details.html?id=${encodeURIComponent(t.account)}">Open the account</a>`,
			);
		D('facts').innerHTML = s;
	}

	function render() {
		paintHead();
		renderDays();
		renderSteps();
		renderPeople();
		paintFeed();
		renderFacts();
	}

	/* Dialogs */
	function modal(id) {
		return bootstrap.Modal.getOrCreateInstance(pick(`#${id}`));
	}

	const forms = {
		convert: pick('[data-trd-form="convert"]'),
		extend: pick('[data-trd-form="extend"]'),
		nudge: pick('[data-trd-form="nudge"]'),
	};

	function seg(sel) {
		return pickAll(sel).forEach((r) => r.dispatchEvent(new Event('change', { bubbles: true })));
	}

	/* Convert: plan, seats and billing, with the price as you change them. */
	function convertTotal() {
		const plan = (pick('[data-trd-plan]:checked') || {}).value || t.plan;
		const seats = parseInt(pick('[data-trd-seats]').value, 10);
		const yearly = (pick('[data-trd-bill]:checked') || {}).value !== 'monthly';
		const out = pick('[data-trd-total]');
		if (!(seats > 0)) {
			out.textContent = 'Enter the number of seats to see the price.';
			return;
		}
		const m = T.price(plan, seats, yearly);
		out.innerHTML = `<strong>${money(m)} a month</strong>${yearly ? `, billed yearly as ${money(T.plans[plan].price * seats * 10)}. Two months free.` : ', billed every month.'}`;
	}
	function showConvert() {
		for (const r of pickAll('[data-trd-plan]')) {
			r.checked = r.value === t.plan;
		}

		pick('[data-trd-seats]').value = t.seats;
		pick('[data-trd-seats]').classList.remove('is-invalid');
		pick('#trd-bill-year').checked = true;
		seg('[data-trd-plan]:checked, [data-trd-bill]:checked');
		pick('[data-trd-convert-sub]').textContent = `Billing starts today. Everything ${first}’s team set up stays.`;
		convertTotal();
		modal('trd-convert').show();
	}
	forms.convert.addEventListener('input', convertTotal);
	forms.convert.addEventListener('change', convertTotal);
	forms.convert.addEventListener('submit', (e) => {
		e.preventDefault();
		const seatsEl = pick('[data-trd-seats]');
		const seats = parseInt(seatsEl.value, 10);
		if (!(seats > 0)) {
			seatsEl.classList.add('is-invalid');
			seatsEl.focus();
			return;
		}
		seatsEl.classList.remove('is-invalid');
		const plan = pick('[data-trd-plan]:checked').value;
		const bill = pick('[data-trd-bill]:checked').value;
		t.status = 'converted';
		t.closed = T.today;
		t.paid = [plan, seats, bill];
		t.activity.unshift([
			T.today,
			`Converted to ${T.plans[plan].name} with ${plural(seats, 'seat')}, billed ${bill}.`,
			'paid',
		]);
		modal('trd-convert').hide();
		render();
		toast({
			tone: 'success',
			title: `${t.name} is paying now`,
			text: `${T.plans[plan].name}, ${plural(seats, 'seat')}, ${money(T.price(plan, seats, bill === 'yearly'))} a month.`,
			duration: 5000,
		});
		say(`${t.name} converted to paid.`);
	});

	/* Extend, or reopen an ended trial: from today when it has ended. */
	function newEnd() {
		const more = parseInt((pick('[data-trd-more]:checked') || {}).value || '7', 10);
		const from = t.status === 'ended' || t.until < T.today ? T.today : t.until;
		return T.addDays(from, more);
	}
	function showNewEnd() {
		pick('[data-trd-new-end]').innerHTML = `New last day: <strong>${T.date(newEnd(), true)}</strong>.`;
	}
	function openExtend() {
		const reopen = t.status === 'ended';
		pick('#trd-extend-title').textContent = reopen ? 'Reopen trial' : 'Extend trial';
		pick('[data-trd-form="extend"] [type="submit"]').textContent = reopen ? 'Reopen trial' : 'Extend trial';
		pick('#trd-more7').checked = true;
		seg('[data-trd-more]:checked');
		showNewEnd();
		modal('trd-extend').show();
	}
	forms.extend.addEventListener('change', showNewEnd);
	forms.extend.addEventListener('submit', (e) => {
		e.preventDefault();
		const end = newEnd();
		const reopen = t.status === 'ended';
		t.until = end;
		t.status = 'running';
		t.activity.unshift([
			T.today,
			`${reopen ? 'Trial reopened' : 'Trial extended'} to ${T.date(end, true)}.`,
			'extend',
		]);
		modal('trd-extend').hide();
		render();
		toast({
			tone: 'success',
			title: reopen ? 'Trial reopened' : 'Trial extended',
			text: `${first} gets an email: the new last day is ${T.date(end, true)}.`,
			duration: 5000,
		});
	});

	/* Nudge: pick what to say; the email fills in from the trial. */
	const tplSelect = pick('[data-trd-template]');
	tplSelect.innerHTML = Object.keys(T.templates)
		.map((k) => `<option value="${k}">${htmlSafe(T.templates[k].label)}</option>`)
		.join('');
	function fillTemplate() {
		const tpl = T.templates[tplSelect.value];
		const nx = T.next(t);

		function fill(s) {
			return s
				.replace(/\{first\}/g, first)
				.replace(/\{ends\}/g, endWords())
				.replace(
					/\{tip\}/g,
					nx ? nx.tip.charAt(0).toLowerCase() + nx.tip.slice(1) : 'invite the rest of the team.',
				);
		}

		pick('[data-trd-subject]').value = fill(tpl.subject);
		pick('[data-trd-message]').value = fill(tpl.body);
	}
	function openNudge(key) {
		const template = key || (left() <= 3 ? 'ending' : T.next(t) ? 'setup' : 'help');
		tplSelect.value = template;
		fillTemplate();

		for (const x of pickAll('.is-invalid', forms.nudge)) {
			x.classList.remove('is-invalid');
		}

		pick('[data-trd-nudge-to]').textContent = `To ${t.people[0][0]}, ${t.email}`;
		modal('trd-nudge').show();
	}
	start();
})();
