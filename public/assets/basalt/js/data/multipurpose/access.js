/**
 * Who may open what. One set of roles and one grid of access per
 * workspace, kept here so Roles, Permissions, Employee Users, Employee
 * User Details and Access Requests all name the same roles and agree on
 * what each one reaches. The areas down the side of the grid are the
 * groups of the sidebar menu, so a role reads as "which parts of this
 * admin they can open".
 *
 * One workspace ships: general, the company behind every section of
 * the menu. It has three base roles (Owner, Administrator, Read-only)
 * and its own job roles on top; SETS takes more workspaces, and the
 * Roles and Permissions pages switch between them.
 *
 * To run it on your own records, replace LEVELS, SETS and ROSTER with
 * the same fields; every page reads through the helpers below.
 *
 * window.Basalt.data.access
 *   levels                 lowest first: none, view, edit, full
 *   levelRank(id)          0 to 3
 *   levelById(id)
 *   sets()                 [{ id, name }] of the workspaces
 *   set(id)                a fresh copy of one workspace: roles, groups,
 *                          access, lastSaved, me. A group with risk
 *                          { from, why } warns when a role is given that
 *                          level there; sensitive groups and resources
 *                          ask for a hold before more access is saved.
 *   resources(set)         every resource with its group
 *   levelOf(set, map, roleId, resourceId)
 *                          the level a role lands on after inheritance
 *   areaLevel(set, map, roleId, groupId)
 *                          the highest level the role has in a group
 *   areaLevels(set, map, roleId)
 *                          { groupId: rank } for every group
 *   people(set)            [{ id, name, team, region, role }] of the
 *                          general workspace's staff and their roles
 *   headcount(set)         { roleId: how many hold it }
 */
