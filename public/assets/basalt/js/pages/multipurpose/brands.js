/**
 * Basalt - Brands page (Catalog)
 * The mills and workshops whose clothes the Marlo shop sells, Marlo's
 * own label included: what each one makes, how it sold over the
 * last 90 days, the stock on hand and what is on order from it.
 * Draws the sales by brand card, the brand list, the brand drawer and
 * the Add brand dialog from BRANDS below. Each brand's own page,
 * where it is edited, is brand-details.html?id=<id>; a brand added
 * here in the demo has none, so it opens in the quick view.
 * In a real app BRANDS comes from your API; "today" is fixed so
 * the demo dates always read the same.
 */
(() => {
	'use strict';
	const root = pick('[data-cb-root]');
	if (!root) return;

	function start() {
		pick('[data-cb-add]', root).addEventListener('click', openAdd);
		dlg.addEventListener('shown.bs.modal', () => nameIn.focus());

		nameIn.addEventListener('input', () => {
			invalid(nameIn, false);
			drawLogoPreview();
		});
		emailIn.addEventListener('input', () => invalid(emailIn, false));
		leadIn.addEventListener('input', () => invalid(leadIn, false));
		fileIn.addEventListener('change', () => {
			const f = fileIn.files && fileIn.files[0];
			if (!f) return;
			if (f.size > 1024 * 1024) {
				toast({
					tone: 'danger',
					icon: 'bi-image',
					title: 'That logo is over 1 MB',
					text: 'Pick a smaller PNG or SVG.',
				});
				fileIn.value = '';
				return;
			}
			const r = new FileReader();
			r.onload = (ev) => {
				pendingLogo = ev.target.result;
				drawLogoPreview();
			};
			r.readAsDataURL(f);
		});
		E('logo-remove').addEventListener('click', () => {
			pendingLogo = null;
			fileIn.value = '';
			drawLogoPreview();
			pick('label[for="cb-logo"]', dlg).focus();
		});

		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const name = nameIn.value.trim();
			const email = emailIn.value.trim();
			const lead = parseInt(leadIn.value, 10);
			const bad = [];
			const clash = brands.some((c) => c.name.toLowerCase() === name.toLowerCase());
			if (!name || clash) {
				bad.push(nameIn);
				pick('#cb-name-error').textContent = clash
					? 'A brand with this name is already on the list.'
					: "Enter the brand's name.";
			}
			if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.push(emailIn);
			if (!(lead >= 1 && lead <= 120)) bad.push(leadIn);

			for (const i of [nameIn, emailIn, leadIn]) {
				invalid(i, bad.includes(i));
			}

			if (bad.length) {
				bad[0].focus();
				return;
			}

			const terms = pick('input[name="cbTerms"]:checked', dlg).value;
			const fields = {
				name,
				makes: E('makes').value.trim() || 'Products to be listed',
				city: E('city').value.trim(),
				country: E('country').value,
			};
			const id = `${name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '')}-${brands.length}`;
			const c = settle(
				Object.assign(fields, {
					id,
					made: true,
					since: TODAY.getFullYear(),
					tone: nextTone(),
					logo: pendingLogo,
					status: 'onboarding',
					prev: 0,
					signed: todayIso,
					products: [],
					buying: { lead, terms, min: 0 },
					po: null,
					contact: { name: E('contact').value.trim() || 'Not added yet', role: '', email: email || '' },
				}),
			);
			brands.push(c);
			bootstrap.Modal.getOrCreateInstance(dlg).hide();
			refresh();
			toast({
				tone: 'success',
				icon: 'bi-building-check',
				title: `${name} added`,
				text: 'It shows as Onboarding until its first products go on sale.',
				actions: [{ label: 'Open', onClick: () => openRecord(id) }],
			});
			announce(`${name} added`);
		});

		refresh();
	}

	function pick(selector, scope = document) {
		return scope.querySelector(selector);
	}

	function pickAll(selector, scope = document) {
		return [...scope.querySelectorAll(selector)];
	}

	/* Demo data */
	const TODAY = new Date(2026, 9, 9); /* Friday, October 9, 2026, local midnight */

	/* The same products, prices and stock as the Products page. `stock` is
     units on hand for boxed goods; extras and services have none.
       sold  sold in the last 90 days, counted in the product's `unit`
             (members joined, gift cards or bookings; plain units otherwise)
       prev  the brand's sales in the 90 days before that
       due   for an out-of-stock item, when the next delivery lands */
	const BRANDS = [
		{
			id: 'marlo',
			name: 'Marlo',
			makes: 'Own label',
			city: 'Akron',
			country: 'Ohio',
			since: null,
			tone: 1,
			status: 'active',
			prev: 1094100,
			products: [
				{
					sku: 'ML-PASS',
					name: 'Express Delivery Pass',
					price: 15,
					per: '/member/month',
					unit: 'seats',
					icon: 'bi-truck',
					kind: 'digital',
					sold: 1315,
				},
				{
					sku: 'ML-MTM',
					name: 'Made-to-Measure Tailoring',
					price: 4800,
					unit: 'booked',
					icon: 'bi-rulers',
					kind: 'service',
					sold: 23,
				},
				{
					sku: 'ML-LOAF',
					name: 'Bar Loafers',
					price: 790,
					icon: 'bi-gem',
					kind: 'stock',
					stock: 540,
					sold: 520,
				},
				{
					sku: 'ML-GIFT250',
					name: 'E-Gift Card, $250',
					price: 250,
					unit: 'packs',
					icon: 'bi-gift',
					kind: 'digital',
					sold: 1149,
				},
				{
					sku: 'ML-STYLE',
					name: 'Private Styling Session',
					price: 650,
					unit: 'booked',
					icon: 'bi-person-standing-dress',
					kind: 'service',
					sold: 60,
				},
				{
					sku: 'ML-CARE',
					name: 'Aftercare Plan, monthly',
					price: 25,
					per: '/member/month',
					unit: 'seats',
					icon: 'bi-scissors',
					kind: 'digital',
					sold: 814,
				},
				{
					sku: 'ML-OXFD',
					name: 'Two-Tone Oxfords',
					price: 850,
					icon: 'bi-award',
					kind: 'stock',
					stock: 310,
					sold: 360,
				},
			],
			buying: { madeBy: 'Workshops in Akron and Canton', lead: 35, terms: 'Net 30', min: 15000 },
			po: {
				id: '#1179',
				placed: '2026-09-02',
				amount: 189600,
				state: 'received',
				on: '2026-09-30',
				what: '600 Bar Loafers',
			},
			contact: {
				name: 'Dawn Fischer',
				role: 'Production lead',
				email: 'dawn.fischer@marlo.com',
				phone: '+1 330 555 0148',
			},
		},
		{
			id: 'hollis',
			name: 'Hollis Atelier',
			makes: 'Tailoring and eveningwear',
			city: 'Champaign',
			country: 'Illinois',
			since: 2022,
			tone: 2,
			status: 'active',
			prev: 1135900,
			products: [
				{
					sku: 'ML-BLAZ',
					name: 'Sculpted Shoulder Blazer',
					price: 1290,
					icon: 'bi-briefcase',
					kind: 'stock',
					stock: 184,
					sold: 388,
				},
				{
					sku: 'ML-GOWN',
					name: 'Draped Column Gown',
					price: 2150,
					icon: 'bi-stars',
					kind: 'stock',
					stock: 236,
					sold: 359,
				},
			],
			buying: { lead: 21, terms: 'Net 45', min: 10000 },
			po: {
				id: '#1184',
				placed: '2026-09-22',
				amount: 51600,
				state: 'shipped',
				due: '2026-10-13',
				what: '100 Sculpted Shoulder Blazers',
			},
			contact: {
				name: 'Carly Caldwell',
				role: 'Partner manager',
				email: 'carly.caldwell@hollisatelier.com',
				phone: '+1 217 555 0122',
			},
		},
		{
			id: 'calder',
			name: 'Calder Couture',
			makes: 'Couture dresses',
			city: 'Galesburg',
			country: 'Illinois',
			since: 2023,
			tone: 3,
			status: 'active',
			prev: 873900,
			products: [
				{
					sku: 'ML-ORGZ',
					name: 'Tiered Organza Dress',
					price: 1680,
					icon: 'bi-flower1',
					kind: 'stock',
					stock: 412,
					sold: 620,
				},
			],
			buying: { lead: 14, terms: 'Net 30', min: 5000 },
			po: {
				id: '#1181',
				placed: '2026-09-10',
				amount: 201600,
				state: 'received',
				on: '2026-09-24',
				what: '300 Tiered Organza Dresses',
			},
			contact: {
				name: 'Gerald Burnett',
				role: 'Account manager',
				email: 'gerald.burnett@caldercouture.com',
				phone: '+1 309 555 0120',
			},
		},
		{
			id: 'willamette',
			name: 'Willamette Tailors',
			makes: 'Suits and leather outerwear',
			city: 'Salina',
			country: 'Kansas',
			since: 2023,
			tone: 4,
			status: 'active',
			prev: 890300,
			products: [
				{
					sku: 'ML-TRCH',
					name: 'Leather Trench Coat',
					price: 3200,
					icon: 'bi-cloud-drizzle',
					kind: 'stock',
					stock: 128,
					sold: 165,
				},
				{
					sku: 'ML-SUIT',
					name: 'Chalk-Stripe Suit',
					price: 2450,
					icon: 'bi-person-standing',
					kind: 'stock',
					stock: 96,
					sold: 126,
				},
			],
			buying: { lead: 21, terms: 'Net 30', min: 3000 },
			po: {
				id: '#1189',
				placed: '2026-09-29',
				amount: 194400,
				state: 'shipped',
				due: '2026-10-20',
				what: '120 suits, 60 trench coats',
			},
			contact: {
				name: 'Robin Dickerson',
				role: 'Key accounts',
				email: 'r.dickerson@willamettetailors.com',
				phone: '+1 785 555 0117',
			},
		},
		{
			id: 'fairhaven',
			name: 'Fairhaven Optical',
			makes: 'Acetate and metal eyewear',
			city: 'Joplin',
			country: 'Missouri',
			since: 2024,
			tone: 5,
			status: 'active',
			prev: 209000,
			products: [
				{
					sku: 'ML-SHLD',
					name: 'Shield Sunglasses',
					price: 520,
					icon: 'bi-eyeglasses',
					kind: 'stock',
					stock: 0,
					sold: 298,
					due: '2026-10-16',
				},
				{
					sku: 'ML-CATE',
					name: 'Cat-Eye Sunglasses',
					price: 465,
					icon: 'bi-sunglasses',
					kind: 'stock',
					stock: 22,
					low: true,
					sold: 130,
				},
			],
			buying: { lead: 21, terms: 'Prepaid', min: 2000 },
			po: {
				id: '#1192',
				placed: '2026-09-25',
				amount: 24960,
				state: 'shipped',
				due: '2026-10-16',
				what: '120 Shield Sunglasses',
			},
			contact: {
				name: 'Melanie Elliot',
				role: 'Wholesale sales',
				email: 'melanie@fairhavenoptical.com',
				phone: '+1 417 555 0189',
			},
		},
		{
			id: 'hartwell',
			name: 'Hartwell Stokes',
			makes: 'Leather gloves',
			city: 'Kalamazoo',
			country: 'Michigan',
			since: 2026,
			tone: 7,
			status: 'onboarding',
			prev: 0,
			signed: '2026-09-22',
			onboardNote: 'Both styles are being wear-tested before they go on sale.',
			products: [
				{
					sku: 'ML-GLV-NP',
					name: 'Nappa Opera Gloves',
					price: 390,
					icon: 'bi-snow3',
					kind: 'review',
					sold: 0,
				},
				{
					sku: 'ML-GLV-SD',
					name: 'Suede Driving Gloves',
					price: 290,
					icon: 'bi-snow',
					kind: 'review',
					sold: 0,
				},
			],
			buying: { lead: 21, terms: 'Net 30', min: 4000 },
			po: {
				id: '#1194',
				placed: '2026-10-01',
				amount: 41100,
				state: 'shipped',
				due: '2026-10-22',
				what: '300 gloves, the first order',
			},
			contact: {
				name: 'Jacob Becker',
				role: 'Wholesale sales',
				email: 'j.becker@hartwellstokes.com',
				phone: '+1 269 555 0130',
			},
		},
		{
			id: 'brightloom',
			name: 'Brightloom',
			makes: 'Silk ties and pocket squares',
			city: 'Greenville',
			country: 'South Carolina',
			since: 2024,
			tone: 6,
			status: 'paused',
			prev: 135000,
			pausedOn: '2026-09-02',
			pauseNote:
				'A batch of silk ties failed our color test. Both products are hidden from the Store until a new batch passes.',
			products: [
				{ sku: 'ML-STIE', name: 'Silk Twill Tie', price: 185, icon: 'bi-wind', kind: 'hidden', sold: 214 },
				{
					sku: 'ML-PSQ3',
					name: 'Pocket Squares, 3-pack',
					price: 145,
					icon: 'bi-square',
					kind: 'hidden',
					sold: 302,
				},
			],
			buying: { lead: 28, terms: 'Net 30', min: 2500 },
			po: {
				id: '#1176',
				placed: '2026-08-26',
				amount: 37000,
				state: 'returned',
				on: '2026-09-04',
				what: '500 ties, sent back',
			},
			contact: {
				name: 'Kevin Zane',
				role: 'Sales manager',
				email: 'kevin.zane@brightloom.com',
				phone: '+1 864 555 0172',
			},
		},
	];

	const STATUS = {
		active: { label: 'Active', tone: 'success' },
		onboarding: { label: 'Onboarding', tone: 'info' },
		paused: { label: 'Paused', tone: 'warning' },
	};

	/* Small helpers */
	function htmlSafe(s) {
		return String(s == null ? '' : s).replace(
			/[&<>"']/g,
			(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
		);
	}

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function short(n) {
		return n >= 1000 ? `$${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : money(n);
	}

	function plural(n, word, many) {
		return `${n.toLocaleString('en-US')} ${n === 1 ? word : many || `${word}s`}`;
	}

	function day(iso) {
		return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function initials(name) {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => w[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}
	const todayIso = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`;

	/* Everything the list and drawer show is worked out here from the
     product rows, so totals always agree with the products listed. */
	function settle(c) {
		c.sales = c.products.reduce((a, p) => a + p.price * p.sold, 0);
		c.listed =
			c.status === 'active' ? c.products.filter((p) => p.kind !== 'review' && p.kind !== 'hidden').length : 0;
		c.onHand = c.products.reduce((a, p) => a + (p.kind === 'stock' ? p.stock : 0), 0);
		c.boxed = c.products.some((p) => p.kind === 'stock');
		c.out = c.products.filter((p) => p.kind === 'stock' && p.stock === 0).length;
		c.low = c.products.filter((p) => p.kind === 'stock' && p.low).length;
		c.change = c.prev ? Math.round(((c.sales - c.prev) / c.prev) * 100) : null;
		return c;
	}
	const brands = BRANDS.map(settle);

	function find(id) {
		return brands.find((c) => c.id === id);
	}

	const state = { status: 'all', q: '', sort: 'sales', dir: -1 };

	function logoHtml(c) {
		return c.logo ? `<img src="${c.logo}" alt="">` : htmlSafe(initials(c.name));
	}
	function stateTag(c) {
		const s = STATUS[c.status];
		return `<span class="basalt-status basalt-status-dot basalt-status-${s.tone}">${s.label}</span>`;
	}

	/* Sales by brand: the total, the share bar and its key */
	function drawShare() {
		const selling = brands.filter((c) => c.sales > 0).sort((a, b) => b.sales - a.sales);
		const total = selling.reduce((a, c) => a + c.sales, 0);
		const before = brands.reduce((a, c) => a + c.prev, 0);
		const change = before ? Math.round(((total - before) / before) * 100) : 0;
		const listed = brands.reduce((a, c) => a + c.listed, 0);
		const makers = brands.filter((c) => c.listed > 0).length;
		pick('[data-cb-total]', root).textContent = money(total);
		const ch = pick('[data-cb-total-change]', root);
		ch.className = `cb-total-change cb-sub-${change >= 0 ? 'up' : 'down'}`;
		ch.innerHTML = `<i class="bi bi-arrow-${change >= 0 ? 'up' : 'down'}-short" aria-hidden="true"></i>${Math.abs(change)}%<span class="visually-hidden">${change >= 0 ? ' up' : ' down'} on the 90 days before</span>`;
		pick('[data-cb-total-note]', root).textContent =
			`${plural(listed, 'product')} on sale from ${plural(makers, 'brand', 'brands')}. Pick a brand to open it.`;
		pick('[data-cb-share-bar]', root).innerHTML = selling
			.map(
				(c) =>
					`<span class="cb-share-seg cb-tone-${c.tone}" style="width:${((c.sales / total) * 100).toFixed(2)}%"></span>`,
			)
			.join('');
		pick('[data-cb-share-legend]', root).innerHTML = selling
			.map(
				(c) =>
					`<li><button type="button" class="cb-share-item" data-cb-open="${c.id}"><span class="cb-logo cb-logo-sm cb-tone-${c.tone}" aria-hidden="true">${logoHtml(c)}</span><span class="cb-share-name">${htmlSafe(c.name)}</span><span class="cb-share-num">${Math.round((c.sales / total) * 100)}% · ${short(c.sales)}</span></button></li>`,
			)
			.join('');
		const waiting = brands.filter((c) => c.status === 'onboarding');
		pick('[data-cb-share-note]', root).textContent = waiting.length
			? `${waiting.map((c) => c.name).join(' and ') + (waiting.length === 1 ? ' starts' : ' start')} selling once ${waiting.length === 1 ? 'its' : 'their'} first stock arrives.`
			: '';
	}

	/* The list */
	const el = {
		body: pick('[data-cb-body]', root),
		wrap: pick('[data-cb-wrap]', root),
		empty: pick('[data-cb-empty]', root),
		summary: pick('[data-cb-summary]', root),
		search: pick('[data-cb-search]', root),
	};

	function filtered() {
		const list = brands.filter((c) => {
			if (state.status !== 'all' && c.status !== state.status) return false;
			if (!state.q) return true;
			const hay = [c.name, c.makes, c.city, c.country, c.contact.name]
				.concat(c.products.map((p) => `${p.name} ${p.sku}`))
				.join(' ');
			return window.Basalt && window.Basalt.matchesQuery
				? window.Basalt.matchesQuery(hay, state.q)
				: hay.toLowerCase().includes(state.q.toLowerCase());
		});
		const key = { name: (c) => c.name.toLowerCase(), stock: (c) => c.onHand, sales: (c) => c.sales }[state.sort];
		return list.sort((a, b) => {
			const x = key(a),
				y = key(b);
			return (x < y ? -1 : x > y ? 1 : 0) * state.dir;
		});
	}

	function productsCell(c) {
		const n = c.products.length;
		if (c.status === 'onboarding')
			return `<span class="cb-line">${n ? `${n} in review` : 'None yet'}</span><span class="cb-sub">Not on sale yet</span>`;
		if (c.status === 'paused')
			return `<span class="cb-line">${n} hidden</span><span class="cb-sub">Since ${day(c.pausedOn)}</span>`;
		const boxed = c.products.filter((p) => p.kind === 'stock').length;
		const other = n - boxed;
		return `<span class="cb-line">${n} listed</span><span class="cb-sub">${other ? `${boxed} boxed, ${other} digital or service` : 'All boxed'}</span>`;
	}

	function stockCell(c) {
		if (c.status === 'onboarding')
			return `<span class="cb-money">0</span><span class="cb-sub">${c.po ? `First stock ${day(c.po.due)}` : 'Nothing ordered'}</span>`;
		if (!c.boxed) return '<span class="cb-money">0</span><span class="cb-sub">None held</span>';
		let note = 'All in stock';
		let cls = '';
		if (c.out) {
			note = `${plural(c.out, 'product')} out`;
			cls = ' cb-sub-danger';
		} else if (c.low) {
			note = `${plural(c.low, 'product')} low`;
			cls = ' cb-sub-warning';
		}
		return `<span class="cb-money">${c.onHand.toLocaleString('en-US')}</span><span class="cb-sub${cls}">${note}</span>`;
	}

	function salesCell(c) {
		if (!c.sales) return '<span class="cb-money">$0</span><span class="cb-sub">No sales yet</span>';
		const up = c.change >= 0;
		return `<span class="cb-money">${money(c.sales)}</span><span class="cb-sub cb-sub-${up ? 'up' : 'down'}"><i class="bi bi-arrow-${up ? 'up' : 'down'}-short" aria-hidden="true"></i>${Math.abs(c.change)}%<span class="visually-hidden">${up ? ' up' : ' down'} on the 90 days before</span></span>`;
	}

	function rowHtml(c) {
		const where = `${c.makes} · ${c.country}`;
		const menu = `<div class="dropdown"><button type="button" class="btn btn-icon cb-more" data-bs-toggle="dropdown" data-bs-popper-config='{"strategy":"fixed"}' aria-expanded="false" aria-label="More for ${htmlSafe(c.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end">${c.status === 'paused' ? '' : '<li><a class="dropdown-item" href="purchase-orders.html"><i class="bi bi-cart-plus" aria-hidden="true"></i>New purchase order</a></li>'}${c.status === 'active' ? '<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item" data-cb-act="pause"><i class="bi bi-pause-circle" aria-hidden="true"></i>Pause selling</button></li>' : ''}${c.status === 'paused' ? '<li><button type="button" class="dropdown-item" data-cb-act="resume"><i class="bi bi-play-circle" aria-hidden="true"></i>Resume selling</button></li>' : ''}</ul></div>`;
		return `<tr data-cb-id="${c.id}"><td class="cb-col-name"><span class="cb-who"><span class="cb-logo cb-tone-${c.tone}" aria-hidden="true">${logoHtml(c)}</span><span>${c.made ? `<strong class="cb-line">${htmlSafe(c.name)}</strong>` : `<a class="cb-link" href="brand-details.html?id=${encodeURIComponent(c.id)}">${htmlSafe(c.name)}</a>`}<span class="cb-sub">${htmlSafe(where)}</span></span></span></td><td class="cb-col-products">${productsCell(c)}</td><td class="cb-col-stock">${stockCell(c)}</td><td class="cb-col-sales">${salesCell(c)}</td><td class="cb-col-status">${stateTag(c)}</td><td class="cb-col-act"><div class="basalt-row-actions"><button type="button" class="btn btn-icon btn-sm" data-cb-act="open" aria-label="Quick view: ${htmlSafe(c.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Quick view"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button>${c.made ? '' : `<a class="btn btn-icon btn-sm" href="brand-details.html?id=${encodeURIComponent(c.id)}" aria-label="Open full page: ${htmlSafe(c.name)}" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-title="Open full page"><i class="bi bi-arrows-angle-expand" aria-hidden="true"></i></a>`}${menu}</div></td></tr>`;
	}

	function emptyHtml() {
		const q = state.q;
		const st = state.status !== 'all' ? STATUS[state.status].label.toLowerCase() : '';
		return `<div class="basalt-empty cb-empty" role="status"><span class="basalt-empty-icon" aria-hidden="true"><i class="bi bi-building-slash"></i></span><p class="basalt-empty-title">${q ? `No ${st ? `${st} ` : ''}brands match “${htmlSafe(q)}”` : `No ${st} brands`}</p><p class="basalt-empty-text">${q ? 'Try a brand, a product name or a contact.' : 'Every brand is in another state right now.'}</p><button type="button" class="btn btn-sm btn-outline-secondary" data-cb-clear>Show every brand</button></div>`;
	}

	let shown = [];
	function drawList() {
		shown = filtered();
		const narrowed = shown.length !== brands.length;
		el.summary.textContent = narrowed
			? `${shown.length} of ${plural(brands.length, 'brand', 'brands')}`
			: plural(shown.length, 'brand', 'brands') +
				(state.sort === 'sales' && state.dir < 0 ? ', highest sales first' : '');
		el.wrap.hidden = !shown.length;
		el.empty.hidden = !!shown.length;
		el.empty.innerHTML = shown.length ? '' : emptyHtml();
		el.body.innerHTML = shown.map(rowHtml).join('');
		if (window.Basalt.tips) window.Basalt.tips(el.body);

		for (const th of pickAll('th[aria-sort]', root)) {
			const key = pick('[data-cb-sort]', th).getAttribute('data-cb-sort');
			const on = key === state.sort;
			th.setAttribute('aria-sort', on ? (state.dir > 0 ? 'ascending' : 'descending') : 'none');
			pick('.bi', th).className =
				`bi ${on ? (state.dir > 0 ? 'bi-sort-up' : 'bi-sort-down') : 'bi-arrow-down-up'}`;
		}
	}

	function refresh() {
		brands.forEach(settle);
		drawShare();
		drawList();
	}

	let typing;
	el.search.addEventListener('input', () => {
		clearTimeout(typing);
		typing = setTimeout(() => {
			state.q = el.search.value.trim();
			drawList();
		}, 160);
	});
	pick('[data-cb-filter]', root).addEventListener('change', (e) => {
		if (e.target.name !== 'cbStatus') return;
		state.status = e.target.value;
		drawList();
	});

	for (const b of pickAll('[data-cb-sort]', root)) {
		b.addEventListener('click', () => {
			const key = b.getAttribute('data-cb-sort');
			if (state.sort === key) state.dir = -state.dir;
			else {
				state.sort = key;
				state.dir = key === 'name' ? 1 : -1;
			}
			drawList();
		});
	}

	el.empty.addEventListener('click', (e) => {
		if (!e.target.closest('[data-cb-clear]')) return;
		state.q = '';
		state.status = 'all';
		el.search.value = '';
		pick('#cb-status-all').checked = true;
		pick('#cb-status-all').dispatchEvent(new Event('change', { bubbles: true }));
		drawList();
		el.search.focus();
	});

	/* Row actions */
	function setStatus(c, status, msg) {
		const before = c.status;
		const beforeOn = c.pausedOn;
		c.status = status;
		if (status === 'paused') c.pausedOn = todayIso;
		refresh();
		if (drawerOpen && current() === c.id) drawRecord(c);
		toast({
			tone: status === 'paused' ? 'warning' : 'success',
			icon: status === 'paused' ? 'bi-pause-circle' : 'bi-play-circle',
			title: msg,
			text:
				status === 'paused'
					? `${plural(c.products.length, 'product')} hidden from the Store.`
					: `${plural(c.products.length, 'product')} back on sale.`,
			duration: 8000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						c.status = before;
						c.pausedOn = beforeOn;
						refresh();
						if (drawerOpen && current() === c.id) drawRecord(c);
						announce(`${msg}, undone`);
					},
				},
			],
		});
		announce(msg);
	}

	function act(name, c) {
		if (!c) return;
		if (name === 'open') openRecord(c.id);
		else if (name === 'pause') setStatus(c, 'paused', `${c.name} paused`);
		else if (name === 'resume') setStatus(c, 'active', `${c.name} is selling again`);
	}

	/* A click anywhere else on a row opens the brand's own page, as its
     name and expand icon do, in a new tab with Cmd, Ctrl, Shift or the
     middle button; the panel icon opens the quick view. A brand added
     here has no page yet, so its row opens the quick view too. */
	function rowPage(tr) {
		const a = pick('a.cb-link', tr);
		return a ? a.href : '';
	}

	el.body.addEventListener('click', (e) => {
		const tr = e.target.closest('tr[data-cb-id]');
		if (!tr) return;
		const b = e.target.closest('[data-cb-act]');
		if (b) {
			act(b.getAttribute('data-cb-act'), find(tr.getAttribute('data-cb-id')));
			return;
		}
		if (e.target.closest('.dropdown, a, button')) return;
		const url = rowPage(tr);
		if (!url) openRecord(tr.getAttribute('data-cb-id'));
		else if (e.metaKey || e.ctrlKey || e.shiftKey) window.open(url, '_blank');
		else location.href = url;
	});
	el.body.addEventListener('auxclick', (e) => {
		const tr = e.button === 1 && !e.target.closest('.dropdown, a, button') && e.target.closest('tr[data-cb-id]');
		const url = tr && rowPage(tr);
		if (url) window.open(url, '_blank');
	});
	pick('[data-cb-share-legend]', root).addEventListener('click', (e) => {
		const b = e.target.closest('[data-cb-open]');
		if (b) openRecord(b.getAttribute('data-cb-open'));
	});

	/* CSV export */
	pick('[data-cb-export]', root).addEventListener('click', () => {
		function cell(v) {
			return `"${String(v).replace(/"/g, '""')}"`;
		}

		const rows = [
			[
				'Brand',
				'Makes',
				'City',
				'State',
				'Status',
				'Products',
				'On hand',
				'Sales, 90 days',
				'Change %',
				'Terms',
				'Lead time (days)',
				'Contact',
				'Email',
			],
		].concat(
			shown.map((c) => [
				c.name,
				c.makes,
				c.city,
				c.country,
				STATUS[c.status].label,
				c.products.length,
				c.onHand,
				c.sales,
				c.change == null ? '' : c.change,
				c.buying.terms,
				c.buying.lead,
				c.contact.name,
				c.contact.email,
			]),
		);
		const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `brands-${todayIso}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		toast({
			tone: 'success',
			icon: 'bi-download',
			title: `Exported ${plural(shown.length, 'brand', 'brands')}`,
			text: a.download,
		});
	});

	/* The brand drawer */
	const drawer = pick('#cb-record');

	function R(k) {
		return pick(`[data-cb-r="${k}"]`, drawer);
	}

	const poBtn = pick('[data-cb-r-po]', drawer);
	const fullLink = pick('[data-cb-r-full]', drawer);
	const resumeBtn = pick('[data-cb-r-resume]', drawer);
	let drawerOpen = false;
	let recordIds = [];
	let at = 0;

	function current() {
		return recordIds[at];
	}

	function itemStock(p) {
		if (p.kind === 'digital') return 'Digital';
		if (p.kind === 'service') return 'Bookable';
		if (p.kind === 'review') return 'In review';
		if (p.kind === 'hidden') return 'Hidden';
		if (p.stock === 0)
			return `<span class="cb-sub cb-sub-danger">Out of stock</span><span class="cb-sub">Back ${day(p.due)}</span>`;
		if (p.low) return `<span class="cb-sub cb-sub-warning">${p.stock} left, low</span>`;
		return `${p.stock} in stock`;
	}

	function stateHtml(c) {
		let lead;
		if (c.status === 'onboarding') {
			lead = `Signed on ${day(c.signed)}. ${c.onboardNote ? `${htmlSafe(c.onboardNote)} ` : ''}${c.po ? `The first stock arrives <strong>${day(c.po.due)}</strong>.` : 'Add its products and place a first purchase order to start selling.'}`;
		} else {
			const all = brands.reduce((a, x) => a + x.sales, 0);
			const share = Math.round((c.sales / all) * 100);
			lead = `Sold <strong>${money(c.sales)}</strong> in the last 90 days, ${share}% of Store sales, ${c.change >= 0 ? 'up ' : 'down '}${Math.abs(c.change)}% on the 90 days before${c.status === 'paused' ? ', most of it before the pause.' : '.'}`;
		}
		let alert = '';
		if (c.status === 'paused') {
			alert = `<p class="cb-alert cb-alert-warning"><i class="bi bi-pause-circle" aria-hidden="true"></i><span>Paused on ${day(c.pausedOn)}. ${htmlSafe(c.pauseNote || 'Its products are hidden from the Store.')}</span></p>`;
		} else if (c.out) {
			const p = c.products.find((x) => x.kind === 'stock' && x.stock === 0);
			alert = `<p class="cb-alert cb-alert-warning"><i class="bi bi-box-seam" aria-hidden="true"></i><span>${htmlSafe(p.name)} is out of stock. ${htmlSafe(c.po.what)} arrive ${day(c.po.due)} on <a href="purchase-orders.html">${c.po.id}</a>.</span></p>`;
		}
		return `${stateTag(c)}<p class="cb-r-lead">${lead}</p>${alert}`;
	}

	function poHtml(c) {
		const po = c.po;
		const when =
			po.state === 'received'
				? `Received ${day(po.on)}`
				: po.state === 'returned'
					? `Sent back ${day(po.on)}`
					: `Arrives ${day(po.due)}`;
		return `<a href="purchase-orders.html">${po.id}</a>, ${money(po.amount)}<span class="cb-sub">${htmlSafe(po.what)} · ${when}</span>`;
	}

	const UNITS = {
		seats: ['member joined', 'members joined'],
		packs: ['card sold', 'cards sold'],
		booked: ['booked', 'booked'],
	};
	function soldText(p) {
		const u = UNITS[p.unit] || ['sold', 'sold'];
		return `${p.sold.toLocaleString('en-US')} ${p.sold === 1 ? u[0] : u[1]}`;
	}

	const SHOW = 4;
	function drawRecord(c) {
		const logo = R('logo');
		logo.className = `cb-logo cb-tone-${c.tone}`;
		logo.innerHTML = logoHtml(c);
		R('title').textContent = c.name;
		R('sub').textContent = c.country + (c.since ? ` · since ${c.since}` : '');
		R('state').innerHTML = stateHtml(c);
		R('products').innerHTML = c.products
			.slice(0, SHOW)
			.map(
				(p) =>
					`<li class="cb-item"><span class="cb-item-icon cb-tone-${c.tone}" aria-hidden="true"><i class="bi ${p.icon}"></i></span><span class="cb-item-text"><span class="cb-item-name">${htmlSafe(p.name)}</span><span class="cb-sub"><span class="cb-mono">${p.sku}</span> · ${money(p.price)}${p.per ? htmlSafe(p.per) : ''}${p.sold ? ` · ${soldText(p)}` : ''}</span></span><span class="cb-item-stock">${itemStock(p)}</span></li>`,
			)
			.join('');
		const rest = c.products.length - SHOW;
		R('more').innerHTML = !c.products.length
			? 'No products yet. Add them from the <a href="products.html">product list</a>.'
			: rest > 0
				? `And ${rest} more in the <a href="products.html">product list</a>.`
				: '';
		R('buying').innerHTML =
			`${c.buying.madeBy ? `<div><dt>Made by</dt><dd>${htmlSafe(c.buying.madeBy)}</dd></div>` : ''}<div><dt>Lead time</dt><dd>${c.buying.lead} days from order</dd></div><div><dt>Terms</dt><dd>${htmlSafe(c.buying.terms)}${c.buying.min ? `, minimum order ${money(c.buying.min)}` : ''}</dd></div><div><dt>Latest order</dt><dd>${c.po ? poHtml(c) : 'None yet'}</dd></div>`;
		R('contact').innerHTML =
			`<div><dt>Name</dt><dd>${htmlSafe(c.contact.name)}${c.contact.role ? `<span class="cb-sub">${htmlSafe(c.contact.role)}</span>` : ''}</dd></div>${c.contact.email ? `<div><dt>Email</dt><dd><a href="mailto:${htmlSafe(c.contact.email)}">${htmlSafe(c.contact.email)}</a></dd></div>` : ''}${c.contact.phone ? `<div><dt>Phone</dt><dd>${htmlSafe(c.contact.phone)}</dd></div>` : ''}<div><dt>Office</dt><dd>${htmlSafe((c.city ? `${c.city}, ` : '') + c.country)}</dd></div>`;
		fullLink.href = `brand-details.html?id=${encodeURIComponent(c.id)}`;
		fullLink.hidden = Boolean(c.made);
		poBtn.hidden = c.status === 'paused';
		resumeBtn.hidden = c.status !== 'paused';
	}

	function navTo(i, dir) {
		at = (i + recordIds.length) % recordIds.length;
		const c = find(recordIds[at]);
		if (c) drawRecord(c);
		pick('[data-basalt-record-pos]', drawer).textContent = `${at + 1} of ${recordIds.length}`;
		drawer.classList.toggle('is-back', dir < 0);
	}
	function openRecord(id) {
		recordIds = shown.map((c) => c.id);
		if (!recordIds.includes(id)) recordIds = brands.map((c) => c.id);
		navTo(recordIds.indexOf(id));
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}
	pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => navTo(at - 1, -1));
	pick('[data-basalt-record-next]', drawer).addEventListener('click', () => navTo(at + 1, 1));
	drawer.addEventListener('keydown', (e) => {
		if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		navTo(at + (e.key === 'ArrowUp' ? -1 : 1), e.key === 'ArrowUp' ? -1 : 1);
	});

	function toastsAt(where) {
		if (window.Basalt.toasts) window.Basalt.toasts.position(where);
	}
	drawer.addEventListener('show.bs.offcanvas', () => {
		drawerOpen = true;
		toastsAt('bottom-center');
	});
	drawer.addEventListener('hidden.bs.offcanvas', () => {
		drawerOpen = false;
		toastsAt('bottom-end');
	});

	resumeBtn.addEventListener('click', () => act('resume', find(current())));

	/* Add a brand */
	const dlg = pick('#cb-add');
	const form = pick('[data-cb-form]', dlg);

	function E(k) {
		return pick(`[data-cb-e="${k}"]`, dlg);
	}

	const nameIn = E('name');
	const emailIn = E('email');
	const leadIn = E('lead');
	const fileIn = E('logo-input');
	let pendingLogo = null;

	function drawLogoPreview() {
		const logo = E('logo');
		logo.className = `cb-logo cb-logo-lg cb-tone-${nextTone()}`;
		const typed = nameIn.value.trim();
		logo.innerHTML = pendingLogo
			? `<img src="${pendingLogo}" alt="">`
			: typed
				? htmlSafe(initials(typed))
				: '<i class="bi bi-building"></i>';
		E('logo-remove').hidden = !pendingLogo;
	}
	function nextTone() {
		const used = brands.map((c) => c.tone);
		return [8, 1, 2, 3, 4, 5, 6, 7].find((t) => !used.includes(t)) || 8;
	}
	function invalid(input, on) {
		input.classList.toggle('is-invalid', on);
		if (on) input.setAttribute('aria-invalid', 'true');
		else input.removeAttribute('aria-invalid');
		if (input === leadIn) input.closest('.input-group').classList.toggle('is-invalid', on);
	}
	function setTerms(value) {
		for (const r of pickAll('input[name="cbTerms"]', dlg)) {
			r.checked = r.value === value;
		}

		/* Lets the segmented switch move its thumb to the new choice. */
		pick('input[name="cbTerms"]:checked', dlg).dispatchEvent(new Event('change', { bubbles: true }));
	}

	/* Editing an existing brand happens on its own page, so the dialog
     only ever starts empty. */
	function openAdd() {
		pendingLogo = null;
		form.reset();

		for (const i of [nameIn, emailIn, leadIn]) {
			invalid(i, false);
		}

		if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(E('country'));
		setTerms('Net 30');
		drawLogoPreview();
		bootstrap.Modal.getOrCreateInstance(dlg).show();
	}
	start();
})();
