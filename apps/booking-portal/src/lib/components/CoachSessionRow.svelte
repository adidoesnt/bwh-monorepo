<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { slide } from 'svelte/transition';
	import { showToast } from '$lib/toast.svelte';
	import { isNetworkFailure, NETWORK_ERROR_MESSAGE } from '$lib/utils/forms';
	import { bookingBadge, dayLabel, dayNumber, formatTime, monthAbbrev } from '$lib/utils/format';

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
	const badge = $derived(bookingBadge(session.status, session.startsAt));

	let submitting = $state(false);
	let confirmingDecline = $state(false);
	let error = $state<string | null>(null);
	// Only slide out when this row's own action removed it, not on tab/page changes.
	let resolved = $state(false);

	const firstName = $derived(session.clientName.split(' ')[0]);
	const when = $derived(`${dayLabel(session.startsAt, zone)} at ${formatTime(session.startsAt, zone)}`);

	// Handles the result here rather than through the page's `form` prop, since
	// this row also posts to /bookings from the dashboard.
	const enhanceAction: SubmitFunction = ({ action }) => {
		const declining = action.search.includes('decline');
		submitting = true;
		error = null;
		return async ({ result }) => {
			if (isNetworkFailure(result)) error = NETWORK_ERROR_MESSAGE;
			else if (result.type === 'failure') error = String(result.data?.message ?? 'something went wrong');
			else if (result.type === 'error') error = 'something went wrong — please try again';
			else {
				resolved = true;
				showToast(
					declining
						? `declined ${firstName}'s request for ${when}`
						: `approved — ${firstName}'s session on ${when} is confirmed`
				);
				await invalidateAll();
			}
			submitting = false;
			confirmingDecline = false;
		};
	};
</script>

<div
	class="bg-base-200 border border-base-300 flex flex-col gap-3 rounded-field p-3"
	out:slide={{ duration: resolved ? 200 : 0 }}
>
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
				{[isRequest && dayLabel(session.startsAt, zone), formatTime(session.startsAt, zone), session.type, session.location]
					.filter(Boolean)
					.join(' · ')}
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
		{:else if !isRequest}
			<span class="badge badge-sm {badge.className} font-body shrink-0">{badge.label}</span>
		{/if}
	</div>
	{#if isRequest && session.clientNote}
		<p class="text-base-content/70 text-sm italic">"{session.clientNote}"</p>
	{/if}
	{#if isRequest}
		<form method="POST" class="flex flex-wrap items-center gap-2" use:enhance={enhanceAction}>
			<input type="hidden" name="bookingId" value={session.id} />
			{#if confirmingDecline}
				<span class="text-base-content/70 text-sm">decline {firstName}'s request?</span>
				<button formaction="/bookings?/decline" class="btn btn-sm btn-error" disabled={submitting}>
					yes, decline
				</button>
				<button
					type="button"
					class="btn btn-sm btn-ghost"
					disabled={submitting}
					onclick={() => (confirmingDecline = false)}
				>
					keep it
				</button>
			{:else}
				<button formaction="/bookings?/approve" class="btn btn-sm btn-accent" disabled={submitting}>
					approve
				</button>
				<button type="button" class="btn btn-sm btn-ghost" onclick={() => (confirmingDecline = true)}>
					decline
				</button>
			{/if}
		</form>
	{/if}
	{#if error}
		<p class="text-error text-sm">{error}</p>
	{/if}
</div>
