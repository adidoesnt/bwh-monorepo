import type { PageData } from './$types';

export type ClientBookingsData = Extract<PageData, { view: 'client' }>;
export type TrainerBookingsData = Extract<PageData, { view: 'trainer' }>;

type Bucket = 'upcoming' | 'awaiting_action' | 'past';

export const BUCKET_TABS: {
	id: Bucket;
	label: string;
	badgeClass?: string;
}[] = [
	{ id: 'upcoming', label: 'upcoming', badgeClass: 'badge-success' },
	{ id: 'awaiting_action', label: 'awaiting action', badgeClass: 'badge-warning' },
	{ id: 'past', label: 'past' }
];

export const bucketCount = (
	counts: { upcoming: number; awaitingAction: number; past: number },
	bucket: Bucket
) => (bucket === 'awaiting_action' ? counts.awaitingAction : counts[bucket]);
