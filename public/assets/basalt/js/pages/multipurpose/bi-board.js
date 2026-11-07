/**
 * Basalt - BI Board (bi-board.html)
 * A board of widgets the viewer arranges: pick a saved board, add widgets
 * from the library, resize them, drag them into a new order, remove them
 * and save. WIDGETS below holds every widget there is and the figures it
 * shows; BOARDS holds the three saved boards as a list of widget ids and
 * sizes. A saved change lives in this browser (localStorage) under
 * "bib-boards"; in your app, save the same shape to your API.
 *
 * Figures match the rest of the demo: September closed at $880k MRR
 * ($158k Basic, $361k Pro, $361k Max), 2,140 paying accounts, 26,802 paid
 * seats and 112% net revenue retention, the same as Reports, Revenue and
 * the plans in assets/basalt/js/data/multipurpose/plans.js.
 */
(() => {
	'use strict';
	const root = pick('[data-bib-root]', document);
	if (!root) return;

	const STORE = 'bib-boards';
	const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
	/* Width in grid columns (of 12) for each size, and its name in the size buttons.
	   A featured widget is half the width and, on a wide screen, two rows high. */
	const SIZES = { s: 3, m: 4, l: 6, hero: 6, xl: 8, full: 12 };
	const SIZE_NAME = { s: 'Small', m: 'Medium', l: 'Half width', hero: 'Featured', xl: 'Wide', full: 'Full width' };
	/* The short form each size takes in a widget's size picker. */
	const SIZE_SHORT = { s: 'S', m: 'M', l: 'Half', hero: 'Featured', xl: 'Wide', full: 'Full' };
	const TALL = new Set(['hero']);

	const WIDGETS = {
		mrr: {
			title: 'Monthly recurring revenue',
			hint: `MRR: what every paying account is billed each month, as of the month's last day.`,
			kind: 'kpi',
			group: 'revenue',
			icon: 'bi-graph-up-arrow',
			about: 'MRR at the end of the month, with its last 12 months.',
			value: '$880k',
			delta: '+34.3% on a year ago',
			up: true,
			series: [655, 668, 690, 702, 726, 745, 770, 790, 812, 838, 856, 880],
			unit: (v) => `$${v}k`,
			sizes: ['s', 'm', 'l', 'hero'],
		},
		netnew: {
			title: 'Net new MRR',
			hint: 'MRR gained from new and growing accounts, minus MRR lost to cancellations and downgrades, each month.',
			kind: 'kpi',
			group: 'revenue',
			icon: 'bi-plus-slash-minus',
			about: 'New and expansion MRR, less churn and contraction.',
			value: '$225k',
			delta: '+35.0% on a year ago',
			up: true,
			series: [13, 22, 12, 24, 19, 25, 21, 22, 26, 18, 24],
			unit: (v) => `$${v}k`,
			sizes: ['s', 'm', 'l', 'hero'],
		},
		accounts: {
			title: 'Paying accounts',
			hint: 'Companies on a paid plan at the end of the month. Trials are not counted.',
			kind: 'kpi',
			group: 'revenue',
			icon: 'bi-building',
			about: 'Accounts on a paid plan at the end of the month.',
			value: '2,140',
			delta: '+20.8% on a year ago',
			up: true,
			series: [1771, 1798, 1826, 1858, 1884, 1915, 1952, 1990, 2031, 2068, 2104, 2140],
			unit: (v) => v.toLocaleString('en-US'),
			sizes: ['s', 'm', 'l', 'hero'],
		},
		nrr: {
			title: 'Net revenue retention',
			hint: 'What accounts paying a year ago pay now, upgrades and downgrades included. Over 100% means they grew.',
			kind: 'kpi',
			group: 'revenue',
			icon: 'bi-arrow-repeat',
			about: 'What last year’s customers pay now, against then.',
			value: '112.0%',
			delta: '+0.1 pts on a year ago',
			up: true,
			series: [111.9, 112.4, 111.6, 111.2, 111.8, 112.6, 112.2, 111.5, 111.9, 112.3, 111.7, 112],
			unit: (v) => `${v}%`,
			sizes: ['s', 'm', 'l', 'hero'],
		},
		seats: {
			title: 'Paid seats',
			hint: 'Team members paid for across all accounts at the end of the month.',
			kind: 'kpi',
			group: 'revenue',
			icon: 'bi-people',
			about: 'Seats on the paid plans at the end of the month.',
			value: '26,802',
			delta: '+21.8% on a year ago',
			up: true,
			series: [21999, 22386, 22773, 23160, 23548, 23967, 24339, 24813, 25239, 25713, 26241, 26802],
			unit: (v) => v.toLocaleString('en-US'),
			sizes: ['s', 'm', 'l'],
		},
		trend: {
			title: 'MRR by month',
			kind: 'line',
			group: 'revenue',
			icon: 'bi-activity',
			about: 'The last 12 months, each point the month-end MRR.',
			series: [655, 668, 690, 702, 726, 745, 770, 790, 812, 838, 856, 880],
			labels: MONTHS,
			unit: (v) => `$${v}k`,
			sizes: ['l', 'xl', 'full'],
		},
		plans: {
			title: 'MRR by plan',
			kind: 'ring',
			group: 'revenue',
			icon: 'bi-pie-chart',
			about: 'Where September’s $880k comes from.',
			parts: [
				['Basic', 158],
				['Pro', 361],
				['Max', 361],
			],
			unit: (v) => `$${v}k`,
			sizes: ['m', 'l'],
		},
		signups: {
			title: 'Sign-ups by week',
			kind: 'bars',
			group: 'growth',
			icon: 'bi-person-plus',
			about: 'New accounts each week, the last eight weeks.',
			series: [262, 248, 291, 305, 279, 318, 296, 334],
			labels: ['Aug 17', 'Aug 24', 'Aug 31', 'Sep 7', 'Sep 14', 'Sep 21', 'Sep 28', 'Oct 5'],
			unit: (v) => `${v}`,
			sizes: ['m', 'l', 'xl'],
		},
		funnel: {
			title: 'Visit to paid, September',
			hint: 'Of the people who visited the website in September, how many signed up, started a trial and paid.',
			kind: 'funnel',
			group: 'growth',
			icon: 'bi-funnel',
			about: 'How many website visitors made it to a paid plan.',
			steps: [
				['Visited the site', 18400],
				['Made an account', 1210],
				['Started a trial', 640],
				['Paid', 212],
			],
			sizes: ['l', 'xl', 'full'],
		},
		regions: {
			title: 'New MRR by region',
			kind: 'hbars',
			group: 'growth',
			icon: 'bi-map',
			about: 'New MRR this quarter, by where the account is.',
			parts: [
				['Northeast', 41.2],
				['Midwest', 23.8],
				['West', 12.6],
				['South', 4.9],
			],
			unit: (v) => `$${v}k`,
			sizes: ['m', 'l'],
		},
		goal: {
			title: 'Q4 new MRR goal',
			hint: 'New MRR booked from October 1 against the goal for the quarter.',
			kind: 'goal',
			group: 'growth',
			icon: 'bi-bullseye',
			about: 'New MRR booked this quarter against its goal.',
			done: 82.5,
			target: 240,
			unit: (v) => `$${v}k`,
			sizes: ['s', 'm', 'l'],
		},
		tickets: {
			title: 'Open tickets',
			kind: 'kpi',
			group: 'support',
			icon: 'bi-life-preserver',
			about: 'Support tickets waiting on the team right now.',
			value: '38',
			delta: '−6 on last week',
			up: true,
			series: [52, 47, 49, 44, 46, 41, 44, 38],
			unit: (v) => `${v}`,
			sizes: ['s', 'm', 'l'],
		},
		reply: {
			title: 'First reply time',
			hint: 'Half of the customers got their first answer faster than this, week by week.',
			kind: 'kpi',
			group: 'support',
			icon: 'bi-reply',
			about: 'Median time to the first answer, by week.',
			value: '1 h 12 min',
			delta: '18 min faster',
			up: true,
			series: [104, 96, 99, 88, 91, 83, 78, 72],
			unit: (v) => `${Math.floor(v / 60)} h ${v % 60} min`,
			sizes: ['s', 'm', 'l'],
		},
		accountsTop: {
			title: 'Largest accounts',
			kind: 'table',
			group: 'revenue',
			icon: 'bi-trophy',
			about: 'The five accounts paying the most each month.',
			rows: [
				['Avocet Care Group', 'Max', 9.4],
				['Lumora AI', 'Max', 8.6],
				['Highpoint Outfitters', 'Pro', 6.1],
				['Polaris Running Co.', 'Max', 5.8],
				['Moorings Line Studios', 'Pro', 4.2],
			],
			sizes: ['l', 'xl', 'full'],
		},
	};

	const BOARDS = [
		{
			id: 'weekly',
			name: 'Weekly review',
			/* A four-across mosaic: MRR featured over two rows, seven small
			   widgets around and under it. */
			widgets: [
				['mrr', 'hero'],
				['accounts', 's'],
				['nrr', 's'],
				['netnew', 's'],
				['seats', 's'],
				['goal', 's'],
				['tickets', 's'],
				['reply', 's'],
			],
		},
		{
			id: 'growth',
			name: 'Growth',
			widgets: [
				['goal', 'm'],
				['signups', 'xl'],
				['funnel', 'xl'],
				['regions', 'm'],
			],
		},
		{
			id: 'support',
			name: 'Support',
			widgets: [
				['tickets', 'm'],
				['reply', 'm'],
				['accounts', 'm'],
				['accountsTop', 'full'],
			],
		},
	];

	const state = {
		board: 'weekly',
		editing: false,
		layouts: loadLayouts(),
		dragging: null,
	};

	function start() {
		drawTabs();
		/* The board opens in edit mode, so the first thing anyone sees is
		   what it is for: arranging their own dashboard. Done editing
		   leaves it as a plain board. */
		setEditing(true, false);
		drawBoard();
		wireEditing();
		wireLibrary();
	}

	/* Helpers */
	function pick(selector, scope = root) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = root) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function loadLayouts() {
		try {
			return JSON.parse(localStorage.getItem(STORE) || '{}');
		} catch {
			return {};
		}
	}

	function saveLayouts() {
		try {
			localStorage.setItem(STORE, JSON.stringify(state.layouts));
			return true;
		} catch {
			return false;
		}
	}

	function boardOf(id) {
		return BOARDS.find((b) => b.id === id);
	}

	/** The widgets on a board: the saved layout if there is one, else its default. */
	function widgetsOf(id) {
		const saved = state.layouts[id];
		const list = saved || boardOf(id).widgets;
		return list.filter(([key]) => WIDGETS[key]).map(([key, size]) => ({ key, size }));
	}

	let current = [];

	/* Saved boards as tabs. */
	function drawTabs() {
		const tabs = pick('[data-bib-tabs]');
		tabs.innerHTML = BOARDS.map(
			(b) =>
				`<button type="button" role="tab" class="bib-tab" data-bib-board="${b.id}" aria-selected="${b.id === state.board}">${htmlSafe(b.name)}<span class="bib-tab-count">${widgetsOf(b.id).length}</span></button>`,
		).join('');
		tabs.onclick = (event) => {
			const tab = event.target.closest('[data-bib-board]');
			if (!tab || tab.dataset.bibBoard === state.board) return;
			state.board = tab.dataset.bibBoard;
			drawTabs();
			drawBoard();
			drawLibrary();
		};
	}

	/* The board */
	function drawBoard(fresh = true) {
		if (fresh) current = widgetsOf(state.board);
		const grid = pick('[data-bib-grid]');
		grid.classList.toggle('is-editing', state.editing);
		if (!current.length) {
			grid.innerHTML = `<div class="bib-empty"><div class="basalt-empty basalt-empty-compact"><h2 class="basalt-empty-title">This board is empty</h2><p class="basalt-empty-text">Add widgets from the library to build it up.</p><div class="basalt-empty-actions"><button type="button" class="btn btn-primary btn-sm" data-bs-toggle="offcanvas" data-bs-target="#bib-library"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add widget</button></div></div></div>`;
			return;
		}
		/* While editing, an Add a widget tile closes the last row. */
		const spans = current.map((w) => SIZES[w.size]);
		/* While editing, widgets keep the width chosen for them, so a size
		   change always shows; only the Add a widget tile stretches to close
		   its row. Once editing ends, every row is stretched to its edge. */
		const grow = state.editing ? new Set([spans.length]) : null;
		const wide = fitRows(
			state.editing ? [...spans, 3] : spans,
			current.map((w) => TALL.has(w.size)),
			grow,
		);
		const tablet = fitRows(
			(state.editing ? [...spans, 3] : spans).map((span) => (span === 3 ? 6 : 12)),
			[],
			grow,
		);
		grid.classList.toggle('is-mosaic', wide.tall.includes(true));
		const add = state.editing
			? `<button type="button" class="bib-add-tile bib-span-3 bib-fit-${wide.spans.at(-1)} bib-fit-md-${tablet.spans.at(-1)}${fresh ? ` bib-rise bib-rise-${Math.min(current.length, 9)}` : ''}" data-bs-toggle="offcanvas" data-bs-target="#bib-library" aria-controls="bib-library"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add a widget</button>`
			: '';
		/* The widgets are redrawn, so their tooltips go first; they have no fade,
		   so nothing is left mid-animation on an element that no longer exists. */
		for (const el of pickAll('[data-bs-toggle="tooltip"]', grid)) {
			const tip = window.bootstrap?.Tooltip.getInstance(el);
			tip?.hide();
			tip?.dispose();
		}
		grid.innerHTML =
			current
				.map((w, i) =>
					widgetHtml(w, i, { wide: wide.spans[i], tall: wide.tall[i], tablet: tablet.spans[i], fresh }),
				)
				.join('') + add;
		for (const el of pickAll('[data-bib-chart]', grid)) wireReadout(el);
		if (state.editing) window.Basalt.tips?.(grid);
		if (fresh) window.Basalt.countUp?.(pickAll('.bib-kpi-value, .bib-funnel-n', grid));
	}

	/**
	 * Lays widths (in columns of 12) into rows in board order, the way the
	 * grid places them, and stretches each run of free columns so it reaches
	 * its edge whatever sizes were chosen. A tall widget keeps its columns in
	 * the row under it as well; when nothing is left to sit beside it there,
	 * it stays one row high, so the board never ends on a hole.
	 * @param {number[]} spans   each widget's width in columns
	 * @param {boolean[]} tall   whether each widget asks for two rows
	 * @param {Set<number>|null} grow   when given, only these widgets take a row's spare columns
	 * @returns {{spans: number[], tall: boolean[]}}
	 */
	function fitRows(spans, tall = [], grow = null) {
		const rows = spans.map((_, i) => Boolean(tall[i]));
		for (;;) {
			const laid = layRows(spans, rows, grow);
			if (laid.hole === null) return { spans: laid.fitted, tall: rows };
			rows[laid.hole] = false;
		}
	}

	/** One pass of fitRows: the widths, or the tall widget that would leave a hole under it. */
	function layRows(spans, tall, grow) {
		const fitted = [...spans];
		let held = [];
		let i = 0;
		while (i < spans.length) {
			const above = held;
			held = [];
			for (const [start, width] of freeRuns(above)) {
				const run = [];
				let used = 0;
				while (i < spans.length && (!run.length || used + spans[i] <= width)) {
					run.push(i);
					used += spans[i];
					i += 1;
				}
				if (!run.length) return { fitted, hole: above.at(-1).i };
				stretch(run, width, spans, fitted, grow);
				let at = start;
				for (const k of run) {
					if (tall[k]) held.push({ i: k, from: at, to: at + fitted[k] });
					at += fitted[k];
				}
			}
		}
		const left = freeRuns(held);
		const covered = left.length === 0;
		return { fitted, hole: held.length && !covered ? held.at(-1).i : null };
	}

	/** The runs of columns, as [first column, width], that the widgets above leave free. */
	function freeRuns(held) {
		const runs = [];
		let at = 0;
		for (const { from, to } of [...held].sort((a, b) => a.from - b.from)) {
			if (from > at) runs.push([at, from - at]);
			at = to;
		}
		if (at < 12) runs.push([at, 12 - at]);
		return runs;
	}

	/** Shares a run's columns among its widgets by size, so together they fill it exactly. */
	function stretch(run, width, spans, fitted, grow) {
		const used = run.reduce((sum, i) => sum + spans[i], 0);
		if (grow) {
			/* Only the widgets in grow take the spare columns; the rest keep their width. */
			for (const i of run) fitted[i] = spans[i];
			const growing = run.filter((i) => grow.has(i));
			if (growing.length) fitted[growing.at(-1)] += width - used;
			return;
		}
		const shares = run.map((i) => ({ i, exact: (spans[i] * width) / used }));
		for (const share of shares) fitted[share.i] = Math.floor(share.exact);
		let left = width - shares.reduce((sum, share) => sum + fitted[share.i], 0);
		for (const share of [...shares].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
			if (left-- <= 0) break;
			fitted[share.i] += 1;
		}
	}

	/** A tool button; one that cannot act is aria-disabled, keeps its tooltip and says why. */
	function toolButton(attr, icon, label, blocked, cls = '') {
		const tip = blocked || label;
		return `<button type="button" class="btn btn-icon btn-sm${cls}" ${attr} aria-label="${htmlSafe(label)}"${blocked ? ` aria-disabled="true"` : ''} data-bs-toggle="tooltip" data-bs-trigger="hover focus" data-bs-placement="top" data-bs-animation="false" data-bs-title="${htmlSafe(tip)}"><i class="bi ${icon}" aria-hidden="true"></i></button>`;
	}

	/** The edit tools of one widget: grip, move, size picker, narrower and wider, remove. */
	function toolsHtml(def, w, i) {
		const at = def.sizes.indexOf(w.size);
		const first = i === 0;
		const last = i === current.length - 1;
		const name = htmlSafe(def.title);
		const picker = `<div class="bib-sizes-row"><div class="bib-sizes" role="radiogroup" aria-label="Size of ${name}">${def.sizes
			.map(
				(size) =>
					`<button type="button" role="radio" class="bib-size" data-bib-pick="${size}" aria-checked="${size === w.size}" tabindex="${size === w.size ? 0 : -1}" aria-label="${SIZE_NAME[size]}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="top" data-bs-animation="false" data-bs-title="${SIZE_NAME[size]}">${SIZE_SHORT[size]}</button>`,
			)
			.join('')}</div></div>`;
		return `<div class="bib-tools"><span class="bib-handle" role="img" aria-label="Drag to move" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="top" data-bs-animation="false" data-bs-title="Drag to move"><i class="bi bi-grip-vertical" aria-hidden="true"></i></span>${picker}<span class="bib-tools-buttons">${toolButton('data-bib-move="-1"', 'bi-arrow-left', 'Move left', first ? 'Already first' : '')}${toolButton('data-bib-move="1"', 'bi-arrow-right', 'Move right', last ? 'Already last' : '')}${toolButton('data-bib-size="-1"', 'bi-arrows-collapse-vertical', 'Make narrower', at <= 0 ? 'Already the smallest size for this widget' : '')}${toolButton('data-bib-size="1"', 'bi-arrows-expand-vertical', 'Make wider', at >= def.sizes.length - 1 ? (w.size === 'full' ? 'Already full width' : 'Already the largest size for this widget') : '')}${toolButton('data-bib-remove', 'bi-x-lg', 'Remove widget', '', ' bib-remove')}</span></div>`;
	}

	function widgetHtml(w, i, fit) {
		const def = WIDGETS[w.key];
		const tools = state.editing ? toolsHtml(def, w, i) : '';
		const look = `${w.size === 'hero' ? ' bib-hero' : ''}${fit.tall ? ' is-tall' : ''}${fit.fresh ? ` bib-rise bib-rise-${Math.min(i, 9)}` : ''}`;
		return `<article class="card basalt-box bib-widget bib-span-${SIZES[w.size]} bib-fit-${fit.wide} bib-fit-md-${fit.tablet}${look}" data-bib-index="${i}"${state.editing ? ' draggable="true"' : ''}><header class="bib-widget-head"><h2 class="bib-widget-title"${def.hint ? ` data-basalt-hint="${htmlSafe(def.hint)}"` : ''}><i class="bi ${def.icon}" aria-hidden="true"></i>${htmlSafe(def.title)}</h2></header>${tools}<div class="bib-widget-body">${bodyHtml(def, w.size)}</div></article>`;
	}

	/* Widget bodies, one per kind. Every chart is drawn to scale from its data. */
	function bodyHtml(def, size) {
		if (def.kind === 'kpi') return kpiHtml(def, size);
		if (def.kind === 'line') return lineHtml(def);
		if (def.kind === 'bars') return barsHtml(def);
		if (def.kind === 'ring') return ringHtml(def);
		if (def.kind === 'funnel') return funnelHtml(def);
		if (def.kind === 'hbars') return hbarsHtml(def);
		if (def.kind === 'goal') return goalHtml(def);
		if (def.kind === 'table') return tableHtml(def);
		return '';
	}

	function points(values, w, h, pad = 4) {
		const lo = Math.min(...values);
		const hi = Math.max(...values);
		return values.map((v, i) => [
			pad + (i / (values.length - 1)) * (w - pad * 2),
			h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2),
		]);
	}

	function kpiHtml(def, size) {
		const pts = points(def.series, 200, 48);
		const line = pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
		const area = `4,48 ${line} 196,48`;
		/* Every size shows the last months as a sparkline. */
		const spark = `<svg class="bib-spark basalt-card-foot" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true"><polygon points="${area}"></polygon><polyline points="${line}"></polyline></svg>`;
		return `<p class="bib-kpi-value">${def.value}</p><p class="bib-kpi-delta${def.up ? ' is-up' : ' is-down'}"><i class="bi ${def.up ? 'bi-arrow-up-right' : 'bi-arrow-down-right'}" aria-hidden="true"></i>${htmlSafe(def.delta)}</p>${spark}`;
	}

	function lineHtml(def) {
		const W = 600;
		const H = 180;
		const pts = points(def.series, W, H, 10);
		const line = pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
		const dots = pts
			.map(
				([x, y], i) =>
					`<g class="bib-hit" data-bib-label="${def.labels[i]}" data-bib-value="${def.unit(def.series[i])}"><rect x="${(x - W / def.series.length / 2).toFixed(1)}" y="0" width="${(W / def.series.length).toFixed(1)}" height="${H}"></rect><path class="bib-dot-ring" d="M${x.toFixed(1)} ${y.toFixed(1)}h0"></path><path class="bib-dot-core" d="M${x.toFixed(1)} ${y.toFixed(1)}h0"></path></g>`,
			)
			.join('');
		return `<div class="bib-chart" data-bib-chart><svg class="bib-line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${htmlSafe(def.title)}, ${def.labels[0]} ${def.unit(def.series[0])} to ${def.labels.at(-1)} ${def.unit(def.series.at(-1))}"><polygon points="10,${H} ${line} ${W - 10},${H}"></polygon><polyline points="${line}"></polyline>${dots}</svg><div class="bib-axis"><span>${def.labels[0]}</span><span>${def.labels[Math.floor(def.labels.length / 2)]}</span><span>${def.labels.at(-1)}</span></div><p class="bib-read" data-bib-read data-bib-rest="Latest: ${def.labels.at(-1)}, ${def.unit(def.series.at(-1))}">Latest: ${def.labels.at(-1)}, ${def.unit(def.series.at(-1))}</p></div>`;
	}

	function barsHtml(def) {
		const top = Math.max(...def.series);
		const bars = def.series
			.map(
				(v, i) =>
					`<span class="bib-bar value-${Math.round((v / top) * 100)}${i === def.series.length - 1 ? ' is-last' : ''} bib-hit" data-bib-label="Week of ${def.labels[i]}" data-bib-value="${def.unit(v)}"></span>`,
			)
			.join('');
		return `<div class="bib-chart" data-bib-chart><div class="bib-bars" role="img" aria-label="${htmlSafe(def.title)}: ${def.series.join(', ')}">${bars}</div><div class="bib-axis"><span>${def.labels[0]}</span><span>${def.labels.at(-1)}</span></div><p class="bib-read" data-bib-read data-bib-rest="Last week: ${def.unit(def.series.at(-1))}">Last week: ${def.unit(def.series.at(-1))}</p></div>`;
	}

	function ringHtml(def) {
		const total = def.parts.reduce((s, p) => s + p[1], 0);
		const r = 52;
		const c = 2 * Math.PI * r;
		let at = 0;
		const segs = def.parts
			.map(([, v], i) => {
				const len = (v / total) * c;
				const seg = `<circle class="bib-ring-seg tone-series-${[1, 7, 4][i]}" cx="70" cy="70" r="${r}" stroke-dasharray="${Math.max(0, len - 3).toFixed(1)} ${c.toFixed(1)}" stroke-dashoffset="${(-at).toFixed(1)}"></circle>`;
				at += len;
				return seg;
			})
			.join('');
		const list = def.parts
			.map(
				([name, v], i) =>
					`<li><span class="bib-key tone-series-${[1, 7, 4][i]}" aria-hidden="true"></span>${name}<b>${def.unit(v)}</b><span class="bib-share">${Math.round((v / total) * 100)}%</span></li>`,
			)
			.join('');
		return `<div class="bib-ring-wrap"><svg class="bib-ring" viewBox="0 0 140 140" aria-hidden="true"><circle class="bib-ring-track" cx="70" cy="70" r="${r}"></circle>${segs}</svg><ul class="bib-legend">${list}</ul></div>`;
	}

	function funnelHtml(def) {
		const first = def.steps[0][1];
		return `<ol class="bib-funnel">${def.steps
			.map(([name, v], i) => {
				const share = (v / first) * 100;
				const from = i
					? `${((v / def.steps[i - 1][1]) * 100).toFixed(1)}% of the step before`
					: 'Everyone who came';
				return `<li><span class="bib-funnel-name">${name}</span><span class="bib-funnel-n">${v.toLocaleString('en-US')}</span><span class="bib-funnel-track"><span class="bib-funnel-fill w-${Math.max(2, Math.round(share))}"></span></span><span class="bib-funnel-sub">${from}</span></li>`;
			})
			.join('')}</ol>`;
	}

	function hbarsHtml(def) {
		const top = Math.max(...def.parts.map((p) => p[1]));
		return `<ul class="bib-hbars">${def.parts
			.map(
				([name, v]) =>
					`<li><span>${name}</span><b>${def.unit(v)}</b><span class="bib-hbar-track"><span class="bib-hbar-fill w-${Math.round((v / top) * 100)}"></span></span></li>`,
			)
			.join('')}</ul>`;
	}

	function goalHtml(def) {
		const share = def.done / def.target;
		return `<p class="bib-kpi-value">${def.unit(def.done)}</p><p class="bib-goal-of">of ${def.unit(def.target)}, ${Math.round(share * 100)}% with 12 weeks to go</p><span class="bib-goal-track" aria-hidden="true"><span class="bib-goal-fill w-${Math.round(share * 100)}"></span><span class="bib-goal-pace"></span></span><p class="bib-goal-pace-note">The mark is where the quarter should be by now.</p>`;
	}

	function tableHtml(def) {
		return `<table class="table bib-table"><thead><tr><th scope="col">Account</th><th scope="col">Plan</th><th scope="col" class="text-end">MRR</th></tr></thead><tbody>${def.rows
			.map(
				([name, plan, mrr]) =>
					`<tr><td><a href="company-details.html">${htmlSafe(name)}</a></td><td><span class="basalt-status basalt-status-primary">${plan}</span></td><td class="text-end bib-num">$${mrr.toFixed(1)}k</td></tr>`,
			)
			.join('')}</tbody></table>`;
	}

	/* Pointing at a point or bar reads its value under the chart. */
	function wireReadout(chart) {
		const read = pick('[data-bib-read]', chart);
		for (const hit of pickAll('.bib-hit', chart)) {
			hit.addEventListener('pointerenter', () => {
				hit.classList.add('is-lit');
				read.textContent = `${hit.dataset.bibLabel}: ${hit.dataset.bibValue}`;
			});
			hit.addEventListener('pointerleave', () => {
				hit.classList.remove('is-lit');
				read.textContent = read.dataset.bibRest;
			});
		}
	}

	/* Editing: move, resize and remove, by button or by dragging. */
	function wireEditing() {
		const button = pick('[data-bib-edit]');
		button.addEventListener('click', () => setEditing(!state.editing));
		pick('[data-bib-save]').addEventListener('click', () => {
			state.layouts[state.board] = current.map((w) => [w.key, w.size]);
			const kept = saveLayouts();
			setEditing(false);
			drawTabs();
			toast({
				tone: 'success',
				title: kept ? `${boardOf(state.board).name} saved` : 'Saved for this visit',
			});
		});
		pick('[data-bib-reset]').addEventListener('click', () => {
			delete state.layouts[state.board];
			saveLayouts();
			drawBoard();
			drawTabs();
			toast({ tone: 'info', title: `${boardOf(state.board).name} is back to its first layout` });
		});

		const grid = pick('[data-bib-grid]');
		grid.addEventListener('click', (event) => {
			const widget = event.target.closest('[data-bib-index]');
			if (!widget) return;
			const i = Number(widget.dataset.bibIndex);
			const button = event.target.closest('button');
			if (button?.getAttribute('aria-disabled') === 'true') return;
			const move = event.target.closest('[data-bib-move]');
			const size = event.target.closest('[data-bib-size]');
			const chosen = event.target.closest('[data-bib-pick]');
			if (chosen) {
				current[i].size = chosen.dataset.bibPick;
				drawBoard(false);
				pick(`[data-bib-index="${i}"] [data-bib-pick="${chosen.dataset.bibPick}"]`, grid)?.focus();
				return;
			}
			if (move) {
				const to = i + Number(move.dataset.bibMove);
				[current[i], current[to]] = [current[to], current[i]];
				drawBoard(false);
				pick(`[data-bib-index="${to}"] [data-bib-move="${move.dataset.bibMove}"]`, grid)?.focus();
			}
			if (size) {
				const def = WIDGETS[current[i].key];
				const next = def.sizes[def.sizes.indexOf(current[i].size) + Number(size.dataset.bibSize)];
				if (next) current[i].size = next;
				drawBoard(false);
				pick(`[data-bib-index="${i}"] [data-bib-size="${size.dataset.bibSize}"]`, grid)?.focus();
			}
			if (event.target.closest('[data-bib-remove]')) removeAt(i);
		});

		/* Arrow keys move along a widget's size picker and choose, as in any radio group. */
		grid.addEventListener('keydown', (event) => {
			const chosen = event.target.closest('[data-bib-pick]');
			if (!chosen) return;
			const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
			if (!step) return;
			event.preventDefault();
			const options = pickAll('[data-bib-pick]', chosen.parentElement);
			const next = options[options.indexOf(chosen) + step];
			if (next) next.click();
		});

		grid.addEventListener('dragstart', (event) => {
			const widget = event.target.closest('[data-bib-index]');
			if (!widget) return;
			state.dragging = Number(widget.dataset.bibIndex);
			widget.classList.add('is-dragging');
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', widget.dataset.bibIndex);
		});
		grid.addEventListener('dragover', (event) => {
			if (state.dragging === null) return;
			event.preventDefault();
			const over = event.target.closest('[data-bib-index]');
			for (const w of pickAll('.is-drop', grid)) w.classList.remove('is-drop');
			if (over && Number(over.dataset.bibIndex) !== state.dragging) over.classList.add('is-drop');
		});
		grid.addEventListener('drop', (event) => {
			event.preventDefault();
			const over = event.target.closest('[data-bib-index]');
			if (over && state.dragging !== null) {
				const to = Number(over.dataset.bibIndex);
				const [moved] = current.splice(state.dragging, 1);
				current.splice(to, 0, moved);
			}
			state.dragging = null;
			drawBoard(false);
		});
		grid.addEventListener('dragend', () => {
			state.dragging = null;
			for (const w of pickAll('.is-dragging, .is-drop', grid)) w.classList.remove('is-dragging', 'is-drop');
		});

		wireTouchDrag(grid);
	}

	/**
	 * Touch screens fire no drag events, so on touch the grip handle drags by
	 * pointer: the card under the finger takes the drop outline, the page
	 * scrolls near the top and bottom edges, and letting go moves the widget.
	 */
	function wireTouchDrag(grid) {
		let touching = false;
		let lastY = 0;
		let scrolling = 0;
		const overAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-bib-index]');
		const mark = (x, y) => {
			const over = overAt(x, y);
			for (const w of pickAll('.is-drop', grid)) w.classList.remove('is-drop');
			if (over && grid.contains(over) && Number(over.dataset.bibIndex) !== state.dragging)
				over.classList.add('is-drop');
		};
		const edgeScroll = () => {
			const edge = 80;
			if (lastY < edge) window.scrollBy(0, -12);
			else if (lastY > window.innerHeight - edge) window.scrollBy(0, 12);
			scrolling = requestAnimationFrame(edgeScroll);
		};
		const finish = () => {
			touching = false;
			cancelAnimationFrame(scrolling);
			state.dragging = null;
			for (const w of pickAll('.is-dragging, .is-drop', grid)) w.classList.remove('is-dragging', 'is-drop');
		};

		grid.addEventListener('pointerdown', (event) => {
			const handle = event.target.closest('.bib-handle');
			if (!handle || event.pointerType === 'mouse') return;
			event.preventDefault();
			const widget = handle.closest('[data-bib-index]');
			handle.setPointerCapture(event.pointerId);
			touching = true;
			state.dragging = Number(widget.dataset.bibIndex);
			widget.classList.add('is-dragging');
			lastY = event.clientY;
			scrolling = requestAnimationFrame(edgeScroll);
		});
		grid.addEventListener('pointermove', (event) => {
			if (!touching) return;
			lastY = event.clientY;
			mark(event.clientX, event.clientY);
		});
		grid.addEventListener('pointerup', (event) => {
			if (!touching) return;
			const over = overAt(event.clientX, event.clientY);
			const from = state.dragging;
			finish();
			if (!over || !grid.contains(over)) return;
			const to = Number(over.dataset.bibIndex);
			if (to === from) return;
			const [moved] = current.splice(from, 1);
			current.splice(to, 0, moved);
			drawBoard(false);
		});
		grid.addEventListener('pointercancel', () => {
			if (touching) finish();
		});
	}

	function setEditing(on, redraw = true) {
		state.editing = on;
		const button = pick('[data-bib-edit]');
		button.setAttribute('aria-pressed', String(on));
		pick('span', button).textContent = on ? 'Done editing' : 'Edit board';
		pick('[data-bib-editbar]').hidden = !on;
		if (redraw) drawBoard(false);
	}

	function removeAt(i) {
		const [gone] = current.splice(i, 1);
		const board = state.board;
		drawBoard(false);
		drawLibrary();
		toast({
			tone: 'info',
			title: `Removed ${WIDGETS[gone.key].title}`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						/* After a switch to another board there is nothing to put back here. */
						if (state.board !== board) return;
						current.splice(i, 0, gone);
						drawBoard(false);
						drawLibrary();
					},
				},
			],
		});
	}

	/* The library */
	function wireLibrary() {
		const search = pick('[data-bib-lib-search]', document);
		const show = pick('[data-bib-lib-show]', document);
		const list = pick('[data-bib-lib]', document);
		search.addEventListener('input', drawLibrary);
		show.addEventListener('change', drawLibrary);
		list.addEventListener('click', (event) => {
			const add = event.target.closest('[data-bib-add]');
			if (add) {
				const key = add.dataset.bibAdd;
				const def = WIDGETS[key];
				current.push({ key, size: def.sizes[Math.min(1, def.sizes.length - 1)] });
				drawBoard(false);
				drawLibrary();
				toast({ tone: 'success', title: `Added ${def.title}`, text: 'Save the board to keep it.' });
				if (!state.editing) setEditing(true);
			}
			if (event.target.closest('[data-bib-lib-reset]')) {
				search.value = '';
				show.value = 'all';
				drawLibrary();
			}
		});
		drawLibrary();
	}

	function drawLibrary() {
		const q = pick('[data-bib-lib-search]', document).value.trim().toLowerCase();
		const group = pick('[data-bib-lib-show]', document).value;
		const all = Object.entries(WIDGETS);
		const rows = all
			.filter(([, w]) => group === 'all' || w.group === group)
			.filter(([, w]) => !q || `${w.title} ${w.about}`.toLowerCase().includes(q));
		pick('[data-bib-lib-count]', document).textContent = `${rows.length} of ${all.length} widgets`;
		const list = pick('[data-bib-lib]', document);
		if (!rows.length) {
			list.innerHTML = `<li class="bib-library-empty"><div class="basalt-empty basalt-empty-compact"><h3 class="basalt-empty-title">No widgets match</h3><p class="basalt-empty-text">Try another word or category.</p><div class="basalt-empty-actions"><button data-bib-lib-reset type="button" class="btn btn-outline-secondary btn-sm">Show all widgets</button></div></div></li>`;
			return;
		}
		const onBoard = new Set(current.map((w) => w.key));
		list.innerHTML = rows
			.map(
				([key, w]) =>
					`<li class="bib-library-item"><span class="bib-library-icon" aria-hidden="true"><i class="bi ${w.icon}"></i></span><span class="bib-library-text"><b>${htmlSafe(w.title)}</b><span>${htmlSafe(w.about)}</span></span>${onBoard.has(key) ? '<span class="basalt-status">On board</span>' : `<button type="button" class="btn btn-outline-secondary btn-sm" data-bib-add="${key}">Add</button>`}</li>`,
			)
			.join('');
	}

	start();
})();
