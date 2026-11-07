/**
 * Every written report on Heidi Fairley's record, for
 * imaging-and-reports.html: lab reports, imaging reads, pathology and the
 * letters that came with her. Lab values and imaging studies are not
 * repeated here; a report names its panels or its study and the page reads
 * them from window.Basalt.data.clinicRecord (clinic-record.js).
 * Published as window.Basalt.data.clinicReports.
 */
(() => {
	'use strict';

	/* The kinds of report, each with its icon and chart color. */
	const KINDS = {
		lab: { name: 'Labs', one: 'Lab report', icon: 'bi-droplet-half', tone: 7 },
		imaging: { name: 'Imaging', one: 'Imaging report', icon: 'bi-images', tone: 4 },
		pathology: { name: 'Pathology', one: 'Pathology report', icon: 'bi-eyedropper', tone: 5 },
		letter: { name: 'Letters', one: 'Letter', icon: 'bi-envelope-paper', tone: 3 },
	};

	/* Newest first. `panels` and `study` point into clinic-record.js; a
	   study of our own carries its scan kind instead. */
	const REPORTS = [
		{
			id: 'labs-2026-09-30',
			kind: 'lab',
			title: 'Blood work, five panels',
			on: '2026-09-30',
			signed: '2026-10-01',
			place: 'us',
			ordered: 'ev',
			signer: 'Broadway Street Clinic laboratory',
			status: 'final',
			reviewed: false,
			panels: ['cmp', 'cbc', 'lipids', 'sugar', 'thyroid'],
			impression:
				'Fasting glucose, ALT, alkaline phosphatase, LDL and HbA1c above range. Liver tests have climbed since naproxen began.',
		},
		{
			id: 'img-knee-follow-up',
			kind: 'imaging',
			title: 'X-ray, left knee, follow-up',
			on: '2026-10-02',
			signed: '2026-10-02',
			place: 'us',
			ordered: 'ta',
			signer: 'Dr. Russell Ashby',
			status: 'preliminary',
			reviewed: false,
			scan: 'xray-knee',
			findings: [
				'Standing views of the left knee. Joint space on the inner side unchanged since July 2025.',
				'No fracture, no loose body. Mild swelling in the front of the joint.',
			],
			impression: 'Stable knee. Final read waits for the radiologist.',
		},
		{
			id: 'path-skin-2026',
			kind: 'pathology',
			title: 'Skin biopsy, right shoulder',
			on: '2026-09-18',
			signed: '2026-09-24',
			place: 'bayview',
			ordered: 'ev',
			signer: 'Dr. Iris Moran, pathologist',
			status: 'final',
			reviewed: false,
			specimen: 'Shave biopsy, 6 mm brown spot, right shoulder',
			findings: [
				'Nests of evenly spaced cells where the skin layers meet. No atypia, no mitoses.',
				'Margins are clear by at least 1 mm on every side.',
			],
			impression: 'Benign compound mole, fully removed. No follow-up beyond yearly skin checks.',
		},
		{
			id: 'img-ecg',
			kind: 'imaging',
			title: 'ECG, resting',
			on: '2026-08-12',
			signed: '2026-08-12',
			place: 'us',
			ordered: 'ev',
			signer: 'Dr. Robert Hayes',
			status: 'final',
			reviewed: true,
			study: 'img-ecg',
			findings: [
				'Sinus rhythm at 74 beats a minute. Normal axis and intervals.',
				'No signs of strain from her blood pressure.',
			],
			impression: 'Normal ECG, unchanged since 2024.',
		},
		{
			id: 'labs-2026-06-03',
			kind: 'lab',
			title: 'Blood work, five panels',
			on: '2026-06-03',
			signed: '2026-06-04',
			place: 'us',
			ordered: 'ev',
			signer: 'Broadway Street Clinic laboratory',
			status: 'final',
			reviewed: true,
			panels: ['cmp', 'cbc', 'lipids', 'sugar', 'thyroid'],
			impression: 'LDL and HbA1c just above range. ALT at the top of normal.',
		},
		{
			id: 'img-mri',
			kind: 'imaging',
			title: 'MRI, left knee',
			on: '2025-07-18',
			signed: '2025-07-21',
			place: 'imaging',
			ordered: 'ta',
			signer: 'Dr. Lauren Fox, radiologist',
			status: 'amended',
			reviewed: true,
			study: 'img-mri',
			findings: [
				'Horizontal tear in the back of the inner meniscus, reaching the lower surface.',
				'Cruciate and side ligaments intact. Small amount of fluid in the joint.',
			],
			impression: 'Inner meniscus tear. Addendum Jul 21: tear length corrected to 9 mm.',
		},
		{
			id: 'img-knee',
			kind: 'imaging',
			title: 'X-ray, left knee',
			on: '2025-07-02',
			signed: '2025-07-02',
			place: 'us',
			ordered: 'ta',
			signer: 'Dr. Russell Ashby',
			status: 'final',
			reviewed: true,
			study: 'img-knee',
			findings: [
				'Three views of the left knee after a twisting fall.',
				'No fracture. Joint space slightly narrowed on the inner side.',
			],
			impression: 'No fracture. MRI if pain on twisting continues.',
		},
		{
			id: 'letter-bayview-2024',
			kind: 'letter',
			title: 'Discharge summary',
			on: '2024-11-21',
			signed: '2024-11-21',
			place: 'bayview',
			ordered: null,
			signer: 'Dr. Rachel Moore',
			status: 'final',
			reviewed: true,
			to: 'Dr. Emily Pearce, Broadway Street Clinic',
			findings: [
				'Admitted Nov 19 with an asthma flare after a chest cold. Chest X-ray clear.',
				'Treated with nebulizers and five days of prednisone. Home on her usual inhalers.',
			],
			impression: 'Please review her inhaler technique within two weeks.',
		},
		{
			id: 'img-chest',
			kind: 'imaging',
			title: 'X-ray, chest',
			on: '2024-11-19',
			signed: '2024-11-19',
			place: 'bayview',
			ordered: 'nh',
			signer: 'Dr. Lauren Fox, radiologist',
			status: 'final',
			reviewed: true,
			study: 'img-chest',
			findings: ['Front and side views. Lungs clear, no pneumonia, no fluid.', 'Heart size normal.'],
			impression: 'Clear chest during an asthma flare.',
		},
		{
			id: 'genetics',
			kind: 'lab',
			title: 'Genetic testing, four genes',
			on: '2024-05-21',
			signed: '2024-06-04',
			place: 'us',
			ordered: 'ev',
			signer: 'Dr. Sophie Arnold, clinical geneticist',
			status: 'final',
			reviewed: true,
			genes: true,
			specimen: 'Blood, sent to the clinic’s reference lab',
			impression:
				'No harmful BRCA change. CYP2C19 intermediate metabolizer: avoid clopidogrel. Statins at usual doses.',
		},
		{
			id: 'letter-mercy-2001',
			kind: 'letter',
			title: 'Discharge letter, appendix',
			on: '2001-08-24',
			signed: '2001-08-24',
			place: 'mercy',
			ordered: null,
			signer: 'Dr. Paul Whitman, surgeon',
			status: 'final',
			reviewed: true,
			to: 'Her primary care doctor',
			findings: [
				'Admitted Aug 22 with pain low on the right. Appendix removed by keyhole surgery the same night.',
				'Recovery without trouble. Penicillin allergy noted; given another antibiotic.',
			],
			impression: 'Stitches out in ten days. No lifting for four weeks.',
		},
		{
			id: 'path-appendix-2001',
			kind: 'pathology',
			title: 'Appendix, after removal',
			on: '2001-08-22',
			signed: '2001-08-27',
			place: 'mercy',
			ordered: null,
			signer: 'Cedar Ridge pathology',
			status: 'final',
			reviewed: true,
			specimen: 'Appendix, 7 cm',
			findings: ['Swelling and pus through the wall of the appendix.', 'No tumor seen.'],
			impression: 'Acute appendicitis. Nothing further needed.',
		},
		{
			id: 'letter-physio-2026',
			kind: 'letter',
			title: 'Referral to physical therapy',
			on: '2026-10-02',
			signed: '2026-10-02',
			place: 'us',
			ordered: null,
			signer: 'Dr. Russell Ashby',
			status: 'final',
			reviewed: true,
			to: 'Northside PT',
			findings: [
				'Six weeks of physical therapy for an inner meniscus tear of the left knee.',
				'Please work on strength and balance; avoid deep squats for now.',
			],
			impression: 'Please send a short note after the first and last session.',
		},
	];

	window.Basalt.data = window.Basalt.data || {};
	window.Basalt.data.clinicReports = {
		patient: { name: 'Heidi Fairley', id: '#10427', born: '1979-03-14' },
		kinds: KINDS,
		reports: REPORTS.sort((a, b) => b.on.localeCompare(a.on)),
		/** A report by id, or undefined. */
		find(id) {
			return REPORTS.find((r) => r.id === id);
		},
	};
})();
