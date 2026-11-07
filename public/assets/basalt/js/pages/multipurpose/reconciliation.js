/**
 * Basalt - Reconciliation (reconciliation.html)
 * One month of the Operating Account's bank statement against the
 * books. The summary compares the two balances; below it, the
 * suggested matches to confirm, the lines with nothing in the books
 * yet (find the entry, or create one), and the lines already matched.
 * When every line is matched the month can be locked.
 *
 * The data is window.Basalt.data.reconciliation (assets/js/data/
 * reconciliation.js). Matching here only changes this page; in your
 * app, post each match to your ledger.
 */
(() => {
	'use strict';
	const root = pick('[data-hire-root]');
	if (!root) return;
	const R = window.Basalt.data && window.Basalt.data.reconciliation;
	if (!R) return;

	function start() {
		createEl.addEventListener('shown.bs.modal', () => memo.focus());
		createForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const l = creating;
			const catOk = !!categoryField.value;
			const okMemo = !!memo.value.trim();
			categoryField.classList.toggle('is-invalid', !catOk);
			memo.classList.toggle('is-invalid', !okMemo);
			if (!catOk) {
				const b = categoryField.nextElementSibling;
				(b && b.focus ? b : categoryField).focus();
				return;
			}
			if (!okMemo) {
				memo.focus();
				return;
			}
			Object.assign(l, {
				state: 'matched',
				je: `#${nextEntry++}`,
				entry: {
					title: memo.value.trim(),
					detail: `Booked to ${catName(categoryField.value)}`,
					href: 'accounting.html',
					link: 'Open in Accounting',
				},
			});
			delete l.hint;
			bootstrap.Modal.getOrCreateInstance(createEl).hide();
			draw();
			announce(`Entry ${l.je} created.`);
			toast({
				tone: 'success',
				icon: 'bi-journal-check',
				title: `${l.je} created`,
				text: `${signed(l.amount)} booked to ${catName(categoryField.value)}.`,
			});
		});

		/* Focus goes back where the dialog was opened from, when that is still there. */
		for (const el of [findEl, createEl]) {
			el.addEventListener('hidden.bs.modal', () => {
				const from = el._from;
				if (from && document.body.contains(from)) from.focus();
				else {
					const t =
						pick('[data-hire-done]:not([hidden]) [data-hire-done-title]', root) ||
						pick('[data-hire-list="review"] [data-hire-open]', root);
					if (t) t.focus();
				}
			});
		}

		draw();
	}

	/* Small helpers */
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

	function announce(t) {
		const r = pick('[data-hire-live]', root);
		if (r) r.textContent = t;
	}
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const FULL = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	];

	function day(s) {
		return `${MONTHS[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`;
	}

	function dayLong(s) {
		return `${day(s)}, ${s.slice(0, 4)}`;
	}

	function cents(n) {
		return Math.round(n * 100) / 100;
	}

	function money(n) {
		return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function signed(n) {
		return (n < 0 ? '−' : '+') + money(n);
	}

	const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

	function words(n, one, many) {
		return `${WORDS[n] || n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function cap(s) {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function hideTip(el) {
		const t = window.bootstrap && bootstrap.Tooltip.getInstance(el);
		if (t) t.hide();
	}

	const METHOD = {
		ach: 'Bank transfer',
		wire: 'Wire transfer',
		check: 'Check deposit',
		payout: 'Card payout',
		debit: 'Direct debit',
		own: 'Own transfer',
		fee: 'Bank fee',
	};

	function catName(code) {
		return (R.categories.find((c) => c[0] === code) || ['', ''])[1];
	}

	/* State */
	const months = R.months();
	let uid = 1;
	months.forEach((m) => {
		if (!m.lines) return;
		m.lines = m.lines
			.map((l) => Object.assign({ id: uid++ }, l))
			.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
	});
	const state = { month: months[0], expanded: false };
	let nextEntry = R.nextEntry;
	const open = R.openEntries();
	const usedEntries = new Set();

	function lineById(id) {
		return state.month.lines.find((l) => l.id === +id);
	}

	function of(st) {
		return (state.month.lines || []).filter((l) => l.state === st);
	}

	function inBooks(l) {
		return l.state !== 'review';
	}

	function bookBalance(m) {
		return m.lines
			? cents(m.close - m.lines.filter((l) => !inBooks(l)).reduce((s, l) => s + l.amount, 0))
			: m.close;
	}

	/* Month picker */
	const monthSel = pick('[data-hire-month]', root);
	function drawMonths() {
		monthSel.innerHTML = months
			.map((m) => {
				const todo = m.lines ? m.lines.filter((l) => l.state !== 'matched').length : 0;
				const hint = m.state === 'done' ? 'Locked' : todo ? `${words(todo, 'line')} to sort` : 'Ready to lock';
				return `<option value="${m.key}" data-hint="${htmlSafe(hint)}"${m === state.month ? ' selected' : ''}>${htmlSafe(m.label)}</option>`;
			})
			.join('');
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(monthSel);
	}
	monthSel.addEventListener('change', () => {
		state.month = months.find((m) => m.key === monthSel.value) || months[0];
		state.expanded = false;
		draw();
		announce(`${state.month.label} shown.`);
	});

	/* Summary */
	function drawSummary() {
		const m = state.month;
		const bank = m.close;
		const books = bookBalance(m);
		const total = m.lines ? m.lines.length : m.count;
		const matched = m.lines ? of('matched').length : m.count;
		const sug = m.lines ? of('suggested').length : 0;
		const rev = m.lines ? of('review').length : 0;
		const pct = total ? Math.round((matched / total) * 100) : 100;

		function fig(tone, icon, label, value, note, extra) {
			return `<div class="hire-fig hire-tone-${tone}"><dt class="hire-fig-label"><span class="hire-fig-icon" aria-hidden="true"><i class="bi ${icon}"></i></span>${label}</dt><dd data-basalt-countup class="hire-fig-value">${value}</dd><dd class="hire-fig-note">${note}</dd>${extra || ''}</div>`;
		}

		pick('[data-hire-figs]', root).innerHTML =
			fig(1, 'bi-bank', 'Statement balance', money(bank), `${R.account.bank}, ${day(m.to)}`) +
			fig(2, 'bi-journal-text', 'Book balance', money(books), `In the books, ${day(m.to)}`) +
			fig(
				3,
				'bi-link-45deg',
				'Matched',
				`${matched} of ${total}`,
				'lines in the books',
				`<dd class="hire-meter" aria-hidden="true"><span style="width:${pct}%"></span></dd>`,
			) +
			fig(
				4,
				'bi-list-check',
				'To review',
				String(sug + rev),
				sug + rev ? `${sug} to confirm, ${rev} unmatched` : 'Nothing left to sort',
			);
		const gap = cents(bank - books);
		const el = pick('[data-hire-gap]', root);
		el.classList.toggle('is-even', !gap);
		el.innerHTML = gap
			? `<i class="bi bi-arrow-left-right" aria-hidden="true"></i><span>The books are <strong>${money(gap)} ${gap > 0 ? 'short of' : 'over'}</strong> the bank. Sorting the ${words(rev, 'line')} with no match closes the gap.</span>`
			: `<i class="bi bi-check2-circle" aria-hidden="true"></i><span>The books and the bank agree at <strong>${money(bank)}</strong>${sug ? '. Confirm the suggestions to finish.' : '.'}</span>`;
	}

	/* Rows */
	function quick(l) {
		return `<button type="button" class="btn btn-icon btn-sm" data-hire-quick aria-label="Quick view: ${htmlSafe(l.who)}, ${day(l.date)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>`;
	}

	function confHtml(c) {
		const tone = c >= 90 ? 'high' : c >= 80 ? 'mid' : 'low';
		return `<span class="hire-conf hire-conf-${tone}"><span class="hire-conf-bar" aria-hidden="true"><span style="width:${c}%"></span></span><span class="hire-conf-n">${c}%<span class="visually-hidden"> sure</span></span></span>`;
	}
	function rowHtml(l) {
		const amt = `<span class="hire-row-amt${l.amount > 0 ? ' is-in' : ''}">${signed(l.amount)}</span>`;
		const who = `<button type="button" class="hire-row-who" data-hire-open>${htmlSafe(l.who)}</button>`;
		const date = `<span class="hire-row-date">${day(l.date)}</span>`;
		if (l.state === 'suggested') {
			return `<li class="hire-row hire-row-sug" data-hire-id="${l.id}">${date}${who}<span class="hire-row-entry"><i class="bi bi-arrow-left-right" aria-hidden="true"></i><span>${htmlSafe(l.entry.title)}</span></span>${confHtml(l.confidence)}${amt}<span class="hire-row-acts"><button type="button" class="btn btn-outline-secondary btn-sm" data-hire-act="confirm"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Confirm</button><button type="button" class="btn btn-icon btn-sm" data-hire-act="reject" aria-label="Not a match: ${htmlSafe(l.who)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Not a match"><i class="bi bi-x-lg" aria-hidden="true"></i></button>${quick(l)}</span></li>`;
		}
		if (l.state === 'review') {
			return `<li class="hire-row hire-row-rev" data-hire-id="${l.id}">${date}${who}<span class="hire-row-entry hire-row-entry-quiet">${htmlSafe(METHOD[l.method] || '')}</span>${amt}<span class="hire-row-acts"><button type="button" class="btn btn-outline-secondary btn-sm" data-hire-act="find"><i class="bi bi-search me-1" aria-hidden="true"></i>Find a match</button><button type="button" class="btn btn-outline-secondary btn-sm" data-hire-act="create"><i class="bi bi-journal-plus me-1" aria-hidden="true"></i>Create entry</button>${quick(l)}</span></li>`;
		}
		return `<li class="hire-row hire-row-mat" data-hire-id="${l.id}">${date}${who}<span class="hire-row-entry"><span class="hire-row-je">${htmlSafe(l.je)}</span><span>${htmlSafe(l.entry.title)}</span></span>${amt}<span class="hire-row-acts">${quick(l)}</span></li>`;
	}

	const ROWS = 8;
	function drawLists() {
		const m = state.month;
		const live = !!m.lines;
		const sug = live ? of('suggested') : [];
		const rev = live ? of('review') : [];
		const mat = live ? of('matched').slice().reverse() : [];

		function sec(k) {
			return pick(`[data-hire-section="${k}"]`, root);
		}

		sec('suggested').hidden = !sug.length;
		sec('review').hidden = !rev.length;
		sec('matched').hidden = !mat.length;
		pick('[data-hire-list="suggested"]', root).innerHTML = sug.map(rowHtml).join('');
		pick('[data-hire-list="review"]', root).innerHTML = rev.map(rowHtml).join('');
		const shown = state.expanded ? mat : mat.slice(0, ROWS);
		pick('[data-hire-list="matched"]', root).innerHTML = shown.map(rowHtml).join('');
		pick('[data-hire-confirm-all-label]', root).textContent = `Confirm all ${sug.length}`;
		pick('[data-hire-confirm-all]', root).hidden = sug.length < 2;
		pick('[data-hire-matched-desc]', root).textContent = 'Paired with an entry in the books, newest first.';
		const foot = pick('[data-hire-more-foot]', root);
		foot.hidden = mat.length <= ROWS;
		if (mat.length > ROWS) {
			pick('[data-hire-more-note]', root).textContent = state.expanded
				? `Showing all ${mat.length} lines.`
				: `Showing the latest ${ROWS} of ${mat.length} lines.`;
			const more = pick('[data-hire-more]', root);
			more.textContent = state.expanded ? 'Show fewer' : `Show all ${mat.length}`;
			more.setAttribute('aria-expanded', String(state.expanded));
		}
		if (window.Basalt.tips)
			for (const ul of pickAll('[data-hire-list]', root)) {
				window.Basalt.tips(ul);
			}
	}

	/* Done */
	function drawDone() {
		const m = state.month;
		const done = m.state === 'done' || (m.lines && !of('suggested').length && !of('review').length);
		const box = pick('[data-hire-done]', root);
		const was = !box.hidden;
		box.hidden = !done;
		if (!done) return;
		const total = m.lines ? m.lines.length : m.count;
		pick('[data-hire-done-title]', root).textContent = `${m.short} is reconciled`;
		pick('[data-hire-done-text]', root).textContent =
			`The books and ${R.account.bank} both end ${m.short} at ${money(m.close)}, with all ${total} lines matched.${m.state === 'done' ? ` Locked by ${m.by} on ${dayLong(m.on)}.` : ` Lock it so nothing in ${m.short} can change.`}`;
		pick('[data-hire-done-actions]', root).hidden = m.state === 'done';
		pick('[data-hire-lock-label]', root).textContent = `Lock ${m.short}`;
		if (!was && m.lines) {
			const t = pick('[data-hire-done-title]', root);
			if (root.contains(document.activeElement) || document.activeElement === document.body) t.focus();
		}
	}
	pick('[data-hire-lock]', root).addEventListener('click', () => {
		const m = state.month;
		m.state = 'done';
		m.by = R.me;
		m.on = R.today;
		draw();
		toast({
			tone: 'success',
			icon: 'bi-lock',
			title: `${m.short} locked`,
			text: `Entries dated in ${m.short} can no longer be changed.`,
		});
	});

	function draw() {
		drawMonths();
		drawSummary();
		drawLists();
		drawDone();
	}

	/* Actions on a line
	   Undo in a toast does nothing once the month has been locked. */
	function whileOpen(m, fn) {
		return () => {
			if (m.state === 'done') {
				toast({
					tone: 'info',
					icon: 'bi-lock',
					title: `${m.short} is locked`,
					text: 'Its matches can no longer change.',
				});
				return;
			}
			fn();
		};
	}

	function confirm(l, quietly) {
		l.state = 'matched';
		if (!quietly) {
			draw();
			announce(`${l.who} matched to ${l.entry.title}.`);
			toast({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Matched',
				text: `${l.who} ${signed(l.amount)} to ${l.entry.title}.`,
				actions: [
					{
						label: 'Undo',
						onClick: whileOpen(state.month, () => {
							l.state = 'suggested';
							draw();
						}),
					},
				],
			});
		}
	}
	function reject(l) {
		const was = { entry: l.entry, je: l.je, confidence: l.confidence, why: l.why };
		l.state = 'review';
		l.hint = `The suggested ${l.entry.title} was not a match.`;
		delete l.entry;
		delete l.je;
		delete l.confidence;
		delete l.why;
		draw();
		toast({
			tone: 'info',
			title: 'Moved to review',
			text: `${l.who} ${signed(l.amount)} needs another entry.`,
			actions: [
				{
					label: 'Undo',
					onClick: whileOpen(state.month, () => {
						Object.assign(l, was, { state: 'suggested' });
						delete l.hint;
						draw();
					}),
				},
			],
		});
	}
	function unmatch(l) {
		l.state = 'review';
		l.hint = `Unmatched from ${l.entry.title} (${l.je}).`;
		if (l.found) {
			usedEntries.delete(l.found);
			delete l.found;
		}
		delete l.entry;
		delete l.je;
		draw();
		toast({ tone: 'info', title: 'Match undone', text: `${l.who} ${signed(l.amount)} is back in To review.` });
	}
	pick('[data-hire-confirm-all]', root).addEventListener('click', (e) => {
		hideTip(e.currentTarget);
		const list = of('suggested');
		list.forEach((l) => confirm(l, true));
		draw();
		announce(`${words(list.length, 'line')} matched.`);
		toast({
			tone: 'success',
			icon: 'bi-check2-all',
			title: `${cap(words(list.length, 'match', 'matches'))} confirmed`,
			text: 'Each bank line is paired with its entry in the books.',
			actions: [
				{
					label: 'Undo',
					onClick: whileOpen(state.month, () => {
						list.forEach((l) => {
							l.state = 'suggested';
						});
						draw();
					}),
				},
			],
		});
	});
	pick('[data-hire-more]', root).addEventListener('click', () => {
		window.Basalt.slide(pick('[data-hire-list="matched"]', root), () => {
			state.expanded = !state.expanded;
			drawLists();
		});
	});

	root.addEventListener('click', (e) => {
		const row = e.target.closest('[data-hire-id]');
		if (!row) return;
		const l = lineById(row.getAttribute('data-hire-id'));
		if (!l) return;
		const act = e.target.closest('[data-hire-act]');
		if (act) {
			hideTip(act);
			const a = act.getAttribute('data-hire-act');
			if (a === 'confirm') confirm(l);
			else if (a === 'reject') reject(l);
			else if (a === 'find') openFind(l, act);
			else if (a === 'create') openCreate(l, act);
			return;
		}
		if (e.target.closest('a, input, select')) return;
		const q = e.target.closest('[data-hire-quick]');
		if (q) hideTip(q);
		showSheet(l, q || pick('[data-hire-open]', row));
	});

	/* Quick view */
	const drawer = pick('#rec-drawer');

	function d(k) {
		return pick(`[data-hire-d="${k}"]`, drawer);
	}

	function panel() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	let current = null;
	function drawDrawer() {
		const l = current;
		if (!l) return;
		d('title').textContent = l.who;
		d('sub').textContent = `${dayLong(l.date)} · ${METHOD[l.method] || ''}`;
		const link =
			l.entry && l.entry.href
				? [l.entry.href, l.entry.link]
				: l.acct
					? [`company-details.html?id=${encodeURIComponent(l.acct)}`, 'Open company']
					: null;
		d('full').hidden = !link;
		if (link) {
			d('full').href = link[0];
			d('full-label').textContent = link[1];
		}
		const facts = `<dl class="hire-facts"><div><dt>Amount</dt><dd class="hire-facts-amt${l.amount > 0 ? ' is-in' : ''}">${signed(l.amount)}</dd></div><div><dt>Date</dt><dd>${dayLong(l.date)}</dd></div><div><dt>How</dt><dd>${htmlSafe(METHOD[l.method] || '')}</dd></div><div><dt>Bank reference</dt><dd class="hire-mono">${htmlSafe(l.memo)}</dd></div></dl>`;
		let books;
		if (l.state === 'review') {
			books = `<p class="hire-d-none"><i class="bi bi-question-circle" aria-hidden="true"></i><span>Nothing in the books yet.</span></p>${l.hint ? `<p class="hire-d-text">${htmlSafe(l.hint)}</p>` : ''}`;
		} else {
			books = `<dl class="hire-facts"><div><dt>Entry</dt><dd>${htmlSafe(l.entry.title)}</dd></div><div><dt>Details</dt><dd>${htmlSafe(l.entry.detail)}</dd></div><div><dt>Journal</dt><dd class="hire-mono">${htmlSafe(l.je)}</dd></div>${l.state === 'suggested' ? `<div><dt>How sure</dt><dd>${confHtml(l.confidence)}</dd></div>` : ''}</dl>${l.state === 'suggested' && l.why ? `<p class="hire-d-text">${htmlSafe(l.why)}</p>` : ''}`;
		}
		/* A locked month cannot change, so its lines offer nothing to do. */
		const locked = state.month.state === 'done';
		if (locked)
			books += `<p class="hire-d-text">${htmlSafe(state.month.short)} is locked, so this match stays as it is.</p>`;
		d('body').innerHTML =
			`<section class="basalt-drawer-section" aria-labelledby="rec-d-bank"><h3 class="basalt-drawer-legend" id="rec-d-bank">On the statement</h3>${facts}</section><section class="basalt-drawer-section" aria-labelledby="rec-d-books"><h3 class="basalt-drawer-legend" id="rec-d-books">In the books</h3>${books}</section>`;

		function btn(act, cls, icon, label) {
			return `<button type="button" class="btn ${cls}" data-hire-dact="${act}"><i class="bi ${icon} me-1" aria-hidden="true"></i>${label}</button>`;
		}

		d('foot').hidden = locked;
		d('foot').innerHTML = locked
			? ''
			: l.state === 'suggested'
				? btn('reject', 'btn-outline-secondary me-auto', 'bi-x-lg', 'Not a match') +
					btn('confirm', 'btn-primary', 'bi-check2', 'Confirm match')
				: l.state === 'review'
					? btn('find', 'btn-outline-secondary me-auto', 'bi-search', 'Find a match') +
						btn('create', 'btn-primary', 'bi-journal-plus', 'Create entry')
					: btn('undo', 'btn-outline-secondary me-auto', 'bi-arrow-counterclockwise', 'Undo match');
	}
	function showSheet(l, from) {
		current = l;
		drawDrawer();
		drawer._from = from;
		panel().show();
	}
	drawer.addEventListener('shown.bs.offcanvas', () => d('title').focus());
	drawer.addEventListener('hidden.bs.offcanvas', () => {
		const from = drawer._from;
		if (from && document.body.contains(from)) from.focus();
	});
	d('foot').addEventListener('click', (e) => {
		const b = e.target.closest('[data-hire-dact]');
		if (!b || !current) return;
		const l = current;
		const a = b.getAttribute('data-hire-dact');
		if (a === 'find' || a === 'create') {
			drawer.addEventListener('hidden.bs.offcanvas', () => (a === 'find' ? openFind(l) : openCreate(l)), {
				once: true,
			});
			panel().hide();
			return;
		}
		panel().hide();
		if (a === 'confirm') confirm(l);
		else if (a === 'reject') reject(l);
		else if (a === 'undo') unmatch(l);
	});

	/* Find a match */
	const findEl = pick('#rec-find');
	const findQ = pick('[data-hire-find-q]', findEl);
	const findList = pick('[data-hire-find-list]', findEl);
	let finding = null;
	const FIND_ROWS = 6;
	function candidates() {
		const l = finding;
		const q = findQ.value.trim().toLowerCase().replace(/[$,]/g, '');
		return open
			.filter((x) => !usedEntries.has(x.id) && Math.sign(x.amount) === Math.sign(l.amount))
			.filter(
				(x) =>
					!q ||
					`${x.title} ${x.who} ${x.detail} ${Math.abs(x.amount).toFixed(2)}`.toLowerCase().indexOf(q) >= 0,
			)
			.sort(
				(x, y) =>
					(Math.abs(y.amount - l.amount) < 0.005) - (Math.abs(x.amount - l.amount) < 0.005) ||
					(y.acct === l.acct) - (x.acct === l.acct) ||
					y.date.localeCompare(x.date),
			);
	}
	function drawFind() {
		const l = finding;
		const all = candidates();
		/* The closest few; searching reaches the rest. */
		const list = all.slice(0, FIND_ROWS);
		const kind = l.amount > 0 ? 'unpaid invoices' : 'unpaid bills';
		pick('[data-hire-find-count]', findEl).textContent = !all.length
			? ''
			: all.length > FIND_ROWS
				? `The ${FIND_ROWS} closest of ${all.length} ${kind}. Search to find the others.`
				: cap(words(all.length, kind.slice(0, -1), kind)) + (findQ.value.trim() ? ' match.' : '.');
		findList.innerHTML = list.length
			? list
					.map((x) => {
						const same = Math.abs(x.amount - l.amount) < 0.005;
						return `<li class="hire-find-row"><div class="hire-find-text"><p class="hire-find-title">${htmlSafe(x.title)}${same ? ' <span class="basalt-status basalt-status-success">Same amount</span>' : ''}</p><p class="hire-find-meta">${htmlSafe(x.who)} · ${day(x.date)}</p></div><span class="hire-find-amt">${money(x.amount)}</span>${same ? `<button type="button" class="btn btn-primary btn-sm" data-hire-pick="${htmlSafe(x.id)}">Match</button>` : `<span class="hire-find-off">${money(x.amount - l.amount)} off</span>`}</li>`;
					})
					.join('')
			: `<li class="hire-find-none">No open entry matches “${htmlSafe(findQ.value.trim())}”. Try a name or an amount, or create an entry instead.</li>`;
	}
	function openFind(l, from) {
		finding = l;
		findEl._from = from;
		findQ.value = '';
		pick('[data-hire-find-sub]', findEl).textContent = `${l.who}, ${signed(l.amount)} on ${day(l.date)}.`;
		drawFind();
		bootstrap.Modal.getOrCreateInstance(findEl).show();
	}
	findEl.addEventListener('shown.bs.modal', () => findQ.focus());
	findQ.addEventListener('input', drawFind);
	findList.addEventListener('click', (e) => {
		const b = e.target.closest('[data-hire-pick]');
		if (!b || !finding) return;
		const x = open.find((o) => o.id === b.getAttribute('data-hire-pick'));
		const l = finding;
		usedEntries.add(x.id);
		Object.assign(l, {
			state: 'matched',
			found: x.id,
			je: `#${nextEntry++}`,
			entry: {
				title: (x.kind === 'invoice' ? 'Payment for ' : 'Payment of ') + x.id,
				detail: `${x.who}, ${x.detail}`,
				href: x.href,
				link: x.kind === 'invoice' ? 'Open invoice' : 'Open in Accounting',
			},
		});
		delete l.hint;
		bootstrap.Modal.getOrCreateInstance(findEl).hide();
		draw();
		announce(`${l.who} matched to ${x.title}.`);
		toast({
			tone: 'success',
			icon: 'bi-link-45deg',
			title: `Matched to ${x.title}`,
			text: x.kind === 'invoice' ? `${x.id} is marked paid on ${dayLong(l.date)}.` : `${x.id} is marked paid.`,
		});
	});

	/* Create an entry */
	const createEl = pick('#rec-create');
	const createForm = pick('[data-hire-create-form]', createEl);
	const categoryField = pick('[data-hire-create-cat]', createEl);
	const memo = pick('[data-hire-create-memo]', createEl);
	let creating = null;
	function openCreate(l, from) {
		creating = l;
		createEl._from = from;
		const cats = R.categories.filter((c) => (l.amount > 0 ? c[0] < '50000' : c[0] >= '50000'));
		categoryField.innerHTML = `<option value="">Choose an account</option>${cats
			.map(
				(c) =>
					`<option value="${c[0]}" data-hint="${c[0]}"${c[0] === l.cat ? ' selected' : ''}>${htmlSafe(c[1])}</option>`,
			)
			.join('')}`;
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(categoryField);
		memo.value = `${l.who + (l.method === 'fee' ? ', account fee' : '')}, ${FULL[+l.date.slice(5, 7) - 1]}`;

		for (const el of [categoryField, memo]) {
			el.classList.remove('is-invalid');
		}

		pick('[data-hire-create-sub]', createEl).textContent = `${l.who}, ${signed(l.amount)} on ${day(l.date)}.`;
		pick('[data-hire-create-help]', createEl).textContent =
			`Books ${money(l.amount)}${l.amount > 0 ? ' into ' : ' out of '}${R.account.name} as journal entry #${nextEntry}, dated ${dayLong(l.date)}.`;
		bootstrap.Modal.getOrCreateInstance(createEl).show();
	}
	start();
})();
