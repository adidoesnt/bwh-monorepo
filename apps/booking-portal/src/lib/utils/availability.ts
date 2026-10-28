const SLOT_INTERVAL_MIN = 30;

export const zonedDateParts = (date: Date, zone: string) => {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: zone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		weekday: "short",
		hourCycle: "h23",
	}).formatToParts(date);

	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";
	const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));

	return {
		year: Number(get("year")),
		month: Number(get("month")),
		day: Number(get("day")),
		hour: Number(get("hour")),
		minute: Number(get("minute")),
		second: Number(get("second")),
		weekday,
	};
};

/** 0 (Sunday) – 6 (Saturday), matching `availability_slot.weekday`, for `date` in `zone`. */
export const zonedWeekday = (date: Date, zone: string): number => zonedDateParts(date, zone).weekday;

/**
 * The UTC instant for wall-clock `year-month-day hour:minute` in `zone`, DST-safe.
 *
 * There's no built-in "construct a Date from wall-clock components in an
 * arbitrary named zone" — this uses the standard two-pass trick: guess the
 * instant by treating the wall-clock values as UTC, see what that guess
 * actually displays as in `zone`, then correct by the difference.
 */
export const zonedTimeToUtc = (
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	zone: string,
): Date => {
	const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
	const displayed = zonedDateParts(guess, zone);
	const displayedAsUtcMs = Date.UTC(
		displayed.year,
		displayed.month - 1,
		displayed.day,
		displayed.hour,
		displayed.minute,
		displayed.second,
	);
	const offsetErrorMs = displayedAsUtcMs - guess.getTime();
	return new Date(guess.getTime() - offsetErrorMs);
};

/** Midnight in `zone` of the calendar day `addDays` after the one `date` falls on there. */
export const zonedStartOfDay = (date: Date, zone: string, addDays = 0): Date => {
	const { year, month, day } = zonedDateParts(date, zone);
	const target = new Date(Date.UTC(year, month - 1, day + addDays));
	return zonedTimeToUtc(
		target.getUTCFullYear(),
		target.getUTCMonth() + 1,
		target.getUTCDate(),
		0,
		0,
		zone,
	);
};

export type AvailabilityWindow = { startMin: number; endMin: number };

/** `YYYY-MM-DD` for the calendar day `date` falls on in `zone` — the format
 * `availability_exception`'s dates use, so they compare as strings. */
export const zonedDateKey = (date: Date, zone: string) => {
	const { year, month, day } = zonedDateParts(date, zone);
	return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export type DayException = {
	kind: "closed" | "open";
	startDate: string;
	endDate: string;
	startMin: number;
	endMin: number;
};

export const exceptionsOn = <T extends DayException>(exceptions: T[], dateKey: string) =>
	exceptions.filter((e) => e.startDate <= dateKey && dateKey <= e.endDate);

/** Sorted, with touching or overlapping ranges merged into one. */
export const mergeWindows = (windows: AvailabilityWindow[]): AvailabilityWindow[] => {
	const merged: AvailabilityWindow[] = [];
	for (const w of [...windows].sort((a, b) => a.startMin - b.startMin)) {
		const last = merged.at(-1);
		if (last && w.startMin <= last.endMin) last.endMin = Math.max(last.endMin, w.endMin);
		else merged.push({ ...w });
	}
	return merged;
};

/** `windows` with `cut` taken out — a window can split in two. */
export const subtractWindow = (windows: AvailabilityWindow[], cut: AvailabilityWindow) =>
	windows.flatMap((w) => {
		if (cut.endMin <= w.startMin || w.endMin <= cut.startMin) return [w];
		const parts: AvailabilityWindow[] = [];
		if (w.startMin < cut.startMin) parts.push({ startMin: w.startMin, endMin: cut.startMin });
		if (cut.endMin < w.endMin) parts.push({ startMin: cut.endMin, endMin: w.endMin });
		return parts;
	});

/** One day's open hours: the weekly windows plus that day's extra hours, minus
 * its time off — time off wins where they overlap. */
export const applyExceptions = (
	weekly: AvailabilityWindow[],
	exceptions: DayException[],
): AvailabilityWindow[] => {
	const opened = mergeWindows([...weekly, ...exceptions.filter((e) => e.kind === "open")]);
	return exceptions
		.filter((e) => e.kind === "closed")
		.reduce((open, cut) => subtractWindow(open, cut), opened)
		.map(({ startMin, endMin }) => ({ startMin, endMin }));
};

export type ActiveBooking = { startsAt: Date; durationMin: number };
export type Slot = { start: Date; available: boolean };

/**
 * Every 30-min-cadence candidate start for one coach-local calendar day,
 * given that day's availability windows and the coach's already-booked
 * sessions — each tagged with whether it's actually bookable. A slot is
 * unavailable if it doesn't leave room for `durationMin` before the window
 * closes and gets skipped entirely (it was never a real candidate), or if
 * it's marked `available: false` because it overlaps an existing booking or
 * is already in the past.
 */
export const slotsForDay = ({
	year,
	month,
	day,
	zone,
	windows,
	existingBookings,
	durationMin,
	now = new Date(),
}: {
	year: number;
	month: number;
	day: number;
	zone: string;
	windows: AvailabilityWindow[];
	existingBookings: ActiveBooking[];
	durationMin: number;
	now?: Date;
}): Slot[] => {
	const candidates: Date[] = [];

	for (const window of windows) {
		for (let min = window.startMin; min + durationMin <= window.endMin; min += SLOT_INTERVAL_MIN) {
			candidates.push(zonedTimeToUtc(year, month, day, Math.floor(min / 60), min % 60, zone));
		}
	}

	return candidates.map((start) => {
		const isPast = start <= now;

		const end = new Date(start.getTime() + durationMin * 60_000);
		const overlapsExisting = existingBookings.some((b) => {
			const bookingEnd = new Date(b.startsAt.getTime() + b.durationMin * 60_000);
			return start < bookingEnd && b.startsAt < end;
		});

		return { start, available: !isPast && !overlapsExisting };
	});
};
