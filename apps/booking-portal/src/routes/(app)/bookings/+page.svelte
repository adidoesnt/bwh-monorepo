<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChevronsDownIcon, CircleCheckIcon } from '@repo/ui';
	import { dayNumber, formatTime, monthAbbrev, statusBadgeClass, statusLabel, viewerZone } from '$lib/utils/format';
	import type { PageProps } from './$types';
	import {
		BUCKET_TABS,
		PAGE_SIZE_OPTIONS,
		SORT_OPTIONS,
		bucketCount,
		formatPriceCents,
		isClient,
		totalPages
	} from './bookings';

	let { data }: PageProps = $props();

	const clientView = $derived(isClient(data));
	const zone = $derived(viewerZone(data.user));

	let search = $state(page.url.searchParams.get('q') ?? '');
	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	const selectedTags = $derived((page.url.searchParams.get('tags') ?? '').split(',').filter(Boolean));
	const sort = $derived(page.url.searchParams.get('sort') ?? 'name');
	const pageSize = $derived(Number(page.url.searchParams.get('pageSize')) || 10);
	const directoryPage = $derived(Number(page.url.searchParams.get('page')) || 1);
	const bookingsPageNum = $derived(Number(page.url.searchParams.get('bookingsPage')) || 1);

	const directoryTotalPages = $derived(totalPages(data.coachDirectoryPage.totalCount, pageSize));
	const bookingsTotalPages = $derived(totalPages(data.bookingsPage.totalCount, 10));

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

	const toggleTag = (tag: string) => {
		const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
		updateUrl({ tags: next.length > 0 ? next.join(',') : null, page: null });
	};

	const setSort = (value: string) => updateUrl({ sort: value === 'name' ? null : value, page: null });
	const setPageSize = (value: number) =>
		updateUrl({ pageSize: value === 10 ? null : String(value), page: null });
	const setDirectoryPage = (n: number) => updateUrl({ page: n === 1 ? null : String(n) });

	const setBucket = (bucket: string) =>
		updateUrl({ tab: bucket === 'upcoming' ? null : bucket, bookingsPage: null });
	const setBookingsPage = (n: number) => updateUrl({ bookingsPage: n === 1 ? null : String(n) });

	const closeDropdown = (e: Event) => (e.currentTarget as HTMLElement).blur();
</script>

