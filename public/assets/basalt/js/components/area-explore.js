/**
 * Component script for the Explore button on the dashboards. It loads
 * after assets/basalt/js/basalt.js and data/<demo>/areas.js, on the
 * dashboard pages only; documentation.html#area-explore explains it.
 *
 * A dashboard's own row in the menu names its business area with
 * data-basalt-area. The button sits in the bottom corner, reads "Explore
 * <area>" (General's reads "Explore by area"), and opens a panel listing
 * the area's pages, grouped by menu section; on General it lists every
 * area instead. Esc, the close button or a click outside closes it, and
 * focus returns to the button.
 *
 * To turn it off everywhere, set SETTINGS.show to false below; to remove
 * it, delete the area-explore.js and area-explore.css lines from the
 * dashboard pages.
 */
(() => {
	'use strict';
	const SETTINGS = { show: true };
	const PANEL_ID = 'basalt-explore-panel';
	const htmlSafe = (text) =>
		String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

	document.addEventListener('DOMContentLoaded', mount);

	function mount() {
		const areas = window.Basalt?.data?.areas;
		const own = document.querySelector('.basalt-mainmenu-scroll a[aria-current="page"][data-basalt-area]');
		if (!SETTINGS.show || !areas || !own) return;
		const wanted = own.dataset.basaltArea;
		const area = wanted === 'all' ? null : areas.find((a) => a.label === wanted);
		if (wanted !== 'all' && !area) return;

		const here = location.pathname.split('/').pop() || 'index.html';
		const title = area ? `Explore ${area.label}` : 'Explore by area';
		const sum = area ? `${area.pages.length} pages` : `${areas.length} areas`;
		const tip = area ? `${area.pages.length} pages in ${area.label}` : `${areas.length} business areas`;

		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'basalt-explore';
		button.dataset.basaltTip = tip;
		button.setAttribute('aria-haspopup', 'dialog');
		button.setAttribute('aria-expanded', 'false');
		button.setAttribute('aria-controls', PANEL_ID);
		button.innerHTML = `<i class="bi bi-compass" aria-hidden="true"></i><span>${htmlSafe(title)}</span><span class="visually-hidden">, ${htmlSafe(sum)}</span>`;

		const panel = document.createElement('div');
		panel.id = PANEL_ID;
		panel.className = 'basalt-explore-panel';
		panel.setAttribute('role', 'dialog');
		panel.setAttribute('aria-modal', 'true');
		panel.setAttribute('aria-labelledby', `${PANEL_ID}-title`);
		panel.tabIndex = -1;
		panel.hidden = true;
		panel.innerHTML =
			`<div class="basalt-explore-head"><h2 class="basalt-explore-title" id="${PANEL_ID}-title">${htmlSafe(title)}</h2>` +
			`<span class="basalt-explore-sum">${htmlSafe(sum)}</span>` +
			'<button type="button" class="basalt-explore-close" aria-label="Close"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>' +
			(area ? pagesHtml(area, here) : areasHtml(areas));

		document.body.append(button, panel);
		(window.Basalt.settled || Promise.resolve()).then(() => button.classList.add('is-in'));

		/* A click opens it as it is; a key press puts focus on the page you are on, or the first. */
		button.addEventListener('click', (event) => (panel.hidden ? open(event.detail === 0) : close()));
		panel.querySelector('.basalt-explore-close').addEventListener('click', () => close());
		panel.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') close();
			if (event.key === 'Tab') keepFocus(event);
		});
		document.addEventListener('click', (event) => {
			if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) close(false);
		});

		function open(byKey) {
			panel.hidden = false;
			button.setAttribute('aria-expanded', 'true');
			const start = byKey && (panel.querySelector('[aria-current="page"]') || panel.querySelector('a'));
			(start || panel).focus();
		}
		function close(returnFocus = true) {
			panel.hidden = true;
			button.setAttribute('aria-expanded', 'false');
			if (returnFocus) button.focus();
		}
		function keepFocus(event) {
			const stops = [...panel.querySelectorAll('a, button')];
			const first = stops[0];
			const last = stops[stops.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	/* An area's pages under their menu section headings. */
	function pagesHtml(area, here) {
		const groups = [];
		for (const page of area.pages) {
			let group = groups.find((g) => g.title === page.section);
			if (!group) groups.push((group = { title: page.section, pages: [] }));
			group.pages.push(page);
		}
		const lists = groups
			.map(
				(group) =>
					`<div class="basalt-explore-group"><h3>${htmlSafe(group.title === 'Overview' ? 'Dashboards' : group.title)}</h3>` +
					group.pages.map((page) => linkHtml(page.file, page.label, page.icon, page.file === here)).join('') +
					'</div>',
			)
			.join('');
		return `<div class="basalt-explore-list${area.pages.length <= 8 ? ' is-short' : ''}">${lists}</div>`;
	}

	/* Every area, each opening on its first page, with its page count. */
	function areasHtml(areas) {
		const links = areas
			.map((area) => linkHtml(area.entry, area.label, area.icon, false, `${area.pages.length}`))
			.join('');
		return `<div class="basalt-explore-list is-areas">${links}</div>`;
	}

	function linkHtml(file, label, icon, current, count = '') {
		return (
			`<a class="basalt-explore-link" href="${htmlSafe(file)}"${current ? ' aria-current="page"' : ''}>` +
			`<i class="bi ${htmlSafe(icon)}" aria-hidden="true"></i><span>${htmlSafe(label)}</span>` +
			(count ? `<small>${count}<span class="visually-hidden"> pages</span></small>` : '') +
			'</a>'
		);
	}
})();
