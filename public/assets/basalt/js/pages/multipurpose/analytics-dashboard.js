/**
 * Website analytics for Fieldline, analytics-dashboard.html, inside [data-an-root].
 *
 * How many people visit the site, where they come from, which page they
 * land on and how many of them go on to order. Every figure, chart and list
 * is worked out from the sample below by buildReport(), so the cards, the
 * charts and the side drawer always agree; the markup only holds the live
 * visitor count in the header.
 *
 * To show your own traffic, replace the generated days (sessions, orders
 * and revenue for each) and SEGMENTS, where every entry has its share of
 * sessions and how well it orders against the site average. MILESTONES
 * puts a labeled marker on the trend chart.
 *
 * Charts take their colors from the --basalt-* tokens whenever they are
 * built and are built again on basalt:appearance. The segmented controls
 * and the toasts come from basalt.js.
 */
(() => {
	'use strict';

	const trafficView = pick('[data-an-root]');
	if (!trafficView) return;

	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";
	const DAY_MS = 86400000;
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* The newest complete day of data; in a live app, yesterday. Two years
     of days are kept so the 12-month view has a year to compare against. */
	const LAST_DAY = new Date(2026, 9, 8);
	const DAY_COUNT = 728;

	/* days is how far a period reaches back; step is how many days each
     point on the chart covers. */
	const PERIODS = {
		'7d': { days: 7, step: 1, now: 'Last 7 days', before: '7 days before' },
		'30d': { days: 30, step: 1, now: 'Last 30 days', before: '30 days before' },
		'90d': { days: 90, step: 1, now: 'Last 90 days', before: '90 days before' },
		'12m': { days: 364, step: 7, now: 'Last 12 months', before: 'Year before' },
	};

	const MEASURES = {
		sessions: { name: 'Sessions', tone: 1 },
		orders: { name: 'Orders', tone: 3 },
		conversion: { name: 'Conversion rate', tone: 5 },
		revenue: { name: 'Revenue', tone: 2 },
	};

	/* Days worth a marker on the trend chart, each with a short name. */
	const MILESTONES = [{ date: new Date(2026, 8, 22), name: 'Travel Planner 2.0 launch' }];

	/* share is an entry's part of all sessions, readSeconds (landing pages
     only) the average time a visitor stays on it, buyFactor how often its
     sessions end in an order against the site average (1 is average), and
     yearlyDrift how fast its share grows in a year. A remainder entry, where
     there is one, stands for everything not listed. */
	const SEGMENTS = {
		channel: {
			name: 'Channel',
			pluralName: 'Channels',
			entries: [
				{
					id: 'search',
					name: 'Search',
					icon: 'search',
					hint: 'Google and Bing',
					share: 0.34,
					buyFactor: 1.0,
					yearlyDrift: 0.08,
					tone: 1,
				},
				{
					id: 'direct',
					name: 'Direct',
					icon: 'cursor',
					hint: 'Typed in or saved',
					share: 0.22,
					buyFactor: 1.35,
					yearlyDrift: -0.06,
					tone: 2,
				},
				{
					id: 'paid',
					name: 'Paid ads',
					icon: 'megaphone',
					hint: 'Search and social ads',
					share: 0.14,
					buyFactor: 0.85,
					yearlyDrift: 0.2,
					tone: 3,
				},
				{
					id: 'email',
					name: 'Email',
					icon: 'envelope',
					hint: 'Newsletters, reminders',
					share: 0.11,
					buyFactor: 1.6,
					yearlyDrift: 0.04,
					tone: 4,
				},
				{
					id: 'social',
					name: 'Social',
					icon: 'people',
					hint: 'LinkedIn, YouTube',
					share: 0.1,
					buyFactor: 0.55,
					yearlyDrift: 0.26,
					tone: 5,
				},
				{
					id: 'partner',
					name: 'Partner sites',
					icon: 'shop',
					hint: 'Resellers, directories',
					share: 0.09,
					buyFactor: 1.1,
					yearlyDrift: 0.1,
					tone: 6,
				},
			],
		},
		country: {
			name: 'State',
			pluralName: 'States',
			entries: [
				{
					id: 'ca',
					name: 'California',
					region: 'West',
					share: 0.38,
					buyFactor: 1.05,
					yearlyDrift: 0.02,
					tone: 5,
				},
				{
					id: 'tx',
					name: 'Texas',
					region: 'South',
					share: 0.12,
					buyFactor: 1.1,
					yearlyDrift: 0.04,
					tone: 6,
				},
				{
					id: 'ny',
					name: 'New York',
					region: 'Northeast',
					share: 0.11,
					buyFactor: 1.0,
					yearlyDrift: 0.06,
					tone: 1,
				},
				{
					id: 'il',
					name: 'Illinois',
					region: 'Midwest',
					share: 0.08,
					buyFactor: 1.12,
					yearlyDrift: 0.09,
					tone: 3,
				},
				{
					id: 'fl',
					name: 'Florida',
					region: 'South',
					share: 0.06,
					buyFactor: 0.9,
					yearlyDrift: 0.12,
					tone: 6,
				},
				{
					id: 'oh',
					name: 'Ohio',
					region: 'Midwest',
					share: 0.05,
					buyFactor: 0.7,
					yearlyDrift: 0.18,
					tone: 3,
				},
			],
			/* Shown as a single line under the list. */
			remainder: {
				id: 'other',
				name: 'Other states',
				count: 44,
				share: 0.2,
				buyFactor: 0.8,
				yearlyDrift: 0.05,
			},
		},
		page: {
			name: 'Landing page',
			pluralName: 'Landing pages',
			entries: [
				{
					id: 'home',
					name: '/',
					title: 'Home',
					share: 0.24,
					buyFactor: 0.5,
					yearlyDrift: -0.04,
					readSeconds: 108,
				},
				{
					id: 'pricing',
					name: '/pricing',
					title: 'Plans and pricing',
					readSeconds: 151,
					share: 0.14,
					buyFactor: 2.3,
					yearlyDrift: 0.05,
				},
				{
					id: 'addons',
					name: '/add-ons',
					title: 'Fieldline Add-ons',
					readSeconds: 72,
					share: 0.11,
					buyFactor: 2.7,
					yearlyDrift: 0.12,
				},
				{
					id: 'sms',
					name: '/add-ons/sms-credits',
					title: 'SMS credit packs',
					readSeconds: 54,
					share: 0.07,
					buyFactor: 2.2,
					yearlyDrift: 0.1,
				},
				{
					id: 'travel',
					name: '/travel-planner',
					title: 'Travel Planner',
					readSeconds: 96,
					share: 0.06,
					buyFactor: 1.2,
					yearlyDrift: 0.16,
				},
				{
					id: 'guide',
					name: '/blog/roster-tips',
					title: 'Home care roster tips',
					readSeconds: 204,
					share: 0.05,
					buyFactor: 0.3,
					yearlyDrift: 0.22,
				},
			],
			remainder: { id: 'other', name: 'Other pages', share: 0.33, buyFactor: 0.7, yearlyDrift: 0.02 },
		},
		device: {
			name: 'Device',
			pluralName: 'Devices',
			entries: [
				{
					id: 'desktop',
					name: 'Desktop',
					icon: 'laptop',
					share: 0.57,
					buyFactor: 1.25,
					yearlyDrift: -0.03,
					tone: 1,
				},
				{
					id: 'mobile',
					name: 'Mobile',
					icon: 'phone',
					share: 0.37,
					buyFactor: 0.6,
					yearlyDrift: 0.07,
					tone: 3,
				},
				{
					id: 'tablet',
					name: 'Tablet',
					icon: 'tablet',
					share: 0.06,
					buyFactor: 0.95,
					yearlyDrift: 0.02,
					tone: 5,
				},
			],
		},
	};

	/* The two lists the drawer can break each kind of row down by, and
     where its button leads. States have no button. */
	const BREAKDOWNS = { channel: ['page', 'country'], country: ['channel', 'page'], page: ['channel', 'country'] };
	const DRAWER_ACTIONS = {
		channel: { href: 'marketing-insights.html', text: 'See campaigns' },
		page: { href: 'page-editor.html', text: 'Edit the page' },
	};

	/* A labeled, dashed upright line at every milestone the chart covers. */
	const MILESTONE_PLUGIN = { id: 'anMarks', afterDatasetsDraw: drawMilestones };

	const visits = buildDays();
	const lens = { period: '30d', measure: 'sessions' };
	const drawerFocus = { list: null, id: null, by: null };
	const sidePanel = pick('#an-drill');
	const liveCharts = {};

	function start() {
		within('[data-an-range]').addEventListener('change', (event) => {
			if (!event.target.matches('input')) return;
			lens.period = event.target.value;
			repaint(true);
		});

		for (const figureTile of pickAll('[data-an-metric]')) {
			figureTile.addEventListener('click', () => {
				if (lens.measure === figureTile.dataset.anMetric) return;
				lens.measure = figureTile.dataset.anMetric;
				showTrend(buildReport(), true);
			});
		}

		trafficView.addEventListener('click', (event) => {
			const opener = event.target.closest('[data-an-open]');
			if (!opener) return;
			const [list, id] = opener.dataset.anOpen.split(':');
			focusRow(list, id);
		});

		/* Only a person's choice counts here; showDrawer() fires an untrusted
       change of its own just to move the switch's thumb. */
		inDrawer('[data-an-drill-switch]').addEventListener('change', (event) => {
			if (!event.isTrusted || !event.target.matches('input')) return;
			drawerFocus.by = event.target.value;
			showDrawer();
		});
		inDrawer('[data-an-drill-export]').addEventListener('click', downloadBreakdown);
		within('[data-an-export]').addEventListener('click', downloadReport);

		document.addEventListener('basalt:appearance', () => repaint(false));

		repaint(true);
	}

	function within(selector) {
		return pick(selector, trafficView);
	}

	function pickAll(selector, scope = trafficView) {
		return [...scope.querySelectorAll(selector)];
	}

	function inDrawer(selector) {
		return pick(selector, sidePanel);
	}

	/* Words and numbers, written the way the cards print them. */

	function whole(number) {
		return Math.round(number).toLocaleString('en-US');
	}

	function percent(fraction, places = 2) {
		return `${(fraction * 100).toFixed(places)}%`;
	}

	function dollars(amount) {
		if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}M`;
		if (amount >= 1e4) return `$${(amount / 1e3).toFixed(1)}k`;
		return `$${whole(amount)}`;
	}

	function dayMonth(date) {
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function fullDate(date) {
		return `${dayMonth(date)}, ${date.getFullYear()}`;
	}

	/** "Sep 9 to Oct 8, 2026", naming the month and year only where they change. */
	function spanWords(from, to) {
		if (from.getFullYear() !== to.getFullYear()) return `${fullDate(from)} to ${fullDate(to)}`;
		if (from.getMonth() !== to.getMonth()) return `${dayMonth(from)} to ${fullDate(to)}`;
		return `${dayMonth(from)} to ${to.getDate()}, ${to.getFullYear()}`;
	}

	function measureText(measure, amount) {
		if (measure === 'conversion') return percent(amount);
		if (measure === 'revenue') return dollars(amount);
		return whole(amount);
	}

	function isoDay(date) {
		const paddedMonth = String(date.getMonth() + 1).padStart(2, '0');
		const paddedDay = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${paddedMonth}-${paddedDay}`;
	}

	/* The sample data: the same numbers on every load. */

	/** A seeded stream of numbers between 0 and 1 (mulberry32). */
	function stream(seed) {
		let cursor = seed >>> 0;
		return function nextNumber() {
			cursor = (cursor + 0x6d2b79f5) >>> 0;
			let mixed = cursor;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/** A steady number between -1 and 1 for any text key (FNV-1a into the stream). */
	function wobble(key) {
		let fnv = 2166136261;
		for (let i = 0; i < key.length; i += 1) fnv = Math.imul(fnv ^ key.charCodeAt(i), 16777619);
		return stream(fnv)() * 2 - 1;
	}

	/* Holidays dip, summer sags a little and spring runs a little high. */
	function seasonFor(date) {
		const monthIndex = date.getMonth();
		const dayOfMonth = date.getDate();
		if ((monthIndex === 11 && dayOfMonth >= 20) || (monthIndex === 0 && dayOfMonth <= 3)) return 0.68;
		if (monthIndex === 6 || monthIndex === 7) return 0.93;
		if (monthIndex >= 2 && monthIndex <= 4) return 1.05;
		return 1;
	}

	/* Each day's sessions, orders and revenue. Traffic grows about 15% a
     year, weekdays run busier than weekends, and the Travel Planner 2.0
     launch on September 22, 2026 lifts a week of traffic that fades day
     by day. */
	function buildDays() {
		const roll = stream(20261008);
		const weekdayPull = [0.8, 1.08, 1.1, 1.09, 1.06, 0.98, 0.82];
		const launch = new Date(2026, 8, 22);
		const dayLog = [];
		for (let index = 0; index < DAY_COUNT; index += 1) {
			const stamp = new Date(
				LAST_DAY.getFullYear(),
				LAST_DAY.getMonth(),
				LAST_DAY.getDate() - (DAY_COUNT - 1 - index),
			);
			const years = (index - (DAY_COUNT - 1)) / 365;
			const afterLaunch = Math.round((stamp - launch) / DAY_MS);
			const lift = afterLaunch >= 0 && afterLaunch < 8 ? 1 + 0.38 * Math.pow(0.68, afterLaunch) : 1;
			const visitCount = Math.round(
				3720 *
					Math.exp(0.15 * years) *
					weekdayPull[stamp.getDay()] *
					seasonFor(stamp) *
					lift *
					(1 + (roll() - 0.5) * 0.12),
			);
			const orderShare =
				((1.24 + 0.08 * years) * (stamp.getDay() % 6 === 0 ? 1.08 : 1) * (1 + (roll() - 0.5) * 0.16)) / 100;
			const orderCount = Math.round(visitCount * orderShare);
			const takings = Math.round(orderCount * 236 * (1 + (roll() - 0.5) * 0.2));
			dayLog.push({ date: stamp, sessions: visitCount, orders: orderCount, revenue: takings });
		}
		return dayLog;
	}

	/* The report: everything the page shows for the chosen period. */

	/**
	 * Splits a whole number into parts in proportion to the weights, giving
	 * the leftover units to the largest remainders so the parts always add
	 * back up to the whole.
	 */
	function shareOut(total, weights) {
		const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;
		const exact = weights.map((weight) => (total * weight) / weightSum);
		const floors = exact.map(Math.floor);
		let leftover = total - floors.reduce((sum, part) => sum + part, 0);
		const byRemainder = exact.map((value, index) => [value - Math.floor(value), index]).sort((a, b) => b[0] - a[0]);
		for (const [, index] of byRemainder) {
			if (leftover <= 0) break;
			floors[index] += 1;
			leftover -= 1;
		}
		return floors;
	}

	/** The days of a period, `back` whole periods before the newest one. */
	function periodDays(period, back) {
		const end = DAY_COUNT - period.days * back;
		return visits.slice(end - period.days, end);
	}

	function sumUp(days) {
		const sum = { sessions: 0, orders: 0, revenue: 0 };
		for (const day of days) {
			sum.sessions += day.sessions;
			sum.orders += day.orders;
			sum.revenue += day.revenue;
		}
		sum.conversion = sum.orders / sum.sessions;
		return sum;
	}

	/** One chart point per `step` days, dated by its first day. */
	function bucket(days, step) {
		const points = [];
		for (let offset = 0; offset < days.length; offset += step) {
			const point = sumUp(days.slice(offset, offset + step));
			point.date = days[offset].date;
			points.push(point);
		}
		return points;
	}

	/* A period's sessions and orders shared across one list. */
	function divide(listKey, periodKey, back, sum) {
		const segment = SEGMENTS[listKey];
		const period = PERIODS[periodKey];
		const everyone = segment.remainder ? [...segment.entries, segment.remainder] : segment.entries;
		const years = (-period.days * (back + 0.5)) / 365;
		const weights = everyone.map(
			(entry) =>
				entry.share *
				(1 + entry.yearlyDrift * years) *
				(1 + 0.035 * wobble(`${listKey}${entry.id}${periodKey}${back}`)),
		);
		const sessionParts = shareOut(sum.sessions, weights);
		const orderParts = shareOut(
			sum.orders,
			weights.map((weight, i) => weight * everyone[i].buyFactor),
		);
		return everyone.map((entry, i) => ({ entry, sessions: sessionParts[i], orders: orderParts[i] }));
	}

	function buildReport() {
		const period = PERIODS[lens.period];
		const currentDays = periodDays(period, 0);
		const earlierDays = periodDays(period, 1);
		const now = sumUp(currentDays);
		const earlierSum = sumUp(earlierDays);

		const lists = {};
		for (const key of Object.keys(SEGMENTS)) {
			const earlier = divide(key, lens.period, 1, earlierSum);
			lists[key] = divide(key, lens.period, 0, now).map((row, i) => Object.assign(row, { before: earlier[i] }));
		}

		return {
			period,
			first: currentDays[0].date,
			last: currentDays[currentDays.length - 1].date,
			now,
			prev: earlierSum,
			series: bucket(currentDays, period.step),
			prevSeries: bucket(earlierDays, period.step),
			lists,
		};
	}

	function repaint(animate) {
		const report = buildReport();
		showFigures(report);
		showTrend(report, animate);
		showTop(report);
		showLists(report);
		showDevices(report);
		if (sidePanel.classList.contains('show')) showDrawer();
	}

	/* Chart colors, read from the theme whenever a chart is built. */

	function themeInks() {
		function token(name, fallback) {
			return window.Basalt.token(name, fallback);
		}

		return {
			ink: token('--basalt-copy', '#191430'),
			body: token('--basalt-copy-body', '#3b4256'),
			muted: token('--basalt-copy-muted', '#6e6790'),
			faint: token('--basalt-copy-faint', '#a3a9b8'),
			rule: token('--basalt-edge', '#e3e7ef'),
			paper: token('--basalt-plane', '#ffffff'),
			series: (slot) => window.Basalt.series(slot, 0, '#2b6fd4'),
		};
	}

	/** A six-digit hex at the given opacity; any other color comes back as it was. */
	function seeThrough(hex, alpha) {
		const hexMatch = /^#([0-9a-f]{6})$/i.exec(hex);
		if (!hexMatch) return hex;
		const packed = parseInt(hexMatch[1], 16);
		return `rgba(${(packed >> 16) & 255},${(packed >> 8) & 255},${packed & 255},${alpha})`;
	}

	function tipStyle(inks) {
		return {
			backgroundColor: inks.paper,
			borderColor: inks.rule,
			borderWidth: 1,
			cornerRadius: 8,
			padding: 10,
			boxPadding: 4,
			titleColor: inks.ink,
			titleFont: { family: TYPEFACE, size: 12, weight: '600' },
			bodyColor: inks.body,
			bodyFont: { family: TYPEFACE, size: 12 },
		};
	}

	function retire(name) {
		if (!liveCharts[name]) return;
		liveCharts[name].destroy();
		delete liveCharts[name];
	}

	/* The four figures across the top of the traffic card. Each is a tab
     that picks what the chart below draws. */

	/** Conversion moves in points; every other figure moves in percent. */
	function describeChange(measure, now, before) {
		if (measure === 'conversion') {
			const points = (now - before) * 100;
			const up = points >= 0;
			return { up, text: `${up ? '+' : '−'}${Math.abs(points).toFixed(2)} pts` };
		}
		const ratio = (now - before) / before;
		const up = ratio >= 0;
		return { up, text: `${up ? '+' : '−'}${Math.abs(ratio * 100).toFixed(1)}%` };
	}

	function showFigures(report) {
		const comparedWith = report.period.before.toLowerCase();
		for (const measure of Object.keys(MEASURES)) {
			const figureTile = within(`[data-an-metric="${measure}"]`);
			if (!figureTile) continue;
			const now = report.now[measure];
			const { up, text } = describeChange(measure, now, report.prev[measure]);

			pick('[data-an-value]', figureTile).textContent = measureText(measure, now);
			const trendBadge = pick('[data-an-trend]', figureTile);
			trendBadge.className = `basalt-trend basalt-trend-${up ? 'up' : 'down'}`;
			trendBadge.innerHTML = `<i class="bi bi-arrow-${up ? 'up' : 'down'}-right" aria-hidden="true"></i>${text}`;
			pick('[data-an-against]', figureTile).textContent = `vs ${comparedWith}`;
			figureTile.setAttribute(
				'aria-label',
				`${MEASURES[measure].name} ${measureText(measure, now)}, ${text} against the ${comparedWith}. Show on the chart.`,
			);
		}
	}

	/* The trend chart: the chosen figure over the period, with the period
     before as a dashed line and a marker on each milestone. */

	function showTrend(report, animate) {
		const { measure } = lens;
		const { period } = report;
		const measureName = MEASURES[measure].name;
		const daily = period.step === 1;

		within('[data-an-trend-title]').textContent = measureName;
		within('[data-an-trend-desc]').textContent =
			`${daily ? 'Each day' : 'Each week'} from ${spanWords(report.first, report.last)}, with the ${period.before.toLowerCase()} as a dashed line.`;
		within('[data-an-key-now]').textContent = period.now;
		within('[data-an-key-before]').textContent = period.before;
		for (const figureTile of pickAll('[data-an-metric]')) {
			figureTile.setAttribute('aria-pressed', String(figureTile.dataset.anMetric === measure));
		}

		showNumberTable(report);

		const plotCanvas = within('[data-an-trend-chart]');
		plotCanvas.setAttribute(
			'aria-label',
			`${measureName}, ${period.now.toLowerCase()}: ${measureText(measure, report.now[measure])}, against ${measureText(measure, report.prev[measure])} in the ${period.before.toLowerCase()}.`,
		);
		if (typeof Chart === 'undefined') return;
		retire('trend');
		liveCharts.trend = new Chart(plotCanvas, trendConfig(report, animate));
	}

	function trendConfig(report, animate) {
		const { measure } = lens;
		const { period } = report;
		const daily = period.step === 1;
		const inks = themeInks();
		const hue = inks.series(MEASURES[measure].tone);
		const axisText = { color: inks.muted, font: { family: TYPEFACE, size: 11.5 }, padding: 6 };
		const marks = milestoneMarks(report);
		const tickFormats = { conversion: (value) => `${(value * 100).toFixed(1)}%`, revenue: dollars };

		function pointTitle(index) {
			const point = report.series[index];
			const mark = marks.find((candidate) => candidate.index === index);
			const when = daily ? dayMonth(point.date) : `Week of ${dayMonth(point.date)}`;
			return `${when}${mark ? ` · ${mark.name}` : ''}`;
		}

		function pointLabel(point) {
			const earlierDay =
				point.datasetIndex === 0 ? '' : ` (${dayMonth(report.prevSeries[point.dataIndex].date)})`;
			return ` ${point.dataset.label}${earlierDay}: ${measureText(measure, point.raw)}`;
		}

		const areaFill = window.Basalt.chartFill(
			[
				[0, seeThrough(hue, 0.22)],
				[1, seeThrough(hue, 0)],
			],
			{ flat: seeThrough(hue, 0.12) },
		);

		return {
			type: 'line',
			data: {
				labels: report.series.map((point) => dayMonth(point.date)),
				datasets: [
					{
						label: period.now,
						data: report.series.map((point) => point[measure]),
						fill: true,
						backgroundColor: areaFill,
						borderColor: hue,
						borderWidth: 2.25,
						tension: 0.35,
						pointRadius: 0,
						pointHoverRadius: 5,
						pointHoverBorderWidth: 2,
						pointHoverBorderColor: inks.paper,
						pointBackgroundColor: hue,
					},
					{
						label: period.before,
						data: report.prevSeries.map((point) => point[measure]),
						fill: false,
						borderColor: inks.faint,
						borderWidth: 1.75,
						borderDash: [5, 5],
						tension: 0.35,
						pointRadius: 0,
						pointHoverRadius: 4,
						pointBackgroundColor: inks.faint,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !calmMotion ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: marks.length ? 30 : 0 } },
				plugins: {
					legend: { display: false },
					anMarks: { marks, line: inks.muted, text: inks.body, surface: inks.paper, border: inks.rule },
					tooltip: {
						...tipStyle(inks),
						callbacks: { title: ([first]) => pointTitle(first.dataIndex), label: pointLabel },
					},
				},
				scales: {
					x: {
						border: { display: false },
						grid: { display: false },
						ticks: {
							...axisText,
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: daily && period.days <= 7 ? 7 : 8,
						},
					},
					y: {
						beginAtZero: measure !== 'conversion',
						border: { display: false },
						grid: { color: inks.rule },
						ticks: {
							...axisText,
							maxTicksLimit: 5,
							callback: (value) => (tickFormats[measure] ?? whole)(value),
						},
					},
				},
			},
			plugins: [MILESTONE_PLUGIN],
		};
	}

	/** The chart point each milestone falls on in the period shown. */
	function milestoneMarks(report) {
		const { step } = report.period;
		return MILESTONES.map(({ date, name }) => ({
			name,
			index: report.series.findIndex((point) => date >= point.date && (date - point.date) / DAY_MS < step),
		})).filter((mark) => mark.index >= 0);
	}

	function drawMilestones(chart, _args, settings) {
		const { ctx, chartArea: area, scales } = chart;
		for (const mark of settings.marks) {
			const x = scales.x.getPixelForValue(mark.index);
			ctx.save();
			drawDashedRule(ctx, x, area, settings.line);
			drawNameTag(ctx, x, area, mark.name, settings);
			ctx.restore();
		}
	}

	function drawDashedRule(ctx, x, area, color) {
		ctx.strokeStyle = color;
		ctx.lineWidth = 1;
		ctx.setLineDash([3, 4]);
		ctx.beginPath();
		ctx.moveTo(x, area.top - 4);
		ctx.lineTo(x, area.bottom);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	/* The name sits in a rounded tag above the chart, kept inside the plot
     area at both ends. */
	function drawNameTag(ctx, x, area, name, settings) {
		ctx.font = `600 11.5px ${TYPEFACE}`;
		const tagWidth = ctx.measureText(name).width + 18;
		const tagHeight = 22;
		const left = Math.min(Math.max(x - tagWidth / 2, area.left), area.right - tagWidth);
		const top = area.top - tagHeight - 6;
		ctx.fillStyle = settings.surface;
		ctx.strokeStyle = settings.border;
		ctx.beginPath();
		ctx.roundRect(left, top, tagWidth, tagHeight, tagHeight / 2);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = settings.text;
		ctx.textBaseline = 'middle';
		ctx.fillText(name, left + 9, top + tagHeight / 2 + 0.5);
	}

	/* The chart's numbers again as a table, for anyone who would rather read
     them than trace a line. */
	function showNumberTable(report) {
		const { measure } = lens;
		within('[data-an-numbers-now]').textContent = report.period.now;
		within('[data-an-numbers-before]').textContent = report.period.before;
		within('[data-an-numbers-when]').textContent = report.period.step === 1 ? 'Day' : 'Week of';
		within('[data-an-numbers]').innerHTML = report.series
			.map(
				(point, i) =>
					`<tr><td>${fullDate(point.date)}</td><td class="text-end">${measureText(measure, point[measure])}</td><td class="text-end">${measureText(measure, report.prevSeries[i][measure])}</td></tr>`,
			)
			.join('');
	}

	/* The ranked lists: channels, states and landing pages. Each row is
     a button that opens the drawer on it. */

	function bySessions(a, b) {
		return b.sessions - a.sessions;
	}

	function rankedRow(row, longest, list, subline, markFor) {
		const { entry } = row;
		const barWidth = Math.max(2, Math.round((row.sessions / longest) * 100));
		return `<li><button type="button" class="an-rank-row" data-an-open="${list}:${entry.id}" aria-haspopup="dialog"><span class="an-rank-who">${markFor(entry)}<span class="an-rank-text"><span class="an-rank-name">${entry.name}</span><span class="an-rank-sub">${subline(entry)}</span></span></span><span class="an-rank-bar" aria-hidden="true"><span class="an-rank-fill an-tone-${entry.tone || 1}" style="width:${barWidth}%"></span></span><span class="an-rank-num">${whole(row.sessions)}</span><span class="an-rank-num an-rank-num-quiet">${percent(row.orders / row.sessions)}</span><i class="bi bi-chevron-right an-rank-go" aria-hidden="true"></i></button></li>`;
	}

	function showLists(report) {
		const channelRows = report.lists.channel;
		const channelPeak = Math.max(...channelRows.map((row) => row.sessions));
		within('[data-an-list="channel"]').innerHTML = [...channelRows]
			.sort(bySessions)
			.map((row) =>
				rankedRow(
					row,
					channelPeak,
					'channel',
					(entry) => entry.hint,
					(entry) =>
						`<span class="an-mark an-tone-${entry.tone}" aria-hidden="true"><i class="bi bi-${entry.icon}"></i></span>`,
				),
			)
			.join('');

		const countryRows = report.lists.country.filter((row) => row.entry.id !== 'other');
		const otherCountries = report.lists.country.find((row) => row.entry.id === 'other');
		const countryPeak = Math.max(...countryRows.map((row) => row.sessions));
		within('[data-an-list="country"]').innerHTML = [...countryRows]
			.sort(bySessions)
			.map((row) =>
				rankedRow(
					row,
					countryPeak,
					'country',
					(entry) => entry.region,
					(entry) =>
						`<span class="an-mark an-mark-code an-tone-${entry.tone}" aria-hidden="true">${entry.id.toUpperCase()}</span>`,
				),
			)
			.join('');
		within('[data-an-country-rest]').textContent =
			`${SEGMENTS.country.remainder.count} more states brought ${whole(otherCountries.sessions)} sessions, ${percent(otherCountries.sessions / report.now.sessions, 0)} of the total.`;

		const landings = report.lists.page.filter((row) => row.entry.id !== 'other').sort(bySessions);
		within('[data-an-pages]').innerHTML = landings
			.map(({ entry, sessions, orders }) => {
				const orderRate = percent(orders / sessions);
				return `<tr><td><button type="button" class="an-landing" data-an-open="page:${entry.id}" aria-haspopup="dialog"><span class="an-landing-path">${entry.name}</span><span class="an-landing-title">${entry.title}</span></button></td><td class="text-end an-num">${whole(sessions)}<span class="an-pages-sub">${orderRate} ordered</span></td><td class="text-end an-num an-pages-wide">${whole(orders)}</td><td class="text-end an-num an-num-quiet an-pages-wide">${orderRate}</td></tr>`;
			})
			.join('');
		const otherPages = report.lists.page.find((row) => row.entry.id === 'other');
		within('[data-an-page-rest]').textContent =
			`Every other page together: ${whole(otherPages.sessions)} sessions and ${whole(otherPages.orders)} orders.`;

		for (const mention of pickAll('[data-an-period]')) mention.textContent = report.period.now.toLowerCase();
	}

	/* Where visits start: the busiest landing page large, with its share of
	   all sessions, time on page and a line of its sessions over the period;
	   the next three as plain rows beside it. */
	function showTop(report) {
		const host = pick('[data-an-top]', trafficView);
		if (!host) return;
		const pages = report.lists.page.filter((row) => row.entry.id !== 'other').sort(bySessions);
		const [lead, ...rest] = pages;
		const share = lead.sessions / report.now.sessions;
		const points = report.series.map((point) => point.sessions * share);
		host.innerHTML =
			`<article class="an-top-lead"><p class="an-top-rank">Busiest landing page</p><h3 class="an-top-name">${lead.entry.title}</h3><p class="an-top-path">${lead.entry.name}</p><p class="an-top-value">${whole(lead.sessions)}<span>sessions</span></p><p class="an-top-meta">${readTime(lead.entry.readSeconds)} on the page · ${percent(share, 0)} of all visits · ${change(lead)}</p>${topLine(points)}</article>` +
			`<ol class="an-top-rest">${rest
				.slice(0, 3)
				.map(
					(row, i) =>
						`<li><span class="an-top-place">${i + 2}</span><span class="an-top-text"><b>${row.entry.title}</b><span class="an-top-path">${row.entry.name}</span></span><span class="an-top-num">${whole(row.sessions)}<small>${readTime(row.entry.readSeconds)} on the page</small></span></li>`,
				)
				.join('')}</ol>`;
		if (!host.dataset.drawn) {
			host.dataset.drawn = 'true';
			if (calmMotion) host.classList.add('is-drawn');
			else (window.Basalt.settled || Promise.resolve()).then(() => host.classList.add('is-drawn'));
		}
	}

	function readTime(seconds) {
		return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
	}

	function change(row) {
		const ratio = row.sessions / row.before.sessions - 1;
		return `${ratio >= 0 ? '+' : '−'}${percent(Math.abs(ratio), 0)} on the period before`;
	}

	/* A plain line of the page's sessions across the period, no axes. */
	function topLine(points) {
		const width = 300;
		const height = 70;
		const high = Math.max(...points);
		const low = Math.min(...points);
		const span = high - low || 1;
		const path = points
			.map(
				(value, i) =>
					`${i ? 'L' : 'M'}${((i / (points.length - 1)) * width).toFixed(1)},${(height - 4 - ((value - low) / span) * (height - 8)).toFixed(1)}`,
			)
			.join(' ');
		return `<svg class="an-top-line" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}"/></svg>`;
	}

	/* Devices: a ring with the session total in its middle, and a key with
     each device's share and order rate. */
	function showDevices(report) {
		const deviceRows = report.lists.device;
		const sessionTotal = report.now.sessions;

		function shareOf(sessions) {
			return percent(sessions / sessionTotal, 0);
		}

		within('[data-an-device-total]').textContent =
			sessionTotal >= 1e6 ? `${(sessionTotal / 1e6).toFixed(2)}M` : `${(sessionTotal / 1e3).toFixed(1)}k`;
		within('[data-an-devices]').innerHTML = deviceRows
			.map(
				({ entry, sessions, orders }) =>
					`<li class="an-device"><span class="an-mark an-device-mark an-tone-${entry.tone}" aria-hidden="true"><i class="bi bi-${entry.icon}"></i></span><span class="an-device-name">${entry.name}</span><span class="an-device-share">${shareOf(sessions)}</span><span class="an-device-meta">${whole(sessions)} sessions · ${percent(orders / sessions)} ordered</span></li>`,
			)
			.join('');

		const plotCanvas = within('[data-an-device-chart]');
		plotCanvas.setAttribute(
			'aria-label',
			`Sessions by device: ${deviceRows.map((row) => `${row.entry.name} ${shareOf(row.sessions)}`).join(', ')}.`,
		);
		if (typeof Chart === 'undefined') return;
		retire('devices');
		const inks = themeInks();
		const center = [within('[data-an-device-total]'), within('.an-devices-caption')];
		const resting = center.map((node) => node.textContent);
		/* The ring's middle names the device under the pointer. */
		const showDevice = (index) => {
			const row = deviceRows[index];
			center[0].textContent = row ? whole(row.sessions) : resting[0];
			center[1].textContent = row ? `${row.entry.name} · ${shareOf(row.sessions)}` : resting[1];
		};
		if (!plotCanvas.dataset.anCenter) {
			plotCanvas.dataset.anCenter = 'on';
			plotCanvas.addEventListener('mouseleave', () => liveCharts.devices?.options.onHover?.(null, []));
		}
		liveCharts.devices = new Chart(plotCanvas, {
			type: 'doughnut',
			data: {
				labels: deviceRows.map((row) => row.entry.name),
				datasets: [
					{
						data: deviceRows.map((row) => row.sessions),
						backgroundColor: deviceRows.map((row) => inks.series(row.entry.tone)),
						borderColor: inks.paper,
						borderWidth: 3,
						borderRadius: 4,
						hoverOffset: 6,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: calmMotion ? false : { duration: 500 },
				cutout: '74%',
				layout: { padding: 6 },
				onHover: (event, slices) => showDevice(slices[0]?.index),
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false },
				},
			},
		});
	}

	/* The drawer: one channel, state or landing page in a sentence, then
     its sessions broken down by one other list at a time. */

	function focusRow(list, id) {
		Object.assign(drawerFocus, { list, id, by: null });
		showDrawer();
		window.bootstrap.Offcanvas.getOrCreateInstance(sidePanel).show();
	}

	/** The row's sessions shared across another list, nudged so no two rows split alike. */
	function breakdown(report, list, id, by) {
		const row = report.lists[list].find((candidate) => candidate.entry.id === id);
		const across = report.lists[by];
		const weights = across.map(
			(other) => other.sessions * (1 + 0.45 * wobble(`${list}${id}${by}${other.entry.id}`)),
		);
		const portions = shareOut(row.sessions, weights);
		return across.map((other, i) => ({ entry: other.entry, sessions: portions[i] }));
	}

	function breakdownName(entry, by) {
		if (entry.id !== 'other') return entry.title || entry.name;
		return by === 'country' ? `${SEGMENTS.country.remainder.count} more states` : 'Other pages';
	}

	function showDrawer() {
		if (!drawerFocus.list) return;
		const { list, id } = drawerFocus;
		const report = buildReport();
		const row = report.lists[list].find((candidate) => candidate.entry.id === id);
		const { entry } = row;
		const isPage = list === 'page';
		const swing = (row.sessions - row.before.sessions) / row.before.sessions;
		const subject = isPage ? `The ${entry.title} page started` : `${entry.name} brought`;

		inDrawer('[data-an-drill-title]').textContent = entry.name;
		inDrawer('[data-an-drill-sub]').textContent =
			`${isPage ? entry.title : SEGMENTS[list].name} · ${report.period.now}`;
		inDrawer('[data-an-drill-lead]').innerHTML =
			`${subject} <strong>${whole(row.sessions)} sessions</strong> in the ${report.period.now.toLowerCase()}, ${Math.abs(swing * 100).toFixed(0)}% ${swing >= 0 ? 'more' : 'fewer'} than in the ${report.period.before.toLowerCase()}. <strong>${whole(row.orders)}</strong> of them ended in an order (${percent(row.orders / row.sessions)}, against ${percent(report.now.conversion)} for the whole site).`;

		const choices = BREAKDOWNS[list];
		if (!choices.includes(drawerFocus.by)) drawerFocus.by = choices[0];
		const { by } = drawerFocus;
		for (const [i, radio] of [...pickAll('[data-an-drill-by]', sidePanel)].entries()) {
			radio.value = choices[i];
			radio.checked = choices[i] === by;
			inDrawer(`label[for="${radio.id}"]`).textContent = SEGMENTS[choices[i]].pluralName;
		}
		/* The segmented control slides its thumb when it hears a change. */
		inDrawer('[data-an-drill-switch]').dispatchEvent(new Event('change'));

		const pieces = breakdown(report, list, id, by).sort((a, b) => {
			if (a.entry.id === 'other') return 1;
			if (b.entry.id === 'other') return -1;
			return b.sessions - a.sessions;
		});
		const peak = Math.max(...pieces.map((part) => part.sessions));
		const colored = by === 'channel' || by === 'country';
		inDrawer('[data-an-drill-head]').textContent = SEGMENTS[by].name;
		inDrawer('[data-an-drill-list]').innerHTML = pieces
			.map((part) => {
				const tone = part.entry.id === 'other' ? 'other' : colored ? part.entry.tone || 7 : 1;
				const barWidth = Math.max(2, Math.round((part.sessions / peak) * 100));
				return `<li class="an-drill-row"><span class="an-drill-name">${breakdownName(part.entry, by)}</span><span class="an-rank-bar" aria-hidden="true"><span class="an-rank-fill an-tone-${tone}" style="width:${barWidth}%"></span></span><span class="an-rank-num">${whole(part.sessions)}</span></li>`;
			})
			.join('');

		/* A channel leads to its campaigns, a page to the page editor. */
		const destination = DRAWER_ACTIONS[list];
		const button = inDrawer('[data-an-drill-link]');
		button.hidden = !destination;
		if (destination) Object.assign(button, { href: destination.href, textContent: destination.text });
	}

	/* Downloads: the chart's numbers for the period, or the drawer's
     breakdown, as CSV files. */

	function saveCsv(filename, rows) {
		function cellText(value) {
			const written = String(value);
			return /[",]/.test(written) ? `"${written.replace(/"/g, '""')}"` : value;
		}

		const csv = rows.map((row) => row.map(cellText).join(',')).join('\r\n');
		const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		const anchor = Object.assign(document.createElement('a'), { href: blobUrl, download: filename });
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
	}

	function downloadReport() {
		const report = buildReport();
		const heading = [
			report.period.step === 1 ? 'Day' : 'Week starting',
			'Sessions',
			'Orders',
			'Conversion rate',
			'Revenue (USD)',
		];
		const records = report.series.map((point) => [
			isoDay(point.date),
			point.sessions,
			point.orders,
			`${(point.conversion * 100).toFixed(2)}%`,
			point.revenue,
		]);
		saveCsv(`fieldline-analytics-${isoDay(report.first)}-to-${isoDay(report.last)}.csv`, [heading, ...records]);
		window.Basalt.toasts?.push({
			tone: 'success',
			title: 'Report downloaded',
			text: `${report.period.now}, ${report.series.length} rows.`,
			duration: 4000,
		});
	}

	function downloadBreakdown() {
		const { list, id, by } = drawerFocus;
		const report = buildReport();
		const row = report.lists[list].find((candidate) => candidate.entry.id === id);
		const records = breakdown(report, list, id, by).map(({ entry, sessions }) => {
			const rowName =
				entry.id === 'other' ? (by === 'country' ? 'Other states' : 'Other pages') : entry.title || entry.name;
			return [rowName, sessions];
		});
		saveCsv(`fieldline-${list}-${row.entry.id}-by-${by}.csv`, [[SEGMENTS[by].name, 'Sessions'], ...records]);
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}
})();
