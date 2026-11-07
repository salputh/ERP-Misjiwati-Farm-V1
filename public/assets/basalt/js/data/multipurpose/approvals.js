/**
 * Sign-off demo data for Fieldline: the policies that hold a request back
 * until someone approves it, and the requests that have gone through them.
 * approvals.html lists them and approval-details.html?id=%231043 opens one,
 * so both pages agree on amounts, people, steps and comments.
 *
 * Every person is an id from assets/basalt/js/data/multipurpose/people.js, which has to load
 * first. Discount requests link to quotes kept in deals.js
 * (quote-details.html?id=%23444); refunds link to customer accounts
 * (company-details.html?id=avocet).
 *
 * Published as window.Basalt.data.approvals:
 *   now, me    the fixed demo time and the teammate who is signed in
 *   rules      every policy, as copies
 *   rule(id)   the policy with that id, or null
 *   list()     every request as a fresh copy the page is free to edit
 *   find(id)   a copy of one request by its number, or null
 *
 * A real app would load the policies and requests from its server in
 * exactly these shapes.
 */
(() => {
	'use strict';

	const CLOCK = '2026-10-09T10:20';
	const VIEWER = 'ja';

	/* The words and icon a verdict leaves in a request's history. */
	const VERDICT_STEP = {
		approved: ['Approved', 'check'],
		declined: ['Declined', 'x'],
	};

	/* A policy only applies past its limit, read as dollars when unit is
     'usd' and as a percentage when it is 'pct'; policies without a limit
     cover every request of their kind. The approver is a people.js id. */
	const POLICIES = [
		policy({
			id: 'spend',
			tone: 1,
			icon: 'bi-credit-card',
			approver: 'rd',
			limit: 2500,
			unit: 'usd',
			name: 'Spend over a limit',
			when: 'Any purchase or contract over',
			after: 'Finance signs off before the order goes out.',
		}),
		policy({
			id: 'supplier',
			tone: 2,
			icon: 'bi-truck',
			approver: 'km',
			name: 'New suppliers',
			when: 'Before the first payment to a supplier we haven’t paid before',
			after: 'Checked for tax details and a signed agreement.',
		}),
		policy({
			id: 'refund',
			tone: 3,
			icon: 'bi-arrow-counterclockwise',
			approver: 'ev',
			limit: 500,
			unit: 'usd',
			name: 'Refunds over a limit',
			when: 'Any refund to a customer over',
			after: 'Smaller refunds go straight through.',
		}),
		policy({
			id: 'discount',
			tone: 4,
			icon: 'bi-percent',
			approver: 'ew',
			limit: 15,
			unit: 'pct',
			name: 'Large discounts',
			when: 'Any quote with more off the list price than',
			after: 'The quote can’t be sent until it is approved.',
		}),
		policy({
			id: 'access',
			tone: 5,
			icon: 'bi-person-plus',
			approver: 'ja',
			name: 'New user access',
			when: 'Every new sign-in to our own tools',
			after: 'Access starts the day it is approved.',
		}),
	];

	/* Newest request first. Amounts are whole dollars; on a discount the
     amount is what comes off the price and pct is that cut as a share.
     A history step reads [time, person, action, icon] and runs oldest to
     newest; a comment reads [person, time, text], also oldest first. The
     opening "asked" step, and the verdict step on decided requests, are
     added by the builders below. */
	const LEDGER = [
		/* Still waiting for a decision. */
		waiting({
			id: '#1050',
			rule: 'spend',
			by: 'as',
			at: '2026-10-09T08:40',
			needBy: '2026-10-19',
			title: 'Laptops for three new hires',
			amount: 5370,
			what: 'Three engineers start on October 19 and need laptops on day one. Same model as the rest of the team, ordered through Keystone IT Supply.',
			facts: [
				['Supplier', 'Keystone IT Supply'],
				['Items', '3 laptops at $1,790'],
				['Budget', 'Engineering equipment'],
			],
			comments: [['as', '2026-10-09T08:42', 'Quote from Keystone is valid until October 16.']],
		}),
		waiting(
			{
				id: '#1049',
				rule: 'discount',
				by: 'mb',
				at: '2026-10-08T17:10',
				needBy: '2026-10-19',
				title: '20% off Max for Bayline',
				amount: 13920,
				pct: 20,
				what: 'Bayline is weighing us against a cheaper tool for 120 seats. Twenty percent off the first year closes it before their legal review ends.',
				facts: [
					['Quote', '#444', 'quote-details.html?id=%23444'],
					['Customer', 'Bayline Shoes'],
					['List price', '$69,600 a year'],
					['After discount', '$55,680 a year'],
				],
				comments: [
					['ew', '2026-10-09T09:05', 'Is this for the first year only, or every year?'],
					['mb', '2026-10-09T09:30', 'First year only. Year two goes back to list.'],
				],
			},
			[['2026-10-09T09:05', 'ew', 'Asked a question', 'chat']],
		),
		waiting(
			{
				id: '#1048',
				rule: 'supplier',
				by: 'cr',
				at: '2026-10-08T14:25',
				needBy: '2026-10-23',
				title: 'Add Brightwave Translations',
				amount: 1850,
				what: 'Translating the help center into Spanish and Vietnamese. First invoice covers the 40 most-read articles.',
				facts: [
					['Supplier', 'Brightwave Translations'],
					['First invoice', '$1,850'],
					['Paid by', 'Bank transfer, 30 days'],
				],
			},
			[['2026-10-08T15:00', 'km', 'Got the tax form from the supplier', 'file']],
		),
		waiting({
			id: '#1047',
			rule: 'refund',
			by: 'hs',
			at: '2026-10-08T11:50',
			needBy: '2026-10-13',
			title: 'Refund a double charge',
			amount: 1280,
			what: 'Avocet Robotics’s card was charged twice for October after they updated it. The second charge goes back in full.',
			facts: [
				['Customer', 'Avocet Robotics', 'company-details.html?id=avocet'],
				['Charged', 'October 1 and October 2'],
				['Back to', 'Card ending 4417'],
			],
			comments: [
				[
					'hs',
					'2026-10-08T11:52',
					'Addison emailed about it this morning. Both charges show on the October invoice.',
				],
			],
		}),
		waiting({
			id: '#1046',
			rule: 'access',
			by: 'km',
			at: '2026-10-07T16:05',
			needBy: '2026-10-12',
			title: 'Sign-in for Wren Abbott',
			amount: 0,
			what: 'Wren joins Operations as an analyst. Needs the reporting tools and read-only billing, same as the rest of the team.',
			facts: [
				['New user', 'Wren Abbott'],
				['Team', 'Operations'],
				['Access', 'Reports, billing (read only)'],
			],
		}),
		waiting(
			{
				id: '#1045',
				rule: 'spend',
				by: 'pm',
				at: '2026-10-07T10:30',
				needBy: '2026-10-15',
				title: 'Small Business Expo booth',
				amount: 6800,
				what: 'A 10 by 10 booth at the Small Business Expo in Evanston, November 12. Last year’s stand brought in 31 leads and four deals.',
				facts: [
					['Supplier', 'Expo Partners'],
					['Event', 'November 12, Evanston'],
					['Budget', 'Marketing events'],
				],
				comments: [['cr', '2026-10-07T14:15', 'Fine from marketing. It is in the Q4 events plan.']],
			},
			[['2026-10-07T14:15', 'cr', 'Approved as team lead', 'check']],
		),
		waiting({
			id: '#1044',
			rule: 'discount',
			by: 'ta',
			at: '2026-10-06T15:40',
			needBy: '2026-10-13',
			title: '18% off Pro for Hartley',
			amount: 2304,
			pct: 18,
			what: 'Graham asked for monthly billing to start. If we keep yearly billing, 18% off makes the first year work for them.',
			facts: [
				['Quote', '#449', 'quote-details.html?id=%23449'],
				['Customer', 'Hartley & Sons Leather'],
				['List price', '$12,800 a year'],
				['After discount', '$10,496 a year'],
			],
		}),
		waiting({
			id: '#1043',
			rule: 'spend',
			by: 'hw',
			at: '2026-10-05T09:15',
			needBy: '2026-10-31',
			title: 'Design tool seats',
			amount: 2880,
			what: 'Yearly renewal for the product team’s design tool, eight seats. Same as last year.',
			facts: [
				['Supplier', 'Canvasly'],
				['Items', '8 seats for a year'],
				['Budget', 'Product software'],
			],
		}),

		/* Already approved or declined. */
		decided(
			{
				id: '#1042',
				rule: 'spend',
				by: 'ka',
				at: '2026-10-02T11:00',
				needBy: '2026-10-09',
				title: 'Load testing service',
				amount: 3200,
				what: 'Three months of load testing before the busy season, so the schedule board holds up at peak.',
				facts: [
					['Supplier', 'Loadline'],
					['Items', '3 months'],
					['Budget', 'Engineering software'],
				],
			},
			{ status: 'approved', by: 'rd', at: '2026-10-03T09:20', note: 'Approved for one quarter.' },
		),
		decided(
			{
				id: '#1041',
				rule: 'discount',
				by: 'mb',
				at: '2026-10-01T13:30',
				needBy: '2026-10-06',
				title: '30% off Pro for Valley',
				amount: 3360,
				pct: 30,
				what: 'Valley Denim is looking at a cheaper tool. Thirty percent off would match their price.',
				facts: [
					['Customer', 'Valley Denim Co.'],
					['List price', '$11,200 a year'],
					['After discount', '$7,840 a year'],
				],
			},
			{
				status: 'declined',
				by: 'ew',
				at: '2026-10-02T10:10',
				note: 'Too deep for 35 seats. Offer onboarding at no charge instead.',
			},
		),
		decided(
			{
				id: '#1040',
				rule: 'refund',
				by: 'hs',
				at: '2026-09-30T15:10',
				needBy: '2026-10-05',
				title: 'Refund an SMS overcharge',
				amount: 760,
				what: 'Polaris Running Co. was billed for SMS credits twice in September after a plan change.',
				facts: [
					['Customer', 'Polaris Running Co. Group', 'company-details.html?id=polarair'],
					['Back to', 'Next invoice'],
				],
			},
			{ status: 'approved', by: 'ev', at: '2026-10-01T08:45', note: '' },
		),
		decided(
			{
				id: '#1039',
				rule: 'access',
				by: 'hw',
				at: '2026-09-29T10:00',
				needBy: '2026-10-01',
				title: 'Sign-in for Allie Ott',
				amount: 0,
				what: 'Allie joins Product as a UX researcher. Needs the research tools and the shared drive.',
				facts: [
					['New user', 'Allie Ott'],
					['Team', 'Product'],
					['Access', 'Research tools, shared drive'],
				],
			},
			{ status: 'approved', by: 'ja', at: '2026-09-29T11:30', note: '' },
		),
		decided(
			{
				id: '#1038',
				rule: 'spend',
				by: 'pm',
				at: '2026-09-26T14:20',
				needBy: '2026-10-02',
				title: 'Second conference booth',
				amount: 4900,
				what: 'A second booth at the Home Care Highpoint in Atlanta, the same week as the Expo.',
				facts: [
					['Supplier', 'Highpoint Events'],
					['Event', 'November 13, Atlanta'],
					['Budget', 'Marketing events'],
				],
			},
			{
				status: 'declined',
				by: 'rd',
				at: '2026-09-28T09:00',
				note: 'One booth this quarter. Ask again in January.',
			},
		),
		decided(
			{
				id: '#1037',
				rule: 'supplier',
				by: 'mo',
				at: '2026-09-24T09:40',
				needBy: '2026-09-30',
				title: 'Add Clearpath Payroll',
				amount: 640,
				what: 'Payroll for the two people we hire in Kansas. Monthly fee, first invoice in October.',
				facts: [
					['Supplier', 'Clearpath Payroll'],
					['First invoice', '$640'],
					['Paid by', 'ACH debit'],
				],
			},
			{ status: 'approved', by: 'km', at: '2026-09-25T13:15', note: 'Agreement and tax form on file.' },
		),
	];

	publish();

	/** Hangs the read-only API on window.Basalt.data without replacing what other data files put there. */
	function publish() {
		window.Basalt.data ||= {};
		window.Basalt.data.approvals = {
			now: CLOCK,
			me: VIEWER,
			rules: POLICIES.map(detached),
			rule(id) {
				return POLICIES.find((entry) => entry.id === id) ?? null;
			},
			list() {
				return LEDGER.map(detached);
			},
			find(id) {
				const request = LEDGER.find((entry) => entry.id === id);
				return request ? detached(request) : null;
			},
		};
	}

	/** A deep copy, so a page can edit what it was given without touching the source records. */
	function detached(value) {
		return JSON.parse(JSON.stringify(value));
	}

	/** Fills in what most policies share: switched on, and no limit unless one is given. */
	function policy(fields) {
		return { limit: null, unit: null, on: true, ...fields };
	}

	/**
	 * A request nobody has decided yet.
	 * @param {object} fields  the request without status or history
	 * @param {Array[]} [laterSteps]  history steps after the request was sent
	 */
	function waiting(fields, laterSteps = []) {
		return {
			status: 'waiting',
			comments: [],
			...fields,
			history: [askedStep(fields), ...laterSteps],
		};
	}

	/**
	 * A request that has been approved or declined.
	 * @param {object} fields  the request without status or history
	 * @param {{status: string, by: string, at: string, note: string}} verdict
	 */
	function decided(fields, verdict) {
		const [action, icon] = VERDICT_STEP[verdict.status];
		return {
			comments: [],
			...fields,
			status: verdict.status,
			decidedBy: verdict.by,
			decidedAt: verdict.at,
			note: verdict.note,
			history: [askedStep(fields), [verdict.at, verdict.by, action, icon]],
		};
	}

	/** The first history step of every request: its author sending it in. */
	function askedStep({ at, by }) {
		return [at, by, 'Asked for approval', 'send'];
	}
})();
