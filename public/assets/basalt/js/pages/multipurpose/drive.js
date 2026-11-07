/**
 * Office drive for drive.html. Folders and files live in one
 * in-memory map; the page browses it, searches it, previews files in a
 * side sheet, takes uploads by drop or picker, and handles sharing,
 * stars, moves, renames and a trash that can be emptied or restored.
 *
 * Connecting a backend: make server.fetchDrive() return your own payload
 * in the SAMPLE format and fill in the other server methods. The page
 * redraws first and rolls a change back if its call is rejected.
 * Leans on basalt.js for the tree, context menu, drop zone, upload queue,
 * undo toasts, hold-to-confirm, the resizable sheet, selects and suggestions.
 */
(() => {
	'use strict';

	const page = pick('[data-drv-root]');
	if (!page) return;

	/* Byte units, and a fixed clock so every visit shows the same ages. */
	const KIB = 1024;
	const MIB = 1024 * KIB;
	const GIB = 1024 * MIB;
	const CLOCK_ORIGIN = new Date(2026, 8, 30, 10, 20);
	const openedAt = Date.now();
	const MONTH_ABBR = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
	const demoMode = new URLSearchParams(location.search).get('state');

	/*
	 * The sample drive. Folders are [id, name, parent id or null, extras],
	 * files are [name, folder id, extras]; extras.look feeds the preview.
	 * Sizes, ages and owners are drawn from a seeded sequence below, so a
	 * real payload would simply carry them.
	 */
	const SAMPLE = {
		viewer: 'ja',
		capacity: 20 * GIB,
		shareUrl: 'https://drive.fieldline.app/oakhaven/s/',
		people: [
			{ id: 'ja', name: 'John Armstrong', email: 'john@oakhavenstudio.com', job: 'Owner' },
			{ id: 'lk', name: 'Leah Zimmerman', email: 'leah@oakhavenstudio.com', job: 'Office manager' },
			{ id: 'dm', name: 'Darius Moore', email: 'darius@oakhavenstudio.com', job: 'Scheduler' },
			{ id: 'mr', name: 'Travis Reid', email: 'travis@oakhavenstudio.com', job: 'Senior carer' },
			{ id: 'hs', name: 'Hope Stout', email: 'hope.stout@oakhavenstudio.com', job: 'Care planner' },
			{ id: 'er', name: 'Elise Rudd', email: 'elise@oakhavenstudio.com', job: 'Accounts' },
		],
		folders: [
			['visits', 'Visit photos', null],
			['vs-new', 'New clients', 'visits'],
			['vs-safety', 'Home safety', 'visits'],
			['vs-review', 'Care reviews', 'visits'],
			['estimates', 'Care plans and pricing', null],
			['suppliers', 'Suppliers and PPE', null],
			['marketing', 'Marketing', null, { sharing: { with: [['lk', 'edit']], link: 'off' } }],
			['mk-fall', 'Fall wellness check', 'marketing'],
			['mk-news', 'Newsletters', 'marketing'],
			['mk-signs', 'Car signs', 'marketing'],
			['mk-show', 'Care fair stand 2025', 'marketing', { binnedDaysAgo: 9 }],
			['procedures', 'Procedures and checklists', null],
			['finance', 'Finance', null],
			['team', 'Team', null],
			['plans', 'Home care packages', null],
		],
		files: [
			[
				'Start here.md',
				null,
				{
					starred: true,
					look: {
						text: '# The office drive\n\nEverything the office and the carers share lives here. A few house rules:\n\n- Visit photos go in Visit photos, named by street and what was done.\n- Price lists are never emailed as attachments. Share the link instead.\n- Anything with a client\'s address or card details stays in Finance or Home care packages.\n- Old versions go to the trash, not to an "old" folder. The trash keeps them for 30 days.\n\nAsk Leah if you need a folder shared with someone outside the company.',
					},
				},
			],
			[
				'brand-kit.zip',
				null,
				{
					look: {
						entries: [
							['logo-mark.svg', 18 * KIB],
							['logo-wordmark.svg', 24 * KIB],
							['car-door-sign.ai', 4.2 * MIB],
							['color-swatches.pdf', 640 * KIB],
							['fonts-license.txt', 3 * KIB],
						],
					},
				},
			],
			[
				'store-room-layout.pdf',
				null,
				{
					look: {
						pages: 2,
						title: 'Store room layout',
						blocks: [
							'Gloves and aprons move to the shelves by the back door, so carers can restock without walking the whole room.',
							'Spare medication bags stay in the locked cabinet on the north wall, signed in and out.',
							'Each carer has a labeled shelf for returns and faulty kit going back to the supplier.',
						],
					},
				},
			],

			['carver-st-grab-rails.jpg', 'vs-new', { look: { art: 'unit', tone: 1, dims: '4032 × 3024' } }],
			['oakridge-front-door-ramp.jpg', 'vs-new', { look: { art: 'unit', tone: 3, dims: '4032 × 3024' } }],
			['maple-ln-bathroom-setup.png', 'vs-new', { look: { art: 'panel', tone: 5, dims: '3024 × 4032' } }],
			['westfield-house-kitchen.jpg', 'vs-new', { look: { art: 'unit', tone: 2, dims: '4032 × 3024' } }],
			['kessler-dr-key-safe.jpg', 'vs-new', { look: { art: 'device', tone: 7, dims: '3024 × 4032' } }],
			['hollis-rd-loose-carpet.jpg', 'vs-safety', { look: { art: 'panel', tone: 4, dims: '3024 × 4032' } }],
			['pine-ct-smoke-alarm.png', 'vs-safety', { look: { art: 'meter', tone: 6, dims: '2400 × 2400' } }],
			['elm-st-hallway-before.jpg', 'vs-safety', { look: { art: 'unit', tone: 8, dims: '4032 × 3024' } }],
			['moorings-house-review-notes.jpg', 'vs-review', { look: { art: 'unit', tone: 2, dims: '4032 × 3024' } }],
			['lakeview-court-meds-chart.png', 'vs-review', { look: { art: 'meter', tone: 1, dims: '2400 × 2400' } }],
			['car-14-kit-restock.jpg', 'vs-review', { look: { art: 'vehicle', tone: 3, dims: '4032 × 3024' } }],

			[
				'price-list-2026.xlsx',
				'estimates',
				{
					starred: true,
					sharing: {
						with: [
							['hs', 'edit'],
							['er', 'view'],
						],
						link: 'team',
					},
					look: {
						total: 46,
						rows: [
							['Item', 'Unit', 'Cost', 'Price'],
							['Live-in care, four weeks', 'block', '$6,850', '$9,400'],
							['Care visit, two hours', 'visit', '$38', '$129'],
							['Medication review', 'each', '$22', '$185'],
							['Key safe, supplied and fitted', 'each', '$140', '$310'],
							['Shopping trip', 'per hour', '$9', '$35'],
						],
					},
				},
			],
			[
				'respite-rate-card.pdf',
				'estimates',
				{
					sharing: { with: [['lk', 'edit']], link: 'anyone' },
					look: {
						pages: 4,
						title: 'Respite care rate card, 2026',
						blocks: [
							'Rates for care homes, clinics and councils on a service agreement, from October 1.',
							'Weekday care is $135 an hour. Evenings and weekends are $190, with a two-hour minimum.',
							'Live-in care is quoted per week after a home visit. Ask Hope for a walkthrough.',
						],
					},
				},
			],
			[
				'service-terms.pdf',
				'estimates',
				{
					look: {
						pages: 6,
						title: 'Service terms',
						blocks: [
							'Invoices are due 30 days from the visit. Overdue accounts go on hold until they are settled.',
							'Care plans hold for 30 days. Prices can change after that.',
							'A missed visit is refunded in full; a visit over an hour late gets half back.',
						],
					},
				},
			],
			[
				'open-care-plans.csv',
				'estimates',
				{
					look: {
						text: 'customer,plan,amount,sent\nWestfield Hotel,Weekend cover for a year,48600,Sep 18\nHarbor Clinic,Discharge support package,12450,Sep 22\nLakeview Court,Night care for six weeks,8900,Sep 24\nGarcia residence,Live-in care for a month,9400,Sep 26\nOak Street Thorne,Day center transport plan,2160,Sep 29',
						rows: [
							['customer', 'plan', 'amount', 'sent'],
							['Westfield Hotel', 'Weekend cover for a year', '48600', 'Sep 18'],
							['Moorings Clinic', 'Discharge support package', '12450', 'Sep 22'],
							['Lakeview Court', 'Night care for six weeks', '8900', 'Sep 24'],
							['Odom residence', 'Live-in care for a month', '9400', 'Sep 26'],
							['Oak Street Thorne', 'Day center transport plan', '2160', 'Sep 29'],
						],
						total: 5,
					},
				},
			],

			[
				'downland-supply-agreement.pdf',
				'suppliers',
				{
					look: {
						pages: 9,
						title: 'Supply agreement: Downland Supply',
						blocks: [
							'Trade pricing on gloves, aprons and hoist slings for 2027, with a rebate at 40 cases a month.',
							'Supplies are paid net 30. Faulty items are swapped at the counter for new ones.',
							'Two pallets a week are delivered to the office on Tuesdays and Fridays.',
						],
					},
				},
			],
			[
				'cleaning-safety-sheets.zip',
				'suppliers',
				{
					look: {
						entries: [
							['hand-gel-sds.pdf', 420 * KIB],
							['surface-wipes-sds.pdf', 380 * KIB],
							['bleach-sds.pdf', 350 * KIB],
							['laundry-sds.pdf', 410 * KIB],
						],
					},
				},
			],
			[
				'quote-fieldline-add-ons.pdf',
				'suppliers',
				{
					look: {
						pages: 2,
						title: 'Quote: Fieldline add-ons',
						blocks: [
							'8 more Pro seats at $32 and Travel Planner at $6, one of each per carer.',
							'Total $3,648 a year before tax. Starts on the first of the month.',
							'Price holds until November 15.',
						],
					},
				},
			],
			[
				'supplier-contacts.csv',
				'suppliers',
				{
					look: {
						text: 'supplier,contact,email\nRidgeway Supply,Dana Holt,dana@example.com\nNorthside Medical,Gerald Pratt,gerald@example.com\nClearcare Gloves,Mae Loy,mae@example.com\nFieldline,Accounts desk,billing@fieldline.app',
						rows: [
							['supplier', 'contact', 'email'],
							['Downland Supply', 'Dana Holt', 'dana@example.com'],
							['Northside Medical', 'Gerald Pratt', 'gerald@example.com'],
							['Clearcare Gloves', 'Mae Loy', 'mae@example.com'],
							['Fieldline', 'Accounts desk', 'billing@fieldline.app'],
						],
						total: 4,
					},
				},
			],

			[
				'fall-wellness-check-plan.docx',
				'mk-fall',
				{
					starred: true,
					sharing: {
						with: [
							['lk', 'edit'],
							['hs', 'view'],
						],
						link: 'off',
					},
					look: {
						pages: 5,
						title: 'Fall wellness check plan',
						blocks: [
							'A $99 home wellness check runs from October 13 to November 30, booked through the customer portal.',
							'SMS reminders to care package clients on the 6th, postcards on the 9th, leaflets on every visit from the 13th.',
							'Photos and the video are in this folder. Post copy is in social-posts.txt.',
						],
					},
				},
			],
			['fall-hero-banner.png', 'mk-fall', { look: { art: 'banner', tone: 4, dims: '2880 × 1200' } }],
			[
				'wellness-check-video-cut-2.mp4',
				'mk-fall',
				{
					sharing: { with: [['dm', 'edit']], link: 'off' },
					look: { art: 'film', tone: 5, duration: '1:42', dims: '1920 × 1080' },
				},
			],
			[
				'social-posts.txt',
				'mk-fall',
				{
					look: {
						text: 'Oct 12  First cold night this week. When did someone last check in on your parents?\n\nOct 13  Wellness checks are $99 until the end of November. Book a time that suits you on our portal.\n\nOct 14  Travis spotted a loose stair rail on Kessler Drive this morning. This is why we check.',
					},
				},
			],
			[
				'september-newsletter.docx',
				'mk-news',
				{
					look: {
						pages: 3,
						title: 'September newsletter',
						blocks: [
							'This month: two new carers, and every carer now has the Fieldline app on their phone.',
							'Care package clients can book fall visits from October 6, before we open the calendar to everyone.',
							'Tip of the month: test your smoke alarm when the seasons change, not when you remember.',
						],
					},
				},
			],
			[
				'october-newsletter-draft.md',
				'mk-news',
				{
					look: {
						text: "# October newsletter (draft)\n\n## Winter season\n\nWellness checks are $99 until November 30. Package clients get theirs included.\n\n## Text reminders\n\nYou will now get a text the day before a visit, with your carer's name and a two-hour window.\n\n## Still to do\n\n- Photo of the new team (Darius)\n- Prices for the night care plan (Hope)",
					},
				},
			],

			[
				'first-visit-checklist.pdf',
				'procedures',
				{
					starred: true,
					sharing: { with: [], link: 'anyone' },
					look: {
						pages: 2,
						title: 'First visit checklist',
						blocks: [
							'Check the key safe code with the office before you set off.',
							'Walk the home, note any trip hazards, and check the smoke alarms work.',
							'Record medication, allergies and contacts in the visit checklist before you leave the home.',
						],
					},
				},
			],
			[
				'medication-rounds.txt',
				'procedures',
				{
					look: {
						text: 'Medication, every visit\n\n1. Tell the client what you are about to give.\n2. Check the chart against the label on the box.\n3. Sign the chart. Your name, the date, the time given.\n4. Watch the dose being taken before you sign.\n5. Only the person who gave it signs for it.',
					},
				},
			],
			[
				'moving-and-handling.md',
				'procedures',
				{
					look: {
						text: '# Moving and handling\n\nRead the care plan for 15 minutes before any transfer.\n\n- One-person transfer: use the slide sheet in small moves.\n- Two-person transfer: wait for your colleague before starting.\n- Change one thing at a time and give the client five minutes between moves.\n\nLog how the transfer went and any pain noted in the visit notes.',
					},
				},
			],
			[
				'lone-worker-card.pdf',
				'procedures',
				{
					look: {
						pages: 1,
						title: 'Lone worker card',
						blocks: [
							'Check in with the office when you arrive and when you leave.',
							'Keep your phone charged. Car keys go in your pocket, not your bag.',
							'No visit alone if a client is unwell with a fever. Call the office and reschedule.',
						],
					},
				},
			],
			[
				'care-review-intervals.xlsx',
				'procedures',
				{
					look: {
						total: 12,
						rows: [
							['Client need', 'Visit', 'Every', 'Time on site'],
							['Personal care', 'Review', '12 months', '1 h'],
							['Medication', 'Review', '6 months', '1.5 h'],
							['Mobility', 'Home check', '3 months', '2 h'],
							['Dementia care', 'Assessment', '12 months', '2 h'],
							['Night care', 'Plan review', '12 months', '1 h'],
						],
					},
				},
			],

			[
				'q3-revenue-summary.xlsx',
				'finance',
				{
					look: {
						total: 92,
						rows: [
							['Month', 'Hourly visits', 'Live-in care', 'Care packages'],
							['July', '$61,240', '$118,900', '$22,470'],
							['August', '$58,310', '$104,350', '$22,860'],
							['September', '$49,780', '$96,120', '$23,190'],
						],
					},
				},
			],
			[
				'sales-tax-return-q2.pdf',
				'finance',
				{
					look: {
						pages: 3,
						title: 'Sales tax return, April to June',
						blocks: [
							'Taxable sales and tax collected for the quarter, filed on July 28.',
							'Supplies sold to clients are taxed; the care itself is not.',
							'Receipts for every cost over $250 are in invoices-june.zip.',
						],
					},
				},
			],
			[
				'invoices-september.zip',
				'finance',
				{
					look: {
						entries: [
							['#2218.pdf', 88 * KIB],
							['#2219.pdf', 91 * KIB],
							['#2220.pdf', 86 * KIB],
							['#2221.pdf', 90 * KIB],
							['#2222.pdf', 87 * KIB],
							['#2223.pdf', 93 * KIB],
						],
					},
				},
			],
			[
				'fuel-cards.csv',
				'finance',
				{
					sharing: { with: [['guest:beck@ledgerlinebooks.com', 'view']], link: 'off' },
					look: {
						text: 'month,gallons,cost\nJuly,2180,$8197\nAugust,2265,$8516\nSeptember,2340,$8821',
						rows: [
							['month', 'gallons', 'cost'],
							['July', '2180', '$8197'],
							['August', '2265', '$8516'],
							['September', '2340', '$8821'],
						],
						total: 3,
					},
				},
			],

			[
				'carer-handbook.pdf',
				'team',
				{
					sharing: { with: [], link: 'team' },
					look: {
						pages: 24,
						title: 'Carer handbook',
						blocks: [
							"Welcome to Oakhaven. This handbook covers your car, the Fieldline app, safety, and how we treat a client's home.",
							'Start of day: check the schedule board, confirm your first visit, and restock from your kit list.',
							'End of day: close every visit with notes and a signature, and text the office if a visit runs over.',
						],
					},
				},
			],
			[
				'on-call-roster-october.xlsx',
				'team',
				{
					starred: true,
					look: {
						total: 31,
						rows: [
							['Day', 'Day shift', 'On call'],
							['Mon', 'Travis', 'Devon'],
							['Tue', 'Lance', 'Travis'],
							['Wed', 'Devon', 'Kayla'],
							['Thu', 'Kayla', 'Lance'],
							['Fri', 'Travis', 'Devon'],
						],
					},
				},
			],
			[
				'onboarding-checklist.md',
				'team',
				{
					look: {
						text: '# First week\n\n- [ ] Sign in to the Fieldline app and the drive\n- [ ] Shadow Travis on visits for two days\n- [ ] Walk the store room and learn your kit list\n- [ ] Read the carer handbook\n- [ ] Close your first visit with notes and photos',
					},
				},
			],
			['team-photo-2026.jpg', 'team', { look: { art: 'team', tone: 6, dims: '4000 × 2667' } }],
			[
				'fieldline-app-training.mp4',
				'team',
				{ look: { art: 'film', tone: 2, duration: '12:08', dims: '1920 × 1080' } },
			],

			[
				'package-clients-september.csv',
				'plans',
				{
					look: {
						text: 'package,clients,visits_due\nHome Basic,412,58\nHome Plus,388,71\nCare Home,146,39\nLive-in,57,22',
						rows: [
							['package', 'clients', 'visits_due'],
							['Home Basic', '412', '58'],
							['Home Plus', '388', '71'],
							['Care Home', '146', '39'],
							['Live-in', '57', '22'],
						],
						total: 4,
					},
				},
			],
			[
				'october-visit-schedule.md',
				'plans',
				{
					look: {
						text: '# October visits\n\nHome Basic: wellness check, medication review\nHome Plus: wellness check, medication review, falls check\nCare Home and Live-in: care plan, family update, GP letter\n\nBooking opens to package clients on October 6.',
					},
				},
			],
			[
				'renewal-reminder.txt',
				'plans',
				{
					look: {
						text: 'Subject: Your care package renews on {date}\n\nHi {first_name},\n\nYour {plan} package renews on {date}. Your fall visit is included, and you can book it from the customer portal now.\n\nWant to change packages? Reply to this email or call the office before the 8th.',
					},
				},
			],

			/* These sit in the trash already; binnedDaysAgo dates the deletion. */
			[
				'summer-respite-offer-2025.pdf',
				null,
				{
					binnedDaysAgo: 6,
					look: {
						pages: 1,
						title: 'Summer respite offer 2025',
						blocks: ['$89 respite day, lunch included, June to August.'],
					},
				},
			],
			[
				'car-sign-draft-v1.png',
				'mk-signs',
				{ binnedDaysAgo: 3, look: { art: 'label', tone: 1, dims: '1200 × 800' } },
			],
			[
				'price-list-2025.xlsx',
				'estimates',
				{
					binnedDaysAgo: 12,
					look: {
						total: 40,
						rows: [
							['Item', 'Unit', 'Price'],
							['Care visit, two hours', 'visit', '$119'],
						],
					},
				},
			],
			[
				'care-fair-stand-photos.zip',
				'mk-show',
				{
					look: {
						entries: [
							['stand-front.jpg', 3.1 * MIB],
							['leaflet-table.jpg', 2.8 * MIB],
						],
					},
				},
			],
			[
				'care-fair-stand-costs.csv',
				'mk-show',
				{
					look: {
						text: 'item,cost\nStand space,$450\nBanner stand,$85\nFlyers,$60',
						rows: [
							['item', 'cost'],
							['Stand space', '$450'],
							['Banner stand', '$85'],
							['Flyers', '$60'],
						],
						total: 3,
					},
				},
			],
		],
	};

	/*
	 * Every server call the page makes. Each returns a promise; the demo
	 * ones only pause and then resolve. The comment beside a stub names
	 * the request a real backend would answer.
	 */
	const server = {
		fetchDrive() {
			if (demoMode !== 'error') return pause(450, SAMPLE);
			return pause(500).then(() => Promise.reject(new Error('The server did not answer')));
		},
		/*
		 * Streams one file, reporting bytes sent as it goes, and resolves with
		 * the stored id. The handle can hold, release or stop the transfer.
		 */
		sendFile(file, folderId, reportBytes) {
			return demoTransfer(file, reportBytes);
		},
		addFolder: (name, parentId) => pause(150) /* POST /api/folders */,
		renameEntry: (id, name) => pause(150) /* PATCH /api/items/:id */,
		relocate: (ids, parentId) => pause(150) /* POST /api/items/move */,
		setStar: (id, starred) => pause(100) /* PUT or DELETE /api/items/:id/star */,
		binEntries: (ids) => pause(150) /* POST /api/items/trash */,
		unbinEntries: (ids) => pause(150) /* POST /api/items/restore */,
		purgeEntries: (ids) => pause(200) /* DELETE /api/items, permanently */,
		saveSharing: (id, sharing) => pause(200) /* PUT /api/items/:id/sharing */,
		prepareDownload: (ids) => pause(900) /* a signed link, or one zip for several */,
	};

	/* File endings mapped to a family (icon tint and type filter), an icon and a spoken label. */
	const KINDS = {};
	for (const [endings, group, glyph, label] of [
		['folder', 'folder', 'bi-folder-fill', 'Folder'],
		['pdf', 'pdf', 'bi-file-earmark-pdf', 'PDF'],
		['docx doc', 'doc', 'bi-file-earmark-word', 'Word document'],
		['md', 'doc', 'bi-file-earmark-text', 'Markdown'],
		['txt', 'doc', 'bi-file-earmark-text', 'Text'],
		['xlsx xls', 'sheet', 'bi-file-earmark-spreadsheet', 'Spreadsheet'],
		['csv', 'sheet', 'bi-filetype-csv', 'CSV'],
		['jpg jpeg', 'image', 'bi-file-earmark-image', 'JPEG image'],
		['png', 'image', 'bi-file-earmark-image', 'PNG image'],
		['gif', 'image', 'bi-file-earmark-image', 'GIF image'],
		['webp', 'image', 'bi-file-earmark-image', 'WebP image'],
		['svg', 'image', 'bi-file-earmark-image', 'SVG image'],
		['mp4 mov', 'video', 'bi-file-earmark-play', 'Video'],
		['zip', 'archive', 'bi-file-earmark-zip', 'Zip archive'],
	]) {
		for (const ending of endings.split(' ')) KINDS[ending] = { group, glyph, label };
	}
	const UNKNOWN_KIND = { group: 'other', glyph: 'bi-file-earmark', label: 'File' };
	const REFUSED_ENDINGS = new Set('exe bat cmd msi scr com'.split(' '));
	const READABLE_ENDINGS = new Set(['md', 'txt', 'csv']);
	const SIZE_RANGE = {
		image: [1.2 * MIB, 6.5 * MIB],
		pdf: [180 * KIB, 4.2 * MIB],
		doc: [2 * KIB, 420 * KIB],
		sheet: [12 * KIB, 900 * KIB],
		video: [240 * MIB, 1.6 * GIB],
		archive: [40 * MIB, 620 * MIB],
		other: [10 * KIB, 2 * MIB],
	};

	/* A heading for each place, and the places whose entries come from many folders. */
	const PLACE_TITLES = { root: 'All files', recent: 'Recent', starred: 'Starred', shared: 'Shared', trash: 'Trash' };
	const FLAT_PLACES = ['recent', 'starred', 'shared', 'trash'];
	const SORTERS = {
		name: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
		modified: (a, b) => b.modified - a.modified,
		size: (a, b) => weight(b) - weight(a),
	};
	/* Storage bar slices: [family key, legend label, tone]. */
	const STORAGE_SLICES = [
		['video', 'Videos', 1],
		['image', 'Images', 2],
		['docs', 'Documents', 3],
		['sheet', 'Spreadsheets', 4],
		['archive', 'Archives', 5],
		['other', 'Other', 6],
	];
	const LINK_HINTS = {
		off: 'Only the people above can open the link. Anyone else is asked to sign in and request access.',
		team: 'Anyone signed in to the company drive can open the link and view it.',
		anyone: 'Anyone who has the link can view it without signing in. Good for customers and suppliers.',
	};
	const LINK_BADGES = {
		off: { text: 'Only people added', glyph: 'bi-lock', tone: 'primary' },
		team: { text: 'Anyone on the team', glyph: 'bi-shop', tone: 'info' },
		anyone: { text: 'Anyone with the link', glyph: 'bi-globe2', tone: 'warning' },
	};
	const LINK_SUMMARY = { off: 'for those people only', team: 'open to the team', anyone: 'open to anyone' };
	const PARALLEL_UPLOADS = 2;
	const VIEW_KEY = 'basalt-drive-view';
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Everything on screen is drawn from these two: the entries and the view. */
	const entries = new Map();
	const ui = {
		place: 'root',
		folderId: null,
		query: '',
		typeFilter: 'all',
		sortKey: 'name',
		layout: readPref(VIEW_KEY) === 'list' ? 'list' : 'grid',
		picked: new Set(),
		focusId: null,
		loading: true,
		failure: null,
		sheetId: null,
		order: [],
		savedSort: null,
	};
	const dom = {
		list: pick('[data-drv-items]'),
		empty: pick('[data-drv-empty]'),
		head: pick('[data-drv-list-head]'),
		hint: pick('[data-drv-hint]'),
		crumbs: pick('[data-drv-crumbs]'),
		title: pick('[data-drv-view-title]'),
		tally: pick('[data-drv-count-line]'),
		search: pick('[data-drv-search]'),
		typeSelect: pick('[data-drv-type]'),
		sortSelect: pick('[data-drv-sort]'),
		bulk: pick('[data-drv-bulk]'),
		bulkTally: pick('[data-drv-bulk-count]'),
		trashNote: pick('[data-drv-trash-note]'),
		places: pick('[data-drv-places]'),
		treeHost: pick('[data-drv-tree-host]'),
		dropZone: pick('[data-drv-drop]'),
		dropLabel: pick('[data-drv-drop-label]'),
		picker: pick('[data-drv-file-input]'),
		menu: pick('#drv-menu'),
		sheet: pick('#drv-sheet'),
		side: pick('#drv-side'),
	};
	const tray = {
		box: pick('[data-drv-queue]'),
		list: pick('[data-drv-queue-list]'),
		heading: pick('[data-drv-queue-title]'),
		detail: pick('[data-drv-queue-sub]'),
		ring: pick('[data-drv-queue-ring]'),
		percent: pick('[data-drv-queue-pct]'),
		fold: pick('[data-drv-queue-toggle]'),
		sweep: pick('[data-drv-queue-clear]'),
	};
	const folderForm = pick('[data-drv-folder-form]');
	const folderField = pick('#drv-folder-name');
	const renameForm = pick('[data-drv-rename-form]');
	const renameField = pick('#drv-rename-name');
	const moveButton = pick('[data-drv-move-go]');
	const shareList = pick('[data-drv-share-people]');
	const shareField = pick('#drv-share-who');
	const linkMode = pick('[data-drv-share-link-mode]');

	let sideTree = pick('[data-drv-tree]');
	let moveTree = pick('[data-drv-move-tree]');
	const expanded = new Set();
	const uploads = [];
	let searchDelay = 0;
	let rangeAnchor = null;
	let menuTargets = [];
	let purgeTargets = [];
	let restoreFocusTo = null;
	let renamingId = null;
	let moving = [];
	let moveDestination;
	let sharingId = null;
	let pendingShare = null;

	/** Binds every control once, then fetches the drive. */
	function start() {
		wireNavigation();
		wireToolbar();
		wireRows();
		wireMenus();
		wireDialogs();
		wireSheet();
		wireUploads();
		dom.typeSelect.value = ui.typeFilter;
		dom.sortSelect.value = ui.sortKey;
		loadDrive();
	}

	/* Fetching the drive and turning its payload into entries. */

	function loadDrive() {
		ui.loading = true;
		ui.failure = null;
		drawRows();
		drawPath();
		server
			.fetchDrive()
			.then((payload) => {
				ingest(payload);
				syncFromHash();
				ui.loading = false;
				redraw({ tree: true });
			})
			.catch((problem) => {
				ui.loading = false;
				ui.failure = problem;
				drawRows();
				drawPath();
				say('The drive did not load.');
			});
	}

	/**
	 * Fills `entries` from a payload. Sizes, dates and owners come from a
	 * seeded sequence, drawn in a fixed order so the demo never shifts.
	 */
	function ingest(payload) {
		entries.clear();
		const roll = makeDice(20260930);
		const owners = payload.people.map((member) => member.id);
		const anyOwner = () => owners[Math.floor(roll() * owners.length)];
		const sharingFrom = (spec) => ({
			people: spec ? spec.with.map(([id, role]) => ({ id, role })) : [],
			link: spec ? spec.link : 'off',
			token: Math.floor(roll() * 1e12).toString(36),
		});

		for (const [id, name, parent, extra = {}] of payload.folders) {
			const age = 40 + Math.floor(roll() * 300);
			const owner = anyOwner();
			const modified = daysBefore(Math.floor(roll() * 30), 9 + Math.floor(roll() * 8));
			entries.set(id, {
				id,
				kind: 'folder',
				name,
				parent,
				owner,
				size: 0,
				created: daysBefore(age),
				modified,
				starred: false,
				trashed: extra.binnedDaysAgo ? daysBefore(extra.binnedDaysAgo, 16) : null,
				share: sharingFrom(extra.sharing),
				activity: [],
			});
		}

		payload.files.forEach(([name, parent, extra], position) => {
			const id = `f${position + 1}`;
			const [smallest, largest] = SIZE_RANGE[kindOfName(name).group] || SIZE_RANGE.other;
			/* Squaring the draw leans ages toward recent, as on a busy drive. */
			const draw = roll();
			const age = Math.floor(draw * draw * 75);
			const modified = daysBefore(age, 8 + Math.floor(roll() * 10), Math.floor(roll() * 60));
			const created = daysBefore(age + 3 + Math.floor(roll() * 60));
			const owner = anyOwner();
			const editor = roll() < 0.5 ? owner : anyOwner();
			const look = extra.look || {};
			const size = look.text ? look.text.length + 40 : Math.round(smallest + roll() * (largest - smallest));
			const activity = [{ who: owner, what: 'uploaded it', when: created }];
			if (modified > created) activity.unshift({ who: editor, what: 'changed it', when: modified });
			entries.set(id, {
				id,
				kind: 'file',
				name,
				parent,
				owner,
				size,
				created,
				modified,
				starred: !!extra.starred,
				trashed: extra.binnedDaysAgo ? daysBefore(extra.binnedDaysAgo, 15) : null,
				share: sharingFrom(extra.sharing),
				preview: look,
				activity,
			});
		});

		/* A folder reads as changed whenever anything inside it changed. */
		for (const entry of entries.values()) {
			if (entry.kind !== 'file' || !entry.parent) continue;
			for (let folder = entries.get(entry.parent); folder; folder = entries.get(folder.parent)) {
				if (entry.modified > folder.modified) folder.modified = entry.modified;
			}
		}
	}

	/** Mulberry32: a tiny repeatable random source. */
	function makeDice(seed) {
		let cursor = seed >>> 0;
		return () => {
			cursor = (cursor + 0x6d2b79f5) >>> 0;
			let mix = Math.imul(cursor ^ (cursor >>> 15), cursor | 1);
			mix ^= mix + Math.imul(mix ^ (mix >>> 7), mix | 61);
			return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
		};
	}

	/** The demo's upload: bytes trickle in on a timer, at most about five seconds per file. */
	function demoTransfer(file, reportBytes) {
		const perSecond = Math.max(file.size / 5, 900 * KIB);
		let bytesSent = 0;
		let held = false;
		let ticker = 0;
		let abort = null;
		const promise = new Promise((finish, fail) => {
			abort = fail;
			let previousTick = performance.now();
			ticker = setInterval(() => {
				const tick = performance.now();
				const elapsed = tick - previousTick;
				previousTick = tick;
				if (held) return;
				bytesSent = Math.min(file.size, bytesSent + (perSecond * elapsed) / 1000);
				reportBytes(bytesSent);
				if (bytesSent < file.size) return;
				clearInterval(ticker);
				finish(`u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
			}, 120);
		});
		return {
			promise,
			hold() {
				held = true;
			},
			release() {
				held = false;
			},
			stop() {
				clearInterval(ticker);
				abort(new Error('canceled'));
			},
		};
	}

	/* Questions asked of the entry map: what is inside, what is trashed, what a name collides with. */

	function kidsOf(parentId) {
		return [...entries.values()].filter((entry) => entry.parent === parentId);
	}

	/** True when the entry, or any folder above it, is in the trash. */
	function inTrash(entry) {
		for (let step = entry; step; step = entries.get(step.parent)) {
			if (step.trashed) return true;
		}
		return false;
	}

	function visibleEntries() {
		return [...entries.values()].filter((entry) => !inTrash(entry));
	}

	/** Folders from the top level down to `id`, itself included. */
	function trail(id) {
		const chain = [];
		for (let folder = entries.get(id); folder; folder = entries.get(folder.parent)) chain.unshift(folder);
		return chain;
	}

	function folderLabel(id) {
		return id ? entries.get(id).name : 'All files';
	}

	function allInside(folderId) {
		return kidsOf(folderId).flatMap((kid) => (kid.kind === 'folder' ? [kid, ...allInside(kid.id)] : [kid]));
	}

	/** A file's own size, or the sum of every file a folder holds. */
	function weight(entry) {
		if (entry.kind !== 'folder') return entry.size;
		return allInside(entry.id).reduce((sum, inner) => (inner.kind === 'file' ? sum + inner.size : sum), 0);
	}

	function isOpenToOthers(entry) {
		return entry.share.link !== 'off' || entry.share.people.length > 0;
	}

	function siblingNames(parentId, ignoreId) {
		return kidsOf(parentId)
			.filter((kid) => kid.id !== ignoreId && !kid.trashed)
			.map((kid) => kid.name.toLowerCase());
	}

	function clashes(name, parentId, ignoreId) {
		return siblingNames(parentId, ignoreId).includes(name.toLowerCase());
	}

	/** `name`, or "name (2).ext" and up when the folder already holds it. */
	function freeName(name, parentId, ignoreId) {
		const used = new Set(siblingNames(parentId, ignoreId));
		if (!used.has(name.toLowerCase())) return name;
		const dot = name.lastIndexOf('.');
		const [stem, tail] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
		let copy = 2;
		while (used.has(`${stem} (${copy})${tail}`.toLowerCase())) copy += 1;
		return `${stem} (${copy})${tail}`;
	}

	function endingOf(name) {
		const dot = name.lastIndexOf('.');
		return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
	}

	function kindOfName(name) {
		return KINDS[endingOf(name)] || UNKNOWN_KIND;
	}

	function kindOf(entry) {
		return entry.kind === 'folder' ? KINDS.folder : kindOfName(entry.name);
	}

	function memberById(id) {
		if (id && id.startsWith('guest:')) {
			const email = id.slice(6);
			return { id, name: email, email, job: 'Guest', guest: true };
		}
		return SAMPLE.people.find((member) => member.id === id) || { id, name: 'Someone', email: '' };
	}

	function displayName(id) {
		return id === SAMPLE.viewer ? 'You' : memberById(id).name;
	}

	function searching() {
		return ui.query.trim() !== '';
	}

	/** Where an upload or a new folder lands from the current view. */
	function uploadTarget() {
		return ui.place === 'folder' && !ui.query ? ui.folderId : null;
	}

	function currentFolderMark() {
		return ui.place === 'folder' && !searching() ? ui.folderId : null;
	}

	/** The entries for the current view, filtered and in display order. */
	function currentRows() {
		let rows = gatherRows(ui.query.trim().toLowerCase());
		if (ui.typeFilter !== 'all') rows = rows.filter((entry) => kindOf(entry).group === ui.typeFilter);
		if (ui.place === 'trash') return rows.sort((a, b) => b.trashed - a.trashed);
		const compare = SORTERS[ui.sortKey];
		return rows.sort((a, b) => {
			if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
			return compare(a, b);
		});
	}

	function gatherRows(needle) {
		if (ui.place === 'trash') {
			return [...entries.values()].filter((entry) => {
				const holder = entries.get(entry.parent);
				return entry.trashed && !(holder && inTrash(holder));
			});
		}
		const pool = visibleEntries();
		if (needle) return pool.filter((entry) => entry.name.toLowerCase().includes(needle));
		if (ui.place === 'recent')
			return pool
				.filter((entry) => entry.kind === 'file')
				.sort(SORTERS.modified)
				.slice(0, 24);
		if (ui.place === 'starred') return pool.filter((entry) => entry.starred);
		if (ui.place === 'shared') return pool.filter(isOpenToOthers);
		const holderId = ui.place === 'folder' ? ui.folderId : null;
		return pool.filter((entry) => entry.parent === holderId);
	}

	/* Painting the page from `entries` and `ui`. */

	/** Redraws the whole page; `tree: true` also rebuilds the folder tree. */
	function redraw(options) {
		drawPath();
		drawPlaces();
		if (options?.tree) rebuildSideTree();
		else markTreeCurrent();
		drawRows();
		drawBulkBar();
		drawStorage();
		if (!ui.sheetId || !sheetVisible()) return;
		const shown = entries.get(ui.sheetId);
		if (shown) fillSheet(shown);
		else closeSheet();
	}

	function drawRows() {
		const list = dom.list;
		list.classList.toggle('drv-items-grid', ui.layout === 'grid');
		list.classList.toggle('drv-items-list', ui.layout === 'list');
		list.classList.toggle('is-flat', searching() || FLAT_PLACES.includes(ui.place));
		dom.head.hidden = ui.layout !== 'list' || ui.loading || !!ui.failure;

		if (ui.loading) {
			list.setAttribute('aria-busy', 'true');
			list.innerHTML = PLACEHOLDER_ROW.repeat(8);
			dom.empty.hidden = true;
			dom.tally.textContent = 'Loading files…';
			return;
		}
		list.setAttribute('aria-busy', 'false');
		if (ui.failure) {
			list.innerHTML = '';
			dom.empty.innerHTML = emptyMarkup('error');
			dom.empty.hidden = false;
			dom.hint.hidden = true;
			dom.tally.textContent = '';
			return;
		}

		const rows = currentRows();
		ui.order = rows.map((entry) => entry.id);
		if (!ui.order.includes(ui.focusId)) ui.focusId = ui.order[0] || null;
		/* The first file after a run of folders gets a class that starts a new grid line. */
		const breakAt = rows[0]?.kind === 'folder' ? rows.find((entry) => entry.kind === 'file') : null;
		list.innerHTML = rows.map((entry) => rowMarkup(entry, entry === breakAt)).join('');
		for (const entry of rows) delete entry.fresh;
		if (window.Basalt.avatars) {
			window.Basalt.avatars(list);
		} else {
			for (const mark of pickAll('[data-basalt-avatar]', list)) {
				if (window.Basalt.avatar) window.Basalt.avatar(mark);
			}
		}
		list.classList.toggle('has-selection', ui.picked.size > 0);

		const reason = rows.length ? null : emptyReason();
		dom.empty.hidden = !reason;
		dom.empty.innerHTML = reason ? emptyMarkup(reason) : '';
		dom.head.hidden = ui.layout !== 'list' || !rows.length;
		dom.hint.hidden = !rows.length;
		dom.tally.textContent = tallyLine(rows);
	}

	function emptyReason() {
		if (searching()) return 'search';
		if (ui.typeFilter !== 'all') return 'type';
		return ui.place === 'folder' || ui.place === 'root' ? 'folder' : ui.place;
	}

	function tallyLine(rows) {
		if (searching()) return `${count(rows.length, 'result')} for “${ui.query.trim()}”`;
		if (!rows.length) return 'Nothing here';
		const folders = rows.filter((entry) => entry.kind === 'folder').length;
		const files = rows.length - folders;
		return [folders && count(folders, 'folder'), files && count(files, 'file')].filter(Boolean).join(', ');
	}

	/** Breadcrumb, view heading, drop-zone label and the trash note. */
	function drawPath() {
		let title;
		let crumbs;
		if (searching()) {
			title = 'Search results';
			crumbs = crumbMarkup('All files', 'root') + crumbMarkup(title, '', true);
		} else if (ui.place === 'folder') {
			const chain = trail(ui.folderId);
			title = chain[chain.length - 1].name;
			crumbs =
				crumbMarkup('All files', 'root') +
				chain
					.map((folder, at) => crumbMarkup(folder.name, `folder:${folder.id}`, at === chain.length - 1))
					.join('');
		} else {
			title = PLACE_TITLES[ui.place];
			crumbs = crumbMarkup(title, ui.place, true);
		}
		dom.crumbs.innerHTML = crumbs;
		dom.title.textContent = title;
		dom.dropLabel.textContent = `Drop to upload to ${folderLabel(uploadTarget())}`;
		dom.trashNote.hidden = ui.place !== 'trash' || ui.loading || !currentRows().length;
	}

	function crumbMarkup(label, target, current = false) {
		if (current)
			return `<li aria-current="page" class="breadcrumb-item active"><span>${htmlSafe(label)}</span></li>`;
		return `<li class="breadcrumb-item"><button data-drv-go="${target}" type="button" class="drv-crumb">${htmlSafe(label)}</button></li>`;
	}

	/** Lights the current place in the side list and refreshes its counters. */
	function drawPlaces() {
		for (const link of pickAll('[data-drv-place]', dom.places)) {
			if (!searching() && link.dataset.drvPlace === ui.place) link.setAttribute('aria-current', 'page');
			else link.removeAttribute('aria-current');
		}
		const showing = visibleEntries();
		const totals = {
			starred: showing.filter((entry) => entry.starred).length,
			shared: showing.filter(isOpenToOthers).length,
			trash: [...entries.values()].filter((entry) => entry.trashed).length,
		};
		for (const [place, total] of Object.entries(totals)) {
			pick(`[data-drv-count="${place}"]`, dom.places).textContent = total || '';
		}
	}

	function drawBulkBar() {
		const picked = ui.picked.size;
		const trashView = ui.place === 'trash';
		dom.bulk.hidden = !picked;
		dom.bulkTally.textContent = `${count(picked, 'item')} selected`;
		for (const button of pickAll('[data-drv-bulk]', dom.bulk)) {
			const action = button.dataset.drvBulk;
			if (action === 'clear') continue;
			const trashOnly = action === 'restore' || action === 'destroy';
			button.hidden = trashView !== trashOnly;
		}
	}

	/** Storage card: the stacked bar, its legend, the trash line and the three figures. */
	function drawStorage() {
		const totals = { video: 0, image: 0, docs: 0, sheet: 0, archive: 0, other: 0 };
		let binned = 0;
		for (const entry of entries.values()) {
			if (entry.kind !== 'file') continue;
			const family = kindOf(entry).group;
			let slot = 'other';
			if (family === 'doc' || family === 'pdf') slot = 'docs';
			else if (totals[family] != null) slot = family;
			totals[slot] += entry.size;
			if (inTrash(entry)) binned += entry.size;
		}
		const used = Object.values(totals).reduce((sum, bytes) => sum + bytes, 0);
		const share = (used / SAMPLE.capacity) * 100;
		const slices = STORAGE_SLICES.filter(([key]) => totals[key]);

		pick('[data-drv-storage-total]').textContent = `${byteLabel(used)} of ${byteLabel(SAMPLE.capacity)}`;
		const bar = pick('[data-drv-storage-bar]');
		bar.innerHTML = slices
			.map(
				([key, , tone]) =>
					`<span style="width:${((totals[key] / SAMPLE.capacity) * 100).toFixed(2)}%" class="drv-tone-${tone}"></span>`,
			)
			.join('');
		bar.setAttribute(
			'aria-label',
			`${Math.round(share)}% of the drive used: ${slices.map(([key, label]) => `${label} ${byteLabel(totals[key])}`).join(', ')}`,
		);
		pick('[data-drv-storage-legend]').innerHTML = slices
			.map(
				([key, label, tone]) =>
					`<li><span aria-hidden="true" class="drv-swatch drv-tone-${tone}"></span><span>${label}</span><span class="drv-storage-num">${byteLabel(totals[key])}</span></li>`,
			)
			.join('');
		pick('[data-drv-storage-trash]').innerHTML = binned
			? `The trash holds ${byteLabel(binned)}. <button data-drv-go="trash" type="button" class="btn btn-link drv-link">Open the trash</button>`
			: 'The trash is empty.';

		const showing = visibleEntries();
		pick('[data-drv-fig="used"]').textContent = `${share < 10 ? share.toFixed(1) : Math.round(share)}%`;
		pick('[data-drv-fig="files"]').textContent = showing.filter((entry) => entry.kind === 'file').length;
		pick('[data-drv-fig="shared"]').textContent = showing.filter(isOpenToOthers).length;
	}

	/* Markup strings for rows, tiles, pictures and empty states. */

	const PLACEHOLDER_ROW =
		'<li aria-hidden="true" class="drv-item drv-item-skeleton"><span class="basalt-skeleton basalt-skeleton-block drv-skel-thumb"></span><span class="basalt-skeleton basalt-skeleton-text"></span><span class="basalt-skeleton basalt-skeleton-text basalt-skeleton-sm drv-skel-short"></span></li>';

	/** One entry as a grid tile or list row; both layouts share the markup. */
	function rowMarkup(entry, breaksLine) {
		const picked = ui.picked.has(entry.id);
		const kind = kindOf(entry);
		const shared = isOpenToOthers(entry);
		const name = htmlSafe(entry.name);
		const states = [picked && 'is-selected', breaksLine && 'is-first-file', entry.fresh && 'is-fresh']
			.filter(Boolean)
			.map((flag) => ` ${flag}`)
			.join('');
		const spoken = [
			entry.kind === 'folder' ? 'Folder' : kind.label,
			entry.starred && 'starred',
			shared && 'shared',
			picked && 'selected',
		]
			.filter(Boolean)
			.join(', ');
		const visual =
			entry.kind === 'folder'
				? glyphBadge(entry)
				: `<span class="drv-item-visual">${tilePicture(entry)}${glyphBadge(entry)}</span>`;
		const marks =
			(entry.starred
				? '<i aria-hidden="true" title="Starred" class="bi bi-star-fill drv-flag drv-flag-star"></i>'
				: '') + (shared ? '<i aria-hidden="true" title="Shared" class="bi bi-people-fill drv-flag"></i>' : '');
		const when = ui.place === 'trash' ? entry.trashed : entry.modified;
		const metaId = `drv-item-${entry.id}-meta`;
		return (
			`<li tabindex="-1" data-id="${entry.id}" class="drv-item drv-item-${entry.kind}${states}">` +
			`<input tabindex="-1" type="checkbox" aria-label="Select ${name}" class="form-check-input drv-item-check"${picked ? ' checked' : ''}>${
				visual
			}<span class="drv-item-text"><button aria-describedby="${metaId}" tabindex="${ui.focusId === entry.id ? '0' : '-1'}" type="button" class="drv-item-open"><span class="drv-item-name">${name}</span></button>` +
			`<span id="${metaId}" class="drv-item-meta"><span class="visually-hidden">${htmlSafe(spoken)}. </span>${htmlSafe(subline(entry))}</span></span>` +
			`<span class="drv-item-owner">${avatarMark(entry.owner)}<span>${htmlSafe(displayName(entry.owner))}</span></span>` +
			`<span class="drv-item-date">${htmlSafe(whenText(when))}</span>` +
			`<span class="drv-item-size">${entry.kind === 'folder' ? '' : htmlSafe(byteLabel(entry.size))}</span>` +
			`<span class="drv-item-flags">${marks}</span>` +
			`<button aria-label="Actions for ${name}" tabindex="-1" type="button" class="drv-item-more"><i aria-hidden="true" class="bi bi-three-dots-vertical"></i></button></li>`
		);
	}

	/** The gray line under a name: size and date, a folder's count, and the folder when listing across folders. */
	function subline(entry) {
		const bits = [];
		if (ui.place === 'trash') {
			bits.push(`Deleted ${whenText(entry.trashed)}`);
		} else if (entry.kind === 'folder') {
			const held = kidsOf(entry.id).filter((kid) => !kid.trashed).length;
			bits.push(held ? count(held, 'item') : 'Empty');
		} else {
			bits.push(byteLabel(entry.size), whenText(entry.modified));
		}
		if (searching() || FLAT_PLACES.includes(ui.place))
			bits.push(`in ${entry.parent ? entries.get(entry.parent).name : 'All files'}`);
		return bits.join(' · ');
	}

	/** The top of a grid tile: an upload's own photo, demo art, or a page with the type icon. */
	function tilePicture(entry) {
		const kind = kindOf(entry);
		const look = entry.preview || {};
		if (entry.blob && kind.group === 'image') {
			return `<span class="drv-thumb drv-thumb-photo"><img loading="lazy" alt="" src="${htmlSafe(entry.blob)}"></span>`;
		}
		if (look.art) {
			const badge =
				kind.group === 'video'
					? `<span class="drv-thumb-badge"><i aria-hidden="true" class="bi bi-play-fill"></i>${htmlSafe(look.duration || '')}</span>`
					: '';
			return `<span class="drv-thumb drv-thumb-photo">${artMarkup(look.art, look.tone)}${badge}</span>`;
		}
		return `<span class="drv-thumb drv-g-${kind.group}"><span aria-hidden="true" class="drv-thumb-page">${'<span></span>'.repeat(4)}</span><i aria-hidden="true" class="bi ${kind.glyph} drv-thumb-icon"></i></span>`;
	}

	function glyphBadge(entry) {
		const kind = kindOf(entry);
		return `<span aria-hidden="true" class="drv-ico drv-g-${kind.group}"><i class="bi ${kind.glyph}"></i></span>`;
	}

	function avatarMark(id, size = 'basalt-avatar-xs') {
		return `<span data-name="${htmlSafe(memberById(id).name)}" data-basalt-avatar aria-hidden="true" class="basalt-avatar ${size}"></span>`;
	}

	/*
	 * Flat drawings standing in for the demo's photos and videos. A real
	 * drive shows <img> tags here, as uploads already do.
	 */
	const ART = {
		vehicle:
			'<path d="M20 46h78l22 20h20v28H20z" class="drv-art-a"/><path d="M102 52h12l14 14h-26z" class="drv-art-paper"/><rect x="30" y="56" width="52" height="14" rx="3" class="drv-art-paper"/><rect x="36" y="61" width="34" height="4" rx="2" class="drv-art-ink"/><circle cx="46" cy="96" r="10" class="drv-art-deep"/><circle cx="114" cy="96" r="10" class="drv-art-deep"/><circle cx="46" cy="96" r="4" class="drv-art-paper"/><circle cx="114" cy="96" r="4" class="drv-art-paper"/>',
		unit: '<rect x="40" y="94" width="80" height="6" rx="3" class="drv-art-deep"/><rect x="44" y="28" width="72" height="66" rx="5" class="drv-art-a"/><circle cx="80" cy="58" r="22" class="drv-art-paper"/><circle cx="80" cy="58" r="5" class="drv-art-deep"/><path d="M80 40v36M62 58h36" class="drv-art-line"/><rect x="52" y="84" width="28" height="4" rx="2" class="drv-art-mute"/>',
		panel: '<rect x="50" y="18" width="60" height="86" rx="5" class="drv-art-a"/><rect x="58" y="28" width="44" height="66" rx="3" class="drv-art-paper"/><rect x="64" y="36" width="14" height="6" rx="2" class="drv-art-deep"/><rect x="82" y="36" width="14" height="6" rx="2" class="drv-art-deep"/><rect x="64" y="48" width="14" height="6" rx="2" class="drv-art-deep"/><rect x="82" y="48" width="14" height="6" rx="2" class="drv-art-deep"/><rect x="64" y="60" width="14" height="6" rx="2" class="drv-art-deep"/><rect x="82" y="60" width="14" height="6" rx="2" class="drv-art-deep"/><rect x="64" y="76" width="32" height="4" rx="2" class="drv-art-mute"/>',
		device: '<rect x="46" y="20" width="68" height="84" rx="10" class="drv-art-deep"/><rect x="54" y="30" width="52" height="62" rx="4" class="drv-art-paper"/><rect x="60" y="38" width="40" height="12" rx="3" class="drv-art-a"/><rect x="60" y="58" width="30" height="4" rx="2" class="drv-art-ink"/><rect x="60" y="68" width="22" height="4" rx="2" class="drv-art-mute"/><circle cx="80" cy="98" r="3" class="drv-art-a"/>',
		meter: '<circle cx="80" cy="60" r="38" class="drv-art-a"/><circle cx="80" cy="60" r="30" class="drv-art-paper"/><path d="M58 74a24 24 0 1 1 44 0" class="drv-art-line"/><path d="M80 60l14-16" class="drv-art-line"/><circle cx="80" cy="60" r="5" class="drv-art-deep"/><rect x="74" y="96" width="12" height="14" rx="2" class="drv-art-deep"/>',
		banner: '<circle cx="118" cy="38" r="14" class="drv-art-paper"/><path d="M0 92l36-28 26 18 30-30 30 26 38-22v64H0z" class="drv-art-a"/><path d="M0 104l44-20 34 14 40-18 42 16v24H0z" class="drv-art-deep"/><rect x="18" y="22" width="56" height="8" rx="4" class="drv-art-paper"/><rect x="18" y="36" width="38" height="5" rx="2.5" class="drv-art-mute"/>',
		team: '<circle cx="54" cy="52" r="12" class="drv-art-a"/><circle cx="80" cy="46" r="13" class="drv-art-deep"/><circle cx="106" cy="52" r="12" class="drv-art-a"/><path d="M34 96c0-14 9-24 20-24s20 10 20 24z" class="drv-art-a"/><path d="M58 96c0-16 10-28 22-28s22 12 22 28z" class="drv-art-deep"/><path d="M86 96c0-14 9-24 20-24s20 10 20 24z" class="drv-art-a"/>',
		label: '<rect x="34" y="30" width="92" height="60" rx="8" class="drv-art-paper"/><rect x="44" y="40" width="72" height="12" rx="3" class="drv-art-a"/><rect x="44" y="60" width="50" height="5" rx="2.5" class="drv-art-ink"/><rect x="44" y="72" width="36" height="4" rx="2" class="drv-art-mute"/>',
		film: '<circle cx="112" cy="36" r="10" class="drv-art-paper"/><path d="M0 96l40-34 30 22 34-30 56 42v24H0z" class="drv-art-a"/><path d="M0 110l50-18 40 10 70-14v32H0z" class="drv-art-deep"/>',
	};

	function artMarkup(scene, tone) {
		return `<svg aria-hidden="true" focusable="false" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" class="drv-art drv-tone-${tone || 1}"><rect width="160" height="120" class="drv-art-bg"/>${ART[scene] || ART.label}</svg>`;
	}

	/*
	 * Copy for each reason a listing can come up empty. Entries are
	 * functions so the search and type wording reads the current view.
	 */
	const EMPTY_COPY = {
		error: () => ({
			tone: 'danger',
			glyph: 'bi-cloud-slash',
			title: 'The drive did not load',
			text: 'The server did not answer. Your files are safe; this only affects what you can see here.',
			actions:
				'<button data-drv-retry type="button" class="btn btn-sm btn-primary"><i aria-hidden="true" class="bi bi-arrow-clockwise me-1"></i>Try again</button>',
		}),
		folder: () => ({
			glyph: 'bi-folder2-open',
			title: 'This folder is empty',
			text: 'Drop files here to upload them, or make a folder inside it.',
			actions:
				'<button data-drv-upload type="button" class="btn btn-sm btn-primary"><i aria-hidden="true" class="bi bi-cloud-arrow-up me-1"></i>Upload files</button><button data-drv-new-folder type="button" class="btn btn-sm btn-outline-secondary"><i aria-hidden="true" class="bi bi-folder-plus me-1"></i>New folder</button>',
		}),
		search: () => {
			const typed = ui.typeFilter !== 'all';
			return {
				glyph: 'bi-search',
				title: `Nothing called “${htmlSafe(ui.query.trim())}”`,
				text: `Search looks at file and folder names in every folder. Check the spelling${typed ? ', or show every type' : ''}.`,
				actions: `<button data-drv-clear-search type="button" class="btn btn-sm btn-outline-secondary">Clear the search</button>${typed ? SHOW_EVERY_TYPE : ''}`,
			};
		},
		type: () => ({
			glyph: 'bi-funnel',
			title: `No ${htmlSafe(pick(`option[value="${ui.typeFilter}"]`, dom.typeSelect).textContent.trim().toLowerCase())} here`,
			text: 'Nothing of that type is in this view.',
			actions: SHOW_EVERY_TYPE,
		}),
		starred: () => ({
			glyph: 'bi-star',
			title: 'Nothing starred yet',
			text: 'Star the files you open most and they wait for you here. Right-click a file and choose Add star.',
		}),
		shared: () => ({
			glyph: 'bi-people',
			title: 'Nothing is shared yet',
			text: 'Files you share with people, or by link, are listed here.',
		}),
		trash: () => ({
			tone: 'success',
			glyph: 'bi-trash3',
			title: 'The trash is empty',
			text: 'Deleted files stay here for 30 days, so you can put them back, before they go for good.',
		}),
		recent: () => ({
			glyph: 'bi-clock-history',
			title: 'Nothing opened lately',
			text: 'Files you and the team change show up here, newest first.',
		}),
	};
	const SHOW_EVERY_TYPE =
		'<button data-drv-clear-type type="button" class="btn btn-sm btn-outline-secondary">Show every type</button>';

	function emptyMarkup(reason) {
		const copy = EMPTY_COPY[reason]();
		const tone = copy.tone ? ` basalt-empty-${copy.tone}` : '';
		const role = reason === 'error' ? ' role="alert"' : '';
		const actions = copy.actions ? `<div class="basalt-empty-actions">${copy.actions}</div>` : '';
		return `<div${role} class="basalt-empty basalt-empty-compact${tone} drv-empty"><span aria-hidden="true" class="drv-empty-icon"><i class="bi ${copy.glyph}"></i></span><h3 class="basalt-empty-title">${copy.title}</h3><p class="basalt-empty-text">${copy.text}</p>${actions}</div>`;
	}

	/* The folder tree appears twice: in the side panel and in the move dialog. */

	/**
	 * Nested treeitems under `parentId`. options: open (Set of expanded ids),
	 * skip (Set to leave out), selected (id), meta (fn giving the right-hand note).
	 */
	function folderBranch(parentId, options) {
		const listed = (entry) => entry.kind === 'folder' && !entry.trashed && !options.skip?.has(entry.id);
		return kidsOf(parentId)
			.filter(listed)
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((folder) => {
				const hasSubfolders = kidsOf(folder.id).some(listed);
				const open = options.open.has(folder.id);
				let glyph = 'bi-folder2';
				if (hasSubfolders) glyph = `${open ? 'bi-folder2-open' : 'bi-folder2'} basalt-tree-icon-folder`;
				const note = options.meta
					? options.meta(folder) || ''
					: kidsOf(folder.id).filter((kid) => !kid.trashed).length || '';
				const branch = hasSubfolders
					? `<ul role="group"${open ? '' : ' hidden'}>${folderBranch(folder.id, options)}</ul>`
					: '';
				return (
					`<li data-id="${folder.id}" role="treeitem"${hasSubfolders ? ` aria-expanded="${open}"` : ''} aria-selected="${options.selected === folder.id}">` +
					`<div class="basalt-tree-row"><i aria-hidden="true" class="bi ${glyph} basalt-tree-icon"></i><span class="basalt-tree-label">${htmlSafe(folder.name)}</span><span class="basalt-tree-meta">${note}</span></div>${branch}</li>`
				);
			})
			.join('');
	}

	/* The shared tree binds once per element, so a changed tree is redrawn on a fresh clone. */
	function swapTree(current, markup) {
		const replacement = current.cloneNode(false);
		replacement.innerHTML = markup;
		current.replaceWith(replacement);
		if (window.Basalt.tree) window.Basalt.tree(replacement);
		return replacement;
	}

	function rebuildSideTree() {
		if (ui.place === 'folder') {
			for (const folder of trail(ui.folderId).slice(0, -1)) expanded.add(folder.id);
		}
		sideTree = swapTree(sideTree, folderBranch(null, { open: expanded, selected: currentFolderMark() }));
	}

	/** Moves the selected mark without a rebuild, which would steal focus from the tree. */
	function markTreeCurrent() {
		const treeApi = window.Basalt.tree && window.Basalt.tree(sideTree);
		const current = currentFolderMark();
		for (const item of pickAll('[role="treeitem"]', sideTree)) {
			item.setAttribute('aria-selected', String(item.dataset.id === current));
		}
		if (!current || !treeApi) return;
		for (const folder of trail(current).slice(0, -1)) {
			const item = pick(`[role="treeitem"][data-id="${folder.id}"]`, sideTree);
			if (!item) continue;
			treeApi.setOpen(item, true, false);
			expanded.add(folder.id);
		}
	}

	/* Moving between places and folders, kept in step with the address bar. */

	function wireNavigation() {
		sideTree.closest('[data-drv-tree-host]').addEventListener('basalt:tree-select', (event) => {
			const item = event.detail.item;
			const treeApi = window.Basalt.tree(sideTree);
			/* A second click would fold the folder; here a click always means open it. */
			if (item.getAttribute('aria-expanded') === 'true') setTimeout(() => treeApi.setOpen(item, true, false), 0);
			expanded.add(item.dataset.id);
			navigate('folder', item.dataset.id, { keepTreeFocus: true });
		});

		dom.treeHost.addEventListener('click', (event) => {
			const item = event.target.closest('.basalt-tree-caret')?.closest('[role="treeitem"]');
			if (!item) return;
			setTimeout(() => {
				if (item.getAttribute('aria-expanded') === 'true') expanded.add(item.dataset.id);
				else expanded.delete(item.dataset.id);
			}, 0);
		});

		window.addEventListener('popstate', () => {
			if (ui.loading || ui.failure) return;
			syncFromHash();
			ui.picked.clear();
			ui.query = '';
			dom.search.value = '';
			redraw();
		});

		page.addEventListener('click', onPageClick);
	}

	/* Buttons anywhere on the page that carry a command attribute, checked in this order. */
	const PAGE_COMMANDS = {
		'data-drv-upload': () => dom.picker.click(),
		'data-drv-new-folder': () => openFolderDialog(),
		'data-drv-retry': () => loadDrive(),
		'data-drv-clear-search': () => {
			applySearch('');
			dom.search.focus();
		},
		'data-drv-clear-type': () => {
			dom.typeSelect.value = 'all';
			dom.typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
		},
		'data-drv-empty-trash': () =>
			askToPurge(
				[...entries.values()].filter((entry) => entry.trashed).map((entry) => entry.id),
				true,
			),
	};

	function onPageClick(event) {
		const jump = event.target.closest('[data-drv-go]');
		if (jump) {
			followLink(jump.dataset.drvGo);
			return;
		}
		const place = event.target.closest('[data-drv-place]');
		if (place) {
			navigate(place.dataset.drvPlace);
			return;
		}
		for (const [attribute, command] of Object.entries(PAGE_COMMANDS)) {
			if (event.target.closest(`[${attribute}]`)) {
				command();
				return;
			}
		}
	}

	/** Follows a data-drv-go value: "folder:<id>" or a place name. */
	function followLink(target) {
		if (target.startsWith('folder:')) navigate('folder', target.slice(7));
		else navigate(target || 'root');
	}

	/**
	 * Switches the view to a place (or a folder) and records it in the
	 * address bar. Focus follows into the listing unless it sat elsewhere.
	 */
	function navigate(place, folderId, options) {
		const focused = document.activeElement;
		const carryFocus =
			!options?.keepTreeFocus &&
			(!focused || focused === document.body || !focused.isConnected || dom.dropZone.contains(focused));
		swapSortFor(ui.place, place);
		ui.place = place;
		ui.folderId = place === 'folder' ? folderId : null;
		ui.query = '';
		dom.search.value = '';
		ui.picked.clear();
		ui.focusId = null;

		let hash = `#${place}`;
		if (place === 'folder') hash = `#folder/${folderId}`;
		else if (place === 'root') hash = '';
		if (location.hash !== hash) history.pushState(null, '', hash || location.pathname + location.search);

		redraw();
		if (window.innerWidth < 992 && dom.side.classList.contains('show'))
			bootstrap.Offcanvas.getOrCreateInstance(dom.side).hide();
		moveTabStop(false);
		if (carryFocus) {
			if (ui.focusId) moveTabStop(true);
			else pick('button', dom.empty)?.focus();
		}
		say(`${dom.title.textContent}. ${dom.tally.textContent}.`);
	}

	/* Recent always lists newest first; leaving it brings the visitor's own sort back. */
	function swapSortFor(leaving, entering) {
		if (entering === 'recent' && leaving !== 'recent') {
			ui.savedSort = ui.sortKey;
			ui.sortKey = 'modified';
		} else if (entering !== 'recent' && leaving === 'recent' && ui.savedSort) {
			ui.sortKey = ui.savedSort;
		}
		dom.sortSelect.value = ui.sortKey;
	}

	function syncFromHash() {
		const leaving = ui.place;
		parseHash();
		swapSortFor(leaving, ui.place);
	}

	function parseHash() {
		const fragment = location.hash.slice(1);
		if (fragment.startsWith('folder/')) {
			const folder = entries.get(fragment.slice(7));
			if (folder && folder.kind === 'folder' && !inTrash(folder)) {
				ui.place = 'folder';
				ui.folderId = folder.id;
				return;
			}
		}
		ui.place = fragment !== 'root' && PLACE_TITLES[fragment] ? fragment : 'root';
		ui.folderId = null;
	}

	/* The toolbar: search, type filter, sort order and grid or list. */

	function wireToolbar() {
		dom.search.addEventListener('input', () => {
			clearTimeout(searchDelay);
			searchDelay = setTimeout(() => applySearch(dom.search.value), 140);
		});
		dom.search.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && dom.search.value) {
				event.preventDefault();
				applySearch('');
			}
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				moveTabStop(true);
			}
		});
		dom.typeSelect.addEventListener('change', () => {
			ui.typeFilter = dom.typeSelect.value;
			ui.picked.clear();
			redraw();
		});
		dom.sortSelect.addEventListener('change', () => {
			ui.sortKey = dom.sortSelect.value;
			drawRows();
		});

		for (const option of pickAll('[data-drv-view]')) {
			option.checked = option.value === ui.layout;
			option.addEventListener('change', () => {
				if (!option.checked) return;
				ui.layout = option.value;
				writePref(VIEW_KEY, ui.layout);
				drawRows();
			});
		}

		/* A bare slash jumps to search unless the visitor is typing or inside a dialog. */
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
			if (
				event.target.closest?.(
					'input, textarea, select, [contenteditable="true"], .modal.show, .offcanvas.show',
				)
			)
				return;
			event.preventDefault();
			dom.search.focus();
		});
	}

	function applySearch(text) {
		ui.query = text;
		dom.search.value = text;
		ui.picked.clear();
		ui.focusId = null;
		redraw();
	}

	/* Rows and tiles: opening, picking and the arrow-key grid. */

	function wireRows() {
		dom.list.addEventListener('click', onRowClick);
		dom.list.addEventListener('keydown', onRowKey);
		/* The context menu returns focus to the row itself; hand it on to the row's button, which owns the tab stop. */
		dom.list.addEventListener('focusin', (event) => {
			if (event.target.matches('.drv-item[data-id]')) markCurrent(event.target.dataset.id, true);
		});
	}

	function onRowClick(event) {
		const entry = entryAt(event.target);
		if (!entry) return;
		const target = event.target;

		if (target.closest('.drv-item-check')) {
			/* Shift-click ticks the whole run between this row and the previous tick. */
			if (event.shiftKey && rangeAnchor && ui.order.includes(rangeAnchor)) {
				const from = ui.order.indexOf(rangeAnchor);
				const to = ui.order.indexOf(entry.id);
				for (const id of ui.order.slice(Math.min(from, to), Math.max(from, to) + 1)) setPicked(id, true);
			} else {
				setPicked(entry.id, target.checked);
			}
			rangeAnchor = entry.id;
			markCurrent(entry.id, false);
			say(`${count(ui.picked.size, 'item')} selected`);
			return;
		}

		const more = target.closest('.drv-item-more');
		if (more) {
			const box = more.getBoundingClientRect();
			markCurrent(entry.id, false);
			more.dispatchEvent(
				new MouseEvent('contextmenu', {
					bubbles: true,
					cancelable: true,
					clientX: box.left,
					clientY: box.bottom + 4,
				}),
			);
			return;
		}

		/* Ctrl or Cmd turns a click into a pick, the way desktop file browsers do. */
		if (event.ctrlKey || event.metaKey) {
			setPicked(entry.id);
			markCurrent(entry.id, true);
			return;
		}
		markCurrent(entry.id, false);
		openEntry(entry);
	}

	/* Keys on a focused row. Each handler gets the event, the entry and its index. */
	const ROW_KEYS = {
		ArrowRight(event, entry, at) {
			if (ui.layout !== 'grid') return;
			event.preventDefault();
			stepFocus(at + 1);
		},
		ArrowLeft(event, entry, at) {
			if (ui.layout !== 'grid') return;
			event.preventDefault();
			stepFocus(at - 1);
		},
		ArrowDown(event, entry, at) {
			event.preventDefault();
			stepFocus(at + tilesPerRow());
		},
		ArrowUp(event, entry, at) {
			event.preventDefault();
			if (at === 0 && ui.layout === 'list') dom.search.focus();
			else stepFocus(at - tilesPerRow());
		},
		Home(event) {
			event.preventDefault();
			stepFocus(0);
		},
		End(event) {
			event.preventDefault();
			stepFocus(ui.order.length - 1);
		},
		' '(event, entry) {
			event.preventDefault();
			setPicked(entry.id);
			const state = ui.picked.has(entry.id) ? 'selected' : 'not selected';
			say(`${entry.name} ${state}. ${count(ui.picked.size, 'item')} selected`);
		},
		Escape(event) {
			if (!ui.picked.size) return;
			event.preventDefault();
			dropSelection();
		},
		Delete(event, entry) {
			event.preventDefault();
			if (ui.place === 'trash') askToPurge(targetsFor(entry.id));
			else sendToTrash(targetsFor(entry.id));
		},
		F2(event, entry) {
			if (ui.place === 'trash') return;
			event.preventDefault();
			openRename(entry.id);
		},
	};
	ROW_KEYS.Backspace = ROW_KEYS.Delete;

	function onRowKey(event) {
		const entry = entryAt(event.target);
		if (!entry || !event.target.classList.contains('drv-item-open')) return;
		const modified = event.ctrlKey || event.metaKey;
		if (modified && event.key.toLowerCase() === 'a') {
			event.preventDefault();
			for (const id of ui.order) setPicked(id, true);
			say(`All ${count(ui.order.length, 'item')} selected`);
			return;
		}
		if (modified || event.altKey || !Object.hasOwn(ROW_KEYS, event.key)) return;
		ROW_KEYS[event.key](event, entry, ui.order.indexOf(entry.id));
	}

	function stepFocus(index) {
		const clamped = Math.min(ui.order.length - 1, Math.max(0, index));
		markCurrent(ui.order[clamped], true);
	}

	/** Tiles on the current tile's line in the grid; a list counts as one. */
	function tilesPerRow() {
		if (ui.layout === 'list') return 1;
		const tiles = pickAll('.drv-item', dom.list);
		if (!tiles.length) return 1;
		const top = (rowFor(ui.focusId) || tiles[0]).offsetTop;
		return tiles.filter((tile) => Math.abs(tile.offsetTop - top) < 4).length || 1;
	}

	function entryAt(node) {
		const row = node?.closest?.('.drv-item[data-id]');
		return row ? entries.get(row.dataset.id) : null;
	}

	function rowFor(id) {
		return pick(`.drv-item[data-id="${id}"]`, dom.list);
	}

	/** Gives the current row's button the single tab stop, and optionally focus. */
	function moveTabStop(takeFocus) {
		const row = ui.focusId && rowFor(ui.focusId);
		if (!row) return;
		for (const button of pickAll('.drv-item-open', dom.list)) button.tabIndex = -1;
		const button = pick('.drv-item-open', row);
		button.tabIndex = 0;
		if (takeFocus) button.focus();
	}

	function markCurrent(id, takeFocus) {
		ui.focusId = id;
		moveTabStop(takeFocus);
	}

	function openEntry(entry) {
		if (entry.kind === 'folder' && ui.place !== 'trash') navigate('folder', entry.id);
		else openSheet(entry.id);
	}

	/** Picks or unpicks one row in place; leaving `on` out flips it. */
	function setPicked(id, on) {
		const wanted = on ?? !ui.picked.has(id);
		if (wanted) ui.picked.add(id);
		else ui.picked.delete(id);
		const row = rowFor(id);
		if (row) {
			row.classList.toggle('is-selected', wanted);
			pick('.drv-item-check', row).checked = wanted;
		}
		dom.list.classList.toggle('has-selection', ui.picked.size > 0);
		drawBulkBar();
	}

	function dropSelection() {
		ui.picked.clear();
		for (const row of pickAll('.drv-item.is-selected', dom.list)) {
			row.classList.remove('is-selected');
			pick('.drv-item-check', row).checked = false;
		}
		dom.list.classList.remove('has-selection');
		drawBulkBar();
		say('Selection cleared');
	}

	/** Acting on a picked row acts on every picked row. */
	function targetsFor(id) {
		return ui.picked.has(id) ? [...ui.picked] : [id];
	}

	/* The right-click menu and the bar that acts on picked rows. */

	/* What the menu, the bulk bar and the sheet footer can ask for. */
	const ACTIONS = {
		open: (first) => openEntry(first),
		details: (first) => openSheet(first.id),
		share: (first) => openShare(first.id),
		download: (first, ids) => downloadEntries(ids),
		rename: (first) => openRename(first.id),
		move: (first, ids) => openMove(ids),
		star: (first) => toggleStar(first.id),
		trash: (first, ids) => sendToTrash(ids),
		restore: (first, ids) => bringBack(ids),
		destroy: (first, ids) => askToPurge(ids),
	};

	function perform(action, ids) {
		const first = entries.get(ids[0]);
		if (first && Object.hasOwn(ACTIONS, action)) ACTIONS[action](first, ids);
	}

	function wireMenus() {
		dom.menu.addEventListener('basalt:context', (event) => {
			const entry = entryAt(event.detail.target);
			if (!entry) {
				dom.menu.classList.remove('show');
				return;
			}
			markCurrent(entry.id, false);
			menuTargets = targetsFor(entry.id);
			fitMenu(entry, menuTargets.length > 1);
		});

		dom.menu.addEventListener('basalt:pick', (event) => {
			const action = event.detail.item.dataset.drvAct;
			const ids = [...menuTargets];
			/* The menu tries to refocus the row; send focus to the row's button instead, unless a dialog opened. */
			setTimeout(() => {
				if (!pick('.modal.show, .offcanvas.show')) moveTabStop(true);
			}, 0);
			perform(action, ids);
		});

		dom.bulk.addEventListener('click', (event) => {
			const button = event.target.closest('[data-drv-bulk]');
			if (!button) return;
			if (button.dataset.drvBulk !== 'clear') {
				perform(button.dataset.drvBulk, [...ui.picked]);
				return;
			}
			dropSelection();
			moveTabStop(true);
		});
	}

	/** Shows only the menu items that fit the trash or not, and one item or many. */
	function fitMenu(entry, several) {
		const trashView = ui.place === 'trash';
		const single = !several;
		const allowed = {
			open: !trashView && single,
			share: !trashView && single,
			rename: !trashView && single,
			star: !trashView && single,
			download: !trashView,
			move: !trashView,
			trash: !trashView,
			details: single,
			restore: trashView,
			destroy: trashView,
		};
		for (const button of pickAll('[data-drv-act]', dom.menu)) {
			const on = !!allowed[button.dataset.drvAct];
			button.parentElement.hidden = !on;
			button.disabled = !on;
		}

		/* A divider stays only while a visible item sits on both sides of it. */
		const rows = pickAll(':scope > li', dom.menu);
		for (const [at, row] of rows.entries()) {
			if (!holdsDivider(row)) continue;
			row.hidden = !(anyVisibleItem(rows.slice(0, at)) && anyVisibleItem(rows.slice(at + 1)));
		}

		pick('[data-drv-open-label]', dom.menu).textContent = entry.kind === 'folder' ? 'Open' : 'Preview';
		pick('[data-drv-star-label]', dom.menu).textContent = entry.starred ? 'Remove star' : 'Add star';
		dom.menu.setAttribute(
			'aria-label',
			several ? `Actions for ${count(menuTargets.length, 'item')}` : `Actions for ${entry.name}`,
		);
	}

	function holdsDivider(row) {
		return pick('.dropdown-divider', row) !== null;
	}

	function anyVisibleItem(rows) {
		return rows.some((row) => !row.hidden && !holdsDivider(row));
	}

	/*
	 * Each action updates the page first, then calls the server. A rejected
	 * call undoes the change and raises an error toast.
	 */

	function rollbackWith(what, undo) {
		return () => {
			undo?.();
			redraw({ tree: true });
			notify({ tone: 'danger', title: `Could not ${what}`, text: 'Nothing was changed. Try again in a moment.' });
		};
	}

	function nameOrCount(ids) {
		return ids.length === 1 ? entries.get(ids[0]).name : count(ids.length, 'item');
	}

	function toggleStar(id) {
		const entry = entries.get(id);
		const starred = !entry.starred;
		entry.starred = starred;
		server.setStar(id, starred).catch(
			rollbackWith(starred ? 'add the star' : 'remove the star', () => {
				entry.starred = !starred;
			}),
		);
		redraw();
		moveTabStop(!pick('.offcanvas.show'));
		say(starred ? `Starred ${entry.name}` : `Removed the star from ${entry.name}`);
	}

	function sendToTrash(requested) {
		const ids = requested.filter((id) => entries.has(id));
		if (!ids.length) return;
		const label = nameOrCount(ids);
		const stamp = clockNow();
		const position = ui.order.indexOf(ids[0]);
		for (const id of ids) {
			entries.get(id).trashed = stamp;
			ui.picked.delete(id);
		}
		const putBack = () => {
			for (const id of ids) {
				const entry = entries.get(id);
				if (entry) entry.trashed = null;
			}
		};

		server.binEntries(ids).catch(rollbackWith(`move ${label} to the trash`, putBack));
		if (ui.sheetId && ids.includes(ui.sheetId)) closeSheet();
		ui.focusId = null;
		redraw({ tree: ids.some((id) => entries.get(id).kind === 'folder') });
		const landing = Math.min(Math.max(position, 0), ui.order.length - 1);
		markCurrent(ui.order[landing] || null, true);
		notify({
			tone: 'primary',
			icon: 'bi-trash3',
			title: 'Moved to the trash',
			text: label,
			actions: [
				{
					label: 'Undo',
					onClick() {
						putBack();
						server.unbinEntries(ids);
						redraw({ tree: true });
						markCurrent(ids[0], true);
						say(`Put back ${label}`);
					},
				},
			],
		});
	}

	function bringBack(ids) {
		let rehomed = false;
		for (const id of ids) {
			const entry = entries.get(id);
			entry.trashed = null;
			/* With its folder gone, a restored entry lands at the top level. */
			const holder = entry.parent && entries.get(entry.parent);
			if (entry.parent && (!holder || inTrash(holder))) {
				rehomed = true;
				entry.parent = null;
			}
			entry.name = freeName(entry.name, entry.parent, entry.id);
			ui.picked.delete(id);
		}
		server.unbinEntries(ids).catch(rollbackWith(`restore ${nameOrCount(ids)}`));
		redraw({ tree: true });
		moveTabStop(true);

		const lead = entries.get(ids[0]);
		const text = rehomed
			? `${nameOrCount(ids)}. Its folder is in the trash, so it is back in All files.`
			: `${nameOrCount(ids)}, back in ${folderLabel(lead.parent)}.`;
		notify({
			tone: 'success',
			title: 'Restored',
			text,
			actions: [
				{
					label: 'Show me',
					onClick() {
						navigate(lead.parent ? 'folder' : 'root', lead.parent);
						markCurrent(lead.id, true);
					},
				},
			],
		});
	}

	function askToPurge(ids, wholeTrash) {
		if (!ids.length) return;
		purgeTargets = ids;
		const total = ids.length;
		const single = total === 1;
		let heading = `Delete ${total} items forever?`;
		if (wholeTrash) heading = 'Empty the trash?';
		else if (single) heading = `Delete ${entries.get(ids[0]).name} forever?`;
		const pieces = ids.reduce((sum, id) => sum + 1 + allInside(id).length, 0);
		const bytes = ids.reduce((sum, id) => sum + weight(entries.get(id)), 0);

		pick('[data-drv-destroy-title]').textContent = heading;
		pick('[data-drv-destroy-text]').textContent =
			`This frees ${byteLabel(bytes)} and cannot be undone. ${pieces > total ? 'Folders go with everything in them. ' : ''}Anyone ${single ? 'it was' : 'they were'} shared with loses access.`;
		pick('[data-drv-destroy-keep]').textContent = single ? 'Keep it' : 'Keep them';
		const names = ids
			.slice(0, 4)
			.map((id) => `<li><i aria-hidden="true" class="bi bi-x-circle"></i>${htmlSafe(entries.get(id).name)}</li>`);
		if (total > 4) names.push(`<li><i aria-hidden="true" class="bi bi-three-dots"></i>and ${total - 4} more</li>`);
		pick('[data-drv-destroy-list]').innerHTML = names.join('');
		openDialog('#drv-destroy-dialog');
	}

	/** Runs once the delete button has been held down. */
	function purgeConfirmed() {
		const ids = [...purgeTargets];
		const bytes = ids.reduce((sum, id) => sum + weight(entries.get(id)), 0);
		const label = nameOrCount(ids);
		for (const id of ids) {
			for (const inner of allInside(id)) entries.delete(inner.id);
			entries.delete(id);
			ui.picked.delete(id);
		}
		server.purgeEntries(ids).catch(() =>
			notify({
				tone: 'danger',
				title: `Could not delete ${label}`,
				text: 'Reload the page to see what is still there.',
			}),
		);
		closeDialog('#drv-destroy-dialog');
		if (ui.sheetId && !entries.has(ui.sheetId)) closeSheet();
		redraw({ tree: true });
		notify({ tone: 'success', title: 'Deleted forever', text: `${label}. ${byteLabel(bytes)} freed.` });
	}

	/*
	 * Text files and uploads exist in the browser, so a single one really
	 * downloads. Anything else gets a progress toast while the link is made.
	 */
	function downloadEntries(ids) {
		const chosen = ids.map((id) => entries.get(id)).filter(Boolean);
		const lone = chosen.length === 1 && chosen[0].kind === 'file' ? chosen[0] : null;
		if (lone && (lone.blob || lone.preview.text)) {
			saveLocally(lone);
			return;
		}
		const bytes = chosen.reduce((sum, entry) => sum + weight(entry), 0);
		const progress = notify({
			tone: 'loading',
			title: lone ? `Getting ${lone.name} ready` : `Making a zip of ${nameOrCount(ids)}`,
			text: byteLabel(bytes),
			duration: 0,
		});
		server.prepareDownload(ids).then(() => {
			progress?.update({
				tone: 'success',
				icon: 'bi-check2-circle',
				title: lone ? `${lone.name} is downloading` : 'oakhaven-drive.zip is downloading',
				duration: 5000,
			});
		});
	}

	function saveLocally(entry) {
		const anchor = document.createElement('a');
		anchor.href = entry.blob || URL.createObjectURL(new Blob([entry.preview.text], { type: 'text/plain' }));
		anchor.download = entry.name;
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		if (!entry.blob) setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
		notify({ tone: 'success', title: 'Downloaded', text: `${entry.name}, ${byteLabel(entry.size)}` });
	}

	/* Dialogs for a new folder, renaming, moving, sharing and deleting forever. */

	function wireDialogs() {
		for (const dialog of pickAll('.drv-dialog')) {
			dialog.addEventListener('hidden.bs.modal', () => {
				if (restoreFocusTo && restoreFocusTo.isConnected && restoreFocusTo !== document.body)
					restoreFocusTo.focus();
				else if (sheetVisible()) dom.sheet.focus();
				else moveTabStop(true);
			});
		}
		pick('[data-drv-destroy-go]').addEventListener('basalt:confirm', purgeConfirmed);

		pick('#drv-folder-dialog').addEventListener('shown.bs.modal', () => folderField.focus());
		folderField.addEventListener('input', () => {
			if (folderField.classList.contains('is-invalid'))
				vetName(folderField, pick('[data-drv-folder-err]'), uploadTarget());
		});
		folderForm.addEventListener('submit', submitFolder);

		pick('#drv-rename-dialog').addEventListener('shown.bs.modal', selectNameStem);
		renameField.addEventListener('input', onRenameInput);
		renameForm.addEventListener('submit', submitRename);

		pick('#drv-move-dialog').addEventListener('shown.bs.modal', () => {
			(pick('[role="treeitem"][tabindex="0"]', moveTree) || pick('[role="treeitem"]', moveTree))?.focus();
		});
		pick('[data-drv-move-host]').addEventListener('basalt:tree-select', onMovePick);
		moveButton.addEventListener('click', submitMove);

		pick('#drv-share-dialog').addEventListener('shown.bs.modal', () => shareField.focus());
		shareList.addEventListener('change', (event) => {
			const select = event.target.closest('[data-drv-role]');
			const grant = select && pendingShare.people.find((person) => person.id === select.dataset.drvRole);
			if (grant) grant.role = select.value;
		});
		shareList.addEventListener('click', onUnshare);
		linkMode.addEventListener('change', () => {
			pendingShare.link = linkMode.value;
			pick('[data-drv-share-note]').textContent = LINK_HINTS[pendingShare.link];
		});
		pick('[data-drv-share-add]').addEventListener('submit', submitInvite);
		pick('[data-drv-share-save]').addEventListener('click', saveShare);
	}

	function openDialog(selector) {
		restoreFocusTo = document.activeElement;
		bootstrap.Modal.getOrCreateInstance(pick(selector)).show();
	}

	function closeDialog(selector) {
		bootstrap.Modal.getOrCreateInstance(pick(selector)).hide();
	}

	/** Flags a bad name on `field` and writes why into `errorNode`; true when the name is fine. */
	function vetName(field, errorNode, parentId, ignoreId) {
		const name = field.value.trim();
		let problem = '';
		if (!name) problem = 'Give it a name.';
		else if (/[\\/]/.test(name)) problem = 'Names cannot hold / or \\.';
		else if (clashes(name, parentId, ignoreId))
			problem = `Something in ${folderLabel(parentId)} already has that name.`;
		field.setCustomValidity(problem);
		errorNode.textContent = problem;
		window.Basalt.dialog.flagFields([field]);
		return problem === '';
	}

	function openFolderDialog() {
		folderForm.reset();
		window.Basalt.dialog.clearFlags(folderForm);
		pick('[data-drv-folder-where]').textContent = `In ${folderLabel(uploadTarget())}`;
		openDialog('#drv-folder-dialog');
	}

	function submitFolder(event) {
		event.preventDefault();
		const parent = uploadTarget();
		if (!vetName(folderField, pick('[data-drv-folder-err]'), parent)) {
			folderField.focus();
			return;
		}
		const id = `n${Date.now().toString(36)}`;
		const folder = {
			id,
			kind: 'folder',
			name: folderField.value.trim(),
			parent,
			owner: SAMPLE.viewer,
			size: 0,
			created: clockNow(),
			modified: clockNow(),
			starred: false,
			trashed: null,
			share: { people: [], link: 'off', token: id },
			activity: [{ who: SAMPLE.viewer, what: 'made the folder', when: clockNow() }],
			fresh: true,
		};
		entries.set(id, folder);
		server.addFolder(folder.name, parent).catch(rollbackWith('make the folder', () => entries.delete(id)));
		restoreFocusTo = null;
		closeDialog('#drv-folder-dialog');
		ui.focusId = id;
		redraw({ tree: true });
		notify({
			tone: 'success',
			title: 'Folder made',
			text: `${folder.name} in ${folderLabel(parent)}`,
			actions: [
				{
					label: 'Open it',
					onClick() {
						navigate('folder', id);
					},
				},
			],
		});
	}

	function openRename(id) {
		const entry = entries.get(id);
		renamingId = id;
		renameForm.reset();
		window.Basalt.dialog.clearFlags(renameForm);
		renameField.value = entry.name;
		pick('[data-drv-rename-note]').textContent = '';
		pick('#drv-rename-title').textContent = entry.kind === 'folder' ? 'Rename folder' : 'Rename file';
		pick('[data-drv-rename-where]').textContent = `In ${folderLabel(entry.parent)}`;
		openDialog('#drv-rename-dialog');
	}

	/* Like a desktop, the rename field selects the name but not its ending. */
	function selectNameStem() {
		const entry = entries.get(renamingId);
		renameField.focus();
		const dot = entry.name.lastIndexOf('.');
		renameField.setSelectionRange(0, entry.kind === 'file' && dot > 0 ? dot : entry.name.length);
	}

	function onRenameInput() {
		const entry = entries.get(renamingId);
		const oldEnding = endingOf(entry.name);
		const newEnding = endingOf(renameField.value.trim());
		let warning = '';
		if (entry.kind === 'file' && oldEnding !== newEnding) {
			warning = newEnding
				? `The ending changes from .${oldEnding} to .${newEnding}, so the file may open in a different app.`
				: `Without .${oldEnding} at the end, the file may not open.`;
		}
		pick('[data-drv-rename-note]').textContent = warning;
		if (renameField.classList.contains('is-invalid'))
			vetName(renameField, pick('[data-drv-rename-err]'), entry.parent, entry.id);
	}

	function submitRename(event) {
		event.preventDefault();
		const entry = entries.get(renamingId);
		if (!vetName(renameField, pick('[data-drv-rename-err]'), entry.parent, entry.id)) {
			renameField.focus();
			return;
		}
		const oldName = entry.name;
		const typedName = renameField.value.trim();
		closeDialog('#drv-rename-dialog');
		if (typedName === oldName) return;
		const isFolder = entry.kind === 'folder';
		entry.name = typedName;
		entry.modified = clockNow();
		entry.activity.unshift({ who: SAMPLE.viewer, what: `renamed it from ${oldName}`, when: clockNow() });
		server.renameEntry(entry.id, typedName).catch(
			rollbackWith(`rename ${oldName}`, () => {
				entry.name = oldName;
			}),
		);
		redraw({ tree: isFolder });
		notify({
			tone: 'success',
			title: 'Renamed',
			text: `${oldName} is now ${typedName}`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						entry.name = oldName;
						entry.activity.shift();
						server.renameEntry(entry.id, oldName);
						redraw({ tree: isFolder });
					},
				},
			],
		});
	}

	function openMove(ids) {
		moving = ids;
		moveDestination = undefined;
		const skip = new Set(ids.filter((id) => entries.get(id).kind === 'folder'));
		const homes = new Set(ids.map((id) => entries.get(id).parent));
		const open = new Set();
		for (const home of homes) {
			for (const folder of trail(home)) open.add(folder.id);
		}
		const branch = folderBranch(null, {
			open,
			skip,
			selected: null,
			meta: (folder) => (homes.has(folder.id) ? 'Here now' : ''),
		});
		const topNote = homes.has(null) ? '<span class="basalt-tree-meta">Here now</span>' : '';
		moveTree = swapTree(
			moveTree,
			`<li data-id="" role="treeitem" aria-expanded="true" aria-selected="false"><div class="basalt-tree-row"><i aria-hidden="true" class="bi bi-hdd basalt-tree-icon"></i><span class="basalt-tree-label">All files</span>${topNote}</div><ul role="group">${branch}</ul></li>`,
		);
		pick('[data-drv-move-title]').textContent = `Move ${nameOrCount(ids)}`;
		pick('[data-drv-move-to]').textContent = 'Nothing picked yet.';
		moveButton.disabled = true;
		openDialog('#drv-move-dialog');
	}

	function onMovePick(event) {
		const item = event.detail.item;
		const id = item.dataset.id || null;
		/* "All files" would fold on a second click; it stays open. */
		if (!id) setTimeout(() => window.Basalt.tree(moveTree).setOpen(item, true, false), 0);
		moveDestination = id;
		const alreadyThere = moving.every((movingId) => entries.get(movingId).parent === id);
		moveButton.disabled = alreadyThere;
		pick('[data-drv-move-to]').textContent = alreadyThere
			? `${moving.length === 1 ? 'It is' : 'They are'} already in ${folderLabel(id)}.`
			: `Moves to ${
					id
						? trail(id)
								.map((folder) => folder.name)
								.join(' / ')
						: 'All files'
				}.`;
	}

	function submitMove() {
		if (moveDestination === undefined) return;
		const destination = moveDestination;
		const snapshot = moving.map((id) => ({ id, parent: entries.get(id).parent, name: entries.get(id).name }));
		for (const id of moving) {
			const entry = entries.get(id);
			if (entry.parent === destination) continue;
			entry.name = freeName(entry.name, destination, id);
			entry.parent = destination;
			entry.activity.unshift({
				who: SAMPLE.viewer,
				what: `moved it to ${folderLabel(destination)}`,
				when: clockNow(),
			});
			ui.picked.delete(id);
		}
		const putBack = () => {
			for (const saved of snapshot) {
				const entry = entries.get(saved.id);
				if (!entry) continue;
				entry.parent = saved.parent;
				entry.name = saved.name;
				entry.activity.shift();
			}
		};

		server.relocate(moving, destination).catch(rollbackWith(`move ${nameOrCount(moving)}`, putBack));
		restoreFocusTo = null;
		closeDialog('#drv-move-dialog');
		redraw({ tree: true });
		notify({
			tone: 'success',
			title: `Moved to ${folderLabel(destination)}`,
			text: nameOrCount(moving),
			actions: [
				{
					label: 'Undo',
					onClick() {
						putBack();
						server.relocate(
							snapshot.map((saved) => saved.id),
							null,
						);
						redraw({ tree: true });
					},
				},
				{
					label: 'Open folder',
					ghost: true,
					onClick() {
						navigate(destination ? 'folder' : 'root', destination);
					},
				},
			],
		});
	}

	function openShare(id) {
		const entry = entries.get(id);
		sharingId = id;
		pendingShare = {
			people: entry.share.people.map((grant) => ({ ...grant })),
			link: entry.share.link,
			token: entry.share.token,
		};
		pick('[data-drv-share-title]').textContent = `Share ${entry.name}`;
		shareField.value = '';
		shareField.classList.remove('is-invalid');
		drawShareList();
		linkMode.value = pendingShare.link;
		window.Basalt.select?.refresh?.(linkMode);
		openDialog('#drv-share-dialog');
	}

	/** The owner first, then everyone added so far, plus the link and its hint. */
	function drawShareList() {
		const entry = entries.get(sharingId);
		offerTeammates(entry);
		shareList.innerHTML =
			accessRow(memberById(entry.owner), 'owner', false) +
			pendingShare.people.map((grant) => accessRow(memberById(grant.id), grant.role, true)).join('');
		if (window.Basalt.avatars) window.Basalt.avatars(shareList);
		pick('[data-drv-share-link]').value = SAMPLE.shareUrl + pendingShare.token;
		pick('[data-drv-share-note]').textContent = LINK_HINTS[pendingShare.link];
	}

	function accessRow(member, role, changeable) {
		const id = htmlSafe(member.id);
		const name = htmlSafe(member.name);
		const shown = htmlSafe(member.id === SAMPLE.viewer ? `${member.name} (you)` : member.name);
		const detail = htmlSafe(member.guest ? `${member.email} · outside the company` : member.email);
		const controls = changeable
			? `<label for="drv-role-${id}" class="visually-hidden">What ${name} can do</label>` +
				`<select data-drv-role="${id}" id="drv-role-${id}" class="form-select form-select-sm drv-share-role"><option value="view"${role === 'view' ? ' selected' : ''}>Can view</option><option value="edit"${role === 'edit' ? ' selected' : ''}>Can edit</option></select>` +
				`<button data-drv-unshare="${id}" aria-label="Remove ${name}" type="button" class="btn btn-icon drv-share-remove"><i aria-hidden="true" class="bi bi-x-lg"></i></button>`
			: '<span class="basalt-people-role">Owner</span>';
		return `<li data-who="${id}"><span class="basalt-person">${avatarMark(member.id, 'basalt-avatar-sm')}<span class="drv-share-person"><span class="basalt-person-name">${shown}</span><span class="basalt-person-meta">${detail}</span></span></span>${controls}</li>`;
	}

	/* Suggestions for "Add people": teammates who are not the owner and have no access yet. */
	function offerTeammates(entry) {
		pick('[data-drv-people-list]').innerHTML = SAMPLE.people
			.filter(
				(member) => member.id !== entry.owner && !pendingShare.people.some((grant) => grant.id === member.id),
			)
			.map(
				(member) =>
					`<li data-hint="${htmlSafe(member.email)}" data-value="${htmlSafe(member.name)}">${htmlSafe(member.name)}</li>`,
			)
			.join('');
	}

	function onUnshare(event) {
		const button = event.target.closest('[data-drv-unshare]');
		if (!button) return;
		const member = memberById(button.dataset.drvUnshare);
		pendingShare.people = pendingShare.people.filter((grant) => grant.id !== member.id);
		drawShareList();
		shareField.focus();
		say(`${member.name} removed. Save to apply.`);
	}

	function submitInvite(event) {
		event.preventDefault();
		const typed = shareField.value.trim();
		const lowered = typed.toLowerCase();
		let member = SAMPLE.people.find(
			(candidate) => candidate.name.toLowerCase() === lowered || candidate.email.toLowerCase() === lowered,
		);
		if (!member && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed)) member = memberById(`guest:${lowered}`);

		let problem = '';
		if (!typed) problem = 'Type a name or an email address.';
		else if (!member) problem = 'No one on the team is called that. Check the name, or type an email address.';
		else if (member.id === entries.get(sharingId).owner) problem = `${member.name} owns it already.`;
		else if (pendingShare.people.some((grant) => grant.id === member.id))
			problem = `${member.name} has access already.`;
		pick('[data-drv-share-err]').textContent = problem;
		shareField.classList.toggle('is-invalid', problem !== '');
		shareField.setAttribute('aria-invalid', String(problem !== ''));
		if (problem) {
			shareField.focus();
			return;
		}
		pendingShare.people.push({ id: member.id, role: pick('[data-drv-share-role]').value });
		shareField.value = '';
		drawShareList();
		shareField.focus();
		say(`${member.name} added. Save to apply.`);
	}

	function saveShare() {
		const entry = entries.get(sharingId);
		const previous = entry.share;
		const draft = pendingShare;
		const newcomers = draft.people.filter((grant) => !previous.people.some((old) => old.id === grant.id));
		entry.share = draft;
		if (newcomers.length) {
			entry.activity.unshift({
				who: SAMPLE.viewer,
				what: `shared it with ${newcomers.map((grant) => memberById(grant.id).name).join(', ')}`,
				when: clockNow(),
			});
		}
		if (previous.link !== draft.link) {
			const what =
				draft.link === 'off'
					? 'turned the link off'
					: `opened the link to ${draft.link === 'team' ? 'the team' : 'anyone with it'}`;
			entry.activity.unshift({ who: SAMPLE.viewer, what, when: clockNow() });
		}
		server.saveSharing(entry.id, draft).catch(
			rollbackWith(`save the sharing for ${entry.name}`, () => {
				entry.share = previous;
			}),
		);
		closeDialog('#drv-share-dialog');
		redraw();
		const people = draft.people.length ? `${count(draft.people.length, 'person', 'people')} added` : 'no one added';
		notify({
			tone: 'success',
			title: 'Sharing saved',
			text: `${entry.name}: ${people}, link ${LINK_SUMMARY[draft.link]}.`,
		});
	}

	/* The side sheet previews one entry and lists its details. */

	function wireSheet() {
		dom.sheet.addEventListener('hidden.bs.offcanvas', () => {
			const closedId = ui.sheetId;
			ui.sheetId = null;
			if (closedId && rowFor(closedId)) markCurrent(closedId, true);
		});
		pick('[data-drv-s-prev]', dom.sheet).addEventListener('click', () => flipSheet(-1));
		pick('[data-drv-s-next]', dom.sheet).addEventListener('click', () => flipSheet(1));
		dom.sheet.addEventListener('keydown', (event) => {
			if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
			event.preventDefault();
			flipSheet(event.key === 'ArrowUp' ? -1 : 1);
		});
		dom.sheet.addEventListener('click', onSheetClick);
	}

	function onSheetClick(event) {
		const jump = event.target.closest('[data-drv-go]');
		if (jump) {
			event.stopPropagation();
			closeSheet();
			followLink(jump.dataset.drvGo);
			return;
		}
		const button = event.target.closest('[data-drv-s-act]');
		const id = ui.sheetId;
		if (!button || !id) return;
		const action = button.dataset.drvSAct;
		if (action === 'restore' || action === 'trash') {
			closeSheet();
			if (action === 'restore') bringBack([id]);
			else sendToTrash([id]);
			return;
		}
		perform(action, [id]);
	}

	function sheetVisible() {
		return dom.sheet.classList.contains('show') || dom.sheet.classList.contains('showing');
	}

	function sheetSlot(key) {
		return pick(`[data-drv-s="${key}"]`, dom.sheet);
	}

	function openSheet(id) {
		ui.sheetId = id;
		fillSheet(entries.get(id));
		bootstrap.Offcanvas.getOrCreateInstance(dom.sheet).show();
	}

	function closeSheet() {
		bootstrap.Offcanvas.getOrCreateInstance(dom.sheet).hide();
	}

	/** Ids of the files in the current listing, the set the sheet steps through. */
	function steppableFiles() {
		return ui.order.filter((id) => entries.get(id)?.kind === 'file');
	}

	function flipSheet(direction) {
		const files = steppableFiles();
		if (files.length < 2) return;
		const at = files.indexOf(ui.sheetId);
		const next = files[(at + direction + files.length) % files.length];
		ui.sheetId = next;
		ui.focusId = next;
		fillSheet(entries.get(next));
		moveTabStop(false);
	}

	function fillSheet(entry) {
		if (!entry) return;
		const kind = kindOf(entry);
		const binned = !!entry.trashed || inTrash(entry);
		const kindText = entry.kind === 'folder' ? 'Folder' : kind.label;

		sheetSlot('icon').innerHTML = glyphBadge(entry);
		sheetSlot('name').textContent = entry.name;
		sheetSlot('sub').textContent = [
			kindText,
			byteLabel(weight(entry)),
			binned ? 'in the trash' : `in ${folderLabel(entry.parent)}`,
		]
			.filter(Boolean)
			.join(' · ');
		const files = steppableFiles();
		const at = files.indexOf(entry.id);
		const canStep = at >= 0 && files.length > 1;
		sheetSlot('pos').textContent = canStep ? `${at + 1} of ${files.length}` : '';
		for (const arrow of [pick('[data-drv-s-prev]', dom.sheet), pick('[data-drv-s-next]', dom.sheet)])
			arrow.hidden = !canStep;

		const openFolder =
			entry.kind === 'folder' && !binned
				? `<button data-drv-go="folder:${entry.id}" type="button" class="btn btn-sm btn-outline-secondary drv-sheet-open"><i aria-hidden="true" class="bi bi-folder2-open me-1"></i>Open the folder</button>`
				: '';
		const recent = entry.activity
			.slice(0, 5)
			.map(
				(event) =>
					`<li>${avatarMark(event.who)}<span><strong>${htmlSafe(displayName(event.who))}</strong> ${htmlSafe(event.what)}<span class="drv-act-when">${htmlSafe(whenText(event.when))}</span></span></li>`,
			)
			.join('');
		sheetSlot('body').innerHTML = `${
			previewMarkup(entry) +
			openFolder +
			factsMarkup(entry, kindText, binned) +
			accessMarkup(entry, binned) +
			(recent ? `<h3 class="drv-sheet-sub">Activity</h3><ul class="drv-act">${recent}</ul>` : '')
		}<p class="drv-sheet-keys"><kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd> step through the files</p>`;
		if (window.Basalt.avatars) window.Basalt.avatars(dom.sheet);

		/* Trashed entries cannot be acted on from the footer, only restored from the banner. */
		for (const button of pickAll('.basalt-drawer-foot [data-drv-s-act]', dom.sheet)) button.disabled = binned;
		pick('.basalt-drawer-foot', dom.sheet).hidden = binned;
		sheetSlot('star').textContent = entry.starred ? 'Remove star' : 'Add star';
		if (!binned) return;
		const restore = entry.trashed
			? '<button data-drv-s-act="restore" type="button" class="btn btn-sm btn-primary"><i aria-hidden="true" class="bi bi-arrow-counterclockwise me-1"></i>Restore</button>'
			: '';
		sheetSlot('body').insertAdjacentHTML(
			'afterbegin',
			`<div class="drv-sheet-trash"><p class="mb-0"><i aria-hidden="true" class="bi bi-trash3 me-1"></i>In the trash since ${htmlSafe(whenText(entry.trashed || clockNow()))}.</p>${restore}</div>`,
		);
	}

	function factsMarkup(entry, kindText, binned) {
		let where;
		if (binned) {
			where = `Trash, from ${htmlSafe(folderLabel(entry.parent && entries.get(entry.parent) ? entry.parent : null))}`;
		} else {
			const target = entry.parent ? `folder:${entry.parent}` : 'root';
			const path = entry.parent
				? trail(entry.parent)
						.map((folder) => folder.name)
						.join(' / ')
				: 'All files';
			where = `<button data-drv-go="${target}" type="button" class="btn btn-link drv-link">${htmlSafe(path)}</button>`;
		}
		const facts = [
			['Type', htmlSafe(kindText)],
			['Size', htmlSafe(byteLabel(weight(entry)) || 'Empty')],
			['Where', where],
			['Owner', htmlSafe(memberById(entry.owner).name)],
			['Changed', htmlSafe(whenText(entry.modified))],
			['Added', htmlSafe(whenText(entry.created))],
		];
		return `<h3 class="drv-sheet-sub">Details</h3><dl class="drv-facts">${facts.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
	}

	function accessMarkup(entry, binned) {
		const badge = LINK_BADGES[entry.share.link];
		const members = entry.share.people.map((grant) => memberById(grant.id));
		const owner = memberById(entry.owner).name;
		const who = members.length
			? `<span class="drv-access-avatars">${members
					.slice(0, 4)
					.map((member) => avatarMark(member.id, 'basalt-avatar-xs'))
					.join(
						'',
					)}</span>${htmlSafe(owner)} and ${htmlSafe(members.map((member) => member.name).join(', '))}`
			: `Only ${htmlSafe(entry.owner === SAMPLE.viewer ? 'you' : owner)}`;
		const change = binned
			? ''
			: '<button data-drv-s-act="share" type="button" class="btn btn-sm btn-outline-secondary"><i aria-hidden="true" class="bi bi-person-plus me-1"></i>Change who can open it</button>';
		return (
			'<h3 class="drv-sheet-sub">Who can open it</h3>' +
			`<div class="drv-access"><p class="drv-access-line"><span class="basalt-status basalt-status-${badge.tone}"><i aria-hidden="true" class="bi ${badge.glyph}"></i>${badge.text}</span></p>` +
			`<p class="drv-access-line">${who}</p>${change}</div>`
		);
	}

	/** Picks which preview a file gets, in priority order. */
	function previewFlavor(entry) {
		const family = kindOf(entry).group;
		const look = entry.preview || {};
		if (entry.kind === 'folder') return 'folder';
		if (family === 'image' || family === 'video') return family;
		if (look.rows) return 'table';
		if (look.text != null) return 'text';
		if (look.blocks) return 'paper';
		if (look.entries) return 'archive';
		if (look.loading) return 'loading';
		return 'none';
	}

	/* Preview builders, keyed by flavor. Each gets the entry, its preview data and its kind. */
	const PREVIEWS = {
		folder(entry) {
			const inside = kidsOf(entry.id)
				.filter((kid) => !kid.trashed)
				.sort((a, b) => {
					if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
					return a.name.localeCompare(b.name);
				});
			if (!inside.length)
				return '<div class="drv-pv drv-pv-plain"><p class="drv-pv-note mb-0">Nothing in this folder yet.</p></div>';
			const more = inside.length > 8 ? `<p class="drv-pv-note">and ${inside.length - 8} more</p>` : '';
			return `<div class="drv-pv drv-pv-plain">${fileListMarkup(inside.slice(0, 8).map((kid) => [kid, kid.kind === 'folder' ? '' : byteLabel(kid.size)]))}${more}</div>`;
		},
		image(entry, look, kind) {
			let picture = `<i aria-hidden="true" class="bi ${kind.glyph}"></i>`;
			if (entry.blob) picture = `<img alt="${htmlSafe(entry.name)}" src="${htmlSafe(entry.blob)}">`;
			else if (look.art) picture = artMarkup(look.art, look.tone);
			const labeled = entry.blob ? '' : ` aria-label="Picture: ${htmlSafe(entry.name)}" role="img"`;
			const caption = look.dims
				? `<figcaption class="drv-pv-note">${htmlSafe(look.dims)} pixels</figcaption>`
				: '';
			return `<figure class="drv-pv drv-pv-image"><div${labeled} class="drv-pv-stage">${picture}</div>${caption}</figure>`;
		},
		video(entry, look) {
			const facts = htmlSafe([look.duration, look.dims].filter(Boolean).join(' · '));
			return `<figure class="drv-pv drv-pv-image"><div aria-label="Still from ${htmlSafe(entry.name)}" role="img" class="drv-pv-stage">${look.art ? artMarkup(look.art, look.tone) : ''}<span aria-hidden="true" class="drv-pv-play"><i class="bi bi-play-fill"></i></span></div><figcaption class="drv-pv-note">${facts}. Download it to watch.</figcaption></figure>`;
		},
		table(entry, look) {
			const [header, ...body] = look.rows;
			const head = header.map((cell) => `<th scope="col">${htmlSafe(cell)}</th>`).join('');
			const cells = body
				.map((row) => `<tr>${row.map((cell) => `<td>${htmlSafe(cell)}</td>`).join('')}</tr>`)
				.join('');
			const note =
				look.total > body.length ? `First ${body.length} of ${look.total} rows` : count(body.length, 'row');
			return `<div class="drv-pv drv-pv-sheet"><div class="table-responsive"><table class="table table-sm drv-pv-table"><thead><tr>${head}</tr></thead><tbody>${cells}</tbody></table></div><p class="drv-pv-note">${note}</p></div>`;
		},
		text(entry, look) {
			return `<div class="drv-pv drv-pv-text"><pre aria-label="Contents of ${htmlSafe(entry.name)}" tabindex="0" class="drv-pv-pre">${htmlSafe(look.text)}</pre></div>`;
		},
		paper(entry, look) {
			const paragraphs = look.blocks.map((block) => `<p>${htmlSafe(block)}</p>`).join('');
			const rest = look.pages > 1 ? '. Download it for the rest.' : '';
			return `<div class="drv-pv drv-pv-doc"><article class="drv-paper"><h3 class="drv-paper-title">${htmlSafe(look.title)}</h3>${paragraphs}</article><p class="drv-pv-note">Page 1 of ${look.pages || 1}${rest}</p></div>`;
		},
		archive(entry, look) {
			const listed = look.entries.map(([name, bytes]) => [{ kind: 'file', name }, byteLabel(bytes)]);
			return `<div class="drv-pv drv-pv-plain">${fileListMarkup(listed)}<p class="drv-pv-note">${count(look.entries.length, 'file')} inside</p></div>`;
		},
		loading: () =>
			'<div class="drv-pv drv-pv-plain"><span class="basalt-skeleton basalt-skeleton-block drv-skel-pv"></span></div>',
		none(entry, look, kind) {
			return `<div class="drv-pv drv-pv-plain drv-pv-none"><i aria-hidden="true" class="bi ${kind.glyph}"></i><p class="drv-pv-note mb-0">No preview for this kind of file. Download it to open it.</p></div>`;
		},
	};

	function previewMarkup(entry) {
		return PREVIEWS[previewFlavor(entry)](entry, entry.preview || {}, kindOf(entry));
	}

	/** A short file list: pairs of [entry-like object, size text]. */
	function fileListMarkup(pairs) {
		return `<ul class="drv-pv-files">${pairs.map(([entry, size]) => `<li>${glyphBadge(entry)}<span>${htmlSafe(entry.name)}</span><span class="drv-pv-dim">${size}</span></li>`).join('')}</ul>`;
	}

	/* Uploads arrive from the drop zone or the picker and wait in the tray. */

	function wireUploads() {
		dom.picker.addEventListener('change', () => {
			queueFiles([...dom.picker.files]);
			dom.picker.value = '';
		});
		dom.dropZone.addEventListener('basalt:files', (event) => queueFiles(event.detail.files));
		tray.fold.addEventListener('click', () => window.Basalt.slide(tray.list, () => foldTray(tray.list.hidden)));
		tray.sweep.addEventListener('click', () => {
			for (let at = uploads.length - 1; at >= 0; at -= 1) {
				if (isSettled(uploads[at])) uploads.splice(at, 1);
			}
			syncTray();
			moveTabStop(true);
		});
		tray.list.addEventListener('click', onTrayClick);
	}

	function isSettled(job) {
		return job.state === 'done' || job.state === 'error';
	}

	/** Adds files to the queue, refusing programs and anything over the space left. */
	function queueFiles(files) {
		if (!files.length || ui.loading || ui.failure) return;
		const folder = uploadTarget();
		const stored = [...entries.values()].reduce((sum, entry) => sum + (entry.kind === 'file' ? entry.size : 0), 0);
		const pending = uploads.filter((job) => !isSettled(job)).reduce((sum, job) => sum + job.file.size, 0);
		let room = SAMPLE.capacity - stored - pending;
		for (const file of files) {
			const job = {
				id: `q${Math.random().toString(36).slice(2, 9)}`,
				file,
				folder,
				sent: 0,
				state: 'queued',
				error: '',
			};
			if (REFUSED_ENDINGS.has(endingOf(file.name))) {
				job.state = 'error';
				job.error = 'Programs cannot be uploaded';
			} else if (file.size > room) {
				job.state = 'error';
				job.error = 'Not enough space left';
			} else {
				room -= file.size;
			}
			uploads.push(job);
		}
		tray.box.hidden = false;
		foldTray(true);
		startNextUploads();
		syncTray();
		say(`Uploading ${count(files.length, 'file')} to ${folderLabel(folder)}`);
	}

	/* Keeps up to PARALLEL_UPLOADS transfers running. */
	function startNextUploads() {
		let running = uploads.filter((job) => job.state === 'sending').length;
		for (const job of uploads) {
			if (running >= PARALLEL_UPLOADS) break;
			if (job.state !== 'queued') continue;
			job.state = 'sending';
			job.transfer = server.sendFile(job.file, job.folder, (bytes) => {
				job.sent = bytes;
				refreshTrayRow(job);
			});
			job.transfer.promise
				.then((storedId) => landUpload(job, storedId))
				.catch(() => {
					/* stopped by the visitor */
				});
			running += 1;
		}
	}

	/** Turns a finished transfer into a drive entry, in its folder if that still exists. */
	function landUpload(job, storedId) {
		job.state = 'done';
		job.sent = job.file.size;
		const holder = job.folder && entries.get(job.folder);
		const folder = holder && !inTrash(holder) ? job.folder : null;
		const name = freeName(job.file.name, folder);
		const entry = {
			id: storedId,
			kind: 'file',
			name,
			parent: folder,
			owner: SAMPLE.viewer,
			size: job.file.size,
			created: clockNow(),
			modified: clockNow(),
			starred: false,
			trashed: null,
			share: { people: [], link: 'off', token: storedId },
			preview: {},
			fresh: true,
			activity: [{ who: SAMPLE.viewer, what: 'uploaded it', when: clockNow() }],
		};
		/* Photos and small text files are read in the browser, so they preview for real. */
		if (kindOf(entry).group === 'image') {
			entry.blob = URL.createObjectURL(job.file);
		} else if (READABLE_ENDINGS.has(endingOf(name)) && job.file.size < 300 * KIB) {
			entry.preview = { loading: true };
			job.file.text().then((text) => {
				entry.preview = { text };
				if (ui.sheetId === entry.id) fillSheet(entry);
			});
		}
		job.savedAs = name === job.file.name ? '' : name;
		job.entryId = storedId;
		entries.set(storedId, entry);
		redraw();
		startNextUploads();
		syncTray();
	}

	function trayRowMarkup(job) {
		const name = htmlSafe(job.file.name);
		return (
			`<li data-q="${job.id}" class="basalt-file-queue-item"><span aria-hidden="true" class="basalt-file-queue-icon"><i class="bi ${kindOfName(job.file.name).glyph}"></i></span>` +
			`<div class="basalt-file-queue-main"><div class="basalt-file-queue-line"><span class="basalt-file-queue-name">${name}</span><span data-q-meta class="basalt-file-queue-meta"></span></div>` +
			`<div aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="${name}" role="progressbar" class="progress"><div class="progress-bar"></div></div></div>` +
			'<div class="basalt-file-queue-actions"><button data-q-act="pause" type="button" class="basalt-file-queue-btn"><i aria-hidden="true" class="bi bi-pause-fill"></i></button>' +
			'<button data-q-act="show" type="button" class="basalt-file-queue-btn" hidden><i aria-hidden="true" class="bi bi-eye"></i></button>' +
			'<button data-q-act="cancel" type="button" class="basalt-file-queue-btn"><i aria-hidden="true" class="bi bi-x-lg"></i></button></div></li>'
		);
	}

	const TRAY_STATE_CLASS = { queued: ' is-queued', paused: ' is-paused', done: ' is-done', error: ' is-error' };

	function refreshTrayRow(job) {
		const row = pick(`[data-q="${job.id}"]`, tray.list);
		if (!row) return;
		const percent = job.file.size ? Math.round((job.sent / job.file.size) * 100) : 100;
		const failed = job.state === 'error';
		const paused = job.state === 'paused';
		row.className = `basalt-file-queue-item${TRAY_STATE_CLASS[job.state] || ''}`;
		pick('.progress', row).setAttribute('aria-valuenow', String(failed ? 0 : percent));
		pick('.progress-bar', row).style.width = `${failed ? 100 : percent}%`;

		const statusLines = {
			queued: () => `Waiting · ${byteLabel(job.file.size)}`,
			sending: () => `${byteLabel(job.sent)} of ${byteLabel(job.file.size)}`,
			paused: () => `Paused at ${percent}%`,
			done: () =>
				job.savedAs ? `Saved as ${job.savedAs}, the name was taken` : `Uploaded to ${folderLabel(job.folder)}`,
			error: () => job.error,
		};
		pick('[data-q-meta]', row).textContent = statusLines[job.state]();

		const holdButton = pick('[data-q-act="pause"]', row);
		holdButton.hidden = job.state !== 'sending' && !paused;
		holdButton.innerHTML = `<i aria-hidden="true" class="bi ${paused ? 'bi-play-fill' : 'bi-pause-fill'}"></i>`;
		holdButton.setAttribute('aria-label', `${paused ? 'Resume' : 'Pause'} ${job.file.name}`);
		const showButton = pick('[data-q-act="show"]', row);
		showButton.hidden = job.state !== 'done';
		showButton.setAttribute('aria-label', `Show ${job.savedAs || job.file.name}`);
		pick('[data-q-act="cancel"]', row).setAttribute(
			'aria-label',
			isSettled(job) ? `Remove from the list: ${job.file.name}` : `Cancel ${job.file.name}`,
		);
		drawTrayHeader();
	}

	/** Adds rows for new jobs, drops rows for removed ones, then refreshes each. */
	function syncTray() {
		const present = new Set(pickAll('[data-q]', tray.list).map((row) => row.dataset.q));
		const wanted = new Set(uploads.map((job) => job.id));
		for (const job of uploads) {
			if (!present.has(job.id)) tray.list.insertAdjacentHTML('beforeend', trayRowMarkup(job));
		}
		for (const row of pickAll('[data-q]', tray.list)) {
			if (!wanted.has(row.dataset.q)) row.remove();
		}
		for (const job of uploads) refreshTrayRow(job);
		drawTrayHeader();
	}

	function drawTrayHeader() {
		if (!uploads.length) {
			tray.box.hidden = true;
			return;
		}
		const valid = uploads.filter((job) => job.state !== 'error');
		const total = valid.reduce((sum, job) => sum + job.file.size, 0);
		const sent = valid.reduce((sum, job) => sum + job.sent, 0);
		const percent = total ? Math.round((sent / total) * 100) : 100;
		const finished = uploads.filter((job) => job.state === 'done').length;
		const refused = uploads.length - valid.length;
		const busy = valid.some((job) => job.state !== 'done');

		tray.ring.style.setProperty('--value', percent);
		tray.ring.setAttribute('aria-label', `Uploads ${percent}% done`);
		tray.percent.textContent = `${percent}%`;
		let heading = `${count(finished, 'file')} uploaded`;
		if (busy) heading = `Uploading ${count(valid.length - finished, 'file')}`;
		else if (refused) heading = `${count(finished, 'file')} uploaded, ${refused} did not`;
		tray.heading.textContent = heading;
		tray.detail.textContent = busy
			? `${byteLabel(sent)} of ${byteLabel(total)}`
			: 'Finished. They are in the folders you dropped them in.';
		tray.sweep.hidden = busy;
		tray.box.classList.toggle('is-finished', !busy);
	}

	function foldTray(open) {
		tray.list.hidden = !open;
		tray.fold.setAttribute('aria-expanded', String(open));
		tray.fold.innerHTML = `<i aria-hidden="true" class="bi ${open ? 'bi-chevron-up' : 'bi-chevron-down'} me-1"></i><span>${open ? 'Hide list' : 'Show list'}</span>`;
	}

	/* Tray row buttons: pause or resume, show the landed file, cancel or remove. */
	const TRAY_ACTIONS = {
		pause(job, row) {
			if (job.state === 'paused') {
				job.state = 'sending';
				job.transfer.release();
			} else {
				job.state = 'paused';
				job.transfer.hold();
			}
			refreshTrayRow(job);
			pick('[data-q-act="pause"]', row).focus();
		},
		show(job) {
			const entry = entries.get(job.entryId);
			if (!entry) return;
			navigate(entry.parent ? 'folder' : 'root', entry.parent);
			markCurrent(entry.id, true);
			openSheet(entry.id);
		},
		cancel(job, row) {
			if (job.transfer && (job.state === 'sending' || job.state === 'paused')) job.transfer.stop();
			const neighbor = row.nextElementSibling || row.previousElementSibling;
			uploads.splice(uploads.indexOf(job), 1);
			syncTray();
			startNextUploads();
			syncTray();
			if (neighbor?.isConnected) pick('[data-q-act="cancel"]', neighbor)?.focus();
			else moveTabStop(true);
			say(isSettled(job) ? 'Removed from the list' : `Upload canceled: ${job.file.name}`);
		},
	};

	function onTrayClick(event) {
		const button = event.target.closest('[data-q-act]');
		if (!button) return;
		const row = button.closest('[data-q]');
		const job = uploads.find((candidate) => candidate.id === row.dataset.q);
		const action = button.dataset.qAct;
		if (job && Object.hasOwn(TRAY_ACTIONS, action)) TRAY_ACTIONS[action](job, row);
	}

	/* Small helpers used throughout. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(value) {
		return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
	}

	function say(message) {
		if (window.Basalt.announce) window.Basalt.announce(message);
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	/** "1 file", "3 files", or a given irregular plural. */
	function count(total, word, plural) {
		return `${total} ${total === 1 ? word : plural || `${word}s`}`;
	}

	function pause(ms, value) {
		return new Promise((resolve) => {
			setTimeout(resolve, ms, value);
		});
	}

	function readPref(key) {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function writePref(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch {
			/* Storage can be off in private windows; the layout just is not remembered. */
		}
	}

	/** The demo clock: the fixed origin plus the time since the page opened. */
	function clockNow() {
		return new Date(CLOCK_ORIGIN.getTime() + (Date.now() - openedAt));
	}

	function daysBefore(days, hour = 10, minute = 0) {
		const moment = new Date(CLOCK_ORIGIN);
		moment.setDate(moment.getDate() - days);
		moment.setHours(hour, minute, 0, 0);
		return moment;
	}

	function startOfDay(date) {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	}

	/** "Today, 9:05 am", "Yesterday", "Sep 12", or "Sep 12, 2025" for another year. */
	function whenText(date) {
		const today = clockNow();
		const dayGap = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
		if (dayGap === 0) return `Today, ${timeLabel(date)}`;
		if (dayGap === 1) return 'Yesterday';
		const short = `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
		return date.getFullYear() === today.getFullYear() ? short : `${short}, ${date.getFullYear()}`;
	}

	function timeLabel(date) {
		const hours = date.getHours();
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'am' : 'pm'}`;
	}

	function byteLabel(bytes) {
		if (bytes == null) return '';
		if (bytes < KIB) return `${Math.round(bytes)} B`;
		if (bytes < MIB) return `${Math.round(bytes / KIB)} KB`;
		if (bytes < GIB) return `${(bytes / MIB).toFixed(bytes < 10 * MIB ? 1 : 0)} MB`;
		return `${(bytes / GIB).toFixed(1)} GB`;
	}

	start();
})();
