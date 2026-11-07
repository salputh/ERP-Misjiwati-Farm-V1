/**
 * Single-account view for customer-insight.html.
 *
 * Shows one Fieldline customer in depth: recurring revenue and how it got
 * there, seats, health, renewal and retention, weekly visit volume, add-ons,
 * a recent activity feed, open support tickets and the latest invoices.
 *
 * The account comes from window.Basalt.customerBook, which
 * customer-insights.js builds, so this page and the Customers report never
 * disagree. ?id=%2310425 picks an account; with no id, the largest paying
 * account whose revenue changed this year is shown.
 *
 * For real data, have server.fetchAccount(id) answer with the profile that
 * profileFor() assembles below.
 */
(() => {
	'use strict';

	const page = pick('[data-cad-root]', document);
	const book = window.Basalt.customerBook;
	if (!page || !book || typeof Chart === 'undefined') return;

	const {
		DEMO: ledger,
		SPAN: monthsHeld,
		seeded: seededStream,
		MONTH_SHORT: shortMonths,
		MONTH_LONG: longMonths,
		monthOf: monthAt,
		arrAt: yearlyRevenue,
		renewal: nextRenewal,
		signalText: warningText,
	} = book;

	const CHART_FAMILY = "'Schibsted Grotesk', sans-serif";
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const FEED_PREVIEW = 5;
	const BAND_LABELS = { healthy: 'Healthy', watch: 'Worth watching', risk: 'At risk' };
	const PRIORITY_TONES = { Urgent: 'danger', Normal: 'warning', Low: 'info' };

	/* Names and ticket subjects the per-account stream draws from. */
	const CONTACTS = [
		'Elaine Zeller',
		'Ben Whitaker',
		'Lindsay Kinney',
		'Lance Monroe',
		'Erin Doyle',
		'Jim Atkins',
		'Hope Stout',
		'Candace Brennan',
	];
	const TICKET_SUBJECTS = [
		'Visits not syncing to the calendar',
		'Staff app logs out on Android',
		'Day plan skips a visit',
		'Customer portal link expired',
		'SMS reminders sent twice',
		'Invoice PDF missing the tax line',
		"Cannot import last month's visits",
		'Schedule board slow to load',
	];

	let profile = null;
	let feedExpanded = false;
	let checkInBooked = false;
	const liveCharts = new Map();

	/* Stand-in for the backend; the demo answers straight from the ledger. */
	const server = {
		/* GET /api/customers/:id answers with a profile. */
		fetchAccount(id) {
			const latest = monthsHeld - 1;
			const paying = ledger.accounts
				.filter((account) => account.mrr[latest] > 0)
				.sort((first, second) => yearlyRevenue(second, latest) - yearlyRevenue(first, latest));
			const chosen =
				ledger.accounts.find((account) => account.id === id) || paying.find(changedThisYear) || paying[0];
			return Promise.resolve(profileFor(chosen));
		},
		/* POST /api/customers/:id/check-ins books one; DELETE cancels it. */
		bookCheckIn(id, on) {
			return pause(200, { id, on });
		},
		/* Builds the CSV in the browser and starts the download. */
		downloadCsv(fileName, rows) {
			const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
			const href = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
			const anchor = document.createElement('a');
			anchor.href = href;
			anchor.download = fileName;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			setTimeout(() => URL.revokeObjectURL(href), 1000);
			return pause(150, rows.length - 1);
		},
	};

	/** Hooks up the header buttons and the feed toggle, then loads the account. */
	function start() {
		pick('[data-cad-more]').addEventListener('click', () => {
			window.Basalt.slide(pick('[data-cad="activity"]'), () => {
				feedExpanded = !feedExpanded;
				paintFeed();
			});
		});
		pick('[data-cad-call]').addEventListener('click', () => bookCheckIn(!checkInBooked, true));
		pick('[data-cad-copy]').addEventListener('click', copyAccountId);
		pick('[data-cad-export]').addEventListener('click', exportInvoices);

		document.addEventListener('basalt:appearance', () => {
			requestAnimationFrame(() => {
				if (!profile) return;
				for (const canvas of liveCharts.keys()) drawChart(canvas, false);
			});
		});

		const requested = new URLSearchParams(location.search).get('id');
		server.fetchAccount(requested).then((loaded) => {
			profile = loaded;
			paintPage();
		});
	}

	/* With no id in the address, prefer an account whose bill moved at
     least twice in the last twelve months. */
	function changedThisYear(account) {
		return new Set(account.mrr.slice(monthsHeld - 12)).size >= 3;
	}

	/* Everything below paints the page from the loaded profile. */

	function paintPage() {
		const { account, plan } = profile;
		document.title = `${account.name} · Basalt`;
		pick('[data-cad="name"]').textContent = account.name;
		const facts = [
			`${plan.name} plan`,
			lookup(ledger.regions, account.region).name,
			account.owner || 'No account manager',
		];
		if (profile.gone) facts.push(`Left in ${monthAndYear(account.end)}`);
		pick('[data-cad="sub"]').textContent = facts.join(' · ');
		pick('[data-cad-call]').hidden = profile.gone;

		pick('[data-cad-kpis]').innerHTML = headlineFigures()
			.map(
				([label, value, note]) =>
					`<article class="ca-kpi"><h3 class="ca-kpi-label">${htmlSafe(label)}</h3><p class="ca-kpi-value">${value}</p><p class="ca-kpi-delta"><span>${htmlSafe(note)}</span></p></article>`,
			)
			.join('');
		/* The figures count up from zero; the fourth tile is a month, not a figure. */
		window.Basalt.countUp?.(pickAll('[data-cad-kpis] .ca-kpi-value').filter((value, at) => at !== 3));

		paintRevenueCaption();
		paintUsage();
		pick('[data-cad="addons"]').innerHTML = profile.extras.map(addonItem).join('');
		paintFeed();
		paintTickets();
		paintInvoices();

		for (const canvas of pickAll('canvas[data-cad-chart]')) drawChart(canvas, true);
		setArrivals();
	}

	/* The page plays in once as each card comes into view: the usage figures
     count up, the feed steps down its timeline and the table rows rise in
     turn. Reduced motion shows everything at rest. */

	function setArrivals() {
		const usage = pick('[data-cad="usage"]');
		onFirstSight(usage, () => window.Basalt.countUp?.(pickAll('dd', usage)));
		for (const list of pickAll('[data-cad="activity"], [data-cad="tickets"], [data-cad="invoices"]')) {
			onFirstSight(list, () => arrive(list));
		}
	}

	/** Runs play once, the first time box is mostly on screen. */
	function onFirstSight(box, play) {
		if (calmMotion || !window.IntersectionObserver) return;
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				play();
			},
			{ threshold: 0.35 },
		);
		watch.observe(box);
	}

	/** Lets the children of list rise in turn, then leaves them as drawn. */
	function arrive(list) {
		Array.from(list.children).forEach((item, at) => item.style.setProperty('--cad-at', Math.min(at, 10)));
		list.classList.add('is-arriving');
		const runs = list.getAnimations({ subtree: true }).map((run) => run.finished);
		Promise.allSettled(runs).then(() => {
			list.classList.remove('is-arriving');
			for (const item of list.children) item.style.removeProperty('--cad-at');
		});
	}

	/** The five tiles as [label, value markup, note] triples. */
	function headlineFigures() {
		const { account, plan, gone, monthly, yearBefore, renewsOn, retention } = profile;
		const band = healthBand(profile.health);
		const revenueNote = yearBefore
			? `${monthly >= yearBefore ? '+' : '−'}${dollars(Math.abs(monthly - yearBefore))} in 12 months`
			: `Joined ${monthAndYear(Math.max(0, account.start))}`;
		const renewal = gone
			? ['Left', monthAndYear(account.end), `Last paid ${monthAndYear(profile.lastMonth)}`]
			: [
					'Renews',
					`${shortMonths[renewsOn.getMonth()]} ${renewsOn.getFullYear()}`,
					`On ${monthDay(renewsOn)}, billed ${account.billing === 'Annual' ? 'yearly' : 'monthly'}`,
				];
		return [
			['Monthly revenue', dollars(monthly), revenueNote],
			['Seats', wholeNumber(profile.seats), `$${plan.seat} a seat`],
			['Health score', `<span class="ca-dot ca-dot-${band}">${profile.health}</span>`, BAND_LABELS[band]],
			renewal,
			retention == null
				? ['Net revenue retention', 'New', 'Under a year on the book']
				: ['Net revenue retention', `${Math.round(retention)}%`, 'Last 12 months'],
		];
	}

	function paintRevenueCaption() {
		const { account, months, lastMonth, monthly, billChanges } = profile;
		const opening = months[0];
		const span = `${monthAndYear(opening)} to ${monthAndYear(lastMonth)}`;
		const fromTo = `from ${dollars(account.mrr[opening] || 0)} to ${dollars(monthly)}`;
		pick('[data-cad="mrr-desc"]').textContent =
			`${span}, ${fromTo} a month${billChanges.length ? '. Rings mark each change.' : ', with no changes.'}`;
		const changeList = billChanges.length
			? `. ${billChanges.map((change) => `${change.text} in ${monthAndYear(change.month)}`).join('. ')}.`
			: '.';
		pick('canvas[data-cad-chart="mrr"]').setAttribute(
			'aria-label',
			`Monthly recurring revenue, ${span}, ${fromTo}${changeList}`,
		);
	}

	function paintUsage() {
		const visits = profile.weeklyVisits;
		const latest = visits[visits.length - 1];
		const twelveWeeksBack = visits[0];
		const shift = Math.round(((latest - twelveWeeksBack) / twelveWeeksBack) * 100);
		pick('[data-cad="usage"]').innerHTML =
			statPair(
				'Visits last week',
				wholeNumber(latest),
				`${shift >= 0 ? '+' : '−'}${Math.abs(shift)}% in 12 weeks`,
			) + statPair('Staff active', wholeNumber(profile.activeStaff), `of ${wholeNumber(profile.seats)} seats`);
	}

	function statPair(term, value, aside) {
		return `<div><dt>${term}</dt><dd>${value}<small>${aside}</small></dd></div>`;
	}

	function addonItem(addon) {
		const state = addon.on
			? '<span class="basalt-status basalt-status-success basalt-status-dot">On</span>'
			: '<span class="cad-off">Off</span>';
		return `<li class="cad-addon"><span class="cad-addon-text"><span class="cad-addon-name">${htmlSafe(addon.name)}</span><span class="cad-addon-note">${htmlSafe(addon.note)}</span></span>${state}</li>`;
	}

	/* The feed shows its five newest entries until the reader asks for all. */
	function paintFeed() {
		const entries = feedExpanded ? profile.happenings : profile.happenings.slice(0, FEED_PREVIEW);
		pick('[data-cad="activity"]').innerHTML = entries
			.map((entry) => {
				const stamp = dayStart(entry.ago).toISOString().slice(0, 10);
				return `<li class="cad-feed-item"><span class="cad-feed-icon" aria-hidden="true"><i class="bi ${entry.icon}"></i></span><span class="cad-feed-text">${htmlSafe(entry.text)}<time class="cad-feed-time" datetime="${stamp}">${relativeDay(entry.ago)}</time></span></li>`;
			})
			.join('');

		const toggle = pick('[data-cad-more]');
		toggle.hidden = profile.happenings.length <= FEED_PREVIEW;
		toggle.textContent = feedExpanded ? 'Show fewer' : `See all ${profile.happenings.length}`;
		toggle.setAttribute('aria-expanded', String(feedExpanded));
	}

	function paintTickets() {
		const queue = profile.openTickets;
		pick('[data-cad="tix-desc"]').textContent = queue.length
			? `${countOf(queue.length, 'ticket')} waiting on the support team.`
			: 'Nothing waiting on the support team.';
		pick('[data-cad="tickets"]').innerHTML = queue
			.map((ticket) => {
				const subject = `<a class="ca-acc-name ca-acc-open" href="tickets.html" target="_blank" rel="noopener">${htmlSafe(ticket.subject)}<span class="visually-hidden"> (opens in a new tab)</span></a>`;
				return (
					`<tr><td><span class="ca-acc">${subject}<span class="ca-acc-sub">${ticket.id}</span></span></td>` +
					`<td>${statusMarker(PRIORITY_TONES[ticket.priority], ticket.priority)}</td>` +
					`<td class="text-end">${relativeDay(ticket.opened)}</td></tr>`
				);
			})
			.join('');
	}

	function paintInvoices() {
		const invoices = profile.invoices;
		pick('[data-cad="whs-desc"]').textContent =
			`The last ${invoices.length === 1 ? 'invoice' : `${invoices.length} invoices`}, newest first.`;
		pick('[data-cad="invoices"]').innerHTML = invoices
			.map(
				(invoice) =>
					`<tr><td><span class="ca-acc"><span class="ca-acc-name">${htmlSafe(invoice.id)}</span><span class="ca-acc-sub">${htmlSafe(invoice.what)}</span></span></td>` +
					`<td>${statusMarker(invoice.status === 'Paid' ? 'success' : 'danger', invoice.status)}</td>` +
					`<td class="text-end">${dollars(invoice.amount)}</td></tr>`,
			)
			.join('');
	}

	function statusMarker(tone, label) {
		return `<span class="basalt-status basalt-status-${tone} basalt-status-dot">${label}</span>`;
	}

	/* The header buttons: book a check-in, copy the id, export invoices. */

	/**
	 * Books or cancels a check-in call and says so in a toast.
	 * @param {boolean} on true to book, false to cancel
	 * @param {boolean} offerUndo add an Undo button that flips it back once
	 */
	function bookCheckIn(on, offerUndo) {
		const account = profile.account;
		const button = pick('[data-cad-call]');
		checkInBooked = on;
		pick('[data-cad-call-label]').textContent = on ? 'Check-in planned' : 'Plan a check-in';
		button.classList.toggle('btn-primary', !on);
		button.classList.toggle('btn-outline-secondary', on);
		server.bookCheckIn(account.id, on);

		let detail = '';
		if (on) {
			detail = account.owner
				? `${account.owner} gets a reminder for tomorrow morning.`
				: 'It goes to the support team, as nobody manages this account.';
		}
		notify({
			tone: on ? 'success' : 'info',
			title: on ? `Check-in planned with ${account.name}` : 'Check-in canceled',
			text: detail,
			actions: offerUndo
				? [
						{
							label: 'Undo',
							onClick() {
								bookCheckIn(!on, false);
							},
						},
					]
				: [],
		});
	}

	function copyAccountId() {
		const id = profile.account.id;
		function confirmCopy() {
			return notify({ tone: 'success', title: `Copied ${id}`, duration: 2200 });
		}
		if (navigator.clipboard && navigator.clipboard.writeText)
			navigator.clipboard.writeText(id).then(confirmCopy, confirmCopy);
		else confirmCopy();
	}

	function exportInvoices() {
		const fileName = `invoices-${profile.account.id}.csv`;
		const rows = [
			['Invoice', 'Description', 'Amount', 'Status'],
			...profile.invoices.map((invoice) => [invoice.id, invoice.what, invoice.amount, invoice.status]),
		];
		server.downloadCsv(fileName, rows).then((count) =>
			notify({
				tone: 'success',
				title: 'Export ready',
				text: `${fileName}, ${countOf(count, 'row')}.`,
				duration: 3600,
			}),
		);
	}

	/* Charts read the color tokens on every draw and are rebuilt when the theme changes. */

	function drawChart(canvas, animate) {
		liveCharts.get(canvas)?.destroy();
		const recipe = CHART_RECIPES[canvas.getAttribute('data-cad-chart')];
		liveCharts.set(canvas, new Chart(canvas, recipe(chartColors(), animate)));
	}

	const CHART_RECIPES = {
		/* Stepped MRR line for the last twelve paid months, with a ring on
       every month the bill changed; the tooltip names the change. */
		mrr(colors, animate) {
			const hue = colors.series[0];
			const months = profile.months;
			const changeAt = months.map(
				(month) => profile.billChanges.find((change) => change.month === month) || null,
			);
			const values = months.map((month) => profile.account.mrr[month] || 0);
			const low = Math.min(...values);
			const high = Math.max(...values);
			const headroom = Math.max((high - low) * 0.3, high * 0.04, 50);
			function floorFor(step) {
				return Math.max(0, Math.floor((low - headroom) / step) * step);
			}
			function ceilingFor(step) {
				return Math.ceil((high + headroom * 0.6) / step) * step;
			}
			/* The smallest even step that spans the line in five or fewer. */
			const step =
				[50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000].find(
					(candidate) => ceilingFor(candidate) - floorFor(candidate) <= candidate * 5,
				) || 100000;

			return {
				type: 'line',
				data: {
					labels: months.map((month, index) => {
						const date = monthAt(month);
						const withYear = index === 0 || date.getMonth() === 0;
						return (
							shortMonths[date.getMonth()] + (withYear ? ` ${String(date.getFullYear()).slice(2)}` : '')
						);
					}),
					datasets: [
						{
							label: 'MRR',
							data: values,
							fill: 'start',
							stepped: 'before',
							borderColor: hue,
							borderWidth: 2.5,
							backgroundColor: fadeDown(hue),
							pointRadius: changeAt.map((change) => (change ? 5 : 0)),
							pointHoverRadius: changeAt.map((change) => (change ? 7 : 4)),
							pointBackgroundColor: colors.surface,
							pointBorderColor: hue,
							pointBorderWidth: 2.5,
							pointHoverBackgroundColor: hue,
						},
					],
				},
				options: chartOptions(colors, animate, {
					tickLabel: shortDollars,
					y: {
						beginAtZero: false,
						min: floorFor(step),
						max: ceilingFor(step),
						ticks: { stepSize: step, maxTicksLimit: 6 },
					},
					tooltip: {
						title: ([first]) => {
							const date = monthAt(months[first.dataIndex]);
							return `${longMonths[date.getMonth()]} ${date.getFullYear()}`;
						},
						label: (item) => ` ${dollars(item.parsed.y)} a month`,
						afterLabel: (item) => {
							const change = changeAt[item.dataIndex];
							return change
								? ` ${change.text} (${change.by > 0 ? '+' : '−'}${dollars(Math.abs(change.by))})`
								: '';
						},
					},
				}),
			};
		},

		/* Twelve weeks of booked visits; the newest week is drawn darker. */
		jobs(colors, animate) {
			const hue = colors.series[1];
			const visits = profile.weeklyVisits;
			return {
				type: 'bar',
				data: {
					labels: visits.map((_, index) => monthDay(dayStart((11 - index) * 7 + 3))),
					datasets: [
						{
							label: 'Visits',
							data: visits,
							backgroundColor: visits.map((_, index) =>
								translucent(hue, index === visits.length - 1 ? 0.95 : 0.55),
							),
							hoverBackgroundColor: hue,
							borderRadius: 5,
							borderSkipped: 'start',
							barPercentage: 0.62,
							maxBarThickness: 30,
						},
					],
				},
				options: chartOptions(colors, animate, {
					tickLabel: (value) => wholeNumber(value),
					tooltip: {
						title: ([first]) => `Week of ${first.label}`,
						label: (item) => ` ${countOf(item.parsed.y, 'visit')} booked`,
					},
				}),
			};
		},
	};

	/**
	 * Shared Chart.js options with this chart's tick labels, y-axis
	 * settings and tooltip callbacks folded in.
	 * @param {{tickLabel: Function, y?: object, tooltip: object}} custom
	 */
	function chartOptions(colors, animate, custom) {
		const tickStyle = { color: colors.quiet, font: { family: CHART_FAMILY, size: 11.5 }, padding: 8 };
		const yAxis = custom.y || {};
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: animate && !calmMotion ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { mode: 'index', intersect: false },
			layout: { padding: { top: 6, right: 6 } },
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					titleColor: colors.text,
					bodyColor: colors.text,
					titleFont: { family: CHART_FAMILY, size: 12, weight: '600' },
					bodyFont: { family: CHART_FAMILY, size: 12 },
					padding: 10,
					cornerRadius: 8,
					displayColors: false,
					callbacks: custom.tooltip,
				},
			},
			scales: {
				x: {
					grid: { display: false },
					border: { display: false },
					ticks: { maxRotation: 0, autoSkipPadding: 12, ...tickStyle },
				},
				y: {
					beginAtZero: true,
					grid: { color: colors.grid },
					border: { display: false },
					...yAxis,
					ticks: { maxTicksLimit: 5, callback: custom.tickLabel, ...tickStyle, ...yAxis.ticks },
				},
			},
		};
	}

	/* An area fill that fades to nothing at the baseline; one light tint with gradients off. */
	function fadeDown(color) {
		return window.Basalt.chartFill(
			[
				[0, translucent(color, 0.24)],
				[1, translucent(color, 0)],
			],
			{ flat: translucent(color, 0.12) },
		);
	}

	function chartColors() {
		const text = readToken('--basalt-copy', '#12233a');
		const muted = readToken('--basalt-copy-muted', '#5f7186');
		const mutedRgb = toRgb(muted);
		const textRgb = toRgb(text);
		/* Mostly the muted gray with a little body text mixed in, so tick
       labels stay readable on the lighter palettes. */
		const quiet = mutedRgb.map((channel, index) => Math.round(channel * 0.82 + textRgb[index] * 0.18));
		return {
			text,
			quiet: `rgb(${quiet.join(', ')})`,
			grid: translucent(text, 0.07),
			surface: readToken('--basalt-plane', '#ffffff'),
			border: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			series: [readToken('--basalt-series-1', '#2b6fd4'), readToken('--basalt-series-2', '#2b6fd4')],
		};
	}

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Reads #rrggbb, #rgb, rgb() or rgba() as [r, g, b]; mid gray otherwise. */
	function toRgb(color) {
		const value = String(color || '').trim();
		const long = /^#([0-9a-f]{6})$/i.exec(value);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const short = /^#([0-9a-f]{3})$/i.exec(value);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16));
		const functional = /^rgba?\(([^)]+)\)$/i.exec(value);
		if (functional)
			return functional[1]
				.split(',')
				.slice(0, 3)
				.map((part) => parseFloat(part));
		return [128, 128, 128];
	}

	function translucent(color, alpha) {
		return `rgba(${toRgb(color).join(', ')}, ${alpha})`;
	}

	/* The profile for one account is assembled from the shared ledger here. */

	/**
	 * Everything the page shows about one account, derived from the ledger.
	 * Usage, add-ons, activity, tickets and invoices come from a stream
	 * seeded by the account, so a reload tells the same story.
	 */
	function profileFor(account) {
		const draw = seededStream(account.seed * 7 + 11);
		const plan = lookup(ledger.plans, account.plan);
		const gone = account.end !== null;
		const lastMonth = gone ? account.end - 1 : monthsHeld - 1;
		const health = account.health[lastMonth];
		const monthly = account.mrr[lastMonth] || 0;
		const seats = Math.max(3, Math.round(monthly / plan.seat));
		const activeStaff = Math.max(2, Math.min(seats, Math.round(seats * Math.min(0.97, 0.3 + health / 130))));

		/* The twelve months that end with the last paid one. */
		const months = [];
		for (let month = Math.max(0, lastMonth - 11); month <= lastMonth; month += 1) months.push(month);
		const yearBefore = lastMonth - 12 >= 0 && account.mrr[lastMonth - 12] > 0 ? account.mrr[lastMonth - 12] : null;
		const billChanges = months.map((month) => billChange(account, plan, month)).filter(Boolean);

		/* Bigger crews book more visits a week; an account that is slipping
       books fewer now than it did a quarter ago. */
		const visitsPerPerson = 5 + draw() * 4;
		const decline = (70 - health) / 110;
		const weeklyVisits = Array.from({ length: 12 }, (_, week) =>
			Math.max(
				4,
				Math.round(activeStaff * visitsPerPerson * (1 + (decline * (11 - week)) / 11) * (0.9 + draw() * 0.2)),
			),
		);

		const hasPlanner = plan.id === 'enterprise' || draw() < 0.5;
		const hasPortal = draw() < (plan.id === 'enterprise' ? 0.8 : 0.35);
		const hasSms = draw() < 0.6;
		const extras = [
			{
				name: 'Travel Planner',
				on: hasPlanner,
				note: hasPlanner ? `${wholeNumber(seats)} seats at $8 a seat` : '$8 a seat each month',
			},
			{
				name: 'Customer Portal',
				on: hasPortal,
				note: hasPortal ? 'Bookings and payments online' : '$199 a month',
			},
			{
				name: 'SMS credits',
				on: hasSms,
				note: hasSms
					? `${wholeNumber(Math.round((activeStaff * 40 + draw() * 300) / 50) * 50)} texts a month`
					: 'Reminders by text, paid by use',
			},
		];

		const contact = CONTACTS[Math.floor(draw() * CONTACTS.length)];
		const reordered = TICKET_SUBJECTS.slice().sort(() => draw() - 0.5);
		const urgentCount = health < 50 ? 2 : health < 70 ? 1 : 0;
		const openTickets = reordered.slice(0, 3).map((subject, index) => {
			let priority = 'Low';
			if (index < urgentCount) priority = 'Urgent';
			else if (index === urgentCount) priority = 'Normal';
			return {
				id: `T-${48210 + (account.seed % 900) * 3 + index * 17}`,
				subject,
				priority,
				opened: 2 + index * 4 + Math.floor(draw() * 4),
			};
		});

		const happenings = activityFeed({
			account,
			plan,
			draw,
			health,
			lastMonth,
			contact,
			hasPlanner,
			reordered,
			openTickets,
			billChanges,
			activeStaff,
		});
		const invoices = invoiceHistory({ account, plan, draw, gone, lastMonth, monthly, hasSms });

		return {
			account,
			plan,
			gone,
			lastMonth,
			health,
			monthly,
			seats,
			activeStaff,
			months,
			yearBefore,
			billChanges,
			retention: yearBefore ? (monthly / yearBefore) * 100 : null,
			renewsOn: gone ? null : nextRenewal(account, lastMonth),
			weeklyVisits,
			extras,
			openTickets,
			happenings,
			invoices,
		};
	}

	/* Names a change in the bill: whole seats at the plan's seat price, or
     an add-on switched on or off when the step is smaller than a seat. */
	function billChange(account, plan, month) {
		const before = month > 0 ? account.mrr[month - 1] : 0;
		const after = account.mrr[month];
		if (!before || !after || before === after) return null;
		const seatCount = Math.round(Math.abs(after - before) / plan.seat);
		const up = after > before;
		let text;
		if (seatCount >= 1) text = (up ? 'Added ' : 'Removed ') + countOf(seatCount, 'team seat');
		else text = up ? 'Turned on Travel Planner' : 'Turned off SMS credits';
		return { month, text, up, by: after - before };
	}

	/** Recent events, newest first, each `ago` days back. Draw order is fixed. */
	function activityFeed(context) {
		const {
			account,
			plan,
			draw,
			health,
			lastMonth,
			contact,
			hasPlanner,
			reordered,
			openTickets,
			billChanges,
			activeStaff,
		} = context;
		const happenings = [];
		function log(ago, icon, text) {
			happenings.push({ ago, icon, text });
		}

		log(Math.floor(draw() * 2), 'bi-box-arrow-in-right', `${contact} signed in to the schedule board`);
		log(1 + Math.floor(draw() * 3), 'bi-life-preserver', `Opened ticket: ${openTickets[0].subject}`);
		if (health < 50) log(3 + Math.floor(draw() * 4), 'bi-graph-down-arrow', warningText(account, lastMonth));

		/* The latest bill change, dated to the day it happened. */
		const latestChange = billChanges[billChanges.length - 1];
		if (latestChange) {
			const changedMonth = monthAt(latestChange.month);
			const changedOn = new Date(changedMonth.getFullYear(), changedMonth.getMonth(), 3 + (account.seed % 20));
			log(
				Math.max(4, Math.round((ledger.now - changedOn) / 864e5)),
				latestChange.up ? 'bi-people' : 'bi-person-dash',
				latestChange.text,
			);
		}

		log(9 + Math.floor(draw() * 6), 'bi-phone', `${countOf(activeStaff, 'team member')} used the mobile app`);
		log(14 + Math.floor(draw() * 6), 'bi-receipt', `Paid the ${longMonths[monthAt(lastMonth).getMonth()]} invoice`);
		if (hasPlanner) log(22 + Math.floor(draw() * 10), 'bi-signpost-split', 'Turned on Travel Planner');
		log(30 + Math.floor(draw() * 12), 'bi-life-preserver', `Closed ticket: ${reordered[4]}`);
		log(
			40 + Math.floor(draw() * 15),
			'bi-arrow-up-circle',
			account.plan === 'starter' ? 'Renewed on the Basic plan' : `Moved up to the ${plan.name} plan`,
		);
		log(
			58 + Math.floor(draw() * 20),
			'bi-person-plus',
			account.owner ? `${account.owner} took over the account` : `${contact} invited the office team`,
		);

		return happenings.sort((first, second) => first.ago - second.ago);
	}

	/* The four latest invoices. Monthly billing sends one a month; annual
     billing sends the yearly invoice plus smaller ones for seats and texts. */
	function invoiceHistory(context) {
		const { account, plan, draw, gone, lastMonth, monthly, hasSms } = context;
		const invoices = [];
		const runningLate = !gone && account.signal === 3;
		function number(month) {
			return `#${10000 + (account.seed % 8000) + month * 37}`;
		}
		function status(month) {
			return month === lastMonth && runningLate ? 'Overdue' : 'Paid';
		}

		if (account.billing === 'Monthly') {
			for (let month = lastMonth; month > lastMonth - 4 && month >= 0 && account.mrr[month] > 0; month -= 1) {
				invoices.push({
					id: number(month),
					what: `${longMonths[monthAt(month).getMonth()]} subscription`,
					amount: account.mrr[month],
					status: status(month),
				});
			}
			return invoices;
		}

		let termStart = account.start;
		while (termStart + 12 <= lastMonth) termStart += 12;
		termStart = Math.max(0, termStart);
		for (let month = lastMonth; month > termStart && invoices.length < 3; month -= 1) {
			if (draw() < 0.5) continue;
			const label = hasSms && draw() < 0.5 ? 'SMS credits, ' : 'Seats added in ';
			invoices.push({
				id: number(month),
				what: label + shortMonths[monthAt(month).getMonth()],
				amount: Math.round(plan.seat * (2 + draw() * 4) * 3),
				status: status(month),
			});
		}
		invoices.push({
			id: number(termStart),
			what: `Yearly subscription from ${monthAndYear(termStart)}`,
			amount: (account.mrr[termStart] || monthly) * 12,
			status: 'Paid',
		});
		return invoices;
	}

	/* Small lookups and formatters used throughout the page. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	function pause(ms, value) {
		return new Promise((resolve) => {
			setTimeout(() => resolve(value), ms);
		});
	}

	function csvCell(value) {
		const text = String(value ?? '');
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	function lookup(entries, id) {
		return entries.find((entry) => entry.id === id);
	}

	function wholeNumber(value) {
		return Math.round(value).toLocaleString('en-US');
	}

	function dollars(value) {
		return `$${wholeNumber(value)}`;
	}

	function shortDollars(value) {
		if (value < 1000) return `$${value}`;
		return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
	}

	function countOf(count, singular, pluralForm) {
		return `${wholeNumber(count)} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function healthBand(score) {
		if (score >= 70) return 'healthy';
		return score >= 50 ? 'watch' : 'risk';
	}

	function monthAndYear(index) {
		const date = monthAt(index);
		return `${shortMonths[date.getMonth()]} ${date.getFullYear()}`;
	}

	function monthDay(date) {
		return `${shortMonths[date.getMonth()]} ${date.getDate()}`;
	}

	/* Midnight `days` days before the demo's today. */
	function dayStart(days) {
		const demoToday = ledger.now;
		return new Date(demoToday.getFullYear(), demoToday.getMonth(), demoToday.getDate() - days);
	}

	function relativeDay(days) {
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		return days < 7 ? `${days} days ago` : monthDay(dayStart(days));
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
