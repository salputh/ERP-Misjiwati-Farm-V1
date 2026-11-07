/**
 * Basalt - Role Details (role-details.html)
 * One open role in full, and the job posting people apply from:
 * pay, hiring manager, how long it has been open, everyone who
 * applied by stage, the posting itself (published or not, edited in
 * place), the interview plan and what has happened so far. The
 * status pill pauses, closes or reopens the role.
 * Uses the detail header, the status menu, avatars, status pills,
 * empty states and toasts.
 */
(() => {
	'use strict';
	/* In your app these come from the server and the clock. The role is
     the one named by ?id= in the address, from the same data as the
     Hiring page (assets/basalt/js/data/multipurpose/hiring.js); opened on its own, the
     page shows Senior Backend Engineer. */
	const TODAY = '2026-10-09';
	const ME = 'John Armstrong';
	const CAREERS = 'fieldline.app/careers/';

	/* The five stages, with the same colors as the Hiring board. */
	const STAGES = [
		{ key: 'applied', label: 'Applied' },
		{ key: 'screen', label: 'Screening' },
		{ key: 'interview', label: 'Interviews' },
		{ key: 'offer', label: 'Offer' },
		{ key: 'hired', label: 'Hired' },
	];
	const STATUS = {
		open: { label: 'Open', tone: 'success' },
		paused: { label: 'Paused', tone: 'warning' },
		closed: { label: 'Closed', tone: 'danger' },
	};
	const SETUPS = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On site' };

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
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

	function count(n, one, many) {
		return `${n < WORDS.length ? WORDS[n] : String(n)} ${n === 1 ? one : many || `${one}s`}`;
	}

	function cap(s) {
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function toDate(iso) {
		const p = iso.split('-').map(Number);
		return new Date(p[0], p[1] - 1, p[2]);
	}

	function dayGap(a, b) {
		return Math.round((toDate(b) - toDate(a)) / 86400000);
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	function dayMonth(iso) {
		const d = toDate(iso);
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	function fullDay(iso) {
		return `${dayMonth(iso)}, ${iso.slice(0, 4)}`;
	}

	/* The record */
	const H = window.Basalt.data.hiring;
	const ROSTER = window.Basalt.data.people;
	const asked = new URLSearchParams(location.search).get('id') || '';
	const KEY = H.roles[asked] ? asked : 'backend';
	const role = H.roles[KEY];
	role.does = role.does || [];
	role.wants = role.wants || [];
	const theirs = H.candidates.filter((c) => c.role === KEY);
	const slug = role.title
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

	function nameOf(c) {
		return `${c.first} ${c.last}`;
	}

	function candidateUrl(c) {
		return `candidate-details.html?id=${encodeURIComponent(c.id)}`;
	}

	function toneOf(c) {
		return (c.id.split('').reduce((n, ch) => n + ch.charCodeAt(0), 0) % 8) + 1;
	}

	function staffOf(name) {
		return ROSTER.people.find((p) => ROSTER.nameOf(p) === name) || null;
	}
	function staffUrl(name) {
		const p = staffOf(name);
		return p ? ROSTER.staffPage(p) : 'employees.html';
	}

	function personLink(name) {
		return `<a class="rd-link" href="${staffUrl(name)}">${htmlSafe(name)}</a>`;
	}

	/* What happened, oldest first: [day, kind, html]. The role's own
     events, then each candidate's record as it touches this role. */
	const LOG = [
		[role.opened, 'open', `${personLink(role.manager)} opened the role, ${count(role.openings, 'opening')}`],
	];
	if (role.views || role.published)
		LOG.push([role.opened, 'publish', `${personLink(role.recruiter)} put the posting on the careers page`]);
	if (role.pausedOn)
		LOG.push([role.pausedOn, 'pause', `${personLink(role.manager)} paused hiring. ${htmlSafe(role.why)}`]);

	for (const c of theirs) {
		const who = `<a class="rd-link" href="${candidateUrl(c)}">${htmlSafe(nameOf(c))}</a>`;
		c.history.forEach(([day, text]) => {
			let m;
			if (/^Applied/.test(text))
				LOG.push([day, 'apply', `${who} applied${c.source === 'board' ? ' through a job board' : ''}`]);
			else if ((m = /^Referred by (.+)$/.exec(text)))
				LOG.push([day, 'apply', `${htmlSafe(m[1])} referred ${who}`]);
			else if ((m = /^Put forward by (.+)$/.exec(text)))
				LOG.push([day, 'apply', `${htmlSafe(m[1])} put ${who} forward`]);
			else if ((m = /^Moved to (\w+) by (.+)$/.exec(text)))
				LOG.push([day, 'move', `${htmlSafe(m[2])} moved ${who} to ${m[1]}`]);
			else if (/^Offer/.test(text))
				LOG.push([day, 'offer', `${who}: ${htmlSafe(text.charAt(0).toLowerCase() + text.slice(1))}`]);
			else if (/^(Signed|Accepted)/.test(text))
				LOG.push([day, 'hire', `${who} ${htmlSafe(text.charAt(0).toLowerCase() + text.slice(1))}`]);
			else LOG.push([day, 'call', `${who}: ${htmlSafe(text.charAt(0).toLowerCase() + text.slice(1))}`]);
		});
	}

	const LOG_SHOWN = 6;
	let logOpen = false;

	/* Elements */
	function D(k) {
		return pick(`[data-rd="${k}"]`);
	}

	const el = {
		status: pick('[data-rd-status]'),
		statusLabel: pick('[data-rd-status-label]'),
		publish: pick('[data-rd-publish]'),
		edit: pick('[data-rd-edit]'),
		form: pick('[data-rd-edit-form]'),
		copy: pick('[data-rd-copy]'),
		more: pick('[data-rd-log-more]'),
	};

	/* Header */
	function paintHead() {
		const s = STATUS[role.status] || STATUS.open;
		document.title = `${role.title} · Basalt`;
		D('title').textContent = role.title;
		D('sub').textContent = `${role.team} · ${role.where} · ${role.type}`;
		el.status.className = `basalt-status basalt-status-dot basalt-status-${s.tone}`;
		el.statusLabel.textContent = s.label;
		el.status.setAttribute('aria-label', `Role status: ${s.label}. Change status`);

		for (const b of pickAll('[data-rd-set]')) {
			const on = b.getAttribute('data-rd-set') === role.status;
			b.classList.toggle('active', on);
			if (on) b.setAttribute('aria-current', 'true');
			else b.removeAttribute('aria-current');
		}

		D('pub').innerHTML = role.published
			? '<span class="basalt-status basalt-status-primary"><i class="bi bi-globe2" aria-hidden="true"></i>On the careers page</span>'
			: '<span class="basalt-status"><i class="bi bi-eye-slash" aria-hidden="true"></i>Not on the careers page</span>';
		D('board').href = `hiring.html?role=${encodeURIComponent(KEY)}`;

		const notice = D('notice');
		notice.hidden = role.status === 'open';
		if (role.status === 'paused') {
			notice.className = 'rd-notice rd-notice-paused';
			notice.innerHTML = `<i class="bi bi-pause-circle" aria-hidden="true"></i><span>Hiring is paused${role.why ? `: ${htmlSafe(role.why.replace(/\.$/, '').charAt(0).toLowerCase() + role.why.replace(/\.$/, '').slice(1))}` : ''}. Candidates already in the pipeline carry on.</span><button type="button" class="btn btn-sm btn-outline-secondary" data-rd-set="open">Resume hiring</button>`;
		} else if (role.status === 'closed') {
			notice.className = 'rd-notice rd-notice-closed';
			notice.innerHTML =
				'<i class="bi bi-x-circle" aria-hidden="true"></i><span>This role is closed and turns new applications away.</span><button type="button" class="btn btn-sm btn-outline-secondary" data-rd-set="open">Reopen</button>';
		}
	}

	/* At a glance */
	function paintGlance() {
		const hired = theirs.filter((c) => c.stage === 'hired').length;
		const age = dayGap(role.opened, TODAY);
		const mgr = staffOf(role.manager);
		const weeks = role.start ? Math.round(dayGap(TODAY, role.start) / 7) : 0;
		const items = [
			['pay', 'bi-cash-stack', 'Salary', htmlSafe(role.band), 'A year, before tax'],
			[
				'manager',
				'bi-person-badge',
				'Hiring manager',
				(mgr
					? `<span class="basalt-avatar basalt-avatar-xs basalt-avatar-tone-${ROSTER.toneOf(mgr)}" aria-hidden="true">${ROSTER.initials(mgr)}</span>`
					: '') + personLink(role.manager),
				mgr ? htmlSafe(cap(mgr.title)) : '',
			],
			[
				'age',
				'bi-hourglass-split',
				'Open for',
				age ? count(age, 'day') : 'Opened today',
				age ? `Since ${dayMonth(role.opened)}` : 'Applications start now',
			],
			[
				'filled',
				'bi-check2-circle',
				'Filled',
				`${hired} of ${role.openings}`,
				role.openings - hired > 0
					? `${cap(count(role.openings - hired, 'opening'))} left`
					: 'Every opening filled',
			],
			[
				'start',
				'bi-calendar-event',
				'Target start',
				role.start ? fullDay(role.start) : 'Not set',
				role.start ? (weeks > 1 ? `In ${weeks} weeks` : 'Soon') : 'Set it when you edit the role',
			],
		];
		D('glance').innerHTML = items
			.map(
				(x) =>
					`<div class="rd-glance-item" data-tone="${x[0]}"><dt><span class="rd-glance-icon" aria-hidden="true"><i class="bi ${x[1]}"></i></span>${x[2]}</dt><dd><span class="rd-glance-value">${x[3]}</span>${x[4] ? `<span class="rd-glance-note">${x[4]}</span>` : ''}</dd></div>`,
			)
			.join('');
	}

	/* Candidates by stage */
	function nextText(c) {
		if (c.stage === 'hired') return `Starts ${dayMonth(c.next.date)}`;
		if (!c.next.date) return `${c.next.text}, ${c.next.todo.toLowerCase()}`;
		return `${c.next.text}, ${dayMonth(c.next.date)}`;
	}
	function paintStages() {
		const inPlay = theirs.filter((c) => c.stage !== 'hired').length;
		const furthest = theirs
			.filter((c) => c.stage !== 'hired')
			.reduce(
				(at, c) =>
					Math.max(
						at,
						STAGES.findIndex((s) => s.key === c.stage),
					),
				-1,
			);
		D('stages-desc').textContent = !theirs.length
			? 'No one has applied yet.'
			: `${cap(count(inPlay, 'candidate'))} in progress${furthest >= 0 ? `, the furthest at ${STAGES[furthest].label}.` : '.'}`;
		const bar = D('bar');
		bar.hidden = !theirs.length;
		if (!theirs.length) {
			D('stages').innerHTML =
				`<div class="basalt-empty basalt-empty-compact basalt-empty-muted rd-empty"><span class="basalt-empty-badge" aria-hidden="true"><i class="bi bi-person-plus"></i></span><h3 class="basalt-empty-title">No candidates yet</h3><p class="basalt-empty-text">${role.status !== 'open' ? 'The role is not taking applications right now.' : role.published ? 'Applications from the careers page land here.' : 'Publish the posting, or add someone you already know from the Hiring page.'}</p><div class="basalt-empty-actions"><a class="btn btn-sm btn-outline-secondary" href="hiring.html">Add a candidate</a></div></div>`;
			return;
		}
		bar.innerHTML = STAGES.map((s) => {
			const n = theirs.filter((c) => c.stage === s.key).length;
			return n ? `<span class="rd-bar-part" data-stage="${s.key}" style="flex-grow:${n}"></span>` : '';
		}).join('');
		bar.setAttribute('role', 'img');
		bar.setAttribute(
			'aria-label',
			STAGES.map((s) => `${s.label} ${theirs.filter((c) => c.stage === s.key).length}`).join(', '),
		);
		D('stages').innerHTML = STAGES.map((s) => {
			const here = theirs
				.filter((c) => c.stage === s.key)
				.sort((a, b) => (a.next.date || '9999').localeCompare(b.next.date || '9999'));
			return `<section class="rd-stage" data-stage="${s.key}" aria-labelledby="rd-stage-${s.key}"><h3 class="rd-stage-head" id="rd-stage-${s.key}"><span class="rd-stage-dot" aria-hidden="true"></span>${s.label}<span class="rd-stage-count">${here.length}</span></h3>${
				here.length
					? `<ul class="rd-stage-list">${here
							.map(
								(c) =>
									`<li class="rd-person"><span class="basalt-avatar basalt-avatar-sm basalt-avatar-tone-${toneOf(c)}" aria-hidden="true">${htmlSafe(c.first.charAt(0) + c.last.charAt(0))}</span><span class="rd-person-text"><a class="rd-person-name" href="${candidateUrl(c)}">${htmlSafe(nameOf(c))}</a><span class="rd-person-next">${htmlSafe(nextText(c))}</span></span></li>`,
							)
							.join('')}</ul>`
					: '<p class="rd-stage-empty">No one</p>'
			}</section>`;
		}).join('');
	}

	/* The posting */
	function listHtml(items, empty) {
		return items.length
			? `<ul class="rd-list">${items.map((x) => `<li>${htmlSafe(x)}</li>`).join('')}</ul>`
			: `<p class="rd-post-empty">${empty}</p>`;
	}
	function paintPost() {
		const skills =
			(role.skills || []).map((x) => `<li class="rd-skill rd-skill-must">${htmlSafe(x)}</li>`).join('') +
			(role.extra || []).map((x) => `<li class="rd-skill">${htmlSafe(x)}</li>`).join('');
		D('post').innerHTML =
			`${role.pitch ? `<p class="rd-post-lede">${htmlSafe(role.pitch)}</p>` : '<p class="rd-post-empty">No opening paragraph yet. Edit the posting to say what the job is.</p>'}<h3 class="rd-post-h">What you’ll do</h3>${listHtml(role.does, 'Nothing listed yet.')}<h3 class="rd-post-h">What we look for</h3>${listHtml(role.wants, 'Nothing listed yet.')}${skills ? `<ul class="rd-skills" aria-label="Skills">${skills}</ul><p class="rd-legend"><span class="rd-legend-key" aria-hidden="true"></span>Must have; the rest are a plus</p>` : ''}<h3 class="rd-post-h">What you get</h3><ul class="rd-perks">${H.benefits
				.map(
					(b) =>
						`<li class="rd-perk"><span class="rd-perk-icon" aria-hidden="true"><i class="bi ${b[0]}"></i></span><span class="rd-perk-text"><strong>${htmlSafe(b[1])}</strong>${htmlSafe(b[2])}</span></li>`,
				)
				.join('')}</ul>`;

		const fromSite = theirs.filter((c) => c.source === 'careers').length;
		const rows = [
			['Posted', fullDay(role.opened)],
			['Visits', (role.views || 0).toLocaleString('en-US')],
			['Applied here', fromSite ? cap(count(fromSite, 'person', 'people')) : 'No one yet'],
			['Work', htmlSafe(`${SETUPS[role.setup]}, ${role.type.toLowerCase()}`)],
			['Recruiter', personLink(role.recruiter)],
		];
		D('side').innerHTML = rows.map((x) => `<dt>${x[0]}</dt><dd>${x[1]}</dd>`).join('');
	}
	function paintShare() {
		const open = role.status === 'open';
		el.publish.checked = !!role.published;
		el.publish.disabled = !open;
		D('pub-note').textContent = !open
			? role.status === 'paused'
				? 'Resume hiring to put it back on the careers page.'
				: 'Reopen the role to publish it again.'
			: role.published
				? 'Anyone with the link, or browsing the careers page, can read it and apply.'
				: 'Only your team can see it for now.';
		D('url').textContent = CAREERS + slug;
	}

	/* Interview plan */
	function paintPlan() {
		const rounds = role.rounds || [];
		const mins = rounds.reduce((n, r) => n + r[2], 0);
		D('plan-desc').textContent =
			`${cap(count(rounds.length, 'round'))}, about ${mins >= 90 ? `${Math.round(mins / 30) / 2} hours` : `${mins} minutes`} for each candidate.`;
		D('plan').innerHTML = rounds
			.map((r, i) => {
				const who = r[1] || role.manager;
				return `<li class="rd-round" style="--rd-tone: var(--basalt-series-${r[3]})"><span class="rd-round-n" aria-hidden="true">${i + 1}</span><span class="rd-round-text"><span class="rd-round-name">${htmlSafe(r[0])}</span><span class="rd-round-meta">With ${personLink(who)} · ${r[2]} minutes</span><span class="rd-round-rates">Rates ${htmlSafe(
					r[4]
						.map((x) => x.toLowerCase())
						.join(', ')
						.replace(/, ([^,]*)$/, ' and $1'),
				)}</span></span></li>`;
			})
			.join('');
	}

	/* Activity */
	const LOG_ICON = {
		open: 'bi-briefcase',
		publish: 'bi-globe2',
		unpublish: 'bi-eye-slash',
		pause: 'bi-pause-circle',
		close: 'bi-x-circle',
		apply: 'bi-person-plus',
		move: 'bi-arrow-right',
		offer: 'bi-envelope-paper',
		hire: 'bi-person-check',
		call: 'bi-chat-left-text',
		edit: 'bi-pencil',
	};
	function paintLog() {
		const all = LOG.map((x, i) => x.concat(i)).sort((a, b) => b[0].localeCompare(a[0]) || b[3] - a[3]);
		const shown = logOpen ? all : all.slice(0, LOG_SHOWN);
		D('log').innerHTML = shown
			.map(
				(x) =>
					`<li class="rd-log-item" data-kind="${x[1]}"><span class="rd-log-icon" aria-hidden="true"><i class="bi ${LOG_ICON[x[1]]}"></i></span><span class="rd-log-text"><span class="rd-log-line">${x[2]}</span><span class="rd-log-when">${x[0] === TODAY ? 'Today' : dayMonth(x[0])}</span></span></li>`,
			)
			.join('');
		const more = D('log-more');
		more.hidden = all.length <= LOG_SHOWN;
		el.more.textContent = logOpen ? 'Show fewer' : `Show all ${all.length}`;
		el.more.setAttribute('aria-expanded', String(logOpen));
	}

	function paint() {
		paintHead();
		paintGlance();
		paintStages();
		paintPost();
		paintShare();
		paintPlan();
		paintLog();
	}

	/* Changes */
	function setStatus(next) {
		if (next === role.status) return;
		const before = { status: role.status, published: role.published, log: LOG.length };
		role.status = next;
		const wasLive = role.published;
		if (next !== 'open') role.published = false;
		const verb = {
			open: before.status === 'closed' ? 'reopened the role' : 'resumed hiring',
			paused: 'paused hiring',
			closed: 'closed the role',
		}[next];
		LOG.push([TODAY, { open: 'open', paused: 'pause', closed: 'close' }[next], `${htmlSafe(ME)} ${verb}`]);
		paint();
		toast({
			tone: next === 'open' ? 'success' : 'info',
			icon: { open: 'bi-play-circle', paused: 'bi-pause-circle', closed: 'bi-x-circle' }[next],
			title: {
				open: before.status === 'closed' ? 'Role reopened' : 'Hiring resumed',
				paused: 'Hiring paused',
				closed: 'Role closed',
			}[next],
			text:
				next === 'open'
					? 'Publish the posting when you want applications again.'
					: `${wasLive ? 'The posting is off the careers page. ' : ''}Candidates already in the pipeline carry on.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						role.status = before.status;
						role.published = before.published;
						LOG.length = before.log;
						paint();
					},
				},
			],
		});
	}
	function setPublished(on) {
		role.published = on;
		LOG.push([
			TODAY,
			on ? 'publish' : 'unpublish',
			htmlSafe(ME) + (on ? ' put the posting on the careers page' : ' took the posting off the careers page'),
		]);
		paintHead();
		paintShare();
		paintPost();
		paintStages();
		paintLog();
		toast({
			tone: 'success',
			icon: on ? 'bi-globe2' : 'bi-eye-slash',
			title: on ? 'Posting published' : 'Posting taken down',
			text: on ? CAREERS + slug : 'People with the link see that the role is not open.',
		});
	}
	function copyLink() {
		const url = `https://${CAREERS}${slug}`;

		function done() {
			return toast({
				tone: 'success',
				icon: 'bi-clipboard-check',
				title: 'Link copied',
				text: url,
				duration: 3000,
			});
		}

		function failed() {
			return toast({
				tone: 'warning',
				icon: 'bi-clipboard-x',
				title: 'Could not copy',
				text: `Your browser blocked it. The link is ${url}`,
			});
		}

		if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, failed);
		else failed();
	}

	/* Edit the posting in place: three boxes, the lists one point a line. */
	function lines(text) {
		return text
			.split('\n')
			.map((x) => x.replace(/^[\s•\-*]+/, '').trim())
			.filter(Boolean);
	}

	function openEdit(on) {
		const f = el.form;
		D('post').hidden = on;
		f.hidden = !on;
		el.edit.hidden = on;
		if (on) {
			f.pitch.value = role.pitch || '';
			f.does.value = role.does.join('\n');
			f.wants.value = role.wants.join('\n');
			f.pitch.classList.remove('is-invalid');
			f.pitch.removeAttribute('aria-invalid');
			f.pitch.focus();
		} else el.edit.focus();
	}
	function saveEdit(e) {
		e.preventDefault();
		const f = el.form;
		const bad = !f.pitch.value.trim();
		f.pitch.classList.toggle('is-invalid', bad);
		f.pitch.setAttribute('aria-invalid', String(bad));
		if (bad) {
			f.pitch.focus();
			return;
		}
		role.pitch = f.pitch.value.trim();
		role.does = lines(f.does.value);
		role.wants = lines(f.wants.value);
		LOG.push([TODAY, 'edit', `${htmlSafe(ME)} edited the posting`]);
		paintPost();
		paintLog();
		openEdit(false);
		toast({
			tone: 'success',
			icon: 'bi-check2-circle',
			title: 'Posting saved',
			text: role.published ? 'The careers page shows the new version now.' : 'Publish it when it is ready.',
		});
	}

	function start() {
		paint();
		document.addEventListener('click', (e) => {
			const b = e.target.closest('[data-rd-set]');
			if (b) setStatus(b.getAttribute('data-rd-set'));
		});
		el.publish.addEventListener('change', () => setPublished(el.publish.checked));
		el.copy.addEventListener('click', copyLink);
		el.edit.addEventListener('click', () => openEdit(true));
		pick('[data-rd-edit-cancel]').addEventListener('click', () => openEdit(false));
		el.form.addEventListener('submit', saveEdit);
		el.form.pitch.addEventListener('input', () => {
			if (el.form.pitch.value.trim()) {
				el.form.pitch.classList.remove('is-invalid');
				el.form.pitch.removeAttribute('aria-invalid');
			}
		});
		el.more.addEventListener('click', () => {
			window.Basalt.slide(D('log'), () => {
				logOpen = !logOpen;
				paintLog();
			});
		});
	}

	document.addEventListener('DOMContentLoaded', start);
})();
