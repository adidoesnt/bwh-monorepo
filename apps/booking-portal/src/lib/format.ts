const MONTHS = [
	'jan', 'feb', 'mar', 'apr', 'may', 'jun',
	'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const atMidnight = (d: Date) => {
	const c = new Date(d);
	c.setHours(0, 0, 0, 0);
	return c;
};

/** e.g. "mon 31 aug 2026" */
export const longDate = (d: Date) =>
	`${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** e.g. "31 aug" */
export const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** { mon: "aug", day: 31 } — for date chips */
export const dateChip = (d: Date) => ({ mon: MONTHS[d.getMonth()], day: d.getDate() });

/** "07:30" in the viewer's locale-agnostic 24h form */
export const timeOf = (d: Date) =>
	`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** "today" / "tomorrow" / "in 3 days" / "mon 8 sep" */
export function relativeDay(d: Date, now = new Date()) {
	const diff = Math.round(
		(atMidnight(d).getTime() - atMidnight(now).getTime()) / 86_400_000,
	);
	if (diff === 0) return 'today';
	if (diff === 1) return 'tomorrow';
	if (diff === -1) return 'yesterday';
	if (diff > 1 && diff < 7) return `in ${diff} days`;
	return longDate(d).replace(` ${d.getFullYear()}`, '');
}
