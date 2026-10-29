<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { CoachSessionRow, Pager } from '$lib/components';
	import { totalPages } from '$lib/utils/pagination';
	import { BUCKET_TABS, bucketCount, type TrainerBookingsData } from './bookings';

	let { data }: { data: TrainerBookingsData } = $props();

	// The coach's own zone, matching the dashboard.
	const zone = $derived(data.coach?.timezone ?? 'Asia/Singapore');

	const FILTER_LABELS: Record<string, string> = {
		requests: 'requests',
		reschedules: 'reschedules',
		to_close: 'to close out',
		completed: 'completed',
		declined: 'declined',
		cancelled: 'cancelled',
		lapsed: 'lapsed'
	};
	const BUCKET_FILTERS: Record<string, (keyof typeof data.bucketCounts.filters)[]> = {
		awaiting_action: ['requests', 'reschedules', 'to_close'],
		history: ['completed', 'declined', 'cancelled', 'lapsed']
	};

	const filters = $derived.by(() => {
		const ids = BUCKET_FILTERS[data.bucket];
		if (!ids) return [];
		const total = ids.reduce((sum, id) => sum + data.bucketCounts.filters[id], 0);
		return [
			{ id: null, label: 'all', count: total },
			...ids.map((id) => ({ id, label: FILTER_LABELS[id], count: data.bucketCounts.filters[id] }))
		];
	});

	let search = $state(page.url.searchParams.get('q') ?? '');
	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	const pageNum = $derived(Number(page.url.searchParams.get('page')) || 1);
	const pageCount = $derived(totalPages(data.bookingsPage.totalCount, 10));

	const updateUrl = (updates: Record<string, string | null>, opts: { replaceState?: boolean } = {}) => {
		const url = new URL(page.url);
		for (const [key, value] of Object.entries(updates)) {
			if (value === null) url.searchParams.delete(key);
			else url.searchParams.set(key, value);
		}
		goto(url, { replaceState: opts.replaceState ?? false, keepFocus: true, noScroll: true });
	};

	const onSearchInput = (value: string) => {
		search = value;
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			updateUrl({ q: value || null, page: null }, { replaceState: true });
		}, 300);
	};

	const setBucket = (bucket: string) =>
		updateUrl({ tab: bucket === 'upcoming' ? null : bucket, filter: null, page: null });
	const setFilter = (filter: string | null) => updateUrl({ filter, page: null });
	const setPage = (n: number) => updateUrl({ page: n === 1 ? null : String(n) });
</script>

<div class="flex flex-col">
	<h1 class="font-headings text-3xl">sessions</h1>
	<p class="text-base-content/60">your upcoming sessions, requests waiting on you, and your session history.</p>
</div>

{#if !data.coach}
	<p class="text-base-content/60 max-w-sm">
		you don't have a coach profile yet — ask an admin to set one up before clients can book you.
	</p>
{:else}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<input
			type="search"
			placeholder="search by client name…"
			class="input input-bordered w-full"
			value={search}
			oninput={(e) => onSearchInput(e.currentTarget.value)}
		/>

		<div role="tablist" class="tabs tabs-box w-fit">
			{#each BUCKET_TABS as tab (tab.id)}
				<button
					type="button"
					role="tab"
					class="tab gap-2 {data.bucket === tab.id ? 'tab-active' : ''}"
					onclick={() => setBucket(tab.id)}
				>
					{tab.label}
					{#if tab.badgeClass && bucketCount(data.bucketCounts, tab.id) > 0}
						<span class="badge badge-sm {tab.badgeClass} font-body">{bucketCount(data.bucketCounts, tab.id)}</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if filters.length > 0}
			<div class="flex gap-2 overflow-x-auto pb-1">
				{#each filters as f (f.label)}
					<button
						type="button"
						class="btn btn-sm shrink-0 rounded-full font-normal {data.filter === f.id
							? 'btn-neutral'
							: 'border-base-300 bg-base-100 text-base-content/70'}"
						onclick={() => setFilter(f.id)}
					>
						{f.label} · {f.count}
					</button>
				{/each}
			</div>
		{/if}

		{#if data.bookingsPage.bookings.length === 0}
			<p class="text-base-content/60 text-sm">{search ? 'no sessions match.' : 'nothing here.'}</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.bookingsPage.bookings as b (b.id)}
					<CoachSessionRow session={b} {zone} />
				{/each}
			</div>

			{#if pageCount > 1}
				<Pager current={pageNum} total={pageCount} onChange={setPage} />
			{/if}
		{/if}
	</div>
{/if}
