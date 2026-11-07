/**
 * The saved-report library behind window.Basalt.data.reports: who is on
 * the team, every saved report with its delivery and sharing settings,
 * and a change log per report. The Reports library, a single report
 * (report-details.html?id=r-101), the Report Builder and the saved
 * reports strip on Financial Reports all read it, so a name, owner or
 * schedule never disagrees between them. Replace the records with your
 * own and keep the field names.
 */
(() => {
	'use strict';

	/* Everyone a report can belong to or be shared with. The last entry
     is not a person: it owns the starter reports the product ships. */
	const team = [
		{ name: 'John Armstrong', id: 'ja', role: 'Revenue lead' },
		{ name: 'Robyn Daniels', id: 'rd', role: 'Finance' },
		{ name: 'Lance Bishop', id: 'lo', role: 'Revenue operations' },
		{ name: 'Marshall Beck', id: 'dk', role: 'Pro' },
		{ name: 'Elise Vick', id: 'ev', role: 'Customer success' },
		{ name: 'Rowan Walsh', id: 'ew', role: 'Sales' },
		{ name: 'Leslie Whitlock', id: 'hw', role: 'Product' },
		{ name: 'Template', id: 'tpl', role: 'Ready-made report' },
	];

	/* Every report follows the page's date range unless it says otherwise
     (a range can also be a fixed count of months up to the latest one),
     starts unstarred, and goes out on no schedule. */
	const unlessStated = { range: 'page', starred: false, schedule: null };

	const weeklyDigestList = ['Robyn Daniels', 'Rowan Walsh', 'Leslie Whitlock'];

	/* The library, in the order the pages list it. */
	const library = [
		savedReport({
			id: 'r-101',
			owner: 'ja',
			updated: '2026-09-28',
			starred: true,
			name: 'Monday MRR',
			summary: 'Recurring revenue at the end of each month, against the period before.',
			kind: 'line',
			metric: 'mrr',
			breakdown: 'none',
			opens: 64,
			schedule: delivery('weekly', 1, '08:00', 'PDF', weeklyDigestList),
			share: { people: ['rd', 'ew', 'hw'] },
		}),
		savedReport({
			id: 'r-102',
			owner: 'lo',
			updated: '2026-09-24',
			name: 'MRR by plan',
			summary: 'How Basic, Pro and Max each add to the monthly total.',
			kind: 'stacked',
			metric: 'mrr',
			breakdown: 'plan',
			opens: 41,
			share: { people: ['ja', 'rd'], link: true },
		}),
		savedReport({
			id: 'r-104',
			owner: 'ja',
			updated: '2026-09-17',
			name: 'Revenue by region',
			summary: 'Share of MRR from each region at the end of the range.',
			kind: 'ring',
			metric: 'mrr',
			breakdown: 'region',
			opens: 22,
		}),
		savedReport({
			id: 'r-105',
			owner: 'dk',
			updated: '2026-09-26',
			name: 'Trials by plan',
			summary: 'Self-serve trials started, largest plan first.',
			kind: 'bars',
			metric: 'trials',
			breakdown: 'plan',
			opens: 33,
			schedule: delivery('weekly', 1, '09:00', 'Link', ['John Armstrong', 'Leslie Whitlock']),
			share: { people: ['ja', 'hw'] },
		}),
		savedReport({
			id: 'r-106',
			owner: 'ev',
			updated: '2026-09-15',
			starred: true,
			name: 'Why accounts canceled',
			summary: 'Reasons given at cancellation, biggest first, with the running share.',
			kind: 'pareto',
			metric: 'churn',
			breakdown: 'none',
			opens: 29,
			schedule: delivery('monthly', 2, '09:00', 'CSV', ['Elise Vick', 'John Armstrong']),
			share: { people: ['ja', 'hw'] },
		}),
		savedReport({
			id: 'r-108',
			owner: 'ja',
			updated: '2026-09-29',
			name: 'New MRR against plan',
			summary: 'New business by region, against what this year’s plan expected.',
			kind: 'bullet',
			metric: 'new',
			breakdown: 'region',
			opens: 26,
			schedule: delivery('weekly', 5, '17:00', 'PDF', ['Rowan Walsh']),
			share: { people: ['ew'], access: 'edit' },
		}),
		savedReport({
			id: 'r-109',
			owner: 'lo',
			updated: '2026-09-09',
			name: 'Seats by region',
			summary: 'Paid seats at the end of the range, largest region first.',
			kind: 'bars',
			metric: 'seats',
			breakdown: 'region',
			opens: 12,
			share: { people: ['ja'] },
		}),
		savedReport({
			id: 'r-110',
			owner: 'rd',
			updated: '2026-09-11',
			name: 'Monthly and annual billing',
			summary: 'Share of MRR billed every month against billed once a year.',
			kind: 'share',
			metric: 'mrr',
			breakdown: 'billing',
			opens: 15,
			share: { people: ['ja'] },
		}),
		savedReport({
			id: 'r-111',
			owner: 'ja',
			updated: '2026-09-03',
			name: 'Canceled MRR by segment',
			summary: 'Revenue lost to cancellations, self-serve against sales-led.',
			kind: 'stacked',
			metric: 'churn',
			breakdown: 'segment',
			opens: 19,
		}),
		savedReport({
			id: 'r-112',
			owner: 'tpl',
			updated: '2026-08-30',
			name: 'Trials started',
			summary: 'New self-serve trials each month.',
			kind: 'line',
			metric: 'trials',
			breakdown: 'none',
			opens: 9,
		}),
		savedReport({
			id: 'r-113',
			owner: 'tpl',
			updated: '2026-08-30',
			name: 'Paying accounts by plan',
			summary: 'Where the paying accounts sit at the end of the range.',
			kind: 'ring',
			metric: 'accounts',
			breakdown: 'plan',
			opens: 8,
		}),
		savedReport({
			id: 'r-114',
			owner: 'ew',
			updated: '2026-09-25',
			name: 'New MRR by segment',
			summary: 'New business each month from self-serve sign-ups and from sales.',
			kind: 'stacked',
			metric: 'new',
			breakdown: 'segment',
			opens: 31,
			schedule: delivery('weekly', 1, '07:00', 'PDF', ['John Armstrong', 'Lance Bishop']),
			share: { people: ['ja', 'lo'] },
		}),
		savedReport({
			id: 'r-115',
			owner: 'hw',
			updated: '2026-09-19',
			name: 'Add-on revenue',
			summary: 'MRR from each add-on, next to the seat licenses themselves.',
			kind: 'bars',
			metric: 'mrr',
			breakdown: 'addon',
			opens: 14,
			share: { people: ['ja'] },
		}),
		savedReport({
			id: 'r-116',
			owner: 'tpl',
			updated: '2026-08-30',
			name: 'Net new MRR',
			summary: 'What each month added after cancellations and downgrades.',
			kind: 'columns',
			metric: 'netnew',
			breakdown: 'none',
			opens: 11,
		}),
	];

	/* A report's log, latest event on top. Only r-101 has a written one;
     the pages make up a brief log for the rest from the record itself. */
	const digestSent = 'Emailed to Robyn Daniels, Rowan Walsh and Leslie Whitlock as a PDF';
	const history = {
		'r-101': [
			{ at: '2026-10-05T08:00', who: '', icon: 'bi-envelope-check', text: digestSent },
			{ at: '2026-10-01T14:12', who: 'Robyn Daniels', icon: 'bi-download', text: 'exported the numbers as CSV' },
			{
				at: '2026-09-28T16:40',
				who: 'John Armstrong',
				icon: 'bi-sliders',
				text: 'changed the comparison to the previous period',
			},
			{ at: '2026-09-28T08:00', who: '', icon: 'bi-envelope-check', text: digestSent },
			{
				at: '2026-09-14T11:05',
				who: 'John Armstrong',
				icon: 'bi-people',
				text: 'shared it with Leslie Whitlock',
			},
			{
				at: '2026-08-03T09:30',
				who: 'John Armstrong',
				icon: 'bi-envelope-paper',
				text: 'set it to go out every Monday at 8:00 am',
			},
			{ at: '2025-03-03T10:20', who: 'John Armstrong', icon: 'bi-plus-lg', text: 'created the report' },
		],
	};

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.reports = { people: team, reports: library, activity: history };

	/**
	 * Fills a report record with the shared defaults. Sharing is private,
	 * view-only and link-free unless the record says otherwise; each call
	 * hands back fresh objects, because the pages edit records in place.
	 * @param {object} fields the report's own fields, overriding the defaults
	 * @returns {object} the complete record
	 */
	function savedReport(fields) {
		const sharing = { people: [], access: 'view', link: false, ...fields.share };
		return { ...unlessStated, ...fields, share: sharing };
	}

	/**
	 * Describes when a report is mailed out and to whom.
	 * @param {string} cadence 'weekly' or 'monthly'
	 * @param {number} day weekday (1 is Monday) or day of the month
	 * @param {string} time 24-hour send time
	 * @param {string} format attachment type: 'PDF', 'CSV' or 'Link'
	 * @param {string[]} recipients display names, in send order
	 */
	function delivery(cadence, day, time, format, recipients) {
		return { cadence, day, time, format, to: [...recipients] };
	}
})();
