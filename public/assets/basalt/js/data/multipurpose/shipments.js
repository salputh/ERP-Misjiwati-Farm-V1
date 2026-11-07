/**
 * Marlo's parcels, published as window.Basalt.data.shipments and read by
 * Shipments (the list) and Shipment Details (one parcel with its scans,
 * route and contents).
 *
 * Nothing here repeats the shop book (window.Basalt.shopBook in
 * assets/basalt/js/data/multipurpose/store.js): orders, shoppers, carriers, tracking numbers
 * and dates come from it, so a parcel matches Order Details exactly.
 * Returns travel on the prepaid labels sent with refund claims
 * (window.Basalt.data.refunds). This file adds only what the book lacks:
 * the sorting hubs a carrier scans parcels through, labels printed for
 * orders still awaiting pickup, the parcels a carrier has flagged late,
 * and emails the team wrote by hand.
 *
 * all() returns every parcel, those needing attention first. Each one has
 * an id (#474 for order #474 going out, #445-R for order
 * #445 coming back), a status (label, transit, out, delivered,
 * delayed or returned), its carrier scans newest first under events, and
 * the messages the shopper received under emails.
 *
 * Swap in a carrier feed that yields parcels of this shape to use real data.
 */
(() => {
	'use strict';

	/* The demo clock, and the earliest ship date the list still shows. */
	const NOW = '2026-10-09T10:40';
	const FROM = '2026-09-09';

	/* Status meta for badges. A lower rank sorts nearer the top. */
	const STATUS = {
		delayed: { rank: 0, label: 'Delayed', tone: 'warning' },
		out: { rank: 1, label: 'Out for delivery', tone: 'primary' },
		transit: { rank: 2, label: 'In transit', tone: 'info' },
		label: { rank: 3, label: 'Label created', tone: '' },
		delivered: { rank: 4, label: 'Delivered', tone: 'success' },
		returned: { rank: 4, label: 'Returned', tone: 'danger' },
	};

	/* Carrier tiles share Shipping's two-letter marks and chart tones. */
	const CARRIERS = {
		UPS: { tone: 1, mark: 'Up' },
		FedEx: { tone: 2, mark: 'Fe' },
		'DHL Express': { tone: 5, mark: 'Dh' },
		USPS: { tone: 6, mark: 'Us' },
	};

	/* Marlo ships from three warehouses. */
	const DEPOTS = {
		reno: { place: 'Elko, NV', name: 'Elko DC' },
		annarbor: { place: 'Ann Arbor, MI', name: 'Ann Arbor DC' },
		medford: { place: 'Bellingham, WA', name: 'Bellingham DC' },
	};

	/*
	 * Each carrier sorts parcels at one hub per destination country. Every
	 * shopper is in the United States, so each carrier has a single
	 * domestic hub; USPS goes straight to the local post office.
	 */
	const SORTING_HUBS = {
		UPS: { US: 'Salt Lake City, UT' },
		'DHL Express': { US: 'Cincinnati, OH' },
	};

	/* Tracking numbers on labels already printed for packed orders. */
	const PRINTED_LABELS = {
		'#477': '6620158934',
		'#478': '1Z8V27E14417760352',
		'#479': '5913307425',
	};

	/* Late reports from carriers: the scan, the reason, the new delivery day. */
	const LATE_REPORTS = {
		'#470': {
			until: '2026-10-13',
			at: '2026-10-09T08:50',
			text: 'Missed its connection at the sorting center',
		},
		'#474': {
			until: '2026-10-13',
			at: '2026-10-09T06:15',
			text: 'Held at the hub after a storm closed the highway',
		},
	};

	/* Messages written by the team on top of the automatic emails. */
	const HANDWRITTEN = {
		'#470': [{ by: 'Hope Stout', at: '2026-10-09T09:30', text: 'Delay notice, new date Tue, Oct 13' }],
	};

	/* Packed kilograms for a single unit of each product. */
	const UNIT_KG = {
		'ML-ORGZ': 0.85,
		'ML-BLAZ': 0.62,
		'ML-GOWN': 0.48,
		'ML-SUIT': 0.44,
		'ML-TRCH': 0.31,
		'ML-CATE': 0.21,
		'ML-LOAF': 0.19,
		'ML-SHLD': 0.14,
		'ML-OXFD': 0.12,
	};

	/* Order states that already have, or are about to get, a parcel. */
	const SHIPPABLE = new Set(['picking', 'dispatched', 'delivered']);

	let parcels = null;

	function publish() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.shipments = {
			NOW,
			FROM,
			STATUS,
			CARRIERS,
			all: () => everyParcel(),
			find: (id) => everyParcel().find((parcel) => parcel.id === id) || null,
			trackingLink: (parcel) => `https://marlo.shop/track/${parcel.tracking}`,
		};
	}

	/** Works the parcels out on first request and reuses them after that. */
	function everyParcel() {
		parcels ??= assemble();
		return parcels;
	}

	/**
	 * Joins outgoing parcels and returns into one list. It stays empty when
	 * the shop book has not loaded.
	 */
	function assemble() {
		const book = window.Basalt.shopBook;
		if (!book) return [];
		const claims = window.Basalt.data.refunds?.CLAIMS || [];
		const gathered = [];
		for (const shopOrder of book.ORDERS) {
			const parcel = outgoing(book, shopOrder);
			if (parcel) gathered.push(parcel);
		}
		for (const claim of claims) {
			const parcel = inbound(book, claim);
			if (parcel) gathered.push(parcel);
		}
		return gathered.sort(byUrgency);
	}

	/* Outgoing parcels, one per order holding physical goods. */

	/**
	 * The parcel for one shop order, or null when the order has nothing to
	 * ship, shipped before FROM, or has no tracking number yet.
	 */
	function outgoing(book, order) {
		if (!SHIPPABLE.has(order.status)) return null;
		const { goods, fulfil, site: depotId, region: zone } = book.story(order);
		if (!goods) return null;
		if (fulfil.shippedAt && fulfil.shippedAt.slice(0, 10) < FROM) return null;

		const ref = order.orderNumber;
		const shopper = book.customer(order.customer);
		const carrier = fulfil.carrier || book.SHIPPING[order.ship].carrier;
		const tracking = fulfil.tracking || PRINTED_LABELS[ref];
		if (!tracking) return null;

		const warehouse = DEPOTS[depotId];
		const { country } = shopper;
		const hub = SORTING_HUBS[carrier]?.[country] || warehouse.place;
		const destination = cityLine(shopper);
		const transitDays = book.REGIONS[zone].transit;
		const printedAt = shiftTime(fulfil.packedAt, 20);
		const leftAt = fulfil.shippedAt || nextPickup();
		const due = (fulfil.expected || shiftTime(leftAt, transitDays, '12:00')).slice(0, 10);
		const late = order.status === 'dispatched' ? LATE_REPORTS[ref] : null;

		const scans = carrierScans({
			order,
			fulfil,
			shopper,
			carrier,
			warehouse,
			hub,
			destination,
			transitDays,
			printedAt,
			leftAt,
			late,
		});
		const phase = stateOf(order, late, scans);
		const contents = packedItems(
			book,
			order.lines.filter((line) => book.kind(line.sku) === 'goods'),
		);
		const kg = weighParcel(contents);
		const waiting = phase === 'label';
		const mailLog = newestFirst(shopperEmails(ref, phase, leftAt, scans, fulfil.deliveredAt));

		return {
			id: `#${ref.replace(/\D/g, '')}`,
			kind: 'out',
			order: ref,
			status: phase,
			customer: shopper,
			carrier,
			service: order.ship,
			tracking,
			site: { id: depotId, ...warehouse },
			hub,
			dest: destination,
			country,
			transit: transitDays,
			labelAt: printedAt,
			pickupAt: waiting ? leftAt : null,
			shippedAt: waiting ? null : leftAt,
			deliveredAt: fulfil.deliveredAt || null,
			expected: late ? late.until : due,
			was: late ? due : null,
			delay: late ? { place: hub, ...late } : null,
			lines: contents,
			weight: kg,
			box: boxSize(kg),
			events: scans.reverse(),
			emails: mailLog,
		};
	}

	/** The scans a carrier has logged so far, oldest first. */
	function carrierScans(trip) {
		const { order, fulfil, shopper, carrier, warehouse, hub, destination, transitDays, printedAt, leftAt, late } =
			trip;
		const hubDay = Math.max(1, Math.floor(transitDays / 2));
		const lastLeg = transitDays - 1;
		const fullRoute = [
			{ kind: 'label', at: printedAt, place: warehouse.place, text: 'Label created, waiting for pickup' },
			{ kind: 'pickup', at: leftAt, place: warehouse.place, text: `Picked up by ${carrier}` },
			{
				kind: 'hub',
				at: shiftTime(leftAt, hubDay, '05:10'),
				place: hub,
				text: `Arrived at the ${carrier} facility`,
			},
			{ kind: 'move', at: shiftTime(leftAt, hubDay, '13:25'), place: hub, text: `Left the ${carrier} facility` },
			{
				kind: 'local',
				at: shiftTime(leftAt, lastLeg, lastLeg === hubDay ? '22:40' : '21:50'),
				place: destination,
				text: 'Arrived at the local delivery office',
			},
			{ kind: 'out', at: shiftTime(leftAt, transitDays, '07:40'), place: destination, text: 'Out for delivery' },
		];
		if (fulfil.deliveredAt) {
			fullRoute.push({
				kind: 'delivered',
				at: fulfil.deliveredAt,
				place: destination,
				text: `Delivered, signed for by ${initialed(shopper.name)}`,
			});
		}

		/* A late parcel stops at the hub; a parcel still being picked has only its label. */
		let logged = fullRoute;
		if (late) logged = [...fullRoute.slice(0, 3), { kind: 'delay', at: late.at, place: hub, text: late.text }];
		if (order.status === 'picking') logged = fullRoute.slice(0, 1);
		return logged.filter(hasHappened);
	}

	function stateOf(order, late, scans) {
		if (order.status === 'delivered') return 'delivered';
		if (late) return 'delayed';
		if (order.status !== 'dispatched') return 'label';
		return scans.some((scan) => scan.kind === 'out') ? 'out' : 'transit';
	}

	/** Automatic emails in the order they were triggered, then the team's own. */
	function shopperEmails(ref, phase, leftAt, scans, deliveredAt) {
		const sent = [];
		if (phase !== 'label') sent.push({ at: shiftTime(leftAt, 1), text: 'Shipping email with the tracking link' });
		const outScan = scans.find((scan) => scan.kind === 'out');
		if (outScan) sent.push({ at: shiftTime(outScan.at, 2), text: 'Out for delivery today' });
		if (deliveredAt) sent.push({ at: shiftTime(deliveredAt, 5), text: 'Delivered, with a link to start a return' });
		for (const { at, text, by } of HANDWRITTEN[ref] || []) sent.push({ at, text, by });
		return sent;
	}

	/* Returns, on prepaid UPS labels, back to the warehouse that shipped. */

	/** The return parcel for one refund claim, or null when no label was sent. */
	function inbound(book, claim) {
		const returnLabel = claim.ret?.label;
		if (!returnLabel) return null;
		const sourceOrder = book.order(claim.order);
		if (!sourceOrder) return null;

		const ref = sourceOrder.orderNumber;
		const depotId = book.story(sourceOrder).site;
		const warehouse = DEPOTS[depotId];
		const shopper = book.customer(sourceOrder.customer);
		const origin = cityLine(shopper);
		const { sent, back, by: sender } = claim.ret;
		const emailedAt = sent.replace(' ', 'T');
		const arrivedAt = back ? back.replace(' ', 'T') : null;
		const droppedAt = shiftTime(emailedAt, 1, '12:10');
		const hub = SORTING_HUBS.UPS[shopper.country] || warehouse.place;

		const scans = [
			{ kind: 'label', at: emailedAt, place: origin, text: 'Return label emailed to the shopper' },
			{ kind: 'pickup', at: droppedAt, place: origin, text: 'Dropped off at a UPS Access Point' },
			{ kind: 'hub', at: shiftTime(droppedAt, 1, '04:50'), place: hub, text: 'Arrived at the UPS facility' },
		];
		if (arrivedAt)
			scans.push({
				kind: 'delivered',
				at: arrivedAt,
				place: warehouse.place,
				text: `Delivered to ${warehouse.name}`,
			});

		const contents = packedItems(book, claim.lines);
		const kg = weighParcel(contents);
		const notices = [{ at: emailedAt, text: 'Return label and drop-off steps', by: sender }];
		if (arrivedAt) notices.push({ at: shiftTime(arrivedAt, 30), text: 'Return received at the warehouse' });

		return {
			id: `#${ref.replace(/\D/g, '')}-R`,
			kind: 'return',
			order: ref,
			claim: claim.id,
			status: arrivedAt ? 'returned' : 'transit',
			customer: shopper,
			carrier: 'UPS',
			service: 'UPS Ground, prepaid return',
			tracking: returnLabel,
			site: { id: depotId, ...warehouse },
			hub,
			origin,
			dest: warehouse.place,
			country: shopper.country,
			transit: 3,
			labelAt: emailedAt,
			shippedAt: droppedAt,
			deliveredAt: arrivedAt,
			expected: (arrivedAt || shiftTime(droppedAt, 3, '12:00')).slice(0, 10),
			was: null,
			delay: null,
			lines: contents,
			weight: kg,
			box: boxSize(kg),
			events: scans.filter(hasHappened).reverse(),
			emails: newestFirst(notices),
		};
	}

	/* Contents, weight and packaging. */

	/** Accepts { sku, qty } lines or [sku, qty] pairs and fills in product details. */
	function packedItems(book, rawLines) {
		return rawLines.map((raw) => {
			const sku = raw.sku || raw[0];
			const product = book.PRODUCTS.find((entry) => entry.sku === sku);
			return {
				sku,
				qty: raw.qty || raw[1],
				name: product.name,
				price: product.price,
				icon: product.icon,
				photo: catalogPhoto(sku),
			};
		});
	}

	function catalogPhoto(sku) {
		const listing = window.Basalt.data.catalog?.find(sku);
		return listing ? listing.photo : '';
	}

	/** Box weight of 0.08 kg plus each item, rounded to two decimals. Unknown SKUs count as 0.2 kg. */
	function weighParcel(contents) {
		let kilos = 0.08;
		for (const { sku, qty } of contents) kilos += (UNIT_KG[sku] || 0.2) * qty;
		return Math.round(kilos * 100) / 100;
	}

	function boxSize(kg) {
		if (kg < 0.5) return 'Mailer bag';
		return kg < 1.5 ? 'Small box' : 'Medium box';
	}

	/* Places and names as the pages print them. */

	/** "Concord, NH": the city and the state from the second address line. */
	function cityLine(shopper) {
		const stateCode = /^(.+?), ([A-Z]{2}) /.exec(shopper.address[1] || '')?.[2];
		return `${shopper.city}, ${stateCode || shopper.country}`;
	}

	/** "Hope Stout" becomes "H. Stout". */
	function initialed(fullName) {
		const [first, ...rest] = fullName.split(' ');
		return [`${first[0]}.`, ...rest].join(' ');
	}

	/* Ordering. */

	/**
	 * Parcels needing attention first, ranked by status. Open parcels then
	 * run by due date; finished ones by their latest scan, newest first.
	 */
	function byUrgency(a, b) {
		const gap = STATUS[a.status].rank - STATUS[b.status].rank;
		if (gap) return gap;
		if (STATUS[a.status].rank >= 4) return lastNews(a) < lastNews(b) ? 1 : -1;
		if (a.expected === b.expected) return 0;
		return a.expected < b.expected ? -1 : 1;
	}

	function lastNews(parcel) {
		return parcel.events[0] ? parcel.events[0].at : parcel.labelAt;
	}

	function newestFirst(entries) {
		return entries.filter(hasHappened).sort((a, b) => (a.at < b.at ? 1 : -1));
	}

	/* Clock helpers. Stamps are local "YYYY-MM-DDTHH:MM" strings with no zone. */

	function hasHappened(entry) {
		return entry.at <= NOW;
	}

	/** Parcels still waiting leave on the 3:40 pm pickup, today if it has not gone yet. */
	function nextPickup() {
		return shiftTime(NOW, NOW.slice(11) < '15:40' ? 0 : 1, '15:40');
	}

	/**
	 * With a clock time, moves the stamp `amount` days ahead and sets that
	 * time. Without one, adds `amount` minutes.
	 */
	function shiftTime(stamp, amount, clock) {
		const anchor = toDate(stamp);
		if (!clock) return toStamp(new Date(anchor.getTime() + amount * 60000));
		const [hours, minutes] = clock.split(':').map(Number);
		return toStamp(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + amount, hours, minutes));
	}

	function toDate(stamp) {
		const [day, time] = stamp.split('T');
		const [year, month, date] = day.split('-').map(Number);
		const [hours, minutes] = (time || '00:00').split(':').map(Number);
		return new Date(year, month - 1, date, hours, minutes);
	}

	function toStamp(when) {
		const two = (value) => String(value).padStart(2, '0');
		return `${when.getFullYear()}-${two(when.getMonth() + 1)}-${two(when.getDate())}T${two(when.getHours())}:${two(when.getMinutes())}`;
	}

	publish();
})();
