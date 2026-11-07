/**
 * One segment's own page, segment-details.html.
 *
 * Six cards describe a single audience: how customers qualify (rules,
 * edited inline in one pass, or the way a list is filled), its size
 * over twelve weeks, the revenue behind it and its plan mix, the sends
 * that target it, a sample of members (editable for lists and
 * suppressions) and a change log.
 *
 * `?id=fleets` picks the segment; without an id the first sample
 * segment (Large Teams) is shown. `&edit=rules` or `&edit=members`,
 * as linked from the Segments table, opens the matching editor on load.
 * Records come from assets/basalt/js/data/multipurpose/customer-groups.js and
 * assets/basalt/js/data/multipurpose/accounts.js, shared with the Segments table. Places
 * that need a backend call say "Server:". Styled selects, avatars,
 * empty states, dialogs and undo toasts are provided by basalt.js.
 */
(() => {
	'use strict';

	const page = pick('[data-cgd-root]');
	if (!page) return;

	/* Shared records, plus the fixed "today" the demo data is written for. */
	const store = window.Basalt.data.customerGroups;
	const ledger = window.Basalt.data.accounts;
	const tests = store.fields;
	const today = store.now;
	const CURRENT_USER = 'John Armstrong';
	const ONE_DAY = 864e5;
	const RULE_CAP = 5;
	const OPENING_PICKS = 9;

	const KIND_NAMES = { segment: 'Segment', list: 'List', suppression: 'Suppression' };
	const SEND_ICONS = {
		Email: 'envelope',
		'Automatic email': 'arrow-repeat',
		Announcement: 'megaphone',
		'Store offer': 'ticket-perforated',
	};
	const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Plan keys in display order, each tied to the series color the
     Reports charts use for that plan. */
	const PLAN_ORDER = [
		{ key: 'starter', name: 'Basic', tone: 1 },
		{ key: 'growth', name: 'Pro', tone: 2 },
		{ key: 'enterprise', name: 'Max', tone: 3 },
		{ key: 'trial', name: 'Trial', tone: 4 },
	];

	/* Accounts keyed by id, trimmed to what this page prints. */
	const customers = Object.fromEntries(
		ledger.list().map((record) => [
			record.id,
			{
				name: record.name,
				place: record.city,
				planKey: record.status === 'trial' ? 'trial' : record.plan,
				seats: record.seats,
				mrr: Math.round(ledger.mrr(record)),
			},
		]),
	);

	const catalog = store.list();
	const query = new URLSearchParams(window.location.search);
	/* With no id in the address the first sample segment stands in. */
	const segment = store.find(query.get('id') || catalog[0].id);
	const ui = { editingRules: false, draft: null, picking: false };
	const trendState = { points: [], index: 0 };

	const slots = new Map([...pickAll('[data-cgd]', page)].map((node) => [node.getAttribute('data-cgd'), node]));
	const grid = pick('[data-cgd-body]', page);
	const missingCard = pick('[data-cgd-gone]', page);
	const heroActions = pick('.cgd-head .basalt-hero-actions', page);
	const whoBody = slot('who-body');
	const rulesButton = pick('[data-cgd-rules-edit]', page);
	const addOpener = pick('[data-cgd-add-open]', page);
	const pickerPanel = pick('[data-cgd-add]', page);
	const pickList = pick('[data-cgd-picks]', page);
	const pickSearch = pick('[data-cgd-add-search]', page);
	const pickError = pick('[data-cgd-add-error]', page);
	const renameForm = pick('[data-cgd-rename]', page);
	const deleteDialog = document.getElementById('cgd-delete');

	function start() {
		wireRuleEditor();
		wireTrend();
		wireMembers();
		wireRename();
		wireDelete();
		wireMenu();

		if (!segment) {
			slot('name').textContent = 'Segment not found';
			slot('desc').textContent = 'This link points to a segment that does not exist.';
			slot('icon').hidden = true;
			slot('tags').hidden = true;
			replaceWithNotice('No segment with this link', 'It may have been deleted. Pick one from the list instead.');
			return;
		}
		paintEverything();
		openRequestedEditor();
	}

	/* An `edit` parameter opens its editor once, then leaves the address,
     so reloading or sharing the link shows the plain page. */
	function openRequestedEditor() {
		const editor = query.get('edit');
		if (!editor) return;
		query.delete('edit');
		history.replaceState(null, '', `?${query.toString()}`);
		if (editor === 'rules' && segment.kind === 'segment') {
			beginRuleEdit();
		} else if (editor === 'members' && membersAreManual()) {
			openPicker();
			pick('.cgd-card-members', page).scrollIntoView({ block: 'start' });
		}
	}

	function paintEverything() {
		paintHeader();
		renderWho();
		renderSize();
		renderWorth();
		renderUses();
		renderMembers();
		renderHistory();
	}

	/* Header: icon, title, tags, and the wrap-around previous/next links. */
	function paintHeader() {
		const toneClass = `cg-tone-${segment.tone}`;
		const icon = slot('icon');
		icon.className = `cg-icon cgd-icon ${toneClass}`;
		grid.className = `cgd-grid ${toneClass}`;
		icon.innerHTML = `<i class="bi bi-${htmlSafe(segment.icon)}"></i>`;
		slot('name').textContent = segment.name;
		slot('desc').textContent = segment.desc;
		const timing =
			segment.kind === 'segment'
				? `Updates every hour, ${freshnessNote()}`
				: `Last change ${timeAgo(segment.updated).replace(/^on /, '')}`;
		slot('tags').innerHTML =
			`<span class="basalt-status basalt-status-dot cg-kind-${segment.kind}">${KIND_NAMES[segment.kind]}</span><span class="cgd-when">${htmlSafe(timing)}</span>`;
		slot('send').hidden = segment.kind === 'suppression';
		document.title = `${segment.name} · Basalt`;

		const position = catalog.findIndex((entry) => entry.id === segment.id);
		const total = catalog.length;
		pointPager(slot('prev'), catalog[(position - 1 + total) % total], 'Previous segment');
		pointPager(slot('next'), catalog[(position + 1) % total], 'Next segment');
	}

	function pointPager(link, neighbor, label) {
		link.href = `segment-details.html?id=${encodeURIComponent(neighbor.id)}`;
		link.setAttribute('aria-label', `${label}: ${neighbor.name}`);
		link.title = neighbor.name;
	}

	/* The membership card reads differently for each kind of segment. */
	function renderWho() {
		rulesButton.hidden = segment.kind !== 'segment' || ui.editingRules;
		const views = { segment: ruleView, list: listView, suppression: suppressionView };
		views[segment.kind]();
		paintAvatars(whoBody);
	}

	function ruleView() {
		slot('who-desc').textContent = ui.editingRules
			? 'Customers join and leave on their own as these rules change.'
			: 'Customers that match every rule. They join and leave on their own.';
		whoBody.innerHTML = ui.editingRules
			? ruleEditorMarkup()
			: `${rulesReadout()}<p class="cgd-quiet-line"><i class="bi bi-arrow-repeat" aria-hidden="true"></i>Checked every hour, ${htmlSafe(freshnessNote())}.</p>${recentMoves()}`;
	}

	function listView() {
		slot('who-desc').textContent = 'A fixed list: customers stay until someone removes them.';
		const origin = `<div class="cgd-source cg-kind-list"><span class="cgd-source-icon" aria-hidden="true"><i class="bi bi-person-check"></i></span><div class="cgd-source-text"><p class="cgd-source-title">Added by hand or imported</p><p class="cgd-source-note">${htmlSafe(segment.how)}</p></div></div>`;
		whoBody.innerHTML = `${origin}<div class="cgd-who-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-cgd-import><i class="bi bi-upload me-1" aria-hidden="true"></i>Import a CSV</button></div>${recentMoves()}`;
	}

	/* Two columns: the sends a suppression blocks and the mail it lets through. */
	function suppressionView() {
		slot('who-desc').textContent = 'Every send skips these customers, even when another segment includes them.';
		const column = (variant, titleId, heading, icon, entries) =>
			`<div class="cgd-rule-split-col cgd-rule-split-col-${variant}"><h3 class="cgd-sub" id="${titleId}">${heading}</h3><ul aria-labelledby="${titleId}">${entries.map((entry) => `<li><i class="bi bi-${icon}" aria-hidden="true"></i>${entry}</li>`).join('')}</ul></div>`;
		const blocked = column('out', 'cgd-out-title', 'Left out of', 'x-circle', [
			'Campaign emails',
			'Announcements',
			'Store offers and promo codes',
		]);
		const allowed = column('in', 'cgd-in-title', 'Still sent', 'check-circle', [
			'Invoices and receipts',
			'Service and sign-in emails',
			'Job updates to their customers',
		]);
		whoBody.innerHTML = `<div class="cgd-rule-split">${blocked}${allowed}</div><p class="cgd-quiet-line"><i class="bi bi-person-check" aria-hidden="true"></i>${htmlSafe(segment.how)}</p>${recentMoves()}`;
	}

	function rulesReadout() {
		const lines = segment.rules.map((rule, index) => {
			const words = describeRule(rule);
			return `<li><span class="cg-rules-join">${index ? 'and' : 'Where'}</span><span class="cg-rules-what"><strong>${htmlSafe(words.field)}</strong> ${htmlSafe(words.op)} <strong>${htmlSafe(words.value)}</strong></span></li>`;
		});
		return `<ol class="cg-rules cgd-rules">${lines.join('')}</ol>`;
	}

	/* The last few accounts to join or leave, each with its reason. */
	function recentMoves() {
		if (!segment.moves.length) return '';
		const items = segment.moves.map(([id, direction, day, reason]) => {
			const who = customers[id];
			const joined = direction === 'in';
			return `<li class="cgd-move"><span class="basalt-avatar basalt-avatar-sm" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(who.name)}"></span><div class="cgd-move-who"><a href="company-details.html?id=${encodeURIComponent(id)}" class="cg-mem-name">${htmlSafe(who.name)}</a><span class="cg-mem-sub">${htmlSafe(reason)}</span></div><span class="basalt-status basalt-status-dot ${joined ? 'basalt-status-success' : 'cgd-left'}">${joined ? 'Joined' : 'Left'}</span><span class="cgd-move-day">${htmlSafe(shortDate(new Date(`${day}T12:00`)))}</span></li>`;
		});
		return `<section class="cgd-moves" aria-labelledby="cgd-moves-title"><h3 class="cgd-sub" id="cgd-moves-title">Latest moves</h3><ul class="cgd-moves-list">${items.join('')}</ul></section>`;
	}

	/* Rule editing happens in place, on a draft, with a live match count. */
	function beginRuleEdit() {
		ui.editingRules = true;
		ui.draft = segment.rules.map((rule) => ({ ...rule }));
		renderWho();
	}

	function wireRuleEditor() {
		rulesButton.addEventListener('click', () => {
			beginRuleEdit();
			focusSelect(pick('[data-cgd-rule="field"]', whoBody));
		});

		whoBody.addEventListener('change', (event) => {
			const part = event.target.getAttribute('data-cgd-rule');
			if (!part) return;
			const rules = collectRules();
			if (part === 'field') {
				const index = Number(event.target.closest('[data-cgd-rule-index]').getAttribute('data-cgd-rule-index'));
				const spec = tests[rules[index].field];
				rules[index] = {
					field: rules[index].field,
					op: spec.ops[0],
					value: spec.values ? spec.values[0] : '10',
				};
				ui.draft = rules;
				renderWho();
				focusSelect(pickAll('[data-cgd-rule="field"]', whoBody)[index]);
				return;
			}
			ui.draft = rules;
			flagFaultyRows(rules);
			pick('[data-cgd-estimate]', whoBody).innerHTML = estimateSentence(rules);
		});

		whoBody.addEventListener('input', (event) => {
			if (!event.target.matches('input[data-cgd-rule]')) return;
			const rules = collectRules();
			ui.draft = rules;
			if (event.target.classList.contains('is-invalid')) flagFaultyRows(rules);
			pick('[data-cgd-estimate]', whoBody).innerHTML = estimateSentence(rules);
		});

		const clickHandlers = [
			['[data-cgd-rule-add]', addDraftRule],
			['[data-cgd-rule-remove]', removeDraftRule],
			['[data-cgd-rules-cancel]', cancelRuleEdit],
			['[data-cgd-rules-save]', saveRules],
			['[data-cgd-import]', announceImport],
		];
		whoBody.addEventListener('click', (event) => {
			const match = clickHandlers.find(([selector]) => event.target.closest(selector));
			if (match) match[1](event.target);
		});
	}

	function addDraftRule() {
		ui.draft = [...collectRules(), { field: 'seats', op: 'at least', value: '10' }];
		renderWho();
		const pickers = pickAll('[data-cgd-rule="field"]', whoBody);
		focusSelect(pickers[pickers.length - 1]);
	}

	function removeDraftRule(origin) {
		const rules = collectRules();
		rules.splice(Number(origin.closest('[data-cgd-rule-index]').getAttribute('data-cgd-rule-index')), 1);
		ui.draft = rules;
		renderWho();
		(pick('[data-cgd-rule-add]', whoBody) || pick('[data-cgd-rules-save]', whoBody)).focus();
	}

	function cancelRuleEdit() {
		ui.editingRules = false;
		renderWho();
		rulesButton.focus();
	}

	/* A changed rule set rescales revenue and plan mix to the new size;
     rounding leftovers land on the largest plan. */
	function saveRules() {
		const rules = collectRules();
		const firstFaulty = flagFaultyRows(rules);
		if (firstFaulty) {
			firstFaulty.focus();
			return;
		}
		if (!rules.length) {
			notify({
				tone: 'warning',
				title: 'Add a rule first',
				text: 'A segment needs at least one rule to decide who is in it.',
			});
			return;
		}
		/* Server: store the rules; the backend works out the new members. */
		const previous = segment.members;
		if (!store.sameRules(rules, segment.rules)) {
			const matched = store.estimate(rules, segment);
			const ratio = matched / Math.max(previous, 1);
			if (segment.mrr !== null) segment.mrr = Math.round((segment.mrr * ratio) / 100) * 100;
			if (segment.potential) segment.potential = Math.round((segment.potential * ratio) / 100) * 100;
			const { mix } = segment;
			for (const plan of Object.keys(mix)) mix[plan] = Math.round(mix[plan] * ratio);
			const biggest = Object.keys(mix).reduce(
				(best, plan) => (best === undefined || mix[plan] > mix[best] ? plan : best),
				undefined,
			);
			if (biggest) mix[biggest] += matched - Object.values(mix).reduce((sum, count) => sum + count, 0);
			segment.rules = rules;
			adjustMembers(matched - previous);
			recordChange(`Changed the rules to ${rules.map(ruleSentence).join(' and ')}`, 'funnel');
		}
		ui.editingRules = false;
		paintEverything();
		rulesButton.focus();
		const was = segment.members !== previous ? ` (was ${formatCount(previous)}).` : '.';
		notify({
			tone: 'success',
			icon: 'bi-funnel',
			title: 'Rules saved',
			text: `${segment.name} now has ${countOf(segment.members, 'customer')}${was}`,
		});
	}

	function announceImport() {
		/* Server: hand off to your own import screen here. */
		notify({
			tone: 'info',
			icon: 'bi-upload',
			title: 'Import a CSV',
			text: `One customer number or company name a row. Customers already in ${segment.name} are skipped.`,
		});
	}

	function ruleEditorMarkup() {
		const rules = ui.draft;
		const addControl =
			rules.length < RULE_CAP
				? '<button type="button" class="btn btn-sm btn-outline-secondary" data-cgd-rule-add><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Add a rule</button>'
				: '<span class="cg-quiet">Five rules at most.</span>';
		const footer = `<div class="cg-build-foot">${addControl}<p class="cg-estimate" aria-live="polite"><i class="bi bi-people" aria-hidden="true"></i><span data-cgd-estimate>${estimateSentence(rules)}</span></p></div>`;
		const buttons =
			'<div class="cgd-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-cgd-rules-cancel>Cancel</button><button type="button" class="btn btn-sm btn-primary" data-cgd-rules-save><i class="bi bi-check2 me-1" aria-hidden="true"></i>Save rules</button></div>';
		return `<ol class="cg-build cgd-build" data-cgd-build>${rules.map(ruleRowMarkup).join('')}</ol>${footer}${buttons}`;
	}

	/** One editable rule row: field, comparison, value and its error text. */
	function ruleRowMarkup(rule, index) {
		const spec = tests[rule.field];
		const ordinal = index + 1;
		const errorId = `cgd-rule-${index}-err`;
		const choice = (label, picked, value) =>
			`<option${value === undefined ? '' : ` value="${value}"`}${picked ? ' selected' : ''}>${htmlSafe(label)}</option>`;
		const fieldPicker = `<select class="form-select" data-cgd-rule="field" aria-label="Rule ${ordinal}: what to test">${Object.entries(
			tests,
		)
			.map(([key, field]) => choice(field.label, key === rule.field, key))
			.join('')}</select>`;
		const opPicker = `<select class="form-select" data-cgd-rule="op" aria-label="Rule ${ordinal}: how to compare">${spec.ops.map((op) => choice(op, op === rule.op)).join('')}</select>`;
		const valueControl = spec.values
			? `<select class="form-select" data-cgd-rule="value" aria-label="Rule ${ordinal}: value">${spec.values.map((value) => choice(value, value === rule.value)).join('')}</select>`
			: `<div class="cg-num"><input type="text" class="form-control" inputmode="numeric" data-cgd-rule="value" value="${htmlSafe(rule.value)}" aria-label="Rule ${ordinal}: number" aria-describedby="${errorId}">${spec.unit ? `<span class="cg-num-unit">${htmlSafe(spec.unit)}</span>` : ''}</div>`;
		return `<li class="cg-build-row" data-cgd-rule-index="${index}"><span class="cg-rules-join">${index ? 'and' : 'Where'}</span><div class="cg-build-fields">${fieldPicker}${opPicker}${valueControl}</div><button type="button" class="btn btn-icon cg-build-remove" aria-label="Remove rule ${ordinal}" data-cgd-rule-remove><i class="bi bi-x-lg" aria-hidden="true"></i></button><p id="${errorId}" class="cg-build-error" hidden>Enter a whole number${spec.max ? ` up to ${spec.max}` : ''}.</p></li>`;
	}

	function collectRules() {
		return [...pickAll('.cg-build-row', whoBody)].map((row) => ({
			field: pick('[data-cgd-rule="field"]', row).value,
			op: pick('[data-cgd-rule="op"]', row).value,
			value: pick('[data-cgd-rule="value"]', row).value.trim(),
		}));
	}

	/**
	 * Flags each editor row whose value cannot be used and hands back the
	 * first offending input, so the caller can move focus there.
	 */
	function flagFaultyRows(rules) {
		const builderRows = [...pickAll('.cg-build-row', whoBody)];
		const faulty = [];
		for (const [slot, builderRow] of builderRows.entries()) {
			const usable = acceptsValue(rules[slot]);
			const numberBox = pick('input[data-cgd-rule="value"]', builderRow);
			numberBox?.classList.toggle('is-invalid', !usable);
			pick('.cg-build-error', builderRow).hidden = usable;
			if (!usable) faulty.push(numberBox);
		}
		return faulty.length ? faulty[0] : null;
	}

	/* Picked values always pass; typed ones must be whole and under any cap. */
	function acceptsValue(rule) {
		const field = tests[rule.field];
		if (field.values) return true;
		if (!/^\d+$/.test(String(rule.value).trim())) return false;
		return !field.max || Number(rule.value) <= field.max;
	}

	function estimateSentence(rules) {
		if (!rules.every(acceptsValue)) return 'Fix the rule above to see how many match';
		const matched = store.estimate(rules, segment);
		const gap = matched - segment.members;
		const delta = gap
			? ` <span class="cgd-delta cgd-delta-${gap > 0 ? 'up' : 'down'}">${formatCount(Math.abs(gap))}${gap > 0 ? ' more' : ' fewer'} than now</span>`
			: '';
		return `About <strong>${formatCount(matched)}</strong> customers match${delta}`;
	}

	/* Size card: headline count, 30-day change and the weekly line. */
	function renderSize() {
		const weeks = segment.trend;
		const change = segment.members - weeks[weeks.length - 5];
		const direction = change > 0 ? ' cgd-change-up' : change < 0 ? ' cgd-change-down' : '';
		slot('size-n').textContent = formatCount(segment.members);
		slot('size-unit').textContent = segment.members === 1 ? 'customer' : 'customers';
		slot('size-change').className = `cgd-change${direction}`;
		slot('size-change').innerHTML = change
			? `<i class="bi bi-arrow-${change > 0 ? 'up' : 'down'}-right" aria-hidden="true"></i>${change > 0 ? '+' : '−'}${formatCount(Math.abs(change))} in 30 days`
			: 'No change in 30 days';
		const percent = (segment.members / store.total) * 100;
		slot('size-foot').innerHTML =
			`<span><strong>${formatCount(segment.joined)}</strong> joined and <strong>${formatCount(segment.left)}</strong> left in the last 30 days</span><span>${percent < 1 ? 'Under 1%' : `${Math.round(percent)}%`} of all ${formatCount(store.total)} customers</span>`;
		renderTrend();
	}

	/** Draws the twelve-week line as SVG, padded so a flat line sits low. */
	function renderTrend() {
		const weeks = segment.trend;
		const width = 600;
		const height = 160;
		const peak = Math.max(...weeks);
		const floor = Math.min(...weeks);
		const margin = Math.max(1, (peak - floor) * 0.25);
		const bottom = floor === peak ? 0 : Math.max(0, floor - margin * 2);
		const top = peak + margin;
		const xAt = (index) => (index / (weeks.length - 1)) * width;
		const yAt = (count) => height - ((count - bottom) / (top - bottom || 1)) * height;

		const path = weeks
			.map((count, index) => `${index ? 'L' : 'M'}${xAt(index).toFixed(1)} ${yAt(count).toFixed(1)}`)
			.join(' ');
		const fill = `${path} L${width} ${height} L0 ${height} Z`;
		const lastIndex = weeks.length - 1;
		const axis = [0, 4, 8, lastIndex]
			.map((index) => `<span>${index === lastIndex ? 'Today' : shortDate(weekEnding(index))}</span>`)
			.join('');
		const overview = `${segment.name} had ${countOf(weeks[0], 'member')} twelve weeks ago and has ${countOf(weeks[lastIndex], 'member')} today.`;
		const svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><line class="cgd-trend-grid" x1="0" x2="${width}" y1="${height / 2}" y2="${height / 2}"></line><path class="cgd-trend-area" d="${fill}"></path><path class="cgd-trend-line" d="${path}"></path></svg>`;
		slot('trend').innerHTML =
			`<div class="cgd-trend-plot" role="img" tabindex="0" data-cgd-plot aria-label="${htmlSafe(`${overview} Use the arrow keys to read each week.`)}">${svg}<span class="cgd-trend-dot" aria-hidden="true" data-cgd-dot></span><span class="cgd-trend-tip" aria-hidden="true" data-cgd-tip></span></div><div class="cgd-trend-axis" aria-hidden="true">${axis}</div>`;

		trendState.points = weeks.map((count, index) => ({
			count,
			left: (xAt(index) / width) * 100,
			top: (yAt(count) / height) * 100,
		}));
		markWeek(plotNode(), lastIndex, false);
	}

	/** Moves the marker to a week, with or without its tooltip. */
	function markWeek(plot, index, withTip) {
		const point = trendState.points[index];
		trendState.index = index;
		const dot = pick('[data-cgd-dot]', plot);
		const tip = pick('[data-cgd-tip]', plot);
		dot.style.left = `${point.left}%`;
		dot.style.top = `${point.top}%`;
		tip.hidden = !withTip;
		if (!withTip) return;
		tip.innerHTML = `<strong>${formatCount(point.count)}</strong> ${htmlSafe(weekName(index))}`;
		tip.style.left = `${Math.min(Math.max(point.left, 12), 88)}%`;
		tip.style.top = `${point.top}%`;
		tip.classList.toggle('is-below', point.top < 30);
	}

	/* Pointer and arrow keys both walk the weeks; leaving resets to today. */
	function wireTrend() {
		const host = slot('trend');
		const lastWeek = () => segment.trend.length - 1;
		const clamp = (index) => Math.max(0, Math.min(lastWeek(), index));
		const reset = () => {
			const plot = plotNode();
			if (plot) markWeek(plot, lastWeek(), false);
		};
		const keySteps = {
			Home: () => 0,
			End: () => lastWeek(),
			ArrowLeft: () => clamp(trendState.index - 1),
			ArrowRight: () => clamp(trendState.index + 1),
		};

		host.addEventListener('pointermove', (event) => {
			const plot = event.target.closest('[data-cgd-plot]');
			if (!plot) return;
			const box = plot.getBoundingClientRect();
			markWeek(plot, clamp(Math.round(((event.clientX - box.left) / box.width) * lastWeek())), true);
		});
		host.addEventListener('pointerleave', reset);
		host.addEventListener('focusout', reset);
		host.addEventListener('keydown', (event) => {
			const plot = event.target.closest('[data-cgd-plot]');
			const step = keySteps[event.key];
			if (!plot || !step) return;
			event.preventDefault();
			const index = step();
			markWeek(plot, index, true);
			if (window.Basalt.announce)
				window.Basalt.announce(`${weekName(index)}: ${countOf(segment.trend[index], 'customer')}`);
		});
	}

	function plotNode() {
		return pick('[data-cgd-plot]', slot('trend'));
	}

	function weekEnding(index) {
		return new Date(today - (segment.trend.length - 1 - index) * 7 * ONE_DAY);
	}

	function weekName(index) {
		return index === segment.trend.length - 1 ? 'Today' : `Week to ${shortDate(weekEnding(index))}`;
	}

	/* Worth card: billed revenue, or the trial upside, and the plan split. */
	function renderWorth() {
		const perHead = (amount) => dollars(amount / Math.max(segment.members, 1));
		if (segment.mrr === null) {
			slot('worth-desc').textContent = 'All on a free trial, so nothing is billed yet.';
			slot('worth-n').textContent = dollars(segment.potential);
			slot('worth-unit').textContent = 'a month once they convert';
			slot('worth-line').textContent =
				`If every trial converts on the plan it is trying, about ${perHead(segment.potential)} per customer.`;
		} else {
			const share = (segment.mrr / store.companyMrr) * 100;
			slot('worth-desc').textContent = 'What its members pay Fieldline every month.';
			slot('worth-n').textContent = dollars(segment.mrr);
			slot('worth-unit').textContent = 'a month';
			slot('worth-line').textContent =
				`${share < 1 ? 'Under 1%' : `${Math.round(share)}%`} of all recurring revenue, about ${perHead(segment.mrr)} per customer.`;
		}

		const { mix } = segment;
		const whole = PLAN_ORDER.reduce((sum, plan) => sum + (mix[plan.key] || 0), 0) || 1;
		const present = PLAN_ORDER.filter((plan) => mix[plan.key]);
		slot('mixbar').innerHTML = present
			.map(
				(plan) =>
					`<span class="cgd-mixbar-part" style="--cgd-part: ${((mix[plan.key] / whole) * 100).toFixed(2)}%; --cgd-c: var(--basalt-series-${plan.tone})"></span>`,
			)
			.join('');
		slot('mix').innerHTML = present
			.map((plan) => {
				const count = mix[plan.key];
				const percent = Math.round((count / whole) * 100);
				return `<li class="cgd-mix-row"><span class="cgd-mix-dot" aria-hidden="true" style="--cgd-c: var(--basalt-series-${plan.tone})"></span><span class="cgd-mix-name">${plan.name}</span><span class="cgd-mix-n">${countOf(count, 'customer')}</span><span class="cgd-mix-pct">${percent < 1 ? '<1' : percent}%</span></li>`;
			})
			.join('');
	}

	/* Uses card: sends that target the segment, or for a suppression the
     sends it held back. */
	function renderUses() {
		const footer = slot('uses-foot');
		const sendIcon = (type) =>
			`<span class="cg-use-icon" aria-hidden="true"><i class="bi bi-${SEND_ICONS[type] || 'send'}"></i></span>`;

		if (segment.kind === 'suppression') {
			slot('uses-title').textContent = 'Kept out of';
			slot('uses-desc').textContent = 'Recent sends that skipped these customers.';
			slot('uses').innerHTML = segment.skips
				.map(
					(skip) =>
						`<li class="cg-use">${sendIcon(skip.type)}<div class="cg-use-text"><span class="cgd-use-name">${htmlSafe(skip.name)}</span><span class="cg-mem-sub">${htmlSafe(skip.type)} · ${htmlSafe(skip.when)}</span></div><span class="basalt-status cgd-skip">${formatCount(skip.count)} skipped</span></li>`,
				)
				.join('');
			footer.textContent = 'Invoices, receipts and service emails still reached them.';
			footer.hidden = false;
			return;
		}

		const { uses } = segment;
		slot('uses-title').textContent = 'Used by';
		if (!uses.length) {
			slot('uses-desc').textContent = 'The messages and offers sent to this segment.';
			slot('uses').innerHTML = '';
			footer.innerHTML = window.Basalt.emptyState({
				icon: 'send',
				title: 'No send uses this segment yet',
				text: 'Pick it as the audience when you write a message or set up an offer.',
			});
			footer.hidden = false;
			return;
		}
		slot('uses-desc').textContent =
			`${countOf(uses.length, 'send')} pick${uses.length === 1 ? 's' : ''} this segment as the audience.`;
		slot('uses').innerHTML = uses
			.map(
				(send) =>
					`<li class="cg-use">${sendIcon(send.type)}<div class="cg-use-text"><a href="${htmlSafe(send.href)}" class="cg-use-name">${htmlSafe(send.name)}</a><span class="cg-mem-sub">${htmlSafe(send.type)} · ${htmlSafe(send.note)}</span></div><span class="basalt-status${send.tone ? ` basalt-status-${send.tone}` : ''}">${htmlSafe(send.status)}</span></li>`,
			)
			.join('');
		footer.innerHTML = '';
		footer.hidden = true;
	}

	/* Members card. Only lists and suppressions take manual edits. */
	function membersAreManual() {
		return segment.kind !== 'segment';
	}

	function renderMembers() {
		const manual = membersAreManual();
		const factLabel = segment.factLabel;
		let lead = 'No customers yet.';
		if (segment.members) {
			lead =
				segment.mrr === null
					? `${countOf(segment.members, 'customer')}, all on a free trial. A few of them:`
					: `${countOf(segment.members, 'customer')} paying ${dollars(segment.mrr)} a month. A few of them:`;
		}
		slot('mem-desc').textContent = lead;
		addOpener.hidden = !manual || ui.picking;

		const headCells = [
			'<th scope="col">Customer</th>',
			factLabel ? `<th scope="col" class="cgd-col-fact">${htmlSafe(factLabel)}</th>` : '',
			'<th scope="col" class="cgd-col-plan">Plan</th>',
			'<th scope="col" class="cgd-col-num">Seats</th>',
			'<th scope="col" class="cgd-col-num">Monthly</th>',
			manual ? '<th scope="col" class="cgd-col-remove"><span class="visually-hidden">Remove</span></th>' : '',
		];
		slot('mem-head').innerHTML = `<tr>${headCells.join('')}</tr>`;
		slot('mem-rows').innerHTML = segment.sample.map(([id, fact]) => memberRow(id, fact, manual)).join('');
		pick('.cgd-table-members', page).closest('.cgd-table-wrap').hidden = !segment.sample.length;
		paintAvatars(slot('mem-rows'));

		const others = segment.members - segment.sample.length;
		const footer = slot('mem-foot');
		footer.innerHTML = `${others > 0 ? `<span>And ${countOf(others, 'more customer')}.</span>` : '<span>That is everyone.</span>'}<a href="companies.html?stage=customer">Open in Companies<i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>`;
		footer.hidden = !segment.members;
	}

	function memberRow(id, fact, manual) {
		const who = customers[id];
		const planLabel = planName(who.planKey);
		const factLabel = segment.factLabel;
		const folded = `${htmlSafe(planLabel)} · ${countOf(who.seats, 'seat')}${factLabel && fact ? ` · ${htmlSafe(factLabel)} ${htmlSafe(fact)}` : ''}`;
		const account = `<div class="cgd-acct"><span class="basalt-avatar basalt-avatar-sm" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(who.name)}"></span><div class="cgd-acct-text"><a href="company-details.html?id=${encodeURIComponent(id)}" class="cg-mem-name">${htmlSafe(who.name)}</a><span class="cg-mem-sub">${htmlSafe(who.place)}</span><span class="cgd-acct-fold">${folded}</span></div></div>`;
		const cells = [
			`<td>${account}</td>`,
			factLabel ? `<td class="cgd-col-fact">${htmlSafe(fact || '')}</td>` : '',
			`<td class="cgd-col-plan">${htmlSafe(planLabel)}</td>`,
			`<td class="cgd-col-num">${formatCount(who.seats)}</td>`,
			`<td class="cgd-col-num">${who.planKey === 'trial' ? '<span class="cg-quiet">On trial</span>' : dollars(who.mrr)}</td>`,
			manual
				? `<td class="cgd-col-remove"><button type="button" class="btn btn-icon cgd-remove" aria-label="Remove ${htmlSafe(who.name)} from ${htmlSafe(segment.name)}" data-cgd-remove><i class="bi bi-x-lg" aria-hidden="true"></i></button></td>`
				: '',
		];
		return `<tr data-cgd-member="${htmlSafe(id)}">${cells.join('')}</tr>`;
	}

	function wireMembers() {
		addOpener.addEventListener('click', () => window.Basalt.slide(pickerPanel, openPicker));
		pick('[data-cgd-add-cancel]', page).addEventListener('click', () => {
			window.Basalt.slide(pickerPanel, closePicker);
			addOpener.focus();
		});
		pickSearch.addEventListener('input', filterPicks);
		pickList.addEventListener('change', () => {
			pickError.hidden = true;
		});
		pick('[data-cgd-add-save]', page).addEventListener('click', () => {
			const chosen = [...pickAll('input:checked', pickList)].map((box) => box.value);
			if (!chosen.length) {
				pickError.hidden = false;
				return;
			}
			window.Basalt.slide(pickerPanel, () => {
				addMembers(chosen);
				closePicker();
				paintEverything();
			});
			addOpener.focus();
			notify({
				tone: 'success',
				icon: 'bi-person-plus',
				title: `${countOf(chosen.length, 'customer')} added`,
				text: `${segment.name} now has ${countOf(segment.members, 'customer')}.`,
			});
		});
		slot('mem-rows').addEventListener('click', (event) => {
			const button = event.target.closest('[data-cgd-remove]');
			if (button) removeMember(button.closest('[data-cgd-member]').getAttribute('data-cgd-member'));
		});
	}

	/* The picker is a checklist inside the card of every account not
     already in the sample. */
	function openPicker() {
		ui.picking = true;
		const present = new Set(segment.sample.map(([id]) => id));
		pickList.innerHTML = Object.keys(customers)
			.filter((id) => !present.has(id))
			.map((id) => {
				const who = customers[id];
				const planLabel = planName(who.planKey);
				return `<li data-cgd-pick="${htmlSafe(`${who.name} ${who.place} ${planLabel}`)}"><label class="cg-pick"><input type="checkbox" class="form-check-input" value="${id}"><span class="basalt-avatar basalt-avatar-sm" aria-hidden="true" data-basalt-avatar data-name="${htmlSafe(who.name)}"></span><span class="cg-pick-text"><span class="cg-pick-name">${htmlSafe(who.name)}</span><span class="cg-mem-sub">${htmlSafe(planLabel)} · ${htmlSafe(who.place)}</span></span></label></li>`;
			})
			.join('');
		paintAvatars(pickList);
		pickSearch.value = '';
		filterPicks();
		pickError.hidden = true;
		pickerPanel.hidden = false;
		renderMembers();
		pickSearch.focus();
	}

	function closePicker() {
		ui.picking = false;
		pickerPanel.hidden = true;
		pickList.innerHTML = '';
		renderMembers();
	}

	/* With an empty search only the first few accounts (and anything
     already ticked) show; typing searches all of them. */
	function filterPicks() {
		const term = pickSearch.value.trim();
		const entries = [...pickAll('[data-cgd-pick]', pickList)];
		let visible = 0;
		for (const [position, entry] of entries.entries()) {
			const show = term
				? window.Basalt.matchesQuery(entry.getAttribute('data-cgd-pick'), term)
				: position < OPENING_PICKS || pick('input', entry).checked;
			entry.hidden = !show;
			if (show) visible += 1;
		}
		const hint = pick('[data-cgd-picks-more]', page);
		hint.hidden = Boolean(term) || entries.length <= visible;
		hint.textContent = `Search to find the other ${countOf(entries.length - visible, 'customer')}.`;
		const emptyNote = pick('[data-cgd-picks-empty]', page);
		emptyNote.hidden = visible > 0;
		emptyNote.innerHTML = visible ? '' : window.Basalt.emptyState({ query: term, noun: 'customers' });
	}

	function addMembers(ids) {
		/* Server: put these accounts into the segment. */
		segment.sample = [...ids.map((id) => [id]), ...segment.sample];
		for (const id of ids) {
			const who = customers[id];
			if (segment.mrr !== null) segment.mrr += who.mrr;
			segment.mix[who.planKey] = (segment.mix[who.planKey] || 0) + 1;
		}
		adjustMembers(ids.length);
		const day = isoMinute(today).slice(0, 10);
		segment.moves = [...ids.map((id) => [id, 'in', day, `Added by ${CURRENT_USER}`]), ...segment.moves].slice(0, 3);
		const names = ids.map((id) => customers[id].name);
		recordChange(
			`Added ${names.length <= 2 ? names.join(' and ') : countOf(names.length, 'customer')}`,
			'person-plus',
		);
	}

	/* Removing snapshots the whole segment first so undo is exact. */
	function removeMember(id) {
		/* Server: take this account out of the segment. */
		const position = segment.sample.findIndex(([memberId]) => memberId === id);
		const who = customers[id];
		const snapshot = JSON.stringify(segment);
		segment.sample.splice(position, 1);
		if (segment.mrr !== null) segment.mrr = Math.max(0, segment.mrr - who.mrr);
		if (segment.mix[who.planKey]) segment.mix[who.planKey] -= 1;
		adjustMembers(-1);
		segment.moves = [
			[id, 'out', isoMinute(today).slice(0, 10), `Removed by ${CURRENT_USER}`],
			...segment.moves,
		].slice(0, 3);
		recordChange(`Removed ${who.name}`, 'person-dash');
		paintEverything();
		const nextFocus = pick('[data-cgd-remove]', slot('mem-rows')) || addOpener;
		if (nextFocus && !nextFocus.hidden) nextFocus.focus();
		notify({
			tone: 'success',
			icon: 'bi-person-dash',
			title: 'Customer removed',
			text: `${who.name} is out of ${segment.name}.`,
			actions: [
				{
					label: 'Undo',
					onClick: () => {
						Object.assign(segment, JSON.parse(snapshot));
						paintEverything();
					},
				},
			],
		});
	}

	/** Applies a member delta to the count, this week's point and the flow. */
	function adjustMembers(delta) {
		segment.members = Math.max(0, segment.members + delta);
		segment.trend[segment.trend.length - 1] = segment.members;
		if (delta > 0) segment.joined += delta;
		else segment.left -= delta;
	}

	function recordChange(text, icon) {
		segment.history.unshift([isoMinute(today), CURRENT_USER, text, icon]);
		segment.updated = isoMinute(today);
	}

	function renderHistory() {
		slot('history').innerHTML = segment.history
			.map(([when, author, change, icon]) => {
				let byline = htmlSafe(author);
				if (author === 'Fieldline') byline = '<span class="cg-quiet">Automatic</span>';
				else if (author === CURRENT_USER) byline += ' <span class="cgd-you">You</span>';
				return `<tr><td class="cgd-col-when">${htmlSafe(fullDate(when))}</td><td><span class="cgd-change-cell"><i class="bi bi-${htmlSafe(icon)}" aria-hidden="true"></i>${htmlSafe(change)}</span></td><td class="cgd-col-by">${byline}</td></tr>`;
			})
			.join('');
	}

	/* Rename swaps the title block for a small inline form. */
	function wireRename() {
		const { name: nameInput, desc: descInput } = renameForm.elements;
		nameInput.addEventListener('input', () => nameInput.classList.remove('is-invalid'));
		pick('[data-cgd-rename-cancel]', page).addEventListener('click', () => {
			closeRename();
			focusTitle();
		});
		renameForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const title = nameInput.value.trim();
			const clash = catalog.some(
				(entry) => entry.id !== segment.id && entry.name.toLowerCase() === title.toLowerCase(),
			);
			pick('[data-cgd-name-error]', page).textContent = title
				? 'There is already a segment with this name.'
				: 'Give the segment a name.';
			nameInput.classList.toggle('is-invalid', !title || clash);
			if (!title || clash) {
				nameInput.focus();
				return;
			}
			/* Server: store the new name and description. */
			const blurb = descInput.value.trim() || segment.desc;
			const renamed = title !== segment.name;
			const changed = renamed || blurb !== segment.desc;
			if (renamed) recordChange(`Renamed from ${segment.name} to ${title}`, 'pencil');
			else if (blurb !== segment.desc) recordChange('Changed what it is for', 'pencil');
			segment.name = title;
			segment.desc = blurb;
			closeRename();
			paintEverything();
			focusTitle();
			if (changed)
				notify({
					tone: 'success',
					icon: 'bi-pencil',
					title: 'Segment saved',
					text: `Sends that use it now show ${title}.`,
				});
		});
	}

	function openRename() {
		const { name: nameInput, desc: descInput } = renameForm.elements;
		nameInput.value = segment.name;
		descInput.value = segment.desc;
		nameInput.classList.remove('is-invalid');
		slot('who').hidden = true;
		renameForm.hidden = false;
		setTimeout(() => nameInput.focus(), 0);
	}

	function closeRename() {
		renameForm.hidden = true;
		slot('who').hidden = false;
	}

	function focusTitle() {
		const heading = slot('name');
		heading.setAttribute('tabindex', '-1');
		heading.focus();
	}

	/* Deleting hides the cards behind a notice; undo brings them back. */
	function wireDelete() {
		pick('[data-cgd-del-go]', deleteDialog).addEventListener('click', () => {
			bootstrap.Modal.getOrCreateInstance(deleteDialog).hide();
			/* Server: delete the segment for real. */
			replaceWithNotice(
				`${segment.name} is deleted`,
				'Its customers are unchanged. Sends that used it need a new audience.',
			);
			notify({
				tone: 'success',
				icon: 'bi-trash3',
				title: 'Segment deleted',
				text: `${segment.name} is gone.`,
				actions: [{ label: 'Undo', onClick: restoreCards }],
			});
		});
	}

	function replaceWithNotice(title, text) {
		grid.hidden = true;
		heroActions.hidden = true;
		const notice = window.Basalt.emptyState({ icon: 'layers', title: htmlSafe(title), text: htmlSafe(text) });
		missingCard.innerHTML = `<div class="card-body">${notice}<p class="cgd-gone-back"><a href="segments.html" class="btn btn-primary btn-sm"><i class="bi bi-arrow-left me-1" aria-hidden="true"></i>All segments</a></p></div>`;
		missingCard.hidden = false;
	}

	function restoreCards() {
		missingCard.hidden = true;
		missingCard.innerHTML = '';
		grid.hidden = false;
		heroActions.hidden = false;
	}

	function deleteConsequence() {
		const people = countOf(segment.members, 'customer');
		if (segment.kind === 'suppression')
			return `Its ${people} will start getting campaigns, announcements and offers again.`;
		const { uses } = segment;
		if (!uses.length) return `No send uses it, so nothing else changes. The ${people} stay in your customer list.`;
		return `${uses.map((send) => send.name).join(' and ')} ${uses.length > 1 ? 'use' : 'uses'} this segment, and will stop reaching its ${people}. The customers themselves stay.`;
	}

	/* The header's overflow menu: rename, export, delete. */
	function wireMenu() {
		const menuActions = {
			rename: openRename,
			export: () => {
				/* Server: ask for the CSV file at this point. */
				notify({
					tone: 'info',
					icon: 'bi-download',
					title: 'Export started',
					text: `${countOf(segment.members, 'customer')} from ${segment.name}, as a CSV. It downloads in a moment.`,
				});
			},
			delete: () => {
				pick('[data-cgd-del-sub]', deleteDialog).textContent = segment.name;
				pick('[data-cgd-del-text]', deleteDialog).textContent = deleteConsequence();
				bootstrap.Modal.getOrCreateInstance(deleteDialog).show();
			},
		};
		for (const item of pickAll('[data-cgd-act]', page)) {
			item.addEventListener('click', () => menuActions[item.getAttribute('data-cgd-act')]?.());
		}
	}

	/* Lookups and formatting shared by the cards above. */
	function slot(name) {
		return slots.get(name);
	}

	function planName(key) {
		return PLAN_ORDER.find((plan) => plan.key === key).name;
	}

	function describeRule(rule) {
		const spec = tests[rule.field];
		return { field: spec.label, op: rule.op, value: `${rule.value}${spec.unit ? ` ${spec.unit}` : ''}` };
	}

	function ruleSentence(rule) {
		const words = describeRule(rule);
		return `${words.field} ${words.op} ${words.value}`;
	}

	function paintAvatars(scope) {
		for (const avatar of pickAll('[data-basalt-avatar]', scope)) {
			if (window.Basalt.avatar) window.Basalt.avatar(avatar);
		}
	}

	/* basalt.js swaps each select for a styled button placed beside it, so
     focus has to go to that button once it exists. */
	function focusSelect(select) {
		if (!select) return;
		setTimeout(() => {
			const styled = [select.previousElementSibling, select.nextElementSibling].find((node) =>
				node?.classList.contains('basalt-select-trigger'),
			);
			(styled || select).focus();
		}, 0);
	}

	/** "just now", "25 min ago", "4 h ago", "yesterday" or "on Sep 12". */
	function timeAgo(iso) {
		const moment = new Date(iso);
		const minutes = Math.max(0, Math.round((today - moment) / 60000));
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (moment.toDateString() === today.toDateString()) return `${Math.round(minutes / 60)} h ago`;
		if (moment.toDateString() === new Date(today - ONE_DAY).toDateString()) return 'yesterday';
		return `on ${shortDate(moment)}`;
	}

	/* Reads "last 40 min ago", or "last checked just now" right after an edit. */
	function freshnessNote() {
		const when = timeAgo(segment.updated);
		return when === 'just now' ? 'last checked just now' : `last ${when}`;
	}

	function fullDate(iso) {
		const moment = new Date(iso);
		if (moment.toDateString() !== today.toDateString()) return `${shortDate(moment)}, ${moment.getFullYear()}`;
		const hours = moment.getHours();
		return `Today, ${hours % 12 || 12}:${String(moment.getMinutes()).padStart(2, '0')}${hours < 12 ? ' am' : ' pm'}`;
	}

	function shortDate(date) {
		return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
	}

	function isoMinute(date) {
		const two = (value) => String(value).padStart(2, '0');
		const day = [date.getFullYear(), two(date.getMonth() + 1), two(date.getDate())].join('-');
		return `${day}T${two(date.getHours())}:${two(date.getMinutes())}`;
	}

	function formatCount(value) {
		return value.toLocaleString('en-US');
	}

	function dollars(value) {
		return `$${formatCount(Math.round(value))}`;
	}

	function countOf(value, singular) {
		return `${formatCount(value)} ${value === 1 ? singular : `${singular}s`}`;
	}

	function htmlSafe(text) {
		const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
		return String(text).replace(/[&<>"']/g, (character) => entities[character]);
	}

	function notify(options) {
		return window.Basalt.toasts?.push(options);
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
