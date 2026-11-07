/**
 * Customer book report for customer-insights.html, and the shared ledger
 * behind customer-insight.html.
 *
 * Fieldline sells scheduling to crews that work at the client's door. This
 * script grows a seeded book of roughly 2,900 accounts (36 months of revenue
 * and health each), then turns one period and one filter set into the
 * figures row, the won/lost chart, cohort retention, the split-by panel, the
 * churn reasons, the at-risk list and the full accounts table.
 *
 * Bringing real data: replace buildLedger() with your accounts, or let
 * server.fetchReport() return a finished report in the shape that
 * composeReport() produces. Nothing on the page is typed into the markup.
 *
 * Charts read the --basalt-* tokens whenever they are drawn, wait until they
 * scroll into view, and redraw on basalt:appearance. The pager, chips,
 * selects, toasts, tips and skeletons are the shared ones from basalt.js.
 * The details page loads this file only for window.Basalt.customerBook.
 */
(() => {
	'use strict';

	/* The demo pretends today is October 2, 2026, and the newest complete
     month on file is September 2026; a live app would use new Date(). */
	const DEMO_TODAY = new Date(2026, 9, 2);
	const NEWEST_MONTH = new Date(2026, 8, 1);
	const MONTHS_HELD = 36;
	const FINAL_MONTH = MONTHS_HELD - 1;
	const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const LONG_MONTHS = [
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

	const ledger = buildLedger();

	/* The details page reads the ledger and these helpers from here, so both
     pages tell the same story about every account. */
	window.Basalt.customerBook = {
		DEMO: ledger,
		SPAN: MONTHS_HELD,
		seeded: seededStream,
		MONTH_SHORT: SHORT_MONTHS,
		MONTH_LONG: LONG_MONTHS,
		monthOf: monthAt,
		arrAt: yearlyRevenue,
		renewal: nextRenewal,
		signalText: warningText,
	};

	const page = pick('[data-ca-root]', document);
	if (!page || typeof Chart === 'undefined') return;

	const CHART_FAMILY = "'Schibsted Grotesk', sans-serif";
	const AXIS_FONT = { family: CHART_FAMILY, size: 11.5 };
	const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const previewState = new URLSearchParams(location.search).get('state');

	/* Period presets by radio value. A custom period may open no earlier
     than two years back, so the matching earlier period is still on file. */
	const PERIODS = {
		3: { from: MONTHS_HELD - 3, to: FINAL_MONTH },
		6: { from: MONTHS_HELD - 6, to: FINAL_MONTH },
		12: { from: MONTHS_HELD - 12, to: FINAL_MONTH },
		ytd: { from: FINAL_MONTH - NEWEST_MONTH.getMonth(), to: FINAL_MONTH },
	};
	const EARLIEST_CUSTOM = MONTHS_HELD - 24;

	const BAND_LABELS = { healthy: 'Healthy', watch: 'Worth watching', risk: 'At risk' };
	const SPLIT_LABELS = {
		plan: 'Plan',
		size: 'Company size',
		industry: 'Industry',
		region: 'Region',
		channel: 'How they bought',
	};
	const SPLITS_THAT_FILTER = new Set(['plan', 'size', 'region']);
	const COHORT_MARKS = [1, 2, 4];
	const RISK_PREVIEW = 6;
	const RISK_PAGE_SIZE = 10;

	/* The five headline tiles. `shift` names how the change against the
     earlier period is worded; `lowerIsBetter` flips the trend color. */
	const FIGURES = [
		{
			key: 'customers',
			title: 'Paying customers',
			hue: 0,
			format: wholeNumber,
			shift: 'count',
			tip: 'Accounts on a paid plan on the last day of the period.',
		},
		{
			key: 'nrr',
			title: 'Net revenue retention',
			hue: 1,
			format: percent,
			shift: 'points',
			tip: 'Revenue at the end of the period from the accounts that were paying at its start, upgrades and downgrades included, as a share of what they paid then.',
		},
		{
			key: 'grr',
			title: 'Gross revenue retention',
			hue: 4,
			format: percent,
			shift: 'points',
			tip: 'The same as net revenue retention but without upgrades, so it can never pass 100%.',
		},
		{
			key: 'churnRate',
			title: 'Monthly churn',
			hue: 2,
			format: percent,
			shift: 'points',
			lowerIsBetter: true,
			tip: 'Share of paying accounts that canceled in an average month of the period, across every plan.',
		},
		{
			key: 'riskArr',
			title: 'Revenue at risk',
			hue: 6,
			format: compactDollars,
			shift: 'share',
			lowerIsBetter: true,
			tip: 'Yearly revenue from paying accounts whose health score is under 50.',
		},
	];

	const ui = {
		preset: '12',
		range: { ...PERIODS[12] },
		filters: { plan: '', region: '', size: '' },
		splitBy: 'plan',
		list: 'book',
		order: { field: 'arr', direction: -1 },
		query: '',
		focus: null /* { kind: 'reason' | 'industry' | 'channel', id, label } from a chart pick */,
		riskExpanded: false /* the top six, or every one paged by ten */,
		riskMarks: {} /* account id to 'planned' or 'handled' */,
		report: null,
		ready: false,
	};

	const nodes = {
		report: pick('[data-ca-report]'),
		failure: pick('[data-ca-error]'),
		nothing: pick('[data-ca-empty]'),
		summary: pick('[data-ca-summary]'),
		filterTags: pick('[data-ca-applied]'),
		figures: pick('[data-ca-kpis]'),
		presets: pick('[data-ca-presets]'),
		customButton: pick('[data-ca-custom-toggle]'),
		customText: pick('[data-ca-custom-label]'),
		customForm: pick('[data-ca-custom]'),
		fromSelect: pick('[data-ca-from]'),
		toSelect: pick('[data-ca-to]'),
		customProblem: pick('[data-ca-custom-error]'),
		tableBody: pick('[data-ca-acc-body]'),
		table: pick('[data-ca-acc-table]'),
		tableEmpty: pick('[data-ca-acc-none]'),
		tablePager: pick('[data-ca-pager]'),
		pageSize: pick('#ca-per'),
		search: pick('[data-ca-search]'),
		tableTags: pick('[data-ca-table-applied]'),
		riskBody: pick('[data-ca-risk-body]'),
		riskTable: pick('[data-ca-risk-table]'),
		riskPagerBox: pick('[data-ca-risk-pager]'),
		riskToggle: pick('[data-ca-risk-more]'),
	};

	const liveCharts = new Map();
	const shownCanvases = new Set();
	const lazyDraw =
		'IntersectionObserver' in window ? new IntersectionObserver(drawOnArrival, { rootMargin: '80px 0px' }) : null;

	let figuresMade = false;
	let arrivalsSet = false;
	let requestSerial = 0;
	let loadsSoFar = 0;
	let searchDelay = 0;
	let tableRows = [];
	let tablePager = null;
	const tablePagerSetup = { total: 0, noun: 'accounts', render: paintTableRows };
	let riskRows = [];
	let riskPager = null;
	const riskPagerSetup = { total: 0, perPage: RISK_PAGE_SIZE, noun: 'accounts', render: paintRiskRows };

	/* Stand-in for the backend. Every call returns a promise; the demo
     answers from the ledger after a short pause. ?state=error and
     ?state=empty in the address preview those two states. */
	const server = {
		/* GET /api/customers/report?from=2025-10&to=2026-09&plan=&region=&size=
       answers with a report object; called at start and on every change. */
		fetchReport(range, filters) {
			loadsSoFar += 1;
			const isFirst = loadsSoFar === 1;
			return pause(isFirst ? 520 : 240).then(() => {
				if (previewState === 'error' && isFirst) throw new Error('The server did not answer');
				if (previewState === 'empty') return { ...composeReport(range, { plan: 'none' }), filters };
				return composeReport(range, filters);
			});
		},
		/* POST /api/customers/:id/check-ins books the call. */
		scheduleCheckIn(id) {
			return pause(200, { id });
		},
		/* PATCH /api/customers/:id/risk with status open, planned or handled. */
		saveRiskStatus(id, status) {
			return pause(150, { id, status });
		},
		/* Builds the CSV in the browser; a server export suits long lists. */
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

	/** Wires every control, starts watching the charts, and asks for the first report. */
	function start() {
		populateControls();

		for (const radio of pickAll('input[name="ca-range"]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				ui.preset = radio.value;
				ui.range = { ...PERIODS[radio.value] };
				syncCustomPicker();
				reload();
			});
		}
		nodes.customForm.addEventListener('submit', applyCustomPeriod);
		pick('[data-ca-custom-cancel]').addEventListener('click', () => {
			syncCustomPicker();
			nodes.customProblem.hidden = true;
			closeCustomPicker();
		});
		nodes.customButton.addEventListener('show.bs.dropdown', () => {
			syncCustomPicker();
			nodes.customProblem.hidden = true;
		});

		for (const picker of pickAll('select[data-ca-filter]')) {
			picker.addEventListener('change', () => {
				ui.filters[picker.getAttribute('data-ca-filter')] = picker.value;
				reload();
			});
		}
		pick('[data-ca-clear]').addEventListener('click', clearFilters);
		pick('[data-ca-retry]').addEventListener('click', () => reload(true));

		pick('[data-ca-seg-body]').addEventListener('click', (event) => {
			const row = event.target.closest('[data-ca-seg]');
			if (row) chooseSegment(row.getAttribute('data-ca-seg'));
		});
		for (const radio of pickAll('input[name="ca-dim"]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				ui.splitBy = radio.value;
				paintSegmentTable();
				refreshChart('segments');
			});
		}
		enableChartKeys(
			'segments',
			() => ui.report.segments[ui.splitBy].length,
			(index) => chooseSegment(ui.report.segments[ui.splitBy][index].id),
		);
		enableChartKeys(
			'reasons',
			() => ui.report.reasons.length,
			(index) => chooseReason(ui.report.reasons[index].id),
		);

		nodes.riskToggle.addEventListener('click', toggleRiskLength);
		nodes.riskBody.addEventListener('click', onRiskClick);

		for (const radio of pickAll('input[name="ca-view"]')) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				ui.list = radio.value;
				/* A reason picked on the chart only makes sense in the lost list. */
				if (ui.focus?.kind === 'reason' && radio.value !== 'lost') ui.focus = null;
				paintAccounts(true);
				refreshChart('reasons');
			});
		}
		for (const button of pickAll('[data-ca-sort]')) {
			button.addEventListener('click', () => {
				const field = button.getAttribute('data-ca-sort');
				ui.order =
					ui.order.field === field
						? { field, direction: -ui.order.direction }
						: { field, direction: field === 'name' ? 1 : -1 };
				paintAccounts(true);
			});
		}
		nodes.search.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => {
				ui.query = nodes.search.value;
				paintAccounts(true);
			}, 160);
		});
		pick('[data-ca-acc-reset]').addEventListener('click', () => {
			resetTable();
			nodes.search.focus();
		});
		nodes.tableBody.addEventListener('click', followRowLink);

		page.addEventListener('click', (event) => {
			const trigger = event.target.closest('[data-ca-export]');
			if (!trigger || !ui.report) return;
			const [fileName, rows] = exportTable(trigger.getAttribute('data-ca-export'));
			server.downloadCsv(fileName, rows).then((count) =>
				notify({
					tone: 'success',
					title: 'Export ready',
					text: `${fileName}, ${countOf(count, 'row')}.`,
					duration: 3600,
				}),
			);
		});

		document.addEventListener('basalt:appearance', () => {
			/* The new tokens land with the attribute, so read them a frame later. */
			requestAnimationFrame(() => {
				for (const canvas of liveCharts.keys()) drawChart(canvas, false);
				if (ui.report) paintSegmentTable();
			});
		});

		watchCanvases(pickAll('canvas[data-ca-chart]'));
		reload();
	}

	/* The period presets, custom picker and filter selects live here. */

	function populateControls() {
		pick('[data-ca-filter="plan"]').innerHTML = optionList(ledger.plans, 'Every plan');
		pick('[data-ca-filter="region"]').innerHTML = optionList(ledger.regions, 'Every region');
		pick('[data-ca-filter="size"]').innerHTML = optionList(ledger.sizes, 'Every company size');

		const monthOptions = [];
		for (let month = EARLIEST_CUSTOM; month < MONTHS_HELD; month += 1) {
			monthOptions.push(`<option value="${month}">${monthAndYear(month)}</option>`);
		}
		nodes.fromSelect.innerHTML = monthOptions.join('');
		nodes.toSelect.innerHTML = monthOptions.join('');

		for (const select of pickAll('select[data-ca-filter], [data-ca-from], [data-ca-to]')) {
			window.Basalt.select?.refresh(select);
		}
	}

	function optionList(entries, everyLabel) {
		const choices = entries.map((entry) => {
			const hint = entry.hint ? ` (${htmlSafe(entry.hint)})` : '';
			return `<option value="${entry.id}">${htmlSafe(entry.name)}${hint}</option>`;
		});
		return `<option value="">${everyLabel}</option>${choices.join('')}`;
	}

	function chooseOption(select, value) {
		select.value = value;
		window.Basalt.select?.refresh(select);
	}

	/** Mirrors the current period into the custom picker and its button. */
	function syncCustomPicker() {
		chooseOption(nodes.fromSelect, String(ui.range.from));
		chooseOption(nodes.toSelect, String(ui.range.to));
		const isCustom = ui.preset === 'custom';
		nodes.customButton.classList.toggle('is-active', isCustom);
		nodes.customText.textContent = isCustom ? periodName(ui.range.from, ui.range.to) : 'Custom';
		if (!isCustom) return;
		for (const radio of pickAll('input[name="ca-range"]', nodes.presets)) radio.checked = false;
		nodes.presets.classList.remove('is-ready');
	}

	function applyCustomPeriod(event) {
		event.preventDefault();
		const from = Number(nodes.fromSelect.value);
		const to = Number(nodes.toSelect.value);
		const backwards = from > to;
		nodes.customProblem.hidden = !backwards;
		nodes.fromSelect.setAttribute('aria-invalid', String(backwards));
		if (backwards) {
			nodes.fromSelect.setAttribute('aria-describedby', 'ca-custom-error');
			return;
		}
		nodes.fromSelect.removeAttribute('aria-describedby');
		ui.preset = 'custom';
		ui.range = { from, to };
		syncCustomPicker();
		closeCustomPicker();
		reload();
	}

	function closeCustomPicker() {
		bootstrap.Dropdown.getOrCreateInstance(nodes.customButton).hide();
		nodes.customButton.focus();
	}

	function setFilter(field, value) {
		ui.filters[field] = value;
		chooseOption(pick(`select[data-ca-filter="${field}"]`), value);
		reload();
	}

	function clearFilters() {
		for (const field of Object.keys(ui.filters)) {
			ui.filters[field] = '';
			chooseOption(pick(`select[data-ca-filter="${field}"]`), '');
		}
		reload();
	}

	function paintFilterChips() {
		const groups = [
			['plan', ledger.plans, 'Plan'],
			['region', ledger.regions, 'Region'],
			['size', ledger.sizes, 'Size'],
		];
		const tags = groups
			.filter(([field]) => ui.filters[field])
			.map(([field, entries, heading]) => ({
				label: `${heading}: ${lookup(entries, ui.filters[field]).name}`,
				remove() {
					setFilter(field, '');
				},
			}));
		window.Basalt.drawer?.applied(nodes.filterTags, tags, clearFilters, pick('select[data-ca-filter="plan"]'));
	}

	/* Each load ends in one of four states: busy, ready, failed or empty. */

	/**
	 * Requests a fresh report for the current period and filters. Answers
	 * that arrive after a newer request are dropped.
	 * @param {boolean} [isRetry] true when the reader pressed Try again
	 */
	function reload(isRetry) {
		const serial = ++requestSerial;
		nodes.report.classList.add('is-loading');
		nodes.report.setAttribute('aria-busy', 'true');
		nodes.table.setAttribute('aria-busy', 'true');
		nodes.summary.textContent = 'Updating the figures';
		if (isRetry) {
			nodes.failure.hidden = true;
			nodes.report.hidden = false;
		}
		if (!ui.ready) paintPlaceholders();
		paintFilterChips();

		return server
			.fetchReport(ui.range, ui.filters)
			.then((report) => {
				if (serial !== requestSerial) return;
				ui.report = report;
				ui.ready = true;
				nodes.failure.hidden = true;
				nodes.report.classList.remove('is-loading');
				nodes.report.setAttribute('aria-busy', 'false');
				nodes.table.setAttribute('aria-busy', 'false');
				if (!report.count) {
					paintEmptyState();
					return;
				}
				nodes.nothing.hidden = true;
				nodes.report.hidden = false;
				paintReport();
				if (isRetry) announce('The customer report loaded.');
			})
			.catch(() => {
				if (serial !== requestSerial) return;
				nodes.report.hidden = true;
				nodes.nothing.hidden = true;
				nodes.failure.hidden = false;
				nodes.summary.textContent = 'The figures could not be loaded.';
				pick('.basalt-empty-title', nodes.failure)?.focus();
				announce('The customer report did not load.');
			});
	}

	function paintEmptyState() {
		const narrowed = Object.values(ui.filters).some(Boolean);
		pick('[data-ca-empty-title]').textContent = narrowed ? 'No customers match these filters' : 'No customers yet';
		pick('[data-ca-empty-text]').textContent = narrowed
			? `No account fits ${filterSentence()}. Try another plan, region or company size.`
			: 'Accounts show up here as soon as the first one signs up.';
		pick('[data-ca-clear]').hidden = !narrowed;
		nodes.report.hidden = true;
		nodes.nothing.hidden = false;
		nodes.summary.textContent = narrowed ? 'No customers match.' : 'No customers yet.';
	}

	function filterSentence() {
		const { plan, size, region } = ui.filters;
		const phrases = [];
		if (plan) phrases.push(`the ${lookup(ledger.plans, plan).name} plan`);
		if (size) {
			const band = lookup(ledger.sizes, size);
			phrases.push(`${band.name.toLowerCase()} companies (${band.hint})`);
		}
		if (region) phrases.push(lookup(ledger.regions, region).name);
		return phrases.join(', ');
	}

	/** Gray stand-ins for the tiles and the table until the first answer. */
	function paintPlaceholders() {
		const still = calmMotion ? ' basalt-skeleton-still' : '';
		function bone(variant, style) {
			return `<span class="basalt-skeleton basalt-skeleton-${variant}${still}" style="${style}"></span>`;
		}
		const placeholderTile = `<div class="ca-kpi" aria-hidden="true">${bone('text', 'width:55%')}${bone('title', 'width:45%;height:1.6rem')}${bone('text', 'width:70%')}${bone('block', 'height:44px')}</div>`;
		nodes.figures.innerHTML = placeholderTile.repeat(5);

		const rows = [];
		for (let index = 0; index < 6; index += 1) {
			const nameWidth = 55 + ((index * 3) % 5) * 8;
			rows.push(
				`<tr class="ca-skel-row" aria-hidden="true">` +
					`<td>${bone('text', `width:${nameWidth}%`)}${bone('sm', 'width:40%')}</td>` +
					`<td>${bone('text', 'width:5rem')}</td>` +
					`<td class="ca-col-region">${bone('text', 'width:6rem')}</td>` +
					`<td>${bone('text', 'width:4rem;margin-left:auto')}</td>` +
					`<td>${bone('text', 'width:3.5rem;margin-left:auto')}</td>` +
					`<td>${bone('text', 'width:5rem')}</td>` +
					`<td class="ca-col-when">${bone('text', 'width:5rem')}</td></tr>`,
			);
		}
		nodes.tableBody.innerHTML = rows.join('');
	}

	/* These functions paint a finished report into the page. */

	function paintReport() {
		const { range, cmp, now } = ui.report;
		const months = range.to - range.from + 1;
		const against = cmp ? ` compared with the ${months === 1 ? 'month' : `${months} months`} before` : '';
		nodes.summary.innerHTML = `<strong>${countOf(now.customers, 'paying customer')}</strong> at the end of ${htmlSafe(monthAndYear(range.to))}. Showing ${htmlSafe(periodName(range.from, range.to))}${htmlSafe(against)}.`;
		paintFigures();
		paintFlowNumbers();
		paintCohortNumbers();
		paintSegmentTable();
		paintRiskList();
		paintDataTables();
		paintAccounts(true);
		refreshAllCharts();
		if (!arrivalsSet) {
			arrivalsSet = true;
			setArrivals();
		}
	}

	/* The first report plays in as each card comes into view: the stat pairs
     count up and the at-risk rows rise one after another. Later reports
     and reduced motion show everything at rest. */

	function setArrivals() {
		for (const stats of pickAll('[data-ca-flow-stats], [data-ca-stay-stats]')) {
			onFirstSight(stats, () => window.Basalt.countUp?.(pickAll('dd', stats)));
		}
		onFirstSight(nodes.riskBody, () => arrive(nodes.riskBody));
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
		Array.from(list.children).forEach((item, at) => item.style.setProperty('--ca-at', Math.min(at, 10)));
		list.classList.add('is-arriving');
		const runs = list.getAnimations({ subtree: true }).map((run) => run.finished);
		Promise.allSettled(runs).then(() => {
			list.classList.remove('is-arriving');
			for (const item of list.children) item.style.removeProperty('--ca-at');
		});
	}

	/* How each figure words its change against the earlier period. */
	const SHIFT_WORDING = {
		count(present, earlier) {
			const diff = present - earlier;
			const ratio = earlier ? ` (${withSign((diff / earlier) * 100, percent)})` : '';
			return { words: withSign(diff, wholeNumber) + ratio, direction: diff };
		},
		points(present, earlier) {
			const diff = Math.round((present - earlier) * 10) / 10;
			return { words: `${withSign(diff, (value) => value.toFixed(1))} pts`, direction: diff };
		},
		share(present, earlier) {
			const rounded = Math.round(earlier ? ((present - earlier) / earlier) * 100 : 0);
			return { words: withSign(rounded, (value) => `${value}%`), direction: rounded };
		},
	};

	function paintFigures() {
		const report = ui.report;
		const fresh = !figuresMade;
		if (fresh) {
			nodes.figures.innerHTML = FIGURES.map(figureShell).join('');
			figuresMade = true;
			window.Basalt.tips?.(nodes.figures);
			watchCanvases(pickAll('canvas[data-ca-spark]', nodes.figures));
		}

		for (const figure of FIGURES) {
			const figureBox = pick(`[data-ca-kpi="${figure.key}"]`, nodes.figures);
			const present = report.now[figure.key];
			pick('[data-ca-kpi-value]', figureBox).textContent = figure.format(present);
			pick('[data-ca-kpi-delta]', figureBox).innerHTML = report.then
				? trendLine(figure, present, report.then[figure.key])
				: figureFallback(figure, report);

			const series = report.spark[figure.key];
			const months = report.spark.months;
			pick('canvas', figureBox).setAttribute(
				'aria-label',
				`${figure.title}, ${periodName(months[0], months[months.length - 1])}: from ${figure.format(series[0])} to ${figure.format(series[series.length - 1])}`,
			);
		}
		/* The figures count up from zero the first time they are drawn. */
		if (fresh) window.Basalt.countUp?.(pickAll('[data-ca-kpi-value]', nodes.figures));
	}

	function figureShell(figure) {
		const info = `<button type="button" class="ca-kpi-info" data-bs-toggle="tooltip" data-bs-title="${htmlSafe(figure.tip)}" aria-label="What ${htmlSafe(figure.title.toLowerCase())} means"><i class="bi bi-info-circle" aria-hidden="true"></i></button>`;
		return (
			`<article class="ca-kpi" data-ca-kpi="${figure.key}"><h3 class="ca-kpi-label">${htmlSafe(figure.title)}${info}</h3>` +
			'<p class="ca-kpi-value" data-ca-kpi-value>0</p><p class="ca-kpi-delta" data-ca-kpi-delta></p>' +
			`<div class="ca-kpi-spark"><canvas data-ca-spark="${figure.key}" role="img"></canvas></div></article>`
		);
	}

	function figureFallback(figure, report) {
		if (figure.key === 'riskArr') return `<span>${countOf(report.now.riskCount, 'account')} under 50</span>`;
		return `<span>${htmlSafe(periodName(report.range.from, report.range.to))}</span>`;
	}

	function trendLine(figure, present, earlier) {
		const { words, direction } = SHIFT_WORDING[figure.shift](present, earlier);
		const way = Math.sign(direction) || 0;
		const tone = { 1: 'basalt-trend-up', '-1': 'basalt-trend-down', 0: 'basalt-trend-flat' }[way];
		const arrow = { 1: 'bi-arrow-up-right', '-1': 'bi-arrow-down-right', 0: 'bi-dash' }[way];
		const verdict = way === 0 ? 'no change' : way > 0 !== Boolean(figure.lowerIsBetter) ? 'better' : 'worse';
		const invert = figure.lowerIsBetter ? ' basalt-trend-invert' : '';
		return `<span class="basalt-trend ${tone}${invert}"><i class="bi ${arrow}" aria-hidden="true"></i>${htmlSafe(words)}<span class="visually-hidden">, ${verdict}</span></span><span>vs ${htmlSafe(figure.format(earlier))}</span>`;
	}

	function statPair(term, value) {
		return `<div><dt>${term}</dt><dd>${value}</dd></div>`;
	}

	function paintFlowNumbers() {
		const { now, then, range } = ui.report;
		function earlier(value) {
			return value == null ? '' : `<small>vs ${wholeNumber(value)}</small>`;
		}
		const earlierNet = then ? `<small>vs ${withSign(then.won - then.lost, wholeNumber)}</small>` : '';
		pick('[data-ca-flow-stats]').innerHTML =
			statPair('Won', wholeNumber(now.won) + earlier(then?.won)) +
			statPair('Lost', wholeNumber(now.lost) + earlier(then?.lost)) +
			statPair('Net change', withSign(now.won - now.lost, wholeNumber) + earlierNet) +
			statPair(`Paying at ${htmlSafe(monthAbbr(range.to))} end`, wholeNumber(now.customers));
	}

	function paintCohortNumbers() {
		const kept = ui.report.stay;
		pick('[data-ca-stay-stats]').innerHTML = COHORT_MARKS.map((quarter) =>
			statPair(`Quarter ${quarter}`, kept[quarter] == null ? '–' : percent(kept[quarter], 0)),
		).join('');
	}

	function numberCell(content) {
		return `<td class="text-end">${content}</td>`;
	}

	/* The split-by panel owns its table, its picks and the filters they set. */

	function segmentHue(colors, split, index, id) {
		return split === 'plan' ? planHue(colors, id) : colors.series[index % 8];
	}

	/** The segment currently singled out for a split, or '' when none is. */
	function chosenSegment(split) {
		if (SPLITS_THAT_FILTER.has(split)) return ui.filters[split];
		return ui.focus && ui.focus.kind === split ? ui.focus.id : '';
	}

	function paintSegmentTable() {
		const report = ui.report;
		const split = ui.splitBy;
		const colors = chartColors();
		const chosen = chosenSegment(split);
		pick('[data-ca-seg-dim]').textContent = SPLIT_LABELS[split];
		pick('[data-ca-seg-caption]').textContent =
			`Customers by ${SPLIT_LABELS[split].toLowerCase()}, ${periodName(report.range.from, report.range.to)}`;

		const fresh = '<span class="ca-flat">new</span>';
		pick('[data-ca-seg-body]').innerHTML = report.segments[split]
			.map((segment, index) => {
				const isChosen = chosen === segment.id;
				const colorDot = `<span class="ca-seg-swatch" style="background:${segmentHue(colors, split, index, segment.id)}" aria-hidden="true"></span>`;
				return (
					`<tr class="ca-segrow${isChosen ? ' is-current' : ''}" data-ca-seg="${segment.id}">` +
					`<td><button type="button" class="ca-seg-name" aria-pressed="${isChosen}">${colorDot}${htmlSafe(segment.name)}</button></td>${numberCell(
						wholeNumber(segment.customers),
					)}${numberCell(customerShift(segment))}${numberCell(compactDollars(segment.arr))}${numberCell(
						segment.atStart ? percent(segment.nrr, 0) : fresh,
					)}${numberCell(segment.atStart ? percent(segment.churnRate) : fresh)}</tr>`
				);
			})
			.join('');

		const { now, then } = report;
		const earlierCount = then ? then.customers : null;
		pick('[data-ca-seg-foot]').innerHTML = `<tr><td>All in view</td>${numberCell(
			wholeNumber(now.customers),
		)}${numberCell(earlierCount == null ? '' : withSign(now.customers - earlierCount, wholeNumber))}${numberCell(
			compactDollars(now.arr),
		)}${numberCell(percent(now.nrr, 0))}${numberCell(percent(now.churnRate))}</tr>`;
	}

	function customerShift(segment) {
		if (segment.before == null) return '<span class="ca-flat">no data</span>';
		const diff = segment.customers - segment.before;
		return `<span class="${trendClass(diff)}">${withSign(diff, wholeNumber)}</span>`;
	}

	function trendClass(value) {
		if (value > 0) return 'ca-up';
		return value < 0 ? 'ca-down' : 'ca-flat';
	}

	/**
	 * Plan, size and region picks become page filters; industry and channel
	 * picks only narrow the accounts table. Picking the same one again undoes it.
	 */
	function chooseSegment(id) {
		const split = ui.splitBy;
		const segment = lookup(ui.report.segments[split], id);

		if (SPLITS_THAT_FILTER.has(split)) {
			const next = ui.filters[split] === id ? '' : id;
			setFilter(split, next);
			notify({
				tone: 'info',
				title: next ? `Showing ${segment.name} only` : `Showing every ${SPLIT_LABELS[split].toLowerCase()}`,
				text: next
					? `Every chart and figure now covers ${segment.name}. Remove the chip at the top to undo it.`
					: '',
				duration: 3200,
			});
			return;
		}

		const again = ui.focus?.kind === split && ui.focus.id === id;
		ui.focus = again ? null : { kind: split, id, label: `${SPLIT_LABELS[split]}: ${segment.name}` };
		if (!again) switchList('book', true);
		paintSegmentTable();
		paintAccounts(true);
		refreshChart('segments');
		if (again) return;
		scrollToAccounts();
		announce(`Accounts list shows ${segment.name} only.`);
	}

	function chooseReason(id) {
		const reason = lookup(ui.report.reasons, id);
		const again = ui.focus?.kind === 'reason' && ui.focus.id === id;
		ui.focus = again ? null : { kind: 'reason', id, label: `Reason: ${reason.name}` };
		if (!again) switchList('lost', true);
		paintAccounts(true);
		refreshChart('reasons');
		if (again) return;
		scrollToAccounts();
		announce(`Accounts list shows ${countOf(reason.count, 'account')} lost because: ${reason.name}.`);
	}

	function scrollToAccounts() {
		document
			.getElementById('ca-accounts')
			.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth', block: 'start' });
	}

	/* The plain tables behind "Show the numbers". */
	function paintDataTables() {
		const report = ui.report;
		pick('[data-ca-table="flow"]').innerHTML = plainTable(
			'Accounts won and lost each month',
			['Month', 'Won', 'Lost', 'Paying at month end'],
			report.flow.map((entry) => [
				monthAndYear(entry.month),
				wholeNumber(entry.won),
				wholeNumber(entry.lost),
				wholeNumber(entry.customers),
			]),
		);
		pick('[data-ca-table="reasons"]').innerHTML = plainTable(
			'Why accounts left',
			['Reason', 'Accounts', 'Share', 'Yearly revenue lost'],
			report.reasons.map((reason) => [
				reason.name,
				wholeNumber(reason.count),
				report.lost ? percent((reason.count / report.lost) * 100) : '0%',
				compactDollars(reason.arr),
			]),
		);
	}

	function plainTable(caption, headings, rows) {
		const head = headings
			.map((text, index) =>
				index
					? `<th class="text-end" scope="col">${htmlSafe(text)}</th>`
					: `<th scope="col">${htmlSafe(text)}</th>`,
			)
			.join('');
		const body = rows
			.map(
				([label, ...values]) =>
					`<tr><th scope="row">${htmlSafe(label)}</th>${values.map((value) => numberCell(htmlSafe(value))).join('')}</tr>`,
			)
			.join('');
		return `<table class="table table-sm mb-0"><caption class="visually-hidden">${htmlSafe(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
	}

	/* The at-risk list holds paying accounts scoring under 50, each with a menu of actions. */

	function atRiskAccounts() {
		const month = ui.report.range.to;
		return ui.report.list
			.filter((account) => account.mrr[month] > 0 && account.health[month] < 50)
			.sort((first, second) => yearlyRevenue(second, month) - yearlyRevenue(first, month));
	}

	/**
	 * Shows the top six, or every account ten to a page once expanded.
	 * @param {boolean} [stayOnPage] keep the pager where it is, as after a status change
	 */
	function paintRiskList(stayOnPage) {
		const month = ui.report.range.to;
		riskRows = atRiskAccounts();
		const total = riskRows.length;
		const handled = riskRows.filter((account) => ui.riskMarks[account.id] === 'handled').length;

		pick('[data-ca-risk-count]').textContent = total
			? `${countOf(total, 'account')} worth ${compactDollars(addUp(riskRows, (account) => yearlyRevenue(account, month)))} a year, ${wholeNumber(handled)} handled.`
			: '';
		pick('[data-ca-risk-none]').hidden = total > 0;
		nodes.riskTable.hidden = !total;
		pick('[data-ca-risk-foot]').hidden = !total;
		nodes.riskToggle.hidden = total <= RISK_PREVIEW;
		nodes.riskToggle.textContent = ui.riskExpanded
			? `Show the top ${RISK_PREVIEW}`
			: `Show all ${wholeNumber(total)}`;

		const usePager = ui.riskExpanded && total > RISK_PREVIEW;
		nodes.riskPagerBox.hidden = !usePager;
		if (!usePager) {
			paintRiskRows(1, Math.min(total, ui.riskExpanded ? total : RISK_PREVIEW));
			return;
		}

		riskPagerSetup.total = total;
		if (!riskPager) {
			riskPager = window.Basalt.pager ? window.Basalt.pager(nodes.riskPagerBox, riskPagerSetup) : null;
			if (!riskPager) paintRiskRows(1, total);
			return;
		}
		const pageCount = Math.ceil(total / RISK_PAGE_SIZE);
		const pageNumber = stayOnPage ? Math.min(riskPager.get(), pageCount) : 1;
		riskPager.setTotal(pageCount);
		riskPager.set(pageNumber);
		paintRiskRows((pageNumber - 1) * RISK_PAGE_SIZE + 1, Math.min(total, pageNumber * RISK_PAGE_SIZE));
	}

	function paintRiskRows(first, last) {
		if (!ui.report) return;
		const month = ui.report.range.to;
		if (ui.riskExpanded) {
			pick('[data-basalt-pager-range]', nodes.riskPagerBox).innerHTML =
				`<strong>${wholeNumber(first)}–${wholeNumber(last)}</strong> of ${wholeNumber(riskRows.length)} accounts`;
		}
		nodes.riskBody.innerHTML = riskRows
			.slice(first - 1, last)
			.map((account) => riskRow(account, month))
			.join('');
	}

	const RISK_BADGES = {
		planned: '<span class="basalt-status basalt-status-info basalt-status-dot">Check-in planned</span>',
		handled:
			'<span class="basalt-status basalt-status-success"><i class="bi bi-check2" aria-hidden="true"></i>Handled</span>',
	};

	function riskRow(account, month) {
		const mark = ui.riskMarks[account.id];
		const owner = account.owner ? htmlSafe(account.owner) : '<span class="ca-flat">No manager</span>';
		const menuToggle = `<button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="Actions for ${htmlSafe(account.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button>`;
		return (
			`<tr data-ca-risk-id="${account.id}">` +
			`<td><span class="ca-acc"><span class="ca-acc-line"><a class="ca-acc-name ca-acc-open" href="${accountLink(account)}">${htmlSafe(account.name)}</a>${RISK_BADGES[mark] || ''}</span><span class="ca-acc-sub">${htmlSafe(warningText(account, month))}</span></span></td>` +
			`<td>${planBadge(account.plan)}</td>` +
			`<td>${healthDot(account.health[month])}</td>` +
			`<td>${longDate(nextRenewal(account, month))}</td>` +
			`<td>${owner}</td>${numberCell(
				compactDollars(yearlyRevenue(account, month)),
			)}<td class="ca-risk-act"><div class="dropdown">${menuToggle}<ul class="dropdown-menu dropdown-menu-end">${riskMenu(mark)}</ul></div></td></tr>`
		);
	}

	function riskMenu(mark) {
		function entry(action, icon, label) {
			return `<li><button type="button" class="dropdown-item" data-ca-risk-act="${action}"><i class="bi ${icon} me-2" aria-hidden="true"></i>${label}</button></li>`;
		}
		if (mark === 'handled') return entry('open', 'bi-arrow-counterclockwise', 'Reopen');
		const first =
			mark === 'planned'
				? entry('open', 'bi-x-circle', 'Cancel the check-in')
				: entry('planned', 'bi-telephone', 'Plan a check-in');
		return first + entry('handled', 'bi-check2-circle', 'Mark handled');
	}

	function healthDot(score) {
		const band = healthBand(score);
		return `<span class="ca-dot ca-dot-${band}">${score}<span class="visually-hidden">, ${BAND_LABELS[band].toLowerCase()}</span></span>`;
	}

	function toggleRiskLength() {
		const card = document.getElementById('ca-risk');
		window.Basalt.slide(pick('.card-body', card), () => {
			ui.riskExpanded = !ui.riskExpanded;
			paintRiskList();
		});
		if (!ui.riskExpanded && card.getBoundingClientRect().top < 0) {
			card.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth', block: 'start' });
		}
	}

	function onRiskClick(event) {
		const action = event.target.closest('[data-ca-risk-act]');
		if (!action) {
			followRowLink(event);
			return;
		}
		const toggle = pick('[data-bs-toggle="dropdown"]', action.closest('.dropdown'));
		bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
		markRisk(
			action.closest('[data-ca-risk-id]').getAttribute('data-ca-risk-id'),
			action.getAttribute('data-ca-risk-act'),
			true,
		);
	}

	/**
	 * Records a status for one at-risk account, saves it, and offers Undo.
	 * A failed save puts the row back the way it was.
	 */
	function markRisk(id, status, offerUndo) {
		const account = ledger.accounts.find((entry) => entry.id === id);
		const priorStatus = ui.riskMarks[id] || 'open';
		function store(value) {
			if (value === 'open') delete ui.riskMarks[id];
			else ui.riskMarks[id] = value;
			paintRiskList(true);
		}

		store(status);
		pick(`[data-ca-risk-id="${id}"]`, nodes.riskBody)?.querySelector('[data-bs-toggle="dropdown"]')?.focus();
		server.saveRiskStatus(id, status).catch(() => {
			store(priorStatus);
			notify({ tone: 'danger', title: 'Could not save that', text: `${account.name} is back as it was.` });
		});
		if (status === 'planned') server.scheduleCheckIn(id);

		const headline = {
			planned: `Check-in planned with ${account.name}`,
			handled: `${account.name} marked as handled`,
			open: `${account.name} is back on the list`,
		};
		notify({
			tone: status === 'open' ? 'info' : 'success',
			title: headline[status],
			text: status === 'planned' ? reminderNote(account) : '',
			actions: offerUndo
				? [
						{
							label: 'Undo',
							onClick() {
								markRisk(id, priorStatus, false);
							},
						},
					]
				: [],
		});
	}

	function reminderNote(account) {
		return account.owner
			? `${account.owner} gets a reminder for tomorrow morning.`
			: 'It goes to the support team, as nobody manages this account.';
	}

	/* The accounts table switches between three lists and handles search, sort and paging. */

	/** Turns on one of the three list radios without letting it repaint twice. */
	function switchList(list, quietly) {
		ui.list = list;
		const radio = document.getElementById(`ca-view-${list}`);
		if (radio && !radio.checked) {
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}
		if (!quietly) paintAccounts(true);
	}

	function listMembers(list) {
		const { list: accounts, range } = ui.report;
		const pickers = {
			won: (account) => account.start >= range.from && account.start <= range.to,
			lost: (account) => account.end !== null && account.end >= range.from && account.end <= range.to,
		};
		return accounts.filter(pickers[list] || ((account) => account.mrr[range.to] > 0));
	}

	/* Rows describe the end of the period, except lost accounts, which are
     shown as of the last month they paid. */
	function rowMonth(account) {
		return ui.list === 'lost' && account.end !== null ? account.end - 1 : ui.report.range.to;
	}

	function revenueShift(account) {
		const { from, to } = ui.report.range;
		if (ui.list === 'lost') return -yearlyRevenue(account, account.end - 1);
		if (account.start >= from) return null;
		return yearlyRevenue(account, to) - yearlyRevenue(account, from - 1);
	}

	function visibleAccounts() {
		let rows = listMembers(ui.list);
		const focus = ui.focus;
		if (focus)
			rows = rows.filter(
				(account) => (focus.kind === 'reason' ? account.reason : account[focus.kind]) === focus.id,
			);

		const needle = ui.query.trim().toLowerCase();
		if (needle) {
			rows = rows.filter((account) => {
				const haystack = `${account.name} ${account.id} ${account.owner || ''} ${lookup(ledger.industries, account.industry).name}`;
				return haystack.toLowerCase().includes(needle);
			});
		}

		const { field, direction } = ui.order;
		const sortValue =
			{
				name: (account) => account.name,
				health: (account) => account.health[rowMonth(account)],
				change: (account) => revenueShift(account) ?? Infinity,
				arr: (account) => yearlyRevenue(account, rowMonth(account)),
			}[field] || ((account) => yearlyRevenue(account, rowMonth(account)));

		return rows.sort((left, right) => {
			const a = sortValue(left);
			const b = sortValue(right);
			const primary = typeof a === 'string' ? a.localeCompare(b) : a - b;
			return primary * direction || left.name.localeCompare(right.name);
		});
	}

	/**
	 * Refreshes counts, headings, chips and the row set, then hands paging to
	 * the shared pager. `restart` sends the reader back to page one.
	 */
	function paintAccounts(restart) {
		const { range } = ui.report;

		for (const list of ['book', 'won', 'lost']) {
			pick(`[data-ca-view-count="${list}"]`).textContent = wholeNumber(listMembers(list).length);
		}
		pick('[data-ca-when-head]').textContent = { lost: 'Left', won: 'Joined', book: 'Renews' }[ui.list];
		pick('[data-ca-acc-caption]').textContent =
			ui.list === 'book'
				? `Accounts paying at ${monthAndYear(range.to)} end`
				: `Accounts ${ui.list} in ${periodName(range.from, range.to)}`;
		paintSortHeaders();

		const tags = [];
		if (ui.focus) tags.push({ label: ui.focus.label, remove: dropFocus });
		if (ui.query) {
			tags.push({
				label: `Search: ${ui.query}`,
				remove() {
					nodes.search.value = '';
					ui.query = '';
					paintAccounts(true);
				},
			});
		}
		window.Basalt.drawer?.applied(nodes.tableTags, tags, resetTable, nodes.search);

		tableRows = visibleAccounts();
		nodes.tableEmpty.hidden = tableRows.length > 0;
		nodes.tablePager.hidden = !tableRows.length;
		tablePagerSetup.total = tableRows.length;
		if (!tablePager) {
			tablePager = window.Basalt.pager ? window.Basalt.pager(nodes.tablePager, tablePagerSetup) : null;
			if (!tablePager) paintTableRows(1, tableRows.length);
			return;
		}
		if (restart) {
			const pageSize = parseInt(nodes.pageSize.value, 10) || 10;
			tablePager.setTotal(Math.max(1, Math.ceil(tableRows.length / pageSize)));
			tablePager.set(1);
			nodes.pageSize.dispatchEvent(new Event('change'));
		}
		if (!tableRows.length) nodes.tableBody.innerHTML = '';
	}

	function paintSortHeaders() {
		const { field, direction } = ui.order;
		for (const header of pickAll('th[aria-sort]', nodes.table)) {
			const button = pick('.ca-sort', header);
			const active = Boolean(button) && button.getAttribute('data-ca-sort') === field;
			header.setAttribute('aria-sort', active ? (direction > 0 ? 'ascending' : 'descending') : 'none');
			if (!button) continue;
			const arrow = active ? (direction > 0 ? 'bi-arrow-up' : 'bi-arrow-down') : 'bi-arrow-down-up';
			pick('.bi', button).className = `bi ${arrow}`;
		}
	}

	function dropFocus() {
		const kind = ui.focus.kind;
		ui.focus = null;
		paintAccounts(true);
		refreshChart(kind === 'reason' ? 'reasons' : 'segments');
		if (kind !== 'reason') paintSegmentTable();
	}

	function paintTableRows(first, last) {
		if (!ui.report) return;
		nodes.tableBody.innerHTML = tableRows
			.slice(first - 1, last)
			.map(accountRow)
			.join('');
	}

	function accountRow(account) {
		const month = rowMonth(account);
		const industry = lookup(ledger.industries, account.industry).name;
		return (
			`<tr data-ca-row="${account.id}">` +
			`<td><span class="ca-acc"><a class="ca-acc-name ca-acc-open" href="${accountLink(account)}">${htmlSafe(account.name)}</a><span class="ca-acc-sub">${account.id} · ${htmlSafe(industry)}</span></span></td>` +
			`<td>${planBadge(account.plan)}</td>` +
			`<td class="ca-col-region">${htmlSafe(lookup(ledger.regions, account.region).name)}</td>${numberCell(
				compactDollars(yearlyRevenue(account, month)),
			)}${numberCell(shiftBadge(revenueShift(account)))}<td>${healthMeter(account.health[month])}</td>` +
			`<td class="ca-col-when">${whenCell(account, month)}</td></tr>`
		);
	}

	function shiftBadge(shift) {
		if (ui.list === 'lost') return `<span class="ca-down">${withSign(shift, compactDollars)}</span>`;
		if (shift == null) return '<span class="basalt-status basalt-status-primary">New</span>';
		return `<span class="${trendClass(shift)}">${shift === 0 ? 'Same' : withSign(shift, compactDollars)}</span>`;
	}

	function whenCell(account, month) {
		function note(text) {
			return `<span class="ca-acc-sub d-block">${text}</span>`;
		}
		if (ui.list === 'lost')
			return monthAndYear(account.end) + note(htmlSafe(lookup(ledger.reasons, account.reason).name));
		if (ui.list === 'won') return monthAndYear(account.start);
		return longDate(nextRenewal(account, month)) + note(account.billing);
	}

	function planBadge(planId) {
		const plan = lookup(ledger.plans, planId);
		/* The dot color goes inline because .badge.basalt-badge-as-dot beats
       the shared tone classes. */
		return `<span class="badge basalt-badge-as-dot" style="--dot:var(--basalt-series-${plan.tone})">${htmlSafe(plan.name)}</span>`;
	}

	const METER_COLORS = {
		healthy: 'var(--basalt-success)',
		watch: 'var(--basalt-warning)',
		risk: 'var(--basalt-danger)',
	};

	function healthMeter(score) {
		if (score == null) return '<span class="ca-flat">none</span>';
		const band = healthBand(score);
		return `<span class="ca-health"><span class="ca-health-bar" aria-hidden="true"><span style="--ca-h:${score}%;--ca-c:${METER_COLORS[band]}"></span></span>${score}<span class="visually-hidden">, ${BAND_LABELS[band].toLowerCase()}</span></span>`;
	}

	/* A click on a row's empty space follows its account link; the link
     stays the keyboard target, and menus keep their own clicks. */
	function followRowLink(event) {
		if (event.target.closest('a, button, .dropdown-menu')) return;
		const link = event.target.closest('tr')?.querySelector('a.ca-acc-open');
		if (!link) return;
		if (event.metaKey || event.ctrlKey) window.open(link.href, '_blank', 'noopener');
		else location.href = link.href;
	}

	function resetTable() {
		ui.query = '';
		nodes.search.value = '';
		const hadFocus = ui.focus?.kind;
		ui.focus = null;
		paintAccounts(true);
		if (!hadFocus) return;
		refreshChart('reasons');
		refreshChart('segments');
		paintSegmentTable();
	}

	/* Every export menu entry is turned into a CSV file here. */

	/** @returns {[string, Array<Array<*>>]} file name and rows, header first */
	function exportTable(kind) {
		const report = ui.report;
		const endMonth = monthAt(report.range.to);
		const stamp = `${ledger.months[report.range.from].toISOString().slice(0, 7)}-to-${new Date(endMonth.getFullYear(), endMonth.getMonth(), 15).toISOString().slice(0, 7)}`;
		const sheets = {
			accounts() {
				const lost = ui.list === 'lost';
				const header = [
					'Account ID',
					'Name',
					'Plan',
					'Region',
					'Company size',
					'Industry',
					'Billing',
					'Yearly revenue',
					'Change in period',
					'Health score',
					lost ? 'Left' : 'Account manager',
				];
				const rows = tableRows.map((account) => {
					const month = rowMonth(account);
					const shift = revenueShift(account);
					return [
						account.id,
						account.name,
						lookup(ledger.plans, account.plan).name,
						lookup(ledger.regions, account.region).name,
						lookup(ledger.sizes, account.size).name,
						lookup(ledger.industries, account.industry).name,
						account.billing,
						yearlyRevenue(account, month),
						shift == null ? 'New' : shift,
						account.health[month],
						lost ? monthAndYear(account.end) : account.owner || '',
					];
				});
				return [`customers-${ui.list}-${stamp}.csv`, [header, ...rows]];
			},
			risk() {
				const month = report.range.to;
				const header = [
					'Account ID',
					'Name',
					'Plan',
					'Yearly revenue',
					'Health score',
					'Renews',
					'Account manager',
					'What changed',
					'Status',
				];
				const rows = atRiskAccounts().map((account) => [
					account.id,
					account.name,
					lookup(ledger.plans, account.plan).name,
					yearlyRevenue(account, month),
					account.health[month],
					longDate(nextRenewal(account, month)),
					account.owner || '',
					warningText(account, month),
					ui.riskMarks[account.id] || 'open',
				]);
				return [`accounts-at-risk-${stamp}.csv`, [header, ...rows]];
			},
			segments() {
				const rows = [
					[
						'Split by',
						'Segment',
						'Paying customers',
						'Yearly revenue',
						'Net revenue retention %',
						'Monthly churn %',
						'Won',
						'Lost',
					],
				];
				for (const [split, segments] of Object.entries(report.segments)) {
					for (const segment of segments) {
						rows.push([
							SPLIT_LABELS[split],
							segment.name,
							segment.customers,
							Math.round(segment.arr),
							segment.atStart ? segment.nrr.toFixed(1) : '',
							segment.atStart ? segment.churnRate.toFixed(1) : '',
							segment.won,
							segment.lost,
						]);
					}
				}
				return [`customer-segments-${stamp}.csv`, rows];
			},
		};
		if (sheets[kind]) return sheets[kind]();
		const monthly = report.flow.map((entry) => [monthAndYear(entry.month), entry.won, entry.lost, entry.customers]);
		return [`customers-by-month-${stamp}.csv`, [['Month', 'Won', 'Lost', 'Paying at month end'], ...monthly]];
	}

	function csvCell(value) {
		const text = String(value ?? '');
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
	}

	/* Charts draw the first time they scroll into view and are rebuilt on every change. */

	function drawOnArrival(entries) {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			lazyDraw.unobserve(entry.target);
			shownCanvases.add(entry.target);
			drawChart(entry.target, true);
		}
	}

	function watchCanvases(canvases) {
		for (const canvas of canvases) {
			if (lazyDraw) {
				lazyDraw.observe(canvas);
			} else {
				shownCanvases.add(canvas);
				drawChart(canvas, false);
			}
		}
	}

	function drawChart(canvas, animate) {
		if (!ui.report) return;
		liveCharts.get(canvas)?.destroy();
		const config = chartConfig(canvas, chartColors(), animate && !calmMotion);
		if (config) liveCharts.set(canvas, new Chart(canvas, config));
		summarizeChart(canvas);
	}

	function chartConfig(canvas, colors, animate) {
		if (canvas.hasAttribute('data-ca-spark')) return sparkChart(colors, animate, canvas);
		const recipe = CHART_RECIPES[canvas.getAttribute('data-ca-chart')];
		return recipe ? recipe(colors, animate) : null;
	}

	/* Charts still off screen only get a fresh label; they pick up the new
     figures when they scroll in. */
	function refreshAllCharts() {
		for (const canvas of shownCanvases) drawChart(canvas, true);
		for (const canvas of pickAll('canvas[data-ca-chart]')) {
			if (!shownCanvases.has(canvas)) summarizeChart(canvas);
		}
	}

	function refreshChart(name) {
		const canvas = pick(`canvas[data-ca-chart="${name}"]`);
		if (!canvas) return;
		if (shownCanvases.has(canvas)) drawChart(canvas, true);
		else summarizeChart(canvas);
	}

	/* One sentence per big chart, read out by screen readers. */
	const CHART_SUMMARIES = {
		flow: (report) =>
			`Accounts won and lost each month, ${periodName(report.range.from, report.range.to)}: ${wholeNumber(report.now.won)} won, ${wholeNumber(report.now.lost)} lost, ending at ${wholeNumber(report.now.customers)} paying customers.`,
		stay: (report) =>
			`Share of accounts still paying after each quarter since signup: ${COHORT_MARKS.filter(
				(quarter) => report.stay[quarter] != null,
			)
				.map((quarter) => `${percent(report.stay[quarter], 0)} after ${countOf(quarter, 'quarter')}`)
				.join(', ')}.`,
		segments: (report) =>
			`Paying customers by ${SPLIT_LABELS[ui.splitBy].toLowerCase()}: ${report.segments[ui.splitBy].map((segment) => `${segment.name} ${wholeNumber(segment.customers)}`).join(', ')}. Use the table beside it to pick one.`,
		reasons: (report) =>
			`${wholeNumber(report.lost)} accounts lost, by reason: ${report.reasons.map((reason) => `${reason.name} ${reason.count}`).join(', ')}. Arrow keys move between reasons, Enter lists those accounts.`,
	};

	function summarizeChart(canvas) {
		const name = canvas.getAttribute('data-ca-chart');
		if (!name || !ui.report) return;
		canvas.setAttribute('aria-label', CHART_SUMMARIES[name]?.(ui.report) ?? '');
	}

	/**
	 * Arrow keys step through the bars of a clickable chart and show each
	 * tooltip; Enter or Space then acts as a click on that bar.
	 */
	function enableChartKeys(name, countBars, activate) {
		const canvas = pick(`canvas[data-ca-chart="${name}"]`);
		const STEPS = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
		const layer = name === 'reasons' ? 1 : 0;
		let cursor = -1;

		canvas.addEventListener('keydown', (event) => {
			const chart = liveCharts.get(canvas);
			if (!chart) return;
			const step = STEPS[event.key];
			if (step !== undefined) {
				event.preventDefault();
				const total = countBars();
				cursor = cursor < 0 ? 0 : (cursor + step + total) % total;
				const active = [{ datasetIndex: layer, index: cursor }];
				const bar = chart.getDatasetMeta(layer).data[cursor];
				chart.setActiveElements(active);
				chart.tooltip.setActiveElements(active, { x: bar.x, y: bar.y });
				chart.update('none');
				return;
			}
			if ((event.key === 'Enter' || event.key === ' ') && cursor >= 0) {
				event.preventDefault();
				activate(cursor);
			}
		});

		canvas.addEventListener('blur', () => {
			const chart = liveCharts.get(canvas);
			cursor = -1;
			if (!chart) return;
			chart.setActiveElements([]);
			chart.tooltip.setActiveElements([], { x: 0, y: 0 });
			chart.update('none');
		});
	}

	function pointerOnHit(event, hits) {
		event.native.target.style.cursor = hits.length ? 'pointer' : 'default';
	}

	const CHART_RECIPES = {
		/* Won bars up, lost bars down, and the paying count as a line on its
       own right-hand scale. Won and lost use the status colors so they
       never share a hue on palettes that open with red. */
		flow(colors, animate) {
			const report = ui.report;
			const months = report.flow;
			const wonHue = colors.success;
			const lostHue = colors.danger;
			const tallest = Math.max(...months.map((entry) => Math.max(entry.won, entry.lost))) || 1;
			const paying = months.map((entry) => entry.customers);
			const low = Math.min(...paying);
			const high = Math.max(...paying);
			const margin = Math.max(10, (high - low) * 0.12);
			const countStep = Math.max(10, Math.ceil((high - low + margin * 2) / 4 / 50) * 50);
			const countFloor = Math.max(0, Math.floor((low - margin) / countStep) * countStep);
			const flowLimit = Math.max(10, Math.ceil((tallest * 1.15) / 10) * 10);
			const netChange = report.now.won - report.now.lost;
			const barBase = {
				type: 'bar',
				yAxisID: 'flow',
				stack: 'f',
				barPercentage: 0.62,
				maxBarThickness: 28,
				order: 2,
				borderRadius: 4,
			};

			return {
				type: 'bar',
				data: {
					labels: months.map((entry, index) => axisMonth(entry.month, index === 0)),
					datasets: [
						lineLayer(colors.text, {
							label: 'Paying customers',
							data: paying,
							yAxisID: 'count',
							borderWidth: 2,
							...ringPoints(colors, colors.text, months.length > 14 ? 0 : 3),
						}),
						{
							...barBase,
							label: 'Won',
							data: months.map((entry) => entry.won),
							backgroundColor: barGradient(wonHue),
							hoverBackgroundColor: wonHue,
						},
						{
							...barBase,
							label: 'Lost',
							data: months.map((entry) => -entry.lost),
							backgroundColor: translucent(lostHue, 0.85),
							hoverBackgroundColor: lostHue,
						},
					],
				},
				options: standardOptions(colors, animate, {
					layout: { padding: { top: 30, right: 4 } },
					plugins: {
						tooltip: {
							callbacks: {
								title: (items) => fullMonth(months[items[0].dataIndex].month),
								label: (item) => ` ${item.dataset.label}: ${wholeNumber(Math.abs(item.parsed.y))}`,
							},
						},
					},
					scales: {
						flow: {
							position: 'left',
							stacked: true,
							min: -flowLimit,
							max: flowLimit,
							grid: {
								color: (context) =>
									context.tick && context.tick.value === 0 ? colors.rest : colors.grid,
							},
							border: { display: false },
							ticks: axisTicks(colors, {
								stepSize: flowLimit / 2,
								callback: (value) => wholeNumber(Math.abs(value)),
							}),
						},
						count: {
							position: 'right',
							min: countFloor,
							max: countFloor + countStep * 4,
							grid: { display: false },
							border: { display: false },
							ticks: axisTicks(colors, { stepSize: countStep, callback: (value) => wholeNumber(value) }),
						},
						x: { stacked: true, ticks: { autoSkip: true, maxTicksLimit: 12 } },
						y: { display: false },
					},
				}),
				plugins: [
					{
						id: 'caNet',
						afterDatasetsDraw(chart) {
							const { ctx, chartArea: area } = chart;
							drawPill(
								ctx,
								colors,
								area.left + 2,
								area.top - 6,
								`${withSign(netChange, wholeNumber)} accounts net`,
								{ left: area.left, right: area.right, top: 0 },
								{ align: 'left', dot: netChange >= 0 ? wonHue : lostHue },
							);
						},
					},
				],
			};
		},

		/* Share of each signup cohort still paying, quarter by quarter. */
		stay(colors, animate) {
			const kept = ui.report.stay;
			const hue = colors.series[0];
			return {
				type: 'line',
				data: {
					labels: kept.map((_, quarter) => (quarter === 0 ? 'Signup' : `+${quarter} qtr`)),
					datasets: [
						lineLayer(hue, {
							label: 'Still paying',
							data: kept,
							fill: 'start',
							backgroundColor: areaGradient(hue, 0.18),
							...ringPoints(colors, hue, 3),
						}),
					],
				},
				options: standardOptions(colors, animate, {
					plugins: {
						tooltip: {
							displayColors: false,
							callbacks: {
								title: ([first]) =>
									first.dataIndex === 0
										? 'End of the signup quarter'
										: `After ${countOf(first.dataIndex, 'quarter')}`,
								label: (item) => ` ${percent(item.parsed.y, 0)} still paying`,
							},
						},
					},
					scales: { y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } } },
				}),
			};
		},

		/* Horizontal bars per segment with the count and revenue written at
       the tip; a click narrows the page or the table. */
		segments(colors, animate) {
			const split = ui.splitBy;
			const rows = ui.report.segments[split];
			const chosen = chosenSegment(split);
			const fills = rows.map((segment, index) => {
				const hue = segmentHue(colors, split, index, segment.id);
				return chosen && chosen !== segment.id ? blend(hue, colors.surface, 0.3) : hue;
			});
			const widest = Math.max(...rows.map((segment) => segment.customers)) || 1;

			return {
				type: 'bar',
				data: {
					labels: rows.map((segment) => segment.name),
					datasets: [
						{
							label: 'Paying customers',
							data: rows.map((segment) => segment.customers),
							backgroundColor: fills,
							hoverBackgroundColor: fills,
							borderRadius: 5,
							borderSkipped: false,
							barPercentage: 0.7,
							categoryPercentage: 0.86,
						},
					],
				},
				options: standardOptions(colors, animate, {
					indexAxis: 'y',
					interaction: { mode: 'nearest', axis: 'y', intersect: false },
					layout: { padding: { right: 90 } },
					onHover: pointerOnHit,
					onClick: (event, hits) => {
						if (hits.length) chooseSegment(rows[hits[0].index].id);
					},
					plugins: {
						tooltip: {
							displayColors: false,
							callbacks: {
								title: ([first]) => rows[first.dataIndex].name,
								label: (item) => {
									const segment = rows[item.dataIndex];
									const retentionNote = segment.atStart
										? `${percent(segment.nrr)} net revenue retention`
										: 'All new this period';
									return [
										` ${countOf(segment.customers, 'paying customer')}`,
										` ${compactDollars(segment.arr)} ARR`,
										` ${retentionNote}`,
									];
								},
								footer: () =>
									SPLITS_THAT_FILTER.has(split)
										? 'Click to show only this'
										: 'Click to list these accounts',
							},
						},
					},
					scales: {
						x: { display: false, min: 0, max: widest },
						y: {
							grid: { display: false },
							ticks: { color: colors.text, autoSkip: false, font: { family: CHART_FAMILY, size: 12 } },
						},
					},
				}),
				plugins: [
					{
						id: 'caSegLabels',
						afterDatasetsDraw(chart) {
							const { ctx } = chart;
							for (const [index, bar] of chart.getDatasetMeta(0).data.entries()) {
								const count = wholeNumber(rows[index].customers);
								drawLabel(ctx, colors.text, count, bar.x + 8, bar.y, 'left', 650, 'middle');
								ctx.save();
								ctx.font = `600 11px ${CHART_FAMILY}`;
								const countWidth = ctx.measureText(count).width;
								ctx.restore();
								drawLabel(
									ctx,
									colors.quiet,
									compactDollars(rows[index].arr),
									bar.x + 14 + countWidth,
									bar.y,
									'left',
									500,
									'middle',
								);
							}
						},
					},
				],
			};
		},

		/* A Pareto chart of cancellation reasons: bars for each share, a
       running line, a dotted 80% guide, and the reasons that reach 80%
       drawn solid. */
		reasons(colors, animate) {
			const report = ui.report;
			const rows = report.reasons;
			const hue = colors.series[7];
			const lostTotal = report.lost || 1;
			const shares = rows.map((reason) => Math.round((reason.count / lostTotal) * 1000) / 10);
			let runningTotal = 0;
			const cumulative = shares.map((share) => {
				runningTotal += share;
				return Math.round(runningTotal * 10) / 10;
			});
			const leaders = Math.max(
				0,
				cumulative.findIndex((value) => value >= 79.95),
			);
			const solid = barGradient(hue);
			const faded = barGradient(hue, 0.38, 0.16);
			const picked = ui.focus && ui.focus.kind === 'reason' ? ui.focus.id : '';
			function fillFor(context) {
				if (picked && rows[context.dataIndex].id !== picked) return faded(context);
				return context.dataIndex <= leaders ? solid(context) : faded(context);
			}

			return {
				type: 'bar',
				data: {
					labels: rows.map((reason) => reason.name),
					datasets: [
						lineLayer(colors.text, {
							label: 'Running share',
							data: cumulative,
							borderWidth: 2,
							...ringPoints(colors, colors.text),
						}),
						{
							type: 'bar',
							label: 'Share of accounts lost',
							data: shares,
							order: 2,
							barPercentage: 0.62,
							maxBarThickness: 40,
							backgroundColor: fillFor,
							hoverBackgroundColor: hue,
							borderColor: rows.map((reason) =>
								reason.id === picked ? colors.text : 'rgba(0, 0, 0, 0)',
							),
							borderWidth: 2,
						},
					],
				},
				options: standardOptions(colors, animate, {
					layout: { padding: { top: 26 } },
					onHover: pointerOnHit,
					onClick: (event, hits) => {
						if (hits.length) chooseReason(rows[hits[0].index].id);
					},
					plugins: {
						tooltip: {
							itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
							callbacks: {
								title: ([first]) => rows[first.dataIndex].name,
								label: (item) =>
									item.datasetIndex === 1
										? ` ${countOf(rows[item.dataIndex].count, 'account')}, ${percent(item.parsed.y)} of losses`
										: ` Running share: ${percent(item.parsed.y)}`,
								afterBody: ([first]) =>
									` ${compactDollars(rows[first.dataIndex].arr)} yearly revenue lost`,
								footer: () => 'Click to list these accounts',
							},
						},
					},
					scales: {
						x: {
							ticks: {
								autoSkip: false,
								maxRotation: 50,
								font: (context) => ({
									family: CHART_FAMILY,
									size: context.chart.width < 420 ? 10 : 11.5,
								}),
								callback: (value, index) => rows[index].short,
							},
						},
						y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (value) => `${value}%` } },
					},
				}),
				plugins: [
					{
						id: 'caEighty',
						beforeDatasetsDraw(chart) {
							const {
								ctx,
								chartArea: area,
								scales: { y },
							} = chart;
							const guide = y.getPixelForValue(80);
							ctx.save();
							ctx.strokeStyle = colors.rest;
							ctx.lineWidth = 1.25;
							ctx.setLineDash([2, 4]);
							ctx.beginPath();
							ctx.moveTo(area.left, guide);
							ctx.lineTo(area.right, guide);
							ctx.stroke();
							ctx.restore();
						},
						afterDatasetsDraw(chart) {
							const { ctx, chartArea: area } = chart;
							const point = chart.getDatasetMeta(0).data[leaders];
							if (!point || !report.lost) return;
							drawPill(
								ctx,
								colors,
								point.x + 10,
								point.y + 26,
								`Top ${leaders + 1} · ${percent(cumulative[leaders], 0)} of losses`,
								{ left: area.left, right: area.right + 6, top: 0 },
								{ align: 'left', dot: hue },
							);
						},
					},
				],
			};
		},
	};

	/* The small trend line under each headline figure. */
	function sparkChart(colors, animate, canvas) {
		const key = canvas.getAttribute('data-ca-spark');
		const figure = FIGURES.find((entry) => entry.key === key);
		const spark = ui.report.spark;
		const values = spark[key];
		const hue = colors.series[figure.hue];
		const lastIndex = values.length - 1;
		const low = Math.min(...values);
		const high = Math.max(...values);
		const room = high - low || Math.abs(high) * 0.1 || 1;
		return {
			type: 'line',
			data: {
				labels: spark.months.map((month) => monthAndYear(month)),
				datasets: [
					{
						label: figure.title,
						data: values,
						fill: 'start',
						borderColor: hue,
						backgroundColor: areaGradient(hue, 0.34),
						pointBackgroundColor: hue,
						borderWidth: 2,
						tension: 0.35,
						pointRadius: (context) => (context.dataIndex === lastIndex ? 3 : 0),
						pointBorderWidth: 0,
					},
				],
			},
			options: standardOptions(colors, animate, {
				layout: { padding: { top: 4, right: 4, bottom: 0, left: 0 } },
				plugins: {
					tooltip: {
						displayColors: false,
						callbacks: { label: (item) => ` ${figure.format(item.parsed.y)}` },
					},
				},
				scales: {
					x: { display: false },
					y: { display: false, min: low - room * 0.6, max: high + room * 0.12 },
				},
			}),
		};
	}

	/* Styling that every chart on the page shares. */

	/** Reads the palette from the live --basalt-* tokens. */
	function chartColors() {
		const text = readToken('--basalt-copy', '#12233a');
		const muted = readToken('--basalt-copy-muted', '#5f7186');
		return {
			text,
			/* The same mix as --ca-quiet in the stylesheet, so small labels
         keep 4.5:1 contrast on the paler palettes. */
			quiet: blend(muted, text, 0.82),
			rest: translucent(text, 0.4),
			grid: translucent(text, 0.07),
			surface: readToken('--basalt-plane', '#ffffff'),
			border: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			success: readToken('--basalt-success', '#12c08f'),
			danger: readToken('--basalt-danger', '#ef4d63'),
			series: Array.from({ length: 8 }, (_, index) => readToken(`--basalt-series-${index + 1}`, '#2b6fd4')),
		};
	}

	function planHue(colors, planId) {
		return colors.series[lookup(ledger.plans, planId).tone - 1];
	}

	/**
	 * Chart.js options every chart starts from, deep-merged with its own.
	 * Arrays and functions in `overrides` replace; plain objects merge.
	 */
	function standardOptions(colors, animate, overrides) {
		const tickStyle = { color: colors.quiet, font: AXIS_FONT, padding: 8 };
		const shared = {
			responsive: true,
			maintainAspectRatio: false,
			animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
			interaction: { mode: 'index', intersect: false },
			layout: { padding: { top: 6, right: 6 } },
			elements: {
				line: { borderWidth: 2.5, borderCapStyle: 'round', borderJoinStyle: 'round' },
				point: { radius: 0, hoverRadius: 5, hoverBorderWidth: 2, hoverBorderColor: colors.surface },
				bar: { borderRadius: 5, borderSkipped: 'start' },
			},
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					titleColor: colors.text,
					bodyColor: colors.text,
					footerColor: colors.text,
					titleFont: { family: CHART_FAMILY, size: 12, weight: '600' },
					bodyFont: { family: CHART_FAMILY, size: 12 },
					footerFont: { family: CHART_FAMILY, size: 11.5, weight: '600' },
					padding: 10,
					boxPadding: 4,
					cornerRadius: 8,
					usePointStyle: true,
				},
			},
			scales: {
				x: {
					grid: { display: false },
					border: { display: false },
					ticks: { maxRotation: 0, autoSkipPadding: 12, ...tickStyle },
				},
				y: {
					grid: { color: colors.grid },
					border: { display: false },
					ticks: { maxTicksLimit: 5, ...tickStyle },
				},
			},
		};
		return foldInto(shared, overrides);
	}

	function foldInto(target, overrides) {
		const merged = { ...target };
		for (const [key, value] of Object.entries(overrides || {})) {
			merged[key] = isPlain(value) && isPlain(merged[key]) ? foldInto(merged[key], value) : value;
		}
		return merged;
	}

	function isPlain(value) {
		return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	}

	function axisTicks(colors, extra) {
		return { color: colors.quiet, font: AXIS_FONT, padding: 8, ...extra };
	}

	/* A top-to-bottom fade across the plot; with gradients off, one plain
	   color: `flat`, or the first stop. */
	function verticalGradient(stops, flat) {
		return window.Basalt.chartFill(stops, { flat });
	}

	function barGradient(color, topAlpha = 0.95, bottomAlpha = 0.5) {
		return verticalGradient([
			[0, translucent(color, topAlpha)],
			[1, translucent(color, bottomAlpha)],
		]);
	}

	function areaGradient(color, strength) {
		return verticalGradient(
			[
				[0, translucent(color, strength || 0.28)],
				[1, translucent(color, 0)],
			],
			translucent(color, 0.12),
		);
	}

	/* A line dataset that sits above the bars of a mixed chart. */
	function lineLayer(color, extra) {
		return {
			type: 'line',
			order: 0,
			tension: 0.3,
			borderColor: color,
			backgroundColor: color,
			pointBackgroundColor: color,
			pointHoverBackgroundColor: color,
			...extra,
		};
	}

	/* Hollow point markers: card-colored centers with a colored rim. */
	function ringPoints(colors, color, radius = 3.5) {
		return {
			pointRadius: radius,
			pointHoverRadius: 5.5,
			pointBorderWidth: 2,
			pointBackgroundColor: colors.surface,
			pointBorderColor: color,
			pointHoverBackgroundColor: color,
			pointHoverBorderColor: colors.surface,
		};
	}

	/**
	 * Paints a rounded label onto the canvas: card fill, edge stroke, body
	 * text, and an optional colored dot, so it reads on every palette.
	 * (x, y) is the middle of the bottom edge, clamped inside bounds.left
	 * and bounds.right.
	 */
	function drawPill(pen, colors, x, y, label, bounds, settings = {}) {
		pen.save();
		pen.font = `600 11px ${CHART_FAMILY}`;
		const dotRoom = settings.dot ? 12 : 0;
		const width = pen.measureText(label).width + 16 + dotRoom;
		const height = 21;
		const anchored = { left: x, right: x - width }[settings.align] ?? x - width / 2;
		const left = Math.max(bounds.left, Math.min(anchored, bounds.right - width));
		const top = Math.max(bounds.top ?? -Infinity, y - height);

		pen.fillStyle = colors.surface;
		pen.strokeStyle = colors.border;
		pen.lineWidth = 1;
		pen.beginPath();
		if (pen.roundRect) pen.roundRect(left, top, width, height, 10.5);
		else pen.rect(left, top, width, height);
		pen.fill();
		pen.stroke();

		if (settings.dot) {
			pen.fillStyle = settings.dot;
			pen.beginPath();
			pen.arc(left + 11, top + height / 2, 3.5, 0, Math.PI * 2);
			pen.fill();
		}

		pen.fillStyle = colors.text;
		pen.textAlign = 'left';
		pen.textBaseline = 'middle';
		pen.fillText(label, left + 8 + dotRoom, top + height / 2 + 0.5);
		pen.restore();
		return { left, top, w: width, h: height };
	}

	function drawLabel(pen, color, label, x, y, align, weight, baseline) {
		pen.save();
		pen.font = `${weight || 600} 11px ${CHART_FAMILY}`;
		pen.fillStyle = color;
		pen.textAlign = align || 'left';
		pen.textBaseline = baseline || 'bottom';
		pen.fillText(label, x, y);
		pen.restore();
	}

	/* Color parsing and mixing for the canvases. */

	function readToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Splits #rgb, #rrggbb, rgb() or rgba() into [r, g, b, alpha]; gray when unreadable. */
	function toChannels(color) {
		const value = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(value);
		if (short) return [...short[1]].map((digit) => parseInt(digit + digit, 16)).concat(1);
		const long = /^#([0-9a-f]{6})$/i.exec(value);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 1];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(value);
		if (functional) {
			const parts = functional[1].split(',').map((part) => parseFloat(part));
			return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
		}
		return [128, 128, 128, 1];
	}

	function translucent(color, alpha) {
		const [red, green, blue] = toChannels(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** Mixes two colors, taking `weight` of the first. */
	function blend(first, second, weight) {
		const a = toChannels(first);
		const b = toChannels(second);
		function channel(index) {
			return Math.round(a[index] * weight + b[index] * (1 - weight));
		}
		return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
	}

	/* Formatters that turn numbers and months into words. */

	function pick(selector, scope = page) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = page) {
		return [...scope.querySelectorAll(selector)];
	}

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	function htmlSafe(value) {
		return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	function announce(message) {
		window.Basalt.announce?.(message);
	}

	function pause(ms, value) {
		return new Promise((resolve) => {
			setTimeout(() => resolve(value), ms);
		});
	}

	function lookup(entries, id) {
		return entries.find((entry) => entry.id === id);
	}

	function addUp(items, valueOf) {
		let total = 0;
		for (const item of items) total += valueOf(item);
		return total;
	}

	function monthAbbr(index) {
		return SHORT_MONTHS[monthAt(index).getMonth()];
	}

	function monthAndYear(index) {
		return `${monthAbbr(index)} ${monthAt(index).getFullYear()}`;
	}

	function fullMonth(index) {
		const date = monthAt(index);
		return `${LONG_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
	}

	/* Axis months carry a two-digit year on the first tick and on January. */
	function axisMonth(index, isFirst) {
		const date = monthAt(index);
		if (!isFirst && date.getMonth() !== 0) return monthAbbr(index);
		return `${monthAbbr(index)} ${String(date.getFullYear()).slice(2)}`;
	}

	function periodName(from, to) {
		if (from === to) return monthAndYear(to);
		const sameYear = monthAt(from).getFullYear() === monthAt(to).getFullYear();
		return `${sameYear ? monthAbbr(from) : monthAndYear(from)} to ${monthAndYear(to)}`;
	}

	function longDate(date) {
		return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
	}

	function wholeNumber(value) {
		return Math.round(value).toLocaleString('en-US');
	}

	function percent(value, digits = 1) {
		const factor = 10 ** digits;
		return `${(Math.round(value * factor) / factor).toFixed(digits)}%`;
	}

	/* Dollars shortened to k or M, with a true minus sign. */
	function compactDollars(value) {
		const size = Math.abs(value);
		const minus = value < 0 ? '−' : '';
		if (size >= 1e6) return `${minus}$${(size / 1e6).toFixed(2)}M`;
		if (size >= 1e3) return `${minus}$${(size / 1e3).toFixed(size >= 1e5 ? 0 : 1)}k`;
		return `${minus}$${Math.round(size)}`;
	}

	function withSign(value, format) {
		let sign = '';
		if (value > 0) sign = '+';
		else if (value < 0) sign = '−';
		return sign + format(Math.abs(value));
	}

	function countOf(count, singular, pluralForm) {
		return `${wholeNumber(count)} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
	}

	function healthBand(score) {
		if (score >= 70) return 'healthy';
		return score >= 50 ? 'watch' : 'risk';
	}

	/* A report holds the figures for one period under one set of filters. */

	/**
	 * Works out everything the page shows for a period and the filters,
	 * plus the same-length period right before it for comparisons. A real
	 * backend behind server.fetchReport() should answer in this same shape.
	 * @param {{from: number, to: number}} range month indexes into ledger.months
	 * @param {{plan: string, region: string, size: string}} filters ids, '' for all
	 */
	function composeReport(range, filters) {
		const accounts = accountsFor(filters);
		const length = range.to - range.from + 1;
		const earlier = { from: range.from - length, to: range.from - 1 };
		const comparable = earlier.from >= 1;

		const lostInRange = accounts.filter(
			(account) => account.end !== null && account.end >= range.from && account.end <= range.to,
		);
		const reasons = ledger.reasons
			.map((reason) => {
				const leavers = lostInRange.filter((account) => account.reason === reason.id);
				return {
					id: reason.id,
					name: reason.name,
					short: reason.short,
					count: leavers.length,
					arr: addUp(leavers, (account) => account.mrr[account.end - 1] * 12),
				};
			})
			.sort((a, b) => b.count - a.count || b.arr - a.arr);

		return {
			range,
			filters,
			cmp: comparable ? earlier : null,
			count: accounts.length,
			now: measurePeriod(accounts, range.from, range.to),
			then: comparable ? measurePeriod(accounts, earlier.from, earlier.to) : null,
			spark: sparkSeries(accounts, range, length),
			flow: monthlyFlow(accounts, range),
			reasons,
			lost: lostInRange.length,
			segments: segmentBreakdown(accounts, range, comparable ? earlier : null),
			stay: cohortRetention(accounts),
			list: accounts,
		};
	}

	function accountsFor({ plan, region, size }) {
		return ledger.accounts.filter(
			(account) =>
				(!plan || account.plan === plan) &&
				(!region || account.region === region) &&
				(!size || account.size === size),
		);
	}

	function payingIn(account, month) {
		return month >= 0 && month < MONTHS_HELD && account.mrr[month] > 0;
	}

	/* Revenue from the month before `from` to the month `to`, split into
     what grew, shrank and left. */
	function revenueBridge(accounts, from, to) {
		const opening = from - 1;
		let start = 0;
		let end = 0;
		let growth = 0;
		let shrink = 0;
		let gone = 0;
		for (const account of accounts) {
			const before = payingIn(account, opening) ? account.mrr[opening] : 0;
			const after = payingIn(account, to) ? account.mrr[to] : 0;
			start += before;
			end += after;
			if (!before) continue;
			if (!after) gone -= before;
			else if (after > before) growth += after - before;
			else shrink += after - before;
		}
		return {
			start,
			expansion: growth,
			contraction: shrink,
			churned: gone,
			end,
			nrr: start ? ((start + growth + shrink + gone) / start) * 100 : 0,
			grr: start ? ((start + shrink + gone) / start) * 100 : 0,
		};
	}

	function measurePeriod(accounts, from, to) {
		const openedWith = accounts.filter((account) => payingIn(account, from - 1));
		const lost = accounts.filter(
			(account) => account.end !== null && account.end >= from && account.end <= to,
		).length;
		const lostFromOpening = openedWith.filter((account) => account.end !== null && account.end <= to).length;
		/* Accounts paying at the start of each month, summed for the average
       monthly churn rate. */
		let monthsAtRisk = 0;
		for (let month = from; month <= to; month += 1) {
			monthsAtRisk += accounts.filter((account) => payingIn(account, month - 1)).length;
		}
		const bridge = revenueBridge(accounts, from, to);
		const struggling = accounts.filter((account) => payingIn(account, to) && account.health[to] < 50);
		return {
			customers: accounts.filter((account) => payingIn(account, to)).length,
			atStart: openedWith.length,
			won: accounts.filter((account) => account.start >= from && account.start <= to).length,
			lost,
			churnRate: monthsAtRisk ? (lost / monthsAtRisk) * 100 : 0,
			lostShare: openedWith.length ? (lostFromOpening / openedWith.length) * 100 : 0,
			nrr: bridge.nrr,
			grr: bridge.grr,
			arr: bridge.end * 12,
			riskArr: addUp(struggling, (account) => account.mrr[to] * 12),
			riskCount: struggling.length,
		};
	}

	/* Rolling values for the figure sparklines. They reach back at least
     six months so even a short period draws a shape. */
	function sparkSeries(accounts, range, length) {
		const series = { months: [], customers: [], nrr: [], grr: [], churnRate: [], riskArr: [] };
		for (let month = Math.max(1, range.to - Math.max(length, 6) + 1); month <= range.to; month += 1) {
			const slice = measurePeriod(accounts, Math.max(1, month - length + 1), month);
			series.months.push(month);
			series.customers.push(slice.customers);
			series.nrr.push(toTenths(slice.nrr));
			series.grr.push(toTenths(slice.grr));
			series.churnRate.push(toTenths(slice.churnRate));
			series.riskArr.push(slice.riskArr);
		}
		return series;
	}

	function toTenths(value) {
		return Math.round(value * 10) / 10;
	}

	function monthlyFlow(accounts, range) {
		const months = [];
		for (let month = range.from; month <= range.to; month += 1) {
			months.push({
				month,
				won: accounts.filter((account) => account.start === month).length,
				lost: accounts.filter((account) => account.end === month).length,
				customers: accounts.filter((account) => payingIn(account, month)).length,
			});
		}
		return months;
	}

	function segmentBreakdown(accounts, range, earlier) {
		const splits = {
			plan: ledger.plans,
			size: ledger.sizes,
			industry: ledger.industries,
			region: ledger.regions,
			channel: ledger.channels,
		};
		const breakdown = {};
		for (const [split, groups] of Object.entries(splits)) {
			breakdown[split] = groups.map((group) => {
				const inGroup = accounts.filter((account) => account[split] === group.id);
				const stats = measurePeriod(inGroup, range.from, range.to);
				return {
					id: group.id,
					name: group.name,
					customers: stats.customers,
					before: earlier ? inGroup.filter((account) => payingIn(account, earlier.to)).length : null,
					arr: stats.arr,
					nrr: stats.nrr,
					churnRate: stats.churnRate,
					won: stats.won,
					lost: stats.lost,
					atStart: stats.atStart,
				};
			});
		}
		return breakdown;
	}

	/* For every signup quarter, the share still paying k quarters after it
     closed, pooled across all quarters old enough to reach k. It spans the
     whole history, so the period has no effect; filters do. */
	function cohortRetention(accounts) {
		const pooled = [];
		for (let opening = 0; opening < MONTHS_HELD; opening += 3) {
			const cohort = accounts.filter((account) => account.start >= opening && account.start < opening + 3);
			for (let lag = 0, checkpoint = opening + 2; checkpoint < MONTHS_HELD; lag += 1, checkpoint += 3) {
				pooled[lag] = pooled[lag] || { size: 0, kept: 0 };
				pooled[lag].size += cohort.length;
				pooled[lag].kept += cohort.filter((account) => payingIn(account, checkpoint)).length;
			}
		}
		return pooled.filter((entry) => entry.size > 0).map((entry) => (entry.kept / entry.size) * 100);
	}

	/* These helpers are also handed to the details page. */

	function monthAt(index) {
		return ledger.months[index];
	}

	function yearlyRevenue(account, month) {
		return (account.mrr[month] || 0) * 12;
	}

	/* The renewal after month `month`: the next month on monthly billing,
     the signup anniversary on annual. */
	function nextRenewal(account, month) {
		const day = 1 + (account.seed % 27);
		if (account.billing === 'Monthly') {
			const base = monthAt(month);
			return new Date(base.getFullYear(), base.getMonth() + 1, day);
		}
		let anniversary = account.start;
		while (anniversary <= month) anniversary += 12;
		const newest = monthAt(FINAL_MONTH);
		return new Date(newest.getFullYear(), newest.getMonth() + (anniversary - FINAL_MONTH), day);
	}

	/* The few words that explain a falling health score. */
	function warningText(account, month) {
		const seed = account.seed;
		const fills = {
			n: 22 + (seed % 31),
			d: 14 + (seed % 25),
			t: 2 + (seed % 4),
			a: 28 + (seed % 27),
			mo: LONG_MONTHS[monthAt(Math.max(0, month - 2)).getMonth()],
		};
		let text = ledger.signals[account.signal];
		for (const [slot, value] of Object.entries(fills)) text = text.replace(`{${slot}}`, value);
		return text;
	}

	function accountLink(account) {
		return `customer-insight.html?id=${encodeURIComponent(account.id)}`;
	}

	/* The demo ledger is generated from fixed seeds, so every visit sees the same book. */

	/** A small, fast seeded generator (mulberry32) returning 0 to 1. */
	function seededStream(seed) {
		let state = seed >>> 0;
		return () => {
			state = (state + 0x6d2b79f5) >>> 0;
			let mixed = state;
			mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* Picks from [value, weight] pairs. */
	function weightedPick(draw, pairs) {
		let leftover = draw() * pairs.reduce((total, pair) => total + pair[1], 0);
		for (const [value, weight] of pairs) {
			leftover -= weight;
			if (leftover <= 0) return value;
		}
		return pairs[pairs.length - 1][0];
	}

	function within(draw, low, high) {
		return low + draw() * (high - low);
	}

	/**
	 * Grows Fieldline's demo book: crews that work on site (home care, pet
	 * care, photography, cleaning and more). Each account carries 36 months
	 * of recurring revenue and health, October 2023 to September 2026. One
	 * seed per account keeps the book identical on every load, and a change
	 * to one setting nudges it rather than reshuffling it.
	 */
	function buildLedger() {
		const calendar = Array.from(
			{ length: MONTHS_HELD },
			(_, index) => new Date(NEWEST_MONTH.getFullYear(), NEWEST_MONTH.getMonth() - (MONTHS_HELD - 1) + index, 1),
		);

		/* Seat prices per seat per month; yearly billing gives two months
       free. `mrr` is where a new account starts: seats plus add-ons
       (Travel Planner at $8 a seat, Customer Portal at $199, SMS by use). */
		const plans = [
			{ id: 'starter', name: 'Basic', tone: 3, seat: 15, churn: 0.019, mrr: [38, 280] },
			{ id: 'growth', name: 'Pro', tone: 1, seat: 32, churn: 0.0055, mrr: [150, 920] },
			{ id: 'enterprise', name: 'Max', tone: 5, seat: 58, churn: 0.002, mrr: [1000, 2600] },
		];
		const sizes = [
			{
				id: 'small',
				name: 'Small',
				hint: '1 to 15 team members',
				share: 66,
				plans: [
					['starter', 87],
					['growth', 13],
				],
			},
			{
				id: 'mid',
				name: 'Mid-sized',
				hint: '16 to 75 team members',
				share: 28,
				plans: [
					['starter', 29],
					['growth', 58],
					['enterprise', 13],
				],
			},
			{
				id: 'large',
				name: 'Large',
				hint: '76+ team members',
				share: 6,
				plans: [
					['growth', 45],
					['enterprise', 55],
				],
			},
		];
		const regions = [
			{ id: 'northeast', name: 'Northeast', share: 46, churn: 0.95 },
			{ id: 'midwest', name: 'Midwest', share: 29, churn: 0.9 },
			{ id: 'west', name: 'West', share: 15, churn: 1.15 },
			{ id: 'south', name: 'South', share: 10, churn: 1.3 },
		];
		const industries = [
			{
				id: 'homecare',
				name: 'Home care',
				share: 24,
				words: [
					'Home Care Group',
					'Care and Support',
					'Care Services',
					'Home Care',
					'Home Help',
					'Senior Care Services',
				],
			},
			{
				id: 'petcare',
				name: 'Pet care',
				share: 20,
				words: ['Pet Care', 'Pet Sitting and Walks', 'Tails', 'Pet Sitters', 'Dog Walking Co', 'Pet Services'],
			},
			{
				id: 'photography',
				name: 'Photography',
				share: 16,
				words: [
					'Studios',
					'Photography',
					'Photo Services',
					'Wedding Photographers',
					'Film and Photography',
					'Portraits',
				],
			},
			{
				id: 'cleaning',
				name: 'Cleaning',
				share: 15,
				words: [
					'Cleaning',
					'Janitorial',
					'Cleaning Co',
					'Commercial Cleaning',
					'Window Cleaning',
					'Carpet Care',
				],
			},
			{
				id: 'landscaping',
				name: 'Landscaping',
				share: 10,
				words: ['Landscaping', 'Lawn Care', 'Grounds', 'Gardens', 'Tree Service', 'Garden Care'],
			},
			{
				id: 'property',
				name: 'Property care',
				share: 7,
				words: [
					'Property Care',
					'Property Services',
					'Estate Caretakers',
					'Home Watchers',
					'Property Management',
					'Estate Care',
				],
			},
			{
				id: 'moving',
				name: 'Movers',
				share: 8,
				words: [
					'Moving Services',
					'Removal Services',
					'Moving and Storage',
					'Removals',
					'Relocations',
					'Movers',
				],
			},
		];
		const channels = [
			{ id: 'self', name: 'Self-serve' },
			{ id: 'sales', name: 'Sales-led' },
		];
		/* Cancellation reasons, as given on the exit form and call. */
		const reasons = [
			{ id: 'value', name: 'Not using it enough', short: 'Low use', weight: 27 },
			{ id: 'budget', name: 'Budget cut', short: 'Budget', weight: 21 },
			{ id: 'competitor', name: 'Moved to a competitor', short: 'Competitor', weight: 17 },
			{ id: 'features', name: 'Missing a feature', short: 'Feature', weight: 12 },
			{ id: 'onboarding', name: 'Never finished setup', short: 'Setup', weight: 9 },
			{ id: 'closed', name: 'Company closed or sold', short: 'Closed', weight: 8 },
			{ id: 'billing', name: 'Payment failed', short: 'Payment', weight: 6 },
		];
		/* Warning signs behind a falling score, for the at-risk list. */
		const signals = [
			'Weekly visits down {n}%',
			'No scheduler sign-in for {d} days',
			'{t} urgent tickets open',
			'Card declined twice',
			'The admin who set it up left',
			'Asked about canceling',
			'Only {a}% of staff on the app',
			'Stopped sending invoices in {mo}',
		];
		const owners = [
			'Courtney Nugent',
			'Todd Upshaw',
			'Leslie Leach',
			'Dev McCarthy',
			'Abby Morrow',
			'Pamela Barlow',
		];
		/* The finish line for September 2026, and where MRR stood a year
       earlier; calibrate() bends the book onto these numbers. */
		const targets = {
			start: 655000,
			nrr: 112,
			grr: 93,
			accounts: { starter: 1190, growth: 790, enterprise: 160 },
			mrr: { starter: 158000, growth: 361000, enterprise: 361000 },
		};
		const NAME_STEMS = [
			'Alder',
			'Amberly',
			'Tamarisk',
			'Ashgrove',
			'Bayline',
			'Beacon',
			'Birchwood',
			'Bluegate',
			'Thicket',
			'Brightwater',
			'Cairn',
			'Calloway',
			'Cedarline',
			'Clearpath',
			'Coastal',
			'Copperfield',
			'Crescent',
			'Dovetail',
			'Driftwood',
			'Eastgate',
			'Elmstead',
			'Everline',
			'Fairhaven',
			'Fieldstone',
			'Foxglove',
			'Galeway',
			'Glenmore',
			'Goldcrest',
			'Greyfriars',
			'Halcyon',
			'Harborview',
			'Hartwell',
			'Highmark',
			'Hollis',
			'Ironbridge',
			'Ivory',
			'Juniper',
			'Keystone',
			'Kingsley',
			'Lakeshore',
			'Larkspur',
			'Lindenwood',
			'Longview',
			'Glint',
			'Maplecroft',
			'Penrose',
			'Meadowlark',
			'Millbrook',
			'Moorland',
			'Northgate',
			'Oakhurst',
			'Orchard',
			'Osprey',
			'Paragon',
			'Pebblebrook',
			'Pinehill',
			'Primrose',
			'Quayside',
			'Ravenna',
			'Redfern',
			'Downland',
			'Millrace',
			'Rosewood',
			'Saltbrook',
			'Sandpiper',
			'Silverleaf',
			'Southfield',
			'Stillwater',
			'Stonebridge',
			'Highpoint',
			'Tamarack',
			'Townsend',
			'Timberline',
			'Truewind',
			'Upton',
			'Valemont',
			'Westbury',
			'Whitfield',
			'Wildflower',
			'Wrenfield',
		];
		const NAME_SUFFIXES = ['North', 'West', 'Pacific', 'Atlantic', 'East', 'South', 'Central', 'Valley'];

		const takenNames = new Set();
		const accounts = [];
		const cohortDraw = seededStream(73019);

		/* The book as it stood in October 2023, then every month's signups. */
		for (let index = 0; index < 1230; index += 1) {
			accounts.push(openAccount(-1 - Math.floor(cohortDraw() * 30)));
		}
		for (let month = 0; month < FINAL_MONTH; month += 1) {
			const signups = Math.round(42 + month * 0.82 + (cohortDraw() - 0.5) * 8);
			for (let index = 0; index < signups; index += 1) accounts.push(openAccount(month));
		}
		/* September 2026 signups top each plan up to its target count. */
		for (const plan of plans) {
			const paying = accounts.filter(
				(account) => account.plan === plan.id && account.mrr[FINAL_MONTH] > 0,
			).length;
			for (let count = paying; count < targets.accounts[plan.id]; count += 1)
				accounts.push(openAccount(FINAL_MONTH, plan.id));
		}
		calibrate();

		return {
			now: DEMO_TODAY,
			months: calendar,
			plans,
			sizes,
			regions,
			industries,
			channels,
			reasons,
			signals,
			owners,
			accounts,
		};

		/**
		 * One account from its own seeded stream, with its revenue and health
		 * filled in month by month from `startMonth`.
		 * @param {number} startMonth signup month; below 0 means before the data starts
		 * @param {string} [planId] force a plan, used when topping up the counts
		 */
		function openAccount(startMonth, planId) {
			const draw = seededStream(91000 + accounts.length * 7919);
			const size = planId
				? weightedPick(
						draw,
						sizes
							.filter((option) => option.plans.some(([id]) => id === planId))
							.map((option) => [option, option.share * option.plans.find(([id]) => id === planId)[1]]),
					)
				: weightedPick(
						draw,
						sizes.map((option) => [option, option.share]),
					);
			const plan = lookup(plans, planId || weightedPick(draw, size.plans));
			const region = weightedPick(
				draw,
				regions.map((option) => [option, option.share]),
			);
			const industry = weightedPick(
				draw,
				industries.map((option) => [option, option.share]),
			);
			const channel =
				plan.id === 'enterprise' ? 'sales' : draw() < (plan.id === 'starter' ? 0.9 : 0.45) ? 'self' : 'sales';
			const yearly = plan.id === 'enterprise' || draw() < (plan.id === 'growth' ? 0.55 : 0.28);
			let revenue = Math.round(Math.exp(within(draw, Math.log(plan.mrr[0]), Math.log(plan.mrr[1]))) / 5) * 5;
			/* Accounts on the small side of their plan leave more often. */
			const sizeRisk = Math.pow(Math.sqrt(plan.mrr[0] * plan.mrr[1]) / revenue, 1.5);
			/* The score an account usually sits near, and maybe one rough patch. */
			const usualHealth = draw() < 0.08 ? within(draw, 44, 58) : within(draw, 60, 93);
			const slump =
				draw() < 0.24
					? {
							first: Math.floor(within(draw, 2, MONTHS_HELD + 3)),
							length: 3 + Math.floor(draw() * 4),
							floor: within(draw, 26, 47),
						}
					: null;
			const idNumber = 10400 + accounts.length * 7 + Math.floor(draw() * 7);
			const name = uniqueName(industry, draw);
			const owner =
				plan.id === 'starter' && channel === 'self' ? null : owners[Math.floor(draw() * owners.length)];
			const signal = Math.floor(draw() * signals.length);
			const seed = Math.floor(draw() * 1e6);

			const account = {
				id: `#${idNumber}`,
				name,
				plan: plan.id,
				size: size.id,
				region: region.id,
				industry: industry.id,
				channel,
				billing: yearly ? 'Annual' : 'Monthly',
				start: startMonth,
				end: null,
				reason: null,
				owner,
				mrr: new Array(MONTHS_HELD).fill(0),
				health: new Array(MONTHS_HELD).fill(null),
				signal,
				seed,
			};

			const leaveRisk = region.churn * sizeRisk * (size.id === 'small' ? 1.12 : size.id === 'large' ? 0.8 : 1);
			for (let month = Math.max(0, startMonth); month < MONTHS_HELD; month += 1) {
				const age = month - startMonth;
				if (age > 0) {
					/* Churn eases a little each month over the three years, and runs
             five times higher in the first months, before a team has moved
             its bookings over. */
					const hazard = plan.churn * leaveRisk * (1.18 - month * 0.011) * (age <= 4 ? 5 : 1);
					const leaves = yearly ? age % 12 === 0 && draw() < 1 - Math.pow(1 - hazard, 12) : draw() < hazard;
					if (leaves) {
						account.end = month;
						account.reason = weightedPick(
							draw,
							reasons.map((reason) => [reason.id, reason.weight]),
						);
						break;
					}
					/* A growing team buys seats or add-ons; once in a while a few
             seats go. */
					const roll = draw();
					if (roll < (plan.id === 'starter' ? 0.038 : 0.058))
						revenue = Math.round((revenue * within(draw, 1.1, 1.38)) / 5) * 5;
					else if (roll > 0.986) revenue = Math.round((revenue * within(draw, 0.74, 0.9)) / 5) * 5;
				}
				account.mrr[month] = revenue;
			}

			for (let month = Math.max(0, startMonth); month < MONTHS_HELD && account.mrr[month]; month += 1) {
				let score = usualHealth + Math.sin((month + (account.seed % 13)) * 0.9) * 4;
				if (account.end !== null && account.end - month <= 5)
					score = Math.min(score, 22 + (account.end - month) * 6 + (account.seed % 9));
				if (slump && month >= slump.first && month < slump.first + slump.length)
					score = Math.min(score, slump.floor + (month - slump.first) * 2);
				account.health[month] = Math.max(6, Math.min(98, Math.round(score)));
			}
			return account;
		}

		function uniqueName(industry, draw) {
			for (let attempt = 0; ; attempt += 1) {
				const stem = NAME_STEMS[Math.floor(draw() * NAME_STEMS.length)];
				const trade = industry.words[Math.floor(draw() * industry.words.length)];
				const candidate = attempt > 40 ? `${stem} ${trade} ${NAME_SUFFIXES[attempt % 8]}` : `${stem} ${trade}`;
				if (!takenNames.has(candidate)) {
					takenNames.add(candidate);
					return candidate;
				}
			}
		}

		/* Bends revenue so the book hits the targets: MRR a year back, gross
       and net retention over that year, and MRR per plan at the end. Every
       step scales one group of accounts, either how far they moved since
       September 2025 or their whole history. */
		function calibrate() {
			const yearBack = FINAL_MONTH - 12;

			/* Step one: land September 2025 on its MRR. */
			const scale = targets.start / totalAt(accounts, yearBack);
			for (const account of accounts) account.mrr = account.mrr.map((value) => Math.round(value * scale));
			const anchorAccount = largestAt(
				accounts.filter((account) => account.mrr[yearBack] && account.mrr[FINAL_MONTH]),
				yearBack,
			);
			const remainder = targets.start - totalAt(accounts, yearBack);
			for (let month = 0; month < MONTHS_HELD; month += 1) {
				if (anchorAccount.mrr[month]) anchorAccount.mrr[month] += remainder;
			}

			const payingThen = accounts.filter((account) => account.mrr[yearBack] > 0);
			const stayed = payingThen.filter((account) => account.mrr[FINAL_MONTH] > 0);
			const recentSignups = accounts.filter((account) => account.start > yearBack);
			const shrank = stayed.filter((account) => account.mrr[FINAL_MONTH] < account.mrr[yearBack]);
			const grew = stayed.filter((account) => account.mrr[FINAL_MONTH] > account.mrr[yearBack]);
			const unchanged = totalAt(
				stayed.filter((account) => account.mrr[FINAL_MONTH] === account.mrr[yearBack]),
				FINAL_MONTH,
			);

			/* Step two: gross retention, by stretching the accounts that shrank. */
			const departed = totalAt(
				payingThen.filter((account) => !account.mrr[FINAL_MONTH]),
				yearBack,
			);
			const shrankGoal = totalAt(shrank, yearBack) - ((targets.start * (100 - targets.grr)) / 100 - departed);
			const shrinkFactor = (shrankGoal - totalAt(shrank, yearBack)) / travel(shrank);
			for (const account of shrank) stretch(account, shrinkFactor);
			largestAt(shrank, FINAL_MONTH).mrr[FINAL_MONTH] += Math.round(shrankGoal) - totalAt(shrank, FINAL_MONTH);

			/* Step three: net retention, by stretching the accounts that grew. */
			const grewGoal = (targets.start * targets.nrr) / 100 - totalAt(shrank, FINAL_MONTH) - unchanged;
			const growFactor = (grewGoal - totalAt(grew, yearBack)) / travel(grew);
			for (const account of grew) stretch(account, growFactor);
			largestAt(grew, FINAL_MONTH).mrr[FINAL_MONTH] += Math.round(grewGoal) - totalAt(grew, FINAL_MONTH);

			/* Step four: MRR per plan, by scaling the year's new accounts. */
			for (const plan of plans) {
				const newcomers = recentSignups.filter((account) => account.plan === plan.id);
				const needed =
					targets.mrr[plan.id] -
					totalAt(
						stayed.filter((account) => account.plan === plan.id),
						FINAL_MONTH,
					);
				const factor = needed / totalAt(newcomers, FINAL_MONTH);
				for (const account of newcomers) {
					account.mrr = account.mrr.map((value) => (value ? Math.max(5, Math.round(value * factor)) : value));
				}
				largestAt(newcomers, FINAL_MONTH).mrr[FINAL_MONTH] += needed - totalAt(newcomers, FINAL_MONTH);
			}

			function totalAt(group, month) {
				return group.reduce((sum, account) => sum + account.mrr[month], 0);
			}

			function travel(group) {
				return totalAt(group, FINAL_MONTH) - totalAt(group, yearBack);
			}

			/* The first account holding the most revenue in `month`. */
			function largestAt(group, month) {
				let largest = group[0];
				for (const account of group) if (account.mrr[month] > largest.mrr[month]) largest = account;
				return largest;
			}

			/* Scales how far an account moved since the year-back month. */
			function stretch(account, factor) {
				const anchor = account.mrr[yearBack];
				for (let month = yearBack + 1; month < MONTHS_HELD; month += 1) {
					if (account.mrr[month])
						account.mrr[month] = Math.max(5, Math.round(anchor + (account.mrr[month] - anchor) * factor));
				}
			}
		}
	}

	start();
})();
