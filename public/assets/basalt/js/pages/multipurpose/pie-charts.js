/**
 * Pie charts page (pie-charts.html). Thirteen Chart.js pies, every color
 * read from the --basalt-* tokens at draw time. A canvas is drawn the first
 * time it scrolls into view and drawn again after basalt:appearance, so a
 * new palette, mode, background or the Flat switch reaches every slice.
 */
(() => {
	'use strict';

	const pageNode = pick('[data-pies-root]');
	if (!pageNode || typeof Chart === 'undefined') return;

	const stillMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const TYPEFACE = "'Schibsted Grotesk', sans-serif";

	/* The figures behind every pie: $880k of September MRR over 2,140
     accounts, plus this week's 503 orders and 9,030 store visits, which the
     Line charts page shows as well. Most series are [name, value] pairs. */
	const FIXTURES = {
		/* Product, September MRR, accounts on it, change against August. */
		products: [
			['Pro', 360800, 790, 6],
			['Max', 211200, 160, 11],
			['Basic', 167200, 1190, 3],
			['Add-ons', 88000, 610, -4],
			['SMS credits', 52800, 880, 18],
		],
		regions: [
			['Northeast', 920],
			['Midwest', 514],
			['West', 407],
			['South', 299],
		],
		returns: [
			['Damaged in transit', 31],
			['Wrong item', 22],
			['Changed mind', 18],
			['Arrived late', 12],
			['Other', 8],
		],
		delivery: [
			['On time', 412],
			['A day late', 63],
			['Later', 28],
		],
		visits: {
			sources: ['Search', 'Direct', 'Email', 'Social', 'Referral'],
			/* Per period: the visit total, then the share each source took. */
			byPeriod: {
				aug: [8420, [38, 24, 14, 15, 9]],
				sep: [9030, [41, 22, 16, 9, 12]],
			},
		},
		signups: [
			['Search', 26],
			['Social', 33],
			['Content', 16],
			['Partner', 25],
		],
		payments: [
			['Card', 58],
			['Gift card', 7],
			['PayPal', 19],
			['Bank', 4],
			['Apple Pay', 12],
		],
		states: [
			['California', 340],
			['Texas', 180],
			['New York', 140],
			['Colorado', 110],
			['Florida', 80],
			['Oregon', 30],
			['Illinois', 26],
			['Georgia', 22],
			['Washington', 18],
			['Massachusetts', 16],
			['North Carolina', 12],
			['Arizona', 10],
			['Minnesota', 9],
			['Michigan', 7],
		],
		teamSize: [
			['1-5 staff', 22],
			['6-20', 38],
			['21-50', 27],
			['51+', 13],
		],
		rhythm: [
			['Weekly', 18],
			['Biweekly', 41],
			['Monthly', 29],
			['Paused', 12],
		],
		placed: [
			['Website', 307],
			['App', 121],
			['Phone', 45],
			['In the shop', 30],
		],
		plans: [
			['Free', 16],
			['Basic', 33],
			['Pro', 26],
			['Max', 14],
			['On trial', 8],
			['Past due', 3],
		],
		addons: {
			groups: ['Travel Planner', 'Customer Portal', 'SMS credits'],
			/* Two billing parts per group, in group order. */
			parts: [
				['Routing, annual', 330],
				['Routing, monthly', 190],
				['Portal, annual', 230],
				['Portal, monthly', 130],
				['SMS bundle', 150],
				['SMS top-up', 110],
			],
		},
	};
	const MRR_TOTAL = addUp(columnOf(FIXTURES.products, 1));

	/* The value of data-pies-chart on a canvas names the recipe that builds it. */
	const RECIPE_FOR = {
		select: selectableSlices,
		labels: labeledSlices,
		pulled: pulledSlice,
		half: halfCircle,
		period: periodPie,
		basic: plainPie,
		outside: outsideLabels,
		top: topFiveAndRest,
		legend: legendPie,
		custom: shadedPie,
		center: centeredTotal,
		hover: liftOnHover,
		nested: nestedRings,
	};

	/* Tokens come as #rgb, #rrggbb or rgba(); Chart.js needs plain strings,
     so mixing happens here rather than with CSS color-mix(). Each reader
     turns the captured part of its pattern into [r, g, b]. */
	const COLOR_READERS = [
		[/^#([0-9a-f]{3})$/i, (hex) => [...hex].map((digit) => parseInt(digit + digit, 16))],
		[
			/^#([0-9a-f]{6})$/i,
			(hex) => {
				const packed = parseInt(hex, 16);
				return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
			},
		],
		[
			/^rgba?\(([^)]+)\)$/i,
			(inner) =>
				inner
					.split(',')
					.slice(0, 3)
					.map((part) => parseFloat(part)),
		],
	];

	/* Every chart drawn so far, by its canvas, so a theme change can redraw it. */
	const drawn = new Map();

	/* The product picked in the first card; its slice sits out from the rest. */
	let chosen = 0;

	const cardGrid = pick('[data-pies-grid]', pageNode);
	const pieCards = pickAll('.pies-card', cardGrid);
	const countNote = pick('[data-pies-count]', pageNode);

	/**
	 * Wires the page: canvases are drawn as they scroll in and redrawn after
	 * a theme change; the product list and the filter chips get their clicks.
	 */
	function start() {
		const canvases = pickAll('canvas[data-pies-chart]', pageNode);
		if ('IntersectionObserver' in window) {
			const watcher = new IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (!entry.isIntersecting) continue;
						watcher.unobserve(entry.target);
						drawPie(entry.target, true);
					}
				},
				{ rootMargin: '80px 0px' },
			);
			for (const canvas of canvases) watcher.observe(canvas);
		} else {
			for (const canvas of canvases) drawPie(canvas, false);
		}

		document.addEventListener('basalt:appearance', () => {
			/* The tokens change with the attribute; the next frame reads the new ones. */
			requestAnimationFrame(() => {
				for (const canvas of drawn.keys()) drawPie(canvas, false);
			});
		});

		pick('[data-pies-picks]', pageNode)?.addEventListener('click', (event) => {
			const pickButton = event.target.closest('[data-pies-pick]');
			if (pickButton) choose(Number(pickButton.getAttribute('data-pies-pick')));
		});

		for (const filterChip of pickAll('[data-pies-filter]', pageNode)) {
			filterChip.addEventListener('click', () => {
				for (const sibling of pickAll('[data-pies-filter]', pageNode)) {
					sibling.setAttribute('aria-pressed', String(sibling === filterChip));
				}
				showKind(filterChip.getAttribute('data-pies-filter'));
			});
		}
	}

	/**
	 * Builds, or rebuilds, the chart on one canvas from its recipe.
	 * @param {HTMLCanvasElement} canvas
	 * @param {boolean} animate  false on a redraw, so nothing spins twice
	 */
	function drawPie(canvas, animate) {
		const recipe = RECIPE_FOR[canvas.getAttribute('data-pies-chart')];
		if (!recipe) return;
		drawn.get(canvas)?.destroy();
		drawn.set(canvas, new Chart(canvas, recipe(themeNow(), animate && !stillMotion, canvas)));
	}

	/** Marks product `index` as chosen: in the list, the detail panel and the pie. */
	function choose(index) {
		chosen = index;
		const [product, revenue, accounts, change] = FIXTURES.products[index];
		for (const pickButton of pickAll('[data-pies-picks] [data-pies-pick]', pageNode)) {
			pickButton.setAttribute(
				'aria-pressed',
				String(Number(pickButton.getAttribute('data-pies-pick')) === index),
			);
		}
		const detailPanel = pick('[data-pies-detail]', pageNode);
		if (detailPanel) {
			const readout = {
				'[data-pies-detail-name]': product,
				'[data-pies-detail-value]': dollars(revenue),
				'[data-pies-detail-share]': `${Math.round((revenue / MRR_TOTAL) * 100)}%`,
				'[data-pies-detail-orders]': accounts.toLocaleString('en-US'),
				'[data-pies-detail-aov]': `$${(revenue / accounts).toFixed(2)}`,
				'[data-pies-detail-change]': `${change < 0 ? 'Down' : 'Up'} ${Math.abs(change)}%`,
			};
			for (const [hook, words] of Object.entries(readout)) {
				const holder = pick(hook, detailPanel);
				if (holder) holder.textContent = words;
			}
		}
		const pieCanvas = pick('[data-pies-chart="select"]', pageNode);
		drawn.get(pieCanvas)?.update(stillMotion ? 'none' : undefined);
	}

	/** Shows the cards of one chart kind, or every card for "all". */
	function showKind(wanted) {
		const everything = wanted === 'all';
		const kept = [];
		for (const pieCard of pieCards) {
			const keep = everything || pieCard.getAttribute('data-pies-kind') === wanted;
			pieCard.classList.toggle('is-hidden', !keep);
			pieCard.classList.remove('is-alone');
			if (keep) kept.push(pieCard);
		}
		cardGrid.classList.toggle('is-filtered', !everything);
		/* The odd one out of a filtered set takes its whole row. */
		if (!everything && kept.length % 2) kept[kept.length - 1].classList.add('is-alone');
		if (countNote) countNote.textContent = `${kept.length} ${kept.length === 1 ? 'chart' : 'charts'}`;
	}

	/* Colors. */

	/** The handful of colors a chart needs, read from the tokens right now. */
	function themeNow() {
		const ink = readToken('--basalt-copy', '#12233a');
		const faint = readToken('--basalt-copy-muted', '#5f7186');
		const plane = readToken('--basalt-plane', '#ffffff');
		/* The same recipe as --pies-quiet in pie-charts.css: small gray text
       that still clears 4.5:1 on the lighter palettes. */
		const quiet = blend(faint, ink, 0.82);
		return {
			ink,
			quiet,
			plane,
			ramp: [1, 2, 3, 4, 5, 6, 7, 8].map((step) => readToken(`--basalt-series-${step}`, '#2b6fd4')),
			/* --pies-gray in the stylesheet: the slice for everything else. */
			ash: blend(quiet, plane, 0.45),
			rule: readToken('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
		};
	}

	function readToken(cssName, fallback) {
		return window.Basalt.token ? window.Basalt.token(cssName, fallback) : fallback;
	}

	/** [r, g, b] of a token value, or a mid gray when it cannot be read. */
	function rgbOf(tint) {
		const given = String(tint || '').trim();
		for (const [pattern, read] of COLOR_READERS) {
			const hit = pattern.exec(given);
			if (hit) return read(hit[1]);
		}
		return [128, 128, 128];
	}

	/** `share` of the first color over the rest of the second, as rgb(). */
	function blend(fromColor, toColor, share) {
		const fromRgb = rgbOf(fromColor);
		const toRgb = rgbOf(toColor);
		const [r, g, b] = fromRgb.map((figure, i) => Math.round(figure * share + toRgb[i] * (1 - share)));
		return `rgb(${r}, ${g}, ${b})`;
	}

	/* Text on a slice is black or white, whichever contrasts more with it;
     one of the two always clears 4.5:1. */
	function inkFor(tint) {
		const lifted = relativeLuminance(tint) + 0.05;
		return lifted / 0.05 >= 1.05 / lifted ? '#000000' : '#ffffff';
	}

	function relativeLuminance(tint) {
		const [r, g, b] = rgbOf(tint).map((figure) => {
			const part = figure / 255;
			return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}

	/* Small arithmetic over the fixture rows. */

	function columnOf(pairs, index) {
		return pairs.map((row) => row[index]);
	}

	function addUp(figures) {
		return figures.reduce((running, figure) => running + figure, 0);
	}

	function shareOf(figures, index) {
		return Math.round((figures[index] / addUp(figures)) * 100);
	}

	function dollars(number) {
		return `$${Number(number).toLocaleString('en-US')}`;
	}

	/* Pieces of config the recipes share. */

	/** A deep merge of plain objects; arrays and scalars on the right win outright. */
	function layer(under, over) {
		const merged = { ...under };
		for (const [key, incoming] of Object.entries(over || {})) {
			const below = merged[key];
			merged[key] = isPlain(incoming) && isPlain(below) ? layer(below, incoming) : incoming;
		}
		return merged;
	}

	function isPlain(thing) {
		return Boolean(thing) && typeof thing === 'object' && !Array.isArray(thing);
	}

	/** The options every pie starts from: no built-in legend, a themed tooltip. */
	function pieOptions(theme, animate, extra) {
		return layer(
			{
				responsive: true,
				maintainAspectRatio: false,
				animation: animate
					? { duration: 500, easing: 'easeOutQuart', animateRotate: true, animateScale: false }
					: false,
				layout: { padding: 10 },
				plugins: { legend: { display: false }, tooltip: themedTooltip(theme) },
			},
			extra,
		);
	}

	function themedTooltip(theme) {
		return {
			backgroundColor: theme.plane,
			titleColor: theme.ink,
			bodyColor: theme.ink,
			borderColor: theme.rule,
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			boxPadding: 4,
			usePointStyle: true,
			titleFont: { family: TYPEFACE, size: 12, weight: '600' },
			bodyFont: { family: TYPEFACE, size: 12 },
			/* "Midwest: 24%" rather than the raw count. */
			callbacks: { label: (item) => ` ${item.label}: ${shareOf(item.dataset.data, item.dataIndex)}%` },
		};
	}

	/** A tooltip line for a pie of orders: "412 orders, 82%". */
	function ordersLabel(figures) {
		return (item) => ` ${item.raw} orders, ${shareOf(figures, item.dataIndex)}%`;
	}

	/** One ring of slices, parted by thin gaps the color of the card. */
	function sliceRing(theme, figures, tints, extra) {
		return {
			data: figures,
			backgroundColor: tints,
			borderColor: theme.plane,
			borderWidth: 2,
			hoverBorderColor: theme.plane,
			hoverOffset: 6,
			...extra,
		};
	}

	/** The data block of a one-ring pie built from [name, value] rows. */
	function pieData(theme, pairs, tints, extra) {
		return { labels: columnOf(pairs, 0), datasets: [sliceRing(theme, columnOf(pairs, 1), tints, extra)] };
	}

	/* Drawing on the canvas by hand. */

	function typeset(ctx, weight, px) {
		ctx.font = `${weight} ${px}px ${TYPEFACE}`;
	}

	function centerText(ctx, baseline = 'middle') {
		ctx.textAlign = 'center';
		ctx.textBaseline = baseline;
	}

	/** Prints `text` at the middle of an arc, in whichever ink reads on it. */
	function stampOnArc(ctx, arc, words, pieceTint) {
		const spot = arc.tooltipPosition();
		ctx.fillStyle = inkFor(pieceTint);
		ctx.fillText(words, spot.x, spot.y);
	}

	/** Two lines of text on a small card of their own, so they read over any slice. */
	function drawBadge(ctx, theme, x, y, headline, caption) {
		ctx.save();
		typeset(ctx, 700, 16);
		const headWidth = ctx.measureText(headline).width;
		typeset(ctx, 500, 11);
		const badgeWidth = Math.max(headWidth, ctx.measureText(caption).width) + 24;
		const badgeHeight = 44;
		ctx.fillStyle = theme.plane;
		ctx.strokeStyle = theme.rule;
		ctx.lineWidth = 1;
		ctx.beginPath();
		if (ctx.roundRect) ctx.roundRect(x - badgeWidth / 2, y - badgeHeight / 2, badgeWidth, badgeHeight, 12);
		else ctx.rect(x - badgeWidth / 2, y - badgeHeight / 2, badgeWidth, badgeHeight);
		ctx.fill();
		ctx.stroke();
		centerText(ctx);
		ctx.fillStyle = theme.ink;
		typeset(ctx, 700, 16);
		ctx.fillText(headline, x, y - 7);
		ctx.fillStyle = theme.quiet;
		typeset(ctx, 500, 11);
		ctx.fillText(caption, x, y + 11);
		ctx.restore();
	}

	/* The recipes, one per card. Each takes the theme, whether to animate and
     the canvas, and returns a Chart.js config. */

	function selectableSlices(theme, animate) {
		const amounts = columnOf(FIXTURES.products, 1);
		const tints = theme.ramp.slice(0, amounts.length);
		const dimmed = tints.map((tint) => blend(tint, theme.plane, 0.6));
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.products, tints, {
				offset: (piece) => (piece.dataIndex === chosen ? 16 : 0),
				backgroundColor: (piece) => (piece.dataIndex === chosen ? tints : dimmed)[piece.dataIndex],
				hoverOffset: 0,
			}),
			options: pieOptions(theme, animate, {
				layout: { padding: 20 },
				onClick(event, touched) {
					if (touched.length) choose(touched[0].index);
				},
				onHover(event, touched) {
					event.native.target.style.cursor = touched.length ? 'pointer' : 'default';
				},
				plugins: {
					tooltip: {
						callbacks: { label: (item) => ` ${dollars(item.raw)}, ${shareOf(amounts, item.dataIndex)}%` },
					},
				},
			}),
		};
	}

	function labeledSlices(theme, animate) {
		const figures = columnOf(FIXTURES.regions, 1);
		const tints = theme.ramp.slice(0, figures.length);
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.regions, tints),
			options: pieOptions(theme, animate),
			plugins: [
				{
					id: 'piesShare',
					afterDatasetsDraw(pie) {
						const { ctx } = pie;
						ctx.save();
						typeset(ctx, 600, 12.5);
						centerText(ctx);
						for (const [index, arc] of pie.getDatasetMeta(0).data.entries()) {
							/* Too thin for text: the legend and the tooltip cover that slice. */
							if (arc.endAngle - arc.startAngle < 0.4) continue;
							stampOnArc(ctx, arc, `${shareOf(figures, index)}%`, tints[index]);
						}
						ctx.restore();
					},
				},
			],
		};
	}

	function pulledSlice(theme, animate) {
		const figures = columnOf(FIXTURES.returns, 1);
		/* The reason worth acting on keeps a color of its own; the rest go gray. */
		const tints = [
			theme.ramp[5],
			...[0.62, 0.48, 0.36, 0.26].map((share) => blend(theme.quiet, theme.plane, share)),
		];
		const leadShare = shareOf(figures, 0);
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.returns, tints, {
				offset: figures.map((_, index) => (index ? 0 : 18)),
				hoverOffset: 0,
			}),
			/* Turned so the pulled slice sits level on the right. */
			options: pieOptions(theme, animate, { rotation: 90 - (leadShare / 100) * 180, layout: { padding: 20 } }),
			plugins: [
				{
					id: 'piesPulled',
					afterDatasetsDraw(pie) {
						const [arc] = pie.getDatasetMeta(0).data;
						if (!arc) return;
						const { ctx } = pie;
						ctx.save();
						typeset(ctx, 600, 12.5);
						centerText(ctx);
						stampOnArc(ctx, arc, `${leadShare}%`, tints[0]);
						ctx.restore();
					},
				},
			],
		};
	}

	function halfCircle(theme, animate) {
		const figures = columnOf(FIXTURES.delivery, 1);
		const solid = [theme.ramp[2], theme.ramp[4], theme.ramp[5]];
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.delivery, solid, {
				/* Each slice fades a little toward the flat edge; with gradients
				   off it is one plain color. */
				backgroundColor(piece) {
					const tint = solid[piece.dataIndex];
					const fill = window.Basalt.chartFill([
						[0, tint],
						[1, blend(tint, theme.plane, 0.78)],
					]);
					return fill(piece);
				},
			}),
			options: pieOptions(theme, animate, {
				rotation: -90,
				circumference: 180,
				layout: { padding: { top: 10, left: 10, right: 10, bottom: 50 } },
				plugins: { tooltip: { callbacks: { label: ordersLabel(figures) } } },
			}),
			plugins: [
				{
					id: 'piesTotal',
					afterDraw(pie) {
						const [arc] = pie.getDatasetMeta(0).data;
						if (!arc) return;
						const { ctx } = pie;
						ctx.save();
						centerText(ctx, 'top');
						ctx.fillStyle = theme.ink;
						typeset(ctx, 700, 18);
						ctx.fillText(addUp(figures).toLocaleString('en-US'), arc.x, arc.y + 10);
						ctx.fillStyle = theme.quiet;
						typeset(ctx, 500, 11.5);
						ctx.fillText('deliveries this week', arc.x, arc.y + 32);
						ctx.restore();
					},
				},
			],
		};
	}

	function periodPie(theme, animate, canvas) {
		const { sources, byPeriod } = FIXTURES.visits;
		const [visitTotal, shares] = byPeriod[canvas.getAttribute('data-pies-period')] || byPeriod.sep;
		return {
			type: 'pie',
			data: { labels: sources, datasets: [sliceRing(theme, shares, theme.ramp.slice(0, 5))] },
			options: pieOptions(theme, animate, {
				plugins: {
					tooltip: {
						callbacks: {
							label: (item) =>
								` ${item.label}: ${item.raw}%, ${Math.round((item.raw / 100) * visitTotal).toLocaleString('en-US')} visits`,
						},
					},
				},
			}),
		};
	}

	function plainPie(theme, animate) {
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.signups, theme.ramp.slice(0, 4)),
			options: pieOptions(theme, animate),
		};
	}

	function outsideLabels(theme, animate) {
		const methodNames = columnOf(FIXTURES.payments, 0);
		const figures = columnOf(FIXTURES.payments, 1);
		/* Room either side for the widest name, plus its line. */
		const probe = document.createElement('canvas').getContext('2d');
		typeset(probe, 600, 11.5);
		const margin = Math.ceil(Math.max(...methodNames.map((label) => probe.measureText(label).width))) + 34;
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.payments, theme.ramp.slice(0, figures.length), { hoverOffset: 0 }),
			options: pieOptions(theme, animate, {
				layout: { padding: () => ({ left: margin, right: margin, top: 28, bottom: 28 }) },
			}),
			plugins: [
				{
					id: 'piesOutside',
					afterDatasetsDraw(pie) {
						const arcs = pie.getDatasetMeta(0).data;
						if (!arcs.length) return;
						const { x: cx, y: cy, outerRadius: radius } = arcs[0];
						const callouts = arcs.map((arc, index) => tagFor(arc, index, cx, cy, radius));
						for (const onRight of [true, false]) {
							spreadApart(
								callouts.filter((callout) => callout.right === onRight).sort((a, b) => a.y - b.y),
								pie.height - 30,
								26,
							);
						}

						const labelBoxes = [];
						const { ctx } = pie;
						ctx.save();
						ctx.lineWidth = 1;
						ctx.strokeStyle = theme.quiet;
						for (const callout of callouts) {
							const bend = cx + (callout.right ? 1 : -1) * (radius + 22);
							ctx.beginPath();
							ctx.moveTo(callout.ex, callout.ey);
							ctx.lineTo(callout.kx, callout.y);
							ctx.lineTo(bend, callout.y);
							ctx.stroke();
							const textX = bend + (callout.right ? 5 : -5);
							ctx.textAlign = callout.right ? 'left' : 'right';
							ctx.textBaseline = 'middle';
							ctx.fillStyle = theme.ink;
							typeset(ctx, 600, 11.5);
							ctx.fillText(methodNames[callout.i], textX, callout.y - 7);
							const nameWidth = ctx.measureText(methodNames[callout.i]).width;
							ctx.fillStyle = theme.quiet;
							typeset(ctx, 500, 11.5);
							const pct = `${shareOf(figures, callout.i)}%`;
							ctx.fillText(pct, textX, callout.y + 8);
							const textWidth = Math.max(nameWidth, ctx.measureText(pct).width);
							labelBoxes.push({
								left: callout.right ? textX : textX - textWidth,
								right: callout.right ? textX + textWidth : textX,
								top: callout.y - 15,
								bottom: callout.y + 15,
							});
						}
						ctx.restore();
						/* Kept on the chart so a test can check nothing is cut off. */
						pie.$piesLabels = labelBoxes;
					},
				},
			],
		};
	}

	/** Where an outside label wants to sit: the slice edge, its knee and its side. */
	function tagFor(arc, index, cx, cy, radius) {
		const angle = (arc.startAngle + arc.endAngle) / 2;
		const dx = Math.cos(angle);
		const dy = Math.sin(angle);
		return {
			i: index,
			right: dx >= 0,
			ex: cx + dx * radius,
			ey: cy + dy * radius,
			kx: cx + dx * (radius + 10),
			y: cy + dy * (radius + 10),
		};
	}

	/**
	 * Nudges one column of labels apart so none overlap: downward first, back
	 * up if the last one fell past the floor, and never above the ceiling.
	 */
	function spreadApart(column, floor, ceiling) {
		const GAP = 30;
		for (let k = 1; k < column.length; k += 1) {
			if (column[k].y - column[k - 1].y < GAP) column[k].y = column[k - 1].y + GAP;
		}
		const overflow = column.length ? column[column.length - 1].y - floor : 0;
		if (overflow > 0) for (const callout of column) callout.y -= overflow;
		for (let k = column.length - 2; k >= 0; k -= 1) {
			if (column[k + 1].y - column[k].y < GAP) column[k].y = column[k + 1].y - GAP;
		}
		for (const callout of column) callout.y = Math.max(ceiling, callout.y);
	}

	function topFiveAndRest(theme, animate) {
		const ranked = [...FIXTURES.states].sort((a, b) => b[1] - a[1]);
		const leaders = ranked.slice(0, 5);
		const tail = ranked.slice(5);
		const everything = addUp(columnOf(ranked, 1));
		return {
			type: 'pie',
			data: {
				labels: [...columnOf(leaders, 0), `${tail.length} others`],
				datasets: [
					sliceRing(
						theme,
						[...columnOf(leaders, 1), addUp(columnOf(tail, 1))],
						[...theme.ramp.slice(0, 5), theme.ash],
					),
				],
			},
			options: pieOptions(theme, animate, {
				plugins: {
					tooltip: {
						callbacks: {
							/* The gray slice lists what is inside it. */
							afterLabel: (item) =>
								item.dataIndex === 5
									? tail.map(
											([state, sales]) =>
												`   ${state} ${((sales / everything) * 100).toFixed(1)}%`,
										)
									: '',
						},
					},
				},
			}),
		};
	}

	function legendPie(theme, animate, canvas) {
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.teamSize, theme.ramp.slice(0, 4), { hoverOffset: 4 }),
			options: pieOptions(theme, animate, {
				layout: { padding: 6 },
				plugins: {
					legend: {
						display: true,
						position: canvas.getAttribute('data-pies-legend') || 'top',
						labels: {
							color: theme.quiet,
							font: { family: TYPEFACE, size: 11.5 },
							usePointStyle: true,
							pointStyle: 'circle',
							boxWidth: 8,
							boxHeight: 8,
							padding: 10,
						},
					},
				},
			}),
		};
	}

	function shadedPie(theme, animate) {
		/* The same four shades as .pies-s1 to .pies-s4 in pie-charts.css. */
		const shades = [1, 0.7, 0.46, 0.26].map((share) => blend(theme.ramp[7], theme.plane, share));
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.rhythm, shades),
			options: pieOptions(theme, animate),
		};
	}

	function centeredTotal(theme, animate) {
		const figures = columnOf(FIXTURES.placed, 1);
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.placed, theme.ramp.slice(0, 4)),
			options: pieOptions(theme, animate, {
				plugins: { tooltip: { callbacks: { label: ordersLabel(figures) } } },
			}),
			plugins: [
				{
					id: 'piesCenter',
					afterDatasetsDraw(pie) {
						const [arc] = pie.getDatasetMeta(0).data;
						if (arc) drawBadge(pie.ctx, theme, arc.x, arc.y, String(addUp(figures)), 'orders');
					},
				},
			],
		};
	}

	function liftOnHover(theme, animate) {
		return {
			type: 'pie',
			data: pieData(theme, FIXTURES.plans, theme.ramp.slice(0, 6), { hoverOffset: 16 }),
			options: pieOptions(theme, animate, {
				animation: animate
					? { duration: 500, easing: 'easeOutQuart', animateRotate: true, animateScale: true }
					: false,
				layout: { padding: 18 },
				plugins: { tooltip: { callbacks: { label: (item) => ` ${item.raw} workspaces` } } },
			}),
		};
	}

	function nestedRings(theme, animate) {
		const { groups, parts } = FIXTURES.addons;
		const groupColors = theme.ramp.slice(0, 3);
		const partColors = groupColors.flatMap((tint) => [tint, blend(tint, theme.plane, 0.5)]);
		const groupTotals = groups.map((_, index) => parts[index * 2][1] + parts[index * 2 + 1][1]);
		return {
			type: 'pie',
			data: {
				labels: groups,
				datasets: [
					/* The first dataset is drawn as the outer ring. */
					sliceRing(theme, columnOf(parts, 1), partColors, {
						names: columnOf(parts, 0),
						weight: 1,
						hoverOffset: 0,
					}),
					sliceRing(theme, groupTotals, groupColors, { names: groups, weight: 2, hoverOffset: 0 }),
				],
			},
			options: pieOptions(theme, animate, {
				plugins: {
					tooltip: {
						callbacks: {
							title: () => '',
							label: (item) => ` ${item.dataset.names[item.dataIndex]}: ${item.raw} accounts`,
						},
					},
				},
			}),
		};
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
