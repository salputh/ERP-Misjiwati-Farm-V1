/**
 * Basalt - Budget Details
 * One budget in full, opened as budget-details.html?id=<key>
 * (an unknown id opens the first budget). Where the year will
 * end comes first, then each month against an even split, the
 * biggest costs and latest payments, and the budget itself
 * with its notes. The figures come from
 * assets/basalt/js/data/multipurpose/budgets.js, the same record Budgets reads,
 * so both pages always agree.
 */
(() => {
	'use strict';
	const page = pick('[data-bd-root]');
	if (!page || !window.Basalt.data || !window.Basalt.data.budgets) return;

	const D = window.Basalt.data.budgets;

	function start() {
		redraw(true);
		document.addEventListener('basalt:appearance', () => requestAnimationFrame(() => buildChart(false)));
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function el(name) {
		return pick(`[data-bd="${name}"]`, page);
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

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function round100(n) {
		return Math.round(n / 100) * 100;
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const ME = 'John Armstrong';
	const ALERTS = { forecast: 'When the forecast goes over', 90: 'When 90% is used', none: 'Never' };

	const b = D.find(new URLSearchParams(location.search).get('id') || '');

	function nameOf(who) {
		return who === 'me' ? ME : D.people[who].name;
	}

	function iso(d) {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	const TODAY_ISO = iso(D.today);
	function day(s) {
		if (s === TODAY_ISO) return 'Today';
		const [y, m, dd] = s.split('-').map(Number);
		return `${MONTHS[m - 1]} ${dd}${y === D.year ? '' : `, ${y}`}`;
	}

	function stateTag(s) {
		return `<span class="basalt-status basalt-status-${D.statuses[s].tone}">${D.statuses[s].label}</span>`;
	}

	page.style.setProperty('--bd-tone', `var(--basalt-series-${b.tone})`);
	page.style.setProperty('--bd-pace', `${(D.pace * 100).toFixed(1)}%`);
	document.title = `${b.name} budget · Basalt`;

	/* Header */
	function drawHead() {
		const who = D.people[b.owner];
		el('icon').className = `bi bi-${b.icon}`;
		el('name').textContent = b.name;
		el('sub').innerHTML =
			`${D.year} budget · Owned by <a class="bd-link" href="employee-details.html">${htmlSafe(who.name)}</a>, ${htmlSafe(who.title)}`;
	}

	/* Previous and next follow the Budgets page: closest to going over first. */
	const order = D.budgets.slice().sort((x, y) => D.figures(y).forecast / y.amount - D.figures(x).forecast / x.amount);
	const at = order.indexOf(b);

	for (const [name, other, label] of [
		['prev', order[(at - 1 + order.length) % order.length], 'Previous budget: '],
		['next', order[(at + 1) % order.length], 'Next budget: '],
	]) {
		el(name).setAttribute('href', `budget-details.html?id=${encodeURIComponent(other.key)}`);
		el(name).setAttribute('aria-label', label + other.name);
	}

	/* Where the year will end */
	let firstDraw = true;
	function drawYear() {
		const f = D.figures(b);
		const used = Math.round(f.used * 100);
		const gone = Math.round(D.pace * 100);
		const left = b.amount - f.spent;
		el('status').innerHTML = stateTag(f.status);
		el('year-title').textContent =
			f.gap < 0 ? `On course to go ${money(-f.gap)} over` : `On course to finish ${money(f.gap)} under`;
		const monthly = b.amount / 12;
		el('year-lede').textContent =
			`${gone}% of the year has gone. Lately about ${money(round100(f.pace))} a month, ${f.pace > monthly ? 'above' : 'below'} the ${money(monthly)} an even split allows.`;
		el('used').textContent = `${used}%`;
		const width = `${Math.min(100, f.used * 100).toFixed(1)}%`;
		if (firstDraw && !reduce.matches)
			requestAnimationFrame(() => requestAnimationFrame(() => el('meter').style.setProperty('--bd-used', width)));
		else el('meter').style.setProperty('--bd-used', width);
		firstDraw = false;
		el('figs').innerHTML =
			`<div class="bd-fig"><dt>Spent so far</dt><dd class="bd-fig-value">${money(f.spent)}</dd><dd class="bd-fig-note">of ${money(b.amount)}</dd></div><div class="bd-fig"><dt>Year-end forecast</dt><dd class="bd-fig-value">${money(f.forecast)}</dd><dd class="bd-fig-note">At the recent pace</dd></div><div class="bd-fig"><dt>Left to spend</dt><dd class="bd-fig-value">${left < 0 ? '$0' : money(left)}</dd><dd class="bd-fig-note">${left > 0 ? `${money(round100(left / D.monthsLeft))} a month` : `${money(-left)} over already`}</dd></div>`;
	}

	/* Month by month */
	function css(name, fallback) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
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
		const [r, g, bl] = parse(c);
		return `rgba(${r}, ${g}, ${bl}, ${a})`;
	}

	function mix(x, y, share) {
		const p = parse(x);
		const q = parse(y);

		function ch(i) {
			return Math.round(p[i] * share + q[i] * (1 - share));
		}

		return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
	}

	const FONT = "'Schibsted Grotesk', sans-serif";
	let chart = null;

	/* Spent each month, the current month so far; the forecast fills the
     rest of this month and the months to December at the recent pace. */
	function series() {
		const f = D.figures(b);
		const spent = MONTHS.map((_, i) => (i < D.month ? b.months[i] : i === D.month ? b.now : null));
		const forecast = MONTHS.map((_, i) =>
			i < D.month ? null : i === D.month ? f.pace * (1 - D.monthPart) : f.pace,
		);
		return { f, spent, forecast, monthly: b.amount / 12 };
	}

	function buildChart(animate) {
		if (typeof Chart === 'undefined') return;
		if (chart) chart.destroy();
		const s = series();
		el('chart').setAttribute(
			'aria-label',
			`Bar chart of ${b.name} spending each month of ${D.year}, with the forecast to December, against an even monthly pace of ${money(s.monthly)}.`,
		);
		const text = css('--basalt-copy', '#12233a');
		const surface = css('--basalt-plane', '#ffffff');
		const quiet = mix(css('--basalt-copy-muted', '#5f7186'), text, 0.82);
		const tone = css(`--basalt-series-${b.tone}`, '#2b6fd4');
		const tick = { color: quiet, font: { family: FONT, size: 11.5 }, padding: 6 };
		chart = new Chart(el('chart'), {
			data: {
				labels: MONTHS,
				datasets: [
					{
						type: 'bar',
						label: 'Spent',
						data: s.spent,
						backgroundColor: tone,
						borderRadius: 4,
						borderSkipped: false,
						maxBarThickness: 26,
						stack: 'm',
						order: 2,
					},
					{
						type: 'bar',
						label: 'Forecast',
						data: s.forecast,
						backgroundColor: tint(tone, 0.3),
						borderRadius: 4,
						borderSkipped: false,
						maxBarThickness: 26,
						stack: 'm',
						order: 2,
					},
					{
						type: 'line',
						label: 'Even monthly pace',
						data: MONTHS.map(() => s.monthly),
						borderColor: mix(quiet, surface, 0.7),
						borderDash: [5, 4],
						borderWidth: 1.5,
						pointRadius: 0,
						pointHoverRadius: 0,
						order: 1,
					},
				],
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
						borderColor: css('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: FONT, size: 12, weight: '600' },
						bodyFont: { family: FONT, size: 12 },
						filter: (item) => item.raw !== null,
						callbacks: {
							title: (items) =>
								new Date(D.year, items[0].dataIndex, 1).toLocaleDateString('en-US', { month: 'long' }) +
								(items[0].dataIndex === D.month ? `, 1 to ${D.today.getDate()} spent` : ''),
							label: (c) => ` ${c.dataset.label}: ${money(c.parsed.y)}`,
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
							{ maxTicksLimit: 5, callback: (v) => (v === 0 ? '$0' : `$${Math.round(v / 1000)}k`) },
							tick,
						),
					},
				},
			},
		});
	}

	/* Biggest costs */
	function drawCosts() {
		const f = D.figures(b);
		const named = b.costs.reduce((s, c) => s + c[1], 0);
		const rows = b.costs.concat([['Everything else', f.spent - named]]);
		const top = Math.max(...rows.map((c) => c[1]));
		el('costs-desc').textContent = `Where the ${money(f.spent)} went this year.`;
		el('costs').innerHTML = rows
			.map(
				(c) =>
					`<li class="bd-rank-item"><span class="bd-rank-name">${htmlSafe(c[0])}</span><span class="bd-rank-value">${money(c[1])} <span class="bd-rank-share">${Math.round((c[1] / f.spent) * 100)}%</span></span><span class="bd-rank-bar" aria-hidden="true"><span style="--bd-w: ${((c[1] / top) * 100).toFixed(1)}%"></span></span></li>`,
			)
			.join('');
	}

	/* Recent payments */
	function drawRecent() {
		const month = TODAY_ISO.slice(0, 7);
		const now = b.recent.filter((r) => r[0].slice(0, 7) === month).length;
		el('recent-desc').textContent =
			`${new Date(D.year, D.month, 1).toLocaleDateString('en-US', { month: 'long' })} so far: ${money(b.now)} in ${now}${now === 1 ? ' payment.' : ' payments.'}`;
		el('link').setAttribute('href', b.link.href);
		el('link').textContent = b.link.label;
		el('recent').innerHTML = b.recent
			.map(
				(r) =>
					`<tr><td class="bd-table-date">${day(r[0])}</td><td><span class="bd-table-payee">${htmlSafe(r[1])}</span><span class="bd-table-note">${htmlSafe(r[2])}</span></td><td class="text-end bd-table-amount">${money(r[3])}</td></tr>`,
			)
			.join('');
	}

	/* The budget, edited in place */
	const setup = el('setup');
	const form = el('form');

	function field(name) {
		return pick(`[data-bd-f="${name}"]`, form);
	}

	function drawSetup() {
		const who = D.people[b.owner];
		el('setup-desc').textContent = `Set for ${D.year} and split evenly by month.`;
		el('facts').innerHTML =
			`<div class="bd-fact"><dt>Amount for ${D.year}</dt><dd><span class="bd-fact-main">${money(b.amount)}</span><span class="bd-fact-note">${money(b.amount / 12)} a month, ${money(b.amount / 4)} a quarter</span></dd></div><div class="bd-fact"><dt>Owner</dt><dd><span class="bd-fact-main">${htmlSafe(who.name)}</span><span class="bd-fact-note">${htmlSafe(who.title)}, approves spending</span></dd></div><div class="bd-fact"><dt>Alert the owner</dt><dd><span class="bd-fact-main">${ALERTS[b.alert]}</span></dd></div>`;
	}

	field('owner').innerHTML = Object.keys(D.people)
		.map((id) => `<option value="${id}">${htmlSafe(D.people[id].name)}</option>`)
		.join('');

	function amountOf() {
		return parseInt(String(field('amount').value).replace(/[^0-9]/g, ''), 10) || 0;
	}

	function hint() {
		const a = amountOf();
		field('hint').textContent = a
			? `Split evenly, that is ${money(a / 12)} a month.`
			: 'Split evenly across the twelve months.';
	}
	function refreshSelects() {
		if (window.Basalt.select && window.Basalt.select.refresh) {
			window.Basalt.select.refresh(field('owner'));
			window.Basalt.select.refresh(field('alert'));
		}
	}

	function editing(on) {
		setup.classList.toggle('is-editing', on);
		el('facts').hidden = on;
		form.hidden = !on;
		el('edit').hidden = on;
		if (on) {
			field('amount').value = b.amount.toLocaleString('en-US');
			field('amount').classList.remove('is-invalid');
			field('owner').value = b.owner;
			field('alert').value = b.alert;
			refreshSelects();
			hint();
			field('amount').focus();
		} else {
			el('edit').focus();
		}
	}

	el('edit').addEventListener('click', () => editing(true));
	pick('[data-bd-cancel]', form).addEventListener('click', () => editing(false));
	form.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !e.target.closest('.dropdown-menu, [aria-expanded="true"]')) editing(false);
	});
	field('amount').addEventListener('input', () => {
		field('amount').classList.remove('is-invalid');
		hint();
	});
	field('amount').addEventListener('blur', () => {
		const a = amountOf();
		if (a) field('amount').value = a.toLocaleString('en-US');
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const amount = amountOf();
		if (!amount) {
			field('amount').classList.add('is-invalid');
			field('amount').focus();
			return;
		}
		const owner = field('owner').value;
		const changes = [];
		if (amount !== b.amount)
			changes.push(`${amount > b.amount ? 'Raised' : 'Lowered'} from ${money(b.amount)} to ${money(amount)}.`);
		if (owner !== b.owner) changes.push(`Owner changed from ${D.people[b.owner].name} to ${D.people[owner].name}.`);
		if (field('alert').value !== b.alert)
			changes.push(`Alert set to “${ALERTS[field('alert').value].toLowerCase()}”.`);
		Object.assign(b, { amount, owner, alert: field('alert').value });
		if (changes.length)
			b.history.unshift({ date: TODAY_ISO, who: 'me', kind: 'change', text: changes.join(' '), fresh: true });
		editing(false);
		redraw(false);
		toast({
			tone: 'success',
			title: `${b.name} saved`,
			text: changes.length
				? `${money(amount)} for ${D.year}, owned by ${D.people[owner].name}.`
				: 'Nothing changed.',
		});
	});

	/* Notes and changes */
	function drawHistory() {
		el('history').innerHTML = b.history
			.map(
				(h) =>
					`<li class="bd-history-item${h.fresh ? ' is-fresh' : ''}"><span class="bd-history-icon" aria-hidden="true"><i class="bi bi-${h.kind === 'note' ? 'chat-left-text' : 'pencil-square'}"></i></span><div class="bd-history-text"><p class="bd-history-body">${h.kind === 'note' ? '' : '<span class="visually-hidden">Change: </span>'}${htmlSafe(h.text)}</p><span class="bd-history-by">${htmlSafe(nameOf(h.who))}${h.who === 'me' ? ' (you)' : ''} · ${day(h.date)}</span></div></li>`,
			)
			.join('');
		b.history.forEach((h) => {
			delete h.fresh;
		});
	}

	el('note-form').addEventListener('submit', (e) => {
		e.preventDefault();
		const text = el('note').value.trim();
		if (!text) {
			el('note').focus();
			return;
		}
		b.history.unshift({ date: TODAY_ISO, who: 'me', kind: 'note', text, fresh: true });
		el('note').value = '';
		drawHistory();
	});

	/* Draw */
	function redraw(animate) {
		drawHead();
		drawYear();
		buildChart(animate);
		drawCosts();
		drawRecent();
		drawSetup();
		drawHistory();
	}

	start();
})();
