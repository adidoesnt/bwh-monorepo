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

export type AvailabilityWindow = { startMin: number; endMin: number };
export type ActiveBooking = { startsAt: Date; durationMin: number };

/**
 * Bookable 30-min-cadence starts for one coach-local calendar day, given that
 * day's availability windows and the coach's already-booked sessions. A start
 * is excluded if it doesn't leave room for `durationMin` before the window
 * closes, overlaps an existing booking, or is already in the past.
 */
export const availableStartsForDay = ({
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
}): Date[] => {
	const candidates: Date[] = [];

	for (const window of windows) {
		for (let min = window.startMin; min + durationMin <= window.endMin; min += SLOT_INTERVAL_MIN) {
			candidates.push(zonedTimeToUtc(year, month, day, Math.floor(min / 60), min % 60, zone));
		}
	}

	return candidates.filter((start) => {
		if (start <= now) return false;

		const end = new Date(start.getTime() + durationMin * 60_000);
		return !existingBookings.some((b) => {
			const bookingEnd = new Date(b.startsAt.getTime() + b.durationMin * 60_000);
			return start < bookingEnd && b.startsAt < end;
		});
	});
};
