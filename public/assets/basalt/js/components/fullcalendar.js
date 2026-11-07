/**
 * Component script for FullCalendar in Basalt's colors. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/* 
   FullCalendar
     window.Basalt.calendar(el, options) builds a FullCalendar 6 calendar
     (the page loads FullCalendar from assets/vendor first) with Basalt's
     defaults, then renders it and returns it. Your options win.
       - US 12-hour times: "9:30 am", "10 am"
       - weeks start on Monday; Today, Month, Week, Day and List buttons
       - height 'auto', so the calendar grows with its content and never
         scrolls inside the card
     Colors live in basalt.css (the FullCalendar section) as theme
     tokens, so a calendar follows the palette and mode by itself. On
     basalt:appearance each calendar re-renders, which redraws anything
     a page colored from code (eventDidMount and the like).
     Event colors: classNames: ['basalt-fc-tone-1'] up to 8.
     window.Basalt.calendar.clock(date) gives the same "9:30 am" text.
    */
(() => {
	'use strict';
	function clock(h, m) {
		return `${(h % 12 || 12) + (m ? `:${String(m).padStart(2, '0')}` : '')} ${h < 12 ? 'am' : 'pm'}`;
	}

	function fromArg(arg) {
		return clock(arg.date.hour, arg.date.minute);
	}

	const live = new Set();

	window.Basalt.calendar = function (el, options) {
		if (!el || !window.FullCalendar) return null;
		const cal = new window.FullCalendar.Calendar(
			el,
			Object.assign(
				{
					firstDay: 1,
					height: 'auto',
					nowIndicator: true,
					dayMaxEvents: 3,
					eventShortHeight: 44,
					eventTimeFormat: fromArg,
					slotLabelFormat: fromArg,
					allDayText: 'All day',
					buttonText: { today: 'Today', month: 'Month', week: 'Week', day: 'Day', list: 'List' },
					moreLinkContent: (arg) => `${arg.num} more`,
					moreLinkDidMount: (arg) => arg.el.setAttribute('role', 'button'),
					noEventsContent: 'Nothing on the calendar',
					dayHeaderFormat: { weekday: 'short' },
					views: {
						timeGrid: {
							dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true },
						},
					},
				},
				options || {},
			),
		);
		cal.render();
		live.add(cal);
		/* FullCalendar marks its arrow glyphs as unlabeled images and its "+3
		   more" links as expandable; the buttons around them already carry the
		   words, so the glyphs are hidden from screen readers. */
		const quietGlyphs = () => {
			for (const glyph of el.querySelectorAll('.fc-icon[role="img"]')) {
				glyph.removeAttribute('role');
				glyph.setAttribute('aria-hidden', 'true');
			}
			for (const more of el.querySelectorAll('.fc-daygrid-more-link[aria-expanded]'))
				more.removeAttribute('aria-expanded');
		};
		quietGlyphs();
		cal.on('datesSet', quietGlyphs);
		cal.on('eventsSet', quietGlyphs);
		/* FullCalendar only re-measures when the window resizes; collapsing the
       menu widens the page without one, so follow the element's own width,
       a frame later so the resize does not feed back into the observer. */
		if (window.ResizeObserver) {
			let width = el.clientWidth;
			new ResizeObserver(() => {
				requestAnimationFrame(() => {
					if (el.clientWidth === width) return;
					width = el.clientWidth;
					cal.updateSize();
				});
			}).observe(el);
		}
		return cal;
	};
	window.Basalt.calendar.clock = (d) => clock(d.getHours(), d.getMinutes());

	document.addEventListener('basalt:appearance', () => {
		live.forEach((cal) => {
			if (cal.el && cal.el.isConnected) cal.render();
			else live.delete(cal);
		});
	});
})();
