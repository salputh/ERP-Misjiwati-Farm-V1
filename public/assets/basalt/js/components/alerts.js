/**
 * Component script for alerts, banners and alert groups. It loads after assets/basalt/js/basalt.js, and
 * only on the pages that use it; documentation.html#page-map lists them.
 */

/**
 * Alerts, banners and alert groups; the markup is on alerts.html.
 * window.Basalt.alert:
 *   dismiss(alert)          fades the alert out, then hides it
 *   timer(alert, seconds)   starts a countdown; returns { stop, keep } or null
 *   stop(alert)             ends a countdown and leaves the alert open
 *   refresh(root)           recounts the banners and groups under root
 * Markup hooks: [data-basalt-alert-close] closes its .alert,
 * [data-basalt-alert-timer="8"] counts down from load,
 * [data-basalt-alert-keep] cancels that countdown for good,
 * [data-basalt-banner] pages through slides and closes, and
 * [data-basalt-alert-group] keeps a count, a tally, show all and clear.
 * basalt:alert-closed and basalt:banner-closed both bubble.
 */
(() => {
	'use strict';
	if (window.Basalt.alert) return;

	/* The countdown running on each alert, the group lists already under
     observation, how a group tally names each tone, and the classes that
     lay out a folded deck (classes, not :nth-child, so a hidden alert
     never leaves an empty layer behind). */
	const countdowns = new WeakMap();
	const observedLists = new WeakSet();
	const TONE_WORDS = { danger: 'urgent', warning: 'to check', info: 'for info', success: 'done' };
	const DECK_LAYERS = ['is-front', 'is-peek', 'is-peek-2', 'is-tucked'];
	const CLICK_ACTIONS = [
		['data-basalt-alert-close', closeFromButton],
		['data-basalt-alert-keep', keepFromButton],
		['data-basalt-banner-next', (button) => turnBanner(button.closest('[data-basalt-banner]'), 1)],
		['data-basalt-banner-prev', (button) => turnBanner(button.closest('[data-basalt-banner]'), -1)],
		['data-basalt-banner-close', closeBanner],
		['data-basalt-alert-group-toggle', flipGroup],
		['data-basalt-alert-group-clear', clearGroup],
	];
	const CLICK_TARGETS = CLICK_ACTIONS.map(([name]) => `[${name}]`).join(', ');

	function start() {
		document.addEventListener('click', onAlertClick);
		document.addEventListener('keydown', onBannerArrows);
		window.Basalt.alert = { dismiss: fadeOut, timer: runCountdown, stop: haltCountdown, refresh: rescan };
		if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => rescan());
		else rescan();
	}

	/** Fades an alert out and hides it, firing basalt:alert-closed. */
	function fadeOut(alert) {
		if (!alert || alert.hidden) return;
		countdowns.get(alert)?.stop();
		if (prefersStill()) {
			finishClosing(alert);
			return;
		}
		alert.classList.add('is-leaving');
		setTimeout(() => finishClosing(alert), 220);
	}

	function finishClosing(alert) {
		alert.classList.remove('is-leaving');
		alert.hidden = true;
		alert.dispatchEvent(new CustomEvent('basalt:alert-closed', { bubbles: true }));
	}

	/**
	 * Runs the countdown row of an alert. It holds while the pointer rests on
	 * the alert, while focus is inside it and while the tab is hidden.
	 * @param {Element} alert
	 * @param {number} [seconds]  defaults to the row's attribute, then 8
	 * @returns {{stop: Function, keep: Function}|null} null without a row
	 */
	function runCountdown(alert, seconds) {
		countdowns.get(alert)?.stop();
		const strip = alert.querySelector('[data-basalt-alert-timer]');
		if (!strip) return null;
		const span = (seconds || parseFloat(strip.getAttribute('data-basalt-alert-timer')) || 8) * 1000;
		const readout = strip.querySelector('[data-basalt-alert-left]');
		const keepButton = strip.querySelector('[data-basalt-alert-keep]');
		const rail = strip.querySelector('.basalt-alert-timer-track');
		const holds = new Set();
		let remaining = span;
		let previous = performance.now();
		let lastSecond = -1;
		let frame = 0;
		let ended = false;

		strip.hidden = false;
		if (rail) rail.hidden = false;
		if (keepButton) keepButton.hidden = false;
		/* The visible seconds tick every second; a screen reader hears one
       sentence up front instead of a number repeated over and over. */
		readout?.setAttribute('aria-hidden', 'true');
		const sentence = spokenNote(strip);
		sentence.textContent = `Closes by itself after ${Math.round(span / 1000)} seconds unless you keep it open.`;

		const listeners = {
			mouseenter: () => hold('hover'),
			mouseleave: () => release('hover'),
			focusin: () => hold('focus'),
			focusout: (event) => {
				if (!alert.contains(event.relatedTarget)) release('focus');
			},
		};
		for (const [type, listener] of Object.entries(listeners)) alert.addEventListener(type, listener);
		document.addEventListener('visibilitychange', onTabChange);
		if (alert.matches(':hover')) hold('hover');
		if (alert.contains(document.activeElement)) hold('focus');

		const control = {
			stop() {
				ended = true;
				cancelAnimationFrame(frame);
				alert.classList.remove('is-paused');
				for (const [type, listener] of Object.entries(listeners)) alert.removeEventListener(type, listener);
				document.removeEventListener('visibilitychange', onTabChange);
				if (countdowns.get(alert) === control) countdowns.delete(alert);
			},
			keep() {
				control.stop();
				if (rail) rail.hidden = true;
				if (keepButton) keepButton.hidden = true;
				if (readout) {
					readout.textContent = 'Kept open';
					readout.removeAttribute('aria-hidden');
				}
				sentence.textContent = '';
			},
		};
		countdowns.set(alert, control);
		draw();
		frame = requestAnimationFrame((now) => {
			previous = now;
			advance(now);
		});
		return control;

		function advance(now) {
			if (ended) return;
			if (!alert.isConnected || alert.hidden) {
				control.stop();
				return;
			}
			if (holds.size === 0) remaining -= now - previous;
			previous = now;
			draw();
			if (remaining <= 0) {
				control.stop();
				fadeOut(alert);
				return;
			}
			frame = requestAnimationFrame(advance);
		}

		function draw() {
			const secondsLeft = Math.max(0, Math.ceil(remaining / 1000));
			const fraction = prefersStill() ? secondsLeft / (span / 1000) : remaining / span;
			const level = Math.max(0, fraction).toFixed(4);
			strip.style.setProperty('--basalt-alert-left', level);
			alert.style.setProperty('--basalt-alert-left', level);
			if (!readout || secondsLeft === lastSecond) return;
			lastSecond = secondsLeft;
			readout.textContent = `Closes in ${secondsLeft} s`;
		}

		function hold(reason) {
			holds.add(reason);
			alert.classList.add('is-paused');
		}

		function release(reason) {
			holds.delete(reason);
			if (!holds.size) alert.classList.remove('is-paused');
		}

		function onTabChange() {
			if (document.hidden) hold('tab');
			else release('tab');
		}
	}

	/** Stops an alert's countdown without closing the alert. */
	function haltCountdown(alert) {
		countdowns.get(alert)?.stop();
	}

	/** Brings banners, groups and countdowns under root up to date. */
	function rescan(root) {
		const scope = root || document;
		for (const banner of scope.querySelectorAll('[data-basalt-banner]')) labelBanner(banner);
		for (const group of scope.querySelectorAll('[data-basalt-alert-group]')) layoutGroup(group);
		for (const strip of scope.querySelectorAll('[data-basalt-alert-timer]')) {
			const alert = strip.closest('.alert');
			if (!alert || strip.hidden || !strip.getAttribute('data-basalt-alert-timer') || countdowns.has(alert))
				continue;
			runCountdown(alert);
		}
	}

	function spokenNote(strip) {
		const existing = strip.querySelector('.basalt-alert-timer-note');
		if (existing) return existing;
		const note = document.createElement('span');
		note.className = 'visually-hidden basalt-alert-timer-note';
		strip.prepend(note);
		return note;
	}

	function onAlertClick(event) {
		const button = event.target.closest?.(CLICK_TARGETS);
		if (!button) return;
		const [, act] = CLICK_ACTIONS.find(([name]) => button.hasAttribute(name));
		act(button);
	}

	/* With focus on a banner's pager, Left and Right turn the slides. */
	function onBannerArrows(event) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		const pager = event.target.closest?.('.basalt-banner-pager');
		if (!pager) return;
		event.preventDefault();
		const forward = event.key === 'ArrowRight';
		const banner = pager.closest('[data-basalt-banner]');
		turnBanner(banner, forward ? 1 : -1);
		banner.querySelector(forward ? '[data-basalt-banner-next]' : '[data-basalt-banner-prev]')?.focus();
	}

	/* Inside a group the alert goes at once, and focus passes to whichever
     alert now sits in its place, or to the empty state. */
	function closeFromButton(button) {
		const alert = button.closest('.alert');
		const group = button.closest('[data-basalt-alert-group]');
		if (!group || !alert) {
			fadeOut(alert);
			return;
		}
		const position = layoutGroup(group).indexOf(alert);
		alert.hidden = true;
		alert.dispatchEvent(new CustomEvent('basalt:alert-closed', { bubbles: true }));
		const rest = layoutGroup(group);
		const neighbor = rest[Math.min(position, rest.length - 1)];
		landFocus(neighbor ? neighbor.querySelector('[data-basalt-alert-close]') : blankNote(group));
	}

	/* The keep button hides itself, so focus moves on inside the alert. */
	function keepFromButton(button) {
		const alert = button.closest('.alert');
		if (!alert) return;
		countdowns.get(alert)?.keep();
		alert.querySelector('.basalt-alert-actions .btn, [data-basalt-alert-close]')?.focus();
	}

	function closeBanner(button) {
		const banner = button.closest('[data-basalt-banner]');
		banner.hidden = true;
		banner.dispatchEvent(new CustomEvent('basalt:banner-closed', { bubbles: true }));
	}

	function flipGroup(button) {
		const group = button.closest('[data-basalt-alert-group]');
		group.classList.toggle('is-open');
		layoutGroup(group);
	}

	function clearGroup(button) {
		const group = button.closest('[data-basalt-alert-group]');
		for (const item of group.querySelectorAll('.basalt-alert-group-list > *')) item.hidden = true;
		group.classList.remove('is-open');
		layoutGroup(group);
		group.dispatchEvent(new CustomEvent('basalt:alert-closed', { bubbles: true }));
		group.querySelector('[data-basalt-alert-group-empty] button')?.focus();
	}

	function slidesOf(banner) {
		const slides = [...banner.querySelectorAll('.basalt-banner-slide')];
		return {
			slides,
			current: Math.max(
				0,
				slides.findIndex((slide) => !slide.hidden),
			),
		};
	}

	function turnBanner(banner, step) {
		const { slides, current } = slidesOf(banner);
		if (slides.length < 2) return;
		const shown = (current + step + slides.length) % slides.length;
		for (const [index, slide] of slides.entries()) {
			slide.hidden = index !== shown;
			slide.classList.toggle('is-entering', index === shown);
		}
		labelBanner(banner);
	}

	function labelBanner(banner) {
		const { slides, current } = slidesOf(banner);
		const counter = banner.querySelector('[data-basalt-banner-count]');
		if (counter) counter.textContent = `${current + 1} / ${slides.length}`;
		const pager = banner.querySelector('.basalt-banner-pager');
		if (pager) pager.hidden = slides.length < 2;
	}

	/**
	 * Lays an alert group out again from the alerts still showing.
	 * @returns {Element[]} the visible alerts, front first
	 */
	function layoutGroup(group) {
		const list = group.querySelector('.basalt-alert-group-list');
		const showing = list ? [...list.children].filter((item) => !item.hidden) : [];
		const total = showing.length;
		writeGroupCount(group, total);
		writeGroupTally(group, showing);
		writeGroupToggle(group, list, total);
		const parts = [
			group.querySelector('[data-basalt-alert-group-clear]'),
			group.querySelector('.basalt-alert-group-title'),
			group.querySelector('[data-basalt-alert-group-tally]'),
			list,
		];
		for (const part of parts) {
			if (part) part.hidden = total === 0;
		}
		const placeholder = group.querySelector('[data-basalt-alert-group-empty]');
		if (placeholder) placeholder.hidden = total > 0;
		if (list) {
			for (const child of list.children) child.classList.remove(...DECK_LAYERS);
		}
		for (const [depth, item] of showing.entries()) item.classList.add(DECK_LAYERS[Math.min(depth, 3)]);
		observeGroup(group, list);
		return showing;
	}

	function writeGroupCount(group, total) {
		const counter = group.querySelector('[data-basalt-alert-group-count]');
		if (!counter) return;
		counter.textContent = total;
		if (counter.nextSibling) counter.nextSibling.textContent = total === 1 ? ' notice' : ' notices';
	}

	function writeGroupTally(group, showing) {
		const strip = group.querySelector('[data-basalt-alert-group-tally]');
		if (!strip) return;
		const perTone = new Map();
		for (const item of showing) {
			const tone = item.getAttribute('data-tone') || 'info';
			perTone.set(tone, (perTone.get(tone) || 0) + 1);
		}
		strip.replaceChildren();
		for (const [tone, words] of Object.entries(TONE_WORDS)) {
			const hits = perTone.get(tone);
			if (!hits) continue;
			const chip = document.createElement('span');
			chip.setAttribute('data-tone', tone);
			chip.textContent = `${hits} ${words}`;
			strip.append(chip);
		}
	}

	function writeGroupToggle(group, list, total) {
		const button = group.querySelector('[data-basalt-alert-group-toggle]');
		if (!button) return;
		if (list) {
			if (!list.id) list.id = `basalt-alert-group-${Math.random().toString(36).slice(2, 8)}`;
			button.setAttribute('aria-controls', list.id);
		}
		button.hidden = total < 2;
		const expanded = group.classList.contains('is-open');
		button.setAttribute('aria-expanded', String(expanded));
		button.textContent = expanded ? 'Show fewer' : `Show all ${total}`;
		if (total < 2) group.classList.remove('is-open');
	}

	/* Any change to a group's list (an alert hidden, shown, dropped by
     Bootstrap's data-bs-dismiss or added by a script) lays the group out
     again. If the change took focus with it, focus goes to the front
     alert's close button, or to the empty state. */
	function observeGroup(group, list) {
		if (!list || observedLists.has(list)) return;
		observedLists.add(list);
		const watcher = new MutationObserver((records) => {
			const matters = records.some(
				(record) => record.type === 'childList' || record.target.parentElement === list,
			);
			if (!matters || !group.isConnected) return;
			const focusLost = !document.activeElement || document.activeElement === document.body;
			const remaining = layoutGroup(group);
			if (!focusLost) return;
			landFocus(
				remaining.length
					? remaining[0].querySelector('[data-basalt-alert-close], [data-bs-dismiss="alert"]')
					: blankNote(group),
			);
		});
		watcher.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
	}

	function blankNote(group) {
		return group.querySelector('[data-basalt-alert-group-empty] button, [data-basalt-alert-group-empty]');
	}

	function landFocus(target) {
		if (!target) return;
		if (!target.matches('button')) target.setAttribute('tabindex', '-1');
		target.focus();
	}

	function prefersStill() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	start();
})();
