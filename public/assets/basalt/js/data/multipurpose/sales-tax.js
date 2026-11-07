/**
 * Tax on out-of-plan purchases, looked up from where an account is based.
 * The New Invoice page (new-invoice.html) reads it through
 * window.Basalt.data.salesTax.forAccount, and every label and percentage
 * here matches the issued invoices in billing.js, so a fresh line is taxed
 * the way the older ones were. Subscriptions themselves carry no tax.
 * A production app would ask its tax provider instead of this table.
 */
(() => {
	'use strict';

	/* Every account is in the United States, so the state's base sales tax
     applies, keyed by the two-letter code in the second address line.
     Alaska, Delaware, Montana, New Hampshire and Oregon charge none and
     are left out. */
	const stateTax = {
		AL: charge('Alabama sales tax 4%', 4),
		AR: charge('Arkansas sales tax 6.5%', 6.5),
		AZ: charge('Arizona sales tax 5.6%', 5.6),
		CA: charge('California sales tax 7.25%', 7.25),
		CO: charge('Colorado sales tax 2.9%', 2.9),
		CT: charge('Connecticut sales tax 6.35%', 6.35),
		DC: charge('District of Columbia sales tax 6%', 6),
		FL: charge('Florida sales tax 6%', 6),
		GA: charge('Georgia sales tax 4%', 4),
		HI: charge('Hawaii sales tax 4%', 4),
		IA: charge('Iowa sales tax 6%', 6),
		ID: charge('Idaho sales tax 6%', 6),
		IL: charge('Illinois sales tax 6.25%', 6.25),
		IN: charge('Indiana sales tax 7%', 7),
		KS: charge('Kansas sales tax 6.5%', 6.5),
		KY: charge('Kentucky sales tax 6%', 6),
		LA: charge('Louisiana sales tax 5%', 5),
		MA: charge('Massachusetts sales tax 6.25%', 6.25),
		MD: charge('Maryland sales tax 6%', 6),
		ME: charge('Maine sales tax 5.5%', 5.5),
		MI: charge('Michigan sales tax 6%', 6),
		MN: charge('Minnesota sales tax 6.875%', 6.875),
		MO: charge('Missouri sales tax 4.225%', 4.225),
		MS: charge('Mississippi sales tax 7%', 7),
		NC: charge('North Carolina sales tax 4.75%', 4.75),
		ND: charge('North Dakota sales tax 5%', 5),
		NE: charge('Nebraska sales tax 5.5%', 5.5),
		NJ: charge('New Jersey sales tax 6.625%', 6.625),
		NM: charge('New Mexico sales tax 4.875%', 4.875),
		NV: charge('Nevada sales tax 6.85%', 6.85),
		NY: charge('New York sales tax 4%', 4),
		OH: charge('Ohio sales tax 5.75%', 5.75),
		OK: charge('Oklahoma sales tax 4.5%', 4.5),
		PA: charge('Pennsylvania sales tax 6%', 6),
		RI: charge('Rhode Island sales tax 7%', 7),
		SC: charge('South Carolina sales tax 6%', 6),
		SD: charge('South Dakota sales tax 4.2%', 4.2),
		TN: charge('Tennessee sales tax 7%', 7),
		TX: charge('Texas sales tax 6.25%', 6.25),
		UT: charge('Utah sales tax 4.85%', 4.85),
		VA: charge('Virginia sales tax 5.3%', 5.3),
		VT: charge('Vermont sales tax 6%', 6),
		WA: charge('Washington sales tax 6.5%', 6.5),
		WI: charge('Wisconsin sales tax 5%', 5),
		WV: charge('West Virginia sales tax 6%', 6),
		WY: charge('Wyoming sales tax 4%', 4),
	};

	const regionCode = /, ([A-Z]{2}) /;

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.salesTax = { forAccount };

	/**
	 * Finds the tax that applies to an account from accounts.js.
	 * @param {object} account  needs `address` (street, then "City, ST ZIP")
	 * @returns {{label: string, rate: number}|null}  null when nothing is charged
	 */
	function forAccount(account) {
		const addressLines = account?.address;
		if (!addressLines) return null;

		const hit = stateTax[regionCode.exec(addressLines[1] || '')?.[1]];

		return hit ? { ...hit } : null;
	}

	function charge(label, rate) {
		return { label, rate };
	}
})();
