import { zoneParts } from './tz';

export const MONTHS = [
	'jan', 'feb', 'mar', 'apr', 'may', 'jun',
	'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];
export const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const pad = (n: number) => String(n).padStart(2, '0');

/** "07:30" — wall-clock time of `at` in `tz`. */
export const timeOf = (at: Date, tz: string) => {
	const { minutes } = zoneParts(at, tz);
	return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
};

/** "mon 31 aug 2026" in `tz`. */
export const longDate = (at: Date, tz: string) => {
	const p = zoneParts(at, tz);
	return `${DOW[p.weekday]} ${p.d} ${MONTHS[p.mo - 1]} ${p.y}`;
};

/** "mon 31 aug" in `tz`. */
export const longDateNoYear = (at: Date, tz: string) => {
	const p = zoneParts(at, tz);
	return `${DOW[p.weekday]} ${p.d} ${MONTHS[p.mo - 1]}`;
};

/** "31 aug" in `tz`. */
export const shortDate = (at: Date, tz: string) => {
	const p = zoneParts(at, tz);
	return `${p.d} ${MONTHS[p.mo - 1]}`;
};

/** { mon: "aug", day: 31 } in `tz` — for date chips. */
export const dateChip = (at: Date, tz: string) => {
	const p = zoneParts(at, tz);
	return { mon: MONTHS[p.mo - 1], day: p.d };
};

/** "today" / "tomorrow" / "in 3 days" / "mon 8 sep" — day boundaries in `tz`. */
export function relativeDay(at: Date, tz: string, now: Date = new Date()) {
	const a = zoneParts(at, tz);
	const n = zoneParts(now, tz);
	const diff = Math.round(
		(Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(n.y, n.mo - 1, n.d)) / 86_400_000,
	);
	if (diff === 0) return 'today';
	if (diff === 1) return 'tomorrow';
	if (diff === -1) return 'yesterday';
	if (diff > 1 && diff < 7) return `in ${diff} days`;
	return `${DOW[a.weekday]} ${a.d} ${MONTHS[a.mo - 1]}`;
}
