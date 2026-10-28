import {
	applyExceptions,
	exceptionsOn,
	zonedDateKey,
	zonedDateParts,
	type DayException,
} from "./availability";

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

/* One-off changes ("off 24–31 dec", "open this sunday") — `availability_exception` rows. */

export type OneOffChange = DayException & { note: string | null };

export const ALL_DAY = { startMin: 0, endMin: 24 * 60 };

/** How many upcoming one-off changes show before "show N more". */
export const ONE_OFF_PREVIEW_COUNT = 5;

const oneOffKey = (o: OneOffChange) =>
	[o.kind, o.startDate, o.endDate, o.startMin, o.endMin, o.note ?? ""].join("|");

/** Entries added plus entries removed between two lists. */
export const countOneOffChanges = (before: OneOffChange[], after: OneOffChange[]) => {
	const a = before.map(oneOffKey);
	const b = after.map(oneOffKey);
	return a.filter((k) => !b.includes(k)).length + b.filter((k) => !a.includes(k)).length;
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
	weekday: "short",
	day: "numeric",
	month: "short",
	timeZone: "UTC",
});

/** "Fri 6 Nov" for a `YYYY-MM-DD` key — the key is already the coach's date. */
export const formatDateKey = (key: string) => DATE_FORMAT.format(new Date(`${key}T00:00:00Z`));

export const oneOffDatesLabel = (o: OneOffChange) =>
	o.startDate === o.endDate
		? formatDateKey(o.startDate)
		: `${formatDateKey(o.startDate)} – ${formatDateKey(o.endDate)}`;

export const oneOffTimesLabel = (o: OneOffChange) =>
	o.startMin === ALL_DAY.startMin && o.endMin === ALL_DAY.endMin
		? "all day"
		: `${clockLabel(o.startMin)}–${o.endMin === ALL_DAY.endMin ? "midnight" : clockLabel(o.endMin)}`;

export type CoachHours = { windows: WeeklyWindow[]; oneOffs: DayException[] };

/** Whether a session's own date and time sit inside the coach's open hours —
 * the weekly pattern for that weekday, adjusted by that date's one-off changes. */
const isWithinHours = (
	session: { startsAt: Date; durationMin: number },
	hours: CoachHours,
	zone: string,
) => {
	const { weekday, hour, minute } = zonedDateParts(session.startsAt, zone);
	const start = hour * 60 + minute;
	const end = start + session.durationMin;
	const open = applyExceptions(
		hours.windows.filter((w) => w.weekday === weekday),
		exceptionsOn(hours.oneOffs, zonedDateKey(session.startsAt, zone)),
	);
	return open.some((w) => w.startMin <= start && end <= w.endMin);
};

/** Upcoming sessions that were inside open hours before an edit and aren't
 * after it. They stay booked; the coach is told before saving. */
export const sessionsLosingHours = <T extends { startsAt: Date; durationMin: number }>(
	sessions: T[],
	before: CoachHours,
	after: CoachHours,
	zone: string,
) =>
	sessions.filter((s) => isWithinHours(s, before, zone) && !isWithinHours(s, after, zone));

/** Longest stretch of dates checked for a single entry — enough for any real holiday. */
const MAX_CHECKED_DAYS = 366;

/** Why a new one-off change would make no difference on any of its dates, or
 * `null` if it changes something. Each date is compared with its hours without
 * the entry: the weekly pattern plus the other one-off changes. */
export const redundantOneOffReason = (
	entry: OneOffChange,
	windows: WeeklyWindow[],
	others: OneOffChange[],
): string | null => {
	const start = new Date(`${entry.startDate}T00:00:00Z`);
	const end = new Date(`${entry.endDate}T00:00:00Z`);
	for (let n = 0, d = start; d <= end && n < MAX_CHECKED_DAYS; n++, d = new Date(d.getTime() + 86_400_000)) {
		const key = d.toISOString().slice(0, 10);
		const weekly = windows.filter((w) => w.weekday === d.getUTCDay());
		const before = applyExceptions(weekly, exceptionsOn(others, key));
		const after = applyExceptions(weekly, exceptionsOn([...others, entry], key));
		if (JSON.stringify(before) !== JSON.stringify(after)) return null;
	}

	const times = oneOffTimesLabel(entry);
	const single = entry.startDate === entry.endDate;
	const on = single ? `on ${formatDateKey(entry.startDate)}` : null;
	return entry.kind === "open"
		? `you're already open ${times} ${on ?? "on all of those days"}`
		: `you're not open ${times === "all day" ? "at all" : times} ${on ?? "on any of those days"} anyway`;
};
