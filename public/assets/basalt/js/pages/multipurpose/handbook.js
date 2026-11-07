/**
 * Fieldline's team handbook (handbook.html), mounted on [data-hb-root].
 *
 * Articles live in collections, which the page lists as a folder tree. Around
 * them sit live search with the matching words marked, a reader that names
 * each article's owner and review date, a "did this help" box, a change
 * history, and an editor that holds new writing as a private draft until
 * someone publishes it.
 *
 * Bringing your own content: empty or replace HANDBOOK, then point the methods
 * of `server` at your endpoints. Every one of them returns a promise, so a
 * fetch() call fits without touching anything else. The screen is drawn
 * from `store` alone, and server.fetchAll() is what fills it.
 *
 * Article text is plain lines with a few markers, so any text column can
 * hold it:
 *   ## Heading        starts a section
 *   - item            a bullet
 *   1. step           a numbered step
 *   > Tip: text       a tip box (> Note: and > Warning: work as well)
 *   | a | b |         a table; its first row becomes the header
 *   **bold** and `code` work inside any line.
 *
 * Two demo cases can be staged from the address bar without breaking
 * anything: ?demo=error makes the first load fail, and ?demo=empty opens a
 * handbook that has nothing written in it yet.
 */
(() => {
	'use strict';

	const shell = pick('[data-hb-root]');
	if (!shell) return;

	/* The sample handbook, kept in one object so it is easy to swap. Dates are
     ISO days; `review` is how many months an article counts as current
     before its owner is asked to check it again. */
	const HANDBOOK = {
		/* The demo's idea of today; switch to the real date once the data is live. */
		today: '2026-09-29',
		me: 'ruth',
		people: [
			{ id: 'ruth', tone: 1, name: 'Ruth Aldridge', role: 'Head of support' },
			{ id: 'earl', tone: 2, name: 'Earl Baldwin', role: 'Support team lead' },
			{ id: 'courtney', tone: 3, name: 'Courtney Leach', role: 'Scheduling specialist' },
			{ id: 'gerald', tone: 4, name: 'Gerald Pryce', role: 'Billing specialist' },
			{ id: 'alexis', tone: 5, name: 'Alexis Kimball', role: 'App and add-ons' },
			{ id: 'felix', tone: 6, name: 'Felix McCall', role: 'Integrations engineer' },
		],
		collections: [
			{
				id: 'start',
				icon: 'bi-flag',
				owner: 'ruth',
				name: 'Getting started',
				desc: 'Setting up a new account: company details, inviting the team and booking the first visits.',
			},
			{
				id: 'schedule',
				icon: 'bi-calendar-week',
				owner: 'courtney',
				name: 'Scheduling and bookings',
				desc: 'The schedule board, service windows, travel and what to do when a visit runs over.',
			},
			{
				id: 'invoices',
				icon: 'bi-receipt',
				owner: 'gerald',
				name: 'Estimates and invoices',
				desc: 'Estimates, invoicing on site, card payments and refunds.',
			},
			{
				id: 'portal',
				icon: 'bi-chat-dots',
				owner: 'earl',
				name: 'Customer portal and SMS',
				desc: 'What customers see, booking requests, and the reminder texts sent on your behalf.',
			},
			{
				id: 'mobile',
				icon: 'bi-phone',
				owner: 'alexis',
				name: 'Mobile app and visits',
				desc: 'The staff app, working offline, checklists and setting it up on a new phone.',
			},
			{
				id: 'billing',
				icon: 'bi-credit-card',
				owner: 'gerald',
				name: 'Plans and billing',
				desc: 'Plans, seats, paying for Fieldline and keeping the account safe.',
			},
			{
				id: 'integrations',
				icon: 'bi-plug',
				owner: 'felix',
				name: 'Integrations',
				desc: 'Accounting, payroll and calendar connections. Being written up this month.',
			},
		],
		starred: ['schedule-board', 'refunds'],
		articles: [
			{
				id: 'welcome',
				title: 'Welcome',
				collection: 'start',
				owner: 'ruth',
				review: 12,
				updated: '2026-08-06',
				summary: 'What Fieldline does, who it is for, and what a normal week in it looks like.',
				tags: ['new accounts', 'overview'],
				body: prose(`
          Fieldline is scheduling software for teams that work on site: home care, pet care, photography, cleaning, movers and anyone else who sends people out to visits. The office books and assigns, staff work from the app, and customers get reminders and invoices without anyone chasing them.
          ## What is in it
          - **Bookings and visits**: one record per booking, with visits, notes, photos and supplies.
          - **Schedule board**: every team member's day on one screen, drag to assign.
          - **Estimates and invoices**: send from the office or take payment on site.
          - **Customer portal and SMS reminders**: customers see their visits and pay online.
          - **The staff app**: today's visits, checklists and time sheets, and it works offline.
          ## How a week usually goes
          Most offices plan the week on Friday afternoon, then adjust on the schedule board each morning as visits run over or new calls come in. Invoices go out as visits close, and the portal handles most of the "what time are you coming" calls.
          > Tip: Anything in this handbook with an orange "due for review" label may be out of date. Check with the owner named at the top before quoting it to a customer.
          ## Where to start
          Read **Your first week** next, then **Bringing your team in**. Everything else you can look up when it comes up.
        `),
			},
			{
				id: 'invite-team',
				title: 'Bringing your team in',
				collection: 'start',
				owner: 'earl',
				review: 6,
				updated: '2026-09-03',
				summary: 'The four roles, what each one can see, and how to send the invites.',
				tags: ['roles', 'new accounts', 'seats'],
				body: prose(`
          Every person who signs in uses one seat. Pick the role that matches what they do day to day; you can change it later without losing anything.
          ## The roles
          | Role | Can do | Usually |
          | --- | --- | --- |
          | Admin | Everything, including billing and plan changes | The owner or office manager |
          | Scheduler | Book, assign and move visits, message customers | Office staff |
          | Team member | See their own visits, fill in checklists, take payment | On-site staff |
          | Office | Estimates, invoices and customers, no scheduling | Bookkeeping |
          ## Sending invites
          1. Go to **Settings**, **Team and roles**, and choose **Invite people**.
          2. Paste one email address per line and pick a role for each.
          3. Team members get a text with a link to the app as well as the email.
          > Note: Team members cannot see invoice totals for other people's visits, or any customer card details.
        `),
			},
			{
				id: 'import-customers',
				title: 'Importing customers',
				collection: 'start',
				owner: 'courtney',
				review: 6,
				updated: '2026-07-23',
				summary: 'Bringing your customer list across from a spreadsheet or your old system.',
				tags: ['import', 'customers', 'spreadsheet'],
				body: prose(`
          Most teams import their customer list on day one. A spreadsheet with a header row is all it needs.
          ## Columns we read
          - Customer name, phone and email.
          - Service address. A customer can have several; put each one on its own row with the same customer name.
          - Notes, such as gate codes or where the spare key is. These show on every visit at that address.
          ## Importing
          1. Go to **Customers** and choose **Import**.
          2. Upload the file and match each column to a Fieldline field.
          3. Check the preview. Rows with a problem are listed with the reason.
          4. Choose **Import**. Large lists can take a couple of minutes.
          > Warning: Phone numbers without a country code are read as the account's own country. Check them if you work across a border.
        `),
			},
			{
				id: 'first-week',
				title: 'Your first week',
				collection: 'start',
				owner: 'ruth',
				review: 12,
				updated: '2026-07-01',
				summary: 'A day by day setup plan, so the office is ready before the first real visit.',
				tags: ['new accounts', 'setup', 'training'],
				body: prose(`
          Nobody has to set everything up at once. This is the order we suggest to new accounts on their onboarding call.
          ## Day by day
          1. **Monday**: company details, logo, tax rates and business hours.
          2. **Tuesday**: import customers and invite the office team.
          3. **Wednesday**: set up visit types, service windows and one checklist.
          4. **Thursday**: invite your staff and get the app on the phones they already have.
          5. **Friday**: book next week's visits on the schedule board and send a test reminder to yourself.
          ## Read this week
          - Schedule board
          - SMS reminders
          - Sending estimates
        `),
			},
			{
				id: 'schedule-board',
				title: 'Schedule board',
				collection: 'schedule',
				owner: 'courtney',
				review: 6,
				updated: '2026-09-11',
				summary: 'Assigning, moving and splitting visits, and reading the board at a glance.',
				tags: ['schedule', 'board', 'assigning'],
				body: prose(`
          The schedule board shows every team member as a row and the day as columns. Unassigned visits wait in the tray on the left.
          ## Reading the board
          - Gray blocks are booked, blue are on the way, green are in progress and dark green are done.
          - A red edge means the visit is past the end of its service window.
          - The car icon shows travel time from the previous visit.
          ## Assigning a visit
          1. Drag the visit from the tray onto a team member's row.
          2. Drop it where it should start. The board snaps to 15 minutes.
          3. The team member gets a notification, and the customer gets their reminder at the usual time.
          ## Moving and splitting
          1. Drag a block to another row or time to move it.
          2. Hold **Shift** while dropping to add a second team member instead of moving it.
          3. Right-click and choose **Split visit** for work that needs two days.
          > Tip: Press **T** to jump back to today, and **F** to filter the board to one territory.
        `),
			},
			{
				id: 'service-windows',
				title: 'Arrival windows',
				collection: 'schedule',
				owner: 'courtney',
				review: 6,
				updated: '2026-09-17',
				summary: 'What customers are promised, and how the board keeps to it.',
				tags: ['service windows', 'scheduling', 'reminders'],
				body: prose(`
          A service window is the time range the customer is told. The visit itself can start anywhere inside it.
          ## The default windows
          | Window | Hours | Used for |
          | --- | --- | --- |
          | Morning | 8:00 AM to 12:00 PM | Most residential work |
          | Afternoon | 12:00 PM to 4:00 PM | Most residential work |
          | All day | 8:00 AM to 5:00 PM | Moves and long shoots |
          | Exact time | One hour | Regular weekly visits |
          ## Changing them
          - Go to **Settings**, **Scheduling**, then **Service windows**.
          - Changes only apply to visits booked after you save.
          > Note: The "on my way" text goes out when the team member taps **Start driving**, whatever the window says.
        `),
			},
			{
				id: 'visit-overrun',
				title: 'Late or missed visits',
				collection: 'schedule',
				owner: 'earl',
				review: 6,
				updated: '2026-01-21',
				summary: 'Moving the rest of the day without losing the customers waiting on it.',
				tags: ['schedule', 'rescheduling', 'customers'],
				body: prose(`
          Days rarely go to plan. The board can move the rest of a team member's day in one go.
          ## A visit runs over
          1. Open the team member's row and choose **Shift remaining visits**.
          2. Pick how long to push them back. Anything that now misses its window turns red.
          3. Drag the red visits to someone free, or check **Text affected customers** to offer them a new time.
          ## A team member is out sick
          1. Choose **Mark unavailable** on their row, for the day or a range of dates.
          2. Their visits go back to the tray, still in their original order.
          3. Use **Auto-assign** to spread them across the territory, then check the result.
          > Warning: Auto-assign does not know who has a background check or a driver’s license unless the visit type says it needs one. Check those visits by hand.
        `),
			},
			{
				id: 'travel-planner',
				title: 'Planning with Travel Planner',
				collection: 'schedule',
				owner: 'courtney',
				review: 12,
				updated: '2026-05-15',
				summary: "Letting the add-on order each team member's day by travel time.",
				tags: ['travel', 'add-ons', 'territories'],
				body: prose(`
          Travel Planner is an add-on at $6 per seat per month. It reorders each team member's visits so they spend less time traveling.
          ## Before you run it
          - Every visit needs a full address. Visits without one stay where they are.
          - Set each team member's start point: home, the office or the first visit.
          ## Running it
          1. On the schedule board, choose **Plan travel** above a team member, or above the whole day.
          2. Check the before and after travel times it shows you.
          3. Choose **Apply**. Customers whose arrival time moves get a new reminder.
          > Tip: Lock a visit with the pin icon if it has to stay at a set time. The planner works around it.
        `),
			},
			{
				id: 'refunds',
				title: 'Refunds and credits',
				collection: 'invoices',
				owner: 'gerald',
				review: 6,
				updated: '2026-09-09',
				summary: 'Full and part refunds, credit notes, and which one to use.',
				tags: ['refunds', 'invoices', 'credit notes'],
				body: prose(`
          A refund sends money back to the customer's card. A credit note keeps it on their account for the next visit. Both are recorded against the original invoice.
          ## Which one to use
          | Situation | Use | Notes |
          | --- | --- | --- |
          | Customer paid twice | Refund | Full amount of the second payment |
          | A visit was cut short | Part refund | Only the time not used |
          | Repeat visit to fix our own work | Credit note | Covers the next invoice |
          | Customer on a weekly plan | Credit note | Taken off the next plan payment |
          ## How to refund
          1. Open the invoice and choose **Refund**.
          2. Check the lines to refund, or type an amount.
          3. Pick a reason. It feeds the monthly report, so pick the real one.
          4. The customer gets an email with the updated invoice attached.
          > Note: Card refunds take 5 to 10 working days to show. Cash and check payments are marked as refunded but the money has to be returned by hand.
        `),
			},
			{
				id: 'estimates',
				title: 'Sending estimates',
				collection: 'invoices',
				owner: 'gerald',
				review: 12,
				updated: '2026-08-20',
				summary: 'Good, better, best options, approval in the portal, and turning it into a booking.',
				tags: ['estimates', 'quotes', 'portal'],
				body: prose(`
          An estimate can have up to three options. Customers pick one and approve it from their phone.
          ## Building it
          1. From the customer or a booking, choose **New estimate**.
          2. Add line items from your price list, or type one in.
          3. Choose **Add option** to offer a second or third version, such as one or two people.
          ## Sending it
          - By email, text or both. The customer sees it in the portal with an **Approve** button.
          - Estimates expire after 30 days unless you change it in Settings.
          ## Once approved
          The estimate turns into a booking in the tray with all its line items, ready to schedule. Nothing needs typing twice.
          > Tip: Add a photo from the visit to each option. Approval rates go up when customers can see what they are paying for.
        `),
			},
			{
				id: 'tap-to-pay',
				title: 'Card payments on site',
				collection: 'invoices',
				owner: 'alexis',
				review: 6,
				updated: '2025-12-03',
				summary: 'Turning on tap to pay, taking a payment, and what to do if it fails.',
				tags: ['payments', 'tap to pay', 'mobile app'],
				body: prose(`
          Your staff can take payment the moment a visit closes, with tap to pay on their phone or by sending a payment link.
          ## Turning it on
          1. Ask an admin to turn it on in Billing.
          2. In the app, open **Settings**, **Tap to pay**, and follow the steps to check the phone can take cards.
          3. It works on most phones from the last five years.
          ## Taking a payment
          1. Close the visit, then choose **Take payment** on the invoice.
          2. The customer taps their card or phone.
          3. The receipt goes by text or email, their choice.
          ## If it fails
          - Ask for another card, or send a payment link instead.
          - If the phone will not read the card, turn NFC off and on again before anything else.
        `),
			},
			{
				id: 'sms-reminders',
				title: 'SMS reminders',
				collection: 'portal',
				owner: 'earl',
				review: 6,
				updated: '2026-09-16',
				summary: 'Which texts go out, when, and how to change what they say.',
				tags: ['sms', 'reminders', 'customers'],
				body: prose(`
          Reminders cut no-shows more than anything else in Fieldline. Most accounts leave all three turned on.
          ## The three texts
          | Text | Sent | Can turn off |
          | --- | --- | --- |
          | Booking confirmed | When the visit is booked | Yes |
          | Reminder | The day before, at 5:00 PM | Yes |
          | On my way | When the team member sets off | Yes |
          ## Changing the wording
          1. Go to **Settings**, **Customer messages**.
          2. Edit the text. Words in curly brackets, like \`{arrival_window}\`, are filled in for each visit.
          3. Send a test to your own phone before saving.
          > Note: Each text uses one SMS credit, or two if it runs past 160 characters.
        `),
			},
			{
				id: 'portal-setup',
				title: 'Customer portal',
				collection: 'portal',
				owner: 'earl',
				review: 6,
				updated: '2026-02-12',
				summary: 'What customers can do in the portal, and how to put your branding on it.',
				tags: ['portal', 'add-ons', 'branding'],
				body: prose(`
          The customer portal is an add-on at $4 per seat per month. Customers sign in with a link texted to them, so there is no password to forget.
          ## What customers can do
          - See upcoming and past visits, with the team member's name.
          - Approve estimates and pay invoices.
          - Request a booking, which lands in your tray for a scheduler to confirm.
          ## Turning it on
          1. Go to **Settings**, **Customer portal**, and choose **Turn on**.
          2. Upload your logo and pick a color.
          3. Add the portal link to your reminder texts and your website.
          > Tip: Put the portal link in the "on my way" text. That is when customers most want to know who is coming.
        `),
			},
			{
				id: 'sms-credits',
				title: 'SMS credits',
				collection: 'portal',
				owner: 'gerald',
				review: 6,
				updated: '2026-08-28',
				summary: 'How credits are counted, topping up, and the warning before you hit zero.',
				tags: ['sms', 'credits', 'billing'],
				body: prose(`
          Every plan includes 200 SMS credits a month per account. More come in packs of 1,000 for $25 from the Billing page.
          ## How they are used
          - One text up to 160 characters uses one credit.
          - Longer texts, or ones with emoji, can use two or three.
          - Replies from customers are free.
          ## Running low
          - Admins get an email at 100 credits left, and again at 20.
          - At zero, reminders stop until you top up. Emails still go out.
          > Tip: Turn on **Top up automatically** in Billing, and a pack is bought when you drop below 50.
        `),
			},
			{
				id: 'booking-requests',
				title: 'Booking requests',
				collection: 'portal',
				owner: 'courtney',
				review: 12,
				updated: '2026-09-02',
				summary: 'Confirming, changing or declining a request, and how fast to answer.',
				tags: ['portal', 'bookings', 'schedule'],
				body: prose(`
          Requests from the portal wait in the tray with a purple edge until someone confirms them. The customer is told it is a request, not a booking.
          ## Answering a request
          1. Open the request. It shows the address, the visit type and the window they asked for.
          2. Drag it onto a team member to confirm the window they asked for.
          3. Or choose **Offer another time** and pick up to three windows for them to choose from.
          4. If you cannot do the work, choose **Decline** and say why in one line.
          > Note: Answer within one working day. After two, the customer gets an automatic message saying you will be in touch.
        `),
			},
			{
				id: 'offline-mode',
				title: 'Working offline',
				collection: 'mobile',
				owner: 'alexis',
				review: 12,
				updated: '2026-07-10',
				summary: 'What works without signal, and how changes catch up afterwards.',
				tags: ['mobile app', 'offline', 'staff'],
				body: prose(`
          Basements, old houses and rural roads all lose signal. The app keeps today's and tomorrow's visits on the phone so work carries on.
          ## Works offline
          - Opening visits, notes, customer details and past visit history.
          - Checklists, photos, signatures and supplies used.
          - Clocking in and out on the time sheet.
          ## Needs signal
          - Card payments and payment links.
          - Seeing visits added to your day after you lost signal.
          ## Catching up
          Everything saved offline uploads on its own once the device is back online. A cloud icon with a number shows how many changes are still waiting.
          > Warning: Do not sign out while changes are waiting. Signing out clears them from the device.
        `),
			},
			{
				id: 'phone-setup',
				title: 'Setting up a new phone',
				collection: 'mobile',
				owner: 'alexis',
				review: 12,
				updated: '2026-09-22',
				summary: 'From the download to a phone your staff can use on visits.',
				tags: ['mobile app', 'phones', 'setup'],
				body: prose(`
          The Fieldline app runs on the phones your team already have, iPhone or Android, with no extra kit.
          ## Setting one up
          1. Install Fieldline from the App Store or Google Play and open it.
          2. Scan the QR code shown in **Settings**, **Team**, **Add a phone**.
          3. The team member signs in with the details from their invite.
          ## On the day
          - Turn on notifications so new visits show on the lock screen.
          - Battery saver can hold back sync, so leave the app out of it.
          > Note: Lost or stolen? Choose **Lock and wipe** on the device in Settings. It happens the next time it connects.
        `),
			},
			{
				id: 'checklists',
				title: 'Visit checklists',
				collection: 'mobile',
				owner: 'courtney',
				review: 12,
				updated: '2026-04-04',
				summary: 'Checklists your staff fill in on site, and attaching them to visit types.',
				tags: ['checklists', 'visit types', 'staff'],
				body: prose(`
          A checklist is a list of steps, readings or photos the team member has to complete before closing a visit.
          ## Item types
          | Item | Staff member enters | Example |
          | --- | --- | --- |
          | Checkbox | Done or not | Bins taken out |
          | Reading | A number with a unit | Distance walked, miles |
          | Photo | One or more photos | Room before and after |
          | Signature | Customer signs on screen | Work accepted |
          ## Attaching to a visit type
          1. Go to **Settings**, **Visit types**, and open one.
          2. Choose the checklist under **Required on close**.
          3. From then on, every new visit of that type carries it.
        `),
			},
			{
				id: 'live-location',
				title: 'Live location',
				collection: 'mobile',
				owner: 'alexis',
				review: 6,
				updated: '2026-03-03',
				summary: 'Who it covers, when it is on, and what the office can see.',
				tags: ['mobile app', 'location', 'privacy'],
				body: prose(`
          Live location comes with every plan. It uses the phone each team member already carries, so there is nothing to fit or set up.
          ## Turning it on
          1. Go to **Settings**, **Team**, and open **Live location**.
          2. Choose who it applies to. Each person is asked to allow it on their own phone.
          3. Once they allow it, their dot shows on the map within a couple of minutes.
          ## What the office sees
          - Each team member on the schedule map, updated every 30 seconds while out.
          - Travel times between visits, used by Travel Planner.
          > Note: Sharing stops when they clock out. Nobody is shown on the map outside working hours.
        `),
			},
			{
				id: 'plans-seats',
				title: 'Plans and seats',
				collection: 'billing',
				owner: 'gerald',
				review: 12,
				updated: '2026-06-13',
				summary: 'What each plan includes, how seats are counted, and moving up or down.',
				tags: ['plans', 'seats', 'pricing'],
				body: prose(`
          Free covers up to 3 people. Paid plans are priced per seat per month, and annual billing gives two months free.
          ## The plans
          | Plan | Per seat, monthly | Best for |
          | --- | --- | --- |
          | Free | $0 | Up to 3 people and 100 visits a month |
          | Basic | $15 | Small teams booking and invoicing |
          | Pro | $32 | Teams that book visits daily and use the portal |
          | Max | $58 | Several territories, custom roles and SSO |
          ## Seats
          - Every person who signs in uses one seat, on-site staff included.
          - Adding a seat mid-month charges only for the days left.
          ## Changing plan
          Admins can change plan from **Settings**, **Billing**. Moving up takes effect straight away; moving down takes effect at the next renewal.
        `),
			},
			{
				id: 'failed-payments',
				title: 'Failed payments',
				collection: 'billing',
				owner: 'gerald',
				review: 12,
				updated: '2026-05-06',
				summary: 'What happens when the card on file is declined, and how long you have.',
				tags: ['billing', 'payments', 'cards'],
				body: prose(`
          If the card on file is declined, we try again three times over seven days and email the account admins each time.
          ## What changes
          - Days 1 to 7: nothing. Everyone keeps working as normal.
          - Days 8 to 14: a banner shows for admins, and new seats cannot be added.
          - After 14 days: the account becomes read-only until the payment goes through. No data is deleted.
          > Tip: An expired card is the cause about eight times in ten. Update it from **Settings**, **Billing**, **Payment method**.
        `),
			},
			{
				id: 'two-step',
				title: 'Passwords and sign-in',
				collection: 'billing',
				owner: 'earl',
				review: 6,
				updated: '2026-09-25',
				summary: 'Keeping the account safe without slowing your staff down.',
				tags: ['security', 'accounts', 'passwords'],
				body: prose(`
          One person, one sign-in. Shared logins hide who changed what, and they use a seat each anyway.
          ## What we recommend
          - Turn on 2-step sign-in for every admin and scheduler.
          - Let team members sign in with a code texted to their phone.
          - On shared office phones, set the app to sign out after each shift.
          ## If something looks wrong
          Choose **Sign out everywhere** on the person in **Team and roles**, then ask them to reset their password. It costs nothing to do it just in case.
        `),
			},
			{
				id: 'autumn-plans',
				title: 'Autumn visit plans',
				collection: 'schedule',
				owner: 'ruth',
				review: 6,
				updated: '2026-09-27',
				status: 'draft',
				summary: 'Notes for the autumn leaf clearing campaign. Not finished.',
				tags: ['visit plans', 'seasonal', 'landscaping'],
				body: prose(`
          Most garden customers want their leaves cleared before the first hard frost. Visit plans book those visits for you.
          ## What goes in a plan
          - One visit a year, booked into an exact-time window.
          - The leaf clearing checklist attached to the visit.
          - Billing monthly or yearly, taken by card.
          ## Still to decide
          - Whether visits are booked six or eight weeks ahead.
        `),
			},
		],
	};

	const USER = HANDBOOK.me;
	const DAY_MS = 864e5;
	const TODAY_MS = dayStamp(HANDBOOK.today);

	/* ?demo=error or ?demo=empty, for previewing those states only. */
	const demoCase = new URLSearchParams(window.location.search).get('demo');
	let failedOnce = false;

	/* The only place that talks to a backend. Each demo method waits a moment
     and answers from memory; the comment above it shows the live call. */
	const server = {
		/* fetch('/api/handbook').then((res) => res.json()), resolving to an
       object shaped like HANDBOOK: { people, collections, articles, starred }. */
		fetchAll() {
			if (demoCase === 'error' && !failedOnce) {
				failedOnce = true;
				return settle(null, 700).then(() => {
					throw new Error('The handbook service did not answer (504).');
				});
			}
			const payload = withDemoNumbers();
			if (demoCase === 'empty') Object.assign(payload, { articles: [], starred: [] });
			return settle(payload, 450);
		},
		/* PUT /api/articles/:id with the article as JSON. Drafts go here too,
       and so does an undone delete. */
		putArticle(article) {
			return settle(article, 600);
		},
		/* DELETE /api/articles/:id */
		removeArticle(articleId) {
			return settle(articleId, 250);
		},
		/* POST /api/collections with the new collection as JSON. */
		putCollection(collection) {
			return settle(collection, 300);
		},
		/* POST /api/articles/:id/feedback. A "no" also carries a reason and an
       optional note. */
		postFeedback(articleId, answer) {
			return settle(answer, 450);
		},
		/* PUT or DELETE /api/me/starred/:id for the person signed in. */
		putStar(articleId, starred) {
			return settle(starred, 0);
		},
	};

	/* Everything the screen is drawn from. */
	const store = {
		ready: false,
		people: [],
		collections: [],
		articles: [],
		stars: new Set(),
		answers: {},
		place: { view: 'home' },
		terms: '',
		resultFilter: 'all',
		sortBy: 'updated',
		session: null,
		resume: null,
	};

	const layout = pick('[data-hb-app]', shell);
	const stage = pick('[data-hb-view]', shell);
	const shelfTree = pick('[data-hb-tree]', shell);
	const finder = pick('[data-hb-search]', shell);
	const composer = pick('[data-hb-editor]', shell);

	/* The editor's controls. The first six keys match collectFields(), so a
     saved set of values can be written straight back. */
	const fields = {
		title: pick('[data-hb-ed="title"]', composer),
		collection: pick('[data-hb-ed="collection"]', composer),
		owner: pick('[data-hb-ed="owner"]', composer),
		review: pick('[data-hb-ed="review"]', composer),
		summary: pick('[data-hb-ed="summary"]', composer),
		body: pick('[data-hb-ed="body"]', composer),
		tags: pick('[data-hb-ed-tags]', composer),
		preview: pick('[data-hb-ed-preview]', composer),
		toolbar: pick('[data-hb-ed-toolbar]', composer),
		heading: pick('[data-hb-editor-title]', composer),
		intro: pick('[data-hb-editor-desc]', composer),
		badge: pick('[data-hb-editor-status]', composer),
		charsLeft: pick('[data-hb-ed-count]', composer),
		quickDraft: pick('[data-hb-ed-top-draft]', composer),
		quickPublish: pick('[data-hb-ed-top-publish]', composer),
		draftButton: pick('[data-hb-ed-draft]', composer),
		publishButton: pick('[data-hb-ed-publish]', composer),
		publishText: pick('[data-hb-ed-publish-label]', composer),
		discardButtons: pickAll('[data-hb-ed-discard]', composer),
	};

	let treeWidget = null;
	let treeDriven = false;
	let ownerChosen = false;

	const HASH_VIEWS = new Map([
		['article', 'article'],
		['collection', 'collection'],
		['view', 'list'],
	]);
	const VIEW_PAINTERS = { article: articleView, collection: collectionView, list: shelfView, home: homeView };

	const SORT_OPTIONS = [
		{ value: 'updated', label: 'Recently updated', compare: newestFirst },
		{ value: 'title', label: 'A to Z', compare: byTitle },
		{ value: 'views', label: 'Most read', compare: mostRead },
	];

	/* The fixed lists in the left column, each with what it shows when empty. */
	const SHELVES = {
		starred: {
			title: 'Starred',
			intro: 'Articles you keep coming back to. Star one from its page.',
			list() {
				return readable().filter((article) => store.stars.has(article.id));
			},
			empty: {
				art: 'star',
				title: 'Nothing starred yet',
				text: 'Open an article you use a lot and press the star next to its title. It shows up here.',
			},
		},
		review: {
			title: 'Due for review',
			intro: 'Past the date their owner promised to look at them again. Open one and mark it reviewed once it is checked.',
			list() {
				return pastReview().sort(oldestFirst);
			},
			empty: {
				art: 'check',
				title: 'Everything is current',
				text: 'No article is past its review date. Nice work.',
			},
		},
		drafts: {
			title: 'Your drafts',
			intro: 'Only you can see these until you publish them.',
			list() {
				return ownDrafts().sort(newestFirst);
			},
			empty: {
				art: 'book',
				title: 'No drafts',
				text: 'Anything you start and do not publish waits here.',
				offerWrite: true,
			},
		},
		recent: {
			title: 'Recently updated',
			intro: 'Everything published, newest change first.',
			list() {
				return live().sort(newestFirst);
			},
			empty: {
				art: 'book',
				title: 'Nothing published yet',
				text: 'Articles show up here once they are published.',
				offerWrite: true,
			},
		},
	};

	const CALLOUT_KINDS = {
		tip: { tone: 'tip', icon: 'bi-lightbulb', label: 'Tip' },
		note: { tone: 'note', icon: 'bi-info-circle', label: 'Note' },
		warning: { tone: 'warning', icon: 'bi-exclamation-triangle', label: 'Watch out' },
	};

	/* Block types other than headings and paragraphs: a run of lines that
     start the same way becomes one block. */
	const BLOCK_KINDS = [
		{ opens: /^[-*]\s+/, render: bulletsHtml },
		{ opens: /^\d+[.)]\s+/, render: stepsHtml },
		{ opens: /^>/, render: calloutHtml },
		{ opens: /^\|/, render: tableHtml },
	];
	const ANY_BLOCK = /^(#{2,3}\s|[-*]\s|\d+[.)]\s|>|\|)/;
	const LINE_PREFIX = /^(#{2,3}|[-*]|\d+[.)]|>\s*(tip|note|warning):)\s*/i;

	/* What each formatting button puts at the start of a line. */
	const LINE_MARKERS = {
		h: { marker: '## ', sample: 'Section heading' },
		ul: { marker: '- ', sample: 'List item' },
		ol: { marker: '1. ', sample: 'First step' },
		tip: { marker: '> Tip: ', sample: 'Something worth knowing' },
		warning: { marker: '> Warning: ', sample: 'Something that can go wrong' },
	};

	const RANKING = [
		['title', 6],
		['tags', 4],
		['summary', 2],
		['collection', 1],
	];
	const AGE_BANDS = [
		{
			under: 14,
			words(days) {
				return `${days} days ago`;
			},
		},
		{
			under: 60,
			words(days) {
				return `${Math.round(days / 7)} weeks ago`;
			},
		},
		{
			under: 365,
			words(days) {
				return `${Math.round(days / 30.4)} months ago`;
			},
		},
	];
	const EDIT_NOTES = [
		'Tidied up the steps',
		'New screenshot of the board',
		'Fixed the reminder times',
		'Shorter, same meaning',
		'Checked it, nothing to change',
		'Added a tip from a support call',
		'New plan prices',
	];
	const NO_REASONS = ['It is out of date', 'A step is missing', 'Hard to follow', 'Not what I needed'];
	const POPULAR_SEARCHES = ['invoice', 'SMS', 'travel', 'refund'];
	const ICON_CHOICES = [
		'bi-folder',
		'bi-geo-alt',
		'bi-car-front',
		'bi-clipboard-check',
		'bi-lightning-charge',
		'bi-receipt',
		'bi-tools',
		'bi-megaphone',
	];
	const RESULT_KEYS = new Map([
		['ArrowDown', 'focus'],
		['Enter', 'click'],
	]);
	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Drawings for the empty states, inside a shared 160 by 120 frame. */
	const ILLUSTRATIONS = {
		book: '<rect class="basalt-illo-card" x="34" y="18" width="70" height="84" rx="8"/><rect class="basalt-illo-tone" x="34" y="18" width="14" height="84" rx="6"/><rect class="basalt-illo-mute" x="58" y="34" width="34" height="6" rx="3"/><rect class="basalt-illo-mute" x="58" y="48" width="26" height="5" rx="2.5"/><rect class="basalt-illo-mute" x="58" y="60" width="30" height="5" rx="2.5"/><circle cx="114" cy="30" r="12" class="basalt-illo-deep"/><path class="basalt-illo-stroke-paper" d="M114 24v12m-6-6h12"/>',
		search: '<rect class="basalt-illo-card" x="26" y="18" width="84" height="80" rx="10"/><rect class="basalt-illo-mute" x="38" y="32" width="46" height="6" rx="3"/><rect class="basalt-illo-mute" x="38" y="46" width="34" height="5" rx="2.5"/><rect class="basalt-illo-mute" x="38" y="59" width="40" height="5" rx="2.5"/><path class="basalt-illo-stroke-deep" d="M121 88l15 15"/><circle cx="106" cy="72" r="21" class="basalt-illo-glass"/><path class="basalt-illo-stroke-tone" d="M99 72h14"/>',
		star: '<rect class="basalt-illo-card" x="30" y="22" width="100" height="76" rx="10"/><path class="basalt-illo-tone" d="M80 36l7.6 15.4 17 2.5-12.3 12 2.9 16.9L80 74.8l-15.2 8 2.9-16.9-12.3-12 17-2.5z"/>',
		cloud: '<path class="basalt-illo-soft" d="M50 92a22 22 0 0 1-2-44 30 30 0 0 1 57-7 24 24 0 0 1 7 51z"/><path class="basalt-illo-tone" d="M56 84a15 15 0 0 1-1-30 21 21 0 0 1 40-5 17 17 0 0 1 5 35z"/><path class="basalt-illo-stroke-paper basalt-illo-stroke-wide" d="M46 30l68 68"/><path class="basalt-illo-stroke-deep" d="M46 30l68 68"/>',
		check: '<rect class="basalt-illo-card" x="30" y="20" width="100" height="78" rx="10"/><circle cx="80" cy="59" r="22" class="basalt-illo-tone"/><path class="basalt-illo-stroke-paper basalt-illo-stroke-wide" d="M70 59l7 7 14-14"/>',
	};

	const WRITE_BUTTON_ICON = '<i class="bi bi-pencil-square me-1" aria-hidden="true"></i>';
	const LOADING_MARKUP = `<div role="status" class="hb-loading" aria-busy="true" aria-label="Loading the handbook">${['title', 'text', 'text', 'block'].map((part) => `<span class="basalt-skeleton basalt-skeleton-${part}"></span>`).join('')}</div>`;

	/** Wires every listener once, then loads the handbook. */
	function start() {
		window.addEventListener('hashchange', () => handleRoute(true));
		wireClicks();
		wireTree();
		wireUnload();
		wireSearch();
		wireComposer();
		wireMoveForm();
		wireDelete();
		wireCollectionDialog();
		load();
	}

	/* Loading. Retry calls load() again, so it redraws the skeleton first. */

	function load() {
		stage.innerHTML = LOADING_MARKUP;
		server
			.fetchAll()
			.then((payload) => {
				store.people = payload.people || HANDBOOK.people;
				store.collections = payload.collections || [];
				store.articles = payload.articles || [];
				store.stars = new Set(payload.starred || []);
				store.ready = true;
				recount();
				fillPickers();
				handleRoute(false);
			})
			.catch((problem) => {
				showLoadError(problem.message || 'Something went wrong.');
				announce('The handbook did not load.');
			});
	}

	function showLoadError(message) {
		stage.innerHTML = emptyMarkup({
			tone: 'danger',
			art: 'cloud',
			title: 'The handbook did not load',
			text: `${htmlSafe(message)} Nothing is lost; the page just could not reach it.`,
			actions:
				'<button type="button" class="btn btn-primary btn-sm" data-hb-act="retry"><i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Try again</button>',
		});
		shelfTree.innerHTML = '<li class="hb-tree-note">Collections show here once the handbook loads.</li>';
		shelfTree.removeAttribute('aria-busy');
	}

	/* Routing. The address bar names the open view, so an article link can be
     shared and Back behaves:
       #home  #collection/<id>  #article/<id>  #view/<starred|review|drafts|recent> */

	function readHash() {
		const [head, key] = decodeURIComponent(window.location.hash.replace(/^#/, '')).split('/');
		if (key && HASH_VIEWS.has(head)) return { view: HASH_VIEWS.get(head), ref: key };
		return { view: 'home' };
	}

	function navigate(hash) {
		if (window.location.hash === hash) handleRoute(true);
		else window.location.hash = hash;
	}

	/** Draws the view the address bar names. `userMoved` sends focus to it. */
	function handleRoute(userMoved) {
		if (!store.ready || !leaveComposer()) return;
		store.place = readHash();
		if (store.terms) {
			store.terms = '';
			finder.value = '';
		}
		const { view, ref } = store.place;
		paint(VIEW_PAINTERS[view](ref));
		markNav();
		drawTree();
		const waiting = store.resume;
		store.resume = null;
		if (waiting && view === 'article' && ref === waiting.article.id) {
			openComposer(waiting);
			return;
		}
		if (userMoved) land();
	}

	function paint(markup) {
		stage.innerHTML = markup;
		stage.hidden = false;
		composer.hidden = true;
		window.Basalt.tips?.(stage);
		window.Basalt.buttons?.(stage);
	}

	/** After a move the visitor asked for: bring the view's top into sight and
      focus `target`, or the view heading when none is given. */
	function land(target) {
		const goal = target || pick('#hb-view-title', shell);
		if (layout.getBoundingClientRect().top < 0)
			layout.scrollIntoView({ block: 'start', behavior: calmMotion() ? 'auto' : 'smooth' });
		const stayInTree = treeDriven && window.innerWidth >= 1200 && !target;
		treeDriven = false;
		if (stayInTree) {
			/* Arrowing through the tree on a wide screen keeps focus in the tree. */
			if (goal) announce(goal.textContent.trim());
			return;
		}
		goal?.focus({ preventScroll: true });
		closeDrawer();
	}

	function markNav() {
		const { view, ref } = store.place;
		const lit = { home: 'home', list: ref }[view] || '';
		for (const link of pickAll('[data-hb-view-link]', shell)) {
			if (!store.terms && link.getAttribute('data-hb-view-link') === lit)
				link.setAttribute('aria-current', 'page');
			else link.removeAttribute('aria-current');
		}
	}

	function closeDrawer() {
		const drawer = pick('#hb-nav');
		if (!drawer || !window.bootstrap || window.innerWidth >= 1200) return;
		const offcanvas = window.bootstrap.Offcanvas.getInstance(drawer);
		if (!offcanvas || !drawer.classList.contains('show')) return;
		/* Bootstrap would hand focus back to Browse; the new view gets it instead. */
		drawer.addEventListener('hidden.bs.offcanvas', () => focusHeading(), { once: true });
		offcanvas.hide();
	}

	function focusHeading() {
		pick('#hb-view-title', shell)?.focus({ preventScroll: true });
	}

	/* Views. Each returns markup for the middle column. */

	function homeView() {
		const title = 'Handbook home';
		if (!store.articles.length) {
			return (
				headMarkup({ title, intro: 'Collections are ready. Nothing has been written yet.' }) +
				emptyMarkup({
					title: 'Your handbook is empty',
					text: 'Start with the question customers ask support about most. One short article beats ten planned ones.',
					actions: `<button type="button" class="btn btn-primary btn-sm" data-hb-act="new">${WRITE_BUTTON_ICON}Write the first article</button><button type="button" class="btn btn-outline-secondary btn-sm" data-hb-act="new-collection">Add a collection</button>`,
				})
			);
		}
		const latest = live().sort(newestFirst).slice(0, 5);
		const stale = pastReview().sort(oldestFirst).slice(0, 5);
		const staleBlock = stale.length
			? `<ul class="hb-list">${stale.map((article) => rowMarkup(article, { withoutPills: true })).join('')}</ul>`
			: '<div class="basalt-empty basalt-empty-compact"><h4 class="basalt-empty-title">Everything is current</h4><p class="basalt-empty-text">No article is past its review date.</p></div>';
		return [
			headMarkup({
				title,
				intro: 'Pick a collection or search above. Starred articles, your drafts and anything due for review have their own lists too.',
			}),
			`<ul class="hb-col-grid">${store.collections.map(collectionCard).join('')}</ul>`,
			'<div class="hb-home-lists">',
			'<section aria-labelledby="kbRecentTitle">',
			subHeadMarkup('kbRecentTitle', 'Recently updated', '#view/recent'),
			`<ul class="hb-list">${latest.map((article) => rowMarkup(article)).join('')}</ul>`,
			'</section>',
			'<section aria-labelledby="kbNeedsTitle">',
			subHeadMarkup('kbNeedsTitle', 'Due for review', stale.length ? '#view/review' : ''),
			staleBlock,
			'</section>',
			'</div>',
		].join('');
	}

	function subHeadMarkup(id, title, seeAll) {
		const link = seeAll ? `<a class="hb-link" href="${seeAll}">See all</a>` : '';
		return `<div class="hb-sub-head"><h3 class="hb-sub-title" id="${id}">${title}</h3>${link}</div>`;
	}

	function collectionCard(collection) {
		const inside = shelfOf(collection.id);
		const dueCount = inside.filter(
			(article) => article.status === 'published' && reviewStatus(article) === 'due',
		).length;
		const due = dueCount ? `<span class="hb-col-card-due">${dueCount} due for review</span>` : '';
		const size = inside.length ? countOf(inside.length, 'article') : 'Nothing yet';
		return (
			`<li><a href="#collection/${encodeURIComponent(collection.id)}" class="hb-col-card">` +
			`<span aria-hidden="true" class="hb-col-card-icon hb-tone-${toneFor(collection.id)}"><i class="bi ${htmlSafe(collection.icon)}"></i></span>` +
			`<span class="hb-col-card-name">${htmlSafe(collection.name)}</span>` +
			`<span class="hb-col-card-desc">${htmlSafe(collection.desc || '')}</span>` +
			`<span class="hb-col-card-meta">${avatarMarkup(collection.owner)}<span>${size}</span>${due}</span></a></li>`
		);
	}

	function collectionView(collectionId) {
		const collection = collectionById(collectionId);
		if (!collection) return notFoundView('That collection is not in the handbook any more.');
		const sort = SORT_OPTIONS.find((option) => option.value === store.sortBy) || SORT_OPTIONS[0];
		const inside = shelfOf(collectionId).sort(sort.compare);
		function writeHere(label, icon) {
			return `<button type="button" class="btn btn-primary btn-sm" data-hb-act="new" data-hb-col="${htmlSafe(collection.id)}"><i class="bi ${icon} me-1" aria-hidden="true"></i>${label}</button>`;
		}
		const head = headMarkup({
			title: htmlSafe(collection.name),
			intro: `${htmlSafe(collection.desc || '')} <span class="hb-view-owner">${avatarMarkup(collection.owner)}Kept up by ${htmlSafe(who(collection.owner).name)}</span>`,
			actions: writeHere('Write one here', 'bi-plus-lg'),
			icon: collection.icon,
			tone: toneFor(collection.id),
		});
		if (!inside.length) {
			return (
				head +
				emptyMarkup({
					title: `Nothing in ${htmlSafe(collection.name)} yet`,
					text: 'Write the first article here, or move one in from another collection.',
					actions: writeHere('Write the first one', 'bi-pencil-square'),
				})
			);
		}
		const options = SORT_OPTIONS.map(
			(option) =>
				`<option value="${option.value}"${option.value === store.sortBy ? ' selected' : ''}>${option.label}</option>`,
		).join('');
		return (
			`${head}<div class="hb-list-tools">` +
			`<p class="hb-list-count" aria-live="polite">${countOf(inside.length, 'article')}</p>` +
			'<label class="visually-hidden" for="hb-col-sort">Sort articles</label>' +
			`<select id="hb-col-sort" class="form-select form-select-sm hb-sort" data-hb-col-sort>${options}</select>` +
			`</div><ul class="hb-list">${inside.map((article) => rowMarkup(article, { withoutCollection: true })).join('')}</ul>`
		);
	}

	function shelfView(name) {
		const shelf = Object.hasOwn(SHELVES, name) ? SHELVES[name] : null;
		if (!shelf) return notFoundView('That list does not exist.');
		const articles = shelf.list();
		const head = headMarkup({ title: shelf.title, intro: shelf.intro });
		if (articles.length) {
			return `${head}<p class="hb-list-count">${countOf(articles.length, 'article')}</p><ul class="hb-list">${articles.map((article) => rowMarkup(article)).join('')}</ul>`;
		}
		const { art, title, text, offerWrite } = shelf.empty;
		return (
			head +
			emptyMarkup({
				art,
				title,
				text,
				actions: offerWrite
					? `<button type="button" class="btn btn-primary btn-sm" data-hb-act="new">${WRITE_BUTTON_ICON}Write an article</button>`
					: '',
			})
		);
	}

	function resultsView(query) {
		const { terms, matches } = findMatches(query);
		const asked = htmlSafe(query.trim());
		const perCollection = {};
		for (const match of matches)
			perCollection[match.article.collection] = (perCollection[match.article.collection] || 0) + 1;
		if (store.resultFilter !== 'all' && !perCollection[store.resultFilter]) store.resultFilter = 'all';
		const head = headMarkup({
			title: `Results for “${asked}”`,
			intro: matches.length ? `${countOf(matches.length, 'article')} match. Titles come first.` : '',
		});
		if (!matches.length) {
			const suggestions = POPULAR_SEARCHES.map(
				(word) =>
					`<button type="button" class="hb-try" data-hb-try="${htmlSafe(word)}">${htmlSafe(word)}</button>`,
			).join(' ');
			return (
				head +
				emptyMarkup({
					art: 'search',
					title: `Nothing in the handbook matches “${asked}”`,
					text: 'Check the spelling or try fewer words. If it should be written down, write it.',
					actions: `<button type="button" class="btn btn-primary btn-sm" data-hb-act="new-from-search">${WRITE_BUTTON_ICON}Write “${htmlSafe(query.trim().slice(0, 40))}”</button><button type="button" class="btn btn-outline-secondary btn-sm" data-hb-act="clear-search">Clear search</button>`,
					hint: `People often look for: ${suggestions}`,
				})
			);
		}
		function chip(value, label, count) {
			return `<button type="button" class="hb-chip" aria-pressed="${store.resultFilter === value}" data-hb-search-col="${htmlSafe(value)}">${label} <span class="hb-chip-n">${count}</span></button>`;
		}
		const chips = [chip('all', 'All', matches.length)];
		for (const collection of store.collections) {
			if (perCollection[collection.id])
				chips.push(chip(collection.id, htmlSafe(collection.name), perCollection[collection.id]));
		}
		const shown =
			store.resultFilter === 'all'
				? matches
				: matches.filter((match) => match.article.collection === store.resultFilter);
		return (
			`${head}<div role="group" class="hb-chips" aria-label="Show results from">${chips.join('')}</div>` +
			`<ul class="hb-list hb-list-results" data-hb-results>${shown.map((match) => rowMarkup(match.article, { terms, excerptText: match.excerpt })).join('')}</ul>`
		);
	}

	function articleView(articleId) {
		const article = findArticle(articleId);
		if (!article || (article.status === 'draft' && article.owner !== USER)) {
			return notFoundView('It may have been deleted or moved. Search for it, or start from the collections.');
		}
		const home = collectionById(article.collection) || { name: 'No collection', icon: 'bi-folder' };
		const prose = bodyToHtml(article.body) || '<p class="hb-quiet">This article has no text yet.</p>';
		return [
			'<article class="hb-article" aria-labelledby="hb-view-title">',
			`<nav class="hb-crumbs" aria-label="Where this article lives"><a href="#collection/${encodeURIComponent(article.collection)}"><i class="bi ${htmlSafe(home.icon)}" aria-hidden="true"></i>${htmlSafe(home.name)}</a></nav>`,
			articleHeadMarkup(article),
			bannerFor(article),
			`<div class="hb-prose" data-hb-prose>${prose}</div>`,
			tagsMarkup(article.tags),
			article.status === 'published' ? feedbackMarkup(article) : '',
			relatedMarkup(article, home),
			'</article>',
		].join('');
	}

	function articleHeadMarkup(article) {
		const owner = who(article.owner);
		const starred = store.stars.has(article.id);
		const listed = article.status === 'published';
		function toolButton(action, icon, label) {
			return `<button type="button" class="btn btn-sm btn-outline-secondary" data-hb-act="${action}"><i class="bi ${icon} me-1" aria-hidden="true"></i>${label}</button>`;
		}
		function menuItem(action, icon, label, extra = '') {
			return `<li><button type="button" class="dropdown-item${extra}" data-hb-act="${action}"><i class="bi ${icon}" aria-hidden="true"></i>${label}</button></li>`;
		}
		const menu = [
			menuItem('move', 'bi-folder-symlink', 'Move to another collection'),
			listed ? menuItem('reviewed', 'bi-calendar-check', 'Mark as reviewed') : '',
			menuItem('print', 'bi-printer', 'Print'),
			'<li><hr class="dropdown-divider"></li>',
			menuItem('delete', 'bi-trash3', 'Delete', ' hb-danger-item'),
		].join('');
		const titleRow =
			`<div class="hb-article-titlerow"><h2 class="hb-article-title" id="hb-view-title" tabindex="-1">${htmlSafe(article.title)}</h2>` +
			`<button type="button" class="btn btn-icon hb-star" data-hb-act="star" aria-label="Star this article" aria-pressed="${starred}" data-bs-toggle="tooltip" data-bs-title="${starred ? 'Starred' : 'Star it'}"><i class="bi ${starred ? 'bi-star-fill' : 'bi-star'}" aria-hidden="true"></i></button></div>`;
		const role = owner.role ? `, ${htmlSafe(owner.role.toLowerCase())}` : '';
		const meta =
			'<div class="hb-article-meta">' +
			`<span class="hb-article-owner">${avatarMarkup(article.owner, 'sm')}<span><span class="hb-article-who">${htmlSafe(owner.name)}</span><span class="hb-article-role">Owner${role}</span></span></span>` +
			`<span class="hb-article-fact"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i>${article.status === 'draft' ? 'Saved ' : 'Updated '}<time datetime="${article.updated}">${htmlSafe(shortDate(article.updated))}</time></span>` +
			`<span class="hb-article-fact"><i class="bi bi-clock" aria-hidden="true"></i>${minutesToRead(article)} min read</span>${pills(article)}</div>`;
		const actions =
			`<div class="hb-article-actions" role="toolbar" aria-label="Article actions">${toolButton(
				'edit',
				'bi-pencil',
				'Edit',
			)}${toolButton('copy-link', 'bi-link-45deg', 'Copy link')}${toolButton(
				'history',
				'bi-clock-history',
				`History <span class="hb-btn-n">${article.history.length}</span>`,
			)}<div class="dropdown"><button type="button" class="btn btn-sm btn-outline-secondary" aria-label="More actions" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-three-dots" aria-hidden="true"></i></button>` +
			`<ul class="dropdown-menu dropdown-menu-end">${menu}</ul></div></div>`;
		const summary = article.summary ? `<p class="hb-article-summary">${htmlSafe(article.summary)}</p>` : '';
		return `<header class="hb-article-head">${titleRow}${summary}${meta}${actions}</header>`;
	}

	/** The strip under an article's head: drafts say who can see them, and
      anything near or past its review date says so. */
	function bannerFor(article) {
		function strip(tone, icon, message, buttons) {
			return `<div class="hb-banner hb-banner-${tone}" role="note"><i class="bi ${icon}" aria-hidden="true"></i><p>${message}</p><div class="hb-banner-actions">${buttons}</div></div>`;
		}
		if (article.status === 'draft') {
			return strip(
				'info',
				'bi-eye-slash',
				`<strong>Draft.</strong> Only you can see this. Saved ${htmlSafe(relativeAge(article.updated))}.`,
				'<button type="button" class="btn btn-sm btn-primary" data-hb-act="publish">Publish</button><button type="button" class="btn btn-sm btn-outline-secondary" data-hb-act="edit">Keep writing</button>',
			);
		}
		const status = reviewStatus(article);
		if (status === 'ok') return '';
		const owner = htmlSafe(firstName(article.owner));
		const message =
			status === 'due'
				? `<strong>Due for review.</strong> Last checked ${htmlSafe(relativeAge(article.updated))}. Some of this may be out of date; ask ${owner} if in doubt.`
				: `<strong>Review coming up.</strong> ${owner} is due to check this by ${htmlSafe(shortDate(reviewDate(article)))}.`;
		return strip(
			'warning',
			'bi-calendar-check',
			message,
			'<button type="button" class="btn btn-sm btn-outline-secondary" data-hb-act="reviewed"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Mark as reviewed</button>',
		);
	}

	function tagsMarkup(tags) {
		if (!tags.length) return '';
		const buttons = tags.map(
			(tag) =>
				`<button type="button" class="hb-tag" aria-label="Search for ${htmlSafe(tag)}" data-hb-tag="${htmlSafe(tag)}">${htmlSafe(tag)}</button>`,
		);
		return `<div class="hb-tags"><span class="hb-tags-label">Tags</span>${buttons.join('')}</div>`;
	}

	/** Up to three published neighbors, the ones sharing most tags first. */
	function relatedMarkup(article, home) {
		function tagOverlap(other) {
			return other.tags.filter((tag) => article.tags.includes(tag)).length;
		}
		const neighbors = shelfOf(article.collection)
			.filter((other) => other.status === 'published')
			.sort(byTitle)
			.filter((other) => other.id !== article.id)
			.sort((left, right) => tagOverlap(right) - tagOverlap(left) || mostRead(left, right))
			.slice(0, 3);
		if (!neighbors.length) return '';
		const cards = neighbors.map(
			(other) =>
				`<li><a class="hb-related-card" href="#article/${encodeURIComponent(other.id)}"><span class="hb-related-title">${htmlSafe(other.title)}</span><span class="hb-related-meta">${minutesToRead(other)} min read · ${htmlSafe(who(other.owner).name)}</span></a></li>`,
		);
		return `<section class="hb-related" aria-labelledby="hb-related-title"><h3 class="hb-sub-title" id="hb-related-title">More in ${htmlSafe(home.name)}</h3><ul class="hb-related-list">${cards.join('')}</ul></section>`;
	}

	/** The "did this answer your question" box, in whichever of its three
      states the visitor's answer has reached. */
	function feedbackMarkup(article) {
		const answer = store.answers[article.id] || {};
		const { yes, no } = article.helpful;
		const total = yes + no;
		const tally = total
			? `${yes} of ${total}${total === 1 ? ' person' : ' people'} said yes`
			: 'Be the first to say';
		const owner = htmlSafe(firstName(article.owner));
		let body;
		if (answer.sent || answer.vote === 'yes') {
			const thanks =
				answer.vote === 'yes'
					? 'Thanks. Good to know it helped.'
					: `Thanks. ${owner} has your note and will look at it.`;
			body = `<p class="hb-helpful-done" tabindex="-1" data-hb-helpful-done><i class="bi bi-check2-circle" aria-hidden="true"></i>${thanks} <button type="button" class="hb-link-btn" data-hb-act="unvote">Change answer</button></p>`;
		} else if (answer.vote === 'no') {
			const reasons = NO_REASONS.map(
				(reason, position) =>
					`<label class="basalt-choice"><input type="radio" name="hb-why" value="${htmlSafe(reason)}"${position === 0 ? ' checked' : ''}>${htmlSafe(reason)}</label>`,
			).join('');
			body =
				'<form class="hb-helpful-more" data-hb-helpful-form novalidate>' +
				`<fieldset><legend class="hb-helpful-legend">What was wrong with it?</legend><div class="basalt-choices basalt-choices-compact">${reasons}</div></fieldset>` +
				'<label class="form-label" for="hb-helpful-note">Anything to add? <span class="hb-optional">optional</span></label>' +
				'<textarea id="hb-helpful-note" class="form-control" rows="2" maxlength="400" placeholder="The cut-off moved to 12:30 pm in September"></textarea>' +
				'<div class="hb-helpful-send"><button type="submit" class="btn btn-sm btn-primary btn-loading">' +
				`<span class="btn-loading-state btn-loading-idle">Send to ${owner}</span>` +
				'<span class="btn-loading-state btn-loading-busy"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Sending</span>' +
				'<span class="btn-loading-state btn-loading-done"><i class="bi bi-check2" aria-hidden="true"></i>Sent</span>' +
				'</button><button type="button" class="btn btn-sm btn-outline-secondary" data-hb-act="unvote">Cancel</button></div></form>';
		} else {
			function choice(value, icon, label) {
				return `<button class="btn btn-sm btn-outline-secondary" data-hb-vote="${value}" type="button"><i class="bi ${icon} me-1" aria-hidden="true"></i>${label}</button>`;
			}
			body = `<div class="hb-helpful-btns">${choice('yes', 'bi-hand-thumbs-up', 'Yes')}${choice('no', 'bi-hand-thumbs-down', 'No')}</div>`;
		}
		return `<section class="hb-helpful" aria-labelledby="hb-helpful-title" data-hb-helpful><div class="hb-helpful-ask"><h3 class="hb-helpful-title" id="hb-helpful-title">Did this answer your question?</h3><p class="hb-helpful-count">${tally}</p></div>${body}</section>`;
	}

	function notFoundView(reason) {
		return (
			headMarkup({ title: 'Article not found', intro: '' }) +
			emptyMarkup({
				art: 'search',
				title: 'We could not find that page',
				text: htmlSafe(reason),
				actions: '<a class="btn btn-primary btn-sm" href="#home">Back to the handbook</a>',
			})
		);
	}

	/* Pieces the views share. */

	function headMarkup({ title, intro, actions, icon, tone }) {
		const badge = icon
			? `<span aria-hidden="true" class="hb-view-icon hb-tone-${tone || 1}"><i class="bi ${htmlSafe(icon)}"></i></span>`
			: '';
		const text = `<div class="hb-view-text"><h2 class="hb-view-title" id="hb-view-title" tabindex="-1">${title}</h2>${intro ? `<p class="hb-view-desc">${intro}</p>` : ''}</div>`;
		return `<header class="hb-view-head">${badge}${text}${actions ? `<div class="hb-view-actions">${actions}</div>` : ''}</header>`;
	}

	function emptyMarkup({ tone, art, title, text, actions, hint }) {
		const drawing = `<svg class="basalt-illo" viewBox="0 0 160 120" aria-hidden="true" focusable="false"><ellipse class="basalt-illo-shadow" cx="80" cy="110" rx="46" ry="5"/>${ILLUSTRATIONS[art || 'book']}</svg>`;
		return (
			`<div class="basalt-empty basalt-empty-framed hb-empty${tone ? ` basalt-empty-${tone}` : ''}">` +
			`<div class="basalt-empty-art">${drawing}</div>` +
			`<h3 class="basalt-empty-title">${title}</h3><p class="basalt-empty-text">${text}</p>${
				actions ? `<div class="basalt-empty-actions">${actions}</div>` : ''
			}${hint ? `<p class="basalt-empty-hint">${hint}</p>` : ''}</div>`
		);
	}

	/** One article as a list row. `terms` marks search words, `excerptText`
      replaces the summary, and the two flags trim the meta line and pills. */
	function rowMarkup(article, { terms = [], excerptText, withoutCollection, withoutPills } = {}) {
		const home = collectionById(article.collection);
		const subline = markTerms(excerptText || article.summary || '', terms);
		const meta = [];
		if (home && !withoutCollection) meta.push(htmlSafe(home.name));
		meta.push(`${article.status === 'draft' ? 'Saved ' : 'Updated '}${htmlSafe(relativeAge(article.updated))}`);
		meta.push(htmlSafe(who(article.owner).name));
		if (terms.length && article.tags.length) meta.push(markTerms(article.tags.join(', '), terms));
		return [
			`<li class="hb-row"><a href="#article/${encodeURIComponent(article.id)}" class="hb-row-link" data-hb-result>`,
			`<span aria-hidden="true" class="hb-row-icon hb-tone-${toneFor(article.collection)}"><i class="bi ${htmlSafe(home ? home.icon : 'bi-file-text')}"></i></span>`,
			`<span class="hb-row-main"><span class="hb-row-title">${markTerms(article.title, terms)}</span>`,
			subline ? `<span class="hb-row-sub">${subline}</span>` : '',
			`<span class="hb-row-meta">${meta.map((part) => `<span>${part}</span>`).join('')}</span></span>`,
			withoutPills ? '' : `<span class="hb-row-pills">${pills(article)}</span>`,
			'</a></li>',
		].join('');
	}

	function pills(article) {
		if (article.status === 'draft')
			return '<span class="basalt-status basalt-status-info basalt-status-dot">Draft</span>';
		if (reviewStatus(article) === 'due')
			return '<span class="basalt-status basalt-status-warning basalt-status-dot">Due for review</span>';
		return '';
	}

	function avatarMarkup(personId, size = 'xs') {
		const person = who(personId);
		return `<span aria-hidden="true" class="basalt-avatar basalt-avatar-${size} basalt-avatar-tone-${person.tone}">${htmlSafe(monogram(person.name))}</span>`;
	}

	/* Collections take the chart colors in the order they are listed. */
	function toneFor(collectionId) {
		return (
			(Math.max(
				0,
				store.collections.findIndex((collection) => collection.id === collectionId),
			) %
				8) +
			1
		);
	}

	/* The tree on the left: collections are folders, articles are leaves. The
     shared Basalt.tree widget adds arrows, Home and End and type-ahead. */

	function drawTree() {
		const expanded = new Set(
			pickAll('[data-hb-col][aria-expanded="true"]', shelfTree).map((node) => node.getAttribute('data-hb-col')),
		);
		const { view, ref } = store.place;
		const reading = view === 'article' ? findArticle(ref) : null;
		if (reading) expanded.add(reading.collection);
		if (view === 'collection') expanded.add(ref);
		const { collections } = store;
		if (!treeWidget && !expanded.size && collections[0]) expanded.add((collections[1] || collections[0]).id);
		const held = document.activeElement;
		const focusedKey = shelfTree.contains(held)
			? held.getAttribute('data-hb-art') || held.getAttribute('data-hb-col')
			: null;

		shelfTree.innerHTML =
			collections
				.map((collection) =>
					folderMarkup(
						collection,
						expanded.has(collection.id),
						view === 'collection' && ref === collection.id,
						reading,
					),
				)
				.join('') || '<li class="hb-tree-note">No collections yet.</li>';
		shelfTree.removeAttribute('aria-busy');

		if (treeWidget) treeWidget.refresh();
		else if (window.Basalt.tree) treeWidget = window.Basalt.tree(shelfTree);

		/* The single tab stop follows the open article or collection. */
		const chosen = pick('[aria-selected="true"]', shelfTree);
		if (chosen) {
			for (const node of pickAll('[role="treeitem"]', shelfTree)) node.tabIndex = node === chosen ? 0 : -1;
		}
		if (!focusedKey) return;
		const again = pick(`[data-hb-art="${focusedKey}"], [data-hb-col="${focusedKey}"]`, shelfTree);
		if (again && treeWidget) treeWidget.focusItem(again);
	}

	function folderMarkup(collection, open, selected, reading) {
		const leaves = shelfOf(collection.id)
			.sort(byTitle)
			.map((article) => {
				const draft = article.status === 'draft';
				return (
					`<li role="treeitem" aria-selected="${reading === article}" data-hb-art="${htmlSafe(article.id)}"><div class="basalt-tree-row">` +
					`<i class="bi ${draft ? 'bi-pencil' : 'bi-file-text'} basalt-tree-icon" aria-hidden="true"></i><span class="basalt-tree-label">${htmlSafe(article.title)}</span>` +
					`${draft ? '<span class="basalt-tree-meta">Draft</span>' : ''}</div></li>`
				);
			})
			.join('');
		return (
			`<li role="treeitem" aria-expanded="${open}" aria-selected="${selected}" data-hb-col="${htmlSafe(collection.id)}"><div class="basalt-tree-row">` +
			`<i class="bi ${htmlSafe(collection.icon)} basalt-tree-icon" aria-hidden="true"></i><span class="basalt-tree-label">${htmlSafe(collection.name)}</span><span class="basalt-tree-count"></span>` +
			`</div><ul role="group"${open ? '' : ' hidden'}>${leaves}</ul></li>`
		);
	}

	function recount() {
		const tallies = {
			starred: readable().filter((article) => store.stars.has(article.id)).length,
			review: pastReview().length,
			drafts: ownDrafts().length,
		};
		for (const [key, total] of Object.entries(tallies)) {
			for (const badge of pickAll(`[data-hb-count="${key}"]`, shell)) badge.textContent = String(total);
		}
	}

	function wireTree() {
		shelfTree.addEventListener('basalt:tree-select', (event) => {
			const node = event.detail.item;
			const articleId = node.getAttribute('data-hb-art');
			const collectionId = node.getAttribute('data-hb-col');
			treeDriven = true;
			if (articleId) navigate(`#article/${encodeURIComponent(articleId)}`);
			else if (collectionId) navigate(`#collection/${encodeURIComponent(collectionId)}`);
		});
	}

	/* Clicks anywhere in the handbook, routed by the data attribute they hit;
     the first selector in `routes` that matches wins. */

	function wireClicks() {
		const routes = [
			['[data-hb-vote]', (hit) => castVote(hit.getAttribute('data-hb-vote'))],
			['[data-hb-search-col]', filterResults],
			['[data-hb-tag]', (hit) => lookUp(hit.getAttribute('data-hb-tag'))],
			['[data-hb-try]', (hit) => lookUp(hit.getAttribute('data-hb-try'))],
			['[data-hb-act]', doAction],
		];
		shell.addEventListener('click', (event) => {
			for (const [selector, handle] of routes) {
				const hit = event.target.closest(selector);
				if (hit) {
					handle(hit);
					return;
				}
			}
			/* The link for the view already open still has to clear a search. */
			const link = event.target.closest('a[href^="#"]');
			if (link && store.terms && link.getAttribute('href') === window.location.hash) {
				event.preventDefault();
				handleRoute(true);
			}
		});
		shell.addEventListener('submit', (event) => {
			if (!event.target.matches('[data-hb-helpful-form]')) return;
			event.preventDefault();
			sendNoVote(event.target);
		});
		shell.addEventListener('change', (event) => {
			if (event.target.matches('[data-hb-col-sort]')) resort(event.target.value);
		});

		/* Write an article also answers the N key (data-basalt-shortcut) and /
       jumps to search. Opening waits a tick so the key is not typed. */
		pick('[data-hb-new]').addEventListener('click', () => setTimeout(() => openComposer({}), 0));
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
			const { target } = event;
			if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
			if (pick('.modal.show') || !composer.hidden) return;
			event.preventDefault();
			focusFinder();
		});
		pick('[data-hb-new-collection]').addEventListener('click', showCollectionDialog);
	}

	/* The handlers behind data-hb-act, keyed by its value. */
	const ACTIONS = {
		star: flipStar,
		edit() {
			const article = openArticle();
			if (article) openComposer({ article });
		},
		'copy-link': shareLink,
		history: showHistory,
		move: askMove,
		reviewed: markReviewed,
		delete: askDelete,
		print() {
			window.print();
		},
		publish() {
			const article = openArticle();
			if (article) publishDraft(article);
		},
		unvote: withdrawVote,
		new(button) {
			openComposer({ collection: button.getAttribute('data-hb-col') });
		},
		'new-from-search'() {
			const asked = store.terms.trim();
			finder.value = '';
			store.terms = '';
			openComposer({ title: asked.charAt(0).toUpperCase() + asked.slice(1) });
		},
		'clear-search'() {
			finder.value = '';
			applySearch();
			finder.focus();
		},
		'new-collection': showCollectionDialog,
		retry: load,
	};

	function doAction(button) {
		const action = button.getAttribute('data-hb-act');
		if (Object.hasOwn(ACTIONS, action)) ACTIONS[action](button);
	}

	function resort(value) {
		store.sortBy = value;
		paint(collectionView(store.place.ref));
		const picker = pick('[data-hb-col-sort]', stage);
		const enhanced = picker && pick('.basalt-select-button, button', picker.parentElement);
		(enhanced || picker || stage).focus();
	}

	function showCollectionDialog() {
		window.bootstrap.Modal.getOrCreateInstance(pick('#hb-collection-modal')).show();
	}

	/* Actions on the open article. */

	function openArticle() {
		return store.place.view === 'article' ? findArticle(store.place.ref) : null;
	}

	/* Redraw after an in-place change and put focus back on the title. */
	function refreshAfterChange() {
		handleRoute();
		recount();
		focusHeading();
	}

	function flipStar(button) {
		const article = openArticle();
		if (!article) return;
		const starred = !store.stars.has(article.id);
		if (starred) store.stars.add(article.id);
		else store.stars.delete(article.id);
		server.putStar(article.id, starred);
		button.setAttribute('aria-pressed', String(starred));
		pick('.bi', button).className = `bi ${starred ? 'bi-star-fill' : 'bi-star'}`;
		window.bootstrap?.Tooltip.getInstance(button)?.setContent({
			'.tooltip-inner': starred ? 'Starred' : 'Star it',
		});
		recount();
		announce(starred ? 'Starred. It is under Starred on the left.' : 'Taken out of Starred.');
	}

	function shareLink() {
		const article = openArticle();
		if (!article) return;
		const address = `${window.location.href.split('#')[0]}#article/${encodeURIComponent(article.id)}`;
		window.Basalt.copyText?.(address).then(
			() =>
				notify({
					tone: 'success',
					icon: 'bi-link-45deg',
					title: 'Link copied',
					text: 'Anyone on the team can open it.',
					duration: 3000,
				}),
			() => notify({ tone: 'danger', title: 'Could not copy', text: address }),
		);
	}

	function markReviewed() {
		const article = openArticle();
		if (!article || article.status !== 'published') return;
		const earlier = { updated: article.updated, history: article.history.slice() };
		article.updated = HANDBOOK.today;
		article.history.unshift({ who: USER, when: HANDBOOK.today, note: 'Checked it, nothing to change' });
		server.putArticle(article);
		refreshAfterChange();
		notify({
			tone: 'success',
			title: 'Marked as reviewed',
			text: `Next review ${shortDate(reviewDate(article))}.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						Object.assign(article, earlier);
						server.putArticle(article);
						recount();
						if (openArticle() === article) handleRoute();
					},
				},
			],
		});
	}

	function publishDraft(article) {
		if (article.status !== 'draft') return;
		const earlier = { updated: article.updated, history: article.history.slice() };
		article.status = 'published';
		article.updated = HANDBOOK.today;
		article.history.unshift({ who: USER, when: HANDBOOK.today, note: 'Published' });
		server.putArticle(article);
		refreshAfterChange();
		notify({
			tone: 'success',
			title: 'Published',
			text: `“${article.title}” is in ${(collectionById(article.collection) || { name: 'the handbook' }).name} and in search.`,
			actions: [
				{
					label: 'Undo',
					onClick() {
						Object.assign(article, { status: 'draft' }, earlier);
						server.putArticle(article);
						recount();
						if (openArticle() === article) handleRoute();
						else drawTree();
					},
				},
			],
		});
	}

	function showHistory() {
		const article = openArticle();
		if (!article) return;
		pick('[data-hb-history-sub]').textContent = `${article.title}. Newest first.`;
		pick('[data-hb-history]').innerHTML = article.history
			.map((entry, position) => {
				const current =
					position === 0 ? ' <span class="basalt-status basalt-status-primary">Current</span>' : '';
				return (
					`<li class="hb-history-item">${avatarMarkup(entry.who)}<div><p class="hb-history-note">${htmlSafe(entry.note)}${current}</p>` +
					`<p class="hb-history-meta">${htmlSafe(who(entry.who).name)} · <time datetime="${entry.when}">${htmlSafe(shortDate(entry.when))}</time></p></div></li>`
				);
			})
			.join('');
		window.bootstrap.Offcanvas.getOrCreateInstance(pick('#hb-history')).show();
	}

	/* Moving offers every collection as a tile, the current one marked Now. */
	function askMove() {
		const article = openArticle();
		if (!article) return;
		const from = collectionById(article.collection) || { name: 'no collection' };
		pick('[data-hb-move-sub]').textContent = `“${article.title}” is in ${from.name}. Links to it keep working.`;
		pick('[data-hb-move-choices]').innerHTML = store.collections
			.map((collection) => {
				const here = collection.id === article.collection;
				return (
					`<label class="basalt-choice"><input type="radio" name="hb-move" value="${htmlSafe(collection.id)}"${here ? ' checked' : ''}>` +
					`<i class="bi ${htmlSafe(collection.icon)}" aria-hidden="true"></i>${htmlSafe(collection.name)}${here ? '<span class="basalt-choice-hint">Now</span>' : ''}</label>`
				);
			})
			.join('');
		window.bootstrap.Modal.getOrCreateInstance(pick('#hb-move-modal')).show();
	}

	function wireMoveForm() {
		const form = pick('[data-hb-move-form]');
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const article = openArticle();
			const chosen = pick('input[name="hb-move"]:checked', form);
			window.bootstrap.Modal.getOrCreateInstance(pick('#hb-move-modal')).hide();
			if (!article || !chosen || chosen.value === article.collection) return;
			const previous = article.collection;
			article.collection = chosen.value;
			server.putArticle(article);
			refreshAfterChange();
			notify({
				tone: 'success',
				title: `Moved to ${collectionById(article.collection).name}`,
				actions: [
					{
						label: 'Undo',
						onClick() {
							article.collection = previous;
							server.putArticle(article);
							if (openArticle() === article) handleRoute();
							else drawTree();
						},
					},
				],
			});
		});
	}

	/* Deleting takes a press and hold; Undo then puts the article back in its
     old place. */
	function askDelete() {
		const article = openArticle();
		if (!article) return;
		pick('[data-hb-del-title]').textContent = `Delete “${article.title}”?`;
		pick('[data-hb-del-text]').textContent =
			article.status === 'draft'
				? 'Nobody else has seen it. You can undo this for a few seconds afterwards.'
				: `It comes out of the handbook and out of search for everyone. ${countOf(article.views, 'person has', 'people have')} read it.`;
		window.bootstrap.Modal.getOrCreateInstance(pick('#hb-delete-modal')).show();
	}

	function wireDelete() {
		pick('[data-hb-del-hold]').addEventListener('basalt:confirm', () => {
			const article = openArticle();
			window.bootstrap.Modal.getOrCreateInstance(pick('#hb-delete-modal')).hide();
			if (article) removeArticle(article);
		});
	}

	function removeArticle(article) {
		const slot = store.articles.indexOf(article);
		const wasStarred = store.stars.has(article.id);
		server.removeArticle(article.id).then(() => {
			store.articles.splice(slot, 1);
			store.stars.delete(article.id);
			recount();
			navigate(`#collection/${encodeURIComponent(article.collection)}`);
			notify({
				tone: 'info',
				icon: 'bi-trash3',
				title: `Deleted “${article.title}”`,
				duration: 8000,
				actions: [
					{
						label: 'Undo',
						onClick() {
							store.articles.splice(Math.min(slot, store.articles.length), 0, article);
							if (wasStarred) store.stars.add(article.id);
							server.putArticle(article);
							recount();
							navigate(`#article/${encodeURIComponent(article.id)}`);
						},
					},
				],
			});
		});
	}

	/* "Did this answer your question?" A yes counts at once; a no opens a
     short form and counts once it is sent. */

	function castVote(choice) {
		const article = openArticle();
		if (!article) return;
		store.answers[article.id] = { vote: choice, sent: false };
		if (choice === 'yes') {
			article.helpful.yes += 1;
			server.postFeedback(article.id, { vote: 'yes' });
		}
		redrawFeedback(article);
	}

	function withdrawVote() {
		const article = openArticle();
		if (!article) return;
		const answer = store.answers[article.id];
		if (answer?.vote === 'yes') article.helpful.yes -= 1;
		if (answer?.vote === 'no' && answer.sent) article.helpful.no -= 1;
		delete store.answers[article.id];
		redrawFeedback(article);
	}

	function sendNoVote(form) {
		const article = openArticle();
		if (!article) return;
		const reason = pick('input[name="hb-why"]:checked', form)?.value;
		const note = pick('textarea', form).value.trim();
		setButtonState(pick('[type="submit"]', form), 'loading');
		server.postFeedback(article.id, { vote: 'no', reason, note }).then(() => {
			article.helpful.no += 1;
			store.answers[article.id] = { vote: 'no', sent: true };
			redrawFeedback(article);
		});
	}

	function redrawFeedback(article) {
		const box = pick('[data-hb-helpful]', stage);
		if (!box) return;
		box.outerHTML = feedbackMarkup(article);
		const fresh = pick('[data-hb-helpful]', stage);
		window.Basalt.buttons?.(fresh);
		const next =
			pick('[data-hb-helpful-done]', fresh) ||
			pick('input[name="hb-why"]:checked', fresh) ||
			pick('[data-hb-vote="yes"]', fresh);
		next?.focus();
	}

	/* The editor: one form for new articles, drafts and edits. Walking away
     with unsaved writing keeps it as a draft, so nothing typed is lost. */

	/** Opens the editor. `request` carries an `article` to edit, or a
      `collection` and `title` for a new one, plus saved `values` to restore. */
	function openComposer(request = {}) {
		if (!leaveComposer()) return;
		const { article } = request;
		const collectionId = article
			? article.collection
			: request.collection ||
				(store.place.view === 'collection' ? store.place.ref : openArticle()?.collection) ||
				store.collections[0]?.id;
		fillPickers();
		fields.title.value = article ? article.title : request.title || '';
		fields.collection.value = collectionId;
		fields.owner.value = article ? article.owner : collectionById(collectionId)?.owner || USER;
		fields.review.value = String(article ? article.review || 6 : 6);
		fields.summary.value = article ? article.summary || '' : '';
		fields.body.value = article ? article.body : '';
		writeTags(article ? article.tags.slice() : []);
		ownerChosen = Boolean(article);
		switchMode('write');
		composer.classList.remove('was-validated');

		const unpublished = !article || article.status === 'draft';
		/* The baseline is the untouched form; values restored from a toast are
       applied after it, so they count as unsaved. */
		store.session = {
			articleId: article ? article.id : null,
			fresh: !article,
			unpublished,
			baseline: JSON.stringify(collectFields()),
		};
		for (const [key, value] of Object.entries(request.values || {})) {
			if (key === 'tags') writeTags(value);
			else if (fields[key]) fields[key].value = value;
		}
		const saveWord = unpublished ? 'Publish' : 'Save changes';
		fields.heading.textContent = article
			? `${unpublished ? 'Draft: ' : 'Editing: '}${article.title}`
			: 'New article';
		fields.intro.textContent = unpublished
			? 'Kept as a draft that only you can see until you publish it.'
			: 'Changes show for everyone as soon as you save them.';
		fields.draftButton.hidden = !unpublished;
		fields.quickDraft.hidden = !unpublished;
		fields.publishText.textContent = saveWord;
		fields.quickPublish.textContent = saveWord;
		if (!article) setBadge('Not saved yet', '');
		else if (unpublished) setBadge(`Draft saved ${relativeAge(article.updated)}`, 'info');
		else setBadge('Published', 'success');
		updateCharsLeft();

		stage.hidden = true;
		composer.hidden = false;
		markNav();
		if (hasUnsavedEdits()) setBadge('Unsaved changes', 'warning');
		let focusTarget = fields.title;
		if (article) focusTarget = fields.heading;
		else if (request.title) focusTarget = fields.body;
		land(focusTarget);
	}

	/** Runs before anything leaves the editor and returns whether it may.
      Unsaved drafts are kept; unsaved edits to a live article get a toast
      that can bring them back. */
	function leaveComposer() {
		const { session } = store;
		if (!session || composer.hidden) {
			store.session = null;
			return true;
		}
		if (hasUnsavedEdits()) {
			const blank = !fields.title.value.trim() && !fields.body.value.trim();
			if (session.unpublished && blank) {
				store.session = null;
				return true;
			}
			if (session.unpublished) parkDraft();
			else reportDroppedEdits(session);
		}
		store.session = null;
		composer.hidden = true;
		return true;
	}

	function parkDraft() {
		commitComposer({ quiet: true }).then((article) => {
			notify({
				tone: 'info',
				icon: 'bi-pencil',
				title: 'Kept as a draft',
				text: `“${article.title}” is under Your drafts.`,
				actions: [
					{
						label: 'Keep writing',
						onClick() {
							reopenAfterRoute(article);
						},
					},
				],
			});
			drawTree();
		});
	}

	function reportDroppedEdits(session) {
		const article = findArticle(session.articleId);
		const values = collectFields();
		notify({
			tone: 'warning',
			title: 'Edits not saved',
			text: `Your changes to “${article.title}” were left out.`,
			actions: [
				{
					label: 'Back to them',
					onClick() {
						reopenAfterRoute(article, values);
					},
				},
			],
		});
	}

	/* Toast buttons open the article first, then its editor on top. */
	function reopenAfterRoute(article, values) {
		const hash = `#article/${encodeURIComponent(article.id)}`;
		if (window.location.hash !== hash) {
			store.resume = { article, values };
			window.location.hash = hash;
			return;
		}
		handleRoute();
		openComposer({ article, values });
	}

	function closeComposer(articleId) {
		const target = articleId || store.session?.articleId;
		store.session = null;
		composer.hidden = true;
		const known = target && findArticle(target);
		if (known && store.place.view === 'article' && store.place.ref === target) handleRoute(true);
		else if (known) navigate(`#article/${encodeURIComponent(target)}`);
		else handleRoute(true);
	}

	/** Saves the form as a draft, or publishes it with `publish`. `quiet`
      skips the tree redraw, for saves made on the way out. */
	function commitComposer({ publish = false, quiet = false } = {}) {
		const values = collectFields();
		const { session } = store;
		const existing = session.articleId ? findArticle(session.articleId) : null;
		const wasLive = Boolean(existing) && existing.status === 'published';
		const article = existing || {
			id: freeArticleId(values.title || 'untitled'),
			status: 'draft',
			views: 0,
			helpful: { yes: 0, no: 0 },
			history: [],
		};
		Object.assign(article, values, { title: values.title || 'Untitled draft', updated: HANDBOOK.today });
		if (publish) article.status = 'published';
		let note = 'Saved a draft';
		if (publish) note = wasLive ? 'Edited' : 'Published';
		article.history.unshift({ who: USER, when: HANDBOOK.today, note });
		if (!existing) store.articles.push(article);
		Object.assign(session, { articleId: article.id, fresh: false, baseline: JSON.stringify(collectFields()) });
		recount();
		if (!quiet) drawTree();
		return server.putArticle(article).then(() => article);
	}

	function collectFields() {
		return {
			title: fields.title.value.trim(),
			collection: fields.collection.value,
			owner: fields.owner.value,
			review: Number(fields.review.value),
			summary: fields.summary.value.trim(),
			tags: readTags(),
			body: fields.body.value,
		};
	}

	function hasUnsavedEdits() {
		return store.session && JSON.stringify(collectFields()) !== store.session.baseline;
	}

	function titleIsSet() {
		composer.classList.add('was-validated');
		if (fields.title.value.trim()) return true;
		fields.title.focus();
		notify({ tone: 'danger', title: 'Not saved yet', text: 'The article needs a title.' });
		return false;
	}

	function fillPickers() {
		fields.collection.innerHTML = store.collections
			.map((collection) => `<option value="${htmlSafe(collection.id)}">${htmlSafe(collection.name)}</option>`)
			.join('');
		fields.owner.innerHTML = store.people
			.map(
				(person) =>
					`<option value="${htmlSafe(person.id)}">${htmlSafe(person.name)}${person.id === USER ? ' (you)' : ''}</option>`,
			)
			.join('');
		if (!window.Basalt.select?.refresh) return;
		window.Basalt.select.refresh(fields.collection);
		window.Basalt.select.refresh(fields.owner);
	}

	function readTags() {
		const widget = fields.tags.basaltTags;
		return widget ? widget.get() : [];
	}

	function writeTags(list) {
		fields.tags.basaltTags?.set(list);
	}

	function setBadge(text, tone) {
		fields.badge.textContent = text;
		fields.badge.className = `basalt-status basalt-status-dot${tone ? ` basalt-status-${tone}` : ''}`;
	}

	function updateCharsLeft() {
		fields.charsLeft.textContent = `${countOf(140 - fields.summary.value.length, 'character')} left`;
	}

	function switchMode(mode) {
		const previewing = mode === 'preview';
		const radio = pick(`input[name="hb-ed-mode"][value="${mode}"]`, composer);
		if (radio && !radio.checked) {
			radio.checked = true;
			radio.dispatchEvent(new Event('change', { bubbles: true }));
		}
		if (previewing)
			fields.preview.innerHTML =
				bodyToHtml(fields.body.value) || '<p class="hb-quiet">Nothing to preview yet.</p>';
		fields.preview.hidden = !previewing;
		fields.body.hidden = previewing;
		fields.toolbar.classList.toggle('is-off', previewing);
		for (const button of pickAll('[data-hb-fmt]', composer)) button.disabled = previewing;
	}

	/** Puts formatting around the selection in the article box: bold wraps
      it, every other kind prefixes each selected line with its marker. */
	function applyFormat(kind) {
		const box = fields.body;
		const { selectionStart: from, selectionEnd: to, value } = box;
		const chosen = value.slice(from, to);
		const edit = kind === 'b' ? boldEdit(chosen, from) : lineEdit(kind, chosen, from, value);
		box.focus();
		box.setRangeText(edit.text, from, to, 'end');
		box.setSelectionRange(edit.start, edit.end);
		box.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function boldEdit(chosen, from) {
		const text = `**${chosen || 'bold text'}**`;
		return { text, start: from + 2, end: from + text.length - 2 };
	}

	function lineEdit(kind, chosen, from, value) {
		const { marker, sample } = LINE_MARKERS[kind];
		const lines = (chosen || sample)
			.split('\n')
			.map((line, position) => (kind === 'ol' ? `${position + 1}. ` : marker) + line.replace(LINE_PREFIX, ''));
		const breakBefore = from > 0 && value[from - 1] !== '\n' ? '\n' : '';
		const text = breakBefore + lines.join('\n');
		const start = from + breakBefore.length + (chosen ? 0 : lines[0].length - sample.length);
		return { text, start, end: from + text.length };
	}

	function wireComposer() {
		fields.summary.addEventListener('input', updateCharsLeft);
		fields.owner.addEventListener('change', () => {
			ownerChosen = true;
		});
		fields.collection.addEventListener('change', () => {
			const collection = collectionById(fields.collection.value);
			if (collection && !ownerChosen) fields.owner.value = collection.owner;
		});
		composer.addEventListener('input', () => {
			if (store.session && hasUnsavedEdits()) setBadge('Unsaved changes', 'warning');
		});
		composer.addEventListener('change', (event) => {
			if (event.target.name === 'hb-ed-mode') switchMode(event.target.value);
			else if (store.session && hasUnsavedEdits()) setBadge('Unsaved changes', 'warning');
		});
		wireToolbar();
		wireShortcuts();
		wireSaving();
		wireDiscard();
	}

	/* The formatting bar is one tab stop; arrows, Home and End move inside it. */
	function wireToolbar() {
		const buttons = pickAll('[data-hb-fmt]', composer);
		for (const [position, button] of buttons.entries()) button.tabIndex = position === 0 ? 0 : -1;
		fields.toolbar.addEventListener('click', (event) => {
			const button = event.target.closest('[data-hb-fmt]');
			if (button) applyFormat(button.getAttribute('data-hb-fmt'));
		});
		fields.toolbar.addEventListener('keydown', (event) => {
			const at = buttons.indexOf(document.activeElement);
			if (at < 0) return;
			const last = buttons.length - 1;
			const steps = {
				ArrowRight: (at + 1) % buttons.length,
				ArrowLeft: (at + last) % buttons.length,
				Home: 0,
				End: last,
			};
			if (!Object.hasOwn(steps, event.key)) return;
			event.preventDefault();
			const next = buttons[steps[event.key]];
			for (const button of buttons) button.tabIndex = button === next ? 0 : -1;
			next.focus();
		});
	}

	/* Ctrl or Cmd with B makes bold inside the article box; with S it saves
     from anywhere in the form. */
	function wireShortcuts() {
		fields.body.addEventListener('keydown', (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'b') return;
			event.preventDefault();
			applyFormat('b');
		});
		composer.addEventListener('keydown', (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
			event.preventDefault();
			(fields.draftButton.hidden ? fields.publishButton : fields.draftButton).click();
		});
	}

	function wireSaving() {
		fields.draftButton.addEventListener('click', () => {
			if (!titleIsSet()) return;
			const button = fields.draftButton;
			setButtonState(button, 'loading');
			commitComposer().then((article) => {
				setButtonState(button, 'success');
				setTimeout(() => setButtonState(button, 'idle'), 1400);
				fields.heading.textContent = `Draft: ${article.title}`;
				setBadge('Draft saved just now', 'info');
				announce('Draft saved.');
			});
		});
		composer.addEventListener('submit', (event) => {
			event.preventDefault();
			if (!titleIsSet()) return;
			const wasDraft = store.session.unpublished;
			setButtonState(fields.publishButton, 'loading');
			commitComposer({ publish: true }).then((article) => {
				setButtonState(fields.publishButton, 'idle');
				store.session = null;
				composer.hidden = true;
				navigate(`#article/${encodeURIComponent(article.id)}`);
				notify({
					tone: 'success',
					title: wasDraft ? 'Published' : 'Changes saved',
					text: wasDraft
						? `“${article.title}” is in ${collectionById(article.collection).name} and in search.`
						: 'Everyone sees the new version now.',
				});
			});
		});
		/* The top bar repeats Save draft so a long article needs no scrolling. */
		fields.quickDraft.addEventListener('click', () => fields.draftButton.click());
	}

	/* Both discard buttons use the shared two-step confirm, which is skipped
     when nothing has changed. */
	function wireDiscard() {
		for (const button of fields.discardButtons) {
			button.addEventListener(
				'click',
				(event) => {
					if (hasUnsavedEdits()) return;
					event.stopImmediatePropagation();
					closeComposer();
				},
				true,
			);
			button.addEventListener('basalt:confirm', () => {
				const articleId = store.session?.articleId;
				store.session = null;
				closeComposer(articleId);
				notify({ tone: 'info', title: 'Changes discarded', duration: 3000 });
			});
		}
	}

	function wireUnload() {
		window.addEventListener('beforeunload', (event) => {
			if (!store.session || composer.hidden || !hasUnsavedEdits()) return;
			event.preventDefault();
			event.returnValue = '';
		});
	}

	/* New collection dialog. */

	function wireCollectionDialog() {
		const dialog = pick('#hb-collection-modal');
		const form = pick('[data-hb-collection-form]');
		const nameField = form.elements.namedItem('name');
		const descField = form.elements.namedItem('desc');
		pick('[data-hb-icon-choices]').innerHTML = ICON_CHOICES.map(
			(icon, position) =>
				`<label class="basalt-choice"><input type="radio" name="hb-col-icon" value="${icon}"${position === 0 ? ' checked' : ''}><i class="bi ${icon}" aria-hidden="true"></i><span class="visually-hidden">${icon.replace('bi-', '').replace('-', ' ')}</span></label>`,
		).join('');
		dialog.addEventListener('shown.bs.modal', () => nameField.focus());
		dialog.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('was-validated');
		});
		nameField.addEventListener('input', () => nameField.setCustomValidity(''));
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const name = nameField.value.trim();
			const clash = store.collections.some((collection) => collection.name.toLowerCase() === name.toLowerCase());
			let problem = '';
			if (!name) problem = 'empty';
			else if (clash) problem = 'taken';
			nameField.setCustomValidity(problem);
			pick('[data-hb-col-error]').textContent = name
				? `There is already a collection called ${name}.`
				: 'Give the collection a name.';
			form.classList.add('was-validated');
			if (!form.checkValidity()) {
				nameField.focus();
				return;
			}
			const collection = {
				id: freeCollectionId(name),
				name,
				desc: descField.value.trim(),
				icon: pick('input[name="hb-col-icon"]:checked', form)?.value || 'bi-folder',
				owner: USER,
			};
			server.putCollection(collection).then(() => {
				store.collections.push(collection);
				fillPickers();
				window.bootstrap.Modal.getOrCreateInstance(dialog).hide();
				navigate(`#collection/${encodeURIComponent(collection.id)}`);
				notify({
					tone: 'success',
					title: `${collection.name} added`,
					text: 'Write its first article, or move one in.',
				});
			});
		});
	}

	/* The search box. Results replace the view as you type; Escape clears,
     Down moves into the results and Enter opens the first one. */

	function applySearch() {
		const text = finder.value;
		if (!text.trim()) {
			if (store.terms) {
				store.terms = '';
				handleRoute();
			}
			return;
		}
		if (!leaveComposer()) return;
		if (store.terms !== text && !store.terms) store.resultFilter = 'all';
		store.terms = text;
		paint(resultsView(text));
		markNav();
	}

	function wireSearch() {
		let pause = null;
		finder.addEventListener('input', () => {
			clearTimeout(pause);
			pause = setTimeout(applySearch, 120);
		});
		finder.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				if (!finder.value) return;
				event.preventDefault();
				finder.value = '';
				applySearch();
				return;
			}
			const move = RESULT_KEYS.get(event.key);
			const first = move && pick('[data-hb-result]', stage);
			if (!first || !store.terms) return;
			event.preventDefault();
			first[move]();
		});
		/* Up and Down walk the results; Up from the first goes back to the box. */
		stage.addEventListener('keydown', (event) => {
			const down = event.key === 'ArrowDown';
			if (!store.terms || (!down && event.key !== 'ArrowUp')) return;
			const links = pickAll('[data-hb-result]', stage);
			const at = links.indexOf(document.activeElement);
			if (at < 0) return;
			event.preventDefault();
			if (down) links[at + 1]?.focus();
			else (links[at - 1] || finder).focus();
		});
	}

	function filterResults(chip) {
		store.resultFilter = chip.getAttribute('data-hb-search-col');
		paint(resultsView(store.terms));
		pick(`[data-hb-search-col="${store.resultFilter}"]`, stage)?.focus();
	}

	function lookUp(text) {
		finder.value = text;
		applySearch();
		finder.focus();
	}

	function focusFinder() {
		finder.focus();
		finder.select();
		if (finder.getBoundingClientRect().top < 60)
			pick('.hb-bar', shell).scrollIntoView({ block: 'center', behavior: calmMotion() ? 'auto' : 'smooth' });
	}

	/** Ranks what the visitor can see against the query. Every word has to
      appear somewhere; a title hit weighs most, then tags, the summary, the
      collection name, and up to three hits in the body. */
	function findMatches(query) {
		const terms = splitTerms(query);
		const matches = [];
		if (!terms.length) return { terms, matches };
		for (const article of readable()) {
			const text = plainText(article.body);
			const haystacks = {
				title: article.title.toLowerCase(),
				tags: article.tags.join(' ').toLowerCase(),
				summary: (article.summary || '').toLowerCase(),
				collection: (collectionById(article.collection)?.name || '').toLowerCase(),
				body: text.toLowerCase(),
			};
			let score = 0;
			const everyTerm = terms.every((term) => {
				const weight = termWeight(term, haystacks);
				score += weight;
				return weight > 0;
			});
			if (everyTerm) matches.push({ article, score, excerpt: excerpt(text, terms) });
		}
		matches.sort((left, right) => right.score - left.score || mostRead(left.article, right.article));
		return { terms, matches };
	}

	function termWeight(term, haystacks) {
		let weight = Math.min(haystacks.body.split(term).length - 1, 3);
		for (const [field, points] of RANKING) {
			if (haystacks[field].includes(term)) weight += points;
		}
		return weight;
	}

	function splitTerms(query) {
		return query
			.toLowerCase()
			.split(/\s+/)
			.map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ''))
			.filter(Boolean);
	}

	function markTerms(text, terms) {
		if (!terms.length) return htmlSafe(text);
		const pattern = new RegExp(`(${terms.map(escapeForRegex).join('|')})`, 'gi');
		return String(text)
			.split(pattern)
			.map((piece, position) => (position % 2 ? `<mark>${htmlSafe(piece)}</mark>` : htmlSafe(piece)))
			.join('');
	}

	/* About two hundred characters around the earliest hit, cut on spaces. */
	function excerpt(text, terms) {
		const lower = text.toLowerCase();
		const found = terms.map((term) => lower.indexOf(term)).filter((at) => at >= 0);
		if (!found.length) return '';
		const hit = Math.min(...found);
		let from = Math.max(0, hit - 60);
		let to = Math.min(text.length, hit + 140);
		if (from > 0) from = text.indexOf(' ', from) + 1;
		if (to < text.length) to = text.lastIndexOf(' ', to);
		return `${from > 0 ? '… ' : ''}${text.slice(from, to)}${to < text.length ? ' …' : ''}`;
	}

	function escapeForRegex(text) {
		return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/* Article text: plain lines in, HTML out. */

	function bodyToHtml(source) {
		const lines = String(source || '')
			.replace(/\r/g, '')
			.split('\n')
			.map((line) => line.trim());
		const anchors = new Set();
		const blocks = [];
		let cursor = 0;
		function runWhile(test) {
			const run = [];
			while (cursor < lines.length && test(lines[cursor])) {
				run.push(lines[cursor]);
				cursor += 1;
			}
			return run;
		}
		while (cursor < lines.length) {
			const line = lines[cursor];
			const heading = line.match(/^(#{2,3})\s+(.*)$/);
			const kind = BLOCK_KINDS.find((block) => block.opens.test(line));
			if (!line) {
				cursor += 1;
			} else if (heading) {
				blocks.push(headingHtml(heading[1].length === 2 ? 'h3' : 'h4', heading[2], anchors));
				cursor += 1;
			} else if (kind) {
				blocks.push(kind.render(runWhile((next) => kind.opens.test(next))));
			} else {
				blocks.push(`<p>${inlineMarks(runWhile((next) => next && !ANY_BLOCK.test(next)).join(' '))}</p>`);
			}
		}
		return blocks.join('');
	}

	function headingHtml(tag, text, anchors) {
		return `<${tag} id="${anchorId(text, anchors)}" tabindex="-1">${inlineMarks(text)}</${tag}>`;
	}

	function bulletsHtml(run) {
		return `<ul>${run.map((line) => `<li>${inlineMarks(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
	}

	function stepsHtml(run) {
		return `<ol class="hb-steps">${run.map((line) => `<li>${inlineMarks(line.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
	}

	function calloutHtml(run) {
		let text = run.map((line) => line.replace(/^>\s?/, '')).join(' ');
		const label = text.match(/^(tip|note|warning):\s*/i);
		const kind = label ? CALLOUT_KINDS[label[1].toLowerCase()] : CALLOUT_KINDS.note;
		if (label) text = text.slice(label[0].length);
		return `<div class="hb-callout hb-callout-${kind.tone}"><i class="bi ${kind.icon}" aria-hidden="true"></i><p><strong>${kind.label}.</strong> ${inlineMarks(text)}</p></div>`;
	}

	/* Divider rows (| --- |) are dropped; the first remaining row is the head. */
	function tableHtml(run) {
		const rows = run
			.map((line) =>
				line
					.replace(/^\||\|$/g, '')
					.split('|')
					.map((cell) => cell.trim()),
			)
			.filter((cells) => !cells.every((cell) => /^:?-{2,}:?$/.test(cell)));
		const head = rows.shift() || [];
		const headCells = head.map((cell) => `<th scope="col">${inlineMarks(cell)}</th>`).join('');
		const bodyRows = rows
			.map((cells) => `<tr>${cells.map((cell) => `<td>${inlineMarks(cell)}</td>`).join('')}</tr>`)
			.join('');
		return `<div class="hb-table"><table class="table table-sm"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
	}

	function inlineMarks(text) {
		return htmlSafe(text)
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/`(.+?)`/g, '<code>$1</code>');
	}

	function anchorId(text, taken) {
		const base = `hb-${toSlug(text)}`;
		let candidate = base;
		for (let suffix = 2; taken.has(candidate); suffix += 1) candidate = `${base}-${suffix}`;
		taken.add(candidate);
		return candidate;
	}

	/* The words of an article without its line markers, for search and for
     the reading time. */
	function plainText(source) {
		return String(source || '')
			.replace(/^(#{2,3}|[-*]|\d+[.)]|>\s*(tip|note|warning):|>)\s*/gim, '')
			.replace(/\*\*|`/g, '')
			.replace(/\|/g, ' ')
			.replace(/-{3,}/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function minutesToRead(article) {
		return Math.max(1, Math.ceil(plainText(article.body).split(' ').length / 200));
	}

	/* Who and what: lookups over the store. */

	function who(personId) {
		return (
			store.people.find((person) => person.id === personId) || {
				id: personId,
				name: 'Someone',
				role: '',
				tone: 7,
			}
		);
	}

	function firstName(personId) {
		return who(personId).name.split(' ')[0];
	}

	function collectionById(collectionId) {
		return store.collections.find((collection) => collection.id === collectionId);
	}

	function findArticle(articleId) {
		return store.articles.find((article) => article.id === articleId);
	}

	/* The person signed in sees everything published plus their own drafts. */
	function readable() {
		return store.articles.filter((article) => article.status === 'published' || article.owner === USER);
	}

	function live() {
		return store.articles.filter((article) => article.status === 'published');
	}

	function shelfOf(collectionId) {
		return readable().filter((article) => article.collection === collectionId);
	}

	function ownDrafts() {
		return store.articles.filter((article) => article.owner === USER && article.status === 'draft');
	}

	function pastReview() {
		return live().filter((article) => reviewStatus(article) === 'due');
	}

	function freeArticleId(title) {
		return freeId(toSlug(title).slice(0, 40) || 'article', findArticle);
	}

	function freeCollectionId(name) {
		return freeId(toSlug(name) || 'collection', collectionById);
	}

	function freeId(base, exists) {
		let id = base;
		for (let suffix = 2; exists(id); suffix += 1) id = `${base}-${suffix}`;
		return id;
	}

	function toSlug(text) {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
	}

	/* Sort orders for article lists. */

	function newestFirst(left, right) {
		return dayStamp(right.updated) - dayStamp(left.updated);
	}

	function oldestFirst(left, right) {
		return dayStamp(left.updated) - dayStamp(right.updated);
	}

	function byTitle(left, right) {
		return left.title.localeCompare(right.title);
	}

	function mostRead(left, right) {
		return right.views - left.views;
	}

	/* Dates. Everything is measured against HANDBOOK.today, at noon UTC so no
     time zone can tip a day over. */

	function dayStamp(iso) {
		return Date.parse(`${iso}T12:00:00Z`);
	}

	function isoOf(ms) {
		return new Date(ms).toISOString().slice(0, 10);
	}

	function shortDate(iso) {
		return new Date(dayStamp(iso)).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC',
		});
	}

	function relativeAge(iso) {
		const days = Math.round((TODAY_MS - dayStamp(iso)) / DAY_MS);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		const band = AGE_BANDS.find((entry) => days < entry.under);
		return band ? band.words(days) : 'over a year ago';
	}

	function plusMonths(iso, months) {
		const moment = new Date(dayStamp(iso));
		moment.setUTCMonth(moment.getUTCMonth() + months);
		return isoOf(moment.getTime());
	}

	function reviewDate(article) {
		return plusMonths(article.updated, article.review || 6);
	}

	/** 'due' once the review date has come, 'soon' within 30 days of it,
      otherwise 'ok'. */
	function reviewStatus(article) {
		const daysLeft = Math.round((dayStamp(reviewDate(article)) - TODAY_MS) / DAY_MS);
		if (daysLeft <= 0) return 'due';
		return daysLeft <= 30 ? 'soon' : 'ok';
	}

	/* Demo numbers: reads, votes and a short history per article, drawn from
     a seeded generator so every visit shows the same handbook. Live data
     would bring these from the server. */

	function withDemoNumbers() {
		const roll = prng(2914);
		const payload = deepCopy(HANDBOOK);
		const staff = payload.people.map((person) => person.id);
		for (const article of payload.articles) {
			article.status ||= 'published';
			const isDraft = article.status === 'draft';
			article.views = isDraft ? 0 : 30 + Math.floor(roll() * 620);
			article.helpful = isDraft
				? { yes: 0, no: 0 }
				: { yes: 4 + Math.floor(roll() * 40), no: Math.floor(roll() * 6) };
			article.history = demoHistory(article, isDraft, roll, staff);
		}
		return payload;
	}

	/** A first version some months back, a few edits by teammates since, and
      the owner's latest save. Returned newest first. */
	function demoHistory(article, isDraft, roll, staff) {
		const revisions = 1 + Math.floor(roll() * 4);
		const lastSave = dayStamp(article.updated);
		let moment = lastSave - (40 + Math.floor(roll() * 260)) * DAY_MS;
		const entries = [{ who: article.owner, when: isoOf(moment), note: 'Wrote the first version' }];
		for (let step = 1; step < revisions; step += 1) {
			moment += Math.floor((lastSave - moment) * (0.3 + roll() * 0.5));
			const editor = staff[Math.floor(roll() * staff.length)];
			entries.push({
				who: editor,
				when: isoOf(moment),
				note: EDIT_NOTES[Math.floor(roll() * EDIT_NOTES.length)],
			});
		}
		if (revisions > 1 || !isDraft)
			entries.push({
				who: article.owner,
				when: article.updated,
				note: isDraft ? 'Saved a draft' : 'Checked and updated',
			});
		return entries.reverse();
	}

	/* A small fast generator (mulberry32) that returns numbers in [0, 1). */
	function prng(seed) {
		let word = seed >>> 0;
		return function next() {
			word = (word + 0x6d2b79f5) >>> 0;
			let mixed = Math.imul(word ^ (word >>> 15), word | 1);
			mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
			return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
		};
	}

	/* Text helpers. */

	/* Article bodies in HANDBOOK are indented to match the code; this drops it. */
	function prose(block) {
		return block
			.trim()
			.split('\n')
			.map((line) => line.trim())
			.join('\n');
	}

	function htmlSafe(value) {
		return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
	}

	function countOf(total, one, many) {
		return `${total} ${total === 1 ? one : many || `${one}s`}`;
	}

	function monogram(name) {
		return name
			.split(/\s+/)
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function deepCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}

	/* Page and shared-widget plumbing. */

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function calmMotion() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/* A promise that resolves after `ms`, capped at 150 for reduced motion. */
	function settle(value, ms) {
		return new Promise((resolve) => {
			setTimeout(() => resolve(value), calmMotion() ? Math.min(ms, 150) : ms);
		});
	}

	function notify(options) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(options) : null;
	}

	function announce(text) {
		window.Basalt.announce?.(text);
	}

	function setButtonState(button, phase, label) {
		window.Basalt.buttonState?.(button, phase, label);
	}

	start();
})();
