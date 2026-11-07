/**
 * Basalt - Expense Details (expense-details.html)
 * One expense claim in full: the decision with its policy checks and
 * approval trail, the receipt, the details (edited in place), the
 * payout, the comments and the history.
 *
 * The claim comes from the shared expense book
 * (assets/basalt/js/data/multipurpose/expenses.js); ?id=%23450 picks which one.
 * Changes made here live in memory for the demo; in your app, send
 * them to the server where the toasts are pushed.
 */
(() => {
	'use strict';
	const BOOK = window.Basalt.data.expenses;
	const TODAY = BOOK.today;
	const ME = BOOK.me;
	const CATS = BOOK.categories;
	const STATUSES = BOOK.statuses;
	const FROM_ACCOUNT = 'Operating ···5182';
	const DEFAULT_ID = '#450';

	/* Helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}

	function money(n) {
		return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	function day(iso) {
		const p = iso.split('-');
		return `${MONTHS[+p[1] - 1]} ${+p[2]}`;
	}

	function weekday(iso) {
		return DAYS[new Date(`${iso}T12:00`).getDay()];
	}

	function clock(hhmm) {
		const h = +hhmm.slice(0, 2);
		return `${((h + 11) % 12) + 1}:${hhmm.slice(3, 5)}${h < 12 ? ' am' : ' pm'}`;
	}

	function stamp(at) {
		return `${at.slice(0, 10) === TODAY ? 'Today' : day(at.slice(0, 10))}, ${clock(at.slice(11, 16))}`;
	}

	function dayGap(a, b) {
		return Math.round((new Date(`${b}T12:00`) - new Date(`${a}T12:00`)) / 864e5);
	}

	function first(name) {
		return name.split(' ')[0];
	}

	function pageOf(c) {
		return `expense-details.html?id=${encodeURIComponent(c.id)}`;
	}

	const approverOf = BOOK.approverOf;

	function mine(c) {
		return approverOf(c) === ME;
	}

	function nameOrYou(name) {
		return name === ME ? 'You' : name;
	}

	/* The clock for today's changes; in your app this is the server's time.
     The counter keeps changes made in the same minute in order. */
	let seq = 0;

	function now() {
		const d = new Date();
		seq += 1;
		return `${TODAY}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(seq).padStart(2, '0')}`;
	}

	/* A steady time of day for each event, seeded by the claim number, so
     the same claim shows the same times on every load. */
	function timeOn(c, iso, salt) {
		const n = (Number(c.id.replace(/\D/g, '')) * 7 + salt * 13) % 540;
		return `${iso}T${String(8 + Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
	}

	/* The claim */
	const asked = new URLSearchParams(window.location.search).get('id');
	const C = BOOK.claims.find((x) => x.id === asked) || BOOK.claims.find((x) => x.id === DEFAULT_ID);
	const ui = { ask: null, editing: false };

	/* Every claim, newest first: the order of All claims on the list. */
	const ORDER = BOOK.claims.slice().sort((a, b) => b.spent.localeCompare(a.spent) || b.id.localeCompare(a.id));

	/* Policy */
	/* Each check says pass, warn (a person should look) or fail (it
     can't be approved like this). */
	function checks(c) {
		const k = CATS[c.cat];
		const out = [];
		if (c.receipt && c.receipt.lines) {
			const total = c.receipt.lines.reduce((s, l) => s + l[1], 0);
			out.push(
				Math.abs(total - c.amount) < 0.01
					? { s: 'pass', t: 'Receipt attached', n: `${c.receipt.shop}, ${money(total)}, matches the claim.` }
					: {
							s: 'warn',
							t: 'Receipt doesn’t match',
							n: `The receipt comes to ${money(total)}, the claim to ${money(c.amount)}.`,
						},
			);
		} else if (c.receipt) {
			out.push({ s: 'pass', t: 'Receipt attached', n: `Attached on ${day(TODAY)}.` });
		} else if (c.amount <= 25) {
			out.push({ s: 'pass', t: 'No receipt needed', n: 'Claims up to $25 don’t need one.' });
		} else {
			out.push({ s: 'fail', t: 'No receipt', n: 'Claims over $25 need one before they can be approved.' });
		}
		if (c.cat === 'meals' && c.heads) {
			const per = c.amount / c.heads;
			out.push(
				per <= k.perHead
					? {
							s: 'pass',
							t: 'Within the meal limit',
							n: `${money(per)} a head for ${c.heads} people. The limit is $${k.perHead}.`,
						}
					: {
							s: 'warn',
							t: 'Over the meal limit',
							n: `${money(per)} a head for ${c.heads} people, ${money(per - k.perHead)} over the $${k.perHead} limit.`,
						},
			);
		} else if (c.cat === 'travel' && c.nights) {
			const per = c.amount / c.nights;
			out.push(
				per <= k.perNight
					? {
							s: 'pass',
							t: 'Within the hotel limit',
							n: `${money(per)} a night for ${c.nights} nights. The limit is $${k.perNight}.`,
						}
					: {
							s: 'warn',
							t: 'Over the hotel limit',
							n: `${money(per)} a night, ${money(per - k.perNight)} over the $${k.perNight} limit.`,
						},
			);
		} else if (c.cat === 'mileage' && c.miles) {
			const due = Math.round(c.miles * k.perMile * 100) / 100;
			out.push(
				Math.abs(due - c.amount) < 0.01
					? {
							s: 'pass',
							t: 'Mileage at the standard rate',
							n: `${c.miles} miles at ${money(k.perMile)} a mile.`,
						}
					: {
							s: 'warn',
							t: 'Mileage doesn’t match the rate',
							n: `${c.miles} miles at ${money(k.perMile)} comes to ${money(due)}.`,
						},
			);
		} else {
			out.push(
				c.amount <= k.limit
					? {
							s: 'pass',
							t: `Within the ${k.label.toLowerCase()} limit`,
							n: `Up to $${k.limit.toLocaleString('en-US')} a claim.`,
						}
					: {
							s: 'warn',
							t: `Over the ${k.label.toLowerCase()} limit`,
							n: `${money(c.amount - k.limit)} over the $${k.limit.toLocaleString('en-US')} a claim.`,
						},
			);
		}
		const late = dayGap(c.spent, c.sent);
		out.push(
			late <= 60
				? {
						s: 'pass',
						t: 'Sent on time',
						n: `${late === 0 ? 'Sent the day it was spent.' : `Sent ${late}${late === 1 ? ' day' : ' days'} after it was spent.`} The limit is 60 days.`,
					}
				: { s: 'warn', t: 'Sent late', n: `Sent ${late} days after it was spent. The limit is 60 days.` },
		);
		const twin = BOOK.claims.find(
			(x) => x !== c && x.who === c.who && x.spent === c.spent && Math.abs(x.amount - c.amount) < 0.01,
		);
		out.push(
			twin
				? { s: 'warn', t: 'Might be claimed twice', n: `${twin.id} has the same day and amount.` }
				: {
						s: 'pass',
						t: 'Not claimed before',
						n: `No other claim from ${first(c.who)} has this day and amount.`,
					},
		);
		return out;
	}

	/* Small pieces */
	function pill(c) {
		return `<span class="basalt-status basalt-status-dot basalt-status-${STATUSES[c.status].tone}">${STATUSES[c.status].label}</span>`;
	}

	function categoryChip(c) {
		return `<span class="ed-cat" data-cat="${c.cat}"><span class="ed-cat-icon" aria-hidden="true"><i class="bi ${CATS[c.cat].icon}"></i></span>${CATS[c.cat].label}</span>`;
	}

	function avatar(name, size) {
		return `<span class="basalt-avatar ${size || 'basalt-avatar-sm'}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function customerLink(name) {
		if (!name) return '';
		const id = BOOK.customers[name];
		return id
			? `<a class="ed-link" href="company-details.html?id=${encodeURIComponent(id)}">${htmlSafe(name)}</a>`
			: htmlSafe(name);
	}

	function staffLink(name) {
		const staff = BOOK.people[name].staff;
		return staff
			? `<a class="ed-link" href="employee-details.html?id=${encodeURIComponent(staff)}">${htmlSafe(name)}</a>`
			: htmlSafe(name);
	}

	function lastReply(c) {
		const list = thread(c);
		const from = list.length ? list[list.length - 1] : null;
		return from && from.who !== approverOf(c) ? from : null;
	}

	/* Header */
	function paintHead(c) {
		pick('[data-ed="title"]').textContent = c.desc;
		pick('[data-ed="sub"]').textContent = `${c.id} · ${c.who}, ${BOOK.people[c.who].role.toLowerCase()}`;
		pick('[data-ed="tags"]').innerHTML = pill(c) + categoryChip(c);
		const at = ORDER.indexOf(c);

		for (const [k, to] of [
			['prev', ORDER[at - 1]],
			['next', ORDER[at + 1]],
		]) {
			const a = pick(`[data-ed="${k}"]`);
			if (to) {
				a.href = pageOf(to);
				a.classList.remove('disabled');
				a.removeAttribute('aria-disabled');
				a.removeAttribute('tabindex');
			} else {
				a.removeAttribute('href');
				a.classList.add('disabled');
				a.setAttribute('aria-disabled', 'true');
				a.setAttribute('tabindex', '-1');
			}
		}

		for (const b of pickAll('[data-ed-download]')) {
			(b.closest('li') || b).hidden = !c.receipt;
		}
	}

	/* Decision */
	function stateText(c) {
		const name = first(c.who);
		const by = nameOrYou(approverOf(c));
		const reply = lastReply(c);
		switch (c.status) {
			case 'waiting':
				return (
					(mine(c)
						? `Sent by ${name} on ${day(c.sent)} and waiting for you.`
						: `Sent on ${day(c.sent)} and waiting for ${approverOf(c)}.`) +
					(c.receipt ? '' : ' It can’t be approved until the receipt is attached.')
				);
			case 'queried':
				return `${by} sent it back on ${day(c.queried.on)} with a question.${reply ? ` ${nameOrYou(reply.who)} replied on ${day(reply.at.slice(0, 10))}.` : ` It comes back once ${name} answers.`}`;
			case 'approved':
				return `${by} approved it on ${day(c.approved)}. It goes out in the payout on ${weekday(BOOK.nextPayout)}, ${day(BOOK.nextPayout)}.`;
			case 'paid':
				return `Approved on ${day(c.approved)} and paid to ${name} on ${day(c.paid)}.`;
			default:
				return `${by} rejected it on ${day(c.rejected.on)}. It won’t be paid.`;
		}
	}
	function sumHtml(c) {
		return `<div class="ed-sum-who">${avatar(c.who, 'basalt-avatar-lg')}<div><p class="ed-sum-label">${htmlSafe(c.who)} claims</p><p class="ed-sum-amount">${money(c.amount)}</p></div></div><p class="ed-sum-meta">${categoryChip(c)}<span>Spent ${day(c.spent)}</span><span>${htmlSafe(c.paidWith)}</span></p>`;
	}
	function stepsHtml(c) {
		const by = nameOrYou(approverOf(c));
		const review = {
			waiting: {
				k: 'now',
				tone: 'warning',
				t: 'Review',
				n: mine(c) ? 'Waiting for you' : `With ${approverOf(c)}`,
			},
			queried: { k: 'now', tone: 'info', t: 'Queried', n: `${day(c.queried ? c.queried.on : TODAY)}, by ${by}` },
			approved: { k: 'done', t: 'Approved', n: `${day(c.approved || TODAY)}, by ${by}` },
			paid: { k: 'done', t: 'Approved', n: `${day(c.approved || TODAY)}, by ${by}` },
			rejected: {
				k: 'stop',
				tone: 'danger',
				t: 'Rejected',
				n: `${day(c.rejected ? c.rejected.on : TODAY)}, by ${by}`,
			},
		}[c.status];
		const paid =
			c.status === 'paid'
				? { k: 'done', t: 'Paid', n: `${day(c.paid)} payout` }
				: c.status === 'approved'
					? {
							k: 'now',
							tone: 'success',
							t: 'Payout',
							n: `${weekday(BOOK.nextPayout)}, ${day(BOOK.nextPayout)}`,
						}
					: c.status === 'rejected'
						? { k: 'off', t: 'Payout', n: 'Won’t be paid' }
						: { k: 'next', t: 'Payout', n: 'Next Friday after approval' };
		const steps = [{ k: 'done', t: 'Sent', n: `${day(c.sent)}, by ${nameOrYou(c.who)}` }, review, paid];
		const word = { done: 'done', now: 'current step', stop: 'stopped here', next: 'not yet', off: 'skipped' };
		return steps
			.map(
				(s, i) =>
					`<li class="ed-step is-${s.k}"${s.tone ? ` data-tone="${s.tone}"` : ''}${s.k === 'now' ? ' aria-current="step"' : ''}><span class="ed-step-mark" aria-hidden="true">${s.k === 'done' ? '<i class="bi bi-check-lg"></i>' : s.k === 'stop' ? '<i class="bi bi-x-lg"></i>' : i + 1}</span><span class="ed-step-text"><span class="ed-step-title">${s.t}<span class="visually-hidden">, ${word[s.k]}</span></span><span class="ed-step-note">${htmlSafe(s.n)}</span></span></li>`,
			)
			.join('');
	}
	function checksHtml(c) {
		const icon = { pass: 'bi-check-circle-fill', warn: 'bi-exclamation-triangle-fill', fail: 'bi-x-circle-fill' };
		const word = { pass: 'Passed', warn: 'Needs a look', fail: 'Failed' };
		return checks(c)
			.map(
				(k) =>
					`<li class="ed-check is-${k.s}"><i class="bi ${icon[k.s]}" aria-hidden="true"></i><span><span class="ed-check-title"><span class="visually-hidden">${word[k.s]}: </span>${htmlSafe(k.t)}</span><span class="ed-check-note">${htmlSafe(k.n)}</span></span></li>`,
			)
			.join('');
	}
	function decideHtml(c) {
		if (ui.ask) {
			const label = { query: 'Send question', receipt: 'Ask for it', reject: 'Reject claim' }[ui.ask];
			return `<button type="button" class="btn btn-outline-secondary" data-ed-act="cancel">Cancel</button><button type="button" class="btn btn-primary" data-ed-act="send">${label}</button>`;
		}
		const open = c.status === 'waiting' || c.status === 'queried';
		if (open && !mine(c)) return `<p class="ed-decide-note">${htmlSafe(approverOf(c))} approves your claims.</p>`;
		if (open) {
			return `<button type="button" class="btn btn-outline-secondary ed-decide-reject" data-ed-act="reject">Reject</button>${c.receipt ? `<button type="button" class="btn btn-outline-secondary" data-ed-act="query">Ask a question</button><button type="button" class="btn btn-primary" data-ed-act="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>` : '<button type="button" class="btn btn-primary" data-ed-act="receipt"><i class="bi bi-paperclip me-1" aria-hidden="true"></i>Ask for the receipt</button>'}`;
		}
		if (c.status === 'approved' && mine(c)) {
			return `<p class="ed-decide-note">Changed your mind? It can go back to the queue until the payout.</p><button type="button" class="btn btn-outline-secondary" data-ed-act="unapprove">Undo approval</button>`;
		}
		if (c.status === 'rejected' && mine(c)) {
			return `<p class="ed-decide-note">Reopen it if ${htmlSafe(first(c.who))} sends what was missing.</p><button type="button" class="btn btn-outline-secondary" data-ed-act="reopen">Reopen</button>`;
		}
		return `<p class="ed-decide-note">${c.status === 'paid' ? 'Paid claims are closed.' : `${htmlSafe(approverOf(c))} decides on your claims.`}</p>`;
	}
	function paintDecision(c) {
		pick('[data-ed="state"]').textContent = stateText(c);
		pick('[data-ed="sum"]').innerHTML = sumHtml(c);
		pick('[data-ed="sum"]').setAttribute('data-cat', c.cat);
		pick('[data-ed="steps"]').innerHTML = stepsHtml(c);
		pick('[data-ed="checks"]').innerHTML = checksHtml(c);
		pick('[data-ed-ask]').hidden = !ui.ask;
		pick('[data-ed="decide"]').innerHTML = decideHtml(c);
	}

	/**
	 * Grows the filled lines between finished steps from the left, the first
	 * time the trail is on screen. Later repaints show them already drawn.
	 */
	function drawTrail() {
		const trail = pick('[data-ed="steps"]');
		let left = pickAll('.ed-step.is-done + .ed-step', trail).length;
		if (!left || !window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(e) {
			if (e.animationName !== 'ed-trail-grow' || --left) return;
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

	/* Receipt */
	function slipHtml(c) {
		const r = c.receipt;
		if (!r.lines) {
			return `<figure class="ed-file"><span class="ed-file-icon" aria-hidden="true"><i class="bi bi-file-earmark-image"></i></span><figcaption><span class="ed-file-name">${htmlSafe(r.file)}</span><span class="ed-file-note">Attached today. Reading the total takes a minute.</span></figcaption></figure>`;
		}
		const log = r.shop === 'Mileage log';
		const paid =
			c.paidWith === 'Personal card'
				? `Card ending ${String((parseInt(BOOK.people[c.who].bank, 10) * 7) % 10000).padStart(4, '0')}`
				: c.paidWith;
		return `<figure class="ed-slip" data-cat="${c.cat}"><figcaption class="visually-hidden">Receipt from ${htmlSafe(r.shop)}, ${money(c.amount)}</figcaption><div class="ed-slip-paper" aria-hidden="true"><p class="ed-slip-shop">${htmlSafe(r.shop)}</p><p class="ed-slip-where">${htmlSafe(r.where)}</p><p class="ed-slip-when">${log ? `Logged by ${htmlSafe(c.who)}` : `${day(c.spent)}, 2026 · ${clock(timeOn(c, c.spent, 1).slice(11, 16))}`}</p><ul class="ed-slip-lines">${r.lines.map((l) => `<li><span>${htmlSafe(l[0])}</span><span>${money(l[1])}</span></li>`).join('')}</ul><p class="ed-slip-total"><span>Total</span><span>${money(r.lines.reduce((s, l) => s + l[1], 0))}</span></p>${log ? '<p class="ed-slip-foot">Rate $0.70 a mile</p>' : `<p class="ed-slip-foot">${htmlSafe(paid)}</p><span class="ed-slip-code"></span>`}</div></figure>`;
	}
	function paintReceipt(c) {
		const has = !!c.receipt;
		pick('[data-ed="receipt-desc"]').textContent = has ? c.receipt.file : 'Nothing attached yet.';
		pick('[data-ed="receipt"]').hidden = !has;
		pick('[data-ed="receipt"]').innerHTML = has ? slipHtml(c) : '';
		pick('[data-ed-drop]').hidden = has;
	}

	/* Details */
	function paintDetails(c) {
		const paid = c.status === 'paid';
		pick('[data-ed-edit]').hidden = paid || ui.editing;
		pick('[data-ed="details-desc"]').textContent = paid
			? 'Paid claims can’t be changed.'
			: `What was spent, as ${first(c.who)} sent it.`;
		const rows = [
			['What for', htmlSafe(c.desc)],
			['Amount', `<strong>${money(c.amount)}</strong>`],
			['Spent on', `${weekday(c.spent)}, ${day(c.spent)}, 2026`],
			['Category', categoryChip(c)],
			[
				'Merchant',
				c.receipt && c.receipt.lines
					? `${htmlSafe(c.receipt.shop)}<span class="ed-facts-note">${htmlSafe(c.receipt.where)}</span>`
					: '',
			],
			['Customer', customerLink(c.customer)],
			['Paid with', htmlSafe(c.paidWith)],
			['Claimant', `${staffLink(c.who)}<span class="ed-facts-note">${htmlSafe(BOOK.people[c.who].role)}</span>`],
			['Note', c.note ? htmlSafe(c.note) : ''],
		].filter((r) => r[1]);
		pick('[data-ed="facts"]').innerHTML = rows.map((r) => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('');
		pick('[data-ed="facts"]').hidden = ui.editing;
		pick('[data-ed-form]').hidden = !ui.editing;
	}

	/* Payout */
	function batchOf(c) {
		const on = c.status === 'paid' ? c.paid : BOOK.nextPayout;
		const of = BOOK.claims.filter((x) =>
			c.status === 'paid' ? x.status === 'paid' && x.paid === on : x.status === 'approved',
		);
		return { n: of.length, sum: of.reduce((s, x) => s + x.amount, 0), on };
	}
	function paintPayout(c) {
		const bank = `···${BOOK.people[c.who].bank}`;
		const tone = { paid: 'done', approved: 'set', rejected: 'off' }[c.status] || 'wait';
		pick('[data-ed="payout-desc"]').textContent = {
			done: 'Paid in the weekly payout.',
			set: 'In this week’s payout, sent on Friday.',
			off: 'Rejected claims aren’t paid.',
			wait: 'Approved claims are paid every Friday.',
		}[tone];
		pick('[data-ed="route"]').className = `ed-route is-${tone}`;
		pick('[data-ed="route"]').innerHTML =
			`<span class="ed-route-end"><span class="ed-route-icon" aria-hidden="true"><i class="bi bi-bank"></i></span><span><span class="ed-route-name">Fieldline</span><span class="ed-route-acct">${FROM_ACCOUNT}</span></span></span><span class="ed-route-line" aria-hidden="true"><span class="ed-route-amount">${money(c.amount)}</span></span><span class="ed-route-end">${avatar(c.who)}<span><span class="ed-route-name">${htmlSafe(c.who)}</span><span class="ed-route-acct">Account ${bank}</span></span></span>`;
		const b = batchOf(c);
		const rows = {
			done: () => [
				['Paid on', `${weekday(c.paid)}, ${day(c.paid)}`],
				['Reference', `#26${c.paid.slice(5, 7)}${c.paid.slice(8, 10)}`],
				['Payout', `${b.n} claims, ${money(b.sum)} in all`],
			],
			set: () => [
				['Goes out', `${weekday(b.on)}, ${day(b.on)}`],
				['Payout', `${b.n} claims, ${money(b.sum)} so far`],
				['Arrives', 'One to two days after'],
			],
			off: () => [['Payout', 'None']],
			wait: () => [
				['Goes out', 'The Friday after approval'],
				['Next payout', `${weekday(BOOK.nextPayout)}, ${day(BOOK.nextPayout)}`],
			],
		}[tone]();
		pick('[data-ed="payout"]').innerHTML = rows
			.map((r) => `<div><dt>${r[0]}</dt><dd>${htmlSafe(r[1])}</dd></div>`)
			.join('');

		const others = ORDER.filter((x) => x !== c && x.who === c.who);
		pick('[data-ed="others-title"]').textContent = others.length
			? `${first(c.who)}’s other claims`
			: `No other claims from ${first(c.who)} this month`;
		pick('[data-ed="others"]').innerHTML = others
			.slice(0, 3)
			.map(
				(x) =>
					`<li><a class="ed-link ed-others-name" href="${pageOf(x)}">${htmlSafe(x.desc)}</a><span class="ed-others-amount">${money(x.amount)}</span><span class="ed-others-meta">${x.id} · ${day(x.spent)}</span>${pill(x)}</li>`,
			)
			.join('');
	}

	/* Comments */
	/* The conversation so far, built once from the book; posts and
     decisions made on this page are added to it. */
	function seedThread(c) {
		const list = [];
		if (c.note) list.push({ at: timeOn(c, c.sent, 0), who: c.who, text: c.note });
		if (c.queried)
			list.push({ at: timeOn(c, c.queried.on, 3), who: approverOf(c), text: c.queried.text, tag: 'Question' });
		if (c.rejected)
			list.push({
				at: timeOn(c, c.rejected.on, 3),
				who: approverOf(c),
				text: c.rejected.text,
				tag: 'Why it was rejected',
			});
		(c.thread || []).forEach((t) => list.push({ at: t[0], who: t[1], text: t[2] }));
		return list;
	}

	function thread(c) {
		return c.comments.slice().sort((a, b) => a.at.localeCompare(b.at));
	}

	function paintComments(c) {
		const list = thread(c);
		pick('[data-ed="comments-desc"]').textContent = `${first(c.who)} sees these too.`;
		pick('[data-ed="thread"]').innerHTML = list.length
			? list
					.map(
						(m) =>
							`<li class="ed-msg">${avatar(m.who)}<div class="ed-msg-body"><p class="ed-msg-head"><span class="ed-msg-who">${htmlSafe(m.who)}</span>${m.who === ME ? '<span class="ed-you">You</span>' : ''}<span class="ed-msg-when">${stamp(m.at)}</span></p>${m.tag ? `<p class="ed-msg-tag">${htmlSafe(m.tag)}</p>` : ''}<p class="ed-msg-text">${htmlSafe(m.text)}</p></div></li>`,
					)
					.join('')
			: `<li class="ed-thread-empty">No comments yet. Ask ${htmlSafe(first(c.who))} anything about the claim here.</li>`;
	}

	/* History */
	/* What happened before today, built once from the book; changes made
     on this page are added to it. */
	function seedHistory(c) {
		const ev = [
			{ at: timeOn(c, c.sent, 0), icon: 'bi-send', who: c.who, what: `sent the claim for ${money(c.amount)}` },
		];
		const warned = checks(c).filter((k) => k.s !== 'pass');
		ev.push({
			at: `${timeOn(c, c.sent, 0)}:30`,
			icon: 'bi-shield-check',
			who: 'Fieldline',
			what: warned.length
				? `flagged it: ${warned.map((k) => k.t.toLowerCase()).join(', ')}`
				: 'checked it against the policy, all clear',
			tone: warned.length ? 'warning' : '',
		});
		if (c.queried)
			ev.push({
				at: timeOn(c, c.queried.on, 3),
				icon: 'bi-chat-left-text',
				who: approverOf(c),
				what: 'sent it back with a question',
				tone: 'info',
			});
		if (c.rejected)
			ev.push({
				at: timeOn(c, c.rejected.on, 3),
				icon: 'bi-x-lg',
				who: approverOf(c),
				what: 'rejected it',
				tone: 'danger',
			});
		if (c.approved)
			ev.push({
				at: timeOn(c, c.approved, 4),
				icon: 'bi-check2',
				who: approverOf(c),
				what: 'approved it',
				tone: 'success',
			});
		if (c.paid)
			ev.push({
				at: `${c.paid}T09:00`,
				icon: 'bi-wallet2',
				who: 'Fieldline',
				what: `paid it to account ···${BOOK.people[c.who].bank}`,
				tone: 'success',
			});
		return ev;
	}

	function history(c) {
		return c.log.slice().sort((a, b) => b.at.localeCompare(a.at));
	}

	function paintHistory(c) {
		pick('[data-ed="history"]').innerHTML = history(c)
			.map(
				(e) =>
					`<li class="ed-feed-item"${e.tone ? ` data-tone="${e.tone}"` : ''}><span class="ed-feed-mark" aria-hidden="true"><i class="bi ${e.icon}"></i></span><div><p class="ed-feed-what"><strong>${htmlSafe(nameOrYou(e.who))}</strong> ${htmlSafe(e.what)}</p><p class="ed-feed-when">${stamp(e.at)}</p></div></li>`,
			)
			.join('');
	}

	function render() {
		paintHead(C);
		paintDecision(C);
		paintReceipt(C);
		paintDetails(C);
		paintPayout(C);
		paintComments(C);
		paintHistory(C);
		if (window.Basalt.avatars) window.Basalt.avatars(pick('[data-ed-root]'));
	}

	/* Changing the claim */
	function snapshot() {
		return { c: Object.assign({}, C), log: C.log.slice(), comments: C.comments.slice() };
	}
	function restore(snap) {
		for (const k of Object.keys(C)) {
			delete C[k];
		}

		Object.assign(C, snap.c);
		C.log = snap.log;
		C.comments = snap.comments;
		ui.ask = null;
		render();
	}
	function nextInQueue() {
		return BOOK.claims
			.filter((x) => x !== C && x.status === 'waiting' && mine(x))
			.sort((a, b) => a.sent.localeCompare(b.sent) || a.id.localeCompare(b.id))[0];
	}
	function decided(o) {
		const next = nextInQueue();
		const actions = [
			{
				label: 'Undo',
				onClick() {
					restore(o.snap);
					announce('Undone.');
				},
			},
		];
		if (next)
			actions.push({
				label: 'Next claim',
				onClick() {
					window.location.href = pageOf(next);
				},
			});
		toast({ tone: o.tone, icon: o.icon, title: o.title, text: o.text, actions });
		ui.ask = null;
		render();
		pick('#ed-decide-title').focus();
	}
	function approve() {
		const snap = snapshot();
		C.status = 'approved';
		C.approved = TODAY;
		delete C.queried;
		C.log.push({ at: now(), icon: 'bi-check2', who: ME, what: 'approved it', tone: 'success' });
		decided({
			snap,
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Claim approved',
			text: `${money(C.amount)} goes to ${first(C.who)} on ${weekday(BOOK.nextPayout)}.`,
		});
	}
	function sendBack(kind, text) {
		const snap = snapshot();
		if (kind === 'reject') {
			C.status = 'rejected';
			C.rejected = { on: TODAY, text };
			C.log.push({ at: now(), icon: 'bi-x-lg', who: ME, what: 'rejected it', tone: 'danger' });
			C.comments.push({ at: now(), who: ME, text, tag: 'Why it was rejected' });
		} else {
			C.status = 'queried';
			C.queried = { on: TODAY, text };
			C.log.push({
				at: now(),
				icon: 'bi-chat-left-text',
				who: ME,
				what: kind === 'receipt' ? 'asked for the receipt' : 'sent it back with a question',
				tone: 'info',
			});
			C.comments.push({ at: now(), who: ME, text, tag: kind === 'receipt' ? 'Receipt request' : 'Question' });
		}
		decided({
			snap,
			tone: kind === 'reject' ? 'danger' : 'info',
			icon: kind === 'reject' ? 'bi-x-circle' : 'bi-chat-left-text',
			title: kind === 'reject' ? 'Claim rejected' : 'Question sent',
			text: `${first(C.who)} gets an email with your note.`,
		});
	}
	function startAsk(kind) {
		ui.ask = kind;
		pick('[data-ed-ask-label]').textContent = {
			query: `What do you need from ${first(C.who)}?`,
			receipt: `Message to ${first(C.who)}`,
			reject: 'Why is it rejected?',
		}[kind];
		const box = pick('[data-ed-ask-text]');
		box.value = kind === 'receipt' ? 'Please attach the receipt so I can approve this.' : '';
		fieldError(box, false);
		paintDecision(C);
		box.focus();
	}
	function fieldError(input, bad) {
		input.classList.toggle('is-invalid', bad);
		if (bad) input.setAttribute('aria-invalid', 'true');
		else input.removeAttribute('aria-invalid');
		const group = input.closest('.input-group');
		if (group) {
			group.classList.toggle('has-validation', bad);
			pick('.invalid-feedback', group.parentNode).classList.toggle('d-block', bad);
		}
		return bad;
	}

	/* Editing the details */
	const form = pick('[data-ed-form]');
	function setSelect(sel, value) {
		sel.value = value;
		sel.dispatchEvent(new Event('change', { bubbles: true }));
	}
	function beginEdit() {
		ui.editing = true;
		form.desc.value = C.desc;
		form.amount.value = C.amount.toFixed(2);
		form.spent.value = C.spent;
		form.spent.max = C.sent;
		setSelect(form.cat, C.cat);
		setSelect(form.paidWith, C.paidWith);
		setSelect(form.customer, C.customer);
		form.note.value = C.note;

		for (const i of pickAll('.is-invalid', form)) {
			fieldError(i, false);
		}

		paintDetails(C);
		form.desc.focus();
	}
	function stopEdit() {
		ui.editing = false;
		paintDetails(C);
		pick('[data-ed-edit]').focus();
	}
	function saveEdit(e) {
		e.preventDefault();
		const amount = parseFloat(String(form.amount.value).replace(/[$,\s]/g, ''));
		const bad = [
			fieldError(form.desc, !form.desc.value.trim()) && form.desc,
			fieldError(form.amount, !(amount >= 1 && amount <= 5000)) && form.amount,
			fieldError(
				form.spent,
				!form.spent.value || form.spent.value < form.spent.min || form.spent.value > form.spent.max,
			) && form.spent,
		].filter(Boolean);
		if (bad.length) {
			bad[0].focus();
			return;
		}
		const next = {
			desc: form.desc.value.trim(),
			amount: Math.round(amount * 100) / 100,
			spent: form.spent.value,
			cat: form.cat.value,
			paidWith: form.paidWith.value,
			customer: form.customer.value,
			note: form.note.value.trim(),
		};
		const said = {
			desc: 'the description',
			amount: `the amount from ${money(C.amount)} to ${money(next.amount)}`,
			spent: `the date to ${day(next.spent)}`,
			cat: `the category to ${CATS[next.cat].label}`,
			paidWith: 'how it was paid',
			customer: 'the customer',
			note: 'the note',
		};
		const changed = Object.keys(next).filter((k) => next[k] !== C[k]);
		ui.editing = false;
		if (!changed.length) {
			render();
			pick('[data-ed-edit]').focus();
			return;
		}
		const snap = snapshot();
		Object.assign(C, next);
		C.log.push({
			at: now(),
			icon: 'bi-pencil',
			who: ME,
			what: `changed ${changed.map((k) => said[k]).join(', ')}`,
		});
		render();
		pick('[data-ed-edit]').focus();
		toast({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Changes saved',
			text: `${first(C.who)} can see what you changed in the history.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						restore(snap);
					},
				},
			],
		});
	}

	/* Wiring */
	function start() {
		C.log = seedHistory(C);
		C.comments = seedThread(C);
		render();
		/* The claimed amount counts up and the trail draws in, once each. */
		window.Basalt.countUp?.(pickAll('.ed-sum-amount'));
		drawTrail();

		pick('[data-ed="decide"]').addEventListener('click', (e) => {
			const b = e.target.closest('[data-ed-act]');
			if (!b) return;
			const act = b.getAttribute('data-ed-act');
			if (act === 'approve') approve();
			else if (act === 'query' || act === 'receipt' || act === 'reject')
				window.Basalt.slide(pick('[data-ed-ask]'), () => startAsk(act));
			else if (act === 'cancel') {
				window.Basalt.slide(pick('[data-ed-ask]'), () => {
					ui.ask = null;
					paintDecision(C);
				});
				pick('[data-ed-act="reject"]').focus();
			} else if (act === 'send') {
				const box = pick('[data-ed-ask-text]');
				const text = box.value.trim();
				if (fieldError(box, !text)) {
					box.focus();
					return;
				}
				sendBack(ui.ask, text);
			} else if (act === 'unapprove' || act === 'reopen') {
				const snap = snapshot();
				C.status = 'waiting';
				delete C.approved;
				delete C.rejected;
				C.log.push({
					at: now(),
					icon: 'bi-arrow-counterclockwise',
					who: ME,
					what: act === 'reopen' ? 'reopened it' : 'took back the approval',
				});
				decided({
					snap,
					tone: 'info',
					icon: 'bi-arrow-counterclockwise',
					title: act === 'reopen' ? 'Claim reopened' : 'Back in the queue',
					text: 'It won’t be paid until it is approved again.',
				});
			}
		});
		pick('[data-ed-ask-text]').addEventListener('input', (e) => {
			if (e.target.value.trim()) fieldError(e.target, false);
		});

		pick('[data-ed-drop]').addEventListener('basalt:files', (e) => {
			const snap = snapshot();
			C.receipt = { file: e.detail.files[0].name };
			C.log.push({ at: now(), icon: 'bi-paperclip', who: ME, what: 'attached the receipt' });
			render();
			pick('#ed-receipt-title').focus();
			toast({
				tone: 'success',
				icon: 'bi-paperclip',
				title: 'Receipt attached',
				text: 'The claim can be approved now.',
				actions: [
					{
						label: 'Undo',
						onClick() {
							restore(snap);
						},
					},
				],
			});
		});

		for (const b of pickAll('[data-ed-download]')) {
			b.addEventListener('click', () => {
				if (C.receipt)
					toast({ tone: 'success', icon: 'bi-download', title: 'Downloading', text: C.receipt.file });
			});
		}

		pick('[data-ed-copy]').addEventListener('click', () => {
			const url = new URL(pageOf(C), window.location.href).href;
			if (window.Basalt.copyText) window.Basalt.copyText(url);
			toast({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Link copied',
				text: `It opens ${C.id} for anyone who can see expenses.`,
			});
		});

		pick('[data-ed-edit]').addEventListener('click', beginEdit);
		pick('[data-ed-cancel]').addEventListener('click', stopEdit);
		form.addEventListener('submit', saveEdit);
		form.addEventListener('input', (e) => {
			if (e.target.classList.contains('is-invalid')) fieldError(e.target, false);
		});

		const reply = pick('[data-ed-reply]');
		const replyText = pick('[data-ed-reply-text]');
		reply.addEventListener('submit', (e) => {
			e.preventDefault();
			const text = replyText.value.trim();
			if (fieldError(replyText, !text)) {
				replyText.focus();
				return;
			}
			C.comments.push({ at: now(), who: ME, text });
			replyText.value = '';
			paintComments(C);
			if (window.Basalt.avatars) window.Basalt.avatars(pick('[data-ed="thread"]'));
			announce('Comment posted.');
		});
		replyText.addEventListener('input', () => {
			if (replyText.value.trim()) fieldError(replyText, false);
		});
	}

	document.addEventListener('DOMContentLoaded', start);
})();
