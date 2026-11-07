/**
 * Locations (locations.html) and Location Details (location-details.html):
 * the group's sites, read from window.Basalt.data.locations, dated Friday,
 * October 9, 2026 at 11:20.
 *
 * Locations is the group: every site. Location Details is one site, named
 * by the address (#broadway), with a picker for the other sites in its
 * header. Locations opens with today's figures (a number over a bar per hour), then one of
 * three tops (a preview: #1 who carries the load, #2 open hours today,
 * #3 where a patient can be seen next), then the list of sites. Sites are
 * added in four steps and edited in one dialog (hours with holidays,
 * services, rooms, members, a temporary close), each with Undo.
 *
 * Changes live in memory until the page reloads.
 */
(() => {
	'use strict';

	const root = document.querySelector('[data-loc-root]');
	const data = window.Basalt && window.Basalt.data && window.Basalt.data.locations;
	if (!root || !data) return;

	const PAGE = root.dataset.locPage;

	/* An icon for each service a site offers. */
	const SERVICE_ICONS = {
		'Primary care': 'heart-pulse',
		Cardiology: 'heart',
		Orthopedics: 'person-walking',
		Respiratory: 'lungs',
		'Ear, nose & throat': 'ear',
		Gastroenterology: 'clipboard2-pulse',
		'Mental health': 'emoji-smile',
		Dermatology: 'droplet-half',
		Pharmacy: 'capsule',
		'Lab draws': 'droplet',
		'Blood draws': 'droplet',
		Vaccines: 'eyedropper',
		Telehealth: 'camera-video',
		Pediatrics: 'balloon-heart',
		"Women's health": 'gender-female',
		Mammography: 'gender-female',
		'Urgent care': 'lightning-charge',
		'X-ray': 'person-bounding-box',
		Stitches: 'bandaid',
		'Sprains & fractures': 'person-arms-up',
		'Flu & COVID tests': 'thermometer-half',
		'Sports physicals': 'bicycle',
		Emergency: 'hospital',
		Wards: 'house-heart',
		Surgery: 'scissors',
		ICU: 'activity',
		'Labor & delivery': 'balloon',
		Imaging: 'camera',
		Ultrasound: 'soundwave',
		CT: 'disc',
		MRI: 'magnet',
	};
	const NOW = data.now;
	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const STATE_WORDS = { open: 'Open', soon: 'Closing soon', closed: 'Closed', alert: 'Problem' };
	const GROUPS = [
		['office', 'Offices'],
		['urgent', 'Urgent care'],
		['hospital', 'Hospital'],
		['lab', 'Lab & Imaging'],
	];
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');

	const state = {
		site: 'all',
		scoreSort: 'problems',
		acted: new Set(),
		list: { query: '', kind: 'all', sort: 'state', asc: true },
	};

	function start() {
		wirePeek();
		wireEdit();
		wireAdd();
		wireActs();
		if (PAGE === 'list') {
			wireScorecard();
			wireList();
		} else {
			wireSwitcher();
			state.site = siteFromHash();
			addEventListener('hashchange', () => {
				state.site = siteFromHash();
				refresh();
			});
		}
		refresh();
		(window.Basalt.settled || Promise.resolve()).then(() => {
			root.classList.add('loc-settled');
			countFigures();
		});
	}

	function refresh() {
		drawSwitcher();
		drawFigures();
		if (PAGE === 'list') {
			drawScorecard();
			drawProblems();
			drawOpening();
			drawList();
		} else {
			drawDetails();
		}
		paintAvatars(root);
		placeVars(root);
	}

	/* Facts about one site, in the words the front desk would use */

	function today(site) {
		return site.closedToday || site.opensOn ? null : site.week[data.today];
	}

	/** Open, closing within the hour, closed, or open with something that
	 * has a problem worth the owner's attention. */
	function stateOf(site) {
		const hours = today(site);
		if (!hours || NOW < hours[0] || NOW >= hours[1]) return 'closed';
		if (site.attention) return 'alert';
		if (hours[1] - NOW <= 60) return 'soon';
		return 'open';
	}

	function openLine(site) {
		if (site.opensOn) return `Opens ${site.opensOn}`;
		const hours = today(site);
		if (!hours) return 'Closed today';
		if (hours[0] === 0 && hours[1] === 1440) return 'Open 24 hours';
		if (NOW < hours[0]) return `Opens at ${clock(hours[0])}`;
		if (NOW >= hours[1]) return `Closed at ${clock(hours[1])}`;
		if (hours[1] - NOW <= 60) return `Closes at ${clock(hours[1])}`;
		return `Open until ${clock(hours[1])}`;
	}

	function stateWord(site) {
		if (site.opensOn) return 'Opening soon';
		const st = stateOf(site);
		return st === 'alert' ? site.attention.why : STATE_WORDS[st];
	}

	function capsule(site) {
		return `<span class="loc-state is-${site.opensOn ? 'new' : stateOf(site)}"><span class="loc-dot"></span>${stateWord(site)}</span>`;
	}

	function hoursText(span) {
		if (!span) return 'Closed';
		if (span[0] === 0 && span[1] === 1440) return '24 hours';
		return `${clock(span[0])} to ${clock(span[1])}`;
	}

	/** 7 pm, 7:30 am, noon. */
	function clock(minutes) {
		if (minutes === 720) return 'noon';
		if (minutes === 1440) return 'midnight';
		const hours = Math.floor(minutes / 60) % 24;
		const mins = minutes % 60;
		return `${hours % 12 || 12}${mins ? `:${String(mins).padStart(2, '0')}` : ''} ${hours >= 12 ? 'pm' : 'am'}`;
	}

	/** The one load figure a person in that job would quote. */
	function loadOf(site) {
		if (site.opensOn) return { value: `${site.opening ? site.opening.signedUp.at(-1) : 0} signed up`, note: '' };
		if (stateOf(site) === 'closed')
			return { value: `Opens ${site.next ? site.next.day.split(',')[0] : 'Mon'}`, note: '' };
		if (site.kind === 'urgent')
			return { value: `${site.postedWait} min`, note: 'posted wait', over: site.postedWait > site.target };
		if (site.kind === 'hospital') return { value: `${site.beds.free} beds`, note: 'free', over: true };
		if (site.kind === 'lab') return { value: `${site.queue} in queue`, note: 'for a draw' };
		return { value: `${site.seen} of ${site.booked}`, note: 'seen' };
	}

	function cap(text) {
		return text.charAt(0).toUpperCase() + text.slice(1);
	}

	function seenOf(site) {
		return site.kind === 'hospital' ? site.seen + 14 : site.seen;
	}

	function share(site) {
		return site.rooms.of ? site.rooms.used / site.rooms.of : 0;
	}

	function kindName(site) {
		return data.kinds[site.kind].name;
	}

	function providerHref(person) {
		return person.id ? `provider-details.html?id=${person.id}` : 'provider-details.html';
	}

	function detailsHref(site) {
		return `location-details.html#${site.id}`;
	}

	function siteById(id) {
		return data.sites.find((s) => s.id === id);
	}

	function siteFromHash() {
		const id = decodeURIComponent(location.hash.slice(1));
		return siteById(id) ? id : data.sites[0].id;
	}

	function money(n) {
		return n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`;
	}

	/* On a site's page: the picker for the other sites, grouped by kind */

	function drawSwitcher() {
		const menu = document.querySelector('[data-loc-switch-menu]');
		if (!menu) return;
		const item = (id, name) =>
			`<li><button data-loc-pick="${id}" type="button" class="dropdown-item${state.site === id ? ' active' : ''}" aria-current="${state.site === id}">${name}</button></li>`;
		menu.innerHTML = GROUPS.map(([kind, title]) => {
			const sites = data.sites.filter((s) => s.kind === kind);
			return sites.length
				? `<li><h6 class="dropdown-header">${title}</h6></li>${sites.map((s) => item(s.id, s.name)).join('')}`
				: '';
		}).join('');
	}

	function wireSwitcher() {
		document.addEventListener('click', (event) => {
			const item = event.target.closest('[data-loc-pick]');
			if (!item) return;
			event.preventDefault();
			location.hash = item.dataset.locPick;
		});
	}

	/* Today so far: plain cards, a number over a bar per hour (6 am to the
	   11 am hour so far), for the group or the one site shown */

	function sumHours(sites, key) {
		return data.hours.map((_, i) => sites.reduce((sum, s) => sum + ((s.byHour[key] || [])[i] || 0), 0));
	}

	function openByHour() {
		return data.hours.map((hour, i) => {
			const at = i === data.hours.length - 1 ? NOW : hour * 60;
			return data.sites.filter((s) => {
				const span = today(s);
				return span && at >= span[0] && at < span[1];
			}).length;
		});
	}

	function figuresFor(site) {
		const seenNote = (series) => `${series.at(-1)} so far this hour`;
		if (!site) {
			const live = running();
			const closed = live.filter((s) => stateOf(s) === 'closed');
			const seen = sumHours(live, 'seen');
			const m = data.month;
			const revenue = m.revenue.reduce((a, b) => a + b, 0);
			const members = m.members.reduce((a, b) => a + b, 0);
			const opening = data.sites.find((s) => s.opening);
			return [
				{
					icon: 'currency-dollar',
					label: 'Revenue this month',
					series: m.revenue,
					labels: m.days,
					text: money(revenue * 1000),
					note: `${Math.round((revenue / m.target) * 100)}% of the target to date`,
					tone: 4,
					format: (v) => money(v * 1000),
					trend: false,
					up: revenue >= m.target,
				},
				{
					icon: 'person-check',
					label: 'Patients seen today',
					series: seen,
					value: live.reduce((sum, s) => sum + seenOf(s), 0),
					note: `${seen.at(-1)} so far this hour`,
					tone: 1,
					word: 'seen',
					trend: true,
				},
				{
					icon: 'geo-alt',
					label: 'Open now',
					series: openByHour(),
					unit: `of ${live.length}`,
					note: closed.length
						? `${closed.map((s) => s.short).join(', ')} closed today`
						: 'Every site is open',
					tone: 2,
					word: 'open',
				},
				{
					icon: 'person-plus',
					label: 'New members this month',
					series: m.members,
					labels: m.days,
					value: members,
					note: opening
						? `${opening.opening.signedUp.at(-1)} more waiting for ${opening.short}`
						: 'across the offices',
					tone: 6,
					word: 'joined',
				},
			];
		}
		if (site.opening) {
			const o = site.opening;
			const weeks = ['5 weeks ago', '4 weeks ago', '3 weeks ago', '2 weeks ago', 'Last week', 'This week'];
			return [
				{
					icon: 'people',
					label: 'Team hired',
					series: o.hired,
					labels: weeks,
					unit: `of ${o.team}`,
					note: `${o.team - o.hired.at(-1)} still to hire`,
					tone: 1,
					word: 'hired',
					trend: true,
				},
				{
					icon: 'hammer',
					label: 'Build-out',
					series: o.fitOut,
					labels: weeks,
					unit: '%',
					note: `Opens ${o.date.split(', ').slice(1).join(', ')}`,
					tone: 2,
					word: '% done',
					trend: true,
				},
				{
					icon: 'person-plus',
					label: 'Members signed up',
					series: o.signedUp,
					labels: weeks,
					unit: `of ${o.goal}`,
					note: `${o.signedUp.at(-1) - o.signedUp.at(-2)} this week`,
					tone: 6,
					word: 'signed up',
					trend: true,
				},
			];
		}
		const h = site.byHour;
		const seen = {
			icon: 'person-check',
			label: 'Seen today',
			series: h.seen,
			value: seenOf(site),
			unit: site.kind === 'office' || site.kind === 'lab' ? `of ${site.booked}` : '',
			note: stateOf(site) === 'closed' ? openLine(site) : seenNote(h.seen),
			tone: 1,
			word: 'seen',
			trend: true,
		};
		const rooms = {
			icon: 'door-open',
			label: `${site.rooms.noun[0].toUpperCase()}${site.rooms.noun.slice(1)} in use`,
			series: h.rooms,
			unit: `of ${site.rooms.of}`,
			note: openLine(site),
			tone: 2,
			word: 'in use',
			trend: true,
		};
		if (site.kind === 'hospital')
			return [
				{ ...seen, note: '25 more before 6 am' },
				rooms,
				{
					icon: 'hourglass-split',
					label: 'ER waiting',
					series: h.waiting,
					note: `${site.postedWait} min to a provider, target ${site.target}`,
					tone: 6,
					word: 'waiting',
					trend: true,
					href: 'emergency-queue.html',
				},
				{
					icon: 'hospital',
					label: 'Beds free',
					series: h.beds,
					unit: `of ${site.beds.of}`,
					note: `${site.ors.used} of ${site.ors.of} ORs in use`,
					tone: 4,
					word: 'free',
					trend: true,
					href: 'wards-and-beds.html',
				},
			];
		if (site.kind === 'urgent')
			return [
				seen,
				rooms,
				{
					icon: 'hourglass-split',
					label: 'Posted wait',
					series: h.wait,
					unit: 'min',
					note: `target ${site.target} min, ${site.waiting} waiting`,
					tone: 6,
					word: 'min',
					trend: true,
				},
			];
		if (site.kind === 'lab')
			return [
				seen,
				rooms,
				{
					icon: 'droplet',
					label: 'Draw queue',
					series: h.queue,
					note: `about ${site.queueWait} min for a walk-in`,
					tone: 6,
					word: 'in queue',
					trend: true,
					href: 'lab-orders-and-results.html',
				},
			];
		return [
			seen,
			rooms,
			{
				icon: 'hourglass-split',
				label: 'Waiting room',
				series: h.waiting,
				note:
					site.accepting && site.next
						? `Next new patient ${site.next.day}`
						: site.accepting
							? 'Taking new members'
							: `Waitlist of ${site.waitlist}`,
				tone: 6,
				word: 'waiting',
				trend: true,
			},
		];
	}

	function hourName(i) {
		const hour = data.hours[i];
		const name = `${hour % 12 || 12} ${hour < 12 ? 'am' : 'pm'}`;
		return i === data.hours.length - 1 ? `${name} hour so far` : name;
	}

	function drawFigures() {
		const host = pick('[data-loc-tiles]');
		if (!host) return;
		const figures = figuresFor(siteById(state.site));
		if (PAGE === 'details' && figures.every((f) => !f.text) && window.Basalt.vitalsStrip) {
			drawStrip(host, siteById(state.site), figures);
			return;
		}
		host.classList.toggle('is-three', figures.length === 3);
		host.innerHTML = figures
			.map((f) => {
				const value = f.value ?? f.series.at(-1);
				const label = (i) =>
					f.labels
						? f.labels[i] + (i === f.series.length - 1 && !f.labels[i].includes('week') ? ' so far' : '')
						: hourName(i);
				const say = (v) => (f.format ? f.format(v) : `${v} ${f.word}`);
				const top = Math.max(...f.series) || 1;
				const bars = f.series
					.map(
						(v, i) =>
							`<span class="loc-fig-bar value-${Math.max(4, Math.round((v / top) * 100))}${i === f.series.length - 1 ? ' is-now' : ''}" data-loc-bar="${label(i)}: ${say(v)}"></span>`,
					)
					.join('');
				const [before, last] = f.series.slice(-2);
				const arrow =
					!f.trend || last === before
						? ''
						: `<i aria-hidden="true" class="bi bi-arrow-${last > before ? 'up' : 'down'}-right"></i>`;
				const figure = f.text
					? `<span>${f.text}</span>`
					: `<span data-loc-figure="${value}">${value}</span>${f.unit ? `<small>${f.unit}</small>` : ''}`;
				return `<article class="card basalt-box loc-fig tone-series-${f.tone}">
					<span class="loc-fig-head"><i aria-hidden="true" class="bi bi-${f.icon}"></i>${f.label}</span>
					<span class="loc-fig-value">${f.href ? `<a href="${f.href}" class="loc-fig-link">${figure}</a>` : figure}</span>
					<span class="loc-fig-note">${arrow}<span>${f.note}</span></span>
					<span class="loc-fig-bars" role="img" aria-label="${f.label}, ${f.labels ? 'by day' : 'by hour today'}">${bars}</span>
				</article>`;
			})
			.join('');
		for (const bar of pickAll('[data-loc-bar]', host)) {
			const note = pick('.loc-fig-note', bar.closest('.loc-fig'));
			const resting = note.innerHTML;
			bar.addEventListener('pointerenter', () => {
				note.textContent = bar.dataset.locBar;
			});
			bar.addEventListener('pointerleave', () => {
				note.innerHTML = resting;
			});
		}
		if (root.classList.contains('loc-settled')) countFigures();
	}

	/** One site's readings on the vitals strip, the clinic monitor-style
	 * header: each figure large, its hours as the pulse along the foot. */
	function drawStrip(host, site, figures) {
		const reading = (f) => {
			const value = f.value ?? f.series.at(-1);
			const of = /^of (\d+)/.exec(f.unit || '');
			const tone = `series-${f.tone}`;
			const label = f.label.charAt(0).toLowerCase() + f.label.slice(1);
			return `<div data-vstrip-read data-value="${value}"${of ? ` data-of="${of[1]}"` : f.unit ? ` data-unit="${f.unit}"` : ''} data-label="${label}" data-tone="${tone}"></div>`;
		};
		const beat = figures[0].series;
		host.classList.remove('is-three');
		host.classList.add('is-strip');
		host.innerHTML = `<section data-hc-vstrip data-beat="${beat.join(',')}" data-beat-from="${data.hours[0]}" data-beat-to="19" data-beat-step="1" data-beat-now="${data.hours.at(-1) + 0.33}" aria-label="${site.name} right now" class="hc-vstrip">
			<p class="hc-vstrip-title">${site.short} right now, ${stripTime(data.now)}</p>
			<dl class="hc-vstrip-reads">${figures.map(reading).join('')}</dl>
		</section>`;
		window.Basalt.vitalsStrip(pick('[data-hc-vstrip]', host));
	}

	/** Minutes after midnight as a 24-hour clock: 680 is 11:20. */
	function stripTime(minutes) {
		return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
	}

	function countFigures() {
		for (const el of pickAll('[data-loc-figure]')) {
			const target = Number(el.dataset.locFigure);
			if (still.matches || !target) {
				el.textContent = target;
				continue;
			}
			const began = performance.now();
			const step = (now) => {
				const t = Math.min(1, (now - began) / 500);
				el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
				if (t < 1) requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		}
	}

	/* Locations: the owner's view of the network */

	/** Sites that are running (not still opening). */
	function running() {
		return data.sites.filter((s) => !s.opensOn);
	}

	const SCORE_SORTS = {
		problems: (s) => [s.attention && stateOf(s) === 'alert' ? 0 : 1, s.score.revenue[0] / s.score.revenue[1]],
		revenue: (s) => [s.score.revenue[0] / s.score.revenue[1]],
		rating: (s) => [-(s.details.rating || 0)],
		name: (s) => [s.name],
	};

	function wireScorecard() {
		const select = pick('[data-loc-score-sort]');
		if (!select) return;
		select.addEventListener('change', () => {
			state.scoreSort = select.value;
			drawScorecard();
			placeVars(root);
		});
	}

	/** The scorecard: one row per running site, five plain answers. */
	function drawScorecard() {
		const body = pick('[data-loc-score]');
		if (!body) return;
		const key = SCORE_SORTS[state.scoreSort || 'problems'];
		const rows = running().sort((x, y) => {
			const a = key(x);
			const b = key(y);
			for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
			return x.name.localeCompare(y.name);
		});
		body.innerHTML = rows.map(scoreRow).join('');
		const ahead = rows.filter((s) => s.score.revenue[0] >= s.score.revenue[1]).length;
		pick('[data-loc-score-foot]').textContent =
			`${ahead} of ${rows.length} sites are at or above this month’s revenue target. A name opens the site.`;
	}

	function scoreRow(site) {
		const sc = site.score;
		const closed = stateOf(site) === 'closed';
		const [mtd, target] = sc.revenue;
		const part = mtd / target;
		/* The track is 125% of the target, so the target sits at 80%. */
		const fill = Math.min(100, (part / 1.25) * 100);
		const newText =
			sc.newIn === null
				? site.kind === 'office'
					? `Waitlist, ${site.waitlist}`
					: '—'
				: sc.newIn === 0
					? 'Walk in'
					: `${sc.newIn} days`;
		const rating = site.details.rating;
		const [inn, need] = sc.staff;
		return `<tr>
			<td><a href="${detailsHref(site)}" class="loc-name-link"><span class="loc-dot is-${stateOf(site)}"></span>${site.name}</a></td>
			<td class="loc-rev-cell">
				<span class="loc-rev" role="img" aria-label="${Math.round(part * 100)}% of target"><span class="loc-rev-fill${part < 0.95 ? ' is-under' : ''}" data-loc-vars="share:${fill.toFixed(1)}%"></span><span class="loc-rev-target"></span></span>
				<span class="loc-rev-text"><strong>${money(mtd * 1000)}</strong> of ${money(target * 1000)}</span>
			</td>
			<td class="hc-num${part < 0.95 ? ' is-over' : ''}">${Math.round(part * 100)}%</td>
			<td class="hc-num">${closed ? '<span class="loc-quiet">Closed</span>' : `${sc.booked}%`}</td>
			<td class="${sc.newIn === null && site.kind === 'office' ? 'is-over' : ''}">${newText}</td>
			<td class="hc-num${rating < 4.4 ? ' is-over' : ''}">${rating.toFixed(1)}</td>
			<td class="hc-num${inn < need ? ' is-over' : ''}">${closed ? '<span class="loc-quiet">Closed</span>' : `${inn} of ${need}`}</td>
		</tr>`;
	}

	/** Today's problems: each in plain words, site, cause and what it costs. */
	function drawProblems() {
		const host = pick('[data-loc-problems]');
		if (!host) return;
		const list = data.sites.filter((s) => s.attention && stateOf(s) === 'alert');
		const under = running().filter((s) => s.score.revenue[0] / s.score.revenue[1] < 0.95 && !list.includes(s));
		host.innerHTML =
			list.length || under.length
				? list
						.map(
							(s) =>
								`<li><span class="loc-dot is-alert"></span><p><a href="${detailsHref(s)}">${s.name}</a>: ${s.attention.text}</p>${actionButton(s) || (s.attention.href ? `<a href="${s.attention.href}" class="btn btn-outline-secondary btn-sm">${s.attention.act}</a>` : '')}</li>`,
						)
						.concat(
							under.map(
								(s) =>
									`<li><span class="loc-dot is-soon"></span><p><a href="${detailsHref(s)}">${s.name}</a>: revenue at ${Math.round((s.score.revenue[0] / s.score.revenue[1]) * 100)}% of this month’s target.</p></li>`,
							),
						)
						.join('')
				: '<li><span class="loc-dot is-open"></span><p>Nothing out of line right now.</p></li>';
	}

	/** Opening soon: the next site, its date and how ready it is. */
	function drawOpening() {
		const host = pick('[data-loc-opening]');
		if (!host) return;
		const site = data.sites.find((s) => s.opensOn && s.opening);
		host.closest('section').hidden = !site;
		if (!site) return;
		const o = site.opening;
		const bar = (label, value, of, text) =>
			`<li><span class="loc-ready-label">${label}</span><span class="loc-ready-track"><span class="loc-load-fill" data-loc-vars="share:${Math.min(100, (value / of) * 100).toFixed(1)}%"></span></span><span class="loc-ready-value">${text}</span></li>`;
		host.innerHTML = `<a href="${detailsHref(site)}" class="loc-opening-name">${site.name}</a>
			<p class="loc-opening-when">Opens ${o.date}</p>
			<p class="loc-meta">${site.address.split(',')[0]} · ${site.rooms.of} exam rooms</p>
			<ul class="loc-ready">
				${bar('Team hired', o.hired.at(-1), o.team, `${o.hired.at(-1)} of ${o.team}`)}
				${bar('Build-out', o.fitOut.at(-1), 100, `${o.fitOut.at(-1)}%`)}
				${bar('Members signed up', o.signedUp.at(-1), o.goal, `${o.signedUp.at(-1)} of ${o.goal}`)}
			</ul>`;
	}

	/* The list of sites */

	function listed() {
		const view = state.list;
		const sorts = {
			name: (s) => s.name,
			state: (s) => ['alert', 'soon', 'open', 'closed'].indexOf(stateOf(s)),
			busy: (s) => -share(s),
			open: (s) => -(today(s) ? today(s)[1] : -1),
		};
		const by = sorts[view.sort] || sorts.name;
		return data.sites
			.filter((s) => state.site === 'all' || s.id === state.site)
			.filter((s) => view.kind === 'all' || s.kind === view.kind)
			.filter(
				(s) =>
					!view.query ||
					window.Basalt.matchesQuery(
						`${s.name} ${s.area} ${s.city} ${kindName(s)} ${s.services.join(' ')} ${s.providers.map((p) => p.name).join(' ')} ${s.manager}`,
						view.query,
					),
			)
			.sort((x, y) => {
				const a = by(x);
				const b = by(y);
				return (a > b ? 1 : a < b ? -1 : x.name.localeCompare(y.name)) * (view.asc ? 1 : -1);
			});
	}

	function wireList() {
		root.addEventListener('input', (event) => {
			if (!event.target.closest('[data-loc-search]')) return;
			state.list.query = event.target.value;
			drawList();
			paintAvatars(root);
		});
		root.addEventListener('change', (event) => {
			if (!event.target.closest('[data-loc-kind]')) return;
			state.list.kind = event.target.value;
			drawList();
			paintAvatars(root);
		});
		root.addEventListener('click', (event) => {
			const head = event.target.closest('[data-loc-sort]');
			if (!head) return;
			const key = head.dataset.locSort;
			state.list.asc = state.list.sort === key ? !state.list.asc : true;
			state.list.sort = key;
			drawList();
			paintAvatars(root);
		});
	}

	function faces(site, size = 'xs', most = 3) {
		const people = site.providers.slice(0, most);
		if (!people.length) return '<span class="loc-quiet">Nobody today</span>';
		const total = site.onSite || site.providers.length;
		return `<span class="loc-faces">${people
			.map(
				(p) =>
					`<a href="${providerHref(p)}" class="loc-face" data-bs-toggle="tooltip" data-bs-title="${p.name}" aria-label="${p.name}">${avatar(p.name.replace(/^Dr\.? /, ''), size)}</a>`,
			)
			.join('')}</span><a href="provider-schedule.html" class="loc-faces-count">${total} on site</a>`;
	}

	function drawList() {
		const body = pick('[data-loc-rows]');
		const list = listed();
		const of = state.site === 'all' ? data.sites.length : 1;
		body.innerHTML = list.length
			? list.map(listRow).join('')
			: `<tr class="basalt-empty-row"><td colspan="6">${window.Basalt.emptyState({ query: state.list.query, noun: 'sites', title: state.list.query ? '' : 'No site of that kind here', text: state.list.query ? '' : 'Pick Every kind, or All locations in the top bar.', icon: 'geo-alt' })}</td></tr>`;
		pick('[data-loc-count="a"]').textContent = `${list.length} of ${of} ${of === 1 ? 'site' : 'sites'}`;
		for (const th of pickAll('[data-loc-sort]')) {
			const on = th.dataset.locSort === state.list.sort;
			if (on) th.setAttribute('aria-sort', state.list.asc ? 'ascending' : 'descending');
			else th.removeAttribute('aria-sort');
			pick('i', th).className =
				`bi ${on ? (state.list.asc ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up hc-sort-idle'}`;
		}
	}

	function listRow(site) {
		const load = loadOf(site);
		return `<tr class="${site.justAdded ? 'is-new' : ''}">
			<td><a href="${detailsHref(site)}" class="loc-name-link">${site.name}</a><span class="loc-meta">${kindName(site)} · ${site.area}</span></td>
			<td>${capsule(site)}</td>
			<td class="loc-hours-cell">${openLine(site)}</td>
			<td class="loc-load-cell ${load.over ? 'is-over' : ''}"><strong>${load.value}</strong> ${load.note}</td>
			<td class="loc-people-cell">${faces(site)}</td>
			<td class="loc-cell-link">${siteMenu(site)}</td>
		</tr>`;
	}

	/** The row's menu: the page, a quick view, edit, close or reopen. */
	function siteMenu(site) {
		const closedByUs = Boolean(site.closedToday);
		return `<div class="dropdown">
			<button data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="Actions for ${site.name}" type="button" class="btn btn-icon btn-sm"><i aria-hidden="true" class="bi bi-three-dots"></i></button>
			<ul class="dropdown-menu dropdown-menu-end">
				<li><a href="${detailsHref(site)}" class="dropdown-item"><i aria-hidden="true" class="bi bi-arrow-up-right"></i>Open site page</a></li>
				<li><button data-loc-open="${site.id}" type="button" class="dropdown-item"><i aria-hidden="true" class="bi bi-layout-sidebar-reverse"></i>Quick view</button></li>
				<li><button data-loc-edit="${site.id}" type="button" class="dropdown-item"><i aria-hidden="true" class="bi bi-pencil"></i>Edit location</button></li>
				${
					site.opensOn
						? ''
						: `<li><hr class="dropdown-divider" /></li>
				<li><button data-loc-close="${site.id}" type="button" class="dropdown-item"><i aria-hidden="true" class="bi bi-${closedByUs ? 'door-open' : 'pause-circle'}"></i>${closedByUs ? 'Reopen today' : 'Close temporarily'}</button></li>`
				}
			</ul>
		</div>`;
	}

	/* Location Details: one site in full */

	function drawDetails() {
		const site = siteById(state.site);
		const ld = (key) => pick(`[data-ld="${key}"]`);
		document.title = `${site.name} · Basalt`;
		ld('mark').textContent = site.short.replace(/[^A-Z]/g, '').slice(0, 2) || site.short.slice(0, 2).toUpperCase();
		ld('name').textContent = site.name;
		ld('sub').textContent =
			`${kindName(site)} · ${site.area}, ${site.city} · ${site.managerRole || 'Practice manager'} ${site.manager}`;
		/* The hours are in the facts row below, so the chips skip them. */
		ld('chips').innerHTML =
			`${capsule(site)}${site.kind === 'office' ? `<span class="loc-chip">${site.accepting ? 'Taking new members' : `Waitlist of ${site.waitlist}`}</span>` : ''}`;
		const primary = ld('primary');
		[primary.href, primary.textContent] =
			site.kind === 'hospital'
				? ['wards-and-beds.html', 'Wards & beds']
				: site.kind === 'lab'
					? ['lab-orders-and-results.html', 'Lab orders']
					: ['appointments.html', 'Appointments'];
		pick('[data-loc-edit]').dataset.locEdit = site.id;
		ld('menu').innerHTML = `
			<li><button data-loc-open="${site.id}" type="button" class="dropdown-item"><i aria-hidden="true" class="bi bi-layout-sidebar-reverse"></i>Quick view</button></li>
			<li><a href="provider-schedule.html" class="dropdown-item"><i aria-hidden="true" class="bi bi-calendar-week"></i>Provider schedule</a></li>
			<li><a href="tel:${site.phone.replace(/[^0-9]/g, '')}" class="dropdown-item"><i aria-hidden="true" class="bi bi-telephone"></i>Call ${site.phone}</a></li>
			<li><hr class="dropdown-divider" /></li>
			<li><button data-loc-close="${site.id}" type="button" class="dropdown-item"><i aria-hidden="true" class="bi bi-${site.closedToday ? 'door-open' : 'pause-circle'}"></i>${site.closedToday ? 'Reopen today' : 'Close temporarily'}</button></li>`;
		const d = site.details;
		const facts = [
			['Today', openLine(site)],
			[
				`${site.rooms.noun[0].toUpperCase()}${site.rooms.noun.slice(1)}`,
				`${site.rooms.used} of ${site.rooms.of} in use`,
			],
			site.opening
				? ['Team', `${site.opening.hired.at(-1)} of ${site.opening.team} hired`]
				: ['On site', site.onSite ? `${site.onSite} physicians` : `${site.providers.length} providers`],
			['Phone', site.phone],
			['Rating', d.reviewCount ? `${d.rating} from ${d.reviewCount}` : 'No reviews yet'],
		];
		ld('facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
		const attention = ld('attention');
		attention.hidden = !(site.attention && stateOf(site) === 'alert') && !site.closedToday;
		attention.innerHTML = site.closedToday
			? `<span class="loc-dot is-closed"></span><span>${site.closedToday}</span>`
			: site.attention
				? `<span class="loc-dot is-alert"></span><span><strong>${site.attention.why}:</strong> ${site.attention.text}</span>${actionButton(site)}${site.attention.href ? `<a href="${site.attention.href}" class="btn btn-outline-secondary btn-sm">${site.attention.act}</a>` : ''}`
				: '';

		/* Visits and revenue: a column per week, the latest solid. */
		const visits = d.visits;
		if (visits.every((v) => v === 0)) {
			ld('visits-head').innerHTML = '';
			ld('visits-sub').textContent = 'Starts with the first week open.';
			ld('weeks').innerHTML =
				`<p class="loc-quiet">${site.name} opens ${site.opening ? site.opening.date : site.opensOn}. Visits and revenue show here from its first week.</p>`;
			ld('weeks-note').textContent = '';
		} else {
			const total = visits.reduce((a, b) => a + b, 0);
			const top = Math.max(...visits) || 1;
			const weekEnds = visits.map((_, i) => {
				const end = new Date(2026, 9, 9 - (visits.length - 1 - i) * 7);
				return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			});
			ld('visits-head').innerHTML =
				`<div><dt>Visits</dt><dd>${total.toLocaleString('en-US')}</dd></div><div><dt>Revenue</dt><dd>${money(total * d.fee)}</dd></div>`;
			ld('visits-sub').textContent = `The last 12 weeks, about $${d.fee.toLocaleString('en-US')} a visit.`;
			ld('weeks').setAttribute('aria-label', `Visits per week, ${weekEnds[0]} to ${weekEnds.at(-1)}`);
			/* One line of weekly visits on a scale fitted to its own range, so the
			   trend reads; a soft flat fill under it, the latest week marked, and
			   a column per week to point at. */
			const W = 600;
			const H = 150;
			const low = Math.min(...visits);
			const pad = (top - low) * 0.35 || top * 0.1;
			const y = (v) => 10 + (1 - (v - (low - pad)) / (top + pad - (low - pad))) * (H - 20);
			const x = (i) => (i / (visits.length - 1)) * W;
			const line = visits.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
			ld('weeks').innerHTML =
				`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" class="loc-trend">
					<polygon points="0,${H} ${line} ${W},${H}" class="loc-trend-area" />
					<polyline points="${line}" vector-effect="non-scaling-stroke" class="loc-trend-line" />
				</svg>
				<span class="loc-trend-now" style="--y: ${(y(visits.at(-1)) / H).toFixed(3)}"></span>
				<div class="loc-trend-hits">${visits
					.map(
						(v, i) =>
							`<span class="loc-week-col" data-loc-week="Week to ${weekEnds[i]}: ${v.toLocaleString('en-US')} visits, ${money(v * d.fee)}"><span class="loc-week-label">${i % 3 === 2 || i === visits.length - 1 ? weekEnds[i] : ''}</span></span>`,
					)
					.join('')}</div>`;
			const note = ld('weeks-note');
			const change = Math.round(
				(visits.slice(-4).reduce((a, b) => a + b, 0) / visits.slice(0, 4).reduce((a, b) => a + b, 0) - 1) * 100,
			);
			const resting = `The last four weeks ran ${Math.abs(change)}% ${change >= 0 ? 'above' : 'below'} the first four.`;
			note.textContent = resting;
			/* Pointing at a week puts its numbers in the card's big figures
			   and marks it on the line; leaving brings the twelve weeks back. */
			const head = ld('visits-head');
			const totals = head.innerHTML;
			const at = document.createElement('span');
			at.className = 'loc-trend-at';
			at.hidden = true;
			ld('weeks').append(at);
			pickAll('[data-loc-week]', ld('weeks')).forEach((col, i) => {
				col.addEventListener('pointerenter', () => {
					head.innerHTML = `<div><dt>Week to ${weekEnds[i]}</dt><dd>${visits[i].toLocaleString('en-US')} <small>visits</small></dd></div><div><dt>Revenue</dt><dd>${money(visits[i] * d.fee)}</dd></div>`;
					at.style.setProperty('--x', (x(i) / W).toFixed(4));
					at.style.setProperty('--y', (y(visits[i]) / H).toFixed(4));
					at.hidden = false;
				});
				col.addEventListener('pointerleave', () => {
					head.innerHTML = totals;
					at.hidden = true;
				});
			});
		}

		/* Hours and contact */
		ld('hours-sub').textContent = openLine(site);
		ld('hours').innerHTML = `<ul class="loc-week">${site.week
			.map(
				(span, i) =>
					`<li class="${i === data.today ? 'is-today' : ''}"><span>${DAYS[i]}</span><span>${i === data.today && site.closedToday ? 'Closed today' : hoursText(span)}</span></li>`,
			)
			.join('')}</ul>
			<h3 class="loc-part-title mt-4">Contact</h3>
			<p class="loc-line">${site.address}</p>
			<p class="loc-line">${site.phone}</p>`;

		/* Who works here */
		const everyone = site.providers
			.map((p) => ({ ...p, on: true }))
			.concat(site.out.map((p) => ({ ...p, on: false })));
		ld('people-sub').textContent = site.onSite
			? `${site.onSite} physicians on site today; the attendings and leads below.`
			: `${site.providers.length} on site today${site.out.length ? `, ${site.out.length} out` : ''}.`;
		/* Five people on one line each, the rest behind Show all. */
		const SHOWN = 5;
		ld('people').innerHTML = everyone.length
			? everyone
					.map(
						(p, i) => `<tr${i >= SHOWN ? ' data-loc-more hidden' : ''}>
						<td><a href="${providerHref(p)}" class="hc-person-link">${avatar(p.name.replace(/^Dr\.? /, ''), 'xs')}<span>${p.name}</span></a> <span class="loc-meta">${p.role}</span></td>
						<td>${p.on ? '<span class="loc-state is-open"><span class="loc-dot"></span>On site</span>' : `<span class="loc-state is-closed"><span class="loc-dot"></span>${p.why ? 'Out sick' : site.opensOn ? `Starts ${site.opensOn}` : 'Off today'}</span>`}</td>
						<td><span class="loc-days">${DAYS.slice(0, 5)
							.map(
								(day, i) =>
									`<span class="${p.days.includes(i) ? 'is-on' : ''}">${day.slice(0, 2)}</span>`,
							)
							.join('')}</span></td>
					</tr>`,
					)
					.join('')
			: `<tr class="basalt-empty-row"><td colspan="3">${window.Basalt.emptyState({ title: 'Nobody yet', text: 'Add providers when the site is staffed.', icon: 'people' })}</td></tr>`;

		const more = ld('people-more');
		if (more) {
			more.hidden = everyone.length <= SHOWN;
			more.textContent = `Show all ${everyone.length}`;
			more.onclick = () => {
				const open = more.dataset.open !== 'true';
				more.dataset.open = open;
				for (const row of pickAll('[data-loc-more]', ld('people'))) row.hidden = !open;
				more.textContent = open ? 'Show fewer' : `Show all ${everyone.length}`;
			};
		}

		/* Services and rooms */
		ld('offer-sub').textContent = `${site.services.length} services`;
		const icon = (s) => SERVICE_ICONS[s] || 'plus-circle';
		const roomCells = (used, of, noun) =>
			`<p class="loc-rooms-name">${noun}</p>${
				/* One square each while they are few; past 40, one bar. */
				of > 40
					? `<p class="loc-rooms-bar" role="img" aria-label="${used} of ${of} ${noun.toLowerCase()} in use"><span class="value-${Math.round((used / of) * 100)}"></span></p><p class="loc-rooms-count">${used} of ${of} in use</p>`
					: `<p class="loc-rooms" role="img" aria-label="${used} of ${of} ${noun.toLowerCase()} in use">${Array.from({ length: of }, (_, i) => `<span class="${i < used ? 'is-used' : ''}"></span>`).join('')}<b class="loc-rooms-count">${used} of ${of} in use</b></p>`
			}`;
		ld('offer').innerHTML = `<ul class="loc-services">${site.services
			.map(
				(s, i) =>
					`<li class="tone-series-${(i % 8) + 1}"><span class="loc-service-icon"><i aria-hidden="true" class="bi bi-${icon(s)}"></i></span>${s}</li>`,
			)
			.join('')}</ul>
			<h3 class="loc-part-title mt-4">Rooms</h3>
			${roomCells(site.rooms.used, site.rooms.of, `${site.rooms.noun[0].toUpperCase()}${site.rooms.noun.slice(1)}`)}
			${site.beds ? roomCells(site.beds.of - site.beds.free, site.beds.of, 'Ward beds') + roomCells(site.ors.used, site.ors.of, 'Operating rooms') : ''}
			${site.scanners ? roomCells(site.scanners.used, site.scanners.of, 'Scanners') : ''}`;

		/* Members whose home office it is */
		if (d.members) {
			const count = d.members.reduce((a, [, n]) => a + n, 0);
			ld('members-sub').textContent = site.opensOn
				? `${count.toLocaleString('en-US')} signed up ahead of opening.`
				: `${count.toLocaleString('en-US')} call this their home office.`;
			const most = Math.max(...d.members.map(([, n]) => n));
			ld('members').innerHTML = `<ul class="loc-plan-list">${d.members
				.map(
					([plan, n]) =>
						`<li><span class="loc-plan-name">${plan}</span><span class="loc-plan-track"><span class="loc-load-fill" data-loc-vars="share:${((n / most) * 100).toFixed(1)}%"></span></span><span class="loc-plan-n">${n.toLocaleString('en-US')}</span></li>`,
				)
				.join('')}</ul>
				<dl class="loc-member-moves">
					<div><dt>Joined in October</dt><dd>+${Math.round(count * 0.012)}</dd></div>
					<div><dt>Renew in 30 days</dt><dd>${Math.round(count * 0.045)}</dd></div>
					<div><dt>Left in October</dt><dd>${Math.round(count * 0.004)}</dd></div>
				</dl>
				<a href="subscriptions.html" class="loc-more-link">All memberships</a>`;
		} else {
			ld('members-sub').textContent = 'Not a home office.';
			ld('members').innerHTML =
				`<p class="loc-quiet">Members are seen here by walk-in or referral; their home office is one of the four offices.</p><a href="subscriptions.html" class="loc-more-link">All memberships</a>`;
		}

		/* Reviews */
		ld('reviews-sub').textContent = d.reviewCount
			? `${d.rating} out of 5 from ${d.reviewCount} reviews.`
			: 'No reviews yet.';
		ld('reviews').innerHTML = d.reviews.length
			? `<ul class="loc-reviews">${d.reviews
					.map(
						([who, stars, text, about]) =>
							`<li><p class="loc-review-stars" role="img" aria-label="${stars} out of 5">${'<i aria-hidden="true" class="bi bi-star-fill"></i>'.repeat(stars)}${'<i aria-hidden="true" class="bi bi-star"></i>'.repeat(5 - stars)}</p><p class="loc-review-text">“${text}”</p><p class="loc-meta">${who} · about ${about}</p></li>`,
					)
					.join('')}</ul><a href="reviews.html" class="loc-more-link">All reviews</a>`
			: '<p class="loc-quiet">Reviews show here after the first visits.</p><a href="reviews.html" class="loc-more-link">All reviews</a>';

		/* Approvals and supplies */
		const paper = [
			...site.auths.slice(0, 2).map(([who, what, payer, status]) => ({
				icon: 'shield-check',
				what,
				meta: `${who} · ${payer}`,
				status,
				over: /Denied|More info/.test(status),
				href: 'approvals.html',
			})),
			...site.supplies.slice(0, 1).map(([item, left, rule]) => ({
				icon: 'box-seam',
				what: item,
				meta: rule,
				status: left,
				over: true,
				href: 'stock-levels.html',
			})),
		];
		ld('paper').innerHTML = paper.length
			? `<ul class="loc-paper">${paper
					.map(
						(p) =>
							`<li><span class="loc-paper-icon"><i aria-hidden="true" class="bi bi-${p.icon}"></i></span><span><a href="${p.href}" class="loc-paper-what">${p.what}</a><span class="loc-meta">${p.meta}</span></span><span class="loc-paper-status${p.over ? ' is-over' : ''}">${p.status}</span></li>`,
					)
					.join('')}</ul><a href="approvals.html" class="loc-more-link">All approvals</a>`
			: '<p class="loc-quiet">Nothing waiting, nothing low.</p><a href="approvals.html" class="loc-more-link">All approvals</a>';
	}

	/* The quick view */

	function wirePeek() {
		document.addEventListener('click', (event) => {
			const open = event.target.closest('[data-loc-open]');
			if (!open) return;
			const peek = document.querySelector('[data-loc-peek]');
			if (!peek || !window.bootstrap) return;
			fillPeek(peek, siteById(open.dataset.locOpen));
			window.bootstrap.Offcanvas.getOrCreateInstance(peek).show();
		});
	}

	function fillPeek(peek, site) {
		peek.dataset.site = site.id;
		pick('[data-loc-peek-title]', peek).textContent = site.name;
		const st = stateOf(site);
		const load = loadOf(site);
		pick('[data-loc-peek-body]', peek).innerHTML = `<article class="loc-detail">
			<p class="loc-site-kind">${kindName(site)} · ${site.area}</p>
			<p class="loc-site-open">${capsule(site)}<span>${openLine(site)}</span></p>
			${site.closedToday ? `<p class="loc-quiet mt-2">${site.closedToday}</p>` : ''}
			${site.attention && st === 'alert' ? `<p class="loc-attention"><span class="loc-dot is-alert"></span><span>${cap(site.attention.text)}</span>${actionButton(site)}</p>` : ''}
			<dl class="loc-facts"><div><dt>Right now</dt><dd class="${load.over ? 'is-over' : ''}">${load.value} ${load.note}</dd></div><div><dt>In use</dt><dd>${site.rooms.used} of ${site.rooms.of}</dd></div></dl>
			<section class="loc-detail-part"><h3 class="loc-part-title">On site today</h3>${
				site.providers.length
					? `<ul class="loc-people">${site.providers
							.slice(0, 6)
							.map(
								(p) =>
									`<li><a href="${providerHref(p)}" class="hc-person-link">${avatar(p.name.replace(/^Dr\.? /, ''), 'xs')}<span>${p.name}</span></a><span class="loc-role">${p.role}</span></li>`,
							)
							.join('')}</ul>`
					: '<p class="loc-quiet">Nobody today.</p>'
			}</section>
			<section class="loc-detail-part"><h3 class="loc-part-title">Today’s hours</h3><p class="loc-line">${hoursText(site.week[data.today])}</p></section>
			<div class="loc-detail-actions">
				<a href="${detailsHref(site)}" class="btn btn-primary btn-sm">Open site page</a>
				<button type="button" data-loc-edit="${site.id}" class="btn btn-outline-secondary btn-sm">Edit location</button>
			</div>
		</article>`;
		paintAvatars(peek);
	}

	/* Fixes for a site with a problem, and the temporary close */

	function actionButton(site) {
		const a = site.attention;
		if (!a || a.href || stateOf(site) !== 'alert') return '';
		if (state.acted.has(site.id)) return `<span class="hc-pill hc-pill-ok">${a.done}</span>`;
		return `<button type="button" data-loc-act="${site.id}" class="btn btn-outline-secondary btn-sm">${a.act}</button>`;
	}

	function wireActs() {
		document.addEventListener('click', (event) => {
			const act = event.target.closest('[data-loc-act]');
			if (act) {
				const site = siteById(act.dataset.locAct);
				const holder = act.closest('[data-loc-peek], [data-loc-root]');
				state.acted.add(site.id);
				rerender();
				const pill = holder && holder.querySelector('.hc-pill-ok');
				if (pill) {
					pill.setAttribute('tabindex', '-1');
					pill.focus();
				}
				toast('success', site.attention.done, site.attention.toast, () => {
					state.acted.delete(site.id);
					rerender();
				});
			}
			const close = event.target.closest('[data-loc-close]');
			if (close) {
				const site = siteById(close.dataset.locClose);
				const before = snapshot(site);
				site.closedToday = site.closedToday
					? undefined
					: 'Closed temporarily. Calls and booking go to the nearest open site.';
				if (!site.closedToday) delete site.closedToday;
				rerender();
				toast(
					'success',
					site.closedToday ? `${site.short} closed for today` : `${site.short} reopened`,
					site.closedToday ? 'Online booking points patients to the nearest open site.' : openLine(site),
					() => {
						restore(site, before);
						rerender();
					},
				);
			}
		});
	}

	function rerender() {
		refresh();
		const peek = document.querySelector('[data-loc-peek]');
		if (peek && peek.classList.contains('show') && peek.dataset.site) fillPeek(peek, siteById(peek.dataset.site));
	}

	function snapshot(site) {
		return JSON.parse(JSON.stringify(site));
	}

	function restore(site, copy) {
		for (const key of Object.keys(site)) if (!(key in copy)) delete site[key];
		Object.assign(site, copy);
	}

	/* Hours rows, shared by the edit and add dialogs */

	function weekRows(week, prefix) {
		return week
			.map(
				(span, i) => `<div class="loc-week-row" data-loc-day="${i}">
				<span class="loc-week-day">${DAYS[i]}</span>
				<label class="visually-hidden" for="${prefix}-from-${i}">${DAYS[i]} opens</label>
				<input id="${prefix}-from-${i}" data-loc-from type="time" value="${toTime(span ? span[0] : 480)}" class="form-control form-control-sm"${span ? '' : ' disabled'} />
				<label class="visually-hidden" for="${prefix}-to-${i}">${DAYS[i]} closes</label>
				<input id="${prefix}-to-${i}" data-loc-to type="time" value="${toTime(span ? Math.min(span[1], 1439) : 1020)}" class="form-control form-control-sm"${span ? '' : ' disabled'} />
				<div class="form-check"><input id="${prefix}-shut-${i}" data-loc-shut type="checkbox" class="form-check-input"${span ? '' : ' checked'} /><label for="${prefix}-shut-${i}" class="form-check-label">Closed</label></div>
			</div>`,
			)
			.join('');
	}

	function readWeek(host) {
		return pickAll('[data-loc-day]', host).map((row) => {
			if (pick('[data-loc-shut]', row).checked) return null;
			const from = fromTime(pick('[data-loc-from]', row).value);
			let to = fromTime(pick('[data-loc-to]', row).value);
			if (to === 1439) to = 1440;
			return to > from ? [from, to] : null;
		});
	}

	function holidayRows(holidays) {
		return holidays
			.map(
				(h, i) => `<div class="loc-week-row" data-loc-holiday="${i}">
				<span class="loc-week-day loc-week-day-wide">${h.date}<span class="loc-meta">${h.name}</span></span>
				<label class="visually-hidden" for="loc-h-from-${i}">${h.name} opens</label>
				<input id="loc-h-from-${i}" data-loc-from type="time" value="${toTime(h.hours ? h.hours[0] : 540)}" class="form-control form-control-sm"${h.hours ? '' : ' disabled'} />
				<label class="visually-hidden" for="loc-h-to-${i}">${h.name} closes</label>
				<input id="loc-h-to-${i}" data-loc-to type="time" value="${toTime(h.hours ? h.hours[1] : 780)}" class="form-control form-control-sm"${h.hours ? '' : ' disabled'} />
				<div class="form-check"><input id="loc-h-shut-${i}" data-loc-shut type="checkbox" class="form-check-input"${h.hours ? '' : ' checked'} /><label for="loc-h-shut-${i}" class="form-check-label">Closed</label></div>
			</div>`,
			)
			.join('');
	}

	function allServices() {
		return [...new Set(data.sites.flatMap((s) => s.services))].sort();
	}

	function servicePicks(chosen, prefix) {
		const list = [...new Set([...allServices(), ...chosen])];
		return list
			.map(
				(name, i) =>
					`<input id="${prefix}-${i}" type="checkbox" value="${name}" class="btn-check"${chosen.includes(name) ? ' checked' : ''} /><label for="${prefix}-${i}" class="hc-list-chip">${name}</label>`,
			)
			.join('');
	}

	function wireShutBoxes(scope) {
		scope.addEventListener('change', (event) => {
			const box = event.target.closest('[data-loc-shut]');
			if (!box) return;
			for (const input of pickAll('input[type="time"]', box.closest('.loc-week-row')))
				input.disabled = box.checked;
		});
	}

	/* Edit location: hours and holidays, services, rooms and members, a temporary close */

	function wireEdit() {
		const form = document.querySelector('[data-loc-edit-form]');
		if (!form) return;
		const modal = form.closest('.modal');
		wireShutBoxes(form);
		let site = null;
		document.addEventListener('click', (event) => {
			const button = event.target.closest('[data-loc-edit]');
			if (!button || !window.bootstrap) return;
			site = siteById(button.dataset.locEdit || (state.site !== 'all' ? state.site : data.sites[0].id));
			pick('[data-loc-edit-title]', form).textContent = `Edit ${site.name}`;
			pick('[data-loc-e-week]', form).innerHTML = weekRows(site.week, 'loc-e');
			pick('[data-loc-e-holidays]', form).innerHTML = holidayRows(site.holidays);
			pick('[data-loc-e-services]', form).innerHTML = servicePicks(site.services, 'loc-e-s');
			pick('[data-loc-e-rooms]', form).innerHTML = [
				['rooms', `${site.rooms.noun[0].toUpperCase()}${site.rooms.noun.slice(1)}`, site.rooms.of],
				...(site.beds ? [['beds', 'Ward beds', site.beds.of]] : []),
				...(site.scanners ? [['scanners', 'Scanners', site.scanners.of]] : []),
			]
				.map(
					([key, label, value]) =>
						`<div class="col-sm-4"><label for="loc-e-n-${key}" class="form-label">${label}</label><input id="loc-e-n-${key}" data-loc-e-count="${key}" type="number" min="1" max="400" value="${value}" class="form-control" /></div>`,
				)
				.join('');
			pick('[data-loc-e-accepting-wrap]', form).hidden = site.kind !== 'office';
			pick('[data-loc-e-accepting]', form).checked = Boolean(site.accepting);
			pick('[data-loc-e-closed]', form).checked = Boolean(site.closedToday);
			pick('[data-loc-e-reason]', form).value = site.closedToday || '';
			const peek = document.querySelector('[data-loc-peek]');
			if (peek && peek.classList.contains('show')) window.bootstrap.Offcanvas.getOrCreateInstance(peek).hide();
			window.bootstrap.Tab.getOrCreateInstance(pick('[data-bs-target="#loc-e-hours"]', form)).show();
			window.bootstrap.Modal.getOrCreateInstance(modal).show();
		});
		pick('[data-loc-e-add-service]', form).addEventListener('click', () => {
			const field = pick('[data-loc-e-new-service]', form);
			const name = field.value.trim();
			if (!name) return;
			const host = pick('[data-loc-e-services]', form);
			const i = pickAll('input', host).length;
			host.insertAdjacentHTML(
				'beforeend',
				`<input id="loc-e-s-${i}" type="checkbox" value="${name.replace(/"/g, '')}" class="btn-check" checked /><label for="loc-e-s-${i}" class="hc-list-chip">${name.replace(/</g, '&lt;')}</label>`,
			);
			field.value = '';
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const before = snapshot(site);
			site.week = readWeek(pick('[data-loc-e-week]', form));
			site.holidays = site.holidays.map((h, i) => {
				const row = pick(`[data-loc-holiday="${i}"]`, form);
				return {
					...h,
					hours: pick('[data-loc-shut]', row).checked
						? null
						: [fromTime(pick('[data-loc-from]', row).value), fromTime(pick('[data-loc-to]', row).value)],
				};
			});
			site.services = pickAll('[data-loc-e-services] input:checked', form).map((box) => box.value);
			for (const input of pickAll('[data-loc-e-count]', form)) {
				const n = Math.max(1, Number(input.value) || 1);
				const key = input.dataset.locECount;
				if (key === 'rooms') site.rooms.of = Math.max(n, site.rooms.used);
				if (key === 'beds') site.beds.of = n;
				if (key === 'scanners') site.scanners.of = n;
			}
			if (site.kind === 'office') site.accepting = pick('[data-loc-e-accepting]', form).checked;
			if (pick('[data-loc-e-closed]', form).checked)
				site.closedToday = pick('[data-loc-e-reason]', form).value.trim() || 'Closed temporarily.';
			else delete site.closedToday;
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			rerender();
			toast(
				'success',
				`${site.short} saved`,
				`${openLine(site)}. Patients see the change on the website and in booking.`,
				() => {
					restore(site, before);
					rerender();
				},
			);
		});
	}

	/* Add location, in four steps */

	function wireAdd() {
		const form = document.querySelector('[data-loc-add-form]');
		if (!form) return;
		const modal = form.closest('.modal');
		wireShutBoxes(form);
		let step = 1;
		const show = (n) => {
			step = n;
			for (const part of pickAll('[data-loc-step]', form)) part.hidden = Number(part.dataset.locStep) !== n;
			pickAll('[data-loc-steps] li', form).forEach((li, i) => {
				li.className = i + 1 < n ? 'is-done' : i + 1 === n ? 'is-now' : '';
			});
			pick('[data-loc-step-back]', form).hidden = n === 1;
			pick('[data-loc-step-next]', form).textContent = n === 4 ? 'Add location' : 'Next';
		};
		const reset = () => {
			form.reset();
			form.classList.remove('was-validated');
			pick('[data-loc-a-week]', form).innerHTML = weekRows(
				[[480, 1020], [480, 1020], [480, 1020], [480, 1020], [480, 1020], null, null],
				'loc-a',
			);
			pick('[data-loc-a-services]', form).innerHTML = servicePicks(
				['Primary care', 'Vaccines', 'Lab draws', 'Telehealth'],
				'loc-a-s',
			);
			show(1);
		};
		document.addEventListener('click', (event) => {
			if (!event.target.closest('[data-loc-add]') || !window.bootstrap) return;
			reset();
			window.bootstrap.Modal.getOrCreateInstance(modal).show();
		});
		pick('[data-loc-step-back]', form).addEventListener('click', () => show(step - 1));
		const field = (key) => pick(`[data-loc-a="${key}"]`, form);
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const part = pick(`[data-loc-step="${step}"]`, form);
			const missing = pickAll('[required]', part).filter((input) => !input.value.trim());
			form.classList.toggle('was-validated', missing.length > 0);
			if (missing.length) {
				missing[0].focus();
				return;
			}
			form.classList.remove('was-validated');
			if (step < 4) {
				show(step + 1);
				return;
			}
			const name = field('name').value.trim();
			const kind = field('kind').value;
			const id = `${name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')}-${data.sites.length}`;
			const opens = field('opens').value
				? new Date(`${field('opens').value}T12:00`).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
					})
				: 'soon';
			const providers = field('staff')
				.value.split('\n')
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => {
					const [who, role] = line.split(',').map((x) => x.trim());
					return { name: who, role: role || 'Provider', days: [0, 1, 2, 3, 4] };
				});
			const rooms = Math.max(1, Number(field('rooms').value) || 1);
			const zeros = [0, 0, 0, 0, 0, 0];
			const site = {
				id,
				name,
				short: name.replace(/ (Office|Clinic)$/, ''),
				kind,
				area: field('area').value.trim() || field('city').value,
				city: field('city').value,
				address: `${field('street').value.trim()}, ${field('city').value}, CA`,
				phone: field('phone').value.trim() || '(415) 555-0190',
				week: readWeek(pick('[data-loc-a-week]', form)),
				opensOn: opens,
				providers: [],
				out: providers,
				rooms: {
					used: 0,
					of: rooms,
					noun: kind === 'lab' ? 'draw chairs' : kind === 'hospital' ? 'ER bays' : 'exam rooms',
				},
				booked: 0,
				seen: 0,
				waiting: 0,
				postedWait: 0,
				target: 30,
				queue: 0,
				queueWait: 0,
				next: null,
				waitlist: 0,
				accepting: field('accepting').checked,
				services: pickAll('[data-loc-a-services] input:checked', form).map((box) => box.value),
				manager: field('manager').value.trim(),
				page: 'appointments.html',
				byHour: { seen: zeros, rooms: zeros, waiting: zeros, wait: zeros, queue: zeros, beds: zeros },
				details: {
					visits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
					fee: 140,
					members: null,
					rating: 0,
					reviewCount: 0,
					reviews: [],
				},
				holidays: field('holidays').checked ? data.sites[0].holidays.map((h) => ({ ...h })) : [],
				auths: [],
				supplies: [],
				justAdded: true,
			};
			if (kind === 'hospital') Object.assign(site, { beds: { free: 0, of: 0 }, ors: { used: 0, of: 0 } });
			if (kind === 'lab') site.scanners = { used: 0, of: 0 };
			data.sites.push(site);
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			rerender();
			toast(
				'success',
				`${name} added`,
				`It shows as opening ${opens}. Open its page to add staff and rooms.`,
				() => {
					data.sites.splice(data.sites.indexOf(site), 1);
					if (state.site === site.id) state.site = 'all';
					rerender();
				},
			);
		});
	}

	function toTime(minutes) {
		return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
	}

	function fromTime(text) {
		const [hours, minutes] = String(text || '0:0')
			.split(':')
			.map(Number);
		return hours * 60 + minutes;
	}

	/* Small helpers */

	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	/** Values written as data-loc-vars="name:value;…" become the element's
	 * custom properties, so the markup carries no style attribute. */
	function placeVars(scope) {
		for (const el of scope.querySelectorAll('[data-loc-vars]')) {
			for (const pair of el.dataset.locVars.split(';')) {
				const at = pair.indexOf(':');
				el.style.setProperty(`--${pair.slice(0, at)}`, pair.slice(at + 1));
			}
			el.removeAttribute('data-loc-vars');
		}
	}

	function avatar(name, size) {
		return `<span data-basalt-avatar data-name="${name}" aria-hidden="true" class="basalt-avatar basalt-avatar-${size}"></span>`;
	}

	function paintAvatars(scope) {
		if (!scope || typeof window.Basalt.avatar !== 'function') return;
		for (const face of scope.querySelectorAll('[data-basalt-avatar]')) window.Basalt.avatar(face);
		if (window.Basalt.tips) window.Basalt.tips(scope);
	}

	/** A toast; with undo, it offers Undo for six seconds. */
	function toast(tone, title, text, undo) {
		if (!window.Basalt.toasts) return;
		const actions = undo ? [{ label: 'Undo', onClick: undo }] : undefined;
		window.Basalt.toasts.push({ tone, title, text, duration: undo ? 6000 : 4500, actions });
	}

	start();
})();
