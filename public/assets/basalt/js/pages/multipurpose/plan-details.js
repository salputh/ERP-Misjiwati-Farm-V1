/**
 * Basalt - Plan Details
 * One subscription plan in full, opened as plan-details.html?id=<plan>
 * (an unknown id opens Pro). Price and billing come first, edited
 * in place, beside the plan's revenue over the year; then what it
 * includes, the biggest accounts on it, last month's moves in and
 * out, and every price it has had. The figures come from
 * assets/basalt/js/data/multipurpose/plans.js and the accounts from
 * assets/basalt/js/data/multipurpose/accounts.js, so Subscription Plans agrees.
 * Adding &edit=1 to the address opens the plan ready to edit.
 * Free earns nothing, so its page follows accounts instead of
 * revenue, lists its busiest accounts and has nothing to edit.
 */
(() => {
	'use strict';
	const page = pick('[data-pld-root]');
	if (!page || !window.Basalt.data || !window.Basalt.data.plans) return;

	const D = window.Basalt.data.plans;
	const A = window.Basalt.data.accounts;

	function start() {
		el('edit').addEventListener('click', () => editing(true));
		pick('[data-pld-cancel]', form).addEventListener('click', () => editing(false));
		form.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && !e.target.closest('.dropdown-menu, [aria-expanded="true"]')) editing(false);
		});
		field('price').addEventListener('input', () => {
			field('price').classList.remove('is-invalid');
			hint();
		});

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const price = priceOf();
			if (!price) {
				field('price').classList.add('is-invalid');
				field('price').focus();
				return;
			}
			const was = p.price;
			p.seatLimit = field('seats').value ? parseInt(field('seats').value, 10) : null;
			p.trialDays = parseInt(field('trial').value, 10);
			p.blurb = field('blurb').value.trim() || p.blurb;
			if (price !== was) {
				p.price = price;
				p.prices.unshift([
					D.today,
					price,
					`${price > was ? 'Raised' : 'Lowered'} from ${cents(was)} for new accounts. Others move at renewal.`,
					`${ME} (you)`,
					true,
				]);
			}
			editing(false);
			drawHead();
			drawPrice();
			drawIncluded();
			drawHistory();
			toast({
				tone: 'success',
				title: `${p.name} saved`,
				text:
					price !== was
						? `New accounts pay ${cents(price)} a seat from today.`
						: `The price stays at ${cents(price)} a seat.`,
			});
		});

		/* Draw */
		drawHead();
		drawPrice();
		drawRevenue();
		buildChart(true);
		drawIncluded();
		drawAccounts();
		drawMoves();
		drawHistory();
		document.addEventListener('basalt:appearance', () => requestAnimationFrame(() => buildChart(false)));
		/* Free's limits are fixed, so there is nothing to edit. */
		el('edit').hidden = FREE;
		if (params.get('edit') === '1' && !FREE) {
			editing(true, true);
			requestAnimationFrame(() =>
				setup.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' }),
			);
		}
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function el(name) {
		return pick(`[data-pld="${name}"]`, page);
	}

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function htmlSafe(v) {
		return String(v).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function num(n) {
		return Math.round(n).toLocaleString('en-US');
	}

	function money(n) {
		return `$${num(n)}`;
	}

	function cents(n) {
		return `$${Number.isInteger(n) ? String(n) : n.toFixed(2)}`;
	}

	function short(n) {
		return n >= 100000
			? `$${Math.round(n / 1000)}k`
			: n >= 1000
				? `$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
				: money(n);
	}

	const MONTH_NAMES = [
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
	const ME = 'John Armstrong';
	const STATUS = { pastdue: ['Past due', 'danger'], canceling: ['Canceling', 'warning'] };

	const params = new URLSearchParams(location.search);
	const p = D.find(params.get('id') || '');
	const T = D.totals();
	const FREE = p.price === 0;
	function day(s) {
		const [y, m, d] = s.split('-').map(Number);
		return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
	}

	page.style.setProperty('--pld-tone', `var(--basalt-series-${p.tone})`);
	page.style.setProperty('--pld-addon-tone', 'var(--basalt-series-5)');
	document.title = `${p.name} plan · Basalt`;

	function changeHtml(pct, words) {
		const r = Math.round(pct * 10) / 10;
		const kind = r > 0 ? 'up' : r < 0 ? 'down' : 'flat';
		const icon = kind === 'up' ? 'bi-arrow-up-right' : kind === 'down' ? 'bi-arrow-down-right' : 'bi-dash';
		return `<span class="pld-change pld-change-${kind}"><i class="bi ${icon}" aria-hidden="true"></i>${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(1)}% ${words}</span>`;
	}

	/* Header */
	function drawHead() {
		el('icon').className = `bi ${p.icon}`;
		el('name').textContent = p.name;
		el('sub').textContent = FREE
			? `Free for good · ${num(p.accounts)} accounts · ${num(p.seats)} people`
			: `${cents(p.price)} a seat a month · ${num(p.accounts)} accounts · ${num(p.seats)} seats`;
	}
	const at = D.plans.indexOf(p);

	for (const [name, other, label] of [
		['prev', D.plans[(at - 1 + D.plans.length) % D.plans.length], 'Previous plan: '],
		['next', D.plans[(at + 1) % D.plans.length], 'Next plan: '],
	]) {
		el(name).setAttribute('href', `plan-details.html?id=${encodeURIComponent(other.id)}`);
		el(name).setAttribute('aria-label', label + other.name);
	}

	/* Price and billing */
	function drawPrice() {
		if (FREE) {
			const up = p.moves.out.filter((m) => /^Up to/.test(m[0])).reduce((n, m) => n + m[1], 0);
			const was = D.counts(p)[D.counts(p).length - 2];
			el('price-desc').textContent = 'No card and no end date. Paid plans start at Basic.';
			el('options').innerHTML =
				`<div class="pld-option"><p class="pld-option-label">Price</p><p class="pld-option-price"><span class="pld-option-amount">$0</span><span class="pld-option-per">for good</span></p><p class="pld-option-note">No card needed</p></div><div class="pld-option"><p class="pld-option-label">Moved to paid</p><p class="pld-option-price"><span class="pld-option-amount">${num(up)}</span><span class="pld-option-per">accounts</span></p><p class="pld-option-note">${Math.round((up / was) * 1000) / 10}% in ${htmlSafe(D.month)}</p></div>`;
			el('fact-list').innerHTML =
				`<div class="pld-fact"><dt>People</dt><dd>Up to ${p.seatLimit} an account</dd></div><div class="pld-fact"><dt>Visits</dt><dd>${p.visitLimit} a month</dd></div><div class="pld-fact"><dt>Add-ons</dt><dd>None</dd></div>`;
			return;
		}
		const y = D.yearly(p);
		el('options').innerHTML =
			`<div class="pld-option"><p class="pld-option-label">Monthly</p><p class="pld-option-price"><span class="pld-option-amount">${cents(p.price)}</span><span class="pld-option-per">a seat a month</span></p><p class="pld-option-note">${Math.round((1 - p.yearlyShare) * 100)}% of accounts</p></div><div class="pld-option"><p class="pld-option-label">Yearly<span class="pld-option-save">2 months free</span></p><p class="pld-option-price"><span class="pld-option-amount">${cents(y)}</span><span class="pld-option-per">a seat a month</span></p><p class="pld-option-note">${Math.round(p.yearlyShare * 100)}% of accounts</p></div>`;
		el('fact-list').innerHTML =
			`<div class="pld-fact"><dt>Seats</dt><dd>${p.seatLimit ? `Up to ${p.seatLimit} an account` : 'No limit'}</dd></div><div class="pld-fact"><dt>Free trial</dt><dd>${p.trialDays ? `${p.trialDays} days, no card needed` : 'No trial'}</dd></div><div class="pld-fact"><dt>A year for 10 seats</dt><dd>${money(y * 12 * 10)}</dd></div>`;
	}

	/* Revenue */
	function css(name, fallback) {
		return (
			getComputedStyle(page).getPropertyValue(name).trim() ||
			getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
			fallback
		);
	}

	function parse(c) {
		const s = String(c || '').trim();
		let m = /^#([0-9a-f]{6})$/i.exec(s);
		if (m) {
			const n = parseInt(m[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}
		m = /^#([0-9a-f]{3})$/i.exec(s);
		if (m) return m[1].split('').map((h) => parseInt(h + h, 16));
		m = /^rgba?\(([^)]+)\)$/i.exec(s);
		if (m)
			return m[1]
				.split(',')
				.slice(0, 3)
				.map((v) => parseFloat(v));
		return [128, 128, 128];
	}
	function tint(c, a) {
		const [r, g, b] = parse(c);
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}

	function mix(x, y, share) {
		const a = parse(x);
		const b = parse(y);

		function ch(i) {
			return Math.round(a[i] * share + b[i] * (1 - share));
		}

		return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
	}

	const FONT = "'Schibsted Grotesk', sans-serif";
	let chart = null;

	function drawRevenue() {
		if (FREE) {
			const c = D.counts(p);
			const last = c[c.length - 1];
			el('rev-title').textContent = 'Accounts';
			el('rev-unit').textContent = ' accounts';
			el('mrr').textContent = num(last);
			el('rev-desc').textContent =
				'Free pays nothing, so this counts accounts at each month end. It launched in April.';
			el('rev-change').innerHTML = changeHtml((last / c[c.length - 2] - 1) * 100, `vs ${D.prevMonth}`);
			el('legend').innerHTML = '<li><span class="pld-legend-swatch"></span>Accounts</li>';
			return;
		}
		const t = D.trend(p);
		const last = t[t.length - 1];
		el('mrr').textContent = short(last);
		el('rev-desc').textContent =
			`${Math.round((p.mrr / T.mrr) * 100)}% of all revenue. Each bar is a month end, add-ons included.`;
		el('rev-change').innerHTML =
			changeHtml((last / t[t.length - 2] - 1) * 100, `vs ${D.prevMonth}`) +
			changeHtml((last / t[0] - 1) * 100, 'in a year');
	}

	function buildChart(animate) {
		if (typeof Chart === 'undefined') return;
		if (chart) chart.destroy();
		const t = FREE ? D.counts(p) : D.trend(p);
		const seats = t.map((v) => Math.round(v * (1 - p.addOnShare)));
		const addOns = t.map((v, i) => v - seats[i]);
		const fmt = FREE ? num : money;
		el('chart').setAttribute(
			'aria-label',
			FREE
				? `Bar chart of Free accounts at each month end from October 2025 to September 2026. It launched in April 2026 and reached ${num(t[t.length - 1])} accounts.`
				: `Bar chart of ${p.name} revenue at each month end from October 2025 to September 2026, split into seats and add-ons. It grew from ${short(t[0])} to ${short(t[t.length - 1])} a month.`,
		);
		const text = css('--basalt-copy', '#12233a');
		const surface = css('--basalt-plane', '#ffffff');
		const quiet = mix(css('--basalt-copy-muted', '#5f7186'), text, 0.82);
		const tone = css(`--basalt-series-${p.tone}`, '#2b6fd4');
		const addTone = css('--basalt-series-5', '#f0a93c');
		const tick = { color: quiet, font: { family: FONT, size: 11.5 }, padding: 6 };

		function year(i) {
			return i < 3 ? 2025 : 2026;
		}

		function monthIndex(i) {
			return (i + 9) % 12;
		}

		chart = new Chart(el('chart'), {
			type: 'bar',
			data: {
				labels: D.months,
				datasets: [
					{
						label: FREE ? 'Accounts' : 'Seats',
						data: seats,
						backgroundColor: tone,
						borderRadius: 3,
						borderSkipped: false,
						maxBarThickness: 28,
						stack: 'm',
					},
				].concat(
					FREE
						? []
						: [
								{
									label: 'Add-ons',
									data: addOns,
									backgroundColor: addTone,
									borderRadius: 3,
									borderSkipped: false,
									maxBarThickness: 28,
									stack: 'm',
								},
							],
				),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: animate && !reduce.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: surface,
						titleColor: text,
						bodyColor: text,
						footerColor: text,
						borderColor: css('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: FONT, size: 12, weight: '600' },
						bodyFont: { family: FONT, size: 12 },
						footerFont: { family: FONT, size: 12, weight: '600' },
						callbacks: {
							title: (items) =>
								`${MONTH_NAMES[monthIndex(items[0].dataIndex)]} ${year(items[0].dataIndex)}`,
							label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y)}`,
							footer: (items) => (FREE ? '' : `Total: ${money(t[items[0].dataIndex])}`),
						},
					},
				},
				scales: {
					x: {
						stacked: true,
						grid: { display: false },
						border: { display: false },
						ticks: Object.assign({ maxRotation: 0, autoSkip: true, autoSkipPadding: 8 }, tick),
					},
					y: {
						stacked: true,
						beginAtZero: true,
						grid: { color: tint(text, 0.07) },
						border: { display: false },
						ticks: Object.assign(
							{
								maxTicksLimit: 5,
								callback: (v) => (FREE ? num(v) : v === 0 ? '$0' : `$${Math.round(v / 1000)}k`),
							},
							tick,
						),
					},
				},
			},
		});
	}

	/* Included */
	function drawIncluded() {
		el('blurb').textContent = p.blurb;
		el('includes').innerHTML = p.includes
			.map(
				(x) =>
					`<li><span class="pld-includes-icon" aria-hidden="true"><i class="bi ${x[0]}"></i></span>${htmlSafe(x[1])}</li>`,
			)
			.join('');
		el('addons').innerHTML =
			`<span class="pld-addons-label">${p.addOns.length ? 'Add-ons it can take' : `No add-ons on ${htmlSafe(p.name)}. They start with Basic.`}</span>${p.addOns
				.map((id) => D.addOns.find((a) => a.id === id))
				.map(
					(a) =>
						`<span class="pld-addon"><i class="bi ${a.icon}" aria-hidden="true"></i>${htmlSafe(a.name)}</span>`,
				)
				.join('')}`;
	}

	/* Accounts on this plan */
	function drawAccounts() {
		if (FREE) {
			const busy = p.busiest;
			el('acc-desc').textContent =
				`The ${busy.length} busiest of ${num(p.accounts)}, by visits this month. Free stops at ${p.visitLimit}.`;
			el('acc-caption').textContent = 'The busiest accounts on Free, by visits this month';
			el('acc-col').textContent = 'Visits';
			pick('thead .pld-col-seats', page).textContent = 'People';
			el('acc-link').href = 'trials.html';
			el('acc-link').textContent = 'Trials';
			el('accounts').innerHTML = busy
				.map(
					(a) =>
						`<tr><td><span class="pld-acc-name">${htmlSafe(a[0])}</span><span class="pld-acc-meta">${htmlSafe(a[1])}</span></td><td class="pld-col-seats"><span class="pld-seats"><span class="pld-seats-bar" aria-hidden="true"><span style="--pld-w: ${Math.round((a[2] / p.seatLimit) * 100)}%"></span></span>${a[2]} of ${p.seatLimit} people</span></td><td class="text-end pld-table-mrr">${a[3]}</td></tr>`,
				)
				.join('');
			return;
		}
		const list = D.accounts(p)
			.filter((a) => a.status !== 'trial')
			.slice(0, 6);
		el('acc-desc').textContent = `The ${list.length} biggest of ${num(p.accounts)}, by what they pay a month.`;
		el('accounts').innerHTML = list
			.map((a) => {
				const s = STATUS[a.status];
				return `<tr><td><a class="pld-link pld-acc-name" href="company-details.html?id=${encodeURIComponent(a.id)}">${htmlSafe(a.name)}</a>${s ? `<span class="basalt-status basalt-status-${s[1]} ms-2">${s[0]}</span>` : ''}<span class="pld-acc-meta">${htmlSafe(a.city)}</span></td><td class="pld-col-seats"><span class="pld-seats"><span class="pld-seats-bar" aria-hidden="true"><span style="--pld-w: ${Math.round((a.used / a.seats) * 100)}%"></span></span>${a.used} of ${a.seats} used</span></td><td class="text-end pld-table-mrr">${money(A.listMrr(a))}</td></tr>`;
			})
			.join('');
	}

	/* In and out */
	function drawMoves() {
		const t = D.trend(p);
		const net = t[t.length - 1] - t[t.length - 2];
		const top = Math.max(
			...p.moves.in
				.concat(p.moves.out)
				.map((m) => m[2])
				.concat([Math.abs(p.moves.seats)]),
		);
		if (FREE) {
			const all = p.moves.in.concat(p.moves.out).map((m) => m[1]);
			const most = Math.max(...all);

			function line(m, kind) {
				return `<li class="pld-move pld-move-${kind}"><span class="pld-move-label">${htmlSafe(m[0])}<small>accounts</small></span><span class="pld-move-value">${kind === 'in' ? '+' : '−'}${num(m[1])}</span><span class="pld-move-bar" aria-hidden="true"><span style="--pld-w: ${((m[1] / most) * 100).toFixed(1)}%"></span></span></li>`;
			}

			const c = D.counts(p);
			const delta = c[c.length - 1] - c[c.length - 2];
			el('moves-desc').textContent = `Accounts that joined and left in ${D.month}.`;
			el('moves').innerHTML =
				`<div class="pld-moves-cols"><div><h3>Came in</h3><ul>${p.moves.in.map((m) => line(m, 'in')).join('')}</ul></div><div><h3>Went out</h3><ul>${p.moves.out.map((m) => line(m, 'out')).join('')}</ul></div></div><p class="pld-net"><span>Net change in ${D.month}</span><strong>${delta >= 0 ? '+' : '−'}${num(Math.abs(delta))} accounts</strong></p>`;
			return;
		}

		function row(m, kind) {
			return `<li class="pld-move pld-move-${kind}${m[2] ? '' : ' pld-move-none'}"><span class="pld-move-label">${htmlSafe(m[0])}<small>${m[1] === '' ? 'existing accounts' : m[1] ? m[1] + (m[1] === 1 ? ' account' : ' accounts') : 'none this month'}</small></span><span class="pld-move-value">${m[2] ? (kind === 'in' ? '+' : '−') + money(m[2]) : '$0'}</span>${m[2] ? `<span class="pld-move-bar" aria-hidden="true"><span style="--pld-w: ${((m[2] / top) * 100).toFixed(1)}%"></span></span>` : ''}</li>`;
		}

		const seats = p.moves.seats;
		const seatRow = row(
			[seats >= 0 ? 'More seats' : 'Fewer seats', '', Math.abs(seats)],
			seats >= 0 ? 'in' : 'out',
		);
		el('moves-desc').textContent = `Plan changes in ${D.month}, in monthly revenue.`;
		el('moves').innerHTML =
			`<div class="pld-moves-cols"><div><h3>Came in</h3><ul>${p.moves.in.map((m) => row(m, 'in')).join('')}${seatRow}</ul></div><div><h3>Went out</h3><ul>${p.moves.out.map((m) => row(m, 'out')).join('')}</ul></div></div><p class="pld-net"><span>Net change in ${D.month}</span><strong>${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</strong></p>`;
	}

	/* Price history */
	function drawHistory() {
		if (FREE) {
			el('hist-title').textContent = 'Plan history';
			el('hist-desc').textContent = 'What has changed since it launched.';
		}
		el('history').innerHTML = p.prices
			.map(
				(h, i) =>
					`<li class="pld-history-item${i === 0 ? ' is-now' : ''}${h[4] ? ' is-fresh' : ''}"><span class="pld-history-price">${cents(h[1])}</span><div class="pld-history-body"><span class="pld-history-when">${day(h[0])}${i === 0 ? '<span class="basalt-status basalt-status-success pld-history-now">Now</span>' : ''}</span><span class="pld-history-note">${htmlSafe(h[2])}</span>${h[3] ? `<span class="pld-history-by">${htmlSafe(h[3])}</span>` : ''}</div></li>`,
			)
			.join('');
		p.prices.forEach((h) => {
			h.length = Math.min(h.length, 4);
		});
	}

	/* Edit plan, in place */
	const setup = el('setup');
	const form = el('form');

	function field(name) {
		return pick(`[data-pld-f="${name}"]`, form);
	}

	function priceOf() {
		const v = parseFloat(String(field('price').value).replace(/[^0-9.]/g, ''));
		return v > 0 ? Math.round(v * 100) / 100 : 0;
	}
	function hint() {
		const v = priceOf();
		field('hint').textContent = v
			? `Paid yearly, that is ${cents(Math.round((v * 1000) / 12) / 100)} a seat a month.`
			: 'Paid yearly, a seat costs ten months.';
	}
	function refreshSelects() {
		if (window.Basalt.select && window.Basalt.select.refresh) {
			window.Basalt.select.refresh(field('seats'));
			window.Basalt.select.refresh(field('trial'));
		}
	}
	function editing(on, quiet) {
		setup.classList.toggle('is-editing', on);
		el('facts').hidden = on;
		form.hidden = !on;
		el('edit').hidden = on;
		if (on) {
			field('price').value = cents(p.price).slice(1);
			field('price').classList.remove('is-invalid');
			field('seats').value = p.seatLimit ? String(p.seatLimit) : '';
			if (field('seats').value !== (p.seatLimit ? String(p.seatLimit) : '')) field('seats').value = '';
			field('trial').value = String(p.trialDays);
			field('blurb').value = p.blurb;
			refreshSelects();
			hint();
			/* Opened from another page, the form waits for a click instead of
         taking focus. */
			if (!quiet) field('price').focus();
		} else if (!quiet) {
			el('edit').focus();
		}
	}
	start();
})();
