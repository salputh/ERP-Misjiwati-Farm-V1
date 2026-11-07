/**
 * Basalt - Transaction Details (transaction-details.html)
 * One bank line in full: the amount and what the bank sent, how it
 * is matched in the books and the records it is linked to, its
 * category, notes and files, and everything that happened to it.
 *
 * The line comes from the shared bank feed
 * (assets/basalt/js/data/multipurpose/transactions.js); ?id=11 picks which one. Changes
 * made here live in memory for the demo; in your app, send them to
 * the server where the toasts are pushed.
 */
(() => {
	'use strict';
	const root = pick('[data-trd-root]');
	if (!root) return;

	const BOOK = window.Basalt.data.transactions;
	const TODAY = BOOK.today;
	const ME = BOOK.me;
	const DEFAULT_ID = 11;

	/* Helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
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
		return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function signed(n) {
		return (n < 0 ? '−' : '+') + money(n);
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	function day(iso) {
		const p = iso.split('-');
		return `${MONTHS[+p[1] - 1]} ${+p[2]}`;
	}

	function longDay(iso) {
		return `${DAYS[new Date(`${iso}T12:00`).getDay()]}, ${day(iso)}, ${iso.slice(0, 4)}`;
	}

	function clock(hhmm) {
		const h = +hhmm.slice(0, 2);
		return `${((h + 11) % 12) + 1}:${hhmm.slice(3, 5)}${h < 12 ? ' am' : ' pm'}`;
	}

	function stamp(at) {
		return `${at.slice(0, 10) === TODAY ? 'Today' : day(at.slice(0, 10))}, ${clock(at.slice(11, 16))}`;
	}

	function avatar(name) {
		return `<span class="basalt-avatar basalt-avatar-sm" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function nameOrYou(name) {
		return name === ME ? 'You' : name;
	}

	function pageOf(l) {
		return `transaction-details.html?id=${encodeURIComponent(l.id)}`;
	}

	function catName(code) {
		return (BOOK.ledger.find((c) => c[0] === code) || ['', ''])[1];
	}

	function isCategory(code) {
		return BOOK.categories.some((c) => c[0] === code);
	}

	/* The clock for today's changes; in your app this is the server's time. */
	let seq = 0;

	function now() {
		const d = new Date();
		seq += 1;
		return `${TODAY}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(seq).padStart(2, '0')}`;
	}

	const METHOD = {
		transfer: 'Bank transfer',
		debit: 'Direct debit',
		payout: 'Card payout',
		batch: 'Batch payment',
		own: 'Own transfer',
	};
	const HOW = {
		transfer: 'by bank transfer',
		debit: 'by direct debit',
		payout: 'as a card payout',
		batch: 'as a batch payment',
		own: 'as a transfer between our own accounts',
	};
	const STATUS = {
		matched: { word: 'Matched', tone: 'success' },
		found: { word: 'Match found', tone: 'info' },
		none: { word: 'No match', tone: 'warning' },
	};
	const KIND = {
		invoice: { word: 'Invoice', icon: 'bi-receipt' },
		receipt: { word: 'Receipt', icon: 'bi-credit-card' },
		bill: { word: 'Bill', icon: 'bi-file-earmark-text' },
		entry: { word: 'Journal entry', icon: 'bi-journal-text' },
		subs: { word: 'Subscriptions', icon: 'bi-arrow-repeat' },
		payroll: { word: 'Payroll', icon: 'bi-people' },
		line: { word: 'Bank line', icon: 'bi-arrow-left-right' },
	};

	/* The line */
	const asked = new URLSearchParams(window.location.search).get('id');
	const L = BOOK.find(asked) || BOOK.find(DEFAULT_ID);
	L.log = [];
	const acct = BOOK.accounts.find((a) => a.key === L.acct);
	/* Newest first, the order of the list on Transactions. */
	const ORDER = BOOK.lines.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time) || b.id - a.id);
	let nextEntry = 415;
	const ui = { editing: false };

	function statusOf(l) {
		return l.match ? 'matched' : l.suggest ? 'found' : 'none';
	}

	function direction(l) {
		return l.transfer ? 'own' : l.amount > 0 ? 'in' : 'out';
	}

	const DIR = {
		in: { word: 'Money in', icon: 'bi-arrow-down-left' },
		out: { word: 'Money out', icon: 'bi-arrow-up-right' },
		own: { word: 'Own transfer', icon: 'bi-arrow-left-right' },
	};
	function pill(l) {
		const s = STATUS[statusOf(l)];
		return `<span class="basalt-status basalt-status-dot basalt-status-${s.tone}">${s.word}</span>`;
	}

	/* Snapshots for Undo. */
	function snapshot() {
		return JSON.stringify({
			match: L.match || null,
			suggest: L.suggest || null,
			prevSuggest: L.prevSuggest || null,
			cat: L.cat,
			guess: L.guess || '',
			records: L.records,
			log: L.log,
			files: L.files,
		});
	}

	function restore(snap) {
		const s = JSON.parse(snap);

		for (const k of Object.keys(s)) {
			L[k] = s[k];
		}

		ui.editing = false;
		render();
		announce('Undone.');
	}

	/* Header */
	function paintHead() {
		document.title = `${L.who} · Basalt`;
		pick('[data-trd="title"]').textContent = L.who;
		pick('[data-trd="sub"]').textContent =
			`${acct.short} ···${acct.last4} · ${METHOD[L.method]} · ${day(L.date)}, ${clock(L.time)}`;
		const d = DIR[direction(L)];
		pick('[data-trd="tags"]').innerHTML =
			`${pill(L)}<span class="trd-dir"><i class="bi ${d.icon}" aria-hidden="true"></i>${d.word}</span>`;
		const i = ORDER.indexOf(L);

		function link(el, to) {
			if (to) {
				el.href = pageOf(to);
				el.classList.remove('disabled');
				el.removeAttribute('aria-disabled');
				el.removeAttribute('tabindex');
			} else {
				el.removeAttribute('href');
				el.classList.add('disabled');
				el.setAttribute('aria-disabled', 'true');
				el.setAttribute('tabindex', '-1');
			}
		}

		link(pick('[data-trd="prev"]'), ORDER[i - 1]);
		link(pick('[data-trd="next"]'), ORDER[i + 1]);
	}

	/* Summary */
	function paintSummary() {
		const dir = direction(L);
		pick('[data-trd="lead"]').innerHTML =
			`<strong>${money(L.amount)}</strong> ${L.amount > 0 ? 'came in ' : 'went out '}${HOW[L.method]} on ${day(L.date)}.`;
		pick('[data-trd="sum"]').innerHTML =
			`<span class="trd-mark trd-mark-${dir}" aria-hidden="true"><i class="bi ${DIR[dir].icon}"></i></span><div class="trd-sum-text"><p class="trd-sum-label">${DIR[dir].word}</p><p class="trd-sum-amount${dir === 'in' ? ' is-in' : ''}">${signed(L.amount)}</p></div><div class="trd-sum-end"><p class="trd-sum-label">Balance after</p><p class="trd-sum-value">${money(L.balance)}</p></div>`;
		const party = L.customer
			? `<a class="trd-link" href="company-details.html?id=${encodeURIComponent(L.customer)}">${htmlSafe(L.who)}</a>`
			: htmlSafe(L.who);
		const cat = L.cat
			? `${htmlSafe(catName(L.cat))} <span class="trd-cat-code">${L.cat}</span>`
			: '<span class="trd-cat-code ms-0">Not booked yet</span>';
		const facts = [
			['Account', `${htmlSafe(acct.name)} ···${acct.last4}`],
			['Counterparty', party],
			['Category', cat],
			['Method', METHOD[L.method]],
			['Reference', htmlSafe(L.ref)],
			['Bank reference', `<span class="trd-mono">${htmlSafe(L.memo)}</span>`],
			['Date', `${longDay(L.date)}, ${clock(L.time)}`],
		];
		pick('[data-trd="facts"]').innerHTML = facts.map((f) => `<div><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`).join('');
	}

	/* Match */
	function catOptions(picked) {
		return `<option value=""${picked ? '' : ' selected'}>Pick a category</option>${
			/* Money in books to an income account, money out to an expense one. */
			BOOK.categories
				.filter((c) => c[0] === picked || L.amount > 0 === (c[0].charAt(0) === '4'))
				.map((c) => `<option value="${c[0]}"${c[0] === picked ? ' selected' : ''}>${htmlSafe(c[1])}</option>`)
				.join('')
		}`;
	}
	function paintMatch() {
		const st = statusOf(L);
		const state = pick('[data-trd="state"]');
		let desc;
		if (st === 'matched') {
			desc = `In the books as journal entry ${L.match.entry}.`;
			state.setAttribute('data-tone', 'success');
			state.innerHTML = `<span class="trd-state-icon" aria-hidden="true"><i class="bi bi-check2-circle"></i></span><div><span class="trd-state-title">${htmlSafe(L.match.title)}</span><span class="trd-state-detail">${htmlSafe(L.match.detail)}</span><span class="trd-state-meta">Matched by ${htmlSafe(nameOrYou(L.match.by).replace(/^You$/, 'you'))}, ${stamp(L.match.at)}</span></div>`;
		} else if (st === 'found') {
			desc = 'A record with the same amount is waiting for you to confirm it.';
			state.setAttribute('data-tone', 'info');
			state.innerHTML = `<span class="trd-state-icon" aria-hidden="true"><i class="bi bi-link-45deg"></i></span><div><span class="trd-state-title">${htmlSafe(L.suggest.title)}</span><span class="trd-state-detail">${htmlSafe(L.suggest.detail)}</span><span class="trd-state-meta">${htmlSafe(L.suggest.why)}</span></div>`;
		} else {
			desc = L.prevSuggest
				? 'You set the suggestion aside. Pick a category to book it.'
				: 'Nothing in the books has this amount. Pick a category to book it.';
			state.setAttribute('data-tone', 'warning');
			state.innerHTML = `<span class="trd-state-icon" aria-hidden="true"><i class="bi bi-question-lg"></i></span><div><span class="trd-state-title">Not in the books yet</span><span class="trd-state-detail">${htmlSafe(L.hint || 'No invoice, bill or rule matches it.')}</span></div>`;
		}
		pick('[data-trd="match-desc"]').textContent = desc;

		pick('[data-trd="records"]').innerHTML = L.records.length
			? L.records
					.map((r) => {
						const k = KIND[r.kind];
						return `<li class="trd-record"><span class="trd-record-icon" aria-hidden="true"><i class="bi ${k.icon}"></i></span><span class="trd-record-text"><a class="trd-link trd-record-title" href="${htmlSafe(r.href)}">${htmlSafe(r.title)}</a><span class="trd-record-detail">${htmlSafe(r.detail)}</span></span><span class="trd-record-kind">${r.suggested ? 'Suggested' : k.word}</span></li>`;
					})
					.join('')
			: '<li class="trd-records-empty">No invoice, receipt or bill is linked yet.</li>';

		/* Category: shown as a value with Change, or as the picker. */
		const categoryBox = pick('[data-trd="cat"]');
		const form = pick('[data-trd-cat-form]');
		const select = pick('[data-trd-cat-select]');
		const picking = st === 'none' || ui.editing;
		categoryBox.hidden = picking;
		form.hidden = !picking;
		if (!picking) {
			const can = st === 'matched' && isCategory(L.cat);
			let note;
			if (st === 'found') note = `Set when you confirm the match: ${catName(L.suggest.cat)}.`;
			else if (!can)
				note = L.transfer
					? 'Money moved between our own accounts, so it has no category.'
					: 'Follows the linked record, so it changes there.';
			categoryBox.innerHTML = `<span class="trd-cat-name">${L.cat ? `${htmlSafe(catName(L.cat))}<span class="trd-cat-code">${L.cat}</span>` : 'None yet'}${note ? `<span class="trd-cat-note">${htmlSafe(note)}</span>` : ''}</span>${can ? '<button type="button" class="btn btn-outline-secondary btn-sm" data-trd-recat><i class="bi bi-pencil me-1" aria-hidden="true"></i>Change</button>' : ''}`;
		} else {
			select.innerHTML = catOptions(ui.editing ? L.cat : L.guess || '');
			select.classList.remove('is-invalid');
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(select);
			pick('[data-trd="hint"]').textContent = ui.editing
				? 'Moves the line and its journal entry to the new account.'
				: '';
			pick('[data-trd-cat-cancel]').hidden = !ui.editing;
			pick('[data-trd="cat-foot"]').hidden = !ui.editing;
		}

		let decide;
		if (st === 'matched') {
			decide =
				'<button type="button" class="btn btn-outline-secondary btn-sm" data-trd-act="undo"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Undo match</button>';
		} else if (st === 'found') {
			decide = `<button type="button" class="btn btn-outline-secondary btn-sm trd-decide-left" data-trd-act="ignore">Not this one</button><button type="button" class="btn btn-primary btn-sm" data-trd-act="confirm"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Confirm match</button>`;
		} else {
			decide =
				'<button type="submit" form="trd-cat-form" class="btn btn-primary btn-sm"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Book it</button>';
		}
		/* While the category is being changed, its own Save and Cancel are the only actions. */
		const box = pick('[data-trd="decide"]');
		box.innerHTML = decide;
		box.hidden = !!ui.editing;
	}

	/* Notes and files */
	function paintNotes() {
		const list = L.notes.slice().sort((a, b) => a.at.localeCompare(b.at));
		pick('[data-trd="thread"]').innerHTML = list.length
			? list
					.map(
						(n) =>
							`<li class="trd-msg">${avatar(n.who)}<div class="trd-msg-body"><p class="trd-msg-head"><span class="trd-msg-who">${htmlSafe(n.who)}</span><span class="trd-msg-when">${stamp(n.at)}</span></p><p class="trd-msg-text">${htmlSafe(n.text)}</p></div></li>`,
					)
					.join('')
			: '<li class="trd-thread-empty">No notes yet. Say what this money was for, so the next person doesn’t have to ask.</li>';

		function icon(name) {
			return /\.csv$/i.test(name)
				? 'bi-filetype-csv'
				: /\.pdf$/i.test(name)
					? 'bi-file-earmark-pdf'
					: /\.(png|jpe?g|gif|webp|heic)$/i.test(name)
						? 'bi-file-earmark-image'
						: 'bi-file-earmark';
		}

		pick('[data-trd="files"]').innerHTML = L.files
			.map(
				(f, i) =>
					`<li class="trd-file"><span class="trd-file-icon" aria-hidden="true"><i class="bi ${icon(f.name)}"></i></span><span class="trd-file-text"><span class="trd-file-name">${htmlSafe(f.name)}</span><span class="trd-file-meta">${htmlSafe(f.size)} · ${htmlSafe(nameOrYou(f.who))}, ${stamp(f.at)}</span></span><button type="button" class="btn btn-icon btn-sm" data-trd-file="${i}" aria-label="Download ${htmlSafe(f.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Download"><i class="bi bi-download" aria-hidden="true"></i></button></li>`,
			)
			.join('');
		if (window.Basalt.avatars) window.Basalt.avatars(pick('[data-trd="thread"]'));
	}

	/* Timeline */
	function events() {
		const out = [
			{ at: `${L.date}T${L.time}`, icon: 'bi-bank', who: 'Northbank', what: 'sent the line in the bank feed' },
		];
		if (L.suggest && L.suggest.at)
			out.push({
				at: L.suggest.at,
				icon: 'bi-link-45deg',
				tone: 'info',
				who: 'Bank rules',
				what: `suggested ${L.suggest.title}`,
			});
		if (L.match && L.match.at)
			out.push({
				at: L.match.at,
				icon: 'bi-check2-circle',
				tone: 'success',
				who: L.match.by,
				what: `matched it to ${L.match.title}`,
			});
		L.notes.forEach((n) => out.push({ at: n.at, icon: 'bi-chat-left-text', who: n.who, what: 'added a note' }));
		L.files.forEach((f) =>
			out.push({ at: f.at, icon: 'bi-paperclip', tone: 'primary', who: f.who, what: `attached ${f.name}` }),
		);
		/* Today's changes are kept in the log, in place of the event they undo. */
		const seen = new Set(L.log.map((e) => e.at));
		return out
			.filter((e) => !seen.has(e.at))
			.concat(L.log)
			.sort((a, b) => b.at.localeCompare(a.at));
	}
	function paintFeed() {
		pick('[data-trd="feed"]').innerHTML = events()
			.map(
				(e) =>
					`<li class="trd-feed-item"${e.tone ? ` data-tone="${e.tone}"` : ''}><span class="trd-feed-mark" aria-hidden="true"><i class="bi ${e.icon}"></i></span><div><p class="trd-feed-what"><strong>${htmlSafe(nameOrYou(e.who))}</strong> ${htmlSafe(e.what)}</p><p class="trd-feed-when">${stamp(e.at)}</p></div></li>`,
			)
			.join('');
	}

	function render() {
		paintHead();
		paintSummary();
		paintMatch();
		paintNotes();
		paintFeed();
		if (window.Basalt.tips) window.Basalt.tips(root);
	}

	/* Actions */
	function booked(snap, title, text) {
		ui.editing = false;
		render();
		pick('#trd-match-title').focus();
		toast({
			tone: 'success',
			icon: 'bi-check2-circle',
			title,
			text,
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
	function confirmMatch() {
		const snap = snapshot();
		const s = L.suggest;
		const at = now();
		L.match = { title: s.title, detail: s.detail, entry: s.entry || `#${nextEntry++}`, by: ME, at };
		L.cat = s.cat;
		L.suggest = null;
		L.records = L.records.map((r) => Object.assign({}, r, { suggested: false }));
		if (!L.records.some((r) => r.kind === 'entry'))
			L.records.push({ kind: 'entry', title: L.match.entry, detail: s.title, href: 'accounting.html' });
		L.log.push({ at, icon: 'bi-check2-circle', tone: 'success', who: ME, what: `matched it to ${s.title}` });
		booked(snap, 'Matched', `${L.who} is in the books as ${L.match.entry}.`);
	}
	function saveCategory(code) {
		const snap = snapshot();
		const at = now();
		if (ui.editing) {
			const was = L.cat;
			L.cat = code;
			L.match.detail = `Booked to ${catName(code)}`;
			if (/^Booked to /.test(L.match.title) || L.match.title === catName(was)) L.match.title = catName(code);
			L.log.push({ at, icon: 'bi-tag', who: ME, what: `moved it from ${catName(was)} to ${catName(code)}` });
			booked(snap, 'Category changed', `${L.who} is now under ${catName(code)}.`);
			return;
		}
		const entry = `#${nextEntry++}`;
		L.prevSuggest = L.suggest || null;
		L.suggest = null;
		L.cat = code;
		L.match = { title: catName(code), detail: `Account ${code}, booked by hand`, entry, by: ME, at };
		L.records = L.records
			.filter((r) => !r.suggested)
			.concat([{ kind: 'entry', title: entry, detail: `Booked to ${catName(code)}`, href: 'accounting.html' }]);
		L.log.push({ at, icon: 'bi-check2-circle', tone: 'success', who: ME, what: `booked it to ${catName(code)}` });
		booked(snap, 'Booked', `${L.who} is in the books as ${entry}.`);
	}
	function undoMatch() {
		const snap = snapshot();
		const at = now();
		const m = L.match;
		L.match = null;
		if (L.prevSuggest) {
			L.suggest = L.prevSuggest;
			L.prevSuggest = null;
		} else if (!m.title || m.detail.indexOf('booked by hand') < 0)
			L.suggest = {
				title: m.title,
				detail: m.detail,
				entry: m.entry,
				why: 'It was matched before; confirm it again or pick a category.',
				cat: L.cat,
			};
		L.guess = L.cat;
		L.cat = '';
		if (L.suggest) L.records = L.records.map((r) => Object.assign({}, r, { suggested: true }));
		else L.records = [];
		L.log.push({ at, icon: 'bi-arrow-counterclockwise', tone: 'warning', who: ME, what: 'undid the match' });
		ui.editing = false;
		render();
		pick('#trd-match-title').focus();
		toast({
			tone: 'info',
			icon: 'bi-arrow-counterclockwise',
			title: 'Match undone',
			text: 'It is back in To match on Transactions.',
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
	function ignoreSuggestion() {
		const snap = snapshot();
		L.prevSuggest = L.suggest;
		L.guess = L.suggest.cat && L.suggest.cat !== '11100' ? L.suggest.cat : '';
		L.suggest = null;
		L.records = L.records.filter((r) => !r.suggested);
		L.log.push({ at: now(), icon: 'bi-x-circle', who: ME, what: 'set the suggestion aside' });
		render();
		pick('[data-trd-cat-select]').focus();
		toast({
			tone: 'info',
			icon: 'bi-x-circle',
			title: 'Suggestion set aside',
			text: 'Pick a category to book it instead.',
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

	function bind() {
		root.addEventListener('click', (e) => {
			const act = e.target.closest('[data-trd-act]');
			if (act) {
				const a = act.getAttribute('data-trd-act');
				if (a === 'confirm') confirmMatch();
				else if (a === 'undo') undoMatch();
				else if (a === 'ignore') ignoreSuggestion();
				return;
			}
			if (e.target.closest('[data-trd-recat]')) {
				ui.editing = true;
				paintMatch();
				pick('[data-trd-cat-select]').focus();
				return;
			}
			if (e.target.closest('[data-trd-cat-cancel]')) {
				ui.editing = false;
				paintMatch();
				const b = pick('[data-trd-recat]');
				if (b) b.focus();
				return;
			}
			const file = e.target.closest('[data-trd-file]');
			if (file) {
				const f = L.files[+file.getAttribute('data-trd-file')];
				toast({ tone: 'success', icon: 'bi-download', title: 'Downloading', text: f.name });
			}
		});

		const form = pick('[data-trd-cat-form]');
		const select = pick('[data-trd-cat-select]');
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!select.value) {
				select.classList.add('is-invalid');
				select.focus();
				return;
			}
			if (ui.editing && select.value === L.cat) {
				ui.editing = false;
				paintMatch();
				return;
			}
			saveCategory(select.value);
		});
		select.addEventListener('change', () => select.classList.remove('is-invalid'));

		const reply = pick('[data-trd-reply]');
		const note = pick('[data-trd-note]');
		reply.addEventListener('submit', (e) => {
			e.preventDefault();
			const text = note.value.trim();
			if (!text) {
				note.classList.add('is-invalid');
				note.focus();
				return;
			}
			L.notes.push({ at: now(), who: ME, text });
			note.value = '';
			paintNotes();
			paintFeed();
			announce('Note added.');
		});
		note.addEventListener('input', () => {
			if (note.value.trim()) note.classList.remove('is-invalid');
		});

		pick('[data-trd-drop]').addEventListener('basalt:files', (e) => {
			const snap = snapshot();
			const f = e.detail.files[0];
			const kb = Math.max(1, Math.round(f.size / 1024));
			L.files.push({
				name: f.name,
				size: kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`,
				at: now(),
				who: ME,
			});
			paintNotes();
			paintFeed();
			if (window.Basalt.tips) window.Basalt.tips(pick('[data-trd="files"]'));
			toast({
				tone: 'success',
				icon: 'bi-paperclip',
				title: 'File attached',
				text: f.name,
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

		pick('[data-trd-copy]').addEventListener('click', () => {
			const url = new URL(pageOf(L), window.location.href).href;
			if (window.Basalt.copyText) window.Basalt.copyText(url);
			toast({
				tone: 'success',
				icon: 'bi-link-45deg',
				title: 'Link copied',
				text: 'It opens this line for anyone on the finance team.',
			});
		});
		pick('[data-trd-export]').addEventListener('click', () => {
			toast({
				tone: 'success',
				icon: 'bi-filetype-csv',
				title: 'Downloading',
				text: `northbank-${acct.last4}-${L.date}.csv`,
			});
		});
	}

	function start() {
		render();
		bind();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
})();
