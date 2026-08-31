/**
 * IANA-timezone helpers built on `Intl.DateTimeFormat` — isomorphic (browser +
 * SvelteKit server) and DST-aware. Used to turn a coach's wall-clock
 * availability into real instants and back.
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const partsFmt = (timeZone: string) => {
	let f = fmtCache.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
		fmtCache.set(timeZone, f);
	}
	return f;
};

type Ymdhms = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function readParts(fmt: Intl.DateTimeFormat, instant: Date): Ymdhms {
	const p = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, x.value]));
	return {
		y: +p.year,
		mo: +p.month,
		d: +p.day,
		h: +p.hour % 24,
		mi: +p.minute,
		s: +p.second,
	};
}

/** Offset of `timeZone` from UTC at `instant`, in ms (e.g. +8h → 28800000). */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
	const w = readParts(partsFmt(timeZone), instant);
	const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
	return asUtc - instant.getTime();
}

/** The instant at which it is `minutes`-past-midnight on `dateISO` in `timeZone`. */
export function wallClockToInstant(dateISO: string, minutes: number, timeZone: string): Date {
	const [y, mo, d] = dateISO.split('-').map(Number);
	const guess = Date.UTC(y, mo - 1, d, 0, minutes);
	// Correct by the zone's offset at the guessed instant. One pass is exact
	// except within the ~1h fold of a DST transition, which no coach window hits.
	const corrected = guess - zoneOffsetMs(new Date(guess), timeZone);
	return new Date(corrected);
}

/** Calendar date, weekday (0=Sun) and minutes-from-midnight of `instant` in `timeZone`. */
export function zoneParts(instant: Date, timeZone: string) {
	const w = readParts(partsFmt(timeZone), instant);
	const dateISO = `${w.y}-${String(w.mo).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
	// getUTCDay of the wall-clock-as-UTC gives the local weekday.
	const weekday = new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay();
	return { y: w.y, mo: w.mo, d: w.d, dateISO, weekday, minutes: w.h * 60 + w.mi };
}

/** Next `n` `YYYY-MM-DD` strings (including today) in `timeZone`. */
export function nextDates(n: number, timeZone: string, from: Date = new Date()): string[] {
	const base = zoneParts(from, timeZone);
	const out: string[] = [];
	for (let i = 0; i < n; i++) {
		const d = new Date(Date.UTC(base.y, base.mo - 1, base.d + i));
		out.push(d.toISOString().slice(0, 10));
	}
	return out;
}

/** `YYYY-MM-DD`, `n` days after `dateISO` (`n` may be negative). */
export function addDaysISO(dateISO: string, n: number): string {
	const [y, mo, d] = dateISO.split('-').map(Number);
	return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

/** Every `YYYY-MM-DD` from `startISO` through `endISO` inclusive (empty if end < start). */
export function datesInRange(startISO: string, endISO: string): string[] {
	const out: string[] = [];
	let cur = startISO;
	for (let i = 0; i < 400 && cur <= endISO; i++) {
		out.push(cur);
		cur = addDaysISO(cur, 1);
	}
	return out;
}

/** The viewer's own IANA zone. */
export function browserZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
