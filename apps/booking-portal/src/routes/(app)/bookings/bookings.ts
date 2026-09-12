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

export const SORT_OPTIONS = [
	{ value: 'name', label: 'name' },
	{ value: 'price', label: 'price' }
];

export const PAGE_SIZE_OPTIONS = [
	{ value: '5', label: '5' },
	{ value: '10', label: '10' },
	{ value: '25', label: '25' }
];

export const totalPages = (totalCount: number, pageSize: number) =>
	Math.max(1, Math.ceil(totalCount / pageSize));
