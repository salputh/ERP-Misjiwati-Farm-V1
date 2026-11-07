/**
 * Everything on order-details.html: one Marlo shop order laid out in
 * full. The cards cover what was bought and the totals, how far the
 * parcel has got, who ordered, how they paid, both addresses, the
 * team's notes and a history of every step.
 *
 * The orders are the same ones the Orders page lists, retail and
 * wholesale alike. assets/basalt/js/data/multipurpose/store.js publishes them as
 * window.Basalt.shopBook together with the buyers, the products and
 * the discount, shipping and tax rules, which is why the total here
 * agrees with the total there. Payment, packing and tracking details
 * come from the book's story() of each order, so an order reads the
 * same on every page and on every reload.
 *
 * ?id=%23478 chooses the order. With no id, or one the book does
 * not know, the latest paid order still waiting to be packed opens.
 *
 * How a list status maps onto this page:
 *   placed      not paid yet
 *   paid        paid and waiting to be packed
 *   picking     packed and waiting for the carrier
 *   dispatched  on its way, with a tracking number
 *   delivered   arrived (or finished, for services and extras); a
 *               refund on the list shows up here as well
 *   canceled   canceled, with the payment refunded or the invoice voided
 *
 * To wire up real data, have backend.load(id) resolve with an order in
 * the shape assemble() returns and point the other backend methods at
 * your server. Every amount is held in cents, so sums never drift.
 */
