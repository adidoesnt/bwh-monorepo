import type { PageData } from './$types';

// Dates render in UTC on both server and client until the dashboard renders
// in the viewer's timezone (Phase 2) — pinning locale + zone here avoids a
// hydration mismatch in the meantime.
const LOCALE = 'en-GB';
const ZONE = 'UTC';

export const dayLabel = (date: Date) => {
	const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
	const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
	if (diffDays === 0) return 'today';
	if (diffDays === 1) return 'tomorrow';
	return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', timeZone: ZONE }).format(
		date
	);
};

export const formatTime = (date: Date) =>
	new Intl.DateTimeFormat(LOCALE, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: ZONE
	}).format(date);

export const formatFullDate = (date: Date) =>
	new Intl.DateTimeFormat(LOCALE, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: ZONE
	}).format(date);

export const monthAbbrev = (date: Date) =>
	new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: ZONE }).format(date).toUpperCase();

export const dayNumber = (date: Date) =>
	new Intl.DateTimeFormat(LOCALE, { day: 'numeric', timeZone: ZONE }).format(date);

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

export const getStats = (data: PageData) => {
	const nextBooking = data.upcomingBookings[0] ?? null;

	return [
		{
			label: 'next session',
			value: nextBooking ? dayLabel(nextBooking.startsAt) : '—',
			sub: nextBooking
				? `${formatTime(nextBooking.startsAt)} · ${nextBooking.coachName}`
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
				? `since ${formatFullDate(data.completedSessionStats.since)}`
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
