import { dayLabel, formatFullDate, formatTime } from '$lib/utils/format';
import type { PageData } from './$types';

export type ClientDashboardData = Extract<PageData, { view: 'client' }>;
export type TrainerDashboardData = Extract<PageData, { view: 'trainer' }>;

const weeklyTrendLabel = (thisWeek: number, lastWeek: number) => {
	const diff = thisWeek - lastWeek;
	if (diff === 0) return 'same as last week';
	return `${Math.abs(diff)} ${diff > 0 ? 'more' : 'fewer'} than last week`;
};

export const getStats = (data: ClientDashboardData, zone: string) => {
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

const sessionEnd = (s: { startsAt: Date; durationMin: number }) =>
	new Date(s.startsAt.getTime() + s.durationMin * 60_000);

const timeAgo = (date: Date) => {
	const hours = Math.floor((Date.now() - date.getTime()) / 3_600_000);
	if (hours < 1) return 'under an hour ago';
	if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
	return `${Math.floor(hours / 24)} days ago`;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** New requests and reschedules — everything a client is waiting on the coach
 * to answer — with a breakdown only when both kinds are waiting. */
const waitingOnCoach = (data: TrainerDashboardData) => {
	const requests = data.pendingRequests.length;
	const reschedules = data.rescheduleRequests.length;
	const oldest = [
		...data.pendingRequests.map((r) => r.createdAt),
		...data.rescheduleRequests.map((r) => r.requestedAt)
	].reduce<Date | null>((min, d) => (min === null || d < min ? d : min), null);

	const sub = [
		requests > 0 && reschedules > 0
			? `${plural(requests, 'request')} · ${plural(reschedules, 'reschedule')}`
			: null,
		oldest ? `oldest ${timeAgo(oldest)}` : 'all caught up'
	]
		.filter(Boolean)
		.join(' · ');

	return { label: 'waiting on you', value: String(requests + reschedules), sub };
};

export const getTrainerStats = (data: TrainerDashboardData, zone: string) => {
	const today = data.todaySessions;
	const completedThisWeek = data.weekSessions.filter((s) => s.status === 'completed').length;

	return [
		{
			label: 'today',
			value: String(today.length),
			sub:
				today.length > 0
					? `${formatTime(today[0].startsAt, zone)} – ${formatTime(sessionEnd(today[today.length - 1]), zone)}`
					: 'nothing booked'
		},
		{
			label: 'this week',
			value: String(data.weekSessions.length),
			sub: `${completedThisWeek} done so far`
		},
		waitingOnCoach(data),
		// TODO: swap for this month's revenue once the Stripe flow exists.
		{
			label: 'active clients',
			value: String(data.activeClientStats.count),
			sub:
				data.activeClientStats.runningLow > 0
					? `${data.activeClientStats.runningLow} running low`
					: 'none running low'
		}
	];
};
