<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { DropdownControl, Pager, PackagesCarousel, RecentActivity } from '$lib/components';
	import { PAGE_SIZE_OPTIONS, SORT_OPTIONS } from '$lib/utils/coachDirectory';
	import { formatPriceCents, viewerZone } from '$lib/utils/format';
	import { totalPages } from '$lib/utils/pagination';
	import type { PageProps } from './$types';
	import { isClient } from './packages';

	let { data }: PageProps = $props();

	const clientView = $derived(isClient(data));
	let zone: string = $derived(viewerZone(data.user));

	// `?bought=1` after a successful purchase (see [slug]/+page.server.ts's
	// redirect) — shown once, then stripped from the URL so a refresh or
	// share doesn't re-trigger it.
	let showBoughtToast = $state(page.url.searchParams.get('bought') === '1');

	$effect(() => {
		if (!showBoughtToast) return;

		untrack(() => {
			const url = new URL(page.url);
			url.searchParams.delete('bought');
			goto(url, { replaceState: true, keepFocus: true, noScroll: true });
		});

		const timer = setTimeout(() => (showBoughtToast = false), 3000);
		return () => clearTimeout(timer);
	});

	let search = $state(page.url.searchParams.get('q') ?? '');
	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	const selectedTags = $derived((page.url.searchParams.get('tags') ?? '').split(',').filter(Boolean));
	const sort = $derived(page.url.searchParams.get('sort') ?? 'name');
	const pageSize = $derived(Number(page.url.searchParams.get('pageSize')) || 10);
	const directoryPage = $derived(Number(page.url.searchParams.get('page')) || 1);

	const directoryTotalPages = $derived(totalPages(data.coachDirectoryPage.totalCount, pageSize));

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
</script>

{#snippet suggestedPackages()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-8 rounded-lg border p-6">
		<div class="flex flex-col">
			<h2 class="font-headings text-2xl">suggested packages</h2>
			<p class="text-base-content/60">
				{data.suggestedPackages.some((pkg) => pkg.reason === 'recent')
					? "picked from coaches you've recently trained with."
					: 'popular picks to get you started.'}
			</p>
		</div>

		{#if data.suggestedPackages.length === 0}
			<p class="text-base-content/60 text-sm">no suggestions yet — browse coaches to find a package.</p>
		{:else}
			<div class="flex flex-col gap-4">
				{#each data.suggestedPackages as pkg (pkg.packageId)}
					<a href={`/packages/${pkg.coachSlug}`} class="block">
						<div
							class="bg-base-200 hover:border-accent border-base-300 flex flex-col gap-2 rounded-field border p-4 transition-colors"
						>
							<div class="flex items-center justify-between gap-2">
								<h3 class="font-headings text-lg">{pkg.name}</h3>
								<span class="text-accent shrink-0 text-sm whitespace-nowrap">
									{formatPriceCents(pkg.sessionCount * pkg.pricePerSessionCents)}
								</span>
							</div>
							<p class="text-base-content/60 text-sm">
								{pkg.coachName} · {pkg.sessionCount} × {pkg.sessionLengthMin}-min sessions
							</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet coachDirectory()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-8 rounded-lg border p-6">
		<div class="flex flex-col">
			<h2 class="font-headings text-2xl">browse packages</h2>
			<p class="text-base-content/60">
				pick a coach to see the packages they sell — you can buy one any time, even before booking a
				session with them.
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
					<DropdownControl options={SORT_OPTIONS} current={sort} onSelect={setSort} />
				</span>
				<span class="text-base-content/60 flex items-center gap-1.5 text-sm">
					show
					<DropdownControl
						options={PAGE_SIZE_OPTIONS}
						current={String(pageSize)}
						onSelect={(v) => setPageSize(Number(v))}
					/>
				</span>
			</div>
		</div>

		{#if data.coachDirectoryPage.coaches.length === 0}
			<p class="text-base-content/60 text-sm">no coaches match.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.coachDirectoryPage.coaches as coach (coach.id)}
					<a href={`/packages/${coach.slug}`} class="block">
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
								<div class="text-base-content/40 text-xs italic">buy a package →</div>
							</div>
						</div>
					</a>
				{/each}
			</div>

			{#if directoryTotalPages > 1}
				<Pager current={directoryPage} total={directoryTotalPages} onChange={setDirectoryPage} />
			{/if}
		{/if}
	</div>
{/snippet}

<div class="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
	<div class="flex flex-col">
		<h1 class="font-headings text-3xl">packages</h1>
		<p class="text-base-content/60">purchase a package in order to start booking sessions with a coach of your choice.</p>
	</div>

	{#if clientView}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<PackagesCarousel activePackages={data.activePackages} {zone} />
			<RecentActivity recentActivity={data.recentActivity} />
		</div>

		<div class="flex flex-col gap-8">
			<div class="flex flex-col">
				<h2 class="font-headings text-2xl">purchase a package</h2>
				<p class="text-base-content/60">
					pick from your suggestions or browse the full coach directory.
				</p>
			</div>
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				{@render suggestedPackages()}
				{@render coachDirectory()}
			</div>
		</div>
	{:else}
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	{/if}
</div>

{#if showBoughtToast}
	<div class="toast toast-top toast-center z-50">
		<div class="alert alert-success">
			<span>package purchased — sessions are ready to book.</span>
		</div>
	</div>
{/if}
