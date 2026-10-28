<script lang="ts">
	import { CoachSessionRow, StatCard, WeekGrid } from '$lib/components';
	import { formatTime, statusBadgeClass, statusLabel } from '$lib/utils/format';
	import { getWeekGrid } from '$lib/utils/weekGrid';
	import { getTrainerStats, type TrainerDashboardData } from './dashboard';

	let { data }: { data: TrainerDashboardData } = $props();

	// The coach's own zone, so "today" and the times shown match their working day.
	const zone = $derived(data.coach?.timezone ?? 'Asia/Singapore');
	const stats = $derived(getTrainerStats(data, zone));
	const actionCount = $derived(data.pendingRequests.length + data.sessionsToClose.length);

	const weekGrid = $derived(getWeekGrid(data, zone));

	const PREVIEW_COUNT = 3;
	const AWAITING_ACTION_HREF = '/bookings?tab=awaiting_action';
</script>

{#snippet groupHeading(label: string, filter: string, title?: string)}
	<div class="flex items-center justify-between">
		<h3 class="text-base-content/60 text-sm" {title}>{label}</h3>
		<a class="text-accent text-sm hover:underline" href="{AWAITING_ACTION_HREF}&filter={filter}">view all</a>
	</div>
{/snippet}

{#snippet moreLink(total: number, filter: string)}
	{#if total > PREVIEW_COUNT}
		<a href="{AWAITING_ACTION_HREF}&filter={filter}" class="text-accent text-left text-sm hover:underline">
			+{total - PREVIEW_COUNT} more
		</a>
	{/if}
{/snippet}

{#snippet today()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div class="flex items-center justify-between">
			<h2 class="font-headings text-xl">today</h2>
			<a class="text-accent text-sm hover:underline" title="sessions" href="/bookings">all sessions</a>
		</div>
		{#if data.todaySessions.length === 0}
			<p class="text-base-content/60 text-sm">nothing on today.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each data.todaySessions as s (s.id)}
					<div class="bg-base-200 border border-base-300 flex items-center gap-3 rounded-field p-3">
						<span class="font-headings w-12 shrink-0 text-center text-lg">{formatTime(s.startsAt, zone)}</span>
						<div class="min-w-0 flex-1">
							<div class="truncate text-sm font-medium">{s.clientName}</div>
							<div class="text-base-content/60 truncate text-xs">{s.type} · {s.location}</div>
							{#if s.clientNote}
								<div class="text-base-content/50 truncate text-xs italic">{s.clientNote}</div>
							{/if}
						</div>
						{#if s.status === 'completed'}
							<span class="badge badge-sm {statusBadgeClass(s.status)} font-body shrink-0"
								>{statusLabel(s.status)}</span
							>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet needsAction()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div class="flex items-center justify-between">
			<h2 class="font-headings text-xl">needs action</h2>
			{#if actionCount > 0}
				<span class="badge badge-sm badge-warning font-body">{actionCount} waiting</span>
			{/if}
		</div>
		{#if actionCount === 0}
			<p class="text-base-content/60 text-sm">all caught up.</p>
		{/if}
		{#if data.pendingRequests.length > 0}
			<div class="flex flex-col gap-2">
				{@render groupHeading('requests', 'requests')}
				{#each data.pendingRequests.slice(0, PREVIEW_COUNT) as r (r.id)}
					<CoachSessionRow session={r} {zone} />
				{/each}
				{@render moreLink(data.pendingRequests.length, 'requests')}
			</div>
		{/if}
		{#if data.sessionsToClose.length > 0}
			<div class="flex flex-col gap-2">
				{@render groupHeading('to close out', 'to_close', 'past sessions still waiting to be marked complete')}
				{#each data.sessionsToClose.slice(0, PREVIEW_COUNT) as s (s.id)}
					<CoachSessionRow session={s} {zone} />
				{/each}
				{@render moreLink(data.sessionsToClose.length, 'to_close')}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet availability()}
	<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div class="flex items-start justify-between gap-3">
			<div class="flex flex-col">
				<h2 class="font-headings text-xl">this week's availability</h2>
				<p class="text-base-content/60 text-sm">your open hours, and what's booked or requested in them.</p>
			</div>
			<a class="btn btn-sm shrink-0" href="/trainer/availability?edit=1">edit hours</a>
		</div>
		<WeekGrid grid={weekGrid} />
	</div>
{/snippet}

{#if !data.coach}
	<p class="text-base-content/60 max-w-sm">
		you don't have a coach profile yet — ask an admin to set one up before clients can book you.
	</p>
{:else}
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
		{#each stats as stat (stat.label)}
			<StatCard {stat} />
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		{@render today()}
		{@render needsAction()}
	</div>

	{@render availability()}
{/if}
