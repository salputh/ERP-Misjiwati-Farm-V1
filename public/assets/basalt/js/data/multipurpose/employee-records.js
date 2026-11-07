/**
 * What each person has handed in and what they have checked out, for the
 * Documents and Equipment cards on employee-details.html. Records are keyed
 * by the short ids that assets/basalt/js/data/multipurpose/people.js gives each person ('lm' is
 * Forrest Murphy), so a record follows its owner across every people page.
 *
 * Published as window.Basalt.data.employeeRecords:
 *   docs    id -> papers on file in display order, each { name, type,
 *           uploaded, expires? }. type is Contract, Letter, ID, Tax form,
 *           Certificate or Agreement; uploaded is a YYYY-MM-DD date, or null
 *           while the paper is still outstanding; expires is set only on
 *           papers that lapse.
 *   assets  id -> equipment on loan, each { kind, item, serial, issued,
 *           condition }. kind is laptop, phone, monitor, badge or car; a
 *           car's serial is its plate; condition is New, Good, Fair or
 *           Needs repair.
 *   spares  unassigned equipment waiting in the IT closet (no issued date).
 *   docsOf(id), assetsOf(id)  private copies of one person's lists.
 *
 * Swap in exports from your own HR and IT tools in the same shape. The
 * demo treats October 9, 2026 as today.
 */
