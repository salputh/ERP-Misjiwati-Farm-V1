/**
 * Basalt - Receipt Details (receipt-details.html)
 * One customer payment, opened from Receipts by its reference
 * (receipt-details.html?id=%2395900): the amount and where it stands,
 * who paid and for what, how it went from the charge to the bank, what
 * it cost to receive, and notes and activity. A failed or disputed
 * payment also gets a card with what went wrong and the ways to sort
 * it out.
 *
 * The payment comes from the shared billing book
 * (window.Basalt.data.billing, assets/basalt/js/data/multipurpose/billing.js), so it has the
 * same amount, customer and invoice as on Receipts and Invoices. The
 * fees and bank days below are the ones Receipts uses. In a real app,
 * load the payment from your payment provider instead and keep the
 * shapes.
 */
(() => {
	'use strict';
	const root = pick('[data-rd-root]');
	const billing = window.Basalt.data && window.Basalt.data.billing;
	if (!root || !billing) return;

	/* Demo data */
	/* The demo's "now". A deployed page would use new Date(). */
	const TODAY = billing.today;
	const NOW = `${TODAY} 10:40`;
	const BANK = 'Operating ···5182';
	const ME = 'John Armstrong';

	/* How each way of paying works: what it costs to receive and how many
     working days it takes to reach the bank. The same as on Receipts. */
	const METHOD = {
		card: {
			label: 'Card',
			days: 2,
			fee: (a) => round(a * 0.029 + 0.3),
			feeName: 'Card fee',
			feeNote: '2.9% + 30¢',
		},
		ach: {
			label: 'Bank transfer',
			days: 2,
			fee: (a) => Math.min(5, round(a * 0.008)),
			feeName: 'Bank transfer fee',
			feeNote: '0.8%, at most $5',
		},
		wire: { label: 'Wire', days: 0, fee: () => 15, feeName: 'Incoming wire fee', feeNote: 'Flat $15' },
		check: { label: 'Check', days: 3, fee: () => 0, feeName: 'Check deposit', feeNote: 'No fee' },
	};
	const DISPUTE_FEE = 15;
	/* A declined card is tried again on these days after the decline. */
	const RETRY_DAYS = [3, 5, 7];

	function start() {
		paidEl.addEventListener('shown.bs.modal', () => pd('method').focus());
		pd('date').addEventListener('input', () => pd('date').classList.remove('is-invalid'));
		paidForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const date = pd('date').value;
			if (!date || date > TODAY || date < p.at.slice(0, 10)) {
				pd('date').classList.add('is-invalid');
				pd('date').focus();
				return;
			}
			const method = pd('method').value;
			const ref = pd('ref').value.trim();
			p.method = method;
			p.from = method === 'check' ? `Check no. ${ref || 'not given'}` : METHOD[method].label;
			p.ref = ref;
			p.state = 'ok';
			p.recorded = ME;
			p.recordedAt = date + (date === TODAY ? ` ${NOW.slice(11)}` : ' 12:00');
			if (paidModal) paidModal.hide();
			activity.push({
				at: NOW,
				what: `Marked as paid by ${METHOD[method].label.toLowerCase()} by ${ME}`,
				icon: 'bi-cash-coin',
				fresh: true,
			});
			draw();
			toast({
				tone: 'success',
				icon: 'bi-cash-coin',
				title: 'Marked as paid',
				text: `${money(p.amount)} from ${who.name} by ${METHOD[method].label.toLowerCase()}.`,
			});
		});

		/* Actions */
		root.addEventListener('click', (e) => {
			const b = e.target.closest('[data-rd-act]');
			if (!b) return;
			const act = b.getAttribute('data-rd-act');
			if (act === 'refund') openRefund();
			else if (act === 'paid') openPaid();
			else if (act === 'download') {
				toast({
					tone: 'success',
					icon: 'bi-download',
					title: 'Receipt downloaded',
					text: `receipt-${p.id}.pdf, for ${money(p.amount)}.`,
				});
			} else if (act === 'email') {
				log(`Receipt emailed to <strong>${htmlSafe(who.contact)}</strong>`, 'bi-envelope-check');
				toast({
					tone: 'success',
					icon: 'bi-envelope-check',
					title: 'Receipt sent',
					text: `${who.contact} got it at ${who.email}.`,
				});
			} else if (act === 'remind') {
				log(`Email sent to <strong>${htmlSafe(who.contact)}</strong>`, 'bi-envelope');
				toast({
					tone: 'success',
					icon: 'bi-envelope',
					title: 'Email sent',
					text:
						p.state === 'failed'
							? `${who.contact} got a link to pay ${money(p.amount)} with another card.`
							: `${who.contact} got a note about the dispute.`,
				});
			} else if (act === 'retry') {
				p.retry = NOW;
				p.state = 'ok';
				activity.push({ at: NOW, what: `Card charged on retry by ${ME}`, icon: 'bi-credit-card', fresh: true });
				draw();
				toast({
					tone: 'success',
					icon: 'bi-credit-card',
					title: 'Card charged',
					text: `${money(p.amount)} went through this time. It reaches the bank on ${day(bankDay())}.`,
				});
				const first = pick('[data-rd-act]', actionsEl);
				if (first) first.focus();
			} else if (act === 'evidence') {
				p.evidenceSent = true;
				activity.push({
					at: NOW,
					what: `Evidence sent to the card network by ${ME}`,
					icon: 'bi-shield-check',
					fresh: true,
				});
				draw();
				toast({
					tone: 'success',
					icon: 'bi-shield-check',
					title: 'Evidence sent',
					text: 'The attendance list and the order went to the card network.',
				});
			}
		});

		/* Start */
		seed();
		draw();
	}

	/* Small helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
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

	function round(n) {
		return Math.round(n * 100) / 100;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	function toDate(s) {
		const [y, m, d] = s.slice(0, 10).split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	function iso(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function shiftDays(s, n) {
		const d = toDate(s);
		d.setDate(d.getDate() + n);
		return iso(d);
	}

	/* A no-break space keeps a day and its month on one line. */
	function day(s) {
		const d = toDate(s);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function dayYear(s) {
		return `${day(s)}, ${s.slice(0, 4)}`;
	}

	function hm12(t) {
		const h = +t.slice(0, 2);
		return `${h % 12 || 12}:${t.slice(3, 5)} ${h < 12 ? 'am' : 'pm'}`;
	}

	function dayTime(s) {
		return s.length > 10 ? `${day(s)}, ${hm12(s.slice(11, 16))}` : day(s);
	}

	function money(n) {
		return `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function initials(name) {
		return name
			.replace(/[^A-Za-z ]/g, '')
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase();
	}

	function toneOf(name) {
		return (Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 6) + 1;
	}

	function firstName(n) {
		return n.split(' ')[0];
	}

	/* Working days only: money doesn't move between banks on the weekend. */
	function addWorkdays(s, n) {
		const d = toDate(s);
		let left = n;
		while (left > 0) {
			d.setDate(d.getDate() + 1);
			if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
		}
		return iso(d);
	}

	/* The payment
	   ?id= picks it; an unknown or missing id opens the newest one. */
	const all = billing.payments();
	const wanted = new URLSearchParams(location.search).get('id');
	const p = all.find((x) => x.id === wanted) || all[0];
	if (!p) return;
	/* Purchases paid back this month, from the same book as Refunds. */
	billing.refunds().forEach((r) => {
		if (p.for[0] !== 'purchase' || p.for[1] !== r.no || p.state !== 'ok') return;
		const amount = round(r.lines.reduce((s, l) => s + l.amount, 0) + (r.tax ? r.tax.amount : 0));
		p.refund = { amount, reason: r.reason, on: r.on, by: ME };
	});
	const who = billing.billTo(p.acct) || { name: p.customer, account: p.acct, contact: p.customer, email: '' };
	const invoice = p.for[0] === 'invoice' ? billing.find(p.for[1]) : null;
	const purchase = p.for[0] === 'purchase' ? billing.purchase(p.for[1]) : null;
	const activity = [];
	const notes = [];
	/* A declined card keeps its automatic retries in the history after a
     retry by hand or a payment by other means. */
	const declined = p.state === 'failed' && p.method === 'card';
	const declinedAt = p.at;

	function charged() {
		return p.retry || p.recordedAt || p.at;
	}
	function settleDay() {
		return addWorkdays(charged(), Math.min(1, METHOD[p.method].days));
	}
	function bankDay() {
		return addWorkdays(charged(), METHOD[p.method].days);
	}
	function fee() {
		return p.state === 'failed' ? 0 : METHOD[p.method].fee(p.amount);
	}
	function status() {
		if (p.state === 'ok' && p.refund && p.refund.amount >= p.amount) return 'refunded';
		if (p.state === 'ok') return bankDay() <= TODAY ? 'bank' : 'clearing';
		return p.state;
	}
	const STATUS = {
		bank: { word: 'In the bank', tone: 'success' },
		clearing: { word: 'Clearing', tone: 'info' },
		failed: { word: 'Failed', tone: 'danger' },
		disputed: { word: 'Disputed', tone: 'warning' },
		refunded: { word: 'Refunded', tone: '' },
	};

	function forLabel() {
		return (p.for[0] === 'purchase' ? 'Order ' : 'Invoice ') + p.for[1];
	}

	function forHref() {
		return p.for[0] === 'purchase'
			? `company-details.html?id=${encodeURIComponent(p.acct)}`
			: `invoice-details.html?id=${encodeURIComponent(p.for[1])}`;
	}

	function forItem() {
		return invoice ? invoice.item : purchase ? purchase.item : '';
	}

	function customerHref() {
		return `company-details.html?id=${encodeURIComponent(who.account || p.acct)}`;
	}

	/* "Visa ending 1087" reads as "Visa ···1087" in tight places. */
	function cardShort(s) {
		return s.replace(/ ending /, ' ···');
	}

	function paidBy() {
		if (p.method === 'card') return cardShort(p.from);
		if (p.method === 'check') return p.from.replace('Check no. ', 'Check ');
		return METHOD[p.method].label;
	}
	function paidFrom() {
		if (p.method === 'card') return 'Card on file';
		if (p.method === 'check') return p.recorded ? `Recorded by ${p.recorded}` : 'Deposited at the bank';
		return p.recorded ? `Recorded by ${p.recorded}` : `From ${p.from}`;
	}

	/* Automatic retries of a declined card: the ones already tried and the
     next one, at the time of the first decline. */
	function retries() {
		if (!declined) return { past: [], next: null, total: 0 };
		const time = declinedAt.slice(10);
		/* Once paid, the tries left are called off. */
		const until = p.state === 'failed' ? NOW : charged();
		const at = RETRY_DAYS.map((n) => shiftDays(declinedAt, n) + time);
		return { past: at.filter((t) => t <= until), next: at.find((t) => t > NOW) || null, total: at.length };
	}

	/* Where a refund goes: the card, or the account the money came from. */
	function refundTo() {
		return p.method === 'card'
			? cardShort(p.from)
			: p.recorded || p.method === 'check'
				? 'their bank account'
				: p.from;
	}

	/* The payout batch a card payment lands in: one per bank day. */
	function payoutRef() {
		return `#${bankDay().slice(2).replace(/-/g, '')}`;
	}

	/* Header */
	const actionsEl = pick('[data-rd="actions"]', root);
	function btn(kind, label, act, icon) {
		const cls = kind === 'primary' ? 'btn btn-primary btn-sm' : 'btn btn-outline-secondary btn-sm';
		return `<button type="button" class="${cls}" data-rd-act="${act}">${icon ? `<i class="bi ${icon} me-1" aria-hidden="true"></i>` : ''}${label}</button>`;
	}
	function drawHead() {
		const m = pick('[data-rd="mark"]', root);
		m.className = `basalt-avatar basalt-avatar-xl rd-mark basalt-avatar-tone-${toneOf(who.name)}`;
		m.textContent = initials(who.name);
		pick('[data-rd="amount"]', root).textContent = money(p.amount);
		const verb = p.state === 'failed' ? 'Owed by ' : 'Paid by ';
		/* The order or invoice number stays on one line. */
		pick('[data-rd="sub"]', root).innerHTML =
			`${htmlSafe(`${verb + who.name} for ${p.for[0] === 'purchase' ? 'order ' : 'invoice '}`)}<span class="rd-nowrap">${htmlSafe(p.for[1])}</span>.`;
		const s = STATUS[status()];
		let tags = `<span class="basalt-status basalt-status-dot${s.tone ? ` basalt-status-${s.tone}` : ''}">${s.word}</span>`;
		if (p.refund && status() !== 'refunded')
			tags += `<span class="rd-tag">Refunded ${money(p.refund.amount)}</span>`;
		pick('[data-rd="tags"]', root).innerHTML = tags;
		document.title = `Receipt ${p.id} · Basalt`;

		let acts = '';
		if (p.state === 'failed')
			acts = `<a class="btn btn-outline-secondary btn-sm" href="${forHref()}"><i class="bi bi-receipt me-1" aria-hidden="true"></i>Open ${p.for[0] === 'purchase' ? 'account' : 'invoice'}</a>`;
		else {
			if (p.state === 'ok' && !p.refund) acts += btn('ghost', 'Refund', 'refund', 'bi-arrow-counterclockwise');
			acts += btn('ghost', 'Download receipt', 'download', 'bi-download');
			acts += btn('primary', 'Email receipt', 'email', 'bi-envelope');
		}
		actionsEl.innerHTML = acts;
	}

	/* What went wrong */
	const issueEl = pick('[data-rd="issue"]', root);
	function drawIssue() {
		const failed = p.state === 'failed';
		issueEl.hidden = !failed && p.state !== 'disputed';
		if (issueEl.hidden) return;
		const facts = [];
		let actions = '';
		if (failed) {
			const r = retries();
			pick('[data-rd="issue-title"]', root).textContent = 'The card was declined';
			pick('[data-rd="issue-text"]', root).textContent =
				`${p.why} ${firstName(who.contact)} got an email asking for another card.`;
			facts.push(['Owed', money(p.amount)]);
			facts.push(['Declined', dayTime(p.at)]);
			facts.push([
				'Next retry',
				r.next
					? `${dayTime(r.next)} <span class="rd-quiet">(${r.past.length + 1} of ${r.total})</span>`
					: `None left. All ${r.total} tries declined`,
			]);
			actions =
				btn('primary', 'Retry now', 'retry', 'bi-arrow-repeat') +
				btn('ghost', 'Email the customer', 'remind', 'bi-envelope') +
				btn('ghost', 'Mark as paid by other means', 'paid', 'bi-cash-coin');
		} else {
			const d = p.dispute;
			pick('[data-rd="issue-title"]', root).textContent = p.evidenceSent
				? 'Evidence sent'
				: 'The customer disputed this charge';
			pick('[data-rd="issue-text"]', root).textContent = p.evidenceSent
				? `The card network has your side and decides by ${day(addWorkdays(TODAY, 17))}. If it agrees, the ${money(p.amount)} comes back.`
				: `${who.name} told their bank: ${d.reason.toLowerCase()}. ${d.by} ran the session on ${day(d.held)} and ${d.attended} attended.`;
			facts.push(['Held back', money(p.amount)]);
			facts.push(['Opened', day(d.opened)]);
			facts.push([
				p.evidenceSent ? 'Decision by' : 'Evidence due',
				p.evidenceSent ? day(addWorkdays(TODAY, 17)) : day(d.due),
			]);
			if (!p.evidenceSent)
				actions =
					btn('primary', 'Send evidence', 'evidence', 'bi-shield-check') +
					btn('ghost', 'Email the customer', 'remind', 'bi-envelope');
		}
		pick('[data-rd="issue-facts"]', root).innerHTML = facts
			.map((f) => `<div class="rd-issue-fact"><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`)
			.join('');
		const act = pick('[data-rd="issue-actions"]', root);
		act.innerHTML = actions;
		act.hidden = !actions;
	}

	/* Who paid, for what, when and how */
	function drawFacts() {
		const rows = [
			[
				'Customer',
				`<a class="rd-link" href="${customerHref()}">${htmlSafe(who.name)}</a>`,
				htmlSafe(who.contact),
			],
			['Paid for', `<a class="rd-link" href="${forHref()}">${htmlSafe(forLabel())}</a>`, htmlSafe(forItem())],
			['Date', htmlSafe(dayYear(p.at)), htmlSafe(hm12(p.at.slice(11, 16)))],
			['Paid by', htmlSafe(paidBy()), htmlSafe(paidFrom())],
			[
				'Reference',
				`<span class="rd-ref">${htmlSafe(p.id)}</span>`,
				htmlSafe(p.method === 'card' ? 'From the card processor' : 'From the bank'),
			],
		];
		pick('[data-rd="facts"]', root).innerHTML = rows
			.map(
				(r) =>
					`<div class="rd-fact"><dt>${r[0]}</dt><dd><span class="rd-fact-main">${r[1]}</span>${r[2] ? `<span class="rd-fact-sub">${r[2]}</span>` : ''}</dd></div>`,
			)
			.join('');
	}

	/* Timeline
	   [what, when, kind]: kind is done (default), wait (still to come),
	   bad (went wrong) or back (money returned). */
	function steps() {
		const out = [];
		const first = {
			card: 'Card charged',
			ach: 'Bank transfer started',
			wire: 'Wire received',
			check: 'Check deposited',
		};
		if (!declined) out.push([first[p.method], dayTime(p.at)]);
		else {
			out.push(['Card declined', dayTime(declinedAt), 'bad']);
			out.push([`${firstName(who.contact)} emailed to update the card`, dayTime(declinedAt)]);
			retries().past.forEach((t, i) => out.push([`Automatic retry ${i + 1} declined`, dayTime(t), 'bad']));
		}
		if (p.state === 'failed') {
			const r = retries();
			out.push(
				r.next
					? ['Next automatic retry', dayTime(r.next), 'wait']
					: ['No automatic retries left', 'Retry by hand or ask for another card', 'wait'],
			);
			return out;
		}
		if (p.retry) out.push([`Card charged on retry by ${ME}`, dayTime(p.retry)]);
		if (p.recorded) out.push([`${METHOD[p.method].label} received, recorded by ${ME}`, day(p.recordedAt)]);
		if (METHOD[p.method].days > 0) {
			const s = settleDay();
			out.push(s <= TODAY ? ['Settled', day(s)] : ['Settles', `Expected ${day(s)}`, 'wait']);
		}
		const b = bankDay();
		out.push(b <= TODAY ? [`Paid out to ${BANK}`, day(b)] : [`Paid out to ${BANK}`, `Expected ${day(b)}`, 'wait']);
		if (p.state === 'disputed') {
			const d = p.dispute;
			out.push([`Session run by ${d.by}, attended by ${d.attended}`, day(d.held)]);
			out.push([`Dispute opened: ${d.reason.toLowerCase()}`, day(d.opened), 'bad']);
			if (p.evidenceSent)
				out.push(
					[`Evidence sent by ${ME}`, day(TODAY)],
					['Card network decides', `By ${day(addWorkdays(TODAY, 17))}`, 'wait'],
				);
			else out.push(['Evidence due', day(d.due), 'wait']);
		}
		if (p.refund) out.push([`Refunded ${money(p.refund.amount)} to ${refundTo()}`, day(p.refund.on), 'back']);
		/* Steps are listed in the order they happen; dated ones before what's to come. */
		return out;
	}
	function stepsDesc() {
		if (p.state === 'failed') return 'From the decline to the next try.';
		if (status() === 'clearing') return `On its way: in ${BANK} by ${day(bankDay())}.`;
		return `From the ${p.method === 'card' ? 'charge' : 'payment'} to ${BANK}.`;
	}
	function drawSteps() {
		pick('[data-rd="steps-desc"]', root).textContent = stepsDesc();
		pick('[data-rd="steps"]', root).innerHTML = steps()
			.map(
				(s) =>
					`<li class="rd-step${s[2] ? ` rd-step-${s[2]}` : ''}"><span class="rd-step-what">${htmlSafe(s[0])}</span><span class="rd-step-when">${htmlSafe(s[1])}</span></li>`,
			)
			.join('');
	}

	/* Fees and payout */
	function drawMoney() {
		const m = METHOD[p.method];
		const rows = [];
		let net = p.amount;
		let desc;
		if (p.state === 'failed') {
			rows.push(
				['Charge', 'Declined', p.amount],
				[m.feeName, 'Not charged on a decline', 0],
				['Collected so far', '', 0, 'total'],
			);
			desc = 'Nothing has reached the bank yet.';
		} else {
			const f = fee();
			rows.push(['Paid', '', p.amount], [m.feeName, m.feeNote, -f]);
			net -= f;
			if (p.state === 'disputed') {
				rows.push(
					['Held for the dispute', `Since ${day(p.dispute.opened)}`, -p.amount],
					['Dispute fee', 'Kept even if you win', -DISPUTE_FEE],
				);
				net -= p.amount + DISPUTE_FEE;
			}
			if (p.refund) {
				rows.push(['Refunded', p.refund.reason, -p.refund.amount]);
				net -= p.refund.amount;
			}
			rows.push([
				p.state === 'disputed' ? 'Net, for now' : p.refund ? 'Kept, after the refund' : 'Net to the bank',
				'',
				round(net),
				'total',
			]);
			desc = f
				? `${money(f)} in fees, ${Math.round((f / p.amount) * 1000) / 10}% of the payment.`
				: 'No fee on this one.';
		}
		pick('[data-rd="money-desc"]', root).textContent = desc;
		pick('[data-rd="money"]', root).innerHTML = rows
			.map(
				(r) =>
					`<li class="rd-line${r[3] ? ' rd-line-total' : ''}"><span class="rd-line-text"><span class="rd-line-name">${htmlSafe(r[0])}</span>${r[1] ? `<span class="rd-line-note">${htmlSafe(r[1])}</span>` : ''}</span><span class="rd-line-amt">${money(r[2])}</span></li>`,
			)
			.join('');

		const payout = [];
		if (p.state !== 'failed') {
			const b = bankDay();
			payout.push(['Paid out to', htmlSafe(BANK)]);
			payout.push([b <= TODAY ? 'Arrived' : 'Arrives', htmlSafe(dayYear(b))]);
			payout.push(
				p.method === 'card'
					? ['Payout', `<span class="rd-ref">${payoutRef()}</span>`]
					: ['Bank reference', `<span class="rd-ref">${htmlSafe(p.ref || p.id)}</span>`],
			);
		} else {
			payout.push(['Pays out to', htmlSafe(BANK)]);
			payout.push(['Card on file', htmlSafe(cardShort(p.from))]);
		}
		pick('[data-rd="payout"]', root).innerHTML = payout
			.map((r) => `<div class="rd-payout-row"><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`)
			.join('');
	}

	/* Notes and activity */
	function seed() {
		const contact = who.contact;

		function by(t, what, icon) {
			return activity.push({ at: t, what, icon });
		}

		if (p.for[0] === 'invoice' && p.state !== 'failed')
			by(p.at, `Matched to <strong>${htmlSafe(p.for[1])}</strong> automatically`, 'bi-link-45deg');
		if (p.state === 'failed') {
			by(p.at, `Decline email sent to <strong>${htmlSafe(contact)}</strong>`, 'bi-envelope');
			retries().past.forEach((t, i) => by(t, `Automatic retry ${i + 1} declined`, 'bi-arrow-repeat'));
			if (retries().past.length)
				notes.push({
					text: `Left a voicemail for ${firstName(contact)}. Their office says a new card is on the way.`,
					by: 'Courtney Lowry',
					at: retries().past[0],
				});
		} else {
			by(p.at, `Receipt emailed to <strong>${htmlSafe(contact)}</strong>`, 'bi-envelope-check');
		}
		if (p.state === 'disputed') {
			by(
				`${p.dispute.opened} 09:00`,
				`Dispute opened by the card network: ${htmlSafe(p.dispute.reason.toLowerCase())}`,
				'bi-shield-exclamation',
			);
			notes.push({
				text: `Attendance list for ${p.dispute.session} is in the shared drive. ${p.dispute.by} can confirm who joined.`,
				by: p.dispute.by,
				at: `${p.dispute.opened} 14:20`,
			});
		}
		if (p.refund)
			by(
				`${p.refund.on} 10:00`,
				`Refunded <strong>${money(p.refund.amount)}</strong> by ${htmlSafe(p.refund.by)}: ${htmlSafe(p.refund.reason.toLowerCase())}`,
				'bi-arrow-counterclockwise',
			);
	}
	function log(what, icon) {
		activity.push({ at: NOW, what: `${what} by ${ME}`, icon, fresh: true });
		drawActivity();
	}
	function drawActivity() {
		const list = activity.slice().sort((a, b) => b.at.localeCompare(a.at));
		pick('[data-rd="activity"]', root).innerHTML = list
			.map(
				(a) =>
					`<li class="rd-feed-item${a.fresh ? ' is-fresh' : ''}"><span class="rd-feed-icon" aria-hidden="true"><i class="bi ${a.icon}"></i></span><span class="rd-feed-text"><span>${a.what}</span><span class="rd-feed-time">${dayTime(a.at)}</span></span></li>`,
			)
			.join('');
	}
	function drawNotes() {
		const list = notes.slice().sort((a, b) => b.at.localeCompare(a.at));
		pick('[data-rd="notes"]', root).innerHTML = list
			.map(
				(n) =>
					`<li class="rd-note${n.fresh ? ' is-fresh' : ''}"><p class="rd-note-text">${htmlSafe(n.text)}</p><p class="rd-note-meta">${htmlSafe(n.by)} · ${dayTime(n.at)}</p></li>`,
			)
			.join('');
		pick('[data-rd="notes-none"]', root).hidden = list.length > 0;
	}
	const noteSheet = pick('[data-rd-note-form]', root);
	const noteField = pick('[data-rd-note]', root);
	const noteError = pick('[data-rd-note-error]', root);
	noteSheet.addEventListener('submit', (e) => {
		e.preventDefault();
		const text = noteField.value.trim();
		if (!text) {
			noteField.classList.add('is-invalid');
			noteError.hidden = false;
			noteField.focus();
			return;
		}
		notes.push({ text, by: ME, at: NOW, fresh: true });
		noteField.value = '';
		drawNotes();
		toast({
			tone: 'success',
			icon: 'bi-journal-check',
			title: 'Note added',
			text: 'Your team can see it on this payment.',
		});
	});
	noteField.addEventListener('input', () => {
		noteField.classList.remove('is-invalid');
		noteError.hidden = true;
	});

	function draw() {
		drawHead();
		drawIssue();
		drawFacts();
		drawSteps();
		drawMoney();
		drawNotes();
		drawActivity();
	}

	/* Refund */
	const refundEl = document.getElementById('rd-refund');
	const refundModal = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(refundEl) : null;
	const refundForm = pick('[data-rd-refund-form]', refundEl);

	function rf(k) {
		return pick(`[data-rd-rf="${k}"]`, refundEl);
	}

	function refundAmount() {
		return round(parseFloat(String(rf('amount').value).replace(/[$,\s]/g, '')));
	}

	function refundLabel() {
		const a = refundAmount();
		rf('go').textContent = a > 0 && a <= p.amount ? `Refund ${money(a)}` : 'Refund';
	}
	function openRefund() {
		refundForm.reset();
		rf('amount').classList.remove('is-invalid');
		rf('amount').value = p.amount.toFixed(2);
		rf('max').textContent = money(p.amount);
		rf('sub').textContent = `Back to ${refundTo()}, for ${forLabel()}.`;
		rf('hint').textContent = `Up to ${money(p.amount)}. The ${money(fee())} fee is not returned.`;
		refundLabel();
		if (refundModal) refundModal.show();
	}
	refundEl.addEventListener('shown.bs.modal', () => {
		rf('amount').focus();
		rf('amount').select();
	});
	rf('amount').addEventListener('input', () => {
		rf('amount').classList.remove('is-invalid');
		refundLabel();
	});
	refundForm.addEventListener('submit', (e) => {
		e.preventDefault();
		const amount = refundAmount();
		if (!(amount > 0) || amount > p.amount) {
			rf('amount').classList.add('is-invalid');
			rf('amount').focus();
			return;
		}
		p.refund = { amount, reason: rf('reason').value, on: TODAY, by: ME };
		if (refundModal) refundModal.hide();
		activity.push({
			at: NOW,
			what: `Refunded <strong>${money(amount)}</strong> by ${ME}: ${htmlSafe(p.refund.reason.toLowerCase())}`,
			icon: 'bi-arrow-counterclockwise',
			fresh: true,
		});
		draw();
		toast({
			tone: 'success',
			icon: 'bi-arrow-counterclockwise',
			title: `${money(amount)} refunded`,
			text: `Back to ${refundTo()} in 5 to 10 days.`,
			actions: [
				{
					label: 'Open refunds',
					onClick: () => {
						window.location.href = 'refunds.html';
					},
				},
			],
		});
	});

	/* Paid another way */
	const paidEl = document.getElementById('rd-paid');
	const paidModal = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(paidEl) : null;
	const paidForm = pick('[data-rd-paid-form]', paidEl);

	function pd(k) {
		return pick(`[data-rd-pd="${k}"]`, paidEl);
	}

	function openPaid() {
		paidForm.reset();
		pd('date').classList.remove('is-invalid');
		pd('date').value = TODAY;
		pd('date').min = p.at.slice(0, 10);
		pd('date').max = TODAY;
		pd('sub').textContent = `${money(p.amount)} from ${who.name}, for ${forLabel()}.`;
		if (paidModal) paidModal.show();
	}
	start();
})();
