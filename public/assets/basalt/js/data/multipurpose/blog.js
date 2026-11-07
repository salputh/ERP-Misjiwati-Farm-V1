/**
 * Every story on the Fieldline blog, published as window.Basalt.data.blog.
 * The Blog list (blog.html) and the story editor (post-editor.html?id=p228)
 * both read it, so a story keeps one title, byline, status and set of dates.
 *
 * Swap in your own backend by returning the same shape. Per story:
 *   status    published, scheduled, review or draft (set per group below)
 *   date      when it went out, or the day it is booked to go out
 *   time      the booked hour; every published story went out at 09:00
 *   edited    the last save on anything not yet published
 *   views30   reads over the past 30 days; sources splits all reads into
 *             search, newsletter, social and direct, in percent
 *   latest    the newest reader comment, days counted back from today
 *   customer  [display name, customer id] when a customer is featured
 *   cover     a photo path, described by alt
 *   body      the article markup exactly as the editor loads it
 * Minutes to read (read) come from the body, by the editor's own rule.
 * Alongside the stories, readers describes the past 30 days as a whole:
 * who read (by role, in percent), how many came back for a second post,
 * and how many read to the end.
 */
(() => {
	'use strict';

	/* The editor counts reading time at this pace, so the list does too. */
	const WORDS_PER_MINUTE = 200;

	/* Topics as [name, icon, tone]; the tone sets the badge color. */
	const topicRows = [
		['Field Tips', 'bi-tools', 1],
		['Product Updates', 'bi-stars', 2],
		['Customer Stories', 'bi-people', 5],
		['Engineering', 'bi-cpu', 4],
		['Company', 'bi-building', 3],
	];

	/* Who read the blog over the past 30 days, as [role, percent]. */
	const readerRows = [
		['Office managers', 38],
		['Business owners', 27],
		['Field staff', 21],
		['Not customers yet', 14],
	];

	/* Everyone with a byline, and the role printed beneath it. */
	const bylines = {
		'Erin Slater': 'Product marketing',
		'Paige Drake': 'Content lead',
		'Sharon Oakley': 'Customer education',
		'Martin Hull': 'Engineering manager',
		'Brittany Fenn': 'Customer stories',
		'John Armstrong': 'Chief Technology Officer',
	};

	/* Live stories, newest first. */
	const liveStories = [
		{
			id: 'p224',
			author: 'Erin Slater',
			category: 'Product Updates',
			date: '2026-10-06',
			title: 'Two-hour windows are now the default',
			tags: ['service windows', 'sms reminders'],
			summary:
				'We looked at 1.2 million visits. Customers given a two-hour window rated the visit higher and canceled less often.',
			views: 2140,
			views30: 2140,
			comments: 9,
			sources: [22, 51, 17, 10],
			cover: 'assets/basalt/images/multipurpose/two-hour-windows.svg',
			alt: 'A white clock with a violet wedge over two hours',
			latest: {
				days: 0,
				ago: 'earlier today',
				who: 'Aaron Fisk',
				text: 'Finally someone with real numbers on window length. Sent this straight to our owner.',
			},
			body: `<p>Until this week, a new Fieldline account offered customers a four-hour arrival window. It was the safe choice: the team almost always made it, and nobody had to promise anything tight. It was also the window customers liked least.</p><p>We looked at 1.2 million visits booked across Basic, Pro and Max accounts over the last year, and compared the ones with a two-hour window against the ones with four.</p><h3>What the numbers said</h3><ul><li>Customers rated two-hour visits 0.4 stars higher on average.</li><li>Cancellations on the morning of the visit fell by a fifth.</li><li>Staff were late slightly more often, but by eleven minutes on average, and the reminder text covered most of it.</li></ul><p>The surprise was the office. Teams on two-hour windows took fewer “when will they get here?” calls, because the window itself answered the question.</p><h3>What changes for you</h3><p>New accounts now start with two-hour windows. If you already use Fieldline, nothing changes until you choose to: open Settings, then Booking, and pick the window length per visit type. Most teams keep four hours for long visits and use two for everything else.</p><p>The reminder text picks up the new window on its own, so customers see the tighter promise the moment you switch.</p><h3>Why two hours, not one</h3><p>We tried one-hour windows with a group of forty teams in the spring. Ratings went up again, but staff were late far more often, and a late arrival inside a one-hour window feels like a broken promise. Two hours turned out to be the point where the window felt precise to customers and still left room for traffic, a long visit or a supplies run.</p><p>The teams who did best with two-hour windows had one thing in common: they let the first visit of the day set the pace. The first window of the morning is fixed, and every window after it is calculated from where the team member actually is, not from the plan made the night before.</p><h3>When four hours still makes sense</h3><ul><li>Moves and deep cleans, where nobody can say how long the work will take.</li><li>Rural rounds with long drives between visits.</li><li>Visits that wait on supplies arriving the same morning.</li></ul><p>For these, keep the longer window and say why in the booking text. Customers are far more patient with a wide window when they understand it.</p><h3>Telling your customers</h3><p>If you switch, mention it in your next invoice email or on your booking page. A line such as “We now arrive within a two-hour window” is enough, and several teams told us it became a reason customers picked them over a competitor.</p>`,
		},
		{
			id: 'p223',
			author: 'Brittany Fenn',
			category: 'Customer Stories',
			date: '2026-09-30',
			title: 'How Oakhaven Studio halved its complaints',
			tags: ['home care', 'checklists', 'complaints'],
			summary:
				'Sixty-four people on Fieldline, two branches in Stamford and Plattsburgh, and a checklist that has to be finished before a visit can close.',
			customer: ['Oakhaven Studio', 'oakhaven'],
			views: 4820,
			views30: 4820,
			comments: 14,
			sources: [31, 28, 29, 12],
			cover: 'assets/basalt/images/multipurpose/complaints-halved.svg',
			alt: 'Two stacks of handwritten customer notes, one half the other',
			latest: {
				days: 1,
				ago: 'yesterday',
				who: 'Dana Whitlock',
				text: 'We copied the close-out checklist for our evening visits. Two weeks in and complaints are already down.',
			},
			body: `<p>Oakhaven Studio has sixty-four people on Fieldline, working from two branches in Stamford and Plattsburgh. A year ago, one visit in nine brought a complaint within a month: a medicine prompt missed, a meal left unmade, a note not passed on to the next carer.</p><p>Complaints are expensive in a way that never shows on an invoice. The extra visit is free, a carer loses an hour of the day, and the family remembers it at review time.</p><h3>A checklist that blocks the close</h3><p>Oakhaven’s care manager, Hope Nugent, wrote a close-out checklist for each visit type. Carers can’t mark a visit done until every line is checked, and three lines need a note.</p><ul><li>Medicine prompted and the time written down, with anything refused.</li><li>Meal made and the fridge checked for old food.</li><li>Anything the next carer should know, read back to the client.</li></ul><blockquote>The first week, the team hated it. By the third, they were adding lines of their own.</blockquote><h3>Six months later</h3><p>Complaints dropped from one visit in nine to one in nineteen. Hope now reads the checklist answers each Friday and turns the most-missed line into a five-minute talk at Monday’s meeting.</p><p>If you want to try it, start with the visit type that brings the most complaints, and keep the list under eight lines.</p><h3>Getting the team on side</h3><p>Hope knew a checklist handed down from the office would be ignored, so she built the first version with her three most experienced carers over two lunches. They cut her draft from fifteen lines to eight and rewrote every line in the words they use in clients’ homes.</p><p>She also made one promise: nobody would be told off for a complaint in the first month. The checklist was there to learn from, not to blame anyone. Carers who found a line pointless could say so, and two lines were dropped in the second week.</p><h3>What the notes showed</h3><p>The note lines turned out to be the most useful part. Medicine taken at the wrong time showed up at once, and so did fridges that looked full and weren’t. Newer carers learned faster by seeing what “done” looked like on another person’s visit.</p><ul><li>Notes are attached to the visit, so the office can answer a family’s question without another visit.</li><li>The best notes of the week are shared at Monday’s meeting, with the carer’s name on them.</li><li>Families can see the notes in the Customer Portal if the office chooses to share them.</li></ul><h3>Where to start</h3><p>Pick one visit type, write the checklist with the people who do the work, and look at the answers every week for a month before adding another.</p>`,
		},
		{
			id: 'p222',
			author: 'Martin Hull',
			category: 'Engineering',
			date: '2026-09-24',
			title: 'Offline mode is out of beta',
			tags: ['mobile', 'offline'],
			summary:
				'Visits, checklists and photos now save on the phone in a basement with no signal, and sync once the phone is back in range.',
			views: 3960,
			views30: 3960,
			comments: 11,
			sources: [26, 44, 14, 16],
			cover: 'assets/basalt/images/multipurpose/offline-mode.svg',
			alt: 'A phone on a fence post above the hills, a work bag at its foot',
			latest: {
				days: 3,
				ago: '3 days ago',
				who: 'Ruth Calloway',
				text: 'Tested it in a cellar under a restaurant. Photos synced the moment we were back in the car.',
			},
			body: `<p>On-site teams spend a surprising part of their day where phones don’t work: cellars, basements, country lanes, the far end of a parking lot. Until now, the Fieldline app needed a signal to save a checklist or a photo.</p><p>Offline mode has been in beta with 140 teams since June. Today it is on for everyone.</p><h3>What works without a signal</h3><ul><li>Opening the day’s visits, notes and customer history.</li><li>Filling in checklists and taking photos.</li><li>Collecting a signature and marking the visit done.</li></ul><p>Everything is saved on the phone first, and sent the moment the phone finds a signal again. A small cloud icon on the visit shows what is still waiting.</p><h3>How we kept it safe</h3><p>The hard part was two people changing the same visit, one of them offline. The office might move the visit while the cleaner is filling in the checklist in a basement. We keep both changes and show the office a short note when they meet, rather than quietly picking one.</p><p>Update the app to version 6.14 or later and offline mode is on. There is nothing to switch on in your settings.</p><h3>What still needs a signal</h3><p>A few things still need the phone to be online, and the app says so clearly rather than failing quietly:</p><ul><li>Taking a card payment, because the bank has to approve it there and then.</li><li>Opening a visit that was added to someone’s day after they lost signal.</li><li>Searching the whole customer list, rather than the day’s customers.</li></ul><p>We looked hard at offline card payments. Storing card details on a phone in someone’s pocket, even for an hour, isn’t something we are willing to do. Staff can still send a payment link that the customer pays later.</p><h3>How much the beta teams used it</h3><p>Across the 140 beta teams, about one visit in six was finished at least partly offline. For teams that work in commercial buildings, it was closer to one in three. The most common place was a basement; the second was, unexpectedly, an underground garage.</p><p>Power use was the other worry. Saving everything on the phone first costs very little charge, and in our tests a full day of offline work used less power than the old app spent searching for a signal.</p><h3>Thank you, beta teams</h3><p>The beta teams sent 412 reports. Two of them found the conflict problem described above, and one found a bug that only happened when a phone changed time zone mid-visit. Every one of those reports made the release better.</p>`,
		},
		{
			id: 'p221',
			author: 'Sharon Oakley',
			category: 'Field Tips',
			date: '2026-09-16',
			title: 'A schedule board that survives Monday',
			tags: ['schedule board', 'scheduling'],
			summary:
				'How busy offices sort urgent requests, regular visits and quotes before the first team leaves the office.',
			views: 6140,
			views30: 6140,
			comments: 18,
			sources: [58, 19, 15, 8],
			cover: 'assets/basalt/images/multipurpose/schedule-board.svg',
			alt: 'A hand moving a violet job card on a planning board',
			latest: {
				days: 2,
				ago: '2 days ago',
				who: 'Jodi Hanson',
				text: 'How do you handle a customer who insists on the first slot of the day, whatever the schedule says?',
			},
			body: `<p>Monday morning is when a schedule board shows what it is made of. The weekend’s urgent requests arrive at once, the regular visits are already booked, and three customers want a quote “this week if you can”.</p><p>We asked twelve busy offices how they get through the first hour. The answers were remarkably alike.</p><h3>Sort before you schedule</h3><p>Every office we spoke to sorts the new work into three piles before touching the board: things that really cannot wait a day; visits that are already promised; and everything else. Only the first pile can move a booked visit.</p><h3>Keep one person loose</h3><p>Most teams leave one team member with a light morning on Mondays. When something urgent comes in, it goes to that person, and nobody else’s day falls apart.</p><ul><li>Book that person for short visits that can move without an apology.</li><li>Rotate the role, so nobody is always on call.</li><li>Release the slack at eleven if the morning stays quiet.</li></ul><h3>Quotes go after lunch</h3><p>Quote visits don’t earn money today, so the offices that cope best book them for the afternoon, when the board has settled. The customer still gets a visit this week, and the morning stays for the work that pays.</p><h3>Write the rules down</h3><p>The offices that coped best had their Monday rules written on one page, pinned next to the schedule board. When the usual scheduler was off sick, someone else could run Monday the same way. The page was short: what counts as urgent, who is the loose team member this week, and which customers have a contract promising a response time.</p><h3>Tell customers early</h3><p>If a booked visit has to move for something urgent, the best offices tell the customer before nine, not at the time of the visit. A short text with a new time and an apology keeps almost everyone happy. A missed visit with no word costs a customer.</p><ul><li>Fieldline can send the new time automatically when a visit moves.</li><li>Offer two new slots, not one, so the customer feels they chose.</li><li>Move regular visits first; they are the easiest to rebook.</li></ul><h3>Look back on Friday</h3><p>Several offices spend ten minutes on Friday looking at the week. How many urgent requests came in on Monday? Did the loose team member have enough room? Was there a pattern, such as deep cleans after a holiday weekend? Over a season, those ten minutes turn into a much calmer Monday.</p>`,
		},
		{
			id: 'p220',
			author: 'Paige Drake',
			category: 'Product Updates',
			date: '2026-09-10',
			title: 'What 500 office managers changed in estimates',
			tags: ['estimates', 'research'],
			summary:
				'Four rounds of testing, one deleted field, and the default that got most estimates sent the same day as the visit.',
			views: 2340,
			views30: 2340,
			comments: 6,
			sources: [24, 47, 18, 11],
			cover: 'assets/basalt/images/multipurpose/estimate-kit.svg',
			alt: 'An estimate on a clipboard with pencils, a tape and swatches',
			body: `<p>In the spring we asked 500 office managers to send us their slowest estimate of the week, and to tell us why it was slow. Most of the answers came down to the same three fields.</p><h3>What we changed</h3><ul><li>We deleted the “internal reference” field. Almost nobody filled it in, and those who did copied the visit number.</li><li>Line items now start from the team’s notes on the visit, so the office edits a draft instead of typing from a photo of a notepad.</li><li>The estimate now goes out by text and email at once, from the same button.</li></ul><p>We tested each change with four rounds of office managers before it shipped. The one that mattered most was the draft: offices that start from the visit notes send 62% of estimates the same day as the visit, against 38% before.</p><h3>One default we kept</h3><p>Many asked for estimates to expire after 14 days instead of 30. We tried it, and it made more customers call the office to ask for a new copy. The default stays at 30 days, and you can still change it per estimate.</p><p>All of this is live on Pro and Max. Basic accounts get the draft from notes next month.</p><h3>What we learned about speed</h3><p>The office managers who sent estimates fastest weren’t the ones who typed fastest. They were the ones who had to type least. Every field we removed or filled in for them saved more time than any shortcut we added to the form.</p><p>The second lesson was about timing. An estimate sent while the customer still remembers the person standing in their kitchen is accepted far more often. Estimates sent the same day were accepted 31% of the time; those sent three days later, 19%.</p><h3>Small things people noticed</h3><ul><li>The estimate now shows the team member’s name and photo at the top.</li><li>Optional extras sit under the main price, so customers can add them with one tap.</li><li>Accepted estimates turn into a booked visit without retyping anything.</li></ul><h3>Thank you</h3><p>Testing with 500 people took most of the spring, and every round changed something. If you took part, thank you. If you would like to join the next round, on invoices, write to the product team from the Help menu in the app.</p>`,
		},
		{
			id: 'p219',
			author: 'Paige Drake',
			category: 'Field Tips',
			date: '2026-09-02',
			title: 'Send the walker’s photo before the visit',
			tags: ['sms reminders', 'no-shows'],
			summary:
				'Why a text with the walker’s name and face cuts no-answer visits, and what it did for Lakeside Apparel.',
			customer: ['Lakeside Apparel', 'lakeside'],
			views: 4270,
			views30: 1260,
			comments: 12,
			sources: [49, 21, 22, 8],
			cover: 'assets/basalt/images/multipurpose/walker-at-door.svg',
			alt: 'A golden retriever waiting by the door, a violet leash on the hook',
			latest: {
				days: 9,
				ago: '9 days ago',
				who: 'Gus Whelan',
				text: 'We started sending the photo last spring and the no-answer visits nearly stopped.',
			},
			body: `<p>Nobody opens the door to a stranger. That is the whole idea behind this tip, and it works better than anything else we have tried for no-answer visits.</p><p>When a walker is on the way, Fieldline can text the customer a short message with the walker’s first name, a photo and the car they drive. Customers who get it answer the door far more often.</p><h3>What it did for Lakeside Apparel</h3><p>Lakeside Apparel was losing about one visit a day to a customer who wasn’t home, or didn’t answer. Three months after switching on the photo text, that fell to one a week.</p><blockquote>Older customers told us the photo is the reason they open the door. They know who to expect.</blockquote><h3>Getting it right</h3><ul><li>Use a friendly head-and-shoulders photo in work clothes, not a passport photo.</li><li>Send it when the walker leaves the previous visit, not the night before.</li><li>Keep the message to two lines: who is coming, and roughly when.</li></ul><p>Switch it on under Settings, then Customer messages. Each text uses one SMS credit.</p><h3>Why it works</h3><p>A knock from a stranger is easy to ignore. A knock from “Kyle, in the white car, the one in the photo” is not. The text turns an unknown visitor into someone the customer has already met, if only for a second on their phone.</p><p>It also helps when someone else answers the door. Customers forward the message to a partner or a neighbor who is home, and the visit happens anyway.</p><h3>Things to watch</h3><ul><li>Ask your walkers before using their photo, and let them pick it.</li><li>Update photos when someone changes their look; customers notice.</li><li>Don’t send it for visits to empty properties, such as rentals between tenants.</li></ul><h3>What it costs</h3><p>Each “on the way” message uses one SMS credit. Credits come in packs of 1,000 for $25, so a team doing twenty visits a day spends about fifteen dollars a month. Lakeside worked out that one saved visit a week paid for the whole year.</p>`,
		},
		{
			id: 'p218',
			author: 'Brittany Fenn',
			category: 'Customer Stories',
			date: '2026-08-26',
			title: 'Eight weeks with Harborline AI',
			tags: ['property care', 'travel planning'],
			summary:
				'Day plans, ride-alongs and the numbers they track, from a rollout that changed how they price quarterly plans.',
			customer: ['Harborline AI', 'harborpest'],
			views: 3860,
			views30: 940,
			comments: 8,
			sources: [29, 33, 27, 11],
			cover: 'assets/basalt/images/multipurpose/eight-weeks.svg',
			alt: 'A desk calendar with eight weeks crossed off in violet',
			body: `<p>Harborline AI runs quarterly plans for about 3,000 homes and a few hundred shops. When they moved to Fieldline in the summer, they asked us to ride along for the first eight weeks.</p><h3>Weeks one to three: the rounds</h3><p>Their old rounds were built by ZIP code. On the map, that meant the team crossing the same bridge four times a day. Travel Planner rebuilt them around the river instead, and the average day lost forty minutes of driving.</p><h3>Weeks four to six: the visits</h3><p>Ride-alongs showed that shop visits ran long because nobody knew where the keys and alarm panels were. The team added a site map to each shop, and visits shortened by a quarter.</p><h3>Weeks seven and eight: the prices</h3><p>With real visit times for the first time, Moorings found that small homes were underpriced and large shops overpriced. They changed the quarterly plans to price by visit length, and kept every shop customer through the change.</p><p>The numbers they still track every Monday: driving time per team member, visits that run over, and plans that renew.</p><h3>What surprised them</h3><p>The biggest surprise wasn’t the driving. It was how much time went on finding things at the start of a visit: the right door at a shop, the key to a shed, the alarm panel nobody had mapped. Once those were written on the visit, the team stopped calling the office from the parking lot.</p><p>The second surprise was the shop managers themselves. Once visits were shorter and on time, several asked for monthly visits instead of quarterly ones.</p><h3>What they would do differently</h3><ul><li>Map every shop in the first week, not the fourth.</li><li>Run the new rounds for a full week before judging them; the first two days were rough.</li><li>Tell customers about new visit days by text before the change, not on the day.</li></ul><h3>Where they are now</h3><p>Three months after the rollout, Moorings’s team fits in one more visit a day on average, and quarterly plan renewals are the highest they have been. They have just started using the Customer Portal so homeowners can move their own visits.</p>`,
		},
		{
			id: 'p217',
			author: 'John Armstrong',
			category: 'Company',
			date: '2026-08-18',
			title: 'Fieldline is now SOC 2 Type II certified',
			tags: ['security'],
			summary: 'What the audit asked of a 120-person company, and the three things we changed to pass.',
			views: 2190,
			views30: 410,
			comments: 3,
			sources: [21, 42, 25, 12],
			cover: 'assets/basalt/images/multipurpose/soc2-certified.svg',
			alt: 'A steel archive box with a brass padlock and a violet seal',
			body: `<p>Fieldline now holds a SOC 2 Type II report. If your customers ask how we look after their data, you can request a copy from our Security page.</p><p>A Type II audit doesn’t just check that the right rules exist. It watches whether a company follows them over months. Ours ran from February to July.</p><h3>Three things we changed</h3><ol><li>Every change to production now needs a second engineer to approve it, with no exceptions for small fixes.</li><li>Access to customer data is granted for a single support ticket and ends when the ticket closes.</li><li>We test our backups by restoring one every month, not just by checking that they ran.</li></ol><p>None of these were dramatic, and all three made us slower for a few weeks. They also caught two mistakes before they reached customers, which is the point.</p><p>Max customers can find the full report and our bridge letter in the account settings, under Security.</p><h3>What it means for you</h3><p>For most customers, nothing changes day to day. The report matters when your own customers ask how their details are kept safe, or when a larger client sends you a security questionnaire. Many of those questions can now be answered by pointing to our report.</p><h3>What the auditors looked at</h3><ul><li>Who can reach customer data, and how that access is granted and removed.</li><li>How code changes are reviewed, tested and released.</li><li>How we notice and respond to incidents, including at night.</li><li>How we check the companies we rely on, such as our hosting provider.</li></ul><p>The audit found no exceptions, which means every control the auditors tested was followed for the whole six months. We are proud of that, and we know the work doesn’t end here. The next audit period started on August 1.</p><h3>Thank you</h3><p>Getting here took effort from almost everyone at Fieldline, from engineers to the support team who changed how they ask for access. Thank you all.</p>`,
		},
		{
			id: 'p216',
			author: 'Martin Hull',
			category: 'Engineering',
			date: '2026-08-12',
			title: 'Team supplies now update when a visit closes',
			tags: ['inventory', 'api'],
			summary: 'The supplies list on each visit now reaches the stockroom, so it knows what to restock tonight.',
			views: 1740,
			views30: 380,
			comments: 4,
			sources: [33, 38, 9, 20],
			cover: 'assets/basalt/images/multipurpose/supplies-shelf.svg',
			alt: 'A hand topping up labeled bins on a steel supply shelf',
			body: `<p>Staff already record the supplies they use on each visit. Until now, that list stopped at the invoice. From today it also reaches the stockroom.</p><h3>How it works</h3><p>Each car is now a stock location. When a visit closes, the supplies in its notes come off that car’s stock, and the stockroom sees a restock list for every car at the end of the day.</p><ul><li>Supplies with a minimum level go on the list as soon as a car drops below it.</li><li>The list can be printed, or sent to your supplier through the API.</li><li>Returns put the item back in the car in one tap.</li></ul><h3>Why it took a while</h3><p>The hard part was visits that close offline. A cleaner can finish three visits in a basement before the phone finds a signal, and the stock has to come off in the right order. We now replay those visits in the order they were finished, not the order they arrive.</p><p>Car stock is available on Pro and Max. Turn it on under Settings, then Inventory.</p><h3>What the office sees</h3><p>Each morning, the stockroom gets a list per car: what came off yesterday, what is below its minimum, and what to load before the car leaves. Most teams print it; some send it to a phone by the stockroom door.</p><p>Office managers can also see the stock in every car from the Inventory page, which helps when someone calls asking whether anyone nearby has a particular cleaning product.</p><h3>First few steps</h3><ol><li>Add your cars as stock locations.</li><li>Count what is in each car once, and enter it.</li><li>Set a minimum for the supplies you never want to run out of.</li></ol><p>The first count takes an afternoon. After that, stock keeps itself up to date as visits close.</p><h3>What comes next</h3><p>Next we are adding transfers between cars, so a team member can hand supplies to a colleague and both cars stay right. After that, purchase orders straight from the restock list.</p>`,
		},
		{
			id: 'p215',
			author: 'Sharon Oakley',
			category: 'Field Tips',
			date: '2026-08-05',
			title: 'Maintenance plans that carry the slow months',
			tags: ['maintenance plans', 'pricing'],
			summary:
				'How three garden firms price spring and autumn visits, and why each plan includes one free extra visit.',
			views: 3520,
			views30: 720,
			comments: 10,
			sources: [61, 17, 14, 8],
			cover: 'assets/basalt/images/multipurpose/garden-shed.svg',
			alt: 'Garden tools on an open shed wall among autumn leaves',
			body: `<p>Every garden business knows the shape of the year: frantic in the first warm weeks and the autumn leaf fall, quiet in between. Maintenance plans are how the best firms fill the quiet months.</p><h3>Two visits, booked a year ahead</h3><p>The three firms we spoke to all sell the same basic plan: a spring visit to tidy and feed, an autumn visit to cut back and clear, booked in April and October when the phones are calm. The customer pays monthly, so cash comes in all year.</p><h3>The free extra visit</h3><p>Each plan includes one free extra visit, after a storm or a fallen branch. It sounds generous. In practice, plan customers rarely need it, because their gardens are looked after, and when they do, it is the moment they decide to renew.</p><blockquote>The free visit costs us about forty dollars a plan a year. It keeps nine in ten plans renewing.</blockquote><h3>Pricing it</h3><ul><li>Start from the two visit times you actually see, not the ones on paper.</li><li>Add the extra visit at cost, spread across the year.</li><li>Round to a monthly price customers can say out loud.</li></ul><h3>Selling the plan</h3><p>The firms that sell the most plans offer them at the end of a one-off visit, when the customer has just seen what a full clear-up costs. The gardener mentions it, the office follows up with a text and a link, and the customer signs up in the Customer Portal.</p><ul><li>Show the plan price per month, not per year.</li><li>Mention the free extra visit first; it is what people remember.</li><li>Offer to book the first visit there and then.</li></ul><h3>Keeping the visits on track</h3><p>A plan only works if the visits happen. Fieldline books each seasonal visit as a recurring booking and reminds the customer a month ahead. If a customer doesn’t pick a slot, the office sees them on a short list to call.</p><h3>What it does to the year</h3><p>One of the three firms showed us their year before and after plans. The peaks are still there, but the quiet months now run at about two thirds of a busy month instead of a third. Their gardeners no longer worry about hours in January.</p>`,
		},
		{
			id: 'p214',
			author: 'Brittany Fenn',
			category: 'Customer Stories',
			date: '2026-07-29',
			title: 'Larchwood Studios dropped paper time sheets',
			tags: ['time sheets', 'photography'],
			summary:
				'Twenty-two photographers, one payroll clerk, and the clock-in reminder that finally made it stick.',
			customer: ['Larchwood Studios', 'larchwood'],
			views: 2640,
			views30: 330,
			comments: 5,
			sources: [34, 29, 26, 11],
			cover: 'assets/basalt/images/multipurpose/paper-time-sheets.svg',
			alt: 'A stack of old paper time sheets tied with string',
			body: `<p>Larchwood Studios had tried to drop paper time sheets twice before. Both times, the photographers went back to the clipboard within a month.</p><p>Their payroll clerk, Wes Granger, spent every Monday morning typing up twenty-two time sheets, and every Monday afternoon calling people to read their handwriting.</p><h3>What was different the third time</h3><p>Clocking in now happens in the same app the photographers already open for their first shoot. And if someone arrives at a shoot without clocking in, the app reminds them once, quietly, five minutes later.</p><ul><li>No separate time-sheet app to remember.</li><li>Travel time fills in from the booking times.</li><li>Wes approves the week in one screen on Friday afternoon.</li></ul><blockquote>The reminder did it. Nobody had to nag anyone.</blockquote><p>Monday mornings are now spent on other work. Larchwood says payroll takes about forty minutes a week instead of most of a day.</p><h3>What the photographers said</h3><p>The team’s main complaint about earlier attempts was that time sheets felt like extra admin on top of the job. This time, clocking in became part of starting the first shoot, so it stopped feeling like a separate task.</p><blockquote>I don’t think about it any more. The app asks, I tap, I start work.</blockquote><h3>Overtime and travel</h3><p>Larchwood pays travel time between shoots but not the drive home. Fieldline fills in travel from the booking times, so Wes only checks the odd day where someone stopped for props on the way.</p><ul><li>Overtime rules apply automatically after forty hours.</li><li>Weekend shoots are paid at time and a half.</li><li>The week exports to their payroll provider in one file.</li></ul><h3>Advice for others</h3><p>Wes’s advice is to switch everyone on the same Monday, and to keep paper time sheets in a drawer for one week only. After that, the drawer is locked.</p><p>If you are thinking of making the same switch, start with the people who complain most about paper. At Larchwood, they became the strongest supporters.</p>`,
		},
		{
			id: 'p213',
			author: 'Erin Slater',
			category: 'Product Updates',
			date: '2026-07-22',
			title: 'Five phones, one twelve-hour test day',
			tags: ['mobile', 'testing'],
			summary:
				'Screen time, glove use and weak signal on every phone we tried the app on, and why old phones still cope.',
			views: 1960,
			views30: 450,
			comments: 7,
			sources: [46, 25, 19, 10],
			cover: 'assets/basalt/images/multipurpose/five-phones.svg',
			alt: 'Four work phones in rugged cases with their cables on a desk',
			body: `<p>Before we tell a customer the Fieldline app will run on the phones their team already has, we wanted to know it was true. So we bought five older phones, and used them hard.</p><h3>The tests</h3><ul><li>A full working day of visits, photos and maps on one charge.</li><li>A whole morning on one bar of signal.</li><li>Tapping a checklist in winter work gloves.</li><li>Reading the screen in direct sun in a garden.</li></ul><h3>What happened</h3><p>Two phones ran flat before the middle of the afternoon. One lasted the day but took a minute to open each photo. One worked well but couldn’t read a gloved finger at all.</p><p>The oldest phone, five years old, finished the day with a third of its charge left once the app’s low-power mode was on. It told us more than any spec sheet: the app has to run on what people already carry, from day one.</p><p>Keep a charging cable in the car either way. Most of the flat phones we see go flat in the afternoon.</p><h3>Other things we checked</h3><p>Beyond the day itself, we looked at the things that slow a phone down over a year: full storage, old software, and dozens of photos waiting to upload. The app now clears uploaded photos from the phone after a week, which matters more than any spec sheet suggests.</p><p>We also checked how long each maker promises software updates. A phone that stops getting security updates has to be replaced, however well it works. The oldest versions we support are listed on our Help pages.</p><h3>What it does not do</h3><ul><li>Low-power mode makes the map a little less smooth.</li><li>The camera on old phones is fine for visit photos, not for marketing shots.</li><li>Very old phones can’t take tap-to-pay in the app.</li></ul><p>For teams that work outdoors in winter, a pair of touchscreen gloves solved the glove problem on every phone we tried.</p>`,
		},
		{
			id: 'p212',
			author: 'Sharon Oakley',
			category: 'Field Tips',
			date: '2026-07-15',
			title: 'Running a 40-visit day without the chaos',
			tags: ['scheduling', 'cleaning'],
			summary: 'Visit order, buffer time and why Copperleaf Design books its longest visits first.',
			customer: ['Copperleaf Design', 'copperleaf'],
			views: 2870,
			views30: 520,
			comments: 6,
			sources: [55, 20, 16, 9],
			cover: 'assets/basalt/images/multipurpose/packed-van.svg',
			alt: 'The open side door of a white van with labeled crates',
			body: `<p>Copperleaf Design runs forty visits on a busy day with eight crews. Their office manager, Robyn Daniels, says the trick isn’t the travel. It’s the order.</p><h3>Longest visits first</h3><p>Every crew starts with its longest visit of the day. If something goes wrong, there is still time to recover, and the short visits at the end can move to tomorrow with a quick text.</p><h3>Buffer where it counts</h3><p>Copperleaf adds fifteen minutes of buffer after any visit in an office building, because lifts and front desks are slow, and none after homes. The board shows the buffer as a gray block so nobody books over it.</p><ul><li>Travel Planner plans the drive between visits, but the team lead sets the first visit.</li><li>Keys and access codes go on the visit, not in a group chat.</li><li>One crew finishes early on purpose, to cover whoever runs late.</li></ul><p>On the days they follow all three rules, Robyn says, the phones stay quiet after ten.</p><h3>Keys, codes and doors</h3><p>On a forty-visit day, small delays add up. Copperleaf found that crews lost the most time at the door: waiting for a key holder, hunting for an access code in a group chat, or finding the right entrance to an office building.</p><p>Every visit now carries its own access notes, with a photo of the right door where it helps. The crew sees them on the way, not on arrival.</p><h3>When things go wrong</h3><p>A crew still runs late a few times a week. When it happens, the team lead taps “running late” in the app, and the office decides within five minutes whether to move a visit or send the early crew to help. The customer gets a text either way.</p><ul><li>Never let a crew decide alone to skip a visit.</li><li>Move the shortest visit, not the last one.</li><li>Tell the customer before the original window starts.</li></ul><p>Copperleaf say the habit took a month to settle. Now, crews ask for it.</p>`,
		},
		{
			id: 'p211',
			author: 'Paige Drake',
			category: 'Company',
			date: '2026-07-08',
			title: 'Q2 in review: portal, offline and 9 integrations',
			tags: ['release notes'],
			summary: 'A short recap for the people who actually read release notes.',
			views: 1280,
			views30: 90,
			comments: 1,
			sources: [12, 63, 13, 12],
			cover: 'assets/basalt/images/multipurpose/quarter-wall.svg',
			alt: 'A wall of sticky notes in three columns, a few in violet',
			body: `<p>This one is for the people who read release notes. Here is what shipped between April and June, in one place.</p><h3>The big three</h3><ul><li>The Customer Portal got online payments and a page where customers pick their own maintenance slots.</li><li>Offline mode went into beta with 140 teams.</li><li>Nine new integrations, including Xero, Stripe and two calendar apps.</li></ul><h3>The small ones you asked for</h3><ul><li>Visit notes now keep their line breaks.</li><li>You can copy a recurring booking with all its visits.</li><li>The schedule board remembers your filters between visits.</li><li>Invoices show the team member’s name, if you want them to.</li></ul><p>Thank you to the 310 customers who sent feedback this quarter. About a third of what shipped started as one of your emails.</p><p>Next quarter: offline mode for everyone, car stock, and a faster portal.</p><h3>By the numbers</h3><ul><li>Six releases, one every two weeks.</li><li>94 changes in total, from new features to small fixes.</li><li>Portal payments went from 0 to 11% of all invoices paid.</li><li>The app’s crash rate halved after the June release.</li></ul><h3>What we got wrong</h3><p>Not everything went smoothly. The April release changed how recurring bookings show on the board, and many of you found it confusing. We put the old view back within a week and are rethinking it with a group of customers before trying again.</p><p>The calendar integration also launched with a bug that doubled some events for a few hours. If that affected you, thank you for your patience, and for the very clear bug reports.</p><h3>How to follow along</h3><p>Release notes go out every other Tuesday in the app and by email. If you only want the big changes, choose the monthly summary in your notification settings.</p><p>As always, if something in a release gets in your way, tell us. The fastest way is the Help menu in the app, where every message reaches a person on the support team.</p>`,
		},
		{
			id: 'p210',
			author: 'Martin Hull',
			category: 'Engineering',
			date: '2026-06-30',
			title: 'The customer portal now loads in a second',
			tags: ['customer portal', 'performance'],
			summary: 'Fewer moving parts, and a payment page that works on one bar of signal.',
			views: 1450,
			views30: 120,
			comments: 2,
			sources: [38, 30, 12, 20],
			cover: 'assets/basalt/images/multipurpose/one-second.svg',
			alt: 'A silver stopwatch resting on a closed laptop',
			body: `<p>Customers open the portal from a text message, usually on a phone, often on a poor connection. In the spring, the first page took four seconds to show anything on a typical phone. It now takes about one.</p><h3>What we removed</h3><p>Most of the time went on things the customer never saw: a chat widget that loaded on every page, fonts in six weights, and a map drawn before anyone asked for it.</p><ul><li>The chat now loads only when someone taps it.</li><li>Two font weights instead of six.</li><li>The map is a picture until it is tapped.</li></ul><h3>The payment page</h3><p>We rebuilt the payment page so it works on one bar of signal. It sends less than a tenth of what it did, and it keeps what the customer typed if the connection drops halfway.</p><p>Portal payments have gone up 18% since, and most of that is customers who used to give up.</p><h3>How we measured it</h3><p>We tested on a mid-range phone from three years ago, on a slow mobile connection, because that is what many of our customers’ customers actually use. Measuring on a new laptop on office Wi-Fi would have told us everything was fine.</p><p>We now run the same test on every release. If the first page gets slower than 1.5 seconds, the release waits until it is fixed.</p><h3>What customers noticed</h3><ul><li>Fewer half-finished bookings left in the portal.</li><li>More payments made from the reminder text itself.</li><li>Fewer calls to the office asking whether a payment went through.</li></ul><h3>What comes next</h3><p>Next we are looking at the booking calendar, which is now the slowest page in the portal. It loads every free slot for the next month at once, when most customers only look at the next week.</p><p>None of this needed new servers or a rewrite. It came from measuring honestly, on the phones customers really use, and removing what didn’t earn its place.</p>`,
		},
		{
			id: 'p209',
			author: 'Brittany Fenn',
			category: 'Customer Stories',
			date: '2026-06-18',
			title: 'Avocet Robotics doubled its grooming visits',
			tags: ['pet care', 'maintenance plans'],
			summary: 'One reminder a month before each visit, and a portal where customers pick the slot themselves.',
			customer: ['Avocet Robotics', 'avocet'],
			views: 2050,
			views30: 160,
			comments: 4,
			sources: [36, 27, 25, 12],
			cover: 'assets/basalt/images/multipurpose/two-groomed-dogs.svg',
			alt: 'Two freshly groomed white dogs on a grooming table',
			body: `<p>Avocet Robotics sold plenty of grooming plans. The trouble was getting customers to actually book the visits. Half the plans went a whole year without one.</p><h3>Two small changes</h3><p>First, a reminder text a month before each visit is due, with a link. Second, that link opens the Customer Portal, where the customer picks a slot themselves instead of calling the office.</p><blockquote>Customers would rather tap a time than talk to us. Who knew.</blockquote><h3>The result</h3><p>Booked grooming visits doubled in four months. Plans that get their visit renew far more often, so the change paid for itself before the year was out.</p><ul><li>Most bookings come in the evening, when the office is closed.</li><li>Customers pick Tuesday to Thursday mornings most.</li><li>Only one in twenty still calls.</li></ul><p>Both features are part of the Customer Portal add-on, at $4 a seat a month.</p><h3>The office’s side</h3><p>Before, the office spent Monday mornings ringing plan customers to book visits, and most calls went to voicemail. Now the office only calls the few who haven’t picked a slot two weeks before the visit is due.</p><p>That freed up about a day a week, which Avocet now spends on following up quotes.</p><h3>The reminder that works</h3><p>Avocet tried a few versions of the reminder text. The one that worked best was the shortest: the customer’s first name, the words “your dog’s groom is due”, and the link. Longer messages, with prices or offers, were booked less.</p><ul><li>Send it on a weekday evening, around six.</li><li>Send one follow-up a week later, then stop.</li><li>Keep the link working for the whole month.</li></ul><h3>What’s next for Avocet</h3><p>They are now adding a second visit to their larger plans, using seasonal schedules once they arrive.</p><p>If you run maintenance plans, try the reminder for one month on a small group of customers, and compare the bookings with everyone else.</p>`,
		},
	];

	/* Booked for a set day and hour, waiting to go out. */
	const bookedStories = [
		{
			id: 'p225',
			author: 'Erin Slater',
			category: 'Product Updates',
			date: '2026-10-13',
			time: '09:00',
			edited: '2026-10-05',
			title: 'Seasonal schedules are here',
			tags: ['maintenance plans', 'scheduling'],
			summary: 'Set a spring and an autumn visit once and Fieldline books both every year.',
			cover: 'assets/basalt/images/multipurpose/four-seasons.svg',
			alt: 'A blossom twig, a sun hat, a dry leaf and a violet glove in a row',
			body: `<p>Maintenance plans often follow the seasons: a garden tidy in spring, a leaf clear in autumn. Until now, that meant setting up two recurring bookings and keeping them in step by hand.</p><p>Seasonal schedules put both visits on one plan. Pick the months once, and Fieldline books both visits every year, in the right order, with the right visit type.</p><h3>How it works</h3><ul><li>Choose a window for each season, such as March to April and September to October.</li><li>Fieldline books each visit in the quietest week of its window.</li><li>The customer gets the reminder a month ahead, as with any maintenance visit.</li></ul><p>If a customer moves the spring visit, the autumn one stays where it is. If they cancel the plan, both go.</p><h3>Moving existing plans</h3><p>Plans that already use two recurring bookings can be joined in one step from the plan page. Nothing already booked moves.</p><p>Seasonal schedules are on Pro and Max from Tuesday, October 13.</p><h3>Why we built it</h3><p>Seasonal plans were one of the most requested changes last year. Teams told us that keeping two recurring bookings in step took hours each spring, and that customers were confused when one visit moved and the other didn’t.</p><h3>What customers see</h3><p>Customers see one plan with two visits, both in the Customer Portal. Reminders mention which season the visit is for, so a customer knows whether to expect a spring or an autumn visit.</p><ul><li>Each visit can have its own checklist.</li><li>Prices can differ by season, or be one monthly amount.</li><li>Invoices show the plan, not two separate visits.</li></ul><h3>Planning the busy weeks</h3><p>Because Fieldline books each visit in the quietest week of its window, the board fills more evenly. In testing, teams with seasonal schedules had about a fifth fewer days where every team member was fully booked in spring.</p><p>We would love to hear how you use it. Reply to the release email, or write to us from the Help menu.</p>`,
		},
		{
			id: 'p226',
			author: 'Brittany Fenn',
			category: 'Customer Stories',
			date: '2026-10-15',
			time: '09:00',
			edited: '2026-10-07',
			title: 'Highpoint Outfitters’s winter checklist',
			tags: ['home care', 'checklists'],
			summary:
				'The twelve checks their carers run in every home before the first cold week, and how they book them.',
			customer: ['Highpoint Outfitters', 'highpoint'],
			cover: 'assets/basalt/images/multipurpose/winter-kit.svg',
			alt: 'Rubber boots, an ice scraper, a flask and a checklist by a door',
			body: `<p>In Concord, the first cold week arrives without much warning. Highpoint Outfitters’s carers spend September and October making sure none of their clients are caught out when it does.</p><h3>Twelve checks, every home</h3><p>The checklist is short enough to finish in forty minutes and strict enough that nothing is left to memory.</p><ol><li>Heating on and the room warm, with the thermostat setting noted.</li><li>Warm clothes and blankets within easy reach.</li><li>Smoke and carbon monoxide alarms tested.</li><li>Paths and front steps checked for ice.</li></ol><p>The other eight cover food in the house, medicines, emergency numbers and the client’s family contacts.</p><h3>Booking 2,000 visits in eight weeks</h3><p>Highpoint books the visits by neighborhood, so a carer can do six in a morning on one street. Families pick from three slots in the portal, and the board fills in the gaps.</p><blockquote>If a client is going to struggle this winter, we want to find out in October with us sitting next to them.</blockquote><h3>What the carers carry</h3><p>Each car carries a winter kit: spare blankets, hand warmers, grit for icy steps and enough smoke alarms for a week. Since Highpoint started using car stock in Fieldline, the kit tops itself up from the stockroom list every night.</p><h3>When something is found</h3><p>If a check finds a problem, the carer books the fix on the spot from the app. Most families approve it before the carer leaves, and about a third of the fixes are done in the same visit.</p><ul><li>Small things are sorted straight away.</li><li>Larger ones get a booked visit within a week.</li><li>Anything unsafe is reported to the family the same day.</li></ul><h3>The results</h3><p>Last winter, Highpoint had a third fewer urgent visits in December than the year before, and the ones they did get were mostly from clients without a winter check. This year they expect to check more than 2,000 homes before the end of October.</p>`,
		},
		{
			id: 'p227',
			author: 'Sharon Oakley',
			category: 'Field Tips',
			date: '2026-10-20',
			time: '14:00',
			edited: '2026-10-06',
			title: 'What to ask before buying phones',
			tags: ['mobile', 'phones'],
			summary: 'Gloves, glare, charging and holders: what matters once the phone goes to work.',
			cover: 'assets/basalt/images/multipurpose/phones-on-bench.svg',
			alt: 'Three work phones beside a car mount, a cable and a notepad',
			body: `<p>Buying phones for a team that works on site is different from buying them for an office. They get dropped, rained on and left on the dashboard in August. Here are the questions worth asking first.</p><h3>Will it work in gloves?</h3><p>Many on-site teams work in gloves half the year. Check that the screen has a glove mode, and test it with the gloves your team actually wears.</p><h3>Can you read it outside?</h3><p>Brightness numbers don’t tell you much. Take it outside at noon and try to read a checklist.</p><h3>Does the charge last a whole day?</h3><p>Maps and photos drain phones fast. Ask how long it lasts with the screen on and location running, and keep a charger in the car either way.</p><h3>Where does it live?</h3><ul><li>A phone on the passenger seat will end up on the floor.</li><li>A proper holder keeps it in sight for directions.</li><li>A power bank is cheaper than a lost afternoon.</li></ul><p>We test the Fieldline app against these questions on the phones our customers use most.</p><h3>How will you set them up?</h3><p>Setting up twenty phones by hand takes most of a day. Ask whether the phones can be set up remotely, so they arrive ready, with your apps and settings in place. Most phone sellers will do it for a small fee.</p><h3>What happens when one breaks?</h3><p>Phones will break. Ask how long a repair takes, whether you get a loan phone, and what the cover includes. A phone out for three weeks is a team member working from paper for three weeks.</p><ul><li>Keep one spare phone per ten people.</li><li>Check that the cover includes drops, not just faults.</li><li>Know who to call before you need to.</li></ul><h3>Their phone or yours?</h3><p>Some teams don’t need work phones at all. If staff mostly fill in checklists and take photos, the app on their own phone may be enough, with a monthly allowance for data. Work phones earn their place for teams that show customers quotes or photos on site.</p>`,
		},
	];

	/* Waiting on a second reader; reviewer names who signs it off. */
	const reviewStories = [
		{
			id: 'p228',
			author: 'Paige Drake',
			category: 'Field Tips',
			date: '2026-10-22',
			time: '09:00',
			edited: '2026-10-06',
			title: 'Two teams, one mobile hoist',
			tags: ['teams', 'scheduling'],
			summary: 'The rule Lumora AI uses for the hoist and the wheelchair, and why Friday afternoons stay empty.',
			customer: ['Lumora AI', 'lumoraai'],
			cover: 'assets/basalt/images/multipurpose/shared-hoist.svg',
			alt: 'A mobile patient hoist in a bright hallway with violet and blue tags',
			reviewer: 'John Armstrong',
			notes: [
				note(
					'Paige Drake',
					'Tue, Oct 6, 4:12 pm',
					'Ready for you. Marlene at Lumora AI read it and is happy for us to use the office photos.',
				),
				note(
					'John Armstrong',
					'Thu, Oct 8, 10:05 am',
					'Reads well. Could the Friday rule go higher up? It is the part people will copy.',
				),
				note(
					'Paige Drake',
					'Thu, Oct 8, 11:40 am',
					'It needs the double-booking story first, or it reads like a random rule. Happy to move it if you still think so.',
				),
			],
			history: [
				{
					when: 'Tue, Oct 6, 4:10 pm',
					icon: 'send',
					tone: 2,
					html: '<strong>Paige Drake</strong> sent it to <strong>John Armstrong</strong> for review',
				},
				{
					when: 'Tue, Oct 6, 3:48 pm',
					icon: 'pencil',
					tone: 1,
					html: '<strong>Paige Drake</strong> added &ldquo;Why Friday afternoons stay empty&rdquo;',
				},
				{
					when: 'Mon, Oct 5, 2:15 pm',
					icon: 'calendar-event',
					tone: 4,
					html: '<strong>Paige Drake</strong> planned it for Thu, Oct 22',
				},
				{
					when: 'Fri, Oct 2, 11:20 am',
					icon: 'image',
					tone: 5,
					html: '<strong>Paige Drake</strong> picked the cover photo',
				},
				{
					when: 'Mon, Sep 28, 9:30 am',
					icon: 'file-earmark-plus',
					tone: 3,
					html: '<strong>Paige Drake</strong> started the draft',
				},
			],
			body: `<p>Lumora AI runs two teams out of one office: a day team and an evening team, nine carers in all. Between them they own one mobile hoist and one spare wheelchair. For two years, both lived on a whiteboard by the door, and for two years someone drove across town to find the hoist already gone.</p><p>This is how their scheduler, Marlene Bishop, stopped the double-booking without buying a second hoist.</p><h3>The kit is a booking, not a note</h3><p>The whiteboard failed for a simple reason. It said where the hoist <em>was</em>, never where it was <em>going</em>. A carer could book a visit for Thursday morning that needed the hoist, and nobody would notice that the other team had the same idea until Thursday morning.</p><p>So Marlene added both items to Fieldline as equipment, the same way you add a team member. A visit that needs the hoist books the hoist, and the schedule board shows it as a third row under the two teams. When a slot is taken, it is taken for everyone.</p><ul><li>Every visit type that might need the hoist, like the first visit home from hospital, asks for it by default.</li><li>The wheelchair is booked for half a day at a time, because fetching it takes longer than using it.</li><li>A clash shows as a red edge on the board before the visit is saved, not after.</li></ul><h3>Why Friday afternoons stay empty</h3><p>The second rule is the one other offices copy first. From noon on Friday, neither team can book the hoist or the wheelchair. That half day is for cleaning the hoist, checking the sling and fixing whatever broke during the week.</p><blockquote>Before, we found out the hoist was broken on Monday at eight, with a client waiting. Now we find out on Friday at two, with nobody waiting.</blockquote><p>It also gives Marlene a buffer. When a Thursday visit runs long, Friday afternoon is where it goes, instead of pushing the next week back by a day.</p><p>The wheelchair follows the same rule with one change. It only fits in one car, so the team that has it on Thursday keeps it overnight and brings it back by Friday noon. Marlene books that return trip as a short visit on the board, so it shows up in the day plan like any other visit and nobody forgets it.</p><h3>What changed in three months</h3><p>In the three months before the change, the two teams double-booked a piece of kit fourteen times. In the three months after, they did it once, on the day the rule went live. Carers stopped driving back to the office to swap kit, which Marlene puts at about two hours a week across both teams. Clients noticed too: fewer visits were moved at the last minute because the right kit was not in the car.</p><p>Nobody had to remember anything new. The board simply stopped offering a slot that was already gone.</p><h3>Try it on your own board</h3><ol><li>Add each shared item as equipment under Settings, then Resources.</li><li>Mark the visit types that need it, so new visits ask for it on their own.</li><li>Block one quiet half day a week for upkeep, and treat it as a real booking.</li></ol><p>Start with the one item people argue about most. If your teams never fight over the wheelchair, leave it off the board and keep things simple.</p>`,
		},
		{
			id: 'p229',
			author: 'Martin Hull',
			category: 'Engineering',
			date: '2026-10-27',
			time: '10:00',
			edited: '2026-10-07',
			title: 'Inside our release process',
			tags: ['release notes', 'quality'],
			summary:
				'Beta flags, a two-week pilot with ten customers, and the checklist we publish with every release.',
			cover: 'assets/basalt/images/multipurpose/release-checklist.svg',
			alt: 'A clipboard checklist ticked in violet beside a blue mug',
			reviewer: 'Paige Drake',
			notes: [
				note(
					'Martin Hull',
					'Wed, Oct 7, 5:02 pm',
					'Over to you. The pilot numbers are from the September release, checked with the support team.',
				),
				note(
					'Paige Drake',
					'Thu, Oct 8, 9:15 am',
					'Love the checklist part. The beta flags section is heavy for customers; could it lose the second paragraph?',
				),
			],
			body: `<p>Every two weeks we ship a new version of Fieldline to more than two thousand companies whose working day depends on it. A broken release doesn’t mean a bad afternoon for us. It means a team member in a parking lot who can’t see their next visit.</p><p>Here is how we try to make sure that never happens.</p><h3>Everything starts behind a flag</h3><p>New features ship switched off. We turn them on for our own team first, then for customers who have asked to try new things early.</p><p>A flag can be switched off again in seconds, without a new release, which is what makes it safe to ship often.</p><h3>A two-week pilot</h3><p>Bigger changes go to ten customers for two weeks before anyone else. We pick a mix: a small pet care team, a large home care company, someone who works offline a lot. Support reads every ticket they send.</p><h3>The checklist we publish</h3><ul><li>What changed, in plain words.</li><li>Who it affects, and whether anyone needs to do anything.</li><li>How to switch it off, if that is possible.</li></ul><p>We publish it with every release, on the same day, whether the release is big or small.</p><h3>When something goes wrong anyway</h3><p>Sometimes a problem slips through. When it does, the engineer on call can switch off the feature that caused it, or roll back the whole release, in under ten minutes. We would rather undo a release quickly than fix it in a hurry.</p><p>After every incident, we write down what happened and what we will change, and share it with the customers who were affected.</p><h3>Why every two weeks</h3><p>Releasing often sounds risky, but it is the opposite. A release with a few changes is easy to check and easy to undo. A release with three months of changes is neither.</p><ul><li>Releases go out on Tuesday mornings, Eastern Time.</li><li>Nothing ships on a Friday or before a public holiday.</li><li>The support team sees every release a day early.</li></ul><p>If you want to join the early-access group, ask in the app or reply to any release email.</p>`,
		},
	];

	/* Unfinished work with no date yet, newest edit first. */
	const draftStories = [
		{
			id: 'p230',
			author: 'Erin Slater',
			category: 'Product Updates',
			edited: '2026-10-07',
			title: 'Travel Planner now plans around lunch breaks',
			tags: ['travel planning'],
			summary: 'Staff pick a lunch window and the day plan works around it, instead of the other way round.',
			cover: 'assets/basalt/images/multipurpose/lunch-break.svg',
			alt: 'A lunch box and a flask on the passenger seat of a van',
			body: `<p>Travel Planner has always planned the shortest day it could. Staff told us the shortest day sometimes meant lunch at three in the afternoon, eaten in the car.</p><p>From this release, each team member can pick a lunch window in the app, such as 12:00 to 1:00 pm. The planner treats it like a short visit with no address and plans the day around it.</p><h3>What it does</h3><ul><li>Keeps a 30-minute break inside the window the team member picked.</li><li>Moves the break, not a customer, if the morning runs late.</li><li>Shows the break on the schedule board as a gray block.</li></ul><p>In testing, days with a planned lunch were a few minutes longer on the road, and staff were noticeably happier about it.</p><p>Travel Planner is an add-on at $6 a seat a month.</p><h3>How staff set it</h3><p>The lunch window lives in each person’s own settings, so each person can pick what suits them. The office can also set a default for the whole team, which most teams do, and let people change it.</p><h3>What the office sees</h3><p>On the schedule board, the break appears as a gray block. Dragging a visit onto it asks whether to move the break, so nobody loses lunch by accident. The day summary also shows anyone whose break was skipped, so the office can follow up.</p><ul><li>Breaks can be paid or unpaid, for time sheets.</li><li>Anyone can take a break early from the app, and the day plan adjusts.</li><li>Breaks never show to customers.</li></ul><h3>Rolling out</h3><p>Lunch breaks will be on for every Travel Planner team in the next release. Nothing changes until a lunch window is set.</p>`,
		},
		{
			id: 'p231',
			author: 'John Armstrong',
			category: 'Company',
			edited: '2026-10-02',
			title: 'A second support team in Ohio',
			tags: ['hiring', 'support'],
			summary: 'Why support for on-site teams has to start at 7am, and the trial shift we run instead of a test.',
			cover: 'assets/basalt/images/multipurpose/support-desk.svg',
			alt: 'A headset on a desk by a window over a small main street',
			body: `<p>On-site teams start early. By seven in the morning, staff are heading out, and if the app shows the wrong day, they need an answer before they leave the office.</p><p>That is why we are building a second support team in Ohio, to cover the early hours for customers from Akron to Bloomington.</p><h3>How we hire</h3><p>We don’t set a take-home test. Instead, candidates join us for a paid trial shift, answering real questions alongside someone from the team.</p><ul><li>Half a day, paid, at a time that suits the candidate.</li><li>Real tickets, with a teammate checking every reply before it goes out.</li><li>An honest talk at the end about how it went, both ways.</li></ul><p>We are hiring six people for the new team, starting in January. The roles are on our Careers page.</p><h3>What the team will do</h3><p>The new team will cover from six in the morning, Eastern Time, until our West Coast team comes online. They will answer chat, email and phone, and they will be able to fix most account problems without passing them on.</p><h3>Where they will be</h3><p>The team will work from our Akron office, with the option to work from home two days a week. We chose Akron because it lets us cover the early hours on the East Coast, and because several of our longest-serving support people already live there.</p><ul><li>Six roles, starting in January.</li><li>Training in our Minot office for the first two weeks.</li><li>A senior lead who has worked in our support team for three years.</li></ul><p>If you know someone who would be good at this, please send them our way.</p>`,
		},
		{
			id: 'p232',
			author: 'Paige Drake',
			category: 'Company',
			edited: '2026-09-28',
			title: 'Counting the miles our customers save',
			tags: ['travel planning'],
			summary:
				'An honest update on the one number we still cannot measure well without asking for location data.',
			cover: 'assets/basalt/images/multipurpose/miles-saved.svg',
			alt: 'A paper road map with a short violet route between pins',
			body: `<p>We often say Fieldline saves on-site teams driving. We believe it. We just can’t prove how much, and we would rather say that plainly.</p><h3>Why it is hard</h3><p>To count the miles saved, we would need to know where every car actually drove, before and after. That means location data from every team member, all day, and we don’t collect it unless a customer turns on live locations in the app.</p><h3>What we can say</h3><ul><li>Days planned by Travel Planner are 18% shorter on paper than the days the office planned first.</li><li>Teams with live locations on drive about 14% fewer miles in their first three months.</li><li>Those teams chose to share their locations, so they may not be typical.</li></ul><p>We will keep publishing the second number, with that warning, until we find a fairer way to count.</p><h3>Why not just collect location data?</h3><p>We could ask every customer to turn on location tracking for every team member, all day. Some would. Many wouldn’t, and they would be right to think hard about it. Tracking people at work raises fair questions about privacy, and it isn’t something we want to make the price of a better day plan.</p><h3>What we are trying instead</h3><p>We are testing a way to estimate distance from the order of visits and the roads between them, without tracking anyone. It won’t be perfect: it can’t see detours for fuel or supplies. It may be good enough to compare a team’s days before and after Travel Planner.</p><ul><li>No location data leaves the phone.</li><li>The estimate is shown with a range, not a single number.</li><li>Teams can compare it with their own fuel bills.</li></ul><p>We will publish the method alongside any number we share.</p>`,
		},
	];

	/**
	 * Stamps each group with its status, works out reading time and hangs
	 * the result on the shared window.Basalt.data namespace.
	 */
	function publish() {
		const stories = [
			...withStatus('published', liveStories, { time: '09:00' }),
			...withStatus('scheduled', bookedStories),
			...withStatus('review', reviewStories),
			...withStatus('draft', draftStories),
		];
		for (const story of stories) story.read = minutesToRead(story.body);

		window.Basalt.data ||= {};
		window.Basalt.data.blog = {
			categories: topicRows.map(([name, icon, tone]) => ({ name, tone, icon })),
			authors: bylines,
			posts: stories,
			readers: {
				roles: readerRows.map(([role, share]) => ({ role, share })),
				returning: 41,
				finished: 63,
			},
		};
	}

	/**
	 * @param {string} status  the workflow state every story in the group shares
	 * @param {object[]} group stories written without that state
	 * @param {object} [shared] further fields the whole group has in common
	 * @returns {object[]} the same stories with the shared fields filled in
	 */
	function withStatus(status, group, shared = {}) {
		return group.map((story) => ({ ...story, status, ...shared }));
	}

	/** One reviewer remark in a story's thread: who left it, when, and what. */
	function note(who, when, remark) {
		return { who, when, text: remark };
	}

	/** Whole minutes to read some markup, never less than one. */
	function minutesToRead(markup) {
		const plain = markup.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
		const wordCount = plain.trim().split(/\s+/).length;
		return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
	}

	publish();
})();
