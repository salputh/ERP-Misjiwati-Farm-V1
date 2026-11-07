/**
 * Basalt - Taxes page
 * The Marlo shop's tax rates: the rate each region charges,
 * what it is charged on (clothing, extras, services, shipping)
 * and what it collected last month. Draws the rate list, the
 * September bars, the checkout rules and the rate drawer, which
 * also adds new rates, from the demo data below.
 */
(() => {
	'use strict';
	const root = pick('[data-tx-root]');
	if (!root) return;

	/* Demo data
	   A live install would load these from the store's API. TODAY is the
	   demo's "now", so the statuses and dates always read the same.
	   on lists what the rate is charged on: goods (clothing), addon,
	   service and shipping, the same kinds the Orders and Order Details
	   pages tax by. sep is the tax collected in September in US dollars
	   and orders the orders delivered there that month. */
	const TODAY = '2026-10-09';

	/* Area ids match the tx-area-* colors in taxes.css. */
	const AREAS = [
		{ id: 'na', name: 'Northeast' },
		{ id: 'eu', name: 'Midwest' },
		{ id: 'ap', name: 'West' },
		{ id: 'la', name: 'South' },
	];
	const STATES = [
		{ cc: 'AL', name: 'Alabama', area: 'la' },
		{ cc: 'AK', name: 'Alaska', area: 'ap' },
		{ cc: 'AZ', name: 'Arizona', area: 'ap' },
		{ cc: 'AR', name: 'Arkansas', area: 'la' },
		{ cc: 'CA', name: 'California', area: 'ap' },
		{ cc: 'CO', name: 'Colorado', area: 'ap' },
		{ cc: 'CT', name: 'Connecticut', area: 'na' },
		{ cc: 'DE', name: 'Delaware', area: 'la' },
		{ cc: 'DC', name: 'District of Columbia', area: 'la' },
		{ cc: 'FL', name: 'Florida', area: 'la' },
		{ cc: 'GA', name: 'Georgia', area: 'la' },
		{ cc: 'HI', name: 'Hawaii', area: 'ap' },
		{ cc: 'ID', name: 'Idaho', area: 'ap' },
		{ cc: 'IL', name: 'Illinois', area: 'eu' },
		{ cc: 'IN', name: 'Indiana', area: 'eu' },
		{ cc: 'IA', name: 'Iowa', area: 'eu' },
		{ cc: 'KS', name: 'Kansas', area: 'eu' },
		{ cc: 'KY', name: 'Kentucky', area: 'la' },
		{ cc: 'LA', name: 'Louisiana', area: 'la' },
		{ cc: 'ME', name: 'Maine', area: 'na' },
		{ cc: 'MD', name: 'Maryland', area: 'la' },
		{ cc: 'MA', name: 'Massachusetts', area: 'na' },
		{ cc: 'MI', name: 'Michigan', area: 'eu' },
		{ cc: 'MN', name: 'Minnesota', area: 'eu' },
		{ cc: 'MS', name: 'Mississippi', area: 'la' },
		{ cc: 'MO', name: 'Missouri', area: 'eu' },
		{ cc: 'MT', name: 'Montana', area: 'ap' },
		{ cc: 'NE', name: 'Nebraska', area: 'eu' },
		{ cc: 'NV', name: 'Nevada', area: 'ap' },
		{ cc: 'NH', name: 'New Hampshire', area: 'na' },
		{ cc: 'NJ', name: 'New Jersey', area: 'na' },
		{ cc: 'NM', name: 'New Mexico', area: 'ap' },
		{ cc: 'NY', name: 'New York', area: 'na' },
		{ cc: 'NC', name: 'North Carolina', area: 'la' },
		{ cc: 'ND', name: 'North Dakota', area: 'eu' },
		{ cc: 'OH', name: 'Ohio', area: 'eu' },
		{ cc: 'OK', name: 'Oklahoma', area: 'la' },
		{ cc: 'OR', name: 'Oregon', area: 'ap' },
		{ cc: 'PA', name: 'Pennsylvania', area: 'na' },
		{ cc: 'RI', name: 'Rhode Island', area: 'na' },
		{ cc: 'SC', name: 'South Carolina', area: 'la' },
		{ cc: 'SD', name: 'South Dakota', area: 'eu' },
		{ cc: 'TN', name: 'Tennessee', area: 'la' },
		{ cc: 'TX', name: 'Texas', area: 'la' },
		{ cc: 'UT', name: 'Utah', area: 'ap' },
		{ cc: 'VT', name: 'Vermont', area: 'na' },
		{ cc: 'VA', name: 'Virginia', area: 'la' },
		{ cc: 'WA', name: 'Washington', area: 'ap' },
		{ cc: 'WV', name: 'West Virginia', area: 'la' },
		{ cc: 'WI', name: 'Wisconsin', area: 'eu' },
		{ cc: 'WY', name: 'Wyoming', area: 'ap' },
	];
	const KINDS = [
		{ v: 'goods', label: 'Clothing', lower: 'clothing' },
		{ v: 'addon', label: 'Extras', lower: 'extras' },
		{ v: 'service', label: 'Services', lower: 'services' },
		{ v: 'shipping', label: 'Shipping', lower: 'shipping' },
	];
	const RATE_TOP = 25;
	const STATUS = {
		active: { label: 'Active', tone: 'success' },
		scheduled: { label: 'Scheduled', tone: 'info' },
		paused: { label: 'Paused', tone: 'warning' },
	};

	const RATES = [
		{
			id: 'us-co',
			region: 'Colorado',
			cc: 'CO',
			name: 'Sales tax',
			rate: 2.9,
			on: ['goods'],
			since: '2025-01-01',
			collect: true,
			sep: 1184,
			orders: 38,
		},
		{
			id: 'us-fl',
			region: 'Florida',
			cc: 'FL',
			name: 'Sales tax',
			rate: 6,
			on: ['goods'],
			since: '2025-03-01',
			collect: true,
			sep: 2946,
			orders: 44,
		},
		{
			id: 'us-il',
			region: 'Illinois',
			cc: 'IL',
			name: 'Sales tax',
			rate: 6.25,
			on: ['shipping'],
			since: '2025-06-01',
			collect: true,
			sep: 212,
			orders: 27,
			note: 'Clothing for Illinois ships from the Evanston partner warehouse, which charges the tax on it.',
		},
		{
			id: 'us-mn',
			region: 'Minnesota',
			cc: 'MN',
			name: 'Sales tax',
			rate: 6.875,
			on: ['goods'],
			since: '2025-09-01',
			collect: true,
			sep: 1402,
			orders: 21,
		},
		{
			id: 'us-ny',
			region: 'New York',
			cc: 'NY',
			name: 'Sales tax',
			rate: 4,
			on: ['goods', 'shipping'],
			since: '2025-01-01',
			collect: true,
			sep: 3874,
			orders: 52,
		},
		{
			id: 'us-or',
			region: 'Oregon',
			cc: 'OR',
			name: 'No sales tax',
			rate: 0,
			on: [],
			since: '2024-01-01',
			collect: true,
			sep: 0,
			orders: 61,
			note: 'Oregon has no sales tax. Orders delivered here are tracked so the returns add up.',
		},
		{
			id: 'us-pa',
			region: 'Pennsylvania',
			cc: 'PA',
			name: 'Sales tax',
			rate: 6,
			on: ['goods'],
			since: '2025-04-01',
			collect: true,
			sep: 1528,
			orders: 29,
		},
		{
			id: 'us-wa',
			region: 'Washington',
			cc: 'WA',
			name: 'Sales tax',
			rate: 6.5,
			on: ['goods', 'shipping'],
			since: '2025-01-01',
			collect: true,
			sep: 2317,
			orders: 46,
		},
		{
			id: 'us-tx',
			region: 'Texas',
			cc: 'TX',
			name: 'Sales tax',
			rate: 6.25,
			on: ['goods', 'shipping'],
			since: '2025-05-01',
			collect: true,
			sep: 893,
			orders: 19,
		},
		{
			id: 'us-ca',
			region: 'California',
			cc: 'CA',
			name: 'Sales tax',
			rate: 7.25,
			on: ['goods'],
			since: '2025-01-01',
			collect: true,
			sep: 4962,
			orders: 47,
		},
		{
			id: 'us-ga',
			region: 'Georgia',
			cc: 'GA',
			name: 'Sales tax',
			rate: 4,
			on: ['goods', 'shipping'],
			since: '2026-11-01',
			collect: true,
			sep: 0,
			orders: 0,
			note: 'Registered in September. Georgia orders pay no tax until November 1.',
		},
		{
			id: 'us-nj',
			region: 'New Jersey',
			cc: 'NJ',
			name: 'Sales tax',
			rate: 6.625,
			on: ['shipping'],
			since: '2025-01-01',
			collect: true,
			sep: 486,
			orders: 33,
			note: 'Clothing is exempt in New Jersey, so only shipping is charged here.',
		},
		{
			id: 'us-ma',
			region: 'Massachusetts',
			cc: 'MA',
			name: 'Sales tax',
			rate: 6.25,
			on: ['addon', 'service'],
			since: '2025-07-01',
			collect: true,
			sep: 1071,
			orders: 12,
			note: 'Clothing under $175 is exempt in Massachusetts. Extras and services are charged here.',
		},
		{
			id: 'us-oh',
			region: 'Ohio',
			cc: 'OH',
			name: 'Sales tax',
			rate: 5.75,
			on: ['goods', 'shipping'],
			since: '2027-01-01',
			collect: true,
			sep: 0,
			orders: 0,
		},
		{
			id: 'us-mi',
			region: 'Michigan',
			cc: 'MI',
			name: 'Sales tax',
			rate: 6,
			on: ['goods', 'addon', 'shipping'],
			since: '2025-01-01',
			collect: true,
			sep: 3215,
			orders: 31,
		},
		{
			id: 'us-nc',
			region: 'North Carolina',
			cc: 'NC',
			name: 'Sales tax',
			rate: 4.75,
			on: ['goods', 'addon', 'service', 'shipping'],
			since: '2025-08-01',
			collect: true,
			sep: 1688,
			orders: 13,
		},
		{
			id: 'us-az',
			region: 'Arizona',
			cc: 'AZ',
			name: 'Sales tax',
			rate: 5.6,
			on: ['addon', 'service'],
			since: '2026-02-01',
			collect: false,
			pausedOn: '2026-09-24',
			pausedBy: 'John Armstrong',
			sep: 142,
			orders: 6,
			note: 'The state tax license is being renewed.',
		},
		{
			id: 'us-tn',
			region: 'Tennessee',
			cc: 'TN',
			name: 'Sales tax',
			rate: 7,
			on: ['goods', 'addon', 'service', 'shipping'],
			since: '2026-02-01',
			collect: true,
			sep: 1276,
			orders: 14,
		},
		{
			id: 'us-va',
			region: 'Virginia',
			cc: 'VA',
			name: 'Sales tax',
			rate: 5.3,
			on: ['addon', 'service'],
			since: '2026-06-01',
			collect: true,
			sep: 318,
			orders: 9,
		},
	];

	/* The order the drawer prices, so a buyer sees what a rate does to a
     real basket. Prices are from the Marlo shop catalog. */
	const SAMPLE = [
		{ name: 'Sculpted Shoulder Blazer', kind: 'goods', price: 1290 },
		{ name: 'Delivery Pass', qty: '10 months', kind: 'addon', price: 60 },
		{ name: 'Private Styling Session', kind: 'service', price: 650 },
		{ name: 'UPS Ground', kind: 'shipping', price: 12 },
	];

	function start() {
		pick('[data-tx-new]').addEventListener('click', openNew);
		drawer.addEventListener('shown.bs.offcanvas', () => {
			if (!current) F('region').focus();
		});

		form.addEventListener('input', (e) => {
			if (e.target.classList.contains('is-invalid')) e.target.classList.remove('is-invalid');
			const group = e.target.closest('.input-group');
			if (group) group.classList.remove('is-invalid');
			if (e.target === F('rate') || e.target.name === 'txOn') drawSample();
		});
		form.addEventListener('change', (e) => {
			if (e.target.name === 'txOn') drawSample();
			if (e.target === F('on')) drawOnHint();
		});

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			unflag();
			const bad = [];
			const isNew = !current;
			const region = F('region').value.trim();
			const name = F('name').value.trim();
			const rate = parseFloat(F('rate').value);
			const since = F('since').value;
			if (isNew && !region) {
				F('region').classList.add('is-invalid');
				bad.push(F('region'));
			}
			if (!name) {
				F('name').classList.add('is-invalid');
				bad.push(F('name'));
			}
			if (isNaN(rate) || rate < 0 || rate > 30) {
				F('rate').classList.add('is-invalid');
				F('rate').closest('.input-group').classList.add('is-invalid');
				bad.push(F('rate'));
			}
			if (!since) {
				F('since').classList.add('is-invalid');
				bad.push(F('since'));
			}
			if (bad.length) {
				bad[0].focus();
				return;
			}

			const f = readForm();
			const r = current || { id: `new-${Date.now()}`, region, cc: F('country').value, sep: 0, orders: 0 };
			const wasOn = isNew ? true : r.collect;
			r.name = name;
			r.rate = Math.round(rate * 1000) / 1000;
			r.on = f.on;
			r.since = since;
			r.collect = F('on').checked;
			if (!r.collect && wasOn) {
				r.pausedOn = TODAY;
				r.pausedBy = 'John Armstrong';
			}
			if (isNew) RATES.push(r);

			drawFigures();
			drawList();
			drawMonth();
			offcanvas().hide();
			const what = `${r.name} ${pct(r.rate)}${r.on.length ? ` on ${onWords(r.on)}` : ', charged on nothing yet'}.`;
			const tone = statusOf(r) === 'paused' ? 'warning' : 'success';
			toast({
				tone,
				title: isNew ? `${r.region} added` : `${r.region} saved`,
				text: statusOf(r) === 'paused' ? `${what} Paused for now.` : what,
			});
		});

		drawFigures();
		drawList();
		drawMonth();
	}

	/* Helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function num(n) {
		return Math.round(n).toLocaleString('en-US');
	}

	function money(n) {
		return `$${num(n)}`;
	}

	function cents(n) {
		return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function pct(n) {
		return `${String(+n.toFixed(3))}%`;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	function parse(iso) {
		const p = iso.split('-').map(Number);
		return new Date(p[0], p[1] - 1, p[2]);
	}
	/* "Nov 1, 2026"; the year is left off for this year when short is asked for. */
	function date(iso, brief) {
		const d = parse(iso);
		const y = d.getFullYear();
		return `${MONTHS[d.getMonth()]} ${d.getDate()}${brief && y === 2026 ? '' : `, ${y}`}`;
	}

	function stateOf(cc) {
		return STATES.find((c) => c.cc === cc) || STATES[0];
	}

	function areaOf(r) {
		return stateOf(r.cc).area;
	}

	function areaName(id) {
		return AREAS.find((a) => a.id === id).name;
	}

	function plural(n, one, many) {
		return `${num(n)} ${n === 1 ? one : many}`;
	}

	function setSelect(el, v) {
		el.value = v;
		if (window.Basalt.select) window.Basalt.select.refresh(el);
	}

	function statusOf(r) {
		if (!r.collect) return 'paused';
		return r.since > TODAY ? 'scheduled' : 'active';
	}
	function stateTag(r) {
		const s = STATUS[statusOf(r)];
		return `<span class="basalt-status basalt-status-dot basalt-status-${s.tone}">${s.label}</span>`;
	}
	/* "clothing and shipping", "extras, services and shipping" */
	function onWords(on) {
		const w = KINDS.filter((k) => on.indexOf(k.v) !== -1).map((k) => k.lower);
		if (w.length < 2) return w.join('');
		return `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
	}

	/* State names and codes are searched too, so "TX" finds Texas. */
	function hay(r) {
		return [r.region, stateOf(r.cc).name, r.cc, r.name].join(' ');
	}

	/* Hero figures */
	function fig(k) {
		return pick(`[data-tx-fig="${k}"]`, root);
	}

	/* How many rates are charging, waiting to start and switched off. */
	function drawFigures() {
		for (const k of Object.keys(STATUS)) {
			fig(k).textContent = num(RATES.filter((r) => statusOf(r) === k).length);
		}
	}

	/* Rate list */
	const rowsEl = pick('[data-tx-rows]', root);
	const findField = pick('[data-tx-search]', root);
	const stateNode = pick('[data-tx-status]', root);
	const onEl = pick('[data-tx-on]', root);
	const state = { q: '', status: 'all', on: 'all' };
	let shown = [];

	function visible() {
		return RATES.filter((r) => {
			if (state.q.trim() && !window.Basalt.matchesQuery(hay(r), state.q)) return false;
			if (state.status !== 'all' && statusOf(r) !== state.status) return false;
			if (state.on !== 'all' && r.on.indexOf(state.on) === -1) return false;
			return true;
		});
	}

	function rowHtml(r) {
		const s = statusOf(r);
		/* A rate on all four kinds reads as one pill, so the row stays one line. */
		const ons = !r.on.length
			? '<span class="tx-none">Nothing</span>'
			: `<div class="tx-ons">${
					r.on.length === KINDS.length
						? '<span class="tx-on">Everything</span>'
						: KINDS.filter((k) => r.on.indexOf(k.v) !== -1)
								.map((k) => `<span class="tx-on">${k.label}</span>`)
								.join('')
				}</div>`;
		const when =
			s === 'scheduled'
				? `<p class="tx-sub">From ${date(r.since, true)}</p>`
				: s === 'paused'
					? `<p class="tx-sub">Since ${date(r.pausedOn, true)}</p>`
					: '';
		const sep =
			s === 'scheduled'
				? '<p class="tx-money tx-money-none">Not started</p>'
				: `<p class="tx-money${r.sep ? '' : ' tx-money-none'}">${money(r.sep)}</p>`;
		/* The meter compares rates at a glance: a full track is RATE_TOP. */
		const meter = `<span class="tx-meter" aria-hidden="true"><span style="--tx-share:${Math.min((r.rate / RATE_TOP) * 100, 100).toFixed(1)}%"></span></span>`;
		return `<tr class="tx-area-${areaOf(r)}" data-tx-id="${r.id}"><td class="tx-row-region"><div class="tx-region"><span class="tx-code" aria-hidden="true">${r.cc}</span><div class="tx-region-text"><p class="tx-line">${htmlSafe(r.region)}</p><p class="tx-sub">${htmlSafe(r.name)}<span class="tx-region-rate"> · ${pct(r.rate)}</span></p></div></div></td><td class="tx-row-rate tx-num"><span class="tx-rate">${pct(r.rate)}</span>${meter}</td><td class="tx-row-ons">${ons}</td><td class="tx-row-status"><div class="tx-status">${stateTag(r)}${when}</div></td><td class="tx-row-money tx-num">${sep}</td><td class="tx-row-go"><button type="button" class="btn btn-icon tx-chev" data-tx-open aria-label="Open ${htmlSafe(r.region)}"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></td></tr>`;
	}

	function drawList() {
		shown = visible();
		const states = new Set(RATES.map((r) => r.cc)).size;
		pick('[data-tx-list-desc]', root).textContent =
			`${plural(RATES.length, 'rate', 'rates')} in ${plural(states, 'state', 'states')}. Open one to change its rate or what it is charged on.`;
		/* The count only speaks up once a filter hides some rates; the line above already gives the total. */
		pick('[data-tx-count]', root).textContent =
			shown.length === RATES.length ? '' : `${num(shown.length)} of ${plural(RATES.length, 'rate', 'rates')}`;

		if (!shown.length) {
			const q = state.q.trim();
			rowsEl.innerHTML = `<tr class="basalt-empty-row"><td colspan="6">${window.Basalt.emptyState({
				query: q,
				noun: 'rates',
				icon: q ? 'search' : 'funnel',
				title: q ? '' : 'No rates match these filters',
				text:
					q && (state.status !== 'all' || state.on !== 'all')
						? 'Check the spelling, or set the filters back to Any.'
						: q
							? ''
							: 'Try another status, or charged on anything.',
			})}</td></tr>`;
			return;
		}
		/* Group by area, in the areas' order; inside one, by state then name. */
		const html = [];

		for (const a of AREAS) {
			const list = shown
				.filter((r) => areaOf(r) === a.id)
				.sort((x, y) =>
					x.cc === y.cc
						? x.region.localeCompare(y.region)
						: STATES.indexOf(stateOf(x.cc)) - STATES.indexOf(stateOf(y.cc)),
				);
			if (!list.length) continue;
			html.push(
				`<tr class="tx-group tx-area-${a.id}"><th colspan="6" scope="colgroup"><div class="tx-group-row"><span class="tx-group-name">${a.name}</span><span class="tx-group-meta">${plural(list.length, 'rate', 'rates')}</span></div></th></tr>`,
			);

			for (const r of list) {
				html.push(rowHtml(r));
			}
		}

		rowsEl.innerHTML = html.join('');
		/* The drawer steps through the rates in the order they are shown. */
		shown = pickAll('tr[data-tx-id]', rowsEl).map((tr) =>
			RATES.find((r) => r.id === tr.getAttribute('data-tx-id')),
		);
	}

	findField.addEventListener('input', () => {
		state.q = findField.value;
		drawList();
	});
	stateNode.addEventListener('change', () => {
		state.status = stateNode.value;
		drawList();
	});
	onEl.addEventListener('change', () => {
		state.on = onEl.value;
		drawList();
	});
	rowsEl.addEventListener('click', (e) => {
		const tr = e.target.closest('tr[data-tx-id]');
		if (tr) openRate(tr.getAttribute('data-tx-id'));
	});

	/* Collected in September */
	function drawMonth() {
		const by = {};

		for (const r of RATES) {
			if (!r.sep) continue;
			const b = by[r.cc] || (by[r.cc] = { cc: r.cc, sep: 0, orders: 0 });
			b.sep += r.sep;
			b.orders += r.orders;
		}

		const list = Object.values(by).sort((a, b) => b.sep - a.sep);
		const total = list.reduce((n, b) => n + b.sep, 0);
		const top = list.slice(0, 6);
		const rest = list.slice(6);
		const max = top.length ? top[0].sep : 1;
		pick('[data-tx-month-desc]', root).textContent =
			`${money(total)} across ${plural(list.length, 'state', 'states')}, due with the October returns.`;
		pick('[data-tx-bars]', root).innerHTML = top
			.map((b) => {
				const c = stateOf(b.cc);
				return `<li class="tx-bars-row tx-area-${c.area}"><span class="tx-bars-name"><span class="tx-bars-country">${c.name}</span><span class="tx-bars-area">${areaName(c.area)}</span></span><span class="tx-bars-bar" aria-hidden="true"><span style="--tx-share:${((b.sep / max) * 100).toFixed(1)}%"></span></span><span class="tx-bars-value"><span class="tx-bars-money">${money(b.sep)}</span><span class="tx-bars-orders">${plural(b.orders, 'order', 'orders')}</span></span></li>`;
			})
			.join('');
		const restSum = rest.reduce((n, b) => n + b.sep, 0);
		const restNames =
			rest.length > 3
				? plural(rest.length, 'more state', 'more states')
				: rest
						.map((b) => stateOf(b.cc).name)
						.join(', ')
						.replace(/, ([^,]*)$/, ' and $1');
		pick('[data-tx-bars-more]', root).textContent = rest.length
			? `And ${restNames}, ${money(restSum)} between them.`
			: '';
	}

	/* Checkout rules */
	const RULE_TEXT = {
		address: [
			'Rates follow the delivery address',
			'Each order pays the rate for where it is delivered.',
			'Rates no longer follow the address',
			'Checkout charges no tax until this is back on.',
		],
		net: [
			'Prices show without tax',
			'Tax is added as its own line in the basket.',
			'Prices now include tax',
			'The store shows each price with its tax added.',
		],
		exempt: [
			'Exemption certificates accepted',
			'Customers with a certificate on file pay no tax.',
			'Exemption certificates ignored',
			'Every customer pays tax, certificate or not.',
		],
		number: [
			'Tax number on invoices',
			'Invoices show the number for their region.',
			'Tax number left off invoices',
			'New invoices no longer show it.',
		],
	};
	pick('[data-tx-rules]', root).addEventListener('change', (e) => {
		const el = e.target.closest('[data-tx-rule]');
		if (!el) return;
		const t = RULE_TEXT[el.getAttribute('data-tx-rule')];
		toast(el.checked ? { tone: 'success', title: t[0], text: t[1] } : { tone: 'warning', title: t[2], text: t[3] });
	});

	/* Export */
	pick('[data-tx-export]').addEventListener('click', () => {
		function cell(v) {
			return `"${String(v).replace(/"/g, '""')}"`;
		}

		const lines = [
			['Region', 'State', 'Tax', 'Rate %', 'Charged on', 'Status', 'Starts', 'September USD', 'September orders']
				.map(cell)
				.join(','),
		];

		for (const r of RATES) {
			lines.push(
				[
					r.region,
					stateOf(r.cc).name,
					r.name,
					r.rate,
					onWords(r.on) || 'nothing',
					STATUS[statusOf(r)].label,
					r.since,
					r.sep,
					r.orders,
				]
					.map(cell)
					.join(','),
			);
		}

		const a = document.createElement('a');
		a.href = URL.createObjectURL(new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/csv' }));
		a.download = 'marlo-tax-rates.csv';
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		toast({
			tone: 'success',
			title: 'Rates exported',
			text: `${plural(RATES.length, 'rate', 'rates')} saved as marlo-tax-rates.csv.`,
		});
	});

	/* Drawer */
	const drawer = pick('#tx-rate');
	const form = pick('[data-tx-form]', drawer);

	function D(k) {
		return pick(`[data-tx-d="${k}"]`, drawer);
	}

	function F(k) {
		return pick(`[data-tx-f="${k}"]`, drawer);
	}

	const onBoxes = pickAll('input[name="txOn"]', drawer);

	function offcanvas() {
		return bootstrap.Offcanvas.getOrCreateInstance(drawer);
	}

	let current = null;
	let navList = [];
	let nav = null;

	F('country').innerHTML = STATES.map((c) => `<option value="${c.cc}">${c.name}</option>`).join('');

	function summary(r) {
		const s = statusOf(r);
		if (s === 'scheduled')
			return `Starts on ${date(r.since)}: ${pct(r.rate)} on ${onWords(r.on) || 'nothing yet'}.`;
		if (s === 'paused')
			return `Paused on ${date(r.pausedOn)} by ${r.pausedBy}. Orders delivered here pay no tax until it is back on.`;
		const month = r.sep
			? `${money(r.sep)} collected on ${plural(r.orders, 'order', 'orders')} in September.`
			: `${plural(r.orders, 'order', 'orders')} delivered here in September.`;
		if (!r.on.length || !r.rate) return `No tax is charged here. ${month}`;
		return `Charging ${pct(r.rate)} on ${onWords(r.on)} since ${date(r.since)}. ${month}`;
	}

	function readForm() {
		return {
			rate: parseFloat(F('rate').value),
			on: onBoxes.filter((b) => b.checked).map((b) => b.value),
		};
	}

	function drawSample() {
		const f = readForm();
		const rate = isNaN(f.rate) ? 0 : Math.min(Math.max(f.rate, 0), 30);
		let taxable = 0;
		pick('[data-tx-sample]', drawer).innerHTML = SAMPLE.map((l) => {
			const taxed = f.on.indexOf(l.kind) !== -1 && rate > 0;
			if (taxed) taxable += l.price;
			const kind = KINDS.find((k) => k.v === l.kind).label;
			return `<li class="tx-sample-item"><span class="tx-sample-name">${l.name}<span class="tx-sample-kind">${kind}${l.qty ? ` · ${l.qty}` : ''}</span></span><span class="tx-sample-flag${taxed ? ' is-taxed' : ''}">${taxed ? 'Taxed' : 'No tax'}</span><span class="tx-sample-price">${cents(l.price)}</span></li>`;
		}).join('');
		const subtotal = SAMPLE.reduce((n, l) => n + l.price, 0);
		const tax = Math.round(taxable * rate) / 100;
		pick('[data-tx-sample-sum]', drawer).innerHTML =
			`<div><dt>Subtotal</dt><dd>${cents(subtotal)}</dd></div><div><dt>Tax at ${pct(rate)}</dt><dd>${cents(tax)}</dd></div><div><dt>Customer pays</dt><dd>${cents(subtotal + tax)}</dd></div>`;
	}

	function drawOnHint() {
		D('on-hint').textContent = F('on').checked
			? 'Orders delivered here pay it from the start date.'
			: 'Orders delivered here pay no tax while it is off.';
	}

	function unflag() {
		for (const el of pickAll('.is-invalid', form)) {
			el.classList.remove('is-invalid');
		}
	}

	function fill(r) {
		unflag();
		F('name').value = r ? r.name : '';
		F('rate').value = r ? String(r.rate) : '';
		F('since').value = r ? r.since : '';
		F('on').checked = r ? r.collect : true;

		for (const b of onBoxes) {
			b.checked = r ? r.on.indexOf(b.value) !== -1 : b.value === 'goods' || b.value === 'shipping';
		}

		drawSample();
		drawOnHint();
	}

	function renderRate(r) {
		current = r;
		D('title').textContent = r.region;
		D('sub').textContent = r.region === stateOf(r.cc).name ? r.name : `${r.name} · ${stateOf(r.cc).name}`;
		D('nav').hidden = navList.length < 2;
		D('status').hidden = false;
		D('pill').innerHTML = stateTag(r);
		D('summary').textContent = summary(r);
		D('note').textContent = r.note || '';
		D('where').hidden = true;
		fill(r);
	}

	function openRate(id) {
		navList = shown.length ? shown.slice() : RATES.slice();
		const i = Math.max(
			0,
			navList.findIndex((r) => r.id === id),
		);
		if (!nav)
			nav = window.Basalt.drawer.recordNav(drawer, { valueOf: () => Math.max(1, navList.length) }, (at) => {
				if (navList[at]) renderRate(navList[at]);
			});
		nav.go(i, 0);
		offcanvas().show();
	}

	function openNew() {
		current = null;
		navList = [];
		D('title').textContent = 'New tax rate';
		D('sub').textContent = 'Orders delivered to this region pay it.';
		D('nav').hidden = true;
		D('status').hidden = true;
		D('where').hidden = false;
		F('region').value = '';
		setSelect(F('country'), 'TX');
		fill(null);
		F('since').value = TODAY;
		offcanvas().show();
	}
	start();
})();
