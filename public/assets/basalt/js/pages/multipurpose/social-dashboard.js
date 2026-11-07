/**
 * The social dashboard, social-dashboard.html. A range at the top (a
 * preset or two dates) picks the weeks; for those weeks it shows five
 * figures as tabs above one trend line, AI suggestions worked out from
 * them, and followers on each network. Below sit where the month's reach
 * came from, the best time to post and the top posts. Everything reads
 * window.Basalt.data.social, so it agrees with the planner and each
 * post's page.
 */
(() => {
	'use strict';
	const page = pick('[data-soc-root]', document);
	const social = window.Basalt.data?.social;
	if (!page || !social) return;

	const NUMBER = new Intl.NumberFormat('en-US');
	const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	const channels = social.channels;
	const posts = social.posts();
	const sent = posts.filter((post) => post.status === 'published');
	const booked = posts.filter((post) => post.status === 'scheduled');
	const { growth, rhythm, slots } = social;
	let growthChart = null;
	let range = { from: growth.weeks.length - 12, to: growth.weeks.length - 1 };
	let picked = 0;
	let drawGrowth = null;
	const KEPT_STORE = 'basalt-soc-kept';
	let kept = readKept();
	let thinking = 0;

	start();

	function start() {
		paintLead();
		wireIdeas();
		paintIdeas();
		wireRange();
		paintRing();
		paintSlots();
		paintTop();
		watchChart();
	}

	/* Small helpers. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(
			/[&<>"']/g,
			(mark) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[mark],
		);
	}

	function compact(amount) {
		if (amount >= 1e6) return `${(amount / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
		if (amount >= 10000) return `${(amount / 1000).toFixed(amount >= 100000 ? 0 : 1).replace(/\.0$/, '')}k`;
		return NUMBER.format(Math.round(amount));
	}

	function channelOf(id) {
		return channels.find((channel) => channel.id === id);
	}

	function sum(list) {
		return list.reduce((total, value) => total + value, 0);
	}

	/** What one sent post did, added up over every network it went to. */
	function totalsOf(post) {
		const results = Object.values(post.results || {});
		return {
			reach: sum(results.map((row) => row[0])),
			likes: sum(results.map((row) => row[1])),
			saves: sum(results.map((row) => row[2])),
			clicks: sum(results.map((row) => row[3])),
		};
	}

	function themeColor(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Eases a figure up from zero; with reduced motion it simply shows. */
	function countUp(element, target, format) {
		if (still.matches) {
			element.textContent = format(target);
			return;
		}
		const started = performance.now();
		const step = (now) => {
			const progress = Math.min(1, (now - started) / 500);
			element.textContent = format(target * (1 - (1 - progress) ** 3));
			if (progress < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	/* The weeks at the top: a preset or a custom range, as indexes into
	   growth.weeks. Figures compare against the same number of weeks
	   just before, when the data reaches back that far. */

	function wireRange() {
		const menu = pick('.soc-range');
		const form = pick('[data-soc-range-form]');
		const from = pick('[data-soc-range-from]');
		const to = pick('[data-soc-range-to]');
		const error = pick('[data-soc-range-error]');
		const fill = () => {
			window.Basalt.datepicker?.set(from, mondayOf(range.from));
			window.Basalt.datepicker?.set(to, growth.weeks[range.to]);
		};
		fill();
		menu.addEventListener('click', (event) => {
			const preset = event.target.closest('[data-soc-range]');
			if (!preset) return;
			const weeks = Number(preset.dataset.socRange);
			setRange(growth.weeks.length - weeks, growth.weeks.length - 1, preset.textContent.trim());
			fill();
			window.bootstrap?.Dropdown.getOrCreateInstance(pick('[data-bs-toggle="dropdown"]', menu)).hide();
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const start = weekOf(window.Basalt.datepicker?.get(from));
			const end = weekOf(window.Basalt.datepicker?.get(to));
			const wrong = start < 0 || end < 0 ? 'Pick both dates.' : end - start < 1 ? 'Pick at least two weeks.' : '';
			error.hidden = !wrong;
			error.textContent = wrong;
			if (wrong) return;
			setRange(start, end, `${shortDay(mondayOf(start))} – ${shortDay(growth.weeks[end])}`);
			window.bootstrap?.Dropdown.getOrCreateInstance(pick('[data-bs-toggle="dropdown"]', menu)).hide();
		});
	}

	function setRange(start, end, label) {
		range = { from: start, to: end };
		pick('[data-soc-range-label]').textContent = label;
		for (const preset of pickAll('[data-soc-range]')) {
			preset.setAttribute('aria-pressed', String(preset.textContent.trim() === label));
		}
		paintLead();
		paintIdeas();
		paintGrowth();
	}

	/** The index of the week a date falls in, or -1 outside the year. */
	function weekOf(iso) {
		if (!iso) return -1;
		return growth.weeks.findIndex((sunday) => sunday >= iso);
	}

	function mondayOf(at) {
		const day = new Date(`${growth.weeks[at]}T12:00`);
		day.setDate(day.getDate() - 6);
		return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
	}

	/** The range's slice of a weekly series, or of the same length just before it. */
	function inRange(list, before = false) {
		const length = range.to - range.from + 1;
		if (!before) return list.slice(range.from, range.to + 1);
		return range.from - length < 0 ? null : list.slice(range.from - length, range.from);
	}

	function weeklyTotals() {
		return growth.weeks.map((_, week) => sum(channels.map((channel) => growth[channel.id][week])));
	}

	/** "Up 12% on the weeks before", or the plain note when there is nothing to compare. */
	function against(now, then, plain) {
		if (!then) return plain;
		const change = Math.round(((now - then) / then) * 100);
		return change === 0
			? 'Level with the weeks before'
			: `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)}% on the weeks before`;
	}

	/* The lead card: the figures as tabs above one trend line. */

	function figuresInRange() {
		const totals = inRange(weeklyTotals());
		const weeks = totals.length;
		const whole = (value) => NUMBER.format(Math.round(value));
		const percent = (value) => `${value.toFixed(1)}%`;
		const reach = inRange(rhythm.reach);
		const clicks = inRange(rhythm.clicks);
		const posted = inRange(rhythm.posts);
		const engaged = inRange(rhythm.engaged);
		const before = (list) => inRange(list, true);
		const mean = (list) => sum(list) / list.length;
		const grew = Math.round(((totals.at(-1) - totals[0]) / totals[0]) * 100);
		return [
			{
				label: 'Followers',
				value: totals.at(-1),
				show: whole,
				note: `Up ${grew}% in ${weeks} weeks`,
				values: totals,
			},
			{
				label: 'Reach',
				value: sum(reach),
				show: compact,
				note: against(
					sum(reach),
					before(rhythm.reach) && sum(before(rhythm.reach)),
					`${sum(posted)} posts sent`,
				),
				values: reach,
			},
			{
				label: 'Engagement',
				value: mean(engaged),
				show: percent,
				note: against(
					mean(engaged),
					before(rhythm.engaged) && mean(before(rhythm.engaged)),
					'Likes and saves per person reached',
				),
				values: engaged,
			},
			{
				label: 'Shop clicks',
				value: sum(clicks),
				show: whole,
				note: against(
					sum(clicks),
					before(rhythm.clicks) && sum(before(rhythm.clicks)),
					`${Math.round(sum(clicks) / sum(posted))} clicks a post`,
				),
				values: clicks,
			},
			{
				label: 'Posts',
				value: sum(posted),
				show: whole,
				note: `${(sum(posted) / weeks).toFixed(1)} a week`,
				values: posted,
			},
		];
	}

	function paintLead() {
		const figures = figuresInRange();
		const names = inRange(growth.weeks).map((week) => `Week of ${shortDay(week)}`);
		const tabs = pick('[data-soc-metrics]');
		const note = pick('[data-soc-perf-note]');
		const holder = pick('[data-soc-trend]');
		pick('[data-soc-perf-title]').textContent = pick('[data-soc-range-label]').textContent;
		if (!tabs.children.length) {
			tabs.innerHTML = figures
				.map(
					(figure, at) =>
						`<button type="button" role="tab" aria-selected="${at === 0}" tabindex="${at === 0 ? 0 : -1}" class="soc-metric" data-soc-metric="${at}"><span class="soc-metric-label">${figure.label}</span><span class="soc-metric-value">0</span></button>`,
				)
				.join('');
			tabs.addEventListener('click', (event) => {
				const tab = event.target.closest('[data-soc-metric]');
				if (tab) choose(Number(tab.dataset.socMetric));
			});
			tabs.addEventListener('keydown', (event) => {
				const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
				if (!step) return;
				event.preventDefault();
				choose(picked + step);
				tabs.children[picked].focus();
			});
		}
		const values = pickAll('.soc-metric-value', tabs);
		figures.forEach((figure, at) => countUp(values[at], figure.value, figure.show));
		const ends = range.to - range.from;
		pick('[data-soc-weeks]').innerHTML = [0, Math.round(ends / 3), Math.round((ends * 2) / 3), ends]
			.map((at) => `<span>${shortDay(growth.weeks[range.from + at])}</span>`)
			.join('');

		function draw() {
			const figure = figures[picked];
			note.textContent = figure.note;
			window.Basalt.trendline?.(holder, figure.values, {
				labels: names,
				format: figure.show,
				name: figure.label,
				onRead: (point, reading, name) => {
					values[picked].textContent = figure.show(point === null ? figure.value : reading);
					tabs.children[picked].classList.toggle('is-reading', point !== null);
					note.textContent = point === null ? figure.note : name;
				},
			});
		}
		function choose(at) {
			picked = (at + figures.length) % figures.length;
			for (const tab of tabs.children) {
				const on = Number(tab.dataset.socMetric) === picked;
				tab.setAttribute('aria-selected', String(on));
				tab.tabIndex = on ? 0 : -1;
			}
			draw();
		}
		draw();
	}

	function shortDay(iso) {
		return new Date(`${iso}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/* Suggestions, worked out again for whichever weeks are picked: the
	   problems those weeks show first, then what worked. Each says what it
	   rests on, and any of them can be pinned to a list that stays while
	   the dates change. The list is kept in this browser. */

	function readKept() {
		try {
			return JSON.parse(localStorage.getItem(KEPT_STORE)) || [];
		} catch {
			return [];
		}
	}

	function writeKept() {
		try {
			localStorage.setItem(KEPT_STORE, JSON.stringify(kept));
		} catch {
			/* A private window says no; the list lasts until the page closes. */
		}
	}

	function ideasInRange() {
		const recent = range.to >= growth.weeks.length - 4;
		const all = [
			dipIdea(),
			quietIdea(),
			clicksIdea(),
			timingIdea(),
			growthIdea(),
			bestWeekIdea(),
			seasonIdea(),
			rhythmIdea(),
			recent ? bestPostIdea() : null,
		].filter(Boolean);
		const problems = all.filter((idea) => idea.kind === 'problem').slice(0, 2);
		const wins = all.filter((idea) => idea.kind !== 'problem');
		return [...problems, ...wins].slice(0, 4);
	}

	/** Shows the AI reading the picked weeks for a moment, then its suggestions. */
	function paintIdeas() {
		const list = pick('[data-soc-ideas]');
		const wait = pick('[data-soc-thinking]');
		const weeks = range.to - range.from + 1;
		clearTimeout(thinking);
		pick('[data-soc-thinking-text]').textContent = `Reading ${weeks} weeks of posts`;
		wait.hidden = pick('[data-soc-ideas-view]:checked').value !== 'new';
		list.hidden = true;
		thinking = setTimeout(
			() => {
				wait.hidden = true;
				list.hidden = pick('[data-soc-ideas-view]:checked').value !== 'new';
				drawIdeas();
			},
			still.matches ? 200 : 500,
		);
	}

	function drawIdeas() {
		pick('[data-soc-ideas]').innerHTML = ideasInRange()
			.map((idea, at) => {
				const on = kept.some((item) => item.id === idea.id);
				return `<li class="basalt-idea${idea.kind === 'problem' ? ' is-problem' : ''}" style="--i: ${at}" data-idea="${idea.id}"><span class="basalt-idea-icon" aria-hidden="true"><i class="bi ${idea.icon}"></i></span><p class="basalt-idea-title">${idea.title}</p><p class="basalt-idea-why"><span class="basalt-idea-kind">${idea.kind === 'problem' ? 'Problem' : 'Working'}</span>${idea.why}</p><span class="basalt-idea-actions"><button type="button" class="btn btn-sm soc-pin${on ? ' is-on' : ''}" data-soc-pin aria-pressed="${on}" aria-label="${on ? 'Unpin' : 'Pin to your list'}" title="${on ? 'Pinned' : 'Pin to your list'}"><i class="bi ${on ? 'bi-pin-angle-fill' : 'bi-pin-angle'}" aria-hidden="true"></i></button><a class="btn btn-outline-secondary btn-sm" href="${idea.href}">${idea.act}</a></span></li>`;
			})
			.join('');
	}

	function drawKept() {
		pick('[data-soc-kept-count]').textContent = kept.length;
		pick('[data-soc-kept]').innerHTML = kept.length
			? kept
					.map(
						(item) =>
							`<li class="soc-kept-item${item.done ? ' is-done' : ''}" data-kept="${item.id}"><input type="checkbox" class="form-check-input" data-soc-done id="soc-kept-${item.id}" aria-label="Done: ${item.title}"${item.done ? ' checked' : ''}><label for="soc-kept-${item.id}" class="soc-kept-text"><span class="soc-kept-title">${item.title}</span><span class="soc-kept-why">${item.why} · ${item.from}</span></label><button type="button" class="btn btn-sm soc-kept-drop" data-soc-drop aria-label="Remove from your list" title="Remove"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>`,
					)
					.join('')
			: `<li class="soc-kept-none">${window.Basalt?.emptyState ? window.Basalt.emptyState({ icon: 'pin-angle', title: 'Nothing pinned yet', text: 'Pin a suggestion to keep it here.' }) : 'Nothing pinned yet.'}</li>`;
	}

	function wireIdeas() {
		const card = pick('[data-soc-ideas]').closest('.card');
		const desc = pick('[data-soc-ideas-desc]');
		drawKept();
		for (const option of pickAll('[data-soc-ideas-view]', card)) {
			option.addEventListener('change', () => {
				const mine = option.value === 'kept';
				/* The card keeps its height, so the chart beside it does not jump. */
				card.style.minHeight = `${card.offsetHeight}px`;
				pick('[data-soc-kept]').hidden = !mine;
				pick('[data-soc-ideas]').hidden = mine;
				pick('[data-soc-thinking]').hidden = true;
				desc.textContent = mine ? 'Pinned from any dates.' : 'What to do next, from the same weeks.';
				if (!mine) paintIdeas();
			});
		}
		card.addEventListener('click', (event) => {
			const pin = event.target.closest('[data-soc-pin]');
			if (pin) {
				const id = pin.closest('[data-idea]').dataset.idea;
				const idea = ideasInRange().find((item) => item.id === id);
				const at = kept.findIndex((item) => item.id === id);
				if (at >= 0) kept.splice(at, 1);
				else
					kept.unshift({
						id,
						title: idea.title,
						why: idea.why,
						from: pick('[data-soc-range-label]').textContent,
						done: false,
					});
				writeKept();
				drawKept();
				drawIdeas();
				const count = pick('[data-soc-kept-count]');
				count.classList.remove('is-bumped');
				void count.offsetWidth;
				count.classList.add('is-bumped');
				return;
			}
			const drop = event.target.closest('[data-soc-drop]');
			if (drop) {
				kept = kept.filter((item) => item.id !== drop.closest('[data-kept]').dataset.kept);
				writeKept();
				drawKept();
				drawIdeas();
			}
		});
		card.addEventListener('change', (event) => {
			const box = event.target.closest('[data-soc-done]');
			if (!box) return;
			const item = kept.find((entry) => entry.id === box.closest('[data-kept]').dataset.kept);
			item.done = box.checked;
			writeKept();
			box.closest('[data-kept]').classList.toggle('is-done', item.done);
		});
	}

	/** The picked week whose engagement fell furthest below the rest. */
	function dipIdea() {
		const engaged = inRange(rhythm.engaged);
		const usual = sum(engaged) / engaged.length;
		const low = engaged.indexOf(Math.min(...engaged));
		if (usual - engaged[low] < 0.7) return null;
		const week = growth.weeks[range.from + low];
		return {
			id: `dip-${week}`,
			kind: 'problem',
			icon: 'bi-graph-down-arrow',
			title: `Engagement fell the week of ${shortDay(week)}`,
			why: `${engaged[low].toFixed(1)}% against ${usual.toFixed(1)}% usual.`,
			act: 'See that week',
			href: 'social-planner.html',
		};
	}

	/** Weeks with three posts or fewer in the picked range. */
	function quietIdea() {
		const posted = inRange(rhythm.posts);
		const quiet = posted.filter((count) => count <= 3).length;
		if (quiet < 2) return null;
		return {
			id: `quiet-${range.from}-${range.to}`,
			kind: 'problem',
			icon: 'bi-calendar-x',
			title: 'Fill the quiet weeks',
			why: `${quiet} weeks had three posts or fewer.`,
			act: 'Plan the week',
			href: 'social-planner.html',
		};
	}

	/** How much more a week reached in November and December, when the range holds them. */
	function seasonIdea() {
		const weeks = inRange(growth.weeks);
		const reach = inRange(rhythm.reach);
		const gifts = reach.filter((_, at) => /-(11|12)-/.test(weeks[at]));
		const rest = reach.filter((_, at) => !/-(11|12)-/.test(weeks[at]));
		if (gifts.length < 3 || !rest.length) return null;
		const lift = Math.round((sum(gifts) / gifts.length / (sum(rest) / rest.length) - 1) * 100);
		return {
			id: 'season',
			kind: 'win',
			icon: 'bi-gift',
			title: 'Plan the gift season early',
			why: `November and December reached ${lift}% more a week.`,
			act: 'Open the planner',
			href: 'social-planner.html',
		};
	}

	/** The fastest and the slowest growing networks in the picked weeks. */
	function growthIdea() {
		const pace = channels
			.map((channel) => {
				const series = inRange(growth[channel.id]);
				return { channel, rise: (series.at(-1) - series[0]) / series[0] };
			})
			.sort((left, right) => right.rise - left.rise);
		const [fast] = pace;
		const slow = pace.at(-1);
		return {
			id: `growth-${fast.channel.id}-${slow.channel.id}`,
			kind: 'win',
			icon: 'bi-arrow-left-right',
			title: `Move a ${slow.channel.name} post to ${fast.channel.name}`,
			why: `${fast.channel.name} grew ${Math.round(fast.rise * 100)}%, ${slow.channel.name} ${Math.round(slow.rise * 100)}%.`,
			act: `Open ${fast.channel.name} posts`,
			href: 'social-planner.html',
		};
	}

	/** The picked week with the most reach for each post sent. */
	function bestWeekIdea() {
		const reach = inRange(rhythm.reach);
		const posted = inRange(rhythm.posts);
		let best = 0;
		reach.forEach((value, at) => {
			if (value / posted[at] > reach[best] / posted[best]) best = at;
		});
		return {
			id: `week-${growth.weeks[range.from + best]}`,
			kind: 'win',
			icon: 'bi-trophy',
			title: `Repeat the week of ${shortDay(growth.weeks[range.from + best])}`,
			why: `${compact(reach[best] / posted[best])} reached a post, the best of these weeks.`,
			act: 'Open the planner',
			href: 'social-planner.html',
		};
	}

	/** Clicks a post against the weeks before the picked ones. */
	function clicksIdea() {
		const before = inRange(rhythm.clicks, true);
		if (!before) return null;
		const now = sum(inRange(rhythm.clicks)) / sum(inRange(rhythm.posts));
		const then = sum(before) / sum(inRange(rhythm.posts, true));
		const change = Math.round(((now - then) / then) * 100);
		if (Math.abs(change) < 3) return null;
		return change > 0
			? {
					id: 'clicks-up',
					kind: 'win',
					icon: 'bi-cursor',
					title: 'Keep a shop link in every post',
					why: `Clicks a post up ${change}% on the weeks before.`,
					act: 'See what links',
					href: 'social-planner.html',
				}
			: {
					id: 'clicks-down',
					kind: 'problem',
					icon: 'bi-cursor',
					title: 'Put shop links back in posts',
					why: `Clicks a post down ${-change}% on the weeks before.`,
					act: 'See what links',
					href: 'social-planner.html',
				};
	}

	/** Whether the busier weeks in the picked range reached more people. */
	function rhythmIdea() {
		const reach = inRange(rhythm.reach);
		const posted = inRange(rhythm.posts);
		const aim = Math.ceil(sum(posted) / posted.length);
		const busy = reach.filter((_, at) => posted[at] >= aim);
		const quiet = reach.filter((_, at) => posted[at] < aim);
		if (!busy.length || !quiet.length) return null;
		const lift = Math.round((sum(busy) / busy.length / (sum(quiet) / quiet.length) - 1) * 100);
		if (lift < 5) return null;
		return {
			id: `rhythm-${aim}`,
			kind: 'win',
			icon: 'bi-calendar-check',
			title: `Post ${aim} times a week`,
			why: `Weeks with ${aim} or more reached ${lift}% more.`,
			act: 'Plan the week',
			href: 'social-planner.html',
		};
	}

	/** The sent post that beat its network's usual reach by the most. */
	function bestPostIdea() {
		let best = null;
		for (const post of sent) {
			for (const [id, row] of Object.entries(post.results || {})) {
				const lift = row[0] / channelOf(id).usual[0];
				if (!best || lift > best.lift) best = { post, id, lift };
			}
		}
		if (!best) return null;
		const network = channelOf(best.id).name;
		return {
			id: `post-${best.post.id}`,
			kind: 'win',
			icon: 'bi-lightning-charge',
			title: `More like “${htmlSafe(best.post.title)}”`,
			why: `Reached ${best.lift.toFixed(1)}× a usual ${network} post.`,
			act: 'Plan a post like it',
			href: 'social-post-details.html?new',
		};
	}

	/** The best slot, and how many booked posts already use it. */
	function timingIdea() {
		const best = bestSlot();
		const onTime = booked.filter((post) => {
			const when = new Date(post.at);
			return (when.getDay() + 6) % 7 === best.day && Math.abs(when.getHours() - best.hour) <= 1;
		}).length;
		return {
			id: `slot-${best.day}-${best.time}`,
			kind: onTime ? 'win' : 'problem',
			icon: 'bi-clock',
			title: `Post on ${DAY_NAMES[best.day]} at ${slots.times[best.time]}`,
			why: `${onTime ? `Only ${onTime}` : 'None'} of ${booked.length} booked posts use it.`,
			act: 'Move booked posts',
			href: 'social-planner.html',
		};
	}

	function bestSlot() {
		let best = { day: 0, time: 0, score: -1 };
		slots.score.forEach((row, day) =>
			row.forEach((score, time) => {
				if (score > best.score) best = { day, time, score };
			}),
		);
		best.hour = [9, 12, 15, 18, 21][best.time];
		return best;
	}

	/* Followers on each network, week by week, over the picked weeks. */

	function paintGrowth() {
		const totals = inRange(weeklyTotals());
		pick('[data-soc-growth-desc]').textContent =
			`${NUMBER.format(totals.at(-1) - totals[0])} more followers in ${totals.length} weeks.`;
		if (growthChart) drawGrowth(true);
	}

	function watchChart() {
		const canvas = pick('[data-soc-growth]');
		paintGrowth();
		pick('[data-soc-legend]').innerHTML = channels
			.map(
				(channel) =>
					`<li style="--soc-tone: var(--basalt-series-${channel.tone})"><i class="bi ${channel.icon}"></i>${channel.name}</li>`,
			)
			.join('');
		if (!window.Chart || !canvas) return;
		const draw = (animate) => {
			growthChart?.destroy();
			growthChart = new window.Chart(canvas, {
				type: 'line',
				data: {
					labels: inRange(growth.weeks).map(shortDay),
					datasets: channels.map((channel) => {
						const color = themeColor(`--basalt-series-${channel.tone}`, '#6d3fe0');
						return {
							label: channel.name,
							data: inRange(growth[channel.id]),
							borderColor: color,
							backgroundColor: color,
							borderWidth: 2.5,
							pointRadius: 0,
							pointHoverRadius: 5,
							tension: 0.35,
						};
					}),
				},
				options: {
					animation: animate && !still.matches ? { duration: 500 } : false,
					maintainAspectRatio: false,
					interaction: { mode: 'index', intersect: false },
					plugins: { legend: { display: false } },
					scales: {
						x: { grid: { display: false } },
						y: { ticks: { callback: (value) => compact(value) } },
					},
				},
			});
		};
		drawGrowth = draw;
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watcher.disconnect();
				draw(true);
			},
			{ rootMargin: '80px 0px' },
		);
		watcher.observe(canvas);
		document.addEventListener('basalt:appearance', () => requestAnimationFrame(() => growthChart && draw(false)));
	}

	/* Where the month's reach came from: a ring that picks a network out on hover. */

	function paintRing() {
		const split = channels
			.map((channel) => ({
				channel,
				reach: sum(
					sent.filter((post) => post.results?.[channel.id]).map((post) => post.results[channel.id][0]),
				),
			}))
			.sort((left, right) => right.reach - left.reach);
		const total = sum(split.map((part) => part.reach));
		const radius = 48;
		const around = 2 * Math.PI * radius;
		let traveled = 0;
		const arcs = split.map(({ channel, reach }) => {
			const length = (reach / total) * around;
			const arc = `<circle data-soc-net="${channel.id}" class="soc-ring-seg" style="--soc-tone: var(--basalt-series-${channel.tone})" cx="60" cy="60" r="${radius}" stroke-dasharray="${Math.max(0, length - 2.5).toFixed(2)} ${around.toFixed(2)}" stroke-dashoffset="${(-traveled).toFixed(2)}"></circle>`;
			traveled += length;
			return arc;
		});
		const svg = pick('[data-soc-ring]');
		svg.innerHTML = `<circle class="soc-ring-track" cx="60" cy="60" r="${radius}"></circle>${arcs.join('')}`;
		const value = pick('[data-soc-ring-value]');
		const label = pick('[data-soc-ring-label]');
		const resting = compact(total);
		value.textContent = resting;
		pick('[data-soc-ring-list]').innerHTML = split
			.map(
				({ channel, reach }) =>
					`<li data-soc-net="${channel.id}" tabindex="0" style="--soc-tone: var(--basalt-series-${channel.tone})"><span class="soc-ring-dot" aria-hidden="true"></span><span class="soc-ring-name"><i class="bi ${channel.icon}" aria-hidden="true"></i>${channel.name}</span><span class="soc-ring-amt">${compact(reach)}<span>${Math.round((reach / total) * 100)}%</span></span></li>`,
			)
			.join('');
		const ring = svg.closest('.soc-ring');
		const choose = (id) => {
			const part = split.find((entry) => entry.channel.id === id);
			ring.classList.toggle('is-picking', Boolean(part));
			for (const piece of pickAll('[data-soc-net]', ring))
				piece.classList.toggle('is-on', piece.dataset.socNet === id);
			value.textContent = part ? compact(part.reach) : resting;
			label.textContent = part
				? `${part.channel.name} · ${Math.round((part.reach / total) * 100)}%`
				: 'people reached';
		};
		const netAt = (event) => event.target.closest?.('[data-soc-net]')?.dataset.socNet ?? null;
		ring.addEventListener('pointerover', (event) => choose(netAt(event)));
		ring.addEventListener('pointerleave', () => choose(null));
		ring.addEventListener('focusin', (event) => choose(netAt(event)));
		ring.addEventListener('focusout', () => choose(null));
	}

	/* When posts do best: a grid of days by times, the strongest outlined. */

	function paintSlots() {
		const best = bestSlot();
		pick('[data-soc-slots-desc]').textContent =
			`Your posts do best on ${DAY_NAMES[best.day]} at ${slots.times[best.time]}. Hover a square for its score.`;
		const head = `<span></span>${slots.times.map((time) => `<span class="soc-slot-time">${time}</span>`).join('')}`;
		const rows = slots.days
			.map(
				(day, row) =>
					`<span class="soc-slot-day">${day}</span>${slots.score[row]
						.map((score, col) => {
							const top = row === best.day && col === best.time ? ' is-best' : '';
							return `<span class="soc-slot${top}" style="--soc-heat: ${score}%; --i: ${row * 5 + col}" title="${day} at ${slots.times[col]}: ${score} of 100"></span>`;
						})
						.join('')}`,
			)
			.join('');
		pick('[data-soc-slots]').innerHTML = head + rows;
	}

	/* The posts that reached the most people this month. */

	function paintTop() {
		const ranked = sent
			.map((post) => ({ post, totals: totalsOf(post) }))
			.sort((left, right) => right.totals.reach - left.totals.reach)
			.slice(0, 4);
		const best = ranked[0].totals.reach;
		pick('[data-soc-top]').innerHTML = ranked
			.map(({ post, totals }) => {
				const icons = post.channels
					.map(
						(id) =>
							`<i class="bi ${channelOf(id).icon}" role="img" aria-label="${channelOf(id).name}"></i>`,
					)
					.join('');
				const rate = ((totals.likes + totals.saves) / totals.reach) * 100;
				return `<li class="soc-top-row"><img src="${social.photoOf(post, 96, 96)}" alt="" width="48" height="48" loading="lazy"><span class="soc-top-text"><a class="soc-top-title" href="social-post-details.html?id=${encodeURIComponent(post.id)}">${htmlSafe(post.title)}</a><span class="soc-top-meta">${icons}<span>${rate.toFixed(1)}% engaged</span></span><span class="soc-top-bar" aria-hidden="true"><span style="--soc-w: ${((totals.reach / best) * 100).toFixed(1)}%"></span></span></span><span class="soc-top-reach">${compact(totals.reach)}</span></li>`;
			})
			.join('');
	}
})();
