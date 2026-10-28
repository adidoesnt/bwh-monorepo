import { zonedDateParts, zonedStartOfDay } from '$lib/utils/availability';
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
};

const CELL_MIN = 30;
const DAY_MS = 86_400_000;

export type GridCellState = 'open' | 'booked' | 'requested' | 'closed';

/** "Tessa Lim" → "Tessa L." — short enough for a grid cell. */
const shortName = (fullName: string) => {
	const [first, ...rest] = fullName.trim().split(/\s+/);
	const last = rest.at(-1);
	return last ? `${first} ${last[0]}.` : first;
};

/** This week (Monday–Sunday, coach's zone) as 30-minute rows, each cell open /
 * booked / requested / closed. Rows closed every day are skipped; `gapBefore`
 * marks where that happened. */
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
		...data.pendingRequests.map((s) => ({ s, state: 'requested' as const }))
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

	const rowMinutes = new Set<number>();
	const addRange = (start: number, end: number) => {
		for (let m = Math.floor(start / CELL_MIN) * CELL_MIN; m < end; m += CELL_MIN) rowMinutes.add(m);
	};
	data.availability.forEach((w) => addRange(w.startMin, w.endMin));
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
			const inWindow = data.availability.some(
				(w) => w.weekday === weekdays[i] && w.startMin < cellEnd && w.endMin > minute
			);
			const state: GridCellState = occupant?.state ?? (inWindow ? 'open' : 'closed');
			if (state === 'open' && !past) openCellsLeft++;

			return {
				state,
				past,
				label: occupant?.name ?? null,
				title: occupant
					? `${occupant.name} · ${occupant.type} · ${occupant.state}`
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
		openHoursLeft: openCellsLeft / 2
	};
};
