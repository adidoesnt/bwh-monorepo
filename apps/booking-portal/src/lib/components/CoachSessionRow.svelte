<script lang="ts">
	import { dayLabel, dayNumber, formatTime, monthAbbrev, statusBadgeClass, statusLabel } from '$lib/utils/format';

	type Session = {
		id: string;
		clientName: string;
		startsAt: Date;
		type: string;
		location: string;
		status: string;
		clientNote: string | null;
		packageName?: string | null;
		balance?: number | null;
	};

	let { session, zone }: { session: Session; zone: string } = $props();

	const isPast = $derived(session.startsAt.getTime() < Date.now());
	const isRequest = $derived(session.status === 'pending_approval' && !isPast);
	const isToClose = $derived(session.status === 'confirmed' && isPast);
	// A request whose slot came and went without an answer.
	const isLapsed = $derived(session.status === 'pending_approval' && isPast);
</script>

<div class="bg-base-200 border border-base-300 flex flex-col gap-3 rounded-field p-3">
	<div class="flex items-center gap-3">
		<div
			class="bg-base-300 flex w-12 shrink-0 flex-col items-center rounded-field py-1.5 text-center leading-tight"
		>
			<span class="text-base-content/50 text-[10px]">{monthAbbrev(session.startsAt, zone)}</span>
			<span class="font-headings text-lg">{dayNumber(session.startsAt, zone)}</span>
		</div>
		<div class="min-w-0 flex-1">
			<div class="truncate text-sm font-medium">{session.clientName}</div>
			<div class="text-base-content/60 truncate text-xs">
				{#if isRequest}{dayLabel(session.startsAt, zone)} · {/if}{formatTime(session.startsAt, zone)} · {session.type}
				· {session.location}
			</div>
			{#if isRequest}
				<div class="text-base-content/60 truncate text-xs">
					{session.packageName ? `${session.packageName} · ${session.balance} left` : 'no package'}
				</div>
			{/if}
		</div>
		{#if isToClose}
			<!-- Wired up in a later step. -->
			<button type="button" class="btn btn-sm shrink-0" disabled>mark complete</button>
		{:else if isLapsed}
			<span class="badge badge-sm badge-ghost font-body shrink-0">lapsed</span>
		{:else if !isRequest}
			<span class="badge badge-sm {statusBadgeClass(session.status)} font-body shrink-0"
				>{statusLabel(session.status)}</span
			>
		{/if}
	</div>
	{#if isRequest && session.clientNote}
		<p class="text-base-content/70 text-sm italic">"{session.clientNote}"</p>
	{/if}
	{#if isRequest}
		<!-- Wired up in the next step. -->
		<div class="flex gap-2">
			<button type="button" class="btn btn-sm btn-accent" disabled>approve</button>
			<button type="button" class="btn btn-sm btn-ghost" disabled>decline</button>
		</div>
	{/if}
</div>
