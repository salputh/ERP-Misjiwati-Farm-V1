/**
 * Runs the backups screen (backups.html). Restore points are generated from
 * a fixed seed, so the history reads the same on every visit and nothing is
 * fetched; timers play the part of the backup service reporting progress.
 * A live install would ask that service for the list instead.
 */
(() => {
	'use strict';

	const root = pick('[data-bk-root]');
	if (!root) return;

	/* The demo is frozen on one autumn morning so relative times stay readable.
     Replace CLOCK with the current time once real restore points arrive. */
	const CLOCK = new Date(2026, 8, 29, 11, 40);
	const DAY_MS = 86400000;
	const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const DAILY_GROWTH_GB = 0.12;
	const TICKS_PER_STEP = 6;
	const prefersStill = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/* Each section a backup can copy, with its rough weight and copy time. */
	const SECTIONS = {
		orders: { title: 'Orders and customers', glyph: 'bi-receipt', weightGb: 0.31, seconds: 95 },
		products: { title: 'Products and stock', glyph: 'bi-box-seam', weightGb: 0.096, seconds: 40 },
		photos: { title: 'Photos and media', glyph: 'bi-images', weightGb: 0.88, seconds: 210 },
		settings: { title: 'Shop settings', glyph: 'bi-sliders', weightGb: 0.004, seconds: 8 },
	};
	const KINDS = {
		night: { title: 'Nightly', glyph: 'bi-moon-stars' },
		week: { title: 'Weekly', glyph: 'bi-calendar-week' },
		month: { title: 'Monthly', glyph: 'bi-calendar3' },
		manual: { title: 'Taken by hand', glyph: 'bi-hand-index-thumb' },
		safety: { title: 'Safety copy', glyph: 'bi-shield-check' },
	};
	const STAFF = ['Elaine Gill', 'Chad Roe', 'Allie Devin'];
	const EVERY_SECTION = { orders: true, products: true, photos: true, settings: true };
	const RETENTION_DAYS = { night: 30, week: 56, month: 183 };
	const SCOPE_TITLES = { all: 'The whole shop', products: 'Products and stock', settings: 'Settings only' };

	/* Storage is split into four bands; safety copies count with the manual ones. */
	const STORAGE_BANDS = [
		{ title: 'Nightly', kinds: ['night'], tone: 1 },
		{ title: 'Weekly', kinds: ['week'], tone: 2 },
		{ title: 'Monthly', kinds: ['month'], tone: 3 },
		{ title: 'Taken by hand', kinds: ['manual', 'safety'], tone: 4 },
	];

	const STATUS_BADGES = {
		fail: '<span class="basalt-status basalt-status-danger basalt-status-dot">Failed</span>',
		warn: '<span class="basalt-status basalt-status-warning basalt-status-dot">Finished with gaps</span>',
		ok: '<span class="basalt-status basalt-status-success basalt-status-dot">Finished</span>',
	};

	const NIGHT_LOOKS = {
		fail: { tone: 'bad', words: () => 'failed' },
		warn: { tone: 'warn', words: () => 'finished with gaps' },
		ok: { tone: 'ok', words: (point) => `finished, ${formatGb(point.sizeGb)}` },
	};

	const STRIP_MOVES = new Map([
		['ArrowRight', (at, count) => Math.min(count - 1, at + 1)],
		['ArrowDown', (at, count) => Math.min(count - 1, at + 1)],
		['ArrowLeft', (at) => Math.max(0, at - 1)],
		['ArrowUp', (at) => Math.max(0, at - 1)],
		['Home', () => 0],
		['End', (at, count) => count - 1],
	]);

	/* The list filter keeps everything unless one of these tests says no. */
	const CATEGORY_FILTERS = {
		auto: (point) => ['night', 'week', 'month'].includes(point.category),
		manual: (point) => ['manual', 'safety'].includes(point.category),
		problem: (point) => point.outcome !== 'ok',
	};

	const ORDERINGS = {
		old: (a, b) => a.takenAt - b.takenAt,
		big: (a, b) => b.sizeGb - a.sizeGb || b.takenAt - a.takenAt,
	};

	const STEP_LOOKS = {
		failed: { modifier: ' is-failed', spoken: ', stopped here' },
		done: { modifier: ' is-done', spoken: ', done' },
		current: { modifier: ' is-current', spoken: ', in progress' },
		waiting: { modifier: '', spoken: ', not started' },
	};

	const PROGRESS_LINES = {
		photos: (tick) => `Copying photos: ${withCommas(Math.round((2806 * tick) / TICKS_PER_STEP))} of 2,806 files`,
		orders: (tick) => `Copying orders: ${withCommas(Math.round((18412 * tick) / TICKS_PER_STEP))} of 18,412`,
		products: () => 'Copying 214 products and their stock counts',
		settings: () => 'Copying shipping, tax and checkout settings',
		check: () => 'Opening the copy to check nothing is missing',
	};

	/* Demo history. The generator is shared, so points are created in a fixed order. */
	const nextRandom = seededRandom(20260929);
	let serialCounter = 0;
	let restorePoints = buildHistory();
	let storageLimit = 60;

	/* Page parts, looked up once. */
	const canvas = pick('[data-bk-chart]', root);
	const strip = pick('[data-bk-nights]', root);

	const table = partsOf(pick('[data-bk-list]', root), {
		rows: '[data-bk-rows]',
		grid: '[data-bk-table]',
		empty: '[data-bk-empty]',
		pager: '[data-bk-pager]',
		search: '[data-bk-search]',
		order: '[data-bk-sort]',
	});

	const detail = document.getElementById('bk-detail');
	const detailPanel = window.bootstrap ? bootstrap.Offcanvas.getOrCreateInstance(detail) : null;
	const removal = document.getElementById('bk-delete');
	const removalModal = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(removal) : null;
	const restoreDialog = document.getElementById('bk-restore');
	const restoreModal = window.bootstrap ? bootstrap.Modal.getOrCreateInstance(restoreDialog) : null;
	const restoreForm = pick('[data-bk-restore-form]', restoreDialog);

	const run = partsOf(pick('[data-bk-run]', root), {
		form: '[data-bk-run-form]',
		live: '[data-bk-live]',
		ring: '[data-bk-ring]',
		ringValue: '[data-bk-ring-value]',
		ringCaption: '[data-bk-ring-caption]',
		status: '[data-bk-run-state]',
		steps: '[data-bk-steps]',
		line: '[data-bk-line]',
		failure: '[data-bk-fail]',
		start: '[data-bk-run-go]',
		stop: '[data-bk-stop]',
		again: '[data-bk-new]',
		seeNew: '[data-bk-view-new]',
		error: '[data-bk-parts-error]',
	});

	const plan = partsOf(pick('[data-bk-plan]', root), { save: '[data-bk-plan-save]' });
	const unsavedBadge = pick('[data-bk-dirty]', root);

	/* Moving state: the table's current view, the drawer, dialogs and the job. */
	let chart = null;
	let tableView = [];
	let highlightSerial = null;
	let pagerApi = null;
	const pagerSettings = {
		total: 1,
		perPage: 8,
		noun: 'restore points',
		render(first, last) {
			table.rows.innerHTML = tableView
				.slice(first - 1, last)
				.map(rowMarkup)
				.join('');
			if (window.Basalt.tips) window.Basalt.tips(table.rows);
			highlightSerial = null;
		},
	};

	let detailList = [];
	let detailIndex = 0;
	let detailOpener = null;

	let removalBatch = [];
	let removalOpener = null;

	let restoreTarget = null;
	let restoreOpener = null;
	let restoreRunning = false;

	let activeJob = null;
	let newestManual = null;
	let savedSchedule = null;

	/** Wires every control, paints the first screen, then reveals the table. */
	function start() {
		savedSchedule = readSchedule();
		wireChart();
		wireStrip();
		wireTable();
		wireDetails();
		wireRemoval();
		wireStorageButtons();
		wireRestore();
		wireBackupCard();
		wireSchedule();

		paintEstimate();
		resetBackup(false);
		paintFigures();
		paintStorage();
		paintNights();
		paintPlanSummary();
		paintSkeleton();
		setTimeout(() => {
			table.grid.setAttribute('aria-busy', 'false');
			paintTable(false);
		}, 700);
	}

	/** Redraws everything that depends on the list of restore points. */
	function refreshAll() {
		paintFigures();
		paintStorage();
		paintNights();
		paintTable(!highlightSerial);
		if (highlightSerial) revealSerial(highlightSerial);
		paintPlanSummary();
		if (chart) paintChart(false);
		if (!detailList.length || !detail.classList.contains('show')) return;
		detailList = detailList.filter((point) => restorePoints.includes(point));
		detailIndex = Math.min(detailIndex, detailList.length - 1);
		fillDetails();
	}

	/* Small shared helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	/** Looks up a card's own element as `host`, then each named part inside it. */
	function partsOf(host, selectors) {
		const found = { host };
		for (const [name, selector] of Object.entries(selectors)) found[name] = pick(selector, host);
		return found;
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function say(message) {
		window.Basalt.announce?.(message);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function setButtonState(button, state) {
		window.Basalt.buttonState?.(button, state);
	}

	function htmlSafe(value) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
		return String(value).replace(/[&<>"]/g, (char) => entities[char]);
	}

	/** Mulberry32: a tiny repeatable generator returning numbers in [0, 1). */
	function seededRandom(seedValue) {
		let state = seedValue >>> 0;
		return () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* Dates, sizes and counts as people read them. */

	function twoDigits(number) {
		return String(number).padStart(2, '0');
	}

	function dateAt(year, month, day, hour, minute) {
		return new Date(year, month, day, hour, minute || 0);
	}

	function monthDay(date) {
		return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
	}

	function timeOfDay(date) {
		const hours = date.getHours();
		const minutes = date.getMinutes();
		if (minutes === 0 && hours === 0) return 'midnight';
		if (minutes === 0 && hours === 12) return 'noon';
		const meridiem = hours < 12 ? 'am' : 'pm';
		return `${hours % 12 || 12}:${twoDigits(minutes)} ${meridiem}`;
	}

	function stamp(date) {
		return `${monthDay(date)}, ${timeOfDay(date)}`;
	}

	/** Like stamp(), with the year added when it is not the demo's year. */
	function stampWithYear(date) {
		const year = date.getFullYear();
		return year === CLOCK.getFullYear() ? stamp(date) : `${stamp(date)}, ${year}`;
	}

	function relative(date) {
		const minutes = Math.round((CLOCK - date) / 60000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} h ago`;
		const days = Math.round(hours / 24);
		if (days === 1) return 'yesterday';
		return days < 45 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
	}

	function formatGb(gigabytes) {
		const digits = gigabytes >= 10 ? 1 : 2;
		return `${gigabytes.toFixed(digits)} GB`;
	}

	/** Under a gigabyte reads better in megabytes. */
	function sizeWords(gigabytes) {
		return gigabytes < 1 ? `${Math.round(gigabytes * 1000)} MB` : formatGb(gigabytes);
	}

	function withCommas(number) {
		return number.toLocaleString('en-US');
	}

	function duration(totalSeconds) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return minutes ? `${minutes} min ${seconds} s` : `${seconds} s`;
	}

	/* Building the demo restore points. */

	function buildHistory() {
		const points = [];
		const nightNotes = {
			15: {
				outcome: 'fail',
				note: 'The photo storage did not answer within 30 seconds. Nothing was kept from this night.',
				sizeGb: 0,
				seconds: 41,
			},
			8: {
				outcome: 'warn',
				note: '3 product photos were being replaced while the copy ran and were skipped. Everything else is complete.',
			},
		};
		for (let back = 0; back < 30; back++) {
			const night = new Date(CLOCK.getFullYear(), CLOCK.getMonth(), CLOCK.getDate() - back, 2, 0);
			points.push(createPoint(night, 'night', { ...nightNotes[back] }));
		}

		/* Weekly copies run on Sundays ahead of the nightly slot; monthly ones on the 1st. */
		const sundays = [dateAt(2026, 7, 30, 2), dateAt(2026, 7, 23, 2), dateAt(2026, 7, 16, 2), dateAt(2026, 7, 9, 2)];
		for (const sunday of sundays) points.push(createPoint(sunday, 'week'));
		const firsts = [
			dateAt(2026, 7, 1, 2),
			dateAt(2026, 6, 1, 2),
			dateAt(2026, 5, 1, 2),
			dateAt(2026, 4, 1, 2),
			dateAt(2026, 3, 1, 2),
			dateAt(2026, 2, 1, 2),
		];
		for (const first of firsts) points.push(createPoint(first, 'month'));

		const byHand = [
			[dateAt(2026, 8, 18, 16, 42), { label: 'Before the autumn price change', takenBy: STAFF[0], seconds: 351 }],
			[
				dateAt(2026, 8, 5, 10, 15),
				{ label: 'Before a theme update', takenBy: STAFF[1], covers: { photos: false }, seconds: 142 },
			],
			[dateAt(2026, 7, 12, 9, 30), { label: 'Before a new payment provider', takenBy: STAFF[0], pinned: true }],
			[
				dateAt(2026, 6, 20, 14, 5),
				{
					label: 'Before importing the accessories range',
					takenBy: STAFF[2],
					covers: { photos: false, settings: false },
					seconds: 118,
				},
			],
		];
		for (const [when, overrides] of byHand) points.push(createPoint(when, 'manual', overrides));
		return points;
	}

	/**
	 * One restore point. Size and duration always draw from the shared
	 * generator, in that order, even when the overrides replace them.
	 */
	function createPoint(takenAt, category, overrides = {}) {
		const age = Math.max(0, Math.round((CLOCK - takenAt) / DAY_MS));
		const covers = { ...EVERY_SECTION, ...overrides.covers };
		const reference = `bk-${takenAt.getFullYear()}${twoDigits(takenAt.getMonth() + 1)}${twoDigits(takenAt.getDate())}-${twoDigits(takenAt.getHours())}${twoDigits(takenAt.getMinutes())}`;
		const sizeGb = estimateSize(age, covers);
		const seconds = 300 + Math.round(nextRandom() * 110);
		return {
			reference,
			serial: ++serialCounter,
			takenAt,
			category,
			label: '',
			outcome: 'ok',
			note: '',
			takenBy: 'Schedule',
			pinned: false,
			mirrored: true,
			sizeGb,
			seconds,
			counts: countsFor(age, covers),
			...overrides,
			covers,
		};
	}

	function estimateSize(age, covers) {
		let total = 0;
		for (const [key, section] of Object.entries(SECTIONS)) {
			if (covers[key]) total += section.weightGb;
		}
		return Math.max(0.01, total * (1 - age * 0.0016) + (nextRandom() - 0.5) * 0.03);
	}

	/* Older copies hold a little less; the key order is what downloads print. */
	function countsFor(age, covers) {
		const shrink = 1 - age * 0.0016;
		return {
			orders: covers.orders ? Math.round(18412 * shrink) : 0,
			customers: covers.orders ? Math.round(6930 * shrink) : 0,
			products: covers.products ? 214 - Math.floor(age / 25) : 0,
			photos: covers.photos ? Math.round(2806 * shrink) : 0,
			settings: Boolean(covers.settings),
		};
	}

	/* Questions asked of the list. */

	function isUsable(point) {
		return point.outcome !== 'fail';
	}

	function newestFirst(a, b) {
		return b.takenAt - a.takenAt;
	}

	function usableSize(points) {
		let total = 0;
		for (const point of points) {
			if (isUsable(point)) total += point.sizeGb;
		}
		return total;
	}

	function usedSpace() {
		return usableSize(restorePoints);
	}

	function mostRecent() {
		return restorePoints.filter(isUsable).sort(newestFirst)[0];
	}

	function pointBySerial(serial) {
		return restorePoints.find((point) => point.serial === serial);
	}

	function outcomeBadge(point) {
		return STATUS_BADGES[point.outcome] ?? STATUS_BADGES.ok;
	}

	function retentionText(point) {
		if (point.pinned) return 'Kept forever';
		if (['manual', 'safety'].includes(point.category)) return 'Until you delete it';
		const days = RETENTION_DAYS[point.category] || 30;
		const clearedOn = new Date(+point.takenAt + days * DAY_MS);
		return `${monthDay(clearedOn)}, ${clearedOn.getFullYear()}`;
	}

	/* Hero figures and the storage card. */

	function paintFigures() {
		const last = mostRecent();
		const figures = {
			last: last ? relative(last.takenAt) : 'never',
			count: String(restorePoints.filter(isUsable).length),
			used: `${Math.round((usedSpace() / storageLimit) * 100)}%`,
		};
		for (const [key, text] of Object.entries(figures)) {
			pick(`[data-bk-fig="${key}"]`, root).textContent = text;
		}
	}

	function paintStorage() {
		const used = usedSpace();
		const percent = Math.round((used / storageLimit) * 100);
		const ring = pick('[data-bk-room-ring]', root);
		ring.style.setProperty('--value', String(Math.min(100, percent)));
		ring.classList.toggle('basalt-ring-warning', percent >= 80 && percent < 95);
		ring.classList.toggle('basalt-ring-danger', percent >= 95);
		ring.setAttribute('aria-label', `${percent}% of the backup storage used`);
		pick('[data-bk-room-pct]', root).textContent = `${percent}%`;
		pick('[data-bk-room-used]', root).textContent = formatGb(used);
		pick('.bk-room-of', root).textContent = `of ${storageLimit} GB`;
		pick('[data-bk-quota]', root).textContent = `${storageLimit} GB`;

		const free = storageLimit - used;
		const fullOn = new Date(+CLOCK + Math.floor(free / DAILY_GROWTH_GB) * DAY_MS);
		pick('[data-bk-room-note]', root).textContent =
			free > 0
				? `${formatGb(free)} free. At the current pace that lasts until about ${monthDay(fullOn)}.`
				: 'Storage is full. New backups will clear the oldest copies first.';
		paintBands(Math.max(0, free));
	}

	function paintBands(free) {
		const bands = STORAGE_BANDS.map((band) => ({
			...band,
			gigabytes: usableSize(restorePoints.filter((point) => band.kinds.includes(point.category))),
		}));
		const segments = bands.map(
			(band) =>
				`<span class="bk-split-seg bk-tone-${band.tone}" style="flex-grow:${band.gigabytes.toFixed(3)}"></span>`,
		);
		segments.push(`<span class="bk-split-seg bk-split-seg-free" style="flex-grow:${free.toFixed(3)}"></span>`);
		pick('[data-bk-split-bar]', root).innerHTML = segments.join('');

		const legend = bands.map(
			(band) =>
				`<li><span class="bk-swatch bk-tone-${band.tone}" aria-hidden="true"></span>${band.title}<strong>${formatGb(band.gigabytes)}</strong></li>`,
		);
		legend.push(
			`<li><span class="bk-swatch bk-swatch-free" aria-hidden="true"></span>Free<strong>${formatGb(free)}</strong></li>`,
		);
		pick('[data-bk-split-legend]', root).innerHTML = legend.join('');
	}

	/* The storage chart: sixty days behind, thirty ahead, and the limit line. */

	function wireChart() {
		if (!canvas) return;
		document.addEventListener('basalt:appearance', repaintForTheme);
		if (typeof IntersectionObserver !== 'function') {
			paintChart(false);
			return;
		}
		/* The chart draws, with its entrance, once it scrolls near the screen. */
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watcher.disconnect();
				paintChart(true);
			},
			{ rootMargin: '80px 0px' },
		);
		watcher.observe(canvas);
	}

	function repaintForTheme() {
		if (chart) requestAnimationFrame(() => paintChart(false));
	}

	function paintChart(animate) {
		if (!canvas || typeof Chart === 'undefined') return;
		chart?.destroy();
		const palette = chartColors();
		const series = storageSeries();
		pick('[data-bk-chart-desc]', root).textContent =
			`Room used rose from ${formatGb(series.used[0])} sixty days ago to ${formatGb(usedSpace())} today, and is heading toward the ${storageLimit} GB limit.`;
		const wash = window.Basalt.chartFill(
			[
				[0, translucent(palette.used, 0.24)],
				[1, translucent(palette.used, 0)],
			],
			{ flat: translucent(palette.used, 0.12) },
		);
		chart = new Chart(canvas, {
			type: 'line',
			data: { labels: series.days, datasets: chartDatasets(series, palette, wash) },
			options: chartOptions(palette, animate),
		});
	}

	function chartColors() {
		const text = themeToken('--basalt-copy', '#12233a');
		return {
			text,
			quiet: blend(themeToken('--basalt-copy-muted', '#5f7186'), text, 0.82),
			used: themeToken('--basalt-series-1', '#2b6fd4'),
			ahead: themeToken('--basalt-series-3', '#9b60f2'),
			limit: themeToken('--basalt-danger', '#ef4d63'),
			surface: themeToken('--basalt-plane', '#ffffff'),
			edge: themeToken('--basalt-edge-strong', 'rgba(16,42,72,.15)'),
		};
	}

	function chartDatasets(series, palette, wash) {
		const flat = { pointRadius: 0, borderWidth: 2 };
		return [
			{
				...flat,
				label: 'Used',
				data: series.used,
				borderColor: palette.used,
				backgroundColor: wash,
				fill: true,
				tension: 0.3,
				pointHoverRadius: 4,
				pointHoverBorderColor: palette.surface,
			},
			{
				...flat,
				label: 'At this pace',
				data: series.ahead,
				borderColor: palette.ahead,
				borderDash: [5, 5],
				tension: 0.2,
				pointHoverRadius: 4,
				fill: false,
			},
			{
				...flat,
				label: 'Your limit',
				data: series.days.map(() => storageLimit),
				borderColor: translucent(palette.limit, 0.8),
				borderDash: [2, 4],
				borderWidth: 1.5,
				pointHoverRadius: 0,
				fill: false,
			},
		];
	}

	function chartOptions(palette, animate) {
		const family = "'Schibsted Grotesk', sans-serif";
		const tickFont = { family, size: 11.5 };
		const hidden = () => ({ display: false });
		return {
			animation: animate && !prefersStill ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { intersect: false, mode: 'index' },
			maintainAspectRatio: false,
			responsive: true,
			layout: { padding: { top: 6, right: 6 } },
			plugins: {
				legend: {
					display: true,
					position: 'bottom',
					align: 'start',
					labels: {
						color: palette.quiet,
						boxWidth: 18,
						boxHeight: 2,
						padding: 14,
						font: { family, size: 12 },
					},
				},
				tooltip: {
					titleColor: palette.text,
					bodyColor: palette.text,
					backgroundColor: palette.surface,
					borderColor: palette.edge,
					borderWidth: 1,
					padding: 10,
					cornerRadius: 8,
					titleFont: { family, size: 12, weight: '600' },
					bodyFont: { family, size: 12 },
					filter: (item) => item.raw != null,
					callbacks: { label: (context) => ` ${context.dataset.label}: ${context.raw} GB` },
				},
			},
			scales: {
				x: {
					grid: hidden(),
					border: hidden(),
					ticks: { color: palette.quiet, maxRotation: 0, autoSkipPadding: 18, font: tickFont },
				},
				y: {
					suggestedMin: 40,
					suggestedMax: storageLimit + 2,
					grid: { color: translucent(palette.text, 0.07) },
					border: hidden(),
					ticks: {
						color: palette.quiet,
						maxTicksLimit: 5,
						callback: (value) => `${value} GB`,
						font: tickFont,
					},
				},
			},
		};
	}

	/** Past usage with a little noise, then a straight projection from today. */
	function storageSeries() {
		const today = usedSpace();
		const wobble = seededRandom(7);
		const series = { days: [], used: [], ahead: [] };
		for (let offset = -59; offset <= 30; offset++) {
			const day = new Date(+CLOCK + offset * DAY_MS);
			series.days.push(monthDay(day));
			if (offset > 0) {
				series.used.push(null);
				series.ahead.push(+(today + offset * DAILY_GROWTH_GB).toFixed(2));
				continue;
			}
			/* An old monthly copy is cleared on each 1st, so the line dips there. */
			const dip = day.getDate() === 1 ? 1.1 : 0;
			series.used.push(+(today + offset * DAILY_GROWTH_GB - dip + (wobble() - 0.5) * 0.35).toFixed(2));
			series.ahead.push(offset === 0 ? +today.toFixed(2) : null);
		}
		return series;
	}

	function themeToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function rgbOf(color) {
		const text = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(text);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16));
		const long = /^#([0-9a-f]{6})$/i.exec(text);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
		if (functional)
			return functional[1]
				.split(',')
				.slice(0, 3)
				.map((part) => parseFloat(part));
		return [128, 128, 128];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = rgbOf(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors; `weight` is the share of the first one. */
	function blend(first, second, weight) {
		const from = rgbOf(first);
		const to = rgbOf(second);
		const [red, green, blue] = from.map((channel, index) =>
			Math.round(channel * weight + to[index] * (1 - weight)),
		);
		return `rgb(${red}, ${green}, ${blue})`;
	}

	/* The last thirty nights: one button each, a single tab stop, arrows move. */

	function wireStrip() {
		strip.addEventListener('keydown', (event) => {
			const buttons = pickAll('.bk-night', strip);
			const at = buttons.indexOf(document.activeElement);
			if (at < 0) return;
			const move = STRIP_MOVES.get(event.key);
			if (!move) return;
			event.preventDefault();
			const target = move(at, buttons.length);
			buttons[at].tabIndex = -1;
			buttons[target].tabIndex = 0;
			buttons[target].focus();
		});
		strip.addEventListener('click', (event) => {
			const night = event.target.closest('.bk-night');
			if (!night) return;
			for (const button of pickAll('.bk-night', strip)) button.tabIndex = button === night ? 0 : -1;
			openDetails(+night.getAttribute('data-uid'), night);
		});
	}

	function paintNights() {
		const nights = restorePoints
			.filter((point) => point.category === 'night')
			.sort((a, b) => a.takenAt - b.takenAt);
		const keepFocus = strip.contains(document.activeElement)
			? document.activeElement.getAttribute('data-uid')
			: null;
		const lastIndex = nights.length - 1;
		strip.innerHTML = nights
			.map((point, index) => {
				const look = NIGHT_LOOKS[point.outcome] ?? NIGHT_LOOKS.ok;
				const words = look.words(point);
				const day = monthDay(point.takenAt);
				return `<button type="button" class="bk-night bk-night-${look.tone}" data-uid="${point.serial}" tabindex="${index === lastIndex ? '0' : '-1'}" aria-label="${day}, ${words}" data-bs-toggle="tooltip" data-bs-title="${day}: ${words}"></button>`;
			})
			.join('');
		window.Basalt.tips?.(strip);
		if (keepFocus) pick(`[data-uid="${keepFocus}"]`, strip)?.focus();
	}

	/* The restore point table: search, filter, order and pages. */

	function wireTable() {
		table.search.addEventListener('input', () => paintTable(false));
		table.order.addEventListener('change', () => paintTable(false));
		for (const radio of pickAll('input[name="bk-kind"]', table.host)) {
			radio.addEventListener('change', () => paintTable(false));
		}
		pick('[data-bk-clear]', table.host).addEventListener('click', () => {
			const showAll = pick('#bk-kind-all');
			table.search.value = '';
			showAll.checked = true;
			showAll.dispatchEvent(new Event('change', { bubbles: true }));
			paintTable(false);
			table.search.focus();
		});
		table.rows.addEventListener('click', onRowClick);
	}

	function onRowClick(event) {
		const row = event.target.closest('tr[data-uid]');
		if (!row) return;
		const point = pointBySerial(+row.getAttribute('data-uid'));
		if (!point) return;
		const hit = (hook) => event.target.closest(`[data-bk-${hook}]`);
		const anchor = pick('.bk-when', row);
		if (hit('open')) return openDetails(point.serial, anchor);
		if (hit('restore')) return openRestore(point, event.target.closest('button'));
		if (hit('download')) return downloadPoint(point, event.target.closest('button'));
		if (hit('copy-id')) {
			window
				.basaltCopyText(point.reference)
				.then(() =>
					notify({ tone: 'success', title: 'Reference copied', text: point.reference, duration: 3000 }),
				);
			return;
		}
		if (hit('keep')) return togglePinned(point, anchor);
		if (hit('delete')) confirmRemoval([point], anchor);
	}

	function narrowList() {
		const query = table.search.value.trim().toLowerCase();
		const filter = pick('input[name="bk-kind"]:checked', table.host)?.value || 'all';
		const test = CATEGORY_FILTERS[filter];
		tableView = restorePoints.filter((point) => (!test || test(point)) && fitsSearch(point, query));
		tableView.sort(ORDERINGS[table.order.value] || newestFirst);
	}

	function fitsSearch(point, query) {
		if (!query) return true;
		const when = point.takenAt;
		const haystack = [
			stamp(when),
			`${MONTH_NAMES[when.getMonth()]} ${when.getDate()}, ${when.getFullYear()}`,
			point.label,
			KINDS[point.category].title,
			point.takenBy,
			point.reference,
		]
			.join(' ')
			.toLowerCase();
		return query.split(/\s+/).every((word) => haystack.includes(word));
	}

	/**
	 * Shows the filtered list, or the empty note. The shared pager remembers
	 * its own total, so its page-size select is poked to make it count again.
	 */
	function paintTable(stayOnPage) {
		narrowList();
		const nothing = tableView.length === 0;
		table.empty.hidden = !nothing;
		table.pager.hidden = nothing;
		pick('.table-responsive', table.host).hidden = nothing;
		if (nothing) {
			const typed = table.search.value.trim();
			pick('[data-bk-empty-text]', table.empty).textContent = typed
				? `Nothing matches “${typed}”. Try a month like “Sep” or a name.`
				: 'None of this kind yet. Show all of them to see the rest.';
			table.rows.innerHTML = '';
			return;
		}
		pagerSettings.total = tableView.length;
		if (!pagerApi) {
			pagerApi = window.Basalt.pager(table.pager, pagerSettings);
			return;
		}
		const returnTo = stayOnPage ? pagerApi.get() : 1;
		pagerApi.set(1);
		pick('[data-basalt-pager-size]', table.pager).dispatchEvent(new Event('change'));
		if (returnTo > 1) pagerApi.set(returnTo);
	}

	/** Turns the pager to whichever page holds this restore point. */
	function revealSerial(serial) {
		const index = tableView.findIndex((point) => point.serial === serial);
		if (index < 0 || !pagerApi) return;
		const pageSize = parseInt(pick('[data-basalt-pager-size]', table.pager).value, 10);
		pagerApi.set(Math.floor(index / pageSize) + 1);
	}

	function paintSkeleton() {
		const bar = (extra) => `<span class="basalt-skeleton basalt-skeleton-text ${extra}"></span>`;
		const row = `<tr class="bk-skel" aria-hidden="true"><td>${bar('bk-skel-a')}${bar('bk-skel-b')}</td><td>${bar('bk-skel-c')}</td><td>${bar('bk-skel-c ms-auto')}</td><td>${bar('bk-skel-c')}</td><td><span class="basalt-skeleton basalt-skeleton-btn bk-skel-d ms-auto"></span></td></tr>`;
		table.rows.innerHTML = row.repeat(5);
	}

	function rowMarkup(point) {
		const flash = point.serial === highlightSerial ? ' class="is-new"' : '';
		const cells = [whenCell(point), categoryCell(point), sizeCell(point), stateCell(point), actionsCell(point)];
		return `<tr data-uid="${point.serial}"${flash}>${cells.join('')}</tr>`;
	}

	function whenCell(point) {
		const title = stamp(point.takenAt);
		const below = point.label ? htmlSafe(point.label) : relative(point.takenAt);
		return `<td><button type="button" class="bk-when" data-bk-open aria-label="Open ${title} restore point"><span class="bk-when-date">${stampWithYear(point.takenAt)}</span><span class="bk-when-sub">${below}</span></button></td>`;
	}

	function categoryCell(point) {
		const { glyph, title } = KINDS[point.category];
		return `<td><span class="bk-kind"><i class="bi ${glyph}" aria-hidden="true"></i>${title}</span></td>`;
	}

	function sizeCell(point) {
		return `<td class="text-end bk-num">${isUsable(point) ? formatGb(point.sizeGb) : 'Nothing kept'}</td>`;
	}

	function stateCell(point) {
		const pin = point.pinned
			? '<span class="bk-pin" data-bs-toggle="tooltip" data-bs-title="Kept forever" tabindex="0" role="img" aria-label="Kept forever"><i class="bi bi-pin-angle-fill" aria-hidden="true"></i></span>'
			: '';
		return `<td><span class="bk-state">${outcomeBadge(point)}${pin}</span></td>`;
	}

	function actionsCell(point) {
		const title = stamp(point.takenAt);
		const usable = isUsable(point);
		const leading = usable
			? `${downloadButton(title)}<button type="button" class="btn btn-sm btn-outline-secondary" data-bk-restore>Restore</button>`
			: '<button type="button" class="btn btn-sm btn-outline-secondary" data-bk-open>Details</button>';
		const menuItem = (hook, glyph, text, extra = '') =>
			`<li><button type="button" class="dropdown-item${extra}" data-bk-${hook}><i class="bi ${glyph}" aria-hidden="true"></i>${text}</button></li>`;
		const items = [
			menuItem('open', 'bi-info-circle', 'Details'),
			menuItem('copy-id', 'bi-copy', 'Copy reference'),
			usable
				? menuItem(
						'keep',
						point.pinned ? 'bi-pin-angle' : 'bi-pin-angle-fill',
						point.pinned ? 'Stop keeping forever' : 'Keep forever',
					)
				: '',
			'<li><hr class="dropdown-divider"></li>',
			menuItem('delete', 'bi-trash3', 'Delete', ' text-danger'),
		];
		const toggle = `<button type="button" class="btn btn-sm btn-outline-secondary btn-icon" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${title}"><i class="bi bi-three-dots" aria-hidden="true"></i></button>`;
		return `<td class="text-end"><div class="bk-actions">${leading}<div class="dropdown">${toggle}<ul class="dropdown-menu dropdown-menu-end">${items.join('')}</ul></div></div></td>`;
	}

	/* The download button carries all four loading states the shared helper flips between. */
	function downloadButton(title) {
		const states = [
			['idle', '<i class="bi bi-download" aria-hidden="true"></i>'],
			['busy', '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>'],
			['done', '<i class="bi bi-check2" aria-hidden="true"></i>'],
			['fail', '<i class="bi bi-x-lg" aria-hidden="true"></i>'],
		];
		const inner = states
			.map(([state, icon]) => `<span class="btn-loading-state btn-loading-${state}">${icon}</span>`)
			.join('');
		return `<button type="button" class="btn btn-sm btn-outline-secondary btn-icon btn-loading bk-dl" data-bk-download aria-label="Download the ${title} backup" data-bs-toggle="tooltip" data-bs-title="Download">${inner}</button>`;
	}

	/* Downloading saves the backup's contents list; the archive itself would come from the service. */

	function downloadPoint(point, button) {
		if (!isUsable(point)) return;
		if (button) setButtonState(button, 'loading');
		const progress = notify({
			tone: 'loading',
			title: `Preparing ${monthDay(point.takenAt)} backup`,
			text: `${formatGb(point.sizeGb)} to package`,
			duration: 0,
		});
		setTimeout(() => {
			saveContentsFile(point);
			if (button?.isConnected) setButtonState(button, 'success');
			progress?.update({
				tone: 'success',
				title: 'Download started',
				text: `The file list is saved. A link to the full ${formatGb(point.sizeGb)} backup is on its way to your email.`,
				duration: 6000,
			});
			setTimeout(() => {
				if (button?.isConnected) setButtonState(button, 'idle');
			}, 1600);
		}, 1300);
	}

	function saveContentsFile(point) {
		const contents = {
			reference: point.reference,
			taken: point.takenAt.toISOString(),
			kind: KINDS[point.category].title,
			name: point.label || null,
			size_gb: +point.sizeGb.toFixed(2),
			contents: point.counts,
		};
		try {
			const blob = new Blob([JSON.stringify(contents, null, 2)], { type: 'application/json' });
			const href = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = href;
			link.download = `${point.reference}-contents.json`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(href), 1000);
		} catch {
			/* A blocked download is fine here; the toast already says what happens next. */
		}
	}

	function togglePinned(point, returnFocus) {
		point.pinned = !point.pinned;
		paintTable(true);
		fillDetails();
		const ending = point.pinned
			? ' will not be cleared out by the schedule.'
			: ' will be cleared out with the others of its kind.';
		notify({
			tone: 'success',
			title: point.pinned ? 'Kept forever' : 'No longer kept forever',
			text: `${stamp(point.takenAt)}${ending}`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						point.pinned = !point.pinned;
						paintTable(true);
						fillDetails();
					},
				},
			],
		});
		if (returnFocus && !returnFocus.isConnected)
			pick(`tr[data-uid="${point.serial}"] .bk-when`, table.rows)?.focus();
	}

	/* The details drawer, which pages through whatever list it was opened from. */

	function detailField(name) {
		return pick(`[data-bk-d="${name}"]`, detail);
	}

	function wireDetails() {
		if (!detail) return;
		detail.addEventListener('show.bs.offcanvas', () => requestAnimationFrame(fillDetails));
		pick('[data-basalt-record-prev]', detail).addEventListener('click', () => stepDetails(-1));
		pick('[data-basalt-record-next]', detail).addEventListener('click', () => stepDetails(1));
		detail.addEventListener('keydown', (event) => {
			const direction = { ArrowUp: -1, ArrowDown: 1 }[event.key];
			if (!event.altKey || !direction) return;
			event.preventDefault();
			stepDetails(direction);
		});
		detail.addEventListener('hidden.bs.offcanvas', () => {
			if (detailOpener?.isConnected) detailOpener.focus();
		});

		const pinSwitch = detailField('keep');
		pinSwitch.addEventListener('change', () => {
			const point = detailList[detailIndex];
			if (point && point.pinned !== pinSwitch.checked) togglePinned(point);
		});
		detailField('download').addEventListener('click', () =>
			downloadPoint(detailList[detailIndex], detailField('download')),
		);
		detailField('restore').addEventListener('click', () => {
			const point = detailList[detailIndex];
			afterDetailsClose(() => openRestore(point, detailOpener));
		});
		detailField('delete').addEventListener('click', () => {
			const point = detailList[detailIndex];
			const backTo = detailOpener;
			afterDetailsClose(() => confirmRemoval([point], backTo));
		});
	}

	/** Closes the drawer without handing focus back, then runs the next step. */
	function afterDetailsClose(next) {
		detail.addEventListener('hidden.bs.offcanvas', next, { once: true });
		detailOpener = null;
		detailPanel.hide();
	}

	function openDetails(serial, opener) {
		if (!detailPanel) return;
		narrowList();
		const inView = tableView.some((point) => point.serial === serial);
		detailList = inView ? [...tableView] : [...restorePoints].sort(newestFirst);
		detailIndex = Math.max(
			0,
			detailList.findIndex((point) => point.serial === serial),
		);
		detailOpener = opener || null;
		detailPanel.show();
		fillDetails();
	}

	function stepDetails(direction) {
		const count = detailList.length;
		if (!count) return;
		detailIndex = (detailIndex + direction + count) % count;
		detail.classList.toggle('is-back', direction < 0);
		fillDetails();
		if (prefersStill) return;
		/* Clearing and restoring the animation replays each block's entrance. */
		for (const block of pickAll(':scope > *', pick('.offcanvas-body', detail))) {
			block.style.animation = 'none';
			void block.offsetWidth;
			block.style.animation = '';
		}
	}

	function fillDetails() {
		const point = detailList[detailIndex];
		if (!point) return;
		const category = KINDS[point.category];
		const usable = isUsable(point);
		const subtitle = [point.label, category.title, relative(point.takenAt)].filter(Boolean).join(' · ');

		detailField('icon').innerHTML = `<i class="bi ${category.glyph}"></i>`;
		detailField('title').textContent = stampWithYear(point.takenAt);
		detailField('sub').textContent = subtitle;
		detailField('status').innerHTML = outcomeBadge(point);
		const problem = detailField('problem');
		problem.hidden = !point.note;
		problem.innerHTML = point.note
			? `<i class="bi bi-info-circle" aria-hidden="true"></i><span>${htmlSafe(point.note)}</span>`
			: '';

		detailField('size').textContent = usable ? formatGb(point.sizeGb) : 'Nothing kept';
		detailField('took').textContent = duration(point.seconds);
		detailField('until').textContent = usable ? retentionText(point) : 'Cleared tomorrow';
		detailField('by').textContent = point.takenBy;
		detailField('inside').innerHTML = usable
			? contentRows(point)
					.map(
						([glyph, name, amount]) =>
							`<li><i class="bi ${glyph}" aria-hidden="true"></i><span>${name}</span><strong>${amount}</strong></li>`,
					)
					.join('')
			: '<li><i class="bi bi-dash-circle" aria-hidden="true"></i><span>Nothing. The copy stopped before it finished.</span></li>';
		detailField('where').innerHTML = usable
			? storedAt(point)
			: '<li><i class="bi bi-dash-circle" aria-hidden="true"></i><span>Not stored</span></li>';

		detailField('id').textContent = point.reference;
		detailField('copy').setAttribute('data-basalt-copy', point.reference);
		const pinSwitch = detailField('keep');
		pinSwitch.checked = point.pinned;
		pinSwitch.disabled = !usable;
		pinSwitch.closest('.bk-drawer-keep').hidden = !usable;
		detailField('download').hidden = !usable;
		detailField('restore').hidden = !usable;
		pick('[data-basalt-record-pos]', detail).textContent = `${detailIndex + 1} of ${detailList.length}`;
	}

	function contentRows(point) {
		const { covers, counts } = point;
		const rows = [];
		if (covers.orders)
			rows.push(
				['bi-receipt', 'Orders', withCommas(counts.orders)],
				['bi-people', 'Customers', withCommas(counts.customers)],
			);
		if (covers.products) rows.push(['bi-box-seam', 'Products', withCommas(counts.products)]);
		if (covers.photos) rows.push(['bi-images', 'Photos', withCommas(counts.photos)]);
		if (covers.settings) rows.push(['bi-sliders', 'Shop settings', 'All']);
		return rows;
	}

	function storedAt(point) {
		const second = point.mirrored
			? '<i class="bi bi-check-circle-fill bk-ok" aria-hidden="true"></i><span>Second copy, Kalamazoo</span>'
			: '<i class="bi bi-dash-circle" aria-hidden="true"></i><span>No second copy</span>';
		return `<li><i class="bi bi-check-circle-fill bk-ok" aria-hidden="true"></i><span>Main copy, Oregon</span></li><li>${second}</li>`;
	}

	/* Deleting one restore point or several: hold the button to confirm, undo after. */

	function removalField(name) {
		return pick(`[data-bk-del="${name}"]`, removal);
	}

	function wireRemoval() {
		if (!removal) return;
		removalField('go').addEventListener('basalt:confirm', () => {
			const removed = [...removalBatch];
			restorePoints = restorePoints.filter((point) => !removed.includes(point));
			setTimeout(() => {
				removalModal.hide();
				refreshAll();
				reportRemoval(removed);
			}, 450);
		});
		removal.addEventListener('hidden.bs.modal', () => {
			(removalOpener?.isConnected ? removalOpener : table.search).focus();
			removalOpener = null;
		});
	}

	function reportRemoval(removed) {
		const single = removed.length === 1;
		notify({
			tone: 'success',
			title: single ? 'Restore point deleted' : `${removed.length} restore points deleted`,
			text: single ? `${stamp(removed[0].takenAt)} is gone.` : `Freed ${formatGb(usableSize(removed))}.`,
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						restorePoints = restorePoints.concat(removed);
						refreshAll();
						say('Restore points put back');
					},
				},
			],
		});
	}

	function confirmRemoval(points, opener) {
		if (!removalModal || !points.length) return;
		removalBatch = points;
		removalOpener = opener || null;
		const freed = usableSize(points);
		const single = points.length === 1;
		const sentences = [
			freed ? `This frees ${formatGb(freed)}. ` : '',
			points.some((point) => point.pinned) ? 'It was set to keep forever. ' : '',
			'You can undo it for a few seconds afterwards.',
		];
		removalField('title').textContent = single
			? `Delete the ${stamp(points[0].takenAt)} restore point?`
			: `Delete ${points.length} old restore points?`;
		removalField('text').textContent = sentences.join('');
		removalField('list').innerHTML = points
			.map((point) => {
				const size = isUsable(point) ? ` · ${formatGb(point.sizeGb)}` : '';
				return `<li><i class="bi bi-x-circle" aria-hidden="true"></i>${stampWithYear(point.takenAt)} · ${KINDS[point.category].title}${size}</li>`;
			})
			.join('');
		removalField('label').textContent = single ? 'Hold to delete' : `Hold to delete ${points.length}`;
		removalModal.show();
	}

	/* The storage card's two buttons: clear old copies, or buy more room. */

	function wireStorageButtons() {
		pick('[data-bk-clean]', root).addEventListener('click', (event) => {
			const oldestMonthly = restorePoints
				.filter((point) => point.category === 'month' && !point.pinned)
				.sort((a, b) => a.takenAt - b.takenAt)
				.slice(0, 3);
			const failed = restorePoints.filter((point) => point.outcome === 'fail');
			const candidates = [...oldestMonthly, ...failed];
			if (candidates.length) {
				confirmRemoval(candidates, event.currentTarget);
				return;
			}
			notify({
				tone: 'info',
				title: 'Nothing old left to clear',
				text: 'Keep copies for less time in the schedule, or add more room.',
			});
		});

		pick('[data-bk-more-room]', root).addEventListener('click', (event) => {
			const button = event.currentTarget;
			if (storageLimit > 60) {
				notify({
					tone: 'info',
					title: 'You already have the extra 50 GB',
					text: `Contact us if you need more than ${storageLimit} GB.`,
				});
				return;
			}
			storageLimit += 50;
			refreshAll();
			button.innerHTML = '<i class="bi bi-check2 me-1" aria-hidden="true"></i>50 GB added';
			notify({
				tone: 'success',
				title: '50 GB added',
				text: `Backups now have ${storageLimit} GB. It adds $4 to your monthly bill.`,
				duration: 8000,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							storageLimit -= 50;
							refreshAll();
							button.innerHTML = '<i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add 50 GB';
						},
					},
				],
			});
		});
	}

	/* Restoring: pick what, read what changes, type the phrase, then watch it run. */

	function restoreField(name) {
		return pick(`[data-bk-r="${name}"]`, restoreDialog);
	}

	function wireRestore() {
		if (!restoreDialog) return;
		restoreForm.addEventListener('change', () => {
			if (restoreTarget) describeImpact();
		});
		restoreDialog.addEventListener('show.bs.modal', () => {
			window.Basalt.dialog?.clearDone(pick('.modal-content', restoreDialog));
			restoreForm.basaltSteps?.reset();
			pick('[data-bk-restoring]', restoreDialog).hidden = true;
			pick('[data-bk-restore-foot]', restoreDialog).hidden = false;
			pick('.basalt-dialog-steps', restoreDialog).hidden = false;
			pick('[data-bk-typed]', restoreDialog).basaltTyped?.reset();
			describeImpact();
		});
		restoreDialog.addEventListener('shown.bs.modal', () => {
			pick('input[name="scope"]:checked', restoreForm)?.focus();
		});
		restoreDialog.addEventListener('hide.bs.modal', (event) => {
			if (restoreRunning) event.preventDefault();
		});
		restoreDialog.addEventListener('hidden.bs.modal', () => {
			if (restoreOpener?.isConnected) restoreOpener.focus();
			restoreOpener = null;
		});
		restoreForm.addEventListener('basalt:steps-done', () => {
			const typed = pick('[data-bk-typed]', restoreDialog);
			if (restoreRunning || !typed.classList.contains('is-match')) {
				pick('input', typed).focus();
				return;
			}
			playRestore();
		});
	}

	function openRestore(point, opener) {
		if (!restoreModal || !point || !isUsable(point)) return;
		restoreTarget = point;
		restoreOpener = opener || null;
		const when = stampWithYear(point.takenAt);
		restoreField('when').textContent = when;
		restoreField('when2').textContent = when;
		/* The shared helper reads the phrase once when it wires a box up, so a
       fresh copy carrying this point's phrase replaces the old box. */
		const phrase = `restore ${monthDay(point.takenAt)}`;
		const current = pick('[data-bk-typed]', restoreDialog);
		const fresh = current.cloneNode(true);
		fresh.setAttribute('data-basalt-type-confirm', phrase);
		pick('[data-bk-r="phrase"]', fresh).textContent = phrase;
		pick('input', fresh).value = '';
		current.replaceWith(fresh);
		pick('#bk-restore-go').disabled = true;
		window.Basalt.dialog?.init(restoreDialog);
		restoreModal.show();
	}

	function describeImpact() {
		const scope = restoreForm.elements.scope.value || 'all';
		const safetyFirst = restoreForm.elements.safety.checked;
		const when = restoreTarget.takenAt;
		const days = Math.max(1, Math.round((CLOCK - when) / DAY_MS));
		const jitter = seededRandom(restoreTarget.serial * 31);
		const lines = [];
		if (scope === 'all') {
			lines.push([
				'bi-receipt',
				`${Math.round(days * (19 + jitter() * 6))} orders placed since then are set aside, not deleted. You can bring each one back from the Orders page.`,
			]);
			lines.push([
				'bi-people',
				`${Math.round(days * 3.2)} customers who signed up since then keep their accounts and passwords.`,
			]);
		}
		if (scope !== 'settings')
			lines.push([
				'bi-box-seam',
				`Stock counts and prices go back to ${stamp(when)}. ${Math.min(214, Math.round(days * 1.7 + 3))} products change.`,
			]);
		if (scope === 'products')
			lines.push(['bi-receipt', 'Orders, customers and settings are left as they are now.']);
		if (scope !== 'products')
			lines.push(['bi-sliders', 'Shipping rates, taxes and checkout settings go back to how they were.']);
		lines.push(['bi-envelope', 'Subscriptions keep billing as normal. No emails go to customers.']);

		restoreField('impact').innerHTML = lines
			.map(([glyph, text]) => `<li><i class="bi ${glyph}" aria-hidden="true"></i><span>${text}</span></li>`)
			.join('');
		restoreField('scope').textContent = SCOPE_TITLES[scope];
		restoreField('safety').textContent = safetyFirst ? 'Yes, a safety copy first' : 'No';
		restoreField('risk').hidden = safetyFirst;
	}

	function restoreStages(scope, safetyFirst, pauseShop) {
		return [
			safetyFirst && 'Taking a safety copy of the shop as it is now',
			pauseShop && 'Showing shoppers the “back soon” page',
			scope === 'all' && 'Setting aside orders placed since then',
			scope !== 'settings' && 'Putting back products, prices and stock',
			scope !== 'products' && 'Putting back shop settings',
			'Checking everything matches',
			pauseShop && 'Opening the shop again',
		].filter(Boolean);
	}

	function playRestore() {
		restoreRunning = true;
		const point = restoreTarget;
		const { scope, safety, pause } = restoreForm.elements;
		const scopeKey = scope.value;
		const safetyFirst = safety.checked;
		const stages = restoreStages(scopeKey, safetyFirst, pause.checked);

		for (const panel of pickAll('[data-basalt-step-panel]', restoreDialog)) panel.hidden = true;
		pick('.basalt-dialog-steps', restoreDialog).hidden = true;
		pick('[data-bk-restore-foot]', restoreDialog).hidden = true;
		pick('[data-bk-restoring]', restoreDialog).hidden = false;
		pick('[data-bk-restoring-title]', restoreDialog).textContent =
			`Restoring ${SCOPE_TITLES[scopeKey].toLowerCase()} to ${stamp(point.takenAt)}`;
		const meter = pick('[data-bk-restoring-bar]', restoreDialog);
		const status = pick('[data-bk-restoring-line]', restoreDialog);
		let reached = 0;

		/* One stage per beat; the bar fills before the status line moves on. */
		function nextStage() {
			const percent = Math.round((reached / stages.length) * 100);
			meter.setAttribute('aria-valuenow', String(percent));
			meter.firstElementChild.style.width = `${percent}%`;
			if (reached >= stages.length) {
				restoreRunning = false;
				finishRestore(point, scopeKey, safetyFirst);
				return;
			}
			status.textContent = `${stages[reached]}…`;
			reached += 1;
			setTimeout(nextStage, prefersStill ? 450 : 750);
		}
		nextStage();
	}

	function finishRestore(point, scopeKey, safetyFirst) {
		const when = stamp(point.takenAt);
		if (safetyFirst) {
			restorePoints.push(
				createPoint(new Date(+CLOCK + 60000), 'safety', {
					label: `Before restoring to ${monthDay(point.takenAt)}`,
					takenBy: STAFF[0],
					seconds: 280,
				}),
			);
			refreshAll();
		}
		const aside = safetyFirst
			? ' A safety copy of how things were is in the list, in case you want to go back.'
			: '';
		window.Basalt.dialog.done(
			pick('.modal-content', restoreDialog),
			`${SCOPE_TITLES[scopeKey]} now matches ${when}.${aside}`,
		);
		const undo = {
			label: 'Undo',
			onClick: () => {
				const progress = notify({
					tone: 'loading',
					title: 'Putting the shop back',
					text: 'Using the safety copy',
					duration: 0,
				});
				setTimeout(() => {
					progress?.update({
						tone: 'success',
						title: 'Shop put back',
						text: 'Everything is as it was before the restore.',
						duration: 5000,
					});
				}, 1600);
			},
		};
		notify({
			tone: 'success',
			title: 'Shop restored',
			text: `Back to ${when}.`,
			duration: 9000,
			actions: safetyFirst ? [undo] : [],
		});
	}

	/* The "Back up now" card: choose sections, run, fail on request, or stop. */

	function wireBackupCard() {
		run.form.addEventListener('change', paintEstimate);
		run.form.addEventListener('submit', (event) => {
			event.preventDefault();
			beginBackup();
		});
		pick('[data-bk-run-fail]', run.host).addEventListener('click', () => beginBackup(true));
		run.stop.addEventListener('basalt:confirm', () => {
			if (!activeJob) return;
			resetBackup(false);
			run.status.textContent = 'Stopped. Nothing was kept.';
			run.start.focus();
			notify({
				tone: 'info',
				title: 'Backup stopped',
				text: 'Nothing was kept, and the shop is unchanged.',
				duration: 5000,
			});
		});
		run.again.addEventListener('click', () => resetBackup(true));
		pick('[data-bk-retry]', run.failure).addEventListener('click', () => {
			activeJob = null;
			beginBackup();
		});
		pick('[data-bk-retry-nophotos]', run.failure).addEventListener('click', () => {
			pick('input[name="part"][value="photos"]', run.form).checked = false;
			paintEstimate();
			beginBackup();
		});
		run.seeNew.addEventListener('click', () => {
			if (newestManual) openDetails(newestManual.serial, run.seeNew);
		});

		pick('[data-bk-hero-run]', root).addEventListener('click', () => {
			run.host.scrollIntoView({ behavior: prefersStill ? 'auto' : 'smooth', block: 'start' });
			if (!activeJob) {
				if (!run.live.hidden) resetBackup(false);
				beginBackup();
			}
			run.stop.focus({ preventScroll: true });
		});
		pick('[data-bk-hero-latest]', root).addEventListener('click', (event) => {
			const latest = mostRecent();
			if (latest) openDetails(latest.serial, event.currentTarget);
		});
	}

	function pickedSections() {
		return pickAll('input[name="part"]:checked', run.form).map((box) => box.value);
	}

	function paintEstimate() {
		const keys = pickedSections();
		let weight = 0;
		let seconds = 30;
		for (const key of keys) {
			weight += SECTIONS[key].weightGb;
			seconds += SECTIONS[key].seconds;
		}
		const minutes = Math.max(1, Math.round(seconds / 60));
		pick('[data-bk-estimate]', run.host).textContent = keys.length
			? `About ${sizeWords(weight)}, ready in roughly ${minutes} minute${seconds >= 90 ? 's' : ''}.`
			: 'Nothing picked yet.';
		if (keys.length) run.error.hidden = true;
	}

	/* At rest the ring reports how many of the recent nights succeeded. */
	function idleRing() {
		const nights = restorePoints.filter((point) => point.category === 'night');
		const finished = nights.filter((point) => point.outcome !== 'fail').length;
		run.ring.className = 'basalt-ring basalt-ring-success bk-run-ring';
		run.ring.style.setProperty('--value', String(Math.round((finished / nights.length) * 100)));
		run.ringValue.textContent = `${finished}/${nights.length}`;
		run.ringCaption.textContent = 'nights backed up';
		run.ring.setAttribute('aria-label', `${finished} of the last ${nights.length} nightly backups finished`);
	}

	function stepState(index, current, failedAt) {
		if (index === failedAt) return 'failed';
		if (index < current) return 'done';
		return index === current ? 'current' : 'waiting';
	}

	function paintSteps(steps, current, failedAt) {
		run.steps.innerHTML = steps
			.map((step, index) => {
				const state = stepState(index, current, failedAt);
				const { modifier, spoken } = STEP_LOOKS[state];
				const marker = index === current && failedAt == null ? ' aria-current="step"' : '';
				const icon = state === 'failed' ? 'bi-x-lg' : 'bi-check-lg';
				return `<li class="basalt-steps-item${modifier}"${marker}><span class="basalt-steps-dot" aria-hidden="true"><i class="bi ${icon}"></i><span class="basalt-steps-num">${index + 1}</span></span><span class="basalt-steps-text"><span class="basalt-steps-label">${step.label}</span><span class="basalt-steps-hint">${step.hint}</span><span class="visually-hidden">${spoken}</span></span></li>`;
			})
			.join('');
	}

	/** Starts a backup of the picked sections; a demo run can be told to fail. */
	function beginBackup(simulateFailure = false) {
		if (activeJob) return;
		const sections = pickedSections();
		if (!sections.length) {
			run.error.hidden = false;
			pick('input[name="part"]', run.form).focus();
			return;
		}
		const steps = [
			{ key: 'prep', label: 'Getting ready', hint: 'Pausing edits for a moment' },
			...sections.map((key) => ({ key, label: SECTIONS[key].title, hint: sizeWords(SECTIONS[key].weightGb) })),
			{ key: 'check', label: 'Checking the copy', hint: 'Opening it to make sure' },
		];
		const photosAt = steps.findIndex((step) => step.key === 'photos');
		activeJob = {
			steps,
			sections,
			title: pick('#bk-run-name').value.trim(),
			failing: simulateFailure,
			failAt: simulateFailure ? (photosAt > 0 ? photosAt : 1) : null,
			step: 0,
			tick: 0,
			timer: 0,
		};

		setButtonState(run.start, 'loading');
		run.form.hidden = true;
		run.live.hidden = false;
		run.failure.hidden = true;
		run.stop.hidden = false;
		run.again.hidden = true;
		run.seeNew.hidden = true;
		run.stop.classList.remove('is-asking');
		run.ring.className = 'basalt-ring bk-run-ring';
		run.ringCaption.textContent = 'copied';
		run.status.textContent = 'Backing up. The shop stays open.';
		advanceBackup();
	}

	function advanceBackup() {
		const job = activeJob;
		if (!job) return;
		const percent = Math.min(
			100,
			Math.round(((job.step * TICKS_PER_STEP + job.tick) / (job.steps.length * TICKS_PER_STEP)) * 100),
		);
		run.ring.style.setProperty('--value', String(percent));
		run.ringValue.textContent = `${percent}%`;
		run.ring.setAttribute('aria-label', `Backup ${percent}% done`);
		paintSteps(job.steps, job.step, null);
		run.line.textContent = PROGRESS_LINES[job.steps[job.step].key]?.(job.tick) ?? 'Getting ready';

		if (job.failing && job.step === job.failAt && job.tick === 3) {
			failBackup();
			return;
		}
		job.tick += 1;
		if (job.tick > TICKS_PER_STEP) {
			job.tick = 1;
			job.step += 1;
		}
		if (job.step >= job.steps.length) {
			completeBackup();
			return;
		}
		job.timer = setTimeout(advanceBackup, prefersStill ? 260 : 190);
	}

	function settleControls() {
		clearTimeout(activeJob.timer);
		run.stop.hidden = true;
		run.again.hidden = false;
	}

	function failBackup() {
		const { steps, failAt, sections } = activeJob;
		settleControls();
		paintSteps(steps, failAt, failAt);
		run.ring.className = 'basalt-ring basalt-ring-danger bk-run-ring';
		run.ringCaption.textContent = 'stopped';
		run.ring.setAttribute('aria-label', `Backup stopped at ${run.ringValue.textContent}`);
		pick('.basalt-alert-title', run.failure).textContent =
			`The backup stopped at ${steps[failAt].label.toLowerCase()}`;
		run.failure.hidden = false;
		pick('[data-bk-retry-nophotos]', run.failure).hidden = !sections.includes('photos');
		run.line.textContent = '';
		run.status.textContent = 'Stopped. Nothing was kept.';
		setButtonState(run.start, 'error');
		activeJob = null;
		pick('[data-bk-retry]', run.failure).focus();
		notify({
			tone: 'danger',
			title: 'Backup failed',
			text: 'The storage service did not answer. Nothing in the shop changed.',
			duration: 7000,
		});
	}

	function completeBackup() {
		const { steps, sections, title } = activeJob;
		settleControls();
		paintSteps(steps, steps.length, null);
		run.ring.className = 'basalt-ring basalt-ring-success bk-run-ring';
		run.ring.style.setProperty('--value', '100');
		run.ringValue.textContent = '100%';
		run.ringCaption.textContent = 'backed up';
		run.ring.setAttribute('aria-label', 'Backup finished');

		const covers = Object.fromEntries(Object.keys(SECTIONS).map((key) => [key, sections.includes(key)]));
		const seconds = sections.reduce((sum, key) => sum + SECTIONS[key].seconds, 30);
		const point = createPoint(new Date(+CLOCK), 'manual', {
			label: title || 'Taken by hand',
			takenBy: STAFF[0],
			covers,
			seconds,
		});
		point.sizeGb = sections.reduce((sum, key) => sum + SECTIONS[key].weightGb, 0);
		point.reference += `-${point.serial}`;
		restorePoints.push(point);
		newestManual = point;
		highlightSerial = point.serial;

		run.line.textContent = `${formatGb(point.sizeGb)} saved, with a second copy on its way to Kalamazoo.`;
		run.status.textContent = 'Done. The new restore point is at the top of the list.';
		run.seeNew.hidden = false;
		setButtonState(run.start, 'success');
		activeJob = null;
		refreshAll();
		run.seeNew.focus();
		const quoted = title ? `“${title}”, ` : '';
		notify({
			tone: 'success',
			title: 'Backup finished',
			text: `${quoted}${formatGb(point.sizeGb)}. You can restore to it any time.`,
			duration: 8000,
			actions: [
				{ label: 'Download', onClick: () => downloadPoint(point, null) },
				{ label: 'Open', ghost: true, onClick: () => openDetails(point.serial, run.seeNew) },
			],
		});
	}

	function resetBackup(focusStart) {
		if (activeJob) {
			clearTimeout(activeJob.timer);
			activeJob = null;
		}
		run.live.hidden = true;
		run.form.hidden = false;
		setButtonState(run.start, 'idle');
		idleRing();
		const latest = mostRecent();
		run.status.textContent = latest ? `Ready. The last one finished ${relative(latest.takenAt)}.` : 'Ready.';
		if (focusStart) run.start.focus();
	}

	/* Schedule and how long each kind of copy is kept. */

	function wireSchedule() {
		plan.host.addEventListener('change', (event) => {
			if (event.target.matches('.basalt-stepper-input')) event.target.value = String(clampToRange(event.target));
			paintPlanSummary();
		});
		plan.host.addEventListener('input', paintPlanSummary);
		pick('[data-bk-plan-reset]', plan.host).addEventListener('click', () => {
			writeSchedule(savedSchedule);
			say('Changes undone');
		});
		plan.host.addEventListener('submit', onScheduleSubmit);
	}

	function onScheduleSubmit(event) {
		event.preventDefault();
		if (plan.save.classList.contains('is-loading')) return;
		const previous = savedSchedule;
		const proposed = readSchedule();
		if (JSON.stringify(proposed) === JSON.stringify(previous)) {
			notify({
				tone: 'info',
				title: 'Nothing to save',
				text: 'The schedule is already set like this.',
				duration: 3500,
			});
			return;
		}
		setButtonState(plan.save, 'loading');
		setTimeout(() => {
			savedSchedule = proposed;
			paintPlanSummary();
			setButtonState(plan.save, 'success');
			setTimeout(() => setButtonState(plan.save, 'idle'), 1400);
			notify({
				tone: 'success',
				title: 'Schedule saved',
				text: `Next backup ${pick('[data-bk-sum="next"]', plan.host).textContent}.`,
				duration: 7000,
				actions: [
					{
						label: 'Undo',
						onClick: () => {
							savedSchedule = previous;
							writeSchedule(previous);
							say('Schedule put back');
						},
					},
				],
			});
		}, 900);
	}

	function readSchedule() {
		const fields = plan.host.elements;
		return {
			cadence: fields.often.value,
			hour: fields.time.value,
			nightly: fields.night.value,
			weekly: fields.week.value,
			monthly: fields.month.value,
			secondCopy: fields.offsite.checked,
			emailMe: fields.mail.checked,
		};
	}

	function writeSchedule(schedule) {
		const fields = plan.host.elements;
		for (const radio of pickAll('input[name="often"]', plan.host)) radio.checked = radio.value === schedule.cadence;
		pick('input[name="often"]:checked', plan.host)?.dispatchEvent(new Event('change', { bubbles: true }));
		fields.time.value = schedule.hour;
		window.Basalt.select?.refresh?.(fields.time);
		fields.night.value = schedule.nightly;
		fields.week.value = schedule.weekly;
		fields.month.value = schedule.monthly;
		fields.offsite.checked = schedule.secondCopy;
		fields.mail.checked = schedule.emailMe;
		paintPlanSummary();
	}

	function clampToRange(field) {
		const value = parseInt(field.value, 10);
		if (!Number.isFinite(value)) return +field.min;
		return Math.min(+field.max, Math.max(+field.min, value));
	}

	function nextRunText(cadence, hour) {
		if (cadence === 'hour') return 'at noon, in 20 minutes';
		if (cadence === 'twice') return `today, ${timeOfDay(new Date(2026, 8, 29, hour + 12, 0))}`;
		return `tonight, ${timeOfDay(new Date(2026, 8, 30, hour, 0))}`;
	}

	/* The summary estimates points kept and room needed from the form as it stands. */
	function paintPlanSummary() {
		const schedule = readSchedule();
		const fields = plan.host.elements;
		const nightly = clampToRange(fields.night);
		const weekly = clampToRange(fields.week);
		const monthly = clampToRange(fields.month);
		const perDay = schedule.cadence === 'twice' ? 2 : 1;
		const hourly = schedule.cadence === 'hour' ? 48 : 0;
		const extraWeeks = Math.max(0, weekly - Math.floor(nightly / 7));
		const manualCount = restorePoints.filter((point) => point.category === 'manual').length;
		const points = nightly * perDay + extraWeeks + monthly + hourly + manualCount;
		const room = nightly * perDay * 1.24 + extraWeeks * 1.14 + monthly * 1.02 + hourly * 0.05 + 4.4;

		pick('[data-bk-sum="points"]', plan.host).textContent = String(points);
		pick('[data-bk-sum="room"]', plan.host).textContent = `about ${Math.round(room)} GB`;
		pick('[data-bk-sum="next"]', plan.host).textContent = nextRunText(schedule.cadence, +schedule.hour);
		pick('[data-bk-time-field]', plan.host).hidden = schedule.cadence === 'hour';
		pick('[data-bk-plan-warn]', plan.host).hidden = room <= storageLimit;
		pick('[data-bk-plan-warn-text]', plan.host).textContent =
			`That needs about ${Math.round(room)} GB, more than the ${storageLimit} GB you have. The oldest copies would be cleared early.`;
		unsavedBadge.hidden = JSON.stringify(schedule) === JSON.stringify(savedSchedule);
	}

	start();
})();