{#snippet dropdownControl(
	options: { value: string; label: string }[],
	current: string,
	onSelect: (value: string) => void
)}
	<div class="dropdown">
		<div
			tabindex="0"
			role="button"
			class="btn btn-sm border-base-300 bg-base-100 rounded-field flex items-center gap-1.5 font-normal"
		>
			{options.find((o) => o.value === current)?.label ?? current}
			<ChevronsDownIcon className="h-3 w-3" />
		</div>
		<ul
			tabindex="0"
			role="menu"
			class="dropdown-content menu bg-base-100 border-base-300 z-10 mt-1 w-36 rounded-xl border p-2 shadow-sm"
		>
			{#each options as opt (opt.value)}
				<li role="none">
					<button
						type="button"
						role="menuitem"
						class="flex items-center gap-2"
						onclick={(e) => {
							onSelect(opt.value);
							closeDropdown(e);
						}}
					>
						{#if opt.value === current}
							<CircleCheckIcon className="h-3 w-3" />
						{/if}
						{opt.label}
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/snippet}

{#snippet pager(current: number, total: number, onChange: (n: number) => void)}
	<div class="flex items-center justify-center gap-3 pt-1 text-sm">
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			disabled={current <= 1}
			onclick={() => onChange(current - 1)}
		>
			prev
		</button>
		<span class="text-base-content/60">page {current} of {total}</span>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			disabled={current >= total}
			onclick={() => onChange(current + 1)}
		>
			next
		</button>
	</div>
{/snippet}

{#snippet sessionsWidget()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div>
			<h2 class="font-headings text-xl">sessions</h2>
			<p class="text-base-content/60 text-sm">your upcoming, pending and past training sessions.</p>
		</div>

		<div role="tablist" class="tabs tabs-box w-fit">
			{#each BUCKET_TABS as tab (tab.id)}
				<button
					type="button"
					role="tab"
					class="tab gap-2 {data.bucket === tab.id ? 'tab-active' : ''}"
					onclick={() => setBucket(tab.id)}
				>
					{tab.label}
					{#if tab.badgeClass && bucketCount(data, tab.id) > 0}
						<span class="badge badge-sm {tab.badgeClass} font-body">{bucketCount(data, tab.id)}</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if data.bookingsPage.bookings.length === 0}
			<p class="text-base-content/60 text-sm">nothing here.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.bookingsPage.bookings as b (b.id)}
					<div class="bg-base-200 border-base-300 flex flex-col gap-3 rounded-field border p-3">
						<div class="flex items-center gap-3">
							<div
								class="bg-base-300 flex w-12 flex-col items-center rounded-field py-1.5 text-center leading-tight"
							>
								<span class="text-base-content/50 text-[10px]">{monthAbbrev(b.startsAt, zone)}</span>
								<span class="font-headings text-lg">{dayNumber(b.startsAt, zone)}</span>
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-medium">{b.type}</div>
								<div class="text-base-content/60 truncate text-xs">
									{formatTime(b.startsAt, zone)} · {b.coachName} · {b.location}
								</div>
							</div>
							<span class="badge badge-sm {statusBadgeClass(b.status)} font-body shrink-0"
								>{statusLabel(b.status)}</span
							>
						</div>
						{#if data.bucket !== 'past'}
							<div class="flex gap-2">
								<button type="button" class="btn btn-outline btn-xs" disabled title="coming soon">
									reschedule
								</button>
								<button type="button" class="btn btn-outline btn-xs" disabled title="coming soon">
									cancel
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if bookingsTotalPages > 1}
				{@render pager(bookingsPageNum, bookingsTotalPages, setBookingsPage)}
			{/if}
		{/if}
	</div>
{/snippet}

{#snippet coachDirectory()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div>
			<h2 class="font-headings text-xl">choose your coach</h2>
			<p class="text-base-content/60 text-sm">
				each coach keeps her own page, hours and rates. you can train with more than one.
			</p>
		</div>

		<input
			type="search"
			placeholder="search by name, speciality or location…"
			class="input input-bordered w-full"
			value={search}
			oninput={(e) => onSearchInput(e.currentTarget.value)}
		/>

		<div class="flex gap-2 overflow-x-auto pb-1">
			<button
				type="button"
				class="btn btn-sm shrink-0 rounded-full font-normal {selectedTags.length === 0
					? 'btn-neutral'
					: 'border-base-300 bg-base-100 text-base-content/70'}"
				onclick={() => updateUrl({ tags: null, page: null })}
			>
				all
			</button>
			{#each data.coachTags as tag (tag)}
				<button
					type="button"
					class="btn btn-sm shrink-0 rounded-full font-normal {selectedTags.includes(tag)
						? 'btn-neutral'
						: 'border-base-300 bg-base-100 text-base-content/70'}"
					onclick={() => toggleTag(tag)}
				>
					{tag}
				</button>
			{/each}
		</div>

		<div class="flex items-center justify-between gap-3">
			<span class="text-base-content/60 text-sm">
				{data.coachDirectoryPage.coaches.length} of {data.coachDirectoryPage.totalCount} coaches
			</span>
			<div class="flex items-center gap-3">
				<span class="text-base-content/60 flex items-center gap-1.5 text-sm">
					sort
					{@render dropdownControl(SORT_OPTIONS, sort, setSort)}
				</span>
				<span class="text-base-content/60 flex items-center gap-1.5 text-sm">
					show
					{@render dropdownControl(PAGE_SIZE_OPTIONS, String(pageSize), (v) => setPageSize(Number(v)))}
				</span>
			</div>
		</div>

		{#if data.coachDirectoryPage.coaches.length === 0}
			<p class="text-base-content/60 text-sm">no coaches match.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.coachDirectoryPage.coaches as coach (coach.id)}
					<div class="bg-base-200 border-base-300 flex items-center gap-3 rounded-field border p-3">
						<div
							class="bg-neutral text-neutral-content grid h-10 w-10 shrink-0 place-items-center rounded-full font-headings text-sm"
						>
							{coach.name[0]}
						</div>
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<div class="flex items-center justify-between gap-2">
								<div class="truncate text-sm font-medium">{coach.name}</div>
								{#if coach.cheapestPriceCents !== null}
									<span class="text-accent shrink-0 text-sm whitespace-nowrap"
										>from {formatPriceCents(coach.cheapestPriceCents)}</span
									>
								{/if}
							</div>
							<div class="text-base-content/70 truncate text-xs">{coach.tagline}</div>
							<div class="text-base-content/50 truncate text-xs">{coach.tags.join(' · ')}</div>
							<div class="text-base-content/40 text-xs italic">availability — coming soon</div>
						</div>
					</div>
				{/each}
			</div>

			{#if directoryTotalPages > 1}
				{@render pager(directoryPage, directoryTotalPages, setDirectoryPage)}
			{/if}
		{/if}
	</div>
{/snippet}

<div class="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
	<h1 class="font-headings text-3xl">bookings</h1>

	{#if clientView}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render sessionsWidget()}
			{@render coachDirectory()}
		</div>
	{:else}
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	{/if}
</div>
