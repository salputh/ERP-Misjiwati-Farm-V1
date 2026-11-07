/**
 * Imaging and reports on imaging-and-reports.html: every written report on
 * one patient, from window.Basalt.data.clinicReports (clinic-reports.js),
 * with lab values and studies read from clinicRecord (clinic-record.js).
 *   Library  the reports newest first, by year, narrowed by kind and by a
 *            search; one waiting for review says To review
 *   Reader   the open report laid out like the paper it stands for, with
 *            Mark reviewed, Share with patient, Download and Print; on a
 *            phone or tablet it opens as a full-screen sheet over the library, closed
 *            by its Library button, Escape or the browser's back
 * The address carries the open report (#genetics), so the chart can link
 * straight to one. Reviews and shares live in memory with a toast.
 */
(() => {
	'use strict';
	const root = pick('[data-hrp-root]');
	const data = window.Basalt.data?.clinicReports;
	const record = window.Basalt.data?.clinicRecord;
	const clinic = window.Basalt.data?.clinic;
	if (!root || !data || !record || !clinic) return;

	const TODAY = clinic.asOf;
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const REVIEWER = 'Dr. Emily Pearce';
	const sheetWidth = window.matchMedia('(max-width: 1199.98px)');
	const still = window.matchMedia('(prefers-reduced-motion: reduce)');
	const shown = { kind: 'all', words: '' };
	let openId = null;

	/* What each status reads as, and its pill. */
	const STATUS = {
		final: { name: 'Final', pill: 'hc-pill-ok' },
		preliminary: { name: 'Preliminary', pill: 'hc-pill-wait' },
		amended: { name: 'Amended', pill: 'hc-pill-info' },
	};

	/* The closing block is named for what it holds in each kind of report. */
	const CLOSING = { lab: 'Summary', imaging: 'Impression', pathology: 'Diagnosis', letter: 'Asks' };

	start();

	function start() {
		drawFilters();
		drawList();
		paintSummary();
		openReport(fromAddress() || firstToReview()?.id || data.reports[0].id, false);
		wire();
		window.addEventListener('hashchange', () => {
			const id = fromAddress();
			if (id && id !== openId) openReport(id, true);
		});
		window.addEventListener('popstate', () => {
			if (root.classList.contains('is-reading')) closeSheet();
		});
	}

	/* Helpers */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value ?? '').replace(
			/[&<>"']/g,
			(mark) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[mark],
		);
	}

	function day(iso) {
		const [y, m, d] = iso.split('-').map(Number);
		return `${MONTHS[m - 1]} ${d}, ${y}`;
	}

	function shortDay(iso) {
		const [, m, d] = iso.split('-').map(Number);
		return `${MONTHS[m - 1]} ${d}`;
	}

	function placeName(key) {
		return record.places[key]?.name ?? key;
	}

	/** The one who ordered it, in full: "Dr. Emily Pearce". */
	function orderedBy(report) {
		return report.ordered ? (clinic.provider(report.ordered)?.name ?? '') : '';
	}

	function toast(tone, title, text) {
		window.Basalt.toasts?.push({
			tone,
			title,
			text,
			icon: tone === 'success' ? 'bi-check2-circle' : 'bi-info-circle',
		});
	}

	function fromAddress() {
		const id = decodeURIComponent(location.hash.slice(1));
		return data.find(id) ? id : null;
	}

	function firstToReview() {
		return data.reports.find((r) => !r.reviewed);
	}

	function matches(report) {
		if (shown.kind !== 'all' && report.kind !== shown.kind) return false;
		if (!shown.words) return true;
		const text = [
			report.title,
			data.kinds[report.kind].one,
			placeName(report.place),
			report.signer,
			orderedBy(report),
			report.impression,
			...(report.findings ?? []),
		]
			.join(' ')
			.toLowerCase();
		return shown.words.split(/\s+/).every((word) => text.includes(word));
	}

	/* Library */

	function drawFilters() {
		const kinds = Object.entries(data.kinds).filter(([key]) => data.reports.some((r) => r.kind === key));
		pick('[data-hrp-kinds]', root).innerHTML = [['all', { name: 'All' }], ...kinds]
			.map(
				([key, k]) =>
					`<button type="button" aria-pressed="${key === shown.kind}" class="hrp-chip" data-hrp-kind="${key}">${k.name}</button>`,
			)
			.join('');
	}

	/** The list, grouped by year; only the reports that pass the filters. */
	function drawList() {
		const list = data.reports.filter(matches);
		const years = [...new Set(list.map((r) => r.on.slice(0, 4)))];
		pick('[data-hrp-list]', root).innerHTML = years
			.map(
				(year) =>
					`<li class="hrp-year"><h3 class="hrp-year-title">${year}</h3><ol class="hrp-year-list">${list
						.filter((r) => r.on.startsWith(year))
						.map(itemHtml)
						.join('')}</ol></li>`,
			)
			.join('');
		pick('[data-hrp-empty]', root).hidden = list.length > 0;
		pick('[data-hrp-count]', root).textContent =
			list.length === data.reports.length ? `${list.length} in all` : `${list.length} of ${data.reports.length}`;
	}

	function itemHtml(report) {
		const kind = data.kinds[report.kind];
		/* A report waiting for a doctor's review says so in words; it goes
		   once Mark reviewed is pressed. */
		const side = !report.reviewed
			? '<span class="hc-pill hc-pill-wait">To review</span>'
			: report.status === 'final'
				? ''
				: `<span class="hc-pill ${STATUS[report.status].pill}">${STATUS[report.status].name}</span>`;
		return `<li><button type="button" class="hrp-item${report.reviewed ? '' : ' is-new'}" aria-current="${report.id === openId}" data-hrp-open="${report.id}" style="--tone: var(--basalt-series-${kind.tone})"><span class="hrp-item-mark" aria-hidden="true"><i class="bi ${kind.icon}"></i></span><span class="hrp-item-text"><b>${htmlSafe(report.title)}</b><span>${shortDay(report.on)} · ${htmlSafe(placeName(report.place))}</span></span>${side}</button></li>`;
	}

	function paintSummary() {
		const waiting = data.reports.filter((r) => !r.reviewed).length;
		pick('[data-hrp-summary]').innerHTML =
			`${htmlSafe(data.patient.name)}: ${data.reports.length} reports and studies, ${waiting ? `<b class="hrp-waiting">${waiting} to review</b>` : 'all reviewed'}.`;
		pick('[data-hrp-next]').disabled = !waiting;
	}

	/* Reader */

	function openReport(id, scroll) {
		const report = data.find(id);
		if (!report) return;
		openId = id;
		if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`);
		for (const item of pickAll('[data-hrp-open]', root))
			item.setAttribute('aria-current', String(item.dataset.hrpOpen === id));
		const reader = pick('[data-hrp-reader]', root);
		reader.innerHTML = readerHtml(report);
		if (scroll && sheetWidth.matches) openSheet(reader);
		else if (scroll && reader.getBoundingClientRect().top < 0)
			reader.scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'start' });
	}

	/* On a phone or tablet the report covers the library like a sheet. It takes a
	   history entry, so the back gesture closes it instead of leaving. */
	function openSheet(reader) {
		if (!root.classList.contains('is-reading')) {
			root.classList.add('is-reading');
			history.pushState({ hrpSheet: true }, '', location.href);
		}
		reader.scrollTop = 0;
		pick('[data-hrp-close]', reader)?.focus({ preventScroll: true });
	}

	function closeSheet() {
		root.classList.remove('is-reading');
		pick(`[data-hrp-open="${openId}"]`, root)?.focus({ preventScroll: false });
	}

	function leaveSheet() {
		if (history.state?.hrpSheet) history.back();
		else closeSheet();
	}

	function readerHtml(report) {
		const kind = data.kinds[report.kind];
		const status = STATUS[report.status];
		const reviewed = report.reviewed
			? `<button type="button" class="btn btn-outline-secondary btn-sm" data-hrp-review aria-pressed="true"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Reviewed</button>`
			: `<button type="button" class="btn btn-primary btn-sm" data-hrp-review aria-pressed="false"><i class="bi bi-check2-square me-1" aria-hidden="true"></i>Mark reviewed</button>`;
		const facts = [
			[
				report.kind === 'letter' ? 'Written' : report.kind === 'imaging' ? 'Performed' : 'Collected',
				day(report.on),
			],
			['Reported', day(report.signed)],
			report.ordered ? ['Ordered by', orderedBy(report)] : null,
			report.to ? ['To', report.to] : null,
		].filter(Boolean);
		return `
			<div class="hrp-sheet-bar">
				<button type="button" class="btn btn-outline-secondary btn-sm" data-hrp-close><i class="bi bi-arrow-left me-1" aria-hidden="true"></i>Library</button>
			</div>
			<div class="hrp-tools">
				<p class="hrp-tools-kind" style="--tone: var(--basalt-series-${kind.tone})"><i class="bi ${kind.icon}" aria-hidden="true"></i>${kind.one}<span class="hc-pill ${status.pill}">${status.name}</span></p>
				<div class="hrp-tools-actions">
					${reviewed}
					<button type="button" class="btn btn-outline-secondary btn-sm" data-hrp-share${report.shared ? ' disabled' : ''}><i class="bi ${report.shared ? 'bi-person-check' : 'bi-send'} me-1" aria-hidden="true"></i>${report.shared ? 'Shared' : 'Share with patient'}</button>
					<button type="button" class="btn btn-outline-secondary btn-sm" data-hrp-download aria-label="Download"><i class="bi bi-download" aria-hidden="true"></i></button>
					<button type="button" class="btn btn-outline-secondary btn-sm" data-hrp-print aria-label="Print"><i class="bi bi-printer" aria-hidden="true"></i></button>
				</div>
			</div>
			<article class="hrp-paper" aria-labelledby="hrp-paper-title">
				<header class="hrp-letterhead">
					<div><p class="hrp-letterhead-place">${htmlSafe(placeName(report.place))}</p><p class="hrp-letterhead-kind">${kind.one}${report.place === 'us' ? '' : ' · received'}</p></div>
					<p class="hrp-letterhead-ref">${report.id.toUpperCase()}</p>
				</header>
				<h2 id="hrp-paper-title" class="hrp-paper-title">${htmlSafe(report.title)}</h2>
				<p class="hrp-patient"><b>${htmlSafe(data.patient.name)}</b><span>${data.patient.id}</span><span>Born ${day(data.patient.born)}</span></p>
				<dl class="hrp-facts">${facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${htmlSafe(value)}</dd></div>`).join('')}</dl>
				${bodyHtml(report)}
				<section class="hrp-closing"><h3>${CLOSING[report.kind]}</h3><p>${htmlSafe(report.impression)}</p></section>
				<footer class="hrp-sign">
					<p>Signed electronically by ${htmlSafe(report.signer)} on ${day(report.signed)}.</p>
					${report.reviewed ? `<p>Reviewed${report.reviewedOn ? ` by ${REVIEWER} on ${day(report.reviewedOn)}` : ''}.</p>` : '<p class="hrp-sign-wait">Not reviewed yet.</p>'}
				</footer>
			</article>`;
	}

	function bodyHtml(report) {
		const parts = [];
		if (report.specimen) parts.push(`<p class="hrp-line"><span>Specimen</span>${htmlSafe(report.specimen)}</p>`);
		if (report.panels) parts.push(report.panels.map((id) => panelHtml(id, report.on)).join(''));
		if (report.genes) parts.push(genesHtml());
		const scan = scanOf(report);
		if (scan)
			parts.push(
				`<button type="button" class="hrp-scan" data-hrp-view aria-label="View the ${htmlSafe(report.title.toLowerCase())} larger"><img src="${scanUrl(scan)}" alt="" width="400" height="260"><span class="hrp-scan-zoom" aria-hidden="true"><i class="bi bi-arrows-angle-expand"></i></span></button>`,
			);
		if (report.findings)
			parts.push(
				`<section class="hrp-section"><h3>${report.kind === 'letter' ? 'Letter' : 'Findings'}</h3>${report.findings.map((line) => `<p>${htmlSafe(line)}</p>`).join('')}</section>`,
			);
		return parts.join('');
	}

	/** One panel as a results table on the day of the report, with the draw before it. */
	function panelHtml(id, on) {
		const panel = record.panels.find((p) => p.id === id);
		if (!panel) return '';
		const rows = panel.tests
			.map((test) => {
				const at = test.results.findIndex(([date]) => date === on);
				if (at < 0) return '';
				const value = test.results[at][1];
				const before = test.results[at - 1]?.[1];
				const flag = value > test.high ? 'High' : value < test.low ? 'Low' : '';
				const range = test.low === 0 ? `under ${test.high + 1}` : `${test.low}–${test.high}`;
				return `<tr${flag ? ' class="is-out"' : ''}><th scope="row">${test.name}</th><td class="hrp-value">${value}${flag ? ` <span class="hrp-flag">${flag}</span>` : ''}</td><td class="hrp-range">${range} ${test.unit}</td><td class="hrp-prev">${before ?? '–'}</td></tr>`;
			})
			.join('');
		return `<section class="hrp-section"><h3>${panel.name}</h3><table class="hrp-table"><thead><tr><th scope="col">Test</th><th scope="col">Result</th><th scope="col">Normal</th><th scope="col" class="hrp-prev">Before</th></tr></thead><tbody>${rows}</tbody></table></section>`;
	}

	function genesHtml() {
		return `<section class="hrp-section"><h3>Results</h3><table class="hrp-table"><thead><tr><th scope="col">Gene</th><th scope="col">Result</th><th scope="col" class="hrp-prev">What it means</th></tr></thead><tbody>${record.genetics
			.map(
				(g) =>
					`<tr${g.state === 'act' ? ' class="is-act"' : ''}><th scope="row">${g.gene}</th><td class="hrp-value">${g.result}</td><td class="hrp-prev">${g.why}</td></tr>`,
			)
			.join('')}</tbody></table></section>`;
	}

	/* Scans */

	function scanOf(report) {
		if (report.scan) return report.scan;
		return report.study ? record.imaging.find((s) => s.id === report.study)?.kind : null;
	}

	/** A small stand-in picture for each kind of study, on dark film or ECG paper. */
	function scan(kind) {
		const film = (body) =>
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><defs><radialGradient id="f" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#232a36"/><stop offset="1" stop-color="#080a0f"/></radialGradient></defs><rect width="400" height="260" fill="url(#f)"/>${body}<text x="12" y="248" fill="#8f98a8" font-family="monospace" font-size="10">${data.patient.id}</text><text x="380" y="248" fill="#8f98a8" font-family="monospace" font-size="10" text-anchor="end">L</text></svg>`;
		if (kind === 'ecg') {
			let grid = '';
			for (let x = 0; x <= 400; x += 20)
				grid += `<path d="M${x} 0V260" stroke="#f1c7cf" stroke-width="${x % 100 ? 0.6 : 1.2}"/>`;
			for (let y = 0; y <= 260; y += 20)
				grid += `<path d="M0 ${y}H400" stroke="#f1c7cf" stroke-width="${y % 100 ? 0.6 : 1.2}"/>`;
			let d = 'M0 130';
			for (let x = 0; x < 400; x += 100)
				d += ` H${x + 22} l6 -8 l6 8 H${x + 46} l4 10 l5 -62 l5 70 l4 -18 H${x + 78} q8 -16 16 0 H${x + 100}`;
			return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><rect width="400" height="260" fill="#fff7f8"/>${grid}<path d="${d}" fill="none" stroke="#1b1e2a" stroke-width="1.8" stroke-linejoin="round"/><text x="12" y="22" fill="#1b1e2a" font-family="monospace" font-size="10">II · 25 mm/s · 74 bpm</text></svg>`;
		}
		if (kind === 'xray-chest') {
			let ribs = '';
			for (let i = 0; i < 8; i++) {
				const y = 60 + i * 21;
				ribs += `<path d="M194 ${y}c-40 -12 -86 -4 -104 26M206 ${y}c40 -12 86 -4 104 26" fill="none" stroke="#d5dbe5" stroke-width="5" opacity=".5"/>`;
			}
			return film(
				`<rect x="191" y="24" width="18" height="236" rx="6" fill="#cfd6e1" opacity=".6"/>${ribs}<ellipse cx="222" cy="190" rx="52" ry="44" fill="#e6eaf1" opacity=".25"/>`,
			);
		}
		if (kind === 'mri-knee') {
			return film(
				`<path d="M126 0h148l8 96c2 26 -38 34 -82 34s-84 -8 -82 -34z" fill="#7a8392"/><path d="M118 152c-2 -14 38 -16 82 -16s84 2 82 16l-8 108H126z" fill="#6b7381"/><path d="M122 134l46 6l-32 10z" fill="#141820"/><circle cx="140" cy="140" r="16" fill="none" stroke="#f4c443" stroke-width="2" stroke-dasharray="4 3"/>`,
			);
		}
		return film(
			`<path d="M150 0c0 52 -10 96 -18 120c-6 20 10 34 68 34s74 -14 68 -34c-8 -24 -18 -68 -18 -120z" fill="#d9dee7" opacity=".85"/><path d="M140 172c-4 14 12 22 60 22s64 -8 60 -22c-4 -8 -116 -8 -120 0z" fill="#d9dee7" opacity=".75"/><path d="M148 194c6 30 12 66 12 66h80s6 -36 12 -66z" fill="#d9dee7" opacity=".85"/>`,
		);
	}

	function scanUrl(kind) {
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(scan(kind))}`;
	}

	/* Actions */

	function wire() {
		root.addEventListener('click', (event) => {
			const open = event.target.closest('[data-hrp-open]');
			if (open) openReport(open.dataset.hrpOpen, true);
			const kind = event.target.closest('[data-hrp-kind]');
			if (kind) {
				shown.kind = kind.dataset.hrpKind;
				for (const chip of pickAll('[data-hrp-kind]', root))
					chip.setAttribute('aria-pressed', String(chip === kind));
				drawList();
			}
			if (event.target.closest('[data-hrp-clear]')) clearFilters();
			if (event.target.closest('[data-hrp-review]')) toggleReviewed();
			if (event.target.closest('[data-hrp-share]')) share();
			if (event.target.closest('[data-hrp-download]')) download();
			if (event.target.closest('[data-hrp-print]')) window.print();
			if (event.target.closest('[data-hrp-view]')) view();
			if (event.target.closest('[data-hrp-close]')) leaveSheet();
		});
		root.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && root.classList.contains('is-reading')) leaveSheet();
		});
		pick('[data-hrp-search]', root).addEventListener('input', (event) => {
			shown.words = event.target.value.trim().toLowerCase();
			drawList();
		});
		pick('[data-hrp-next]').addEventListener('click', () => {
			const next = firstToReview();
			if (!next) return;
			if (!matches(next)) clearFilters();
			openReport(next.id, true);
		});
	}

	function clearFilters() {
		shown.kind = 'all';
		shown.words = '';
		pick('[data-hrp-search]', root).value = '';
		for (const chip of pickAll('[data-hrp-kind]', root))
			chip.setAttribute('aria-pressed', String(chip.dataset.hrpKind === 'all'));
		drawList();
	}

	function toggleReviewed() {
		const report = data.find(openId);
		report.reviewed = !report.reviewed;
		report.reviewedOn = report.reviewed ? TODAY : null;
		drawList();
		paintSummary();
		openReport(openId, false);
		pick('[data-hrp-review]', root).focus();
		if (report.reviewed) {
			const next = firstToReview();
			toast(
				'success',
				'Marked reviewed',
				`${report.title} is signed off.${next ? ` Next up: ${next.title.toLowerCase()}.` : ' Nothing else waits.'}`,
			);
		}
	}

	function share() {
		const report = data.find(openId);
		report.shared = true;
		openReport(openId, false);
		toast(
			'success',
			'Shared with the patient',
			`${data.patient.name.split(' ')[0]} can read it in her patient portal now.`,
		);
	}

	/** The open report as a plain text file. */
	function download() {
		const report = data.find(openId);
		const lines = [
			placeName(report.place),
			data.kinds[report.kind].one,
			'',
			report.title,
			`${data.patient.name} · ${data.patient.id} · born ${day(data.patient.born)}`,
			`Date: ${day(report.on)} · Reported: ${day(report.signed)} · Status: ${STATUS[report.status].name}`,
			report.ordered ? `Ordered by: ${orderedBy(report)}` : '',
			report.to ? `To: ${report.to}` : '',
			report.specimen ? `Specimen: ${report.specimen}` : '',
			'',
		];
		for (const id of report.panels ?? []) {
			const panel = record.panels.find((p) => p.id === id);
			lines.push(panel.name.toUpperCase());
			for (const test of panel.tests) {
				const value = test.results.find(([date]) => date === report.on)?.[1];
				if (value === undefined) continue;
				const flag = value > test.high ? ' HIGH' : value < test.low ? ' LOW' : '';
				lines.push(`  ${test.name}: ${value} ${test.unit} (${test.low}–${test.high})${flag}`);
			}
			lines.push('');
		}
		if (report.genes) {
			for (const g of record.genetics) lines.push(`  ${g.gene}: ${g.result}. ${g.why}`);
			lines.push('');
		}
		if (report.findings) lines.push(...report.findings, '');
		lines.push(
			`${CLOSING[report.kind]}: ${report.impression}`,
			'',
			`Signed by ${report.signer} on ${day(report.signed)}.`,
		);
		const file = new Blob([`${lines.filter((line, i) => line || lines[i - 1]).join('\n')}\n`], {
			type: 'text/plain',
		});
		const link = document.createElement('a');
		link.href = URL.createObjectURL(file);
		link.download = `patient-${data.patient.id.replace('#', '')}-${report.id}.txt`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(link.href), 1000);
		toast('info', 'Report downloaded', `${link.download} is in your downloads.`);
	}

	/* The lightbox walks through every report that has a picture. */
	function view() {
		if (!window.Basalt.lightbox) return;
		const studies = data.reports.filter(scanOf);
		window.Basalt.lightbox.open(
			studies.map((r) => ({
				src: scanUrl(scanOf(r)),
				title: r.title,
				caption: `${day(r.on)} · ${r.impression}`,
				alt: r.title,
			})),
			studies.findIndex((r) => r.id === openId),
		);
	}
})();
