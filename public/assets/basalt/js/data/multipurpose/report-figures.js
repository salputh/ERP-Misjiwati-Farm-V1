/**
 * Month-end Fieldline numbers behind the Report Builder (report-builder.html),
 * published as window.Basalt.data.reportFigures. plans.js has to be loaded
 * first: the latest twelve months reuse its MRR and account curves, so a
 * September report here agrees with Subscription Plans and Plan Details,
 * while the year before that is projected back from each plan's own growth.
 *
 * Each cell is one plan sold in one region through one channel and carries a
 * monthly series for every measure. A "stock" measure is read at the close of
 * a period and a "flow" measure is summed across it. A real app would serve
 * the same cells from its warehouse.
 */
(() => {
	'use strict';

	const catalog = window.Basalt.data?.plans;
	if (!catalog) throw new Error('Load plans.js before report-figures.js.');

	/* Twenty-four month keys, October 2024 through September 2026, oldest first. */
	const monthKeys = Array.from({ length: 24 }, (_, step) => monthKey(2024, 10 + step));
	const lastStep = monthKeys.length - 1;

	/* Everything a report can total, in the order the measure picker lists it. */
	const measureList = [
		measure('mrr', 'money', 'stock', 'Revenue (MRR)', 'Monthly recurring revenue', 'Revenue'),
		measure('new', 'money', 'flow', 'New revenue', 'MRR from accounts that started paying'),
		measure('accounts', 'count', 'stock', 'Paying accounts', 'Accounts on a paid plan'),
		measure('signups', 'count', 'flow', 'New accounts', 'Accounts that started paying'),
		measure('seats', 'count', 'stock', 'Paid seats', 'Seats on paid plans'),
		measure('active', 'count', 'stock', 'Active users', 'People who signed in during the month'),
		measure('signins', 'count', 'flow', 'Sign-ins', 'Times people signed in'),
	];

	/* The ways a report can be split. Plans come straight from plans.js. */
	const planList = catalog.plans.map(({ id, name, tone }) => ({ id, name, tone }));
	const regionList = choices([
		['na', 'Northeast'],
		['eu', 'Midwest'],
		['apac', 'West'],
		['latam', 'South'],
	]);
	const channelList = choices([
		['self', 'Self-serve'],
		['sales', 'Sales-led'],
	]);
	const billingList = choices([
		['monthly', 'Billed monthly'],
		['annual', 'Billed yearly'],
	]);

	/*
	 * How each plan's book of business looks in September 2026. Region weights
	 * follow regionList and match the Reports page, route splits accounts by
	 * how they bought, and the rest drives new revenue, new accounts and usage.
	 */
	const planMix = {
		free: {
			regionWeights: [0.44, 0.3, 0.16, 0.1],
			route: { self: 1, sales: 0 },
			newRevenueRate: 0,
			newAccounts: 0,
			users: 2700,
			signinsPerUser: 9,
		},
		starter: {
			regionWeights: [0.41, 0.31, 0.17, 0.11],
			route: { self: 0.93, sales: 0.07 },
			newRevenueRate: 3250 / 158000,
			newAccounts: 26,
			users: 12100,
			signinsPerUser: 16,
		},
		growth: {
			regionWeights: [0.46, 0.29, 0.15, 0.1],
			route: { self: 0.56, sales: 0.44 },
			newRevenueRate: 7200 / 361000,
			newAccounts: 22,
			users: 19800,
			signinsPerUser: 21,
		},
		enterprise: {
			regionWeights: [0.52, 0.3, 0.13, 0.05],
			route: { self: 0.2, sales: 0.8 },
			newRevenueRate: 6980 / 361000,
			newAccounts: 4,
			users: 13600,
			signinsPerUser: 24,
		},
	};

	/* Yearly tilt per region, in regionList order: the West and the South outpace the others. */
	const regionTilt = [-0.05, 0, 0.14, 0.08];

	/* Seasonal pull on new business, January to December, scaled so September is 1. */
	const seasonality = [1.15, 1.02, 1.06, 0.94, 0.92, 0.89, 0.83, 0.75, 1, 1.04, 0.96, 0.74];

	function publish() {
		const allCells = catalog.plans.flatMap(cellsForTier);

		window.Basalt.data ??= {};
		window.Basalt.data.reportFigures = {
			months: monthKeys,
			measures: measureList,
			plans: planList,
			regions: regionList,
			channels: channelList,
			billing: billingList,
			cells: allCells,
		};
	}

	/** Every region and channel pairing the plan actually sells through, one cell each. */
	function cellsForTier(tier) {
		const mix = planMix[tier.id];
		const curve = curveOf(tier.growth);
		const pairings = [];

		for (const [regionAt, region] of regionList.entries()) {
			for (const channel of channelList) {
				const routeShare = mix.route[channel.id];
				if (!routeShare) continue;
				pairings.push({
					plan: tier.id,
					region: region.id,
					channel: channel.id,
					annual: tier.yearlyShare,
					values: seriesFor(tier, mix, curve, regionAt, routeShare),
				});
			}
		}
		return pairings;
	}

	/**
	 * One cell's monthly numbers for each measure id.
	 * @param {object} tier        the plan record from plans.js
	 * @param {object} mix         that plan's entry in planMix
	 * @param {number[]} curve     24 month-end multipliers of September's size
	 * @param {number} regionAt    position of the cell's region in regionList
	 * @param {number} routeShare  fraction of the plan sold through the cell's channel
	 */
	function seriesFor(tier, mix, curve, regionAt, routeShare) {
		const byMeasure = { mrr: [], new: [], accounts: [], signups: [], seats: [], active: [], signins: [] };

		for (const [step, key] of monthKeys.entries()) {
			const share = regionShare(mix.regionWeights, regionAt, step) * routeShare;
			const scale = curve[step] * share;
			const lift = seasonFactor(key);
			const live = curve[step] ? 1 : 0;

			byMeasure.mrr.push(tier.mrr * scale);
			byMeasure.new.push(tier.mrr * scale * mix.newRevenueRate * lift);
			byMeasure.accounts.push(tier.price ? tier.accounts * scale : 0);
			byMeasure.signups.push(mix.newAccounts * share * live * lift * Math.min(1, 0.8 + 0.2 * curve[step]));
			byMeasure.seats.push(tier.price ? tier.seats * scale : 0);
			byMeasure.active.push(mix.users * scale);
			byMeasure.signins.push(mix.users * scale * mix.signinsPerUser);
		}
		return byMeasure;
	}

	/**
	 * The region's slice of a plan in a given month. Weights lean along
	 * regionTilt the further back the month is, then are rescaled to sum to one.
	 */
	function regionShare(weights, regionAt, step) {
		const reach = (step - lastStep) / lastStep;
		const leaned = weights.map((weight, at) => weight * (1 + regionTilt[at] * reach));
		let whole = 0;
		for (const part of leaned) whole += part;
		return leaned[regionAt] / whole;
	}

	/**
	 * Twenty-four month-end curve relative to September 2026: plans.js supplies
	 * the latest twelve, and the twelve before are projected back at the plan's
	 * average monthly rate. A plan that starts at zero is padded with zeros.
	 */
	function curveOf(growth) {
		if (!growth[0]) return [...Array(12).fill(0), ...growth]; /* Free only opened in April 2026. */
		const monthlyRate = Math.pow(growth[11] / growth[0], 1 / 11);
		const projected = Array.from({ length: 12 }, (_, at) => growth[0] / Math.pow(monthlyRate, 12 - at));
		return [...projected, ...growth];
	}

	function seasonFactor(key) {
		return seasonality[Number(key.slice(5)) - 1];
	}

	/** A "YYYY-MM" key; month numbers past 12 roll into the following years. */
	function monthKey(year, month) {
		const index = year * 12 + month - 1;
		return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
	}

	/** A measure record; the short name falls back to the label when none is given. */
	function measure(id, unit, kind, label, long, short = label) {
		return { id, label, short, long, unit, kind };
	}

	function choices(pairs) {
		return pairs.map(([id, name]) => ({ id, name }));
	}

	publish();
})();
