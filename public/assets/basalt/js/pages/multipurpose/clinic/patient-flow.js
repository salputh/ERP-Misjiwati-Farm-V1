/**
 * Patient Flow (patient-flow.html): pointing at one of the vitals strip's
 * readings lights its stop in the Right now flow below and dims the rest,
 * and the Moving dots switch stops the flow's dots (remembered per browser).
 * healthcare.js draws the flow; vitals-strip.js draws the strip and says
 * which reading is in focus.
 */
(() => {
	'use strict';

	/* The strip's readings in order, and the flow stop each one stands for. */
	const STOPS = ['door', 'wait', 'rooms', 'ward'];

	const DOTS_KEY = 'basalt-patient-flow-dots';

	function start() {
		const strip = document.querySelector('[data-pf-strip]');
		const flow = document.querySelector('[data-hc-flow]');
		if (!strip || !flow) return;
		wireDots(flow);
		const settled = (window.Basalt && window.Basalt.settled) || Promise.resolve();
		settled.then(() => requestAnimationFrame(() => drawJourney(flow)));
		strip.addEventListener('hc-vstrip-focus', (event) => {
			const stop = STOPS[event.detail.index];
			if (stop) flow.dataset.pfFocus = stop;
			else delete flow.dataset.pfFocus;
		});
	}

	/* The stops top to bottom for narrow screens: the main path, with the
	   lab and the ward as side trips off the exam rooms. */
	const JOURNEY = [
		['door', false],
		['wait', false],
		['rooms', false],
		['lab', true],
		['ward', true],
		['home', false],
	];

	/** On tablets and phones the wide drawing gives way to the same stops as
	 * one vertical journey, read from the drawing healthcare.js made. */
	function drawJourney(flow) {
		const art = flow.querySelector('.hc-flow-art');
		if (!art || flow.querySelector('.pf-journey')) return;
		const text = (stop, cls) => stop.querySelector(`.${cls}`)?.textContent.trim() || '';
		const items = JOURNEY.map(([key, side]) => {
			const stop = art.querySelector(`.stop-${key}`);
			if (!stop) return '';
			return `<li data-pf-stop="${key}" class="${side ? 'is-side' : ''}">
				<a href="${stop.getAttribute('href')}" class="pf-journey-stop">
					<span class="pf-journey-label">${text(stop, 'stop-label')}</span>
					<span class="pf-journey-read"><b>${text(stop, 'stop-figure')}</b> ${text(stop, 'stop-unit')}</span>
					<span class="pf-journey-line">${text(stop, 'stop-line')}</span>
				</a>
			</li>`;
		}).join('');
		flow.insertAdjacentHTML(
			'beforeend',
			`<ol class="pf-journey" aria-label="Today's patients, door to home">${items}</ol>`,
		);
	}

	/** The Moving dots switch: off pauses the flow's animations and hides the
	 * dots; the choice is kept for the next visit. */
	function wireDots(flow) {
		const toggle = document.querySelector('[data-pf-dots]');
		if (!toggle) return;
		let saved = null;
		try {
			saved = localStorage.getItem(DOTS_KEY);
		} catch {
			/* storage blocked: the switch still works for this visit */
		}
		const apply = (on) => {
			flow.classList.toggle('is-still', !on);
			const art = flow.querySelector('.hc-flow-art');
			if (art) on ? art.unpauseAnimations() : art.pauseAnimations();
		};
		toggle.checked = saved !== 'off';
		/* healthcare.js draws the flow once Basalt has settled; apply after it. */
		const settled = (window.Basalt && window.Basalt.settled) || Promise.resolve();
		settled.then(() => requestAnimationFrame(() => apply(toggle.checked)));
		toggle.addEventListener('change', () => {
			apply(toggle.checked);
			try {
				localStorage.setItem(DOTS_KEY, toggle.checked ? 'on' : 'off');
			} catch {
				/* storage blocked */
			}
		});
	}

	start();
})();
