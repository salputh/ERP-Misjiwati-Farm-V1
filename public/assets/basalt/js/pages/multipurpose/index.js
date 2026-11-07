/**
 * Fieldline's home dashboard, index.html, inside [data-db-root].
 *
 * It greets the visitor for the time of day, runs the swiping headline
 * panel with its column steps, draws the active-users line and the two
 * revenue charts from SAMPLE, lets today's tasks be ticked off, and totals
 * the overdue invoices from the shared billing data. AI suggestions are
 * worked out from the same figures, and Add to today puts one on the
 * task list. The task and trial lists are plain markup in index.html and
 * are edited there.
 *
 * Charts take their colors from the --basalt-* tokens at the moment they
 * are built, wait until they are about to scroll into view, and are built
 * again after basalt:appearance. Avatars, toasts and the tokens come from
 * basalt.js and appearance.js.
 */
(() => {
	'use strict';

	const dashboard = pick('[data-db-root]', document);
	if (!dashboard) return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/* Sample figures; put your own here, or fetch them and draw again.
     startsAt is the first of twelve closed months, as [year, month from 0]:
     October 2025, so the twelfth is September 2026. Money is in thousands
     of dollars. recurring starts one month early (September 2025) and ends
     at $880k, which the plans add up to; each month it moves by gained
     minus churned. activeUsers is in thousands, newAccounts counts paying
     sign-ups, and a plan's hue is its chart series number. */
	const SAMPLE = {
		startsAt: [2025, 9],
		recurring: [655, 672, 688, 699, 718, 736, 755, 771, 792, 813, 836, 859, 880],
		gained: [21, 20, 16, 23, 22, 23, 19, 25, 25, 26, 29, 27],
		churned: [4, 4, 5, 4, 4, 4, 3, 4, 4, 3, 6, 6],
		activeUsers: [38.4, 39.1, 39.0, 40.6, 41.3, 42.0, 42.9, 43.8, 44.6, 45.9, 46.8, 48.2],
		newAccounts: [71, 78, 64, 88, 86, 90, 83, 81, 85, 72, 84, 96],
		plans: [
			{ label: 'Basic', hue: 7, recurring: 158, accounts: 1190 },
			{ label: 'Pro', hue: 1, recurring: 361, accounts: 790 },
			{ label: 'Max', hue: 2, recurring: 361, accounts: 160 },
		],
	};

	/* How late an invoice is, in days, decides its band; the last band has
     no ceiling. */
	const LATENESS = [
		{ key: 'soon', label: '1–7 days', upTo: 7 },
		{ key: 'late', label: '8–21 days', upTo: 21 },
		{ key: 'over', label: '22+ days', upTo: Infinity },
	];

	/* The color notations the tokens can come back in, each with the way
     to read its red, green and blue. */
	const COLOR_FORMS = [
		[/^#([0-9a-f]{3})$/i, (digits) => digits.split('').map((digit) => parseInt(digit + digit, 16))],
		[
			/^#([0-9a-f]{6})$/i,
			(digits) => {
				const packed = parseInt(digits, 16);
				return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
			},
		],
		[
			/^rgba?\(([^)]+)\)$/i,
			(inner) =>
				inner
					.split(',')
					.slice(0, 3)
					.map((part) => parseFloat(part)),
		],
		[
			/^color\(srgb ([^)]+)\)$/i,
			(inner) =>
				inner
					.split(/\s+/)
					.slice(0, 3)
					.map((part) => Math.round(parseFloat(part) * 255)),
		],
	];

	/* A canvas names its recipe in data-db-chart. */
	const RECIPES = {
		spark: usersLine,
		flow: wonAndLost,
		plans: planRing,
	};

	const MONTH_TITLES = SAMPLE.gained.map((_, index) => monthLong(index));
	const arrears = tallyOverdue();
	const liveCharts = new Map();
	const drawnOnce = new Set();

	function start() {
		greetByClock();
		wireHero();
		pick('.db-ring-chart')?.addEventListener('mouseleave', () => ringCenter());
		watchCharts();
		wireTasks();
		showOverdue();
		wireIdeas();
	}

	function pick(selector, scope = dashboard) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = dashboard) {
		return [...scope.querySelectorAll(selector)];
	}

	/* The heading says "Good morning"; this swaps in the visitor's own
     part of the day. */
	function greetByClock() {
		const heading = pick('[data-db-greeting]');
		if (!heading) return;
		const hour = new Date().getHours();
		let partOfDay = 'evening';
		if (hour < 12) partOfDay = 'morning';
		else if (hour < 18) partOfDay = 'afternoon';
		heading.textContent = heading.textContent.trim().replace(/morning|afternoon|evening/, partOfDay);
	}

	/* Customer names go into markup, so they are escaped first. */
	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
	}

	/* Month names and money, written the way the cards print them. */

	function monthAt(index) {
		const [year, month] = SAMPLE.startsAt;
		return new Date(year, month + index, 1);
	}

	function monthShort(index) {
		return monthAt(index).toLocaleString('en-US', { month: 'short' });
	}

	function monthLong(index) {
		return monthAt(index).toLocaleString('en-US', { month: 'long', year: 'numeric' });
	}

	/** January, and the first month shown, carry their year on a second line. */
	function axisLabel(index) {
		const when = monthAt(index);
		if (index === 0 || when.getMonth() === 0) return [monthShort(index), String(when.getFullYear())];
		return monthShort(index);
	}

	function thousands(amount) {
		return `$${amount}k`;
	}

	function signedThousands(amount) {
		if (amount === 0) return '$0';
		return `${amount < 0 ? '−' : ''}${thousands(Math.abs(amount))}`;
	}

	function dollars(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function people(inThousands) {
		return (inThousands * 1000).toLocaleString('en-US');
	}

	/* Drawing: each chart is built the first time it comes near the
     viewport, and every chart already drawn is built again, without
     animation, when the theme changes. */

	function watchCharts() {
		const plots = pickAll('canvas[data-db-chart]');

		if ('IntersectionObserver' in window) {
			const lookout = new IntersectionObserver(
				(sightings) => {
					for (const sighting of sightings) {
						if (!sighting.isIntersecting) continue;
						lookout.unobserve(sighting.target);
						drawnOnce.add(sighting.target);
						drawChart(sighting.target, true);
					}
				},
				{ rootMargin: '80px 0px' },
			);
			for (const plot of plots) lookout.observe(plot);
		} else {
			for (const plot of plots) {
				drawnOnce.add(plot);
				drawChart(plot, false);
			}
		}

		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				for (const plot of drawnOnce) drawChart(plot, false);
			});
		});
	}

	function drawChart(plot, animate) {
		if (!window.Chart) return;
		const recipe = RECIPES[plot.getAttribute('data-db-chart')];
		if (!recipe) return;
		liveCharts.get(plot)?.destroy();
		liveCharts.set(plot, new window.Chart(plot, recipe(readInks(), animate && !calmMotion, plot)));
	}

	/* Colors are read from the theme every time a chart is built. */

	function tokenOr(name, fallback) {
		if (!window.Basalt.token) return fallback;
		return window.Basalt.token(name, fallback);
	}

	function readInks() {
		const ink = tokenOr('--basalt-copy', '#12233a');
		const mutedInk = tokenOr('--basalt-copy-muted', '#5f7186');
		return {
			ink,
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((position) => tokenOr(`--basalt-series-${position}`, '#2b6fd4')),
			soft: blend(mutedInk, ink, 0.82),
			rule: translucent(ink, 0.07),
			paper: tokenOr('--basalt-plane', '#ffffff'),
			edge: tokenOr('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	/** Red, green and blue of any token color; mid gray when it cannot be read. */
	function rgbOf(color) {
		const written = String(color || '').trim();
		for (const [pattern, read] of COLOR_FORMS) {
			const hit = pattern.exec(written);
			if (hit) return read(hit[1]);
		}
		return [128, 128, 128];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbOf(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** `share` of the first color, the rest of the second. */
	function blend(first, second, share) {
		const over = rgbOf(first);
		const under = rgbOf(second);
		const mixed = [0, 1, 2].map((i) => Math.round(over[i] * share + under[i] * (1 - share)));
		return `rgb(${mixed.join(', ')})`;
	}

	/* A fill that fades downward under a line; with gradients switched off it
	   is one plain tint. */
	function verticalWash(color, topAlpha, bottomAlpha) {
		return window.Basalt.chartFill(
			[
				[0, translucent(color, topAlpha)],
				[1, translucent(color, bottomAlpha)],
			],
			{ flat: translucent(color, Math.max(bottomAlpha, topAlpha / 2)) },
		);
	}

	/* Option pieces that every chart on the page shares. */

	function motion(animate) {
		return animate ? { duration: 500, easing: 'easeOutQuart' } : false;
	}

	function tipStyle(inks) {
		return {
			usePointStyle: true,
			backgroundColor: inks.paper,
			borderColor: inks.edge,
			borderWidth: 1,
			cornerRadius: 8,
			padding: 10,
			boxPadding: 4,
			titleColor: inks.ink,
			titleFont: { family: TYPEFACE, size: 12, weight: '600' },
			bodyColor: inks.ink,
			bodyFont: { family: TYPEFACE, size: 12 },
		};
	}

	/** The headline cards' pictures: no axes and no legend, one line of tooltip a month. */
	function bareOptions(inks, animate, describe) {
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: motion(animate),
			interaction: { mode: 'index', intersect: false },
			layout: { autoPadding: false, padding: { top: 4, right: 0, bottom: 0, left: 0 } },
			scales: { x: { display: false }, y: { display: false, grace: '12%' } },
			plugins: {
				legend: { display: false },
				tooltip: { ...tipStyle(inks), displayColors: false, callbacks: { label: describe } },
			},
		};
	}

	function areaLine(points, color, rim, width) {
		return {
			data: points,
			fill: 'start',
			backgroundColor: verticalWash(color, 0.3, 0.06),
			borderColor: color,
			borderWidth: width,
			tension: 0.4,
			pointRadius: 0,
			pointHoverRadius: 4,
			pointHoverBackgroundColor: color,
			pointHoverBorderColor: rim,
			pointHoverBorderWidth: 2,
		};
	}

	/* One recipe per chart; each returns a complete Chart.js config. */

	function usersLine(inks, animate) {
		return {
			type: 'line',
			data: { labels: MONTH_TITLES, datasets: [areaLine(SAMPLE.activeUsers, inks.series[6], inks.paper, 2)] },
			options: {
				...bareOptions(inks, animate, (point) => `${people(point.parsed.y)} people`),
				/* Pointing along the line shows that month in the tile. */
				...window.Basalt.sparkReadout?.({
					value: pick('[data-db-chart="spark"]', document)
						?.closest('.db-kpi')
						?.querySelector('.db-kpi-value'),
					note: pick('[data-db-chart="spark"]', document)
						?.closest('.db-kpi')
						?.querySelector('.db-kpi-change'),
					labels: MONTH_TITLES,
					format: people,
				}),
				plugins: { legend: { display: false }, tooltip: { enabled: false } },
			},
		};
	}

	/* Revenue gained stands above the zero line and revenue churned hangs
     below it, one pair of bars a month. */
	function wonAndLost(inks, animate) {
		const axisText = { color: inks.soft, font: { family: TYPEFACE, size: 11.5 }, padding: 8 };

		function column(label, values, hue) {
			return {
				label,
				data: values,
				backgroundColor: hue,
				hoverBackgroundColor: hue,
				borderRadius: 4,
				borderSkipped: false,
				barPercentage: 0.62,
				categoryPercentage: 0.72,
			};
		}

		return {
			type: 'bar',
			data: {
				labels: SAMPLE.gained.map((_, i) => axisLabel(i)),
				datasets: [
					column('Added', SAMPLE.gained, inks.series[0]),
					/* Lost revenue is the same hue as Added, faded, so the chart
					   keeps to the palette's own color in every palette. */
					column(
						'Lost',
						SAMPLE.churned.map((amount) => -amount),
						/^#[0-9a-f]{6}$/i.test(inks.series[0]) ? `${inks.series[0]}66` : inks.series[0],
					),
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: motion(animate),
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6, right: 6 } },
				plugins: {
					legend: { display: false },
					tooltip: {
						...tipStyle(inks),
						footerColor: inks.ink,
						footerFont: { family: TYPEFACE, size: 12, weight: '600' },
						callbacks: {
							title: ([first]) => monthLong(first.dataIndex),
							label: (bar) => ` ${bar.dataset.label}: ${thousands(Math.abs(bar.parsed.y))}`,
							footer: ([first]) =>
								`Net: +${thousands(SAMPLE.gained[first.dataIndex] - SAMPLE.churned[first.dataIndex])}`,
						},
					},
				},
				scales: {
					x: {
						stacked: true,
						border: { display: false },
						grid: { display: false },
						ticks: { ...axisText, maxRotation: 0, autoSkipPadding: 10 },
					},
					y: {
						stacked: true,
						suggestedMin: -10,
						suggestedMax: 30,
						border: { display: false },
						grid: { color: (line) => (line.tick?.value === 0 ? inks.edge : inks.rule) },
						ticks: { ...axisText, stepSize: 10, callback: signedThousands },
					},
				},
			},
		};
	}

	/* September's recurring revenue by plan, as a ring beside its list. */
	function planRing(inks, animate) {
		return {
			type: 'doughnut',
			data: {
				labels: SAMPLE.plans.map((plan) => plan.label),
				datasets: [
					{
						data: SAMPLE.plans.map((plan) => plan.recurring),
						backgroundColor: SAMPLE.plans.map((plan) => inks.series[plan.hue - 1]),
						hoverBackgroundColor: SAMPLE.plans.map((plan) => inks.series[plan.hue - 1]),
						borderColor: inks.paper,
						hoverBorderColor: inks.paper,
						borderWidth: 3,
						borderRadius: 4,
						hoverOffset: 6,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: motion(animate),
				cutout: '74%',
				layout: { padding: 6 },
				onHover: (event, slices) => ringCenter(slices[0]?.index),
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false },
				},
			},
		};
	}

	/* The ring's middle names the plan under the pointer, and goes back to
	   the paying accounts once the pointer leaves the ring. */
	function ringCenter(index) {
		const value = pick('.db-ring-value');
		const label = pick('.db-ring-label');
		if (!value || !label) return;
		const plan = SAMPLE.plans[index];
		if (!plan) {
			const accounts = SAMPLE.plans.reduce((sum, each) => sum + each.accounts, 0);
			value.textContent = accounts.toLocaleString('en-US');
			label.textContent = 'paying accounts';
			return;
		}
		value.textContent = thousands(plan.recurring);
		label.textContent = `${plan.label} · ${plan.accounts.toLocaleString('en-US')} accounts`;
	}

	/* The headline panel. Its slides sit side by side on a track that is
     dragged, swiped, stepped with the arrow keys or the dots, and moves on
     by itself every few seconds unless the pointer or focus is on it. A
     copy of the first slide at the end lets the loop keep going forward. */

	function wireHero() {
		const panel = pick('[data-db-hero]');
		if (!panel) return;
		const track = pick('[data-db-hero-track]', panel);
		const dots = pickAll('[data-db-hero-dots] button', panel);
		const count = dots.length;
		const loopCopy = track.firstElementChild.cloneNode(true);
		loopCopy.setAttribute('aria-hidden', 'true');
		loopCopy.setAttribute('data-db-hero-copy', '');
		loopCopy.inert = true;
		track.append(loopCopy);
		const slides = [...track.children];
		const hero = { panel, track, dots, slides, count, at: 0, drag: null, held: false };

		track.classList.add('is-gliding');
		show(hero, 0);
		drawAllSteps(hero, false);
		dots.forEach((dot, index) => dot.addEventListener('click', () => show(hero, index)));
		panel.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowRight') show(hero, hero.at + 1);
			if (event.key === 'ArrowLeft') show(hero, hero.at - 1);
		});
		for (const [name, held] of [
			['mouseenter', true],
			['mouseleave', false],
			['focusin', true],
			['focusout', false],
		]) {
			panel.addEventListener(name, () => {
				hero.held = held;
			});
		}
		track.addEventListener('transitionend', () => wrapAround(hero));
		wireHeroDrag(hero);
		new MutationObserver(() => drawAllSteps(hero, false)).observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-bs-theme', 'data-basalt-palette', 'data-basalt-gradients'],
		});
		if (!calmMotion) {
			setInterval(() => {
				if (!hero.held && !hero.drag && !document.hidden) show(hero, hero.at + 1);
			}, 6000);
		}
	}

	function slideTo(hero, offset = 0) {
		hero.track.style.transform = `translateX(calc(${-hero.at * 100}% + ${offset}px))`;
	}

	function show(hero, index) {
		const { track, count } = hero;
		if (index < 0) {
			/* Back from the first slide: stand on the copy at the end, then step back. */
			track.classList.remove('is-gliding');
			hero.at = count;
			slideTo(hero);
			void track.offsetWidth;
			track.classList.add('is-gliding');
			index = count - 1;
		}
		hero.at = Math.min(index, count);
		slideTo(hero);
		const showing = hero.at % count;
		hero.dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === showing)));
		hero.slides.forEach((slide, i) => {
			if (i < count) slide.inert = i !== showing;
		});
		const art = pick('[data-db-steps]', hero.slides[hero.at]);
		if (art) drawSteps(art, !calmMotion);
	}

	function wrapAround(hero) {
		if (hero.at !== hero.count) return;
		hero.track.classList.remove('is-gliding');
		hero.at = 0;
		slideTo(hero);
		void hero.track.offsetWidth;
		hero.track.classList.add('is-gliding');
	}

	function wireHeroDrag(hero) {
		const { panel, track } = hero;
		panel.addEventListener('pointerdown', (event) => {
			if (event.button !== 0 || event.target.closest('button')) return;
			wrapAround(hero);
			hero.drag = { from: event.clientX, by: 0 };
			track.classList.remove('is-gliding');
			panel.classList.add('is-dragging');
			panel.setPointerCapture(event.pointerId);
		});
		panel.addEventListener('pointermove', (event) => {
			if (!hero.drag) return;
			hero.drag.by = event.clientX - hero.drag.from;
			slideTo(hero, hero.at === 0 && hero.drag.by > 0 ? hero.drag.by * 0.35 : hero.drag.by);
		});
		const letGo = () => {
			if (!hero.drag) return;
			const { by } = hero.drag;
			hero.drag = null;
			panel.classList.remove('is-dragging');
			track.classList.add('is-gliding');
			if (Math.abs(by) > Math.min(80, panel.clientWidth * 0.15)) show(hero, hero.at + (by < 0 ? 1 : -1));
			else slideTo(hero);
		};
		panel.addEventListener('pointerup', letGo);
		panel.addEventListener('pointercancel', letGo);
	}

	function drawAllSteps(hero, animate) {
		for (const art of pickAll('[data-db-steps]', hero.panel)) drawSteps(art, animate);
	}

	/* Column steps: one lit six-sided column per month along a rising line,
     the trend drawn over their tops and September tagged. Everything is
     drawn in the panel's own text color, so it suits every palette and
     both themes; with gradients off the faces are flat. */
	function drawSteps(art, animate) {
		const series = SAMPLE[art.getAttribute('data-db-steps')];
		const tag = `Sep ${art.getAttribute('data-db-steps-tag')}`;
		const ink = getComputedStyle(art.closest('[data-db-hero]')).color;
		const flat = document.documentElement.getAttribute('data-basalt-gradients') === 'off';
		const low = Math.min(...series);
		const span = Math.max(...series) - low || 1;
		const columns = series.map((value, month) => ({
			month,
			x: 128 + month * 22.5,
			y: 254 - month * 6,
			rise: 22 + ((value - low) / span) * 80,
		}));
		const paint = (share) => {
			art.replaceChildren();
			art.setAttribute('viewBox', '0 0 440 272');
			art.setAttribute('preserveAspectRatio', 'xMaxYMax meet');
			const fills = stepFills(art, ink, flat);
			for (const column of [...columns].sort((a, b) => a.y - b.y)) {
				stepColumn(art, fills, column.x, column.y, column.rise * share, column.month === columns.length - 1);
			}
			const tops = columns.map((column) => [column.x, column.y - column.rise * share - 4]);
			svgNode(
				'path',
				{
					d: tops.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
					fill: 'none',
					stroke: ink,
					'stroke-width': 2,
					'stroke-linejoin': 'round',
					'stroke-opacity': 0.9,
				},
				art,
			);
			for (const [x, y] of tops) svgNode('circle', { cx: x, cy: y, r: 2.2, fill: ink }, art);
			if (share === 1) stepTag(art, ink, tops[tops.length - 1], tag);
		};
		if (!animate) {
			paint(1);
			return;
		}
		const began = performance.now();
		const frame = (now) => {
			const progress = Math.min(1, (now - began) / 500);
			paint(1 - (1 - progress) ** 3);
			if (progress < 1) requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	}

	function svgNode(name, attributes, parent) {
		const node = document.createElementNS('http://www.w3.org/2000/svg', name);
		for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
		parent.append(node);
		return node;
	}

	/* Each face of a column fades from the ink at the top to less of it below;
     the gradients are named per drawing so the three slides do not share. */
	function stepFills(art, ink, flat) {
		const faces = { top: [0.95, 0.75], front: [0.62, 0.22], left: [0.5, 0.18], right: [0.34, 0.1] };
		if (flat)
			return Object.fromEntries(Object.entries(faces).map(([face, [alpha]]) => [face, translucent(ink, alpha)]));
		const defs = svgNode('defs', {}, art);
		/* The hidden loop copy of the first slide draws the same chart, so its
		   gradients take their own names to keep every id unique. */
		const copy = art.closest('[data-db-hero-copy]') ? '-copy' : '';
		const name = `db-steps-${art.getAttribute('data-db-steps')}${copy}`;
		const fills = {};
		for (const [face, [upper, lower]] of Object.entries(faces)) {
			const wash = svgNode(
				'linearGradient',
				{ id: `${name}-${face}`, x1: 0, y1: 0, x2: face === 'top' ? 1 : 0, y2: 1 },
				defs,
			);
			svgNode('stop', { offset: 0, 'stop-color': translucent(ink, upper) }, wash);
			svgNode('stop', { offset: 1, 'stop-color': translucent(ink, lower) }, wash);
			fills[face] = `url(#${name}-${face})`;
		}
		const glow = svgNode('radialGradient', { id: `${name}-glow` }, defs);
		svgNode('stop', { offset: 0, 'stop-color': translucent(ink, 0.7) }, glow);
		svgNode('stop', { offset: 1, 'stop-color': translucent(ink, 0) }, glow);
		fills.glow = `url(#${name}-glow)`;
		return fills;
	}

	function stepColumn(art, fills, x, y, rise, newest) {
		const radius = 12.5;
		const rim = Array.from({ length: 6 }, (_, side) => {
			const turn = (Math.PI / 3) * side;
			return [x + radius * Math.cos(turn), y - rise + radius * Math.sin(turn) * 0.56];
		});
		const points = (list) => list.map((point) => point.map((n) => n.toFixed(1)).join(',')).join(' ');
		const wall = (a, b) => points([rim[a], rim[b], [rim[b][0], rim[b][1] + rise], [rim[a][0], rim[a][1] + rise]]);
		svgNode('polygon', { points: wall(0, 1), fill: fills.right }, art);
		svgNode('polygon', { points: wall(1, 2), fill: fills.front }, art);
		svgNode('polygon', { points: wall(2, 3), fill: fills.left }, art);
		svgNode('polygon', { points: points(rim), fill: fills.top }, art);
		if (newest && fills.glow) svgNode('circle', { cx: x, cy: y - rise, r: radius * 1.6, fill: fills.glow }, art);
	}

	function stepTag(art, ink, [x, y], words) {
		const width = 10 + words.length * 7.4;
		/* On a phone the art sits behind the words, so its tag is hidden there (index.css). */
		const tag = svgNode('g', { class: 'db-hero-tag' }, art);
		svgNode('rect', { x: x - width - 14, y: y - 30, width, height: 24, rx: 6, fill: ink }, tag);
		const label = svgNode(
			'text',
			{
				x: x - width / 2 - 14,
				y: y - 14,
				'text-anchor': 'middle',
				'font-family': "'Chivo Mono', monospace",
				'font-size': 12,
				'font-weight': 500,
			},
			tag,
		);
		label.style.fill = getComputedStyle(art.closest('[data-db-hero]')).backgroundColor;
		label.textContent = words;
	}

	/* Today's tasks. Ticking one strikes it through and turns its pill to
     Done; unticking brings back the pill's own words. Nothing is saved. */

	function wireTasks() {
		const tasks = pick('[data-db-todo]');
		const tally = pick('[data-db-todo-count]');
		if (!tasks) return;

		for (const tickBox of pickAll('.form-check-input', tasks)) {
			const tag = pick('.db-pill', tickBox.closest('.db-todo-item'));
			tag.dataset.dbLabel = tag.textContent.trim();
			tag.dataset.dbTone = tag.className.match(/\bdb-pill-(\w+)/)?.[1] || 'warning';
			reflectTask(tickBox);
		}
		/* One listener for the whole list, so tasks added later tick off too. */
		tasks.addEventListener('change', (event) => {
			const tickBox = event.target.closest('.form-check-input');
			if (!tickBox) return;
			reflectTask(tickBox);
			recount(tasks, tally);
		});
		recount(tasks, tally);
	}

	function reflectTask(tickBox) {
		const row = tickBox.closest('.db-todo-item');
		const tag = pick('.db-pill', row);
		const finished = tickBox.checked;
		row.classList.toggle('is-done', finished);
		tag.className = `db-pill db-pill-${finished ? 'success' : tag.dataset.dbTone}`;
		tag.textContent = finished ? 'Done' : tag.dataset.dbLabel;
	}

	function recount(tasks, tally) {
		const tickBoxes = pickAll('.form-check-input', tasks);
		const stillOpen = tickBoxes.filter((tickBox) => !tickBox.checked).length;
		tally.textContent = stillOpen ? `${stillOpen} of ${tickBoxes.length} still to do.` : 'All done for today.';
	}

	/* AI suggestions: worked out from the figures on this page, problems
	   first. Add to today puts one on the task list beside it; Dismiss
	   brings in the next. Nothing is stored. */

	function suggestions() {
		const last = SAMPLE.gained.length - 1;
		const ideas = [];
		const late = arrears.items?.[0];
		if (late) {
			ideas.push({
				id: 'late',
				kind: 'problem',
				icon: 'bi-receipt',
				title: `Call ${late.invoice.customer} about ${dollars(late.invoice.amount)}`,
				why: `${late.late} days late, the oldest invoice.`,
				meta: `${late.late} days late`,
				href: 'invoices.html',
				pill: ['Overdue', 'danger'],
			});
		}
		const slowed = SAMPLE.gained[last] - SAMPLE.gained[last - 1];
		if (slowed < 0) {
			ideas.push({
				id: 'slowed',
				kind: 'problem',
				icon: 'bi-graph-down-arrow',
				title: `New revenue slowed in ${monthLong(last).split(' ')[0]}`,
				why: `${thousands(SAMPLE.gained[last])} added against ${thousands(SAMPLE.gained[last - 1])} the month before.`,
				meta: 'Look at where sign-ups dropped',
				href: 'revenue-insights.html',
				pill: ['Review', 'warning'],
			});
		}
		const full = trialRows()
			.filter((trial) => trial.used / trial.seats >= 0.85 && trial.plan !== 'Max')
			.sort((left, right) => right.used / right.seats - left.used / left.seats)[0];
		if (full) {
			const next = full.plan === 'Basic' ? 'Pro' : 'Max';
			ideas.push({
				id: 'trial',
				kind: 'win',
				icon: 'bi-rocket-takeoff',
				title: `Offer ${full.name} the ${next} plan`,
				why: `They use ${full.used} of ${full.seats} ${full.plan} seats; the trial ends ${full.ends}.`,
				meta: `Trial ends ${full.ends}`,
				href: 'company-details.html',
				pill: ['Trial', 'info'],
			});
		}
		const total = SAMPLE.plans.reduce((sum, plan) => sum + plan.recurring, 0);
		const top = [...SAMPLE.plans].sort(
			(left, right) => right.recurring / right.accounts - left.recurring / left.accounts,
		)[0];
		ideas.push({
			id: 'plan',
			kind: 'win',
			icon: 'bi-gem',
			title: `Show ${top.label} to growing teams`,
			why: `${top.accounts} ${top.label} accounts bring ${Math.round((top.recurring / total) * 100)}% of revenue.`,
			meta: `${top.label} brings the most per account`,
			href: 'subscription-plans.html',
			pill: ['Idea', 'info'],
		});
		const best = Math.max(...SAMPLE.newAccounts);
		if (SAMPLE.newAccounts[last] === best) {
			ideas.push({
				id: 'welcome',
				kind: 'win',
				icon: 'bi-emoji-smile',
				title: `Welcome the ${best} new accounts`,
				why: `${monthLong(last).split(' ')[0]} brought the most sign-ups this year.`,
				meta: 'A short hello from the team',
				href: 'newsletters.html',
				pill: ['Idea', 'info'],
			});
		}
		return [...ideas.filter((idea) => idea.kind === 'problem'), ...ideas.filter((idea) => idea.kind !== 'problem')];
	}

	/** The trials table as plain values: name, plan, seats used and the end date. */
	function trialRows() {
		return pickAll('[aria-labelledby="db-trial-title"] tbody tr').map((row) => {
			const [used, seats] = (pick('.db-use', row)?.textContent.match(/\d+/g) || [0, 1]).map(Number);
			return {
				name: pick('.db-who-name', row)?.textContent.trim(),
				plan: pick('.badge', row)?.textContent.trim(),
				used,
				seats,
				ends: row.lastElementChild.textContent.trim(),
			};
		});
	}

	function wireIdeas() {
		const list = pick('[data-db-ideas]');
		const wait = pick('[data-db-thinking]');
		if (!list) return;
		const queue = suggestions();
		const shown = queue.splice(0, 4);
		const draw = () => {
			list.innerHTML = shown
				.map(
					(idea, at) =>
						`<li class="basalt-idea${idea.kind === 'problem' ? ' is-problem' : ''}" style="--i: ${at}" data-idea="${idea.id}"><span class="basalt-idea-icon" aria-hidden="true"><i class="bi ${idea.icon}"></i></span><p class="basalt-idea-title">${htmlSafe(idea.title)}</p><p class="basalt-idea-why"><span class="basalt-idea-kind">${idea.kind === 'problem' ? 'Problem' : 'Working'}</span>${htmlSafe(idea.why)}</p><span class="basalt-idea-actions"><button type="button" class="btn btn-outline-secondary btn-sm" data-db-accept><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add to today</button><button type="button" class="btn btn-sm db-idea-drop" data-db-drop aria-label="Dismiss" title="Dismiss"><i class="bi bi-x-lg" aria-hidden="true"></i></button></span></li>`,
				)
				.join('');
			if (!shown.length) list.innerHTML = `<li class="db-ideas-done">Nothing else for now.</li>`;
		};
		setTimeout(
			() => {
				wait.hidden = true;
				list.hidden = false;
				draw();
			},
			calmMotion ? 200 : 500,
		);
		list.addEventListener('click', (event) => {
			const row = event.target.closest('[data-idea]');
			if (!row) return;
			const at = shown.findIndex((idea) => idea.id === row.dataset.idea);
			if (event.target.closest('[data-db-accept]')) {
				addTask(shown[at]);
				window.Basalt.toasts?.push({
					tone: 'success',
					icon: 'bi-check2-circle',
					title: 'Added to today',
					text: shown[at].title,
				});
			} else if (!event.target.closest('[data-db-drop]')) return;
			shown.splice(at, 1);
			if (queue.length) shown.push(queue.shift());
			draw();
		});
	}

	/** Puts a suggestion on the task list, marked as one the AI made. */
	function addTask(idea) {
		const tasks = pick('[data-db-todo]');
		const id = `db-todo-ai-${idea.id}`;
		const row = document.createElement('li');
		row.className = 'db-todo-item is-new';
		row.innerHTML = `<input id="${id}" type="checkbox" class="form-check-input"><div class="db-todo-text"><label for="${id}" class="db-todo-label"><i class="bi bi-stars db-todo-ai" aria-label="Suggested by AI"></i>${htmlSafe(idea.title)}</label><a href="${idea.href}" class="db-todo-meta">${htmlSafe(idea.meta)}</a></div><span class="db-pill db-pill-${idea.pill[1]}" data-db-label="${idea.pill[0]}" data-db-tone="${idea.pill[1]}">${idea.pill[0]}</span>`;
		const firstDone = pickAll('.db-todo-item.is-done', tasks)[0];
		tasks.insertBefore(row, firstDone || null);
		recount(tasks, pick('[data-db-todo-count]'));
	}

	/* Overdue invoices: what customers owe past the due date, read from the
     same billing data as the Invoices page and split by how late it is. */

	function tallyOverdue() {
		const billing = window.Basalt.data?.billing;
		if (!billing) return { invoices: [], owed: 0, oldest: 0, bands: null };

		function calendarDay(stamp) {
			const [year, month, date] = stamp.slice(0, 10).split('-').map(Number);
			return new Date(year, month - 1, date);
		}

		function daysPastDue(invoice) {
			return Math.round((calendarDay(billing.today) - calendarDay(invoice.due)) / 864e5);
		}

		const invoices = billing
			.invoices()
			.filter((invoice) => invoice.state === 'sent' && invoice.due < billing.today);
		const sums = new Map(LATENESS.map((band) => [band, 0]));
		let owed = 0;
		let oldest = 0;
		const items = [];
		for (const invoice of invoices) {
			const late = daysPastDue(invoice);
			items.push({ invoice, late, band: LATENESS.find((candidate) => late <= candidate.upTo) });
			const band = LATENESS.find((candidate) => late <= candidate.upTo);
			if (band) sums.set(band, sums.get(band) + invoice.amount);
			owed += invoice.amount;
			oldest = Math.max(oldest, late);
		}

		const bands = [...sums].filter(([, sum]) => sum > 0).map(([band, sum]) => ({ ...band, sum }));
		items.sort((a, b) => b.late - a.late);
		return { invoices, owed, oldest, bands, items };
	}

	/* The overdue card: the total, then one bar segment per invoice, oldest
	   first and sized by amount, and the faces of the customers who owe. */
	function showOverdue() {
		if (!arrears.bands) return;
		const { invoices, owed, oldest, items } = arrears;
		const howMany = invoices.length;
		const noun = howMany === 1 ? 'invoice' : 'invoices';

		function spot(name) {
			return pick(`[data-db-late="${name}"]`);
		}

		spot('total').textContent = dollars(owed);
		spot('sub').textContent = howMany ? `${howMany} ${noun} · oldest ${oldest} days late` : 'Nothing is late';
		spot('bar').innerHTML = items
			.map(
				({ invoice, late, band }) =>
					`<span class="db-late-part db-late-part-${band?.key ?? 'over'}" style="flex-grow:${Math.round(invoice.amount)}" title="${htmlSafe(invoice.customer)} · ${dollars(invoice.amount)} · ${late} days late"></span>`,
			)
			.join('');
		const faces = spot('faces');
		faces.innerHTML = items
			.map(
				({ invoice }) =>
					`<span class="basalt-avatar basalt-avatar-xs" data-basalt-avatar data-name="${htmlSafe(invoice.customer)}" title="${htmlSafe(invoice.customer)}"></span>`,
			)
			.join('');
		for (const face of faces.children) window.Basalt.avatar?.(face);
		spot('who').hidden = !items.length;
		spot('todo').textContent = `Reach out about ${howMany} late ${noun}`;
		spot('tdl-sum').textContent = `${dollars(owed)} still to come in`;
	}

	start();
})();
