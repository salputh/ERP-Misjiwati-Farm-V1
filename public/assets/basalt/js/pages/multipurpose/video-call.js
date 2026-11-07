/**
 * Basalt - Video Call (video-call.html)
 * A team video call: a tile for everyone (initials, not real video),
 * a ring on whoever is speaking, the controls under the tiles, and a
 * panel with the chat and the people in the call.
 *
 * video-call.html?id=<meeting id> opens one of the video meetings in
 * assets/basalt/js/data/multipurpose/meetings.js; without it the page opens the meeting
 * on now. What happens on the call (who is muted, the chat so far)
 * comes from assets/basalt/js/data/multipurpose/calls.js.
 *
 * This is a demo: nothing asks for the camera or microphone. In your
 * app, swap the buttons' handlers for your calling service's calls
 * (mute, camera, screen share, raise hand, leave) and draw the tiles
 * from its list of people.
 */
(() => {
	'use strict';
	const root = pick('[data-vc-root]', document);
	if (!root || !window.Basalt.data || !window.Basalt.data.meetings || !window.Basalt.data.calls) return;

	const ROSTER = window.Basalt.data.people;
	const MEET = window.Basalt.data.meetings;
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
		const el = pick('[data-vc-live]');
		el.textContent = '';
		setTimeout(() => {
			el.textContent = text;
		}, 30);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* Which meeting */
	const fromUrl = new URLSearchParams(location.search).get('id');
	const videoMeetings = MEET.meetings.filter((m) => m.kind === 'video');
	const onNow = videoMeetings.find((m) => m.start <= CALLS.NOW && CALLS.NOW < MEET.endOf(m));
	const meeting = videoMeetings.find((m) => m.id === fromUrl) || onNow || videoMeetings[0];
	const state = CALLS.video[meeting.id] || { muted: [], cameraOff: [], hands: [], chat: [] };

	/* Time */
	function clock(d) {
		return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
	}

	function clockOf(hm) {
		const [h, m] = hm.split(':').map(Number);
		return clock(new Date(2026, 0, 1, h, m));
	}

	function mmss(s) {
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = String(s % 60).padStart(2, '0');
		return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
	}

	/* How long the call has been going at the demo's "now". A meeting
     that isn't on now opens as if you are the first to join it. */
	const isOnNow = meeting === onNow;
	let seconds = isOnNow ? Math.round((CALLS.NOW - meeting.start) / 1000) : 0;
	const loaded = Date.now();
	const startSecs = seconds;

	/* People
	   Staff come from the roster; guests from a customer are [name, company]. */
	const people = meeting.people.map((id) => {
		const p = ROSTER.recordWithId(id);
		return {
			id,
			name: p ? ROSTER.nameOf(p) : id,
			first: p ? p.first : id,
			title: p ? p.title : '',
			initials: p ? ROSTER.initials(p) : id.slice(0, 2).toUpperCase(),
			tone: p ? ROSTER.toneOf(p) : 1,
			me: id === ME,
			host: id === meeting.by,
			muted: state.muted.includes(id),
			camera: !state.cameraOff.includes(id),
			hand: state.hands.includes(id),
		};
	});
	(meeting.guests || []).forEach((g, i) => {
		const parts = g[0].split(' ');
		people.push({
			id: `guest${i}`,
			name: g[0],
			first: parts[0],
			title: g[1],
			initials: (parts[0][0] + (parts[1] || '')[0]).toUpperCase(),
			tone: 'guest',
			guest: true,
			muted: false,
			camera: true,
			hand: false,
		});
	});
	const me = people.find((p) => p.me);

	function byKey(id) {
		return people.find((p) => p.id === id);
	}

	function avatar(p, size) {
		return `<span class="basalt-avatar ${size ? `basalt-avatar-${size} ` : ''}${p.tone === 'guest' ? 'vc-guest' : `basalt-avatar-tone-${p.tone}`}" aria-hidden="true">${htmlSafe(p.initials)}</span>`;
	}

	/* Header */
	document.title = `${meeting.title} · Basalt`;
	pick('[data-vc="title"]').textContent = meeting.title;
	const host = byKey(meeting.by);
	pick('[data-vc="sub"]').textContent =
		`Video call · hosted by ${host && host.me ? 'you' : host ? host.name : MEET.nameOf(meeting.by)}${isOnNow ? ` · started at ${clock(meeting.start)}` : ` · planned for ${meeting.start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${clock(meeting.start)}`}`;
	pick('[data-vc="meeting"]').href = `meeting-details.html?id=${encodeURIComponent(meeting.id)}`;

	/* Agenda: the item on now, and what comes next */
	function agendaNow() {
		const items = meeting.agenda || [];
		if (!items.length) return { now: meeting.title, next: '' };
		let mins = seconds / 60;
		for (let i = 0; i < items.length; i++) {
			if (mins < items[i][1] || i === items.length - 1) {
				const left = Math.max(1, Math.ceil(items[i][1] - mins));
				return { now: items[i][0], left, next: items[i + 1] ? items[i + 1][0] : '' };
			}
			mins -= items[i][1];
		}
		return { now: meeting.title, next: '' };
	}
	function drawAgenda() {
		const a = agendaNow();
		pick('[data-vc="now"]').textContent = `Now: ${a.now}`;
		pick('[data-vc="next"]').textContent = a.left ? `${a.left} min left${a.next ? ` · next: ${a.next}` : ''}` : '';
	}

	/* Tiles */
	let speaking = null;
	const call = pick('[data-vc-call]');
	const tiles = pick('[data-vc-tiles]');
	function tileHtml(p) {
		const status = [];
		if (p.muted) status.push('muted');
		if (!p.camera) status.push('camera off');
		if (p.hand) status.push('hand raised');
		return `<li class="vc-tile${p.camera ? ' has-camera' : ''}${p.id === speaking ? ' is-speaking' : ''}" data-vc-tile="${htmlSafe(p.id)}"${p.tone !== 'guest' ? ` style="--vc-tone: var(--basalt-series-${p.tone})"` : ''}><span class="vc-tile-face">${avatar(p, 'xl')}</span>${p.hand ? '<span class="vc-tile-hand"><i class="bi bi-hand-index-thumb" aria-hidden="true"></i><span class="visually-hidden">Hand raised</span></span>' : ''}${!p.camera ? '<span class="vc-tile-cam"><i class="bi bi-camera-video-off" aria-hidden="true"></i><span class="visually-hidden">Camera off</span></span>' : ''}<span class="vc-tile-name">${p.muted ? '<i class="bi bi-mic-mute vc-tile-muted" aria-hidden="true"></i>' : p.id === speaking ? '<span class="vc-wave" aria-hidden="true"><span></span><span></span><span></span></span>' : ''}${p.hand ? '<i class="bi bi-hand-index-thumb vc-tile-handmark" aria-hidden="true"></i>' : ''}<span class="vc-tile-who">${htmlSafe(p.me ? 'You' : p.name)}</span><span class="vc-tile-first">${htmlSafe(p.me ? 'You' : p.first)}</span>${status.length ? `<span class="visually-hidden">, ${status.join(', ')}</span>` : ''}${p.id === speaking ? '<span class="visually-hidden">, speaking</span>' : ''}</span></li>`;
	}
	/* A big call shows the host, you and the first few others; the rest
     are counted on one last tile that opens the people list. */
	const MAX_TILES = 12;

	function onStage() {
		if (people.length <= MAX_TILES) return people;
		const first = people.filter((p) => p.host || p.me);
		return first.concat(people.filter((p) => !p.host && !p.me).slice(0, MAX_TILES - 1 - first.length));
	}

	function drawTiles() {
		const shown = onStage();
		const rest = people.length - shown.length;
		tiles.innerHTML =
			shown.map(tileHtml).join('') +
			(rest
				? `<li class="vc-tile vc-tile-more"><button type="button" class="vc-more" data-vc-more>${rest} more people</button></li>`
				: '');
		tiles.dataset.count = String(shown.length + (rest ? 1 : 0));
	}
	tiles.addEventListener('click', (e) => {
		if (!e.target.closest('[data-vc-more]')) return;
		if (!call.classList.contains('is-panel-open')) pick('[data-vc-ctl="panel"]').click();
		const tab = document.getElementById('vc-view-people');
		tab.checked = true;
		tab.dispatchEvent(new Event('change', { bubbles: true }));
		tab.focus();
	});

	/* Whoever is speaking moves around the room every few seconds. Only
     unmuted people speak; you speak now and then once you unmute. */
	function nextSpeaker() {
		const can = onStage().filter((p) => !p.muted && !p.me);
		if (!me.muted && Math.random() < 0.15) return me.id;
		const others = can.filter((p) => p.id !== speaking);
		return others.length ? others[Math.floor(Math.random() * others.length)].id : null;
	}
	function setSpeaker(id) {
		speaking = id;

		for (const el of pickAll('[data-vc-tile]')) {
			el.outerHTML = tileHtml(byKey(el.dataset.vcTile));
		}

		drawRoster();
	}

	/* People list */
	const ROSTER_SHOW = 10;
	let rosterAll = false;
	function drawRoster() {
		pick('[data-vc="count"]').textContent = `(${people.length})`;
		const list = people.slice().sort((a, b) => b.hand - a.hand || b.host - a.host || b.me - a.me);
		const more = pick('[data-vc-roster-more]');
		more.hidden = list.length <= ROSTER_SHOW;
		more.textContent = rosterAll ? 'Show fewer people' : `Show all ${list.length} people`;
		more.setAttribute('aria-expanded', String(rosterAll));
		pick('[data-vc-roster]').innerHTML = list
			.slice(0, rosterAll ? list.length : ROSTER_SHOW)
			.map((p) => {
				const tags = [];
				if (p.me) tags.push('You');
				if (p.host) tags.push('Host');
				if (p.guest) tags.push('Guest');
				const icons =
					(p.hand
						? '<i class="bi bi-hand-index-thumb vc-roster-hand" role="img" aria-label="Hand raised"></i>'
						: '') +
					(p.camera ? '' : '<i class="bi bi-camera-video-off" role="img" aria-label="Camera off"></i>') +
					(p.muted
						? '<i class="bi bi-mic-mute" role="img" aria-label="Muted"></i>'
						: p.id === speaking
							? '<i class="bi bi-soundwave vc-roster-talk" role="img" aria-label="Speaking"></i>'
							: '<i class="bi bi-mic" role="img" aria-label="Microphone on"></i>');
				const name =
					p.guest || p.me
						? `<span class="vc-roster-name">${htmlSafe(p.name)}</span>`
						: `<a class="vc-roster-name" href="${htmlSafe(MEET.personPage(p.id))}">${htmlSafe(p.name)}</a>`;
				return `<li class="vc-roster-row">${avatar(p, 'sm')}<span class="vc-roster-text">${name}<span class="vc-roster-title">${htmlSafe(tags.length ? `${tags.join(' · ')} · ${p.title}` : p.title)}</span></span><span class="vc-roster-icons">${icons}</span></li>`;
			})
			.join('');
	}

	pick('[data-vc-roster-more]').addEventListener('click', () => {
		window.Basalt.slide(pick('[data-vc-roster]'), () => {
			rosterAll = !rosterAll;
			drawRoster();
		});
	});

	/* Chat
	   The latest few messages show; the rest sit behind "Show earlier". */
	const SHOW = 5;
	const chat = state.chat.map((c) => ({ who: c[0], at: clockOf(c[1]), hm: c[1], text: c[2] }));
	let expanded = false;
	function drawChat() {
		const box = pick('[data-vc-msgs]');
		const earlier = pick('[data-vc-earlier]');
		const hidden = expanded ? 0 : Math.max(0, chat.length - SHOW);
		earlier.hidden = chat.length <= SHOW;
		earlier.textContent = expanded
			? 'Show fewer messages'
			: `Show ${hidden} earlier message${hidden === 1 ? '' : 's'}`;
		earlier.setAttribute('aria-expanded', String(expanded));
		if (!chat.length) {
			box.innerHTML =
				'<li class="vc-msgs-empty">No messages yet. Anything you write here goes to everyone in the call.</li>';
			return;
		}
		box.innerHTML = chat
			.slice(hidden)
			.map((m) => {
				const p = byKey(m.who) || me;
				return `<li class="vc-msg${p.me ? ' is-mine' : ''}">${avatar(p, 'xs')}<div class="vc-msg-body"><p class="vc-msg-meta"><span class="vc-msg-who">${htmlSafe(p.me ? 'You' : p.name)}</span><time class="vc-msg-at" datetime="${m.hm}">${htmlSafe(m.at)}</time></p><p class="vc-msg-text">${htmlSafe(m.text)}</p></div></li>`;
			})
			.join('');
	}
	pick('[data-vc-earlier]').addEventListener('click', () => {
		window.Basalt.slide(pick('[data-vc-msgs]'), () => {
			expanded = !expanded;
			drawChat();
		});
	});
	pick('[data-vc-compose]').addEventListener('submit', (e) => {
		e.preventDefault();
		const input = pick('[data-vc-message]');
		const text = input.value.trim();
		if (!text) {
			input.focus();
			return;
		}
		const now = new Date(CALLS.NOW.getTime() + (seconds - startSecs) * 1000);
		chat.push({
			who: ME,
			at: clock(now),
			hm: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
			text,
		});
		input.value = '';
		drawChat();
		announce('Message sent to everyone');
	});

	/* Panel views */
	for (const r of pickAll('[data-vc-view]')) {
		r.addEventListener('change', () => {
			for (const p of pickAll('[data-vc-pane]')) {
				p.hidden = p.dataset.vcPane !== r.value;
			}
		});
	}

	/* Shared screen
	   A stand-in for your screen: the first file shared with the invite. */
	function drawScreen() {
		const file = (meeting.files || [])[0];
		const name = file ? file.name.replace(/\.[a-z]+$/, '') : meeting.title;
		const rows = (meeting.agenda || []).slice(0, 4);
		pick('[data-vc-screen-body]').innerHTML =
			`<div class="vc-doc"><p class="vc-doc-title"><i class="bi bi-file-earmark-text" aria-hidden="true"></i>${htmlSafe(name)}</p><ol class="vc-doc-list">${rows.map((r) => `<li><span>${htmlSafe(r[0])}</span><span class="vc-doc-mins">${r[1]} min</span></li>`).join('')}</ol></div>`;
	}

	/* Controls */
	/* The aria-label stays the same and aria-pressed carries the state
     ("Mute, pressed"); only the tooltip says what a click does next. */
	function tipText(btn, text) {
		btn.setAttribute('data-bs-title', text);
		const tip = window.bootstrap && window.bootstrap.Tooltip.getInstance(btn);
		if (tip) tip.setContent({ '.tooltip-inner': text });
	}

	function setControl(name, on) {
		const btn = pick(`[data-vc-ctl="${name}"]`);
		btn.setAttribute('aria-pressed', String(on));
		const icon = pick('i', btn);
		if (name === 'mute') {
			icon.className = `bi ${on ? 'bi-mic-mute' : 'bi-mic'}`;
			tipText(btn, on ? 'Unmute' : 'Mute');
		}
		if (name === 'camera') {
			icon.className = `bi ${on ? 'bi-camera-video-off' : 'bi-camera-video'}`;
			tipText(btn, on ? 'Turn camera on' : 'Turn camera off');
		}
		if (name === 'share') tipText(btn, on ? 'Stop sharing' : 'Share screen');
		if (name === 'hand') tipText(btn, on ? 'Lower hand' : 'Raise hand');
		if (name === 'panel') tipText(btn, on ? 'Hide chat and people' : 'Chat and people');
	}
	function sharing(on) {
		call.classList.toggle('is-sharing', on);
		pick('[data-vc-screen]').hidden = !on;
		setControl('share', on);
		if (on) drawScreen();
	}
	pick('[data-vc-stop-share]').addEventListener('click', () => {
		sharing(false);
		announce('You stopped sharing your screen');
		pick('[data-vc-ctl="share"]').focus();
	});

	for (const btn of pickAll('[data-vc-ctl]')) {
		btn.addEventListener('click', () => {
			const name = btn.dataset.vcCtl;
			const on = btn.getAttribute('aria-pressed') !== 'true';
			if (name === 'mute') {
				me.muted = on;
				if (on && speaking === me.id) speaking = null;
				announce(on ? 'You are muted' : 'You are unmuted');
			}
			if (name === 'camera') {
				me.camera = !on;
				announce(on ? 'Your camera is off' : 'Your camera is on');
			}
			if (name === 'hand') {
				me.hand = on;
				announce(on ? 'Your hand is raised' : 'Your hand is lowered');
			}
			if (name === 'share') {
				sharing(on);
				announce(on ? 'You are sharing your screen' : 'You stopped sharing your screen');
				return;
			}
			if (name === 'panel') {
				call.classList.toggle('is-panel-open', on);
				pick('[data-vc-panel]').hidden = !on;
				setControl('panel', on);
				return;
			}
			setControl(name, on);
			drawTiles();
			drawRoster();
		});
	}

	/* Copy the invite link */
	for (const btn of pickAll('[data-vc-copy]')) {
		btn.addEventListener('click', () => {
			const link = `https://${meeting.where}`;
			function done() {
				toast({ tone: 'success', icon: 'bi-link-45deg', title: 'Invite link copied', text: meeting.where });
				announce('Invite link copied');
			}
			if (window.Basalt.copyText) window.Basalt.copyText(link).then(done, done);
			else done();
		});
	}

	/* Leave and rejoin */
	let ticker = null;
	let talker = null;
	const leaveDialog = document.getElementById('vc-leave');
	pick('[data-vc-leave]').addEventListener('click', () => {
		if (window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(leaveDialog).show();
	});
	pick('[data-vc-leave-go]', document).addEventListener('click', () => {
		if (window.bootstrap) window.bootstrap.Modal.getOrCreateInstance(leaveDialog).hide();
		stop();
		call.classList.add('has-left');
		pick('[data-vc-left]').hidden = false;
		pick('[data-vc="left-text"]').textContent =
			`You were in the call for ${Math.max(1, Math.round(seconds / 60))} min. ${people.length - 1} people are still talking.`;
		sharing(false);
		leaveDialog.addEventListener('hidden.bs.modal', () => pick('[data-vc-left-title]').focus(), { once: true });
		announce('You left the call');
	});
	pick('[data-vc-rejoin]').addEventListener('click', () => {
		call.classList.remove('has-left');
		pick('[data-vc-left]').hidden = true;
		start();
		announce('You are back in the call');
		pick('[data-vc-ctl="mute"]').focus();
	});

	function tick() {
		seconds = startSecs + Math.round((Date.now() - loaded) / 1000);
		pick('[data-vc="timer"]').textContent = mmss(seconds);
		drawAgenda();
	}
	function start() {
		tick();
		ticker = setInterval(tick, 1000);
		talker = setInterval(() => setSpeaker(nextSpeaker()), reduced.matches ? 6000 : 3200);
	}
	function stop() {
		clearInterval(ticker);
		clearInterval(talker);
	}

	/* First draw */
	const hostTalks = people.find((p) => p.host && !p.muted && !p.me);
	speaking = hostTalks ? hostTalks.id : nextSpeaker();
	drawTiles();
	drawRoster();
	drawChat();
	drawAgenda();
	start();
})();
