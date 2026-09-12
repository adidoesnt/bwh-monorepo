import type { PageData } from './$types';

export const isClient = (data: PageData) => data.user.role === 'client';

export const cheapestPackagePriceCents = (packages: { pricePerSessionCents: number }[]) =>
	packages.length > 0 ? Math.min(...packages.map((p) => p.pricePerSessionCents)) : null;
