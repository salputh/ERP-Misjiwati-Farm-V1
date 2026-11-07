/**
 * The texts Broadway Street Clinic sends its patients, read by
 * appointments.html and telehealth.html and by any page that sends one
 * (a booking that texts a reminder, a result that texts a link).
 *
 * window.Basalt.data.clinicTexts carries:
 *   clinic       the sender's name, phone and the opt-out line every text ends with
 *   fields       the fill-ins a message may use, written {first name}, {provider}…
 *   categories   the groups templates sit in, in menu order
 *   events       what sets a text off; `timed` ones take an amount and a unit
 *   moments      the stops of a visit, from booking to follow-up, in order
 *   samples      patients to preview a text with, and their next visit
 *   templates    the templates themselves, with this month's numbers
 * and the helpers below: find, byCategory, timing, moment, clock,
 * dateLabel, sampleValues, sendsAt, fill, render and count. Replace the lists with the same fields to run on real records.
 */
(() => {
	'use strict';

	const clinic = {
		name: 'Broadway Street Clinic',
		phone: '(415) 555-0100',
		optOut: 'Reply STOP to opt out.',
	};

	/* `key` is what render() expects in its values; `label` is what sits
	   between the braces in a message. */
	const fields = [
		{ key: 'firstName', label: 'first name' },
		{ key: 'provider', label: 'provider' },
		{ key: 'date', label: 'date' },
		{ key: 'time', label: 'time' },
		{ key: 'clinic', label: 'clinic' },
		{ key: 'clinicPhone', label: 'clinic phone' },
		{ key: 'link', label: 'link' },
	];

	/* `tone` picks a chart series color (1 to 8). */
	const categories = [
		{ key: 'reminder', name: 'Visit reminders', tone: 1 },
		{ key: 'booking', name: 'Booking confirmations', tone: 2 },
		{ key: 'surgery', name: 'Surgery and procedure updates', short: 'Surgery updates', tone: 6 },
		{ key: 'results', name: 'Results ready', tone: 3 },
		{ key: 'rx', name: 'Prescriptions', tone: 5 },
		{ key: 'billing', name: 'Billing', tone: 4 },
		{ key: 'video', name: 'Telehealth links', tone: 7 },
		{ key: 'after', name: 'After the visit', tone: 8 },
		{ key: 'noshow', name: 'No-show follow-up', tone: 2 },
	];

	const events = [
		{ key: 'before', label: 'Before the visit', timed: true },
		{ key: 'booked', label: 'When the visit is booked' },
		{ key: 'moved', label: 'When the visit is moved' },
		{ key: 'after', label: 'After the visit', timed: true },
		{ key: 'results', label: 'When results are signed' },
		{ key: 'rx', label: 'When a prescription is sent' },
		{ key: 'bill', label: 'When a bill is ready' },
		{ key: 'missed', label: 'When a visit is missed' },
	];

	const moments = [
		{ key: 'booked', name: 'Booked' },
		{ key: 'eve', name: 'Day before' },
		{ key: 'morning', name: 'Morning of' },
		{ key: 'after', name: 'After the visit' },
		{ key: 'results', name: 'Results signed' },
		{ key: 'follow', name: 'Follow-up' },
	];

	/* Who a template goes to: every visit, video visits only, or procedures. */
	const audiences = [
		{ key: 'all', name: 'All visits' },
		{ key: 'video', name: 'Video' },
		{ key: 'procedure', name: 'Procedures' },
	];

	/* `visit` is the sample's next visit, local time. */
	const samples = [
		{ patient: 'Heidi Fairley', provider: 'Dr. Morgan', visit: '2026-10-23T11:30', link: 'hsc.care/m/7KQ2' },
		{ patient: 'Oliver Hart', provider: 'Dr. Ashby', visit: '2026-10-12T09:15', link: 'hsc.care/m/R4T8' },
		{ patient: 'Lisa Talley', provider: 'Dr. Pearce', visit: '2026-10-13T14:40', link: 'hsc.care/m/9WBX' },
		{ patient: 'Rose Parker', provider: 'Dr. Hayes', visit: '2026-10-15T08:00', link: 'hsc.care/m/D2LP' },
	];

	/* `when` is { event, amount, unit, at }: unit is minutes, hours or days,
	   and `at` (24-hour) only applies to days. `stats` is this month. */
	const templates = [
		{
			id: 'tx-reminder-eve',
			name: 'Visit reminder',
			category: 'reminder',
			audience: 'all',
			when: { event: 'before', amount: 1, unit: 'days', at: '18:00' },
			body: 'Hi {first name}, reminder of your visit with {provider} on {date} at {time}. Reply C to confirm, R to reschedule. {clinic}',
			on: true,
			stats: { sent: 1284, replies: 911, optOuts: 4 },
		},
		{
			id: 'tx-reminder-morning',
			name: 'Morning reminder',
			category: 'reminder',
			audience: 'all',
			when: { event: 'before', amount: 2, unit: 'hours', at: null },
			body: 'Hi {first name}, see you today at {time} with {provider}. Please come 10 minutes early with your insurance card. {clinic}',
			on: true,
			stats: { sent: 1197, replies: 86, optOuts: 3 },
		},
		{
			id: 'tx-booked',
			name: 'Visit booked',
			category: 'booking',
			audience: 'all',
			when: { event: 'booked', amount: 0, unit: 'hours', at: null },
			body: "Hi {first name}, you're booked with {provider} on {date} at {time}. Need to change it? Call {clinic phone}. {clinic}",
			on: true,
			stats: { sent: 1342, replies: 58, optOuts: 2 },
		},
		{
			id: 'tx-moved',
			name: 'Visit moved',
			category: 'booking',
			audience: 'all',
			when: { event: 'moved', amount: 0, unit: 'hours', at: null },
			body: "Hi {first name}, your visit with {provider} is now on {date} at {time}. Reply R if that doesn't suit you. {clinic}",
			on: true,
			stats: { sent: 164, replies: 37, optOuts: 0 },
		},
		{
			id: 'tx-surgery-prep',
			name: 'Procedure prep',
			category: 'surgery',
			audience: 'procedure',
			when: { event: 'before', amount: 2, unit: 'days', at: '09:00' },
			body: 'Hi {first name}, your procedure is {date} at {time}. Nothing to eat after midnight, water is fine until 6 am. Questions? {clinic phone}',
			on: true,
			stats: { sent: 88, replies: 41, optOuts: 0 },
		},
		{
			id: 'tx-surgery-done',
			name: 'Out of surgery',
			category: 'surgery',
			audience: 'procedure',
			when: { event: 'after', amount: 0, unit: 'hours', at: null },
			body: "Hi {first name}, your procedure with {provider} went as planned. We'll text again when you're ready to go home. {clinic}",
			on: true,
			stats: { sent: 79, replies: 33, optOuts: 0 },
		},
		{
			id: 'tx-surgery-check',
			name: 'Surgery check-in',
			category: 'surgery',
			audience: 'procedure',
			when: { event: 'after', amount: 2, unit: 'days', at: '10:00' },
			body: 'Hi {first name}, checking in after your procedure. A fever, more pain or swelling? Call us at {clinic phone} any time. {clinic}',
			on: true,
			stats: { sent: 74, replies: 29, optOuts: 1 },
		},
		{
			id: 'tx-results',
			name: 'Results ready',
			category: 'results',
			audience: 'all',
			when: { event: 'results', amount: 0, unit: 'hours', at: null },
			body: 'Hi {first name}, your results from {provider} are ready. Read them securely here: {link} {clinic}',
			on: true,
			stats: { sent: 512, replies: 22, optOuts: 1 },
		},
		{
			id: 'tx-results-call',
			name: 'Please call us',
			category: 'results',
			audience: 'all',
			when: { event: 'results', amount: 0, unit: 'hours', at: null },
			body: '{provider} would like to talk through your results, {first name}. Please call {clinic phone} to set a time. {clinic}',
			on: true,
			stats: { sent: 61, replies: 18, optOuts: 0 },
		},
		{
			id: 'tx-rx-sent',
			name: 'Prescription sent',
			category: 'rx',
			audience: 'all',
			when: { event: 'rx', amount: 0, unit: 'hours', at: null },
			body: 'Hi {first name}, {provider} sent your prescription to your pharmacy. It is usually ready within 2 hours. {clinic}',
			on: true,
			stats: { sent: 436, replies: 15, optOuts: 1 },
		},
		{
			id: 'tx-bill',
			name: 'Bill ready',
			category: 'billing',
			audience: 'all',
			when: { event: 'bill', amount: 0, unit: 'hours', at: null },
			body: 'Hi {first name}, the bill for your visit on {date} is ready. See it and pay here: {link} Questions? Call {clinic phone}.',
			on: true,
			stats: { sent: 618, replies: 47, optOuts: 5 },
		},
		{
			id: 'tx-video-link',
			name: 'Video visit link',
			category: 'video',
			audience: 'video',
			when: { event: 'before', amount: 15, unit: 'minutes', at: null },
			body: 'Hi {first name}, your video visit with {provider} starts at {time}. Join from your phone: {link} {clinic}',
			on: true,
			stats: { sent: 203, replies: 9, optOuts: 0 },
		},
		{
			id: 'tx-how-was-it',
			name: 'Visit feedback',
			category: 'after',
			audience: 'all',
			when: { event: 'after', amount: 2, unit: 'hours', at: null },
			body: 'Hi {first name}, thank you for coming in today. How was your visit with {provider}? Two taps to tell us: {link}',
			on: false,
			stats: { sent: 0, replies: 0, optOuts: 0 },
		},
		{
			id: 'tx-missed',
			name: 'Missed visit',
			category: 'noshow',
			audience: 'all',
			when: { event: 'missed', amount: 0, unit: 'hours', at: null },
			body: 'Hi {first name}, we missed you today with {provider}. Reply R and we will find a new time, or call {clinic phone}. {clinic}',
			on: true,
			stats: { sent: 57, replies: 24, optOuts: 2 },
		},
	];

	/* Characters a plain text can carry in one segment (GSM-7). Anything
	   else, an emoji or a curly quote, turns the whole text into Unicode. */
	const GSM =
		'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
	const GSM_WIDE = '^{}\\[~]|€';

	const byId = (id) => templates.find((t) => t.id === id);

	/** "1 day before at 6:00 pm", "2 hours after the visit", "When results are signed". */
	function timing(when) {
		const event = events.find((e) => e.key === when.event);
		if (!event) return '';
		if (!event.timed) return event.label;
		if (when.event === 'after' && !when.amount) return 'When the visit ends';
		const unit = when.amount === 1 ? when.unit.replace(/s$/, '') : when.unit;
		const side = when.event === 'before' ? 'before' : 'after the visit';
		const at = when.unit === 'days' && when.at ? ` at ${clock(when.at)}` : '';
		return `${when.amount} ${unit} ${side}${at}`;
	}

	/** Which stop of a visit a template's text lands on (a key of moments). */
	function moment(when) {
		if (when.event === 'booked' || when.event === 'moved') return 'booked';
		if (when.event === 'before') return when.unit === 'days' ? 'eve' : 'morning';
		if (when.event === 'after') return when.unit === 'days' ? 'follow' : 'after';
		if (when.event === 'results') return 'results';
		if (when.event === 'bill') return 'follow';
		return 'after';
	}

	/**
	 * When a timed template goes out for a visit, taking a visit as half an
	 * hour long. Texts set off by something else (a result, a bill) have no
	 * time of their own, so they return null.
	 * @param {object} when   a template's `when`
	 * @param {string} visit  the visit's local start, "2026-10-23T11:30"
	 * @returns {Date|null}
	 */
	function sendsAt(when, visit) {
		if (when.event !== 'before' && when.event !== 'after') return null;
		const [day, hhmm] = visit.split('T');
		const [y, m, d] = day.split('-').map(Number);
		const [h, min] = hhmm.split(':').map(Number);
		const sign = when.event === 'before' ? -1 : 1;
		if (when.unit === 'days') {
			const [ah, am] = (when.at || hhmm).split(':').map(Number);
			return new Date(y, m - 1, d + sign * when.amount, ah, am);
		}
		const minutes = when.unit === 'hours' ? when.amount * 60 : when.amount;
		const start = sign < 0 ? h * 60 + min : h * 60 + min + 30;
		return new Date(y, m - 1, d, 0, start + sign * minutes);
	}

	/** "2026-10-23" (or a full local date-time) as "Fri, Oct 23". */
	function dateLabel(iso) {
		const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	/** A sample patient's fill-in values, ready for render(). */
	function sampleValues(sample) {
		return {
			firstName: sample.patient.split(' ')[0],
			provider: sample.provider,
			date: dateLabel(sample.visit),
			time: clock(sample.visit.slice(11, 16)),
			link: sample.link,
		};
	}

	/** "18:00" as "6:00 pm". */
	function clock(hhmm) {
		const [h, m] = hhmm.split(':').map(Number);
		return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
	}

	/**
	 * Fills a message's fill-ins. Values are keyed by field key; the clinic's
	 * name and phone fill themselves. A fill-in with no value stays as written.
	 */
	function fill(body, values = {}) {
		const given = { clinic: clinic.name, clinicPhone: clinic.phone, ...values };
		return body.replace(/\{([a-z ]+)\}/g, (whole, label) => {
			const field = fields.find((f) => f.label === label);
			return field && given[field.key] != null ? given[field.key] : whole;
		});
	}

	/**
	 * The text a patient receives from a template, opt-out line included.
	 * @param {string} templateId  a template's id
	 * @param {object} values      { firstName, provider, date, time, link }
	 * @returns {string} the filled text, or '' for an unknown id
	 */
	function render(templateId, values) {
		const template = byId(templateId);
		if (!template) return '';
		return `${fill(template.body, values)} ${clinic.optOut}`;
	}

	/**
	 * How a text bills: its length, whether it is Unicode, the room in one
	 * segment (160, or 70 with an emoji) and how many segments it takes.
	 * Longer texts split into parts of 153 (or 67) to leave room for the header.
	 */
	function count(text) {
		const chars = [...text];
		const unicode = chars.some((ch) => !GSM.includes(ch) && !GSM_WIDE.includes(ch));
		const length = unicode
			? chars.reduce((sum, ch) => sum + (ch.length > 1 ? 2 : 1), 0)
			: chars.reduce((sum, ch) => sum + (GSM_WIDE.includes(ch) ? 2 : 1), 0);
		const single = unicode ? 70 : 160;
		const part = unicode ? 67 : 153;
		const segments = length <= single ? 1 : Math.ceil(length / part);
		return { length, unicode, single, segments };
	}

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.clinicTexts = {
		clinic,
		fields,
		categories,
		events,
		moments,
		audiences,
		samples,
		templates,
		/** The template with this id, or undefined. */
		find: byId,
		/** The templates in a category, in list order; switched-off ones included. */
		byCategory(key) {
			return templates.filter((t) => t.category === key);
		},
		timing,
		moment,
		clock,
		dateLabel,
		sampleValues,
		sendsAt,
		fill,
		render,
		count,
	};
})();
