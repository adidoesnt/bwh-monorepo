import type { PageData } from './$types';

export const isClient = (data: PageData) => data.user.role === 'client';

export const cheapestPackagePriceCents = (packages: { pricePerSessionCents: number }[]) =>
	packages.length > 0 ? Math.min(...packages.map((p) => p.pricePerSessionCents)) : null;

const FREE_CONSULT_DURATION_MIN = 30;
const DEFAULT_RANGE_WEEKS = 8;

export const parseDateParam = (value: string | null) => {
	if (!value) return null;
	const [year, month, day] = value.split('-').map(Number);
	if (!year || !month || !day) return null;
	return { year, month, day };
};

type ActivePackage = { purchaseId: string; sessionLengthMin: number; expiresAt: Date };

/** Resolve which purchase a session draws from, its length, and how far out
 * the date picker should range, from the session type + `?package=` param. */
export const resolveBookingSelection = ({
	sessionType,
	packageIdParam,
	activePackages
}: {
	sessionType: string;
	packageIdParam: string | null;
	activePackages: ActivePackage[];
}) => {
	const selectedPurchase =
		sessionType === 'free consult'
			? null
			: (activePackages.find((p) => p.purchaseId === packageIdParam) ?? activePackages[0] ?? null);

	const durationMin =
		sessionType === 'free consult' ? FREE_CONSULT_DURATION_MIN : (selectedPurchase?.sessionLengthMin ?? null);

	const rangeEnd = selectedPurchase
		? selectedPurchase.expiresAt
		: new Date(Date.now() + DEFAULT_RANGE_WEEKS * 7 * 86_400_000);

	return { selectedPurchase, durationMin, rangeEnd };
};
