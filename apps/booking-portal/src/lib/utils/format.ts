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

export const statusLabel = (status: string) =>
	status === 'pending_approval' ? 'awaiting approval' : status;

export const statusBadgeClass = (status: string) =>
	status === 'confirmed' ? 'badge-success' : 'badge-warning';

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
