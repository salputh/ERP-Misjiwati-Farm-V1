/**
 * Tax Reports (tax-reports.html). Fieldline charges state and local sales
 * tax on its invoices; this page shows one quarter of it at a time:
 * four headline figures, a stacked bar of the last five quarters by
 * region, the returns coming due, a table with a row per place and a
 * side panel holding a place's returns for the quarter.
 *
 * The places and their returns come from assets/basalt/js/data/multipurpose/tax-returns.js,
 * the invoices behind them from assets/basalt/js/data/multipurpose/billing.js. Marking a
 * return filed or paid only changes the copy this page holds; the
 * comments mark where a real app would talk to its tax software.
 *
 * The chart is stock Chart.js 4 fed with --basalt-* token colors and is
 * rebuilt whenever basalt:appearance fires.
 */
(() => {
	'use strict';

	const page = pick('[data-txr-root]');
	const ledger = window.Basalt.data?.taxReturns;
	if (!page || !ledger) return;
	const invoiceBook = window.Basalt.data.billing ?? null;

	const SIGNER = 'John Armstrong';
	const NOW_DAY = ledger.today;
	const NOW_YEAR = NOW_DAY.slice(0, 4);
	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const MONTH_FULL = [
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
	const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const PERIODS = ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4'];
	const CADENCE_WORDS = { month: 'Every month', quarter: 'Every quarter', year: 'Once a year' };
	const BADGES = {
		open: { text: 'To file', tone: 'warning' },
		late: { text: 'Late', tone: 'danger' },
		filed: { text: 'Filed', tone: 'info' },
		paid: { text: 'Paid', tone: 'success' },
		later: { text: 'Not due yet', tone: '' },
	};
	/* Rows sort by how badly they need attention, then by due day. */
	const URGENCY = { late: 0, open: 1, filed: 2, later: 3, paid: 4 };
	/* Four ramp slots kept apart, so the regions read as four distinct colors. */
	const RAMP_SLOTS = [1, 3, 5, 2];
	const PENDING_LIMIT = 6;
	const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
	const TYPEFACE = getComputedStyle(document.body).fontFamily || 'sans-serif';

	/* One copy of the data for this visit; filing and paying edit it in place. */
	const REGISTRY = ledger.places();
	const REGIONS = ledger.areas;

	const view = { period: '2026-Q3', chip: 'all', openedPlace: null };
	let panelPeriod = view.period;
	let bars = null;

	const ui = {
		period: pick('[data-txr-period]', page),
		exportButton: pick('[data-txr-export]', page),
		legend: pick('[data-txr-legend]', page),
		canvas: pick('[data-txr-chart]', page),
		pending: pick('[data-txr-due]', page),
		pendingNote: pick('[data-txr-due-desc]', page),
		listTitle: pick('[data-txr-list-title]', page),
		summary: pick('[data-txr-summary]', page),
		chips: pick('[data-txr-chips]', page),
		rows: pick('[data-txr-rows]', page),
		foot: pick('[data-txr-foot]', page),
		table: pick('.txr-table', page),
		empty: pick('[data-txr-empty]', page),
		live: pick('[data-txr-live]', page),
		figure(key) {
			return pick(`[data-txr-fig="${key}"]`, page);
		},
	};
	const sidePanel = document.getElementById('tax-return');
	const panelUi = {
		title: pick('[data-txr-d="title"]', sidePanel),
		subtitle: pick('[data-txr-d="sub"]', sidePanel),
		body: pick('[data-txr-d="body"]', sidePanel),
		actions: pick('[data-txr-d="foot"]', sidePanel),
	};

	function start() {
		ui.period.addEventListener('change', onPeriodChange);
		ui.chips.addEventListener('click', onChipClick);
		ui.empty.addEventListener('click', onEmptyClick);
		ui.rows.addEventListener('click', onRowClick);
		ui.pending.addEventListener('click', onPendingClick);
		ui.exportButton.addEventListener('click', exportReport);
		sidePanel.addEventListener('shown.bs.offcanvas', () => panelUi.title.focus({ preventScroll: true }));
		sidePanel.addEventListener('hidden.bs.offcanvas', onPanelClosed);
		panelUi.actions.addEventListener('click', onPanelAction);
		document.addEventListener('basalt:appearance', () =>
			requestAnimationFrame(() => {
				paintLegend();
				buildBars(false);
			}),
		);
		paintLegend();
		paintAll();
		drawWhenVisible();
	}

	/* Money and dates. Day strings are yyyy-mm-dd throughout the data. */

	function dollars(amount) {
		return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function rounded(amount) {
		return `$${Math.round(amount).toLocaleString('en-US')}`;
	}

	function brief(amount) {
		if (Math.abs(amount) >= 1000) return `$${Math.round(amount / 1000)}k`;
		return `$${Math.round(amount)}`;
	}

	function parseDay(iso) {
		const [year, month, day] = iso.split('-').map(Number);
		return new Date(year, month - 1, day);
	}

	/** "Oct 10", and "Oct 10, 2025" once the year is not the current one. */
	function dayName(iso) {
		const at = parseDay(iso);
		const yearPart = iso.slice(0, 4) === NOW_YEAR ? '' : `, ${at.getFullYear()}`;
		return `${MONTH_SHORT[at.getMonth()]} ${at.getDate()}${yearPart}`;
	}

	function fullDayLabel(iso) {
		const at = parseDay(iso);
		return `${WEEKDAY[at.getDay()]}, ${MONTH_SHORT[at.getMonth()]} ${at.getDate()}, ${at.getFullYear()}`;
	}

	function daysLeft(iso) {
		return Math.round((parseDay(iso) - parseDay(NOW_DAY)) / 86400000);
	}

	/** A word for a day within a week of now, or null when it is further off. */
	function relativeDay(iso) {
		const gap = daysLeft(iso);
		if (gap === 0) return 'today';
		if (gap === 1) return 'tomorrow';
		if (gap > 1 && gap < 7) return `in ${gap} days`;
		if (gap === -1) return 'yesterday';
		if (gap < 0) return `${-gap} days ago`;
		return null;
	}

	function count(total, noun) {
		return `${total} ${noun}${total === 1 ? '' : 's'}`;
	}

	/* Periods. A period key is "2026-Q3"; a month key is "2026-07". */

	function periodOfMonth(yearMonth) {
		return `${yearMonth.slice(0, 4)}-Q${Math.ceil(Number(yearMonth.slice(5)) / 3)}`;
	}

	function currentPeriod() {
		return periodOfMonth(NOW_DAY.slice(0, 7));
	}

	function periodIsOver(period) {
		return period < currentPeriod();
	}

	/** "Jul to Sep 2026", with ", so far" added for the running quarter when asked. */
	function periodTitle(period, { soFar = false } = {}) {
		const year = period.slice(0, 4);
		const index = Number(period.slice(-1));
		const span = `${MONTH_SHORT[(index - 1) * 3]} to ${MONTH_SHORT[index * 3 - 1]} ${year}`;
		return soFar && period === currentPeriod() ? `${span}, so far` : span;
	}

	function periodAxisLabel(period) {
		return [`Q${period.slice(-1)}`, period.slice(0, 4)];
	}

	const FILING_TITLES = {
		month(period) {
			const [year, month] = period.split('-').map(Number);
			return `${MONTH_FULL[month - 1]} ${year}`;
		},
		quarter: (period) => periodTitle(period),
		year: (period) => `Year ${period}`,
	};

	function filingTitle(place, filing) {
		return FILING_TITLES[place.every](filing.period);
	}

	/* A yearly return belongs to the newest period; the rest to their last month. */
	function periodOfFiling(entry, filing) {
		if (entry.place.every === 'year') return PERIODS[PERIODS.length - 1];
		return periodOfMonth(filing.months[filing.months.length - 1]);
	}

	/** "Texas sales tax", "Ohio CAT": a kind written in capitals is left alone. */
	function placeTitle(place) {
		const kind = /^[A-Z][a-z]/.test(place.kind) ? place.kind[0].toLowerCase() + place.kind.slice(1) : place.kind;
		return `${place.name} ${kind}`;
	}

	function regionSlot(regionId) {
		return REGIONS.findIndex((region) => region.id === regionId);
	}

	/* One place in one period: collected, paid, owed and the returns behind it. */

	function summarize(entry, period) {
		const place = entry.place;
		const monthSlots = ledger.months.flatMap((yearMonth, slot) =>
			periodOfMonth(yearMonth) === period ? [slot] : [],
		);
		const collected = monthSlots.reduce((sum, slot) => sum + entry.tax[slot], 0);
		const filings =
			place.every === 'year'
				? entry.returns.filter((filing) => filing.period === period.slice(0, 4))
				: entry.returns.filter((filing) =>
						filing.months.some((yearMonth) => periodOfMonth(yearMonth) === period),
					);
		const unpaid = filings.filter((filing) => filing.state !== 'paid');
		const paid =
			place.every === 'year'
				? filings[0]?.state === 'paid'
					? collected
					: 0
				: filings.reduce((sum, filing) => sum + (filing.state === 'paid' ? filing.tax : 0), 0);
		const nextUnpaid = unpaid.filter((filing) => filing.ended).sort(byDue)[0] || unpaid[0];
		return {
			entry,
			place,
			period,
			filings,
			status: filingStatus(unpaid),
			due: nextUnpaid ? nextUnpaid.due : filings[filings.length - 1]?.due,
			collected: roundCents(collected),
			paid: roundCents(paid),
			owed: roundCents(collected - paid),
			sales: Math.round(collected / place.effective),
		};
	}

	function filingStatus(unpaid) {
		if (!unpaid.length) return 'paid';
		if (unpaid.every((filing) => !filing.ended)) return 'later';
		const stillOpen = unpaid.filter((filing) => filing.ended && filing.state === 'open');
		if (!stillOpen.length) return 'filed';
		return stillOpen.some((filing) => filing.due < NOW_DAY) ? 'late' : 'open';
	}

	function summaries(period) {
		return REGISTRY.map((entry) => summarize(entry, period));
	}

	function roundCents(amount) {
		return Math.round(amount * 100) / 100;
	}

	function byDue(a, b) {
		return a.due.localeCompare(b.due);
	}

	function byUrgency(a, b) {
		return URGENCY[a.status] - URGENCY[b.status] || String(a.due).localeCompare(String(b.due)) || b.owed - a.owed;
	}

	function needsAction(row) {
		return row.status === 'open' || row.status === 'late';
	}

	function passesChip(row) {
		if (view.chip === 'all') return true;
		if (view.chip === 'open') return needsAction(row);
		return row.status === view.chip;
	}

	function tally(rows, status) {
		return rows.filter((row) => row.status === status).length;
	}

	function sumOf(rows, key) {
		return rows.reduce((sum, row) => sum + row[key], 0);
	}

	/** Every return whose period has ended and is not paid yet, soonest first. */
	function pendingFilings() {
		return REGISTRY.flatMap((entry) =>
			entry.returns
				.filter((filing) => filing.ended && filing.state !== 'paid')
				.map((filing) => ({ entry, filing })),
		).sort((a, b) => a.filing.due.localeCompare(b.filing.due) || b.filing.tax - a.filing.tax);
	}

	function badge(status) {
		const { text, tone } = BADGES[status];
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${text}</span>`;
	}

	/* The four figures at the top. */

	function paintFigures(rows) {
		const collected = sumOf(rows, 'collected');
		const slot = PERIODS.indexOf(view.period);
		ui.figure('collected').textContent = rounded(collected);
		ui.figure('collected-note').textContent =
			slot > 0 && periodIsOver(view.period)
				? collectedChange(collected, PERIODS[slot - 1])
				: `From ${rows.length} places`;
		ui.figure('paid').textContent = rounded(sumOf(rows, 'paid'));
		ui.figure('paid-note').textContent = `${tally(rows, 'paid')} of ${rows.length} places settled`;
		ui.figure('owed').textContent = rounded(sumOf(rows, 'owed'));
		ui.figure('owed-note').textContent = owedNote(rows);
		const soonest = pendingFilings()[0];
		ui.figure('next').textContent = soonest ? dayName(soonest.filing.due) : 'None';
		ui.figure('next-note').textContent = soonest ? nextNote(soonest) : 'Every ended return is paid';
	}

	/** "+4.2% on Apr to Jun": the change against the period before. */
	function collectedChange(collected, earlierPeriod) {
		const earlier = sumOf(summaries(earlierPeriod), 'collected');
		const pct = Math.round((collected / earlier - 1) * 1000) / 10;
		return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}% on ${periodTitle(earlierPeriod).replace(/ \d{4}$/, '')}`;
	}

	function owedNote(rows) {
		const toFile = rows.filter(needsAction).length;
		const toPay = tally(rows, 'filed');
		if (toFile || toPay) {
			return [toFile ? `${toFile} to file` : '', toPay ? `${toPay} to pay` : ''].filter(Boolean).join(', ');
		}
		return tally(rows, 'later') ? 'Not due until the period ends' : 'Nothing left to pay';
	}

	function nextNote({ entry, filing }) {
		const soon = relativeDay(filing.due);
		return placeTitle(entry.place) + (soon ? `, ${soon}` : '');
	}

	/* The chart: five quarters stacked by region, the picked one in full color. */

	function themeColor(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	function packHex(hex) {
		const found = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
		return found ? parseInt(found[1], 16) : null;
	}

	function tint(hex, alpha) {
		const packed = packHex(hex);
		if (packed === null) return hex;
		return `rgba(${(packed >> 16) & 255}, ${(packed >> 8) & 255}, ${packed & 255}, ${alpha})`;
	}

	/** Weighs hexA against hexB channel by channel; falls back to hexA when either is not a hex color. */
	function blend(hexA, hexB, weight) {
		const first = packHex(hexA);
		const second = packHex(hexB);
		if (first === null || second === null) return hexA;
		return `#${[16, 8, 0]
			.map((shift) => Math.round(((first >> shift) & 255) * weight + ((second >> shift) & 255) * (1 - weight)))
			.map((channel) => channel.toString(16).padStart(2, '0'))
			.join('')}`;
	}

	function regionColors() {
		return REGIONS.map((region, slot) => themeColor(`--basalt-series-${RAMP_SLOTS[slot]}`, '#6d3fe0'));
	}

	function paintLegend() {
		const colors = regionColors();
		ui.legend.innerHTML = REGIONS.map(
			(region, slot) =>
				`<li><span class="txr-legend-dot" aria-hidden="true" style="background:${colors[slot]}"></span>${htmlSafe(region.name)}</li>`,
		).join('');
	}

	function periodTotals() {
		const totals = Object.fromEntries(PERIODS.map((period) => [period, REGIONS.map(() => 0)]));
		for (const entry of REGISTRY) {
			const slot = regionSlot(entry.place.area);
			for (const [monthSlot, amount] of entry.tax.entries()) {
				totals[periodOfMonth(ledger.months[monthSlot])][slot] += amount;
			}
		}
		return totals;
	}

	function barsConfig(animate) {
		const colors = regionColors();
		const ink = themeColor('--basalt-copy', '#12233a');
		const inkMuted = themeColor('--basalt-copy-muted', '#5f7186');
		const plane = themeColor('--basalt-plane', '#ffffff');
		const axisInk = blend(inkMuted, ink, 0.72);
		const totals = periodTotals();
		const picked = view.period;

		function axisTicks(extra) {
			return { color: axisInk, font: { family: TYPEFACE, size: 11.5 }, ...extra };
		}

		const datasets = REGIONS.map((region, slot) => ({
			label: region.name,
			data: PERIODS.map((period) => Math.round(totals[period][slot])),
			backgroundColor: PERIODS.map((period) => (period === picked ? colors[slot] : tint(colors[slot], 0.32))),
			hoverBackgroundColor: PERIODS.map((period) => (period === picked ? colors[slot] : tint(colors[slot], 0.5))),
			borderColor: plane,
			borderWidth: { top: 2 },
			borderSkipped: 'bottom',
			borderRadius: slot === REGIONS.length - 1 ? { topLeft: 6, topRight: 6 } : 0,
			maxBarThickness: 64,
		}));
		return {
			type: 'bar',
			data: { labels: PERIODS.map(periodAxisLabel), datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				onClick: (event, hits) => {
					if (hits?.length) choosePeriod(PERIODS[hits[0].index]);
				},
				onHover: (event, hits) => {
					const surface = event.native?.target;
					if (surface) surface.style.cursor = hits?.length ? 'pointer' : 'default';
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: plane,
						titleColor: ink,
						bodyColor: ink,
						footerColor: ink,
						borderColor: themeColor('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: TYPEFACE, size: 12, weight: '600' },
						bodyFont: { family: TYPEFACE, size: 12 },
						footerFont: { family: TYPEFACE, size: 12, weight: '600' },
						callbacks: {
							title: (items) => periodTitle(PERIODS[items[0].dataIndex], { soFar: true }),
							label: (item) => ` ${item.dataset.label}: ${rounded(item.parsed.y)}`,
							labelColor: (item) => ({
								borderColor: colors[item.datasetIndex],
								backgroundColor: colors[item.datasetIndex],
							}),
							footer: (items) => `Total ${rounded(items.reduce((sum, item) => sum + item.parsed.y, 0))}`,
						},
					},
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: axisTicks({ padding: 6 }),
					},
					y: {
						stacked: true,
						beginAtZero: true,
						grid: { color: tint(ink.length === 7 ? ink : '#12233a', 0.07) },
						border: { display: false },
						ticks: axisTicks({ padding: 8, maxTicksLimit: 5, callback: (value) => brief(value) }),
					},
				},
			},
		};
	}

	function buildBars(animate) {
		if (typeof Chart === 'undefined' || !ui.canvas) return;
		bars?.destroy();
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		bars = new Chart(ui.canvas, barsConfig(animate && !reduced));
	}

	/* Swapping the data in place keeps the axes steady when the quarter changes. */
	function refreshBars() {
		if (!bars) return;
		bars.config.data = barsConfig(false).data;
		bars.update('none');
	}

	/* The first draw waits until the canvas is near the viewport, so it animates in view. */
	function drawWhenVisible() {
		if (!('IntersectionObserver' in window)) {
			buildBars(false);
			return;
		}
		const watcher = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watcher.disconnect();
				buildBars(true);
			},
			{ rootMargin: '120px 0px' },
		);
		watcher.observe(ui.canvas);
	}

	/* The list of returns coming due. */

	function paintPending() {
		const waiting = pendingFilings();
		if (!waiting.length) {
			ui.pending.innerHTML =
				'<li class="txr-due-item"><p class="txr-due-none">Every return that has ended is paid.</p></li>';
			ui.pendingNote.textContent = 'Nothing is waiting to be filed or paid.';
			return;
		}
		ui.pendingNote.textContent = `${count(waiting.length, 'return')} not paid yet, soonest first.`;
		const overflow = waiting.length - PENDING_LIMIT;
		const tail =
			overflow > 0
				? `<li class="txr-due-item"><p class="txr-due-none">${count(overflow, 'more return')} due by ${dayName(waiting[waiting.length - 1].filing.due)}.</p></li>`
				: '';
		ui.pending.innerHTML = waiting.slice(0, PENDING_LIMIT).map(pendingItem).join('') + tail;
	}

	function pendingItem({ entry, filing }) {
		const place = entry.place;
		const dueOn = parseDay(filing.due);
		const soonClass = daysLeft(filing.due) <= 7 ? ' is-soon' : '';
		const note =
			filing.state === 'filed'
				? `Filed, pays ${dayName(filing.payOn || filing.due)}`
				: `To file · ${filingTitle(place, filing).replace(/ to /, '–')}`;
		const spoken = `${placeTitle(place)}, ${filingTitle(place, filing)}, due ${fullDayLabel(filing.due)}, ${dollars(filing.tax)}`;
		return [
			`<li class="txr-due-item"><button class="txr-due-btn" type="button" data-txr-open="${htmlSafe(place.id)}" data-txr-q="${htmlSafe(periodOfFiling(entry, filing))}" aria-label="${htmlSafe(spoken)}">`,
			`<span class="txr-due-date${soonClass}" aria-hidden="true"><span class="txr-due-mon">${MONTH_SHORT[dueOn.getMonth()]}</span><span class="txr-due-day">${dueOn.getDate()}</span></span>`,
			`<span class="txr-due-text" aria-hidden="true"><span class="txr-due-name">${htmlSafe(placeTitle(place))}</span><span class="txr-due-meta">${htmlSafe(note)}</span></span>`,
			`<span class="txr-due-amount" aria-hidden="true">${rounded(filing.tax)}</span></button></li>`,
		].join('');
	}

	/* The table of places. */

	function paintTable(rows) {
		dropTooltips(ui.rows);
		const tallies = {
			all: rows.length,
			open: rows.filter(needsAction).length,
			filed: tally(rows, 'filed'),
			paid: tally(rows, 'paid'),
		};
		for (const [chip, total] of Object.entries(tallies)) {
			pick(`[data-txr-n="${chip}"]`, ui.chips).textContent = total;
		}
		for (const button of pickAll('[data-txr-filter]', ui.chips)) {
			button.setAttribute('aria-pressed', String(button.dataset.txrFilter === view.chip));
		}
		ui.listTitle.textContent = `Returns for ${periodTitle(view.period)}`;
		ui.summary.textContent = periodIsOver(view.period)
			? `${count(rows.length, 'place')} charge tax. Soonest due first; open one to file or pay it.`
			: `The quarter is still running, so nothing is due yet. Figures are to ${dayName(NOW_DAY)}.`;
		const shown = rows.filter(passesChip).sort(byUrgency);
		const palette = regionColors();
		ui.rows.innerHTML = shown.map((row) => tableRow(row, palette)).join('');
		ui.foot.innerHTML = shown.length ? totalsRow(shown) : '';
		ui.table.hidden = !shown.length;
		ui.empty.hidden = shown.length > 0;
		if (!shown.length) ui.empty.innerHTML = emptyNotice();
		window.Basalt.tips?.(ui.rows);
	}

	function tableRow(row, palette) {
		const place = row.place;
		const spoken = `${placeTitle(place)}, ${periodTitle(row.period)}`;
		const dueText = htmlSafe(dayName(row.due));
		const zero = '<span class="txr-quiet">$0</span>';
		return [
			`<tr class="txr-row${view.openedPlace === place.id ? ' is-open' : ''}" data-txr-id="${htmlSafe(place.id)}">`,
			`<td class="txr-row-place"><span class="txr-place"><span class="txr-place-dot" aria-hidden="true" style="background:${palette[regionSlot(place.area)]}"></span><span class="txr-place-name">${htmlSafe(place.name)}<span class="txr-place-kind">${htmlSafe(place.kind)}</span></span></span></td>`,
			`<td class="txr-row-kind">${htmlSafe(place.kind)} <span class="txr-quiet">${htmlSafe(place.rate)}</span></td>`,
			`<td class="txr-row-sales txr-r txr-num">${rounded(row.sales)}</td>`,
			`<td class="txr-row-collected txr-r txr-num">${rounded(row.collected)}</td>`,
			`<td class="txr-row-paid txr-r txr-num">${row.paid ? rounded(row.paid) : zero}</td>`,
			`<td class="txr-row-owed txr-r txr-num">${row.owed ? `<span class="txr-owed">${rounded(row.owed)}</span>` : zero}<span class="txr-row-mobile"> owed · due ${dueText}</span></td>`,
			`<td class="txr-row-due">${dueText}</td>`,
			`<td class="txr-row-status">${badge(row.status)}</td>`,
			`<td class="txr-row-open"><span class="basalt-row-actions"><button class="btn btn-icon btn-sm" type="button" data-txr-quick="${htmlSafe(place.id)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view" aria-label="Quick view: ${htmlSafe(spoken)}"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button></span></td>`,
			'</tr>',
		].join('');
	}

	function totalsRow(rows) {
		return [
			'<tr><th class="txr-foot-place" scope="row">Total</th><td class="txr-foot-kind"></td>',
			`<td class="txr-foot-sales txr-r txr-num">${rounded(sumOf(rows, 'sales'))}</td>`,
			`<td class="txr-foot-collected txr-r txr-num">${rounded(sumOf(rows, 'collected'))}</td>`,
			`<td class="txr-foot-paid txr-r txr-num">${rounded(sumOf(rows, 'paid'))}</td>`,
			`<td class="txr-foot-owed txr-r txr-num">${rounded(sumOf(rows, 'owed'))}</td>`,
			'<td class="txr-foot-due"></td><td class="txr-foot-status"></td><td class="txr-foot-open"></td></tr>',
		].join('');
	}

	function emptyNotice() {
		const wording = { open: 'to file', filed: 'filed and waiting to be paid', paid: 'paid' }[view.chip];
		return `<div class="basalt-empty basalt-empty-compact txr-empty"><span class="txr-empty-icon" aria-hidden="true"><i class="bi bi-funnel"></i></span><h3 class="basalt-empty-title">No returns ${wording}</h3><p class="basalt-empty-text">Nothing for ${htmlSafe(periodTitle(view.period))} is ${wording}.</p><div class="basalt-empty-actions"><button class="btn btn-sm btn-outline-secondary" type="button" data-txr-all>Show all returns</button></div></div>`;
	}

	function paintAll() {
		const rows = summaries(view.period);
		paintFigures(rows);
		paintPending();
		paintTable(rows);
	}

	/* What the page's own controls do. */

	function onPeriodChange() {
		view.period = ui.period.value;
		paintAll();
		refreshBars();
		speak(`Showing ${periodTitle(view.period, { soFar: true })}`);
	}

	/* A bar in the chart picks its quarter the same way the select does. */
	function choosePeriod(period) {
		if (period === view.period) return;
		ui.period.value = period;
		ui.period.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function onChipClick(event) {
		const chip = event.target.closest('[data-txr-filter]');
		if (!chip) return;
		view.chip = chip.dataset.txrFilter;
		paintTable(summaries(view.period));
		speak(`${ui.rows.children.length} places shown`);
	}

	function onEmptyClick(event) {
		if (!event.target.closest('[data-txr-all]')) return;
		view.chip = 'all';
		paintTable(summaries(view.period));
		pick('[data-txr-filter="all"]', ui.chips).focus();
	}

	/* A return has no page of its own, so the whole row opens the panel. */
	function onRowClick(event) {
		const row = event.target.closest('tr[data-txr-id]');
		if (row) showPlace(row.dataset.txrId, view.period);
	}

	function onPendingClick(event) {
		const button = event.target.closest('[data-txr-open]');
		if (button) showPlace(button.dataset.txrOpen, button.dataset.txrQ);
	}

	/* CSV export of the table and of one place's returns. */

	function exportReport() {
		const rows = summaries(view.period).sort(byUrgency);
		const sheet = [['Place', 'Tax', 'Rate', 'Taxed sales', 'Collected', 'Paid', 'Owed', 'Due', 'Status']];
		for (const row of rows) {
			sheet.push([
				row.place.name,
				row.place.kind,
				row.place.rate,
				row.sales,
				row.collected.toFixed(2),
				row.paid.toFixed(2),
				row.owed.toFixed(2),
				row.due,
				BADGES[row.status].text,
			]);
		}
		saveCsv(`fieldline-tax-${view.period.toLowerCase()}.csv`, sheet);
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: 'Tax report exported',
			text: `${periodTitle(view.period)}, ${count(rows.length, 'place')} as CSV.`,
		});
	}

	function downloadFiling(place, row) {
		const sheet = [['Place', 'Tax', 'Return', 'Due', 'Tax', 'Status']];
		for (const filing of row.filings) {
			sheet.push([
				place.name,
				`${place.kind} ${place.rate}`,
				filingTitle(place, filing),
				filing.due,
				filing.tax.toFixed(2),
				filing.state,
			]);
		}
		saveCsv(`return-${place.id}-${panelPeriod.toLowerCase()}.csv`, sheet);
		notify({
			tone: 'success',
			icon: 'bi-download',
			title: 'Return downloaded',
			text: `${placeTitle(place)}, ${periodTitle(panelPeriod)}.`,
		});
	}

	function saveCsv(filename, sheet) {
		const body = sheet.map((cells) => cells.map(csvCell).join(',')).join('\r\n');
		const href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
		const link = Object.assign(document.createElement('a'), { href, download: filename });
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(href), 1000);
	}

	function csvCell(value) {
		const text = String(value);
		return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : value;
	}

	/* The side panel: one place, one period. */

	function panelInstance() {
		return bootstrap.Offcanvas.getOrCreateInstance(sidePanel);
	}

	function openedEntry() {
		return REGISTRY.find((entry) => entry.place.id === view.openedPlace);
	}

	function showPlace(placeId, period) {
		view.openedPlace = placeId;
		panelPeriod = period || view.period;
		paintPanel();
		markOpenRow();
		dropTooltips(ui.rows);
		panelInstance().show();
	}

	function paintPanel() {
		const entry = openedEntry();
		if (!entry) return;
		const row = summarize(entry, panelPeriod);
		panelUi.title.textContent = placeTitle(entry.place);
		panelUi.subtitle.textContent = `${periodTitle(panelPeriod, { soFar: true })} · ${entry.place.kind} ${entry.place.rate}`;
		panelUi.body.innerHTML = panelBody(row);
		panelUi.actions.innerHTML = panelActions(row);
	}

	/* Only the row for the open place in the shown period is lit. */
	function markOpenRow() {
		for (const row of pickAll('tr[data-txr-id]', ui.rows)) {
			row.classList.toggle('is-open', row.dataset.txrId === view.openedPlace && panelPeriod === view.period);
		}
	}

	function onPanelClosed() {
		view.openedPlace = null;
		for (const row of pickAll('tr.is-open', ui.rows)) row.classList.remove('is-open');
	}

	/* In a real app each action is a request to the tax software; the page repaints once it answers. */
	function onPanelAction(event) {
		const button = event.target.closest('[data-txr-act]');
		const entry = button && openedEntry();
		if (!entry) return;
		const row = summarize(entry, panelPeriod);
		const place = entry.place;
		const action = button.dataset.txrAct;
		if (action === 'download') {
			downloadFiling(place, row);
			return;
		}
		const wanted = action === 'file' ? 'open' : 'filed';
		const filing = row.filings.filter((item) => item.ended && item.state === wanted).sort(byDue)[0];
		if (!filing) return;
		if (action === 'file') markFiled(place, filing);
		else markPaid(place, filing);
		paintAll();
		paintPanel();
		markOpenRow();
		refreshBars();
		panelUi.title.focus({ preventScroll: true });
	}

	function markFiled(place, filing) {
		Object.assign(filing, { state: 'filed', filed: NOW_DAY, by: SIGNER, payOn: filing.due });
		notify({
			tone: 'success',
			title: `${placeTitle(place)} filed`,
			text: `${filingTitle(place, filing)}. ${dollars(filing.tax)} to pay by ${dayName(filing.due)}.`,
		});
	}

	function markPaid(place, filing) {
		Object.assign(filing, { state: 'paid', paid: NOW_DAY, by: SIGNER });
		notify({
			tone: 'success',
			icon: 'bi-bank',
			title: 'Payment recorded',
			text: `${dollars(filing.tax)} to ${place.office} for ${filingTitle(place, filing)}.`,
		});
	}

	function panelBody(row) {
		return [
			`<p class="txr-d-state">${badge(row.status)}<span>${statusSentence(row)}</span></p>`,
			`<dl class="txr-d-figs">${panelFigure('Taxed sales', rounded(row.sales))}${panelFigure('Tax collected', dollars(row.collected))}${panelFigure('Paid', dollars(row.paid))}${panelFigure('Still owed', dollars(row.owed))}</dl>`,
			filingsSection(row),
			detailsSection(row.place),
			invoicesSection(row.place, row.period),
		].join('');
	}

	function panelFigure(term, value) {
		return `<div class="txr-d-fig"><dt>${term}</dt><dd>${value}</dd></div>`;
	}

	/** One sentence on where the place stands in this period. */
	function statusSentence(row) {
		const { place, filings, status } = row;
		if (status === 'paid') {
			const latest = filings.filter((filing) => filing.paid).sort((a, b) => b.paid.localeCompare(a.paid))[0];
			return latest
				? `Paid ${dayName(latest.paid)}${latest.by ? ` by ${htmlSafe(latest.by)}` : ''}.`
				: 'Paid in full.';
		}
		if (status === 'later') {
			return place.every === 'year'
				? `${place.name} takes one return a year. The ${row.period.slice(0, 4)} return is due ${fullDayLabel(row.due)}.`
				: `The period is still running. The return is due ${fullDayLabel(row.due)}.`;
		}
		const soonest = filings.filter((filing) => filing.state !== 'paid' && filing.ended).sort(byDue)[0];
		if (status === 'filed') {
			return `Filed ${dayName(soonest.filed)}${soonest.by ? ` by ${htmlSafe(soonest.by)}` : ''}. ${dollars(soonest.tax)} goes out ${dayName(soonest.payOn || soonest.due)}.`;
		}
		const gap = relativeDay(soonest.due);
		return `${status === 'late' ? 'Was due ' : 'Due '}${fullDayLabel(soonest.due)}${gap ? ` (${gap})` : ''}. Not filed yet.`;
	}

	function filingNote(filing) {
		if (filing.state === 'paid') return `Paid ${dayName(filing.paid)}`;
		if (filing.state === 'filed')
			return `Filed ${dayName(filing.filed)}, pays ${dayName(filing.payOn || filing.due)}`;
		if (!filing.ended) return `Due ${dayName(filing.due)}, period still running`;
		return `${filing.due < NOW_DAY ? 'Was due ' : 'Due '}${dayName(filing.due)}, not filed`;
	}

	function filingsSection({ place, filings }) {
		const items = filings
			.map(
				(filing) =>
					`<li class="txr-d-return"><span class="txr-d-return-name">${htmlSafe(filingTitle(place, filing))}</span><span class="txr-d-return-amt">${dollars(filing.tax)}</span><span class="txr-d-return-meta">${htmlSafe(filingNote(filing))}</span></li>`,
			)
			.join('');
		const yearlyNote =
			place.every === 'year'
				? '<p class="txr-d-note">The yearly return counts every month of the year; the figures above are this quarter’s share.</p>'
				: '';
		return `<section class="txr-d-section" aria-labelledby="tax-d-ret-title"><h3 class="txr-d-h" id="tax-d-ret-title">${filings.length > 1 ? 'Returns' : 'Return'}</h3><ul class="txr-d-returns">${items}</ul>${yearlyNote}</section>`;
	}

	function detailsSection(place) {
		return `<section class="txr-d-section" aria-labelledby="tax-d-facts-title"><h3 class="txr-d-h" id="tax-d-facts-title">Details</h3><dl class="txr-d-facts"><dt>Tax office</dt><dd>${htmlSafe(place.office)}</dd><dt>Registration</dt><dd>${htmlSafe(place.reg)}</dd><dt>Rate</dt><dd>${htmlSafe(`${place.kind} ${place.rate}`)}</dd><dt>Returns</dt><dd>${CADENCE_WORDS[place.every]}</dd></dl></section>`;
	}

	function invoicesSection(place, period) {
		const found = taxedInvoices(place, period);
		const allLink = '<a class="txr-d-more" href="invoices.html">All invoices</a>';
		const inner = found.length
			? `<ul class="txr-d-invoices">${found.slice(0, 4).map(invoiceItem).join('')}</ul><p class="txr-d-note">${found.length > 4 ? `The newest 4 of ${found.length} in the invoice list.` : 'From the invoice list, newest first.'} ${allLink}</p>`
			: `<p class="txr-d-note">The invoice list starts on Aug 17, 2026, so it holds none from this period that charged this tax. ${allLink}</p>`;
		return `<section class="txr-d-section" aria-labelledby="tax-d-inv-title"><h3 class="txr-d-h" id="tax-d-inv-title">Invoices that charged it</h3>${inner}</section>`;
	}

	function invoiceItem(invoice) {
		return `<li class="txr-d-invoice"><a href="invoice-details.html?id=${encodeURIComponent(invoice.no)}">${htmlSafe(invoice.no)}</a><span class="txr-d-invoice-amt">${dollars(invoice.tax.amount)}</span><span class="txr-d-invoice-who">${htmlSafe(invoice.customer)} · ${htmlSafe(dayName(invoice.issued))}</span></li>`;
	}

	/** The invoices in the period that carried one of this place's tax labels, newest first. */
	function taxedInvoices(place, period) {
		if (!invoiceBook) return [];
		return invoiceBook
			.invoices()
			.filter(
				(invoice) =>
					invoice.tax &&
					place.labels.includes(invoice.tax.label) &&
					invoice.issued &&
					periodOfMonth(invoice.issued.slice(0, 7)) === period,
			)
			.sort((a, b) => b.issued.localeCompare(a.issued));
	}

	function panelActions(row) {
		const save =
			'<button class="btn btn-outline-secondary" type="button" data-txr-act="download"><i class="bi bi-download me-1" aria-hidden="true"></i>Download return</button>';
		const close =
			'<button class="btn btn-outline-secondary" type="button" data-bs-dismiss="offcanvas">Close</button>';
		const byStatus = {
			open: `${save}<button class="btn btn-primary" type="button" data-txr-act="file"><i class="bi bi-send-check me-1" aria-hidden="true"></i>Mark as filed</button>`,
			filed: `${save}<button class="btn btn-primary" type="button" data-txr-act="pay"><i class="bi bi-bank me-1" aria-hidden="true"></i>Record payment</button>`,
			paid: `${close}${save}`,
			later: close,
		};
		return byStatus[row.status === 'late' ? 'open' : row.status];
	}

	/* Small DOM helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(text) {
		return String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);
	}

	function notify(message) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(message) : null;
	}

	/* Clearing first makes a repeated message read out again. */
	function speak(text) {
		ui.live.textContent = '';
		setTimeout(() => {
			ui.live.textContent = text;
		}, 40);
	}

	/* Rows are replaced wholesale, so a tooltip left showing would outlive its button. */
	function dropTooltips(scope) {
		if (!window.bootstrap?.Tooltip) return;
		for (const trigger of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const tip = bootstrap.Tooltip.getInstance(trigger);
			if (!tip) continue;
			if (!tip.tip) {
				tip.dispose();
				continue;
			}
			if (tip.tip.classList.contains('show')) tip.hide();
		}
	}

	start();
})();
