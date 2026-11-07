/**
 * Basalt - Approval Details (approval-details.html)
 * One request for sign-off: what is asked and by whom, the rule it
 * hit, the decision, the comments and the history. Opened from
 * Approvals with ?id=%231050; without one it shows the oldest request
 * still waiting.
 *
 * Approving or declining stays on the page: the Sign-off card shows
 * the answer, and a toast offers Undo.
 *
 * To use your own data, replace assets/basalt/js/data/multipurpose/approvals.js with what
 * your backend returns, in the same shape. People come from
 * assets/basalt/js/data/multipurpose/people.js.
 */
(() => {
	'use strict';
	const root = pick('[data-apd-root]');
	const DATA = window.Basalt.data && window.Basalt.data.approvals;
	const P = window.Basalt.data && window.Basalt.data.people;
	if (!root || !DATA || !P) return;

	function start() {
		root.addEventListener('click', (e) => {
			const go = e.target.closest('[data-apd-go]');
			if (!go || req.status !== 'waiting') return;
			const status = go.dataset.apdGo;
			const ok = status === 'approved';
			const note = (pick('[data-apd-note]', root) || {}).value || '';
			req.status = status;
			req.decidedBy = DATA.me;
			req.decidedAt = DATA.now;
			req.note = note.trim();
			req.history.push([DATA.now, DATA.me, ok ? 'Approved' : 'Declined', ok ? 'check' : 'x']);
			paintEverything();
			el.title.focus({ preventScroll: true });
			say(req.title + (ok ? ' approved.' : ' declined.'));
			toast({
				tone: ok ? 'success' : 'info',
				icon: ok ? 'bi-check2-circle' : 'bi-x-circle',
				title: ok ? 'Approved' : 'Declined',
				text: `${nameOf(req.by)} gets an email.`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							req.status = 'waiting';
							req.decidedBy = null;
							req.decidedAt = null;
							req.history.pop();
							paintEverything();
							const n = pick('[data-apd-note]', root);
							if (n) n.value = note;
							say('Back to waiting.');
						},
					},
				],
			});
		});
		el.title.setAttribute('tabindex', '-1');

		/* Comments */
		const reply = pick('[data-apd-reply]', root);
		const replyText = pick('[data-apd-reply-text]', root);
		const replyError = pick('[data-apd-reply-error]', root);
		reply.addEventListener('submit', (e) => {
			e.preventDefault();
			const text = replyText.value.trim();
			replyError.hidden = !!text;
			replyText.classList.toggle('is-invalid', !text);
			if (!text) {
				replyText.focus();
				return;
			}
			req.comments.push([DATA.me, DATA.now, text]);
			replyText.value = '';
			renderComments();
			say('Comment added.');
		});
		replyText.addEventListener('input', () => {
			if (replyText.value.trim()) {
				replyError.hidden = true;
				replyText.classList.remove('is-invalid');
			}
		});
		replyText.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) reply.requestSubmit();
		});

		paintEverything();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function parse(s) {
		const [d, t] = s.split('T');
		const [y, m, dd] = d.split('-').map(Number);
		const [h, mi] = (t || '12:00').split(':').map(Number);
		return new Date(y, m - 1, dd, h, mi);
	}
	const NOW = parse(DATA.now);

	function dayStart(d) {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	function agoDays(s) {
		return Math.round((dayStart(NOW) - dayStart(parse(s))) / 864e5);
	}

	function time12(d) {
		return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	}

	function dayText(s) {
		return parse(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	/* "today at 9:05 AM", "yesterday at 5:10 PM", "on Fri, Oct 2 at 10:10 AM" */
	function whenPhrase(s) {
		const n = agoDays(s);
		const t = time12(parse(s));
		return `${n === 0 ? 'today' : n === 1 ? 'yesterday' : `on ${dayText(s)}`} at ${t}`;
	}
	function whenText(s) {
		const n = agoDays(s);
		const d = parse(s);
		if (n === 0) return `Today, ${time12(d)}`;
		if (n === 1) return `Yesterday, ${time12(d)}`;
		return `${dayText(s)}, ${time12(d)}`;
	}

	function person(id) {
		return P.recordWithId(id);
	}

	function nameOf(id) {
		const p = person(id);
		return p ? P.nameOf(p) : id;
	}

	function avatar(id, size) {
		return `<span class="basalt-avatar ${size || 'basalt-avatar-sm'}" data-basalt-avatar data-name="${htmlSafe(nameOf(id))}" aria-hidden="true"></span>`;
	}

	/* The request */
	const all = DATA.list();
	const asked = new URLSearchParams(location.search).get('id');
	const oldestWaiting = all.filter((r) => r.status === 'waiting').sort((a, b) => parse(a.at) - parse(b.at))[0];
	const req = all.find((r) => r.id === asked) || oldestWaiting || all[0];
	const rule = DATA.rule(req.rule);

	function approver() {
		return req.decidedBy || rule.approver;
	}

	const el = {};

	for (const x of pickAll('[data-apd]', root)) {
		el[x.dataset.apd] = x;
	}

	const live = pick('[data-apd-live]', root);
	function say(t) {
		live.textContent = '';
		setTimeout(() => {
			live.textContent = t;
		}, 30);
	}

	/* Previous and next follow the queue's order: number, newest first. */
	(function pager() {
		const ids = all
			.map((r) => r.id)
			.sort()
			.reverse();
		const at = ids.indexOf(req.id);

		function set(a, id) {
			if (id) {
				a.href = `approval-details.html?id=${encodeURIComponent(id)}`;
				a.classList.remove('disabled');
				a.removeAttribute('aria-disabled');
				a.removeAttribute('tabindex');
			} else {
				a.removeAttribute('href');
				a.classList.add('disabled');
				a.setAttribute('aria-disabled', 'true');
			}
		}

		set(el.prev, ids[at - 1]);
		set(el.next, ids[at + 1]);
	})();

	const PILL = {
		waiting: ['warning', 'Waiting'],
		approved: ['success', 'Approved'],
		declined: ['danger', 'Declined'],
	};

	function paintHead() {
		document.title = `${req.title} · Basalt`;
		el.title.textContent = req.title;
		el.sub.textContent = `${req.id} · Asked by ${nameOf(req.by)} on ${dayText(req.at)} at ${time12(parse(req.at))}`;
		const p = PILL[req.status];
		el.tags.innerHTML = `<span class="basalt-status basalt-status-dot basalt-status-${p[0]}">${p[1]}</span><span class="apd-tag"><i class="bi ${rule.icon}" aria-hidden="true"></i>${htmlSafe(rule.name)}</span>`;
	}

	function renderAsk() {
		const by = person(req.by);
		el['ask-desc'].textContent = `In ${nameOf(req.by).split(' ')[0]}’s words, with the details.`;
		el.who.innerHTML = `${avatar(req.by, '')}<div class="apd-who-text"><a class="apd-who-name" href="${htmlSafe(P.userPage(by))}">${htmlSafe(nameOf(req.by))}</a><span class="apd-quiet">${htmlSafe(by.title)} · ${htmlSafe(by.team)}</span></div>`;
		el.what.textContent = req.what;

		function fact(k, v) {
			return `<div class="apd-facts-row"><dt>${htmlSafe(k)}</dt><dd>${v}</dd></div>`;
		}

		el.facts.innerHTML =
			fact(
				'Amount',
				req.amount ? `<strong>${money(req.amount)}</strong>${req.pct ? ` off, ${req.pct}%` : ''}` : 'No cost',
			) +
			req.facts
				.map((x) =>
					fact(
						x[0],
						x[2] ? `<a class="apd-link" href="${htmlSafe(x[2])}">${htmlSafe(x[1])}</a>` : htmlSafe(x[1]),
					),
				)
				.join('') +
			fact('Needed by', htmlSafe(dayText(req.needBy)));
	}

	function limitText() {
		return rule.unit === 'usd' ? ` ${money(rule.limit)}` : rule.unit === 'pct' ? ` ${rule.limit}%` : '';
	}

	function renderDecide() {
		el['decide-desc'].textContent =
			req.status === 'waiting'
				? `Waiting for ${plural(Math.max(agoDays(req.at), 0), 'day')}.`
				: 'The answer, and who gave it.';
		if (req.status === 'waiting' && agoDays(req.at) === 0) el['decide-desc'].textContent = 'Asked today.';
		el.rule.innerHTML = `<span class="apd-chip apd-tone-${rule.tone}" aria-hidden="true"><i class="bi ${rule.icon}"></i></span><div class="apd-rule-text"><p class="apd-rule-name">${htmlSafe(rule.name)}</p><p class="apd-quiet">${htmlSafe(rule.when + limitText())}. ${htmlSafe(rule.after)}</p></div>`;
		const who = approver();
		const whoRow = `<div class="apd-approver">${avatar(who)}<div class="apd-who-text"><span class="apd-approver-name">${htmlSafe(nameOf(who))}</span><span class="apd-quiet">${htmlSafe((person(who) || {}).title || '')}</span></div></div>`;
		if (req.status === 'waiting') {
			el.decide.innerHTML = `<h3 class="apd-section">Approver</h3>${whoRow}<form class="apd-decide" novalidate data-apd-decide><label class="form-label" for="apd-note">Note to ${htmlSafe(nameOf(req.by).split(' ')[0])}</label><textarea class="form-control" id="apd-note" rows="2" maxlength="300" placeholder="Optional" data-apd-note></textarea><div class="apd-decide-foot"><button type="button" class="btn btn-outline-secondary btn-sm" data-apd-go="declined"><i class="bi bi-x-lg me-1" aria-hidden="true"></i>Decline</button><button type="button" class="btn btn-primary btn-sm" data-apd-go="approved"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button></div></form>`;
		} else {
			const ok = req.status === 'approved';
			el.decide.innerHTML = `<h3 class="apd-section">${ok ? 'Approved by' : 'Declined by'}</h3>${whoRow}<div class="apd-outcome apd-outcome-${ok ? 'ok' : 'no'}"><i class="bi ${ok ? 'bi-check2-circle' : 'bi-x-circle'}" aria-hidden="true"></i><p>${ok ? 'Approved' : 'Declined'} ${htmlSafe(whenPhrase(req.decidedAt))}.${req.note ? ` “${htmlSafe(req.note)}”` : ' No note.'}</p></div>`;
		}
		if (window.Basalt.avatars) window.Basalt.avatars(el.decide);
	}

	const ICONS = {
		send: 'bi-send',
		check: 'bi-check2',
		x: 'bi-x-lg',
		chat: 'bi-chat-left-text',
		file: 'bi-file-earmark-text',
	};
	function renderHistory() {
		el.history.innerHTML = req.history
			.map(
				(h) =>
					`<li class="apd-feed-item"><span class="apd-feed-icon apd-feed-icon-${h[3]}" aria-hidden="true"><i class="bi ${ICONS[h[3]] || 'bi-dot'}"></i></span><div class="apd-feed-text"><p class="apd-feed-what"><strong>${htmlSafe(nameOf(h[1]))}</strong> ${htmlSafe(h[2].replace(/^./, (c) => c.toLowerCase()))}</p><p class="apd-quiet">${htmlSafe(whenText(h[0]))}</p></div></li>`,
			)
			.join('');
	}

	function renderComments() {
		el['comments-desc'].textContent = req.comments.length
			? `${plural(req.comments.length, 'comment')}, oldest first.`
			: 'No comments yet. Ask a question here.';
		el.comments.innerHTML = req.comments
			.map(
				(c) =>
					`<li class="apd-comment">${avatar(c[0])}<div class="apd-comment-body"><p class="apd-comment-head"><strong>${htmlSafe(nameOf(c[0]))}</strong><span class="apd-quiet">${htmlSafe(whenText(c[1]))}</span></p><p class="apd-comment-text">${htmlSafe(c[2])}</p></div></li>`,
			)
			.join('');
		el.comments.hidden = !req.comments.length;
		if (window.Basalt.avatars) window.Basalt.avatars(el.comments);
	}

	function paintEverything() {
		paintHead();
		renderAsk();
		renderDecide();
		renderHistory();
		renderComments();
	}

	/* Deciding, with Undo */
	start();

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
