/**
 * Blog comment moderation, the script behind comments.html (it only
 * runs when the page carries [data-cc-root]).
 *
 * Readers' comments arrive in five piles: waiting for review, published,
 * handed to support, spam and the bin. Each one is also tagged with what
 * the reader wanted, because a question, a correction to the post and a
 * sales pitch each get a different answer. Everything below is invented
 * demo content; a live page would fetch INBOX from its API and send each
 * status change back.
 */
(() => {
	'use strict';

	const screen = pick('[data-cc-root]');
	if (!screen) return;

	/* The sample comments are dated around this fixed moment, so their ages
     never drift. A live page would read the clock instead. */
	const NOW = new Date('2026-10-08T15:00:00');
	const MODERATOR = 'John Armstrong';
	/* The support colleague who picks up comments passed along from here. */
	const SUPPORT_OWNER = 'Connie Reese';
	const DAY_MS = 86400000;
	const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Posts with comments, keyed by id: the Blog page's headline, and a
     shorter label for table rows and the post filter. */
	const ARTICLES = {
		p224: { headline: 'Two-hour windows are now the default', label: 'Two-hour windows' },
		p223: { headline: 'How Oakhaven Studio halved its complaints', label: 'Oakhaven Studio complaints' },
		p222: { headline: 'Offline mode is out of beta', label: 'Offline mode' },
		p221: { headline: 'A schedule board that survives Monday', label: 'Monday schedule board' },
		p220: { headline: 'What 500 office managers changed in estimates', label: 'Estimates' },
		p219: { headline: 'Send the walker’s photo before the visit', label: 'Walker’s photo' },
		p217: { headline: 'Fieldline is now SOC 2 Type II certified', label: 'SOC 2 certified' },
		p215: { headline: 'Maintenance plans that carry the slow months', label: 'Maintenance plans' },
	};

	/* What a comment is for. `ask` becomes the reply box's placeholder, so
     the answer fits the comment; {name} is the reader's first name. */
	const COMMENT_KINDS = {
		question: { one: 'Question', many: 'Questions', glyph: 'question-circle', ask: 'Answer {name}’s question' },
		praise: { one: 'Praise', many: 'Praise', glyph: 'hand-thumbs-up', ask: 'Thank {name} for the kind words' },
		correction: {
			one: 'Correction',
			many: 'Corrections',
			glyph: 'pencil-square',
			ask: 'Thank {name} and say what you fixed',
		},
		complaint: {
			one: 'Complaint',
			many: 'Complaints',
			glyph: 'emoji-frown',
			ask: 'Say sorry and tell {name} what happens next',
		},
		promotion: { one: 'Promotion', many: 'Promotion', glyph: 'megaphone', ask: 'Reply to {name}' },
	};

	/* One entry per tab: its pill, the table caption, the line under the
     heading, the empty state, and the actions each place offers. */
	const TABS = {
		waiting: {
			pill: 'Waiting',
			tone: 'warning',
			caption: 'Comments waiting for review, oldest first',
			blurb: 'Held until someone reads them. Approve, reply or remove.',
			empty: {
				glyph: 'check2-circle',
				title: 'Nothing waiting',
				text: 'Every comment has been read. New ones land here.',
			},
			primary: 'approve',
			menu: ['reply', 'support', '-', 'spam', 'bin'],
			bulk: ['approve', 'spam', 'bin'],
			sheet: { aside: 'spam', also: ['bin'], main: 'approve' },
		},
		published: {
			pill: 'Published',
			tone: 'success',
			caption: 'Published comments, newest first',
			blurb: 'Live under their posts. Reply, or take one down.',
			empty: { glyph: 'chat-square', title: 'Nothing published yet', text: 'Approved comments show here.' },
			primary: 'reply',
			menu: ['unpublish', 'support', '-', 'spam', 'bin'],
			bulk: ['unpublish', 'bin'],
			sheet: { aside: 'bin', also: ['unpublish'] },
		},
		support: {
			pill: 'With support',
			tone: 'info',
			caption: 'Comments passed to support, newest first',
			blurb: 'Customer problems handed to the support team as tickets.',
			empty: {
				glyph: 'life-preserver',
				title: 'Nothing with support',
				text: 'Comments you pass to support show here with their ticket.',
			},
			primary: 'approve',
			menu: ['reply', 'ticket', '-', 'spam', 'bin'],
			bulk: ['approve', 'bin'],
			sheet: { aside: 'bin', also: [], main: 'approve' },
		},
		spam: {
			pill: 'Spam',
			tone: 'danger',
			caption: 'Comments marked as spam, newest first',
			blurb: 'Caught by the filter or marked by hand. Deleted after 30 days.',
			empty: { glyph: 'shield-check', title: 'No spam', text: 'The filter has nothing to show you.' },
			primary: 'notspam',
			menu: ['purge'],
			bulk: ['notspam', 'purge'],
			sheet: { aside: 'purge', also: [], main: 'notspam' },
		},
		bin: {
			pill: 'In the bin',
			tone: 'primary',
			caption: 'Comments in the bin, newest first',
			blurb: 'Removed by a moderator. Restore one if it went by mistake.',
			empty: { glyph: 'trash3', title: 'The bin is empty', text: 'Comments you remove wait here for 30 days.' },
			primary: 'restore',
			menu: ['purge'],
			bulk: ['restore', 'purge'],
			sheet: { aside: 'purge', also: [], main: 'restore' },
		},
	};

	/* Every moderation action: its icon and label wherever it appears, the
     tab it sends a comment to, the toast it raises, and how the comment's
     status note is reworded. */
	const ACTIONS = {
		approve: {
			glyph: 'check2',
			label: 'Approve',
			sendsTo: 'published',
			toast: 'Approved',
			tone: 'success',
			noteVerb: 'Approved by',
		},
		notspam: {
			glyph: 'check2-circle',
			label: 'Not spam',
			sendsTo: 'published',
			toast: 'Published',
			tone: 'success',
			noteVerb: 'Approved by',
		},
		unpublish: {
			glyph: 'eye-slash',
			label: 'Unpublish',
			sendsTo: 'waiting',
			toast: 'Taken down and back in Waiting',
			tone: 'info',
			noteVerb: 'Taken down by',
		},
		restore: {
			glyph: 'arrow-counterclockwise',
			label: 'Restore',
			sendsTo: 'waiting',
			toast: 'Back in Waiting',
			tone: 'info',
			noteVerb: 'Restored from the bin by',
		},
		spam: {
			glyph: 'slash-circle',
			label: 'Mark as spam',
			sendsTo: 'spam',
			toast: 'Marked as spam',
			tone: 'warning',
			noteVerb: 'Marked as spam by',
		},
		bin: {
			glyph: 'trash3',
			label: 'Move to bin',
			sendsTo: 'bin',
			toast: 'Moved to the bin',
			tone: 'info',
			noteVerb: 'Moved to the bin by',
		},
		support: { glyph: 'life-preserver', label: 'Pass to support', sendsTo: 'support', tone: 'info' },
		purge: { glyph: 'x-octagon', label: 'Delete forever', toast: 'Deleted for good', tone: 'danger' },
		reply: { glyph: 'reply', label: 'Reply' },
	};

	/* The comments. `account` is the company's id on company-details.html
     when the reader works for a Fieldline customer, `approvedBefore` counts
     their earlier published comments, and `note` is the line under the
     status in the side sheet. */
	const INBOX = [
		{
			id: 'c-3141',
			status: 'waiting',
			kind: 'complaint',
			on: 'p217',
			at: '2026-10-08T11:20',
			author: 'Gerald Pryce',
			company: 'Pryce Photography',
			email: 'gerald@prycephotography.com',
			approvedBefore: 0,
			body: 'A badge is nice. I would rather see your uptime history for the busy season.',
			note: 'Held because it is Gerald’s first comment.',
		},
		{
			id: 'c-3138',
			status: 'waiting',
			kind: 'correction',
			on: 'p224',
			at: '2026-10-08T07:50',
			author: 'Lori Middleton',
			company: 'Middleton Cleaning',
			email: 'lori@middletoncleaning.com',
			approvedBefore: 0,
			body: 'The text message example still shows a four-hour window. Worth updating now two hours is the default.',
			note: 'Held because it is Lori’s first comment.',
		},
		{
			id: 'c-3134',
			status: 'waiting',
			kind: 'promotion',
			on: 'p221',
			at: '2026-10-07T16:05',
			author: 'Marty Burgess',
			company: 'Full Diary Agency',
			email: 'marty@fulldiary.example',
			approvedBefore: 0,
			body: 'Great post. We help care companies book three times more visits. Message me for a free audit.',
			note: 'Held because it has 2 links, and it is Marty’s first comment.',
		},
		{
			id: 'c-3130',
			status: 'waiting',
			kind: 'praise',
			on: 'p223',
			at: '2026-10-07T09:40',
			author: 'Hailey Zimmerman',
			company: 'Lumora AI',
			email: 'hailey@lumoraai.com',
			account: 'lumoraai',
			approvedBefore: 0,
			body: 'We copied the close-out checklist for evening visits. A week in, complaints are already down.',
			note: 'Held because it is Hailey’s first comment.',
		},
		{
			id: 'c-3127',
			status: 'waiting',
			kind: 'question',
			on: 'p222',
			at: '2026-10-06T19:12',
			author: 'Hope Olson',
			company: 'Olson Home Care',
			email: 'hope@olsonhomecare.com',
			approvedBefore: 0,
			body: 'Do photos taken offline keep the time they were taken, or the time they sync?',
			note: 'Held because it is Hope’s first comment.',
		},
		{
			id: 'c-3121',
			status: 'waiting',
			kind: 'question',
			on: 'p221',
			at: '2026-10-06T08:40',
			author: 'Barry Davis',
			company: 'Davis Cleaning',
			email: 'barry@daviscleaning.com',
			approvedBefore: 0,
			body: 'Do you keep one team member free for urgent visits, or fill the board and reshuffle when a call comes in?',
			note: 'Held because it is Barry’s first comment.',
		},

		{
			id: 'c-3133',
			status: 'published',
			kind: 'praise',
			on: 'p219',
			at: '2026-10-07T14:30',
			author: 'Gus Whelan',
			company: 'Whelan Pet Sitting',
			email: 'gus@whelanpets.com',
			approvedBefore: 3,
			body: 'We started sending the photo last spring and the no-answer visits nearly stopped.',
			note: 'Went live straight away. Gus had comments approved before.',
		},
		{
			id: 'c-3125',
			status: 'published',
			kind: 'question',
			on: 'p224',
			at: '2026-10-06T10:05',
			author: 'Connie Nathan',
			company: 'Nathan Home Services',
			email: 'connie@nathanhomeservices.com',
			approvedBefore: 1,
			body: 'Can we keep four-hour windows for our rural visits only?',
			note: 'Approved by Erin Slater on Oct 6.',
			answer: {
				by: 'Erin Slater',
				at: '2026-10-06T11:30',
				body: 'Yes. Set the window per service area under Scheduling, and the rest keep two hours.',
			},
		},
		{
			id: 'c-3124',
			status: 'published',
			kind: 'praise',
			on: 'p221',
			at: '2026-10-05T21:10',
			author: 'Rick Donnelly',
			company: 'Donnelly Movers',
			email: 'rick@donnellymovers.com',
			approvedBefore: 2,
			body: 'Sorting urgent requests before regular visits saved our Mondays. Printing this for the office.',
			note: 'Went live straight away. Rick had comments approved before.',
		},
		{
			id: 'c-3122',
			status: 'published',
			kind: 'praise',
			on: 'p222',
			at: '2026-10-05T12:00',
			author: 'Emil Sager',
			company: 'Sager Optics',
			email: 'emil@sageroptics.com',
			approvedBefore: 4,
			body: 'Tested it in a care home basement this morning. Every photo synced once we were back upstairs.',
			note: 'Went live straight away. Emil had comments approved before.',
		},
		{
			id: 'c-3116',
			status: 'published',
			kind: 'praise',
			on: 'p223',
			at: '2026-10-02T18:30',
			author: 'Addison Brennan',
			company: 'Avocet Robotics',
			email: 'addison@avocetrobotics.com',
			account: 'avocet',
			approvedBefore: 1,
			body: 'We tried the same checklist rule. Visits take two minutes longer and complaints are down by a third.',
			note: 'Approved by Paige Drake on Oct 3.',
		},
		{
			id: 'c-3109',
			status: 'published',
			kind: 'praise',
			on: 'p223',
			at: '2026-09-30T15:20',
			author: 'Lindsay Kinney',
			company: 'Oakhaven Studio',
			email: 'lindsay@oakhavenstudio.com',
			account: 'oakhaven',
			approvedBefore: 0,
			body: 'Thanks for telling our story properly. The territory map is exactly how we run it.',
			note: 'Approved by Brittany Fenn on Sep 30.',
			answer: {
				by: 'Brittany Fenn',
				at: '2026-09-30T16:05',
				body: 'Thank you for the site visit, Lindsay. The team made it easy.',
			},
		},
		{
			id: 'c-3102',
			status: 'published',
			kind: 'praise',
			on: 'p220',
			at: '2026-09-29T09:15',
			author: 'Aaron Fisk',
			company: 'Fisk Cleaning',
			email: 'aaron@fiskcleaning.com',
			approvedBefore: 2,
			body: 'Same-day estimates were what our owner wanted most. Glad the default changed.',
			note: 'Went live straight away. Aaron had comments approved before.',
		},
		{
			id: 'c-3094',
			status: 'published',
			kind: 'correction',
			on: 'p222',
			at: '2026-09-25T10:00',
			author: 'Paige Drake',
			company: 'Fieldline',
			email: 'paige@fieldline.app',
			approvedBefore: 9,
			writer: true,
			body: 'Update: offline mode also works on older Android phones from app version 6.4.',
			note: 'Went live straight away. Paige writes for the blog.',
		},

		{
			id: 'c-3129',
			status: 'support',
			kind: 'complaint',
			on: 'p222',
			at: '2026-10-02T09:05',
			author: 'Jordan Pike',
			company: 'Larchwood Studios',
			email: 'jordan@larchwoodstudios.com',
			account: 'larchwood',
			approvedBefore: 1,
			body: 'Customers sign on the phone where there is no signal, and the signature is missing from the PDF visit notes we email them. Six visits yesterday.',
			escalation: { owner: 'John Armstrong', ticket: '#20413', at: '2026-10-02T09:30' },
		},
		{
			id: 'c-3119',
			status: 'support',
			kind: 'complaint',
			on: 'p219',
			at: '2026-10-02T06:15',
			author: 'Curtis Rowe',
			company: 'Redline Motion',
			email: 'curtis@redlineproperty.com',
			account: 'redline',
			approvedBefore: 0,
			body: 'We moved some visits this morning and the reminder texts still gave customers the old arrival window. Who do I talk to?',
			escalation: { owner: 'Alexis Boone', ticket: '#20411', at: '2026-10-02T06:40' },
		},

		{
			id: 'c-3132',
			status: 'spam',
			kind: 'promotion',
			on: 'p223',
			at: '2026-10-07T03:12',
			author: 'Best Deals Daily',
			company: '',
			email: 'promo@cheap-leads.example',
			approvedBefore: 0,
			body: 'Free leads for care companies. 10,000 contacts, 70% off, no contract!!!',
			note: 'Caught by the spam filter: 4 links and the blocked words “free leads”.',
		},
		{
			id: 'c-3118',
			status: 'spam',
			kind: 'promotion',
			on: 'p217',
			at: '2026-10-04T22:01',
			author: 'Airdrop Bot',
			company: '',
			email: 'bot@airdrop.example',
			approvedBefore: 0,
			body: 'Airdrop for businesses: free tokens, claim in 24 hours.',
			note: 'Caught by the spam filter: the blocked word “airdrop”.',
		},
		{
			id: 'c-3113',
			status: 'spam',
			kind: 'promotion',
			on: 'p221',
			at: '2026-10-03T13:47',
			author: 'Rank Booster',
			company: '',
			email: 'hello@rankbooster.example',
			approvedBefore: 0,
			body: 'Your blog could rank #1 on Google. Reply for a free report.',
			note: 'Marked as spam by Paige Drake on Oct 3.',
		},

		{
			id: 'c-3120',
			status: 'bin',
			kind: 'question',
			on: 'p219',
			at: '2026-10-05T16:45',
			author: 'Kip Monroe',
			company: 'Monroe Builders',
			email: 'kip@monroe-property.com',
			approvedBefore: 1,
			body: 'Does the photo text use one SMS credit each time?',
			note: 'Moved to the bin by John Armstrong on Oct 5: Kip sent it twice.',
		},
		{
			id: 'c-3106',
			status: 'bin',
			kind: 'complaint',
			on: 'p220',
			at: '2026-09-29T20:30',
			author: 'Jo Hartley',
			company: 'Hartley Movers',
			email: 'jo@hartleymovers.com',
			approvedBefore: 0,
			body: 'Test comment, please ignore.',
			note: 'Moved to the bin by Paige Drake on Sep 30: a test.',
		},
	];

	/* For the two cards under the queue: the five most discussed posts with
     their published comment counts (the top of the Blog page's list), and
     the last 30 days of comments by kind. */
	const BUSIEST_POSTS = [
		['p221', 18],
		['p223', 14],
		['p219', 12],
		['p222', 11],
		['p215', 10],
	];
	const MONTH_BY_KIND = { question: 31, praise: 26, complaint: 11, correction: 9, promotion: 7 };
	/* The ring's gap between arcs, in percent of the circle. */
	const ARC_GAP = 1.2;

	const filters = { tab: 'waiting', query: '', kind: '', post: '' };
	const selected = new Set();
	let shownRows = [];
	let nextTicket = 20419;
	let findDelay = 0;

	/* The side sheet steps through the rows the table showed when it opened. */
	let sheetRows = [];
	let sheetComment = null;
	let sheetNav = null;

	const tableBody = pick('[data-cc-body]', screen);
	const emptyBox = pick('[data-cc-empty]', screen);
	const tableShell = pick('.cc-scroll', screen);
	const countLine = pick('[data-cc-status]', screen);
	const pickAllBox = pick('[data-cc-check-all]', screen);
	const batchBar = pick('[data-cc-bulk]', screen);
	const kindFilter = pick('[data-cc-kind]', screen);
	const postFilter = pick('[data-cc-post]', screen);
	const searchBox = pick('[data-cc-search]', screen);
	const sheet = document.getElementById('cc-comment');
	const replyForm = pick('[data-cc-reply-form]', sheet);
	const replyBox = pick('[data-cc-reply-text]', sheet);

	/**
	 * Fills the post filter, wires the table, toolbar, tabs and both side
	 * sheets, draws the two cards under the queue, then draws the queue.
	 */
	function start() {
		for (const option of postOptions()) postFilter.appendChild(option);

		tableBody.addEventListener('change', togglePick);
		pickAllBox.addEventListener('change', toggleAllPicks);
		batchBar.addEventListener('click', runBulk);
		screen.addEventListener('click', handleScreenClick);

		searchBox.addEventListener('input', (event) => {
			clearTimeout(findDelay);
			findDelay = setTimeout(() => {
				filters.query = event.target.value;
				refresh();
			}, 150);
		});
		kindFilter.addEventListener('change', (event) => {
			filters.kind = event.target.value;
			refresh();
		});
		postFilter.addEventListener('change', (event) => {
			filters.post = event.target.value;
			refresh();
		});
		for (const tab of pickAll('[data-cc-tab]', screen)) {
			tab.addEventListener('shown.bs.tab', () => {
				filters.tab = tab.dataset.ccTab;
				selected.clear();
				refresh();
			});
		}

		sheetNav = window.Basalt.drawer?.recordNav
			? window.Basalt.drawer.recordNav(sheet, { valueOf: () => Math.max(1, sheetRows.length) }, (index) => {
					if (sheetRows[index]) fillSheet(sheetRows[index]);
				})
			: { go: (index) => fillSheet(sheetRows[index]) };
		sheetPart('foot').addEventListener('click', decideFromSheet);
		replyForm.addEventListener('submit', postReply);
		replyBox.addEventListener('input', () => replyBox.classList.remove('is-invalid'));
		pick('[data-cc-rules]').addEventListener('submit', saveRules);

		paintBusiestPosts();
		paintKindRing();
		refresh();
	}

	/* Small shared helpers. */

	function htmlSafe(value) {
		return `${value}`.replace(/[&<>"']/g, (character) => ENTITIES[character]);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	/** "1 comment", "3 comments": the count first, then the noun. */
	function counted(amount, singular, plural) {
		return `${amount} ${amount === 1 ? singular : plural || `${singular}s`}`;
	}

	function firstName(wholeName) {
		return wholeName.split(' ')[0];
	}

	/** Uses the shared search matcher when basalt.js offers one. */
	function fitsQuery(haystack, query) {
		if (window.Basalt?.matchesQuery) return window.Basalt.matchesQuery(haystack, query);
		return haystack.toLowerCase().includes(query.toLowerCase());
	}

	function articleLink(postId) {
		return `post-editor.html?id=${encodeURIComponent(postId)}`;
	}

	/* A ticket opened from this page lives only here, so its link goes to
     the support queue rather than to a ticket page that does not exist. */
	function ticketLink(comment) {
		const { local, ticket } = comment.escalation;
		return local ? 'tickets.html' : `ticket-details.html?id=${encodeURIComponent(ticket)}`;
	}

	/* Time, always measured against NOW. */

	function midnightOf(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate());
	}

	function calendarDaysAgo(date) {
		return Math.round((midnightOf(NOW) - midnightOf(date)) / DAY_MS);
	}

	function clockText(date) {
		return date
			.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
			.toLowerCase()
			.replace(/\s/g, ' ');
	}

	function monthDay(date) {
		return `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getDate()}`;
	}

	/** "5 min ago", "3 h ago", "Today, 9:40 am", "Yesterday", "4 days ago" or "Sep 29". */
	function age(stamp) {
		const date = new Date(stamp);
		const minutes = Math.round((NOW - date) / 60000);
		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (minutes < 12 * 60) return `${Math.round(minutes / 60)} h ago`;
		const days = calendarDaysAgo(date);
		if (days === 0) return `Today, ${clockText(date)}`;
		if (days === 1) return 'Yesterday';
		return days < 7 ? `${days} days ago` : monthDay(date);
	}

	function longStamp(stamp) {
		const date = new Date(stamp);
		return `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${monthDay(date)}, ${clockText(date)}`;
	}

	/** NOW as a local "YYYY-MM-DDTHH:MM" string, the shape the records use. */
	function nowStamp() {
		return `${NOW.getFullYear()}-${twoDigits(NOW.getMonth() + 1)}-${twoDigits(NOW.getDate())}T${twoDigits(NOW.getHours())}:${twoDigits(NOW.getMinutes())}`;
	}

	function twoDigits(part) {
		return `${part}`.padStart(2, '0');
	}

	/* Reading the queue. */

	function commentById(id) {
		return INBOX.find((comment) => comment.id === id);
	}

	function underTab(tab) {
		return INBOX.filter((comment) => comment.status === tab);
	}

	function isFiltered() {
		return filters.query.trim() || filters.kind || filters.post;
	}

	/* Waiting is worked oldest first; every other tab reads newest first. */
	function queueRows() {
		const query = filters.query.trim();
		const direction = filters.tab === 'waiting' ? 1 : -1;
		return underTab(filters.tab)
			.filter((comment) => {
				if (filters.kind && comment.kind !== filters.kind) return false;
				if (filters.post && comment.on !== filters.post) return false;
				if (!query) return true;
				const haystack = [
					comment.author,
					comment.company,
					comment.email,
					comment.body,
					ARTICLES[comment.on].headline,
				].join(' ');
				return fitsQuery(haystack, query);
			})
			.sort((left, right) => direction * left.at.localeCompare(right.at));
	}

	/* Drawing the queue and everything that counts it. */

	function kindBadge(kind) {
		const { glyph, one } = COMMENT_KINDS[kind];
		return `<span class="cc-kind cc-kind-${kind}"><i class="bi bi-${glyph}" aria-hidden="true"></i>${one}</span>`;
	}

	function avatarSlot(name, size = 'basalt-avatar-sm') {
		return `<span class="basalt-avatar ${size}" data-basalt-avatar data-name="${htmlSafe(name)}" aria-hidden="true"></span>`;
	}

	function menuEntry(key, comment) {
		if (key === '-') return '<li><hr class="dropdown-divider"></li>';
		if (key === 'ticket') {
			return `<li><a class="dropdown-item" href="${ticketLink(comment)}"><i class="bi bi-ticket-perforated" aria-hidden="true"></i>Open ticket ${htmlSafe(comment.escalation.ticket)}</a></li>`;
		}
		const { glyph, label } = ACTIONS[key];
		return `<li><button type="button" class="dropdown-item" data-cc-act="${key}" data-cc-id="${comment.id}"><i class="bi bi-${glyph}" aria-hidden="true"></i>${label}</button></li>`;
	}

	function rowMenu(comment) {
		const entries = TABS[comment.status].menu.map((key) => menuEntry(key, comment)).join('');
		return `<div class="dropdown"><button type="button" class="btn btn-icon cc-more" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${htmlSafe(comment.author)}’s comment"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${entries}</ul></div>`;
	}

	/* Under the comment: the ticket it went to, or who replied. */
	function rowFootnote(comment) {
		if (comment.status === 'support')
			return `<span class="cc-row-note">With ${htmlSafe(comment.escalation.owner)} · ${htmlSafe(comment.escalation.ticket)}</span>`;
		if (!comment.answer) return '';
		return `<span class="cc-row-note"><i class="bi bi-reply" aria-hidden="true"></i>${htmlSafe(firstName(comment.answer.by))} replied</span>`;
	}

	function queueRow(comment) {
		const key = TABS[comment.status].primary;
		const { glyph, label } = ACTIONS[key];
		const picked = selected.has(comment.id);
		const name = htmlSafe(comment.author);

		const checkCell = `<td class="cc-check"><input class="form-check-input" type="checkbox" aria-label="Select ${name}’s comment" data-cc-pick="${comment.id}"${picked ? ' checked' : ''}></td>`;
		const readerCell = `<td class="cc-cell-reader"><span class="cc-reader">${avatarSlot(comment.author)}<span class="cc-reader-text"><button type="button" class="cc-reader-open" data-cc-open="${comment.id}">${name}</button><span class="cc-reader-co">${htmlSafe(comment.company || comment.email)}</span></span></span></td>`;
		const textCell = `<td class="cc-cell-text"><p class="cc-row-text">${htmlSafe(comment.body)}</p><span class="cc-row-post">On ${htmlSafe(ARTICLES[comment.on].label)}</span>${rowFootnote(comment)}</td>`;
		const actionCell = `<td class="cc-cell-act"><div class="cc-actions"><button type="button" class="btn btn-outline-secondary btn-sm" data-cc-act="${key}" data-cc-id="${comment.id}"><i class="bi bi-${glyph} me-1" aria-hidden="true"></i>${label}</button>${rowMenu(comment)}</div></td>`;

		return `<tr class="cc-row${picked ? ' is-picked' : ''}" data-cc-row="${comment.id}">${checkCell}${readerCell}${textCell}<td class="cc-cell-kind">${kindBadge(comment.kind)}</td><td class="cc-cell-when">${age(comment.at)}</td>${actionCell}</tr>`;
	}

	/** What the empty table says: a search miss, a filter miss, or an empty tab. */
	function emptyMarkup() {
		if (!isFiltered()) {
			const { glyph, title, text } = TABS[filters.tab].empty;
			return `<div class="basalt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-${glyph}"></i></span><p class="basalt-empty-title">${title}</p><p class="basalt-empty-text">${text}</p></div>`;
		}
		if (filters.query.trim() && window.Basalt) {
			const hint = filters.kind || filters.post ? 'Check the spelling, or clear the other filters.' : '';
			return window.Basalt.emptyState({ query: filters.query, noun: 'comments', text: hint });
		}
		return '<div class="basalt-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-funnel"></i></span><p class="basalt-empty-title">No comments match</p><p class="basalt-empty-text">Nothing in this tab fits those filters.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-cc-reset>Show every comment</button></div>';
	}

	function countSummary(total) {
		if (isFiltered()) return `${shownRows.length} of ${total} shown`;
		if (!total) return '';
		const order = total > 1 ? (filters.tab === 'waiting' ? ', oldest first' : ', newest first') : '';
		return counted(total, 'comment') + order;
	}

	/** Redraws the table, its empty state, the tab counts and the selection bar. */
	function refresh() {
		shownRows = queueRows();
		for (const id of selected) {
			if (!shownRows.some((comment) => comment.id === id)) selected.delete(id);
		}
		tableBody.innerHTML = shownRows.map(queueRow).join('');
		window.Basalt.avatars?.(tableBody);

		const hasRows = shownRows.length > 0;
		tableShell.hidden = !hasRows;
		emptyBox.hidden = hasRows;
		if (!hasRows) emptyBox.innerHTML = emptyMarkup();

		const tab = TABS[filters.tab];
		countLine.textContent = countSummary(underTab(filters.tab).length);
		pick('[data-cc-caption]', screen).textContent = tab.caption;
		pick('[data-cc-desc]', screen).textContent = tab.blurb;
		for (const key of Object.keys(TABS))
			pick(`[data-cc-count="${key}"]`, screen).textContent = underTab(key).length;

		paintTabLines();
		paintSelection();
	}

	/* The small line under three of the tab counts. Spam and Bin keep the
     line written into the page. */
	function paintTabLines() {
		let oldest = '';
		for (const comment of underTab('waiting')) {
			if (!oldest || comment.at < oldest) oldest = comment.at;
		}
		let waitingLine = 'All caught up';
		if (oldest) {
			const hours = Math.floor((NOW - new Date(oldest)) / 3600000);
			waitingLine = `Oldest ${hours < 24 ? counted(Math.max(1, hours), 'hour') : counted(Math.floor(hours / 24), 'day')}`;
		}
		pick('[data-cc-sub="waiting"]', screen).textContent = waitingLine;

		const weekStart = new Date(NOW - 7 * DAY_MS);
		const recent = underTab('published').filter((comment) => new Date(comment.at) >= weekStart).length;
		pick('[data-cc-sub="published"]', screen).textContent = `${recent} this week`;

		const tickets = underTab('support').length;
		pick('[data-cc-sub="support"]', screen).textContent = tickets
			? counted(tickets, 'open ticket')
			: 'No open tickets';
	}

	/* Selection and the bulk bar. */

	function paintSelection() {
		const count = selected.size;
		batchBar.hidden = !count;
		pick('[data-cc-bulk-count]', batchBar).textContent = count;
		const buttons = TABS[filters.tab].bulk.map(
			(key) =>
				`<button type="button" class="btn btn-outline-secondary btn-sm" data-cc-bulk="${key}"><i class="bi bi-${ACTIONS[key].glyph} me-1" aria-hidden="true"></i>${ACTIONS[key].label}</button>`,
		);
		pick('[data-cc-bulk-actions]', batchBar).innerHTML =
			`${buttons.join('')}<button type="button" class="btn btn-outline-secondary btn-sm" data-cc-bulk="clear">Clear selection</button>`;
		pickAllBox.checked = count > 0 && count === shownRows.length;
		pickAllBox.indeterminate = count > 0 && count < shownRows.length;
		pickAllBox.disabled = !shownRows.length;
	}

	function togglePick(event) {
		const box = event.target.closest('[data-cc-pick]');
		if (!box) return;
		if (box.checked) selected.add(box.dataset.ccPick);
		else selected.delete(box.dataset.ccPick);
		box.closest('tr').classList.toggle('is-picked', box.checked);
		paintSelection();
	}

	function toggleAllPicks() {
		selected.clear();
		if (pickAllBox.checked) {
			for (const comment of shownRows) selected.add(comment.id);
		}
		for (const box of pickAll('[data-cc-pick]', tableBody)) {
			box.checked = pickAllBox.checked;
			box.closest('tr').classList.toggle('is-picked', box.checked);
		}
		paintSelection();
	}

	function runBulk(event) {
		const button = event.target.closest('[data-cc-bulk]');
		if (!button) return;
		const action = button.dataset.ccBulk;
		if (action !== 'clear') moderate(action, [...selected]);
		selected.clear();
		refresh();
	}

	/* Moderation. Every change carries an Undo in its toast. */

	/** Applies one action to the given comments and raises the toast that can reverse it. */
	function moderate(action, ids) {
		const targets = ids.map(commentById).filter(Boolean);
		if (!targets.length) return;
		const saved = targets.map((comment) => ({ comment, copy: { ...comment }, position: INBOX.indexOf(comment) }));
		const stampText = longStamp(nowStamp());
		const rule = ACTIONS[action];

		for (const comment of targets) {
			if (action === 'purge') {
				INBOX.splice(INBOX.indexOf(comment), 1);
				continue;
			}
			comment.status = rule.sendsTo;
			if (rule.noteVerb) comment.note = `${rule.noteVerb} ${MODERATOR}, ${stampText}.`;
			if (action === 'support')
				comment.escalation = {
					owner: SUPPORT_OWNER,
					ticket: `#${nextTicket++}`,
					at: nowStamp(),
					local: true,
				};
		}

		const subject = targets.length === 1 ? targets[0].author : counted(targets.length, 'comment');
		notify({
			tone: rule.tone,
			title:
				action === 'support'
					? `Passed to ${SUPPORT_OWNER} as ${targets[0].escalation.ticket}`
					: `${rule.toast}: ${subject}`,
			actions: [{ label: 'Undo', onClick: () => undoModeration(saved) }],
		});
	}

	/* Puts removed comments back where they were and every field back as it
     was, dropping anything the action added. */
	function undoModeration(saved) {
		saved.sort((left, right) => left.position - right.position);
		for (const { comment, copy, position } of saved) {
			if (!INBOX.includes(comment)) INBOX.splice(Math.min(position, INBOX.length), 0, comment);
			for (const field of Object.keys(comment)) {
				if (!(field in copy)) delete comment[field];
			}
			Object.assign(comment, copy);
		}
		refresh();
	}

	function clearFilters() {
		filters.kind = '';
		filters.post = '';
		kindFilter.value = '';
		postFilter.value = '';
		refresh();
	}

	/**
	 * One listener for the whole page: the reset button in the empty state,
	 * row actions, a reader's name, and a plain click on a row.
	 */
	function handleScreenClick(event) {
		if (event.target.closest('[data-cc-reset]')) {
			clearFilters();
			return;
		}

		const actionButton = event.target.closest('[data-cc-act]');
		if (actionButton) {
			runRowAction(actionButton, event.detail === 0);
			return;
		}

		const nameButton = event.target.closest('[data-cc-open]');
		if (nameButton) {
			openSheet(nameButton.dataset.ccOpen);
			return;
		}

		/* A click on the row itself opens it, unless it hit a control inside. */
		const row = event.target.closest('[data-cc-row]');
		if (row && !event.target.closest('a, button, input, .dropdown-menu, .cc-check')) openSheet(row.dataset.ccRow);
	}

	function runRowAction(button, fromKeyboard) {
		const { ccAct: action, ccId: id } = button.dataset;
		if (action === 'reply') {
			openSheet(id, true);
			return;
		}
		const row = button.closest('[data-cc-row]');
		const rowIndex = row ? [...pickAll('[data-cc-row]', tableBody)].indexOf(row) : 0;
		moderate(action, [id]);
		refresh();
		if (!fromKeyboard) return;

		/* From the keyboard, focus moves to the row that slid into this one's place. */
		const rows = [...pickAll('[data-cc-row]', tableBody)];
		const successor = rows[Math.min(rowIndex, rows.length - 1)];
		(successor ? pick('.cc-actions > .btn', successor) : searchBox).focus();
	}

	/* The toolbar's post filter lists only posts that have comments, by label. */
	function postOptions() {
		return Object.keys(ARTICLES)
			.filter((postId) => INBOX.some((comment) => comment.on === postId))
			.sort((left, right) => ARTICLES[left].label.localeCompare(ARTICLES[right].label))
			.map((postId) => {
				const option = document.createElement('option');
				option.value = postId;
				option.textContent = ARTICLES[postId].label;
				return option;
			});
	}

	/* The comment side sheet. */

	function sheetPart(name) {
		return pick(`[data-cc-d="${name}"]`, sheet);
	}

	function statusNote(comment) {
		if (comment.status !== 'support') return htmlSafe(comment.note || '');
		const { owner, ticket, at } = comment.escalation;
		return `Passed to ${htmlSafe(owner)} in support on ${htmlSafe(longStamp(at))}.<a class="cc-d-state-link" href="${ticketLink(comment)}">Open ticket ${htmlSafe(ticket)}</a>`;
	}

	function readerHistory(comment) {
		if (comment.writer) return 'Writes for the blog';
		return comment.approvedBefore
			? `${counted(comment.approvedBefore, 'earlier comment')}, all published`
			: 'First comment';
	}

	function sheetButton(key, { primary = false, aside = false } = {}) {
		return `<button type="button" class="btn btn-${primary ? 'primary' : 'outline-secondary'}${aside ? ' me-auto' : ''}" data-cc-d-act="${key}">${ACTIONS[key].label}</button>`;
	}

	/** Writes one comment into the side sheet, from the reader down to the footer buttons. */
	function fillSheet(comment) {
		sheetComment = comment;
		const reader = firstName(comment.author);
		const tab = TABS[comment.status];
		const kind = COMMENT_KINDS[comment.kind];

		const avatar = sheetPart('avatar');
		avatar.dataset.name = comment.author;
		window.Basalt.avatar?.(avatar);
		sheetPart('name').textContent = comment.author;
		sheetPart('sub').textContent = comment.company || 'No company given';

		const pill = sheetPart('status');
		pill.className = `basalt-status basalt-status-dot basalt-status-${tab.tone}`;
		pill.textContent = tab.pill;
		sheetPart('why').innerHTML = statusNote(comment);

		sheetPart('quote').className = `cc-d-quote cc-kind-${comment.kind}`;
		sheetPart('text').textContent = comment.body;
		const kindTag = sheetPart('kind');
		kindTag.className = `cc-kind cc-kind-${comment.kind}`;
		kindTag.innerHTML = `<i class="bi bi-${kind.glyph}" aria-hidden="true"></i>${kind.one}`;
		sheetPart('when').textContent = longStamp(comment.at);
		const postLink = sheetPart('post');
		postLink.textContent = ARTICLES[comment.on].headline;
		postLink.href = articleLink(comment.on);

		const { answer } = comment;
		sheetPart('replies-wrap').hidden = !answer;
		sheetPart('replies').innerHTML = answer
			? `<div class="cc-d-reply-head">${avatarSlot(answer.by, 'basalt-avatar-xs')}<strong>${htmlSafe(answer.by)}</strong><span>${htmlSafe(longStamp(answer.at))}</span></div><p>${htmlSafe(answer.body)}</p>`
			: '';
		window.Basalt.avatars?.(sheetPart('replies'));

		sheetPart('email').innerHTML = `<a href="mailto:${htmlSafe(comment.email)}">${htmlSafe(comment.email)}</a>`;
		sheetPart('company').innerHTML = comment.account
			? `<a href="company-details.html?id=${encodeURIComponent(comment.account)}">${htmlSafe(comment.company)}</a> <span class="cc-d-facts-note">Fieldline customer</span>`
			: htmlSafe(comment.company || 'Not given');
		sheetPart('history').textContent = readerHistory(comment);

		const awaiting = comment.status === 'waiting' || comment.status === 'support';
		replyForm.hidden = comment.status === 'spam' || comment.status === 'bin';
		replyBox.value = '';
		replyBox.placeholder = kind.ask.replace('{name}', reader);
		replyBox.classList.remove('is-invalid');
		pick('[data-cc-reply-email-label]', sheet).textContent = `Email ${reader} when it is posted`;
		const hint = pick('[data-cc-reply-hint]', sheet);
		hint.textContent = awaiting ? `Posting a reply publishes ${reader}’s comment too.` : '';
		hint.hidden = !awaiting;

		const { aside, also, main } = tab.sheet;
		const buttons = [sheetButton(aside, { aside: true }), ...also.map((key) => sheetButton(key))];
		if (main) buttons.push(sheetButton(main, { primary: true }));
		sheetPart('foot').innerHTML = buttons.join('');
	}

	function openSheet(id, focusReply) {
		sheetRows = shownRows.slice();
		sheetNav.go(
			Math.max(
				0,
				sheetRows.findIndex((comment) => comment.id === id),
			),
			0,
		);
		const panel = bootstrap.Offcanvas.getOrCreateInstance(sheet);
		if (focusReply) sheet.addEventListener('shown.bs.offcanvas', () => replyBox.focus(), { once: true });
		panel.show();
	}

	/* After a decision the sheet steps to the next comment in the table, so
     a whole tab can be worked through without closing it. */
	function advanceSheet(decided) {
		const formerIndex = sheetRows.indexOf(decided);
		sheetRows = shownRows.slice();
		if (!sheetRows.length) {
			bootstrap.Offcanvas.getOrCreateInstance(sheet).hide();
			return;
		}
		const stillHere = sheetRows.indexOf(decided);
		sheetNav.go(stillHere >= 0 ? stillHere : Math.min(formerIndex, sheetRows.length - 1), 1);
	}

	/* The footer is redrawn for the next comment, so the clicked button is
     gone. Focus stays inside the sheet so Esc and Tab keep working. */
	function holdFocus(action) {
		if (!sheet.classList.contains('show')) return;
		(pick(`[data-cc-d-act="${action}"]`, sheet) || sheet).focus({ preventScroll: true });
	}

	function decideFromSheet(event) {
		const button = event.target.closest('[data-cc-d-act]');
		if (!button || !sheetComment) return;
		const decided = sheetComment;
		const action = button.dataset.ccDAct;
		moderate(action, [decided.id]);
		refresh();
		advanceSheet(decided);
		holdFocus(action);
	}

	function postReply(event) {
		event.preventDefault();
		const text = replyBox.value.trim();
		if (!text) {
			replyBox.classList.add('is-invalid');
			replyBox.focus();
			return;
		}
		const comment = sheetComment;
		const reader = firstName(comment.author);
		const publishesToo = comment.status === 'waiting' || comment.status === 'support';
		comment.answer = { by: MODERATOR, at: nowStamp(), body: text };
		if (publishesToo) {
			comment.status = 'published';
			comment.note = `Approved by ${MODERATOR} with a reply, ${longStamp(nowStamp())}.`;
		}

		let detail = `${reader}’s comment is published too.`;
		if (!publishesToo)
			detail = pick('[data-cc-reply-email]', sheet).checked ? `${reader} gets an email with it.` : '';
		notify({ tone: 'success', title: 'Reply posted', text: detail });
		refresh();
		if (!publishesToo) {
			fillSheet(comment);
			return;
		}
		advanceSheet(comment);
		holdFocus('approve');
	}

	function saveRules(event) {
		event.preventDefault();
		bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('cc-rules')).hide();
		notify({ tone: 'success', title: 'Comment rules saved', text: 'They apply to new comments from now on.' });
	}

	/* The two cards under the queue, drawn once. */

	function paintBusiestPosts() {
		const leader = BUSIEST_POSTS[0][1];
		pick('[data-cc-ranks]', screen).innerHTML = BUSIEST_POSTS.map(
			([postId, total]) =>
				`<li class="cc-rank"><a class="cc-rank-title" href="${articleLink(postId)}">${htmlSafe(ARTICLES[postId].headline)}</a><span class="cc-rank-count">${total}</span><span class="cc-rank-bar" aria-hidden="true"><span style="width:${Math.round((total / leader) * 100)}%"></span></span></li>`,
		).join('');
	}

	/* A ring of arcs, one per kind, starting at twelve o'clock, with a
     legend list beside it. The circle's length is 100, so dash values are
     percentages. */
	function paintKindRing() {
		const kinds = Object.entries(MONTH_BY_KIND);
		let total = 0;
		for (const [, amount] of kinds) total += amount;

		let start = 0;
		const arcs = kinds.map(([kind, amount]) => {
			const share = (amount / total) * 100;
			const arc = `<circle class="cc-ring-arc cc-kind-${kind}" cx="21" cy="21" r="15.915" stroke-dasharray="${(share - ARC_GAP).toFixed(2)} ${(100 - share + ARC_GAP).toFixed(2)}" stroke-dashoffset="${(25 - start).toFixed(2)}"></circle>`;
			start += share;
			return arc;
		});
		pick('[data-cc-ring]', screen).innerHTML =
			`<svg viewBox="0 0 42 42" role="img" aria-label="${total} comments in the last 30 days, by kind"><circle class="cc-ring-track" cx="21" cy="21" r="15.915"></circle>${arcs.join('')}</svg><span class="cc-ring-mid"><span class="cc-ring-num">${total}</span><span class="cc-ring-lbl">comments</span></span>`;

		pick('[data-cc-kinds]', screen).innerHTML = kinds
			.map(
				([kind, amount]) =>
					`<li class="cc-kinds-item cc-kind-${kind}"><span class="cc-kinds-dot" aria-hidden="true"></span><span class="cc-kinds-name">${COMMENT_KINDS[kind].many}</span><span class="cc-kinds-n">${amount}</span><span class="cc-kinds-pct">${Math.round((amount / total) * 100)}%</span></li>`,
			)
			.join('');
	}

	start();

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
