/**
 * Basalt - E-Commerce dashboard
 * The four figure tiles pick what the sales chart shows,
 * built from a day-by-day book for this period and the
 * one before. Orders to handle filter by what they wait
 * on and can be packed or chased; low stock opens a
 * restock drawer that drafts a purchase order; a ring
 * shows how customers paid, and AI suggestions are
 * worked out from the same figures. The best sellers come
 * from the catalog (assets/basalt/js/data/multipurpose/catalog.js):
 * photo, name and units sold, with the revenue each made after
 * discounts from BEST below. In a real deployment, replace DAYS,
 * STOCK, PAID and BEST with figures from your store.
 */
(() => {
	'use strict';
	const page = pick('[data-ec-root]');
	if (!page) return;

	function start() {
		drawBest();
		wireIdeas();

		/* Export */
		const exportButton = pick('[data-ec-export]', page);
		if (exportButton)
			exportButton.addEventListener('click', () => {
				toast({
					tone: 'success',
					title: 'Store summary exported',
					text: 'Sales, orders and stock for the 30 days were saved as a CSV to your downloads.',
				});
			});
	}

	/* What each best seller made in the 30 days, after discounts, by SKU. */
	const BEST = { 'ML-TRCH': 73600, 'ML-BLAZ': 71468, 'ML-ORGZ': 65520, 'ML-GOWN': 53452, 'ML-SUIT': 44100 };

	/** The best sellers as a row of photos, tallest for the one that made most. */
	function drawBest() {
		const list = pick('[data-ec-best]', page);
		const catalog = window.Basalt.data && window.Basalt.data.catalog;
		if (!list || !catalog) return;
		const rows = Object.entries(BEST)
			.map(([sku, revenue]) => ({ product: catalog.find(sku), revenue }))
			.filter((row) => row.product)
			.sort((a, b) => b.revenue - a.revenue);
		const top = rows[0].revenue;
		list.innerHTML = rows
			.map(({ product, revenue }, i) => {
				const href = `product-details.html?sku=${encodeURIComponent(product.sku)}`;
				const each = revenue / product.sold;
				const sub =
					Math.round(each) === product.price
						? `${count(product.sold)} sold at ${money(product.price)}`
						: `${count(product.sold)} sold · ${money(each)} avg`;
				return `<li class="ec-best-row"><a href="${href}" class="ec-best-photo" tabindex="-1" aria-hidden="true"><img src="${htmlSafe(product.photo)}" alt="" loading="lazy" /><span class="ec-best-rank">#${i + 1}</span></a><div class="ec-best-text"><span class="ec-best-value">${money(revenue)}</span><a href="${href}" class="ec-best-name">${htmlSafe(product.name)}</a><span class="ec-best-sub">${sub}</span></div></li>`;
			})
			.join('');
		/* Each photo's height follows its share of the top seller's revenue. */
		pickAll('.ec-best-row', list).forEach((row, i) =>
			row.style.setProperty('--ec-share', (rows[i].revenue / top).toFixed(3)),
		);
		const sum = rows.reduce((n, row) => n + row.revenue, 0);
		pick('[data-ec-best-total]', page).innerHTML = `${money(sum)}<small>from five pieces</small>`;
		(window.Basalt.settled || Promise.resolve()).then(() => list.classList.add('is-drawn'));
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function btnState(btn, state) {
		if (window.Basalt.buttonState) window.Basalt.buttonState(btn, state);
	}

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function count(n) {
		return Math.round(n).toLocaleString('en-US');
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function dayName(d) {
		return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
	}

	/* Daily book
	   September 9 to October 8, 2026, and the 30 days before it
	   (August 10 to September 8): the shop's revenue, orders and returns
	   by the day they came in. Revenue is net of refunds; returns are the
	   refund claims opened that day. The orders table below and
	   assets/basalt/js/data/multipurpose/store.js hold a sample of these
	   orders, not every one. Revenue in dollars. */
	const START = new Date(2026, 8, 9);
	const DAYS = {
		revenue: {
			now: [
				9814.97, 11405.84, 17486.82, 12191.91, 9084.98, 12799.5, 10234.47, 13614.09, 10102.11, 10206.65,
				17831.72, 9021.94, 10613.24, 10145.56, 17225.59, 9162.82, 10452.14, 19581.88, 12089.11, 13686.42,
				13006.15, 17998.08, 9604.06, 18540.09, 11821.55, 14763.59, 11376.42, 14445.08, 15124.46, 12705.76,
			],
			before: [
				8681.67, 7067.26, 12331.93, 12248.56, 10369.22, 17005.85, 14173.29, 7878.56, 9135.83, 7300.46, 13835.72,
				8460.98, 13286.95, 8297.39, 10946.76, 13568.87, 8319.89, 14816.07, 9131.76, 14004.39, 15303.17,
				12883.59, 11477.09, 14622.35, 10981.94, 17827.28, 11272.5, 16218.77, 10734.83, 10297.07,
			],
		},
		orders: {
			now: [7, 8, 13, 9, 7, 9, 7, 10, 7, 7, 13, 6, 8, 7, 12, 7, 8, 14, 9, 10, 9, 13, 7, 13, 9, 11, 8, 10, 11, 9],
			before: [
				6, 5, 9, 9, 8, 13, 10, 6, 7, 5, 10, 6, 10, 6, 8, 10, 6, 11, 7, 10, 11, 9, 8, 11, 8, 14, 8, 12, 8, 8,
			],
		},
		returns: {
			now: [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0],
			before: [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 1],
		},
	};
	function running(list) {
		let t = 0;
		return list.map((v) => (t += v));
	}

	/* Average order so far: revenue to date over orders to date. */
	function average(when) {
		const orders = running(DAYS.orders[when]);
		return running(DAYS.revenue[when]).map((v, i) => v / orders[i]);
	}

	const LABELS = DAYS.revenue.now.map((_, i) =>
		dayName(new Date(START.getFullYear(), START.getMonth(), START.getDate() + i)),
	);
	const PERIOD = 'from September 9 to October 8, against the 30 days before.';
	const MEASURES = {
		revenue: {
			tone: '--basalt-series-1',
			series: (w) => running(DAYS.revenue[w]),
			show: money,
			axis: (v) => (v === 0 ? '$0' : `$${Math.round(v / 1000)}k`),
			step: 30000,
			desc: `Running total ${PERIOD}`,
			word: 'revenue added up day by day',
		},
		orders: {
			tone: '--basalt-series-2',
			series: (w) => running(DAYS.orders[w]),
			show: count,
			axis: String,
			step: 50,
			desc: `Orders added up ${PERIOD}`,
			word: 'orders added up day by day',
		},
		average: {
			tone: '--basalt-series-7',
			series: average,
			show: money,
			axis: (v) => `$${v.toLocaleString('en-US')}`,
			step: 250,
			desc: `Average order so far ${PERIOD}`,
			word: 'the average order so far',
		},
		returns: {
			tone: '--basalt-series-4',
			series: (w) => running(DAYS.returns[w]),
			show: count,
			axis: String,
			step: 4,
			desc: `Returns added up ${PERIOD}`,
			word: 'returns added up day by day',
		},
	};
	let measure = 'revenue';
	const canvas = pick('[data-ec-chart]', page);
	const salesCard = canvas.closest('.ec-card');

	/* What the chart shows
	   The card's line, and the description under its title, follow the
	   chosen tile. */
	function drawMeasure() {
		const m = MEASURES[measure];
		const now = m.series('now').pop();
		const before = m.series('before').pop();
		salesCard.style.setProperty('--ec-now', `var(${m.tone})`);
		pick('[data-ec-desc]', page).textContent = m.desc;
		canvas.setAttribute(
			'aria-label',
			`Line chart of ${m.word}. This period ended at ${m.show(now)} against ${m.show(before)} in the 30 days before.`,
		);
	}

	/* Sales chart */
	const FONT = "'Schibsted Grotesk', sans-serif";

	function token(name, fallback) {
		return window.Basalt.token ? window.Basalt.token(name, fallback) : fallback;
	}

	let chart = null;

	function parse(c) {
		const s = String(c || '').trim();
		let m = /^#([0-9a-f]{6})$/i.exec(s);
		if (m) {
			const n = parseInt(m[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}
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

	function mix(a, b, share) {
		const x = parse(a);
		const y = parse(b);

		function ch(i) {
			return Math.round(x[i] * share + y[i] * (1 - share));
		}

		return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
	}

	function buildChart(animate) {
		if (typeof Chart === 'undefined' || !canvas) return;
		if (chart) chart.destroy();
		const m = MEASURES[measure];
		const now = m.series('now');
		const before = m.series('before');
		const text = token('--basalt-copy', '#12233a');
		const muted = token('--basalt-copy-muted', '#5f7186');
		const quiet = mix(muted, text, 0.82);
		const lineNow = token(m.tone, '#2b6fd4');
		const lineBefore = tint(muted, 0.7);
		const tick = { color: quiet, font: { family: FONT, size: 11.5 }, padding: 6 };
		const all = now.concat(before);
		const top = Math.ceil(Math.max(...all) / m.step) * m.step;
		const fill = window.Basalt.chartFill(
			[
				[0, tint(lineNow, 0.22)],
				[1, tint(lineNow, 0)],
			],
			{ flat: tint(lineNow, 0.12) },
		);
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels: LABELS,
				datasets: [
					{
						label: 'This period',
						data: now,
						borderColor: lineNow,
						backgroundColor: fill,
						fill: 'start',
						borderWidth: 2.5,
						tension: 0.35,
						pointRadius: 0,
						pointHoverRadius: 4,
						pointHoverBackgroundColor: lineNow,
						pointHoverBorderWidth: 0,
					},
					{
						label: '30 days before',
						data: before,
						borderColor: lineBefore,
						borderDash: [5, 4],
						fill: false,
						borderWidth: 2,
						tension: 0.35,
						pointRadius: 0,
						pointHoverRadius: 4,
						pointHoverBackgroundColor: lineBefore,
						pointHoverBorderWidth: 0,
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
						backgroundColor: token('--basalt-plane', '#ffffff'),
						titleColor: text,
						bodyColor: text,
						borderColor: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: FONT, size: 12, weight: '600' },
						bodyFont: { family: FONT, size: 12 },
						callbacks: {
							title: (items) => `Day ${items[0].dataIndex + 1}, to ${items[0].label}`,
							label: (c) => ` ${c.dataset.label}: ${m.show(c.parsed.y)}`,
						},
					},
				},
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: Object.assign({ maxRotation: 0, autoSkipPadding: 18 }, tick),
					},
					y: {
						min: 0,
						max: top,
						grid: { color: tint(text, 0.07) },
						border: { display: false },
						ticks: Object.assign({ stepSize: m.step, callback: m.axis }, tick),
					},
				},
			},
		});
	}

	for (const r of pickAll('input[name="ec-measure"]', page)) {
		r.addEventListener('change', () => {
			if (!r.checked) return;
			measure = r.value;
			drawMeasure();
			if (chart) buildChart(true);
		});
	}

	/* How customers paid
	   Revenue for the 30 days by how each order was paid, from the Store
	   book; it adds up to the Revenue tile. */
	const PAID = [
		{ name: 'Pay by invoice', amount: 238053.25, tone: '--basalt-series-1' },
		{ name: 'Card', amount: 110780.28, tone: '--basalt-series-4' },
		{ name: 'Bank transfer', amount: 20517.73, tone: '--basalt-series-7' },
		{ name: 'Gift card', amount: 16785.47, tone: '--basalt-series-2' },
	];
	const ringCanvas = pick('[data-ec-ring]', page);
	let ring = null;

	function makeRing(animate) {
		if (typeof Chart === 'undefined' || !ringCanvas) return;
		if (ring) ring.destroy();
		const text = token('--basalt-copy', '#12233a');
		const total = PAID.reduce((t, p) => t + p.amount, 0);
		ring = new Chart(ringCanvas, {
			type: 'doughnut',
			data: {
				labels: PAID.map((p) => p.name),
				datasets: [
					{
						data: PAID.map((p) => p.amount),
						backgroundColor: PAID.map((p) => token(p.tone, '#2b6fd4')),
						borderColor: token('--basalt-plane', '#ffffff'),
						borderWidth: 3,
						borderRadius: 4,
						hoverOffset: 4,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '76%',
				animation: animate && !reduce.matches ? { duration: 500, easing: 'easeOutQuart' } : false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: token('--basalt-plane', '#ffffff'),
						titleColor: text,
						bodyColor: text,
						borderColor: token('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
						borderWidth: 1,
						padding: 10,
						cornerRadius: 8,
						boxPadding: 4,
						usePointStyle: true,
						titleFont: { family: FONT, size: 12, weight: '600' },
						bodyFont: { family: FONT, size: 12 },
						callbacks: { label: (c) => ` ${money(c.parsed)}, ${Math.round((c.parsed / total) * 100)}%` },
					},
				},
			},
		});
	}

	/* Each chart draws when it scrolls into view, and again, without
     animation, when the theme changes. */
	function whenSeen(el, draw) {
		if (!el) return;
		if (!('IntersectionObserver' in window)) {
			draw(false);
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return;
				io.disconnect();
				draw(true);
			},
			{ rootMargin: '80px 0px' },
		);
		io.observe(el);
	}

	whenSeen(canvas, buildChart);
	whenSeen(ringCanvas, makeRing);
	document.addEventListener('basalt:appearance', () => {
		requestAnimationFrame(() => {
			if (chart) buildChart(false);
			if (ring) makeRing(false);
		});
	});

	/* Orders to handle */
	const rows = pickAll('[data-ec-orders] > tr', page);

	for (const r of pickAll('input[name="ec-orders"]', page)) {
		r.addEventListener('change', () => {
			if (!r.checked) return;

			for (const row of rows) {
				row.hidden = r.value !== 'all' && row.dataset.ecKind !== r.value;
			}
		});
	}

	/* A finished action leaves a quiet note in the button's place, so
     the row can't be acted on twice and the column keeps its width.
     A keyboard user's focus moves on to the row's link, if it has one. */
	function markDone(btn, label) {
		const done = document.createElement('span');
		done.className = 'ec-done';
		const icon = document.createElement('i');
		icon.className = 'bi bi-check2';
		icon.setAttribute('aria-hidden', 'true');
		done.append(icon, label);
		const next = btn.matches(':focus-visible') ? pick('a', btn.closest('tr, li')) : null;
		btn.replaceWith(done);
		if (next) next.focus();
	}

	for (const btn of pickAll('[data-ec-pack]', page)) {
		btn.addEventListener('click', () => {
			const row = btn.closest('tr');
			const pill = pick('[data-ec-status]', row);
			pill.classList.replace('basalt-status-info', 'basalt-status-success');
			pill.textContent = 'Packed';
			markDone(btn, 'Packed');
			toast({
				tone: 'success',
				icon: 'bi-box-seam',
				title: `${btn.dataset.ecPack} is packed`,
				text: 'It goes out with today’s courier collection at 3:00 pm.',
			});
		});
	}

	for (const btn of pickAll('[data-ec-remind]', page)) {
		btn.addEventListener('click', () => {
			markDone(btn, 'Reminded');
			toast({
				tone: 'success',
				title: `Reminder sent to ${btn.dataset.ecRemind}`,
				text: 'They’ll get the order again with a link to pay online.',
			});
		});
	}

	/* Running low
	   perWeek is the average over the 30 days; a suggested order
	   covers 60 days of sales, rounded up to the supplier's case of 10. */
	const TODAY = new Date(2026, 9, 9);
	const COVER_DAYS = 60;
	/* `left` is what is free to sell across the four warehouses, as on
     Stock Levels; cost and lead time are the supplier's, as on Purchase Orders. */
	const STOCK = {
		'ML-SHLD': {
			name: 'Shield Sunglasses',
			left: 0,
			perWeek: 9,
			supplier: 'Fairhaven Optical',
			cost: 208,
			leadDays: 18,
			outSince: 'Sep 30',
		},
		'ML-CATE': {
			name: 'Cat-Eye Sunglasses',
			left: 19,
			perWeek: 3,
			supplier: 'Fairhaven Optical',
			cost: 186,
			leadDays: 18,
		},
		'ML-BLAZ': {
			name: 'Sculpted Shoulder Blazer',
			left: 174,
			perWeek: 16,
			supplier: 'Hollis Atelier',
			cost: 516,
			leadDays: 21,
		},
		'ML-OXFD': { name: 'Two-Tone Oxfords', left: 282, perWeek: 16, supplier: 'Marlo', cost: 340, leadDays: 7 },
		'ML-SUIT': {
			name: 'Chalk-Stripe Suit',
			left: 96,
			perWeek: 4,
			supplier: 'Willamette Tailors',
			cost: 980,
			leadDays: 14,
		},
	};

	function perDay(s) {
		return s.perWeek / 7;
	}

	let nextPo = 1045;

	const drawer = pick('#shop-restock');
	const form = pick('[data-ec-restock-form]', drawer);

	function field(k) {
		return pick(`[data-ec-r="${k}"]`, drawer);
	}

	const qty = field('qty');
	const save = field('save');
	let current = null;
	let opener = null;

	function shiftDays(n) {
		return new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + n);
	}

	function drawTotals() {
		const s = STOCK[current];
		const n = Math.max(0, parseInt(qty.value, 10) || 0);
		const days = Math.floor((s.left + n) / perDay(s));
		field('cover').textContent = n
			? `With what’s left, that covers about ${days} days of sales.`
			: 'Choose how many to order.';
		field('total').textContent = money(n * s.cost);
	}

	function openRestock(sku, btn) {
		const s = STOCK[sku];
		current = sku;
		opener = btn;
		const suggest = Math.ceil((perDay(s) * COVER_DAYS - s.left) / 10) * 10;
		field('title').textContent = `Restock ${s.name}`;
		field('sub').textContent = `SKU ${sku}`;
		field('lead').innerHTML = '';
		const strong = document.createElement('strong');
		if (s.left === 0) {
			strong.textContent = 'Sold out.';
			field('lead').append(strong, ` It sold about ${s.perWeek} a week before it ran out on ${s.outSince}.`);
		} else {
			const out = shiftDays(Math.round(s.left / perDay(s)));
			strong.textContent = `${s.left} left,`;
			field('lead').append(
				strong,
				` selling about ${s.perWeek} a week. At that pace it runs out around ${dayName(out)}.`,
			);
		}
		qty.value = suggest;
		field('supplier').textContent = s.supplier;
		field('cost').textContent = money(s.cost);
		field('arrives').textContent = `${dayName(shiftDays(s.leadDays))}, in ${s.leadDays} days`;
		btnState(save, 'idle');
		drawTotals();
		window.bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}

	qty.addEventListener('input', drawTotals);
	qty.addEventListener('change', drawTotals);

	for (const btn of pickAll('[data-ec-restock]', page)) {
		btn.addEventListener('click', () => {
			openRestock(btn.closest('[data-ec-sku]').dataset.ecSku, btn);
		});
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		if (save.getAttribute('aria-busy') === 'true') return;
		const s = STOCK[current];
		const n = Math.max(0, parseInt(qty.value, 10) || 0);
		if (!n) {
			qty.focus();
			return;
		}
		const po = `#${nextPo++}`;
		const arrives = dayName(shiftDays(s.leadDays));
		btnState(save, 'loading');
		setTimeout(() => {
			btnState(save, 'success');
			setTimeout(
				() => {
					window.bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
					const row = opener.closest('[data-ec-sku]');
					const pill = pick('.basalt-status', row);
					pill.className = 'basalt-status basalt-status-success';
					pill.textContent = 'On order';
					markDone(opener, 'Ordered');
					toast({
						tone: 'success',
						icon: 'bi-send',
						title: `${po} sent to ${s.supplier}`,
						text: `${n} × ${s.name}, ${money(n * s.cost)}. Expected by ${arrives}.`,
					});
				},
				reduce.matches ? 150 : 550,
			);
		}, 700);
	});

	/* AI suggestions
	   Worked out from DAYS, STOCK and the tables on the page, problems
	   first. Each links to the page where it is done; Dismiss brings in
	   the next. Nothing is stored. */
	function total(list) {
		return list.reduce((sum, value) => sum + value, 0);
	}

	function suggestions() {
		const ideas = [];
		const returned = total(DAYS.returns.now);
		const returnedBefore = total(DAYS.returns.before);
		if (returned > returnedBefore * 1.5) {
			ideas.push({
				id: 'returns',
				kind: 'problem',
				icon: 'bi-arrow-return-left',
				title: `Returns rose to ${returned}`,
				why: `${returnedBefore} in the 30 days before.`,
				href: 'returns.html',
				go: 'Returns',
			});
		}
		const unpaid = pickAll('[data-ec-orders] > tr[data-ec-kind="unpaid"]', page).map((row) => ({
			id: pick('.ec-table-id', row).textContent.trim(),
			amount: Number(pick('.ec-table-amount', row).textContent.replace(/[^\d.]/g, '')),
		}));
		if (unpaid.length) {
			ideas.push({
				id: 'unpaid',
				kind: 'problem',
				icon: 'bi-credit-card',
				title: `${unpaid.length} ${unpaid.length === 1 ? 'order awaits' : 'orders await'} payment`,
				why: `${money(total(unpaid.map((order) => order.amount)))} on ${unpaid.map((order) => order.id).join(' and ')}.`,
				href: 'orders.html',
				go: 'Orders',
			});
		}
		const perOrder = average('now').pop();
		const perOrderBefore = average('before').pop();
		if (perOrder < perOrderBefore * 0.95) {
			ideas.push({
				id: 'average',
				kind: 'problem',
				icon: 'bi-receipt',
				title: 'Smaller orders',
				why: `${money(perOrder)} on average, down from ${money(perOrderBefore)}.`,
				href: 'sales-insights.html',
				go: 'Analytics',
			});
		}
		const revenue = total(DAYS.revenue.now);
		const revenueBefore = total(DAYS.revenue.before);
		if (revenue > revenueBefore) {
			ideas.push({
				id: 'revenue',
				kind: 'win',
				icon: 'bi-graph-up-arrow',
				title: `Revenue up ${Math.round((revenue / revenueBefore - 1) * 100)}%`,
				why: `${money(revenue)}, was ${money(revenueBefore)}.`,
				href: 'revenue-insights.html',
				go: 'Revenue',
			});
		}
		const top = pick('.ec-best-row', page);
		if (top) {
			const name = pick('.ec-best-name', top).textContent.trim();
			const sku = new URL(pick('.ec-best-name', top).href).searchParams.get('sku');
			const sold = Number(pick('.ec-best-value', top).textContent.replace(/[^\d.]/g, ''));
			const stock = STOCK[sku];
			ideas.push({
				id: 'top',
				kind: 'win',
				icon: 'bi-star',
				title: `${name.split(' ').pop()} is ${Math.round((sold / revenue) * 100)}% of sales`,
				why: stock
					? `${stock.left} left, ${Math.floor(stock.left / perDay(stock))} days of stock.`
					: `${money(sold)} in the 30 days.`,
				href: pick('.ec-best-name', top).getAttribute('href'),
				go: 'Product',
			});
		}
		const orders = total(DAYS.orders.now);
		ideas.push({
			id: 'orders',
			kind: 'win',
			icon: 'bi-bag-check',
			title: `${orders} orders, up from ${total(DAYS.orders.before)}`,
			why: `Orders came in on ${DAYS.orders.now.filter(Boolean).length} of 30 days.`,
			href: 'orders.html',
			go: 'Orders',
		});
		return [...ideas.filter((idea) => idea.kind === 'problem'), ...ideas.filter((idea) => idea.kind !== 'problem')];
	}

	function htmlSafe(value) {
		const holder = document.createElement('span');
		holder.textContent = value;
		return holder.innerHTML;
	}

	function wireIdeas() {
		const list = pick('[data-ec-ideas]', page);
		const wait = pick('[data-ec-thinking]', page);
		if (!list) return;
		const queue = suggestions();
		const shown = queue.splice(0, 4);
		const draw = () => {
			list.innerHTML = shown
				.map(
					(idea, at) =>
						`<li class="basalt-idea${idea.kind === 'problem' ? ' is-problem' : ''}" style="--i: ${at}" data-idea="${idea.id}"><span class="basalt-idea-icon" aria-hidden="true"><i class="bi ${idea.icon}"></i></span><p class="basalt-idea-title">${htmlSafe(idea.title)}</p><p class="basalt-idea-why"><span class="basalt-idea-kind">${idea.kind === 'problem' ? 'Problem' : 'Working'}</span>${htmlSafe(idea.why)}</p><span class="basalt-idea-actions"><a href="${idea.href}" class="btn btn-outline-secondary btn-sm">${idea.go}</a><button type="button" class="btn btn-sm ec-idea-drop" data-ec-drop aria-label="Dismiss" title="Dismiss"><i class="bi bi-x-lg" aria-hidden="true"></i></button></span></li>`,
				)
				.join('');
			if (!shown.length) list.innerHTML = `<li class="ec-ideas-done">Nothing else for now.</li>`;
		};
		setTimeout(
			() => {
				wait.hidden = true;
				list.hidden = false;
				draw();
			},
			reduce.matches ? 200 : 500,
		);
		list.addEventListener('click', (event) => {
			const row = event.target.closest('[data-idea]');
			if (!row || !event.target.closest('[data-ec-drop]')) return;
			shown.splice(
				shown.findIndex((idea) => idea.id === row.dataset.idea),
				1,
			);
			if (queue.length) shown.push(queue.shift());
			draw();
		});
	}

	start();
})();
