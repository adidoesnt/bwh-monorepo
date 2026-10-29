const LOCALE = 'en-GB';

/** The viewer's stored timezone, else whatever the browser reports. */
export const viewerZone = (user: { timezone: string | null }) =>
	user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

const zonedDateKey = (date: Date, zone: string) =>
	new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(date);

export const dayLabel = (date: Date, zone: string) => {
	const today = zonedDateKey(new Date(), zone);
	if (zonedDateKey(date, zone) === today) return 'today';

	const tomorrow = new Date();
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
	if (zonedDateKey(date, zone) === zonedDateKey(tomorrow, zone)) return 'tomorrow';

	return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: zone }).format(
		date
	);
};

export const formatTime = (date: Date, zone: string) =>
	new Intl.DateTimeFormat(LOCALE, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: zone
	}).format(date);

export const formatFullDate = (date: Date, zone: string) =>
	new Intl.DateTimeFormat(LOCALE, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: zone
	}).format(date);

export const monthAbbrev = (date: Date, zone: string) =>
	new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: zone }).format(date).toUpperCase();

export const dayNumber = (date: Date, zone: string) =>
	new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: zone }).format(date);

export const weekdayAbbrev = (date: Date, zone: string) =>
	new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: zone }).format(date).toUpperCase();

export const monthYearLabel = (date: Date, zone: string) =>
	new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: zone }).format(date);

export const statusLabel = (status: string) =>
	status === 'pending_approval' ? 'awaiting approval' : status;

const STATUS_BADGE_CLASSES: Record<string, string> = {
	confirmed: 'badge-success',
	pending_approval: 'badge-warning',
	declined: 'badge-error',
	completed: 'badge-ghost',
	cancelled: 'badge-ghost'
};

export const statusBadgeClass = (status: string) => STATUS_BADGE_CLASSES[status] ?? 'badge-warning';

/** The badge for a booking row. A request whose start passed without an
 * answer reads "lapsed" rather than "awaiting approval"; a cancel that kept
 * its session spent reads "late cancel". */
export const bookingBadge = (status: string, startsAt: Date, lateCancel = false) => {
	if (status === 'pending_approval' && startsAt.getTime() < Date.now()) {
		return { label: 'lapsed', className: 'badge-ghost' };
	}
	if (lateCancel) return { label: 'late cancel', className: 'badge-ghost' };
	return { label: statusLabel(status), className: statusBadgeClass(status) };
};

export const formatPriceCents = (cents: number | null) =>
	cents === null ? null : `SG$${(cents / 100).toFixed(0)}`;

const formatClockMinutes = (minutes: number) => {
	const hour = Math.floor(minutes / 60);
	const minute = minutes % 60;
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/** `startMin`/`endMin` (minutes from midnight) as `"07:00 - 09:00"`. */
export const formatMinuteRange = (startMin: number, endMin: number) =>
	`${formatClockMinutes(startMin)} - ${formatClockMinutes(endMin)}`;
