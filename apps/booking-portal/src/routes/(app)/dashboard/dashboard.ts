import { zonedDateParts, zonedStartOfDay } from '$lib/utils/availability';
import { dayLabel, dayNumber, formatFullDate, formatTime, weekdayAbbrev } from '$lib/utils/format';
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

export const getTrainerStats = (data: TrainerDashboardData, zone: string) => {
	const today = data.todaySessions;
	const oldestRequest = data.pendingRequests.reduce<Date | null>(
		(oldest, r) => (oldest === null || r.createdAt < oldest ? r.createdAt : oldest),
		null
	);
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
		{
			label: 'requests waiting',
			value: String(data.pendingRequests.length),
			sub: oldestRequest ? `oldest ${timeAgo(oldestRequest)}` : 'all caught up'
		},
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

const CELL_MIN = 30;
const DAY_MS = 86_400_000;

export type GridCellState = 'open' | 'booked' | 'requested' | 'closed';

const pad = (n: number) => String(n).padStart(2, '0');
const clockLabel = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

/** This week (Monday–Sunday, coach's zone) as 30-minute rows, each cell open /
 * booked / requested / closed. Rows closed every day are skipped; `gapBefore`
 * marks where that happened. Read-only for now — see TrainerDashboard. */
export const getWeekGrid = (data: TrainerDashboardData, zone: string) => {
	const now = Date.now();
	const days = Array.from({ length: 7 }, (_, i) => zonedStartOfDay(data.weekStart, zone, i));
	const weekdays = days.map((d) => zonedDateParts(d, zone).weekday);
	const todayStart = zonedStartOfDay(new Date(), zone).getTime();

	const dayIndexOf = (date: Date) =>
		Math.round((zonedStartOfDay(date, zone).getTime() - data.weekStart.getTime()) / DAY_MS);
	const minuteOf = (date: Date) => {
		const { hour, minute } = zonedDateParts(date, zone);
		return hour * 60 + minute;
	};

	const occupied = [
		...data.weekSessions.map((s) => ({ s, state: 'booked' as const })),
		...data.pendingRequests.map((s) => ({ s, state: 'requested' as const }))
	]
		.map(({ s, state }) => ({
			state,
			day: dayIndexOf(s.startsAt),
			start: minuteOf(s.startsAt),
			end: minuteOf(s.startsAt) + s.durationMin,
			name: s.clientName.split(' ')[0],
			type: s.type
		}))
		.filter((o) => o.day >= 0 && o.day < 7);

	const rowMinutes = new Set<number>();
	const addRange = (start: number, end: number) => {
		for (let m = Math.floor(start / CELL_MIN) * CELL_MIN; m < end; m += CELL_MIN) rowMinutes.add(m);
	};
	data.availability.forEach((w) => addRange(w.startMin, w.endMin));
	occupied.forEach((o) => addRange(o.start, o.end));

	let openCellsLeft = 0;
	const sorted = [...rowMinutes].sort((a, b) => a - b);

	const rows = sorted.map((minute, rowIndex) => ({
		minute,
		label: clockLabel(minute),
		gapBefore: rowIndex > 0 && minute - sorted[rowIndex - 1] > CELL_MIN,
		cells: days.map((day, i) => {
			const cellEnd = minute + CELL_MIN;
			const past = day.getTime() + cellEnd * 60_000 <= now;
			const occupant = occupied.find((o) => o.day === i && o.start < cellEnd && o.end > minute);
			const inWindow = data.availability.some(
				(w) => w.weekday === weekdays[i] && w.startMin < cellEnd && w.endMin > minute
			);
			const state: GridCellState = occupant?.state ?? (inWindow ? 'open' : 'closed');
			if (state === 'open' && !past) openCellsLeft++;

			return {
				state,
				past,
				// Name the client on a session's first cell only.
				label: occupant && occupant.start >= minute ? occupant.name : null,
				title: occupant
					? `${occupant.name} · ${occupant.type} · ${occupant.state}`
					: `${clockLabel(minute)} · ${state}`
			};
		})
	}));

	return {
		days: days.map((d) => ({
			label: weekdayAbbrev(d, zone),
			day: dayNumber(d, zone),
			isToday: d.getTime() === todayStart
		})),
		rows,
		openHoursLeft: openCellsLeft / 2
	};
};
