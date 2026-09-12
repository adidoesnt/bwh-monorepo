import type { PageData } from './$types';

const LOCALE = 'en-GB';

/** The viewer's stored timezone, else whatever the browser reports. */
export const viewerZone = (data: PageData) =>
	data.user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

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

export const statusLabel = (status: string) =>
	status === 'pending_approval' ? 'awaiting approval' : status;

export const statusBadgeClass = (status: string) =>
	status === 'confirmed' ? 'badge-success' : 'badge-warning';

const weeklyTrendLabel = (thisWeek: number, lastWeek: number) => {
	const diff = thisWeek - lastWeek;
	if (diff === 0) return 'same as last week';
	return `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last week`;
};

export const isClient = (data: PageData) => data.user.role === 'client';

export const getStats = (data: PageData, zone: string) => {
	const nextBooking = data.upcomingBookings[0] ?? null;

	return [
		{
			label: 'next session',
			value: nextBooking ? dayLabel(nextBooking.startsAt, zone) : '—',
			sub: nextBooking
				? `${formatTime(nextBooking.startsAt, zone)} · ${nextBooking.coachName}`
				: 'nothing booked'
		},
		{
			label: 'active packages',
			value: String(data.activePackages.length),
			sub:
				data.activePackages.length > 0
					? [...new Set(data.activePackages.map((p) => p.coachName))].join(', ')
					: 'none yet'
		},
		{
			label: 'sessions done',
			value: String(data.completedSessionStats.count),
			sub: data.completedSessionStats.since
				? `since ${formatFullDate(data.completedSessionStats.since, zone)}`
				: 'no sessions yet'
		},
		{
			label: 'this week',
			value: String(data.weeklySessionCounts.thisWeek),
			sub: weeklyTrendLabel(data.weeklySessionCounts.thisWeek, data.weeklySessionCounts.lastWeek)
		}
	];
};

export const getPackageSlides = (data: PageData) =>
	data.activePackages.map((pkg, i, arr) => ({
		...pkg,
		slideId: `package-${pkg.purchaseId}`,
		prevId: `package-${arr[(i - 1 + arr.length) % arr.length].purchaseId}`,
		nextId: `package-${arr[(i + 1) % arr.length].purchaseId}`
	}));

export const balanceProgressClass = (balance: number, sessionCount: number) => {
	const remainingRatio = sessionCount > 0 ? balance / sessionCount : 0;
	if (remainingRatio >= 0.5) return 'progress-success';
	if (remainingRatio >= 0.2) return 'progress-warning';
	return 'progress-error';
};
