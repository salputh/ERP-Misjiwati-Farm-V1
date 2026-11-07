/**
 * Basalt - Shipment Details (shipment-details.html)
 * One parcel: where it is between the warehouse and the shopper's door,
 * every carrier scan, what is in the box, the delivery address and the
 * emails the shopper got. From here the team copies the tracking link,
 * emails the shopper or starts a return.
 *
 * The parcels are the ones on Shipments, from
 * window.Basalt.data.shipments (assets/basalt/js/data/multipurpose/shipments.js).
 * ?id=%23474 in the address picks the parcel; without one, or with an
 * id that isn't there, the first parcel on the list opens (the most
 * urgent one).
 *
 * In a real app the Send and Return handlers call your server; here
 * they update the page and show a toast.
 */
(() => {
	'use strict';
	const root = pick('[data-sd-root]');
	const D = window.Basalt.data && window.Basalt.data.shipments;
	if (!root || !D || typeof bootstrap === 'undefined') return;

	function start() {
		for (const r of pickAll('input[name="sdHow"]', ret)) {
			r.addEventListener('change', how);
		}

		pick('[data-sd-return-form]', ret).addEventListener('submit', (e) => {
			e.preventDefault();
			const picked = pickAll('.form-check-input:checked', R('items'));
			R('items-error').hidden = !!picked.length;
			if (!picked.length) {
				pick('.form-check-input', R('items')).focus();
				return;
			}
			const byPickup = pick('#sd-how-pick', ret).checked;
			const day =
				byPickup && window.Basalt.datepicker ? window.Basalt.datepicker.get(pick('#sd-pick-date', ret)) : '';
			X.emails.unshift({
				at: stamp(NOW),
				text: `Return label${byPickup && day ? `, UPS pickup ${fmtShort(parse(`${day}T09:00`))}` : ' and drop-off steps'}`,
				by: 'John Armstrong',
				fresh: true,
			});
			bootstrap.Modal.getOrCreateInstance(ret).hide();
			S('return-btn').hidden = true;
			drawMails();
			toast({
				tone: 'success',
				title: 'Return started',
				text: `A prepaid UPS label is on its way to ${C.name}.`,
				duration: 5000,
			});
			announce(`Return started for ${plural(picked.length, 'item')}`);
		});

		drawHead();
		drawNotice();
		drawRoute();
		fillRouteOnSight(S('route'));
		drawScans();
		drawItems();
		drawAddress();
		drawMails();
		if (window.Basalt.buttons) window.Basalt.buttons(root);
	}

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

	function money(n) {
		return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		const l = pick('[data-sd-live]', root);
		if (l) l.textContent = t;
	}

	function S(k) {
		return pick(`[data-sd="${k}"]`, root);
	}

	/* Dates */
	function pad(n) {
		return String(n).padStart(2, '0');
	}

	function parse(s) {
		const [d, t] = s.split('T');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '00:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}
	const NOW = parse(D.NOW);
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	function startOfDay(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	function dayDiff(d) {
		return Math.round((startOfDay(d) - startOfDay(NOW)) / 86400000);
	}

	function clockText(d) {
		return `${d.getHours() % 12 || 12}:${pad(d.getMinutes())}${d.getHours() < 12 ? ' am' : ' pm'}`;
	}

	function fmtDay(d) {
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function fmtShort(d) {
		const n = dayDiff(d);
		if (n === 0) return 'Today';
		if (n === -1) return 'Yesterday';
		if (n === 1) return 'Tomorrow';
		return `${DAYS[d.getDay()]}, ${fmtDay(d)}`;
	}

	function fmtLong(d) {
		return `${fmtShort(d)}, ${clockText(d)}`;
	}

	function lower(s) {
		return /^(Today|Tomorrow|Yesterday)/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
	}

	function stamp(d) {
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	/* The parcel */
	const ALL = D.all();
	const asked = new URLSearchParams(location.search).get('id');
	const X = ALL.find((x) => x.id === asked) || ALL[0];
	if (!X) return;
	const C = X.customer;
	const first = C.name.split(' ')[0];
	const isReturn = X.kind === 'return';
	const STATUS = D.STATUS;
	const carrier = D.CARRIERS[X.carrier] || { mark: X.carrier.slice(0, 2), tone: 1 };

	function reached(kind) {
		return X.events.some((e) => e.kind === kind);
	}

	function event(kind) {
		return X.events.find((e) => e.kind === kind);
	}

	function told() {
		return X.emails.some((e) => /delay/i.test(e.text));
	}

	function photo(id) {
		return window.Basalt.photo(id, 112, 112);
	}

	/* Header */
	function pill() {
		const s = STATUS[X.status];
		return `<span class="basalt-status basalt-status-dot${s.tone ? ` basalt-status-${s.tone}` : ''}">${s.label}</span>`;
	}
	function drawHead() {
		const title = (isReturn ? 'Return from ' : 'Parcel to ') + C.city;
		document.title = `${title} · Basalt`;
		S('title').textContent = title;
		const m = S('mark');
		m.className = `sd-mark sd-tone-${carrier.tone}`;
		m.textContent = carrier.mark;
		S('sub').textContent = `Order ${X.order} for ${C.name} · ${X.service}`;
		S('tags').innerHTML =
			`${pill()}<span class="sd-tag"><span class="visually-hidden">Tracking number </span><span class="sd-mono">${htmlSafe(X.tracking)}</span></span>`;
		S('copy').setAttribute('data-basalt-copy', D.trackingLink(X));
		S('return-btn').hidden = isReturn || X.status !== 'delivered';
		/* A late parcel nobody has explained yet makes Notify the main move. */
		const urgent = X.status === 'delayed' && !told();
		S('notify-btn').classList.toggle('btn-primary', urgent);
		S('notify-btn').classList.toggle('btn-outline-secondary', !urgent);
		/* Previous and next follow the order of the Shipments list. */
		const i = ALL.indexOf(X);

		function link(el, x) {
			el.href = `shipment-details.html?id=${encodeURIComponent(x.id)}`;
			el.setAttribute('aria-label', `${el === S('prev') ? 'Previous' : 'Next'} parcel: ${x.order}`);
		}

		link(S('prev'), ALL[(i - 1 + ALL.length) % ALL.length]);
		link(S('next'), ALL[(i + 1) % ALL.length]);
	}

	/* The one urgent thing: a carrier delay. */
	function drawNotice() {
		const n = S('notice');
		if (X.status !== 'delayed') {
			n.hidden = true;
			return;
		}
		n.hidden = false;
		n.innerHTML = `<i class="bi bi-exclamation-triangle" aria-hidden="true"></i><span>${htmlSafe(X.carrier)}: ${htmlSafe(X.delay.text.toLowerCase())} in ${htmlSafe(X.delay.place)}, ${htmlSafe(lower(fmtLong(parse(X.delay.at))))}. New delivery day ${htmlSafe(fmtShort(parse(X.expected)))}, was ${htmlSafe(fmtDay(parse(X.was)))}. ${told() ? `${htmlSafe(first)} has been told.` : `${htmlSafe(first)} hasn't been told yet.`}</span>`;
	}

	/* Route: three stops on one line, no map */
	function drawRoute() {
		function at(e) {
			return e ? fmtLong(parse(e.at)) : '';
		}

		const from = isReturn
			? { name: C.name, place: X.origin, icon: 'bi-house' }
			: { name: X.site.name, place: X.site.place, icon: 'bi-box-seam' };
		const to = isReturn
			? { name: X.site.name, place: X.site.place, icon: 'bi-box-seam' }
			: { name: C.name, place: X.dest, icon: 'bi-house' };
		const picked = reached('pickup');
		const atHub = reached('hub');
		const done = reached('delivered');
		const left = reached('move') || reached('local') || reached('out') || done;
		const late = X.status === 'delayed';
		const stops = [
			Object.assign(from, {
				state: picked ? 'done' : 'here',
				when: picked
					? (isReturn ? 'Dropped off ' : 'Picked up ') + lower(at(event('pickup')))
					: `Pickup ${lower(fmtLong(parse(X.pickupAt)))}`,
			}),
			{
				name: `${X.carrier} facility`,
				place: X.hub,
				icon: 'bi-building',
				state: late ? 'late' : left || done ? 'done' : atHub ? 'here' : 'next',
				when: late
					? `Held since ${lower(at(event('delay')))}`
					: atHub
						? `Arrived ${lower(at(event('hub')))}`
						: 'Not there yet',
			},
			Object.assign(to, {
				state: done ? 'done' : reached('out') ? 'here' : 'next',
				when: done
					? (isReturn ? 'Arrived ' : 'Delivered ') + lower(at(event('delivered')))
					: reached('out')
						? `Out for delivery since ${clockText(parse(event('out').at))}`
						: `Expected ${lower(fmtShort(parse(X.expected)))}`,
			}),
		];
		/* Each leg: done, moving (the parcel is on it), late or still to come. */
		const legs = [
			atHub ? 'done' : picked ? 'moving' : 'todo',
			done || reached('out') ? 'done' : left ? 'moving' : 'todo',
		];
		const STATE = { done: 'Done', here: 'Here now', late: 'Delayed here', next: 'Still to come' };
		S('route').innerHTML = stops
			.map(
				(s, i) =>
					`<li class="sd-stop sd-stop-${s.state}"><span class="sd-stop-dot" aria-hidden="true"><i class="bi ${s.state === 'done' ? 'bi-check-lg' : s.state === 'late' ? 'bi-exclamation-lg' : s.icon}"></i></span>${i < 2 ? `<span class="sd-leg sd-leg-${legs[i]}" aria-hidden="true">${legs[i] === 'moving' ? '<i class="bi bi-truck"></i>' : ''}</span>` : ''}<span class="sd-stop-name">${htmlSafe(s.name)}<span class="visually-hidden">, ${STATE[s.state]}</span></span><span class="sd-stop-place">${htmlSafe(s.place)}</span><span class="sd-stop-when">${htmlSafe(s.when)}</span></li>`,
			)
			.join('');

		const days = X.shippedAt
			? Math.max(
					0,
					Math.round((((X.deliveredAt ? parse(X.deliveredAt) : NOW) - parse(X.shippedAt)) / 864e5) * 10) / 10,
				)
			: 0;
		S('route-desc').textContent =
			X.status === 'label'
				? `Packed at ${X.site.name}, waiting for ${X.carrier} to collect it.`
				: done
					? `Took ${days} days with ${X.carrier}.`
					: `Day ${Math.max(1, Math.ceil(days))} with ${X.carrier}. The usual time is ${plural(X.transit, 'day')}.`;

		const facts = [
			['Service', X.service],
			[
				X.status === 'label' ? 'Pickup' : isReturn ? 'Dropped off' : 'Shipped',
				X.status === 'label' ? fmtLong(parse(X.pickupAt)) : fmtLong(parse(X.shippedAt)),
			],
			done
				? [isReturn ? 'Arrived' : 'Delivered', fmtLong(parse(X.deliveredAt))]
				: ['Expected', fmtShort(parse(X.expected))],
			['Package', `${X.box}, ${X.weight.toFixed(2)} kg`],
		];
		S('facts').innerHTML = facts.map((f) => `<div><dt>${f[0]}</dt><dd>${htmlSafe(f[1])}</dd></div>`).join('');
	}

	/**
	 * Fills the route in from the first stop the first time it is on
	 * screen. The classes only switch the stylesheet's animation on, then
	 * step aside.
	 */
	function fillRouteOnSight(route) {
		if (!window.IntersectionObserver || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		route.classList.add('is-waiting');
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				route.classList.replace('is-waiting', 'is-drawing');
				setTimeout(() => route.classList.remove('is-drawing'), 1200);
			},
			{ threshold: 0.5 },
		);
		watch.observe(route);
	}

	/* Tracking scans */
	const ICONS = {
		label: 'bi-upc-scan',
		pickup: 'bi-box-arrow-up',
		hub: 'bi-building',
		move: 'bi-truck',
		local: 'bi-signpost',
		out: 'bi-truck',
		delivered: 'bi-house-check',
		delay: 'bi-exclamation-triangle',
		note: 'bi-envelope',
	};
	function drawScans() {
		S('scans-desc').textContent = `${plural(X.events.length, 'scan')} from ${X.carrier}, newest first.`;
		S('scans').innerHTML = X.events
			.map(
				(e, i) =>
					`<li class="sd-scan sd-scan-${e.kind}${i === 0 ? ' is-latest' : ''}"><span class="sd-scan-icon" aria-hidden="true"><i class="bi ${ICONS[e.kind] || 'bi-dot'}"></i></span><span class="sd-scan-text">${htmlSafe(e.text)}</span><span class="sd-scan-meta">${htmlSafe(e.place)} · ${htmlSafe(fmtLong(parse(e.at)))}</span></li>`,
			)
			.join('');
	}

	/* Contents, address and shopper updates */
	function drawItems() {
		const units = X.lines.reduce((t, l) => t + l.qty, 0);
		const value = X.lines.reduce((t, l) => t + l.qty * l.price, 0);
		S('items-desc').textContent = `${plural(units, 'item')}, ${money(value)} at shop prices.`;
		S('order-link').href = `order-details.html?id=${encodeURIComponent(X.order)}`;
		S('items').innerHTML = X.lines
			.map(
				(l) =>
					`<li class="sd-item">${l.photo ? `<img class="sd-item-img" src="${photo(l.photo)}" alt="" width="48" height="48" loading="lazy">` : `<span class="sd-item-img" aria-hidden="true"><i class="bi ${htmlSafe(l.icon)}"></i></span>`}<span class="sd-item-text"><span class="sd-item-name">${htmlSafe(l.name)}</span><span class="sd-item-meta"><span class="sd-mono">${htmlSafe(l.sku)}</span> · ${money(l.price)} each</span></span><span class="sd-item-qty">× ${l.qty}</span></li>`,
			)
			.join('');
	}

	function drawAddress() {
		S('addr-title').textContent = isReturn ? 'Sent back by' : 'Delivery address';
		S('addr-desc').textContent = isReturn
			? `Back to ${X.site.name}, ${X.site.place}.`
			: `Where ${X.carrier} delivers it.`;
		S('shopper-link').href = `shopper-details.html?id=${encodeURIComponent(C.id)}`;
		const lines = C.address
			.concat(C.country === 'SG' ? [] : [window.Basalt.shopBook.COUNTRIES[C.country]])
			.filter(Boolean);
		S('addr').innerHTML =
			`<div><dt>Name</dt><dd>${htmlSafe(C.name)}</dd></div><div><dt>Address</dt><dd>${lines.map(htmlSafe).join('<br>')}</dd></div><div><dt>Phone</dt><dd><a class="sd-link sd-link-plain" href="tel:${htmlSafe(C.phone.replace(/\s+/g, ''))}">${htmlSafe(C.phone)}</a></dd></div><div><dt>Email</dt><dd><a class="sd-link sd-link-plain" href="mailto:${htmlSafe(C.email)}">${htmlSafe(C.email)}</a></dd></div>`;
	}

	function drawMails() {
		const late = X.status === 'delayed' && !told();
		S('mail-desc').textContent = late
			? `${first} hasn't heard about the delay yet.`
			: `Emails ${first} got about this parcel.`;
		const rows = X.emails.map(
			(m) =>
				`<li class="sd-mail${m.fresh ? ' is-fresh' : ''}"><span class="sd-mail-icon" aria-hidden="true"><i class="bi ${m.by ? 'bi-person' : 'bi-envelope'}"></i></span><span class="sd-mail-text">${htmlSafe(m.text)}</span><span class="sd-mail-meta">${htmlSafe(fmtLong(parse(m.at)))}${m.by ? ` · sent by ${htmlSafe(m.by)}` : ' · automatic'}</span></li>`,
		);
		if (!rows.length)
			rows.push(
				'<li class="sd-mail sd-mail-none"><span class="sd-mail-icon" aria-hidden="true"><i class="bi bi-clock"></i></span><span class="sd-mail-text">Nothing sent yet</span><span class="sd-mail-meta">The shipping email goes out at pickup.</span></li>',
			);
		S('mails').innerHTML = rows.join('');
	}

	/* Notify shopper */
	const notify = document.getElementById('sd-notify');

	function N(k) {
		return pick(`[data-sd-n="${k}"]`, notify);
	}

	const link = D.trackingLink(X);
	const sign = '\n\nThanks,\nThe Marlo team';
	const KINDS = [];
	if (X.status === 'delayed')
		KINDS.push({
			id: 'delay',
			icon: 'bi-hourglass-split',
			label: 'Delay notice',
			log: `Delay notice, new date ${fmtShort(parse(X.expected))}`,
			text: `Hi ${first},\n\nYour Marlo parcel is running late. ${X.carrier} now expects to deliver it on ${fmtShort(parse(X.expected))}. You can follow it here: ${link}${sign}`,
		});
	if (!isReturn)
		KINDS.push({
			id: 'link',
			icon: 'bi-link-45deg',
			label: 'Tracking link',
			log: 'Tracking link sent again',
			text: `Hi ${first},\n\nHere is the tracking link for order ${X.order}: ${link}${sign}`,
		});
	if (X.status === 'delivered')
		KINDS.push({
			id: 'check',
			icon: 'bi-house-check',
			label: 'Delivery check',
			log: 'Asked if the parcel arrived safely',
			text: `Hi ${first},\n\n${X.carrier} shows order ${X.order} as delivered on ${fmtDay(parse(X.deliveredAt))}. Did everything arrive safely? Just reply to this email if not.${sign}`,
		});
	if (isReturn)
		KINDS.push({
			id: 'back',
			icon: 'bi-box-seam',
			label: 'Return received',
			log: 'Return received, refund on its way',
			text: `Hi ${first},\n\nYour return for order ${X.order} has reached us. We'll be in touch about the refund within two business days.${sign}`,
		});
	KINDS.push({
		id: 'note',
		icon: 'bi-pencil',
		label: 'Custom',
		log: 'Message from the team',
		text: `Hi ${first},\n\n${sign.trim()}`,
	});

	N('kinds').innerHTML = `<legend>Message</legend>${KINDS.map(
		(k, i) =>
			`<label class="basalt-choice"><input type="radio" name="sd-kind" value="${k.id}"${i === 0 ? ' checked' : ''}><i class="bi ${k.icon}" aria-hidden="true"></i>${htmlSafe(k.label)}</label>`,
	).join('')}`;

	function pickKind() {
		return KINDS.find((k) => k.id === (pick('input[name="sd-kind"]:checked', notify) || {}).value) || KINDS[0];
	}

	/* The email box grows with its text, so the whole message shows. */
	function fit() {
		const t = N('text');
		t.style.height = 'auto';
		t.style.height = `${t.scrollHeight + 2}px`;
	}

	N('text').addEventListener('input', fit);
	notify.addEventListener('shown.bs.modal', fit);
	N('kinds').addEventListener('change', () => {
		N('text').value = pickKind().text;
		fit();
	});
	notify.addEventListener('show.bs.modal', () => {
		N('sub').textContent = `To ${C.name}, ${C.email}`;
		pick('input[name="sd-kind"]', notify).checked = true;
		N('text').value = KINDS[0].text;
		N('error').hidden = true;
		N('text').classList.remove('is-invalid');
	});
	pick('[data-sd-notify-form]', notify).addEventListener('submit', (e) => {
		e.preventDefault();
		if (!N('text').value.trim()) {
			N('error').hidden = false;
			N('text').classList.add('is-invalid');
			N('text').focus();
			return;
		}
		const k = pickKind();
		X.emails.unshift({ at: stamp(NOW), text: k.log, by: 'John Armstrong', fresh: true });
		bootstrap.Modal.getOrCreateInstance(notify).hide();
		drawMails();
		drawNotice();
		drawHead();
		toast({ tone: 'success', title: 'Email sent', text: `${k.label} sent to ${C.name}.`, duration: 4000 });
		announce(`Email sent to ${C.name}`);
	});

	/* Start a return */
	const ret = document.getElementById('sd-return');

	function R(k) {
		return pick(`[data-sd-r="${k}"]`, ret);
	}

	R('items').innerHTML = X.lines
		.map(
			(l, i) =>
				`<div class="form-check"><input class="form-check-input" type="checkbox" id="sd-ret-${i}" value="${htmlSafe(l.sku)}"${i === 0 ? ' checked' : ''}><label class="form-check-label" for="sd-ret-${i}">${htmlSafe(l.name)}${l.qty > 1 ? ` × ${l.qty}` : ''}</label></div>`,
		)
		.join('');
	function how() {
		const byPickup = pick('#sd-how-pick', ret).checked;
		R('pickup').hidden = !byPickup;
		R('drop-hint').textContent = byPickup
			? 'UPS collects between 9:00 am and 5:00 pm on the day picked.'
			: 'Any UPS Access Point takes it. The label is valid for 30 days.';
	}

	start();
})();
