import { zonedDateParts, zonedTimeToUtc } from '$lib/utils/availability';
import type { PageData } from './$types';

export const isClient = (data: PageData) => data.user.role === 'client';

export const cheapestPackagePriceCents = (packages: { pricePerSessionCents: number }[]) =>
	packages.length > 0 ? Math.min(...packages.map((p) => p.pricePerSessionCents)) : null;

export const SESSION_TYPES = ['1:1 in-person', '1:1 online', 'free consult', 'assessment'];
const REMOTE_COMPATIBLE_TYPES = ['1:1 online', 'free consult'];

/** Which session types the client may pick, per `BOOKING-LIFECYCLE.md`'s
 * timezone + screening gates. A free consult is treated as remote-compatible
 * (it's a quick intro call, not tied to the coach's physical location), which
 * is what makes both gates active at once collapse to "free consult only"
 * rather than an empty set. `crossTimezone` is `false` when the client's zone
 * is unknown (`user.timezone` unset) — permissive by default rather than
 * blocking bookings over missing data. */
export const allowedSessionTypes = ({
	crossTimezone,
	parqSubmitted
}: {
	crossTimezone: boolean;
	parqSubmitted: boolean;
}) => {
	let allowed: string[] = SESSION_TYPES;
	if (crossTimezone) allowed = allowed.filter((t) => REMOTE_COMPATIBLE_TYPES.includes(t));
	if (!parqSubmitted) allowed = allowed.filter((t) => t === 'free consult');
	return allowed;
};

/** The session type actually in effect — falls back to the first allowed
 * type rather than trusting a `?type=` that the gates now disallow. */
export const resolveSessionType = (requestedType: string, allowedTypes: string[]) =>
	allowedTypes.includes(requestedType) ? requestedType : allowedTypes[0];

const FREE_CONSULT_DURATION_MIN = 30;
const DEFAULT_RANGE_WEEKS = 8;

export const parseDateParam = (value: string | null) => {
	if (!value) return null;
	const [year, month, day] = value.split('-').map(Number);
	if (!year || !month || !day) return null;
	return { year, month, day };
};

// Can't derive this from `PageData` (circular: `load` calls
// `resolveBookingSelection`) — kept in sync with `getClientActivePackages`'s
// return shape (`$lib/server/queries.ts`) by hand instead.
type ActivePackage = {
	purchaseId: string;
	sessionLengthMin: number;
	expiresAt: Date;
	balance: number;
	holds: number;
	bookable: number;
};

/** Resolve which purchase a session draws from, its length, and how far out
 * the date picker should range, from the session type + `?package=` param. */
export const resolveBookingSelection = ({
	sessionType,
	packageIdParam,
	activePackages
}: {
	sessionType: string;
	packageIdParam: string | null;
	activePackages: ActivePackage[];
}) => {
	const selectedPurchase =
		sessionType === 'free consult'
			? null
			: (activePackages.find((p) => p.purchaseId === packageIdParam) ?? activePackages[0] ?? null);

	const durationMin =
		sessionType === 'free consult' ? FREE_CONSULT_DURATION_MIN : (selectedPurchase?.sessionLengthMin ?? null);

	const rangeEnd = selectedPurchase
		? selectedPurchase.expiresAt
		: new Date(Date.now() + DEFAULT_RANGE_WEEKS * 7 * 86_400_000);

	return { selectedPurchase, durationMin, rangeEnd };
};

export type DateParts = { year: number; month: number; day: number };

/** Every coach-local calendar date from `today` through `rangeEnd`, for the
 * date chips. Noon is used as each day's reference instant purely to stay
 * clear of its midnight boundary during the walk — the returned parts are
 * calendar dates, not times. */
export const enumerateDateRange = (today: DateParts, rangeEnd: Date, zone: string): DateParts[] => {
	const start = zonedTimeToUtc(today.year, today.month, today.day, 12, 0, zone);
	const endParts = zonedDateParts(rangeEnd, zone);
	const end = zonedTimeToUtc(endParts.year, endParts.month, endParts.day, 12, 0, zone);

	const dates: DateParts[] = [];
	for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
		dates.push(zonedDateParts(cursor, zone));
	}
	return dates;
};

/** `DateParts` as the `YYYY-MM-DD` string used for the `?date=` param. */
export const dateParamValue = ({ year, month, day }: DateParts) =>
	`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** `DateParts` as a `Date`, for reuse with the `$lib/utils/format` formatters
 * (noon is just a safe reference instant within that calendar day). */
export const dateForParts = (date: DateParts, zone: string) =>
	zonedTimeToUtc(date.year, date.month, date.day, 12, 0, zone);

export const sameDate = (a: DateParts, b: DateParts) =>
	a.year === b.year && a.month === b.month && a.day === b.day;

/** Just `dates` that fall in `year`/`month` — the day chips for the currently
 * viewed month. */
export const daysInMonth = (dates: DateParts[], year: number, month: number) =>
	dates.filter((d) => d.year === year && d.month === month);

/** `{ year, month }` `delta` months from `year`/`month` (`delta` can be
 * negative), handling year rollover. */
export const adjacentMonth = (year: number, month: number, delta: number) => {
	const total = year * 12 + (month - 1) + delta;
	return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
};

/** Whether `year`/`month` has any day in `dates` — whether the month-nav
 * button for it should be enabled. */
export const hasDayInMonth = (dates: DateParts[], year: number, month: number) =>
	dates.some((d) => d.year === year && d.month === month);
