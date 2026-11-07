/**
 * Quote Details (quote-details.html).
 *
 * One quote from end to end: where it stands with the buyer, the document as
 * the buyer sees it, the customer, every saved version and the journal of
 * what happened. "Edit quote" turns the document into a form in place; a
 * save keeps the old version and can email the new one. The quote named by
 * ?id= (a plan quote or a services quote) is read from
 * assets/basalt/js/data/multipurpose/deals.js, the same record the Quotes, deal and account
 * pages link to; an unknown id opens #431. In a real app the record
 * comes from your API. The day is pinned so the demo dates read the same on
 * every visit.
 */
(() => {
	'use strict';

	const pageRoot = pick('[data-qd-root]', document);
	if (!pageRoot) return;

	const CLOCK_DAY = new Date(2026, 9, 9);
	const SIGNED_IN = 'John Armstrong';
	const HOME_ID = '#431';
	const INVOICES_PAGE = 'invoices.html';
	const NEXT_ORDER = '#485';
	const DAY_MS = 86400000;
	const BULK = { units: 20, off: 0.05 };
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const TIMES_WORD = { 1: 'once', 2: 'twice' };
	const ICON_TONE = {
		'bi-file-earmark-plus': 8,
		'bi-pencil': 4,
		'bi-send': 1,
		'bi-eye': 3,
		'bi-bell': 2,
		'bi-calendar-plus': 7,
	};
	const STEP_MARK = { done: '<i class="bi bi-check-lg"></i>', stopped: '<i class="bi bi-x-lg"></i>' };
	const STEP_SAID = { done: ', done', next: ', next', stopped: ', stopped' };

	/*
	 * The record behind the page. A services quote prices courses and set-up
	 * work and becomes an order; a plan quote prices seats and add-ons (and
	 * any set-up) for a deal or a renewal, and is signed. Twenty or more
	 * course places on one quote take 5% off the courses.
	 */
	const LEDGER = window.Basalt.data.deals;
	const record = LEDGER.quote(new URLSearchParams(location.search).get('id')) || LEDGER.quote(HOME_ID);
	const isPlan = record.kind === 'plan';
	const CATALOG = LEDGER.products;
	const STATUS_PILL = {
		draft: ['Draft', ''],
		expired: ['Lapsed', ''],
		sent: ['Sent', 'basalt-status-dot basalt-status-info'],
		accepted: [isPlan ? 'Signed' : 'Accepted', 'basalt-status-dot basalt-status-success'],
		declined: ['Declined', 'basalt-status-dot basalt-status-danger'],
	};
	const todayStamp = isoDate(CLOCK_DAY);

	const buyer = {
		name: record.company,
		contact: record.buyer.name,
		role: record.buyer.title,
		email: record.buyer.email,
		phone: record.buyer.phone,
		address: record.address,
		tax: isPlan ? null : record.tax,
		pay: paymentWords(),
		plan: record.account ? `${record.account.plan} plan` : 'New customer',
		seats: record.account ? record.account.seats : 0,
		since: record.account ? monthYear(record.account.since) : '',
		tone: record.tone || 1,
	};
	const seller = { name: record.rep.name, role: record.rep.role };

	/*
	 * Times are local, "YYYY-MM-DD HH:MM". Every save is a version and the
	 * last one is the quote as it stands; `views` are the moments the buyer
	 * opened the email link. A record without saved versions gets one, put
	 * together the afternoon before it went out.
	 */
	const quote = {
		id: record.id,
		status: record.status,
		sent: record.sent || null,
		until: record.sent ? daysLater(record.sent, record.valid) : null,
		views: record.views || [],
		reminders: record.reminders || [],
		closed: record.closed,
		reason: record.reason,
		order: record.order,
		versions: record.versions || [firstVersion()],
	};
	for (const version of quote.versions) {
		version.by ||= seller.name;
		version.valid ||= record.valid;
	}
	quote.sentVersion = quote.sent ? quote.versions.at(-1).n : 0;

	const journal = [];
	let shownIndex = quote.versions.length - 1;
	let draft = null;
	let ui = null;

	/*
	 * Everything starts here: the journal is assembled from the record, the
	 * buttons, the document, the dialogs and the delegated clicks are wired,
	 * and the page is painted once. The ring fills after the first paint.
	 */
	function start() {
		ui = {
			mainButton: pick('[data-qd-primary]'),
			editButton: pick('[data-qd-edit]'),
			emailSwitch: hook('edit-notify'),
			convertDialog: document.getElementById('qd-convert'),
			declineDialog: document.getElementById('qd-decline'),
		};
		buildJournal();
		ui.mainButton.addEventListener('click', () => perform(ui.mainButton.dataset.mode));
		pageRoot.addEventListener('click', onRootClick);
		ui.editButton.addEventListener('click', beginEdit);
		pick('[data-qd-cancel]').addEventListener('click', leaveEdit);
		hook('doc').addEventListener('input', onPaperInput);
		hook('doc').addEventListener('change', (event) => {
			if (event.target.matches('[data-qd-qty]'))
				event.target.dispatchEvent(new Event('input', { bubbles: true }));
		});
		hook('lines').addEventListener('click', onLineClick);
		pick('[data-qd-add]').addEventListener('click', addLine);
		pageRoot.addEventListener('change', (event) => {
			if (draft && event.target.matches('input[name="qdValid"]')) draft.valid = parseInt(event.target.value, 10);
		});
		pick('[data-qd-save]').addEventListener('click', saveDraft);
		pick('[data-qd-convert-form]', ui.convertDialog).addEventListener('submit', onConvertSubmit);
		pick('[data-qd-decline-form]', ui.declineDialog).addEventListener('submit', onDeclineSubmit);
		if (isPlan) {
			hook('brand').textContent = 'Fieldline';
			hook('brand-meta').textContent = '1600 Champa St, Boulder, CO 80202 · sales@fieldline.app';
		}
		document.title = `Quote ${quote.id} · Basalt`;
		paintBuyer();
		paint();
		drawSteps();
		requestAnimationFrame(() => requestAnimationFrame(() => hook('standing').classList.add('is-ready')));
	}

	function pick(selector, scope = pageRoot) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = pageRoot) {
		return [...scope.querySelectorAll(selector)];
	}

	function hook(name) {
		return pick(`[data-qd="${name}"]`);
	}

	function htmlSafe(value) {
		return `${value ?? ''}`.replace(/[&<>"']/g, (mark) => ESCAPES[mark]);
	}

	function notify(message) {
		window.Basalt.toasts?.push(message);
	}

	function sayAloud(text) {
		window.Basalt.announce?.(text);
	}

	function goTo(url) {
		window.location.href = url;
	}

	function calmMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	/** "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" to a local Date. */
	function parseStamp(stamp) {
		const [datePart, timePart = '00:00'] = stamp.split(' ');
		const [year, month, dayOfMonth] = datePart.split('-').map(Number);
		const [hours, minutes] = timePart.split(':').map(Number);
		return new Date(year, month - 1, dayOfMonth, hours, minutes);
	}

	function isoDate(calendar) {
		return [calendar.getFullYear(), twoDigits(calendar.getMonth() + 1), twoDigits(calendar.getDate())].join('-');
	}

	function stampOf(calendar) {
		return `${isoDate(calendar)} ${twoDigits(calendar.getHours())}:${twoDigits(calendar.getMinutes())}`;
	}

	function shortDate(stamp) {
		const calendar = parseStamp(stamp);
		return `${MONTH_SHORT[calendar.getMonth()]} ${calendar.getDate()}`;
	}

	function longDate(stamp) {
		return `${shortDate(stamp)}, ${parseStamp(stamp).getFullYear()}`;
	}

	/** "16:30" to "4:30 pm". */
	function clockText(hhmm) {
		const hours = +hhmm.slice(0, 2);
		return `${hours % 12 || 12}:${hhmm.slice(3, 5)}${hours < 12 ? ' am' : ' pm'}`;
	}

	function dateAndTime(stamp) {
		return `${shortDate(stamp)}, ${clockText(stamp.slice(11, 16))}`;
	}

	function monthYear(iso) {
		return `${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
	}

	/** The date `count` days on from the stamp's day, as "YYYY-MM-DD". */
	function daysLater(stamp, count) {
		const calendar = parseStamp(stamp.slice(0, 10));
		calendar.setDate(calendar.getDate() + count);
		return isoDate(calendar);
	}

	/** The same, counting only Monday to Friday. */
	function workdaysLater(stamp, count) {
		const calendar = parseStamp(stamp);
		let left = count;
		while (left > 0) {
			calendar.setDate(calendar.getDate() + 1);
			if (calendar.getDay() % 6) left -= 1;
		}
		return isoDate(calendar);
	}

	function daysApart(from, to) {
		return Math.round((parseStamp(to.slice(0, 10)) - parseStamp(from.slice(0, 10))) / DAY_MS);
	}

	/** The demo "now": the pinned day at the visitor's clock time. */
	function rightNow() {
		const stamp = new Date(CLOCK_DAY);
		const wall = new Date();
		stamp.setHours(wall.getHours(), wall.getMinutes());
		return stampOf(stamp);
	}

	function dollars(amount) {
		return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function countOf(total, word) {
		return `${total} ${word}${total === 1 ? '' : 's'}`;
	}

	function timesWord(total) {
		return TIMES_WORD[total] || `${total} times`;
	}

	function upperFirst(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function lowerFirst(text) {
		return text.charAt(0).toLowerCase() + text.slice(1);
	}

	function monogram(name) {
		return name
			.split(' ')
			.map((word) => word[0])
			.slice(0, 2)
			.join('');
	}

	function givenName(name) {
		return name.split(' ')[0];
	}

	function factRow(label, value) {
		return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
	}

	function paymentWords() {
		if (isPlan) return record.pay;
		return record.terms === 'card' ? `Card on file, ${record.card}` : `Invoice, ${record.terms} days`;
	}

	function firstVersion() {
		return {
			n: 1,
			saved: record.edited || `${daysLater(record.sent, -1)} 16:30`,
			summary: lineSummary(record.lines),
			lines: record.lines,
			note:
				record.note ||
				`${givenName(buyer.contact)}, here are the prices we talked about, held for ${record.valid} days.`,
		};
	}

	function lineSummary(lines) {
		const [[sku, qty]] = lines;
		const opening = `${qty} × ${CATALOG[sku].name}`;
		return lines.length === 1 ? opening : `${opening} and ${lines.length - 1} more`;
	}

	function lineCost([sku, qty]) {
		return CATALOG[sku].price * qty;
	}

	/**
	 * The money on a set of lines. Plan quotes leave tax to the invoice and
	 * set up any work free; a services quote adds set-up under $500 and the
	 * account's tax.
	 */
	function totalsFor(lines) {
		const beforeDiscount = lines.reduce((sum, line) => sum + lineCost(line), 0);
		const devices = lines.filter(([sku]) => CATALOG[sku].device);
		const deviceUnits = devices.reduce((sum, [, qty]) => sum + qty, 0);
		const discount =
			deviceUnits >= BULK.units
				? Math.round(devices.reduce((sum, line) => sum + lineCost(line), 0) * BULK.off * 100) / 100
				: 0;
		const ships = !isPlan && lines.some(([sku]) => !CATALOG[sku].service);
		const net = beforeDiscount - discount;
		const shipping = !ships ? 0 : net >= 500 ? 0 : 18;
		const tax = buyer.tax ? Math.round((net + shipping) * buyer.tax[1] * 100) / 100 : 0;
		const pieces = lines
			.filter(([sku]) => !CATALOG[sku].service && !CATALOG[sku].sub)
			.reduce((sum, [, qty]) => sum + qty, 0);
		const yearly = lines.filter(([sku]) => CATALOG[sku].sub).reduce((sum, line) => sum + lineCost(line), 0);
		return {
			subtotal: beforeDiscount,
			discount,
			shipping,
			tax,
			total: net + shipping + tax,
			units: pieces,
			ships,
			yearly,
			once: beforeDiscount - yearly,
		};
	}

	function latestVersion() {
		return quote.versions.at(-1);
	}

	function opensSinceSent() {
		return quote.views.filter((at) => at >= quote.sent);
	}

	function daysRemaining() {
		return Math.max(daysApart(todayStamp, quote.until), 0);
	}

	function validitySpan() {
		return Math.max(daysApart(quote.sent, quote.until), 1);
	}

	function isLost() {
		return ['declined', 'expired'].includes(quote.status);
	}

	function statusTag() {
		const [label, extra] = STATUS_PILL[quote.status];
		return `<span class="basalt-status ${extra}">${label}</span>`;
	}

	/* Journal entries keep their push order, so same-minute ties stay stable. */
	function jot(at, icon, html, tone = '') {
		journal.push({ t: at, icon, html, tone, seq: journal.length });
	}

	function buildJournal() {
		for (const version of quote.versions) {
			const isFirst = version.n === 1;
			const what = isFirst
				? 'started version 1'
				: `saved version ${version.n}: ${htmlSafe(lowerFirst(version.summary))}`;
			jot(
				version.saved,
				isFirst ? 'bi-file-earmark-plus' : 'bi-pencil',
				`<strong>${htmlSafe(version.by)}</strong> ${what}`,
			);
		}
		if (quote.sent)
			jot(
				quote.sent,
				'bi-send',
				`<strong>${htmlSafe(seller.name)}</strong> sent version ${quote.sentVersion} to ${htmlSafe(buyer.contact)}`,
			);
		for (const [index, at] of quote.views.entries()) {
			jot(at, 'bi-eye', `<strong>${htmlSafe(buyer.contact)}</strong> opened the quote${index ? ' again' : ''}`);
		}
		for (const at of quote.reminders) {
			jot(
				at,
				'bi-bell',
				`<strong>${htmlSafe(seller.name)}</strong> sent a reminder to ${htmlSafe(buyer.contact)}`,
			);
		}
		if (quote.status === 'accepted')
			jot(
				quote.closed,
				isPlan ? 'bi-pen' : 'bi-check2-circle',
				`<strong>${htmlSafe(buyer.contact)}</strong> ${isPlan ? 'signed it' : 'accepted it'}`,
				'won',
			);
		if (quote.order)
			jot(
				quote.closed,
				'bi-bag-check',
				`<strong>${htmlSafe(seller.name)}</strong> turned it into order <a class="qd-link" href="${INVOICES_PAGE}">${quote.order}</a>`,
				'won',
			);
		if (quote.status === 'declined')
			jot(
				quote.closed,
				'bi-x-circle',
				`<strong>${htmlSafe(buyer.contact)}</strong> declined it: ${htmlSafe(quote.reason.toLowerCase())}`,
				'lost',
			);
		if (quote.status === 'expired')
			jot(`${quote.until} 23:59`, 'bi-hourglass-bottom', 'It lapsed with no reply', 'lost');
	}

	function paint() {
		paintHeader();
		paintStanding();
		paintPaper();
		paintVersions();
		paintJournal();
	}

	/* Header: the quote number, who it is for, the main button and the menu. */
	function paintHeader() {
		hook('title').textContent = `Quote ${quote.id}`;
		const companyHtml = record.acct
			? `<a class="qd-link" href="company-details.html?id=${encodeURIComponent(record.acct)}">${htmlSafe(buyer.name)}</a>`
			: htmlSafe(buyer.name);
		hook('sub').innerHTML = `${companyHtml} · prepared by ${htmlSafe(seller.name)} · version ${latestVersion().n}`;
		const [mode, icon, label] = mainAction();
		ui.mainButton.dataset.mode = mode;
		ui.mainButton.innerHTML = `<i class="bi ${icon} me-1" aria-hidden="true"></i>${label}`;
		ui.mainButton.hidden = Boolean(draft);
		ui.editButton.hidden = !['sent', 'draft'].includes(quote.status) || Boolean(draft);
		hook('menu').innerHTML = menuHtml(mode);
	}

	/** The one button that matters at this point: [mode, icon, label]. */
	function mainAction() {
		if (quote.status === 'draft') return ['send', 'bi-send', 'Send quote'];
		if (quote.status === 'sent')
			return isPlan ? ['accept', 'bi-pen', 'Mark signed'] : ['accept', 'bi-check2-circle', 'Mark accepted'];
		if (isLost()) return ['requote', 'bi-arrow-repeat', 'Quote again'];
		if (isPlan)
			return record.deal
				? ['deal', 'bi-briefcase', 'Open deal']
				: ['sub', 'bi-arrow-repeat', 'Open subscription'];
		return quote.order
			? ['order', 'bi-box-arrow-up-right', 'Open invoices']
			: ['convert', 'bi-bag-check', 'Turn into order'];
	}

	function menuItem(action, icon, text, extraClass = '') {
		return `<li><button type="button" class="dropdown-item${extraClass ? ` ${extraClass}` : ''}" data-qd-act="${action}"><i class="bi ${icon}" aria-hidden="true"></i>${text}</button></li>`;
	}

	function menuHtml(mode) {
		const menuRows = [];
		if (quote.status === 'sent')
			menuRows.push(
				menuItem('remind', 'bi-bell', 'Send a reminder'),
				menuItem('extend', 'bi-calendar-plus', 'Extend by 14 days'),
			);
		if (record.deal && mode !== 'deal')
			menuRows.push(
				`<li><a class="dropdown-item" href="deal-details.html?id=${encodeURIComponent(record.deal)}"><i class="bi bi-briefcase" aria-hidden="true"></i>Open deal</a></li>`,
			);
		menuRows.push(
			menuItem('copy', 'bi-copy', 'Duplicate'),
			menuItem('pdf', 'bi-file-earmark-arrow-down', 'Download PDF'),
		);
		if (quote.status === 'sent')
			menuRows.push(
				'<li><hr class="dropdown-divider"></li>',
				menuItem('decline', 'bi-x-circle', 'Mark declined', 'qd-danger'),
			);
		return menuRows.join('');
	}

	/* Where it stands: the sentence, the total, the clock and the steps. */
	function paintStanding() {
		const version = latestVersion();
		const tally = totalsFor(version.lines);
		const opens = opensSinceSent();
		hook('standing').dataset.tone = standingTone();
		hook('status').innerHTML = statusTag();
		const [lead, hint] = standingWords(version, tally, opens);
		hook('lead').innerHTML = lead;
		hook('hint').innerHTML = hint;
		hook('hint').hidden = !hint;
		hook('total').textContent = dollars(tally.total);
		hook('total-note').textContent = totalNote(tally);
		paintClock();
		paintSteps(opens);
	}

	function standingTone() {
		if (quote.status === 'sent') return daysRemaining() <= 3 ? 'urgent' : daysRemaining() <= 7 ? 'soon' : 'calm';
		if (quote.status === 'draft') return 'calm';
		return isLost() ? 'declined' : quote.status;
	}

	/** The lead sentence and, while it waits, a hint: [lead, hint]. */
	function standingWords(version, tally, opens) {
		const who = htmlSafe(buyer.contact);
		if (quote.status === 'draft')
			return [`Not sent yet. ${htmlSafe(givenName(version.by))} saved it on ${dateAndTime(version.saved)}.`, ''];
		if (quote.status === 'sent') {
			const lastOpen = opens.at(-1);
			const opened = lastOpen
				? `Opened ${timesWord(opens.length)}, last on ${shortDate(lastOpen)} at ${clockText(lastOpen.slice(11))}.`
				: 'Not opened yet.';
			const nudged = quote.reminders.some((at) => !lastOpen || at > lastOpen);
			let hint = '';
			if (lastOpen && !nudged)
				hint =
					'Opened recently with no reply yet: a good moment to <button type="button" class="qd-inline-btn" data-qd-act="remind">send a reminder</button>.';
			else if (nudged) hint = `Reminder sent on ${dateAndTime(quote.reminders.at(-1))}.`;
			return [`Sent to ${who} on ${shortDate(quote.sent)}. ${opened}`, hint];
		}
		if (quote.status === 'accepted' && isPlan) {
			return [
				`${who} signed it on ${dateAndTime(quote.closed)}. ${record.renewal ? 'The new year' : 'The plan'} starts on ${longDate(record.starts)}.`,
				'',
			];
		}
		if (quote.status === 'accepted') {
			const followUp = quote.order
				? ` It became order <a class="qd-link" href="${INVOICES_PAGE}">${quote.order}</a>.`
				: ` Turn it into an order to reserve the ${countOf(tally.units, 'unit')}.`;
			return [`${who} accepted it on ${dateAndTime(quote.closed)}.${followUp}`, ''];
		}
		if (quote.status === 'expired') return [`Lapsed on ${longDate(quote.until)} with no reply.`, ''];
		return [`Marked declined on ${dateAndTime(quote.closed)}. ${htmlSafe(quote.reason)}.`, ''];
	}

	function totalNote(tally) {
		if (isPlan)
			return tally.once
				? `${dollars(tally.yearly)} a year · ${dollars(tally.once)} one-off`
				: `A year, from ${shortDate(record.starts)}`;
		return countOf(tally.units, 'unit') + (tally.discount ? ` · saves ${dollars(tally.discount)} on volume` : '');
	}

	/* The ring shows the days left of the validity, or the outcome once decided. */
	function paintClock() {
		const [ratio, number, unit, caption] = clockFace();
		hook('clock-num').textContent = number;
		hook('clock-unit').textContent = unit;
		hook('clock-caption').innerHTML = caption;
		hook('clock-fill').style.setProperty('--qd-ring', String(Math.round(ratio * 100)));
		const said =
			quote.status === 'sent'
				? `${daysRemaining()} of ${validitySpan()} days left, valid until ${longDate(quote.until)}`
				: `${hook('clock-num').textContent}, ${hook('clock-caption').textContent}`;
		hook('clock').setAttribute('aria-label', said);
	}

	/** [how full the ring is, the big figure, the word under it, the caption]. */
	function clockFace() {
		if (quote.status === 'draft') return [1, latestVersion().valid, 'days', 'Valid once it is sent'];
		if (quote.status === 'sent') {
			const left = daysRemaining();
			return [
				left / validitySpan(),
				left,
				left === 1 ? 'day left' : 'days left',
				`Valid until <strong>${longDate(quote.until)}</strong>`,
			];
		}
		if (quote.status === 'accepted') {
			const caption = isPlan
				? `Starts <strong>${longDate(record.starts)}</strong>`
				: quote.order
					? `Order <strong>${quote.order}</strong>`
					: 'Prices held for the order';
			return [1, 'Won', shortDate(quote.closed), caption];
		}
		return [
			0,
			'Lost',
			shortDate(quote.status === 'expired' ? quote.until : quote.closed),
			'Quote again at today’s prices',
		];
	}

	/* Started, sent, opened, accepted, then ordered or started. */
	function paintSteps(opens) {
		const yes = isPlan ? 'Signed' : 'Accepted';
		const decision =
			quote.status === 'declined'
				? ['Declined', 'stopped', shortDate(quote.closed)]
				: quote.status === 'expired'
					? ['Lapsed', 'stopped', shortDate(quote.until)]
					: quote.status === 'accepted'
						? [yes, 'done', shortDate(quote.closed)]
						: [
								yes,
								opens.length ? 'next' : 'todo',
								quote.sent ? `Waiting on ${givenName(buyer.contact)}` : 'Not yet',
							];
		const finale = isPlan
			? [
					'Starts',
					quote.status === 'accepted' ? (record.starts <= todayStamp ? 'done' : 'next') : 'todo',
					isLost() ? '—' : shortDate(record.starts),
				]
			: quote.order
				? ['Ordered', 'done', quote.order]
				: ['Ordered', quote.status === 'accepted' ? 'next' : 'todo', isLost() ? '—' : 'Not yet'];
		const milestones = [
			['Started', 'done', `${shortDate(quote.versions[0].saved)} by ${givenName(quote.versions[0].by)}`],
			quote.sent
				? ['Sent', 'done', `${shortDate(quote.sent)} · version ${quote.sentVersion}`]
				: ['Sent', 'next', 'Not yet'],
			[
				'Opened',
				opens.length ? 'done' : quote.status === 'sent' ? 'next' : 'todo',
				opens.length ? `${upperFirst(timesWord(opens.length))}, last ${shortDate(opens.at(-1))}` : 'Not yet',
			],
			decision,
			finale,
		];
		hook('steps').innerHTML = milestones.map(stepHtml).join('');
	}

	/**
	 * Grows the filled lines between done steps the first time the steps are
	 * on screen. Later repaints show them already drawn.
	 */
	function drawSteps() {
		const trail = hook('steps');
		let left = pickAll('.qd-step.is-done:not(:last-child)', trail).length;
		if (!left || !window.IntersectionObserver || calmMotion()) return;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'qd-trail-grow' || --left) return;
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

	function stepHtml([label, state, when], index) {
		const marker = STEP_MARK[state] || index + 1;
		const said = STEP_SAID[state] || ', to do';
		return `<li class="qd-step is-${state}"${state === 'next' ? ' aria-current="step"' : ''}><span class="qd-step-marker" aria-hidden="true">${marker}</span><span class="qd-step-text"><span class="qd-step-label">${label}<span class="visually-hidden">${said}</span></span><span class="qd-step-when">${htmlSafe(when)}</span></span></li>`;
	}

	/* The document: the paper as the buyer sees it, or the same as a form. */
	function paintPaper() {
		const onLatest = shownIndex === quote.versions.length - 1;
		const version = draft || quote.versions[shownIndex];
		const editable = Boolean(draft);
		const sheet = hook('doc');
		sheet.classList.toggle('is-editing', editable);
		sheet.classList.toggle('is-old', !onLatest);

		const banner = hook('viewing');
		banner.hidden = onLatest || editable;
		if (!onLatest) {
			const wentOut = quote.sentVersion === version.n || (quote.sentBefore || []).includes(version.n);
			banner.innerHTML = `<i class="bi bi-clock-history" aria-hidden="true"></i><span>Version ${version.n}, saved ${dateAndTime(version.saved)} by ${htmlSafe(version.by)}${wentOut ? '.' : '. Never sent.'}</span><button type="button" class="btn btn-outline-secondary btn-sm" data-qd-current>Back to current</button>`;
		}

		hook('doc-no').textContent = `${quote.id} · version ${editable ? quote.versions.length + 1 : version.n}`;
		hook('for').innerHTML =
			`<strong>${htmlSafe(buyer.name)}</strong><br>Attn: ${htmlSafe(buyer.contact)}<br>${buyer.address.map(htmlSafe).join('<br>')}`;
		const wasIssued = onLatest && !editable && Boolean(quote.sent);
		const dateRows = wasIssued
			? factRow('Issued', longDate(quote.sent)) + factRow('Valid until', longDate(quote.until))
			: factRow('Saved', longDate(version.saved)) + factRow('Valid for', `${version.valid} days once sent`);
		hook('dates').innerHTML =
			dateRows + factRow('Prepared by', htmlSafe(seller.name)) + factRow('Payment', htmlSafe(buyer.pay));

		hook('lines').innerHTML = version.lines
			.map((line) => lineHtml(line, editable, version.lines.length === 1))
			.join('');
		for (const widget of pickAll('[data-basalt-stepper]', hook('lines'))) window.Basalt.stepper?.(widget);
		hook('totals').innerHTML = totalsBlock(version.lines);

		hook('note').textContent = version.note;
		hook('note').hidden = editable;
		const noteField = hook('note-field');
		noteField.hidden = !editable;
		hook('add').hidden = !editable;
		hook('editbar').hidden = !editable;
		if (editable) {
			noteField.value = version.note;
			const unused = Object.keys(CATALOG).filter((sku) => !version.lines.some(([used]) => used === sku));
			hook('add-product').innerHTML = unused
				.map(
					(sku) =>
						`<option value="${sku}">${htmlSafe(CATALOG[sku].name)} · ${dollars(CATALOG[sku].price)}</option>`,
				)
				.join('');
			hook('add').hidden = !unused.length;
			window.Basalt.select?.refresh?.(hook('add-product'));
		}
		hook('terms').textContent = termsWords(wasIssued, version);
	}

	function qtyStepper(sku, qty) {
		const itemName = htmlSafe(CATALOG[sku].name);
		return `<div class="basalt-stepper qd-qty" data-basalt-stepper><button type="button" class="basalt-stepper-btn" data-basalt-step="-1" aria-label="One fewer ${itemName}"><i class="bi bi-dash-lg" aria-hidden="true"></i></button><input type="number" class="basalt-stepper-input" value="${qty}" min="1" max="500" inputmode="numeric" aria-label="Quantity of ${itemName}" data-qd-qty="${sku}"><button type="button" class="basalt-stepper-btn" data-basalt-step="1" aria-label="One more ${itemName}"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div>`;
	}

	function lineHtml([sku, qty], editable, solo) {
		const product = CATALOG[sku];
		const unitNote = product.sub
			? ` · ${product.unit === 'bundle' ? 'a year for each 1,000 a month' : 'a seat for a year'}`
			: '';
		const removeCell =
			editable && !solo
				? `<button type="button" class="btn btn-icon qd-rm" data-qd-rm="${sku}" aria-label="Remove ${htmlSafe(product.name)}"><i class="bi bi-trash3" aria-hidden="true"></i></button>`
				: '';
		const nameCell = `<span class="qd-product"><span class="qd-product-icon qd-tone-${product.tone}" aria-hidden="true"><i class="bi ${product.icon}"></i></span><span class="qd-product-text"><span class="qd-product-name">${htmlSafe(product.name)}</span><span class="qd-product-sku">${sku}${unitNote}<span class="qd-fold"> · ${dollars(product.price)}${product.sub ? '' : ' each'}</span></span></span></span>`;
		return `<tr><td>${nameCell}</td><td class="qd-col-unit text-end">${dollars(product.price)}</td><td class="qd-col-qty text-end">${editable ? qtyStepper(sku, qty) : qty}</td><td class="qd-col-total text-end"><span class="qd-amount" data-qd-amount="${sku}">${dollars(product.price * qty)}</span></td><td class="qd-col-rm">${removeCell}</td></tr>`;
	}

	/** The totals list: a plan quote splits yearly from one-off; a services quote itemizes. */
	function totalsBlock(lines) {
		const tally = totalsFor(lines);
		if (isPlan) {
			const split = tally.once
				? `<div><dt>Plan and add-ons<small>A year</small></dt><dd>${dollars(tally.yearly)}</dd></div><div><dt>Courses and set-up<small>Once</small></dt><dd>${dollars(tally.once)}</dd></div>`
				: '';
			return `${split}<div class="qd-totals-total"><dt>${tally.once ? 'First year' : 'A year'}</dt><dd>${dollars(tally.total)}</dd></div>`;
		}
		const saving = tally.discount
			? `<div class="qd-totals-save"><dt>Volume discount<small>5% off ${BULK.units} or more course places</small></dt><dd>−${dollars(tally.discount)}</dd></div>`
			: '';
		const setup = tally.ships
			? `<div><dt>Set-up<small>Standard${tally.shipping ? '' : ', free over $500'}</small></dt><dd>${tally.shipping ? dollars(tally.shipping) : 'Free'}</dd></div>`
			: '';
		return `<div><dt>Subtotal</dt><dd>${dollars(tally.subtotal)}</dd></div>${saving}${setup}<div><dt>Tax<small>${htmlSafe(buyer.tax[0])}</small></dt><dd>${dollars(tally.tax)}</dd></div><div class="qd-totals-total"><dt>Total</dt><dd>${dollars(tally.total)}</dd></div>`;
	}

	function termsWords(wasIssued, version) {
		const held = wasIssued ? `until ${longDate(quote.until)}` : `for ${version.valid} days from sending`;
		if (isPlan)
			return `Prices held ${held}. Seats are billed once a year at ten months’ price and add-ons every month, from the start date. Tax is added to the invoice where it applies.`;
		const billing =
			record.terms === 'card'
				? 'charged to the card on file when the order is placed'
				: `invoiced on ${record.terms}-day terms`;
		return `Prices held ${held}. Work is booked within two working days of acceptance and is ${billing}. Course dates can be changed for free.`;
	}

	/* The customer card, painted once: it never changes while the page is open. */
	function paintBuyer() {
		const subline = record.acct
			? `${buyer.plan} · ${buyer.seats} seats`
			: `New customer · ${htmlSafe(record.city)}`;
		hook('who').innerHTML =
			`<span class="basalt-avatar basalt-avatar-tone-${buyer.tone} qd-who-mark" aria-hidden="true">${monogram(buyer.name)}</span><span class="qd-who-text"><span class="qd-who-name">${htmlSafe(buyer.name)}</span><span class="qd-who-meta">${subline}</span></span>`;
		const mailCell = `<span class="qd-facts-mail"><a class="qd-link" href="mailto:${htmlSafe(buyer.email)}">${htmlSafe(buyer.email).replace('@', '@<wbr>')}</a><button type="button" class="btn btn-icon qd-copy" data-qd-copy="${htmlSafe(buyer.email)}" aria-label="Copy email address"><i class="bi bi-copy" aria-hidden="true"></i></button></span>`;
		hook('customer').innerHTML =
			factRow('Buyer', `${htmlSafe(buyer.contact)}<span class="qd-facts-sub">${htmlSafe(buyer.role)}</span>`) +
			factRow('Email', mailCell) +
			(buyer.phone ? factRow('Phone', htmlSafe(buyer.phone)) : '') +
			(record.acct
				? factRow('Joined', buyer.since)
				: factRow(
						'Deal',
						`<a class="qd-link" href="deal-details.html?id=${encodeURIComponent(record.deal)}">${htmlSafe(record.deal)}</a>`,
					));
		const customerLink = hook('cust-link');
		customerLink.hidden = !record.acct;
		if (record.acct) customerLink.href = `company-details.html?id=${encodeURIComponent(record.acct)}`;
	}

	function paintVersions() {
		const lastIndex = quote.versions.length - 1;
		const rows = quote.versions.map((version, index) => versionHtml(version, index, lastIndex));
		hook('versions').innerHTML = rows.reverse().join('');
	}

	function versionHtml(version, index, lastIndex) {
		const tally = totalsFor(version.lines);
		const tag = index === lastIndex ? '<span class="basalt-status basalt-status-primary">Current</span>' : '';
		const sideHtml =
			index === shownIndex
				? `<span class="qd-version-on">${index === lastIndex ? '' : 'Showing'}</span>`
				: `<button type="button" class="btn btn-outline-secondary btn-sm" data-qd-view="${index}" aria-label="Show version ${version.n}">Show</button>`;
		return `<li class="qd-version${index === shownIndex ? ' is-shown' : ''}"><span class="qd-version-n" aria-hidden="true">v${version.n}</span><span class="qd-version-text"><span class="qd-version-title">Version ${version.n} ${tag}</span><span class="qd-version-meta">${htmlSafe(version.summary)}</span><span class="qd-version-meta">${dateAndTime(version.saved)} · ${htmlSafe(version.by)}</span></span><span class="qd-version-side"><span class="qd-version-money">${dollars(tally.total)}</span>${sideHtml}</span></li>`;
	}

	/* The journal, newest first; each kind of entry keeps its own ramp color. */
	function paintJournal() {
		const ordered = journal.slice().sort((a, b) => b.t.localeCompare(a.t) || b.seq - a.seq);
		hook('activity').innerHTML = ordered
			.map(
				(entry) =>
					`<li class="qd-feed-item${entry.tone ? ` qd-feed-item-${entry.tone}` : ''}"><span class="qd-feed-icon qd-tone-${ICON_TONE[entry.icon] || 1}" aria-hidden="true"><i class="bi ${entry.icon}"></i></span><span class="qd-feed-text"><span>${entry.html}</span><span class="qd-feed-time">${dateAndTime(entry.t)}</span></span></li>`,
			)
			.join('');
	}

	/* What the buttons and the menu can do to the quote. */
	const ACTIONS = {
		accept: markAccepted,
		send: sendQuote,
		convert: openConvertDialog,
		order: () => goTo(INVOICES_PAGE),
		deal: () => goTo(`deal-details.html?id=${encodeURIComponent(record.deal)}`),
		sub: () => goTo(`subscription-details.html?id=${encodeURIComponent(record.account.sub)}`),
		requote: () => cloneQuote(true),
		remind: sendReminder,
		extend: extendValidity,
		copy: () => cloneQuote(false),
		pdf: () => window.print(),
		decline: openDeclineDialog,
	};

	function perform(action) {
		ACTIONS[action]?.();
	}

	function onRootClick(event) {
		const actionNode = event.target.closest('[data-qd-act]');
		if (actionNode) {
			perform(actionNode.getAttribute('data-qd-act'));
			return;
		}
		const versionButton = event.target.closest('[data-qd-view]');
		if (versionButton) {
			revealVersion(parseInt(versionButton.getAttribute('data-qd-view'), 10));
			return;
		}
		if (event.target.closest('[data-qd-current]')) {
			revealVersion(quote.versions.length - 1);
			return;
		}
		const copier = event.target.closest('[data-qd-copy]');
		if (copier && window.Basalt.copyText) {
			window.Basalt.copyText(copier.getAttribute('data-qd-copy'));
			notify({ tone: 'success', icon: 'bi-copy', title: 'Email address copied' });
		}
	}

	/** What an Undo puts back: the status fields and the journal's length. */
	function takeSnapshot() {
		return {
			status: quote.status,
			closed: quote.closed,
			reason: quote.reason,
			order: quote.order,
			until: quote.until,
			sent: quote.sent,
			sentVersion: quote.sentVersion,
			reminders: quote.reminders.slice(),
			events: journal.length,
		};
	}

	function rollBack(snapshot, message) {
		const { events: journalLength, ...fields } = snapshot;
		Object.assign(quote, fields);
		journal.length = journalLength;
		paint();
		sayAloud(message);
	}

	function finish(title, extra) {
		paint();
		notify({ tone: 'success', icon: 'bi-check2-circle', title, ...extra });
		sayAloud(title);
	}

	function markAccepted() {
		const before = takeSnapshot();
		quote.status = 'accepted';
		quote.closed = rightNow();
		jot(
			quote.closed,
			isPlan ? 'bi-pen' : 'bi-check2-circle',
			`<strong>${SIGNED_IN}</strong> recorded that ${htmlSafe(buyer.contact)}${isPlan ? ' signed' : ' accepted'}`,
			'won',
		);
		finish(`${quote.id}${isPlan ? ' marked signed' : ' marked accepted'}`, {
			text: isPlan ? `It starts on ${longDate(record.starts)}.` : 'Next, turn it into an order.',
			duration: 8000,
			actions: [{ label: 'Undo', onClick: () => rollBack(before, `${quote.id} back to sent`) }],
		});
	}

	function sendReminder() {
		const at = rightNow();
		quote.reminders.push(at);
		jot(at, 'bi-bell', `<strong>${SIGNED_IN}</strong> sent a reminder to ${htmlSafe(buyer.contact)}`);
		finish(`Reminder sent to ${buyer.contact}`, { icon: 'bi-bell', text: buyer.email });
	}

	function extendValidity() {
		quote.until = daysLater(todayStamp > quote.until ? todayStamp : quote.until, 14);
		jot(rightNow(), 'bi-calendar-plus', `<strong>${SIGNED_IN}</strong> extended it to ${shortDate(quote.until)}`);
		finish(`${quote.id} now valid until ${longDate(quote.until)}`, {
			icon: 'bi-calendar-plus',
			text: `${givenName(buyer.contact)} gets an email with the new date.`,
		});
	}

	function sendQuote() {
		const before = takeSnapshot();
		const at = rightNow();
		quote.status = 'sent';
		quote.sent = at;
		quote.sentVersion = latestVersion().n;
		quote.until = daysLater(at, latestVersion().valid);
		jot(
			at,
			'bi-send',
			`<strong>${SIGNED_IN}</strong> sent version ${quote.sentVersion} to ${htmlSafe(buyer.contact)}`,
		);
		finish(`${quote.id} sent to ${buyer.contact}`, {
			icon: 'bi-send',
			text: `Valid until ${longDate(quote.until)}.`,
			duration: 8000,
			actions: [{ label: 'Undo', onClick: () => rollBack(before, `${quote.id} back to a draft`) }],
		});
	}

	/** Every quote shares one numbering; a copy takes the next number. */
	function nextQuoteId() {
		const highest = Math.max(...LEDGER.quotes().map((row) => Number(row.id.replace(/\D/g, ''))));
		return `#${highest + 1}`;
	}

	function cloneQuote(fresh) {
		const freshId = nextQuoteId();
		notify({
			tone: 'success',
			icon: 'bi-copy',
			title: `${fresh ? `New draft for ${buyer.name}` : `${quote.id} copied`} as ${freshId}`,
			text: 'At today’s prices, saved as a draft.',
			actions: [{ label: 'Go to Quotes', onClick: () => goTo('quotes.html') }],
		});
		sayAloud(`${freshId} created`);
	}

	function revealVersion(index) {
		if (draft) return;
		shownIndex = index;
		paintPaper();
		paintVersions();
		const sheet = hook('doc');
		if (sheet.getBoundingClientRect().top < 0)
			sheet.scrollIntoView({ behavior: calmMotion() ? 'auto' : 'smooth', block: 'start' });
		sayAloud(
			index === quote.versions.length - 1
				? 'Showing the current version'
				: `Showing version ${quote.versions[index].n}`,
		);
	}

	/* Editing works on a copy of the latest version until Save pushes it. */
	function beginEdit(event) {
		const version = latestVersion();
		shownIndex = quote.versions.length - 1;
		draft = {
			n: version.n + 1,
			saved: rightNow(),
			by: SIGNED_IN,
			valid: version.valid,
			lines: version.lines.map((line) => line.slice()),
			note: version.note,
		};
		const radio = pick(`input[name="qdValid"][value="${version.valid}"]`);
		if (radio) radio.checked = true;
		ui.emailSwitch.checked = true;
		hook('edit-notify-label').textContent = `Email version ${draft.n} to ${givenName(buyer.contact)}`;
		paint();
		const firstQty = pick('[data-qd-qty]');
		if (event?.detail === 0 && firstQty) firstQty.focus();
		else hook('doc').focus({ preventScroll: true });
	}

	function leaveEdit() {
		draft = null;
		paint();
		ui.editButton.focus();
	}

	/* Quantities and the note update the working copy and the totals as typed. */
	function onPaperInput(event) {
		if (!draft) return;
		const qtyField = event.target.closest('[data-qd-qty]');
		if (qtyField) {
			const sku = qtyField.getAttribute('data-qd-qty');
			const qty = Math.max(1, parseInt(qtyField.value, 10) || 1);
			draft.lines.find(([used]) => used === sku)[1] = qty;
			pick(`[data-qd-amount="${sku}"]`).textContent = dollars(CATALOG[sku].price * qty);
			hook('totals').innerHTML = totalsBlock(draft.lines);
		}
		if (event.target === hook('note-field')) draft.note = event.target.value;
	}

	function onLineClick(event) {
		if (!draft) return;
		const remover = event.target.closest('[data-qd-rm]');
		if (!remover) return;
		const sku = remover.getAttribute('data-qd-rm');
		draft.lines = draft.lines.filter(([used]) => used !== sku);
		paintPaper();
		hook('add-product').focus();
		sayAloud(`${CATALOG[sku].name} removed`);
	}

	function addLine() {
		const sku = hook('add-product').value;
		if (!sku) return;
		draft.lines.push([sku, 1]);
		paintPaper();
		pick(`[data-qd-qty="${sku}"]`)?.focus();
		sayAloud(`${CATALOG[sku].name} added`);
	}

	/** What changed between two versions, in a few words each. */
	function changesBetween(before, after) {
		const changeList = [];
		const was = Object.fromEntries(before.lines);
		const kept = Object.fromEntries(after.lines);
		for (const [sku, qty] of after.lines) {
			if (!was[sku]) changeList.push(`${CATALOG[sku].name} added`);
			else if (was[sku] !== qty) changeList.push(`${CATALOG[sku].name} ${was[sku]} → ${qty}`);
		}
		for (const [sku] of before.lines) {
			if (!kept[sku]) changeList.push(`${CATALOG[sku].name} removed`);
		}
		if (before.valid !== after.valid) changeList.push(`valid for ${after.valid} days`);
		if (before.note.trim() !== after.note.trim()) changeList.push('note reworded');
		return changeList;
	}

	function saveDraft() {
		const before = latestVersion();
		draft.note = hook('note-field').value.trim();
		const changes = changesBetween(before, draft);
		if (!changes.length) {
			leaveEdit();
			notify({
				tone: 'info',
				icon: 'bi-info-circle',
				title: 'Nothing changed',
				text: `Version ${before.n} stays current.`,
			});
			return;
		}
		const version = draft;
		const at = rightNow();
		version.saved = at;
		version.summary = upperFirst(
			changes.slice(0, 2).join(', ') + (changes.length > 2 ? ` and ${changes.length - 2} more` : ''),
		);
		quote.versions.push(version);
		shownIndex = quote.versions.length - 1;
		quote.until = daysLater(at, version.valid);
		jot(
			at,
			'bi-pencil',
			`<strong>${SIGNED_IN}</strong> saved version ${version.n}: ${htmlSafe(changes.join(', '))}`,
		);
		const emailing = ui.emailSwitch.checked;
		if (emailing) {
			quote.sentBefore = (quote.sentBefore || []).concat(quote.sentVersion);
			quote.sent = at;
			quote.sentVersion = version.n;
			quote.reminders = [];
			jot(at, 'bi-send', `<strong>${SIGNED_IN}</strong> sent version ${version.n} to ${htmlSafe(buyer.contact)}`);
		}
		draft = null;
		finish(`Version ${version.n} saved`, {
			text: emailing
				? `Sent to ${buyer.contact}, valid until ${longDate(quote.until)}.`
				: `Not emailed. Prices held until ${longDate(quote.until)}.`,
		});
		ui.editButton.focus();
	}

	/* Turning a quote into an order: the dialog spells out what will happen. */
	function openConvertDialog() {
		const dialog = ui.convertDialog;
		const tally = totalsFor(latestVersion().lines);
		pick('[data-qd-c="sub"]', dialog).textContent = `${quote.id} for ${buyer.name}, ${dollars(tally.total)}.`;
		pick('[data-qd-c="plan"]', dialog).innerHTML = [
			`<li><i class="bi bi-check2" aria-hidden="true"></i><span>Order ${NEXT_ORDER} is created at the quoted prices<span class="qd-plan-sub">${countOf(latestVersion().lines.length, 'line')}, nothing re-priced</span></span></li>`,
			`<li><i class="bi bi-check2" aria-hidden="true"></i><span>${countOf(tally.units, 'item')} booked, ready by ${shortDate(workdaysLater(todayStamp, 2))}<span class="qd-plan-sub">Standard set-up, as quoted</span></span></li>`,
			`<li><i class="bi bi-check2" aria-hidden="true"></i><span>${record.terms === 'card' ? 'Charged to the card on file' : `Invoiced on ${record.terms}-day terms`}<span class="qd-plan-sub">The account’s usual way of paying</span></span></li>`,
		].join('');
		pick('[data-qd-c="notify"]', dialog).checked = true;
		pick('[data-qd-c="notify-label"]', dialog).textContent = `Email the order confirmation to ${buyer.contact}`;
		bootstrap.Modal.getOrCreateInstance(dialog).show();
	}

	function onConvertSubmit(event) {
		event.preventDefault();
		const emailing = pick('[data-qd-c="notify"]', ui.convertDialog).checked;
		const at = rightNow();
		if (quote.status !== 'accepted') {
			quote.status = 'accepted';
			quote.closed = at;
		}
		quote.order = NEXT_ORDER;
		jot(
			at,
			'bi-bag-check',
			`<strong>${SIGNED_IN}</strong> turned it into order <a class="qd-link" href="${INVOICES_PAGE}">${NEXT_ORDER}</a>`,
			'won',
		);
		bootstrap.Modal.getOrCreateInstance(ui.convertDialog).hide();
		finish(`${NEXT_ORDER} created from ${quote.id}`, {
			icon: 'bi-bag-check',
			text: emailing ? `Confirmation emailed to ${buyer.contact}.` : '',
			actions: [{ label: 'Open invoices', onClick: () => goTo(INVOICES_PAGE) }],
		});
	}

	function openDeclineDialog() {
		pick('[data-qd-d="sub"]', ui.declineDialog).textContent =
			`${quote.id} for ${buyer.name}. It moves to Lost on the Quotes page.`;
		pick('input[name="qdReason"]', ui.declineDialog).checked = true;
		bootstrap.Modal.getOrCreateInstance(ui.declineDialog).show();
	}

	function onDeclineSubmit(event) {
		event.preventDefault();
		const before = takeSnapshot();
		quote.status = 'declined';
		quote.closed = rightNow();
		quote.reason = pick('input[name="qdReason"]:checked', ui.declineDialog).value;
		jot(
			quote.closed,
			'bi-x-circle',
			`<strong>${SIGNED_IN}</strong> marked it declined: ${htmlSafe(quote.reason.toLowerCase())}`,
			'lost',
		);
		bootstrap.Modal.getOrCreateInstance(ui.declineDialog).hide();
		finish(`${quote.id} marked declined`, {
			tone: 'danger',
			icon: 'bi-x-circle',
			duration: 8000,
			actions: [{ label: 'Undo', onClick: () => rollBack(before, `${quote.id} back to sent`) }],
		});
	}

	start();
})();
