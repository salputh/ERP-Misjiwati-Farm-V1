/**
 * Basalt - AI Assistant (ai-assistant.html)
 * A chat for asking about the business in plain words. Recent chats
 * sit beside the open conversation; an empty chat offers suggested
 * questions.
 *
 * This is a demo: nothing is sent anywhere. Each answer is worked out
 * from the shared data files (accounts.js, billing.js, plans.js and
 * trials.js), so its figures match the pages it links to, and each
 * has two wordings so Regenerate gives a different one. In your app,
 * replace answer() with a call to your assistant's API and render
 * what it returns the same way: text, then an optional chart or
 * table, then where the numbers came from.
 */
(() => {
	'use strict';
	const root = pick('[data-ai-root]');
	if (!root) return;

	const D = window.Basalt.data || {};
	const A = D.accounts;
	const B = D.billing;
	const P = D.plans;
	const T = D.trials;
	const AS = D.assistant;
	if (!A || !B || !P || !T || !AS) return;

	function start() {
		el.input.addEventListener('input', () => {
			el.send.disabled = busy || !el.input.value.trim();
			fit();
		});
		el.input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
				e.preventDefault();
				el.form.requestSubmit();
			}
		});
		el.form.addEventListener('submit', (e) => {
			e.preventDefault();
			const text = el.input.value;
			if (!text.trim() || busy) return;
			el.input.value = '';
			fit();
			el.send.disabled = true;
			ask(text);
		});

		/* Start */
		drawChats();
		drawChat();
	}

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

	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		return window.Basalt.announce ? window.Basalt.announce(t) : null;
	}

	const el = {
		feed: pick('[data-ai-feed]', root),
		chats: pick('[data-ai-chats]', root),
		title: pick('[data-ai-title]', root),
		form: pick('[data-ai-form]', root),
		input: pick('[data-ai-input]', root),
		send: pick('[data-ai-send]', root),
		rail: pick('#ai-chats', root),
	};

	/* Formatting */
	const TODAY = AS.today;
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
	function toDate(s) {
		const [y, m, d] = s.slice(0, 10).split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	function dayGap(a, b) {
		return Math.round((toDate(b) - toDate(a)) / 86400000);
	}

	function day(iso) {
		return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
	}

	function num(n) {
		return n.toLocaleString('en-US');
	}

	function money(n) {
		return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	}

	function whole(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function short(n) {
		return n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`;
	}

	function pct(n) {
		return `${Math.round(n * 100)}%`;
	}

	const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many || `${one}s`}`;
	}

	function clock(at) {
		const h = Number(at.slice(11, 13));
		const m = at.slice(14, 16);
		return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
	}
	/* When a chat was last used, as Recent chats shows it. */
	function when(at) {
		const ago = dayGap(at, TODAY);
		if (ago <= 0) return clock(at);
		if (ago === 1) return 'Yesterday';
		return day(at);
	}
	/* The demo's clock: 10:40 AM on its "today" when the page opened,
     moving on with the real minutes since. */
	const opened = Date.now();
	function now() {
		const mins = 10 * 60 + 40 + Math.floor((Date.now() - opened) / 60000);
		return `${TODAY}T${String(Math.min(23, Math.floor(mins / 60))).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
	}
	const asOf = `as of ${day(TODAY)}, ${TODAY.slice(0, 4)}`;

	/* Links to records */
	function link(href, text) {
		return `<a class="ai-link" href="${href}">${htmlSafe(text)}</a>`;
	}

	function accountLink(a) {
		return link(`company-details.html?id=${encodeURIComponent(a.id)}`, a.name);
	}

	function planLink(p) {
		return link(`plan-details.html?id=${encodeURIComponent(p.id)}`, p.name);
	}

	const PLAN_NAMES = { free: 'Free', starter: 'Basic', growth: 'Pro', enterprise: 'Max' };

	function leaving(a) {
		return /^cancel/.test(a.status);
	}

	/* Answers
	   Each returns { html, plain, figure, source }:
	     html     the text, with links to the records it names
	     plain    the same answer as plain text, for Copy
	     figure   null, { chart } or { table }, drawn under the first paragraph
	     source   [page name, page link] the numbers came from
	   v picks the wording (0 or 1). */
	function strip(html) {
		return html
			.replace(/<\/p>\s*<p>/g, '\n\n')
			.replace(/<[^>]+>/g, '')
			.replace(/&amp;/g, '&')
			.replace(/&#39;/g, "'")
			.replace(/&quot;/g, '"')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>');
	}

	function tablePlain(t) {
		return [t.head.map((h) => h[0]).join('\t')]
			.concat(t.rows.map((r) => r.cells.map((c) => strip(c)).join('\t')))
			.join('\n');
	}

	const ANSWERS = {
		mrr(v) {
			const paying = P.plans
				.filter((p) => p.price > 0)
				.slice()
				.sort((x, y) => y.mrr - x.mrr || y.accounts - x.accounts);
			const tot = P.totals();
			const free = P.plans.find((p) => p.price === 0);
			const [first, second, third] = paying;
			const lead =
				v === 0
					? `<p>MRR closed ${P.month} at <strong>${short(tot.mrr)}</strong> from ${num(tot.accounts)} paying accounts. ${planLink(first)} and ${planLink(second)} bring in ${short(first.mrr)}${first.mrr === second.mrr ? ' each' : ` and ${short(second.mrr)}`}, and ${planLink(third)} ${short(third.mrr)}.</p>`
					: `<p>Of the <strong>${short(tot.mrr)}</strong> a month, ${paying
							.map((p) => `${planLink(p)} brings in ${pct(p.mrr / tot.mrr)}`)
							.join(', ')
							.replace(/, ([^,]*)$/, ' and $1')}.</p>`;
			const tail =
				v === 0
					? `<p>${planLink(paying.find((p) => p.id === 'enterprise'))} earns that from ${num(paying.find((p) => p.id === 'enterprise').accounts)} accounts, against ${num(paying.find((p) => p.id === 'growth').accounts)} on Pro. The ${num(free.accounts)} accounts on Free pay nothing yet.</p>`
					: `<p>Per account, ${paying
							.map((p) => `${p.name} pays about ${whole(p.mrr / p.accounts)}`)
							.join(', ')
							.replace(/, ([^,]*)$/, ' and $1')} a month.</p>`;
			return {
				lead,
				tail,
				figure: {
					chart: {
						title: `MRR by plan, end of ${P.month}`,
						type: 'hbar',
						labels: paying.map((p) => p.name),
						data: paying.map((p) => p.mrr),
						tones: paying.map((p) => p.tone),
						fmt: whole,
						tick: short,
						aria: `Bar chart of MRR by plan at the end of ${P.month}: ${paying.map((p) => `${p.name} ${whole(p.mrr)}`).join(', ')}.`,
					},
				},
				source: ['Subscription Plans', 'subscription-plans.html'],
			};
		},

		overdue(v) {
			const late = B.invoices()
				.filter((i) => i.state === 'sent' && i.due && i.due < TODAY)
				.map((i) => Object.assign(i, { late: dayGap(i.due, TODAY) }));
			late.sort(v === 0 ? (x, y) => y.late - x.late : (x, y) => y.amount - x.amount);
			const total = late.reduce((s, i) => s + i.amount, 0);
			const declined = late.filter((i) => i.declined).length;
			const reminded = late.filter((i) => i.reminded).length;
			const top = late[0];

			function acct(i) {
				return link(`company-details.html?id=${encodeURIComponent(i.acct)}`, i.customer);
			}

			if (!late.length)
				return {
					lead: '<p>Nothing is overdue. Every invoice sent has been paid or is not due yet.</p>',
					tail: '',
					figure: null,
					source: ['Invoices', 'invoices.html'],
				};
			const lead =
				v === 0
					? `<p><strong>${plural(late.length, 'invoice')}</strong> ${late.length === 1 ? 'is' : 'are'} past due, <strong>${money(total)}</strong> in all. The oldest is from ${acct(top)}, ${plural(top.late, 'day')} late.</p>`
					: `<p>${acct(top)} owes the most: <strong>${money(top.amount)}</strong>, ${plural(top.late, 'day')} late. All ${late.length} overdue invoices add up to ${money(total)}.</p>`;
			const tail =
				v === 0
					? `<p>${declined ? `${declined} of them ${declined === 1 ? 'is a renewal' : 'are renewals'} where the card was declined.` : 'None of them had a declined card.'}</p>`
					: `<p>${reminded ? `A reminder has gone out for ${reminded} of them. ` : ''}Open an invoice to send a reminder or take a payment.</p>`;
			return {
				lead,
				tail,
				figure: {
					table: {
						caption: v === 0 ? 'Overdue invoices, oldest first' : 'Overdue invoices, largest first',
						head: [['Account'], ['Invoice', '', true], ['Late', 'end'], ['Amount', 'end']],
						rows: late.map((i) => ({
							href: `invoice-details.html?id=${encodeURIComponent(i.no)}`,
							cells: [
								acct(i),
								link(`invoice-details.html?id=${encodeURIComponent(i.no)}`, i.no),
								plural(i.late, 'day'),
								money(i.amount),
							],
						})),
					},
				},
				source: ['Invoices', 'invoices.html'],
			};
		},

		churn(v) {
			const all = A.list();
			const risk = all.filter((a) => a.status !== 'trial' && !leaving(a) && a.health !== null && a.health < 45);
			risk.sort(v === 0 ? (x, y) => A.mrr(y) - A.mrr(x) : (x, y) => x.health - y.health);
			const gone = all.filter(leaving).sort((x, y) => (x.statusOn || '').localeCompare(y.statusOn || ''));
			const worth = risk.reduce((s, a) => s + A.mrr(a), 0);
			const top = risk[0];
			const lead =
				v === 0
					? `<p><strong>${plural(risk.length, 'account')}</strong> score under 45 for health, worth <strong>${whole(worth)}</strong> a month together. The biggest is ${accountLink(top)} at ${whole(A.mrr(top))} a month.</p>`
					: `<p>The lowest health score is ${accountLink(top)} at ${top.health}: they use ${top.used} of ${top.seats} seats. In all, ${plural(risk.length, 'account')} score under 45.</p>`;
			const tail = gone.length
				? `<p>${v === 0 ? `${COUNT[gone.length] || gone.length} more ${gone.length === 1 ? 'is' : 'are'} already leaving: ` : 'Already leaving, so not counted: '}${gone.map((a) => `${accountLink(a)} on ${day(a.statusOn)}`).join(' and ')}.</p>`
				: '';

			function tone(h) {
				return h < 40 ? 'danger' : 'warning';
			}

			return {
				lead,
				tail,
				figure: {
					table: {
						caption: v === 0 ? 'Accounts at risk, largest first' : 'Accounts at risk, lowest health first',
						head: [['Account'], ['Health'], ['Seats used', 'end', true], ['MRR', 'end']],
						rows: risk.map((a) => ({
							href: `company-details.html?id=${encodeURIComponent(a.id)}`,
							cells: [
								accountLink(a),
								`<span class="basalt-status basalt-status-${tone(a.health)}">${a.health}</span>`,
								`${a.used} of ${a.seats}`,
								whole(A.mrr(a)),
							],
						})),
					},
				},
				source: ['Companies', 'companies.html'],
			};
		},

		addons(v) {
			const list = P.addOns.slice().sort((x, y) => y.mrr - x.mrr);
			const total = list.reduce((s, a) => s + a.mrr, 0);
			const most = list.slice().sort((x, y) => y.accounts - x.accounts)[0];
			const [first, second] = list;

			function change(c) {
				return `${(c >= 0 ? 'up ' : 'down ') + Math.abs(c)}%`;
			}

			const lead =
				v === 0
					? `<p>${htmlSafe(first.name)} earns the most: <strong>${whole(first.mrr)}</strong> a month from ${num(first.accounts)} accounts, ${change(first.change)} on ${P.prevMonth}. ${htmlSafe(second.name)} is next at ${whole(second.mrr)}.</p>`
					: `<p>Together, add-ons bring in <strong>${whole(total)}</strong> a month, about ${pct(total / P.totals().mrr)} of MRR. ${htmlSafe(first.name)} is the largest share.</p>`;
			const tail =
				v === 0
					? most.id !== first.id
						? `<p>${htmlSafe(most.name)} is on the most accounts, ${num(most.accounts)}, but earns ${whole(most.mrr)}, ${change(most.change)}.</p>`
						: ''
					: `<p>Per account, ${list
							.map((a) => `${a.name} earns ${whole(a.mrr / a.accounts)}`)
							.join(', ')
							.replace(/, ([^,]*)$/, ' and $1')} a month.</p>`;
			return {
				lead,
				tail,
				figure: {
					chart: {
						title: `Add-on revenue a month, ${P.month}`,
						type: 'hbar',
						labels: list.map((a) => a.name),
						data: list.map((a) => a.mrr),
						tones: [5, 3, 7],
						fmt: whole,
						tick: short,
						aria: `Bar chart of add-on revenue a month in ${P.month}: ${list.map((a) => `${a.name} ${whole(a.mrr)}`).join(', ')}.`,
					},
				},
				source: ['Subscription Plans', 'subscription-plans.html'],
			};
		},

		trials(v) {
			const end = T.addDays(TODAY, 7);
			const soon = T.list().filter((t) => t.status === 'running' && T.ends(t) <= end);
			soon.sort(
				v === 0
					? (x, y) => T.ends(x).localeCompare(T.ends(y))
					: (x, y) => T.done(x) - T.done(y) || T.ends(x).localeCompare(T.ends(y)),
			);

			function trialLink(t) {
				return link(`trial-details.html?id=${encodeURIComponent(t.id)}`, t.name);
			}

			const top = soon[0];
			function ends(t) {
				const d = dayGap(TODAY, T.ends(t));
				return d === 0 ? 'today' : d === 1 ? 'tomorrow' : `on ${day(T.ends(t))}`;
			}
			const behind = soon.filter((t) => T.done(t) <= 2).length;
			const ahead = soon.length - behind;
			if (!soon.length)
				return {
					lead: '<p>No trials end in the next 7 days.</p>',
					tail: '',
					figure: null,
					source: ['Trials', 'trials.html'],
				};
			const lead =
				v === 0
					? `<p><strong>${plural(soon.length, 'trial')}</strong> end in the next 7 days. ${trialLink(top)} ends first, ${ends(top)}, with ${T.done(top)} of 4 set-up steps done.</p>`
					: `<p>${behind} of the ${soon.length} trials ending this week have done 2 set-up steps or fewer. ${trialLink(top)} is furthest behind: ${T.done(top)} of 4, and it ends ${ends(top)}.</p>`;
			const tail =
				v === 0
					? `<p>${plural(ahead, 'team has', 'teams have')} done 3 or more steps. Teams that finish all four nearly always pay.</p>`
					: '<p>A short nudge email from the trial page helps a team with its next step.</p>';
			return {
				lead,
				tail,
				figure: {
					table: {
						caption:
							v === 0
								? 'Trials ending in 7 days, soonest first'
								: 'Trials ending in 7 days, fewest steps first',
						head: [['Trial'], ['Plan', '', true], ['Ends'], ['Set-up', 'end']],
						rows: soon.map((t) => ({
							href: `trial-details.html?id=${encodeURIComponent(t.id)}`,
							cells: [trialLink(t), PLAN_NAMES[t.plan] || t.plan, day(T.ends(t)), `${T.done(t)} of 4`],
						})),
					},
				},
				source: ['Trials', 'trials.html'],
			};
		},

		growth(v) {
			const paying = P.plans.filter((p) => p.price > 0);
			const series = P.months.map((m, i) => paying.reduce((s, p) => s + P.trend(p)[i], 0));
			const firstYear = 2025;

			function label(i) {
				return `${P.months[i]} ${i < 3 ? firstYear : firstYear + 1}`;
			}

			function longLabel(i) {
				return `${MONTH_NAMES[MONTHS.indexOf(P.months[i])]} ${i < 3 ? firstYear : firstYear + 1}`;
			}

			const start = series[0];
			const endV = series[series.length - 1];
			let jump = 1;
			series.forEach((x, i) => {
				if (i && x - series[i - 1] > series[jump] - series[jump - 1]) jump = i;
			});
			const byGrowth = paying.map((p) => ({ p, g: p.mrr / P.trend(p)[0] - 1 })).sort((x, y) => y.g - x.g);
			const lead =
				v === 0
					? `<p>MRR grew from <strong>${short(start)}</strong> in ${longLabel(0)} to <strong>${short(endV)}</strong> in ${longLabel(series.length - 1)}, up ${pct(endV / start - 1)}.</p>`
					: `<p>Over the last 12 months MRR added <strong>${short(endV - start)}</strong> a month. ${byGrowth
							.map((x, i) => planLink(x.p) + (i === 0 ? ' grew fastest, up ' : ' ') + pct(x.g))
							.join(', ')
							.replace(/, ([^,]*)$/, ' and $1')}.</p>`;
			const tail =
				v === 0
					? `<p>It rose every month. The biggest step was in ${longLabel(jump)}, up ${short(series[jump] - series[jump - 1])}.</p>`
					: '<p>Price rises in March reach older accounts at renewal, so the climb is steadier than the sign-ups alone.</p>';
			return {
				lead,
				tail,
				figure: {
					chart: {
						title: 'MRR at each month end',
						type: 'line',
						labels: series.map((x, i) => label(i)),
						data: series,
						tones: [1],
						fmt: whole,
						tick: short,
						aria: `Line chart of MRR at each month end from ${longLabel(0)} to ${longLabel(series.length - 1)}. It grew from ${short(start)} to ${short(endV)}.`,
					},
				},
				source: ['Subscription Plans', 'subscription-plans.html'],
			};
		},

		other(v) {
			const lead =
				v === 0
					? '<p>I can’t answer that one in this demo. I know about revenue, bills, accounts and trials in the sample data. Try one of these:</p>'
					: '<p>That one is outside what this demo knows. These are the questions it can answer from the sample data:</p>';
			return { lead, tail: '', figure: { suggest: true }, source: null };
		},
	};

	function answer(topic, v) {
		const a = (ANSWERS[topic] || ANSWERS.other)(v);
		let plain = strip(a.lead);
		if (a.figure && a.figure.table) plain += `\n\n${tablePlain(a.figure.table)}`;
		if (a.figure && a.figure.chart)
			plain += `\n\n${a.figure.chart.title}\n${a.figure.chart.labels.map((l, i) => `${l}: ${a.figure.chart.fmt(a.figure.chart.data[i])}`).join('\n')}`;
		if (a.tail) plain += `\n\n${strip(a.tail)}`;
		if (a.source) plain += `\n\nFrom ${a.source[0]}, ${asOf}.`;
		a.plain = plain;
		return a;
	}

	/* Which topic a typed question is about: the one whose words it
     mentions most, or "other". */
	function match(text) {
		const q = ` ${text.toLowerCase()} `;
		let best = 'other';
		let score = 0;
		AS.topics.forEach((t) => {
			const s = t.words.reduce((n, w) => n + (q.indexOf(w) >= 0 ? 1 : 0), 0);
			if (s > score) {
				score = s;
				best = t.id;
			}
		});
		return best;
	}

	/* Chats */
	let seq = 0;
	function addMinutes(at, m) {
		const h = Number(at.slice(11, 13));
		const mm = Number(at.slice(14, 16)) + m;
		return `${at.slice(0, 11) + String(h + Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
	}
	const chats = AS.history.map(([id, at]) => {
		const t = AS.find(id);
		return {
			id: `c${++seq}`,
			title: t.title,
			at,
			messages: [
				{ role: 'user', text: t.ask, at },
				{ role: 'bot', topic: id, v: 0, at: addMinutes(at, 1) },
			],
		};
	});

	function blank() {
		return {
			id: `c${++seq}`,
			title: 'New chat',
			at: null,
			messages: [],
		};
	}

	let current = blank();
	let busy = false;

	function drawChats() {
		el.chats.innerHTML = chats
			.map(
				(c) =>
					`<li><button type="button" class="ai-chat" data-ai-chat="${c.id}"${c === current ? ' aria-current="true"' : ''}><i class="bi bi-chat-left-text" aria-hidden="true"></i><span class="ai-chat-title">${htmlSafe(c.title)}</span><span class="ai-chat-when">${htmlSafe(when(c.at))}</span></button></li>`,
			)
			.join('');
	}

	/* Charts */
	const charts = [];

	function css(name, fallback) {
		return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
	}

	function series(tone) {
		return window.Basalt.series ? window.Basalt.series(tone) : css(`--basalt-series-${tone}`, '#2b6fd4');
	}

	function mix(a, b, w) {
		function hex(c) {
			const m = /^#([0-9a-f]{6})$/i.exec(c);
			if (!m) return null;
			const n = parseInt(m[1], 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}
		const x = hex(a);
		const y = hex(b);
		if (!x || !y) return a;
		return `rgb(${x.map((v, i) => Math.round(v * w + y[i] * (1 - w))).join(',')})`;
	}
	function alpha(c, a) {
		const m = /^#([0-9a-f]{6})$/i.exec(c);
		if (!m) return c;
		const n = parseInt(m[1], 16);
		return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
	}

	function build(item, animate) {
		if (typeof Chart === 'undefined') return;
		const s = item.spec;
		if (item.chart) item.chart.destroy();
		const font = getComputedStyle(document.body).fontFamily;
		const text = css('--basalt-copy', '#12233a');
		const surface = css('--basalt-plane', '#ffffff');
		const quiet = mix(css('--basalt-copy-muted', '#5f7186'), text, 0.82);
		const tick = { color: quiet, font: { family: font, size: 11.5 }, padding: 6 };
		const grid = alpha(text.length === 7 ? text : '#12233a', 0.07);
		const colors = s.tones.map((t) => series(t));
		const tooltip = {
			backgroundColor: surface,
			titleColor: text,
			bodyColor: text,
			borderColor: css('--basalt-edge-strong', 'rgba(16, 42, 72, .15)'),
			borderWidth: 1,
			padding: 10,
			cornerRadius: 8,
			displayColors: false,
			titleFont: { family: font, size: 12, weight: '600' },
			bodyFont: { family: font, size: 12 },
			callbacks: { label: (c) => ` ${s.fmt(s.type === 'hbar' ? c.parsed.x : c.parsed.y)}` },
		};
		const anim = animate && !reduce.matches ? { duration: 500, easing: 'easeOutQuart' } : false;
		const config =
			s.type === 'line'
				? {
						type: 'line',
						data: {
							labels: s.labels,
							datasets: [
								{
									data: s.data,
									borderColor: colors[0],
									backgroundColor: alpha(colors[0], 0.12),
									fill: true,
									tension: 0.35,
									borderWidth: 2,
									pointRadius: 0,
									pointHoverRadius: 4,
									pointBackgroundColor: colors[0],
								},
							],
						},
						options: {
							responsive: true,
							maintainAspectRatio: false,
							animation: anim,
							interaction: { mode: 'index', intersect: false },
							plugins: { legend: { display: false }, tooltip },
							scales: {
								x: {
									grid: { display: false },
									border: { display: false },
									ticks: Object.assign({ maxRotation: 0, autoSkip: true, autoSkipPadding: 14 }, tick),
								},
								y: {
									grid: { color: grid },
									border: { display: false },
									ticks: Object.assign({ maxTicksLimit: 4, callback: (v) => s.tick(v) }, tick),
								},
							},
						},
					}
				: {
						type: 'bar',
						data: {
							labels: s.labels,
							datasets: [
								{
									data: s.data,
									backgroundColor: colors,
									borderRadius: 4,
									borderSkipped: false,
									barThickness: 16,
								},
							],
						},
						options: {
							indexAxis: 'y',
							responsive: true,
							maintainAspectRatio: false,
							animation: anim,
							plugins: { legend: { display: false }, tooltip },
							scales: {
								x: {
									beginAtZero: true,
									grid: { color: grid },
									border: { display: false },
									ticks: Object.assign({ maxTicksLimit: 5, callback: (v) => s.tick(v) }, tick),
								},
								y: {
									grid: { display: false },
									border: { display: false },
									ticks: Object.assign({}, tick, { color: text }),
								},
							},
						},
					};
		item.chart = new Chart(item.canvas, config);
	}

	function drawCharts(scope, animate) {
		for (const canvas of pickAll('canvas[data-ai-chart]', scope)) {
			const item = { canvas, spec: canvas._aiSpec, chart: null };
			charts.push(item);
			build(item, animate);
		}
	}
	function dropCharts() {
		for (let i = charts.length - 1; i >= 0; i--) {
			if (!charts[i].canvas.isConnected) {
				if (charts[i].chart) charts[i].chart.destroy();
				charts.splice(i, 1);
			}
		}
	}
	document.addEventListener('basalt:appearance', () =>
		requestAnimationFrame(() => charts.forEach((c) => build(c, false))),
	);

	/* Messages */
	function suggestions(compact) {
		return `<ul class="ai-suggest${compact ? ' ai-suggest-compact' : ''}">${AS.topics
			.map(
				(t) =>
					`<li><button type="button" class="ai-suggest-btn" data-ai-ask="${t.id}" style="--ai-tone: var(--basalt-series-${t.tone})"><span class="ai-suggest-icon" aria-hidden="true"><i class="bi ${t.icon}"></i></span><span class="ai-suggest-text">${htmlSafe(t.ask)}</span></button></li>`,
			)
			.join('')}</ul>`;
	}

	function figure(f) {
		if (!f) return '';
		if (f.suggest) return suggestions(true);
		if (f.chart) {
			return `<figure class="ai-figure"><figcaption class="ai-figure-title">${htmlSafe(f.chart.title)}</figcaption><div class="ai-figure-chart ai-figure-chart-${f.chart.type}" style="--ai-rows: ${f.chart.labels.length}"><canvas role="img" aria-label="${htmlSafe(f.chart.aria)}" data-ai-chart></canvas></div></figure>`;
		}
		const t = f.table;

		/* h[1]: 'end' lines the column up on the right; h[2]: true hides it on phones. */
		function cls(h) {
			const c = (h[1] === 'end' ? 'text-end ' : '') + (h[2] ? 'ai-col-wide' : '');
			return c.trim() ? ` class="${c.trim()}"` : '';
		}

		return `<div class="ai-figure ai-figure-table"><p class="ai-figure-title" aria-hidden="true">${htmlSafe(t.caption)}</p><div class="ai-table-wrap"><table class="table ai-table mb-0"><caption class="visually-hidden">${htmlSafe(t.caption)}</caption><thead><tr>${t.head.map((h) => `<th scope="col"${cls(h)}>${htmlSafe(h[0])}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr data-ai-href="${r.href}">${r.cells.map((c, i) => `<td${cls(t.head[i])}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
	}

	function userNode(m) {
		const n = document.createElement('div');
		n.className = 'ai-msg ai-msg-user';
		n.innerHTML = `<p class="visually-hidden">You asked</p><div class="ai-msg-bubble">${htmlSafe(m.text).replace(/\n/g, '<br>')}</div><span class="ai-msg-time">${clock(m.at)}</span>`;
		return n;
	}

	function botNode(m, last) {
		const a = answer(m.topic, m.v);
		m.plain = a.plain;
		const n = document.createElement('article');
		n.className = 'ai-msg ai-msg-bot';
		n.setAttribute('aria-label', 'Answer');
		n.innerHTML = `<span class="ai-msg-mark" aria-hidden="true"><i class="bi bi-stars"></i></span><div class="ai-msg-body"><div class="ai-answer">${a.lead}${figure(a.figure)}${a.tail}</div><div class="ai-msg-foot"><p class="ai-msg-source">${a.source ? `From ${link(a.source[1], a.source[0])}, ${asOf}` : 'Demo answer'}<span class="ai-msg-at"><span aria-hidden="true"> · </span>${clock(m.at)}</span></p><div class="ai-msg-tools"><button type="button" class="btn btn-icon btn-sm ai-tool" aria-label="Copy answer" data-ai-copy data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Copy answer"><i class="bi bi-copy" aria-hidden="true"></i></button>${last ? '<button type="button" class="btn btn-icon btn-sm ai-tool" aria-label="Regenerate answer" data-ai-regen data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Regenerate"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i></button>' : ''}</div></div></div>`;
		if (a.figure && a.figure.chart) pick('canvas', n)._aiSpec = a.figure.chart;
		n._aiMsg = m;
		return n;
	}

	function typingNode() {
		const n = document.createElement('div');
		n.className = 'ai-msg ai-msg-bot ai-msg-typing';
		n.innerHTML = `<span class="ai-msg-mark" aria-hidden="true"><i class="bi bi-stars"></i></span><div class="ai-typing" role="status"><span class="visually-hidden">The assistant is writing an answer</span><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i></div>`;
		return n;
	}

	function emptyHtml() {
		return `<div class="ai-empty"><span class="ai-empty-mark" aria-hidden="true"><i class="bi bi-stars"></i></span><h3 class="ai-empty-title">What would you like to know?</h3><p class="ai-empty-desc">Ask about revenue, bills, accounts or trials. Answers come with the numbers and links to the records.</p>${suggestions(false)}</div>`;
	}

	function tips(scope) {
		if (window.Basalt.tips) window.Basalt.tips(scope);
	}
	function hideTips(scope) {
		if (!window.bootstrap || !window.bootstrap.Tooltip) return;

		for (const t of pickAll('[data-bs-toggle="tooltip"]', scope)) {
			const i = window.bootstrap.Tooltip.getInstance(t);
			if (i) i.dispose();
		}
	}

	function lastBotIndex(c) {
		for (let i = c.messages.length - 1; i >= 0; i--) if (c.messages[i].role === 'bot') return i;
		return -1;
	}

	function drawChat() {
		hideTips(el.feed);
		el.title.textContent = current.title;
		el.feed.removeAttribute('aria-busy');
		if (!current.messages.length) {
			el.feed.innerHTML = emptyHtml();
			dropCharts();
			return;
		}
		el.feed.innerHTML = '';
		const last = lastBotIndex(current);
		current.messages.forEach((m, i) =>
			el.feed.appendChild(m.role === 'user' ? userNode(m) : botNode(m, i === last)),
		);
		dropCharts();
		drawCharts(el.feed, false);
		tips(el.feed);
	}

	function open(c, focus) {
		if (busy) return;
		current = c;
		drawChats();
		drawChat();
		window.scrollTo({ top: 0, behavior: 'auto' });
		if (el.rail && window.bootstrap && window.bootstrap.Offcanvas) {
			const oc = window.bootstrap.Offcanvas.getInstance(el.rail);
			if (oc) oc.hide();
		}
		if (focus) el.title.focus({ preventScroll: true });
	}

	/* Keeps a new message in view above the composer. */
	function reveal(n, fromTop) {
		const r = n.getBoundingClientRect();
		const composer = el.form.getBoundingClientRect();
		const head = parseFloat(css('--basalt-header-h', '72')) || 72;
		const bottomLimit = Math.min(window.innerHeight, composer.top) - 16;
		let dy = 0;
		if (fromTop && r.height > bottomLimit - head - 16) dy = r.top - head - 16;
		else if (r.bottom > bottomLimit) dy = r.bottom - bottomLimit;
		if (dy > 0) window.scrollBy({ top: dy, behavior: reduce.matches ? 'auto' : 'smooth' });
	}

	function setBusy(on) {
		busy = on;
		el.send.disabled = on || !el.input.value.trim();

		for (const b of pickAll('[data-ai-regen]', el.feed)) {
			b.disabled = on;
		}

		for (const b of pickAll('[data-ai-ask]', el.feed)) {
			b.disabled = on;
		}
	}

	function reply(m, replaceNode) {
		setBusy(true);
		const typing = typingNode();
		if (replaceNode) {
			hideTips(replaceNode);
			replaceNode.replaceWith(typing);
		} else el.feed.appendChild(typing);
		dropCharts();
		reveal(typing);
		const wait = reduce.matches ? 300 : 900 + Math.round(Math.random() * 500);
		setTimeout(() => {
			/* Only the newest answer can be regenerated. */
			for (const b of pickAll('[data-ai-regen]', el.feed)) {
				hideTips(b.parentNode);
				b.remove();
			}

			const n = botNode(m, true);
			n.classList.add('is-new');
			typing.replaceWith(n);
			drawCharts(n, true);
			tips(n);
			setBusy(false);
			reveal(n, true);
			announce(`Answer ready. ${strip(answer(m.topic, m.v).lead)}`);
		}, wait);
	}

	function ask(text, topic) {
		text = text.trim();
		if (!text || busy) return;
		const id = topic || match(text);
		if (!current.messages.length) {
			const t = AS.find(id);
			current.title = t
				? t.title
				: text
						.split(/\s+/)
						.slice(0, 4)
						.join(' ')
						.replace(/[?.!,]+$/, '');
			current.at = now();
			chats.unshift(current);
			el.feed.innerHTML = '';
			el.title.textContent = current.title;
		}
		current.at = now();
		const q = { role: 'user', text, at: now() };
		const m = { role: 'bot', topic: id, v: 0, at: now() };
		current.messages.push(q, m);
		drawChats();
		el.feed.appendChild(userNode(q));
		reply(m);
	}

	/* Events */
	el.chats.addEventListener('click', (e) => {
		const b = e.target.closest('[data-ai-chat]');
		if (!b) return;
		const c = chats.find((x) => x.id === b.getAttribute('data-ai-chat'));
		if (c) open(c, true);
	});

	pick('[data-ai-new]', root).addEventListener('click', () => {
		if (busy) return;
		if (current.messages.length) {
			current = blank();
			drawChats();
			drawChat();
		}
		el.input.focus();
	});

	el.feed.addEventListener('click', (e) => {
		const s = e.target.closest('[data-ai-ask]');
		if (s) {
			const t = AS.find(s.getAttribute('data-ai-ask'));
			if (t) ask(t.ask, t.id);
			return;
		}

		const copy = e.target.closest('[data-ai-copy]');
		if (copy) {
			const m = copy.closest('.ai-msg')._aiMsg;
			Promise.resolve(window.Basalt.copyText ? window.Basalt.copyText(m.plain) : null).then(() => {
				const icon = pick('i', copy);
				icon.className = 'bi bi-check2';
				setTimeout(() => {
					icon.className = 'bi bi-copy';
				}, 1600);
				toast({ tone: 'success', title: 'Answer copied', text: 'Paste it into an email or a note.' });
			});
			return;
		}

		const regen = e.target.closest('[data-ai-regen]');
		if (regen && !busy) {
			const node = regen.closest('.ai-msg');
			const m = node._aiMsg;
			m.v = (m.v + 1) % 2;
			m.at = now();
			reply(m, node);
			return;
		}

		/* A row in an answer's table opens its record, as list rows do. */
		const row = e.target.closest('tr[data-ai-href]');
		if (row && !e.target.closest('a, button')) window.location.href = row.getAttribute('data-ai-href');
	});

	function fit() {
		el.input.style.height = 'auto';
		el.input.style.height = `${el.input.scrollHeight}px`;
	}
	start();
})();
