<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { untrack } from 'svelte';
	import { DropdownControl, Pager } from '$lib/components';
	import { showToast } from '$lib/toast.svelte';
	import { PAGE_SIZE_OPTIONS, SORT_OPTIONS } from '$lib/utils/coachDirectory';
	import { isNetworkFailure, NETWORK_ERROR_MESSAGE } from '$lib/utils/forms';
	import {
		bookingBadge,
		dayNumber,
		formatFullDate,
		formatPriceCents,
		formatTime,
		monthAbbrev,
		viewerZone,
		weekdayAbbrev
	} from '$lib/utils/format';
	import { totalPages } from '$lib/utils/pagination';
	import { BUCKET_TABS, bucketCount, type ClientBookingsData } from './bookings';

	let { data }: { data: ClientBookingsData } = $props();

	const zone = $derived(viewerZone(data.user));

	// `?booked=1` after a successful request (see [slug]/+page.server.ts's
	// redirect) — shown once, then stripped from the URL so a refresh or
	// share doesn't re-trigger it.
	let showBookedToast = $state(page.url.searchParams.get('booked') === '1');

	$effect(() => {
		if (!showBookedToast) return;

		untrack(() => {
			const url = new URL(page.url);
			url.searchParams.delete('booked');
			goto(url, { replaceState: true, keepFocus: true, noScroll: true });
		});

		const timer = setTimeout(() => (showBookedToast = false), 3000);
		return () => clearTimeout(timer);
	});

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

	type ManagedBooking = ClientBookingsData['bookingsPage']['bookings'][number];

	let manageDialog = $state<HTMLDialogElement>();
	let managingId = $state<string | null>(null);
	let confirmingCancel = $state(false);
	let cancelling = $state(false);
	let savingReflection = $state(false);
	let reflectionDraft = $state('');
	let manageError = $state<string | null>(null);

	// Looked up by id so a reload after a failed cancel shows the fresh outcome.
	const managing = $derived(data.bookingsPage.bookings.find((b) => b.id === managingId) ?? null);

	const openManage = (id: string) => {
		managingId = id;
		confirmingCancel = false;
		manageError = null;
		reflectionDraft = data.bookingsPage.bookings.find((b) => b.id === id)?.clientReflection ?? '';
		manageDialog?.showModal();
	};

	const coachFirstName = (b: ManagedBooking) => b.coachName.split(' ')[0];

	const manageDetails = (b: ManagedBooking) => {
		const end = new Date(b.startsAt.getTime() + b.durationMin * 60_000);
		// The balance is today's, so it only makes sense next to an upcoming session.
		const showBalance = b.startsAt.getTime() > Date.now();
		return [
			['coach', b.coachName],
			['date', `${weekdayAbbrev(b.startsAt, zone)} ${formatFullDate(b.startsAt, zone)}`],
			['time', `${formatTime(b.startsAt, zone)} – ${formatTime(end, zone)} · ${b.durationMin} min`],
			['session', b.type],
			['location', b.location],
			[
				'package',
				!b.packageName ? 'no package' : showBalance ? `${b.packageName} · ${b.balance} left` : b.packageName
			],
			['note', b.clientNote ? `"${b.clientNote}"` : null]
		].filter((d): d is [string, string] => d[1] !== null);
	};

	const cancelEffect = (b: ManagedBooking) => {
		const hours = data.cancellationWindowHours;
		if (b.cancelOutcome === 'none') {
			return `${coachFirstName(b)} hasn't confirmed this yet, so nothing's been used — cancelling costs you nothing.`;
		}
		if (!b.packageName || b.balance === null) {
			return `this session isn't drawn from a package, so cancelling costs you nothing.`;
		}
		if (b.cancelOutcome === 'return') {
			return `it's more than ${hours} hours away, so the session goes back to your ${b.packageName} package (${b.balance} → ${b.balance + 1} left).`;
		}
		return `it's less than ${hours} hours away, so this session won't go back to your ${b.packageName} package.`;
	};

	const cancelledMessage = (b: ManagedBooking) => {
		if (b.cancelOutcome === 'none') return `cancelled your request with ${coachFirstName(b)}`;
		if (b.cancelOutcome === 'return' && b.packageName) {
			return `cancelled — the session's back on your ${b.packageName} package`;
		}
		return `cancelled your session with ${coachFirstName(b)}`;
	};

	const enhanceCancel: SubmitFunction = () => {
		const cancelled = managing;
		cancelling = true;
		manageError = null;
		return async ({ result }) => {
			if (isNetworkFailure(result)) manageError = NETWORK_ERROR_MESSAGE;
			else if (result.type === 'failure') {
				const message = String(result.data?.message ?? 'something went wrong');
				await invalidateAll();
				// The reload can move the booking to another tab, leaving nothing to show in the modal.
				if (managing) manageError = message;
				else {
					manageDialog?.close();
					showToast(message, 'error');
				}
			} else if (result.type === 'error') manageError = 'something went wrong — please try again';
			else {
				manageDialog?.close();
				if (cancelled) showToast(cancelledMessage(cancelled));
				await invalidateAll();
			}
			cancelling = false;
		};
	};

	const enhanceReflect: SubmitFunction = () => {
		const cleared = reflectionDraft.trim() === '';
		savingReflection = true;
		manageError = null;
		return async ({ result }) => {
			if (isNetworkFailure(result)) manageError = NETWORK_ERROR_MESSAGE;
			else if (result.type === 'failure') manageError = String(result.data?.message ?? 'something went wrong');
			else if (result.type === 'error') manageError = 'something went wrong — please try again';
			else {
				manageDialog?.close();
				showToast(cleared ? 'notes removed' : 'notes saved');
				await invalidateAll();
			}
			savingReflection = false;
		};
	};
