/**
 * Basalt - Reviews page (reviews.html)
 * Reviews of what Marlo sells, from shoppers and from the stockists
 * who sell it on: approve new ones, decide flagged ones, answer them
 * in public, and see how products rate.
 * Every list on the page is drawn from the data below.
 */
(() => {
	'use strict';
	const root = pick('[data-rvw-root]');
	if (!root) return;

	function start() {
		ask.addEventListener('change', drawAsk);
		askMessage.addEventListener('input', () => {
			askMessage.classList.remove('is-invalid');
			askMessage.removeAttribute('aria-invalid');
		});
		/* Each time the dialog opens it starts from the defaults again. */
		ask.addEventListener('show.bs.modal', () => {
			askProduct.value = 'all';
			const when = pick('#rvw-ask-when30', ask);
			when.checked = true;
			when.dispatchEvent(new Event('change', { bubbles: true }));
			askMessage.value = askDefault;
			askMessage.classList.remove('is-invalid');
			askMessage.removeAttribute('aria-invalid');
			drawAsk();
		});
		askForm.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!askMessage.value.trim()) {
				askMessage.classList.add('is-invalid');
				askMessage.setAttribute('aria-invalid', 'true');
				askMessage.focus();
				return;
			}
			const n = askCount();
			const what = askProduct.value === 'all' ? 'their order' : PRODUCTS[askProduct.value].name;
			bootstrap.Modal.getOrCreateInstance(ask).hide();
			toast({
				tone: 'success',
				icon: 'bi-send',
				title: `Asked ${plural(n, 'buyer')} for a review`,
				text: `Each gets one email about ${what}.`,
			});
			announce('Review requests sent');
		});

		refresh();
	}

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

	function toast(o) {
		return window.Basalt.toasts ? window.Basalt.toasts.push(o) : null;
	}

	function announce(t) {
		if (window.Basalt.announce) window.Basalt.announce(t);
	}

	function plural(n, one, many) {
		return `${n.toLocaleString('en-US')} ${n === 1 ? one : many || `${one}s`}`;
	}

	/* The signed-in admin, who writes new replies. */
	const ME = 'John Armstrong';

	/* Data */
	/* Products, customers and orders come from the Store book
     (window.Basalt.shopBook, assets/basalt/js/data/multipurpose/store.js), so a review
     names the same product, customer and order as Products, Shoppers
     and Order Details, and every link opens that record. */
	const book = window.Basalt.shopBook;

	/* The Store catalog: name, average rating and review count per
     product, as on the Products page. Tone picks the tile color from the
     chart ramp, so neighboring rows and lists never share one color. */
	const TONES = {
		'ML-BLAZ': 1,
		'ML-GOWN': 2,
		'ML-ORGZ': 3,
		'ML-SUIT': 4,
		'ML-TRCH': 5,
		'ML-LOAF': 6,
		'ML-OXFD': 3,
		'ML-CATE': 5,
		'ML-SHLD': 6,
		'ML-GIFT250': 4,
		'ML-CARE': 2,
		'ML-PASS': 1,
		'ML-MTM': 5,
		'ML-STYLE': 3,
	};
	const PRODUCTS = {};
	book.PRODUCTS.forEach((p) => {
		PRODUCTS[p.sku] = {
			sku: p.sku,
			name: p.name,
			icon: p.icon,
			tone: TONES[p.sku],
			rating: p.rating,
			reviews: p.reviews,
		};
	});

	/* Every published review in the Store, by stars (adds up to the
     catalog's 1,186 reviews). */
	const DISTRIBUTION = [
		[5, 875],
		[4, 210],
		[3, 51],
		[2, 22],
		[1, 28],
	];

	/* Buyers who could be asked for a review, by product, for orders in the
     last 30, 60 and 90 days. Anyone who already reviewed is left out. */
	const ASKABLE = {
		'ML-BLAZ': [9, 17, 26],
		'ML-GOWN': [6, 11, 18],
		'ML-ORGZ': [7, 13, 21],
		'ML-SUIT': [3, 5, 8],
		'ML-TRCH': [3, 6, 9],
		'ML-LOAF': [8, 15, 24],
		'ML-OXFD': [4, 8, 12],
		'ML-CATE': [1, 2, 4],
		'ML-SHLD': [2, 4, 6],
		'ML-GIFT250': [2, 5, 7],
		'ML-CARE': [1, 3, 5],
		'ML-PASS': [2, 4, 6],
		'ML-MTM': [1, 1, 2],
		'ML-STYLE': [1, 2, 3],
	};

	/* status: pending (waiting for approval), flagged (held back until
     someone decides), published (live in the Store) or hidden.
     order: the Store order the product came on; the customer, quantity
     and delivery day are read from it. A club review names the
     customer who is a member (member) instead; a review with neither
     came from someone who never ordered (from). */
	const REVIEWS = [
		{
			id: '#4222',
			sku: 'ML-SUIT',
			order: '#33',
			rating: 4,
			title: 'Sold out in our boutique in a week',
			body: 'All six went in the first week, mostly to regulars. A darker stripe for winter would sell just as fast.',
			photos: 0,
			status: 'pending',
			date: '2026-10-09',
			time: '8:20 am',
		},
		{
			id: '#4221',
			sku: 'ML-BLAZ',
			order: '#32',
			rating: 5,
			title: 'Our best seller this autumn',
			body: 'Clients try it on and buy it on the spot. The care card in each pocket saves us explaining the pressing.',
			photos: 1,
			status: 'published',
			date: '2026-10-08',
			time: '3:05 pm',
			reply: {
				by: ME,
				date: 'Oct 8',
				text: 'Thanks, Maren. The next blazers for Arbor North Studio leave Ann Arbor on October 20.',
			},
		},
		{
			id: '#4220',
			sku: 'ML-TRCH',
			order: '#31',
			rating: 4,
			title: 'Easy to sell, sizes run large',
			body: 'Nappa that softens beautifully with wear, which our clients love. We now tell them to take a size down.',
			photos: 0,
			status: 'published',
			date: '2026-10-08',
			time: '10:40 am',
		},
		{
			id: '#4219',
			sku: 'ML-BLAZ',
			order: '#458',
			rating: 5,
			title: 'Sharp enough to skip the coat',
			body: 'I wore it to the office all week over a silk shirt. Structured, light and not a crease after a week of wear so far.',
			photos: 2,
			status: 'pending',
			date: '2026-10-08',
			time: '9:14 am',
		},
		{
			id: '#4218',
			sku: 'ML-SHLD',
			order: '#439',
			rating: 2,
			title: 'Stunning, but light on the nose',
			body: 'Bold as anything, but both pairs slid down my nose within a month. I only wear them on the beach.',
			photos: 1,
			status: 'pending',
			date: '2026-10-07',
			time: '4:52 pm',
		},
		{
			id: '#4217',
			sku: 'ML-OXFD',
			order: '#455',
			rating: 3,
			title: 'Beautiful leather, a little stiff',
			body: 'The calf is supple and the ivory suede is perfect. The heel counter is quite stiff, so it rubbed for the first week of wear.',
			photos: 0,
			status: 'pending',
			date: '2026-10-06',
			time: '11:30 am',
		},
		{
			id: '#4216',
			sku: 'ML-GOWN',
			order: '#453',
			rating: 2,
			title: 'Left out in the rain',
			body: 'The courier left the box on the step in the rain. The gown was fine, but the packaging was ruined.',
			photos: 1,
			status: 'hidden',
			date: '2026-10-05',
			time: '7:46 pm',
			hidden: {
				reason: 'About the delivery, not the product. Passed to Support.',
				by: 'Connie Reese',
				date: 'Oct 6',
			},
		},
		{
			id: '#4215',
			sku: 'ML-GIFT250',
			order: '#419',
			rating: 4,
			title: 'My sister loved it, just one small wish',
			body: 'The card arrived right on her birthday. I would like a way to stop it landing in her inbox before 8 am.',
			photos: 0,
			status: 'pending',
			date: '2026-10-05',
			time: '7:05 pm',
		},
		{
			id: '#4214',
			sku: 'ML-ORGZ',
			order: '#457',
			rating: 5,
			title: 'A showstopper all October',
			body: 'The organza holds its shape and the bodice fits like couture. Every tier caught the light at the gala.',
			photos: 3,
			status: 'published',
			date: '2026-10-05',
			time: '8:40 am',
		},
		{
			id: '#4213',
			sku: 'ML-CATE',
			order: '#428',
			rating: 1,
			title: 'Hinge came loose in a week',
			body: 'One hinge came loose after a week. Connie in Support sent a new pair the same day, but it should not fail this soon.',
			photos: 1,
			status: 'flagged',
			date: '2026-10-04',
			time: '2:18 pm',
			flag: { reason: 'Names a member of staff', by: 'Reported by Connie Reese' },
		},
		{
			id: '#4212',
			sku: 'ML-MTM',
			order: '#426',
			rating: 5,
			title: 'Worth the two fittings',
			body: 'The tailor fixed the shoulders at the second fitting, and the suit came a week early. Worth every penny.',
			photos: 0,
			status: 'published',
			date: '2026-10-04',
			time: '11:18 am',
		},
		{
			id: '#4211',
			sku: 'ML-LOAF',
			order: '#422',
			rating: 5,
			title: 'The loafer I would buy in every color',
			body: 'Soft suede that molds to the foot and keeps its shape. Call me on 555 0148 if you want to buy my old ones.',
			photos: 0,
			status: 'flagged',
			date: '2026-10-03',
			time: '10:02 am',
			flag: { reason: 'Contains a phone number', by: 'Caught by the Store filter' },
		},
		{
			id: '#4210',
			sku: 'ML-SUIT',
			order: '#430',
			rating: 4,
			title: 'Sharp and light, creases at first',
			body: 'Light as a cloud and sharp on the walk to work. It creased a little at the elbow for the first week.',
			photos: 1,
			status: 'published',
			date: '2026-10-02',
			time: '3:44 pm',
			reply: {
				by: ME,
				date: 'Oct 3',
				text: 'Thanks, Natalie. A light steam on a hanger settles the cloth, and the creasing should stop after that.',
			},
		},
		{
			id: '#4209',
			sku: 'ML-BLAZ',
			order: '#436',
			rating: 5,
			title: 'Still sharp after a month',
			body: 'A month of daily wear through the first frosts in Boulder and it still looks new. The jet buttons are a lovely touch and feel solid.',
			photos: 2,
			status: 'published',
			date: '2026-10-01',
			time: '4:27 pm',
			reply: {
				by: ME,
				date: 'Oct 2',
				text: 'Thanks, Claire. Glad it held up. The Shield Sunglasses are back in November if you would like a pair too.',
			},
		},
		{
			id: '#4208',
			sku: 'ML-PASS',
			member: 'Claire Donnelly',
			rating: 5,
			title: 'Next-day, every single time',
			body: 'Everything I ordered this autumn came the next morning, and the free returns pickup saves me a trip to town.',
			photos: 0,
			status: 'published',
			date: '2026-09-30',
			time: '9:26 am',
		},
		{
			id: '#4207',
			sku: 'ML-TRCH',
			order: '#424',
			rating: 4,
			title: 'Supple nappa, runs a size big',
			body: 'Beautiful black nappa that moves like cloth. It runs large, so I swapped mine for a small with no fuss.',
			photos: 2,
			status: 'published',
			date: '2026-09-28',
			time: '1:12 pm',
			reply: {
				by: ME,
				date: 'Sep 29',
				text: 'Thanks, Phyllis. The size guide now says the trench runs large, and the small you asked for is on its way.',
			},
		},
		{
			id: '#4206',
			sku: 'ML-GOWN',
			order: '#427',
			rating: 5,
			title: 'Wore it to a wedding and danced',
			body: "Wore it to my cousin's wedding and danced all night. Not a crease by the end, and the drape never slipped.",
			photos: 1,
			status: 'published',
			date: '2026-09-26',
			time: '5:38 pm',
		},
		{
			id: '#4205',
			sku: 'ML-CARE',
			member: 'Phyllis Delaney',
			rating: 4,
			title: 'Flawless repair, one thing missing',
			body: 'My old blazer came back with both cuffs repaired. I would like to see which tailor did it, with a photo.',
			photos: 0,
			status: 'published',
			date: '2026-09-24',
			time: '10:50 am',
			reply: {
				by: ME,
				date: 'Sep 25',
				text: 'Tailor photos arrive on the repair notes in November. We will let you know the day they go live.',
			},
		},
		{
			id: '#4204',
			sku: 'ML-STYLE',
			order: '#420',
			rating: 4,
			title: 'Knew what to wear by lunch',
			body: 'Ninety minutes with a stylist who listened and never pushed. A written list to take home would have helped me.',
			photos: 0,
			status: 'published',
			date: '2026-09-22',
			time: '2:05 pm',
			reply: {
				by: 'Connie Reese',
				date: 'Sep 22',
				text: 'Good idea, Iva. Every session now ends with a written list, and yours is on its way to you by email today.',
			},
		},
		{
			id: '#4203',
			sku: 'ML-CATE',
			order: '#421',
			rating: 3,
			title: 'Striking, but wider than shown',
			body: 'They sit wider than the photos show, and the wings catch in my hair when I push them up.',
			photos: 1,
			status: 'published',
			date: '2026-09-14',
			time: '8:55 am',
			reply: {
				by: 'Connie Reese',
				date: 'Sep 14',
				text: 'Sorry about that, Jasmine. The narrow fit is on its way to you at no charge.',
			},
		},
		{
			id: '#4202',
			sku: 'ML-LOAF',
			order: '#416',
			rating: 5,
			title: 'Bought them in both colors',
			body: 'Soft, light and they never pinch. I went back for the black pair the very same week.',
			photos: 0,
			status: 'published',
			date: '2026-09-09',
			time: '6:10 pm',
		},
		{
			id: '#4201',
			sku: 'ML-OXFD',
			from: 'Solewise Direct',
			person: 'Jamie Reed',
			rating: 1,
			title: 'Better shoes at our shop',
			body: 'Cheaper and better shoes are available from our online store, with free delivery.',
			photos: 0,
			status: 'hidden',
			date: '2026-09-07',
			time: '3:33 am',
			hidden: { reason: 'Advertises another shop', by: ME, date: 'Sep 7' },
		},
	];
	const TABS = ['pending', 'flagged', 'published', 'hidden'];
	const state = { tab: 'pending', q: '', stars: 'all' };

	/* Helpers */
	function product(r) {
		return PRODUCTS[r.sku];
	}

	function find(id) {
		return REVIEWS.find((r) => r.id === id);
	}

	function first(name) {
		return name.split(' ')[0];
	}

	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	function day(iso) {
		const p = iso.split('-');
		return `${MONTHS[+p[1] - 1]} ${+p[2]}`;
	}

	/* Fill in the customer, the order's quantity and delivery day, and for
     a club what the member pays for. */
	for (const r of REVIEWS) {
		if (r.order) {
			const o = book.order(r.order);
			const c = book.customer(o.customer);
			const line = o.lines.find((l) => l.sku === r.sku);
			r.account = c.name;
			r.person = c.buyer;
			r.city = c.city;
			r.acct = c.id;
			r.stockist = c.tier === 'stockist';
			r.order = {
				no: o.orderNumber,
				qty: line.qty,
				delivered: day(book.story(o).fulfil.deliveredAt.slice(0, 10)),
			};
		} else if (r.member) {
			const c = book.customer(r.member);
			r.acct = c.id;
			r.account = c.name;
			r.person = c.name;
			r.city = c.city;
			r.order = null;
			r.plan = `A member since ${c.joinedOn.slice(0, 4)}, billed each month`;
		} else {
			r.account = r.from;
			r.order = null;
		}
	}

	/* In a real app this is the current date; the demo is fixed on October 9. */
	const TODAY = 'Oct 9';

	function stars(n, label) {
		let out = `<span class="rvw-stars" role="img" aria-label="${label || `${n} out of 5 stars`}">`;
		for (let i = 1; i <= 5; i++) out += `<i class="bi ${i <= n ? 'bi-star-fill' : 'bi-star rvw-stars-off'}"></i>`;
		return `${out}</span>`;
	}

	function tile(p) {
		return `<span class="rvw-tile rvw-tile-${p.tone}" aria-hidden="true"><i class="bi ${p.icon}"></i></span>`;
	}

	/* The buyer's photos as small tiles, each a step further along the ramp. */
	function shots(r, cls) {
		if (!r.photos) return '';
		let out = `<span class="rvw-shots ${cls}" role="img" aria-label="${plural(r.photos, 'photo')}">`;
		for (let i = 0; i < r.photos; i++)
			out += `<span class="rvw-tile-${((product(r).tone + i) % 6) + 1}"><i class="bi bi-image"></i></span>`;
		return `${out}</span>`;
	}

	function buyer(r) {
		return r.stockist ? 'Verified stockist' : r.order ? 'Verified buyer' : r.plan ? 'Subscriber' : 'No Store order';
	}

	function productUrl(p) {
		return `product-details.html?sku=${encodeURIComponent(p.sku)}`;
	}

	/* Shoppers link to their page; a stockist, or someone who never
     ordered, has none. */
	function customerHtml(r) {
		return r.acct && !r.stockist
			? `<a href="shopper-details.html?id=${encodeURIComponent(r.acct)}">${htmlSafe(r.account)}</a>`
			: htmlSafe(r.account);
	}

	/* Tab counts */
	function counts() {
		const c = { pending: 0, flagged: 0, published: 0, hidden: 0 };

		for (const r of REVIEWS) {
			c[r.status]++;
		}

		return c;
	}
	function drawCounts() {
		const c = counts();

		for (const t of TABS) {
			pick(`[data-rvw-count="${t}"]`).textContent = c[t];
		}
	}

	/* The list */
	const list = pick('[data-rvw-list]');
	const empty = pick('[data-rvw-empty]');
	const summary = pick('[data-rvw-summary]');
	let shown = [];

	function matches(r) {
		if (r.status !== state.tab) return false;
		if (state.stars === 'low' ? r.rating > 2 : state.stars !== 'all' && r.rating !== +state.stars) return false;
		if (!state.q.trim()) return true;
		const hay = [product(r).name, r.account, r.person, r.title, r.body, r.id].join(' ');
		return window.Basalt && window.Basalt.matchesQuery
			? window.Basalt.matchesQuery(hay, state.q)
			: hay.toLowerCase().includes(state.q.toLowerCase());
	}

	function action(r) {
		if (r.status === 'pending')
			return `<button type="button" class="btn btn-outline-primary btn-sm" data-rvw-approve="${r.id}"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>`;
		if (r.status === 'flagged')
			return `<button type="button" class="btn btn-outline-primary btn-sm" data-rvw-open="${r.id}">Decide</button>`;
		if (r.status === 'hidden')
			return `<button type="button" class="btn btn-outline-secondary btn-sm" data-rvw-restore="${r.id}">Restore</button>`;
		if (!r.reply)
			return `<button type="button" class="btn btn-outline-primary btn-sm" data-rvw-open="${r.id}" data-rvw-focus="reply"><i class="bi bi-reply me-1" aria-hidden="true"></i>Reply</button>`;
		return `<span class="rvw-answered"><i class="bi bi-reply" aria-hidden="true"></i>Answered ${htmlSafe(r.reply.date)}</span>`;
	}

	function note(r) {
		if (r.status === 'flagged')
			return `<p class="rvw-row-note rvw-row-note-danger"><i class="bi bi-flag" aria-hidden="true"></i>${htmlSafe(r.flag.reason)}</p>`;
		if (r.status === 'hidden')
			return `<p class="rvw-row-note"><i class="bi bi-eye-slash" aria-hidden="true"></i>${htmlSafe(r.hidden.reason)}</p>`;
		return '';
	}

	function row(r) {
		const p = product(r);
		return `<li class="rvw-row" data-rvw-row="${r.id}">${tile(p)}<div class="rvw-row-main"><p class="rvw-row-top">${stars(r.rating)}<a class="rvw-row-product" href="${productUrl(p)}">${htmlSafe(p.name)}</a></p><h3 class="rvw-row-title"><button type="button" class="rvw-row-open" data-rvw-open="${r.id}">${htmlSafe(r.title)}</button></h3><p class="rvw-row-body">${htmlSafe(r.body)}</p>${shots(r, '')}<p class="rvw-row-meta"><span>${htmlSafe(r.person)}, ${htmlSafe(r.stockist ? r.account : r.city || r.account)}</span><span>${buyer(r)} · ${day(r.date)}</span></p>${note(r)}</div><div class="rvw-row-act">${action(r)}</div></li>`;
	}

	function sentence(all) {
		const n = all.length;
		if (state.tab === 'pending')
			return n ? `${plural(n, 'review')} waiting, the oldest from ${day(all[n - 1].date)}.` : '';
		if (state.tab === 'flagged') return n ? `${plural(n, 'review')} held back until you decide.` : '';
		if (state.tab === 'published') {
			const open = all.filter((r) => !r.reply).length;
			return `${plural(n, 'review')} live in the Store${open ? `, ${open} not answered yet.` : ', all answered.'}`;
		}
		return n ? `${plural(n, 'review')} kept out of the Store.` : '';
	}

	const EMPTY = {
		pending: {
			icon: 'check2-circle',
			title: 'Nothing waiting for approval',
			text: 'New reviews show up here before they go live.',
		},
		flagged: {
			icon: 'flag',
			title: 'Nothing flagged',
			text: 'Reviews that are reported or caught by the filter wait here.',
		},
		published: { icon: 'star', title: 'No published reviews', text: 'Approved reviews show up here.' },
		hidden: { icon: 'eye-slash', title: 'Nothing hidden', text: 'Reviews you hide from the Store are kept here.' },
	};

	function render() {
		const all = REVIEWS.filter((r) => r.status === state.tab);
		shown = all.filter(matches);
		list.innerHTML = shown.map(row).join('');
		list.hidden = !shown.length;
		const filtered = state.q.trim() || state.stars !== 'all';
		summary.textContent =
			filtered && all.length ? `${shown.length} of ${plural(all.length, 'review')} match.` : sentence(all);
		summary.hidden = !summary.textContent.trim();
		empty.hidden = !!shown.length;
		if (shown.length) {
			empty.innerHTML = '';
			return;
		}
		if (state.q.trim()) {
			empty.innerHTML = window.Basalt.emptyState({
				query: state.q,
				noun: 'reviews',
				text: state.stars !== 'all' ? 'Check the spelling, or set the rating back to Every rating.' : '',
			});
		} else if (filtered && all.length) {
			empty.innerHTML = window.Basalt.emptyState({
				icon: 'star',
				title: 'No reviews with that rating here',
				text: 'Try another rating, or another tab.',
			});
		} else {
			empty.innerHTML = window.Basalt.emptyState(EMPTY[state.tab]);
		}
	}

	function refresh() {
		drawCounts();
		render();
	}

	for (const t of pickAll('[data-rvw-tab]')) {
		t.addEventListener('shown.bs.tab', () => {
			state.tab = t.getAttribute('data-rvw-tab');
			pick('#rvw-panel').setAttribute('aria-labelledby', t.id);
			render();
		});
	}

	pick('[data-rvw-search]').addEventListener('input', (e) => {
		state.q = e.target.value;
		render();
	});
	pick('[data-rvw-stars]').addEventListener('change', (e) => {
		state.stars = e.target.value;
		render();
	});

	/* Changing a review's status */
	/* Each change can be undone from its toast, which puts every field back. */
	function change(r, next, msg) {
		const before = { status: r.status, reply: r.reply, hidden: r.hidden, flag: r.flag };
		Object.assign(r, next);
		refresh();
		announce(msg.title);
		toast({
			tone: msg.tone || 'success',
			icon: msg.icon,
			title: msg.title,
			text: msg.text,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(r, before);
						refresh();
						if (drawerOpen()) drawRecord(current());
						announce('Undone');
					},
				},
			],
		});
	}

	function approve(r, reply) {
		const p = product(r);
		change(
			r,
			{ status: 'published', reply: reply ? { by: ME, date: TODAY, text: reply } : r.reply, flag: undefined },
			{
				icon: 'bi-check2-circle',
				title: `${(r.status === 'flagged' ? 'Published ' : 'Approved ') + r.account}’s review`,
				text: reply ? `It is live on ${p.name}, with your reply under it.` : `It is live on ${p.name}.`,
			},
		);
	}
	function hide(r) {
		change(
			r,
			{ status: 'hidden', hidden: { reason: r.flag ? r.flag.reason : `Hidden by ${ME}`, by: ME, date: TODAY } },
			{
				tone: 'info',
				icon: 'bi-eye-slash',
				title: `Hid ${r.account}’s review`,
				text: 'It is no longer shown in the Store.',
			},
		);
	}
	function restore(r) {
		change(
			r,
			{ status: 'published', hidden: undefined },
			{
				icon: 'bi-arrow-counterclockwise',
				title: `Restored ${r.account}’s review`,
				text: `It is live on ${product(r).name} again.`,
			},
		);
	}

	list.addEventListener('click', (e) => {
		const a = e.target.closest('[data-rvw-approve]');
		if (a) {
			approve(find(a.getAttribute('data-rvw-approve')));
			return;
		}
		const s = e.target.closest('[data-rvw-restore]');
		if (s) {
			restore(find(s.getAttribute('data-rvw-restore')));
			return;
		}
		const o = e.target.closest('[data-rvw-open]');
		if (o) openReview(o.getAttribute('data-rvw-open'), o.getAttribute('data-rvw-focus'));
	});

	/* Drawer */
	const drawer = pick('#rvw-review');
	const body = pick('[data-rvw-r="body"]', drawer);
	const foot = pick('[data-rvw-r="foot"]', drawer);
	let recordIds = [];
	let at = 0;
	let editing = false;

	function current() {
		return find(recordIds[at]);
	}

	function drawerOpen() {
		return drawer.classList.contains('show');
	}

	function statePills(r) {
		const pill = {
			pending: '<span class="basalt-status basalt-status-dot basalt-status-warning">Waiting for approval</span>',
			flagged:
				'<span class="basalt-status basalt-status-danger"><i class="bi bi-flag" aria-hidden="true"></i>Flagged</span>',
			published: '<span class="basalt-status basalt-status-dot basalt-status-success">Live in the Store</span>',
			hidden: '<span class="basalt-status basalt-status-dot">Hidden</span>',
		}[r.status];
		const verified =
			r.order || r.plan
				? `<span class="basalt-status"><i class="bi bi-patch-check" aria-hidden="true"></i>${buyer(r)}</span>`
				: '<span class="basalt-status">No Store order</span>';
		let alert = '';
		if (r.status === 'flagged')
			alert = `<p class="rvw-alert rvw-alert-danger"><i class="bi bi-flag" aria-hidden="true"></i><span><strong>${htmlSafe(r.flag.reason)}.</strong> ${htmlSafe(r.flag.by)}. Buyers don’t see it until you publish it.</span></p>`;
		if (r.status === 'hidden')
			alert = `<p class="rvw-alert"><i class="bi bi-eye-slash" aria-hidden="true"></i><span><strong>${htmlSafe(r.hidden.reason)}</strong> Hidden by ${htmlSafe(r.hidden.by)} on ${htmlSafe(r.hidden.date)}.</span></p>`;
		return `<div class="rvw-r-state"><div class="rvw-r-pills">${pill}${verified}</div>${alert}</div>`;
	}

	function replyHtml(r) {
		const open =
			r.status === 'pending' || r.status === 'flagged' || (r.status === 'published' && (!r.reply || editing));
		let html = `<section class="basalt-drawer-section" aria-labelledby="rvw-r-reply"><h3 class="basalt-drawer-legend" id="rvw-r-reply">Public reply</h3>`;
		if (open) {
			const optional = r.status !== 'published';
			html += `<label class="visually-hidden" for="rvw-reply-text">Reply to ${htmlSafe(first(r.person))}</label><textarea class="form-control" id="rvw-reply-text" rows="4" aria-describedby="rvw-reply-hint rvw-reply-error" placeholder="Thank ${htmlSafe(first(r.person))} and say what happens next">${editing && r.reply ? htmlSafe(r.reply.text) : ''}</textarea><div class="form-text" id="rvw-reply-hint">${optional ? 'Optional. Posted under the review when it goes live.' : 'Posted under the review, signed Marlo.'}</div><div class="invalid-feedback" id="rvw-reply-error">Write a reply before posting it.</div>`;
		} else if (r.reply) {
			html += `<blockquote class="rvw-quote rvw-quote-reply"><p>${htmlSafe(r.reply.text)}</p><footer class="rvw-quote-by">${htmlSafe(r.reply.by)}, ${htmlSafe(r.reply.date)}</footer></blockquote>`;
		} else {
			html += '<p class="rvw-muted mb-0">No reply was posted.</p>';
		}
		return `${html}</section>`;
	}

	function drawRecord(r) {
		const p = product(r);
		const t = pick('[data-rvw-r="tile"]', drawer);
		t.className = `rvw-tile rvw-tile-${p.tone}`;
		t.innerHTML = `<i class="bi ${p.icon}"></i>`;
		pick('[data-rvw-r="title"]', drawer).textContent = p.name;
		pick('[data-rvw-r="sub"]', drawer).textContent = `${r.id} · ${day(r.date)}`;

		const order = r.order
			? `<div><dt>Order</dt><dd><a href="order-details.html?id=${encodeURIComponent(r.order.no)}">${htmlSafe(r.order.no)}</a><span class="rvw-muted d-block">${r.order.qty} × ${htmlSafe(p.name)}, delivered ${htmlSafe(r.order.delivered)}</span></dd></div>`
			: r.plan
				? `<div><dt>Member</dt><dd>${htmlSafe(r.plan)}</dd></div>`
				: '<div><dt>Order</dt><dd>No Store order found for this reviewer</dd></div>';

		body.innerHTML = `${statePills(r)}<section class="basalt-drawer-section" aria-labelledby="rvw-r-text"><h3 class="basalt-drawer-legend" id="rvw-r-text">Review</h3><blockquote class="rvw-quote"><p class="rvw-quote-top">${stars(r.rating)}<span>${r.rating} out of 5</span></p><p class="rvw-quote-title">${htmlSafe(r.title)}</p><p>${htmlSafe(r.body)}</p></blockquote>${shots(r, 'rvw-shots-lg')}</section><section class="basalt-drawer-section" aria-labelledby="rvw-r-from"><h3 class="basalt-drawer-legend" id="rvw-r-from">From</h3><dl class="rvw-facts"><div><dt>Product</dt><dd><a href="${productUrl(p)}">${htmlSafe(p.name)}</a></dd></div>${r.stockist ? `<div><dt>Reviewer</dt><dd>${htmlSafe(r.person)}, buyer</dd></div>` : r.city ? `<div><dt>Lives in</dt><dd>${htmlSafe(r.city)}</dd></div>` : `<div><dt>Reviewer</dt><dd>${htmlSafe(r.person)}</dd></div>`}<div><dt>${r.stockist ? 'Stockist' : 'Shopper'}</dt><dd>${customerHtml(r)}${r.stockist ? `, ${htmlSafe(r.city)}` : ''}</dd></div>${order}<div><dt>Received</dt><dd>${day(r.date)} 2026, ${r.time}</dd></div></dl></section>${replyHtml(r)}`;
		body.scrollTop = 0;

		const hideBtn =
			'<button type="button" class="btn btn-outline-secondary" data-rvw-do="hide"><i class="bi bi-eye-slash me-1" aria-hidden="true"></i>Hide</button>';
		if (r.status === 'pending')
			foot.innerHTML = `${hideBtn}<button type="button" class="btn btn-primary" data-rvw-do="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Approve</button>`;
		else if (r.status === 'flagged')
			foot.innerHTML = `${hideBtn}<button type="button" class="btn btn-primary" data-rvw-do="approve"><i class="bi bi-check2 me-1" aria-hidden="true"></i>Publish</button>`;
		else if (r.status === 'hidden')
			foot.innerHTML =
				'<button type="button" class="btn btn-primary" data-rvw-do="restore"><i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Restore</button>';
		else if (editing)
			foot.innerHTML =
				'<button type="button" class="btn btn-outline-secondary" data-rvw-do="cancel">Cancel</button><button type="button" class="btn btn-primary" data-rvw-do="reply"><i class="bi bi-send me-1" aria-hidden="true"></i>Save reply</button>';
		else if (r.reply)
			foot.innerHTML = `${hideBtn}<button type="button" class="btn btn-primary" data-rvw-do="edit"><i class="bi bi-pencil me-1" aria-hidden="true"></i>Edit reply</button>`;
		else
			foot.innerHTML = `${hideBtn}<button type="button" class="btn btn-primary" data-rvw-do="reply"><i class="bi bi-send me-1" aria-hidden="true"></i>Post reply</button>`;
	}

	function navTo(i, dir) {
		at = (i + recordIds.length) % recordIds.length;
		editing = false;
		drawRecord(current());
		pick('[data-basalt-record-pos]', drawer).textContent = `${at + 1} of ${recordIds.length}`;
		drawer.classList.toggle('is-back', dir < 0);
	}
	let focusReply = false;
	function openReview(id, focus) {
		recordIds = shown.map((r) => r.id);
		if (!recordIds.includes(id)) recordIds = [id];
		navTo(recordIds.indexOf(id));
		focusReply = focus === 'reply';
		bootstrap.Offcanvas.getOrCreateInstance(drawer).show();
	}
	drawer.addEventListener('shown.bs.offcanvas', () => {
		if (!focusReply) return;
		focusReply = false;
		const ta = pick('#rvw-reply-text', body);
		if (ta) ta.focus();
	});
	pick('[data-basalt-record-prev]', drawer).addEventListener('click', () => navTo(at - 1, -1));
	pick('[data-basalt-record-next]', drawer).addEventListener('click', () => navTo(at + 1, 1));
	drawer.addEventListener('keydown', (e) => {
		if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
		e.preventDefault();
		navTo(at + (e.key === 'ArrowUp' ? -1 : 1), e.key === 'ArrowUp' ? -1 : 1);
	});
	body.addEventListener('input', (e) => {
		if (e.target.id !== 'rvw-reply-text') return;
		e.target.classList.remove('is-invalid');
		e.target.removeAttribute('aria-invalid');
	});

	/* After a decision the drawer moves on to the next review still in the
     same queue, or closes when the queue is done. */
	function moveOn(r, was) {
		const left = recordIds.filter((id) => id !== r.id && find(id).status === was);
		if (!left.length) {
			bootstrap.Offcanvas.getOrCreateInstance(drawer).hide();
			return;
		}
		recordIds = left;
		navTo(Math.min(at, left.length - 1), 1);
	}

	foot.addEventListener('click', (e) => {
		const b = e.target.closest('[data-rvw-do]');
		if (!b) return;
		const r = current();
		const was = r.status;
		const ta = pick('#rvw-reply-text', body);
		const text = ta ? ta.value.trim() : '';
		const act = b.getAttribute('data-rvw-do');
		if (act === 'approve') {
			approve(r, text);
			moveOn(r, was);
		} else if (act === 'hide') {
			hide(r);
			moveOn(r, was);
		} else if (act === 'restore') {
			restore(r);
			moveOn(r, was);
		} else if (act === 'edit') {
			editing = true;
			drawRecord(r);
			pick('#rvw-reply-text', body).focus();
		} else if (act === 'cancel') {
			editing = false;
			drawRecord(r);
		} else if (act === 'reply') {
			if (!text) {
				ta.classList.add('is-invalid');
				ta.setAttribute('aria-invalid', 'true');
				ta.focus();
				return;
			}
			const edited = !!r.reply;
			editing = false;
			change(
				r,
				{ reply: { by: ME, date: TODAY, text } },
				{
					icon: 'bi-reply',
					title: (edited ? 'Updated your reply to ' : 'Replied to ') + r.account,
					text: `Buyers see it under the review on ${product(r).name}.`,
				},
			);
			drawRecord(r);
		}
		/* The clicked button was redrawn, so keep focus in the open drawer
       (Escape and the arrow keys still work there). */
		if (drawerOpen() && !drawer.contains(document.activeElement)) drawer.focus({ preventScroll: true });
	});

	/* Rating summary */
	const total = DISTRIBUTION.reduce((s, d) => s + d[1], 0);
	const most = Math.max(...DISTRIBUTION.map((d) => d[1]));
	pick('[data-rvw-dist]').innerHTML = DISTRIBUTION.map((d) => {
		const tone = d[0] >= 4 ? 'good' : d[0] === 3 ? 'mid' : 'low';
		return `<li class="rvw-dist-row"><span class="rvw-dist-label">${d[0]} <i class="bi bi-star-fill" aria-hidden="true"></i><span class="visually-hidden"> stars</span></span><span class="rvw-dist-track" aria-hidden="true"><span class="rvw-dist-bar rvw-dist-bar-${tone}" style="--rvw-w:${((d[1] / most) * 100).toFixed(1)}%"></span></span><span class="rvw-dist-count">${d[1].toLocaleString('en-US')}</span><span class="rvw-dist-pct">${Math.round((d[1] / total) * 100)}%</span></li>`;
	}).join('');

	/* The five lowest-rated products; the rest are summed up underneath. */
	const ranked = Object.keys(PRODUCTS)
		.map((k) => PRODUCTS[k])
		.sort((a, b) => a.rating - b.rating || b.reviews - a.reviews);
	const low = ranked.slice(0, 5);
	pick('[data-rvw-ranked]').innerHTML = low
		.map(
			(p) =>
				`<li class="rvw-ranked-row">${tile(p)}<span class="rvw-ranked-name"><a href="${productUrl(p)}">${htmlSafe(p.name)}</a><span class="rvw-ranked-sub">${plural(p.reviews, 'review')}</span></span><span class="rvw-ranked-score">${p.rating.toFixed(1)} <i class="bi bi-star-fill" aria-hidden="true"></i><span class="visually-hidden"> out of 5</span></span></li>`,
		)
		.join('');
	const rest = ranked.length - low.length;
	pick('[data-rvw-ranked-note]').textContent =
		`${rest} more products, all rated ${ranked[low.length].rating.toFixed(1)} or higher.`;

	/* Ask for reviews */
	const ask = pick('#rvw-ask');
	const askForm = pick('[data-rvw-ask-form]', ask);
	const askProduct = pick('[data-rvw-a="product"]', ask);
	const askMessage = pick('[data-rvw-a="message"]', ask);
	const askSum = pick('[data-rvw-a="sum"]', ask);
	const askSend = pick('[data-rvw-a="send"]', ask);
	const askDefault = askMessage.value;
	askProduct.insertAdjacentHTML(
		'beforeend',
		Object.keys(PRODUCTS)
			.map((k) => `<option value="${k}">${htmlSafe(PRODUCTS[k].name)}</option>`)
			.join(''),
	);

	function askCount() {
		const when = +(pick('input[name="rvwAskWhen"]:checked', ask) || { value: 0 }).value;
		const skus = askProduct.value === 'all' ? Object.keys(ASKABLE) : [askProduct.value];
		return skus.reduce((s, k) => s + ASKABLE[k][when], 0);
	}
	function drawAsk() {
		const n = askCount();
		askSum.innerHTML = n
			? `Goes to <strong>${plural(n, 'buyer')}</strong>. Nobody is asked twice about the same product.`
			: 'No buyers to ask about this product in that time.';
		askSend.disabled = !n;
	}
	start();
})();
