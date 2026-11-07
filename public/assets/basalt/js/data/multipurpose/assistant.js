/**
 * Demo knowledge for the AI Assistant page (ai-assistant.html): which
 * questions it can answer and the chats already sitting in its sidebar.
 *
 * No answer text lives here. The page script assembles every reply from
 * the account, billing, plan and trial data, so a number quoted in a
 * chat always matches the number shown on the page it links to.
 *
 * Published as window.Basalt.data.assistant:
 *   today    the demo's calendar date, YYYY-MM-DD
 *   topics   one record per answerable question, in suggestion order:
 *              id     key of the answer the page script builds
 *              ask    the question written out as someone would type it
 *              title  short chat name shown under Recent chats
 *              icon   Bootstrap Icon class on the suggestion button
 *              tone   chart series color, 1 through 8
 *              words  phrases a typed question must contain to match
 *   history  past chats, latest first, each a [topic id, YYYY-MM-DDTHH:MM] pair
 *   find     looks a topic up by id
 *
 * A real app would load the history from its backend and send questions
 * to its own model instead.
 */
(() => {
	'use strict';

	const DEMO_DATE = '2026-10-09';

	/* Suggestions render in this order, and an equal keyword score goes to
     whichever topic comes first, so the sequence matters. Each row reads
     id, tone, icon, title, question, then its match phrases. */
	const questions = [
		[
			'mrr',
			1,
			'bi-bar-chart-line',
			'MRR by plan',
			'What is our MRR by plan?',
			['mrr', 'revenue by plan', 'by plan', 'plans', 'recurring'],
		],
		[
			'overdue',
			5,
			'bi-receipt',
			'Overdue invoices',
			'Which invoices are overdue?',
			['overdue', 'late', 'unpaid', 'invoice', 'owe', 'bills'],
		],
		[
			'churn',
			2,
			'bi-heart-pulse',
			'Churn risk',
			'Which accounts might cancel?',
			['churn', 'cancel', 'risk', 'leave', 'leaving', 'health'],
		],
		[
			'addons',
			3,
			'bi-plus-square',
			'Top add-ons',
			'Which add-ons earn the most?',
			['add-on', 'addon', 'add on', 'extras', 'portal', 'sms', 'travel'],
		],
		[
			'trials',
			4,
			'bi-hourglass-split',
			'Trials ending soon',
			'Which trials end this week?',
			['trial', 'trials', 'sign-up', 'signup', 'convert'],
		],
		[
			'growth',
			6,
			'bi-graph-up-arrow',
			'MRR growth',
			'How has MRR grown in the last year?',
			['grow', 'grown', 'growth', 'trend', 'year', 'over time'],
		],
	].map(([id, tone, icon, title, ask, words]) => ({ id, title, ask, icon, tone, words }));

	/* Earlier chats as [topic id, asked at] pairs, the latest first. */
	const pastChats = [
		['overdue', '2026-10-09T09:12'],
		['churn', '2026-10-08T16:40'],
		['trials', '2026-10-07T11:05'],
		['mrr', '2026-10-06T14:20'],
		['addons', '2026-10-02T10:30'],
	];

	const questionsById = new Map(questions.map((entry) => [entry.id, entry]));

	/**
	 * Returns the topic record for an answer key.
	 * @param {string} key  a topic id such as 'churn'
	 * @returns {object|null} the record, or null when no topic has that id
	 */
	function topicFor(key) {
		return questionsById.get(key) ?? null;
	}

	window.Basalt.data ??= {};
	window.Basalt.data.assistant = {
		today: DEMO_DATE,
		topics: questions,
		history: pastChats,
		find: topicFor,
	};
})();
