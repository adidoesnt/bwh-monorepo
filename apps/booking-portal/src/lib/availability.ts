import { nextDates, wallClockToInstant } from './tz';

export type Window = { weekday: number; startMin: number; endMin: number };
export type Busy = { startsAt: Date; durationMin: number };
export type Slot = { startMin: number; at: Date; ok: boolean };

const STEP_MIN = 30;

const weekdayOf = (dateISO: string) => {
	const [y, mo, d] = dateISO.split('-').map(Number);
	return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
};

const overlaps = (start: Date, end: Date, busy: Busy[]) =>
	busy.some((b) => {
		const bStart = b.startsAt.getTime();
		const bEnd = bStart + b.durationMin * 60_000;
		return start.getTime() < bEnd && end.getTime() > bStart;
	});

/** Bookable starts on one coach-local date, given the coach's weekly windows and booked slots. */
export function daySlots(opts: {
	windows: Window[];
	busy: Busy[];
	dateISO: string;
	durationMin: number;
	coachZone: string;
	now?: Date;
}): Slot[] {
	const { windows, busy, dateISO, durationMin, coachZone, now = new Date() } = opts;
	const weekday = weekdayOf(dateISO);
	const out: Slot[] = [];
	for (const w of windows) {
		if (w.weekday !== weekday) continue;
		for (let m = w.startMin; m + durationMin <= w.endMin; m += STEP_MIN) {
			const at = wallClockToInstant(dateISO, m, coachZone);
			const end = new Date(at.getTime() + durationMin * 60_000);
			out.push({ startMin: m, at, ok: at >= now && !overlaps(at, end, busy) });
		}
	}
	return out.sort((a, b) => a.startMin - b.startMin);
}

/** Open-slot count and soonest free start over the next `days`, for the directory sort. */
export function openness(opts: {
	windows: Window[];
	busy: Busy[];
	durationMin: number;
	days: number;
	coachZone: string;
	now?: Date;
}): { openCount: number; nextFreeAt: Date | null } {
	const { windows, busy, durationMin, days, coachZone, now = new Date() } = opts;
	let openCount = 0;
	let nextFreeAt: Date | null = null;
	for (const dateISO of nextDates(days, coachZone, now)) {
		for (const slot of daySlots({ windows, busy, dateISO, durationMin, coachZone, now })) {
			if (!slot.ok) continue;
			openCount++;
			if (!nextFreeAt || slot.at < nextFreeAt) nextFreeAt = slot.at;
		}
	}
	return { openCount, nextFreeAt };
}