</script>

{#snippet manageModal()}
	<dialog bind:this={manageDialog} class="modal">
		<div class="modal-box bg-base-100 flex flex-col gap-4 rounded-2xl">
			{#if managing}
				<h3 class="font-headings text-xl">
					{confirmingCancel ? 'cancel this session?' : 'your session'}
				</h3>

				<dl class="bg-base-200 border-base-300 divide-base-300 divide-y rounded-field border text-sm">
					{#each manageDetails(managing) as [label, value] (label)}
						<div class="grid grid-cols-[5.5rem_1fr] gap-4 px-4 py-2.5">
							<dt class="text-base-content/60">{label}</dt>
							<dd class={label === 'note' ? 'italic' : ''}>{value}</dd>
						</div>
					{/each}
				</dl>

				{#if managing.cancelOutcome !== 'blocked'}
					<p class="text-base-content/70 text-sm">{cancelEffect(managing)}</p>
				{/if}

				{#if managing.canReflect}
					<form method="POST" action="?/reflect" class="flex flex-col gap-2" use:enhance={enhanceReflect}>
						<input type="hidden" name="bookingId" value={managing.id} />
						<label class="text-base-content/60 text-sm" for="reflection">your notes</label>
						<textarea
							id="reflection"
							name="reflection"
							bind:value={reflectionDraft}
							maxlength={data.reflectionMaxLength}
							rows="3"
							class="textarea textarea-bordered w-full"
							placeholder="how did it go? anything to remember for next time?"
						></textarea>
						<button
							class="btn btn-sm btn-accent self-end"
							disabled={savingReflection || reflectionDraft.trim() === (managing.clientReflection ?? '')}
						>
							{savingReflection ? 'saving…' : 'save notes'}
						</button>
					</form>
				{/if}

				{#if manageError}
					<p class="text-error text-sm">{manageError}</p>
				{/if}

				{#if confirmingCancel}
					<form method="POST" action="?/cancel" class="modal-action mt-0" use:enhance={enhanceCancel}>
						<input type="hidden" name="bookingId" value={managing.id} />
						<input type="hidden" name="expectedOutcome" value={managing.cancelOutcome} />
						<button type="button" class="btn btn-sm btn-ghost" onclick={() => (confirmingCancel = false)}>
							keep it
						</button>
						<button class="btn btn-sm btn-error" disabled={cancelling}>
							{cancelling ? 'cancelling…' : 'yes, cancel'}
						</button>
					</form>
				{:else}
					<div class="modal-action mt-0">
						<button type="button" class="btn btn-sm btn-ghost" onclick={() => manageDialog?.close()}>
							close
						</button>
						{#if managing.cancelOutcome !== 'blocked'}
							<button type="button" class="btn btn-sm btn-outline" disabled title="coming soon">
								reschedule
							</button>
							<button
								type="button"
								class="btn btn-sm btn-outline btn-error"
								onclick={() => (confirmingCancel = true)}
							>
								cancel session
							</button>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button aria-label="close">close</button>
		</form>
	</dialog>
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
					{#if tab.badgeClass && bucketCount(data.bucketCounts, tab.id) > 0}
						<span class="badge badge-sm {tab.badgeClass} font-body">{bucketCount(data.bucketCounts, tab.id)}</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if data.bookingsPage.bookings.length === 0}
			<p class="text-base-content/60 text-sm">nothing here.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.bookingsPage.bookings as b (b.id)}
					{@const badge = bookingBadge(b.status, b.startsAt)}
					<button
						type="button"
						class="bg-base-200 border-base-300 hover:border-base-content/20 flex flex-col gap-2 rounded-field border p-3 text-left"
						onclick={() => openManage(b.id)}
					>
						<div class="flex w-full items-center gap-3">
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
							<span class="badge badge-sm {badge.className} font-body shrink-0">{badge.label}</span>
						</div>
						{#if b.clientReflection}
							<p class="text-base-content/70 line-clamp-2 text-sm italic">"{b.clientReflection}"</p>
						{:else if b.canReflect}
							<p class="text-base-content/40 text-xs">+ add your notes</p>
						{/if}
					</button>
				{/each}
			</div>

			{#if bookingsTotalPages > 1}
				<Pager current={bookingsPageNum} total={bookingsTotalPages} onChange={setBookingsPage} />
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
    				<a href={`/bookings/${coach.slug}`} class="block">
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
    				</a>
				{/each}
			</div>

			{#if directoryTotalPages > 1}
				<Pager current={directoryPage} total={directoryTotalPages} onChange={setDirectoryPage} />
			{/if}
		{/if}
	</div>
{/snippet}

<div class="flex flex-col">
	<h1 class="font-headings text-3xl">bookings</h1>
	<p class="text-base-content/60">pick a coach to see their page, their hours and their rates.</p>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	{@render sessionsWidget()}
	{@render coachDirectory()}
</div>

{@render manageModal()}

{#if showBookedToast}
	<div class="toast toast-top toast-center z-50 w-full md:toast-end md:w-auto">
		<div class="alert alert-success w-full rounded-2xl md:w-auto">
			<span>request sent — your coach will approve it soon.</span>
		</div>
	</div>
{/if}
