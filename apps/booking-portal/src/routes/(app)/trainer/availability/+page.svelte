<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { AvailabilityRangeEditor, WeekGrid } from '$lib/components';
	import {
		ONE_OFF_PREVIEW_COUNT,
		oneOffDatesLabel,
		oneOffTimesLabel,
		type OneOffChange,
		type WeeklyWindow
	} from '$lib/utils/availabilityEditor';
	import { getWeekGrid } from '$lib/utils/weekGrid';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// `?edit=1` opens the editor — the dashboard's "edit hours" link lands here.
	const editing = $derived(page.url.searchParams.get('edit') === '1');
	const setEditing = (on: boolean) => {
		const url = new URL(page.url);
		if (on) url.searchParams.set('edit', '1');
		else url.searchParams.delete('edit');
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	};

	let draftHours = $state<WeeklyWindow[]>();
	let draftOneOffs = $state<OneOffChange[]>();

	let showAllOneOffs = $state(false);
	const visibleOneOffs = $derived(
		data.coach && !showAllOneOffs ? data.oneOffs.slice(0, ONE_OFF_PREVIEW_COUNT) : (data.oneOffs ?? [])
	);
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
	<div class="flex flex-col">
		<h1 class="font-headings text-3xl">availability</h1>
		<p class="text-base-content/60">the hours clients can book you. they repeat every week.</p>
	</div>

	{#if !data.coach}
		<p class="text-base-content/60 max-w-sm">
			you don't have a coach profile yet — ask an admin to set one up before clients can book you.
		</p>
	{:else}
		{@const zone = data.coach.timezone}
		<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
			<div class="flex items-start justify-between gap-3">
				<div class="flex flex-col">
					<h2 class="font-headings text-xl">{editing ? 'your weekly hours' : "this week's availability"}</h2>
					{#if !editing}
						<p class="text-base-content/60 text-sm">your open hours, and what's booked or requested in them.</p>
					{/if}
				</div>
				{#if !editing}
					<button type="button" class="btn btn-sm shrink-0" onclick={() => setEditing(true)}>edit hours</button>
				{/if}
			</div>

			{#if !editing}
				<WeekGrid grid={getWeekGrid(data, zone)} />

				<hr class="border-base-300" />

				<div class="flex flex-col gap-2">
					<h3 class="font-headings text-lg">one-off changes</h3>
					{#if data.oneOffs.length === 0}
						<p class="text-base-content/50 text-sm">nothing coming up.</p>
					{:else}
						<ul class="border-base-300 divide-base-300 divide-y rounded-field border">
							{#each visibleOneOffs as entry (entry.id)}
								<li class="flex items-center gap-3 px-3 py-2.5">
									<span
										class="badge badge-sm font-body shrink-0 {entry.kind === 'closed'
											? 'badge-neutral'
											: 'badge-success'}"
									>
										{entry.kind === 'closed' ? 'time off' : 'extra hours'}
									</span>
									<div class="min-w-0 flex-1">
										<div class="text-sm">{oneOffDatesLabel(entry)} · {oneOffTimesLabel(entry)}</div>
										{#if entry.note}
											<div class="text-base-content/60 truncate text-xs">{entry.note}</div>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
						{#if data.oneOffs.length > ONE_OFF_PREVIEW_COUNT}
							<button
								type="button"
								class="text-accent self-start text-sm hover:underline"
								onclick={() => (showAllOneOffs = !showAllOneOffs)}
							>
								{showAllOneOffs ? 'show fewer' : `show ${data.oneOffs.length - ONE_OFF_PREVIEW_COUNT} more`}
							</button>
						{/if}
					{/if}
				</div>
			{:else}
				<!-- Re-created after a save so it starts from the newly saved hours. -->
				{#key [data.availability, data.oneOffs]}
					<AvailabilityRangeEditor
						windows={data.availability}
						oneOffs={data.oneOffs}
						today={data.today}
						upcoming={data.upcomingActive}
						{zone}
						minSessionLength={data.minSessionLength}
						onCancel={() => setEditing(false)}
						onSaved={() => setEditing(false)}
						bind:draft={draftHours}
						bind:draftOneOffs
					>
						{#snippet preview()}
							<div class="flex min-w-0 flex-col gap-3">
								<p class="text-base-content/60 text-sm">preview — this week with your new hours</p>
								<WeekGrid
									grid={getWeekGrid({ ...data, availability: draftHours ?? data.availability }, zone)}
								/>
							</div>
						{/snippet}
					</AvailabilityRangeEditor>
				{/key}
			{/if}
		</div>
	{/if}
</div>
