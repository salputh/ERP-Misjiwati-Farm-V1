/**
 * The patient record on patient-chart.html: every tab after
 * Overview, drawn from window.Basalt.data.clinicRecord (clinic-record.js)
 * and the clinic's own data (clinic.js).
 *   Labs        each panel as range bars, each test with its own history:
 *               latest value, its trend over the normal band, the table,
 *               a second test to compare and a CSV download
 *   Imaging     scans and traces with a viewer and a download
 *   Medications what she takes as a timeline, and Prescribe with checks
 *               against her allergies, her other medicines and her genes
 *   History     her life with the clinic and the places it hears from,
 *               and Request records from another place
 *   Family      three generations with what runs in the family, and her
 *               genetic results
 *   Insurance   her plan, this year's spending and her claims
 * The header's actions (Message, Refer, Schedule surgery, Edit her
 * details) are wired here too. Changes (a prescription, a referral, a
 * booked theater) live in memory with a toast.
 */
(() => {
	'use strict';
	const page = pick('[data-hc-page="patient-chart"]', document);
	const record = window.Basalt.data?.clinicRecord;
	const clinic = window.Basalt.data?.clinic;
	if (!page || !record || !clinic) return;

	const TODAY = clinic.asOf;
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	const charts = new Map();
	let labView = { test: null, compare: '' };
	const historyShown = { kind: 'all', place: 'all' };

	/* The kinds of event in her history, each with its icon and color. */
	const KINDS = {
		visit: { name: 'Visits', icon: 'bi-person-badge', tone: 1 },
		lab: { name: 'Labs', icon: 'bi-droplet', tone: 7 },
		imaging: { name: 'Imaging', icon: 'bi-images', tone: 4 },
		stay: { name: 'Hospital stays', icon: 'bi-hospital', tone: 6 },
		surgery: { name: 'Surgeries', icon: 'bi-bandaid', tone: 5 },
		vaccine: { name: 'Vaccines', icon: 'bi-shield-plus', tone: 3 },
		allergy: { name: 'Allergies', icon: 'bi-exclamation-octagon', tone: 2 },
	};

	/* Openings for a message, written the way the front desk would. */
	const MESSAGE_STARTS = [
		{
			name: 'Results are in',
			body: 'Hi Rhiannon, your blood test results from Sep 30 are in. Dr. Pearce would like to go over them; please book a short call.',
		},
		{
			name: 'Please call us',
			body: 'Hi Rhiannon, could you call Broadway Street Clinic when you have a moment? (415) 555-0100.',
		},
		{
			name: 'Check-up due',
			body: 'Hi Rhiannon, you are due for your yearly check-up. Book online or reply with a day that suits you.',
		},
		{ name: 'Blank', body: '' },
	];

	/* Why she would be sent to each department, from her own record. */
	const REFER_REASONS = {
		ortho: 'MRI on Jul 18, 2025 shows a meniscus tear in her left knee; still locking after PT.',
		cardio: 'High blood pressure on two medicines; father with heart disease. Please review.',
		resp: 'Asthma on budesonide; more night symptoms this fall.',
		gastro: 'ALT and alkaline phosphatase rising since naproxen began. Please review.',
		derm: 'Changing mole on her back for six months.',
	};

	start();

	function start() {
		markHeader();
		drawLabs();
		drawImaging();
		drawMeds();
		drawHistory();
		drawFamily();
		drawInsurance();
		wirePrescribe();
		wireRecordRequest();
		wireMessage();
		wireRefer();
		wireSurgery();
		wireDetails();
		openFromAddress();
		window.addEventListener('hashchange', openFromAddress);
		document.addEventListener('basalt:appearance', () => {
			if (labView.test) requestAnimationFrame(() => drawTrend(false));
		});
	}

	/* Helpers */

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

	function pane(name) {
		return pick(`[data-hcr-pane="${name}"]`);
	}

	function day(iso) {
		const [y, m, d] = iso.split('-').map(Number);
		return `${MONTHS[m - 1]} ${d}, ${y}`;
	}

	function shortDay(iso) {
		const [y, m, d] = iso.split('-').map(Number);
		return `${MONTHS[m - 1]} ${d}${iso.slice(0, 4) === TODAY.slice(0, 4) ? '' : `, ${y}`}`;
	}

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	/** 13:30 as 1:30 PM. */
	function clock(hhmm) {
		const [h, m] = hhmm.split(':').map(Number);
		return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
	}

	function who(id) {
		return id ? clinic.short(id) : '';
	}

	function toast(tone, title, text) {
		window.Basalt.toasts?.push({
			tone,
			title,
			text,
			icon: tone === 'success' ? 'bi-check2-circle' : 'bi-info-circle',
		});
	}

	function token(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** Hands the browser a file to save. */
	function download(name, blob) {
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = name;
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
	}

	function showTab(name) {
		const tab = pick(`#hcr-tab-${name}`);
		if (tab && window.bootstrap) window.bootstrap.Tab.getOrCreateInstance(tab).show();
	}

	/** #labs/alp opens a test's history, #imaging a tab, straight from a link. */
	function openFromAddress() {
		const [tab, item] = location.hash.slice(1).split('/');
		if (!tab || !pick(`#hcr-tab-${tab}`)) return;
		showTab(tab);
		if (tab === 'labs' && item && record.test(item)) openTest(item);
	}

	/* How long she has been with the clinic, beside her allergies. */
	function markHeader() {
		const since = pick('[data-hcr-since]');
		if (since) since.textContent = `With us since ${record.since.slice(0, 4)}, ${record.visits} visits`;
		paintContact();
	}

	/** The phone cell follows her details, and says how she likes to be reached. */
	function paintContact() {
		const c = record.contact;
		const phone = pick('[data-hcr-phone]');
		if (phone) {
			phone.textContent = c.phone;
			phone.href = `tel:${c.phone.replace(/[^+\d]/g, '')}`;
		}
		const prefers = pick('[data-hcr-prefers]');
		if (prefers)
			prefers.textContent = { text: 'Prefers texts', email: 'Prefers email', call: 'Prefers a call' }[c.prefers];
	}

	/* Labs */

	function latest(test) {
		return test.results.at(-1);
	}

	function outOf(test, value = latest(test)[1]) {
		return value < test.low ? 'low' : value > test.high ? 'high' : '';
	}

	/** Where a value sits on its bar, 0 to 100, with the normal range in the middle half. */
	function place(test, value) {
		const span = test.high - test.low;
		const from = test.low === 0 ? 0 : test.low - span * 0.5;
		const to = test.high + span * 0.5;
		return Math.max(2, Math.min(98, ((value - from) / (to - from)) * 100));
	}

	function rangeText(test) {
		return test.low === 0
			? `under ${test.high + (Number.isInteger(test.high) ? 1 : 0)} ${test.unit}`
			: `${test.low}–${test.high} ${test.unit}`;
	}

	/** A test's bar: the normal range as a green band and the value as a bubble on it. */
	function rangeBar(test, value) {
		const out = outOf(test, value);
		const from = place(test, test.low === 0 ? 0 : test.low);
		const to = place(test, test.high);
		return `<div class="hcr-range${out ? ' is-out' : ''}"><span class="hcr-range-band" style="left: ${test.low === 0 ? 0 : from}%; width: ${to - (test.low === 0 ? 0 : from)}%"></span><span class="hcr-range-mark" style="left: ${place(test, value)}%"><b>${value}</b></span></div><div class="hcr-range-ends"><span style="left: ${test.low === 0 ? 0 : from}%">${test.low === 0 ? '' : test.low}</span><span style="left: ${to}%">${test.high}</span></div>`;
	}

	function drawLabs() {
		const host = pane('labs');
		if (!host) return;
		const all = record.panels.flatMap((p) => p.tests);
		const out = all.filter((t) => outOf(t));
		const lastDraw = all
			.map((t) => latest(t)[0])
			.sort()
			.at(-1);
		host.innerHTML = `
			<div data-hcr-lab-list>
				<header class="hcr-head">
					<div>
						<h2 class="hcr-title">Lab results</h2>
						<p class="hcr-sub">Last drawn ${day(lastDraw)} · ${all.length} tests · <b class="hcr-out">${out.length} out of range</b></p>
					</div>
					<div class="hcr-head-actions">
						<div role="group" aria-label="Show" class="hcr-chips">
							<button type="button" class="hcr-chip" aria-pressed="true" data-hcr-lab-filter="all">All tests</button>
							<button type="button" class="hcr-chip" aria-pressed="false" data-hcr-lab-filter="out">Out of range</button>
						</div>
						<button type="button" class="btn btn-outline-secondary btn-sm" data-hcr-fold-all="open"><i class="bi bi-arrows-expand me-1" aria-hidden="true"></i>Expand all</button>
						<a href="lab-orders-and-results.html" class="btn btn-outline-secondary btn-sm"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Order labs</a>
					</div>
				</header>
				${insightHtml()}
				<div data-hcr-panels>${record.panels.map((panel, at) => panelHtml(panel, at)).join('')}</div>
			</div>
			<div data-hcr-lab-test hidden></div>`;
		host.addEventListener('click', (event) => {
			const filter = event.target.closest('[data-hcr-lab-filter]');
			if (filter) {
				const onlyOut = filter.dataset.hcrLabFilter === 'out';
				for (const chip of pickAll('[data-hcr-lab-filter]', host))
					chip.setAttribute('aria-pressed', String(chip === filter));
				/* The whole slot goes, so the tests left close up in order. */
				for (const slot of pickAll('.hcr-tests > li', host))
					slot.hidden = onlyOut && !slot.classList.contains('is-out');
				for (const card of pickAll('[data-hcr-panel]', host)) {
					card.hidden = !pick('.hcr-tests > li:not([hidden])', card);
					if (!card.hidden) foldPanel(card, onlyOut || card === pick('[data-hcr-panel]', host));
				}
				syncFoldAll(host);
				return;
			}
			const fold = event.target.closest('[data-hcr-panel-toggle]');
			if (fold) {
				const card = fold.closest('[data-hcr-panel]');
				slidePanel(card, !card.classList.contains('is-open'));
				syncFoldAll(host);
				return;
			}
			const foldAll = event.target.closest('[data-hcr-fold-all]');
			if (foldAll) {
				const open = foldAll.dataset.hcrFoldAll === 'open';
				for (const card of pickAll('[data-hcr-panel]:not([hidden])', host)) slidePanel(card, open);
				syncFoldAll(host);
				return;
			}
			const tile = event.target.closest('[data-hcr-test]');
			if (tile) {
				openTest(tile.dataset.hcrTest);
				return;
			}
			const pair = event.target.closest('[data-hcr-compare-pair]');
			if (pair) {
				const [first, second] = pair.dataset.hcrComparePair.split(',');
				openTest(first, second);
				return;
			}
			if (event.target.closest('[data-hcr-lab-back]')) closeTest();
			if (event.target.closest('[data-hcr-lab-csv]')) testCsv();
		});
		host.addEventListener('change', (event) => {
			if (!event.target.closest('[data-hcr-compare]')) return;
			labView.compare = event.target.value;
			drawTrend(true);
		});
	}

	/** The bigger picture: tests that have moved together since a medicine began. */
	function insightHtml() {
		const alt = record.test('alt').test;
		const alp = record.test('alp').test;
		const naproxen = record.medications.find((m) => m.id === 'naproxen');
		const started = naproxen.steps[0].from;
		const before = (test) => test.results.filter(([on]) => on < started).at(-1)[1];
		return `<aside class="hcr-insight"><span class="hcr-insight-mark" aria-hidden="true"><i class="bi bi-stars"></i></span><div><p class="hcr-insight-title">Liver tests are climbing</p><p class="hcr-insight-text">ALT ${before(alt)} → ${latest(alt)[1]} and ALP ${before(alp)} → ${latest(alp)[1]} since naproxen began on ${shortDay(started)}.</p></div><button type="button" class="btn btn-outline-secondary btn-sm" data-hcr-compare-pair="alp,alt">Compare them</button></aside>`;
	}

	/** A panel folds under its head; folded, the head still shows a dot per test. */
	function panelHtml(panel, at) {
		const outs = panel.tests.filter((t) => outOf(t)).length;
		const drawn = panel.tests
			.map((t) => latest(t)[0])
			.sort()
			.at(-1);
		const open = at === 0;
		const dots = panel.tests
			.map(
				(t) =>
					`<i class="${outOf(t) ? 'is-out' : ''}" title="${htmlSafe(`${t.name}: ${latest(t)[1]} ${t.unit}`)}"></i>`,
			)
			.join('');
		return `<section class="card basalt-box hcr-panel${open ? ' is-open' : ''}" data-hcr-panel="${panel.id}" aria-labelledby="hcr-panel-${panel.id}">
			<button type="button" class="hcr-panel-head" data-hcr-panel-toggle aria-expanded="${open}" aria-controls="hcr-panel-body-${panel.id}">
				<span class="hcr-panel-chevron" aria-hidden="true"><i class="bi bi-chevron-right"></i></span>
				<span class="hcr-panel-text"><span id="hcr-panel-${panel.id}" class="hcr-panel-title">${panel.name}</span><span class="hcr-sub">${panel.what} · drawn ${shortDay(drawn)}</span></span>
				<span class="hcr-panel-dots" aria-hidden="true">${dots}</span>
				${outs ? `<span class="hcr-flag is-out">${outs} out of range</span>` : '<span class="hcr-flag">All in range</span>'}
			</button>
			<ul class="hcr-tests" id="hcr-panel-body-${panel.id}"${open ? '' : ' hidden'}>${panel.tests
				.map((test) => {
					const [on, value] = latest(test);
					const out = outOf(test);
					return `<li${out ? ' class="is-out"' : ''}><button type="button" class="hcr-test${out ? ' is-out' : ''}" data-hcr-test="${test.id}"><span class="hcr-test-head"><span class="hcr-test-name">${test.name}</span><span class="hcr-test-link">Trend<i class="bi bi-arrow-right" aria-hidden="true"></i></span></span><span class="hcr-test-range">Normal ${rangeText(test)}</span>${rangeBar(test, value)}<span class="hcr-test-on">${shortDay(on)}${out ? ` · ${out === 'high' ? 'above' : 'below'} range` : ''}</span></button></li>`;
				})
				.join('')}</ul>
		</section>`;
	}

	function foldPanel(card, open) {
		card.classList.toggle('is-open', open);
		pick('[data-hcr-panel-toggle]', card).setAttribute('aria-expanded', String(open));
		pick('.hcr-tests', card).hidden = !open;
	}

	/* A click folds the list of tests with a slide; the filter and the first paint snap. */
	function slidePanel(card, open) {
		window.Basalt.slide(pick('.hcr-tests', card), () => foldPanel(card, open));
	}

	function syncFoldAll(host) {
		const cards = pickAll('[data-hcr-panel]:not([hidden])', host);
		const allOpen = cards.length > 0 && cards.every((card) => card.classList.contains('is-open'));
		const button = pick('[data-hcr-fold-all]', host);
		button.innerHTML = allOpen
			? '<i class="bi bi-arrows-collapse me-1" aria-hidden="true"></i>Collapse all'
			: '<i class="bi bi-arrows-expand me-1" aria-hidden="true"></i>Expand all';
		button.dataset.hcrFoldAll = allOpen ? 'close' : 'open';
	}

	function openTest(id, compare = '') {
		const found = record.test(id);
		if (!found) return;
		labView = { test: found.test, panel: found.panel, compare };
		const host = pane('labs');
		pick('[data-hcr-lab-list]', host).hidden = true;
		const view = pick('[data-hcr-lab-test]', host);
		view.hidden = false;
		const test = found.test;
		const values = test.results.map(([, v]) => v);
		const [on, value] = latest(test);
		const out = outOf(test);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const digits = Math.max(...values.map((v) => (String(v).split('.')[1] || '').length));
		const others = record.panels.flatMap((p) => p.tests).filter((t) => t.id !== test.id);
		view.innerHTML = `
			<button type="button" class="basalt-hero-back hcr-back" data-hcr-lab-back><i class="bi bi-arrow-left" aria-hidden="true"></i>All labs</button>
			<header class="hcr-head">
				<div>
					<h2 class="hcr-title">${test.name}</h2>
					<p class="hcr-sub">${found.panel.name} · normal ${rangeText(test)}</p>
				</div>
				<div class="hcr-head-actions">
					<button type="button" class="btn btn-outline-secondary btn-sm btn-export" data-hcr-lab-csv><i class="bi bi-download me-1" aria-hidden="true"></i>Download CSV</button>
				</div>
			</header>
			<section class="card basalt-box hcr-test-top${out ? ' is-out' : ''}">
				<div class="hcr-latest">
					<p class="hcr-latest-label">Latest, ${day(on)}</p>
					<p class="hcr-latest-value">${value}<small>${test.unit}</small><span class="hcr-latest-state">${out ? (out === 'high' ? 'Above range' : 'Below range') : 'In range'}</span></p>
					<div class="hcr-latest-bar">${rangeBar(test, value)}</div>
				</div>
				<dl class="hcr-facts">
					<div><dt>Results</dt><dd>${values.length}</dd></div>
					<div><dt>Lowest – highest</dt><dd>${Math.min(...values)} – ${Math.max(...values)}</dd></div>
					<div><dt>Average</dt><dd>${mean.toFixed(digits)}</dd></div>
				</dl>
			</section>
			<section class="card basalt-box hcr-trend-card">
				<header class="hcr-trend-head">
					<div><h3 class="hcr-panel-title">Every result</h3><p class="hcr-sub">The green band is the normal range.</p></div>
					<label class="hcr-compare"><span>Compare with</span><select class="form-select form-select-sm" data-hcr-compare><option value="">Nothing</option>${others
						.map((t) => `<option value="${t.id}"${t.id === compare ? ' selected' : ''}>${t.name}</option>`)
						.join('')}</select></label>
				</header>
				<div class="hcr-trend"><canvas data-hcr-trend role="img" aria-label="${htmlSafe(`${test.name} over time`)}"></canvas></div>
				<details class="hcr-table-wrap">
					<summary>Data table (${values.length})</summary>
					<table class="table hcr-table"><thead><tr><th scope="col">Date</th><th scope="col">Value</th><th scope="col">Normal range</th><th scope="col">Flag</th></tr></thead><tbody>${test.results
						.slice()
						.reverse()
						.map(([when, v]) => {
							const flag = outOf(test, v);
							return `<tr><td>${day(when)}</td><td><b>${v}</b> ${test.unit}</td><td>${rangeText(test)}</td><td><span class="hcr-flag${flag ? ' is-out' : ' is-ok'}">${flag ? (flag === 'high' ? 'High' : 'Low') : 'Normal'}</span></td></tr>`;
						})
						.join('')}</tbody></table>
				</details>
			</section>`;
		drawTrend(true);
		history.replaceState(null, '', `#labs/${test.id}`);
		view.scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'start' });
	}

	function closeTest() {
		const host = pane('labs');
		pick('[data-hcr-lab-test]', host).hidden = true;
		pick('[data-hcr-lab-list]', host).hidden = false;
		labView = { test: null, compare: '' };
		charts.get('trend')?.destroy();
		charts.delete('trend');
		history.replaceState(null, '', '#labs');
	}

	/** The test over time with its normal band; a second test on its own scale. */
	function drawTrend(animate) {
		const canvas = pick('[data-hcr-trend]');
		if (!canvas || !window.Chart || !labView.test) return;
		charts.get('trend')?.destroy();
		const test = labView.test;
		const other = labView.compare ? record.test(labView.compare)?.test : null;
		const days = [...new Set([...test.results, ...(other ? other.results : [])].map(([on]) => on))].sort();
		const at = (t) => days.map((d) => t.results.find(([on]) => on === d)?.[1] ?? null);
		const hue = token('--basalt-hue', '#6d3fe0');
		const second = token('--basalt-series-5', '#d966a8');
		const good = token('--basalt-success', '#12c08f');
		const bad = token('--basalt-danger', '#ef4d63');
		const quiet = token('--basalt-copy-muted', '#6b6880');
		const band = (value) => days.map(() => value);
		const datasets = [
			{
				label: 'Normal top',
				data: band(test.high),
				borderWidth: 0,
				pointRadius: 0,
				fill: '+1',
				backgroundColor: `${good}26`,
				yAxisID: 'y',
			},
			{ label: 'Normal bottom', data: band(test.low), borderWidth: 0, pointRadius: 0, fill: false, yAxisID: 'y' },
			{
				label: test.name,
				data: at(test),
				borderColor: hue,
				backgroundColor: hue,
				borderWidth: 2.5,
				tension: 0.3,
				spanGaps: true,
				pointRadius: 5,
				pointHoverRadius: 7,
				pointBackgroundColor: at(test).map((v) => (v === null ? hue : outOf(test, v) ? bad : good)),
				pointBorderColor: token('--basalt-plane', '#fff'),
				pointBorderWidth: 2,
				yAxisID: 'y',
			},
		];
		if (other) {
			datasets.push({
				label: other.name,
				data: at(other),
				borderColor: second,
				backgroundColor: second,
				borderWidth: 2,
				borderDash: [6, 4],
				tension: 0.3,
				spanGaps: true,
				pointRadius: 3.5,
				yAxisID: 'y2',
			});
		}
		const values = test.results.map(([, v]) => v);
		const span = Math.max(...values, test.high) - Math.min(...values, test.low);
		const chart = new window.Chart(canvas, {
			type: 'line',
			data: { labels: days.map(shortDay), datasets },
			options: {
				maintainAspectRatio: false,
				animation: animate && !still.matches ? { duration: 500 } : false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: {
						display: Boolean(other),
						labels: { filter: (item) => !item.text.startsWith('Normal'), usePointStyle: true },
					},
					tooltip: {
						filter: (item) => !item.dataset.label.startsWith('Normal'),
						callbacks: {
							label: (item) => {
								const t = item.dataset.label === test.name ? test : other;
								return `${item.dataset.label}: ${item.raw} ${t.unit}`;
							},
						},
					},
				},
				scales: {
					x: { grid: { display: false }, ticks: { color: quiet, maxRotation: 0, autoSkipPadding: 18 } },
					y: {
						suggestedMin: Math.max(0, Math.min(...values, test.low) - span * 0.3),
						suggestedMax: Math.max(...values, test.high) + span * 0.3,
						ticks: { color: quiet },
						title: { display: true, text: test.unit, color: quiet },
					},
					...(other
						? {
								y2: {
									position: 'right',
									grid: { display: false },
									ticks: { color: second },
									title: { display: true, text: other.unit, color: second },
								},
							}
						: {}),
				},
			},
		});
		charts.set('trend', chart);
	}

	function testCsv() {
		const test = labView.test;
		const rows = [
			['Date', 'Value', 'Unit', 'Low', 'High', 'Flag'],
			...test.results.map(([on, v]) => [on, v, test.unit, test.low, test.high, outOf(test, v) || 'normal']),
		];
		const text = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
		download(
			`${record.patient.replace(/\s+/g, '-').toLowerCase()}-${test.id}.csv`,
			new Blob([text], { type: 'text/csv' }),
		);
		toast('success', 'Downloaded', `${test.name}, ${test.results.length} results.`);
	}

	/* Imaging */

	/* Each study is drawn rather than photographed, so it ships with the
	   template and downloads as a real picture. */
	function scan(kind) {
		const film = (body) =>
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#1c2230"/><stop offset="1" stop-color="#05070b"/></radialGradient><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="#9aa3b2"/><stop offset=".5" stop-color="#e9edf3"/><stop offset="1" stop-color="#8d95a3"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/>${body}<text x="14" y="288" fill="#9aa3b2" font-family="monospace" font-size="11">#10427 · L</text></svg>`;
		if (kind === 'ecg') {
			let grid = '';
			for (let x = 0; x <= 400; x += 10)
				grid += `<line x1="${x}" y1="0" x2="${x}" y2="300" stroke="#f3c4cc" stroke-width="${x % 50 ? 0.5 : 1.2}"/>`;
			for (let y = 0; y <= 300; y += 10)
				grid += `<line x1="0" y1="${y}" x2="400" y2="${y}" stroke="#f3c4cc" stroke-width="${y % 50 ? 0.5 : 1.2}"/>`;
			let trace = '';
			for (const base of [80, 170, 260]) {
				let d = `M0 ${base}`;
				for (let x = 0; x < 400; x += 80) {
					d += ` L${x + 18} ${base} L${x + 24} ${base - 6} L${x + 30} ${base} L${x + 38} ${base} L${x + 41} ${base + 8} L${x + 45} ${base - 44} L${x + 49} ${base + 14} L${x + 53} ${base} L${x + 62} ${base} L${x + 70} ${base - 10} L${x + 78} ${base}`;
				}
				trace += `<path d="${d}" fill="none" stroke="#1a1d29" stroke-width="1.6" stroke-linejoin="round"/>`;
			}
			return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#fff6f7"/>${grid}${trace}<text x="12" y="20" fill="#1a1d29" font-family="monospace" font-size="11">I · 25 mm/s · 74 bpm</text></svg>`;
		}
		if (kind === 'xray-knee') {
			return film(
				`<g opacity=".92"><path d="M150 0 C150 60 140 110 132 138 C126 160 142 176 200 176 C258 176 274 160 268 138 C260 110 250 60 250 0 Z" fill="url(#b)"/><path d="M138 196 C134 214 150 222 200 222 C250 222 266 214 262 196 C258 188 142 188 138 196 Z" fill="url(#b)" opacity=".85"/><path d="M146 222 C152 260 160 300 160 300 L240 300 C240 300 248 260 254 222 Z" fill="url(#b)"/><path d="M268 214 C276 240 274 300 274 300 L258 300 C260 270 256 236 252 222 Z" fill="url(#b)" opacity=".7"/><ellipse cx="200" cy="120" rx="34" ry="26" fill="#e9edf3" opacity=".35"/></g><path d="M140 188 L170 186" stroke="#f5c542" stroke-width="2" opacity=".8"/>`,
			);
		}
		if (kind === 'xray-chest') {
			let ribs = '';
			for (let i = 0; i < 9; i++) {
				const y = 70 + i * 22;
				ribs += `<path d="M196 ${y} C150 ${y - 14} 96 ${y - 4} 80 ${y + 30}" fill="none" stroke="#d8dde6" stroke-width="5" opacity=".55"/><path d="M204 ${y} C250 ${y - 14} 304 ${y - 4} 320 ${y + 30}" fill="none" stroke="#d8dde6" stroke-width="5" opacity=".55"/>`;
			}
			return film(
				`<rect x="190" y="30" width="20" height="270" rx="6" fill="url(#b)" opacity=".7"/><path d="M110 60 L190 50 M210 50 L290 60" stroke="#e9edf3" stroke-width="8" stroke-linecap="round" opacity=".7"/>${ribs}<ellipse cx="225" cy="215" rx="58" ry="52" fill="#e9edf3" opacity=".28"/><path d="M60 270 C120 250 280 250 340 270" stroke="#e9edf3" stroke-width="6" fill="none" opacity=".5"/>`,
			);
		}
		return film(
			`<g opacity=".9"><path d="M120 0 L280 0 L290 112 C292 140 250 150 200 150 C150 150 108 140 110 112 Z" fill="#7d8594"/><path d="M110 178 C108 160 150 158 200 158 C250 158 292 160 290 178 L282 300 L118 300 Z" fill="#6e7684"/><path d="M118 150 L170 156 L134 166 Z" fill="#1b2029"/><path d="M230 156 L282 150 L266 166 Z" fill="#1b2029"/><rect x="0" y="120" width="400" height="80" fill="#3a4150" opacity=".25"/></g><path d="M132 160 L158 158" stroke="#f4f6fa" stroke-width="2"/><circle cx="146" cy="160" r="18" fill="none" stroke="#f5c542" stroke-width="2" stroke-dasharray="4 3"/><text x="170" y="196" fill="#f5c542" font-family="monospace" font-size="11">tear</text>`,
		);
	}

	function scanUrl(kind) {
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scan(kind))}`;
	}

	function drawImaging() {
		const host = pane('imaging');
		if (!host) return;
		const studies = record.imaging;
		host.innerHTML = `
			<header class="hcr-head">
				<div><h2 class="hcr-title">Imaging</h2><p class="hcr-sub">${studies.length} studies, from this clinic and connected places.</p></div>
			</header>
			<ul class="hcr-scans">${studies
				.map((s, i) => {
					const place = record.places[s.place];
					return `<li class="card basalt-box hcr-scan">
						<button type="button" class="hcr-scan-pic" data-hcr-view="${i}" aria-label="View ${htmlSafe(`${s.name}, ${s.part}`)}"><img src="${scanUrl(s.kind)}" alt="" width="400" height="300" loading="lazy"><span class="hcr-scan-zoom" aria-hidden="true"><i class="bi bi-arrows-angle-expand"></i></span></button>
						<div class="hcr-scan-body">
							<p class="hcr-scan-title">${s.name} · ${s.part}</p>
							<p class="hcr-sub">${day(s.on)}${s.by ? ` · ${who(s.by)}` : ''}</p>
							${place.state === 'us' ? '' : `<span class="hcr-source"><i class="bi bi-link-45deg" aria-hidden="true"></i>${place.name}</span>`}
							<p class="hcr-scan-report">${s.report}</p>
							<div class="hcr-scan-actions"><button type="button" class="btn btn-outline-secondary btn-sm" data-hcr-view="${i}">View</button><button type="button" class="btn btn-outline-secondary btn-sm" data-hcr-save="${i}"><i class="bi bi-download me-1" aria-hidden="true"></i>Download</button></div>
						</div>
					</li>`;
				})
				.join('')}</ul>`;
		host.addEventListener('click', (event) => {
			const view = event.target.closest('[data-hcr-view]');
			if (view && window.Basalt.lightbox) {
				window.Basalt.lightbox.open(
					studies.map((s) => ({
						src: scanUrl(s.kind),
						title: `${s.name} · ${s.part}`,
						caption: `${day(s.on)} · ${s.report}`,
						alt: `${s.name} of the ${s.part.toLowerCase()}`,
					})),
					Number(view.dataset.hcrView),
				);
			}
			const save = event.target.closest('[data-hcr-save]');
			if (save) savePicture(studies[Number(save.dataset.hcrSave)]);
		});
	}

	/** Draws the study at twice its size and hands it over as a PNG. */
	function savePicture(study) {
		const picture = new Image();
		picture.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = 1200;
			canvas.height = 900;
			canvas.getContext('2d').drawImage(picture, 0, 0, 1200, 900);
			canvas.toBlob((blob) => {
				download(
					`${`${study.on}-${study.name}-${study.part}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`,
					blob,
				);
				toast('success', 'Downloaded', `${study.name} of the ${study.part.toLowerCase()}, ${day(study.on)}.`);
			}, 'image/png');
		};
		picture.src = scanUrl(study.kind);
	}

	/* Medications */

	function drawMeds() {
		const host = pane('meds');
		if (!host) return;
		const meds = record.medications;
		const current = meds.filter((m) => m.steps.at(-1).to === null);
		const allergies = record.history.filter((h) => h.kind === 'allergy' || /latex/i.test(h.note));
		host.innerHTML = `
			<header class="hcr-head">
				<div><h2 class="hcr-title">Medications</h2><p class="hcr-sub">${current.length} taken now · ${meds.length - current.length} in the past</p></div>
				<div class="hcr-head-actions"><button type="button" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#hcr-prescribe"><i class="bi bi-capsule me-1" aria-hidden="true"></i>Prescribe</button></div>
			</header>
			<section class="card basalt-box hcr-card" aria-labelledby="hcr-meds-time">
				<header class="hcr-card-head"><div><h3 id="hcr-meds-time" class="hcr-panel-title">Since 2019</h3><p class="hcr-sub">Each bar is a medicine; a step is a dose change.</p></div></header>
				<div data-hcr-med-time class="hcr-medtime"></div>
			</section>
			<div class="hcr-pair">
				<section class="card basalt-box hcr-card" aria-labelledby="hcr-meds-now">
					<header class="hcr-card-head"><div><h3 id="hcr-meds-now" class="hcr-panel-title">Taken now</h3><p class="hcr-sub">Refill sends it to her pharmacy.</p></div></header>
					<ul data-hcr-med-list class="hcr-medlist"></ul>
				</section>
				<section class="card basalt-box hcr-card" aria-labelledby="hcr-allergies">
					<header class="hcr-card-head"><div><h3 id="hcr-allergies" class="hcr-panel-title">Allergies</h3><p class="hcr-sub">Checked on every prescription.</p></div></header>
					<ul class="hcr-allergies">${allergies
						.map(
							(a) =>
								`<li><span class="hcr-allergy-mark" aria-hidden="true"><i class="bi bi-exclamation-octagon"></i></span><div><b>${a.kind === 'allergy' ? a.what.replace(' allergy', '') : 'Latex'}</b><span>${a.kind === 'allergy' ? a.note : 'Rash on both hands, found in 2016.'}</span></div><span class="hcr-sub">${a.on.slice(0, 4)}</span></li>`,
						)
						.join('')}</ul>
				</section>
			</div>`;
		paintMeds();
		host.addEventListener('click', (event) => {
			const refill = event.target.closest('[data-hcr-refill]');
			if (refill)
				toast(
					'success',
					'Refill sent',
					`${refill.dataset.hcrRefill} goes to Broadway Street Pharmacy, ready tomorrow.`,
				);
			const stop = event.target.closest('[data-hcr-stop]');
			if (stop) {
				const med = meds.find((m) => m.id === stop.dataset.hcrStop);
				med.steps.at(-1).to = TODAY;
				paintMeds();
				window.Basalt.toasts?.push({
					tone: 'info',
					icon: 'bi-capsule',
					title: `${med.name} stopped`,
					text: 'It stays in her history.',
					actions: [
						{
							label: 'Undo',
							onClick: () => {
								med.steps.at(-1).to = null;
								paintMeds();
							},
						},
					],
				});
			}
		});
	}

	function paintMeds() {
		const meds = record.medications;
		const list = pick('[data-hcr-med-list]');
		const current = meds.filter((m) => m.steps.at(-1).to === null);
		list.innerHTML = current
			.map(
				(m) =>
					`<li><div><b>${m.name}</b><span>${m.steps.at(-1).dose} · ${m.for}</span><span class="hcr-sub">Since ${shortDay(m.steps[0].from)} · ${who(m.by)}</span></div><div class="hcr-med-actions"><button type="button" class="btn btn-outline-secondary btn-sm" data-hcr-refill="${m.name}">Refill</button><button type="button" class="btn btn-sm hcr-stop" data-hcr-stop="${m.id}">Stop</button></div></li>`,
			)
			.join('');
		drawMedTime();
	}

	/** One lane per medicine from 2019 to now, a segment per dose. */
	function drawMedTime() {
		const host = pick('[data-hcr-med-time]');
		const meds = [...record.medications].sort((a, b) => a.steps[0].from.localeCompare(b.steps[0].from));
		const start = new Date('2019-01-01T12:00').getTime();
		const end = new Date(`${TODAY}T12:00`).getTime();
		const x = (iso) => ((new Date(`${iso}T12:00`).getTime() - start) / (end - start)) * 100;
		const years = [];
		for (let y = 2019; y <= Number(TODAY.slice(0, 4)); y++) years.push(y);
		const allergy = record.history.find((h) => /latex/i.test(h.note));
		host.innerHTML = `<div class="hcr-medtime-axis">${years.map((y) => `<span style="left: ${x(`${y}-01-01`)}%">${y}</span>`).join('')}<span class="is-now" style="left: 100%">Now</span></div>${meds
			.map((m, row) => {
				const tone = (row % 8) + 1;
				const live = m.steps.at(-1).to === null;
				return `<div class="hcr-medrow${live ? '' : ' is-past'}" style="--tone: var(--basalt-series-${tone})"><span class="hcr-medrow-name">${m.name}</span><div class="hcr-medrow-track">${m.steps
					.map((s, i) => {
						const from = x(s.from);
						const to = x(s.to || TODAY);
						return `<span class="hcr-dose${i ? ' is-step' : ''}${s.to === null ? ' is-live' : ''}" style="left: ${from}%; width: ${Math.max(0.8, to - from)}%" title="${htmlSafe(`${m.name}: ${s.dose}, ${shortDay(s.from)} to ${s.to ? shortDay(s.to) : 'now'}`)}"><i>${s.dose.split(',')[0]}</i></span>`;
					})
					.join('')}</div></div>`;
			})
			.join(
				'',
			)}${allergy ? `<span class="hcr-medtime-mark" style="left: ${x(allergy.on < '2019-01-01' ? '2019-01-01' : allergy.on)}%"></span>` : ''}`;
	}

	/* Prescribe: pick a medicine, then the dose and pharmacy. It is checked
	   against her allergies, what she already takes and her genes before it
	   can be sent; a serious warning needs a tick to go ahead. */
	function wirePrescribe() {
		const form = pick('[data-hcr-rx]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		const drug = pick('[data-hcr-rx-drug]', form);
		drug.innerHTML =
			'<option value="">Choose a medicine</option>' +
			record.formulary.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
		pick('[data-hcr-rx-pharmacy]', form).innerHTML = record.pharmacies.map((p) => `<option>${p}</option>`).join('');
		const checks = pick('[data-hcr-rx-checks]', form);
		const confirm = pick('[data-hcr-rx-confirm]', form);

		function warnings(item) {
			const out = [];
			if (item.family === 'penicillin') {
				const allergy = record.history.find((h) => h.kind === 'allergy');
				out.push({
					level: 'stop',
					text: `She is allergic to penicillin since ${allergy.on.slice(0, 4)}: ${allergy.note}`,
				});
			}
			if (item.family === 'nsaid') {
				const same = record.medications.find((m) => m.steps.at(-1).to === null && m.id === 'naproxen');
				if (same && item.name !== 'Naproxen')
					out.push({
						level: 'warn',
						text: `She already takes naproxen; two anti-inflammatories together raise the risk of stomach bleeding.`,
					});
				if (item.name === 'Naproxen')
					out.push({ level: 'warn', text: 'She already takes naproxen. This renews it.' });
				const alt = record.test('alt').test;
				if (outOf(alt))
					out.push({
						level: 'warn',
						text: `Her ALT is ${latest(alt)[1]}, above range; anti-inflammatories can strain the liver.`,
					});
			}
			if (item.gene) {
				const gene = record.genetics.find((g) => g.gene.toLowerCase() === item.gene);
				out.push({ level: 'stop', text: `Genes: ${gene.result.toLowerCase()} for ${gene.gene}. ${gene.why}` });
			}
			return out;
		}

		function paint() {
			const item = record.formulary[drug.value];
			pick('[data-hcr-rx-dose]', form).value = item ? item.dose : '';
			pick('[data-hcr-rx-days]', form).value = item ? item.days : '';
			const found = item ? warnings(item) : [];
			checks.innerHTML = item
				? found.length
					? found
							.map(
								(w) =>
									`<li class="hcr-check is-${w.level}"><i class="bi ${w.level === 'stop' ? 'bi-exclamation-octagon' : 'bi-exclamation-triangle'}" aria-hidden="true"></i>${w.text}</li>`,
							)
							.join('')
					: '<li class="hcr-check is-ok"><i class="bi bi-check2-circle" aria-hidden="true"></i>No allergies, clashes or gene notes for this medicine.</li>'
				: '';
			const stop = found.some((w) => w.level === 'stop');
			confirm.closest('.form-check').hidden = !stop;
			confirm.required = stop;
			confirm.checked = false;
		}

		drug.addEventListener('change', paint);
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const item = record.formulary[drug.value];
			const dose = pick('[data-hcr-rx-dose]', form).value.trim();
			const pharmacy = pick('[data-hcr-rx-pharmacy]', form).value;
			const id = item.name.toLowerCase().replace(/[^a-z]+/g, '-');
			const existing = record.medications.find((m) => m.id === id && m.steps.at(-1).to === null);
			if (existing) existing.steps.push({ from: TODAY, to: null, dose });
			else
				record.medications.push({
					id,
					name: item.name,
					for: 'Prescribed today',
					by: 'ev',
					steps: [{ from: TODAY, to: null, dose }],
				});
			if (existing && existing.steps.length > 1) existing.steps.at(-2).to = TODAY;
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			if (pick('[data-hcr-med-list]')) paintMeds();
			toast('success', 'Prescription sent', `${item.name}, ${dose}, to ${pharmacy}.`);
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
			paint();
		});
		paint();
	}

	/* History */

	function drawHistory() {
		const host = pane('history');
		if (!host) return;
		host.innerHTML = `
			<header class="hcr-head">
				<div><h2 class="hcr-title">History</h2><p class="hcr-sub">Everything since ${record.history.at(-1).on.slice(0, 4)}, from here and the places that share her records.</p></div>
				<div class="hcr-head-actions"><button type="button" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#hcr-request"><i class="bi bi-cloud-download me-1" aria-hidden="true"></i>Request records</button></div>
			</header>
			<section class="card basalt-box hcr-card" aria-labelledby="hcr-life">
				<header class="hcr-card-head"><div><h3 id="hcr-life" class="hcr-panel-title">Her life in the record</h3><p class="hcr-sub">A dot per event; pick a kind below to see only those.</p></div></header>
				<div data-hcr-life class="hcr-life"></div>
			</section>
			<section class="card basalt-box hcr-card" aria-labelledby="hcr-places">
				<header class="hcr-card-head"><div><h3 id="hcr-places" class="hcr-panel-title">Where her records come from</h3><p class="hcr-sub">Pick a place to see only what came from it.</p></div></header>
				<ul data-hcr-places class="hcr-places"></ul>
				<p data-hcr-waiting class="hcr-waiting"></p>
			</section>
			<section class="card basalt-box hcr-card" aria-labelledby="hcr-events">
				<header class="hcr-card-head"><div><h3 id="hcr-events" class="hcr-panel-title">Every event</h3><p data-hcr-events-count class="hcr-sub">Newest first.</p></div><div role="group" aria-label="Show" class="hcr-chips">${[
					'all',
					...Object.keys(KINDS),
				]
					.map(
						(k) =>
							`<button type="button" class="hcr-chip" aria-pressed="${k === 'all'}" data-hcr-kind="${k}">${k === 'all' ? 'All' : KINDS[k].name}</button>`,
					)
					.join('')}</div></header>
				<ol data-hcr-events class="hcr-events"></ol>
			</section>`;
		paintHistory();
		host.addEventListener('click', (event) => {
			const kind = event.target.closest('[data-hcr-kind]');
			if (kind) {
				const pressed = kind.getAttribute('aria-pressed') === 'true';
				filterHistory(host, { kind: pressed && kind.dataset.hcrKind !== 'all' ? 'all' : kind.dataset.hcrKind });
			}
			const place = event.target.closest('[data-hcr-from]');
			if (place) {
				const pressed = place.getAttribute('aria-pressed') === 'true';
				filterHistory(host, { place: pressed ? 'all' : place.dataset.hcrFrom });
			}
			const dot = event.target.closest('[data-hcr-dot]');
			if (dot) {
				const row = pick(`[data-hcr-row="${dot.dataset.hcrDot}"]`, host);
				if (row.hidden) filterHistory(host, { kind: 'all', place: 'all' });
				row.scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'center' });
				row.classList.remove('is-found');
				void row.offsetWidth;
				row.classList.add('is-found');
			}
		});
	}

	/** Narrows the strip, the place cards and the list to one kind, one place, or both. */
	function filterHistory(host, change) {
		Object.assign(historyShown, change);
		/* A pair with nothing in it (no visits from the imaging center) keeps
		   only the choice just made. */
		const fits = (e) =>
			(historyShown.kind === 'all' || e.kind === historyShown.kind) &&
			(historyShown.place === 'all' || e.place === historyShown.place);
		if (!record.history.some(fits)) historyShown['kind' in change ? 'place' : 'kind'] = 'all';
		const { kind, place } = historyShown;
		const shows = (e) => (kind === 'all' || e.kind === kind) && (place === 'all' || e.place === place);
		for (const button of pickAll('[data-hcr-kind]', host))
			button.setAttribute('aria-pressed', String(button.dataset.hcrKind === kind));
		for (const button of pickAll('[data-hcr-from]', host))
			button.setAttribute('aria-pressed', String(button.dataset.hcrFrom === place));
		for (const dot of pickAll('[data-hcr-dot]', host))
			dot.classList.toggle('is-faded', !shows(record.history[dot.dataset.hcrDot]));
		for (const row of pickAll('[data-hcr-row]', host)) row.hidden = !shows(record.history[row.dataset.hcrRow]);
		const left = pickAll('[data-hcr-row]:not([hidden])', host).length;
		pick('[data-hcr-events-count]', host).textContent =
			kind === 'all' && place === 'all'
				? 'Newest first.'
				: `${left} ${left === 1 ? 'event' : 'events'}${place === 'all' ? '' : ` from ${record.places[place].name}`}, newest first.`;
	}

	function paintHistory() {
		const events = record.history;
		const first = Number(events.at(-1).on.slice(0, 4));
		const last = Number(TODAY.slice(0, 4)) + 1;
		const x = (iso) =>
			((Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) - 1) / 12 - first) / (last - first)) * 100;
		const ticks = [];
		for (let y = first; y < last; y += 5) ticks.push(y);
		pick('[data-hcr-life]').innerHTML =
			`<div class="hcr-life-track">${ticks.map((y) => `<span class="hcr-life-year" style="left: ${x(`${y}-01-01`)}%">${y}</span>`).join('')}${events
				.map(
					(e, i) =>
						`<button type="button" class="hcr-life-dot" data-hcr-dot="${i}" style="left: ${x(e.on)}%; --tone: var(--basalt-series-${KINDS[e.kind].tone})" title="${htmlSafe(`${day(e.on)}: ${e.what}`)}" aria-label="${htmlSafe(`${day(e.on)}, ${e.what}`)}"></button>`,
				)
				.join('')}</div><ul class="hcr-life-key">${Object.entries(KINDS)
				.filter(([k]) => events.some((e) => e.kind === k))
				.map(
					([key, k]) =>
						`<li><button type="button" aria-pressed="${historyShown.kind === key}" class="hcr-key-button" data-hcr-kind="${key}"><i style="--tone: var(--basalt-series-${k.tone})"></i>${k.name}</button></li>`,
				)
				.join('')}</ul>`;
		const places = Object.entries(record.places);
		pick('[data-hcr-places]').innerHTML = places
			.filter(([, p]) => p.state !== 'requested')
			.map(([key, p]) => {
				const count = events.filter((e) => e.place === key).length;
				const state =
					p.state === 'us'
						? 'This clinic'
						: p.state === 'connected'
							? `Linked since ${p.since.slice(0, 4)}`
							: `Received in ${p.since.slice(0, 4)}`;
				return `<li><button type="button" aria-pressed="${historyShown.place === key}" class="hcr-place" data-hcr-from="${key}"><span class="hcr-place-mark" aria-hidden="true"><i class="bi ${p.state === 'us' ? 'bi-hospital' : 'bi-link-45deg'}"></i></span><span class="hcr-place-text"><b>${p.name}</b><span>${state} · ${count} ${count === 1 ? 'event' : 'events'}</span></span></button></li>`;
			})
			.join('');
		/* A place that has been asked but not answered has nothing to show yet. */
		const waiting = places.filter(([, p]) => p.state === 'requested');
		pick('[data-hcr-waiting]').innerHTML = waiting.length
			? `<i class="bi bi-hourglass-split" aria-hidden="true"></i>Waiting on ${waiting.map(([, p]) => `<b>${p.name}</b>, asked ${shortDay(p.since)}`).join('; ')}.`
			: '';
		pick('[data-hcr-events]').innerHTML = events
			.map((e, i) => {
				const k = KINDS[e.kind];
				const place = record.places[e.place];
				const link = e.kind === 'lab' ? '#labs' : e.kind === 'imaging' ? '#imaging' : '';
				return `<li class="hcr-event" data-hcr-event="${e.kind}" data-hcr-row="${i}" style="--tone: var(--basalt-series-${k.tone})"><span class="hcr-event-when">${shortDay(e.on)}</span><span class="hcr-event-dot" aria-hidden="true"><i class="bi ${k.icon}"></i></span><div class="hcr-event-body"><p class="hcr-event-what">${link ? `<a href="${link}" data-hcr-tab-link="${link.slice(1)}">${e.what}</a>` : e.what}</p><p class="hcr-sub">${e.note}</p></div><span class="hcr-event-meta">${e.by ? who(e.by) : ''}${place.state === 'us' ? '' : `<span class="hcr-source"><i class="bi bi-link-45deg" aria-hidden="true"></i>${place.name}</span>`}</span></li>`;
			})
			.join('');
		filterHistory(pane('history'), {});
		for (const a of pickAll('[data-hcr-tab-link]')) {
			a.addEventListener('click', (event) => {
				event.preventDefault();
				showTab(a.dataset.hcrTabLink);
			});
		}
	}

	/* Request records from a place she has been seen at. */
	function wireRecordRequest() {
		const form = pick('[data-hcr-request]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const name = pick('[data-hcr-req-place]', form).value.trim();
			const what = pickAll('[data-hcr-req-what]:checked', form).map((b) => b.value);
			const key = name.toLowerCase().replace(/[^a-z]+/g, '-');
			record.places[key] = { name, state: 'requested', since: TODAY };
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			if (pick('[data-hcr-places]')) paintHistory();
			toast(
				'success',
				'Records requested',
				`${name} has been asked for ${what.length ? what.join(', ').toLowerCase() : 'her records'}. Replies usually take two to five days.`,
			);
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
		});
	}

	/* Header actions */

	/* Message her: the channel sets the address and, for a text, the length to watch. */
	function wireMessage() {
		const form = pick('[data-hcr-message]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		const body = pick('[data-hcr-msg-body]', form);
		const starts = pick('[data-hcr-msg-starts]', form);
		starts.innerHTML = MESSAGE_STARTS.map(
			(s, i) =>
				`<button type="button" class="hcr-chip" aria-pressed="false" data-hcr-msg-start="${i}">${s.name}</button>`,
		).join('');
		const by = () => pick('[name="hcr-msg-by"]:checked', form).value;
		const paint = () => {
			const c = record.contact;
			pick('[data-hcr-msg-to]', form).textContent =
				by() === 'text'
					? `To ${c.phone}`
					: by() === 'email'
						? `To ${c.email}`
						: 'To her inbox in the patient portal';
			const n = body.value.length;
			pick('[data-hcr-msg-count]', form).textContent =
				by() === 'text'
					? `${n} characters · ${Math.max(1, Math.ceil(n / 160))} text${n > 160 ? 's' : ''}`
					: `${n} characters`;
		};
		form.addEventListener('change', paint);
		body.addEventListener('input', paint);
		starts.addEventListener('click', (event) => {
			const chip = event.target.closest('[data-hcr-msg-start]');
			if (!chip) return;
			for (const c of pickAll('[data-hcr-msg-start]', starts)) c.setAttribute('aria-pressed', String(c === chip));
			body.value = MESSAGE_STARTS[chip.dataset.hcrMsgStart].body;
			body.focus();
			paint();
		});
		modal.addEventListener('show.bs.modal', () => {
			pick(
				`[name="hcr-msg-by"][value="${record.contact.prefers === 'call' ? 'text' : record.contact.prefers}"]`,
				form,
			).checked = true;
			paint();
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const words = { text: 'by text', email: 'by email', portal: 'to her portal inbox' }[by()];
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			toast('success', 'Message sent', `Sent to Rhiannon ${words}. Her reply will show in Messages.`);
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
			for (const c of pickAll('[data-hcr-msg-start]', starts)) c.setAttribute('aria-pressed', 'false');
		});
	}

	/* Refer: the department picks the specialists; her record goes along. */
	function wireRefer() {
		const form = pick('[data-hcr-refer]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		const dept = pick('[data-hcr-ref-dept]', form);
		const why = pick('[data-hcr-ref-why]', form);
		const depts = clinic.departments.filter((d) => d.key !== 'gp');
		dept.innerHTML = depts.map((d) => `<option value="${d.key}">${d.name}</option>`).join('');
		const lastLab = record.panels[0].tests[0].results.at(-1)[0];
		pick('[data-hcr-ref-send]', form).innerHTML = [
			[`Lab results, last ${shortDay(lastLab)}`, true],
			['Imaging and reports', true],
			['Medicines and allergies', true],
			['Visit notes', false],
		]
			.map(
				([name, on]) =>
					`<label class="form-check"><input data-hcr-ref-item type="checkbox" value="${name}" class="form-check-input"${on ? ' checked' : ''}><span class="form-check-label">${name}</span></label>`,
			)
			.join('');
		const paint = () => {
			const d = depts.find((x) => x.key === dept.value);
			const soon = pick('[name="hcr-ref-when"]:checked', form).value;
			pick('[data-hcr-ref-who]', form).innerHTML = d.staff
				.map((id, i) => {
					const p = clinic.providers.find((x) => x.id === id);
					const wait = Math.max(
						1,
						Math.round((d.wait + i * 4) / (soon === 'urgent' ? 6 : soon === 'soon' ? 2 : 1)),
					);
					return `<label class="hcr-pick"><input type="radio" name="hcr-ref-who" value="${id}" class="form-check-input"${i === 0 ? ' checked' : ''}><span class="hcr-pick-text"><b>${p.name}</b><span>${p.role}</span></span><span class="hcr-pick-side">Seen in ${wait} ${wait === 1 ? 'day' : 'days'}</span></label>`;
				})
				.join('');
			if (!why.dataset.typed) why.value = REFER_REASONS[d.key] || '';
		};
		dept.addEventListener('change', paint);
		form.addEventListener('change', (event) => {
			if (event.target.name === 'hcr-ref-when') paint();
		});
		why.addEventListener('input', () => {
			why.dataset.typed = 'yes';
		});
		modal.addEventListener('show.bs.modal', () => {
			dept.value = 'ortho';
			delete why.dataset.typed;
			paint();
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const p = clinic.providers.find((x) => x.id === pick('[name="hcr-ref-who"]:checked', form).value);
			const items = pickAll('[data-hcr-ref-item]:checked', form).length;
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			toast(
				'success',
				'Referral sent',
				`${p.name} has Rhiannon's referral${items ? ` and ${items} part${items === 1 ? '' : 's'} of her record` : ''}. Rhiannon gets a text when it is booked.`,
			);
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
		});
	}

	/* Schedule surgery: the operation, a theater opening, then the checks
	   her record calls for before the day. */
	function wireSurgery() {
		const form = pick('[data-hcr-surgery]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		const ops = record.procedures;
		const op = () => ops.find((o) => o.id === pick('[name="hcr-op"]:checked', form).value);
		pick('[data-hcr-op-list]', form).innerHTML = ops
			.map((o, i) => {
				const scan = o.because && record.imaging.find((s) => s.id === o.because);
				return `<label class="hcr-pick"><input type="radio" name="hcr-op" value="${o.id}" class="form-check-input"${i === 0 ? ' checked' : ''}><span class="hcr-pick-text"><b>${o.name}</b><span>${o.part} · ${who(o.surgeon)} · ${o.minutes} min · ${o.sleep}</span>${scan ? `<span class="hcr-pick-why"><i class="bi bi-images" aria-hidden="true"></i>${scan.name} ${shortDay(scan.on)}: ${scan.report}</span>` : ''}</span><span class="hcr-pick-side">Home ${o.home.charAt(0).toLowerCase()}${o.home.slice(1)}</span></label>`;
			})
			.join('');
		pick('[data-hcr-op-slots]', form).innerHTML = record.theater
			.map(
				(s, i) =>
					`<label class="hc-bk-slot"><input type="radio" name="hcr-op-slot" value="${i}" class="visually-hidden"${i === 0 ? ' checked' : ''}><span class="hc-bk-slot-day">${shortDay(s.on)}</span><span class="hc-bk-slot-time">${clock(s.at)}</span><span class="hc-bk-slot-who">${s.room}</span></label>`,
			)
			.join('');
		const paint = () => {
			const o = op();
			pick('[data-hcr-op-length]', form).textContent =
				`${who(o.surgeon)} holds the room ${o.minutes + 30} minutes, cleaning included.`;
			pick('[data-hcr-op-checks]', form).innerHTML = surgeryChecks(o)
				.map(
					(c) =>
						`<li class="hcr-check is-${c.level}"><i class="bi ${c.level === 'ok' ? 'bi-check2-circle' : 'bi-exclamation-triangle'}" aria-hidden="true"></i>${c.text}</li>`,
				)
				.join('');
		};
		form.addEventListener('change', paint);
		modal.addEventListener('show.bs.modal', paint);
		const consent = pick('[data-hcr-op-consent]', form);
		consent.addEventListener('change', () => consent.classList.toggle('is-invalid', !consent.checked));
		form.addEventListener('basalt:steps-done', () => {
			/* The last step is not checked by the stepper, so consent is checked here. */
			if (!consent.checked) {
				consent.classList.add('is-invalid');
				consent.focus();
				return;
			}
			const o = op();
			const slot = record.theater[pick('[name="hcr-op-slot"]:checked', form).value];
			const texted = pick('[data-hcr-op-text]', form).checked;
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			toast(
				'success',
				'Surgery booked',
				`${o.name}, ${day(slot.on)} at ${clock(slot.at)} in ${slot.room} with ${who(o.surgeon)}.${texted ? ' Rhiannon has her instructions by text.' : ''}`,
			);
		});
		modal.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
			consent.classList.remove('is-invalid');
			form.basaltSteps?.reset();
		});
	}

	/** What her record asks for before an operation: allergies, medicines, genes and labs. */
	function surgeryChecks(o) {
		const checks = [];
		const taking = (id) => record.medications.some((m) => m.id === id && m.steps.at(-1).to === null);
		checks.push({ level: 'warn', text: 'Allergic to latex: the OR is set up latex-free.' });
		checks.push({
			level: 'warn',
			text: 'Allergic to penicillin: the antibiotic before surgery is not penicillin-based.',
		});
		if (taking('naproxen') && o.sleep !== 'Local')
			checks.push({ level: 'warn', text: 'Takes naproxen: stop it 7 days before, it thins the blood.' });
		if (o.sleep !== 'Local')
			checks.push({ level: 'ok', text: 'Nothing to eat for 8 hours before; water until 2 hours before.' });
		const factor = record.genetics.find((g) => g.gene === 'Factor V Leiden');
		if (factor)
			checks.push({
				level: 'ok',
				text: `Factor V Leiden ${factor.result.toLowerCase()}: usual clot prevention.`,
			});
		const drawn = record.panels[0].tests[0].results.at(-1)[0];
		const age = Math.round((Date.parse(TODAY) - Date.parse(drawn)) / 864e5);
		checks.push(
			age <= 30
				? { level: 'ok', text: `Blood tests from ${shortDay(drawn)} are recent enough.` }
				: { level: 'warn', text: `Blood tests are ${age} days old: order new ones.` },
		);
		return checks;
	}

	/* Edit her details: the header phone and every message address follow. */
	function wireDetails() {
		const form = pick('[data-hcr-details]', document);
		if (!form || !window.bootstrap) return;
		const modal = form.closest('.modal');
		const c = record.contact;
		const fields = {
			'hcr-det-phone': ['phone'],
			'hcr-det-email': ['email'],
			'hcr-det-address': ['address'],
			'hcr-det-language': ['language'],
			'hcr-det-em-name': ['emergency', 'name'],
			'hcr-det-em-relation': ['emergency', 'relation'],
			'hcr-det-em-phone': ['emergency', 'phone'],
		};
		const at = (path) => path.reduce((o, k) => o[k], c);
		modal.addEventListener('show.bs.modal', () => {
			for (const [id, path] of Object.entries(fields)) pick(`#${id}`, form).value = at(path);
			pick(`[name="hcr-det-prefers"][value="${c.prefers}"]`, form).checked = true;
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.add('was-validated');
			if (!form.checkValidity()) return;
			const changed = [];
			for (const [id, path] of Object.entries(fields)) {
				const value = pick(`#${id}`, form).value.trim();
				const holder = path.length > 1 ? c[path[0]] : c;
				if (holder[path.at(-1)] !== value)
					changed.push(
						path.length > 1
							? 'emergency contact'
							: pick(`label[for="${id}"]`, form).textContent.toLowerCase(),
					);
				holder[path.at(-1)] = value;
			}
			const prefers = pick('[name="hcr-det-prefers"]:checked', form).value;
			if (prefers !== c.prefers) changed.push('best way to reach her');
			c.prefers = prefers;
			paintContact();
			window.bootstrap.Modal.getOrCreateInstance(modal).hide();
			toast(
				'success',
				changed.length ? 'Details saved' : 'Nothing changed',
				changed.length ? `Updated ${[...new Set(changed)].join(', ')}.` : 'Her details are as they were.',
			);
		});
		modal.addEventListener('hidden.bs.modal', () => form.classList.remove('was-validated'));
	}

	/* Family and genetics */

	function drawFamily() {
		const host = pane('family');
		if (!host) return;
		const fam = record.family;
		const runs = Object.entries(record.conditions)
			.map(([key, c]) => ({ key, ...c, people: fam.filter((f) => !f.self && f.conditions.includes(key)) }))
			.filter((c) => c.people.length);
		const a1c = record.test('a1c').test;
		host.innerHTML = `
			<header class="hcr-head">
				<div><h2 class="hcr-title">Family and genetics</h2><p class="hcr-sub">Three generations, and the genes tested because of them.</p></div>
			</header>
			<div class="hcr-pair hcr-pair-wide">
				<section class="card basalt-box hcr-card" aria-labelledby="hcr-tree">
					<header class="hcr-card-head"><div><h3 id="hcr-tree" class="hcr-panel-title">Family tree</h3><p class="hcr-sub">Squares are men, circles women; a slash means died.</p></div></header>
					<div class="hcr-tree">${familyTree(fam)}</div>
					<p data-hcr-tree-read class="hcr-tree-read" aria-live="polite">Point at someone to read about them.</p>
					<ul class="hcr-life-key">${Object.values(record.conditions)
						.map((c) => `<li><i style="--tone: var(--basalt-series-${c.tone})"></i>${c.name}</li>`)
						.join('')}</ul>
				</section>
				<div class="hcr-stack">
				<section class="card basalt-box hcr-card" aria-labelledby="hcr-runs">
					<header class="hcr-card-head"><div><h3 id="hcr-runs" class="hcr-panel-title">What runs in the family</h3><p class="hcr-sub">And what it means for her.</p></div></header>
					<ul class="hcr-runs">${runs
						.map((c) => {
							const note = {
								cancer: 'BRCA tested in 2024: no harmful change.',
								sugar: `Her HbA1c is ${latest(a1c)[1]}%, just above range. <a href="#labs/a1c" data-hcr-open-test="a1c">See the trend</a>`,
								heart: 'She is treated for high blood pressure.',
								lungs: 'She and her son have asthma.',
							}[c.key];
							return `<li style="--tone: var(--basalt-series-${c.tone})"><span class="hcr-runs-mark" aria-hidden="true"></span><div><b>${c.name}</b><span>${c.people.map((p) => p.relation.toLowerCase()).join(', ')}</span><span class="hcr-sub">${note}</span></div></li>`;
						})
						.join('')}</ul>
				</section>
				<section class="card basalt-box hcr-card" aria-labelledby="hcr-genes">
					<header class="hcr-card-head"><div><h3 id="hcr-genes" class="hcr-panel-title">Genetic results</h3><p class="hcr-sub">Tested ${day(record.genetics[0].on)}; Prescribe checks these.</p></div><a href="imaging-and-reports.html#genetics" class="btn btn-outline-secondary btn-sm"><i class="bi bi-file-earmark-text me-1" aria-hidden="true"></i>Lab report</a></header>
					<ul class="hcr-genes">${record.genetics
						.map(
							(g) =>
								`<li class="is-${g.state}"><div><b>${g.gene}</b><span class="hcr-gene-result">${g.result}</span></div><p>${g.why}</p></li>`,
						)
						.join('')}</ul>
				</section>
				</div>
			</div>`;
		const read = pick('[data-hcr-tree-read]', host);
		host.addEventListener('pointerover', (event) => {
			const person = event.target.closest('[data-hcr-person]');
			if (!person) return;
			const p = fam.find((f) => f.id === person.dataset.hcrPerson);
			read.innerHTML = `<b>${p.name}</b>, ${p.relation.toLowerCase()}, ${p.died ? `died at ${p.age}` : `${p.age}`} · ${p.note}`;
		});
		host.addEventListener('click', (event) => {
			const open = event.target.closest('[data-hcr-open-test]');
			if (!open) return;
			event.preventDefault();
			showTab('labs');
			openTest(open.dataset.hcrOpenTest);
		});
	}

	/** The tree: grandparents, parents, her generation, her children. */
	function familyTree(fam) {
		const spots = {
			gf: [150, 40],
			gm: [250, 40],
			dad: [200, 130],
			mum: [320, 130],
			bro: [170, 230],
			me: [260, 230],
			sis: [350, 230],
			son: [220, 330],
			girl: [300, 330],
		};
		const r = 22;
		const person = (p) => {
			const [cx, cy] = spots[p.id];
			const tones = p.conditions.map((c) => record.conditions[c].tone);
			const clip = `hcr-clip-${p.id}`;
			const shape =
				p.sex === 'm'
					? `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="5"/>`
					: `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
			const fills = tones
				.map((t, i) => {
					const w = (r * 2) / tones.length;
					return `<rect x="${cx - r + i * w}" y="${cy - r}" width="${w}" height="${r * 2}" fill="var(--basalt-series-${t})"/>`;
				})
				.join('');
			return `<g class="hcr-person${p.self ? ' is-self' : ''}${p.died ? ' is-gone' : ''}" data-hcr-person="${p.id}" tabindex="0" aria-label="${htmlSafe(`${p.name}, ${p.relation}, ${p.note}`)}"><clipPath id="${clip}">${shape}</clipPath><g clip-path="url(#${clip})"><rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" class="hcr-person-fill"/>${fills}</g>${shape.replace('/>', ' class="hcr-person-edge"/>')}${p.died ? `<line x1="${cx - r - 4}" y1="${cy + r + 4}" x2="${cx + r + 4}" y2="${cy - r - 4}" class="hcr-person-gone"/>` : ''}<text x="${cx}" y="${cy + r + 16}" class="hcr-person-name">${p.name}</text><text x="${cx}" y="${cy + r + 29}" class="hcr-person-rel">${p.self ? 'Her' : p.relation}</text>${p.self ? `<path d="M${cx - r - 18} ${cy + 14} l12 -8 l-3 9 z" class="hcr-person-arrow"/>` : ''}</g>`;
		};
		const line = (d) => `<path d="${d}" class="hcr-tree-line"/>`;
		const lines = [
			line('M172 40 H228'),
			line('M200 40 V108'),
			line('M222 130 H298'),
			line('M260 130 V190 M170 190 H350 M170 190 V208 M260 190 V208 M350 190 V208'),
			line('M260 252 V292 M220 292 H300 M220 292 V308 M300 292 V308'),
		].join('');
		return `<svg viewBox="100 0 300 380" role="img" aria-label="Family tree">${lines}${fam.map(person).join('')}</svg>`;
	}

	/* Insurance */

	function drawInsurance() {
		const host = pane('insurance');
		if (!host) return;
		const ins = record.insurance;
		const meter = (label, [used, of]) =>
			`<div class="hcr-meter"><div class="hcr-meter-head"><span>${label}</span><b>${money(used)} <small>of ${money(of)}</small></b></div><span class="hcr-meter-bar"><span style="--w: ${Math.round((used / of) * 100)}%"></span></span><span class="hcr-sub">${money(of - used)} to go this year</span></div>`;
		host.innerHTML = `
			<header class="hcr-head">
				<div><h2 class="hcr-title">Insurance</h2><p class="hcr-sub">Her plan, what she has spent this year, and her claims.</p></div>
				<div class="hcr-head-actions"><button type="button" class="btn btn-outline-secondary btn-sm" data-hcr-eligible><i class="bi bi-patch-check me-1" aria-hidden="true"></i>Check cover</button></div>
			</header>
			<div class="hcr-pair">
				<section class="card basalt-box hcr-card hcr-plan" aria-label="Insurance card">
					<div class="hcr-plan-card">
						<p class="hcr-plan-name">${ins.plan}</p>
						<p class="hcr-plan-tier">${ins.tier}</p>
						<dl class="hcr-plan-facts"><div><dt>Member</dt><dd>${ins.member}</dd></div><div><dt>Group</dt><dd>${ins.group}</dd></div><div><dt>Holder</dt><dd>${ins.holder}</dd></div><div><dt>Valid until</dt><dd>${day(ins.until)}</dd></div></dl>
					</div>
					<dl class="hcr-plan-terms"><div><dt>Copay</dt><dd>${money(ins.copay)} a visit</dd></div><div><dt>Covers</dt><dd>${Math.round(ins.covers * 100)}% after the deductible</dd></div></dl>
				</section>
				<section class="card basalt-box hcr-card" aria-labelledby="hcr-spend">
					<header class="hcr-card-head"><div><h3 id="hcr-spend" class="hcr-panel-title">This year so far</h3><p class="hcr-sub">Resets on January 1.</p></div></header>
					${meter('Deductible', ins.deductible)}
					${meter('Out-of-pocket limit', ins.outOfPocket)}
				</section>
			</div>
			<section class="card basalt-box hcr-card" aria-labelledby="hcr-claims">
				<header class="hcr-card-head"><div><h3 id="hcr-claims" class="hcr-panel-title">Her claims</h3><p class="hcr-sub">Newest first.</p></div></header>
				<table class="table hcr-table"><thead><tr><th scope="col">Claim</th><th scope="col">Date</th><th scope="col" class="d-none d-sm-table-cell">For</th><th scope="col" class="text-end d-none d-sm-table-cell">Billed</th><th scope="col" class="text-end">Paid</th><th scope="col">State</th></tr></thead><tbody>${ins.claims
					.map(
						(c) =>
							`<tr><td>${c.id}</td><td>${shortDay(c.on)}</td><td class="d-none d-sm-table-cell">${c.what}</td><td class="text-end d-none d-sm-table-cell">${money(c.billed)}</td><td class="text-end">${c.paid ? money(c.paid) : '—'}</td><td><span class="hcr-flag${c.state === 'Paid' ? ' is-ok' : ''}">${c.state}</span></td></tr>`,
					)
					.join('')}</tbody></table>
			</section>`;
		pick('[data-hcr-eligible]', host).addEventListener('click', () =>
			toast('success', 'Covered', `${ins.plan} is active until ${day(ins.until)}. Copay ${money(ins.copay)}.`),
		);
	}
})();
