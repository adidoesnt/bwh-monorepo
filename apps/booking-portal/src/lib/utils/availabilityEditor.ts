import { zonedDateParts } from "./availability";

export const CELL_MIN = 30;
export const CELLS_PER_DAY = (24 * 60) / CELL_MIN;

/** Monday-first display order, as `availability_slot.weekday` values (0 = Sunday). */
export const EDITOR_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LABELS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type WeeklyWindow = { weekday: number; startMin: number; endMin: number };

/** `cells[weekday][i]` — whether the half hour starting at `i * 30` minutes is open. */
export type WeekCells = boolean[][];

export const windowsToCells = (windows: WeeklyWindow[]): WeekCells => {
	const cells = Array.from({ length: 7 }, () => Array<boolean>(CELLS_PER_DAY).fill(false));
	for (const w of windows) {
		for (let i = Math.floor(w.startMin / CELL_MIN); i * CELL_MIN < w.endMin; i++) {
			cells[w.weekday][i] = true;
		}
	}
	return cells;
};

/** Merges each day's runs of open cells into windows — what gets saved. */
export const cellsToWindows = (cells: WeekCells): WeeklyWindow[] => {
	const windows: WeeklyWindow[] = [];
	cells.forEach((day, weekday) => {
		let runStart: number | null = null;
		for (let i = 0; i <= CELLS_PER_DAY; i++) {
			const open = i < CELLS_PER_DAY && day[i];
			if (open && runStart === null) runStart = i;
			if (!open && runStart !== null) {
				windows.push({ weekday, startMin: runStart * CELL_MIN, endMin: i * CELL_MIN });
				runStart = null;
			}
		}
	});
	return windows;
};

/** Windows no package session fits in — clients could only book a free consult there. */
export const shortWindows = (windows: WeeklyWindow[], minSessionLength: number | null) =>
	minSessionLength === null ? [] : windows.filter((w) => w.endMin - w.startMin < minSessionLength);

export type PlacedBooking<T> = { booking: T; weekday: number; cells: number[] };

/** Where each upcoming booking falls on the weekly pattern, in the coach's zone. */
export const placeBookings = <T extends { startsAt: Date; durationMin: number }>(
	bookings: T[],
	zone: string,
): PlacedBooking<T>[] =>
	bookings.map((booking) => {
		const { weekday, hour, minute } = zonedDateParts(booking.startsAt, zone);
		const start = hour * 60 + minute;
		const cells: number[] = [];
		for (let i = Math.floor(start / CELL_MIN); i * CELL_MIN < start + booking.durationMin; i++) {
			if (i < CELLS_PER_DAY) cells.push(i);
		}
		return { booking, weekday, cells };
	});

/** Upcoming bookings sitting in hours this edit closes. They stay booked; the
 * coach is told before saving. */
export const conflictingBookings = <T>(placed: PlacedBooking<T>[], before: WeekCells, after: WeekCells) =>
	placed.filter((p) => p.cells.some((i) => before[p.weekday][i] && !after[p.weekday][i]));

export const clockLabel = (minute: number) =>
	`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

/* Range editing — how coaches actually describe their hours ("6 to 9, then 5 to 8"). */

export type TimeRange = { startMin: number; endMin: number };

/** Every half hour of the day; an end of 24:00 reads as "midnight". */
export const TIME_OPTIONS = Array.from({ length: CELLS_PER_DAY + 1 }, (_, i) => ({
	value: i * CELL_MIN,
	label: i === CELLS_PER_DAY ? "midnight" : clockLabel(i * CELL_MIN),
}));

export const DEFAULT_RANGE: TimeRange = { startMin: 9 * 60, endMin: 17 * 60 };

/** Ranges per weekday (index 0 = Sunday), in start order, as the editor shows them. */
export const windowsToRanges = (windows: WeeklyWindow[]): TimeRange[][] =>
	Array.from({ length: 7 }, (_, weekday) =>
		windows
			.filter((w) => w.weekday === weekday)
			.map(({ startMin, endMin }) => ({ startMin, endMin }))
			.sort((a, b) => a.startMin - b.startMin),
	);

/** The windows a set of ranges saves as — touching or overlapping ranges merge. */
export const rangesToWindows = (ranges: TimeRange[][]): WeeklyWindow[] =>
	cellsToWindows(
		windowsToCells(
			ranges.flatMap((day, weekday) =>
				day.filter((r) => r.endMin > r.startMin).map((r) => ({ weekday, ...r })),
			),
		),
	);

/** A problem with each range, in the order the coach reads them, or `null`. */
export const rangeErrors = (ranges: TimeRange[]): (string | null)[] =>
	ranges.map((r, i) => {
		if (r.endMin <= r.startMin) return "ends before it starts";
		const overlaps = ranges.some(
			(other, j) => j !== i && other.startMin < r.endMin && r.startMin < other.endMin,
		);
		return overlaps ? "overlaps other hours on this day" : null;
	});

/** A sensible next range after a day's last one: an hour later, for an hour. */
export const nextRange = (ranges: TimeRange[]): TimeRange => {
	const last = ranges.at(-1);
	if (!last) return { ...DEFAULT_RANGE };
	const startMin = Math.min(last.endMin + 60, 24 * 60 - 60);
	return { startMin, endMin: Math.min(startMin + 60, 24 * 60) };
};
