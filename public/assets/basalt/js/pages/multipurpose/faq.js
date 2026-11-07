/**
 * Behavior for faq.html. Typing in the search box narrows the answers and
 * marks the words that matched, the topic rail follows the reader down the
 * page, every answer takes a vote on whether it helped (a "no" asks what
 * was missing), and the "Ask the team" dialog knows when the desk is
 * staffed: 06:00 to 22:00 UTC, Monday to Friday, read from the viewer's
 * own clock. Everything hangs off [data-qa-*] hooks.
 */
(() => {
	'use strict';

	const page = pick('[data-qa-page]');
	if (!page) return;

	/* Answers unfold by themselves while a search leaves this many or fewer. */
	const UNFOLD_UP_TO = 5;

	/* Desk hours, UTC, weekdays only. */
	const DESK_OPENS_AT = 6;
	const DESK_CLOSES_AT = 22;
	const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

	const MISSING_REASONS = ['It’s out of date', 'It doesn’t cover my case', 'It’s hard to follow'];
	const SAMPLE_QUESTIONS = [
		'can we pay with a purchase order',
		'why did my alert fire twice',
		'how are seats counted',
		'does it work offline',
	];

	/* What the dialog promises, by urgency, while the desk is closed and
     while it is open with a reply by email. */
	const PROMISE_WHEN_CLOSED = {
		curious: 'Expect a reply that day.',
		slowing: 'Expect a reply in the first few hours.',
		blocked: 'Blocking questions are read first.',
	};
	const PROMISE_BY_EMAIL = {
		curious: 'Expect a reply within one working day',
		slowing: 'Expect a reply within about 2 hours',
		blocked: 'Expect a reply within about 30 minutes',
	};

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	const dialogNode = document.getElementById('faq-ask-modal');
	const askForm = hook('ask-form', dialogNode);

	/* The page, read once: a section per topic, then every answer with the
     text it is searched by. */
	const sections = collectSections();
	const answers = collectAnswers();

	const search = {
		field: hook('query'),
		box: hook('query').closest('.qa-ask'),
		live: hook('status'),
		nothing: hook('none'),
		nothingTerm: hook('none-term'),
	};

	const ask = {
		question: askForm.elements.question,
		email: askForm.elements.email,
		tooShort: hook('ask-invalid', askForm),
		counter: hook('ask-chars', askForm),
		emailRow: hook('ask-email-row', askForm),
		chatOption: pick('input', hook('chat-choice', askForm)),
		chatHint: hook('chat-note', askForm),
		promise: pick('span', hook('eta', askForm)),
		sheet: window.bootstrap?.Modal.getOrCreateInstance(dialogNode) ?? null,
	};

	let litSection = null;
	let notices = pick('.qa-toast-region');

	/* Wires every part, then paints the page for the first time. */
	function start() {
		if (!notices) {
			notices = make('div', 'qa-toast-region');
			notices.setAttribute('aria-live', 'polite');
			document.body.append(notices);
		}

		wireSearch();
		wireAnswers();
		wireRail();
		for (const answer of answers) wireVote(answer);
		wireAskDialog();

		for (const [index, section] of sections.entries()) section.node.style.setProperty('--qa-i', index);
		if (!calmMotion.matches) {
			page.classList.add('is-entering');
			setTimeout(() => page.classList.remove('is-entering'), 1200);
			cyclePlaceholder();
		}

		applySearch();
		paintDeskState();
		setInterval(paintDeskState, 60000);
		if (window.location.hash) followHash();
	}

	/* Search: the box, Escape and Enter, the clear button and the / shortcut. */

	function wireSearch() {
		const { field } = search;
		field.addEventListener('input', applySearch);
		field.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && field.value) {
				event.preventDefault();
				setQueryText('');
				return;
			}
			if (event.key !== 'Enter') return;
			event.preventDefault();
			if (!field.value.trim()) return;
			const first = answers.find((answer) => !answer.node.classList.contains('is-hidden'));
			if (first) revealAnswer(first, true);
		});
		hook('clear').addEventListener('click', () => {
			setQueryText('');
			field.focus();
		});
		document.addEventListener('keydown', focusSearchOnSlash);
	}

	/** The / key lands in the search box unless the reader is already typing somewhere. */
	function focusSearchOnSlash(event) {
		if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.target.closest?.('input, textarea, select, [contenteditable="true"], .modal')) return;
		event.preventDefault();
		search.field.focus();
		search.field.select();
	}

	function setQueryText(text) {
		search.field.value = text;
		applySearch();
	}

	/** Hides what does not match, marks what does, and keeps every count honest. */
	function applySearch() {
		const typed = search.field.value.trim();
		const words = searchWords(typed);
		const hits = answers.filter((answer) => words.every((word) => answer.haystack.includes(word)));
		const unfold = words.length > 0 && hits.length <= UNFOLD_UP_TO;

		for (const answer of answers) {
			const hit = hits.includes(answer);
			answer.node.classList.toggle('is-hidden', !hit);
			markWords(answer, hit ? words : []);
			setUnfolded(answer, answer.pinnedOpen || (hit && unfold));
		}

		let sectionsLeft = 0;
		for (const section of sections) {
			const total = answers.filter((answer) => answer.section === section).length;
			const shown = hits.filter((answer) => answer.section === section).length;
			const questions = count(total, 'question');
			section.node.classList.toggle('is-hidden', shown === 0);
			section.shownCount.textContent = words.length ? `${shown} of ${questions}` : questions;
			if (section.link) {
				section.badge.textContent = shown;
				section.link.classList.toggle('is-empty', shown === 0);
				section.link.setAttribute('aria-disabled', shown === 0 ? 'true' : 'false');
			}
			if (shown > 0) sectionsLeft += 1;
		}

		search.box.classList.toggle('has-query', typed.length > 0);
		search.nothing.hidden = hits.length > 0 || words.length === 0;
		search.nothingTerm.textContent = typed;
		announceResults(typed, words, hits, sectionsLeft);
		trackSection();
	}

	/** Tells screen readers what the search found, in the visually hidden status line. */
	function announceResults(typed, words, hits, sectionsLeft) {
		const { live } = search;
		if (!words.length) {
			live.textContent = `${count(answers.length, 'answer')} in ${count(sections.length, 'topic')}`;
			return;
		}
		if (!hits.length) {
			live.textContent = `No answers for “${typed}” yet`;
			return;
		}
		const tally = make('strong', '', count(hits.length, 'answer'));
		live.replaceChildren(tally, ` for “${typed}” in ${count(sectionsLeft, 'topic')}`);
	}

	/** Lowercase words without accents; dots, quotes and dashes may sit inside a word, not around it. */
	function searchWords(text) {
		const words = [];
		for (const piece of fold(text).split(/[^a-z0-9@.'-]+/)) {
			const word = piece.replace(/^[.'-]+|[.'-]+$/g, '');
			if (word) words.push(word);
		}
		return words;
	}

	/**
	 * Wraps each matched word of an answer in <mark>. The marks are cut from
	 * the original text, so nothing typed can ever become markup. A text whose
	 * folded form has a different length cannot be mapped back and is left plain.
	 */
	function markWords(answer, words) {
		for (const piece of answer.pieces) {
			const folded = fold(piece.original);
			const spans = folded.length === piece.original.length ? matchSpans(folded, words) : [];
			if (!spans.length) {
				piece.node.textContent = piece.original;
				continue;
			}
			const parts = [];
			let cursor = 0;
			for (const [from, to] of spans) {
				if (from > cursor) parts.push(piece.original.slice(cursor, from));
				parts.push(make('mark', 'qa-hit', piece.original.slice(from, to)));
				cursor = to;
			}
			if (cursor < piece.original.length) parts.push(piece.original.slice(cursor));
			piece.node.replaceChildren(...parts);
		}
	}

	/** Every [from, to) a word occupies in the folded text, sorted and with overlaps joined. */
	function matchSpans(folded, words) {
		const found = [];
		for (const word of words) {
			for (let at = folded.indexOf(word); at !== -1; at = folded.indexOf(word, at + word.length)) {
				found.push([at, at + word.length]);
			}
		}
		found.sort((a, b) => a[0] - b[0]);
		const joined = [];
		for (const [from, to] of found) {
			const tail = joined[joined.length - 1];
			if (tail && from <= tail[1]) tail[1] = Math.max(tail[1], to);
			else joined.push([from, to]);
		}
		return joined;
	}

	/* Answers: folding, unfolding and arriving at one from a link or the hash. */

	function wireAnswers() {
		for (const answer of answers) {
			answer.button.addEventListener('click', () => {
				const opening = !answer.node.classList.contains('is-open');
				answer.pinnedOpen = opening;
				setUnfolded(answer, opening);
				if (opening) rememberInAddress(answer.id);
			});
		}
		for (const link of pickAll('[data-qa-jump]', page)) {
			link.addEventListener('click', (event) => {
				const target = answerById(link.getAttribute('data-qa-jump'));
				if (!target) return;
				event.preventDefault();
				revealAnswer(target);
			});
		}
		window.addEventListener('hashchange', followHash);
	}

	function setUnfolded(answer, open) {
		answer.node.classList.toggle('is-open', open);
		answer.button.setAttribute('aria-expanded', open ? 'true' : 'false');
	}

	/**
	 * Opens an answer and scrolls to it. The panel goes to full height before
	 * the scroll, so the target is measured against the finished layout rather
	 * than a panel still growing. A hidden answer clears the search first
	 * unless the caller is keeping it.
	 */
	function revealAnswer(answer, keepSearch = false) {
		if (!keepSearch && answer.node.classList.contains('is-hidden')) setQueryText('');
		answer.pinnedOpen = true;
		answer.node.classList.add('is-instant');
		setUnfolded(answer, true);
		void answer.node.offsetHeight;
		answer.node.classList.remove('is-instant');
		answer.node.scrollIntoView({ behavior: scrollMode(), block: 'start' });
		answer.button.focus({ preventScroll: true });
		pulse(answer.node);
		rememberInAddress(answer.id);
	}

	function followHash() {
		const target = answerById(decodeURIComponent(window.location.hash.slice(1)));
		if (target) revealAnswer(target);
	}

	function answerById(id) {
		return answers.find((answer) => answer.id === id);
	}

	function rememberInAddress(id) {
		if (window.history.replaceState) window.history.replaceState(null, '', `#${id}`);
	}

	/** Restarts the arrival flash even when the same answer is hit twice in a row. */
	function pulse(node) {
		node.classList.remove('is-flash');
		void node.offsetWidth;
		node.classList.add('is-flash');
		setTimeout(() => node.classList.remove('is-flash'), 1500);
	}

	/* The topic rail: clicking scrolls to a section, scrolling lights the one on screen. */

	function wireRail() {
		for (const section of sections) {
			section.link?.addEventListener('click', (event) => {
				event.preventDefault();
				if (section.link.classList.contains('is-empty')) return;
				section.node.scrollIntoView({ behavior: scrollMode(), block: 'start' });
				lightSection(section);
			});
		}

		let frameQueued = false;
		window.addEventListener(
			'scroll',
			() => {
				if (frameQueued) return;
				frameQueued = true;
				requestAnimationFrame(() => {
					frameQueued = false;
					trackSection();
				});
			},
			{ passive: true },
		);
	}

	/** Lights the section whose heading last passed under the top bar; at the foot of the page, the last one. */
	function trackSection() {
		const visible = sections.filter((section) => !section.node.classList.contains('is-hidden'));
		if (!visible.length) {
			lightSection(null);
			return;
		}
		const topBar =
			parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--basalt-header-h')) || 64;
		const line = topBar + 40;
		let current = visible.findLast((section) => section.node.getBoundingClientRect().top <= line) ?? visible[0];

		const atFoot = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
		const last = visible[visible.length - 1];
		if (atFoot && last.node.getBoundingClientRect().top < window.innerHeight) current = last;
		lightSection(current);
	}

	function lightSection(section) {
		if (litSection === section) return;
		litSection = section;
		for (const other of sections) {
			if (!other.link) continue;
			const lit = other === section;
			other.link.classList.toggle('is-active', lit);
			if (lit) other.link.setAttribute('aria-current', 'location');
			else other.link.removeAttribute('aria-current');
		}
	}

	/* Did this answer it? Yes bumps the count; No asks what was missing. */

	function wireVote(answer) {
		const panel = hook('vote', answer.node);
		const yes = hook('vote-yes', panel);
		const no = hook('vote-no', panel);
		const tally = hook('vote-count', panel);
		const helped = parseInt(panel.getAttribute('data-qa-helpful'), 10) || 0;
		let choice = null;
		let followUp = null;

		function paint() {
			yes.setAttribute('aria-pressed', choice === 'yes' ? 'true' : 'false');
			no.setAttribute('aria-pressed', choice === 'no' ? 'true' : 'false');
			if (choice === 'yes') {
				tally.textContent = `${count(helped + 1, 'person', 'people')} found this useful, including you`;
				tally.classList.remove('is-bumped');
				void tally.offsetWidth;
				tally.classList.add('is-bumped');
			} else {
				tally.textContent = `${count(helped, 'person', 'people')} found this useful`;
			}
			if (choice === 'no') {
				followUp ??= buildFollowUp(answer, panel);
			} else if (followUp) {
				followUp.remove();
				followUp = null;
			}
		}

		yes.addEventListener('click', () => {
			choice = choice === 'yes' ? null : 'yes';
			paint();
		});
		no.addEventListener('click', () => {
			choice = choice === 'no' ? null : 'no';
			paint();
		});
		hook('copy', panel).addEventListener('click', () => copyAnswerLink(answer.id));
	}

	/** The box under a "no": three reasons to pick from and a button that opens the dialog on this answer. */
	function buildFollowUp(answer, panel) {
		const box = make('div', 'qa-follow');
		const reasons = make('div', 'qa-follow-reasons');
		const row = make('div', 'qa-follow-row');
		const thanks = make('span', 'qa-follow-thanks');
		thanks.setAttribute('aria-live', 'polite');

		for (const reason of MISSING_REASONS) {
			const reasonButton = make('button', 'qa-follow-reason', reason);
			reasonButton.type = 'button';
			reasonButton.setAttribute('aria-pressed', 'false');
			reasonButton.addEventListener('click', () => {
				for (const other of pickAll('button', reasons)) {
					other.setAttribute('aria-pressed', other === reasonButton ? 'true' : 'false');
				}
				thanks.textContent = 'Thanks. The team rereads answers that get this note.';
			});
			reasons.append(reasonButton);
		}

		const askButton = make('button', 'btn btn-sm btn-primary');
		const glyph = make('i', 'bi bi-chat-square-text me-1');
		glyph.setAttribute('aria-hidden', 'true');
		askButton.type = 'button';
		askButton.append(glyph, 'Ask the team about this');
		askButton.addEventListener('click', () => {
			openAskDialog({ topic: answer.section.key, question: `About “${answer.title}”: ` });
		});

		row.append(askButton, thanks);
		box.append(make('p', 'qa-follow-q', 'Sorry about that. What was missing?'), reasons, row);
		panel.append(box);
		return box;
	}

	/** Copies the answer's own address; where the clipboard is out of reach, the address is shown instead. */
	function copyAnswerLink(id) {
		const address = `${window.location.href.split('#')[0]}#${id}`;

		function showAddress() {
			notify(address);
		}

		if (!navigator.clipboard || !window.isSecureContext) {
			showAddress();
			return;
		}
		navigator.clipboard.writeText(address).then(() => notify('Link to this answer copied.', 'done'), showAddress);
	}

	/* Ask the team: the dialog, its live estimate and what happens on send. */

	function wireAskDialog() {
		for (const button of pickAll('[data-qa-ask]', page)) {
			button.addEventListener('click', () => {
				const fromSearch = button.hasAttribute('data-qa-ask-from-search');
				openAskDialog(fromSearch ? { question: search.field.value.trim() } : {});
			});
		}

		dialogNode.addEventListener('shown.bs.modal', () => {
			const { question } = ask;
			question.focus();
			question.setSelectionRange(question.value.length, question.value.length);
		});

		ask.question.addEventListener('input', () => {
			paintCounter();
			if (ask.question.value.trim().length >= ask.question.minLength) clearTooShort();
		});

		askForm.addEventListener('change', (event) => {
			if (event.target.name === 'reply') paintReplyChoice();
			else if (event.target.name === 'urgency') paintPromise();
		});

		askForm.addEventListener('submit', sendQuestion);
	}

	/** Resets the form, prefills it from the caller and shows the dialog. */
	function openAskDialog(prefill = {}) {
		const { topic = 'other', question = '' } = prefill;
		askForm.classList.remove('was-validated');
		clearTooShort();
		ask.question.value = question;
		askForm.elements.topic.value = topic;
		paintCounter();
		paintDeskState();
		ask.sheet?.show();
	}

	function sendQuestion(event) {
		event.preventDefault();
		const { question, email, tooShort } = ask;
		const tooFewWords = question.value.trim().length < question.minLength;
		question.classList.toggle('is-invalid', tooFewWords);
		tooShort.hidden = !tooFewWords;
		const badAddress = email.required && !email.checkValidity();
		askForm.classList.toggle('was-validated', badAddress);
		if (tooFewWords) {
			question.focus();
			return;
		}
		if (badAddress) {
			email.focus();
			return;
		}

		const ticket = `Q-${4800 + Math.floor(Math.random() * 900)}`;
		const byChat = askForm.elements.reply.value === 'chat';
		ask.sheet?.hide();
		notify(
			byChat
				? `Sent. A chat window is opening with the on-duty engineer (${ticket}).`
				: `Sent as ${ticket}. The reply will go to ${email.value.trim()}.`,
			'done',
		);
	}

	/** Live chat can only be chosen while the desk is staffed; otherwise the reply falls back to email. */
	function paintDeskState() {
		const desk = deskStatus();
		ask.chatOption.disabled = !desk.open;
		ask.chatHint.textContent = desk.open
			? 'Usually under a minute'
			: `Opens ${desk.reopens} at ${DESK_OPENS_AT}:00 am UTC`;
		if (!desk.open && ask.chatOption.checked) askForm.elements.reply.value = 'email';
		paintReplyChoice();
	}

	function paintReplyChoice() {
		const byEmail = askForm.elements.reply.value === 'email';
		ask.emailRow.hidden = !byEmail;
		ask.email.required = byEmail;
		paintPromise();
	}

	function paintPromise() {
		const desk = deskStatus();
		const urgency = askForm.elements.urgency.value;
		let promise = PROMISE_BY_EMAIL[urgency];
		if (!desk.open)
			promise = `The team is back ${desk.reopens} at ${DESK_OPENS_AT}:00 am UTC. ${PROMISE_WHEN_CLOSED[urgency]}`;
		else if (askForm.elements.reply.value === 'chat')
			promise = 'A chat opens when you send, usually within a minute';
		ask.promise.textContent = promise;
	}

	function paintCounter() {
		ask.counter.textContent = `${ask.question.value.length} / ${ask.question.maxLength}`;
	}

	function clearTooShort() {
		ask.tooShort.hidden = true;
		ask.question.classList.remove('is-invalid');
	}

	/**
	 * Whether the desk is staffed right now and, if not, when it is back:
	 * "today" before opening on a weekday, "tomorrow", or the weekday name
	 * when a weekend is in the way.
	 */
	function deskStatus(now = new Date()) {
		const weekday = now.getUTCDay();
		const clock = now.getUTCHours() + now.getUTCMinutes() / 60;
		const workday = weekday >= 1 && weekday <= 5;
		if (workday && clock >= DESK_OPENS_AT && clock < DESK_CLOSES_AT) return { open: true };

		let daysAhead = workday && clock < DESK_OPENS_AT ? 0 : 1;
		while ([0, 6].includes((weekday + daysAhead) % 7)) daysAhead += 1;
		const reopens = { 0: 'today', 1: 'tomorrow' }[daysAhead] ?? WEEKDAY_NAMES[(weekday + daysAhead) % 7];
		return { open: false, reopens };
	}

	/**
	 * Until the box is used, its placeholder types real questions one letter
	 * at a time, erases them and moves on. It pauses while the tab is hidden
	 * and while the box has focus or text.
	 */
	function cyclePlaceholder() {
		const { field } = search;
		const resting = field.placeholder;
		let phraseIndex = 0;
		let letters = 0;
		let erasing = false;
		let pending = null;

		function inUse() {
			return document.activeElement === field || field.value !== '';
		}

		function step() {
			pending = null;
			if (document.hidden) return;
			if (inUse()) {
				field.placeholder = resting;
				return;
			}
			const phrase = SAMPLE_QUESTIONS[phraseIndex];
			let delay = 55;
			if (erasing) {
				letters -= 1;
				delay = 22;
				if (letters <= 0) {
					erasing = false;
					phraseIndex = (phraseIndex + 1) % SAMPLE_QUESTIONS.length;
					delay = 450;
				}
			} else {
				letters += 1;
				if (letters >= phrase.length) {
					erasing = true;
					delay = 1700;
				}
			}
			field.placeholder = phrase.slice(0, letters) || resting;
			pending = setTimeout(step, delay);
		}

		function wake() {
			if (!pending && !document.hidden && !inUse()) pending = setTimeout(step, 600);
		}

		document.addEventListener('visibilitychange', wake);
		field.addEventListener('blur', wake);
		field.addEventListener('focus', () => {
			field.placeholder = resting;
		});
		pending = setTimeout(step, 900);
	}

	/** A small notice in the corner: plain for something under way, "done" for a finished action. */
	function notify(message, tone) {
		const finished = tone === 'done';
		const card = make('div', finished ? 'qa-toast qa-toast-done' : 'qa-toast');
		const glyph = make('i', finished ? 'bi bi-check-circle-fill' : 'bi bi-info-circle-fill');
		card.setAttribute('role', 'status');
		glyph.setAttribute('aria-hidden', 'true');
		card.append(glyph, make('span', '', message));
		notices.append(card);
		setTimeout(() => {
			card.classList.add('is-out');
			setTimeout(() => card.remove(), 220);
		}, 3600);
	}

	/* Reading the page and the small shared helpers. */

	function collectSections() {
		return Array.from(pickAll('[data-qa-topic]', page), (node) => {
			const key = node.getAttribute('data-qa-topic');
			const link = pick(`[data-qa-topic-link="${key}"]`, page);
			return {
				node,
				key,
				link,
				title: pick('.qa-topic-title', node).textContent.trim(),
				shownCount: hook('topic-shown', node),
				badge: link?.querySelector('[data-qa-topic-count]'),
			};
		});
	}

	function collectAnswers() {
		return Array.from(pickAll('[data-qa-q]', page), (node) => {
			const section = sections.find((candidate) => candidate.node.contains(node));
			const pieces = Array.from(pickAll('[data-qa-text]', node), (textNode) => ({
				node: textNode,
				original: textNode.textContent,
			}));
			const spoken = pieces.map((piece) => piece.original);
			return {
				node,
				section,
				pieces,
				id: node.id,
				button: pick('.qa-q-toggle', node),
				title: spoken[0],
				haystack: fold(`${spoken.join(' ')} ${node.getAttribute('data-qa-keywords')} ${section.title}`),
				pinnedOpen: false,
			};
		});
	}

	function hook(name, scope = page) {
		return pick(`[data-qa-${name}]`, scope);
	}

	function make(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text) node.textContent = text;
		return node;
	}

	/** "3 answers", "1 person": the noun takes an s unless a plural is given. */
	function count(number, one, many = `${one}s`) {
		return `${number} ${number === 1 ? one : many}`;
	}

	/** Lowercase without accents, so "résumé" and "resume" are the same word. */
	function fold(text) {
		return String(text ?? '')
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	function scrollMode() {
		return calmMotion.matches ? 'auto' : 'smooth';
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