(() => {
	'use strict';

	/* Lowest first. rank is what "more access" means; key is the letter
     that sets it on the Permissions grid. */
	const LEVELS = [
		{
			id: 'none',
			rank: 0,
			name: 'None',
			long: 'No access',
			icon: 'bi-dash-circle',
			key: 'n',
			text: 'Hidden from the role',
		},
		{
			id: 'view',
			rank: 1,
			name: 'View',
			long: 'Can view',
			icon: 'bi-eye',
			key: 'v',
			text: 'Can look, can’t change anything',
		},
		{
			id: 'edit',
			rank: 2,
			name: 'Edit',
			long: 'Can edit',
			icon: 'bi-pencil',
			key: 'e',
			text: 'Can add and change, not delete',
		},
		{
			id: 'full',
			rank: 3,
			name: 'Full',
			long: 'Full access',
			icon: 'bi-shield-check',
			key: 'f',
			text: 'Everything, including delete and setup',
		},
	];

	/* The three roles every workspace starts with. The Owner is locked at
     Full everywhere; Read-only tops out at View and is what the job
     roles inherit from. */
	const BASE_ROLES = [
		{
			id: 'owner',
			name: 'Owner',
			rank: 1,
			icon: 'bi-star',
			builtin: true,
			locked: true,
			manage: false,
			about: 'Everything, including the plan and handing over the workspace.',
			note: 'The Owner always has full access. Ownership moves in Settings.',
		},
		{
			id: 'admin',
			name: 'Administrator',
			rank: 2,
			icon: 'bi-shield-check',
			builtin: true,
			manage: true,
			about: 'Runs the workspace day to day. Everything except the plan and payroll.',
		},
		{
			id: 'readonly',
			name: 'Read-only',
			rank: 9,
			icon: 'bi-eye',
			builtin: true,
			manage: true,
			max: 'view',
			about: 'Can look at the day-to-day screens, but not change them.',
			note: 'Read-only can see things but never change them, so View is as high as it goes.',
		},
	];

	/* The general workspace. Groups follow the sidebar top to bottom;
     each group's resources are the pages inside it, folded into two to
     four rows. A sensitive group or resource asks for a hold to confirm
     when a role gains access to it. */
	const GENERAL = {
		id: 'general',
		name: 'General',
		me: { name: 'John Armstrong', role: 'admin' },
		lastSaved: { by: 'Hope Stout', at: '2026-10-06T11:05:00' },
		roles: [
			...BASE_ROLES,
			{
				id: 'sales',
				name: 'Sales rep',
				rank: 3,
				icon: 'bi-briefcase',
				inherits: 'readonly',
				manage: true,
				about: 'Leads, deals and quotes, and the customers behind them.',
			},
			{
				id: 'support',
				name: 'Support agent',
				rank: 4,
				icon: 'bi-headset',
				inherits: 'readonly',
				manage: true,
				about: 'Tickets and customer records, and the bookings they ask about.',
			},
			{
				id: 'store',
				name: 'Store manager',
				rank: 5,
				icon: 'bi-shop',
				inherits: 'readonly',
				manage: true,
				about: 'The shop, its catalog and orders, and what the storefront shows.',
			},
			{
				id: 'warehouse',
				name: 'Warehouse staff',
				rank: 6,
				icon: 'bi-boxes',
				inherits: 'readonly',
				manage: true,
				about: 'Stock, purchase orders and shipments. No prices or money.',
			},
			{
				id: 'accountant',
				name: 'Accountant',
				rank: 7,
				icon: 'bi-calculator',
				inherits: 'readonly',
				manage: true,
				about: 'The books, invoices, refunds and payroll. Reports to read.',
			},
			{
				id: 'hr',
				name: 'HR manager',
				rank: 8,
				icon: 'bi-person-workspace',
				inherits: 'readonly',
				manage: true,
				about: 'Employees, time off, hiring and reviews. Invites new staff.',
			},
			{
				id: 'marketing',
				name: 'Marketing manager',
				rank: 5,
				icon: 'bi-megaphone',
				inherits: 'readonly',
				manage: true,
				about: 'Campaigns, the blog, pages and newsletters, plus marketing reports.',
			},
			{
				id: 'engineer',
				name: 'Engineer',
				rank: 6,
				icon: 'bi-code-slash',
				inherits: 'readonly',
				manage: true,
				about: 'Connections, API keys, jobs and logs. No customer money.',
			},
		],
		groups: [
			{
				id: 'crm',
				name: 'CRM',
				icon: 'bi-person-rolodex',
				open: true,
				resources: [
					{
						id: 'leads',
						name: 'Leads and deals',
						desc: 'The pipeline, deal details and activities',
						page: 'leads.html',
					},
					{
						id: 'quotes',
						name: 'Quotes',
						desc: 'Prices offered and whether they were taken',
						page: 'quotes.html',
					},
					{
						id: 'trials',
						name: 'Trials',
						desc: 'Accounts trying the product right now',
						page: 'trials.html',
					},
				],
			},
			{
				id: 'customers',
				name: 'Customers',
				icon: 'bi-people',
				resources: [
					{
						id: 'companies',
						name: 'Companies and people',
						desc: 'Customer accounts, contacts and segments',
						page: 'companies.html',
					},
					{
						id: 'shoppers',
						name: 'Shoppers',
						desc: 'People who buy from the online store',
						page: 'shoppers.html',
					},
					{
						id: 'reviews',
						name: 'Reviews and feedback',
						desc: 'What customers wrote, and replies to it',
						page: 'reviews.html',
					},
				],
			},
			{
				id: 'catalog',
				name: 'Catalog',
				icon: 'bi-box-seam',
				resources: [
					{
						id: 'products',
						name: 'Products and brands',
						desc: 'Items for sale, categories and brands',
						page: 'products.html',
					},
					{
						id: 'plans',
						name: 'Plans and prices',
						desc: 'Subscription plans and the price list',
						page: 'subscription-plans.html',
					},
				],
			},
			{
				id: 'orders',
				name: 'Orders & Billing',
				icon: 'bi-receipt',
				risk: { from: 'full', why: 'Full access here can refund money and cancel orders.' },
				resources: [
					{
						id: 'orderbook',
						name: 'Orders',
						desc: 'Orders placed and where each one is',
						page: 'orders.html',
					},
					{
						id: 'invoices',
						name: 'Invoices and receipts',
						desc: 'Bills sent, payments in and subscriptions',
						page: 'invoices.html',
					},
					{
						id: 'refunds',
						name: 'Refunds and returns',
						desc: 'Money going back out',
						page: 'refunds.html',
						sensitive: true,
					},
				],
			},
			{
				id: 'marketing',
				name: 'Marketing & Content',
				icon: 'bi-megaphone',
				resources: [
					{
						id: 'social',
						name: 'Social and newsletters',
						desc: 'Posts, the planner and mailings',
						page: 'social-dashboard.html',
					},
					{
						id: 'blog',
						name: 'Blog and pages',
						desc: 'Posts, landing pages and the page editor',
						page: 'blog.html',
					},
					{
						id: 'banners',
						name: 'Banners and menus',
						desc: 'What the site shows and how it is laid out',
						page: 'banners.html',
					},
				],
			},
			{
				id: 'analytics',
				name: 'Analytics',
				icon: 'bi-graph-up',
				risk: { from: 'full', why: 'Full access here can export customer and invoice data.' },
				resources: [
					{
						id: 'reports',
						name: 'Reports',
						desc: 'Saved reports and the report builder',
						page: 'reports.html',
					},
					{
						id: 'dashboards',
						name: 'Dashboards',
						desc: 'Sales, revenue, customer and marketing views',
						page: 'sales-insights.html',
					},
					{
						id: 'exports',
						name: 'Data exports',
						desc: 'CSV downloads of customers, orders and invoices',
						page: 'reports.html',
						sensitive: true,
					},
				],
			},
			{
				id: 'support',
				name: 'Support',
				icon: 'bi-life-preserver',
				resources: [
					{
						id: 'tickets',
						name: 'Tickets',
						desc: 'Open questions and who is answering them',
						page: 'tickets.html',
					},
					{
						id: 'helpdesk',
						name: 'Help desk and handbook',
						desc: 'Help articles, the FAQ and reply templates',
						page: 'help-desk.html',
					},
				],
			},
			{
				id: 'store',
				name: 'Online Store',
				icon: 'bi-shop',
				risk: { from: 'full', why: 'Full access here can change payment methods and payouts.' },
				resources: [
					{
						id: 'storefront',
						name: 'Storefront and carts',
						desc: 'The shop as shoppers see it, and carts left behind',
						page: 'storefront.html',
					},
					{
						id: 'shipping',
						name: 'Shipments and shipping',
						desc: 'Parcels on their way, carriers and rates',
						page: 'shipments.html',
					},
					{
						id: 'promos',
						name: 'Promo codes and taxes',
						desc: 'Discounts and the tax rules at checkout',
						page: 'promo-codes.html',
					},
					{
						id: 'payouts',
						name: 'Payment methods and payouts',
						desc: 'How shoppers pay and where the money lands',
						page: 'payment-methods.html',
						sensitive: true,
					},
				],
			},
			{
				id: 'bookings',
				name: 'Bookings',
				icon: 'bi-calendar-check',
				resources: [
					{
						id: 'bookingbook',
						name: 'Bookings',
						desc: 'Appointments made and their details',
						page: 'bookings.html',
					},
					{
						id: 'services',
						name: 'Services',
						desc: 'What can be booked, for how long and at what price',
						page: 'services.html',
					},
				],
			},
			{
				id: 'inventory',
				name: 'Inventory',
				icon: 'bi-boxes',
				resources: [
					{
						id: 'stock',
						name: 'Stock levels and transfers',
						desc: 'What is on hand and moving between sites',
						page: 'stock-levels.html',
					},
					{
						id: 'purchasing',
						name: 'Purchase orders',
						desc: 'Stock ordered from suppliers',
						page: 'purchase-orders.html',
					},
					{ id: 'suppliers', name: 'Suppliers', desc: 'Who the company buys from', page: 'suppliers.html' },
				],
			},
			{
				id: 'finance',
				name: 'Finance',
				icon: 'bi-bank',
				sensitive: true,
				risk: { from: 'edit', why: 'They can change the books, bank matches and budgets.' },
				resources: [
					{
						id: 'books',
						name: 'Accounting and journal',
						desc: 'The ledger and every entry in it',
						page: 'accounting.html',
					},
					{
						id: 'cashflow',
						name: 'Income and expenses',
						desc: 'Money in, money out and the receipts behind it',
						page: 'income.html',
					},
					{
						id: 'banking',
						name: 'Transactions and reconciliation',
						desc: 'Bank movements matched to the books',
						page: 'transactions.html',
					},
					{
						id: 'budgets',
						name: 'Budgets and tax reports',
						desc: 'Spending plans and what is owed',
						page: 'budgets.html',
					},
				],
			},
			{
				id: 'people',
				name: 'People',
				icon: 'bi-person-workspace',
				sensitive: true,
				risk: { from: 'edit', why: 'They can see salaries and change staff files and payroll.' },
				resources: [
					{
						id: 'employees',
						name: 'Employees',
						desc: 'Staff files, contact details and managers',
						page: 'employees.html',
					},
					{
						id: 'timeoff',
						name: 'Shifts and time off',
						desc: 'Who is in, who is away and the timesheets',
						page: 'shifts.html',
					},
					{
						id: 'payroll',
						name: 'Payroll',
						desc: 'Pay runs and payslips',
						page: 'payroll.html',
						sensitive: true,
					},
					{
						id: 'hiring',
						name: 'Hiring and performance',
						desc: 'Openings, candidates and reviews',
						page: 'hiring.html',
					},
				],
			},
			{
				id: 'work',
				name: 'Work',
				icon: 'bi-kanban',
				resources: [
					{
						id: 'projects',
						name: 'Projects and tasks',
						desc: 'Boards, to-dos and who owns what',
						page: 'projects.html',
					},
					{
						id: 'teams',
						name: 'Teams and schedule',
						desc: 'Team pages, meetings and the calendar',
						page: 'teams.html',
					},
					{ id: 'approvals', name: 'Approvals', desc: 'Requests waiting for a yes', page: 'approvals.html' },
				],
			},
			{
				id: 'access',
				name: 'Team & Access',
				icon: 'bi-shield-lock',
				sensitive: true,
				risk: { from: 'edit', why: 'They can invite people and give them any role, including their own.' },
				resources: [
					{
						id: 'users',
						name: 'Users and invitations',
						desc: 'Invite, suspend and remove teammates',
						page: 'employee-users.html',
					},
					{
						id: 'roles',
						name: 'Roles and permissions',
						desc: 'This page and the Roles page',
						page: 'roles.html',
					},
					{
						id: 'signins',
						name: 'Sign-in history and requests',
						desc: 'Who signed in, and who asked for more access',
						page: 'sign-in-history.html',
					},
				],
			},
			{
				id: 'system',
				name: 'System',
				icon: 'bi-gear',
				sensitive: true,
				risk: { from: 'edit', why: 'They can change sign-in rules, connections and API keys.' },
				resources: [
					{
						id: 'settings',
						name: 'Settings',
						desc: 'Company details, sign-in rules and branding',
						page: 'settings.html',
					},
					{
						id: 'connections',
						name: 'Connections and API keys',
						desc: 'Outside services and the keys that reach them',
						page: 'connections.html',
					},
					{
						id: 'audit',
						name: 'Audit trail and backups',
						desc: 'Who changed what, and the copies to roll back to',
						page: 'audit-trail.html',
					},
					{
						id: 'jobs',
						name: 'Jobs, logs and status',
						desc: 'Background work, errors and maintenance',
						page: 'background-jobs.html',
					},
				],
			},
		],
		/* Each role's own cells. A cell a role does not set falls back to
       the role it inherits from; Read-only sets every cell. */
		access: {
			admin: grant(
				'full',
				[
					'leads',
					'quotes',
					'trials',
					'companies',
					'shoppers',
					'reviews',
					'products',
					'plans',
					'orderbook',
					'invoices',
					'refunds',
					'social',
					'blog',
					'banners',
					'reports',
					'dashboards',
					'exports',
					'tickets',
					'helpdesk',
					'storefront',
					'shipping',
					'promos',
					'payouts',
					'bookingbook',
					'services',
					'stock',
					'purchasing',
					'suppliers',
					'books',
					'cashflow',
					'banking',
					'budgets',
					'employees',
					'timeoff',
					'hiring',
					'projects',
					'teams',
					'approvals',
					'users',
					'roles',
					'signins',
					'settings',
					'connections',
					'audit',
					'jobs',
				],
				{ payroll: 'view' },
			),
			readonly: grant(
				'view',
				[
					'leads',
					'quotes',
					'trials',
					'companies',
					'shoppers',
					'reviews',
					'products',
					'plans',
					'orderbook',
					'invoices',
					'social',
					'blog',
					'banners',
					'reports',
					'dashboards',
					'tickets',
					'helpdesk',
					'storefront',
					'shipping',
					'promos',
					'bookingbook',
					'services',
					'stock',
					'purchasing',
					'suppliers',
					'projects',
					'teams',
					'approvals',
				],
				{
					refunds: 'none',
					exports: 'none',
					payouts: 'none',
					books: 'none',
					cashflow: 'none',
					banking: 'none',
					budgets: 'none',
					employees: 'none',
					timeoff: 'none',
					payroll: 'none',
					hiring: 'none',
					users: 'none',
					roles: 'none',
					signins: 'none',
					settings: 'none',
					connections: 'none',
					audit: 'none',
					jobs: 'none',
				},
			),
			sales: {
				leads: 'full',
				quotes: 'full',
				trials: 'full',
				companies: 'edit',
				reviews: 'edit',
				invoices: 'view',
				bookingbook: 'edit',
			},
			support: {
				tickets: 'full',
				helpdesk: 'edit',
				companies: 'edit',
				shoppers: 'edit',
				reviews: 'edit',
				orderbook: 'edit',
				refunds: 'view',
				bookingbook: 'edit',
				shipping: 'view',
			},
			store: {
				storefront: 'full',
				shipping: 'full',
				promos: 'full',
				payouts: 'view',
				products: 'full',
				plans: 'edit',
				orderbook: 'full',
				refunds: 'edit',
				shoppers: 'edit',
				reviews: 'edit',
				banners: 'edit',
				stock: 'edit',
				dashboards: 'edit',
			},
			warehouse: {
				stock: 'full',
				purchasing: 'full',
				suppliers: 'edit',
				shipping: 'edit',
				orderbook: 'edit',
				products: 'view',
				leads: 'none',
				quotes: 'none',
				trials: 'none',
				social: 'none',
				blog: 'none',
				banners: 'none',
			},
			accountant: {
				books: 'full',
				cashflow: 'full',
				banking: 'full',
				budgets: 'full',
				invoices: 'full',
				refunds: 'full',
				payouts: 'edit',
				payroll: 'edit',
				employees: 'view',
				reports: 'edit',
				exports: 'view',
				plans: 'edit',
				promos: 'view',
				purchasing: 'view',
				suppliers: 'edit',
			},
			hr: {
				employees: 'full',
				timeoff: 'full',
				payroll: 'view',
				hiring: 'full',
				teams: 'edit',
				approvals: 'edit',
				users: 'edit',
				signins: 'view',
				reports: 'edit',
				leads: 'none',
				quotes: 'none',
				trials: 'none',
				shoppers: 'none',
				orderbook: 'none',
				storefront: 'none',
				shipping: 'none',
				promos: 'none',
				stock: 'none',
				purchasing: 'none',
			},
			marketing: {
				social: 'full',
				blog: 'full',
				banners: 'full',
				reviews: 'edit',
				promos: 'edit',
				dashboards: 'edit',
				reports: 'edit',
				exports: 'view',
				companies: 'view',
				shoppers: 'view',
			},
			engineer: {
				connections: 'full',
				jobs: 'full',
				audit: 'view',
				settings: 'edit',
				reports: 'edit',
				projects: 'edit',
				leads: 'none',
				quotes: 'none',
				trials: 'none',
				shoppers: 'none',
				invoices: 'none',
				promos: 'none',
				bookingbook: 'none',
				services: 'none',
				purchasing: 'none',
				suppliers: 'none',
			},
		},
	};

	/* Who holds which role in the general workspace, by sign-in id, so
     the people counts on Roles and Permissions match the Employee Users
     roster. Names, teams and cities come from people.js when that file
     is loaded first; people who have left are not listed. */
	const ROSTER = [
		['rc', 'owner'],
		['km', 'admin'],
		['ja', 'admin'],
		['pd', 'admin'],
		['rd', 'accountant'],
		['hs', 'accountant'],
		['mo', 'accountant'],
		['ih', 'hr'],
		['ew', 'sales'],
		['mb', 'sales'],
		['lf', 'sales'],
		['za', 'sales'],
		['rf', 'sales'],
		['op', 'sales'],
		['pr', 'support'],
		['yh', 'support'],
		['dr', 'support'],
		['sl', 'support'],
		['ab', 'support'],
		['rk', 'support'],
		['ms', 'support'],
		['cm', 'support'],
		['jt', 'support'],
		['nd', 'support'],
		['bc', 'support'],
		['si', 'support'],
		['ev', 'store'],
		['ta', 'store'],
		['hb', 'store'],
		['gl', 'store'],
		['cd', 'store'],
		['nf', 'store'],
		['lo', 'warehouse'],
		['wa', 'warehouse'],
		['cr', 'marketing'],
		['sr', 'marketing'],
		['dk', 'marketing'],
		['pm', 'marketing'],
		['as', 'engineer'],
		['mk', 'engineer'],
		['hw', 'engineer'],
		['og', 'engineer'],
		['lg', 'engineer'],
		['th', 'engineer'],
		['ds', 'engineer'],
		['ka', 'engineer'],
		['so', 'engineer'],
		['fr', 'engineer'],
		['im', 'engineer'],
		['yt', 'engineer'],
		['lm', 'engineer'],
		['jp', 'engineer'],
		['np', 'engineer'],
		['ak', 'engineer'],
		['nfe', 'readonly'],
		['jw', 'readonly'],
		['ao', 'readonly'],
	];

	const SETS = { general: GENERAL };

	function start() {
		window.Basalt.data = window.Basalt.data || {};
		window.Basalt.data.access = {
			levels: LEVELS.map((level) => ({ ...level })),
			levelRank,
			levelById,
			sets: () => Object.values(SETS).map(({ id, name }) => ({ id, name })),
			set,
			resources,
			levelOf,
			areaLevel,
			areaLevels,
			people,
			headcount,
		};
	}

	/** One level on many resources, plus the exceptions. */
	function grant(level, ids, exceptions = {}) {
		const cells = {};
		for (const id of ids) cells[id] = level;
		return Object.assign(cells, exceptions);
	}

	function levelRank(id) {
		const level = levelById(id);
		return level ? level.rank : 0;
	}

	function levelById(id) {
		return LEVELS.find((level) => level.id === id) || null;
	}

	/** A fresh copy of a workspace, with each role's headcount filled in. */
	function set(id) {
		const source = SETS[id] || SETS.general;
		const copy = JSON.parse(JSON.stringify(source));
		const counts = headcount(copy.id);
		for (const role of copy.roles) role.people = counts[role.id] || 0;
		return copy;
	}

	function resources(workspace) {
		return workspace.groups.flatMap((group) => group.resources.map((resource) => ({ group, ...resource })));
	}

	/**
	 * The level a role lands on for one resource in the given access map,
	 * after following inheritance. A locked role is always at Full.
	 */
	function levelOf(workspace, map, roleId, resourceId) {
		const role = workspace.roles.find((candidate) => candidate.id === roleId);
		if (!role) return 'none';
		if (role.locked) return LEVELS[LEVELS.length - 1].id;
		const own = map[roleId] && map[roleId][resourceId];
		if (own) return own;
		return role.inherits ? levelOf(workspace, map, role.inherits, resourceId) : 'none';
	}

	/** The highest level a role holds anywhere in a group, as a rank. */
	function areaLevel(workspace, map, roleId, groupId) {
		const group = workspace.groups.find((candidate) => candidate.id === groupId);
		if (!group) return 0;
		let top = 0;
		for (const resource of group.resources)
			top = Math.max(top, levelRank(levelOf(workspace, map, roleId, resource.id)));
		return top;
	}

	function areaLevels(workspace, map, roleId) {
		const levels = {};
		for (const group of workspace.groups) levels[group.id] = areaLevel(workspace, map, roleId, group.id);
		return levels;
	}

	/** The general staff with their role; names and places from people.js when it is loaded. */
	function people(setId) {
		const staff = window.Basalt.data && window.Basalt.data.people;
		return ROSTER.map(([id, role]) => {
			const person = staff ? staff.find(id) : null;
			const place = person && staff.cityOf(person);
			return {
				id,
				role,
				name: person ? staff.nameOf(person) : id.toUpperCase(),
				team: person ? person.team : '',
				region: place ? place.region : '',
			};
		});
	}

	function headcount(setId) {
		const counts = {};
		for (const [, role] of ROSTER) counts[role] = (counts[role] || 0) + 1;
		return counts;
	}

	start();
})();
