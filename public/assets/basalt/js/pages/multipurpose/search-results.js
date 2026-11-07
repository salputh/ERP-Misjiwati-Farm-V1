/**
 * Basalt - Search Results (search-results.html)
 * One search over customers, store orders, invoices, people, help
 * articles and the admin's own pages. Results are ranked, the best
 * match leads, and each kind gets its own card.
 *
 * Demo data: customers, contacts, store orders and invoices are read
 * from the shared data files the list pages use (accounts.js, store.js
 * and billing.js); the team and the handbook are copied from employee-users.html
 * and handbook.html. So every name, number and status matches
 * what those pages show. Pages are read from the sidebar menu, so the
 * list never goes stale. A deployed page would ask the server instead.
 */
(() => {
	'use strict';
	const root = pick('[data-sr-page]');
	if (!root) return;

	function start() {
		let typing = 0;
		el.input.addEventListener('input', () => {
			clearTimeout(typing);
			typing = setTimeout(() => setQuery(el.input.value), 120);
		});
		el.form.addEventListener('submit', (e) => {
			e.preventDefault();
			clearTimeout(typing);
			setQuery(el.input.value, { remember: true });
		});

		/* The header's "Type to search…" box searches here on this page. */
		const headerForm = pick('[data-basalt-chrome="search-form"]');
		const headerInput = document.getElementById('basalt-find');
		if (headerForm && headerInput) {
			headerForm.addEventListener('submit', () => {
				const q = headerInput.value.trim();
				if (!q) return;
				headerInput.value = '';
				headerInput.blur();
				setQuery(q, { remember: true });
				el.input.focus();
			});
		}

		root.addEventListener('click', (e) => {
			const t = e.target;
			const tryBtn = t.closest('[data-sr-try]');
			if (tryBtn) {
				state.kind = 'all';
				setQuery(tryBtn.textContent.trim(), { remember: true });
				return;
			}
			const kindBtn = t.closest('[data-sr-kind]');
			if (kindBtn) {
				setKind(kindBtn.getAttribute('data-sr-kind'));
				return;
			}
			const show = t.closest('[data-sr-show]');
			if (show) {
				setKind(show.getAttribute('data-sr-show'));
				const pressed = pick('[data-sr-kind][aria-pressed="true"]', root);
				if (pressed) pressed.focus({ preventScroll: true });
				pick('.sr-ask', root).scrollIntoView({
					behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
					block: 'start',
				});
				return;
			}
			if (t.closest('[data-sr-more]')) {
				const before = pickAll('.sr-list > li', el.results).length;
				window.Basalt.slide(el.results, () => {
					state.shown += 10;
					render();
				});
				const next = pickAll('.sr-row', el.results)[before];
				if (next) next.focus();
				return;
			}
			if (t.closest('[data-sr-clear]')) {
				setQuery('');
				el.input.focus();
				return;
			}
			if (t.closest('[data-sr-forget]')) {
				recent = [];
				writeRecent(recent);
				render();
				el.input.focus();
				return;
			}
			const again = t.closest('[data-sr-recent]');
			if (again) {
				e.preventDefault();
				state.kind = 'all';
				setQuery(again.getAttribute('data-sr-recent'), { remember: true });
				return;
			}
			if (t.closest('[data-sr-open]')) remember(state.query);
		});

		/* Keyboard: "/" jumps to the box; the arrows walk the results. */
		document.addEventListener('keydown', (e) => {
			if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
				const a = document.activeElement;
				if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
				e.preventDefault();
				el.input.focus();
				el.input.select();
				return;
			}
			if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
			const items = pickAll('[data-sr-nav]', el.results);
			if (!items.length) return;
			const at = items.indexOf(document.activeElement);
			if (document.activeElement === el.input) {
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					items[0].focus();
				}
				return;
			}
			if (at === -1) return;
			e.preventDefault();
			if (e.key === 'ArrowDown') items[Math.min(at + 1, items.length - 1)].focus();
			else if (at === 0) el.input.focus();
			else items[at - 1].focus();
		});

		/* Start
		   A deployed page is opened with ?q= from the header search. Opened
		   directly, as in the demo, it shows a sample search. */
		const params = new URLSearchParams(window.location.search);
		const kindParam = params.get('kind');
		if (kindParam && KIND[kindParam]) state.kind = kindParam;
		setQuery(params.has('q') ? params.get('q') : 'highpoint');
	}

	/* Small helpers */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function fold(s) {
		return String(s == null ? '' : s)
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase();
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	/* The demo's "today". A deployed page would use new Date(). */
	const TODAY = '2026-10-09';

	function day(iso) {
		const [y, m, d] = iso.split('-').map(Number);
		return `${MONTHS[m - 1]} ${d}${y === Number(TODAY.slice(0, 4)) ? '' : `, ${y}`}`;
	}

	function money(n, cents) {
		return `$${n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many}`;
	}

	function initials(name) {
		return name
			.split(/\s+/)
			.filter((w) => /^[A-Za-zÀ-ž]/.test(w))
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase();
	}

	function toneOf(name) {
		let h = 0;
		const s = name.toLowerCase();
		for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
		return (h % 8) + 1;
	}

	/* The kinds, in their default order */
	const KINDS = [
		{
			id: 'customers',
			name: 'Customers',
			one: 'customer',
			many: 'customers',
			icon: 'bi-buildings',
			tone: 1,
			list: ['companies.html?stage=customer', 'All customers'],
			open: 'Open customer',
		},
		{
			id: 'orders',
			name: 'Store orders',
			one: 'store order',
			many: 'store orders',
			icon: 'bi-box-seam',
			tone: 2,
			list: ['orders.html', 'All orders'],
			open: 'Open order',
		},
		{
			id: 'invoices',
			name: 'Invoices',
			one: 'invoice',
			many: 'invoices',
			icon: 'bi-receipt',
			tone: 3,
			list: ['invoices.html', 'All invoices'],
			open: 'Open invoice',
		},
		{
			id: 'people',
			name: 'People',
			one: 'person',
			many: 'people',
			icon: 'bi-people',
			tone: 4,
			list: ['people-at-companies.html', 'All contacts'],
			open: 'Open profile',
		},
		{
			id: 'help',
			name: 'Help articles',
			one: 'help article',
			many: 'help articles',
			icon: 'bi-journal-text',
			tone: 5,
			list: ['handbook.html', 'Handbook'],
			open: 'Read article',
		},
		{
			id: 'pages',
			name: 'Pages',
			one: 'page',
			many: 'pages',
			icon: 'bi-window',
			tone: 6,
			list: null,
			open: 'Go to page',
		},
	];
	const KIND = Object.fromEntries(KINDS.map((k) => [k.id, k]));

	/* Demo records
	   Customers and their contacts come from the shared accounts
	   (assets/basalt/js/data/multipurpose/accounts.js), store orders from the Store book
	   (assets/basalt/js/data/multipurpose/store.js) and invoices from the billing data
	   (assets/basalt/js/data/multipurpose/billing.js): the same records Companies,
	   Orders and Invoices list, so every result opens its own page. */
	const BOOK = window.Basalt.data.accounts;
	const SHOP = window.Basalt.shopBook;
	const BILLING = window.Basalt.data.billing;
	const ACCOUNT_STATUS = {
		active: ['Active', 'success'],
		pastdue: ['Past due', 'danger'],
		trial: ['Trial', 'info'],
		canceling: ['Canceling', 'warning'],
	};

	/* Store items, short names for one line: [one, many, icon, tone]; an
     order shows the icon of its first line. */
	const SKU = {
		'ML-BLAZ': ['blazer', 'blazers', 'bi-briefcase', 1],
		'ML-GOWN': ['gown', 'gowns', 'bi-stars', 1],
		'ML-ORGZ': ['organza dress', 'organza dresses', 'bi-flower1', 2],
		'ML-SUIT': ['suit', 'suits', 'bi-person-standing', 3],
		'ML-TRCH': ['trench coat', 'trench coats', 'bi-cloud-drizzle', 3],
		'ML-LOAF': ['pair of loafers', 'pairs of loafers', 'bi-gem', 4],
		'ML-OXFD': ['pair of oxfords', 'pairs of oxfords', 'bi-award', 5],
		'ML-CATE': ['cat-eye', 'cat-eyes', 'bi-sunglasses', 5],
		'ML-SHLD': ['shield', 'shields', 'bi-eyeglasses', 6],
		'ML-GIFT250': ['gift card', 'gift cards', 'bi-gift', 4],
		'ML-STYLE': ['styling session', 'styling sessions', 'bi-person-hearts', 6],
		'ML-MTM': ['made-to-measure suit', 'made-to-measure suits', 'bi-rulers', 6],
	};
	/* The warehouse stages, as on orders.html. */
	const STAGE = {
		received: ['Received', 'primary'],
		picking: ['Picking', 'info'],
		configuring: ['Configuring', 'info'],
		packing: ['Packing', 'info'],
		dispatched: ['Shipped', 'primary'],
		delivered: ['Delivered', 'success'],
		canceled: ['Canceled', 'muted'],
	};
	/* Where an order is, worked out the way orders.html does: picking starts
     half an hour after it can go ahead and set-up an hour after that. */
	function stageOf(o) {
		if (o.status === 'canceled') return 'canceled';
		const told = SHOP.story(o);
		const f = told.fulfil;
		if (f.deliveredAt) return 'delivered';
		if (f.shippedAt) return 'dispatched';
		if (f.packedAt) return 'packing';
		const start = told.payment.terms === 'Net 30' ? told.placed : told.payment.paidAt;
		if (!start) return 'received';
		const mins = (Date.parse(SHOP.NOW) - Date.parse(start)) / 60000;
		return mins >= 90 ? 'configuring' : mins >= 30 ? 'picking' : 'received';
	}

	/* The Fieldline team as on employee-users.html: [id, name, job, team, email] */
	const TEAM = [
		['ja', 'John Armstrong', 'IT and systems manager', 'Operations', 'john.armstrong@fieldline.app'],
		['pr', 'Connie Reese', 'Support lead', 'Support', 'connie.reese@fieldline.app'],
		['ev', 'Elise Vick', 'Customer success lead', 'Success', 'elise.vick@fieldline.app'],
		['hb', 'Leslie Ashby', 'Customer success manager', 'Success', 'leslie.ashby@fieldline.app'],
		['ta', 'Tony Aldridge', 'Customer success manager', 'Success', 'tony.aldridge@fieldline.app'],
		['gl', 'Courtney Lowry', 'Onboarding specialist', 'Success', 'courtney.lowry@fieldline.app'],
		['mb', 'Quentin Cook', 'Account executive', 'Sales', 'quentin.cook@fieldline.app'],
		['ew', 'Rowan Walsh', 'Sales manager', 'Sales', 'rowan.walsh@fieldline.app'],
		['mk', 'Thomas Morrison', 'Solutions engineer, West', 'Sales', 'thomas.morrison@fieldline.app'],
		['hw', 'Leslie Whitlock', 'Product manager, Travel Planner', 'Product', 'leslie.whitlock@fieldline.app'],
	];

	/* The handbook (handbook.html): [id, title, summary, collection, updated, tags] */
	const COLLECTION = {
		start: ['Getting started', 'bi-flag', 1],
		schedule: ['Scheduling and bookings', 'bi-calendar-week', 2],
		invoices: ['Estimates and invoices', 'bi-receipt', 3],
		portal: ['Customer portal and SMS', 'bi-chat-dots', 4],
		mobile: ['Mobile app and visits', 'bi-phone', 5],
		billing: ['Plans and billing', 'bi-credit-card', 6],
	};
	const ARTICLES = [
		[
			'welcome',
			'Welcome',
			'What Fieldline does, who it is for, and what a normal week looks like.',
			'start',
			'2026-08-06',
			'new accounts overview',
		],
		[
			'invite-team',
			'Bringing your team in',
			'The four roles, what each one can see, and how to send the invites.',
			'start',
			'2026-09-03',
			'roles seats',
		],
		[
			'import-customers',
			'Importing customers',
			'Bringing your customer list across from a spreadsheet.',
			'start',
			'2026-07-23',
			'import spreadsheet',
		],
		[
			'schedule-board',
			'Schedule board',
			'Assigning, moving and splitting visits, and reading the board.',
			'schedule',
			'2026-09-11',
			'board assigning',
		],
		[
			'service-windows',
			'Arrival windows',
			'What customers are promised, and how the board keeps to it.',
			'schedule',
			'2026-09-17',
			'scheduling reminders',
		],
		[
			'travel-planner',
			'Planning with Travel Planner',
			'Letting the add-on order each team member’s day by travel time.',
			'schedule',
			'2026-05-15',
			'travel add-ons territories',
		],
		[
			'refunds',
			'Refunds and credits',
			'Full and part refunds, credit notes, and which one to use.',
			'invoices',
			'2026-09-09',
			'refunds credit notes',
		],
		[
			'estimates',
			'Sending estimates',
			'Options, approval in the portal, and turning it into a booking.',
			'invoices',
			'2026-08-20',
			'quotes portal',
		],
		[
			'tap-to-pay',
			'Card payments on site',
			'Turning on tap to pay, taking a payment, and what to do if it fails.',
			'invoices',
			'2025-12-03',
			'payments mobile app',
		],
		[
			'sms-reminders',
			'SMS reminders',
			'Which texts go out, when, and how to change what they say.',
			'portal',
			'2026-09-16',
			'sms customers',
		],
		[
			'portal-setup',
			'Customer portal',
			'What customers can do in the portal, and adding your branding.',
			'portal',
			'2026-02-12',
			'add-ons branding',
		],
		[
			'sms-credits',
			'SMS credits',
			'How credits are counted, topping up, and the warning before zero.',
			'portal',
			'2026-08-28',
			'billing',
		],
		[
			'offline-mode',
			'Working offline',
			'What works without signal, and how changes catch up afterwards.',
			'mobile',
			'2026-07-10',
			'mobile app staff',
		],
		[
			'phone-setup',
			'Setting up a new phone',
			'From the download to a phone your staff can use on visits.',
			'mobile',
			'2026-09-22',
			'phones setup',
		],
		[
			'live-location',
			'Live location',
			'Who it covers, when it is on, and what the office can see.',
			'mobile',
			'2026-03-03',
			'location privacy',
		],
		[
			'plans-seats',
			'Plans and seats',
			'What each plan includes, how seats are counted, and moving plan.',
			'billing',
			'2026-06-13',
			'pricing',
		],
		[
			'failed-payments',
			'Failed payments',
			'What happens when the card on file is declined.',
			'billing',
			'2026-05-06',
			'cards',
		],
		[
			'two-step',
			'Passwords and sign-in',
			'Keeping the account safe without slowing your staff down.',
			'billing',
			'2026-09-25',
			'security accounts',
		],
	];

	/* Records, one shape for every kind
	   title and sub are shown and searched; keys are searched only.
	   lead is the avatar or icon, facts feed the best match card. */
	function status(pair) {
		return pair ? { label: pair[0], tone: pair[1] } : null;
	}

	const records = [];
	function add(r) {
		r.fTitle = fold(r.title);
		r.fHay = fold([r.title, r.sub, r.meta, r.keys, KIND[r.kind].one].join(' '));
		records.push(r);
	}

	BOOK.list().forEach((a) => {
		const plan = BOOK.plans[a.plan].name;
		const trade = BOOK.trades.find((t) => t.id === a.trade).name;
		const month = BOOK.mrr(a);
		const addOns = [
			a.route ? 'Travel Planner' : '',
			a.portal ? 'Customer Portal' : '',
			a.sms ? 'SMS credits' : '',
		].join(' ');
		add({
			kind: 'customers',
			title: a.name,
			sub: `${trade} · ${a.city}`,
			href: `company-details.html?id=${encodeURIComponent(a.id)}`,
			lead: { text: initials(a.name), tone: toneOf(a.name) },
			meta: `${plan} plan`,
			value: `${money(month)}/mo`,
			status: status(ACCOUNT_STATUS[a.status]),
			keys: [a.owner, addOns].join(' '),
			facts: [
				['Plan', plan],
				['Seats', `${a.used} of ${a.seats} in use`],
				['Monthly', money(month)],
				['Owner', a.owner],
			],
		});
	});

	SHOP.ORDERS.forEach((o) => {
		const what = o.lines.map((l) => `${l.qty} ${SKU[l.sku][l.qty === 1 ? 0 : 1]}`).join(', ');
		const items = o.lines.reduce((t, l) => t + l.qty, 0);
		add({
			kind: 'orders',
			title: o.orderNumber,
			sub: `${o.customer} · ${what}`,
			href: `order-details.html?id=${encodeURIComponent(o.orderNumber)}`,
			lead: { icon: SKU[o.lines[0].sku][2], tone: SKU[o.lines[0].sku][3] },
			meta: `Placed ${day(o.date)}`,
			value: money(o.total, true),
			status: status(STAGE[stageOf(o)]),
			keys: `order ${o.ship}`,
			facts: [
				['Customer', o.customer],
				['Items', plural(items, 'item', 'items')],
				['Placed', day(o.date)],
				['Delivery', o.ship],
			],
		});
	});

	/* An invoice's icon says what it bills: a plan, an add-on, an extra or services. */
	function billedFor(item) {
		if (/plan/.test(item)) return { icon: 'bi-layers', tone: 1 };
		if (/Travel Planner|Customer Portal|SMS/.test(item)) return { icon: 'bi-puzzle', tone: 4 };
		if (/Onboarding|onboarding|training|course/.test(item)) return { icon: 'bi-mortarboard', tone: 6 };
		const extra = [
			['phone line', 'bi-telephone', 4],
			['storage', 'bi-cloud-plus', 5],
			['import', 'bi-upload', 3],
			['form', 'bi-ui-checks', 3],
			['Report', 'bi-file-earmark-text', 3],
			['set-up call', 'bi-headset', 5],
		].find(([word]) => item.indexOf(word) !== -1);
		return extra ? { icon: extra[1], tone: extra[2] } : { icon: 'bi-cpu', tone: 2 };
	}
	BILLING.invoices().forEach((inv) => {
		const issued = inv.issued || inv.saved;
		const overdue = inv.state === 'sent' && inv.due < TODAY;
		const st =
			inv.state === 'draft'
				? ['Draft', 'muted']
				: inv.state === 'paid'
					? ['Paid', 'success']
					: inv.state === 'void'
						? ['Void', 'muted']
						: overdue
							? ['Overdue', 'danger']
							: ['Sent', 'info'];
		const when =
			inv.state === 'draft'
				? `Saved ${day(issued)}`
				: inv.state === 'paid'
					? `Paid ${day(inv.paid.on)}`
					: inv.state === 'void'
						? 'Voided'
						: `Due ${day(inv.due)}`;
		add({
			kind: 'invoices',
			title: inv.no,
			sub: `${inv.customer} · ${inv.item}`,
			href: `invoice-details.html?id=${encodeURIComponent(inv.no)}`,
			lead: billedFor(inv.item),
			meta: when,
			value: money(inv.amount, true),
			status: status(st),
			keys: `invoice bill ${inv.order || ''}`,
			facts: [
				['Customer', inv.customer],
				['Amount', money(inv.amount, true)],
				[inv.state === 'draft' ? 'Saved' : 'Issued', day(issued)],
				inv.state === 'paid'
					? ['Paid', day(inv.paid.on)]
					: ['Due', inv.state === 'draft' ? 'When sent' : day(inv.due)],
			],
		});
	});

	BOOK.list().forEach((a) =>
		a.people.forEach((p) =>
			add({
				kind: 'people',
				title: p.name,
				sub: `${p.title} · ${a.name}`,
				href: `person-details.html?id=${encodeURIComponent(p.key)}`,
				lead: { text: initials(p.name), tone: toneOf(p.name), round: true },
				meta: 'Customer contact',
				value: '',
				status: null,
				keys: p.email,
				facts: [
					['Role', p.title],
					['Works At', a.name],
					['Email', p.email],
				],
			}),
		),
	);

	for (const [id, name, job, team, email] of TEAM) {
		add({
			kind: 'people',
			title: name,
			sub: `${job} · ${team} team`,
			href: `employee-user-details.html?id=${encodeURIComponent(id)}`,
			lead: { text: initials(name), tone: toneOf(name), round: true },
			meta: 'Fieldline team',
			value: '',
			status: null,
			keys: email,
			facts: [
				['Role', job],
				['Team', team],
				['Email', email],
			],
		});
	}

	for (const [id, title, summary, coll, updated, tags] of ARTICLES) {
		add({
			kind: 'help',
			title,
			sub: summary,
			href: `handbook.html#article/${id}`,
			lead: { icon: COLLECTION[coll][1], tone: COLLECTION[coll][2] },
			meta: COLLECTION[coll][0],
			value: '',
			status: null,
			keys: tags,
			facts: [
				['Collection', COLLECTION[coll][0]],
				['Updated', day(updated)],
			],
		});
	}

	/* Pages: every link in the sidebar menu, with the section it sits in. */
	const seen = new Set(['search-results.html']);
	const sections = pickAll('.basalt-mainmenu-scroll .basalt-menu-group');

	for (const a of pickAll('.basalt-mainmenu-scroll a[href]')) {
		const href = a.getAttribute('href');
		const label = (pick('.basalt-menu-label', a) || a).textContent.trim();
		if (!href || href.charAt(0) === '#' || seen.has(href) || seen.has(`${href}|${label}`)) continue;
		seen.add(`${href}|${label}`);
		const section = a.closest('.basalt-menu-group');
		const sectionName = section ? pick('.basalt-menu-group-heading', section).textContent.trim() : '';
		const parentList = a.closest('ul');
		const parentLink =
			parentList &&
			parentList.previousElementSibling &&
			parentList.previousElementSibling.matches('.basalt-menu-entry-parent')
				? pick('.basalt-menu-label', parentList.previousElementSibling).textContent.trim()
				: '';
		const icon = pick('.basalt-menu-glyph', a);
		const glyphName = icon ? Array.from(icon.classList).find((c) => c.indexOf('bi-') === 0) : 'bi-window';
		add({
			kind: 'pages',
			title: label,
			sub: [sectionName, parentLink].filter(Boolean).join(' · '),
			href,
			lead: { icon: glyphName, tone: (sections.indexOf(section) % 6) + 1 },
			meta: '',
			value: '',
			status: null,
			keys: '',
			facts: [],
		});
	}

	/* Matching and ranking */
	function reEsc(s) {
		return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function score(r, q, words) {
		if (!words.every((w) => r.fHay.includes(w))) return 0;
		const t = r.fTitle;
		if (t === q) return 100;
		if (t.startsWith(q)) return 80;
		if (words.every((w) => t.includes(w))) {
			return words.every((w) => new RegExp(`(^|[^a-z0-9])${reEsc(w)}`).test(t)) ? 60 : 40;
		}
		return 20;
	}

	/* Wraps every typed word in <mark>, ignoring case and accents. */
	function mark(text, words) {
		const s = String(text);
		let folded = '';
		const at = [];
		for (let i = 0; i < s.length; i++) {
			const f = fold(s[i]);
			for (let k = 0; k < f.length; k++) {
				folded += f[k];
				at.push(i);
			}
		}
		const ranges = [];
		words.forEach((w) => {
			let from = folded.indexOf(w);
			while (from !== -1 && w) {
				ranges.push([at[from], at[from + w.length - 1] + 1]);
				from = folded.indexOf(w, from + w.length);
			}
		});
		if (!ranges.length) return htmlSafe(s);
		ranges.sort((a, b) => a[0] - b[0]);
		const merged = [ranges[0]];

		for (const r of ranges.slice(1)) {
			const last = merged[merged.length - 1];
			/* Words next to each other read as one highlight. */
			if (r[0] <= last[1] || !s.slice(last[1], r[0]).trim()) last[1] = Math.max(last[1], r[1]);
			else merged.push(r);
		}

		let out = '';
		let pos = 0;

		for (const [a, b] of merged) {
			out += `${htmlSafe(s.slice(pos, a))}<mark>${htmlSafe(s.slice(a, b))}</mark>`;
			pos = b;
		}

		return out + htmlSafe(s.slice(pos));
	}

	function search(query) {
		const q = fold(query).trim().replace(/\s+/g, ' ');
		const words = q ? q.split(' ') : [];
		const hits = q ? records.map((r, i) => ({ r, i, s: score(r, q, words) })).filter((h) => h.s > 0) : [];

		function order(k) {
			return KINDS.findIndex((x) => x.id === k);
		}

		hits.sort((a, b) => b.s - a.s || order(a.r.kind) - order(b.r.kind) || a.i - b.i);
		const byKind = Object.fromEntries(KINDS.map((k) => [k.id, hits.filter((h) => h.r.kind === k.id)]));
		/* A best match is only claimed when the title itself matches. */
		const best = hits.length && hits[0].s >= 60 ? hits[0] : null;
		return { q, words, hits, byKind, best };
	}

	/* Rendering */
	const el = {
		input: pick('[data-sr-query]', root),
		form: pick('[data-sr-form]', root),
		results: pick('[data-sr-results]', root),
		status: pick('[data-sr-status]', root),
		kindRow: pick('.sr-kinds', root),
		kinds: pickAll('[data-sr-kind]', root),
	};
	const state = { query: '', kind: 'all', shown: 10 };
	const ALL_PREVIEW = 3;

	function leadHtml(r) {
		return r.lead.icon
			? `<span class="sr-tile" data-sr-tone="${r.lead.tone}" aria-hidden="true"><i class="bi ${r.lead.icon}"></i></span>`
			: `<span class="basalt-avatar basalt-avatar-tone-${r.lead.tone}${r.lead.round ? '' : ' basalt-avatar-rounded'}" aria-hidden="true">${htmlSafe(r.lead.text)}</span>`;
	}

	function pill(st) {
		return st
			? `<span class="basalt-status basalt-status-dot${st.tone === 'muted' ? '' : ` basalt-status-${st.tone}`}">${htmlSafe(st.label)}</span>`
			: '';
	}

	function rowHtml(r, words) {
		const facts = `${
			(r.meta
				? `<span class="sr-row-meta">${htmlSafe(r.meta)}</span>`
				: '<span class="sr-row-meta" aria-hidden="true"></span>') +
			(r.value
				? `<span class="sr-row-value">${htmlSafe(r.value)}</span>`
				: '<span class="sr-row-value" aria-hidden="true"></span>')
		}<span class="sr-row-status">${pill(r.status)}</span>`;
		return `<li><a class="sr-row" href="${htmlSafe(r.href)}" data-sr-nav data-sr-open>${leadHtml(r)}<span class="sr-row-main"><span class="sr-row-title">${mark(r.title, words)}</span>${r.sub ? `<span class="sr-row-sub">${mark(r.sub, words)}</span>` : ''}</span><span class="sr-row-facts">${facts}</span><i class="bi bi-chevron-right sr-row-go" aria-hidden="true"></i></a></li>`;
	}

	function bestHtml(r, words) {
		const k = KIND[r.kind];
		const tile = r.lead.icon
			? `<span class="sr-tile" data-sr-tone="${k.tone}" aria-hidden="true"><i class="bi ${r.lead.icon}"></i></span>`
			: `<span class="sr-tile" data-sr-tone="${k.tone}" aria-hidden="true">${htmlSafe(r.lead.text)}</span>`;
		return `<section class="card basalt-box sr-best" data-sr-tone="${k.tone}" aria-labelledby="sr-best-title">${tile}<div class="sr-best-body"><p class="sr-best-eyebrow"><i class="bi bi-stars" aria-hidden="true"></i>Best match · ${htmlSafe(k.one.charAt(0).toUpperCase() + k.one.slice(1))}</p><h2 class="sr-best-title" id="sr-best-title">${mark(r.title, words)}</h2>${r.sub ? `<p class="sr-best-sub">${mark(r.sub, words)}</p>` : ''}${r.facts.length ? `<dl class="sr-best-facts">${r.facts.map(([label, value]) => `<div class="sr-best-fact"><dt>${htmlSafe(label)}</dt><dd>${htmlSafe(value)}</dd></div>`).join('')}</dl>` : ''}</div><a class="btn btn-primary sr-best-go" href="${htmlSafe(r.href)}" data-sr-nav data-sr-open>${htmlSafe(k.open)}<i class="bi bi-arrow-right ms-2" aria-hidden="true"></i></a></section>`;
	}

	function groupHtml(k, list, total, words, mode) {
		const id = `sr-group-${k.id}`;
		const more = mode === 'all' && total > list.length;
		const left = mode === 'kind' && total > list.length;
		const desc = more
			? `${plural(total, 'match', 'matches')}, ${list.length} shown`
			: plural(total, 'match', 'matches');
		return `<section class="card basalt-box sr-group" data-sr-tone="${k.tone}" aria-labelledby="${id}"><header class="sr-group-head"><span class="sr-tile" data-sr-tone="${k.tone}" aria-hidden="true"><i class="bi ${k.icon}"></i></span><div class="sr-group-text"><h2 class="sr-group-title" id="${id}">${htmlSafe(k.name)}</h2><p class="sr-group-desc">${desc}</p></div>${k.list ? `<a class="sr-group-link" href="${k.list[0]}">${htmlSafe(k.list[1])}<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>` : ''}</header><ul class="sr-list">${list.map((h) => rowHtml(h.r, words)).join('')}</ul>${more ? `<div class="sr-group-foot"><p>${plural(total - list.length, `more ${k.one}`, `more ${k.many}`)} match this search.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-sr-show="${k.id}">Show all ${total} ${htmlSafe(total === 1 ? k.one : k.many)}</button></div>` : ''}${left ? `<div class="sr-group-foot"><p>Showing ${list.length} of ${total}.</p><button type="button" class="btn btn-sm btn-outline-secondary" data-sr-more>Show ${Math.min(10, total - list.length)} more</button></div>` : ''}</section>`;
	}

	function emptyHtml(o) {
		return `<div class="basalt-empty basalt-empty-framed" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi ${o.icon}"></i></span><h2 class="basalt-empty-title">${o.title}</h2><p class="basalt-empty-text">${o.text}</p>${o.actions ? `<div class="basalt-empty-actions">${o.actions}</div>` : ''}</div>`;
	}

	/* Recent searches stay in this browser only. Storage can be missing
     (private windows, blocked site data), so every use is guarded. */
	const RECENT_KEY = 'basalt-search-recent';
	const RECENT_DEMO = ['#471', 'travel planner', 'Marie Tremblay'];
	function readRecent() {
		try {
			const saved = JSON.parse(localStorage.getItem(RECENT_KEY));
			return Array.isArray(saved) ? saved.filter((s) => typeof s === 'string') : RECENT_DEMO.slice();
		} catch {
			return RECENT_DEMO.slice();
		}
	}
	function writeRecent(list) {
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(list));
		} catch {
			/* storage blocked: keep the list for this visit only */
		}
	}
	let recent = readRecent();
	function remember(q) {
		const t = String(q || '').trim();
		if (!t) return;
		recent = [t].concat(recent.filter((s) => fold(s) !== fold(t))).slice(0, 5);
		writeRecent(recent);
	}

	function recentHtml() {
		if (!recent.length) {
			return emptyHtml({
				icon: 'bi-search',
				title: 'Search across Fieldline',
				text: 'Customers, store orders, invoices, people, help articles and pages, all from the box above.',
			});
		}
		return `<section class="card basalt-box sr-group sr-recent" aria-labelledby="sr-recent-title"><header class="sr-group-head sr-recent-head"><div class="sr-group-text"><h2 class="sr-group-title" id="sr-recent-title">Recent searches</h2><p class="sr-group-desc">Kept in this browser only.</p></div><button type="button" class="btn btn-sm btn-outline-secondary" data-sr-forget>Clear</button></header><ul class="sr-list">${recent.map((s) => `<li><a class="sr-row" href="?q=${encodeURIComponent(s)}" data-sr-nav data-sr-recent="${htmlSafe(s)}"><span class="sr-tile" data-sr-tone="${(toneOf(s) % 6) + 1}" aria-hidden="true"><i class="bi bi-clock-history"></i></span><span class="sr-row-main"><span class="sr-row-title">${htmlSafe(s)}</span></span><i class="bi bi-arrow-up-left sr-row-go" aria-hidden="true"></i></a></li>`).join('')}</ul></section>`;
	}

	let firstRender = true;
	function render() {
		const res = search(state.query);
		const total = res.hits.length;
		const raw = state.query.trim();
		const quoted = `“${htmlSafe(raw)}”`;

		el.kindRow.hidden = !res.q;
		el.kinds.forEach((b) => {
			const id = b.getAttribute('data-sr-kind');
			const n = id === 'all' ? total : res.byKind[id].length;
			pick('[data-sr-count]', b).textContent = n;
			b.setAttribute('aria-pressed', String(id === state.kind));
			b.classList.toggle('is-none', !!res.q && n === 0);
		});

		let html = '';
		if (!res.q) {
			html = recentHtml();
			el.status.textContent = 'Type to search.';
		} else if (!total) {
			html = emptyHtml({
				icon: 'bi-search',
				title: `Nothing matches ${quoted}`,
				text: 'We looked through customers, store orders, invoices, people, help articles and pages. Check the spelling, or try fewer words.',
				actions: `<button type="button" class="btn btn-outline-secondary" data-sr-clear>Clear search</button><a class="btn btn-outline-secondary" href="handbook.html"><i class="bi bi-journal-text" aria-hidden="true"></i>Browse the handbook</a>`,
			});
			el.status.textContent = `No results for ${raw}.`;
		} else if (state.kind === 'all') {
			const best = res.best;
			if (best) html += bestHtml(best.r, res.words);
			const groups = KINDS.map((k) => ({ k, list: res.byKind[k.id] }))
				.filter((g) => g.list.length)
				.sort((a, b) => b.list[0].s - a.list[0].s || KINDS.indexOf(a.k) - KINDS.indexOf(b.k));

			for (const g of groups) {
				const rest = g.list.filter((h) => h !== best);
				if (!rest.length) continue;
				html += groupHtml(g.k, rest.slice(0, ALL_PREVIEW), rest.length, res.words, 'all');
			}

			const parts = KINDS.filter((k) => res.byKind[k.id].length).map((k) =>
				plural(res.byKind[k.id].length, k.one, k.many),
			);
			el.status.textContent = `${plural(total, 'result', 'results')} for ${raw}: ${parts.join(', ')}.`;
		} else {
			const k = KIND[state.kind];
			const list = res.byKind[k.id];
			if (list.length) {
				html = groupHtml(k, list.slice(0, state.shown), list.length, res.words, 'kind');
				el.status.textContent = `${plural(list.length, k.one, k.many)} for ${raw}.`;
			} else {
				html = emptyHtml({
					icon: k.icon,
					title: `No ${htmlSafe(k.many)} match ${quoted}`,
					text: `The other kinds hold ${plural(total, 'result', 'results')} for this search.`,
					actions: `<button type="button" class="btn btn-outline-secondary" data-sr-show="all">Show all ${plural(total, 'result', 'results')}</button>`,
				});
				el.status.textContent = `No ${k.many} for ${raw}. ${plural(total, 'result', 'results')} in other kinds.`;
			}
		}

		el.results.innerHTML = html;
		el.results.classList.toggle('is-entering', firstRender);
		firstRender = false;
	}

	/* State in the address bar */
	function syncUrl() {
		const p = new URLSearchParams();
		p.set('q', state.query.trim());
		if (state.kind !== 'all') p.set('kind', state.kind);
		history.replaceState(null, '', `?${p.toString()}`);
	}
	function setQuery(q, opts) {
		state.query = q;
		state.shown = 10;
		if (el.input.value !== q) el.input.value = q;
		render();
		syncUrl();
		if (opts && opts.remember) remember(q);
	}
	function setKind(kind) {
		state.kind = KIND[kind] ? kind : 'all';
		state.shown = 10;
		render();
		syncUrl();
	}

	/* Events */
	start();
})();
