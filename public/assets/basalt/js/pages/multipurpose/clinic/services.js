/**
 * Visit Types (services.html)
 * What patients can book at Bayline Health: each visit type's length and
 * the time kept free after it, its self-pay price, who can see the
 * patient for it and its booking rules, edited in a side panel. Below,
 * the settings for every booking.
 *
 * Data comes from window.Basalt.data.bookings (data/multipurpose/clinic/bookings.js).
 * Changes stay in the page; swap the api object's methods for calls to
 * your backend.
 */
(() => {
	'use strict';
	const root = pick('[data-sv-root]');
	const B = window.Basalt.data && window.Basalt.data.bookings;
	if (!root || !B) return;

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function plural(n, w) {
		return `${n} ${w}${n === 1 ? '' : 's'}`;
	}

	const api = {
		save: (s) => Promise.resolve(s),
		rule: (k, v) => Promise.resolve(v),
	};

	const LONGEST = 120; /* the time bar's full width, in minutes */
	const rows = pick('[data-sv-rows]', root);
	const summary = pick('[data-sv-summary]', root);
	const live = pick('[data-sv-live]', root);
	let openId = null;

	function avatar(name) {
		return `<span class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function leadText(h) {
		return h === 0 ? 'Same day' : h < 24 ? `${h} hours ahead` : h === 24 ? '1 day ahead' : `${h / 24} days ahead`;
	}

	function start(scope) {
		if (window.Basalt.avatars) window.Basalt.avatars(scope);
		if (window.Basalt.tips) window.Basalt.tips(scope);
	}
	function disposeTips(scope) {
		if (!window.bootstrap) return;

		for (const t of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const i = bootstrap.Tooltip.getInstance(t);
			if (!i) continue;
			if (i.tip) {
				if (i.tip.classList.contains('show')) i.hide();
				continue;
			}
			i.dispose();
		}
	}

	function timeBar(minutes, buffer) {
		return `<span class="sv-bar" style="--sv-len:${((minutes / LONGEST) * 100).toFixed(1)}%;--sv-buf:${((buffer / LONGEST) * 100).toFixed(1)}%"><span class="sv-bar-len"></span><span class="sv-bar-buf"></span></span>`;
	}
	function priceCell(s) {
		if (s.included) return ['Included', s.included];
		if (s.from) return [`From ${B.money(s.price)}`, 'Depends on the tests'];
		return [B.money(s.price), s.deposit ? `${B.money(s.deposit)} deposit to book` : 'Self-pay or insurance'];
	}
	function whereLine(s) {
		return `${s.where.indexOf('video') >= 0 ? 'In person or video' : 'In person'} · ${s.online ? `Booked online, ${leadText(s.lead).toLowerCase()}` : 'Booked by the desk'}`;
	}

	function rowHtml(s) {
		const p = priceCell(s);
		const people = s.staff.map(B.person);
		return `<tr class="sv-row${openId === s.id ? ' is-open' : ''}" data-sv-id="${htmlSafe(s.id)}"><td class="sv-row-svc"><div class="sv-svc"><span class="sv-svc-icon bk-tone-${s.group}" aria-hidden="true"><i class="bi ${htmlSafe(s.icon)}"></i></span><span class="sv-svc-text"><span class="sv-svc-name">${htmlSafe(s.name)}</span><span class="sv-sub">${htmlSafe(whereLine(s))}</span></span></div></td><td class="sv-col-time"><span class="sv-time">${timeBar(s.minutes, s.buffer)}<span class="sv-time-text">${htmlSafe(B.fmtMinutes(s.minutes))}${s.buffer ? `<span class="sv-sub"> + ${s.buffer} min</span>` : ''}</span></span></td><td class="sv-col-price"><span class="sv-main">${htmlSafe(p[0])}</span><span class="sv-sub">${htmlSafe(p[1])}</span></td><td class="sv-col-who"><span class="sv-who basalt-avatar-group" role="img" aria-label="${htmlSafe(people.map((x) => x.name).join(', '))}">${people.map((x) => avatar(x.name)).join('')}</span><span class="sv-sub">${htmlSafe(people.length === B.staff.length ? 'Everyone' : people.map((x) => x.name.split(' ').pop()).join(', '))}</span></td><td class="sv-col-open"><span class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-sv-open="${htmlSafe(s.id)}" aria-label="Edit ${htmlSafe(s.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Edit"><i class="bi bi-pencil" aria-hidden="true"></i></button></span></td></tr>`;
	}

	function render() {
		disposeTips(rows);
		let html = '';

		for (const g of Object.keys(B.groups)) {
			const list = B.services.filter((s) => s.group === g);
			if (!list.length) continue;
			html += `<tr class="sv-group"><th scope="rowgroup" colspan="5"><span class="sv-group-dot bk-tone-${g}" aria-hidden="true"></span>${htmlSafe(B.groups[g].label)}</th></tr>${list.map(rowHtml).join('')}`;
		}

		rows.innerHTML = html;
		const online = B.services.filter((s) => s.online).length;
		summary.textContent = `${plural(B.services.length, 'visit type')}, ${online} of them bookable online.`;
		start(rows);
	}

	rows.addEventListener('click', (e) => {
		const btn = e.target.closest('[data-sv-open]');
		const tr = e.target.closest('tr[data-sv-id]');
		if (btn && e.detail > 0) btn.blur();
		if (tr) showEditor(tr.dataset.svId);
	});

	/* The editor */
	const drawer = pick('#sv-edit');
	const form = pick('[data-sv-form]', drawer);
	const d = { title: pick('[data-sv-d="title"]', drawer), sub: pick('[data-sv-d="sub"]', drawer) };
	const f = {};

	for (const n of pickAll('[data-sv-f]', form)) {
		f[n.dataset.svF] = n;
	}

	const preview = pick('[data-sv-preview]', form);
	const staffBox = pick('[data-sv-staff]', form);
	const staffError = pick('[data-sv-staff-error]', form);
	const money = pick('[data-sv-money]', form);
	const incl = pick('[data-sv-incl]', form);

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	staffBox.innerHTML = B.staff
		.map(
			(p) =>
				`<label class="sv-person"><input class="form-check-input" type="checkbox" value="${p.id}" data-sv-person>${avatar(p.name)}<span class="sv-person-text"><span class="sv-person-name">${htmlSafe(p.name)}</span><span class="sv-sub">${htmlSafe(p.role)}, ${htmlSafe(B.place(p.studio).name)}</span></span></label>`,
		)
		.join('');
	start(staffBox);

	function setSelect(sel, v) {
		sel.value = String(v);
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(sel);
	}

	function priceKind() {
		return (pick('[data-sv-pk]:checked', form) || {}).value || 'fixed';
	}

	function setPriceKind(k) {
		const r = pick(`[data-sv-pk][value="${k}"]`, form);
		r.checked = true;
		r.dispatchEvent(new Event('change', { bubbles: true }));
		syncPrice();
	}
	function syncPrice() {
		const k = priceKind();
		money.hidden = k === 'included';
		incl.hidden = k !== 'included';
		f.deposit.closest('.sv-field').hidden = k === 'from';
	}
	function syncPreview() {
		const m = +f.minutes.value;
		const b = +f.buffer.value;
		preview.innerHTML = `${timeBar(m, b)}<span class="sv-preview-text">${htmlSafe(B.fmtMinutes(m))}${b ? `, then ${b} min free` : ''}</span>`;
	}

	for (const r of pickAll('[data-sv-pk]', form)) {
		r.addEventListener('change', syncPrice);
	}

	f.minutes.addEventListener('change', syncPreview);
	f.buffer.addEventListener('change', syncPreview);

	function fill(s) {
		f.name.value = s ? s.name : '';
		f.name.classList.remove('is-invalid');
		setSelect(f.group, s ? s.group : 'styling');
		setSelect(f.minutes, s ? s.minutes : 60);
		setSelect(f.buffer, s ? s.buffer : 15);
		f.price.value = s && !s.included ? s.price : '';
		f.deposit.value = s && s.deposit ? s.deposit : '';
		f.included.value = s && s.included ? s.included : '';
		setPriceKind(s ? (s.included ? 'included' : s.from ? 'from' : 'fixed') : 'fixed');

		for (const c of pickAll('[data-sv-person]', form)) {
			c.checked = s ? s.staff.indexOf(c.value) >= 0 : false;
		}

		staffError.classList.remove('d-block');
		setSelect(f.lead, s ? s.lead : 24);
		setSelect(f.cancel, s ? s.cancel : 24);
		f.video.checked = !!(s && s.where.indexOf('video') >= 0);
		f.online.checked = s ? s.online : true;
		syncPreview();
	}

	function showEditor(id) {
		const s = id ? B.service(id) : null;
		openId = s ? s.id : 'new';
		d.title.textContent = s ? s.name : 'New visit type';
		d.sub.textContent = s ? s.note : 'Set it up, then Appointments can book it.';
		fill(s);
		render();
		panel().show();
	}
	drawer.addEventListener('shown.bs.offcanvas', () => d.title.focus());
	drawer.addEventListener('hidden.bs.offcanvas', () => {
		const id = openId;
		openId = null;
		render();
		const back =
			id && id !== 'new' ? pick(`[data-sv-open="${CSS.escape(id)}"]`, rows) : pick('[data-sv-new]', root);
		if (back) back.focus({ preventScroll: true });
	});
	root.addEventListener('click', (e) => {
		const n = e.target.closest('[data-sv-new]');
		if (n) {
			if (e.detail > 0) n.blur();
			showEditor(null);
		}
	});

	for (const c of pickAll('[data-sv-person]', form)) {
		c.addEventListener('change', () => staffError.classList.remove('d-block'));
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const name = f.name.value.trim();
		const staff = pickAll('[data-sv-person]:checked', form).map((c) => c.value);
		f.name.classList.toggle('is-invalid', !name);
		staffError.classList.toggle('d-block', !staff.length);
		if (!name) {
			f.name.focus();
			return;
		}
		if (!staff.length) {
			pick('[data-sv-person]', form).focus();
			return;
		}
		const k = priceKind();
		const data = {
			name,
			short: name.length > 18 ? name.split(' ').slice(-2).join(' ') : name,
			group: f.group.value,
			minutes: +f.minutes.value,
			buffer: +f.buffer.value,
			price: k === 'included' ? 0 : Math.max(0, +f.price.value || 0),
			from: k === 'from',
			included: k === 'included' ? f.included.value.trim() || 'Included' : undefined,
			deposit: k === 'fixed' ? Math.max(0, +f.deposit.value || 0) : 0,
			staff,
			lead: +f.lead.value,
			cancel: +f.cancel.value,
			where: f.video.checked ? ['studio', 'video'] : ['studio'],
			online: f.online.checked,
		};
		let s = openId && openId !== 'new' ? B.service(openId) : null;
		if (s) {
			Object.assign(s, data);
			if (!data.included) delete s.included;
		} else {
			s = Object.assign(
				{
					id: `svc-${Date.now().toString(36)}`,
					icon: { styling: 'bi-clipboard2-pulse', measure: 'bi-thermometer-half', alter: 'bi-droplet' }[
						data.group
					],
					note: 'New visit type',
					sku: null,
				},
				data,
			);
			if (!data.included) delete s.included;
			B.services.push(s);
		}
		api.save(s);
		openId = s.id;
		panel().hide();
		live.textContent = `Saved ${s.name}`;
		toast({
			tone: 'success',
			title: 'Visit type saved',
			text: `${s.name}, ${B.fmtMinutes(s.minutes)}. Appointments can book it right away.`,
			duration: 4000,
		});
	});

	/* Rules for every booking */
	const RULE_TEXT = {
		ahead: (v) => `Patients can book up to ${v} weeks ahead.`,
		reminder: (v) =>
			+v ? `Reminders go out ${v === '24' ? 'the day' : 'two days'} before.` : 'No reminder texts.',
		expire: (v) => `Unanswered requests are declined after ${v} hours.`,
		keepDeposit: (v) => (v ? 'No-shows are charged the late-cancel fee.' : 'No-shows are not charged.'),
	};

	for (const c of pickAll('[data-sv-rule]', root)) {
		const k = c.dataset.svRule;
		if (c.type === 'checkbox') c.checked = !!B.rules[k];
		else setSelect(c, B.rules[k]);
		c.addEventListener('change', () => {
			const v = c.type === 'checkbox' ? c.checked : c.value;
			B.rules[k] = c.type === 'checkbox' ? v : +v;
			api.rule(k, B.rules[k]);
			if (c.type === 'checkbox') c.blur();
			toast({ tone: 'success', title: 'Saved', text: RULE_TEXT[k](v), duration: 3000 });
		});
	}

	render();
})();
