/**
 * campaign-details.html, the page carrying [data-cd-root]: one marketing
 * campaign end to end. It shows spend against budget, the pipeline and
 * customers the campaign produced month by month, where its leads came
 * from, which landing-page headline won, the customers it brought in and
 * its settings, which are edited here one section at a time.
 *
 * The record is "Scheduling benchmark report" from marketing-insights.html,
 * with the same spend, pipeline and customers that its row and quick view
 * show for the last twelve months.
 *
 * Connecting real data:
 *   - the campaign list links here as campaign-details.html?id=<id>. Read
 *     that id and let backend.load() fetch the campaign; the demo always
 *     answers with the single record in FIXTURE.
 *   - backend.save() stores the settings and backend.setStatus() handles
 *     pause, resume and end. Every number on the page is derived from what
 *     load() returns; none of it is written into the markup.
 *
 * Uses the shared basalt.js parts (segmented controls, styled selects,
 * toasts and the live region). The chart follows the recipe from the chart
 * pages and is redrawn on basalt:appearance.
 */
(() => {
	'use strict';

	const campaignPage = pick('[data-cd-root]');
	if (!campaignPage) return;

	/* Demo data, to be replaced by your own.
       today        the demo's current day.
       figuresTo    the last day the monthly figures reach.
       months       a row per month: spend, leads, sqls (sales-qualified),
                    opps (opportunities), won (new customers), pipeline,
                    and arr, the yearly value of what was won.
       budget       covers the budget year, which closes on budgetEnd.
       sources      lead sources; their leads and won match the month totals.
       messages     landing-page headlines tested against one another.
       customers    the newest customers won; moreCount and moreValue cover
                    the rest so that the yearly value adds up. */
	const FIXTURE = {
		today: '2026-10-09',
		figuresTo: '2026-09-30',
		owners: ['Larry Barlow', 'Connie Reese', 'Hope Stout', 'Allie Boyle', 'Randall Farley', 'Tom Whitaker'],
		industries: [
			{ id: 'homecare', name: 'Home care' },
			{ id: 'petcare', name: 'Pet care' },
			{ id: 'photography', name: 'Photography' },
			{ id: 'moving', name: 'Movers' },
			{ id: 'property', name: 'Property care' },
			{ id: 'cleaning', name: 'Cleaning' },
		],
		sizes: [
			{ id: 'any', name: 'Any size' },
			{ id: '5-50', name: '5 to 50 team members' },
			{ id: '5-200', name: '5 to 200 team members' },
			{ id: '50-500', name: '50 to 500 team members' },
		],
		regions: [
			{ id: 'northeast', name: 'Northeast' },
			{ id: 'midwest', name: 'Midwest' },
			{ id: 'west', name: 'West' },
			{ id: 'south', name: 'South' },
		],
		plans: {
			starter: { name: 'Basic', tone: 2 },
			growth: { name: 'Pro', tone: 1 },
			enterprise: { name: 'Max', tone: 5 },
		},
		grossMargin: 0.8,
		paybackTarget: 15,
		campaign: {
			id: 'cmp-108',
			name: 'Scheduling benchmark report',
			about: 'Yearly report on how 600 on-site businesses book visits, schedule and get paid. Free with an email address.',
			channel: { name: 'Content and SEO', tone: 3 },
			owner: 'Larry Barlow',
			status: 'live',
			start: '2026-03-09',
			end: null,
			budget: 48000,
			budgetEnd: '2026-12-31',
			goal: 400000,
			industries: ['homecare', 'petcare', 'photography'],
			size: '5-200',
			regions: ['midwest', 'west'],
			landing: 'fieldline.app/benchmark',
			months: [
				{ m: '2026-03', spend: 3883, leads: 242, sqls: 29, opps: 11, won: 2, pipeline: 37675, arr: 5912 },
				{ m: '2026-04', spend: 4945, leads: 296, sqls: 35, opps: 13, won: 2, pipeline: 47556, arr: 13158 },
				{ m: '2026-05', spend: 4959, leads: 289, sqls: 33, opps: 12, won: 3, pipeline: 36342, arr: 6858 },
				{ m: '2026-06', spend: 4829, leads: 255, sqls: 29, opps: 11, won: 2, pipeline: 34128, arr: 5886 },
				{ m: '2026-07', spend: 5128, leads: 255, sqls: 30, opps: 11, won: 2, pipeline: 32400, arr: 6372 },
				{ m: '2026-08', spend: 5092, leads: 261, sqls: 31, opps: 12, won: 2, pipeline: 45342, arr: 7614 },
				{ m: '2026-09', spend: 5033, leads: 313, sqls: 35, opps: 13, won: 3, pipeline: 48042, arr: 6858 },
			],
			sources: [
				{ name: 'Organic search', leads: 742, won: 6 },
				{ name: 'Email newsletter', leads: 486, won: 4 },
				{ name: 'LinkedIn posts', leads: 318, won: 2 },
				{ name: 'Partner newsletters', leads: 221, won: 3 },
				{ name: 'Webinar mentions', leads: 144, won: 1 },
			],
			messages: [
				{
					text: 'How 600 on-site businesses schedule their week',
					visitors: 10551,
					downloads: 1034,
					main: true,
				},
				{ text: 'Your staff lose two hours a day. Here is where.', visitors: 7211, downloads: 512 },
				{ text: 'The 2026 home services benchmark', visitors: 7935, downloads: 365 },
			],
			customers: [
				{
					name: 'Fernhill Architects',
					city: 'Minot, ND',
					plan: 'growth',
					seats: 12,
					source: 'Organic search',
					joined: '2026-09-28',
					arr: 4608,
				},
				{
					name: 'Bayview Studios',
					city: 'San Diego, CA',
					plan: 'starter',
					seats: 8,
					source: 'Email newsletter',
					joined: '2026-09-22',
					arr: 1440,
				},
				{
					name: 'Ashgrove Photography',
					city: 'Duluth, MN',
					plan: 'growth',
					seats: 14,
					source: 'Partner newsletters',
					joined: '2026-09-09',
					arr: 5376,
				},
				{
					name: 'Copperline Labs',
					city: 'Boulder, CO',
					plan: 'growth',
					seats: 9,
					source: 'Organic search',
					joined: '2026-08-25',
					arr: 3456,
				},
				{
					name: 'Saltmarsh Goods',
					city: 'Minot, ND',
					plan: 'starter',
					seats: 6,
					source: 'LinkedIn posts',
					joined: '2026-08-12',
					arr: 1080,
				},
			],
			moreCount: 11,
			moreValue: 36698,
			activity: [
				{
					at: '2026-09-30',
					who: 'Larry Barlow',
					icon: 'bi-type',
					text: 'made “How 600 on-site businesses schedule their week” the main headline',
				},
				{
					at: '2026-06-02',
					who: 'John Armstrong',
					icon: 'bi-wallet2',
					text: 'raised the budget from $40,000 to $48,000',
				},
				{
					at: '2026-05-18',
					who: 'Connie Reese',
					icon: 'bi-diagram-3',
					text: 'added partner newsletters as a source',
				},
				{ at: '2026-03-09', who: 'Larry Barlow', icon: 'bi-rocket-takeoff', text: 'launched the campaign' },
				{ at: '2026-02-24', who: 'Larry Barlow', icon: 'bi-plus-circle', text: 'created the campaign' },
			],
		},
	};
	const CURRENT_USER = 'John Armstrong';
	const NOW_DAY = FIXTURE.today;
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	const STATUS_LOOK = {
		live: { name: 'Live', tone: 'success' },
		paused: { name: 'Paused', tone: 'warning' },
		ended: { name: 'Ended', tone: '' },
	};
	const STATUS_ICON = { live: 'bi-play-circle', paused: 'bi-pause-circle', ended: 'bi-stop-circle' };
	const STATUS_TOAST = { live: 'Campaign resumed', paused: 'Campaign paused', ended: 'Campaign ended' };

	/* The two series each chart view plots, so the key and the chart agree. */
	const CHART_VIEWS = {
		money: { a: { label: 'Spend', tone: 8 }, b: { label: 'Pipeline', tone: 1 } },
		people: { a: { label: 'Leads', tone: 3 }, b: { label: 'New customers', tone: 5 } },
	};

	const CONFIRM_COPY = {
		pause: {
			icon: 'bi-pause-circle',
			tone: 'warning',
			title: 'Pause this campaign?',
			btn: 'Pause',
			cls: 'btn-primary',
			text: 'Promotion stops today and nothing more is spent. The report stays up, and you can resume at any time.',
		},
		end: {
			icon: 'bi-stop-circle',
			tone: '',
			title: 'End this campaign?',
			btn: 'End campaign',
			cls: 'btn-danger',
			text: 'It stops today for good and the rest of the budget is freed. Its figures and customers stay on this page.',
		},
	};

	/* Where your server plugs in. Every call returns a Promise and the demo
     answers from memory; keep the shapes when fetch() takes over.
       load       GET   /api/campaigns/:id
       save       PATCH /api/campaigns/:id { name, about, owner, end, budget, goal, industries, size, regions }
       setStatus  POST  /api/campaigns/:id/status { status: 'live' | 'paused' | 'ended' } */
	const backend = {
		load() {
			return Promise.resolve(FIXTURE.campaign);
		},
		save(changes) {
			return later(350, changes);
		},
		setStatus(status) {
			return later(300, status);
		},
	};

	/* The loaded record, the chart's current view and instance, and the
     action waiting in the confirm dialog. */
	let campaign = null;
	let chartView = 'money';
	let monthsChart = null;
	let awaiting = null;

	const toggleRunBtn = pick('[data-cd-primary]', campaignPage);
	const settingsForm = pick('[data-cd-form]', campaignPage);
	const factsList = pick('[data-cd="facts"]', campaignPage);
	const editButton = pick('[data-cd-edit]', campaignPage);
	const confirmDialog = pick('#cd-confirm');

	function start() {
		wireSettings();
		wireStatus();
		wireMenu();
		wireChartSwitch();
		backend.load().then((record) => {
			campaign = record;
			drawAll(true);
		});
	}

	function wireSettings() {
		editButton.addEventListener('click', () => toggleEditing(true));
		pick('[data-cd-cancel]', settingsForm).addEventListener('click', () => {
			toggleEditing(false);
			editButton.focus();
		});
		settingsForm.addEventListener('submit', onSettingsSubmit);
	}

	function wireStatus() {
		pick('[data-cd-confirm-go]', confirmDialog).addEventListener('click', () => {
			const confirmed = awaiting;
			bootstrap.Modal.getOrCreateInstance(confirmDialog).hide();
			if (confirmed === 'pause') applyStatus('paused', 'paused');
			if (confirmed === 'end') applyStatus('ended', 'ended');
		});
		toggleRunBtn.addEventListener('click', () => {
			if (campaign.status === 'paused') applyStatus('live', 'resumed');
			else openConfirm('pause');
		});
	}

	function wireMenu() {
		const MENU_ACTIONS = {
			edit() {
				pick('.cd-card-settings', campaignPage).scrollIntoView({
					behavior: prefersStill() ? 'auto' : 'smooth',
					block: 'start',
				});
				toggleEditing(true);
			},
			export: downloadMonths,
			duplicate() {
				notify({
					tone: 'success',
					title: 'Copy saved as a draft',
					text: `“${campaign.name} (copy)” keeps these settings, with no spend or results.`,
				});
			},
			end() {
				openConfirm('end');
			},
		};
		pick('[data-cd="menu"]', campaignPage).addEventListener('click', (event) => {
			const choice = event.target.closest('[data-cd-act]');
			if (choice) MENU_ACTIONS[choice.dataset.cdAct]?.();
		});
	}

	function wireChartSwitch() {
		for (const radio of pickAll('input[name="cd-months"]', campaignPage)) {
			radio.addEventListener('change', () => {
				if (!radio.checked) return;
				chartView = radio.value;
				drawMonths(true);
			});
		}
		document.addEventListener('basalt:appearance', () => requestAnimationFrame(() => paintChart(false)));
	}

	/* DOM, text and number helpers. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}
	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}
	function speak(message) {
		window.Basalt.announce?.(message);
	}
	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}
	function later(ms, value) {
		return new Promise((settle) => setTimeout(() => settle(value), ms));
	}

	function escHtml(value) {
		const ENTITY = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(value == null ? '' : value).replace(/[&<>"']/g, (mark) => ENTITY[mark]);
	}

	/** A CSV field, quoted only when it holds a quote, comma or line break. */
	function csvField(value) {
		const plain = String(value == null ? '' : value);
		return /[",\r\n]/.test(plain) ? `"${plain.replace(/"/g, '""')}"` : plain;
	}

	function integer(value) {
		return Math.round(value).toLocaleString('en-US');
	}
	function usd(value) {
		return `$${integer(value)}`;
	}
	function percent(share) {
		return `${Math.round(share * 100)}%`;
	}

	/** $1.2M, $48k, $9.5k or $640, always positive. */
	function usdShort(value) {
		const magnitude = Math.abs(value);
		if (magnitude >= 1e6) return `$${(magnitude / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
		if (magnitude >= 1e3) return `$${(magnitude / 1e3).toFixed(magnitude >= 1e5 ? 0 : 1).replace(/\.0$/, '')}k`;
		return `$${Math.round(magnitude)}`;
	}

	function localDate(iso) {
		const [year, month, date] = iso.split('-').map(Number);
		return new Date(year, month - 1, date);
	}

	function shortDate(iso) {
		const when = localDate(iso);
		return `${MONTH_ABBR[when.getMonth()]} ${when.getDate()}`;
	}

	function longDate(iso) {
		return `${shortDate(iso)}, ${localDate(iso).getFullYear()}`;
	}
	function monthLabel(key, full) {
		return (full ? MONTH_FULL : MONTH_ABBR)[+key.slice(5, 7) - 1];
	}
	function dayGap(from, to) {
		return Math.round((localDate(to) - localDate(from)) / 86400000);
	}

	function tradeLabel(id) {
		return FIXTURE.industries.find((trade) => trade.id === id).name;
	}
	function regionLabel(id) {
		return FIXTURE.regions.find((region) => region.id === id).name;
	}
	function sizeLabel(id) {
		return FIXTURE.sizes.find((band) => band.id === id).name;
	}

	/** "a", "a and b" or "a, b and c". */
	function joinWords(words) {
		if (words.length < 2) return words.join('');
		return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
	}

	function channelBadge() {
		return `<span class="badge basalt-badge-as-dot basalt-badge-tone-${campaign.channel.tone}">${escHtml(campaign.channel.name)}</span>`;
	}

	/* Working out the figures. */

	/** Sums of every monthly column, plus cost per customer, pipeline per
      dollar and the payback period in months. */
	function sumUp() {
		const sums = { spend: 0, leads: 0, sqls: 0, opps: 0, won: 0, pipeline: 0, arr: 0 };
		for (const row of campaign.months) {
			for (const column of Object.keys(sums)) sums[column] += row[column];
		}
		sums.cac = sums.won ? sums.spend / sums.won : null;
		sums.roi = sums.spend ? sums.pipeline / sums.spend : null;
		sums.payback = sums.arr ? (12 * sums.spend) / (FIXTURE.grossMargin * sums.arr) : null;
		return sums;
	}

	/** Where spend is heading by the end of the budget year, or the end date
      when that comes first, at the pace of the last three months. */
	function spendPace(sums) {
		const stopDay = campaign.end && campaign.end < campaign.budgetEnd ? campaign.end : campaign.budgetEnd;
		const elapsedShare = Math.min(
			1,
			Math.max(0, dayGap(campaign.start, FIXTURE.figuresTo) / Math.max(1, dayGap(campaign.start, stopDay))),
		);
		const recentMonths = campaign.months.slice(-3);
		let recentSpend = 0;
		for (const row of recentMonths) recentSpend += row.spend;
		const perDay = recentSpend / dayGap(`${recentMonths[0].m}-01`, FIXTURE.figuresTo);
		const daysLeft = campaign.status === 'live' ? Math.max(0, dayGap(FIXTURE.figuresTo, stopDay)) : 0;
		const projected = sums.spend + perDay * daysLeft;
		return { elapsed: elapsedShare, projected, over: projected - campaign.budget, stop: stopDay };
	}

	/* Drawing every section. */

	function drawAll(animate) {
		const sums = sumUp();
		drawHeader();
		drawFigures(sums);
		drawMonths(animate);
		drawFunnel(sums);
		drawSources();
		drawHeadlines();
		drawCustomers(sums);
		drawSettings(sums);
		drawHistory();
	}

	function drawHeader() {
		const look = STATUS_LOOK[campaign.status];
		const ended = campaign.status === 'ended';
		const period = ended
			? `from ${longDate(campaign.start)} to ${longDate(campaign.end)}`
			: `since ${longDate(campaign.start)}`;
		pick('[data-cd="title"]', campaignPage).textContent = campaign.name;
		document.title = `${campaign.name} · Basalt`;
		pick('[data-cd="sub"]', campaignPage).textContent = `Run by ${campaign.owner} ${period}.`;
		pick('[data-cd="tags"]', campaignPage).innerHTML =
			`<span class="basalt-status basalt-status-dot${look.tone ? ` basalt-status-${look.tone}` : ''}">${look.name}</span>${channelBadge()}`;
		toggleRunBtn.hidden = ended;
		toggleRunBtn.innerHTML =
			campaign.status === 'paused'
				? '<i class="bi bi-play-fill me-1" aria-hidden="true"></i>Resume campaign'
				: '<i class="bi bi-pause-fill me-1" aria-hidden="true"></i>Pause campaign';
		const endItem = ended
			? ''
			: '<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item cd-danger-item" data-cd-act="end"><i class="bi bi-stop-circle" aria-hidden="true"></i>End campaign</button></li>';
		pick('[data-cd="menu"]', campaignPage).innerHTML =
			`<li><button type="button" class="dropdown-item" data-cd-act="edit"><i class="bi bi-pencil" aria-hidden="true"></i>Edit settings</button></li><li><button type="button" class="dropdown-item" data-cd-act="export"><i class="bi bi-download" aria-hidden="true"></i>Export CSV</button></li><li><button type="button" class="dropdown-item" data-cd-act="duplicate"><i class="bi bi-copy" aria-hidden="true"></i>Duplicate</button></li>${endItem}`;
	}

	/** The note under Spent: paused, ended, heading over, or on pace. */
	function paceNote(sums, pace) {
		if (campaign.status === 'paused') return '<span class="cd-fig-flag">Not spending while paused</span>';
		if (campaign.status === 'ended') return `${usd(campaign.budget - sums.spend)} left unspent`;
		if (pace.over > 0)
			return `<span class="cd-fig-flag cd-fig-flag-warn">Heading ${usdShort(pace.over)} over by ${shortDate(pace.stop)}</span>`;
		return 'On pace to stay within it';
	}

	function drawFigures(sums) {
		const pace = spendPace(sums);
		const spentShare = sums.spend / campaign.budget;
		const goalShare = sums.pipeline / campaign.goal;
		const peakWon = Math.max(...campaign.months.map((row) => row.won));
		const wonBars = `<div class="cd-minibars" role="img" aria-label="Customers won each month: ${campaign.months.map((row) => `${monthLabel(row.m)} ${row.won}`).join(', ')}">${campaign.months.map((row) => `<span style="--cd-h:${Math.round((row.won / peakWon) * 100)}%"></span>`).join('')}</div>`;
		const perDollar = sums.roi == null ? 'no spend yet' : `$${sums.roi.toFixed(2)} per $1 spent`;
		const payback = sums.payback == null ? 'Nothing won yet' : `Pays back in ${sums.payback.toFixed(1)} months`;
		pick('[data-cd="figs"]', campaignPage).innerHTML = [
			figureTile(
				1,
				'bi-wallet2',
				'Spent',
				usd(sums.spend),
				progressMeter(
					spentShare,
					pace.elapsed,
					`${percent(spentShare)} of the budget spent, ${percent(pace.elapsed)} of the time gone`,
				),
				`${percent(spentShare)} of ${usd(campaign.budget)}. ${paceNote(sums, pace)}`,
			),
			figureTile(
				2,
				'bi-graph-up-arrow',
				'Pipeline',
				usd(sums.pipeline),
				progressMeter(goalShare, null, `${percent(goalShare)} of the pipeline goal`),
				`${percent(goalShare)} of the ${usdShort(campaign.goal)} goal, ${perDollar}`,
			),
			figureTile(
				3,
				'bi-people',
				'New Customers',
				integer(sums.won),
				wonBars,
				sums.cac == null ? 'None won yet' : `${usd(sums.cac)} each to win`,
			),
			figureTile(
				4,
				'bi-arrow-repeat',
				'Yearly Value Won',
				usd(sums.arr),
				`<span class="cd-fig-big-note">${payback}</span>`,
				`Target ${FIXTURE.paybackTarget} months, after running costs`,
			),
		].join('');
	}

	function figureTile(position, icon, caption, value, picture, note) {
		return `<div class="cd-fig cd-fig-${position}"><dt class="cd-fig-label"><i class="bi ${icon}" aria-hidden="true"></i>${caption}</dt><dd class="cd-fig-value">${value}</dd><dd class="cd-fig-visual">${picture}</dd><dd class="cd-fig-note">${note}</dd></div>`;
	}

	/** A filled bar, with an optional tick marking how much time has gone. */
	function progressMeter(share, tickAt, label) {
		const timeTick =
			tickAt == null ? '' : `<span class="cd-meter-mark" style="--cd-at:${(tickAt * 100).toFixed(1)}%"></span>`;
		return `<div class="cd-meter" role="img" aria-label="${label}"><span class="cd-meter-bar" style="--cd-w:${Math.min(100, share * 100).toFixed(1)}%"></span>${timeTick}</div>`;
	}

	/* Results by month: the description, the key and the chart. */

	function drawMonths(animate) {
		const monthRows = campaign.months;
		const byMoney = chartView === 'money';
		const views = CHART_VIEWS[chartView];
		const upTo = shortDate(FIXTURE.figuresTo);
		if (byMoney) {
			const topPipeline = monthRows.reduce((kept, row) => (row.pipeline > kept.pipeline ? row : kept));
			pick('[data-cd="months-desc"]', campaignPage).textContent =
				`To ${upTo}. Best month ${monthLabel(topPipeline.m, true)}: ${usd(topPipeline.pipeline)} of pipeline from ${usd(topPipeline.spend)}.`;
		} else {
			const topLeads = monthRows.reduce((kept, row) => (row.leads > kept.leads ? row : kept));
			pick('[data-cd="months-desc"]', campaignPage).textContent =
				`To ${upTo}. Best month ${monthLabel(topLeads.m, true)}: ${integer(topLeads.leads)} leads and ${topLeads.won} new customers.`;
		}
		pick('[data-cd="months-key"]', campaignPage).innerHTML =
			`<li class="cd-c${views.a.tone}"><span class="cd-key-bar"></span>${views.a.label}</li><li class="cd-c${views.b.tone}"><span class="${byMoney ? 'cd-key-bar' : 'cd-key-line'}"></span>${views.b.label}</li>`;
		const describe = byMoney
			? `Spend and pipeline each month, ${monthRows.map((row) => `${monthLabel(row.m)} ${usdShort(row.spend)} and ${usdShort(row.pipeline)}`).join('; ')}`
			: `Leads and new customers each month, ${monthRows.map((row) => `${monthLabel(row.m)} ${row.leads} and ${row.won}`).join('; ')}`;
		pick('[data-cd-chart="months"]', campaignPage).setAttribute('aria-label', describe);
		paintChart(animate);
	}

	function paintChart(animate) {
		if (typeof Chart === 'undefined') return;
		const canvasEl = pick('[data-cd-chart="months"]', campaignPage);
		if (monthsChart) monthsChart.destroy();
		const hues = chartColors();
		const views = CHART_VIEWS[chartView];
		const byMoney = chartView === 'money';
		const firstColor = hues.series[views.a.tone - 1];
		const secondColor = hues.series[views.b.tone - 1];
		const monthRows = campaign.months;
		const tickStyle = { color: hues.quiet, font: { family: TYPEFACE, size: 11.5 }, padding: 8 };
		const barBase = {
			type: 'bar',
			barPercentage: 0.8,
			categoryPercentage: 0.66,
			maxBarThickness: 30,
			borderRadius: 6,
			borderSkipped: 'start',
			order: 2,
		};
		const sets = byMoney
			? [
					{
						...barBase,
						label: 'Spend',
						data: monthRows.map((row) => row.spend),
						backgroundColor: fadeFill(firstColor),
						hoverBackgroundColor: firstColor,
					},
					{
						...barBase,
						label: 'Pipeline',
						data: monthRows.map((row) => row.pipeline),
						backgroundColor: fadeFill(secondColor),
						hoverBackgroundColor: secondColor,
					},
				]
			: [
					{
						...barBase,
						label: 'Leads',
						data: monthRows.map((row) => row.leads),
						backgroundColor: fadeFill(firstColor),
						hoverBackgroundColor: firstColor,
						categoryPercentage: 0.5,
					},
					{
						type: 'line',
						label: 'New customers',
						data: monthRows.map((row) => row.won),
						yAxisID: 'y1',
						order: 0,
						borderColor: secondColor,
						backgroundColor: secondColor,
						borderWidth: 2.5,
						tension: 0,
						pointRadius: 4,
						pointHoverRadius: 6,
						pointBackgroundColor: hues.surface,
						pointBorderColor: secondColor,
						pointBorderWidth: 2,
						pointHoverBackgroundColor: secondColor,
						pointHoverBorderColor: hues.surface,
					},
				];
		const axisSet = {
			x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, ...tickStyle } },
			y: {
				beginAtZero: true,
				grid: { color: hues.grid },
				border: { display: false },
				ticks: {
					maxTicksLimit: 5,
					callback: (tickValue) => (chartView === 'money' ? usdShort(tickValue) : integer(tickValue)),
					...tickStyle,
				},
			},
		};
		if (!byMoney)
			axisSet.y1 = {
				position: 'right',
				beginAtZero: true,
				suggestedMax: 4,
				grid: { display: false },
				border: { display: false },
				ticks: { stepSize: 1, maxTicksLimit: 5, ...tickStyle },
			};
		monthsChart = new Chart(canvasEl, {
			data: { labels: monthRows.map((row) => monthLabel(row.m)), datasets: sets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !prefersStill() ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				layout: { padding: { top: 6 } },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: hues.surface,
						titleColor: hues.text,
						bodyColor: hues.text,
						borderColor: hues.border,
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: TYPEFACE, size: 12, weight: '600' },
						bodyFont: { family: TYPEFACE, size: 12 },
						callbacks: {
							title: (hovered) => {
								const key = campaign.months[hovered[0].dataIndex].m;
								return `${monthLabel(key, true)} ${key.slice(0, 4)}`;
							},
							label: (hovered) =>
								` ${hovered.dataset.label}: ${chartView === 'money' ? usd(hovered.parsed.y) : integer(hovered.parsed.y)}`,
						},
					},
				},
				scales: axisSet,
			},
		});
	}

	/** The chart's colors, read from the live theme tokens. */
	function chartColors() {
		const ink = cssToken('--basalt-copy', '#12233a');
		return {
			series: [1, 2, 3, 4, 5, 6, 7, 8].map((step) => cssToken(`--basalt-series-${step}`, '#2b6fd4')),
			text: ink,
			quiet: blend(cssToken('--basalt-copy-muted', '#5f7186'), ink, 0.72),
			grid: alphaOf(ink, 0.07),
			surface: cssToken('--basalt-plane', '#ffffff'),
			border: cssToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	function cssToken(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	/** [r, g, b] from #rgb, #rrggbb, rgb() or rgba(); mid gray otherwise. */
	function rgbParts(color) {
		const raw = String(color || '').trim();
		const short = /^#([0-9a-f]{3})$/i.exec(raw);
		if (short) return short[1].split('').map((digit) => parseInt(digit + digit, 16));
		const long = /^#([0-9a-f]{6})$/i.exec(raw);
		if (long) {
			const packed = parseInt(long[1], 16);
			return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
		}
		const functional = /^rgba?\(([^)]+)\)$/i.exec(raw);
		if (functional)
			return functional[1]
				.split(/[\s,/]+/)
				.filter(Boolean)
				.map(parseFloat)
				.slice(0, 3);
		return [128, 128, 128];
	}

	function alphaOf(color, alpha) {
		const [red, green, blue] = rgbParts(color);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	/** share of the first color mixed with the rest of the second. */
	function blend(first, second, share) {
		const fromRgb = rgbParts(first);
		const toRgb = rgbParts(second);
		const channel = (index) => Math.round(fromRgb[index] * share + toRgb[index] * (1 - share));
		return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
	}

	/** A bar fill that fades from strong at the top to soft at the base; solid with gradients off. */
	function fadeFill(color) {
		return window.Basalt.chartFill([
			[0, alphaOf(color, 0.95)],
			[1, alphaOf(color, 0.45)],
		]);
	}

	/* Leads to customers, lead sources and headlines. */

	function drawFunnel(sums) {
		const funnel = [
			{ name: 'Leads', n: sums.leads, note: 'Downloaded the report' },
			{ name: 'Sales-qualified', n: sums.sqls, note: `${percent(sums.sqls / sums.leads)} of leads` },
			{ name: 'Opportunities', n: sums.opps, note: `${percent(sums.opps / sums.sqls)} of sales-qualified` },
			{ name: 'New customers', n: sums.won, note: `${percent(sums.won / sums.opps)} of opportunities` },
		];
		const stageRows = funnel
			.map(
				(stage, index) =>
					`<li class="cd-flow-step cd-c${index + 1}"><div class="cd-flow-line"><span class="cd-flow-name">${stage.name}</span><strong class="cd-flow-n">${integer(stage.n)}</strong></div><span class="cd-flow-track"><span class="cd-flow-bar" style="--cd-w:${Math.max(1.5, (stage.n / sums.leads) * 100).toFixed(1)}%"></span></span><span class="cd-flow-note">${stage.note}</span></li>`,
			)
			.join('');
		const costRow = `<li class="cd-flow-cost"><span>Cost per lead <strong>${usd(sums.spend / sums.leads)}</strong></span><span>Per customer <strong>${sums.cac == null ? 'none won' : usd(sums.cac)}</strong></span></li>`;
		pick('[data-cd="flow"]', campaignPage).innerHTML = stageRows + costRow;
	}

	function rankRow(name, value, sub, share, tone, extra) {
		return `<li class="cd-rank cd-c${tone}"><div class="cd-rank-line"><span class="cd-rank-name">${name}${extra || ''}</span><strong class="cd-rank-value">${value}</strong></div><span class="cd-rank-track"><span class="cd-rank-bar" style="--cd-w:${(share * 100).toFixed(1)}%"></span></span><span class="cd-rank-sub">${sub}</span></li>`;
	}

	function drawSources() {
		const mostLeads = Math.max(...campaign.sources.map((source) => source.leads));
		pick('[data-cd="sources"]', campaignPage).innerHTML = campaign.sources
			.map((source, index) =>
				rankRow(
					escHtml(source.name),
					integer(source.leads),
					`${source.won}${source.won === 1 ? ' new customer' : ' new customers'}`,
					source.leads / mostLeads,
					index + 1,
				),
			)
			.join('');
	}

	function drawHeadlines() {
		const headlines = campaign.messages;
		const rates = headlines.map((headline) => headline.downloads / headline.visitors);
		const topRate = Math.max(...rates);
		pick('[data-cd="messages"]', campaignPage).innerHTML = headlines
			.map((headline, index) => {
				const tag = headline.main
					? ' <span class="basalt-status basalt-status-success cd-main-tag">Main headline</span>'
					: '';
				return rankRow(
					`“${escHtml(headline.text)}”`,
					`${(rates[index] * 100).toFixed(1)}%`,
					`${integer(headline.downloads)} downloads from ${integer(headline.visitors)} visitors`,
					rates[index] / topRate,
					headline.main ? 3 : 8,
					tag,
				);
			})
			.join('');
		let downloadsTotal = 0;
		for (const headline of headlines) downloadsTotal += headline.downloads;
		const picked = headlines.some((headline) => headline.main);
		pick('[data-cd="messages-note"]', campaignPage).textContent =
			`Tested side by side since ${shortDate(campaign.start)}, ${integer(downloadsTotal)} downloads in all. ${picked ? 'The best one now shows to everyone.' : 'No headline has been picked yet.'}`;
	}

	/* Customers it brought in. */

	function drawCustomers(sums) {
		pick('[data-cd="cust-desc"]', campaignPage).textContent =
			`${integer(sums.won)} new customers since ${shortDate(campaign.start)}, worth ${usd(sums.arr)} a year. The newest first.`;
		pick('[data-cd="customers"]', campaignPage).innerHTML = campaign.customers
			.map((buyer) => {
				const planInfo = FIXTURE.plans[buyer.plan];
				return `<tr><td><a class="cd-name" href="company-details.html">${escHtml(buyer.name)}</a><span class="cd-cell-note cd-city">${escHtml(buyer.city)}</span><span class="cd-fold">Joined ${shortDate(buyer.joined)}</span></td><td><span class="badge basalt-badge-as-dot basalt-badge-tone-${planInfo.tone}">${planInfo.name}</span><span class="cd-cell-note">${buyer.seats} seats</span></td><td class="cd-col-source">${escHtml(buyer.source)}</td><td class="cd-col-joined">${shortDate(buyer.joined)}</td><td class="text-end cd-amount">${usd(buyer.arr)}</td></tr>`;
			})
			.join('');
		pick('[data-cd="cust-more"]', campaignPage).textContent =
			`And ${campaign.moreCount} more, worth ${usd(campaign.moreValue)} a year.`;
	}

	/* Settings: read them, or edit the whole section in one go. */

	function drawSettings(sums) {
		const leftover = campaign.budget - sums.spend;
		const runs = campaign.end
			? `${longDate(campaign.start)} to ${longDate(campaign.end)}`
			: `From ${longDate(campaign.start)}<span class="cd-facts-aside">no end date</span>`;
		const budgetAside = leftover >= 0 ? `${usd(leftover)} left` : `${usd(-leftover)} over`;
		const tradeChips = campaign.industries
			.map((id) => `<span class="cd-chip">${escHtml(tradeLabel(id))}</span>`)
			.join('');
		const rows = [
			['About', escHtml(campaign.about)],
			['Owner', escHtml(campaign.owner)],
			['Channel', channelBadge()],
			['Runs', runs],
			['Budget', `${usd(campaign.budget)} for 2026<span class="cd-facts-aside">${budgetAside}</span>`],
			['Pipeline goal', `${usd(campaign.goal)} for 2026`],
			['Industries', `<span class="cd-chips">${tradeChips}</span>`],
			['Company size', escHtml(sizeLabel(campaign.size))],
			['Regions', escHtml(joinWords(campaign.regions.map(regionLabel)))],
			['Landing page', `<span class="cd-mono">${escHtml(campaign.landing)}</span>`],
		];
		factsList.innerHTML = rows
			.map(([caption, detail]) => `<div><dt>${caption}</dt><dd>${detail}</dd></div>`)
			.join('');
	}

	function formField(name) {
		return settingsForm.elements[name];
	}
	function onlyDigits(text) {
		return String(text).replace(/[^\d]/g, '');
	}
	function withCommas(value) {
		return Number(value).toLocaleString('en-US');
	}

	function checkboxes(options, chosen, group) {
		return options
			.map(
				(option) =>
					`<label class="cd-check"><input type="checkbox" name="${group}" value="${option.id}"${chosen.includes(option.id) ? ' checked' : ''}><span>${escHtml(option.name)}</span></label>`,
			)
			.join('');
	}

	function clearErrors() {
		for (const errorNote of pickAll('.cd-error', settingsForm)) errorNote.hidden = true;
		for (const flagged of pickAll('.is-invalid', settingsForm)) flagged.classList.remove('is-invalid');
	}

	function loadForm() {
		formField('name').value = campaign.name;
		formField('about').value = campaign.about;
		formField('owner').innerHTML = FIXTURE.owners
			.map((who) => `<option${who === campaign.owner ? ' selected' : ''}>${escHtml(who)}</option>`)
			.join('');
		pick('[data-cd="channel-static"]', settingsForm).innerHTML = channelBadge();
		formField('start').value = campaign.start;
		formField('end').value = campaign.end || '';
		formField('end').min = NOW_DAY;
		formField('budget').value = withCommas(campaign.budget);
		formField('goal').value = withCommas(campaign.goal);
		pick('[data-cd="industries-edit"]', settingsForm).innerHTML = checkboxes(
			FIXTURE.industries,
			campaign.industries,
			'industries',
		);
		pick('[data-cd="regions-edit"]', settingsForm).innerHTML = checkboxes(
			FIXTURE.regions,
			campaign.regions,
			'regions',
		);
		formField('size').innerHTML = FIXTURE.sizes
			.map(
				(band) =>
					`<option value="${band.id}"${band.id === campaign.size ? ' selected' : ''}>${escHtml(band.name)}</option>`,
			)
			.join('');
		if (window.Basalt.select?.refresh) {
			window.Basalt.select.refresh(formField('owner'));
			window.Basalt.select.refresh(formField('size'));
		}
		clearErrors();
	}

	function toggleEditing(editing) {
		settingsForm.hidden = !editing;
		factsList.hidden = editing;
		editButton.hidden = editing;
		editButton.setAttribute('aria-expanded', String(editing));
		if (!editing) return;
		loadForm();
		formField('name').focus();
	}

	function markInvalid(input, errorNote, text) {
		input?.classList.add('is-invalid');
		if (text) errorNote.textContent = text;
		errorNote.hidden = false;
	}

	/** Reads the form into the shape backend.save() takes. */
	function readDraft() {
		const ticked = (group) => pickAll(`input[name="${group}"]:checked`, settingsForm).map((box) => box.value);
		return {
			name: formField('name').value.trim(),
			about: formField('about').value.trim(),
			owner: formField('owner').value,
			end: formField('end').value || null,
			budget: parseInt(onlyDigits(formField('budget').value), 10) || 0,
			goal: parseInt(onlyDigits(formField('goal').value), 10) || 0,
			industries: ticked('industries'),
			size: formField('size').value,
			regions: ticked('regions'),
		};
	}

	/** Flags every problem in the draft and returns the controls at fault,
      in the order they appear. */
	function problemsIn(draft) {
		const spentSoFar = sumUp().spend;
		const problems = [];
		function fail(input, messageId, text, focusTarget) {
			markInvalid(input, pick(messageId), text);
			problems.push(focusTarget || input);
		}
		if (!draft.name) fail(formField('name'), '#cd-name-error');
		if (!draft.about) fail(formField('about'), '#cd-about-error');
		if (draft.end && draft.end < NOW_DAY) fail(formField('end'), '#cd-end-error', 'Pick today or a later date.');
		if (!draft.budget) fail(formField('budget'), '#cd-budget-error', 'Add a budget.');
		else if (draft.budget < spentSoFar)
			fail(
				formField('budget'),
				'#cd-budget-error',
				`It has already spent ${usd(spentSoFar)}, so the budget can’t be lower.`,
			);
		if (!draft.goal) fail(formField('goal'), '#cd-goal-error', 'Add a pipeline goal.');
		if (!draft.industries.length)
			fail(null, '#cd-industries-error', undefined, pick('input[name="industries"]', settingsForm));
		if (!draft.regions.length)
			fail(null, '#cd-regions-error', undefined, pick('input[name="regions"]', settingsForm));
		return problems;
	}

	/** What the draft changes, in words for the toast and the history. */
	function changesIn(draft) {
		const changes = [];
		if (draft.name !== campaign.name) changes.push('the name');
		if (draft.about !== campaign.about) changes.push('the description');
		if (draft.owner !== campaign.owner) changes.push('the owner');
		if (draft.end !== campaign.end) changes.push('the end date');
		if (draft.budget !== campaign.budget)
			changes.push(`the budget from ${usd(campaign.budget)} to ${usd(draft.budget)}`);
		if (draft.goal !== campaign.goal) changes.push('the pipeline goal');
		const audienceMoved =
			draft.industries.join() !== campaign.industries.join() ||
			draft.size !== campaign.size ||
			draft.regions.join() !== campaign.regions.join();
		if (audienceMoved) changes.push('the audience');
		return changes;
	}

	function onSettingsSubmit(event) {
		event.preventDefault();
		clearErrors();
		const draft = readDraft();
		const [firstProblem] = problemsIn(draft);
		if (firstProblem) {
			firstProblem
				.closest('.cd-field')
				.scrollIntoView({ behavior: prefersStill() ? 'auto' : 'smooth', block: 'center' });
			firstProblem.focus({ preventScroll: true });
			return;
		}
		const changes = changesIn(draft);
		if (!changes.length) {
			toggleEditing(false);
			editButton.focus();
			notify({ tone: 'info', title: 'Nothing changed', text: 'The settings are as they were.' });
			return;
		}
		const submitButton = pick('button[type="submit"]', settingsForm);
		submitButton.disabled = true;
		backend.save(draft).then(() => {
			Object.assign(campaign, draft);
			campaign.activity.unshift({
				at: NOW_DAY,
				who: CURRENT_USER,
				icon: 'bi-pencil',
				text: `changed ${joinWords(changes)}`,
			});
			submitButton.disabled = false;
			toggleEditing(false);
			drawAll(false);
			editButton.focus();
			notify({ tone: 'success', title: 'Settings saved', text: `Changed ${joinWords(changes)}.` });
			speak('Settings saved.');
		});
	}

	/* The history list. */

	function drawHistory() {
		pick('[data-cd="activity"]', campaignPage).innerHTML = campaign.activity
			.map(
				(entry) =>
					`<li class="cd-feed-item"><span class="cd-feed-icon" aria-hidden="true"><i class="bi ${entry.icon}"></i></span><p class="cd-feed-text"><span><strong>${escHtml(entry.who)}</strong> ${escHtml(entry.text)}</span><span class="cd-feed-time">${entry.at === NOW_DAY ? 'Today' : longDate(entry.at)}</span></p></li>`,
			)
			.join('');
	}

	/* Pausing, resuming and ending, and the CSV export. */

	function openConfirm(kind) {
		const wording = CONFIRM_COPY[kind];
		awaiting = kind;
		pick('[data-cd-confirm]', confirmDialog).className =
			`basalt-confirm${wording.tone ? ` basalt-confirm-${wording.tone}` : ''}`;
		pick('[data-cd-confirm-icon]', confirmDialog).className = `bi ${wording.icon}`;
		pick('[data-cd-confirm-title]', confirmDialog).textContent = wording.title;
		pick('[data-cd-confirm-text]', confirmDialog).textContent = wording.text;
		const goButton = pick('[data-cd-confirm-go]', confirmDialog);
		goButton.textContent = wording.btn;
		goButton.className = `btn ${wording.cls}`;
		bootstrap.Modal.getOrCreateInstance(confirmDialog).show();
	}

	function applyStatus(status, verb) {
		return backend.setStatus(status).then(() => {
			campaign.status = status;
			if (status === 'ended') campaign.end = NOW_DAY;
			campaign.activity.unshift({
				at: NOW_DAY,
				who: CURRENT_USER,
				icon: STATUS_ICON[status],
				text: `${verb} the campaign`,
			});
			drawAll(false);
			const headline = STATUS_TOAST[status];
			notify({
				tone: status === 'ended' ? 'info' : 'success',
				title: headline,
				text: `${campaign.name} is now ${STATUS_LOOK[status].name.toLowerCase()}.`,
			});
			speak(`${headline}.`);
		});
	}

	function downloadMonths() {
		const columnTitles = [
			'Campaign',
			'Month',
			'Spend',
			'Leads',
			'Sales-qualified',
			'Opportunities',
			'New customers',
			'Pipeline',
			'Yearly value won',
		];
		const rowsOut = campaign.months.map((row) => [
			campaign.name,
			row.m,
			row.spend,
			row.leads,
			row.sqls,
			row.opps,
			row.won,
			row.pipeline,
			row.arr,
		]);
		const csv = [columnTitles, ...rowsOut].map((line) => line.map(csvField).join(',')).join('\r\n');
		const blobUrl = URL.createObjectURL(new Blob([`${csv}`], { type: 'text/csv;charset=utf-8' }));
		const fileName = `${campaign.id}-by-month.csv`;
		const anchorEl = document.createElement('a');
		anchorEl.href = blobUrl;
		anchorEl.download = fileName;
		document.body.appendChild(anchorEl);
		anchorEl.click();
		anchorEl.remove();
		setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
		notify({ tone: 'success', title: 'Exported', text: `Saved as ${fileName}.` });
	}

	start();
})();
