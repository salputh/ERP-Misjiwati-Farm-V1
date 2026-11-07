/**
 * Drives the standalone status screens: the 404 dead end (route animation,
 * page finder, broken-link report), the 500 outage page, both launch
 * countdowns and the maintenance window. Every part looks for its own
 * data-stp-* hook first and stays idle on a page that does not carry it.
 * Used by 404-not-found.html, 500-server-error.html, coming-soon-1.html,
 * coming-soon-2-2.html and down-for-maintenance.html.
 */
(() => {
	'use strict';

	/* An address needs text on both sides of the @ and a dotted domain. */
	const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

	/* Toast tones mapped to the stem of their filled glyph; anything unlisted uses the info mark. */
	const TONE_GLYPHS = { success: 'check-circle', danger: 'exclamation-octagon', warning: 'exclamation-triangle' };

	/* Both the toast shelf and each toast announce politely, as one block. */
	const LIVE_REGION = { 'aria-live': 'polite', 'aria-atomic': 'true' };

	/*
	 * Every demo page as title: path from this page's folder without .html,
	 * filed under its menu section and in menu order. The 404 finder and its
	 * closest-match hint read from here, so a page added to the menu belongs
	 * here as well (tools/checks/links.py fails on an entry that leads nowhere).
	 */
	const SITE_MAP = {
		Overview: {
			General: 'index',
			Sales: 'sales-dashboard',
			Analytics: 'analytics-dashboard',
			'BI Board': 'bi-board',
			Realtime: 'realtime',
			'E-Commerce': 'ecommerce-dashboard',
			Travel: 'travel',
			CRM: 'crm-dashboard',
			Finance: 'finance-dashboard',
			Investing: 'investing',
			HR: 'hr-dashboard',
			Medical: 'medical-dashboard',
			'My Day': 'my-day',
		},
		CRM: {
			Leads: 'leads',
			'Lead Details': 'lead-details',
			'Deal Pipeline': 'deal-pipeline',
			Deals: 'deals',
			'Deal Details': 'deal-details',
			Quotes: 'quotes',
			'Quote Details': 'quote-details',
			Activities: 'activities',
			Trials: 'trials',
			'Trial Details': 'trial-details',
		},
		Customers: {
			Companies: 'companies',
			'Company Details': 'company-details',
			'People at Companies': 'people-at-companies',
			'Person Details': 'person-details',
			Segments: 'segments',
			'Segment Details': 'segment-details',
			Shoppers: 'shoppers',
			'Shopper Details': 'shopper-details',
			Reviews: 'reviews',
			Feedback: 'feedback',
		},
		Healthcare: {
			'Front Desk & Check-in': 'front-desk-and-check-in',
			'Patient Flow': 'patient-flow',
			Locations: 'locations',
			'Location Details': 'location-details',
			Patients: 'patients',
			'Patient Chart': 'patient-chart',
			'Visit Notes': 'visit-notes',
			Appointments: 'appointments',
			'Appointment Details': 'appointment-details',
			Telehealth: 'telehealth',
			Prescriptions: 'prescriptions',
			'Lab Orders & Results': 'lab-orders-and-results',
			'Imaging & Reports': 'imaging-and-reports',
			Referrals: 'referrals',
			Providers: 'providers',
			'Provider Details': 'provider-details',
			'Provider Schedule': 'provider-schedule',
			'Visit Types': 'visit-types',
			'Emergency Queue': 'emergency-queue',
			'Wards & Beds': 'wards-and-beds',
		},
		Catalog: {
			Products: 'products',
			'Product Details': 'product-details',
			'Subscription Plans': 'subscription-plans',
			'Plan Details': 'plan-details',
			Categories: 'categories',
			Brands: 'brands',
			'Brand Details': 'brand-details',
			'Price List': 'price-list',
		},
		'Orders & Billing': {
			Orders: 'orders',
			'Order Details': 'order-details',
			Subscriptions: 'subscriptions',
			'Subscription Details': 'subscription-details',
			Invoices: 'invoices',
			'Invoice Details': 'invoice-details',
			'New Invoice': 'new-invoice',
			Receipts: 'receipts',
			'Receipt Details': 'receipt-details',
			Refunds: 'refunds',
			'Refund Details': 'refund-details',
			Returns: 'returns',
			'Return Details': 'return-details',
		},
		'Marketing & Content': {
			'Social Dashboard': 'social-dashboard',
			'Social Planner': 'social-planner',
			'Social Post Details': 'social-post-details',
			Newsletters: 'newsletters',
			'Newsletter Details': 'newsletter-details',
			Blog: 'blog',
			'Post Editor': 'post-editor',
			Media: 'media',
			'Blog Categories': 'blog-categories',
			Comments: 'comments',
			Banners: 'banners',
			'Landing Pages': 'landing-pages',
			Pages: 'pages',
			'Page Editor': 'page-editor',
			Menus: 'menus',
		},
		Analytics: {
			Reports: 'reports',
			'Report Details': 'report-details',
			'Report Builder': 'report-builder',
			Sales: 'sales-insights',
			Revenue: 'revenue-insights',
			Customers: 'customer-insights',
			'Customer Insight': 'customer-insight',
			Marketing: 'marketing-insights',
			'Campaign Details': 'campaign-details',
			'Product Usage': 'product-usage',
			Funnel: 'funnel',
		},
		Support: {
			Tickets: 'tickets',
			'Ticket Details': 'ticket-details',
			'Help Desk': 'help-desk',
			Handbook: 'handbook',
			FAQ: 'faq',
			'Reply Templates': 'reply-templates',
		},
		'Online Store': {
			Storefront: 'storefront',
			'Abandoned Carts': 'abandoned-carts',
			Shipments: 'shipments',
			'Shipment Details': 'shipment-details',
			'Promo Codes': 'promo-codes',
			Shipping: 'shipping',
			Taxes: 'taxes',
			'Payment Methods': 'payment-methods',
			Payouts: 'payouts',
		},
		Bookings: { Bookings: 'bookings', 'Booking Details': 'booking-details', Services: 'services' },
		Inventory: {
			'Stock Levels': 'stock-levels',
			'Purchase Orders': 'purchase-orders',
			'Stock Transfers': 'stock-transfers',
			Suppliers: 'suppliers',
			'Supplier Details': 'supplier-details',
		},
		Finance: {
			Accounting: 'accounting',
			Journal: 'journal',
			'Journal Entry Details': 'journal-entry-details',
			Income: 'income',
			Expenses: 'expenses',
			'Expense Details': 'expense-details',
			Transactions: 'transactions',
			'Transaction Details': 'transaction-details',
			Reconciliation: 'reconciliation',
			'Tax Reports': 'tax-reports',
			Budgets: 'budgets',
			'Budget Details': 'budget-details',
			'Finance Reports': 'finance-reports',
		},
		People: {
			Employees: 'employees',
			'Employee Details': 'employee-details',
			Shifts: 'shifts',
			'Time Off': 'time-off',
			Timesheets: 'timesheets',
			'Timesheet Details': 'timesheet-details',
			Payroll: 'payroll',
			'Payslip Details': 'payslip-details',
			Hiring: 'hiring',
			'Candidate Details': 'candidate-details',
			'Role Details': 'role-details',
			Performance: 'performance',
		},
		Work: {
			Projects: 'projects',
			'Project Details': 'project-details',
			'Project Board': 'project-board',
			'To Dos': 'to-dos',
			'Task Details': 'task-details',
			Teams: 'teams',
			'Team Details': 'team-details',
			Schedule: 'schedule',
			Meetings: 'meetings',
			'Meeting Details': 'meeting-details',
			Approvals: 'approvals',
			'Approval Details': 'approval-details',
		},
		'Company Chat': {
			Announcements: 'announcements',
			'Announcement Details': 'announcement-details',
			Chat: 'chat',
			Inbox: 'inbox',
			Mail: 'mail',
			Notifications: 'notifications',
			'Video Call': 'video-call',
			'Voice Call': 'voice-call',
		},
		'Team & Access': {
			'Access Requests': 'access-requests',
			Activity: 'activity',
			Invitations: 'invitations',
			Permissions: 'permissions',
			Roles: 'roles',
			'Sign In History': 'sign-in-history',
			'Employee Users': 'employee-users',
			'Employee User Details': 'employee-user-details',
		},
		Apps: { 'AI Assistant': 'ai-assistant', 'Team Bookmarks': 'team-bookmarks', Drive: 'drive', Notes: 'notes' },
		System: {
			'Audit Trail': 'audit-trail',
			'Background Jobs': 'background-jobs',
			Backups: 'backups',
			Connections: 'connections',
			'Connection Details': 'connection-details',
			'Event Log': 'event-log',
			'Error Details': 'error-details',
			Maintenance: 'maintenance-windows',
			Settings: 'settings',
			'System Status': 'system-status',
		},
		Components: {
			Accordion: 'accordion',
			Alerts: 'alerts',
			Avatars: 'avatars',
			Badges: 'badges',
			Breadcrumbs: 'breadcrumbs',
			Buttons: 'buttons',
			Cards: 'cards',
			Dropdowns: 'dropdowns',
			'Empty States': 'empty-states',
			Headers: 'headers',
			Lightbox: 'lightbox',
			Loaders: 'loaders',
			Modals: 'modals',
			Offcanvas: 'offcanvas',
			Pagination: 'pagination',
			Progress: 'progress',
			Slideshow: 'slideshow',
			Tabs: 'tabs',
			Toasts: 'toasts',
			Tooltips: 'tooltips',
			'Tree & Sortable': 'tree-and-sortable',
			Typography: 'typography',
		},
		Forms: {
			'Form Builder': 'form-builder',
			'Field Types': 'field-types',
			'Date Fields': 'date-fields',
			'Time Fields': 'time-fields',
			'Text Editor': 'text-editor',
			'Sliders & Rating': 'sliders-and-rating',
			'Color Fields': 'color-fields',
			'File Uploads': 'file-uploads',
			'Form Validation': 'form-validation',
			'Step Forms': 'step-forms',
		},
		Tables: {
			'Table Tools': 'table-tools',
			'Table Basics': 'table-basics',
			'Data Grids': 'data-grids',
			'Edit in Place': 'edit-in-place',
			'Infinite Scroll Table': 'infinite-scroll-table',
			'Tables on Mobile': 'tables-on-mobile',
		},
		Charts: {
			Advanced: 'apex-charts',
			Areas: 'area-charts',
			Bars: 'bar-charts',
			'Chart.js': 'chartjs-charts',
			Donuts: 'donut-charts',
			Lines: 'line-charts',
			Combos: 'mixed-charts',
			Pies: 'pie-charts',
			'Polar Areas': 'polar-charts',
			Radars: 'radar-charts',
			Scatter: 'scatter-charts',
		},
		Calendar: { 'Full Calendar': 'full-calendar' },
		Icons: {
			'Bootstrap Icons': 'bootstrap-icons',
			'Font Awesome': 'font-awesome',
			'Lucide Icons': 'lucide-icons',
			'Phosphor Icons': 'phosphor-icons',
		},
		'Sign-In Screens': {
			'Sign In': 'sign-in',
			'Sign Up': 'sign-up',
			'Forgot Password': 'forgot-password',
			'Reset Password': 'reset-password',
			'Sleep Mode': 'sleep-mode',
			'2FA': 'two-step-sign-in',
			'Verify Email': 'verify-email',
			'Magic Link': 'magic-link',
			'SSO Sign In': 'sso-sign-in',
			'Session Expired': 'session-expired',
			'Account Suspended': 'account-suspended',
			'Sign In (Threshold)': 'sign-in-2',
			'Sign Up (Threshold)': 'sign-up-2',
			'Forgot Password (Threshold)': 'forgot-password-2',
			'Reset Password (Threshold)': 'reset-password-2',
			'Sleep Mode (Threshold)': 'sleep-mode-2',
			'2FA (Threshold)': 'two-step-sign-in-2',
			'Verify Email (Threshold)': 'verify-email-2',
			'Magic Link (Threshold)': 'magic-link-2',
			'SSO Sign In (Threshold)': 'sso-sign-in-2',
			'Session Expired (Threshold)': 'session-expired-2',
			'Account Suspended (Threshold)': 'account-suspended-2',
		},
		'Additional Screens': {
			'My Profile': 'my-profile',
			'My Account': 'my-account',
			Security: 'security',
			'Price Tiers': 'price-tiers',
			'Search Results': 'search-results',
			'History Feed': 'history-feed',
			'Privacy Policy': 'privacy-policy',
			'Terms of Service': 'terms-of-service',
			'Coming Soon 1': 'coming-soon-1',
			'Coming Soon 2': 'coming-soon-2-2',
			Maintenance: 'down-for-maintenance',
			'404 Not Found': '404-not-found',
			'500 Server Error': '500-server-error',
		},
	};

	/* The same pages flattened into { title, file, area } records, sidebar order kept. */
	const PAGES = Object.entries(SITE_MAP).flatMap(([area, entries]) =>
		Object.entries(entries).map(([title, stem]) => ({
			title,
			file: `${stem}.html`,
			name: stem.split('/').pop(),
			area,
		})),
	);

	function start() {
		toastShelf();
		/* These pages load without basalt.js, so the footer year is set here. */
		for (const year of pickAll('[data-basalt-chrome="year"]')) year.textContent = new Date().getFullYear();

		wireReportDialog();
		showMissingAddress();
		wirePageFinder();
		pick('[data-stp-404-back]')?.addEventListener('click', stepBackOrHome);
		animateDeadEnd();

		wireOutagePage();

		wireLaunchCountdown();
		wireSpotlight();
		countUpWaitlist();
		wireLaunchSignup();

		wireMaintenance();
	}

	/* Shared pieces: toasts, number formatting, motion preference, navigation. */

	/** Returns the toast container, creating it at the end of the body on first use. */
	function toastShelf() {
		const placed = pick('[data-stp-toaster]');
		if (placed !== null) return placed;
		const shelf = document.createElement('div');
		shelf.className = 'stp-toaster';
		for (const [name, value] of Object.entries(LIVE_REGION)) shelf.setAttribute(name, value);
		shelf.dataset.stpToaster = '';
		return document.body.appendChild(shelf);
	}

	/**
	 * Shows a Bootstrap toast that removes itself once hidden.
	 * @param {string} message plain text for the toast body
	 * @param {string} [tone] primary, success, danger or warning
	 */
	function toast(message, tone = 'primary') {
		const Toast = window.bootstrap?.Toast;
		if (!Toast) return;
		const glyph = TONE_GLYPHS[tone] ?? 'info-circle';
		const blueprint = document.createElement('template');
		blueprint.innerHTML =
			`<div class="toast align-items-center border-0 text-bg-${tone}" role="status">` +
			'<div class="d-flex">' +
			`<div class="toast-body d-flex align-items-center gap-2"><i class="bi bi-${glyph}-fill"></i><span></span></div>` +
			'<button class="btn-close btn-close-white me-2 m-auto" type="button" aria-label="Close" data-bs-dismiss="toast"></button>' +
			'</div></div>';
		const card = blueprint.content.firstElementChild;
		for (const [name, value] of Object.entries(LIVE_REGION)) card.setAttribute(name, value);
		pick('.toast-body > span', card).textContent = message;
		card.addEventListener('hidden.bs.toast', () => card.remove());
		toastShelf().appendChild(card);
		new Toast(card, { delay: 3200 }).show();
	}

	function twoDigits(value) {
		return String(value).padStart(2, '0');
	}

	/** Twelve-hour clock text such as "9:05 am", or "9:05:12 am" with seconds. */
	function clockText(moment, withSeconds) {
		const hours = moment.getHours();
		const seconds = withSeconds ? `:${twoDigits(moment.getSeconds())}` : '';
		return `${hours % 12 || 12}:${twoDigits(moment.getMinutes())}${seconds}${hours < 12 ? ' am' : ' pm'}`;
	}

	function prefersStillness() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	/* A visitor who arrived from outside has no history to return to. */
	function stepBackOrHome() {
		if (window.history.length > 1 && document.referrer) window.history.back();
		else window.location.href = 'index.html';
	}

	/**
	 * Runs draw(eased) on every frame for the given duration, easing out on a
	 * cubic curve from 0 to 1.
	 */
	function tween(duration, draw) {
		let began = null;
		function frame(now) {
			began ??= now;
			const progress = Math.min(1, (now - began) / duration);
			draw(1 - (1 - progress) ** 3);
			if (progress < 1) window.requestAnimationFrame(frame);
		}
		window.requestAnimationFrame(frame);
	}

	/** Writes a form reply and marks it as accepted or not. */
	function setReply(node, message, accepted) {
		if (!node) return;
		node.textContent = message;
		node.classList.toggle('is-ok', accepted);
	}

	/* 404: the address that failed and the page it most likely meant. */

	function showMissingAddress() {
		const pathCode = pick('[data-stp-404-path]');
		const hint = pick('[data-stp-404-match]');
		if (!pathCode) return;

		const { folder, slug } = missingAddress(pathCode);
		const highlight = document.createElement('mark');
		highlight.textContent = slug;
		pathCode.textContent = `${folder}/`;
		pathCode.appendChild(highlight);

		const reportAddress = pick('[data-stp-report-path]');
		if (reportAddress) reportAddress.textContent = `${folder}/${slug}`;

		if (!hint) return;
		const nearest = nearestPage(slug);
		if (!nearest) {
			hint.hidden = true;
			return;
		}
		hint.href = nearest.file;
		pick('[data-stp-404-match-name]', hint).textContent = nearest.title;
	}

	/**
	 * Splits the address bar into folder and file name. Served as a real 404
	 * it holds the missing address; opened as a demo it holds this page, so
	 * the sample written on the element stands in.
	 */
	function missingAddress(pathCode) {
		const segments = decodeURIComponent(window.location.pathname || '/').split('/');
		const slug = segments.pop();
		if (slug && !/404-not-found\.html?$/.test(slug)) return { folder: segments.join('/'), slug };
		return { folder: '', slug: pathCode.getAttribute('data-stp-404-sample') || 'invoces.html' };
	}

	/** The page whose file or title is fewest edits away, if it is close enough to trust. */
	function nearestPage(slug) {
		const wanted = simplify(slug);
		if (!wanted) return null;
		let nearest = null;
		let fewestEdits = Infinity;
		for (const page of PAGES) {
			const edits = Math.min(
				editsBetween(wanted, simplify(page.name)),
				editsBetween(wanted, simplify(page.title)),
			);
			if (edits < fewestEdits) {
				fewestEdits = edits;
				nearest = page;
			}
		}
		/* Missing by more than a third of the word is a guess rather than a match. */
		return fewestEdits <= Math.max(2, Math.floor(wanted.length / 3)) ? nearest : null;
	}

	function simplify(text) {
		return text
			.toLowerCase()
			.replace(/\.html?$/, '')
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
	}

	/** Levenshtein distance, kept in one rolling row of costs. */
	function editsBetween(source, target) {
		const costs = Array.from({ length: target.length + 1 }, (_, column) => column);
		for (let row = 0; row < source.length; row += 1) {
			let diagonal = costs[0];
			costs[0] = row + 1;
			for (let column = 1; column <= target.length; column += 1) {
				const above = costs[column];
				const swap = source[row] === target[column - 1] ? 0 : 1;
				costs[column] = Math.min(above + 1, costs[column - 1] + 1, diagonal + swap);
				diagonal = above;
			}
		}
		return costs[target.length];
	}

	/* 404: the page finder, a combobox over every demo page. */

	function wirePageFinder() {
		const field = pick('[data-stp-404-input]');
		const listbox = pick('[data-stp-404-results]');
		if (!field || !listbox) return;

		let matches = [];
		let highlighted = -1;
		const keyActions = {
			ArrowDown: (event) => move(event, 1),
			ArrowUp: (event) => move(event, -1),
			Enter: follow,
			Escape: dismiss,
		};

		field.addEventListener('input', refresh);
		field.addEventListener('focus', refresh);
		field.addEventListener('keydown', (event) => keyActions[event.key]?.(event));
		document.addEventListener('click', (event) => {
			if (!event.target.closest('[data-stp-404-search]')) collapse();
		});
		/* A slash anywhere outside a text field jumps to the finder, as admin tools tend to do. */
		document.addEventListener('keydown', (event) => {
			if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
			if (isTypingIn(event.target)) return;
			event.preventDefault();
			field.focus();
		});

		function refresh() {
			const typed = field.value;
			matches = findPages(typed);
			listbox.innerHTML = '';
			if (!typed.trim()) {
				collapse();
				return;
			}
			if (matches.length === 0) listbox.appendChild(emptyRow(typed.trim()));
			for (const [position, page] of matches.entries()) listbox.appendChild(resultRow(page, position));
			listbox.hidden = false;
			field.setAttribute('aria-expanded', 'true');
			highlight(matches.length ? 0 : -1);
		}

		function highlight(position) {
			highlighted = position;
			const options = [...pickAll('[role="option"]', listbox)];
			for (const [index, option] of options.entries()) {
				option.setAttribute('aria-selected', String(index === position));
			}
			const current = options[position];
			if (current) field.setAttribute('aria-activedescendant', current.id);
			else field.removeAttribute('aria-activedescendant');
		}

		function collapse() {
			listbox.hidden = true;
			field.setAttribute('aria-expanded', 'false');
			highlight(-1);
		}

		function move(event, direction) {
			const count = matches.length;
			if (!count) return;
			event.preventDefault();
			highlight((highlighted + direction + count) % count);
		}

		function follow(event) {
			const chosen = highlighted > -1 ? matches[highlighted] : null;
			if (!chosen) return;
			event.preventDefault();
			window.location.href = chosen.file;
		}

		function dismiss() {
			if (field.value) field.value = '';
			collapse();
		}
	}

	/**
	 * Up to seven pages for a query: titles that start with it, then titles
	 * that contain it, then pages whose area or file name contains it.
	 */
	function findPages(query) {
		const needle = query.trim().toLowerCase();
		if (!needle) return [];
		const tiers = [[], [], []];
		for (const page of PAGES) {
			const tier = matchTier(page, needle);
			if (tier !== null) tiers[tier].push(page);
		}
		return tiers.flat().slice(0, 7);
	}

	function matchTier(page, needle) {
		const title = page.title.toLowerCase();
		if (title.startsWith(needle)) return 0;
		if (title.includes(needle)) return 1;
		if (page.area.toLowerCase().includes(needle) || page.name.includes(needle)) return 2;
		return null;
	}

	function resultRow(page, position) {
		const row = document.createElement('li');
		row.setAttribute('role', 'option');
		row.id = `status404-result-${position}`;
		const link = document.createElement('a');
		link.tabIndex = -1;
		link.href = page.file;
		const title = document.createElement('span');
		title.textContent = page.title;
		const area = document.createElement('span');
		area.className = 'stp-404-result-group';
		area.textContent = page.area;
		link.append(title, area);
		row.appendChild(link);
		return row;
	}

	function emptyRow(query) {
		const row = document.createElement('li');
		row.className = 'stp-404-results-empty';
		row.textContent = `No page matches “${query}”`;
		return row;
	}

	function isTypingIn(node) {
		return Boolean(node) && (node.isContentEditable || /^(input|textarea|select)$/i.test(node.tagName));
	}

	/* 404: the dot that runs the zero and falls out of its gap, plus pointer parallax. */

	function animateDeadEnd() {
		const art = pick('[data-stp-404-art]');
		const zeroPath = pick('[data-stp-404-zero]');
		const runner = pick('[data-stp-404-dot]');
		if (!art || !zeroPath || !runner || !zeroPath.getTotalLength) return;

		const length = zeroPath.getTotalLength();
		const gap = zeroPath.getPointAtLength(length);
		if (prefersStillness()) {
			placeRunner(runner, gap.x, gap.y);
			return;
		}

		const RUN_MS = 2600;
		const FALL_MS = 700;
		const LOOP_MS = RUN_MS + FALL_MS + 900;
		const FIRST_DELAY_MS = 1300;
		let firstFrame = null;

		window.requestAnimationFrame(frame);
		if (window.matchMedia('(pointer: fine)').matches) {
			document.addEventListener('mousemove', (event) => {
				art.style.setProperty('--px', (event.clientX / window.innerWidth - 0.5) * 2);
				art.style.setProperty('--py', (event.clientY / window.innerHeight - 0.5) * 2);
			});
		}

		function frame(now) {
			firstFrame ??= now;
			const elapsed = now - firstFrame - FIRST_DELAY_MS;
			if (elapsed < 0) runner.style.opacity = 0;
			else drawMoment(elapsed % LOOP_MS);
			window.requestAnimationFrame(frame);
		}

		/* One loop: run along the zero, drop out of the gap, then rest unseen. */
		function drawMoment(moment) {
			if (moment < RUN_MS) {
				const progress = moment / RUN_MS;
				const point = zeroPath.getPointAtLength(easeInOut(progress) * length);
				placeRunner(runner, point.x, point.y);
				runner.style.opacity = Math.min(1, progress * 8);
				return;
			}
			if (moment < RUN_MS + FALL_MS) {
				const drop = (moment - RUN_MS) / FALL_MS;
				placeRunner(runner, gap.x - 18 * drop, gap.y + 30 * drop + 110 * drop * drop);
				runner.style.opacity = 1 - drop;
				return;
			}
			runner.style.opacity = 0;
		}
	}

	function placeRunner(runner, x, y) {
		runner.setAttribute('cx', x);
		runner.setAttribute('cy', y);
	}

	function easeInOut(progress) {
		return progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
	}

	/* 404: the broken-link report, which turns into a receipt inside the same dialog. */

	function wireReportDialog() {
		const form = pick('[data-stp-report-form]');
		const receipt = pick('[data-stp-report-done]');
		if (!form) return;
		const emailField = pick('#report-email', form);

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			/*
			 * Only the source is required, so flag the one field that is wrong
			 * instead of letting .was-validated paint every optional field green.
			 */
			emailField?.classList.toggle('is-invalid', !emailField.checkValidity());
			const complete = form.checkValidity();
			if (!complete) {
				form.classList.add('stp-report-checked');
				pick(':invalid', form)?.focus();
				return;
			}
			if (!receipt) {
				toast('Logged. Broken links are triaged the same working day.', 'success');
				return;
			}
			fillReceipt(receipt, emailField?.value.trim());
			form.hidden = true;
			receipt.hidden = false;
			pick('[data-bs-dismiss]', receipt)?.focus();
		});

		/* Closing the dialog clears it, so the next visit starts a fresh report. */
		form.closest('.modal')?.addEventListener('hidden.bs.modal', () => {
			form.reset();
			form.classList.remove('stp-report-checked');
			emailField?.classList.remove('is-invalid');
			form.hidden = false;
			if (receipt) receipt.hidden = true;
		});
	}

	function fillReceipt(receipt, address) {
		pick('[data-stp-report-ref]', receipt).textContent = `BL-${1000 + Math.floor(Math.random() * 9000)}`;
		pick('[data-stp-report-follow]', receipt).textContent = address
			? `We will email ${address} once the link resolves again.`
			: 'The web team will pick it up today.';
	}

	/* 500: a reference to quote, a way back, and a health check on a timer. */

	function wireOutagePage() {
		const page = pick('[data-stp-500]');
		if (!page) return;

		const reference = pick('[data-stp-incident-id]', page);
		if (reference) reference.textContent = incidentReference(new Date());

		const copyButton = pick('[data-stp-500-copy]', page);
		if (copyButton && reference) {
			copyButton.addEventListener('click', () => copyReference(reference.textContent.trim()));
		}
		pick('[data-stp-500-back]', page)?.addEventListener('click', stepBackOrHome);

		wireHealthChecks(page);
	}

	/** Today's date plus four random hex characters, something support can search for. */
	function incidentReference(today) {
		const suffix = Math.random().toString(16).slice(2, 6).toUpperCase();
		return `ERR-${today.getFullYear()}${twoDigits(today.getMonth() + 1)}${twoDigits(today.getDate())}-${suffix}`;
	}

	function copyReference(text) {
		function confirmCopied() {
			toast('Reference copied', 'success');
		}
		const clipboard = navigator.clipboard;
		if (clipboard?.writeText) clipboard.writeText(text).then(confirmCopied, confirmCopied);
		else confirmCopied();
	}

	/**
	 * Counts down to the next automatic check and runs one early on request.
	 * Deployed, a check would reload the page (add data-stp-retry-reload to
	 * the button); the demo keeps the service down so the page stays readable.
	 */
	function wireHealthChecks(page) {
		const PAUSE_SECONDS = 30;
		const banner = pick('.stp-500-checked', page);
		const note = pick('[data-stp-500-checked]', page);
		const retry = pick('[data-stp-retry]', page);
		const state = { secondsLeft: PAUSE_SECONDS, checkedAt: new Date(), busy: false };

		retry?.addEventListener('click', () => runCheck(true));
		describe();
		setInterval(countDown, 1000);

		function describe() {
			if (!note || state.busy) return;
			note.textContent = `Last checked ${clockText(state.checkedAt, true)} · checking again in ${state.secondsLeft}s`;
		}

		function countDown() {
			if (state.busy) return;
			state.secondsLeft -= 1;
			if (state.secondsLeft <= 0) runCheck(false);
			else describe();
		}

		function runCheck(byHand) {
			if (state.busy) return;
			if (byHand && retry?.hasAttribute('data-stp-retry-reload')) {
				window.location.reload();
				return;
			}
			state.busy = true;
			banner?.classList.add('is-checking');
			if (note) note.textContent = 'Checking now…';
			const restingLabel = retry ? retry.innerHTML : '';
			const showSpinner = byHand && retry;
			if (showSpinner) {
				retry.disabled = true;
				retry.innerHTML = '<span class="stp-spinner" aria-hidden="true"></span>Reloading…';
			}
			setTimeout(() => {
				Object.assign(state, { busy: false, checkedAt: new Date(), secondsLeft: PAUSE_SECONDS });
				banner?.classList.remove('is-checking');
				if (showSpinner) {
					retry.innerHTML = restingLabel;
					retry.disabled = false;
					toast('Reports are still not responding. We will keep checking.', 'warning');
				}
				describe();
			}, 1500);
		}
	}

	/*
	 * Launch pages. The clock digits are <number-flow> elements (NumberFlow,
	 * loaded as a module); should the library fail to load, the same elements
	 * keep showing plain text.
	 */

	function wireLaunchCountdown() {
		const clockFace = pick('[data-stp-countdown]');
		if (!clockFace) return;
		const still = prefersStillness();
		const launch = launchMoment(clockFace);

		for (const stamp of pickAll('[data-stp-launch-date]')) {
			stamp.textContent = launch.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
			if (stamp.tagName === 'TIME') stamp.setAttribute('datetime', launch.toISOString());
		}

		const units = ['days', 'hours', 'minutes', 'seconds'].map((unit) => pick(`[data-stp-${unit}]`, clockFace));
		const announcer = document.createElement('span');
		announcer.className = 'stp-visually-hidden';
		clockFace.appendChild(announcer);

		paintUnits(units, timeUntil(launch));
		const flowReady = window.customElements ? window.customElements.whenDefined('number-flow') : Promise.reject();
		flowReady.then(rollIn).catch(() => {
			advance();
			setInterval(advance, 1000);
		});

		function advance() {
			const remaining = timeUntil(launch);
			const [days, hours, minutes] = remaining;
			paintUnits(units, remaining);
			announcer.textContent = `${days} days, ${hours} hours, ${minutes} minutes until launch`;
		}

		/* Each unit rolls up from zero, left to right, before the clock starts ticking. */
		function rollIn() {
			for (const [index, unit] of units.entries()) {
				unit.textContent = '';
				unit.format = index === 0 ? {} : { minimumIntegerDigits: 2 };
				unit.trend = -1;
				/* The tens digit of minutes and seconds never passes 5. */
				if (index >= 2) unit.digits = { 1: { max: 5 } };
				unit.update(0);
			}
			const opening = timeUntil(launch);
			for (const [index, unit] of units.entries()) {
				setTimeout(
					() => {
						unit.trend = 1;
						unit.update(opening[index]);
						unit.trend = -1;
					},
					still ? 0 : 200 + index * 160,
				);
			}
			setTimeout(
				() => {
					advance();
					setInterval(advance, 1000);
				},
				still ? 0 : 1400,
			);
		}
	}

	/** The launch named on the clock, or for the demo a moment that always
	 * sits the same distance ahead of now: data-stp-ahead="65 19 0 23" is
	 * 65 days, 19 hours, 0 minutes and 23 seconds, so the countdown never
	 * runs out. */
	function launchMoment(clockFace) {
		const written = clockFace.getAttribute('data-stp-target');
		const parsed = written ? new Date(written) : null;
		if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
		const [days = 45, hours = 0, minutes = 0, seconds = 0] = (clockFace.getAttribute('data-stp-ahead') || '45')
			.trim()
			.split(/\s+/)
			.map(Number);
		return new Date(Date.now() + (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000);
	}

	/** Whole days, hours, minutes and seconds left, never below zero. */
	function timeUntil(moment) {
		const left = Math.max(0, moment.getTime() - Date.now());
		return [
			Math.floor(left / 86400000),
			Math.floor((left / 3600000) % 24),
			Math.floor((left / 60000) % 60),
			Math.floor((left / 1000) % 60),
		];
	}

	function paintUnits(units, values) {
		for (const [index, unit] of units.entries()) {
			const value = values[index];
			if (typeof unit.update === 'function') unit.update(value);
			else unit.textContent = index === 0 ? value : twoDigits(value);
		}
	}

	/* The sneak peek's spotlight follows the pointer and settles back when it leaves. */
	function wireSpotlight() {
		const stage = pick('[data-stp-peek]');
		if (!stage) return;
		stage.addEventListener('pointermove', aimSpotlight);
		stage.addEventListener('pointerdown', aimSpotlight);
		stage.addEventListener('pointerleave', () => {
			stage.style.removeProperty('--mx');
			stage.style.removeProperty('--my');
		});
	}

	function aimSpotlight(event) {
		const stage = event.currentTarget;
		const box = stage.getBoundingClientRect();
		stage.style.setProperty('--mx', `${(((event.clientX - box.left) / box.width) * 100).toFixed(1)}%`);
		stage.style.setProperty('--my', `${(((event.clientY - box.top) / box.height) * 100).toFixed(1)}%`);
	}

	/* The waitlist figure climbs to its written value once, on load. */
	function countUpWaitlist() {
		const figure = pick('[data-stp-waitlist]');
		if (!figure || prefersStillness()) return;
		const total = parseInt(figure.textContent.replace(/[^0-9]/g, ''), 10) || 0;
		tween(500, (eased) => {
			figure.textContent = Math.round(total * eased).toLocaleString('en-US');
		});
	}

	function wireLaunchSignup() {
		const form = pick('[data-stp-subscribe]');
		if (!form) return;
		const field = pick('[data-stp-subscribe-input]', form);
		const reply = pick('[data-stp-subscribe-feedback]', form);

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const address = (field?.value || '').trim();
			if (!EMAIL_SHAPE.test(address)) {
				setReply(reply, 'That does not look like an email address.', false);
				field?.focus();
				return;
			}
			setReply(reply, 'You are on the list. We will email you once, on launch day.', true);
			if (field) field.value = '';
			toast('Launch-day email confirmed', 'success');
		});
	}

	/*
	 * Maintenance window. Step times and the "back at" time are written as
	 * minutes from page load, so the demo always reads as work under way now.
	 */

	function wireMaintenance() {
		const panel = pick('[data-stp-maint]');
		if (!panel) return;
		const openedAt = Date.now();

		for (const stamp of pickAll('[data-stp-maint-at]', panel)) {
			const moment = new Date(openedAt + parseFloat(stamp.getAttribute('data-stp-maint-at')) * 60000);
			const roughly = stamp.textContent.trim().startsWith('~');
			stamp.textContent = `${roughly ? '~' : ''}${clockText(moment, false)}`;
			stamp.setAttribute('datetime', moment.toISOString());
		}

		const meter = buildProgressMeter(panel);
		runEtaClock(panel, openedAt, meter);
		wireMaintenanceNotify(panel);
		wireReloadSwitch(panel);
		growStepper(panel);
	}

	/**
	 * Grows the filled connectors of the steps done and under way, the first
	 * time the stepper is on screen.
	 */
	function growStepper(panel) {
		const trail = pick('.stp-maint-stepper', panel);
		let left = trail ? pickAll('li:is(.is-done, .is-doing):not(:last-child)', trail).length : 0;
		if (!left || !window.IntersectionObserver || prefersStillness()) return;
		trail.classList.add('is-waiting');
		trail.addEventListener('animationend', function done(event) {
			if (event.animationName !== 'stp-trail-grow' || --left) return;
			trail.classList.remove('is-drawing');
			trail.removeEventListener('animationend', done);
		});
		const watch = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				watch.disconnect();
				trail.classList.replace('is-waiting', 'is-drawing');
			},
			{ threshold: 0.5 },
		);
		watch.observe(trail);
	}

	/**
	 * Fills the grid with 160 cells, one per slice of the work, and sweeps it
	 * up to its written figure. Returns null when the page has no grid.
	 */
	function buildProgressMeter(panel) {
		const grid = pick('[data-stp-maint-grid]', panel);
		if (!grid) return null;
		const CELL_COUNT = 160;
		const PER_ROW = 20;
		const IN_FLIGHT = 3;
		const readout = pick('[data-stp-progress-value]', panel);
		const cells = [];

		for (let index = 0; index < CELL_COUNT; index += 1) {
			const cell = document.createElement('span');
			cell.className = 'stp-maint-cell';
			cell.style.setProperty('--t', ((index % PER_ROW) / (PER_ROW - 1)).toFixed(3));
			grid.appendChild(cell);
			cells.push(cell);
		}

		const meter = {
			goal: parseFloat(grid.getAttribute('data-stp-progress-target') || '61'),
			percent: 0,
			fill(value) {
				meter.percent = Math.min(100, value);
				const finished = Math.floor((CELL_COUNT * meter.percent) / 100);
				const working = meter.percent < 100;
				for (const [index, cell] of cells.entries()) {
					cell.classList.toggle('is-done', index < finished);
					cell.classList.toggle('is-doing', index >= finished && index < finished + IN_FLIGHT && working);
				}
				if (readout) readout.textContent = `${Math.floor(meter.percent)}%`;
				grid.setAttribute('aria-valuenow', Math.floor(meter.percent));
			},
		};

		if (prefersStillness()) meter.fill(meter.goal);
		else tween(500, (eased) => meter.fill(meter.goal * eased));
		return meter;
	}

	/* Counts down to the "back at" time; once swept in, progress creeps toward 100% on the same clock. */
	function runEtaClock(panel, openedAt, meter) {
		const readout = pick('[data-stp-eta]', panel);
		const hours = readout ? parseFloat(readout.getAttribute('data-stp-eta-hours') || '4') : 4;
		const deadline = openedAt + hours * 3600000;
		const creepPerSecond = meter ? (100 - meter.goal) / (hours * 3600) : 0;

		tick();
		setInterval(tick, 1000);

		function tick() {
			const left = deadline - Date.now();
			if (readout) {
				readout.textContent =
					left <= 0
						? '00:00:00'
						: [left / 3600000, (left / 60000) % 60, (left / 1000) % 60]
								.map((part) => twoDigits(Math.floor(part)))
								.join(':');
			}
			if (meter && meter.percent >= meter.goal) {
				meter.fill(meter.goal + ((Date.now() - openedAt) / 1000) * creepPerSecond);
			}
		}
	}

	function wireMaintenanceNotify(panel) {
		const form = pick('[data-stp-maint-notify]', panel);
		if (!form) return;
		const reply = pick('[data-stp-maint-feedback]', panel);
		const field = pick('input[type="email"]', form);

		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const address = (field.value || '').trim();
			if (!EMAIL_SHAPE.test(address)) {
				setReply(reply, 'That does not look like an email address.', false);
				field.focus();
				return;
			}
			setReply(reply, `Done. We will email ${address} the moment it is back.`, true);
			field.value = '';
		});
	}

	/**
	 * The "reload when back" switch. Point data-stp-maint-health at an
	 * endpoint that answers 200 once the app is up; left empty, as in the
	 * demo, the switch only confirms the choice.
	 */
	function wireReloadSwitch(panel) {
		const toggle = pick('[data-stp-maint-reload]', panel);
		if (!toggle) return;
		const reply = pick('[data-stp-maint-feedback]', panel);
		let poller = null;

		toggle.addEventListener('change', () => {
			const healthUrl = toggle.getAttribute('data-stp-maint-health');
			setReply(reply, toggle.checked ? 'This tab will check every minute and reload itself.' : '', true);
			clearInterval(poller);
			poller = toggle.checked && healthUrl ? setInterval(() => reloadWhenHealthy(healthUrl), 60000) : null;
		});
	}

	function reloadWhenHealthy(url) {
		fetch(url, { cache: 'no-store' })
			.then((response) => {
				if (response.ok) window.location.reload();
			})
			.catch(() => {});
	}

	document.addEventListener('DOMContentLoaded', start);

	/* DOM lookups, shared by every helper above. */
	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}
})();
