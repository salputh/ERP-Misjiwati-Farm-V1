/**
 * Demo calling state behind the Video Call and Voice Call pages.
 *
 * The person signed in is John Armstrong (roster id "ja"). Callers are roster
 * ids from people.js and the video state is keyed by a meeting id from
 * meetings.js, so both files must load before this one; that is how names,
 * job titles and meeting times agree from page to page.
 *
 * Members of window.Basalt.data.calls:
 *   NOW     fixed demo time, Thursday, October 8, 2026 at 11:20 AM
 *   ME      roster id of the signed-in person
 *   video   per meeting id, who is muted, who has cameraOff, whose hands
 *           are raised (roster ids), and chat as [who, 'H:MM', text]
 *   voice   { who, seconds }: the call Voice Call opens with when the URL
 *           has no ?id=, and how many seconds it has already run
 *   recent  call history, newest first, as { who, dir, at, mins }
 *
 * To wire up a real calling service, supply the same members in the same
 * shape and make NOW a plain new Date().
 */
(() => {
	'use strict';

	/* JavaScript counts months from zero, so 9 is October. */
	const YEAR = 2026;
	const MONTH = 9;

	/* Call history grouped by day of the month, newest day first. Each row is
     caller, direction, 'H:MM' on a 24-hour clock, and minutes on the line;
     a missed call is always zero minutes. */
	const historyByDay = [
		[
			8,
			[
				['pr', 'missed', '10:52', 0],
				['km', 'out', '10:31', 6],
				['rd', 'in', '9:05', 14],
			],
		],
		[
			7,
			[
				['lg', 'out', '16:48', 9],
				['ih', 'in', '14:15', 3],
				['mb', 'missed', '11:40', 0],
			],
		],
		[
			6,
			[
				['as', 'in', '17:20', 22],
				['lo', 'out', '13:10', 4],
				['pd', 'missed', '10:02', 0],
				['ka', 'in', '8:47', 11],
			],
		],
	];

	start();

	/** Builds the calls object and attaches it to the shared demo namespace. */
	function start() {
		window.Basalt.data ??= {};
		window.Basalt.data.calls = {
			NOW: onDay(8, '11:20'),
			ME: 'ja',
			video: { m10: releaseDecision() },
			voice: { who: 'km', seconds: 272 },
			recent: flattenHistory(),
		};
	}

	/**
	 * Live state of meeting m10, the Team app 6.5 go or no-go call. A
	 * meeting left out of `video` opens with every camera on, nobody muted,
	 * no raised hands and an empty chat.
	 */
	function releaseDecision() {
		return {
			muted: ['as', 'jp'],
			cameraOff: ['th'],
			hands: ['pr'],
			chat: [
				['og', '11:02', 'The beta report and the bug list are in the meeting files.'],
				['fr', '11:06', 'Crash numbers run from Monday to this morning, 4,180 sessions.'],
				['th', '11:09', 'The Android 11 fix is in review and should merge today.'],
				['pr', '11:12', 'Support has the 6.5 help article ready to publish.'],
				['jp', '11:15', 'Duplicate photos: I can make it happen on a slow connection.'],
				['as', '11:18', 'Let’s hold the vote until we have seen the two high bugs.'],
			],
		};
	}

	/** Turns the day groups into one newest-first list of log records. */
	function flattenHistory() {
		const records = [];
		for (const [day, rows] of historyByDay) {
			for (const [who, dir, clock, mins] of rows) {
				records.push({ who, dir, at: onDay(day, clock), mins });
			}
		}
		return records;
	}

	/**
	 * A local Date in the demo month.
	 * @param {number} day    day of October
	 * @param {string} clock  'H:MM' on a 24-hour clock
	 * @returns {Date}
	 */
	function onDay(day, clock) {
		const [hours, minutes] = clock.split(':').map(Number);
		return new Date(YEAR, MONTH, day, hours, minutes);
	}
})();
