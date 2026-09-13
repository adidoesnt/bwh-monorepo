<script lang="ts">
	import { ChevronLeftIcon, ChevronRightIcon } from '@repo/ui';
	import { dayNumber, formatFullDate, formatTime, monthAbbrev, statusBadgeClass, statusLabel, viewerZone } from '$lib/utils/format';
	import type { PageProps } from './$types';
	import { getStats, isClient } from './dashboard';
    import { PackagesCarousel, RecentActivity } from '$lib/components';

	let { data }: PageProps = $props();

	const firstName = $derived(data.user.name.split(' ')[0] ?? data.user.name);

	const clientView = $derived(isClient(data));
	const zone = $derived(viewerZone(data.user));
	const stats = $derived(getStats(data, zone));
</script>

{#snippet statCard(stat: { label: string; value: string; sub: string })}
	<div class="bg-base-100 border-base-300 rounded-2xl border p-4">
		<div class="text-base-content/60 text-sm">{stat.label}</div>
		<div class="font-headings text-2xl">{stat.value}</div>
		<div class="text-base-content/50 text-xs">{stat.sub}</div>
	</div>
{/snippet}

{#snippet whatsNext()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div class="flex items-center justify-between">
			<h2 class="font-headings text-xl">what's next</h2>
			<a class="text-accent text-sm hover:underline" title="bookings" href="/bookings">all bookings</a>
		</div>
		{#if data.upcomingBookings.length === 0}
			<p class="text-base-content/60 text-sm">no upcoming sessions yet.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.upcomingBookings as b (b.id)}
					<div class="bg-base-200 flex items-center gap-3 rounded-field p-3">
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
				{/each}
			</div>
			{#if data.upcomingBookingsCount > data.upcomingBookings.length}
				<a href="/bookings" class="text-accent text-left text-sm hover:underline">
					+{data.upcomingBookingsCount - data.upcomingBookings.length} more
				</a>
			{/if}
		{/if}
	</div>
{/snippet}

{#snippet weeklyFocus()}
	<div class="bg-success/30 text-success-content flex flex-col gap-3 rounded-2xl p-5">
		<h2 class="font-headings text-xl">this week's focus</h2>
		<!-- TODO: real per-coach carousel backed by a weekly_focus table (see DATA-MODEL.md discussion) -->
		<p class="text-success-content/70 text-sm">
			your coaches' focus for the week will show up here once programming is wired up.
		</p>
	</div>
{/snippet}

<div class="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
	<div class="flex items-center justify-between">
		<h1 class="font-headings text-3xl">hey {firstName}!</h1>
		<a href="/bookings" class="btn btn-accent" title="request a session">request a session</a>
	</div>

	{#if clientView}
		<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
			{#each stats as stat (stat.label)}
				{@render statCard(stat)}
			{/each}
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{@render whatsNext()}
			<PackagesCarousel activePackages={data.activePackages} {zone} />
			{@render weeklyFocus()}
			<RecentActivity recentActivity={data.recentActivity} />
		</div>
	{:else}
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	{/if}
</div>