(() => {
	'use strict';

	/* The two flavors of tax paperwork that appear on file. */
	const [W4, ANNUAL] = ['Form W-4', 'Tax form 2026'];

	/* Training on record. A course with a term in years lapses that many years
     after it was passed; the rest never expire. */
	const COURSES = {
		firstAid: { title: 'First aid certificate', years: 3 },
		aws: { title: 'AWS certification', years: 3 },
		securityPlus: { title: 'Security+ certificate', years: 3 },
		accounting: { title: 'Accounting license', years: 2 },
		sales: { title: 'Sales training' },
		product: { title: 'Product training' },
		design: { title: 'Design course' },
		privacy: { title: 'Data privacy course' },
	};

	/* Every model the company hands out, filed under the kind the page draws
     an icon for, then flattened so a record can name its model alone. */
	const KINDS = {
		laptop: { air13: 'MacBook Air 13"', pro14: 'MacBook Pro 14"', thinkpad: 'ThinkPad X1 Carbon' },
		phone: { iphone: 'iPhone 15', pixel: 'Pixel 8' },
		monitor: { dell27: 'Dell 27" monitor' },
		badge: { badge: 'Door badge' },
		car: { rav4: 'Toyota RAV4 Hybrid', corolla: 'Toyota Corolla Hybrid' },
	};
	const MODELS = Object.fromEntries(
		Object.entries(KINDS).flatMap(([kind, models]) =>
			Object.entries(models).map(([model, item]) => [model, { kind, item }]),
		),
	);

	/* One file per person: start date, passport expiry, which tax form, the day
     the equipment agreement was signed, then any raise letter, course, or a
     tax form that came in outside the January 14 round for existing staff. */
	const PAPERS = {
		rc: dossier('2018-05-14', '2031-06-04', W4, '2018-06-04', { course: ['firstAid', '2024-01-21'] }),
		km: dossier('2019-01-21', '2028-02-11', W4, '2019-02-11', { course: ['firstAid', '2024-02-27'] }),
		as: dossier('2019-07-29', '2028-08-19', ANNUAL, '2019-08-19', { raise: '2026-03-25' }),
		rd: dossier('2019-09-16', '2030-10-07', W4, '2019-10-07'),
		ew: dossier('2019-12-23', '2032-01-13', W4, '2020-01-13', { course: ['sales', '2024-07-28'] }),
		pr: dossier('2020-03-30', '2030-04-20', W4, '2020-04-20', { course: ['firstAid', '2024-10-28'] }),
		hw: dossier('2020-05-25', '2027-06-15', ANNUAL, '2020-06-15', { course: ['design', '2025-03-26'] }),
		ev: dossier('2020-09-07', '2031-09-28', ANNUAL, '2020-09-28', { course: ['product', '2024-08-08'] }),
		th: dossier('2020-09-14', '2030-10-05', ANNUAL, '2020-10-05'),
		yh: dossier('2020-10-12', '2031-11-02', ANNUAL, '2020-11-02', {
			raise: '2026-09-25',
			course: ['firstAid', '2024-02-12'],
		}),
		ds: dossier('2020-12-28', '2027-01-18', ANNUAL, '2021-01-18', { course: ['aws', '2025-07-28'] }),
		mk: dossier('2021-01-11', '2032-02-01', ANNUAL, '2021-02-01'),
		ja: dossier('2021-02-15', '2031-03-08', W4, '2021-03-08'),
		cr: dossier('2021-03-22', '2031-04-12', ANNUAL, '2021-04-12', { course: ['privacy', '2025-06-26'] }),
		ka: dossier('2021-05-03', '2028-05-24', ANNUAL, '2021-05-24', { course: ['aws', '2025-06-09'] }),
		dr: dossier('2021-05-24', '2032-06-14', ANNUAL, '2021-06-14', { course: ['firstAid', '2025-06-23'] }),
		mb: dossier('2021-07-05', '2029-07-26', W4, '2021-07-26'),
		pd: dossier('2021-07-26', '2030-08-16', W4, '2021-08-16', { course: ['securityPlus', '2025-03-18'] }),
		sl: dossier('2021-08-16', '2029-09-06', ANNUAL, '2021-09-06', { course: ['firstAid', '2025-03-04'] }),
		ta: dossier('2021-09-27', '2027-10-18', ANNUAL, '2021-10-18', { course: ['product', '2024-02-20'] }),
		og: dossier('2021-11-08', '2028-11-29', ANNUAL, '2021-11-29'),
		ab: dossier('2021-12-20', '2031-01-10', W4, '2022-01-10', { course: ['firstAid', '2024-05-20'] }),
		nfe: dossier('2022-01-31', '2029-02-21', ANNUAL, '2022-02-21', { course: ['design', '2025-03-22'] }),
		gl: dossier('2022-02-14', '2027-03-07', ANNUAL, '2022-03-07', { course: ['product', '2024-04-30'] }),
		so: dossier('2022-03-21', '2028-04-11', ANNUAL, '2022-04-11'),
		rk: dossier('2022-04-25', '2027-05-16', ANNUAL, '2022-05-16', { course: ['firstAid', '2024-01-29'] }),
		hs: dossier('2022-06-06', '2029-06-27', ANNUAL, '2022-06-27', { course: ['accounting', '2024-01-27'] }),
		ih: dossier('2022-08-01', '2029-08-22', ANNUAL, '2022-08-22', { course: ['firstAid', '2025-05-29'] }),
		fr: dossier('2022-08-22', '2030-09-12', ANNUAL, '2022-09-12', { raise: '2026-06-25' }),
		lf: dossier('2022-09-12', '2028-10-03', ANNUAL, '2022-10-03', { course: ['sales', '2025-04-08'] }),
		nf: dossier('2022-10-24', '2032-11-14', ANNUAL, '2022-11-14', { course: ['product', '2025-01-28'] }),
		im: dossier('2022-11-14', '2032-12-05', ANNUAL, '2022-12-05', { course: ['aws', '2025-06-15'] }),
		ms: dossier('2022-12-19', '2028-01-09', ANNUAL, '2023-01-09', { course: ['firstAid', '2025-03-29'] }),
		yt: dossier('2023-02-06', '2031-02-27', ANNUAL, '2023-02-27', { course: ['aws', '2024-10-05'] }),
		cm: dossier('2023-02-20', '2032-03-13', ANNUAL, '2023-03-13', { course: ['firstAid', '2024-03-19'] }),
		za: dossier('2023-03-27', '2029-04-17', ANNUAL, '2023-04-17', { course: ['sales', '2024-04-24'] }),
		cd: dossier('2023-05-01', '2027-05-22', ANNUAL, '2023-05-22', { course: ['product', '2024-11-28'] }),
		lg: dossier('2023-06-19', '2027-07-10', W4, '2023-07-10'),
		jt: dossier('2023-07-31', '2028-08-21', ANNUAL, '2023-08-21'),
		sr: dossier('2023-08-28', '2027-09-18', ANNUAL, '2023-09-18', { course: ['privacy', '2025-06-18'] }),
		lm: dossier('2023-09-11', '2031-10-02', W4, '2023-10-02', { course: ['aws', '2023-12-04'] }),
		lo: dossier('2023-12-25', '2031-01-15', ANNUAL, '2024-01-15', { course: ['firstAid', '2025-03-18'] }),
		hb: dossier('2024-01-15', '2030-02-05', W4, '2024-02-05'),
		rf: dossier('2024-02-19', '2030-03-11', ANNUAL, '2024-03-11'),
		jp: dossier('2024-03-18', '2030-04-08', ANNUAL, '2024-04-08', { course: ['aws', '2025-04-24'] }),
		ao: dossier('2024-04-22', '2028-05-13', ANNUAL, '2024-05-13', { course: ['design', '2024-06-06'] }),
		nd: dossier('2024-05-13', '2030-06-03', ANNUAL, '2024-06-03', { course: ['firstAid', '2025-06-19'] }),
		dk: dossier('2024-07-01', '2031-07-22', W4, '2024-07-22', { course: ['privacy', '2024-07-22'] }),
		op: dossier('2024-08-19', '2031-09-09', W4, '2024-09-09', { course: ['sales', '2025-01-23'] }),
		pm: dossier('2025-02-17', '2031-03-10', ANNUAL, '2025-03-10'),
		mo: dossier('2025-07-14', '2032-08-04', ANNUAL, '2025-08-04'),
		bc: dossier('2026-08-24', '2029-09-14', ANNUAL, '2026-09-14', { taxFiled: '2026-09-14' }),
		wa: dossier('2026-09-21', '2028-10-12', W4, '2026-09-21', { taxFiled: '2026-09-21' }),
		ak: dossier('2026-09-14', '2028-10-12', ANNUAL, '2026-09-14', { taxFiled: '2026-09-14' }),
		si: dossier('2026-09-25', '2030-10-19', ANNUAL, '2026-09-25', { taxFiled: '2026-09-25' }),
		jw: dossier('2026-10-01', '2029-11-02', ANNUAL, '2026-10-01', { taxFiled: null }),
	};

	/* Equipment each person has signed out, in the order the Equipment card shows it. */
	const ON_LOAN = {
		rc: [
			held('air13', 'C028S50DAP', '2024-02-27', 'Needs repair'),
			held('iphone', 'FSETN1W94H', '2024-06-25'),
			held('badge', 'BDG-1018', '2018-06-04'),
		],
		km: [
			held('thinkpad', 'PF-B1N9WK', '2025-04-17'),
			held('iphone', 'FXRCZL7UF2', '2024-09-20'),
			held('badge', 'BDG-1031', '2019-02-11'),
			held('rav4', 'HXJ-9755', '2025-01-13'),
		],
		as: [
			held('pro14', 'C02Z3QBYM8', '2024-02-12'),
			held('iphone', 'FP1N9WH4RC', '2024-09-04', 'Needs repair'),
			held('badge', 'BDG-1051', '2019-08-19'),
		],
		rd: [
			held('thinkpad', 'PF-1XJPAD', '2024-06-07'),
			held('iphone', 'FK3QVGM8D0', '2025-07-07'),
			held('badge', 'BDG-1073', '2019-10-07'),
		],
		ew: [
			held('air13', 'C027F2PAZL', '2024-08-24'),
			held('iphone', 'FKZL7UF2PA', '2024-07-18'),
			held('badge', 'BDG-1093', '2020-01-13'),
			held('rav4', '5D0-7411', '2025-01-13'),
		],
		pr: [
			held('air13', 'C025TEK6BY', '2025-05-01'),
			held('pixel', '3ARH49WZLR', '2024-06-30'),
			held('badge', 'BDG-1111', '2020-04-20'),
		],
		hw: [
			held('pro14', 'C02AQ3GV6K', '2023-08-05', 'Fair'),
			held('iphone', 'FUCR4HW9N1', '2024-10-13'),
			held('badge', 'BDG-1130', '2020-06-15'),
		],
		ev: [
			held('air13', 'C02EETN1YB', '2023-08-11', 'Needs repair'),
			held('pixel', '3AYLZU72FA', '2025-03-12'),
			held('badge', 'BDG-1150', '2020-09-28'),
		],
		th: [
			held('pro14', 'C02HF2PAXJ', '2024-12-18'),
			held('iphone', 'FTH4RC1N9W', '2025-03-15'),
			held('badge', 'BDG-1171', '2020-10-05'),
		],
		yh: [
			held('air13', 'C02W0DS5JX', '2024-02-13', 'Fair'),
			held('pixel', '3A8JXAP0DS', '2025-06-26'),
			held('badge', 'BDG-1192', '2020-11-02'),
		],
		ds: [
			held('pro14', 'C02N4HW9LZ', '2024-09-24'),
			held('iphone', 'F6S5JXAP2F', '2025-06-10'),
			held('badge', 'BDG-1212', '2021-01-18'),
		],
		mk: [held('air13', 'C02D1N9WH4', '2024-02-02', 'Fair'), held('iphone', 'F1H4RC1N9W', '2025-06-07')],
		ja: [
			held('thinkpad', 'PF-LN1ET6', '2023-12-31', 'Fair'),
			held('iphone', 'FY6KYBN1ET', '2024-10-29'),
			held('badge', 'BDG-1256', '2021-03-08'),
		],
		cr: [
			held('air13', 'C026JXAP0D', '2024-06-20', 'Needs repair'),
			held('iphone', 'FQ6KYBQ3GV', '2024-09-11'),
			held('badge', 'BDG-1274', '2021-04-12'),
		],
		ka: [
			held('pro14', 'C02VXJ5SD0', '2025-03-04'),
			held('iphone', 'F5F2PAZL7U', '2025-04-12'),
			held('badge', 'BDG-1297', '2021-05-24'),
		],
		dr: [
			held('air13', 'C02H7UZLPA', '2024-06-23'),
			held('pixel', '3ATPAF27UZ', '2024-10-16'),
			held('badge', 'BDG-1313', '2021-06-14'),
		],
		mb: [
			held('air13', 'C02SCRLZU7', '2023-11-23', 'Fair'),
			held('iphone', 'FGW94HETN1', '2024-07-03'),
			held('badge', 'BDG-1338', '2021-07-26'),
			held('corolla', '44H-4628', '2024-05-13'),
		],
		pd: [
			held('pro14', 'C02Z3QBYK6', '2025-05-19'),
			held('iphone', 'F9M8VG5SD0', '2025-05-14'),
			held('badge', 'BDG-1353', '2021-08-16'),
		],
		sl: [
			held('air13', 'C02WU72FCR', '2025-02-01'),
			held('pixel', '3AJJXS50D8', '2024-12-26'),
			held('badge', 'BDG-1374', '2021-09-06'),
		],
		ta: [
			held('air13', 'C02ELZU72F', '2024-06-14', 'Needs repair'),
			held('pixel', '3A00D8MJXS', '2025-04-01'),
			held('badge', 'BDG-1396', '2021-10-18'),
		],
		og: [
			held('pro14', 'C02XF27UXJ', '2024-08-06'),
			held('iphone', 'FBRCH49W1N', '2025-04-30'),
			held('badge', 'BDG-1417', '2021-11-29'),
		],
		ab: [
			held('air13', 'C026U72FCR', '2024-04-27'),
			held('pixel', '3AUJXS50D8', '2024-06-13'),
			held('badge', 'BDG-1432', '2022-01-10'),
		],
		nfe: [held('pro14', 'C02JU7LZAP', '2024-03-12', 'Fair'), held('iphone', 'FUAP2FU7LZ', '2024-06-07')],
		gl: [
			held('air13', 'C02J0D8MGV', '2024-07-28'),
			held('pixel', '3A0CRLZW94', '2025-07-10'),
			held('badge', 'BDG-1478', '2022-03-07'),
		],
		so: [
			held('pro14', 'C02KM8D05S', '2024-01-19', 'Fair'),
			held('iphone', 'FX5SXJM8D0', '2025-03-09', 'Needs repair'),
			held('badge', 'BDG-1493', '2022-04-11'),
		],
		rk: [
			held('air13', 'C02E2FAPLZ', '2024-12-31'),
			held('pixel', '3AUN1W94HC', '2025-03-16'),
			held('badge', 'BDG-1518', '2022-05-16'),
		],
		hs: [held('thinkpad', 'PF-Y4HW9N', '2025-01-22'), held('badge', 'BDG-1534', '2022-06-27')],
		ih: [
			held('thinkpad', 'PF-YLZCR4', '2025-05-10'),
			held('iphone', 'FJ8M0DQ3GV', '2024-06-03'),
			held('badge', 'BDG-1572', '2022-08-22'),
		],
		fr: [
			held('pro14', 'C021VG3QBY', '2025-03-24'),
			held('iphone', 'FBBYK6VG3Q', '2025-07-13'),
			held('badge', 'BDG-1591', '2022-09-12'),
		],
		lf: [
			held('air13', 'C02R9W1NTE', '2023-12-06', 'Fair'),
			held('iphone', 'F3TEK69W1N', '2024-07-12', 'Needs repair'),
			held('badge', 'BDG-1611', '2022-10-03'),
		],
		nf: [
			held('air13', 'C021ZL7UH4', '2023-07-05'),
			held('pixel', '3ADH4RCZL7', '2025-06-19', 'Needs repair'),
			held('badge', 'BDG-1635', '2022-11-14'),
		],
		im: [held('pro14', 'C029H49WZL', '2024-03-03'), held('iphone', 'FXZLRCH49W', '2025-01-24')],
		ms: [
			held('air13', 'C02PRCZL7U', '2025-04-05'),
			held('pixel', '3AZ9WH4TE1', '2025-05-30'),
			held('badge', 'BDG-1677', '2023-01-09'),
		],
		yt: [
			held('pro14', 'C026AP2FS5', '2024-03-11'),
			held('iphone', 'FQGV8M0DS5', '2025-02-14'),
			held('badge', 'BDG-1710', '2023-02-27'),
		],
		cm: [
			held('air13', 'C02RM8VG5S', '2023-09-07', 'Fair'),
			held('pixel', '3AX5SD0M8V', '2024-11-19'),
			held('badge', 'BDG-1733', '2023-03-13'),
		],
		za: [
			held('air13', 'C022JXAP2F', '2025-05-02'),
			held('iphone', 'FNS5JX8M0D', '2025-03-06'),
			held('badge', 'BDG-1754', '2023-04-17'),
		],
		cd: [held('air13', 'C028LZU74H', '2025-05-20', 'Needs repair'), held('pixel', '3AS8MGVQ3Y', '2025-04-05')],
		lg: [
			held('pro14', 'C02WGV8M0D', '2023-07-10'),
			held('iphone', 'FG4HW9LZCR', '2024-12-04'),
			held('dell27', 'CN-91N9WK6', '2023-07-10'),
			held('badge', 'BDG-1790', '2023-07-10'),
			held('corolla', '4Q3-5806', '2024-09-08'),
		],
		jt: [held('air13', 'C02F1NTEH4', '2023-08-21', 'Fair'), held('pixel', '3A3H49W1NT', '2024-10-16')],
		sr: [
			held('air13', 'C028Q3GV6K', '2023-09-18', 'Fair'),
			held('iphone', 'FJ6KYBQ3GV', '2025-06-26'),
			held('badge', 'BDG-1838', '2023-09-18'),
		],
		lm: [
			held('pro14', 'C02CYB6KGB', '2023-10-02', 'Fair'),
			held('iphone', 'FNETN1W94H', '2025-06-16'),
			held('dell27', 'CN-R1NTE1N', '2023-10-02'),
		],
		lo: [
			held('thinkpad', 'PF-LS5JXA', '2024-01-15', 'Fair'),
			held('iphone', 'FAAP2FS5JX', '2025-03-22'),
			held('badge', 'BDG-1878', '2024-01-15'),
		],
		hb: [
			held('air13', 'C02FPAF27U', '2024-02-05', 'Fair'),
			held('pixel', '3AM5SXJM8D', '2025-06-01'),
			held('badge', 'BDG-1893', '2024-02-05'),
		],
		rf: [
			held('air13', 'C02HXJ5SD0', '2024-03-11'),
			held('iphone', 'F5D0M8XJ5S', '2024-08-03', 'Needs repair'),
			held('badge', 'BDG-1915', '2024-03-11'),
		],
		jp: [
			held('pro14', 'C02ZXJPAF2', '2024-04-08', 'Fair'),
			held('iphone', 'FBF27UXJPA', '2024-06-26'),
			held('badge', 'BDG-1935', '2024-04-08'),
		],
		ao: [
			held('pro14', 'C02D7UF2PA', '2024-05-13'),
			held('iphone', 'FTK6TE3QBY', '2025-07-17'),
			held('badge', 'BDG-1957', '2024-05-13'),
		],
		nd: [
			held('air13', 'C02P3QVGM8', '2024-06-03'),
			held('pixel', '3ADM8D03QV', '2024-06-03'),
			held('badge', 'BDG-1971', '2024-06-03'),
		],
		dk: [
			held('air13', 'C02G6KYBN1', '2024-07-22'),
			held('iphone', 'F4N1ET6KYB', '2024-07-22'),
			held('badge', 'BDG-1990', '2024-07-22'),
		],
		op: [
			held('air13', 'C0200D8MJX', '2024-09-09', 'Needs repair'),
			held('iphone', 'FNQ3YB6KET', '2024-09-09'),
			held('badge', 'BDG-2018', '2024-09-09'),
		],
		pm: [held('air13', 'C028YB6KET', '2025-03-10'), held('iphone', 'FUCRLZW94H', '2025-03-10')],
		mo: [held('thinkpad', 'PF-95SD0P', '2025-08-04'), held('badge', 'BDG-2075', '2025-08-04')],
		bc: [
			held('air13', 'C02JGVQ30D', '2026-09-14', 'New'),
			held('pixel', '3AUYB6KETN', '2026-09-14', 'New'),
			held('badge', 'BDG-2110', '2026-09-14'),
		],
		wa: [
			held('thinkpad', 'PF-55SD0P', '2026-10-08', 'New'),
			held('iphone', 'FHPAXJ5SD0', '2026-10-08', 'New'),
			held('badge', 'BDG-2131', '2026-10-08', 'New'),
		],
		ak: [held('pro14', 'C02TH4RC1N', '2026-10-08', 'New'), held('iphone', 'FD7UF2PAXJ', '2026-10-08', 'New')],
		si: [
			held('air13', 'C021D0M8VG', '2026-10-08', 'New'),
			held('pixel', '3ABVG3QD0M', '2026-10-08', 'New'),
			held('badge', 'BDG-2173', '2026-10-08', 'New'),
		],
		jw: [
			held('pro14', 'C0282FAPJX', '2026-10-08', 'New'),
			held('iphone', 'FQETN1YB6K', '2026-10-08', 'New'),
			held('badge', 'BDG-2196', '2026-10-08', 'New'),
		],
	};

	/* Spare stock the assign dialog offers. */
	const CLOSET = [
		spare('air13', 'C0233QVGK6'),
		spare('air13', 'C02Y2FU7JX', 'Good'),
		spare('pro14', 'C02BPAXJ5S'),
		spare('thinkpad', 'PF-6W94HC', 'Good'),
		spare('iphone', 'FKH49W1NTE'),
		spare('pixel', '3AEN1ET6KY', 'Good'),
		spare('dell27', 'CN-T9WH4TE'),
		spare('badge', 'BDG-2301'),
		spare('corolla', '55S-6402', 'Good'),
	];

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.employeeRecords = {
		docs: PAPERS,
		assets: ON_LOAN,
		spares: CLOSET,
		/** One person's papers as fresh rows; an unknown id yields an empty list. */
		docsOf(id) {
			return cloneRows(PAPERS[id]);
		},
		/** One person's equipment as fresh rows; an unknown id yields an empty list. */
		assetsOf(id) {
			return cloneRows(ON_LOAN[id]);
		},
	};

	/**
	 * Builds one person's papers in the order the Documents card lists them:
	 * contract, raise letter, passport, tax form, course, equipment agreement.
	 * The contract and passport were both filed on the start date.
	 * @param {string} started  first day, YYYY-MM-DD
	 * @param {string} passportUntil  passport expiry
	 * @param {string} taxForm  W4 or ANNUAL
	 * @param {string} signed  day the equipment agreement was filed
	 * @param {{raise?: string, course?: [string, string], taxFiled?: string|null}} [extras]
	 *   taxFiled defaults to the January round; null marks a form still owed.
	 */
	function dossier(started, passportUntil, taxForm, signed, { raise, course, taxFiled = '2026-01-14' } = {}) {
		const papers = [{ name: 'Employment contract', type: 'Contract', uploaded: started }];
		if (raise) papers.push({ name: 'Pay raise letter', type: 'Letter', uploaded: raise });
		papers.push(
			{ name: 'Passport', type: 'ID', uploaded: started, expires: passportUntil },
			{ name: taxForm, type: 'Tax form', uploaded: taxFiled },
		);
		if (course) papers.push(certificate(course));
		papers.push({ name: 'Equipment agreement', type: 'Agreement', uploaded: signed });
		return papers;
	}

	/** Turns a [course, date passed] pair into a record; only termed courses get an expiry. */
	function certificate([courseKey, passedOn]) {
		const { title, years } = COURSES[courseKey];
		const record = { name: title, type: 'Certificate', uploaded: passedOn };
		return years ? { ...record, expires: `${Number(passedOn.slice(0, 4)) + years}${passedOn.slice(4)}` } : record;
	}

	/** Equipment signed out to someone; most of it is in good shape. */
	function held(model, serial, issued, condition = 'Good') {
		return { ...MODELS[model], serial, issued, condition };
	}

	/** Equipment still in the closet, so it carries no issue date; most of it is unopened. */
	function spare(model, serial, condition = 'New') {
		return { ...MODELS[model], serial, condition };
	}

	/** Shallow-copies each row so a page can edit its list without touching ours. */
	function cloneRows(rows = []) {
		return rows.map((row) => ({ ...row }));
	}
})();
