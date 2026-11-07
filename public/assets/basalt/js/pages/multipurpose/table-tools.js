/**
 * Drives the seven demo tables on table-tools.html. Every table is a
 * stock Bootstrap .table whose <tbody> is rebuilt from a small state
 * object: the order ledger, the filtered customer directory, the price
 * editor, the front page ranking, expandable subscriptions, grouped
 * invoices and the catalog with column controls. No plugins are used.
 */
(() => {
	'use strict';

	const host = pick('[data-tadv-root]');
	if (!host) return;

	const ONE_DAY_MS = 86400000;
	const midnight = new Date();
	midnight.setHours(0, 0, 0, 0);

	/* The generator starts from the same number every time, so a reload
     always shows the same orders, customers and invoices. */
	let generatorState = 7;

	const asDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
	const asDayMonth = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
	const asFullDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	const asMonthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

	const HTML_ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	/* Shoppers of the Marlo store, paired with the local part of their email. */
	const SHOPPERS = [
		['Sandra Franklin', 'sandra.f'],
		['Leslie Whitlock', 'leslie.w'],
		['Phyllis Delaney', 'phyllis'],
		['Travis Daugherty', 'travis.d'],
		['Patricia Pemberton', 'patricia'],
		['Benjamin Hartley', 'ben.h'],
		['Cheryl Sorensen', 'cheryl.s'],
		['Sabrina Kavanagh', 'sabrina'],
		['Eleanor Fairweather', 'eleanor'],
		['Iva Blackwood', 'iva.b'],
		['Rodney Forbes', 'rodney'],
		['Christopher Vance', 'chris.v'],
		['Georgia Webster', 'georgia'],
		['Abigail Montgomery', 'abigail'],
		['Rochelle Fairbanks', 'ros.f'],
		['Annika Greenwood', 'annika'],
		['Rebecca MacKinnon', 'becca.m'],
		['Francis Pennington', 'francis.p'],
		['Maureen Fitzgerald', 'maureen'],
		['Candace Carpenter', 'candace.c'],
		['Jackie Blackburn', 'jackie'],
		['Penelope Bradford', 'penny.ar'],
		['Beatrice Hollings', 'bea.h'],
		['Fiona MacAllister', 'fiona.m'],
		['Jennifer McDaniel', 'jennifer'],
		['Evangeline Ainsworth', 'evie.t'],
		['Valerie Richards', 'valerie'],
		['Theodora Stafford', 'theo.sw'],
		['Caitlin Fitzpatrick', 'caitlin'],
		['Caroline Flowers', 'caroline'],
	];

	/* What an order line can contain, with the shelf price of each piece. */
	const SHELF = [
		['Sculpted Shoulder Blazer', 1290],
		['Draped Column Gown', 2150],
		['Tiered Organza Dress', 1680],
		['Chalk-Stripe Suit', 2450],
		['Leather Trench Coat', 3200],
		['Bar Loafers', 790],
		['Two-Tone Oxfords', 850],
		['Cat-Eye Sunglasses', 465],
		['Shield Sunglasses', 520],
		['Private Styling Session', 650],
	];

	const ORDER_TONES = { Paid: 'info', Packed: 'wait', Shipped: 'ok', Refunded: 'bad' };

	/** Sets the sticky offset, then mounts each table in the order the data is drawn. */
	function start() {
		trackTopBarHeight();
		const ledger = buildOrderLedger();
		mountOrderLedger(ledger);
		mountCustomerDirectory();
		mountPriceEditor();
		mountFrontPageRanking();
		mountSubscriptions();
		mountInvoiceGroups();
		mountCatalogColumns();
		mountKindFilter();
	}

	/* Sticky headers have to clear the top bar, whose height can change. */
	function trackTopBarHeight() {
		const bar = pick('.basalt-topbar');

		function publish() {
			const pinned = bar && getComputedStyle(bar).position !== 'static';
			host.style.setProperty('--tadv-top', `${pinned ? Math.floor(bar.getBoundingClientRect().height) : 0}px`);
		}

		publish();
		if (bar && 'ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(publish)).observe(bar);
	}

	/* Order history: search, status filter, sorting, paging and row checks. */
	function mountOrderLedger(ledger) {
		const card = pick('#tadv-orders', host);
		if (!card) return;

		const ledgerTable = hook(card, 'orders-table');
		const rowsHost = hook(card, 'orders-body');
		const [searchBox, statusPicker, pageSizePicker] = ['search', 'status', 'size'].map((part) =>
			pick(`#tadv-orders-${part}`, card),
		);
		const summary = hook(card, 'orders-count');
		const rangeNote = hook(card, 'orders-range');
		const pager = hook(card, 'orders-pages');
		const headerBox = hook(card, 'orders-all');
		const selectionBar = hook(card, 'orders-bulk');
		const selectionNote = hook(card, 'orders-selected');

		const sorting = { column: 'date', direction: 'desc' };
		const query = { text: '', status: '' };
		const paging = { current: 1, perPage: 10 };
		const checked = new Set();
		let pageRows = [];
		let typingTimer;

		rowsHost.addEventListener('change', (event) => {
			const row = event.target.closest('tr[data-id]');
			if (!row) return;
			if (event.target.checked) checked.add(row.dataset.id);
			else checked.delete(row.dataset.id);
			paintSelection();
		});

		headerBox.addEventListener('change', () => {
			for (const order of pageRows) {
				if (headerBox.checked) checked.add(order.id);
				else checked.delete(order.id);
			}
			paintSelection();
		});

		searchBox.addEventListener('input', () => {
			clearTimeout(typingTimer);
			typingTimer = setTimeout(() => {
				query.text = searchBox.value;
				paging.current = 1;
				redraw();
			}, 150);
		});

		statusPicker.addEventListener('change', () => {
			query.status = statusPicker.value;
			paging.current = 1;
			redraw();
		});

		pageSizePicker.addEventListener('change', () => {
			paging.perPage = Number(pageSizePicker.value);
			paging.current = 1;
			redraw();
		});

		hook(card, 'orders-ship').addEventListener('click', markCheckedShipped);
		hook(card, 'orders-export').addEventListener('click', exportChecked);
		hook(card, 'orders-clear').addEventListener('click', () => {
			checked.clear();
			paintSelection();
			headerBox.focus();
		});

		makeSortable(ledgerTable, sorting, redraw);
		redraw();

		function matchingOrders() {
			const needle = query.text.trim().toLowerCase();
			return ledger.filter((order) => {
				if (query.status && order.status !== query.status) return false;
				return !needle || `${order.id} ${order.customer} ${order.items}`.toLowerCase().includes(needle);
			});
		}

		function redraw() {
			const hits = orderBy(matchingOrders(), sorting);
			const pageCount = Math.max(1, Math.ceil(hits.length / paging.perPage));
			paging.current = Math.min(Math.max(1, paging.current), pageCount);
			const offset = (paging.current - 1) * paging.perPage;
			pageRows = hits.slice(offset, offset + paging.perPage);

			if (hits.length) rowsHost.innerHTML = pageRows.map(orderRowMarkup).join('');
			else showNoMatches();

			const everyOrder = ledger.length;
			summary.textContent =
				hits.length === everyOrder
					? countOf(everyOrder, 'order')
					: `${hits.length} of ${countOf(everyOrder, 'order')} match`;
			rangeNote.textContent = hits.length
				? `${offset + 1}–${offset + pageRows.length} of ${countOf(hits.length, 'order')}`
				: 'No orders to show';

			drawPager(pageCount);
			paintSelection();
		}

		function orderRowMarkup(order) {
			const safeId = htmlSafe(order.id);
			const cells = [
				td(
					'tadv-check',
					`<input class="form-check-input" type="checkbox" aria-label="Select order ${safeId}">`,
				),
				td('', mono(safeId)),
				td('', strong(htmlSafe(order.customer))),
				td('', subLine(htmlSafe(order.items))),
				td('tadv-num', asDayMonth.format(order.date)),
				td('text-end tadv-num', strong(asDollars.format(order.total))),
				td('', tonePill(order.status, ORDER_TONES[order.status])),
			];
			return `<tr data-id="${safeId}">${cells.join('')}</tr>`;
		}

		function showNoMatches() {
			rowsHost.innerHTML =
				'<tr><td colspan="7" class="tadv-empty">No orders match these filters.<br><button type="button" class="btn btn-sm btn-outline-secondary" data-orders-reset>Clear search and filter</button></td></tr>';
			pick('[data-orders-reset]', rowsHost).addEventListener('click', () => {
				searchBox.value = '';
				statusPicker.value = '';
				query.text = '';
				query.status = '';
				redraw();
				searchBox.focus();
			});
		}

		function drawPager(pageCount) {
			const here = paging.current;
			const slots = [];
			for (let number = 1; number <= pageCount; number += 1) {
				const worthShowing =
					pageCount <= 7 || number === 1 || number === pageCount || Math.abs(number - here) <= 1;
				if (worthShowing) slots.push(number);
				else if (slots.at(-1) !== 0) slots.push(0);
			}

			const items = [
				pagerItem('<i class="bi bi-chevron-left" aria-hidden="true"></i>', here - 1, {
					disabled: here === 1,
					aria: 'Previous page',
				}),
			];
			for (const number of slots) {
				items.push(
					number === 0
						? pagerItem('', 0, { gap: true })
						: pagerItem(String(number), number, { active: number === here, aria: `Page ${number}` }),
				);
			}
			items.push(
				pagerItem('<i class="bi bi-chevron-right" aria-hidden="true"></i>', here + 1, {
					disabled: here === pageCount,
					aria: 'Next page',
				}),
			);

			pager.replaceChildren(...items);
		}

		/**
		 * One <li> for the pager. `flags` may carry active, disabled, gap (an
		 * ellipsis that is not a button) and aria (the button's spoken name).
		 */
		function pagerItem(content, destination, flags) {
			const classes = [
				'page-item',
				flags.active && 'active',
				flags.disabled && 'disabled',
				flags.gap && 'disabled tadv-gap',
			];
			const item = make('li', { className: classes.filter(Boolean).join(' ') });

			if (flags.gap) {
				item.innerHTML = '<span class="page-link" aria-hidden="true">…</span>';
				return item;
			}

			const button = make('button', {
				type: 'button',
				className: 'page-link',
				innerHTML: content,
				disabled: Boolean(flags.disabled),
			});
			if (flags.aria) button.setAttribute('aria-label', flags.aria);
			if (flags.active) button.setAttribute('aria-current', 'page');
			button.addEventListener('click', () => {
				paging.current = destination;
				redraw();
				refocusPager(flags.aria);
			});
			item.append(button);
			return item;
		}

		/* The pager was rebuilt, so focus returns to the same control, or to
       the current page once that control has become disabled. */
		function refocusPager(spokenName) {
			const sameControl = spokenName ? pick(`[aria-label="${spokenName}"]:not(:disabled)`, pager) : null;
			(sameControl || pick('[aria-current="page"]', pager))?.focus();
		}

		function paintSelection() {
			const total = checked.size;
			selectionBar.hidden = total === 0;
			selectionNote.textContent = `${countOf(total, 'order')} selected`;

			const checkedHere = pageRows.filter((order) => checked.has(order.id)).length;
			headerBox.checked = pageRows.length > 0 && checkedHere === pageRows.length;
			headerBox.indeterminate = checkedHere > 0 && checkedHere < pageRows.length;

			for (const row of pickAll('tr[data-id]', rowsHost)) {
				const isChecked = checked.has(row.dataset.id);
				row.classList.toggle('table-active', isChecked);
				pick('input', row).checked = isChecked;
			}
		}

		function markCheckedShipped() {
			const settled = new Set(['Shipped', 'Refunded']);
			let shippedNow = 0;
			for (const order of ledger) {
				if (!checked.has(order.id) || settled.has(order.status)) continue;
				order.status = 'Shipped';
				shippedNow += 1;
			}

			checked.clear();
			redraw();
			summary.textContent = shippedNow
				? `${countOf(shippedNow, 'order')} marked as shipped`
				: 'Those orders were already shipped or refunded';
		}

		function exportChecked() {
			const csvRows = [['Order', 'Customer', 'Items', 'Date', 'Total', 'Status']];
			for (const order of ledger) {
				if (!checked.has(order.id)) continue;
				csvRows.push([
					order.id,
					order.customer,
					order.items,
					order.date.toISOString().slice(0, 10),
					order.total.toFixed(2),
					order.status,
				]);
			}
			saveTextFile('orders.csv', csvRows.map((line) => line.map(quoteCsv).join(',')).join('\r\n'), 'text/csv');
		}

		function quoteCsv(value) {
			return `"${String(value).replace(/"/g, '""')}"`;
		}
	}

	/* Customer directory: every column has its own filter, and the list grows a batch at a time. */
	function mountCustomerDirectory() {
		const card = pick('#tadv-customers', host);
		if (!card) return;

		const directoryTable = hook(card, 'cust-grid');
		const rowsHost = hook(card, 'cust-body');
		const summary = hook(card, 'cust-count');
		const moreFooter = hook(card, 'cust-more');
		const moreButton = hook(card, 'cust-more-btn');
		const cityPicker = pick('[data-cf="city"]', card);

		const BATCH = 12;
		const TOWNS = [
			'Phoenix',
			'Columbus',
			'Concord',
			'Tampa',
			'Minneapolis',
			'Sacramento',
			'Raleigh',
			'Kansas City',
		];
		const TIERS = ['Member', 'Member', 'Standard', 'Standard', 'Insider'];
		const TIER_TONES = { Member: 'info', Standard: 'quiet', Insider: 'ok' };

		/* Tier decides how often someone orders and how big a basket is. */
		const HABITS = {
			Insider: () => [12 + Math.floor(nextRandom() * 30), 900 + nextRandom() * 2000],
			Member: () => [4 + Math.floor(nextRandom() * 20), 180 + nextRandom() * 520],
			Standard: () => [1 + Math.floor(nextRandom() * 6), 60 + nextRandom() * 240],
		};

		/* Each test answers whether one customer passes one column filter. */
		const PASSES = {
			name: (person, value) =>
				!value || `${person.name} ${person.email}`.toLowerCase().includes(value.trim().toLowerCase()),
			plan: (person, value) => !value || person.plan === value,
			city: (person, value) => !value || person.city === value,
			orders: (person, value) => person.orders >= Number(value),
			spend: (person, value) => person.spend >= Number(value),
			last: (person, value) => Number(value) === 0 || person.daysSince <= Number(value),
		};

		const people = SHOPPERS.map(([name, handle]) => describeShopper(name, handle));
		const sorting = { column: 'spend', direction: 'desc' };
		let revealed = BATCH;
		let typingTimer;

		const towns = [...new Set(people.map((person) => person.city))].sort();
		cityPicker.append(...towns.map((town) => make('option', { textContent: town })));

		const controls = [...pickAll('[data-cf]', card)];
		for (const control of controls) {
			const typed = control.tagName === 'INPUT';
			control.addEventListener(typed ? 'input' : 'change', () => {
				clearTimeout(typingTimer);
				typingTimer = setTimeout(
					() => {
						revealed = BATCH;
						redraw();
					},
					typed ? 150 : 0,
				);
			});
		}

		hook(card, 'cust-clear').addEventListener('click', () => {
			for (const control of controls) {
				control.value = control.tagName === 'INPUT' ? '' : control.options[0].value;
			}
			redraw();
		});

		moreButton.addEventListener('click', () => {
			const firstNew = revealed;
			revealed += BATCH;
			window.Basalt.slide(directoryTable.parentElement, redraw);
			/* Send focus to the first row that just appeared, without jumping the page. */
			const landing = rowsHost.rows[firstNew];
			if (landing) {
				landing.tabIndex = -1;
				landing.focus({ preventScroll: true });
			}
		});

		makeSortable(directoryTable, sorting, redraw);
		redraw();

		/* Standard shoppers can go months between orders; the others shop within weeks. */
		function describeShopper(name, handle) {
			const plan = pickOne(TIERS);
			const [orderCount, averageBasket] = HABITS[plan]();
			const daysSince = Math.floor(nextRandom() * (plan === 'Standard' ? 160 : 40));
			const domain = name
				.split(' ')
				.pop()
				.toLowerCase()
				.replace(/[^a-z]/g, '');
			return {
				name,
				email: `${handle}@${domain}.com`,
				plan,
				city: pickOne(TOWNS),
				orders: orderCount,
				spend: Math.round(orderCount * averageBasket * 100) / 100,
				daysSince,
				last: daysBefore(daysSince),
			};
		}

		function redraw() {
			const kept = people.filter((person) =>
				controls.every((control) => PASSES[control.dataset.cf](person, control.value)),
			);
			const ordered = orderBy(kept, sorting);
			const leftOver = ordered.length - revealed;

			moreFooter.hidden = leftOver <= 0;
			moreButton.textContent = `Show ${countOf(Math.min(BATCH, leftOver), 'more customer')}`;

			rowsHost.innerHTML = ordered.length
				? ordered.slice(0, revealed).map(customerRowMarkup).join('')
				: '<tr><td colspan="6" class="tadv-empty">No customers match every filter. Try loosening one.</td></tr>';

			summary.textContent =
				ordered.length === people.length
					? countOf(people.length, 'customer')
					: `${ordered.length} of ${countOf(people.length, 'customer')}`;
		}

		function customerRowMarkup(person) {
			const lastSeen = person.daysSince === 0 ? 'Today' : asFullDate.format(person.last);
			const cells = [
				td('', strong(htmlSafe(person.name)) + subLine(htmlSafe(person.email))),
				td('', tonePill(person.plan, TIER_TONES[person.plan])),
				td('', htmlSafe(person.city)),
				td('text-end tadv-num', person.orders),
				td('text-end tadv-num', strong(asDollars.format(person.spend))),
				td('tadv-num', lastSeen),
			];
			return `<tr>${cells.join('')}</tr>`;
		}
	}

	/* Price list: cells turn into inputs, and edits stay a draft until Save. */
	function mountPriceEditor() {
		const card = pick('#tadv-pricelist', host);
		if (!card) return;

		const rowsHost = hook(card, 'prices-body');
		const statusLine = hook(card, 'prices-status');
		const saveButton = hook(card, 'prices-save');
		const discardButton = hook(card, 'prices-discard');

		const SECTIONS = ['Clothing', 'Accessories'];
		const LOW_STOCK = 12;
		const EDITABLE = {
			cat: { label: 'Category', display: (value) => value },
			price: { label: 'Price', display: (value) => asDollars.format(value) },
			stock: { label: 'Units in stock', display: (value) => String(value) },
		};

		let saved = [
			{ name: 'Sculpted Shoulder Blazer', code: 'ML-BLAZ', cat: 'Clothing', price: 1290, stock: 42 },
			{ name: 'Draped Column Gown', code: 'ML-GOWN', cat: 'Clothing', price: 2150, stock: 8 },
			{ name: 'Tiered Organza Dress', code: 'ML-ORGZ', cat: 'Clothing', price: 1680, stock: 57 },
			{ name: 'Leather Trench Coat', code: 'ML-TRCH', cat: 'Clothing', price: 3200, stock: 23 },
			{ name: 'Cat-Eye Sunglasses', code: 'ML-CATE', cat: 'Accessories', price: 465, stock: 31 },
			{ name: 'Shield Sunglasses', code: 'ML-SHLD', cat: 'Accessories', price: 520, stock: 6 },
		];
		let working = cloneEach(saved);

		rowsHost.addEventListener('click', (event) => {
			const trigger = event.target.closest('.tadv-cell');
			if (trigger) beginEdit(trigger);
		});

		saveButton.addEventListener('click', () => {
			const changes = pendingChanges();
			saved = cloneEach(working);
			redraw();
			statusLine.textContent = `Saved ${countOf(changes, 'change')}`;
		});

		discardButton.addEventListener('click', () => {
			const changes = pendingChanges();
			working = cloneEach(saved);
			redraw();
			statusLine.textContent = `Discarded ${countOf(changes, 'change')}`;
		});

		redraw();

		function cloneEach(list) {
			return list.map((entry) => ({ ...entry }));
		}

		function lowStockTag(units) {
			return units < LOW_STOCK ? tonePill('Low', 'wait') : '';
		}

		function pendingChanges() {
			let changes = 0;
			for (const [index, entry] of working.entries()) {
				for (const column of Object.keys(EDITABLE)) {
					if (entry[column] !== saved[index][column]) changes += 1;
				}
			}
			return changes;
		}

		function redraw() {
			rowsHost.innerHTML = working
				.map((entry, index) => {
					const heading = rowHeading(strong(htmlSafe(entry.name)) + subLine(htmlSafe(entry.code)));
					const editable = ['cat', 'price', 'stock'].map((column) =>
						td(column === 'cat' ? '' : 'text-end', cellButton(index, column), ` data-field="${column}"`),
					);
					return `<tr>${heading}${editable.join('')}</tr>`;
				})
				.join('');
			syncSaveBar();
		}

		function cellButton(index, column) {
			const entry = working[index];
			const { label, display } = EDITABLE[column];
			const edited = entry[column] !== saved[index][column];
			const displayed = display(entry[column]);
			const spoken = `${label} for ${entry.name}: ${displayed}${edited ? ', changed' : ''}. Press Enter to edit`;
			const tag = column === 'stock' ? lowStockTag(entry.stock) : '';
			const button = `<button type="button" class="tadv-cell${edited ? ' is-dirty' : ''}" data-edit="${column}" data-row="${index}" aria-label="${htmlSafe(spoken)}"><i class="bi bi-pencil" aria-hidden="true"></i>${htmlSafe(displayed)}</button>`;
			return tag ? `${button}<span class="tadv-low">${tag}</span>` : button;
		}

		function syncSaveBar() {
			const changes = pendingChanges();
			saveButton.disabled = changes === 0;
			discardButton.disabled = changes === 0;
			statusLine.classList.toggle('is-busy', changes > 0);
			if (changes > 0) statusLine.textContent = countOf(changes, 'unsaved change');
		}

		/** Swaps one cell's button for the right control and handles commit, cancel and blur. */
		function beginEdit(trigger) {
			const index = Number(trigger.dataset.row);
			const column = trigger.dataset.edit;
			const cell = trigger.closest('td');
			const entry = working[index];
			const startValue = entry[column];
			const errorId = `tadv-fb-${index}-${column}`;

			const shell = make('div', { className: 'tadv-edit' });
			const editorFor = { cat: buildCategoryPicker, price: buildPriceInput, stock: buildStockStepper };
			const { input, extra } = editorFor[column](shell, entry);

			input.setAttribute('aria-label', `${EDITABLE[column].label} for ${entry.name}`);
			input.setAttribute('aria-describedby', errorId);
			const errorNote = make('div', { className: 'invalid-feedback', id: errorId });
			if (!input.parentElement) shell.append(input);
			shell.append(errorNote);

			cell.replaceChildren(shell);
			if (extra) wireStepper(extra);
			input.focus();
			input.select?.();

			let closed = false;

			shell.addEventListener('keydown', (event) => {
				/* Enter on a stepper button presses that button; everywhere else it commits. */
				if (event.key === 'Enter' && !event.target.matches('button')) {
					event.preventDefault();
					finishEdit(true);
				}
				if (event.key === 'Escape') {
					event.preventDefault();
					entry[column] = startValue;
					finishEdit(false);
				}
			});

			input.addEventListener('input', () => {
				input.classList.remove('is-invalid');
				input.removeAttribute('aria-invalid');
			});

			/* Leaving the editor keeps a valid value and throws away an invalid
         one. Focus moving onto a stepper button stays inside the shell. */
			shell.addEventListener('focusout', () => {
				setTimeout(() => {
					if (closed || shell.contains(document.activeElement)) return;
					if (finishEdit(true) === false) {
						closed = true;
						redraw();
					}
				}, 0);
			});

			function wireStepper(lowSlot) {
				cell.append(lowSlot);
				lowSlot.innerHTML = lowStockTag(entry.stock);
				if (window.Basalt.stepper) window.Basalt.stepper(pick('[data-basalt-stepper]', shell));
				/* Pressing + or - with the mouse leaves focus in the number box, so Enter still commits. */
				shell.addEventListener('mousedown', (event) => {
					if (event.target.closest('button')) event.preventDefault();
				});
				/* Every step counts at once: the Low tag and the unsaved count follow it. */
				input.addEventListener('change', () => {
					const units = Number(input.value);
					if (input.value === '' || !Number.isInteger(units) || units < 0) return;
					entry.stock = units;
					lowSlot.innerHTML = lowStockTag(units);
					syncSaveBar();
				});
			}

			/** Returns false when the value is rejected, true once the editor closes. */
			function finishEdit(keep) {
				if (closed) return undefined;
				if (keep && column === 'cat') {
					entry.cat = input.value;
				} else if (keep) {
					const cleaned = input.value.replace(/[$,\s]/g, '');
					const amount = Number(cleaned);
					const acceptable =
						cleaned !== '' &&
						Number.isFinite(amount) &&
						(column === 'price' ? amount >= 0.5 : Number.isInteger(amount) && amount >= 0);
					if (!acceptable) {
						input.classList.add('is-invalid');
						input.setAttribute('aria-invalid', 'true');
						errorNote.textContent =
							column === 'price' ? 'Enter a price of at least $0.50' : 'Enter a whole number of units';
						return false;
					}
					entry[column] = column === 'price' ? Math.round(amount * 100) / 100 : amount;
				}
				closed = true;
				redraw();
				pick(`[data-row="${index}"][data-edit="${column}"]`, rowsHost)?.focus();
				return true;
			}
		}

		function buildCategoryPicker(shell, entry) {
			const menu = make('select', { className: 'form-select form-select-sm' });
			for (const section of SECTIONS) {
				menu.append(make('option', { textContent: section, selected: section === entry.cat }));
			}
			return { input: menu, extra: null };
		}

		/* Money is typed, not spun, so the price gets a text box behind a $ sign. */
		function buildPriceInput(shell, entry) {
			const moneyGroup = make('div', {
				className: 'input-group input-group-sm tadv-money',
				innerHTML: '<span class="input-group-text" aria-hidden="true">$</span>',
			});
			const box = make('input', {
				type: 'text',
				inputMode: 'decimal',
				autocomplete: 'off',
				className: 'form-control',
				value: entry.price.toFixed(2),
			});
			moneyGroup.append(box);
			shell.append(moneyGroup);
			return { input: box, extra: null };
		}

		/* Stock is a count, so it borrows the shared plus and minus stepper. */
		function buildStockStepper(shell, entry) {
			const stepper = make('div', { className: 'basalt-stepper basalt-stepper-sm' });
			stepper.setAttribute('data-basalt-stepper', '');
			const fewer = htmlSafe(`One fewer ${entry.name}`);
			const more = htmlSafe(`One more ${entry.name}`);
			stepper.innerHTML =
				`<button type="button" class="basalt-stepper-btn" data-basalt-step="-1" aria-label="${fewer}"><i class="bi bi-dash-lg" aria-hidden="true"></i></button>` +
				`<input type="number" class="basalt-stepper-input" min="0" max="999" step="1" inputmode="numeric" value="${entry.stock}">` +
				`<button type="button" class="basalt-stepper-btn" data-basalt-step="1" aria-label="${more}"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>`;
			shell.append(stepper);
			return { input: pick('input', stepper), extra: make('span', { className: 'tadv-low' }) };
		}
	}

	/* Front page order: rows move by drag and drop or by their arrow buttons. */
	function mountFrontPageRanking() {
		const card = pick('#tadv-rank', host);
		if (!card) return;

		const rowsHost = hook(card, 'rank-body');
		const statusLine = hook(card, 'rank-status');
		const BY_UNITS = [
			{ name: 'Sculpted Shoulder Blazer', kind: 'Clothing', sold: 184 },
			{ name: 'Cat-Eye Sunglasses', kind: 'Accessories', sold: 162 },
			{ name: 'Aftercare Plan, monthly', kind: 'Extras', sold: 141 },
			{ name: 'Tiered Organza Dress', kind: 'Clothing', sold: 118 },
			{ name: 'Chalk-Stripe Suit', kind: 'Clothing', sold: 97 },
			{ name: 'Express Delivery Pass', kind: 'Extras', sold: 64 },
		];
		let lineup = [...BY_UNITS];
		let carried = null;

		rowsHost.addEventListener('click', (event) => {
			const arrow = event.target.closest('[data-move]');
			if (!arrow) return;
			const name = arrow.closest('tr').dataset.name;
			const step = Number(arrow.dataset.move);
			relocate(name, positionOf(name) + step);
			/* Focus follows the row; at either end it falls back to the opposite arrow. */
			const row = pick(`tr[data-name="${CSS.escape(name)}"]`, rowsHost);
			const sameArrow = pick(`[data-move="${step}"]`, row);
			const nextFocus = sameArrow.disabled ? pick(`[data-move="${-step}"]`, row) : sameArrow;
			nextFocus.focus();
		});

		rowsHost.addEventListener('dragstart', (event) => {
			const row = event.target.closest('tr');
			if (!row) return;
			carried = row.dataset.name;
			row.classList.add('is-dragging');
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', carried);
		});

		rowsHost.addEventListener('dragover', (event) => {
			const row = event.target.closest('tr');
			if (!carried || !row) return;
			event.preventDefault();
			for (const marked of pickAll('.is-over', rowsHost)) {
				if (marked !== row) marked.classList.remove('is-over');
			}
			row.classList.add('is-over');
		});

		rowsHost.addEventListener('dragleave', (event) => {
			const row = event.target.closest('tr');
			if (row && !row.contains(event.relatedTarget)) row.classList.remove('is-over');
		});

		rowsHost.addEventListener('drop', (event) => {
			const row = event.target.closest('tr');
			if (!carried || !row) return;
			event.preventDefault();
			relocate(carried, positionOf(row.dataset.name));
		});

		rowsHost.addEventListener('dragend', () => {
			carried = null;
			for (const marked of pickAll('.is-dragging, .is-over', rowsHost)) {
				marked.classList.remove('is-dragging', 'is-over');
			}
		});

		hook(card, 'rank-reset').addEventListener('click', () => {
			lineup = [...BY_UNITS];
			redraw();
			statusLine.textContent = 'Sorted by units sold';
		});

		redraw();

		function positionOf(name) {
			return lineup.findIndex((product) => product.name === name);
		}

		function relocate(name, destination) {
			const origin = positionOf(name);
			const outOfRange = destination < 0 || destination >= lineup.length;
			if (origin < 0 || destination === origin || outOfRange) return;
			const [product] = lineup.splice(origin, 1);
			lineup.splice(destination, 0, product);
			redraw(name);
			statusLine.textContent = `${name} is now ${ordinalOf(destination + 1)} of ${lineup.length}`;
		}

		function redraw(justMoved) {
			const lastIndex = lineup.length - 1;
			rowsHost.innerHTML = lineup
				.map((product, index) => {
					const safeName = htmlSafe(product.name);
					const rowClass = `tadv-rank-row${product.name === justMoved ? ' is-moved' : ''}`;
					const grip =
						'<span class="tadv-handle" aria-hidden="true"><i class="bi bi-grip-vertical"></i></span>';
					const arrows =
						arrowButton(safeName, -1, index === 0) + arrowButton(safeName, 1, index === lastIndex);
					const cells = [
						td('', `<span class="tadv-rank-num">${index + 1}</span>`),
						rowHeading(
							`<span class="tadv-prod">${grip}<span>${strong(safeName)}${subLine(htmlSafe(product.kind))}</span></span>`,
						),
						td('text-end tadv-num', product.sold),
						td('text-end', `<span class="tadv-move">${arrows}</span>`),
					];
					return `<tr class="${rowClass}" draggable="true" data-name="${safeName}">${cells.join('')}</tr>`;
				})
				.join('');
		}

		function arrowButton(safeName, step, atEnd) {
			const [word, icon] = step < 0 ? ['up', 'bi-arrow-up'] : ['down', 'bi-arrow-down'];
			return `<button type="button" class="tadv-icon-btn" data-move="${step}" aria-label="Move ${safeName} ${word}"${atEnd ? ' disabled' : ''}><i class="bi ${icon}" aria-hidden="true"></i></button>`;
		}
	}

	/* Account subscriptions: each row has a button that reveals a detail row beneath it. */
	function mountSubscriptions() {
		const card = pick('#tadv-subs', host);
		if (!card) return;

		const rowsHost = hook(card, 'subs-body');
		const toggleAll = hook(card, 'subs-all');
		const STATE_TONES = { Active: 'ok', Paused: 'quiet', 'Past due': 'bad' };
		const accounts = [
			{
				who: 'Oakhaven Studio',
				plan: 'Pro, 24 seats',
				cycle: 'monthly',
				renewsIn: 3,
				status: 'Active',
				address: '2140 Tannery Way, Phoenix AZ',
				addons: 'Travel Planner',
				ageDays: 410,
				note: 'Adding a second weekend team in November.',
			},
			{
				who: 'Larchwood Studios',
				plan: 'Max, 86 seats',
				cycle: 'annually',
				renewsIn: 9,
				status: 'Active',
				address: '18 Kiln Rd, Columbus OH',
				addons: 'Customer Portal, Travel Planner',
				ageDays: 1180,
				note: 'Renewal call booked with their operations manager.',
			},
			{
				who: 'Copperleaf Design',
				plan: 'Basic, 6 seats',
				cycle: 'monthly',
				renewsIn: 14,
				status: 'Paused',
				address: '77 Elm St, Tampa FL',
				addons: 'None',
				ageDays: 90,
				note: 'Seasonal pause, crews back in March.',
			},
			{
				who: 'Avocet Robotics',
				plan: 'Pro, 15 seats',
				cycle: 'monthly',
				renewsIn: 1,
				status: 'Active',
				address: '9 Riverside Dr, Sacramento CA',
				addons: 'Customer Portal',
				ageDays: 520,
				note: '',
			},
			{
				who: 'Harborline AI',
				plan: 'Basic, 4 seats',
				cycle: 'monthly',
				renewsIn: 0,
				status: 'Past due',
				address: '31 Wharf St, Raleigh NC',
				addons: 'None',
				ageDays: 118,
				note: 'Card declined twice. The owner has been emailed.',
			},
			{
				who: 'Polaris Running Co. Group',
				plan: 'Pro, 31 seats',
				cycle: 'monthly',
				renewsIn: 6,
				status: 'Active',
				address: '5 Cedar Grove Ln, Minneapolis MN',
				addons: 'Travel Planner',
				ageDays: 150,
				note: '',
			},
		];
		const expandedRows = new Set();

		rowsHost.addEventListener('click', (event) => {
			const toggle = event.target.closest('[data-sub]');
			if (!toggle) return;
			const index = Number(toggle.dataset.sub);
			fold(index, !expandedRows.has(index));
			reflectAll();
		});

		toggleAll.addEventListener('click', () => {
			const opening = expandedRows.size !== accounts.length;
			for (const index of accounts.keys()) fold(index, opening);
			reflectAll();
		});

		hook(card, 'subs-count').textContent = countOf(accounts.length, 'subscription');
		redraw();

		function redraw() {
			rowsHost.innerHTML = accounts
				.map((account, index) => summaryRow(account, index) + detailRow(account, index))
				.join('');
			reflectAll();
		}

		/* Opens or shuts one account's detail row in place; the grid inside it slides, since a row cannot. */
		function fold(index, opening) {
			if (expandedRows.has(index) === opening) return;
			if (opening) expandedRows.add(index);
			else expandedRows.delete(index);
			const toggle = pick(`[data-sub="${index}"]`, rowsHost);
			const detail = document.getElementById(`tadv-sub-${index}`);
			toggle.setAttribute('aria-expanded', String(opening));
			toggle.closest('tr').classList.toggle('is-open', opening);
			window.Basalt.slide(pick('.tadv-detail-grid', detail), () => {
				detail.hidden = !opening;
			});
		}

		function reflectAll() {
			const everyOpen = expandedRows.size === accounts.length;
			toggleAll.textContent = everyOpen ? 'Close all' : 'Open all';
			toggleAll.setAttribute('aria-pressed', String(everyOpen));
		}

		function renewalLabel(account) {
			if (account.status === 'Paused') return 'On hold';
			return account.renewsIn === 0 ? 'Today' : asDayMonth.format(daysAfter(account.renewsIn));
		}

		function summaryRow(account, index) {
			const unfolded = expandedRows.has(index);
			const safeWho = htmlSafe(account.who);
			const toggle = `<button type="button" class="tadv-icon-btn tadv-toggle" data-sub="${index}" aria-expanded="${unfolded}" aria-controls="tadv-sub-${index}" aria-label="Details for ${safeWho}"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>`;
			const cells = [
				td('tadv-check', toggle),
				rowHeading(strong(safeWho)),
				td('', htmlSafe(account.plan) + subLine(`Billed ${htmlSafe(account.cycle)}`)),
				td('tadv-num', renewalLabel(account)),
				td('', tonePill(account.status, STATE_TONES[account.status])),
			];
			return `<tr${unfolded ? ' class="is-open"' : ''}>${cells.join('')}</tr>`;
		}

		/* The three most recent invoices step back one billing period each from the renewal. */
		function detailRow(account, index) {
			const period = account.cycle === 'annually' ? 365 : 30;
			const dateFormat = period > 30 ? asFullDate : asDayMonth;
			let invoices = '';
			for (const step of [1, 2, 3]) {
				const outcome = account.status === 'Past due' && step === 1 ? 'Failed' : 'Paid';
				invoices += `<li><span>${dateFormat.format(daysBefore(period * step - account.renewsIn))}</span><span>${outcome}</span></li>`;
			}
			const note = account.note
				? `<p class="tadv-detail-label mt-3">Note</p><p class="tadv-detail-value">${htmlSafe(account.note)}</p>`
				: '';
			return `<tr class="tadv-detail" id="tadv-sub-${index}"${expandedRows.has(index) ? '' : ' hidden'}><td colspan="5"><div class="tadv-detail-grid">${detailBlock(
				'Billing address',
				`<p class="tadv-detail-value">${htmlSafe(account.address)}</p>`,
			)}${detailBlock(
				'Add-ons and billing',
				`<p class="tadv-detail-value">${htmlSafe(account.addons)}<br>Billed ${htmlSafe(account.cycle)}</p>`,
			)}${detailBlock('Last three invoices', `<ul class="tadv-detail-list">${invoices}</ul>`)}${detailBlock(
				'Customer since',
				`<p class="tadv-detail-value">${asFullDate.format(daysBefore(account.ageDays))}</p>${note}`,
			)}</div></td></tr>`;
		}

		function detailBlock(label, body) {
			return `<div><p class="tadv-detail-label">${label}</p>${body}</div>`;
		}
	}

	/* Account invoices: one <tbody> per group, each with its own subtotal and fold button. */
	function mountInvoiceGroups() {
		const card = pick('#tadv-invoices', host);
		if (!card) return;

		const invoiceTable = hook(card, 'whs-table');
		const footer = hook(card, 'whs-foot');
		const secondHeading = hook(card, 'whs-other');
		const groupChips = [...pickAll('[data-whs-group]', card)];
		const DUE_TONES = { Paid: 'ok', Due: 'wait', Overdue: 'bad' };
		const BILLED_CLIENTS = [
			'Highpoint Outfitters',
			'Brightline Photography',
			'Lakeside Apparel',
			'Evergreen Landscaping',
		];

		const invoices = issueInvoices();
		const layout = { grouping: 'month', folded: new Set() };

		invoiceTable.addEventListener('click', (event) => {
			const fold = event.target.closest('[data-group]');
			if (!fold) return;
			const label = fold.dataset.group;
			const key = `${layout.grouping}:${label}`;
			if (layout.folded.has(key)) layout.folded.delete(key);
			else layout.folded.add(key);
			window.Basalt.slide(invoiceTable.parentElement, redraw);
			[...pickAll('[data-group]', invoiceTable)].find((button) => button.dataset.group === label)?.focus();
		});

		for (const choice of groupChips) {
			choice.addEventListener('click', () => {
				for (const other of groupChips) other.setAttribute('aria-pressed', String(other === choice));
				layout.grouping = choice.dataset.whsGroup;
				redraw();
			});
		}

		redraw();

		/* Three months of invoices, one per client per month, minus the last client this month. */
		function issueInvoices() {
			const issued = [];
			let serial = 3092;
			for (const monthsBack of [2, 1, 0]) {
				const firstOfMonth = new Date(midnight.getFullYear(), midnight.getMonth() - monthsBack, 1);
				for (const [slot, client] of BILLED_CLIENTS.entries()) {
					if (monthsBack === 0 && slot === 3) continue;
					const sent = new Date(firstOfMonth.getTime() + (3 + slot * 6) * ONE_DAY_MS);
					const due = new Date(sent.getTime() + 30 * ONE_DAY_MS);
					let status = 'Due';
					if (due < midnight) status = monthsBack === 1 && slot === 1 ? 'Overdue' : 'Paid';
					issued.push({
						id: `#${serial}`,
						buyer: client,
						issued: sent,
						due,
						status,
						amount: Math.round((900 + nextRandom() * 4200) * 100) / 100,
					});
					serial += 1;
				}
			}
			return issued;
		}

		function groupInvoices() {
			const monthly = layout.grouping === 'month';
			const ordered = [...invoices].sort(
				monthly
					? (a, b) => b.issued - a.issued
					: (a, b) => a.buyer.localeCompare(b.buyer) || b.issued - a.issued,
			);
			const bins = new Map();
			for (const invoice of ordered) {
				const label = monthly ? asMonthYear.format(invoice.issued) : invoice.buyer;
				if (!bins.has(label)) bins.set(label, []);
				bins.get(label).push(invoice);
			}
			return bins;
		}

		function redraw() {
			for (const section of pickAll('tbody', invoiceTable)) section.remove();
			secondHeading.textContent = layout.grouping === 'month' ? 'Customer' : 'Issued';

			let groupNumber = 0;
			for (const [label, members] of groupInvoices()) {
				const idStem = `tadv-inv-g${groupNumber}`;
				groupNumber += 1;
				const section = document.createElement('tbody');
				section.innerHTML =
					groupHeaderMarkup(label, members, idStem) +
					members
						.map((invoice, position) =>
							invoiceRowMarkup(
								invoice,
								`${idStem}-${position}`,
								layout.folded.has(`${layout.grouping}:${label}`),
							),
						)
						.join('');
				invoiceTable.insertBefore(section, footer);
			}

			const grandTotal = sumAmounts(invoices);
			const outstanding = sumAmounts(invoices.filter((invoice) => invoice.status !== 'Paid'));
			footer.innerHTML =
				`<tr><th scope="row" colspan="4">Total, ${countOf(invoices.length, 'invoice')}</th><td class="text-end tadv-num">${asDollars.format(grandTotal)}</td></tr>` +
				`<tr><th scope="row" colspan="4" class="fw-normal">Still to be paid</th><td class="text-end tadv-num">${asDollars.format(outstanding)}</td></tr>`;
		}

		function sumAmounts(list) {
			return list.reduce((running, invoice) => running + invoice.amount, 0);
		}

		function groupHeaderMarkup(label, members, idStem) {
			const unfolded = !layout.folded.has(`${layout.grouping}:${label}`);
			const controls = members.map((_, position) => `${idStem}-${position}`).join(' ');
			const safeLabel = htmlSafe(label);
			return (
				`<tr class="tadv-group"><th scope="rowgroup" colspan="4"><button type="button" class="tadv-group-btn" data-group="${safeLabel}" aria-expanded="${unfolded}" aria-controls="${controls}"><i class="bi bi-chevron-right" aria-hidden="true"></i>${safeLabel} <span class="tadv-group-meta">${countOf(members.length, 'invoice')}</span></button></th>` +
				`<td class="text-end tadv-num tadv-group-total">${asDollars.format(sumAmounts(members))}</td></tr>`
			);
		}

		function invoiceRowMarkup(invoice, rowId, folded) {
			const secondCell =
				layout.grouping === 'month' ? htmlSafe(invoice.buyer) : asDayMonth.format(invoice.issued);
			const cells = [
				td('', mono(htmlSafe(invoice.id))),
				td('', secondCell),
				td('tadv-num', asDayMonth.format(invoice.due)),
				td('', tonePill(invoice.status, DUE_TONES[invoice.status])),
				td('text-end tadv-num', asDollars.format(invoice.amount)),
			];
			return `<tr id="${rowId}"${folded ? ' hidden' : ''}>${cells.join('')}</tr>`;
		}
	}

	/* Clothing catalog: a column chooser, two row heights, stripes and a fade on the clipped edge. */
	function mountCatalogColumns() {
		const card = pick('#tadv-devices', host);
		if (!card) return;

		const catalogTable = hook(card, 'devices-table');
		const headRow = hook(card, 'devices-head');
		const rowsHost = hook(card, 'devices-body');
		const chooser = hook(card, 'devices-cols');
		const summary = hook(card, 'devices-count');
		const densityChips = [...pickAll('[data-devices-density]', card)];
		const scroller = catalogTable.parentElement;

		const FIELD_ORDER = ['name', 'sku', 'cat', 'price', 'cost', 'stock', 'supplier', 'lead', 'rating'];
		const catalog = [
			['Sculpted Shoulder Blazer', 'ML-BLAZ', 'Clothing', 649, 412, 42, 'Hollis Atelier', 21, 4.7],
			['Draped Column Gown', 'ML-GOWN', 'Clothing', 429, 268, 8, 'Hollis Atelier', 21, 4.5],
			['Tiered Organza Dress', 'ML-ORGZ', 'Clothing', 119, 64, 57, 'Calder Couture', 14, 4.4],
			['Chalk-Stripe Suit', 'ML-SUIT', 'Clothing', 189, 108, 19, 'Willamette Tailors', 10, 4.3],
			['Leather Trench Coat', 'ML-TRCH', 'Clothing', 149, 86, 23, 'Willamette Tailors', 12, 4.6],
			['Bar Loafers', 'ML-LOAF', 'Clothing', 59, 31, 74, 'Marlo', 12, 4.8],
			['Two-Tone Oxfords', 'ML-OXFD', 'Accessories', 49, 22, 96, 'Marlo', 7, 4.6],
			['Cat-Eye Sunglasses', 'ML-CATE', 'Accessories', 89, 47, 31, 'Fairhaven Optical', 18, 4.2],
			['Shield Sunglasses', 'ML-SHLD', 'Accessories', 39, 18, 6, 'Fairhaven Optical', 18, 4.5],
		].map((values) => Object.fromEntries(FIELD_ORDER.map((column, at) => [column, values[at]])));

		/* `end` right-aligns a figure column; `html` returns the cell's inner markup. */
		const OPTIONAL_COLUMNS = [
			{ key: 'sku', label: 'SKU', html: (item) => mono(item.sku) },
			{ key: 'cat', label: 'Category', html: (item) => htmlSafe(item.cat) },
			{ key: 'price', label: 'Price', end: true, html: (item) => strong(asDollars.format(item.price)) },
			{ key: 'cost', label: 'Unit cost', end: true, html: (item) => asDollars.format(item.cost) },
			{
				key: 'margin',
				label: 'Margin',
				end: true,
				html: (item) => `${Math.round((1 - item.cost / item.price) * 100)}%`,
			},
			{
				key: 'stock',
				label: 'In stock',
				end: true,
				html: (item) =>
					`${item.stock}${item.stock < 15 ? ` <span class="tadv-low">${tonePill('Low', 'wait')}</span>` : ''}`,
			},
			{ key: 'supplier', label: 'Supplier', html: (item) => htmlSafe(item.supplier) },
			{ key: 'lead', label: 'Lead time', end: true, html: (item) => `${item.lead} days` },
			{
				key: 'rating',
				label: 'Rating',
				end: true,
				html: (item) =>
					`<span class="tadv-stars"><i class="bi bi-star-fill" aria-hidden="true"></i>${item.rating.toFixed(1)}</span>`,
			},
		];
		const visible = new Set(OPTIONAL_COLUMNS.map((column) => column.key));

		chooser.innerHTML = OPTIONAL_COLUMNS.map(
			({ key, label }) =>
				`<div class="form-check"><input class="form-check-input" type="checkbox" id="tadv-col-${key}" data-col="${key}" checked>` +
				`<label class="form-check-label" for="tadv-col-${key}">${label}</label></div>`,
		).join('');

		chooser.addEventListener('change', (event) => {
			const key = event.target.dataset.col;
			if (!key) return;
			if (event.target.checked) visible.add(key);
			else visible.delete(key);
			redraw();
		});

		for (const choice of densityChips) {
			choice.addEventListener('click', () => {
				for (const other of densityChips) other.setAttribute('aria-pressed', String(other === choice));
				catalogTable.classList.toggle('table-sm', choice.dataset.devicesDensity === 'compact');
			});
		}

		hook(card, 'devices-stripes').addEventListener('change', (event) => {
			catalogTable.classList.toggle('table-striped', event.target.checked);
		});

		scroller.addEventListener('scroll', flagHiddenColumns, { passive: true });
		if ('ResizeObserver' in window) {
			const sizeWatch = new ResizeObserver(() => requestAnimationFrame(flagHiddenColumns));
			sizeWatch.observe(scroller);
			sizeWatch.observe(catalogTable);
		}

		redraw();

		/* The right edge fades only while some column is still past it. */
		function flagHiddenColumns() {
			const pastEdge = scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 1;
			return scroller.classList.toggle('is-more-end', pastEdge);
		}

		function redraw() {
			const active = OPTIONAL_COLUMNS.filter((column) => visible.has(column.key));
			headRow.innerHTML = `<th scope="col">Product</th>${active.map((column) => `<th scope="col"${column.end ? ' class="text-end"' : ''}>${column.label}</th>`).join('')}`;
			rowsHost.innerHTML = catalog
				.map((item) => {
					const cells = active.map((column) => td(column.end ? 'text-end tadv-num' : '', column.html(item)));
					return `<tr>${rowHeading(strong(htmlSafe(item.name)))}${cells.join('')}</tr>`;
				})
				.join('');
			catalogTable.classList.toggle('tadv-table-pin', active.length > 3);
			summary.textContent = `${active.length} of ${OPTIONAL_COLUMNS.length} columns`;
		}
	}

	/* The chips above the grid show one kind of table at a time. */
	function mountKindFilter() {
		const grid = pick('[data-tadv-grid]', host);
		const cards = [...pickAll('.tadv-card', grid)];
		const tally = pick('[data-tadv-count]', host);
		const chips = [...pickAll('[data-tadv-filter]', host)];

		for (const choice of chips) {
			choice.addEventListener('click', () => {
				for (const other of chips) other.setAttribute('aria-pressed', String(other === choice));
				showKind(choice.getAttribute('data-tadv-filter'));
			});
		}

		function showKind(kind) {
			const matching = cards.filter((card) => kind === 'all' || card.getAttribute('data-tadv-kind') === kind);
			for (const card of cards) {
				card.classList.toggle('is-hidden', !matching.includes(card));
				card.classList.remove('is-alone');
			}
			grid.classList.toggle('is-filtered', kind !== 'all');
			/* Half-width cards sit in pairs, so a leftover one stretches across the row. */
			const halfWidth = matching.filter((card) => !card.classList.contains('tadv-card-full'));
			if (halfWidth.length % 2) halfWidth.at(-1).classList.add('is-alone');
			if (tally) tally.textContent = countOf(matching.length, 'table');
		}
	}

	/* Sixty-four orders, newest first, each one to three lines long. */
	function buildOrderLedger() {
		const ledger = [];
		for (let index = 0; index < 64; index += 1) {
			const lineCount = 1 + Math.floor(nextRandom() * 3);
			const lineNames = [];
			let basketSum = 0;
			let pieces = 0;
			for (let line = 0; line < lineCount; line += 1) {
				const [title, price] = pickOne(SHELF);
				const quantity = 1 + Math.floor(nextRandom() * 2);
				lineNames.push(`${title.split(',')[0]}${quantity > 1 ? ` ×${quantity}` : ''}`);
				basketSum += price * quantity;
				pieces += quantity;
			}
			const ageInDays = Math.floor(index * 0.9 + nextRandom() * 2);
			const status = statusForAge(ageInDays);
			/* Baskets under $100 add flat-rate shipping of $9.95. */
			const shipping = basketSum < 100 ? 9.95 : 0;
			ledger.push({
				id: `#${9306 - index}`,
				customer: pickOne(SHOPPERS)[0],
				items: lineNames.join(', '),
				pieces,
				date: daysBefore(ageInDays),
				total: Math.round((basketSum + shipping) * 100) / 100,
				status,
			});
		}
		return ledger;
	}

	/* Fresh orders are still in the warehouse; older ones have mostly shipped. */
	function statusForAge(ageInDays) {
		if (ageInDays < 2) return pickOne(['Paid', 'Packed']);
		if (ageInDays < 5) return pickOne(['Paid', 'Packed', 'Shipped']);
		return nextRandom() < 0.08 ? 'Refunded' : 'Shipped';
	}

	/** Lehmer generator; returns a number in [0, 1). */
	function nextRandom() {
		generatorState = (generatorState * 16807) % 2147483647;
		return (generatorState - 1) / 2147483646;
	}

	function pickOne(choices) {
		return choices[Math.floor(nextRandom() * choices.length)];
	}

	function daysBefore(count) {
		return new Date(midnight.getTime() - count * ONE_DAY_MS);
	}

	function daysAfter(count) {
		return new Date(midnight.getTime() + count * ONE_DAY_MS);
	}

	function countOf(amount, noun) {
		return `${amount} ${amount === 1 ? noun : `${noun}s`}`;
	}

	/** 1 → "1st", 12 → "12th", 23 → "23rd". */
	function ordinalOf(position) {
		const suffixes = ['th', 'st', 'nd', 'rd'];
		const lastTwo = position % 100;
		return `${position}${suffixes[(lastTwo - 20) % 10] ?? suffixes[lastTwo] ?? suffixes[0]}`;
	}

	function htmlSafe(value) {
		return String(value).replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
	}

	/** First element under `scope` carrying the data-<name> hook attribute. */
	function hook(scope, name) {
		return pick(`[data-${name}]`, scope);
	}

	/** A new element with its properties already set. */
	function make(tag, properties) {
		return Object.assign(document.createElement(tag), properties);
	}

	/** A body cell; an empty class leaves the attribute off, `extra` adds raw attributes. */
	function td(className, inner, extra = '') {
		return `<td${className ? ` class="${className}"` : ''}${extra}>${inner}</td>`;
	}

	function rowHeading(inner) {
		return `<th scope="row" class="fw-normal">${inner}</th>`;
	}

	function strong(html) {
		return `<span class="tadv-strong">${html}</span>`;
	}

	function subLine(html) {
		return `<span class="tadv-sub">${html}</span>`;
	}

	function mono(html) {
		return `<span class="tadv-mono">${html}</span>`;
	}

	function tonePill(text, tone) {
		return `<span class="tadv-pill tadv-pill-${tone}">${htmlSafe(text)}</span>`;
	}

	/**
	 * Wires the .tadv-sort buttons in a table head to `sorting` ({ column,
	 * direction }). The active header gets aria-sort; a first click sorts
	 * ascending and a repeat click flips the direction.
	 */
	function makeSortable(sortableTable, sorting, redraw) {
		const triggers = [...pickAll('thead .tadv-sort', sortableTable)];

		for (const trigger of triggers) {
			trigger.addEventListener('click', () => {
				const column = trigger.dataset.sort;
				if (sorting.column === column) {
					sorting.direction = sorting.direction === 'asc' ? 'desc' : 'asc';
				} else {
					sorting.column = column;
					sorting.direction = 'asc';
				}
				paintHeaders();
				redraw();
			});
		}

		paintHeaders();

		function paintHeaders() {
			const ascending = sorting.direction === 'asc';
			for (const trigger of triggers) {
				const heading = trigger.closest('th');
				const isCurrent = trigger.dataset.sort === sorting.column;
				let arrow = 'bi-chevron-expand';
				if (isCurrent) {
					heading.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
					arrow = ascending ? 'bi-chevron-up' : 'bi-chevron-down';
				} else {
					heading.removeAttribute('aria-sort');
				}
				pick('.tadv-sort-icon', trigger).className = `tadv-sort-icon bi ${arrow}`;
			}
		}
	}

	function orderBy(list, sorting) {
		const sign = sorting.direction === 'asc' ? 1 : -1;
		return [...list].sort((left, right) => sign * compareValues(left[sorting.column], right[sorting.column]));
	}

	function compareValues(left, right) {
		if (left instanceof Date || typeof left === 'number') return left - right;
		return String(left).localeCompare(String(right));
	}

	function saveTextFile(fileName, text, mimeType) {
		const address = URL.createObjectURL(new Blob([text], { type: mimeType }));
		const link = make('a', { href: address, download: fileName });
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(address), 1000);
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
