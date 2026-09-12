import { dayLabel, formatFullDate, formatTime } from '$lib/utils/format';
import type { PageData } from './$types';

export const isClient = (data: PageData) => data.user.role === 'client';

const weeklyTrendLabel = (thisWeek: number, lastWeek: number) => {
	const diff = thisWeek - lastWeek;
	if (diff === 0) return 'same as last week';
	return `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last week`;
};

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