(() => {
	'use strict';

	const stage = pick('[data-od-root]', document);
	const shop = window.Basalt.shopBook;
	if (!stage || !shop || typeof bootstrap === 'undefined') return;

	/* What the page is showing right now. */
	let order = null;
	let orders = [];
	let showWholeHistory = false;
	let justChangedStep = null;
	let editingTracking = false;
	const HISTORY_PREVIEW = 5;

	/* Who works these orders; SIGNED_IN is the person using the page. */
	const SIGNED_IN = 'John Armstrong';
	const STAFF = { packer: 'Earl Baldwin', helpdesk: 'Dee Quigley' };

	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MS_PER_DAY = 86400000;
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* The demo's clock starts at the book's "today", October 9, 2026, and
     runs forward from the moment the page loaded. */
	const DEMO_CLOCK_START = fromStamp(shop.NOW);
	const LOADED_AT = Date.now();

	/* Which chart tones a category's products cycle through, and the
     one-line remarks some products carry under their name. */
	const CATEGORY_TONES = { Clothing: [1, 2, 3, 6], Accessories: [7, 8], Extras: [5, 4], Services: [6, 1] };
	const SKU_NOTES = {
		'ML-GIFT250': 'Sent by email, nothing ships',
		'ML-CARE': 'Per member, per month',
		'ML-PASS': 'Per member, per month',
		'ML-MTM': 'Made in the Akron workshop',
		'ML-STYLE': 'Run by the styling team',
	};
	const TIER_LABEL = {
		flagship: 'Insider tier',
		partner: 'Member tier',
		trade: 'Standard tier',
		stockist: 'Stockist',
	};
	const SITE_NAMES = { reno: 'Elko', columbus: 'Columbus', annarbor: 'Ann Arbor', medford: 'Bellingham' };

	/* What each carrier's tracking numbers look like, for the placeholder
     in the shipping dialog. */
	const TRACKING_EXAMPLES = {
		UPS: '1Z4F89600358812046',
		FedEx: '778144209952',
		USPS: '9400111899223817460021',
		'DHL Express': '4417920563',
	};

	const PAY_TAGS = {
		paid: { tone: 'success', text: 'Paid' },
		due: { tone: 'warning', text: 'Awaiting payment' },
		invoiced: { tone: 'info', text: 'Invoiced' },
		partly: { tone: 'info', text: 'Partly refunded' },
		refunded: { tone: 'info', text: 'Refunded' },
		voided: { tone: '', text: 'Invoice voided' },
	};
	const SHIP_TAGS = {
		unfulfilled: { tone: 'warning', text: 'Waiting to pack' },
		todo: { tone: 'warning', text: 'Not started' },
		packed: { tone: 'primary', text: 'Packed' },
		shipped: { tone: 'primary', text: 'Shipped' },
		delivered: { tone: 'success', text: 'Delivered' },
		canceled: { tone: 'danger', text: 'Canceled' },
	};

	const ACTION_DUPLICATE = { act: 'duplicate', icon: 'bi-copy', label: 'Duplicate order' };
	const ACTION_PAY = { act: 'pay', icon: 'bi-cash-coin', label: 'Record payment' };
	const ACTION_REFUND = { act: 'refund', icon: 'bi-arrow-counterclockwise', label: 'Issue refund' };
	const PAGER_WORDS = { prev: ['Newer order, ', 'No newer order'], next: ['Older order, ', 'No older order'] };

	const catalog = buildCatalog();
	const buyerCache = {};
	const FALLBACK_ID = (shop.ORDERS.find((entry) => entry.status === 'paid') || shop.ORDERS[0]).orderNumber;

	/* The dialogs and the note box, looked up once. */
	const shipDialog = {
		form: pick('[data-od-ship-form]'),
		heading: pick('[data-od-ship-title]'),
		lead: pick('[data-od-ship-sub]'),
		submit: pick('[data-od-ship-go]'),
		notify: pick('[data-od-ship-notify]'),
		notifyLabel: pick('[data-od-ship-notify-label]'),
		carriers: pick('[data-od-carriers]'),
		tracking: pick('[data-od-tracking]'),
		trackingError: pick('[data-od-tracking-error]'),
	};
	const payDialog = {
		form: pick('[data-od-pay-form]'),
		lead: pick('[data-od-pay-sub]'),
		reference: pick('[data-od-pay-ref]'),
		referenceError: pick('[data-od-pay-ref-error]'),
		received: pick('[data-od-pay-date]'),
	};
	const refundDialog = {
		form: pick('[data-od-refund-form]'),
		lead: pick('[data-od-refund-sub]'),
		rows: pick('[data-od-refund-lines]'),
		shipRow: pick('[data-od-refund-ship-wrap]'),
		ship: pick('[data-od-refund-ship]'),
		shipLabel: pick('[data-od-refund-ship-label]'),
		restockRow: pick('[data-od-restock-wrap]'),
		restock: pick('[data-od-restock]'),
		sum: pick('[data-od-refund-sum]'),
		error: pick('[data-od-refund-error]'),
	};
	const cancelDialog = {
		heading: pick('[data-od-cancel-title]'),
		lead: pick('[data-od-cancel-text]'),
		list: pick('[data-od-cancel-list]'),
		proceed: pick('[data-od-cancel-go]'),
	};
	const noteComposer = pick('[data-od-note-form]');
	const noteBox = pick('[data-od-note]');
	const noteError = pick('[data-od-note-error]');
	const historyToggle = pick('[data-od-more]');

	/* Where the page talks to a server. The demo answers from the book
     after a short pause, and keeps whatever it is handed. */
	const backend = {
		/* GET /api/orders/:id */
		load(id) {
			const hit = orders.find((entry) => entry.id === id) || orders.find((entry) => entry.id === FALLBACK_ID);
			return Promise.resolve(deepCopy(hit));
		},
		/* PATCH /api/orders/:id with the whole changed order. */
		save(changed) {
			return settle(150, changed);
		},
	};

	/** Builds the order list, wires every control, then loads the order. */
	function start() {
		orders = [...shop.ORDERS, ...shop.WHOLESALE].map(assemble);

		stage.addEventListener('click', onStageClick);
		historyToggle.addEventListener('click', () => {
			window.Basalt.slide(slot('activity'), () => {
				showWholeHistory = !showWholeHistory;
				paintHistory();
			});
		});

		shipDialog.carriers.addEventListener('change', (event) => {
			if (event.target.name === 'od-carrier')
				shipDialog.tracking.placeholder = `For example ${TRACKING_EXAMPLES[event.target.value]}`;
		});
		shipDialog.tracking.addEventListener('input', () => showTrackingError(''));
		pick('#od-ship').addEventListener('shown.bs.modal', () => shipDialog.tracking.focus());
		shipDialog.form.addEventListener('submit', submitShip);

		payDialog.reference.addEventListener('input', () => showReferenceError(false));
		pick('#od-pay').addEventListener('shown.bs.modal', () => payDialog.reference.focus());
		payDialog.form.addEventListener('submit', submitPayment);

		refundDialog.form.addEventListener('change', () => {
			showRefundError(false);
			paintRefundSum();
		});
		refundDialog.form.addEventListener('input', paintRefundSum);
		refundDialog.form.addEventListener('submit', submitRefund);

		cancelDialog.proceed.addEventListener('click', confirmCancel);

		noteBox.addEventListener('input', () => showNoteError(false));
		noteComposer.addEventListener('submit', submitNote);

		backend.load(new URLSearchParams(location.search).get('id')).then((loaded) => {
			order = loaded;
			paint();
			drawTrail(slot('steps'));
		});
	}

	/**
	 * Grows the done connectors the first time the steps are on screen.
	 * Later repaints show them already drawn.
	 */
	function drawTrail(trail) {
		const lines = pickAll('.od-step.is-done:not(:last-child)', trail);
		if (!lines.length || !window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches)
			return;
		lines.forEach((line, at) => line.style.setProperty('--od-trail-at', at));
		let left = lines.length;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'od-trail-grow' || --left) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				trail.classList.replace('is-waiting', 'is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	/* Copy buttons and action buttons anywhere on the page share one listener. */
	function onStageClick(event) {
		const copier = event.target.closest('[data-od-copy]');
		if (copier) {
			putOnClipboard(copier.getAttribute('data-od-copy'));
			return;
		}
		const trigger = event.target.closest('[data-od-act]');
		if (trigger) doAction(trigger.getAttribute('data-od-act'));
	}

	/* Small lookups and formatters. */

	function pick(selector, scope = stage) {
		return scope.querySelector(selector);
	}
	function pickAll(selector, scope = stage) {
		return [...scope.querySelectorAll(selector)];
	}
	function slot(name) {
		return pick(`[data-od="${name}"]`);
	}
	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
	}
	function notify(options) {
		return window.Basalt.toasts?.push(options);
	}
	function speak(text) {
		window.Basalt.announce?.(text);
	}
	function dialog(id) {
		return bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
	}
	function deepCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}
	function settle(ms, value) {
		return new Promise((resolve) => setTimeout(() => resolve(value), ms));
	}
	function countOf(amount, singular, pluralForm) {
		return `${amount.toLocaleString('en-US')} ${amount === 1 ? singular : pluralForm || `${singular}s`}`;
	}
	function monogram(name) {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.map((word) => word[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	/** Cents as "$1,234.56"; a negative amount gets a proper minus sign. */
	function dollars(cents) {
		const amount = (Math.abs(cents) / 100).toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
		return `${cents < 0 ? '−' : ''}$${amount}`;
	}

	function roundDollars(cents) {
		return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
	}

	function randomDigits(random, count) {
		let out = '';
		while (out.length < count) out += Math.floor(random() * 10);
		return out;
	}

	/** "Earl Baldwin" becomes "M. Baldwin", the way a carrier writes a signature. */
	function signedName(wholeName) {
		const [first, ...rest] = wholeName.split(' ');
		return [`${first[0]}.`, ...rest].join(' ');
	}

	/** "Packed the order" reads as "packed the order" after a name; brand names keep their capital. */
	function softStart(text) {
		if (!/^[A-Z][a-z]/.test(text) || /^(UPS|FedEx|Visa)/.test(text)) return text;
		return text[0].toLowerCase() + text.slice(1);
	}

	/** "a, b and c" from a list of phrases. */
	function listWords(parts) {
		if (parts.length < 2) return parts.join('');
		return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
	}

	function youOr(name) {
		return name === SIGNED_IN ? 'you' : name;
	}

	/* Dates travel as "YYYY-MM-DDTHH:MM" strings and are only turned into
     Date objects for arithmetic. */

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function toStamp(date) {
		const day = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
		return `${day}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
	}

	function fromStamp(text) {
		const [dayPart, timePart = '00:00'] = text.split('T');
		const [year, month, day] = dayPart.split('-').map(Number);
		const [hours, minutes] = timePart.split(':').map(Number);
		return new Date(year, month - 1, day, hours, minutes);
	}

	function demoNow() {
		return new Date(DEMO_CLOCK_START.getTime() + (Date.now() - LOADED_AT));
	}
	function midnight(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	}
	function daysSince(date) {
		return Math.round((midnight(demoNow()) - midnight(date)) / MS_PER_DAY);
	}

	function clockTime(date) {
		const hours = date.getHours();
		return `${hours % 12 || 12}:${twoDigits(date.getMinutes())}${hours < 12 ? ' am' : ' pm'}`;
	}

	function shortDate(text) {
		const date = fromStamp(text);
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function longDate(text) {
		return `${shortDate(text)}, ${fromStamp(text).getFullYear()}`;
	}

	function relativeStamp(text) {
		const date = fromStamp(text);
		const back = daysSince(date);
		const dayWord = { 0: 'Today', 1: 'Yesterday' }[back] || shortDate(text);
		return `${dayWord}, ${clockTime(date)}`;
	}

	/** A stamp pushed on by whole days at a given time of day, or, with no time, by minutes. */
	function shifted(text, amount, timeOfDay) {
		const date = fromStamp(text);
		if (!timeOfDay) return toStamp(new Date(date.getTime() + amount * 60000));
		const [hours, minutes] = timeOfDay.split(':').map(Number);
		return toStamp(new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, hours, minutes));
	}

	function notAfter(first, second) {
		return fromStamp(first) <= fromStamp(second);
	}

	/* The catalog and the buyers, read from the book once and kept. */

	function buildCatalog() {
		const seenInCategory = {};
		const out = {};
		for (const entry of shop.PRODUCTS) {
			const tones = CATEGORY_TONES[entry.category] || [1];
			const position = seenInCategory[entry.category] || 0;
			seenInCategory[entry.category] = position + 1;
			out[entry.sku] = {
				name: entry.name,
				price: entry.price,
				kind: shop.kind(entry.sku),
				icon: entry.icon,
				tone: tones[position % tones.length],
				note: SKU_NOTES[entry.sku],
			};
		}
		return out;
	}

	function product(sku) {
		return catalog[sku];
	}

	/** The buyer behind an order. Shoppers link to Shopper Details; stockists have no page. */
	function buyer(name) {
		if (!buyerCache[name]) {
			const account = shop.customer(name);
			buyerCache[name] = {
				name,
				person: account.buyer,
				email: account.email,
				phone: account.phone,
				memberSince: Number(account.joinedOn.slice(0, 4)),
				tierLabel: TIER_LABEL[account.tier] || '',
				pastOrders: account.orders,
				lifetimeCents: Math.round(account.lifetimeValue * 100),
				hue: account.avatarTone || 1,
				profileUrl:
					account.tier === 'stockist' ? '' : `shopper-details.html?id=${encodeURIComponent(account.id)}`,
			};
		}
		return buyerCache[name];
	}

	function shipRegion(target) {
		return shop.REGIONS[target.region] || shop.REGIONS.na;
	}

	/**
	 * One list order worked out in full. The book's story() says when it
	 * was paid, packed, shipped and delivered; this adds who did each
	 * step, the refunds, the addresses and the history.
	 */
	function assemble(raw) {
		const { customer: buyerName, status, orderNumber } = raw;
		const random = shop.seeded(`${orderNumber}:bill`);
		const account = shop.customer(buyerName);
		const country = shop.COUNTRIES[account.country];
		const who = buyer(buyerName);
		const story = shop.story(raw);
		const { placed: placedAt, goods: hasGoods } = story;
		const shipRule = raw.ship ? shop.SHIPPING[raw.ship] : null;
		const [shipCents, sums, today] = [shop.shipping(raw), shop.sums(raw), shop.NOW];
		const payment = deepCopy(story.payment);
		const fulfil = deepCopy(story.fulfil);
		if (fulfil.packedAt) fulfil.packedBy = STAFF.packer;
		if (fulfil.shippedAt) fulfil.shippedBy = STAFF.packer;

		/* The lines, any refund against them, and the cancellation. */
		const items = raw.lines.map((line) => ({ sku: line.sku, qty: line.qty, qtyRefunded: 0 }));
		const refunds = [];
		let cancellation = null;
		if (raw.refund) {
			for (const part of raw.refund.lines) items.find((line) => line.sku === part.sku).qtyRefunded += part.qty;
			refunds.push({
				at: `${raw.refund.date}T10:15`,
				by: STAFF.helpdesk,
				reason: raw.refund.reason,
				picks: deepCopy(raw.refund.lines),
				withShipping: false,
				cents: sums.refunded,
			});
		}
		if (status === 'canceled') {
			cancellation = { at: shifted(placedAt, 180), by: STAFF.helpdesk, reason: raw.cancel || '' };
			if (payment.paidAt) {
				for (const line of items) line.qtyRefunded = line.qty;
				refunds.push({
					at: cancellation.at,
					by: STAFF.helpdesk,
					reason: 'Order canceled',
					picks: raw.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
					withShipping: true,
					cents: sums.total,
				});
			}
		}

		/* Flagship accounts bill to a PO box; everyone else bills where they ship. */
		const shipTo = [buyerName, who.phone, ...account.address, country];
		const billsApart = shop.CUSTOMERS.some((entry) => entry.name === buyerName && entry.tier === 'flagship');
		const billTo = billsApart
			? [buyerName, who.email, `PO Box ${randomDigits(random, 4)}`, account.address[1], country]
			: null;

		/* The history, oldest first; nothing dated after today is kept. */
		const history = [];
		const record = (at, actor, icon, text) => {
			if (notAfter(at, today)) history.push({ at, actor, icon, text });
		};
		record(
			placedAt,
			who.person,
			'bi-bag-check',
			raw.channel === 'wholesale'
				? 'Placed a wholesale order'
				: `Placed the order${raw.discount ? ` with code ${raw.discount}` : ''}`,
		);
		if (payment.kind === 'card') {
			if (payment.paidAt)
				record(
					placedAt,
					'Marlo shop',
					'bi-credit-card',
					`Charged ${dollars(sums.total)} to the ${payment.brand} ending ${payment.last4}`,
				);
			else
				record(shifted(placedAt, 1), 'Marlo shop', 'bi-link-45deg', `Sent a card payment link to ${who.email}`);
			if (payment.declinedAt)
				record(
					payment.declinedAt,
					'Marlo shop',
					'bi-x-circle',
					`Could not charge the ${payment.brand} ending ${payment.last4}: the bank declined it`,
				);
		} else {
			record(
				shifted(placedAt, 1),
				'Marlo shop',
				'bi-receipt',
				`Sent invoice ${payment.invoice}, ${payment.terms}`,
			);
			if (payment.paidAt)
				record(
					payment.paidAt,
					STAFF.helpdesk,
					'bi-cash-coin',
					`Recorded ${payment.method === 'Gift card' ? 'a gift card payment' : 'a bank transfer'} of ${dollars(sums.total)}`,
				);
		}
		const giftLine = raw.lines.find((line) => line.sku === 'ML-GIFT250');
		if (giftLine && (payment.paidAt || payment.terms === 'Pay in 30 days') && !cancellation) {
			record(
				shifted(payment.paidAt || placedAt, 2),
				'Marlo shop',
				'bi-chat-dots',
				`Emailed ${countOf(giftLine.qty, 'e-gift card')} to the customer`,
			);
		}
		if (fulfil.packedAt) record(fulfil.packedAt, STAFF.packer, 'bi-box-seam', 'Packed the order');
		if (fulfil.shippedAt) {
			record(
				fulfil.shippedAt,
				STAFF.packer,
				'bi-truck',
				`Shipped with ${fulfil.carrier}, tracking ${fulfil.tracking}`,
			);
			record(
				shifted(fulfil.shippedAt, 1),
				'Marlo shop',
				'bi-envelope',
				`Emailed the tracking link to ${who.person}`,
			);
		}
		if (fulfil.deliveredAt && hasGoods) {
			record(
				fulfil.deliveredAt,
				fulfil.carrier,
				'bi-house-check',
				`Delivered, signed for by ${signedName(who.person)}`,
			);
		} else if (fulfil.deliveredAt) {
			const ranSession = raw.lines.some((line) => shop.kind(line.sku) === 'service');
			record(
				fulfil.deliveredAt,
				STAFF.helpdesk,
				'bi-check2-circle',
				ranSession ? 'Marked the session as run' : 'Marked the order as done',
			);
		}
		const notes = [];
		if (raw.refund) {
			const firstPart = raw.refund.lines[0];
			const complaint = countOf(firstPart.qty, product(firstPart.sku).name.toLowerCase()).replace(/^1 /, 'a ');
			record(
				shifted(refunds[0].at, -1, '16:05'),
				who.person,
				'bi-chat-left-text',
				`Reported a problem with ${complaint}`,
			);
			record(
				refunds[0].at,
				STAFF.helpdesk,
				'bi-arrow-counterclockwise',
				`Refunded ${dollars(refunds[0].cents)} for ${raw.refund.lines.map((part) => `${part.qty} ${product(part.sku).name}`).join(', ')}`,
			);
			if (raw.refund.note) {
				notes.push({ at: shifted(refunds[0].at, 3), author: STAFF.helpdesk, text: raw.refund.note });
				record(shifted(refunds[0].at, 3), STAFF.helpdesk, 'bi-sticky', 'Added a note');
			}
		}
		if (cancellation) {
			record(cancellation.at, STAFF.helpdesk, 'bi-x-octagon', 'Canceled the order');
			if (payment.paidAt)
				record(
					cancellation.at,
					'Marlo shop',
					'bi-arrow-counterclockwise',
					`Refunded ${dollars(sums.total)} to the ${payment.brand} ending ${payment.last4}`,
				);
			else record(cancellation.at, 'Marlo shop', 'bi-receipt', `Voided invoice ${payment.invoice}`);
		}
		history.sort((left, right) => fromStamp(left.at) - fromStamp(right.at));

		const promo = raw.discount ? shop.DISCOUNTS[raw.discount] : null;
		const onHold = raw.paymentMethod === 'card' && status === 'placed';
		const declinedNote = payment.declinedAt ? `The card was declined on ${shortDate(payment.declinedAt)}. ` : '';
		return {
			id: orderNumber,
			buyerName,
			placedAt,
			region: story.region,
			site: SITE_NAMES[story.site],
			items,
			promo: promo ? { code: raw.discount, label: promo.label } : null,
			delivery: {
				method: raw.ship || '',
				cents: shipCents,
				note: shipRule && shipRule.freeOver && !shipCents ? `Free over $${shipRule.freeOver}` : '',
				refunded: Boolean(cancellation && payment.paidAt),
			},
			tax: deepCopy(shop.TAX[raw.tax]),
			shipTo,
			billTo,
			payment,
			holdNote: onHold ? `${declinedNote}Waiting for ${who.person} to pay by card. It ships once paid.` : '',
			fulfil,
			refunds,
			cancellation,
			notes,
			history,
			listTotal: Math.round(raw.total * 100),
		};
	}

	/* Money, all in cents. */

	function taxed(target, kind) {
		return target.tax.on.includes(kind);
	}
	function taxOf(target, base) {
		return Math.round((base * target.tax.rate) / 100000);
	}

	/** A line priced by the book's rules under the order's promo code. */
	function lineMoney(target, line) {
		return shop.line({ discount: target.promo ? target.promo.code : null }, line);
	}

	function orderTotals(target) {
		let subtotal = 0;
		let promoOff = 0;
		let taxable = 0;
		for (const line of target.items) {
			const priced = lineMoney(target, line);
			subtotal += priced.gross;
			promoOff += priced.off;
			if (taxed(target, priced.kind)) taxable += priced.net;
		}
		const shipping = target.delivery.cents;
		if (taxed(target, 'shipping')) taxable += shipping;
		const tax = taxOf(target, taxable);
		const total = subtotal - promoOff + shipping + tax;
		const refunded = target.refunds.reduce((sum, entry) => sum + entry.cents, 0);
		return { subtotal, promoOff, shipping, tax, total, refunded, net: total - refunded };
	}

	/** What giving back these quantities, plus the shipping if asked, adds up to. */
	function refundMoney(target, picks, withShipping) {
		let goods = 0;
		let taxable = 0;
		for (const chosen of picks) {
			const line = target.items.find((entry) => entry.sku === chosen.sku);
			const priced = lineMoney(target, line);
			const share = Math.round((priced.net * chosen.qty) / line.qty);
			goods += share;
			if (taxed(target, priced.kind)) taxable += share;
		}
		const ship = withShipping ? target.delivery.cents : 0;
		if (ship && taxed(target, 'shipping')) taxable += ship;
		const tax = taxOf(target, taxable);
		return { goods, ship, tax, cents: goods + ship + tax };
	}

	/* Where the order stands, as two words the badges and actions read. */

	function payStatus(target, totals) {
		if (!target.payment.paidAt) {
			if (target.cancellation) return 'voided';
			return target.payment.terms === 'Pay in 30 days' ? 'invoiced' : 'due';
		}
		if (totals.refunded >= totals.total) return 'refunded';
		return totals.refunded > 0 ? 'partly' : 'paid';
	}

	function shipStatus(target) {
		if (target.cancellation) return 'canceled';
		if (target.fulfil.deliveredAt) return 'delivered';
		if (!needsShipping(target)) return 'todo';
		if (target.fulfil.shippedAt) return 'shipped';
		return target.fulfil.packedAt ? 'packed' : 'unfulfilled';
	}

	function needsShipping(target) {
		return target.items.some((line) => product(line.sku).kind === 'goods');
	}

	function canStillRefund(target) {
		const unitsLeft = target.items.reduce((sum, line) => sum + (line.qty - (line.qtyRefunded || 0)), 0);
		return unitsLeft > 0 || (target.delivery.cents > 0 && !target.delivery.refunded);
	}

	function paymentName(target) {
		const pay = target.payment;
		return pay.kind === 'card' ? `${pay.brand} ending ${pay.last4}` : pay.method || 'Invoice';
	}

	function tag({ tone, text }) {
		return `<span class="basalt-status${tone ? ` basalt-status-${tone}` : ''} basalt-status-dot">${text}</span>`;
	}

	/** A canceled card order that was never paid was never charged either. */
	function payTag(status) {
		const unpaidCard = status === 'voided' && !order.payment.invoice;
		return tag(unpaidCard ? { tone: '', text: 'Not charged' } : PAY_TAGS[status]);
	}

	function copyButton(text, label) {
		return `<button data-od-copy="${htmlSafe(text)}" aria-label="${htmlSafe(label)}" type="button" class="btn btn-icon btn-sm od-copy"><i class="bi bi-copy" aria-hidden="true"></i></button>`;
	}

	/* Drawing the page. paint() redoes every card from the order in hand. */

	function paint() {
		const who = buyer(order.buyerName);
		const totals = orderTotals(order);
		const [pay, ship] = [payStatus(order, totals), shipStatus(order)];

		document.title = `Order ${order.id} · Basalt`;
		slot('title').textContent = `Order ${order.id}`;
		slot('sub').textContent =
			`Placed ${longDate(order.placedAt)} at ${clockTime(fromStamp(order.placedAt))} · ${who.name}`;
		slot('tags').innerHTML = payTag(pay) + tag(SHIP_TAGS[ship]);

		paintActions(pay, ship);
		paintPager();
		paintNotice(pay, ship);
		paintItems(totals);
		paintSteps(pay, ship);
		paintBuyer(who);
		paintPayment(totals, pay);
		paintAddresses();
		paintNotes();
		paintHistory();
	}

	/** The single next step for this order; the first match wins. */
	function nextAction(pay, ship) {
		const choices = [
			[ship === 'canceled' || pay === 'refunded', ACTION_DUPLICATE],
			[pay === 'due', ACTION_PAY],
			[ship === 'unfulfilled', { act: 'pack', icon: 'bi-box-seam', label: 'Mark as packed' }],
			[ship === 'todo', { act: 'deliver', icon: 'bi-check2-circle', label: 'Mark as delivered' }],
			[ship === 'packed', { act: 'ship', icon: 'bi-truck', label: 'Mark as shipped' }],
			[ship === 'shipped', { act: 'deliver', icon: 'bi-house-check', label: 'Mark as delivered' }],
			[pay === 'invoiced', ACTION_PAY],
			[canStillRefund(order), ACTION_REFUND],
		];
		const winner = choices.find(([applies]) => applies);
		return winner ? winner[1] : ACTION_DUPLICATE;
	}

	/* The header shows the one next step as a button; everything else waits in the "…" menu. */
	function paintActions(pay, ship) {
		const primary = pick('[data-od-primary]');
		const next = nextAction(pay, ship);
		primary.hidden = false;
		primary.setAttribute('data-od-act', next.act);
		primary.innerHTML = `<i class="bi ${next.icon} me-1" aria-hidden="true"></i>${next.label}`;

		const menuRow = ({ act, icon, label }, extraClass) =>
			`<li><button data-od-act="${act}" type="button" class="dropdown-item${extraClass ? ` ${extraClass}` : ''}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</button></li>`;
		const invoiceNumber = order.payment.invoice;
		const menuItems = invoiceNumber
			? [
					`<li><a href="invoice-details.html?id=${encodeURIComponent(invoiceNumber)}" class="dropdown-item"><i class="bi bi-printer" aria-hidden="true"></i>Print invoice</a></li>`,
				]
			: [];
		if (next.act !== 'duplicate') menuItems.push(menuRow(ACTION_DUPLICATE));
		menuItems.push(menuRow({ act: 'link', icon: 'bi-link-45deg', label: 'Copy order link' }));
		const refundable = (pay === 'paid' || pay === 'partly') && ship !== 'canceled' && canStillRefund(order);
		if (refundable && next.act !== 'refund') menuItems.push(menuRow(ACTION_REFUND));
		if (pay === 'invoiced' && next.act !== 'pay') menuItems.push(menuRow(ACTION_PAY));
		if (['unfulfilled', 'packed', 'todo'].includes(ship)) {
			menuItems.push(
				'<li><hr class="dropdown-divider"></li>',
				menuRow({ act: 'cancel', icon: 'bi-x-octagon', label: 'Cancel order' }, 'od-danger-item'),
			);
		}
		slot('menu').innerHTML = menuItems.join('');
	}

	/* The arrows step to the order before and after this one in the book. */
	function paintPager() {
		const index = orders.findIndex((entry) => entry.id === order.id);
		const neighbors = { prev: orders[index - 1], next: orders[index + 1] };
		for (const [side, other] of Object.entries(neighbors)) {
			const link = slot(side);
			const [someLabel, noneLabel] = PAGER_WORDS[side];
			link.href = `order-details.html?id=${encodeURIComponent(other ? other.id : order.id)}`;
			link.classList.toggle('disabled', !other);
			link.setAttribute('aria-label', other ? someLabel + other.id : noneLabel);
			if (other) {
				link.removeAttribute('aria-disabled');
				link.removeAttribute('tabindex');
			} else {
				link.setAttribute('aria-disabled', 'true');
				link.setAttribute('tabindex', '-1');
			}
		}
	}

	/* One quiet line explaining a held or canceled order; hidden otherwise. */
	function paintNotice(pay, ship) {
		const notice = slot('notice');
		let tone = '';
		let icon = 'bi-info-circle';
		let text = '';
		if (ship === 'canceled') {
			tone = 'danger';
			icon = 'bi-x-octagon';
			const why = order.cancellation.reason ? ` ${order.cancellation.reason}` : '';
			text = `Canceled ${longDate(order.cancellation.at)} by ${youOr(order.cancellation.by)}.${why}`;
		} else if (pay === 'due' && order.holdNote) {
			tone = 'warning';
			icon = 'bi-hourglass-split';
			text = order.holdNote;
		}
		notice.hidden = !text;
		notice.className = `od-notice${tone ? ` od-notice-${tone}` : ''}`;
		notice.innerHTML = text ? `<i class="bi ${icon}" aria-hidden="true"></i><span>${htmlSafe(text)}</span>` : '';
	}

	function paintItems(totals) {
		const units = order.items.reduce((sum, line) => sum + line.qty, 0);
		slot('items-desc').textContent = `${countOf(order.items.length, 'product')}, ${countOf(units, 'unit')} in all.`;
		slot('lines').innerHTML = order.items.map(itemRow).join('');

		const totalRow = (label, note, value, extraClass) =>
			`<div${extraClass ? ` class="${extraClass}"` : ''}><dt>${label}${note ? `<small>${htmlSafe(note)}</small>` : ''}</dt><dd>${value}</dd></div>`;
		const rows = [totalRow('Subtotal', '', dollars(totals.subtotal))];
		if (order.promo) {
			const codePrefix = order.promo.code === 'STOCKIST' ? '' : `${order.promo.code}, `;
			rows.push(totalRow('Discount', codePrefix + order.promo.label, dollars(-totals.promoOff)));
		}
		const shipNote = order.delivery.note ? `, ${order.delivery.note.toLowerCase()}` : '';
		rows.push(
			totalRow(
				'Shipping',
				order.delivery.method + shipNote,
				order.delivery.cents ? dollars(totals.shipping) : 'Free',
			),
		);
		rows.push(totalRow('Tax', order.tax.label, dollars(totals.tax)));
		rows.push(totalRow('Total', '', dollars(totals.total), 'od-totals-total'));
		if (totals.refunded) {
			const howMany = order.refunds.length > 1 ? countOf(order.refunds.length, 'refund') : '';
			rows.push(totalRow('Refunded', howMany, dollars(-totals.refunded), 'od-totals-refund'));
			rows.push(totalRow('Net payment', '', dollars(totals.net), 'od-totals-net'));
		}
		slot('totals').innerHTML = rows.join('');
	}

	/** One table row: the product with its notes, then SKU, unit price, quantity and line total. */
	function itemRow(line) {
		const entry = product(line.sku);
		const priced = lineMoney(order, line);
		const unitPrice = dollars(entry.price * 100);
		let remark = '';
		if (line.qtyRefunded) {
			remark = `<span class="od-product-note od-product-note-refund">${line.qtyRefunded === line.qty ? 'Refunded' : `${line.qtyRefunded} of ${line.qty} refunded`}</span>`;
		} else if (entry.note) {
			remark = `<span class="od-product-note">${htmlSafe(entry.note)}</span>`;
		}
		const icon = `<span aria-hidden="true" class="od-product-icon" style="--od-tone:var(--basalt-series-${entry.tone})"><i class="bi ${entry.icon}"></i></span>`;
		const text = `<span class="od-product-text"><span class="od-product-name">${htmlSafe(entry.name)}</span><span class="od-product-note od-fold">${line.sku} · ${unitPrice} each</span>${remark}</span>`;
		return `<tr><td><span class="od-product">${icon}${text}</span></td><td class="od-col-sku"><span class="od-sku">${line.sku}</span></td><td class="od-col-unit text-end">${unitPrice}</td><td class="text-end od-qty">${line.qty}</td><td class="text-end od-line-total">${dollars(priced.gross)}</td></tr>`;
	}

	/* Placed, paid, packed, shipped, delivered, drawn as a row of markers
     with the parcel underneath once there is a tracking number. */
	function paintSteps(pay, ship) {
		const fulfil = order.fulfil;
		const pays = order.payment;
		const who = buyer(order.buyerName);
		let steps = [{ key: 'placed', label: 'Placed', at: order.placedAt, line: `By ${youOr(who.person)}` }];
		if (pays.paidAt) {
			const brandWord = pays.brand === 'American Express' ? 'Amex' : pays.brand;
			steps.push({
				key: 'paid',
				label: 'Paid',
				at: pays.paidAt,
				line: pays.kind === 'card' ? `${brandWord} ·· ${pays.last4}` : pays.method || 'Invoice',
			});
		} else {
			const unpaidWord = pays.invoice ? 'Invoice voided' : 'Not paid';
			steps.push({
				key: 'paid',
				label: 'Paid',
				line: order.cancellation ? unpaidWord : `Due ${shortDate(pays.dueAt)}`,
			});
		}
		if (ship === 'canceled') {
			steps.push({
				key: 'canceled',
				label: 'Canceled',
				at: order.cancellation.at,
				line: `By ${youOr(order.cancellation.by)}`,
				stopped: true,
			});
		} else if (!needsShipping(order)) {
			const isSession = order.items.some((line) => product(line.sku).kind === 'service');
			steps.push({
				key: 'delivered',
				label: 'Delivered',
				at: fulfil.deliveredAt,
				line: fulfil.deliveredAt ? (isSession ? 'Session run' : 'Sent by email') : 'Not yet',
			});
		} else {
			const packedLine = fulfil.packedAt
				? `By ${youOr(fulfil.packedBy)}`
				: pay === 'due'
					? 'Once paid'
					: `${order.site} warehouse`;
			const deliveredLine = fulfil.deliveredAt
				? `${fulfil.carrier} confirmed`
				: fulfil.expected
					? `Expected ${shortDate(fulfil.expected)}`
					: 'Not yet';
			steps.push({ key: 'packed', label: 'Packed', at: fulfil.packedAt, line: packedLine });
			steps.push({
				key: 'shipped',
				label: 'Shipped',
				at: fulfil.shippedAt,
				line: fulfil.shippedAt ? fulfil.carrier : 'Not yet',
			});
			steps.push({ key: 'delivered', label: 'Delivered', at: fulfil.deliveredAt, line: deliveredLine });
		}
		/* On invoice terms the goods leave first and the money arrives
       later, so the payment step moves to the end. */
		if (pays.terms === 'Pay in 30 days' && ship !== 'canceled') {
			const [placedStep, paidStep, ...rest] = steps;
			steps = [placedStep, ...rest, paidStep];
		}

		let nextFound = ship === 'canceled';
		const list = slot('steps');
		list.style.setProperty('--od-count', steps.length);
		list.innerHTML = steps
			.map((step, index) => {
				const done = Boolean(step.at);
				let classes = done ? 'is-done' : 'is-todo';
				if (step.stopped) classes = 'is-done is-stopped';
				if (!done && !nextFound) {
					classes = 'is-todo is-next';
					nextFound = true;
				}
				if (justChangedStep === step.key) classes += ' is-fresh';
				const marker = step.stopped
					? '<i class="bi bi-x-lg" aria-hidden="true"></i>'
					: done
						? '<i class="bi bi-check-lg" aria-hidden="true"></i>'
						: String(index + 1);
				const spoken = step.stopped
					? ''
					: done
						? ', done'
						: classes.includes('is-next')
							? ', next'
							: ', not yet';
				const when = `${step.at ? relativeStamp(step.at) : ''}${step.at && step.line ? '<br>' : ''}${htmlSafe(step.line || '')}`;
				return `<li class="od-step ${classes}"><span aria-hidden="true" class="od-step-marker">${marker}</span><span class="od-step-text"><span class="od-step-label">${step.label}<span class="visually-hidden">${spoken}</span></span><span class="od-step-when">${when}</span></span></li>`;
			})
			.join('');
		justChangedStep = null;

		slot('fulfil-desc').textContent = {
			unfulfilled:
				pay === 'due'
					? 'On hold until the order is paid.'
					: `Waiting to be packed at the ${order.site} warehouse.`,
			todo:
				pay === 'due' ? 'Starts once the order is paid.' : 'Nothing to ship; marked delivered once it is done.',
			packed: 'Packed and waiting for the carrier.',
			shipped: `On its way with ${fulfil.carrier}${fulfil.expected ? `, expected ${shortDate(fulfil.expected)}.` : '.'}`,
			delivered: `${needsShipping(order) ? 'Delivered ' : 'Done '}${longDate(fulfil.deliveredAt || order.placedAt)}.`,
			canceled: 'Stopped before it left the warehouse.',
		}[ship];

		const parcel = slot('parcel');
		parcel.hidden = !fulfil.tracking;
		parcel.innerHTML = fulfil.tracking ? parcelMarkup(fulfil, ship) : '';
	}

	/** The carrier, the service, the tracking number with a copy button, and an edit button while it is still in transit. */
	function parcelMarkup(fulfil, ship) {
		const service = order.delivery.method.replace(/^(UPS|FedEx|DHL Express|USPS) /, '');
		const editButton =
			ship === 'shipped'
				? '<button data-od-act="tracking" type="button" class="btn btn-outline-secondary btn-sm"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit tracking</button>'
				: '';
		return `<span aria-hidden="true" class="od-parcel-icon"><i class="bi bi-box-seam"></i></span><span class="od-parcel-text"><span class="od-parcel-carrier">${htmlSafe(fulfil.carrier)}, ${htmlSafe(service)}</span><span class="od-parcel-track">Tracking <span class="od-sku">${htmlSafe(fulfil.tracking)}</span>${copyButton(fulfil.tracking, 'Copy the tracking number')}</span></span>${editButton}`;
	}

	function paintBuyer(who) {
		const metaLine = [who.tierLabel, `customer since ${who.memberSince}`].filter(Boolean).join(' · ');
		slot('who').innerHTML =
			`<span aria-hidden="true" class="od-who-mark" style="--od-tone:var(--basalt-series-${who.hue})">${monogram(who.name)}</span><span class="od-who-text"><span class="od-who-name">${htmlSafe(who.name)}</span><span class="od-who-meta">${htmlSafe(metaLine)}</span></span>`;
		const link = slot('customer-link');
		link.hidden = !who.profileUrl;
		if (who.profileUrl) link.href = who.profileUrl;
		slot('customer').innerHTML = factRows([
			['Contact', htmlSafe(who.person)],
			['Email', `<span>${htmlSafe(who.email)}</span>${copyButton(who.email, 'Copy the email address')}`],
			['Phone', `<span>${htmlSafe(who.phone)}</span>${copyButton(who.phone, 'Copy the phone number')}`],
			[
				'Past orders',
				who.pastOrders
					? `${countOf(who.pastOrders, 'order')} since ${who.memberSince}`
					: 'None, this is their first',
			],
			['Total spend', who.lifetimeCents ? roundDollars(who.lifetimeCents) : '$0'],
		]);
	}

	function factRows(pairs) {
		return pairs.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
	}

	function paintPayment(totals, pay) {
		const pays = order.payment;
		const byCard = pays.kind === 'card';
		let metaLine;
		if (byCard)
			metaLine =
				pay === 'refunded'
					? 'Charged, then refunded in full'
					: pays.paidAt
						? 'Charged when the order was placed'
						: order.cancellation
							? 'Never charged'
							: 'Payment link sent, not paid yet';
		else if (pays.paidAt) metaLine = `Invoice ${pays.invoice}, ${pays.terms}`;
		else metaLine = order.cancellation ? `Invoice ${pays.invoice}, voided` : `${pays.terms}, not paid yet`;
		const icon = byCard ? 'bi-credit-card' : pays.paidAt ? 'bi-bank' : 'bi-receipt';
		const name = byCard ? paymentName(order) : pays.paidAt ? pays.method : `Invoice ${pays.invoice}`;
		slot('method').innerHTML =
			`<span aria-hidden="true" class="od-method-icon"><i class="bi ${icon}"></i></span><span class="od-method-text"><span class="od-method-name">${htmlSafe(name)}</span><span class="od-method-meta">${htmlSafe(metaLine)}</span></span>`;

		const facts = [['Status', payTag(pay)]];
		if (pays.paidAt) facts.push(['Paid on', longDate(pays.paidAt)]);
		else if (!order.cancellation) facts.push(['Due', longDate(pays.dueAt)]);
		facts.push(['Amount', dollars(totals.total)]);
		if (totals.refunded) {
			const lastRefund = order.refunds[order.refunds.length - 1];
			facts.push(['Refunded', dollars(totals.refunded) + (lastRefund ? ` on ${shortDate(lastRefund.at)}` : '')]);
		}
		if (pays.ref)
			facts.push([
				'Reference',
				`<span class="od-sku">${htmlSafe(pays.ref)}</span>${copyButton(pays.ref, 'Copy the payment reference')}`,
			]);
		else if (pays.invoice)
			facts.push([
				'Invoice',
				`<span class="od-sku">${htmlSafe(pays.invoice)}</span>${copyButton(pays.invoice, 'Copy the invoice number')}`,
			]);
		slot('payment').innerHTML = factRows(facts);
	}

	function paintAddresses() {
		const block = (title, lines) => {
			const body = lines
				? `<address class="od-address"><strong>${htmlSafe(lines[0])}</strong><br>${lines.slice(1).map(htmlSafe).join('<br>')}</address>`
				: '<p class="od-address od-address-same">Same as shipping</p>';
			return `<section aria-label="${title} address"><h3 class="od-sub">${title}</h3>${body}</section>`;
		};
		slot('addresses').innerHTML = block('Shipping', order.shipTo) + block('Billing', order.billTo);
	}

	function paintNotes() {
		const newestFirst = [...order.notes].reverse();
		slot('notes').innerHTML = newestFirst
			.map(
				(entry) =>
					`<li class="od-note${entry.isNew ? ' is-fresh' : ''}"><p class="od-note-text">${htmlSafe(entry.text)}</p><span class="od-note-by">${htmlSafe(entry.author === SIGNED_IN ? 'You' : entry.author)} · ${relativeStamp(entry.at)}</span></li>`,
			)
			.join('');
		for (const entry of order.notes) delete entry.isNew;
	}

	function paintHistory() {
		const newestFirst = [...order.history].reverse();
		const shown = showWholeHistory ? newestFirst : newestFirst.slice(0, HISTORY_PREVIEW);
		slot('activity').innerHTML = shown
			.map(
				(entry) =>
					`<li class="od-feed-item${entry.isNew ? ' is-fresh' : ''}"><span aria-hidden="true" class="od-feed-icon"><i class="bi ${entry.icon}"></i></span><span class="od-feed-text"><span><strong>${htmlSafe(entry.actor === SIGNED_IN ? 'You' : entry.actor)}</strong> ${htmlSafe(softStart(entry.text))}</span><time class="od-feed-time" datetime="${entry.at}">${relativeStamp(entry.at)}</time></span></li>`,
			)
			.join('');
		historyToggle.hidden = newestFirst.length <= HISTORY_PREVIEW;
		historyToggle.textContent = showWholeHistory ? 'Show fewer' : `See all ${newestFirst.length}`;
		historyToggle.setAttribute('aria-expanded', String(showWholeHistory));
	}

	/* Changing the order. perform() runs a change, redraws, saves it and
     offers Undo; a failed save puts the order back as it was. */

	function logEvent(icon, text) {
		order.history.push({ at: toStamp(demoNow()), actor: SIGNED_IN, icon, text, isNew: true });
	}

	function perform({ run, title, detail, icon }) {
		const snapshot = deepCopy(order);
		run();
		paint();
		speak(title);
		const handle = notify({
			tone: 'success',
			icon: icon || 'bi-check2-circle',
			title,
			text: detail || '',
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick() {
						order = snapshot;
						paint();
						speak('Undone.');
						backend.save(order);
					},
				},
			],
		});
		return backend.save(order).catch(() => {
			handle?.dismiss();
			order = snapshot;
			paint();
			notify({
				tone: 'danger',
				title: 'That didn’t save',
				text: 'Nothing was changed. Check your connection and try again.',
			});
		});
	}

	/* Each data-od-act value maps to one of these. */
	const ACTIONS = {
		pack() {
			perform({
				run() {
					order.fulfil.packedAt = toStamp(demoNow());
					order.fulfil.packedBy = SIGNED_IN;
					justChangedStep = 'packed';
					logEvent('bi-box-seam', 'Packed the order');
				},
				title: `Order ${order.id} packed`,
				detail: 'Next, add the tracking number when the label is printed.',
				icon: 'bi-box-seam',
			});
		},
		deliver() {
			const who = buyer(order.buyerName);
			const physical = needsShipping(order);
			perform({
				run() {
					order.fulfil.deliveredAt = toStamp(demoNow());
					justChangedStep = 'delivered';
					logEvent(physical ? 'bi-house-check' : 'bi-check2-circle', 'Marked the order as delivered');
				},
				title: 'Marked as delivered',
				detail: physical
					? `${who.person} gets a short email asking if everything arrived in good shape.`
					: `${who.person} gets an email to say it is done.`,
				icon: 'bi-house-check',
			});
		},
		ship: () => openShipDialog(false),
		tracking: () => openShipDialog(true),
		pay: openPayDialog,
		refund: openRefundDialog,
		cancel: openCancelDialog,
		duplicate() {
			const who = buyer(order.buyerName);
			const earlierCopies = order.history.filter((entry) => /^Duplicated/.test(entry.text)).length;
			const draftId = `FS-${20396 + earlierCopies}`;
			perform({
				run() {
					logEvent('bi-copy', `Duplicated the order as draft ${draftId}`);
				},
				title: `Draft ${draftId} created`,
				detail: `Same items and addresses for ${who.name}, ready to edit before it is sent.`,
				icon: 'bi-copy',
			});
		},
		link() {
			putOnClipboard(`${location.origin}${location.pathname}?id=${order.id}`, `Link to ${order.id} copied`);
		},
	};

	function doAction(name) {
		ACTIONS[name]?.();
	}

	function putOnClipboard(text, title) {
		const confirm = () =>
			notify({ tone: 'success', icon: 'bi-copy', title: title || `Copied ${text}`, duration: 2400 });
		if (window.Basalt.copyText) window.Basalt.copyText(text).then(confirm);
		else confirm();
	}

	/** Marks a field invalid for the eye and for assistive tech, or clears it. */
	function flagField(field, invalid) {
		field.classList.toggle('is-invalid', invalid);
		if (invalid) field.setAttribute('aria-invalid', 'true');
		else field.removeAttribute('aria-invalid');
	}

	/* Mark as shipped, or change the tracking on an order already on its way. */

	function openShipDialog(editing) {
		editingTracking = editing;
		const who = buyer(order.buyerName);
		const carrierNames = shipRegion(order).carriers;
		const picked = editing
			? order.fulfil.carrier
			: carrierNames.find((name) => order.delivery.method.startsWith(name)) || carrierNames[0];
		shipDialog.heading.textContent = editing ? 'Edit tracking' : `Mark ${order.id} as shipped`;
		shipDialog.lead.textContent = editing
			? 'Fix a mistyped number or a change of carrier.'
			: 'Add the carrier and tracking number from the label.';
		shipDialog.submit.textContent = editing ? 'Save tracking' : 'Mark as shipped';
		shipDialog.notifyLabel.textContent = `Email the tracking link to ${who.person}`;
		shipDialog.notify.checked = true;
		const choices = carrierNames.map(
			(name) =>
				`<label class="basalt-choice"><input type="radio" name="od-carrier" value="${htmlSafe(name)}"${name === picked ? ' checked' : ''}><i class="bi bi-truck" aria-hidden="true"></i>${htmlSafe(name)}</label>`,
		);
		shipDialog.carriers.innerHTML = `<legend>Carrier</legend>${choices.join('')}`;
		shipDialog.tracking.value = editing ? order.fulfil.tracking : '';
		shipDialog.tracking.placeholder = `For example ${TRACKING_EXAMPLES[picked]}`;
		showTrackingError('');
		dialog('od-ship').show();
	}

	function showTrackingError(message) {
		shipDialog.trackingError.textContent = message;
		shipDialog.trackingError.hidden = !message;
		flagField(shipDialog.tracking, Boolean(message));
	}

	function submitShip(event) {
		event.preventDefault();
		const carrier = pick('input[name="od-carrier"]:checked')?.value;
		const tracking = shipDialog.tracking.value.replace(/\s+/g, '').toUpperCase();
		const problem = !tracking
			? 'Add the tracking number from the label.'
			: !/^[A-Z0-9]{8,34}$/.test(tracking)
				? 'That doesn’t look like a tracking number. Use letters and digits only.'
				: '';
		if (problem) {
			showTrackingError(problem);
			shipDialog.tracking.focus();
			return;
		}
		const tellBuyer = shipDialog.notify.checked;
		const who = buyer(order.buyerName);
		dialog('od-ship').hide();
		if (editingTracking) {
			perform({
				run() {
					order.fulfil.carrier = carrier;
					order.fulfil.tracking = tracking;
					logEvent('bi-pencil', `Changed the tracking to ${carrier} ${tracking}`);
					if (tellBuyer) logEvent('bi-envelope', `Emailed the new tracking link to ${who.person}`);
				},
				title: 'Tracking updated',
				detail: tellBuyer ? `${who.person} gets the new link by email.` : 'The customer wasn’t emailed.',
				icon: 'bi-truck',
			});
			return;
		}
		perform({
			run() {
				const moment = demoNow();
				order.fulfil.shippedAt = toStamp(moment);
				order.fulfil.shippedBy = SIGNED_IN;
				order.fulfil.carrier = carrier;
				order.fulfil.tracking = tracking;
				order.fulfil.expected = toStamp(
					new Date(moment.getFullYear(), moment.getMonth(), moment.getDate() + shipRegion(order).transit),
				);
				justChangedStep = 'shipped';
				logEvent('bi-truck', `Shipped with ${carrier}, tracking ${tracking}`);
				if (tellBuyer) logEvent('bi-envelope', `Emailed the tracking link to ${who.person}`);
			},
			title: `Order ${order.id} shipped`,
			detail: tellBuyer ? `${who.person} gets the tracking link by email.` : 'The customer wasn’t emailed.',
			icon: 'bi-truck',
		});
	}

	/* Record a payment that arrived outside the store. */

	function openPayDialog() {
		const totals = orderTotals(order);
		const onInvoice = order.payment.invoice ? ` on invoice ${order.payment.invoice}` : '';
		const today = toStamp(demoNow()).slice(0, 10);
		payDialog.lead.textContent = `${dollars(totals.total)}${onInvoice}, for money that reached the bank outside the store.`;
		payDialog.reference.value = '';
		payDialog.received.value = today;
		payDialog.received.max = today;
		showReferenceError(false);
		pick('input[name="od-pay-method"]').checked = true;
		dialog('od-pay').show();
	}

	function showReferenceError(shown) {
		payDialog.referenceError.hidden = !shown;
		flagField(payDialog.reference, shown);
	}

	function submitPayment(event) {
		event.preventDefault();
		const reference = payDialog.reference.value.trim();
		if (!reference) {
			showReferenceError(true);
			payDialog.reference.focus();
			return;
		}
		const method = pick('input[name="od-pay-method"]:checked').value;
		const received = payDialog.received.value || toStamp(demoNow()).slice(0, 10);
		const totals = orderTotals(order);
		const methodWords = { 'Gift card': 'a gift card payment', 'Card by phone': 'a card payment by phone' };
		dialog('od-pay').hide();
		perform({
			run() {
				const now = toStamp(demoNow());
				order.payment.paidAt = received === now.slice(0, 10) ? now : `${received}T12:00`;
				order.payment.method = method;
				order.payment.ref = reference;
				justChangedStep = 'paid';
				logEvent(
					'bi-cash-coin',
					`Recorded ${methodWords[method] || 'a bank transfer'} of ${dollars(totals.total)}`,
				);
			},
			title: 'Payment recorded',
			detail: `${dollars(totals.total)} marked as paid.${!order.fulfil.packedAt && needsShipping(order) ? ' The order can now be packed.' : ''}`,
			icon: 'bi-cash-coin',
		});
	}

	/* Refund some or all of the order. */

	function openRefundDialog() {
		const pays = order.payment;
		const destination =
			pays.kind === 'card'
				? paymentName(order)
				: `account it came from, by ${(pays.method || 'bank transfer').toLowerCase()}`;
		refundDialog.lead.textContent = `The money goes back to the ${destination}.`;
		refundDialog.rows.innerHTML = order.items.map(refundRow).join('');
		for (const stepper of pickAll('[data-basalt-stepper]', refundDialog.rows)) window.Basalt.stepper?.(stepper);

		const shipRefundable = order.delivery.cents > 0 && !order.delivery.refunded;
		refundDialog.shipRow.hidden = !shipRefundable;
		refundDialog.ship.checked = false;
		refundDialog.shipLabel.textContent = `Refund the shipping, ${dollars(order.delivery.cents)}`;
		refundDialog.restockRow.hidden = !needsShipping(order);
		refundDialog.restock.checked = false;
		pick('input[name="od-refund-reason"]').checked = true;
		showRefundError(false);
		paintRefundSum();
		dialog('od-refund').show();
	}

	/** One line of the refund dialog: the product and a stepper capped at what is left. */
	function refundRow(line) {
		const entry = product(line.sku);
		const left = line.qty - (line.qtyRefunded || 0);
		const nameId = `od-r-${line.sku.replace(/[^A-Z0-9]/gi, '')}Name`;
		const text = `<span class="od-rline-text"><span id="${nameId}" class="od-rline-name">${htmlSafe(entry.name)}</span><span class="od-rline-meta">${left ? `${left} left` : 'All refunded'} · ${dollars(entry.price * 100)} each</span></span>`;
		const fewer =
			'<button data-basalt-step="-1" aria-label="One fewer" type="button" class="basalt-stepper-btn"><i class="bi bi-dash-lg" aria-hidden="true"></i></button>';
		const more =
			'<button data-basalt-step="1" aria-label="One more" type="button" class="basalt-stepper-btn"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>';
		const field = `<input data-od-rqty="${line.sku}" aria-labelledby="${nameId}" class="basalt-stepper-input" type="number" inputmode="numeric" min="0" max="${left}" step="1" value="0"${left ? '' : ' disabled'}>`;
		return `<li class="od-rline">${text}<span data-basalt-stepper class="basalt-stepper basalt-stepper-sm">${fewer}${field}${more}</span></li>`;
	}

	function pickedRefunds() {
		return pickAll('[data-od-rqty]')
			.map((field) => ({ sku: field.getAttribute('data-od-rqty'), qty: parseInt(field.value, 10) || 0 }))
			.filter((chosen) => chosen.qty > 0);
	}

	function paintRefundSum() {
		const sum = refundMoney(order, pickedRefunds(), refundDialog.ship.checked);
		const sumRow = (label, value, extraClass) =>
			`<div${extraClass ? ` class="${extraClass}"` : ''}><span>${label}</span><span>${value}</span></div>`;
		const rows = [sumRow('Items', dollars(sum.goods))];
		if (sum.ship) rows.push(sumRow('Shipping', dollars(sum.ship)));
		rows.push(sumRow('Tax', dollars(sum.tax)), sumRow('Refund', dollars(sum.cents), 'od-sum-total'));
		refundDialog.sum.innerHTML = rows.join('');
	}

	function showRefundError(shown) {
		refundDialog.error.hidden = !shown;
	}

	function submitRefund(event) {
		event.preventDefault();
		const picks = pickedRefunds();
		const withShipping = refundDialog.ship.checked;
		if (!picks.length && !withShipping) {
			showRefundError(true);
			return;
		}
		const sum = refundMoney(order, picks, withShipping);
		const reason = pick('input[name="od-refund-reason"]:checked').value;
		const restock = refundDialog.restock.checked;
		const phrases = picks.map((chosen) => `${chosen.qty} ${product(chosen.sku).name}`);
		if (withShipping) phrases.push('the shipping');
		dialog('od-refund').hide();
		perform({
			run() {
				for (const chosen of picks) {
					const line = order.items.find((entry) => entry.sku === chosen.sku);
					line.qtyRefunded = (line.qtyRefunded || 0) + chosen.qty;
				}
				if (withShipping) order.delivery.refunded = true;
				order.refunds.push({
					at: toStamp(demoNow()),
					by: SIGNED_IN,
					reason,
					picks,
					withShipping,
					cents: sum.cents,
				});
				logEvent('bi-arrow-counterclockwise', `Refunded ${dollars(sum.cents)} for ${listWords(phrases)}`);
				if (restock && picks.length) {
					const units = picks.reduce((total, chosen) => total + chosen.qty, 0);
					logEvent('bi-boxes', `Put ${countOf(units, 'item')} back in stock`);
				}
			},
			title: `${dollars(sum.cents)} refunded`,
			detail: 'It reaches the customer in 5 to 10 working days.',
			icon: 'bi-arrow-counterclockwise',
		});
	}

	/* Cancel the order outright. */

	function openCancelDialog() {
		const totals = orderTotals(order);
		const pays = order.payment;
		const paid = Boolean(pays.paidAt);
		cancelDialog.heading.textContent = `Cancel order ${order.id}?`;
		cancelDialog.lead.textContent = `${buyer(order.buyerName).person} gets an email to say it was canceled.`;
		const stockLine = needsShipping(order)
			? [
					'bi-box-seam',
					order.fulfil.packedAt ? 'The packed boxes go back on the shelf' : 'The warehouse stops picking it',
				]
			: ['bi-calendar-x', 'Nothing is booked or sent out'];
		let moneyLine;
		if (paid)
			moneyLine = [
				'bi-arrow-counterclockwise',
				`${dollars(totals.net)} back to the ${pays.kind === 'card' ? paymentName(order) : `customer by ${pays.method.toLowerCase()}`}`,
			];
		else if (pays.invoice) moneyLine = ['bi-receipt', `Invoice ${pays.invoice} is voided`];
		else moneyLine = ['bi-link-45deg', 'The card payment link stops working'];
		cancelDialog.list.innerHTML = [stockLine, moneyLine]
			.map(([icon, text]) => `<li><i class="bi ${icon}" aria-hidden="true"></i>${htmlSafe(text)}</li>`)
			.join('');
		dialog('od-cancel').show();
	}

	function confirmCancel() {
		const totals = orderTotals(order);
		const pays = order.payment;
		const paid = Boolean(pays.paidAt);
		const givesBack = paid && totals.net > 0;
		dialog('od-cancel').hide();
		perform({
			run() {
				order.cancellation = { at: toStamp(demoNow()), by: SIGNED_IN, reason: '' };
				if (givesBack) {
					const picks = order.items
						.map((line) => ({ sku: line.sku, qty: line.qty - (line.qtyRefunded || 0) }))
						.filter((chosen) => chosen.qty > 0);
					for (const chosen of picks) {
						const line = order.items.find((entry) => entry.sku === chosen.sku);
						line.qtyRefunded = line.qty;
					}
					order.delivery.refunded = true;
					order.refunds.push({
						at: toStamp(demoNow()),
						by: SIGNED_IN,
						reason: 'Order canceled',
						picks,
						withShipping: true,
						cents: totals.net,
					});
				}
				logEvent('bi-x-octagon', 'Canceled the order');
				if (givesBack)
					logEvent(
						'bi-arrow-counterclockwise',
						`Refunded ${dollars(totals.net)} to the ${pays.kind === 'card' ? paymentName(order) : 'customer'}`,
					);
				else if (!paid && pays.invoice) logEvent('bi-receipt', `Voided invoice ${pays.invoice}`);
			},
			title: `Order ${order.id} canceled`,
			detail: paid
				? `${dollars(totals.net)} is on its way back to the customer.`
				: pays.invoice
					? 'The invoice was voided.'
					: 'Nothing was charged.',
			icon: 'bi-x-octagon',
		});
	}

	/* Notes for the team. */

	function showNoteError(shown) {
		noteError.hidden = !shown;
		flagField(noteBox, shown);
	}

	function submitNote(event) {
		event.preventDefault();
		const text = noteBox.value.trim();
		if (!text) {
			showNoteError(true);
			noteBox.focus();
			return;
		}
		noteBox.value = '';
		perform({
			run() {
				order.notes.push({ at: toStamp(demoNow()), author: SIGNED_IN, text, isNew: true });
				logEvent('bi-sticky', 'Added a note');
			},
			title: 'Note added',
			detail: 'Everyone on the team can see it.',
			icon: 'bi-sticky',
		});
	}

	start();
})();
