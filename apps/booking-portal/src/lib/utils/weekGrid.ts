import {
	applyExceptions,
	exceptionsOn,
	zonedDateKey,
	zonedDateParts,
	zonedStartOfDay,
	type AvailabilityWindow,
	type DayException
} from '$lib/utils/availability';
import { clockLabel, type WeeklyWindow } from '$lib/utils/availabilityEditor';
import { dayNumber, weekdayAbbrev } from '$lib/utils/format';

type GridSession = { startsAt: Date; durationMin: number; clientName: string; type: string };

export type WeekGridInput = {
	weekStart: Date;
	availability: WeeklyWindow[];
	/** Confirmed and completed sessions this week. */
	weekSessions: GridSession[];
	/** Requests still awaiting the coach (any week; only this week's are drawn). */
	pendingRequests: GridSession[];
	/** Times clients have asked to move confirmed sessions to — held until answered. */
	proposedTimes?: GridSession[];
	/** One-off changes touching this week (time off / extra hours). */
	oneOffs?: (DayException & { note?: string | null })[];
};

/** Reschedule requests as grid sessions at the time they ask for. */
export const proposedGridTimes = (
	requests: (Omit<GridSession, 'startsAt'> & { latestProposal: { startsAt: Date } })[]
): GridSession[] =>
	requests.map((r) => ({
		startsAt: r.latestProposal.startsAt,
		durationMin: r.durationMin,
		clientName: r.clientName,
		type: r.type
	}));

const CELL_MIN = 30;
const DAY_MS = 86_400_000;

export type GridCellState = 'open' | 'booked' | 'requested' | 'off' | 'closed';

const within = (windows: AvailabilityWindow[], start: number, end: number) =>
	windows.some((w) => w.startMin < end && w.endMin > start);

/** "Tessa Lim" → "Tessa L." — short enough for a grid cell. */
const shortName = (fullName: string) => {
	const [first, ...rest] = fullName.trim().split(/\s+/);
	const last = rest.at(-1);
	return last ? `${first} ${last[0]}.` : first;
};

/** This week (Monday–Sunday, coach's zone) as 30-minute rows, each cell open /
 * booked / requested / off / closed. Each day's hours are the weekly pattern
 * adjusted by that date's one-off changes; "off" marks time the coach would
 * otherwise be open but has taken off. Rows closed every day are skipped;
 * `gapBefore` marks where that happened. */
export const getWeekGrid = (data: WeekGridInput, zone: string) => {
	const now = Date.now();
	const days = Array.from({ length: 7 }, (_, i) => zonedStartOfDay(data.weekStart, zone, i));
	const weekdays = days.map((d) => zonedDateParts(d, zone).weekday);
	const todayStart = zonedStartOfDay(new Date(), zone).getTime();

	const dayIndexOf = (date: Date) =>
		Math.round((zonedStartOfDay(date, zone).getTime() - data.weekStart.getTime()) / DAY_MS);
	const minuteOf = (date: Date) => {
		const { hour, minute } = zonedDateParts(date, zone);
		return hour * 60 + minute;
	};

	const occupied = [
		...data.weekSessions.map((s) => ({ s, state: 'booked' as const })),
		...data.pendingRequests.map((s) => ({ s, state: 'requested' as const })),
		...(data.proposedTimes ?? []).map((s) => ({ s, state: 'requested' as const }))
	]
		.map(({ s, state }) => ({
			state,
			day: dayIndexOf(s.startsAt),
			start: minuteOf(s.startsAt),
			end: minuteOf(s.startsAt) + s.durationMin,
			name: shortName(s.clientName),
			type: s.type
		}))
		.filter((o) => o.day >= 0 && o.day < 7);

	const oneOffs = data.oneOffs ?? [];
	const hours = days.map((day, i) => {
		const dayOneOffs = exceptionsOn(oneOffs, zonedDateKey(day, zone));
		const weekly = data.availability.filter((w) => w.weekday === weekdays[i]);
		return {
			open: applyExceptions(weekly, dayOneOffs),
			// What would be open with this date's extra hours but none of its time off.
			openBeforeTimeOff: applyExceptions(
				weekly,
				dayOneOffs.filter((o) => o.kind === 'open')
			),
			timeOff: dayOneOffs.filter((o) => o.kind === 'closed')
		};
	});
	const isOff = (i: number, start: number, end: number) =>
		within(hours[i].openBeforeTimeOff, start, end) && !within(hours[i].open, start, end);

	const rowMinutes = new Set<number>();
	const addRange = (start: number, end: number) => {
		for (let m = Math.floor(start / CELL_MIN) * CELL_MIN; m < end; m += CELL_MIN) rowMinutes.add(m);
	};
	hours.forEach((h) => h.openBeforeTimeOff.forEach((w) => addRange(w.startMin, w.endMin)));
	occupied.forEach((o) => addRange(o.start, o.end));

	let openCellsLeft = 0;
	const sorted = [...rowMinutes].sort((a, b) => a - b);

	const rows = sorted.map((minute, rowIndex) => ({
		minute,
		label: clockLabel(minute),
		gapBefore: rowIndex > 0 && minute - sorted[rowIndex - 1] > CELL_MIN,
		cells: days.map((day, i) => {
			const cellEnd = minute + CELL_MIN;
			const past = day.getTime() + cellEnd * 60_000 <= now;
			const occupant = occupied.find((o) => o.day === i && o.start < cellEnd && o.end > minute);
			const off = isOff(i, minute, cellEnd);
			const state: GridCellState =
				occupant?.state ??
				(within(hours[i].open, minute, cellEnd) ? 'open' : off ? 'off' : 'closed');
			if (state === 'open' && !past) openCellsLeft++;

			const offNote = off
				? hours[i].timeOff.find((o) => o.startMin < cellEnd && o.endMin > minute)?.note
				: null;
			const offStartsHere = off && !isOff(i, minute - CELL_MIN, minute);

			return {
				state,
				past,
				label: occupant?.name ?? (state === 'off' && offStartsHere ? 'off' : null),
				title: occupant
					? `${occupant.name} · ${occupant.type} · ${occupant.state}`
					: state === 'off'
						? `${clockLabel(minute)} · time off${offNote ? ` · ${offNote}` : ''}`
						: `${clockLabel(minute)} · ${state}`
			};
		})
	}));

	return {
		days: days.map((d) => ({
			label: weekdayAbbrev(d, zone),
			day: dayNumber(d, zone),
			isToday: d.getTime() === todayStart
		})),
		rows,
		openHoursLeft: openCellsLeft / 2,
		hasTimeOff: rows.some((r) => r.cells.some((c) => c.state === 'off'))
	};
};
