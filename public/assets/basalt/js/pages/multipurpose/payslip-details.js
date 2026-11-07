/**
 * Basalt - Payslip Details (payslip-details.html)
 * One person's payslip for one pay run: earnings, taxes and
 * deductions, the net pay and where it goes, the year so far and
 * the changes in the run.
 *
 * Everything is worked out from the shared roster
 * (assets/basalt/js/data/multipurpose/people.js) and the payroll settings
 * (assets/basalt/js/data/multipurpose/payslips.js), so the figures match Payroll.
 * ?id=%23129 picks the person and ?month=9 the run; without them
 * the page opens Jim Atkins's October payslip.
 */
(() => {
	'use strict';
	const root = pick('[data-psd-root]');
	if (!root) return;

	const PAY = window.Basalt.data.payslips;
	const PEOPLE = window.Basalt.data.people;
	const YEAR = PAY.year;
	const OPEN = PAY.openMonth;
	const DEFAULT_ID = '#129';

	/* Helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch],
		);
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function money(n) {
		return (
			(n < 0 ? '−$' : '$') +
			Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		);
	}

	function whole(n) {
		return `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
	}

	const MONTHS = [
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
	const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	function dateOf(iso) {
		const p = iso.split('-').map(Number);
		return new Date(p[0], p[1] - 1, p[2]);
	}
	function day(iso) {
		const d = dateOf(iso);
		return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
	}

	function weekday(iso) {
		return `${DAYS[dateOf(iso).getDay()]}, ${day(iso)}`;
	}

	function nameOf(p) {
		return `${p.first} ${p.last}`;
	}

	function pageOf(p, m) {
		return `payslip-details.html?id=${encodeURIComponent(p.id)}${m && m !== OPEN ? `&month=${m}` : ''}`;
	}

	function pill(tone, label) {
		return `<span class="basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}">${label}</span>`;
	}

	/* Whose payslip, for which month */
	const ALL = PAY.people().sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
	const q = new URLSearchParams(window.location.search);
	const P = ALL.find((x) => x.id === q.get('id')) || ALL.find((x) => x.id === DEFAULT_ID) || ALL[0];
	const months = [];
	for (let m = 1; m <= OPEN; m++) if (PAY.slipFor(P, m)) months.push(m);
	const askedMonth = parseInt(q.get('month'), 10);
	const M = months.indexOf(askedMonth) >= 0 ? askedMonth : months[months.length - 1];
	const S = PAY.slipFor(P, M);
	const opened = M === OPEN;
	const team = PEOPLE.teams.find((t) => t.id === P.team);

	/* Header */
	function paintHead() {
		document.title = `${nameOf(P)}, ${MONTHS[M - 1]} payslip · Basalt`;
		pick('[data-psd="title"]').textContent = nameOf(P);
		pick('[data-psd="sub"]').textContent = `${MONTHS[M - 1]} ${YEAR} payslip · ${P.role} · ${P.team}`;
		pick('[data-psd="tags"]').innerHTML =
			`${opened ? pill('info', 'Draft') : pill('success', 'Paid')}<span class="psd-when"><i class="bi bi-calendar-event" aria-hidden="true"></i>${opened ? 'Pays ' : 'Paid '}${weekday(PAY.payday(M))}</span>`;
		const sel = pick('[data-psd-month]');
		sel.innerHTML = months
			.slice()
			.reverse()
			.map((m) => `<option value="${m}"${m === M ? ' selected' : ''}>${MONTHS[m - 1]} ${YEAR}</option>`)
			.join('');
		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(sel);
		const i = ALL.indexOf(P);

		function link(el, to) {
			if (to) {
				el.href = pageOf(to, M);
				el.classList.remove('disabled');
				el.removeAttribute('aria-disabled');
				el.removeAttribute('tabindex');
			} else {
				el.removeAttribute('href');
				el.classList.add('disabled');
				el.setAttribute('aria-disabled', 'true');
				el.setAttribute('tabindex', '-1');
			}
		}

		link(pick('[data-psd="prev"]'), ALL[i - 1]);
		link(pick('[data-psd="next"]'), ALL[i + 1]);
	}

	/* The payslip */
	function lines(list, minus) {
		return `<ul class="psd-lines">${list.map((l) => `<li><span>${htmlSafe(l.label)}</span><span>${minus ? '−' : ''}${money(l.amount)}</span></li>`).join('')}</ul>`;
	}
	function paintSlip() {
		const end = new Date(YEAR, M, 0).getDate();
		pick('[data-psd="period"]').textContent =
			`Pay period ${MONTHS[M - 1].slice(0, 3)} ${S.from} to ${MONTHS[M - 1].slice(0, 3)} ${Math.min(S.to, end)}, ${YEAR}.`;
		pick('[data-psd="slip"]').innerHTML =
			`<div class="psd-group"><h3 class="psd-sub">Earnings</h3></div>${lines(S.earnings)}<p class="psd-total"><span>Gross pay</span><span>${money(S.gross)}</span></p><div class="psd-group"><h3 class="psd-sub">Taxes</h3></div>${lines(S.taxes, true)}<p class="psd-total"><span>Total taxes</span><span>−${money(S.tax)}</span></p><div class="psd-group"><h3 class="psd-sub">Other deductions</h3></div>${lines(S.deductions, true)}<p class="psd-total"><span>Total other deductions</span><span>−${money(S.other)}</span></p><p class="psd-netline"><span>Net pay</span><span>${money(S.net)}</span></p>`;
	}

	/* Payment */
	function paintPayment() {
		function pct(n) {
			return Math.round((n / S.gross) * 1000) / 10;
		}

		pick('[data-psd="pay-desc"]').textContent = opened
			? `Waiting for the run to be approved by ${day(PAY.approveBy)}.`
			: `Paid with the ${MONTHS[M - 1]} run.`;
		pick('[data-psd="net"]').innerHTML =
			`<p class="psd-net-label">Net pay</p><p class="psd-net-amount">${money(S.net)}</p><div class="psd-split" role="img" aria-label="Of ${money(S.gross)} gross pay, ${pct(S.net)}% is net pay, ${pct(S.tax)}% taxes and ${pct(S.other)}% other deductions."><span class="psd-split-net" style="width:${pct(S.net)}%"></span><span class="psd-split-tax" style="width:${pct(S.tax)}%"></span><span class="psd-split-ded" style="width:${pct(S.other)}%"></span></div><ul class="psd-legend" aria-hidden="true"><li><i class="psd-split-net"></i>Net pay <strong>${pct(S.net)}%</strong></li><li><i class="psd-split-tax"></i>Taxes <strong>${pct(S.tax)}%</strong></li><li><i class="psd-split-ded"></i>Other deductions <strong>${pct(S.other)}%</strong></li></ul>`;
		const facts = [
			['Pay date', `${weekday(PAY.payday(M))}, ${YEAR}`],
			['Paid into', `Account ···${PAY.accountOf(P)}`],
			['Paid from', `Payroll Account ···${PAY.account}`],
			['Method', 'Bank transfer'],
			['Status', opened ? pill('info', 'Draft') : pill('success', 'Paid')],
		];
		pick('[data-psd="payment"]').innerHTML = facts
			.map((f) => `<div><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`)
			.join('');
	}

	/* Year to date */
	function paintYtd() {
		const shown = months.filter((m) => m <= M);
		const slips = shown.map((m) => PAY.slipFor(P, m));

		function sum(k) {
			return slips.reduce((s, x) => s + x[k], 0);
		}

		pick('[data-psd="ytd-desc"]').textContent =
			`January to ${MONTHS[M - 1]}, ${slips.length}${slips.length === 1 ? ' payslip.' : ' payslips.'}`;
		pick('[data-psd="ytd"]').innerHTML = slips
			.slice()
			.reverse()
			.map(
				(s) =>
					`<tr${s.m === M ? ' class="is-current"' : ''}><td>${s.m === M ? MONTHS[s.m - 1] : `<a class="psd-link" href="${pageOf(P, s.m)}">${MONTHS[s.m - 1]}</a>`}</td><td class="text-end">${whole(s.gross)}</td><td class="text-end psd-col-tax">${whole(s.tax)}</td><td class="text-end">${whole(s.net)}</td></tr>`,
			)
			.join('');
		pick('[data-psd="ytd-total"]').innerHTML =
			`<tr><td>Total</td><td class="text-end">${whole(sum('gross'))}</td><td class="text-end psd-col-tax">${whole(sum('tax'))}</td><td class="text-end">${whole(sum('net'))}</td></tr>`;
	}

	/* Employee */
	function paintWho() {
		const profile = `employee-details.html?id=${encodeURIComponent(P.id)}`;
		pick('[data-psd="profile"]').href = profile;
		pick('[data-psd="who-desc"]').textContent = `${P.type}, ${P.city}.`;
		pick('[data-psd="person"]').innerHTML =
			`<span class="basalt-avatar basalt-avatar-md basalt-avatar-tone-${team.tone}" aria-hidden="true">${htmlSafe((P.first.charAt(0) + P.last.charAt(0)).toUpperCase())}</span><span><a class="psd-link psd-person-name" href="${profile}">${htmlSafe(nameOf(P))}</a><span class="psd-person-role">${htmlSafe(P.role)}</span></span>`;
		const salary = P.was && M <= P.was.until ? P.was.salary : P.salary;
		const facts = [
			['Staff number', htmlSafe(P.id)],
			['Team', htmlSafe(P.team)],
			['Started', `${weekday(P.start)}, ${P.start.slice(0, 4)}`],
			['Monthly salary', money(salary)],
		];
		if (P.end) facts.push(['Last day', `${weekday(P.end)}, ${P.end.slice(0, 4)}`]);
		pick('[data-psd="who"]').innerHTML = facts.map((f) => `<div><dt>${f[0]}</dt><dd>${f[1]}</dd></div>`).join('');
		const changes = opened ? PAY.changes.filter((c) => c.who === P.id) : [];
		pick('[data-psd="changes"]').innerHTML = changes.length
			? changes
					.map(
						(c) =>
							`<li><span><strong>${PAY.kinds[c.kind]}</strong> · ${htmlSafe(c.note)}</span>${c.status === 'approved' ? pill('success', 'Approved') : c.status === 'skipped' ? pill('', 'Next run') : pill('warning', 'To check')}</li>`,
					)
					.join('')
			: `<li class="psd-changes-none">${opened ? 'None. Paid the usual salary.' : 'This run is closed.'}</li>`;
	}

	function start() {
		paintHead();
		paintSlip();
		paintPayment();
		paintYtd();
		paintWho();
		pick('[data-psd-month]').addEventListener('change', (e) => {
			location.href = pageOf(P, parseInt(e.target.value, 10));
		});
		pick('[data-psd-download]').addEventListener('click', () => {
			toast({
				tone: 'success',
				icon: 'bi-download',
				title: 'Payslip downloaded',
				text: `payslip-${P.id.toLowerCase()}-${YEAR}-${String(M).padStart(2, '0')}.pdf`,
			});
		});
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
})();
