import type { PageData } from './$types';

export const isClient = (data: PageData) => data.user.role === 'client';

export const BUCKET_TABS: {
	id: 'upcoming' | 'awaiting_action' | 'past';
	label: string;
	badgeClass?: string;
}[] = [
	{ id: 'upcoming', label: 'upcoming', badgeClass: 'badge-success' },
	{ id: 'awaiting_action', label: 'awaiting action', badgeClass: 'badge-warning' },
	{ id: 'past', label: 'past' }
];

export const bucketCount = (data: PageData, bucket: 'upcoming' | 'awaiting_action' | 'past') =>
	bucket === 'awaiting_action' ? data.bucketCounts.awaitingAction : data.bucketCounts[bucket];
