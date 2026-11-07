/**
 * Basalt - Shopper Details page (shopper-details.html)
 * One Marlo shopper in full: what they spend, their orders, the
 * sizes they keep, returns, saved addresses, what they agreed to
 * hear from us, and how they sign in.
 *
 * shopper-details.html?id=<customer number> opens a shopper; without
 * one, or with a number the shop doesn't know, it opens the shop's
 * biggest spender. Orders and customers come from the shop book
 * (window.Basalt.shopBook, store.js), refund claims from
 * window.Basalt.data.refunds and the rest from
 * window.Basalt.data.shoppers, so every page tells the same story.
 */
(() => {
	'use strict';
	const page = pick('[data-sp-root]');
	const book = window.Basalt.shopBook;
	const data = window.Basalt.data || {};
	if (!page || !book || !data.shoppers) return;

	function start() {
		pick('[data-sp-copy]', page).addEventListener('click', () => {
			function done() {
				return toast({ tone: 'success', title: 'Copied', text: `${c.id} is on your clipboard.` });
			}

			if (navigator.clipboard) navigator.clipboard.writeText(c.id).then(done, done);
			else done();
		});
		pick('[data-sp-export]', page).addEventListener('click', () => {
			const out = {
				customer: c.id,
				name: c.name,
				email: c.email,
				phone: c.phone,
				address: c.address,
				country,
				tier: tier.label,
				joined: c.joinedOn,
				sizes: p.sizes,
				consent: p.consent,
				orders: orders.map((o) => ({
					order: o.orderNumber,
					date: o.date,
					total: o.total,
					status: ORDER_STATUS[o.status][1],
				})),
			};
			const link = document.createElement('a');
			link.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
			link.download = `${c.id.toLowerCase()}.json`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(link.href), 1000);
			toast({ tone: 'success', title: 'Data downloaded', text: `Everything we hold on ${c.name}, in one file.` });
		});

		header();
		band();
		ordersCard();
		signCard();
		sizesCard();
		returnsCard();
		addressesCard();
		consentCard();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function el(k) {
		return pick(`[data-sp="${k}"]`, page);
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

	/* The demo is pinned to the shop book's "now", Friday, October 9, 2026. */
	const TODAY = window.Basalt.toLocalDay(book.NOW.slice(0, 10));
	const DAY = 86400000;

	function day(iso) {
		return window.Basalt.toLocalDay(iso.slice(0, 10));
	}

	function daysSince(iso) {
		return Math.round((TODAY - day(iso)) / DAY);
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Dates keep together on one line (no-break spaces). */
	function dayMonth(iso) {
		const d = day(iso);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function fullDate(iso) {
		return `${dayMonth(iso)}, ${day(iso).getFullYear()}`;
	}

	function monthYear(iso) {
		const d = day(iso);
		return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
	}
	function clock(iso) {
		const [h, m] = iso.slice(11, 16).split(':').map(Number);
		return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
	}
	function when(iso) {
		const n = daysSince(iso);
		if (n === 0) return `Today at ${clock(iso)}`;
		if (n === 1) return `Yesterday at ${clock(iso)}`;
		return fullDate(iso);
	}

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function moneyCents(n) {
		return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function plural(n, word) {
		return `${n} ${word}${n === 1 ? '' : 's'}`;
	}

	function initials(name) {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase();
	}

	const TIERS = {
		flagship: { label: 'Insider', perk: '15% off clothing', tone: 8 },
		partner: { label: 'Member', perk: '10% off clothing', tone: 3 },
		trade: { label: 'Standard', perk: 'Full price', tone: 'plain' },
	};
	const ORDER_STATUS = {
		placed: ['warning', 'Awaiting payment'],
		paid: ['warning', 'Waiting to pack'],
		picking: ['primary', 'Packed'],
		dispatched: ['primary', 'Shipped'],
		delivered: ['success', 'Delivered'],
		canceled: ['danger', 'Canceled'],
	};
	const RHYTHM = {
		ok: { tone: 'success', label: 'On track' },
		due: { tone: 'warning', label: 'Due to reorder' },
		quiet: { tone: 'danger', label: 'Gone quiet' },
		fresh: { tone: 'info', label: 'New' },
	};
	const CLAIM_STATUS = {
		new: ['warning', 'Waiting'],
		inspecting: ['info', 'Checking'],
		refunded: ['success', 'Refunded'],
		declined: ['danger', 'Declined'],
	};
	const PAST = {
		exchange: ['primary', 'Exchanged', 'bi-arrow-left-right', 'Swapped for another size'],
		refund: ['success', 'Refunded', 'bi-arrow-counterclockwise', 'Changed their mind'],
		credit: ['success', 'Credited', 'bi-arrow-counterclockwise', 'Credited to the next order'],
	};
	const SIGN = {
		password: ['bi-key', 'Email and password'],
		google: ['bi-google', 'Google'],
		apple: ['bi-apple', 'Apple'],
	};
	const SIZE_TONE = { Tailoring: 1, Dresses: 8, Coats: 2, Evening: 4, Shoes: 3, Coat: 5 };

	/* Which shopper */
	const wanted = new URLSearchParams(location.search).get('id');
	const c = book.CUSTOMERS.find((x) => x.id === wanted) || book.CUSTOMERS.find((x) => x.id === '#88041');
	const p = Object.assign(
		{ sign: null, sizes: [], fit: '', more: [], consent: {}, past: [] },
		data.shoppers.PROFILES[c.id],
	);
	const first = c.name.split(' ')[0];
	const orders = book.ORDERS.filter((o) => o.customer === c.name)
		.slice()
		.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
	const kept = orders.filter((o) => o.status !== 'canceled');
	const last = kept.length ? kept[0].date : c.last || null;
	const state = { locked: !!p.locked, reason: '', invited: false };

	/* Their pace: the average gap between orders, and how long since the last. */
	function rhythm() {
		if (!c.orders || !last) return { key: 'fresh', gap: 0 };
		const since = daysSince(last);
		const gap = c.orders > 1 ? Math.round((day(last) - day(c.joinedOn)) / DAY / (c.orders - 1)) : 30;
		return { key: since > gap * 1.8 ? 'quiet' : since > gap * 1.15 ? 'due' : 'ok', gap, since };
	}
	const r = rhythm();
	const tier = TIERS[c.tier];
	const country = book.COUNTRIES[c.country];

	/* Header */
	function header() {
		const av = el('avatar');
		av.textContent = initials(c.name);
		av.classList.add(`sp-tone-${c.avatarTone}`);
		el('name').textContent = c.name;
		el('sub').textContent =
			`${c.city === country ? c.city : `${c.city}, ${country}`} · Customer since ${monthYear(c.joinedOn)}`;
		const st = RHYTHM[r.key];
		el('tags').innerHTML =
			`<span class="sp-tier sp-tone-${tier.tone}">${tier.label}</span><span class="basalt-status basalt-status-dot basalt-status-${st.tone}">${st.label}</span><span class="sp-id">${htmlSafe(c.id)}</span>`;
		el('mail').href = `mailto:${c.email}`;
		el('mail').setAttribute('aria-label', `Send ${c.name} an email`);
		document.title = `${c.name} · Basalt`;
	}

	/* The band */
	function band() {
		el('spend').textContent = money(c.lifetimeValue);
		el('spend-note').textContent = `${tier.label}, ${tier.perk.charAt(0).toLowerCase()}${tier.perk.slice(1)}`;
		el('count').textContent = String(c.orders);
		el('count-note').textContent = !c.orders
			? `Joined on ${fullDate(c.joinedOn)}`
			: c.orders === 1
				? 'Their first order'
				: `About one every ${r.gap} days`;
		if (!last) {
			el('last').textContent = 'None yet';
			el('last-note').textContent = `A welcome email went out on ${dayMonth(c.joinedOn)}`;
			return;
		}
		el('last').textContent = fullDate(last);
		if (kept.length) {
			const o = kept[0];
			el('last-note').innerHTML =
				`<a class="sp-link" href="order-details.html?id=${encodeURIComponent(o.orderNumber)}">${o.orderNumber}</a> · ${ORDER_STATUS[o.status][1]}`;
		} else {
			el('last-note').textContent =
				`${plural(daysSince(last), 'day')} ago${c.orders > 1 ? `, usually every ${r.gap} days` : ''}`;
		}
	}

	/* Orders */
	const SHOW = 5;
	function itemsLine(o) {
		return o.lines.map((l) => book.product(l.sku).name + (l.qty > 1 ? ` ×${l.qty}` : '')).join(', ');
	}
	function ordersCard() {
		const list = orders.slice(0, SHOW);
		el('orders').innerHTML = list
			.map((o) => {
				const s = ORDER_STATUS[o.status];
				const items = itemsLine(o);
				return `<li class="sp-order"><span class="sp-order-main"><a class="sp-link" href="order-details.html?id=${encodeURIComponent(o.orderNumber)}">${o.orderNumber}</a><span class="sp-order-items" title="${htmlSafe(items)}">${htmlSafe(items)}</span></span><span class="sp-order-date"><span class="sp-order-date-label">Placed </span>${fullDate(o.date)}</span><span class="basalt-status basalt-status-${s[0]} sp-pill">${s[1]}</span><span class="sp-order-total sp-num">${moneyCents(o.total)}</span></li>`;
			})
			.join('');
		el('orders-head').hidden = !list.length;
		el('orders').hidden = !list.length;
		/* With nothing recent, one line says when the last order came in. */
		const empty = el('orders-empty');
		empty.hidden = !!list.length || !last;
		if (!list.length && last) {
			empty.textContent =
				c.orders === 1
					? `Their only order came in on ${fullDate(last)}.`
					: `The last of their ${c.orders} orders came in on ${fullDate(last)}.`;
		}
		el('orders-desc').textContent = list.length
			? list.length === 1
				? 'The latest one.'
				: `The latest ${['', '', 'two', 'three', 'four', 'five'][list.length]}, newest first.`
			: last
				? 'None in the last six weeks.'
				: 'None yet. They show here as they come in.';
		const earlier = c.orders - list.length;
		el('orders-foot').textContent =
			list.length && earlier > 0 ? `And ${plural(earlier, 'earlier order')} since ${monthYear(c.joinedOn)}.` : '';
	}

	/* Sign-in */
	function signCard() {
		const s = p.sign;
		const reset = pick('[data-sp-reset]', page);
		const lock = pick('[data-sp-lock]', page);
		const unlock = pick('[data-sp-unlock]', page);
		const invite = pick('[data-sp-invite]', page);
		el('sign-facts').hidden = !s;
		el('guest').hidden = !!s;
		reset.hidden = lock.hidden = unlock.hidden = true;
		invite.hidden = true;

		if (!s) {
			el('sign-desc').textContent = `${first} checks out as a guest.`;
			el('guest-text').innerHTML =
				`No account yet. Orders are placed with <strong>${htmlSafe(c.email)}</strong>, so they still land here.`;
			invite.hidden = state.invited;
			el('locked-note').hidden = true;
			return;
		}

		el('sign-desc').textContent = `How ${first} signs in.`;
		const how = SIGN[s[0]];
		const verified = s[1]
			? '<span class="sp-check"><i class="bi bi-patch-check" aria-hidden="true"></i>Verified</span>'
			: '<span class="sp-check sp-check-no"><i class="bi bi-exclamation-circle" aria-hidden="true"></i>Not verified</span>';
		const rows = [
			['Email', `<a class="sp-link" href="mailto:${htmlSafe(c.email)}">${htmlSafe(c.email)}</a>${verified}`],
			[
				'Signs in with',
				`<span class="sp-facts-with"><i class="bi ${how[0]}" aria-hidden="true"></i>${how[1]}</span>${s[0] === 'password' ? '' : '<span class="sp-facts-note">No password with us to reset.</span>'}`,
			],
			['Last signed in', `${when(s[2])}<span class="sp-facts-note">${htmlSafe(s[3])}</span>`],
			['Account opened', fullDate(c.joinedOn)],
		];
		el('sign-facts').innerHTML = rows
			.map((row) => `<div class="sp-facts-row"><dt>${row[0]}</dt><dd>${row[1]}</dd></div>`)
			.join('');

		el('locked-note').hidden = !state.locked;
		if (state.locked)
			el('locked-text').textContent =
				`Locked today${state.reason ? `: ${state.reason.charAt(0).toLowerCase()}${state.reason.slice(1)}` : ''}. ${first} can’t sign in until you unlock it.`;
		const label = s[1] ? 'Send reset link' : 'Resend verification';
		reset.lastChild.textContent = label;
		reset.hidden = state.locked || (s[0] !== 'password' && s[1]);
		lock.hidden = state.locked;
		unlock.hidden = !state.locked;
	}

	function sent(text) {
		el('sent-text').textContent = text;
		el('sent').hidden = false;
	}

	pick('[data-sp-reset]', page).addEventListener('click', () => {
		const verify = !p.sign[1];
		toast({
			tone: 'success',
			title: verify ? 'Verification email sent' : 'Reset link sent',
			text: c.email + (verify ? ' gets a link to confirm the address.' : ' gets a link that works for one hour.'),
		});
		sent(verify ? 'Verification sent' : 'Reset link sent');
		el('sent').focus();
	});
	pick('[data-sp-invite]', page).addEventListener('click', () => {
		state.invited = true;
		signCard();
		sent('Invite sent today');
		el('sent').focus();
		toast({
			tone: 'success',
			title: 'Invite sent',
			text: `${first} gets an email to set up an account with ${c.email}.`,
		});
	});

	const lockModal = document.getElementById('sp-lock');
	pick('[data-sp-lock-name]', lockModal).textContent = `${first}’s`;
	pick('[data-sp-lock-sub]', lockModal).textContent =
		`${first} is signed out everywhere and can’t sign in until you unlock the account.`;
	pick('[data-sp-lock]', page).addEventListener('click', () =>
		window.bootstrap.Modal.getOrCreateInstance(lockModal).show(),
	);
	pick('[data-sp-lock-go]', lockModal).addEventListener('click', () => {
		state.locked = true;
		state.reason = pick('[data-sp-lock-reason]', lockModal).value;
		el('sent').hidden = true;
		lockModal.addEventListener('hidden.bs.modal', () => el('locked-note').focus(), { once: true });
		window.bootstrap.Modal.getInstance(lockModal).hide();
		signCard();
		toast({ tone: 'success', title: 'Account locked', text: `${first} is signed out on every device.` });
	});
	pick('[data-sp-unlock]', page).addEventListener('click', () => {
		state.locked = false;
		signCard();
		pick('[data-sp-lock]', page).focus();
		toast({ tone: 'success', title: 'Account unlocked', text: `${first} can sign in again.` });
	});

	/* Sizes and fits */
	function sizesCard() {
		el('sizes').innerHTML = p.sizes
			.map(
				(s) =>
					`<li class="sp-size sp-tone-${SIZE_TONE[s[0]] || 1}"><span class="sp-size-what">${htmlSafe(s[0])}</span><span class="sp-size-value${s[1].length > 4 ? ' sp-size-value-long' : ''}">${htmlSafe(s[1])}</span><span class="sp-size-note">${htmlSafe(s[2])}</span></li>`,
			)
			.join('');
		el('sizes').hidden = !p.sizes.length;
		el('fit').hidden = !p.fit;
		el('fit-text').textContent = p.fit;
		el('sizes-empty').hidden = !!p.sizes.length;
	}

	/* Returns */
	function returnsCard() {
		const refunds = data.refunds || { CLAIMS: [], REASONS: {}, TONE: {} };
		const mine = orders.map((o) => o.orderNumber);
		const claims = refunds.CLAIMS.filter((k) => mine.indexOf(k.order) !== -1);
		const rows = claims
			.map((k) => {
				const sku = Array.isArray(k.lines[0]) ? k.lines[0][0] : k.lines[0].sku;
				const st = CLAIM_STATUS[k.status] || CLAIM_STATUS.new;
				return {
					date: k.opened.slice(0, 10),
					html: `<li class="sp-return sp-tone-${refunds.TONE[sku] || 1}"><span class="sp-return-icon" aria-hidden="true"><i class="bi bi-arrow-counterclockwise"></i></span><span class="sp-return-main"><span class="sp-return-name">${htmlSafe(book.product(sku).name)}</span><span class="sp-return-sub"><a class="sp-link" href="refund-details.html?id=${encodeURIComponent(k.id)}">${k.id}</a> · ${htmlSafe(refunds.REASONS[k.reason] ? refunds.REASONS[k.reason].label : '')} · ${dayMonth(k.opened.slice(0, 10))}</span></span><span class="basalt-status basalt-status-${st[0]} sp-pill">${st[1]}</span></li>`,
				};
			})
			.concat(
				p.past.map((x) => {
					const how = PAST[x[3]];
					return {
						date: x[0],
						html: `<li class="sp-return sp-tone-${(refunds.TONE || {})[x[1]] || 2}"><span class="sp-return-icon" aria-hidden="true"><i class="bi ${how[2]}"></i></span><span class="sp-return-main"><span class="sp-return-name">${htmlSafe(book.product(x[1]).name)}, size ${htmlSafe(x[2])}</span><span class="sp-return-sub">${htmlSafe(x[4])} · ${how[3]} · ${fullDate(x[0])}</span></span><span class="basalt-status basalt-status-${how[0]} sp-pill">${how[1]}</span></li>`,
					};
				}),
			)
			.sort((a, b) => b.date.localeCompare(a.date));

		el('returns').innerHTML = rows.map((x) => x.html).join('');
		el('returns').hidden = !rows.length;
		el('returns-empty').hidden = !!rows.length || !c.orders;
		el('returns-desc').textContent = !c.orders
			? 'Nothing ordered yet.'
			: rows.length
				? `${plural(rows.length, 'return')} across ${plural(c.orders, 'order')}.`
				: `Across ${plural(c.orders, 'order')}.`;
	}

	/* Addresses */
	function addressesCard() {
		const homeLines = c.address.concat(c.city === country ? [] : [country]);
		const guest = !p.sign;

		function tag(t) {
			return `<span class="basalt-status basalt-status-primary sp-address-tag">${t}</span>`;
		}

		function block(icon, label, lines, tags) {
			return `<li class="sp-address"><div class="sp-address-head"><span class="sp-address-label"><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(label)}</span>${tags}</div><address class="sp-address-lines">${lines.map(htmlSafe).join('<br>')}</address></li>`;
		}

		el('addresses').innerHTML = guest
			? block('bi-box-seam', 'Last delivery', homeLines, '')
			: block('bi-house', 'Home', homeLines, tag('Delivery') + tag('Billing')) +
				p.more.map((a) => block('bi-geo-alt', a.label, a.lines, '')).join('');
		el('addr-desc').textContent = guest
			? 'Guests don’t save addresses. This is where the last order went.'
			: p.more.length
				? `Home is the default. ${first} picks the other at checkout.`
				: `Orders go here unless ${first} picks another at checkout.`;
	}

	/* Marketing */
	function consentCard() {
		const CHANNELS = [
			['email', 'bi-envelope', 'Email', 'News and the lookbook'],
			['sms', 'bi-chat-dots', 'Texts', 'Early access to sales'],
			['post', 'bi-mailbox', 'Mail', 'Printed lookbook'],
		];
		el('consent').innerHTML = CHANNELS.map((ch) => {
			const v = p.consent[ch[0]] || [false, null];
			const on = !!v[0];
			const sub = on ? `${ch[3]} · since ${fullDate(v[1])}` : v[1] ? `Unsubscribed ${fullDate(v[1])}` : ch[3];
			return `<li class="sp-consent-row${on ? ' is-on' : ''}"><span class="sp-consent-icon" aria-hidden="true"><i class="bi ${ch[1]}"></i></span><span class="sp-consent-main"><span class="sp-consent-name">${ch[2]}</span><span class="sp-consent-sub">${htmlSafe(sub)}</span></span><span class="sp-consent-state">${on ? '<i class="bi bi-check-lg me-1" aria-hidden="true"></i>Yes' : 'No'}</span></li>`;
		}).join('');
	}

	/* Header menu */
	start();
})();
