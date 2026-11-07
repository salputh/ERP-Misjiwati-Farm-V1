/**
 * Basalt - Categories (categories.html)
 * The Marlo shop menu: top-level categories, their
 * subcategories and the products filed under each. Rows are
 * drawn from CATEGORIES and PRODUCTS below; reordering uses the
 * shared sortable list (window.Basalt.sortable), editing happens
 * in the drawer, and adding and deleting in the two dialogs.
 */
(() => {
	'use strict';
	const root = pick('[data-pc-root]');
	if (!root) return;

	/* Demo data
	   Top-level categories carry an icon and a color (1-8, the theme's
	   chart series); subcategories take their parent's color. `shown`
	   is whether the category appears in the Store menu. */
	const CATEGORIES = [
		{
			id: 'clothing',
			name: 'Clothing',
			icon: 'bi-bag',
			tone: 1,
			shown: true,
			slug: 'clothing',
			title: 'Tailoring, dresses and outerwear',
			desc: 'Tailoring, gowns and leather for the new season.',
			subs: [
				{
					id: 'tailoring',
					name: 'Tailoring',
					shown: true,
					slug: 'tailoring',
					title: 'Sculpted blazers and suits',
					desc: 'Cut and finished by hand in Maine and Oregon.',
				},
				{
					id: 'dresses',
					name: 'Dresses',
					shown: true,
					slug: 'dresses',
					title: 'Gowns and organza',
					desc: 'Silk jersey and hand-pleated organza, in small runs.',
				},
				{
					id: 'outerwear',
					name: 'Outerwear',
					shown: true,
					slug: 'outerwear',
					title: 'Leather trench coats',
					desc: 'Black nappa, belted and cut long.',
				},
			],
		},
		{
			id: 'accessories',
			name: 'Accessories',
			icon: 'bi-sunglasses',
			tone: 3,
			shown: true,
			slug: 'accessories',
			title: 'Shoes, eyewear and gloves',
			desc: 'Hand-finished shoes and eyewear to complete the look.',
			subs: [
				{
					id: 'shoes',
					name: 'Shoes',
					shown: true,
					slug: 'shoes',
					title: 'Loafers and oxfords',
					desc: 'Hand-sewn in Akron, on leather soles.',
				},
				{
					id: 'eyewear',
					name: 'Eyewear',
					shown: true,
					slug: 'eyewear',
					title: 'Cat-eye and shield sunglasses',
					desc: 'Hand-polished acetate and chrome, in short runs.',
				},
				{
					id: 'gloves',
					name: 'Gloves',
					shown: false,
					slug: 'gloves',
					title: 'Leather gloves',
					desc: 'Nappa and suede gloves, due in November.',
				},
			],
		},
		{
			id: 'extras',
			name: 'Extras',
			icon: 'bi-gift',
			tone: 8,
			shown: true,
			slug: 'extras',
			title: 'Gift cards and memberships',
			desc: 'Gift cards and monthly plans, nothing to ship.',
			subs: [
				{
					id: 'gift-cards',
					name: 'Gift cards',
					shown: true,
					slug: 'gift-cards',
					title: 'E-gift cards',
					desc: 'Sent by email on the day, and they never expire.',
				},
				{
					id: 'memberships',
					name: 'Memberships',
					shown: true,
					slug: 'memberships',
					title: 'Aftercare Plan and Express Delivery',
					desc: 'Aftercare and next-day delivery, monthly.',
				},
			],
		},
		{
			id: 'services',
			name: 'Services',
			icon: 'bi-rulers',
			tone: 5,
			shown: true,
			slug: 'services',
			title: 'Made to measure and styling',
			desc: 'Fittings and styling with the Marlo team.',
			subs: [
				{
					id: 'made-to-measure',
					name: 'Made to measure',
					shown: true,
					slug: 'made-to-measure',
					title: 'Made-to-measure tailoring',
					desc: 'Two fittings and a suit cut to your size.',
				},
				{
					id: 'styling',
					name: 'Styling',
					shown: true,
					slug: 'styling',
					title: 'Private styling sessions',
					desc: 'Ninety minutes with a stylist, in store or video.',
				},
			],
		},
	];

	/* The Marlo shop catalog. `sold` is units (or paying members, for
     the monthly clubs) from September 9 to October 8, so each
     category's sales are price x sold, summed. */
	const PRODUCTS = [
		{
			name: 'Sculpted Shoulder Blazer',
			sku: 'ML-BLAZ',
			cat: 'tailoring',
			price: 1290,
			per: '',
			sold: 38,
			icon: 'bi-briefcase',
		},
		{
			name: 'Draped Column Gown',
			sku: 'ML-GOWN',
			cat: 'dresses',
			price: 2150,
			per: '',
			sold: 24,
			icon: 'bi-stars',
		},
		{
			name: 'Tiered Organza Dress',
			sku: 'ML-ORGZ',
			cat: 'dresses',
			price: 1680,
			per: '',
			sold: 52,
			icon: 'bi-flower1',
		},
		{
			name: 'Chalk-Stripe Suit',
			sku: 'ML-SUIT',
			cat: 'tailoring',
			price: 2450,
			per: '',
			sold: 21,
			icon: 'bi-person-standing',
		},
		{
			name: 'Leather Trench Coat',
			sku: 'ML-TRCH',
			cat: 'outerwear',
			price: 3200,
			per: '',
			sold: 33,
			icon: 'bi-cloud-drizzle',
		},
		{ name: 'Bar Loafers', sku: 'ML-LOAF', cat: 'shoes', price: 790, per: '', sold: 64, icon: 'bi-gem' },
		{
			name: 'Two-Tone Oxfords',
			sku: 'ML-OXFD',
			cat: 'shoes',
			price: 850,
			per: '',
			sold: 71,
			icon: 'bi-award',
		},
		{
			name: 'Cat-Eye Sunglasses',
			sku: 'ML-CATE',
			cat: 'eyewear',
			price: 465,
			per: '',
			sold: 18,
			icon: 'bi-sunglasses',
		},
		{
			name: 'Shield Sunglasses',
			sku: 'ML-SHLD',
			cat: 'eyewear',
			price: 520,
			per: '',
			sold: 46,
			icon: 'bi-eyeglasses',
		},
		{
			name: 'E-Gift Card, $250',
			sku: 'ML-GIFT250',
			cat: 'gift-cards',
			price: 250,
			per: '',
			sold: 120,
			icon: 'bi-gift',
		},
		{
			name: 'Aftercare Plan',
			sku: 'ML-CARE',
			cat: 'memberships',
			price: 25,
			per: '/member/mo',
			sold: 410,
			icon: 'bi-scissors',
		},
		{
			name: 'Express Delivery Pass',
			sku: 'ML-PASS',
			cat: 'memberships',
			price: 15,
			per: '/member/mo',
			sold: 520,
			icon: 'bi-truck',
		},
		{
			name: 'Made-to-Measure Tailoring',
			sku: 'ML-MTM',
			cat: 'made-to-measure',
			price: 4800,
			per: '',
			sold: 9,
			icon: 'bi-rulers',
		},
		{
			name: 'Private Styling Session',
			sku: 'ML-STYLE',
			cat: 'styling',
			price: 650,
			per: '',
			sold: 14,
			icon: 'bi-person-standing-dress',
		},
	];

	const ICONS = [
		['bi-bag', 'Bag'],
		['bi-snow2', 'Snowflake'],
		['bi-gift', 'Gift'],
		['bi-rulers', 'Rulers'],
		['bi-box-seam', 'Box'],
		['bi-truck', 'Truck'],
		['bi-scissors', 'Scissors'],
		['bi-shield-check', 'Shield'],
	];
	const TONES = [1, 2, 3, 4, 5, 6, 7, 8];

	let state = { cats: CATEGORIES, products: PRODUCTS };
	const collapsed = new Set();

	function start() {
		newEl.addEventListener('show.bs.modal', () => {
			draftForm.reset();
			draftForm.name.classList.remove('is-invalid');
			N('parents').innerHTML =
				`<label class="basalt-choice"><input type="radio" name="pc-new-parent" value=""><i class="bi bi-diagram-3" aria-hidden="true"></i>Top level</label>${state.cats.map((g) => `<label class="basalt-choice"><input type="radio" name="pc-new-parent" value="${g.id}"><i class="bi ${g.icon}" aria-hidden="true"></i>${htmlSafe(g.name)}</label>`).join('')}`;
			checkChoice('pc-new-parent', presetParent);
			checkChoice('pc-new-icon', 'bi-box-seam');
			const used = state.cats.map((g) => g.tone);
			checkChoice('pc-new-tone', TONES.find((t) => used.indexOf(t) < 0) || 1);
			N('look').hidden = !!presetParent;
			presetParent = '';
		});
		newEl.addEventListener('shown.bs.modal', () => draftForm.name.focus());
		draftForm.addEventListener('change', (e) => {
			if (e.target.name === 'pc-new-parent') N('look').hidden = !!e.target.value;
		});
		draftForm.name.addEventListener('input', () => draftForm.name.classList.remove('is-invalid'));

		draftForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const parentId = picked('pc-new-parent');
			const parent = parentId ? find(parentId).node : null;
			const bad = check(draftForm.name, N('nameErr'), parent ? parent.subs : state.cats);
			if (bad) {
				bad.focus();
				return;
			}
			const name = draftForm.name.value.trim();
			const slug = slugify(name) || 'category';
			const node = { id: uniqueId(slug), name, shown: false, slug, title: name, desc: '' };
			if (parent) {
				parent.subs.push(node);
				collapsed.delete(parent.id);
			} else {
				node.icon = picked('pc-new-icon') || 'bi-box-seam';
				node.tone = Number(picked('pc-new-tone')) || 1;
				node.subs = [];
				state.cats.push(node);
			}
			findField.value = '';
			bootstrap.Modal.getOrCreateInstance(newEl).hide();
			render(node.id);
			toast({
				tone: 'success',
				title: `${name} added`,
				text: `${parent ? `Under ${parent.name}, hidden` : 'At the end of the menu, hidden'} until you show it.`,
				duration: 6000,
				actions: [{ label: 'Edit details', onClick: () => openEdit(node.id) }],
			});
		});

		/* Export */
		pick('[data-pc-export]', root).addEventListener('click', () => {
			function cell(v) {
				return `"${String(v).replace(/"/g, '""')}"`;
			}

			const rows = [['Category', 'Subcategory', 'Products', 'Sales, 30 days', 'In store', 'Web address']];
			state.cats.forEach((g) => {
				const gl = groupProducts(g);
				rows.push([g.name, '', gl.length, salesOf(gl), g.shown ? 'Yes' : 'No', `shop.marlo.com/${g.slug}`]);
				g.subs.forEach((s) => {
					const sl = productsIn(s);
					rows.push([
						g.name,
						s.name,
						sl.length,
						salesOf(sl),
						s.shown && g.shown ? 'Yes' : 'No',
						`shop.marlo.com/${g.slug}/${s.slug}`,
					]);
				});
			});
			const blob = new Blob([rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = 'marlo-shop-categories.csv';
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
			toast({
				tone: 'success',
				title: 'Categories exported',
				text: `${plural(rows.length - 1, 'row', 'rows')} in marlo-shop-categories.csv.`,
				duration: 4000,
			});
		});

		render();
	}

	/* Helpers */
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

	function money(n) {
		return `$${Math.round(n).toLocaleString('en-US')}`;
	}

	function plural(n, one, many) {
		return `${n} ${n === 1 ? one : many}`;
	}

	function slugify(s) {
		return String(s)
			.toLowerCase()
			.replace(/&/g, ' ')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		const el = pick('[data-pc-status]', root);
		if (el) el.textContent = t;
	}

	function find(id) {
		for (const g of state.cats) {
			if (g.id === id) return { node: g, group: null };
			const s = g.subs.find((x) => x.id === id);
			if (s) return { node: s, group: g };
		}
		return null;
	}

	function productsIn(sub) {
		return state.products.filter((p) => p.cat === sub.id);
	}

	function groupProducts(g) {
		return g.subs.reduce((all, s) => all.concat(productsIn(s)), []);
	}

	function salesOf(list) {
		return list.reduce((sum, p) => sum + p.price * p.sold, 0);
	}

	function priceOf(p) {
		return money(p.price) + (p.per ? `<span class="pc-per">${htmlSafe(p.per)}</span>` : '');
	}

	function uniqueId(base) {
		let id = base || 'category';
		let n = 2;
		while (find(id)) id = `${base}-${n++}`;
		return id;
	}

	function snapshot() {
		return JSON.parse(JSON.stringify(state));
	}

	/* Cards and rows */
	const treeNode = pick('[data-pc-tree]', root);
	const blankNode = pick('[data-pc-empty]', root);
	const findField = pick('[data-pc-search]', root);

	function storeCell(node, group) {
		if (group && !group.shown) {
			return `<span class="pc-store pc-quiet" title="${htmlSafe(group.name)} is hidden">Hidden</span>`;
		}
		const id = `pc-show-${node.id}`;
		return `<span class="pc-store"><span class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" id="${id}"${node.shown ? ' checked' : ''} data-pc-toggle="${node.id}"><label class="visually-hidden" for="${id}">Show ${htmlSafe(node.name)} in the Store menu</label></span></span>`;
	}

	function menuCell(node, group) {
		const isGroup = !group;
		const list = isGroup ? state.cats : group.subs;
		const i = list.indexOf(node);
		const canDelete = !isGroup || !node.subs.length;
		return `<div class="pc-menu dropdown"><button type="button" class="btn btn-icon btn-sm" data-bs-toggle="dropdown" aria-expanded="false" aria-label="More for ${htmlSafe(node.name)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button><ul class="dropdown-menu dropdown-menu-end"><li><button type="button" class="dropdown-item" data-pc-act="edit" data-pc-id="${node.id}"><i class="bi bi-pencil" aria-hidden="true"></i>Edit details</button></li><li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item" data-pc-act="up" data-pc-id="${node.id}"${i === 0 ? ' disabled' : ''}><i class="bi bi-arrow-up" aria-hidden="true"></i>Move up</button></li><li><button type="button" class="dropdown-item" data-pc-act="down" data-pc-id="${node.id}"${i === list.length - 1 ? ' disabled' : ''}><i class="bi bi-arrow-down" aria-hidden="true"></i>Move down</button></li>${canDelete ? `<li><hr class="dropdown-divider"></li><li><button type="button" class="dropdown-item text-danger" data-pc-act="delete" data-pc-id="${node.id}"><i class="bi bi-trash3" aria-hidden="true"></i>Delete</button></li>` : ''}</ul></div>`;
	}

	function hiddenPill(node) {
		return node.shown ? '' : ' <span class="basalt-status pc-pill">Hidden</span>';
	}

	function storeSales() {
		return state.cats.reduce((sum, g) => sum + salesOf(groupProducts(g)), 0);
	}

	/* Subcategory bars share one scale across the Store, so a long bar in
     one card means the same as a long bar in another. */
	function topSub() {
		return Math.max(1, ...state.cats.map((g) => Math.max(0, ...g.subs.map((s) => salesOf(productsIn(s))))));
	}

	function subRow(s, g, hide, top) {
		const list = productsIn(s);
		const sales = salesOf(list);
		const pct = Math.max(sales ? 3 : 0, Math.round((sales / top) * 100));
		const facts = list.length
			? `${plural(list.length, 'product', 'products')} · ${money(sales)}`
			: 'No products yet';
		return `<li class="basalt-sortable-item pc-sub${s.shown && g.shown ? '' : ' is-off'}" data-pc-id="${s.id}"${hide ? ' hidden' : ''}><div class="pc-row"><button type="button" class="basalt-sortable-handle" aria-label="Move ${htmlSafe(s.name)}"><i class="bi bi-grip-vertical" aria-hidden="true"></i></button><div class="pc-cat"><span class="pc-dot" aria-hidden="true"></span><div class="pc-cat-text"><button type="button" class="pc-name" data-pc-open="${s.id}">${htmlSafe(s.name)}</button>${hiddenPill(s)}<p class="pc-facts">${facts}</p></div></div>${list.length ? `<span class="pc-num"><a class="pc-count" href="products.html" aria-label="${htmlSafe(`${plural(list.length, 'product', 'products')} in ${s.name}, open the product list`)}">${list.length}</a></span>` : '<span class="pc-num pc-quiet">None yet</span>'}<span class="pc-sales"><span class="pc-bar" aria-hidden="true"><span style="width:${pct}%"></span></span><span class="pc-sales-val${sales ? '' : ' pc-quiet'}">${sales ? money(sales) : '–'}</span></span>${storeCell(s, g)}${menuCell(s, g)}</div></li>`;
	}

	function groupCard(g, q, total, top) {
		const list = groupProducts(g);
		const sales = salesOf(list);
		const share = total ? Math.round((sales / total) * 100) : 0;
		const open = q || !collapsed.has(g.id);
		const showAllSubs = !q || Basalt.matchesQuery(g.name, q);
		const subsHtml = g.subs.map((s) => subRow(s, g, !showAllSubs && !subMatches(s, q), top)).join('');
		const facts = list.length
			? `${plural(list.length, 'product', 'products')} · ${money(sales)}`
			: 'No products yet';
		return `<li class="basalt-sortable-item pc-group pc-tone-${g.tone}${g.shown ? '' : ' is-off'}" data-pc-id="${g.id}"${q && !groupMatches(g, q) ? ' hidden' : ''}><div class="pc-row pc-row-head"><button type="button" class="basalt-sortable-handle" aria-label="Move ${htmlSafe(g.name)}"><i class="bi bi-grip-vertical" aria-hidden="true"></i></button><div class="pc-cat"><span class="pc-mark" aria-hidden="true"><i class="bi ${g.icon}"></i></span><div class="pc-cat-text"><h2 class="pc-title"><button type="button" class="pc-name" data-pc-open="${g.id}">${htmlSafe(g.name)}</button>${hiddenPill(g)}</h2><p class="pc-desc">${htmlSafe(g.desc || (g.subs.length ? plural(g.subs.length, 'subcategory', 'subcategories') : 'No subcategories yet'))}</p><p class="pc-facts">${facts}</p></div></div><span class="pc-stat pc-num"><span class="pc-stat-label">Products</span><span class="pc-stat-val">${list.length || '–'}</span></span><span class="pc-stat pc-sales-head"><span class="pc-stat-label">Sales, 30 days</span><span class="pc-stat-val">${sales ? `${money(sales)}<span class="pc-share">${share}% of the Store</span>` : '–'}</span></span><span class="pc-stat pc-stat-store"><span class="pc-stat-label">In store</span>${storeCell(g, null)}</span>${menuCell(g, null)}</div><ul class="basalt-sortable pc-subs" id="pc-subs-${g.id}" data-basalt-sortable data-basalt-sortable-group="pc-subs" aria-label="Subcategories of ${htmlSafe(g.name)}"${open ? '' : ' hidden'}>${subsHtml}</ul><div class="pc-group-foot"><button type="button" class="pc-chev" aria-expanded="${open}" aria-controls="pc-subs-${g.id}"${g.subs.length ? '' : ' hidden'}><i class="bi bi-chevron-down" aria-hidden="true"></i><span>${open ? 'Hide' : 'Show'} ${plural(g.subs.length, 'subcategory', 'subcategories')}</span></button><button type="button" class="pc-add" data-pc-act="add" data-pc-id="${g.id}"><i class="bi bi-plus-lg" aria-hidden="true"></i>Add subcategory</button></div></li>`;
	}

	function subMatches(s, q) {
		return (
			Basalt.matchesQuery(s.name, q) || productsIn(s).some((p) => Basalt.matchesQuery(`${p.name} ${p.sku}`, q))
		);
	}
	function groupMatches(g, q) {
		return Basalt.matchesQuery(g.name, q) || g.subs.some((s) => subMatches(s, q));
	}

	function render(changedId) {
		const q = findField.value.trim();
		const any = !q || state.cats.some((g) => groupMatches(g, q));
		const total = storeSales();
		const top = topSub();
		treeNode.innerHTML = state.cats.map((g) => groupCard(g, q, total, top)).join('');
		treeNode.hidden = !any;
		blankNode.hidden = any;
		blankNode.innerHTML = any ? '' : Basalt.emptyState({ query: q, noun: 'categories or products' });
		if (q) {
			const n = state.cats.reduce((sum, g) => sum + (groupMatches(g, q) ? 1 : 0), 0);
			announce(n ? plural(n, 'category matches', 'categories match') : '');
		}
		treeNode.setAttribute('data-basalt-sortable', '');

		for (const list of [treeNode].concat(pickAll('.pc-subs', treeNode))) {
			window.Basalt.sortable(list);
			/* A sub-list sits inside its category's card, so keys pressed on its
         handles must not also reach the outer list's keyboard sorting. */
			if (list !== treeNode)
				list.addEventListener('keydown', (e) => {
					if (e.target.closest('.basalt-sortable-handle')) e.stopPropagation();
				});
		}

		summary();
		/* Briefly light up the row that just changed. */
		const changed = changedId && pick(`[data-pc-id="${changedId}"]`, treeNode);
		if (changed) changed.classList.add('is-moved');
	}

	function summary() {
		const subs = state.cats.reduce((n, g) => n + g.subs.length, 0);
		const hidden = state.cats.reduce((n, g) => n + (g.shown ? 0 : 1) + g.subs.filter((s) => !s.shown).length, 0);
		pick('[data-pc-sum]', root).textContent =
			`${plural(state.cats.length, 'category', 'categories')} · ${plural(subs, 'subcategory', 'subcategories')}${hidden ? ` · ${hidden} hidden` : ''}`;
	}

	/* Rebuild the order from the rows after a drag or a keyboard move. */
	function readOrder() {
		const nodeById = {};
		state.cats.forEach((g) => {
			nodeById[g.id] = g;
			g.subs.forEach((s) => {
				nodeById[s.id] = s;
			});
		});
		state.cats = pickAll(':scope > .pc-group', treeNode).map((li) => {
			const g = nodeById[li.dataset.pcId];
			g.subs = pickAll(':scope > .pc-sub', pick('.pc-subs', li)).map((sli) => nodeById[sli.dataset.pcId]);
			return g;
		});
	}

	/* The sortable list still reads the moved row after this event, and its
     drop animation runs for about 200ms, so the redraw waits for both. */
	treeNode.addEventListener('basalt:sortable-change', (e) => {
		const { item, from, to } = e.detail;
		const id = item.dataset.pcId;
		readOrder();
		summary();
		setTimeout(() => {
			const hadFocus = item.contains(document.activeElement);
			render(id);
			if (hadFocus) {
				const h = pick(`[data-pc-id="${id}"] > .pc-row .basalt-sortable-handle`, treeNode);
				if (h) h.focus();
			}
		}, 240);
		if (from !== to) {
			const f = find(id);
			toast({
				tone: 'success',
				title: `${f.node.name} moved`,
				text: `Now under ${f.group.name}.`,
				duration: 4000,
			});
		}
	});

	function move(id, dir) {
		const f = find(id);
		const list = f.group ? f.group.subs : state.cats;
		const i = list.indexOf(f.node);
		const j = i + dir;
		if (j < 0 || j >= list.length) return;
		list.splice(i, 1);
		list.splice(j, 0, f.node);
		render(id);
		announce(`${f.node.name} is now ${j + 1} of ${list.length}.`);
	}

	treeNode.addEventListener('click', (e) => {
		const chev = e.target.closest('.pc-chev');
		if (chev) {
			const li = chev.closest('.pc-group');
			const id = li.dataset.pcId;
			const open = chev.getAttribute('aria-expanded') !== 'true';
			if (open) collapsed.delete(id);
			else collapsed.add(id);
			chev.setAttribute('aria-expanded', String(open));
			pick('span', chev).textContent =
				(open ? 'Hide ' : 'Show ') + plural(pickAll('.pc-sub', li).length, 'subcategory', 'subcategories');
			const subs = pick('.pc-subs', li);
			window.Basalt.slide(subs, () => {
				subs.hidden = !open;
			});
			return;
		}
		const act = e.target.closest('[data-pc-act]');
		if (act) {
			const id = act.dataset.pcId;
			const what = act.dataset.pcAct;
			if (what === 'edit') openEdit(id);
			else if (what === 'add') openNew(id);
			else if (what === 'up') move(id, -1);
			else if (what === 'down') move(id, 1);
			else if (what === 'delete') openDelete(id);
			return;
		}
		if (e.target.closest('.basalt-sortable-handle, .pc-store, .pc-menu, a')) return;
		const open = e.target.closest('[data-pc-open]');
		const row = e.target.closest('.pc-row');
		if (open) openEdit(open.dataset.pcOpen);
		else if (row) openEdit(row.closest('.basalt-sortable-item').dataset.pcId);
	});

	treeNode.addEventListener('change', (e) => {
		const sw = e.target.closest('[data-pc-toggle]');
		if (!sw) return;
		const f = find(sw.dataset.pcToggle);
		f.node.shown = sw.checked;
		render();
		const box = pick(`[data-pc-toggle="${f.node.id}"]`, treeNode);
		if (box) box.focus({ preventScroll: true });
		const kids =
			!f.group && f.node.subs.length
				? ` with its ${plural(f.node.subs.length, 'subcategory', 'subcategories')}`
				: '';
		toast({
			tone: sw.checked ? 'success' : 'primary',
			title: f.node.name + (sw.checked ? ' is in the Store menu' : ' is hidden'),
			text: sw.checked
				? 'Customers can browse it again.'
				: `Taken out of the Store menu${kids}. Its products stay on sale.`,
			duration: 4000,
		});
	});

	findField.addEventListener('input', () => render());

	/* Icon and color pickers */
	function fillPickers(kind) {
		pick(`[data-pc-icons="${kind}"]`).innerHTML = ICONS.map(
			(ic) =>
				`<label class="basalt-choice"><input type="radio" name="pc-${kind}-icon" value="${ic[0]}"><i class="bi ${ic[0]}" aria-hidden="true"></i><span class="visually-hidden">${ic[1]}</span></label>`,
		).join('');
		pick(`[data-pc-tones="${kind}"]`).innerHTML = TONES.map(
			(n) =>
				`<label class="pc-swatch"><input type="radio" class="btn-check" name="pc-${kind}-tone" value="${n}"><span class="pc-swatch-dot pc-tone-${n}" aria-hidden="true"></span><span class="visually-hidden">Color ${n}</span></label>`,
		).join('');
	}
	fillPickers('edit');
	fillPickers('new');
	function checkChoice(name, value) {
		const el = pick(`input[name="${name}"][value="${value}"]`);
		if (el) el.checked = true;
	}
	function picked(name) {
		const el = pick(`input[name="${name}"]:checked`);
		return el ? el.value : '';
	}

	function counters(scope) {
		for (const c of pickAll('[data-pc-count]', scope)) {
			const input = document.getElementById(c.dataset.pcCount);
			c.textContent = `${input.value.length} / ${input.maxLength}`;
		}
	}

	/* Edit drawer */
	const sheetNode = document.getElementById('pc-edit');
	const drawer = bootstrap.Offcanvas.getOrCreateInstance(sheetNode);
	const form = pick('[data-pc-edit-form]', sheetNode);

	function E(k) {
		return pick(`[data-pc-e="${k}"]`, sheetNode);
	}

	let editing = null;
	let autoSlug = false;

	function markHtml(tone, icon) {
		return `<span class="pc-mark pc-tone-${tone}"><i class="bi ${icon}"></i></span>`;
	}
	function editPrefix() {
		if (!editing || !editing.group) return 'shop.marlo.com/';
		const g = find(E('parent').value);
		return `shop.marlo.com/${g ? g.node.slug : editing.group.slug}/`;
	}
	/* The header mark follows the form: a subcategory takes the color of
     the category picked under Belongs to; a top-level one its own picks. */
	function editMark() {
		const f = editing;
		if (f.group) {
			const g = find(E('parent').value);
			E('mark').innerHTML = markHtml((g ? g.node : f.group).tone, 'bi-tag');
		} else {
			E('mark').innerHTML = markHtml(
				Number(picked('pc-edit-tone')) || f.node.tone,
				picked('pc-edit-icon') || f.node.icon,
			);
		}
	}

	function openEdit(id) {
		const f = find(id);
		if (!f) return;
		editing = f;
		const n = f.node;
		const isGroup = !f.group;
		form.classList.remove('was-validated');

		for (const el of pickAll('.is-invalid', form)) {
			el.classList.remove('is-invalid');
		}

		E('title').textContent = n.name;
		form.name.value = n.name;
		form.desc.value = n.desc || '';
		form.shown.checked = n.shown;
		form.slug.value = n.slug;
		form.title.value = n.title || '';
		autoSlug = n.slug === slugify(n.name);

		E('parentField').hidden = isGroup;
		E('look').hidden = !isGroup;
		if (isGroup) {
			checkChoice('pc-edit-icon', n.icon);
			checkChoice('pc-edit-tone', n.tone);
			const list = groupProducts(n);
			E('sub').textContent =
				`${plural(n.subs.length, 'subcategory', 'subcategories')} · ${plural(list.length, 'product', 'products')}`;
			E('shownHint').textContent = n.subs.length
				? 'Hiding it hides its subcategories too. Products stay on sale.'
				: 'Hidden categories keep their web address.';
			E('listTitle').textContent = 'Subcategories';
			E('list').innerHTML = n.subs
				.map((s) => {
					const c = productsIn(s).length;
					return `<li class="pc-items-row"><span class="pc-dot pc-tone-${n.tone}" aria-hidden="true"></span><span class="pc-items-name">${htmlSafe(s.name)}${s.shown ? '' : ' <span class="basalt-status">Hidden</span>'}</span><span class="pc-items-end">${c ? plural(c, 'product', 'products') : 'No products yet'}</span></li>`;
				})
				.join('');
			E('note').hidden = false;
			E('note').textContent = n.subs.length
				? `To delete ${n.name}, move or delete its ${plural(n.subs.length, 'subcategory', 'subcategories')} first.`
				: 'No subcategories yet. Add one with Add subcategory on its card.';
			E('delete').hidden = n.subs.length > 0;
		} else {
			const sel = E('parent');
			sel.innerHTML = state.cats
				.map((g) => `<option value="${g.id}"${g === f.group ? ' selected' : ''}>${htmlSafe(g.name)}</option>`)
				.join('');
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(sel);
			const list = productsIn(n);
			E('sub').textContent =
				`In ${f.group.name} · ${list.length ? plural(list.length, 'product', 'products') : 'no products yet'}`;
			E('shownHint').textContent = f.group.shown
				? 'Hidden categories keep their products and web address.'
				: `${f.group.name} is hidden, so this stays out of the menu until it is shown.`;
			E('listTitle').textContent = 'Products';
			E('list').innerHTML = list
				.map(
					(p) =>
						`<li class="pc-items-row"><span class="pc-thumb pc-tone-${f.group.tone}" aria-hidden="true"><i class="bi ${p.icon}"></i></span><span class="pc-items-name"><a href="product-details.html">${htmlSafe(p.name)}</a><span class="pc-items-sku">${htmlSafe(p.sku)}</span></span><span class="pc-items-end pc-items-price">${priceOf(p)}</span></li>`,
				)
				.join('');
			E('note').hidden = list.length > 0;
			E('note').innerHTML =
				'No products yet. Pick this category on a product in the <a href="products.html">product list</a>.';
			E('delete').hidden = false;
		}
		E('prefix').textContent = editPrefix();
		editMark();
		counters(form);
		drawer.show();
	}

	form.addEventListener('input', (e) => {
		if (e.target === form.name) {
			E('title').textContent = form.name.value.trim() || 'Untitled';
			if (autoSlug) form.slug.value = slugify(form.name.value);
		}
		if (e.target === form.slug) autoSlug = false;
		if (e.target.classList.contains('is-invalid')) e.target.classList.remove('is-invalid');
		counters(form);
	});
	form.addEventListener('change', (e) => {
		if (e.target === E('parent')) E('prefix').textContent = editPrefix();
		if (e.target.name === 'pc-edit-icon' || e.target.name === 'pc-edit-tone' || e.target === E('parent'))
			editMark();
	});

	/* Checks a name and a web address against the other categories at
     the same level. Returns the first field with a problem, or null. */
	function check(nameInput, nameErr, siblings, slugInput, slugErr) {
		let bad = null;
		const name = nameInput.value.trim();
		const clash = siblings.find((x) => x.name.toLowerCase() === name.toLowerCase());
		if (!name || clash) {
			nameErr.textContent = name
				? `There is already a category called ${clash.name} here.`
				: 'Give the category a name.';
			nameInput.classList.add('is-invalid');
			bad = nameInput;
		}
		if (slugInput) {
			const slug = slugInput.value.trim();
			const taken = siblings.some((x) => x.slug === slug);
			if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || taken) {
				slugErr.textContent = taken
					? 'Another category here already uses this address.'
					: 'Use lower-case letters, numbers and dashes.';
				slugInput.classList.add('is-invalid');
				bad = bad || slugInput;
			}
		}
		return bad;
	}

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const f = editing;
		const n = f.node;
		const target = f.group ? find(E('parent').value).node : null;
		const siblings = (f.group ? target.subs : state.cats).filter((x) => x !== n);
		const bad = check(form.name, E('nameErr'), siblings, form.slug, E('slugErr'));
		if (bad) {
			bad.focus();
			return;
		}
		n.name = form.name.value.trim();
		n.desc = form.desc.value.trim();
		n.shown = form.shown.checked;
		n.slug = form.slug.value.trim();
		n.title = form.title.value.trim();
		if (!f.group) {
			n.icon = picked('pc-edit-icon') || n.icon;
			n.tone = Number(picked('pc-edit-tone')) || n.tone;
		} else if (target !== f.group) {
			f.group.subs.splice(f.group.subs.indexOf(n), 1);
			target.subs.push(n);
			collapsed.delete(target.id);
		}
		drawer.hide();
		render(n.id);
		toast({
			tone: 'success',
			title: 'Changes saved',
			text: n.name + (f.group && target !== f.group ? ` is now under ${target.name}.` : ' is up to date.'),
			duration: 4000,
		});
	});

	E('delete').addEventListener('click', () => {
		const id = editing.node.id;
		sheetNode.addEventListener('hidden.bs.offcanvas', () => openDelete(id), { once: true });
		drawer.hide();
	});

	/* Delete */
	const delEl = document.getElementById('pc-delete');
	const removeDialog = bootstrap.Modal.getOrCreateInstance(delEl);

	function D(k) {
		return pick(`[data-pc-d="${k}"]`, delEl);
	}

	let deleting = null;

	function openDelete(id) {
		const f = find(id);
		if (!f) return;
		deleting = f;
		const n = f.node;
		const list = f.group ? productsIn(n) : [];
		D('title').textContent = `Delete ${n.name}?`;
		D('moveField').hidden = !list.length;
		if (list.length) {
			D('text').textContent =
				list.length === 1
					? 'Its one product stays on sale under another category.'
					: `Its ${list.length} products stay on sale under another category.`;
			D('moveLabel').textContent = `Move ${list.length === 1 ? 'it' : 'them'} to`;
			const sel = D('move');
			const others = [];
			f.group.subs.forEach((s) => {
				if (s !== n) others.push([s, f.group]);
			});
			state.cats.forEach((g) => {
				if (g !== f.group) g.subs.forEach((s) => others.push([s, g]));
			});
			sel.innerHTML = others
				.map((o) => `<option value="${o[0].id}">${htmlSafe(`${o[1].name} · ${o[0].name}`)}</option>`)
				.join('');
			if (window.Basalt.select && window.Basalt.select.refresh) window.Basalt.select.refresh(sel);
		} else {
			D('text').textContent = f.group
				? 'It has no products, so nothing else changes.'
				: 'It has no subcategories, so nothing else changes.';
		}
		removeDialog.show();
	}

	D('go').addEventListener('click', () => {
		const f = deleting;
		const before = snapshot();
		const moved = f.group ? productsIn(f.node) : [];
		let dest = null;
		if (moved.length) {
			dest = find(D('move').value);
			moved.forEach((p) => {
				p.cat = dest.node.id;
			});
		}
		const list = f.group ? f.group.subs : state.cats;
		list.splice(list.indexOf(f.node), 1);
		removeDialog.hide();
		render(dest ? dest.node.id : null);
		toast({
			tone: 'primary',
			icon: 'bi-trash3',
			title: `${f.node.name} deleted`,
			text: moved.length
				? `${plural(moved.length, 'product', 'products')} moved to ${dest.node.name}.`
				: 'Removed from the Store menu.',
			duration: 6000,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						state = before;
						render(f.node.id);
					},
				},
			],
		});
	});

	/* New category */
	const newEl = document.getElementById('pc-new');
	const draftForm = pick('[data-pc-new-form]', newEl);

	function N(k) {
		return pick(`[data-pc-n="${k}"]`, newEl);
	}

	let presetParent = '';

	function openNew(parentId) {
		presetParent = parentId || '';
		bootstrap.Modal.getOrCreateInstance(newEl).show();
	}

	start();
})();
