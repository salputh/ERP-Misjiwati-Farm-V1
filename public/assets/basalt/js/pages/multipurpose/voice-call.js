/**
 * Basalt - Voice Call (voice-call.html)
 * A voice call with someone on the team: who you are talking to,
 * who is speaking, the call controls, and your recent calls beside it.
 *
 * voice-call.html?id=<person id> calls someone from the roster in
 * assets/basalt/js/data/multipurpose/people.js; without it the page opens the call in
 * assets/basalt/js/data/multipurpose/calls.js. The call history comes from there too.
 *
 * This is a demo: nothing asks for the microphone. In your app, swap
 * the buttons' handlers for your calling service's calls (mute,
 * speaker, add someone, send a tone, hang up).
 */
(() => {
	'use strict';
	const root = pick('[data-vo-root]', document);
	if (!root || !window.Basalt.data || !window.Basalt.data.calls) return;

	const ROSTER = window.Basalt.data.people;
	const CALLS = window.Basalt.data.calls;
	const ME = CALLS.ME;

	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function announce(text) {
		const el = pick('[data-vo-live]');
		el.textContent = '';
		setTimeout(() => {
			el.textContent = text;
		}, 30);
	}
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* Time */
	const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTHS = [
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

	function iso(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function clock(d) {
		return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
	}

	function mmss(s) {
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	const loaded = Date.now();

	function now() {
		return new Date(CALLS.NOW.getTime() + (Date.now() - loaded));
	}

	function dayName(d) {
		const today = iso(CALLS.NOW);
		const y = new Date(CALLS.NOW);
		y.setDate(y.getDate() - 1);
		if (iso(d) === today) return 'Today';
		if (iso(d) === iso(y)) return 'Yesterday';
		return `${DAY_NAMES[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
	}
	/* The local time where someone works, from their city's time zone. */
	function localTime(p) {
		const city = ROSTER.cityOf(p);
		try {
			const chicago = new Date(now().toLocaleString('en-US', { timeZone: 'America/Chicago' }));
			const there = new Date(now().toLocaleString('en-US', { timeZone: city.tz }));
			return clock(new Date(now().getTime() + (there - chicago)));
		} catch {
			return '';
		}
	}

	function person(id) {
		return ROSTER.recordWithId(id);
	}

	function avatar(p, size) {
		return `<span class="basalt-avatar ${size ? `basalt-avatar-${size} ` : ''}basalt-avatar-tone-${ROSTER.toneOf(p)}" aria-hidden="true">${htmlSafe(ROSTER.initials(p))}</span>`;
	}

	/* The call */
	const fromUrl = person(new URLSearchParams(location.search).get('id') || '');
	const call = {
		on: false,
		with: [] /* roster ids on the line, besides you */,
		ringing: null /* someone being added who has not answered yet */,
		seconds: 0,
		startedAt: 0,
		muted: false,
		speaker: false,
		keypad: false,
		digits: '',
	};
	let speaking = null;
	let ticker = null;
	let talker = null;
	let ringTimer = null;
	let lastWith = [];
	const recent = CALLS.recent.slice();

	const card = pick('[data-vo-call]');

	function seconds() {
		return call.seconds + Math.round((Date.now() - call.startedAt) / 1000);
	}

	function drawWho() {
		const list = call.with.map(person);
		const size = list.length > 1 ? 'xl' : 'xxl';
		const faces = list.map(
			(p) =>
				`<li class="vo-face${p.id === speaking ? ' is-speaking' : ''}">${avatar(p, size)}${list.length > 1 ? `<span class="vo-face-name">${htmlSafe(p.first)}</span>` : ''}</li>`,
		);
		if (call.ringing) {
			const r = person(call.ringing);
			faces.push(
				`<li class="vo-face is-ringing">${avatar(r, size)}<span class="vo-face-name">${htmlSafe(r.first)}</span></li>`,
			);
		}
		pick('[data-vo-faces]').innerHTML = faces.join('');
		pick('[data-vo-faces]').classList.toggle('is-group', faces.length > 1);

		if (list.length === 1 && !call.ringing) {
			const p = list[0];
			pick('[data-vo="name"]').textContent = ROSTER.nameOf(p);
			const t = localTime(p);
			pick('[data-vo="sub"]').textContent = `${p.title} · ${p.city}${t ? `, ${t}` : ''}`;
		} else {
			const names = list.map((p) => p.first);
			pick('[data-vo="name"]').textContent =
				`You, ${names.slice(0, -1).join(', ')}${names.length > 1 ? ' and ' : ''}${names[names.length - 1]}`;
			pick('[data-vo="sub"]').textContent = call.ringing
				? `Calling ${ROSTER.nameOf(person(call.ringing))}…`
				: `${list.length + 1} people on the call`;
		}
		drawSpeaking();
	}

	function drawSpeaking() {
		const line = pick('[data-vo-speaking]');
		let text = 'Nobody is speaking';
		if (speaking === ME) text = 'You are speaking';
		else if (speaking) text = `${person(speaking).first} is speaking`;
		if (call.muted && speaking !== ME && !speaking) text = 'You are muted';
		line.classList.toggle('is-quiet', !speaking);
		pick('[data-vo="speaking"]').textContent = text;
		pickAll('.vo-face').forEach((li, i) => li.classList.toggle('is-speaking', call.with[i] === speaking));
	}

	function nextSpeaker() {
		const pool = call.with.slice();
		if (!call.muted) pool.push(ME, ME);
		pool.push(null);
		const options = pool.filter((id) => id !== speaking);
		return options[Math.floor(Math.random() * options.length)];
	}

	function tick() {
		pick('[data-vo="timer"]').textContent = mmss(seconds());
	}

	function start(ids, already) {
		stop();
		call.on = true;
		call.with = ids.slice();
		call.seconds = already || 0;
		call.startedAt = Date.now();
		call.muted = false;
		call.digits = '';
		setPressed('mute', false);
		setKeypad(false);
		card.classList.remove('is-idle');
		pick('[data-vo-idle]').hidden = true;
		pick('[data-vo="state"]').textContent = 'Connected';
		speaking = call.with[0];
		drawWho();
		tick();
		ticker = setInterval(tick, 1000);
		talker = setInterval(
			() => {
				if (!call.ringing) {
					speaking = nextSpeaker();
					drawSpeaking();
				}
			},
			reduced.matches ? 6000 : 3000,
		);
	}
	function stop() {
		clearInterval(ticker);
		clearInterval(talker);
		clearTimeout(ringTimer);
		call.ringing = null;
	}

	function end() {
		const secs = seconds();
		const was = call.with.slice();
		stop();
		call.on = false;
		speaking = null;
		lastWith = was;

		/* The call goes to the top of the history, one row per person. */
		for (const id of was.slice().reverse()) {
			recent.unshift({ who: id, dir: 'out', at: now(), mins: Math.max(1, Math.round(secs / 60)) });
		}

		drawRecent();
		card.classList.add('is-idle');
		pick('[data-vo-idle]').hidden = false;
		const names = was.map((id) => ROSTER.nameOf(person(id)));
		pick('[data-vo-idle-title]').textContent = 'Call ended';
		pick('[data-vo="idle-text"]').textContent =
			`You talked to ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]} for ${mmss(secs)}.`;
		pick('[data-vo="again"]').textContent =
			was.length > 1 ? 'Call them again' : `Call ${person(was[0]).first} again`;
		pick('[data-vo-idle-title]').focus();
		announce('Call ended');
	}

	/* Controls */
	function setPressed(name, on) {
		const btn = pick(`[data-vo-ctl="${name}"]`);
		btn.setAttribute('aria-pressed', String(on));
		const icon = pick('.vo-ctl-icon i', btn);
		if (name === 'mute') icon.className = `bi ${on ? 'bi-mic-mute' : 'bi-mic'}`;
	}
	function setKeypad(on) {
		call.keypad = on;
		setPressed('keypad', on);
		pick('[data-vo-keypad]').hidden = !on;
		/* The keypad takes the faces' place; the name stays above it. */
		pick('[data-vo-faces]').hidden = on;
		pick('[data-vo-speaking]').hidden = on;
		pick('[data-vo="digits"]').textContent = call.digits;
	}

	for (const btn of pickAll('[data-vo-ctl]')) {
		btn.addEventListener('click', () => {
			const name = btn.dataset.voCtl;
			const on = btn.getAttribute('aria-pressed') !== 'true';
			if (name === 'mute') {
				call.muted = on;
				setPressed('mute', on);
				if (on && speaking === ME) speaking = null;
				drawSpeaking();
				announce(on ? 'You are muted' : 'You are unmuted');
			}
			if (name === 'speaker') {
				call.speaker = on;
				setPressed('speaker', on);
				announce(on ? 'Speaker on' : 'Speaker off');
			}
			if (name === 'keypad') setKeypad(on);
		});
	}

	/* The keypad sends tones down the line, for menus and PINs. */
	const KEYS = [
		['1', ''],
		['2', 'ABC'],
		['3', 'DEF'],
		['4', 'GHI'],
		['5', 'JKL'],
		['6', 'MNO'],
		['7', 'PQRS'],
		['8', 'TUV'],
		['9', 'WXYZ'],
		['*', ''],
		['0', '+'],
		['#', ''],
	];
	pick('[data-vo-keys]').innerHTML = KEYS.map(
		(k) =>
			`<button type="button" class="vo-key" data-vo-key="${k[0]}" aria-label="${k[0] === '*' ? 'Star' : k[0] === '#' ? 'Pound' : k[0]}"><span class="vo-key-digit" aria-hidden="true">${k[0]}</span><span class="vo-key-letters" aria-hidden="true">${k[1]}</span></button>`,
	).join('');
	pick('[data-vo-keys]').addEventListener('click', (e) => {
		const key = e.target.closest('[data-vo-key]');
		if (!key) return;
		call.digits = (call.digits + key.dataset.voKey).slice(-18);
		pick('[data-vo="digits"]').textContent = call.digits;
	});

	pick('[data-vo-end]').addEventListener('click', end);
	pick('[data-vo-again]').addEventListener('click', () => {
		start(lastWith);
		announce(`Calling ${lastWith.map((id) => person(id).first).join(' and ')}`);
		pick('[data-vo="name"]').focus();
	});

	/* Add someone */
	const addDialog = document.getElementById('vo-add');
	const find = pick('[data-vo-find]', addDialog);
	const pickList = pick('[data-vo-pick]', addDialog);
	const findNote = pick('[data-vo-find-note]', addDialog);
	const SHOW = 6;

	function fold(s) {
		return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	}

	function drawPicks() {
		const q = fold(find.value.trim());
		const busy = new Set([ME].concat(call.with, call.ringing ? [call.ringing] : []));
		let list;
		if (!q) {
			const seen = [];

			for (const r of recent) {
				if (!seen.includes(r.who)) seen.push(r.who);
			}

			list = seen.map(person);
			findNote.textContent = 'People you talked to lately';
		} else {
			list = ROSTER.staff.filter(
				(p) => ROSTER.hasStarted(p) && fold(`${ROSTER.nameOf(p)} ${p.team} ${p.title}`).includes(q),
			);
		}
		list = list.filter((p) => p && !busy.has(p.id));
		if (q)
			findNote.textContent = list.length
				? list.length > SHOW
					? `First ${SHOW} of ${list.length} people. Type more to narrow it.`
					: list.length + (list.length === 1 ? ' person' : ' people')
				: `Nobody matches “${find.value.trim()}”.`;
		pickList.innerHTML = list
			.slice(0, SHOW)
			.map(
				(p) =>
					`<li class="vo-pick-row">${avatar(p, 'sm')}<span class="vo-pick-text"><span class="vo-pick-name">${htmlSafe(ROSTER.nameOf(p))}</span><span class="vo-pick-title">${htmlSafe(p.title)}</span></span><button type="button" class="btn btn-outline-secondary btn-sm" data-vo-pick-id="${htmlSafe(p.id)}" aria-label="Call ${htmlSafe(ROSTER.nameOf(p))} into this call">Add</button></li>`,
			)
			.join('');
	}
	find.addEventListener('input', drawPicks);
	pickList.addEventListener('click', (e) => {
		const btn = e.target.closest('[data-vo-pick-id]');
		if (!btn) return;
		const id = btn.dataset.voPickId;
		window.bootstrap.Modal.getOrCreateInstance(addDialog).hide();
		if (!call.on) {
			start([id]);
			announce(`Calling ${ROSTER.nameOf(person(id))}`);
			return;
		}
		call.ringing = id;
		drawWho();
		announce(`Calling ${ROSTER.nameOf(person(id))}`);
		/* They answer after a moment and join the call. */
		ringTimer = setTimeout(() => {
			call.with.push(id);
			call.ringing = null;
			speaking = id;
			drawWho();
			announce(`${person(id).first} joined the call`);
		}, 2600);
	});

	for (const btn of pickAll('[data-vo-add]')) {
		btn.addEventListener('click', () => {
			if (call.ringing) {
				announce(`Still calling ${person(call.ringing).first}`);
				return;
			}
			find.value = '';
			drawPicks();
			window.bootstrap.Modal.getOrCreateInstance(addDialog).show();
		});
	}

	addDialog.addEventListener('shown.bs.modal', () => find.focus());

	/* Recent calls */
	const DIRS = {
		in: { label: 'Incoming', icon: 'bi-telephone-inbound' },
		out: { label: 'Outgoing', icon: 'bi-telephone-outbound' },
		missed: { label: 'Missed', icon: 'bi-telephone-x' },
	};
	let show = 'all';
	function drawRecent() {
		const rows = recent.filter((r) => show === 'all' || r.dir === 'missed');
		const missed = recent.filter((r) => r.dir === 'missed').length;
		pick('[data-vo="recent-desc"]').textContent = missed
			? `${missed} missed this week`
			: 'Nothing missed this week';
		const days = [];

		for (const r of rows) {
			const name = dayName(r.at);
			let day = days.find((d) => d.name === name);
			if (!day) {
				day = { name, rows: [] };
				days.push(day);
			}
			day.rows.push(r);
		}

		if (!days.length) {
			pick('[data-vo-days]').innerHTML = '<p class="vo-days-empty">No missed calls.</p>';
			return;
		}
		pick('[data-vo-days]').innerHTML = days
			.map(
				(d) =>
					`<h3 class="vo-day">${htmlSafe(d.name)}</h3><ul class="vo-calls">${d.rows
						.map((r) => {
							const p = person(r.who);
							const dir = DIRS[r.dir];
							return `<li class="vo-calls-row${r.dir === 'missed' ? ' is-missed' : ''}">${avatar(p, 'sm')}<span class="vo-calls-text"><a class="vo-calls-name" href="${htmlSafe(ROSTER.userPage(p))}">${htmlSafe(ROSTER.nameOf(p))}</a><span class="vo-calls-meta"><i class="bi ${dir.icon}" aria-hidden="true"></i>${dir.label} · ${clock(r.at)}${r.mins ? `<span class="vo-calls-mins"> · ${r.mins} min</span>` : ''}</span></span><button type="button" class="btn btn-icon btn-sm vo-calls-call" data-vo-call-id="${htmlSafe(p.id)}" aria-label="Call ${htmlSafe(ROSTER.nameOf(p))}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Call ${htmlSafe(p.first)}"><i class="bi bi-telephone" aria-hidden="true"></i></button></li>`;
						})
						.join('')}</ul>`,
			)
			.join('');
		if (window.Basalt.tips) window.Basalt.tips(pick('[data-vo-days]'));
	}
	pick('[data-vo-days]').addEventListener('click', (e) => {
		const btn = e.target.closest('[data-vo-call-id]');
		/* A click anywhere else on the row opens the person's page. */
		if (!btn) {
			const row = e.target.closest('.vo-calls-row');
			if (row && !e.target.closest('a')) pick('.vo-calls-name', row).click();
			return;
		}
		const tip = window.bootstrap && window.bootstrap.Tooltip.getInstance(btn);
		if (tip) tip.hide();
		/* Calling someone else hangs up the call you are on first. */
		if (call.on) {
			const secs = seconds();

			for (const id of call.with.slice().reverse()) {
				recent.unshift({ who: id, dir: 'out', at: now(), mins: Math.max(1, Math.round(secs / 60)) });
			}
		}
		const id = btn.dataset.voCallId;
		start([id]);
		drawRecent();
		announce(`Calling ${ROSTER.nameOf(person(id))}`);
		pick('[data-vo="name"]').focus();
	});

	for (const r of pickAll('[data-vo-show]')) {
		r.addEventListener('change', () => {
			show = r.value;
			drawRecent();
		});
	}

	/* First draw */
	drawRecent();
	if (fromUrl && fromUrl.id !== ME) start([fromUrl.id], 0);
	else start([CALLS.voice.who], CALLS.voice.seconds);
})();
