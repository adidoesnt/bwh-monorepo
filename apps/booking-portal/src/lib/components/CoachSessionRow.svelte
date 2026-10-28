<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { slide } from 'svelte/transition';
	import { showToast } from '$lib/toast.svelte';
	import { isNetworkFailure, NETWORK_ERROR_MESSAGE } from '$lib/utils/forms';
	import {
		bookingBadge,
		dayLabel,
		dayNumber,
		formatFullDate,
		formatTime,
		monthAbbrev,
		weekdayAbbrev
	} from '$lib/utils/format';

	type Session = {
		id: string;
		clientName: string;
		startsAt: Date;
		durationMin: number;
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
	let confirmDialog = $state<HTMLDialogElement>();
	let confirming = $state<'approve' | 'decline'>('approve');

	const openConfirm = (action: 'approve' | 'decline') => {
		confirming = action;
		confirmDialog?.showModal();
	};
	let error = $state<string | null>(null);
	// Only slide out when this row's own action removed it, not on tab/page changes.
	let resolved = $state(false);

	const firstName = $derived(session.clientName.split(' ')[0]);
	const when = $derived(`${dayLabel(session.startsAt, zone)} at ${formatTime(session.startsAt, zone)}`);
	const timeRange = $derived(
		`${formatTime(session.startsAt, zone)} – ${formatTime(
			new Date(session.startsAt.getTime() + session.durationMin * 60_000),
			zone
		)}`
	);
	const details = $derived(
		[
			['client', session.clientName],
			['date', `${weekdayAbbrev(session.startsAt, zone)} ${formatFullDate(session.startsAt, zone)}`],
			['time', `${timeRange} · ${session.durationMin} min`],
			['session', session.type],
			['location', session.location],
			['package', session.packageName ? `${session.packageName} · ${session.balance} left` : 'no package'],
			['note', session.clientNote ? `"${session.clientNote}"` : null]
		].filter((d): d is [string, string] => d[1] !== null)
	);

	// Handles the result here rather than through the page's `form` prop, since
	// this row also posts to /bookings from the dashboard.
	const SUCCESS_MESSAGES: Record<string, () => string> = {
		approve: () => `approved — ${firstName}'s session on ${when} is confirmed`,
		decline: () => `declined ${firstName}'s request for ${when}`,
		complete: () => `marked ${firstName}'s session on ${when} as complete`
	};

	const enhanceAction: SubmitFunction = ({ action }) => {
		const actionName = action.search.replace('?/', '');
		submitting = true;
		error = null;
		return async ({ result }) => {
			if (isNetworkFailure(result)) error = NETWORK_ERROR_MESSAGE;
			else if (result.type === 'failure') error = String(result.data?.message ?? 'something went wrong');
			else if (result.type === 'error') error = 'something went wrong — please try again';
			else {
				resolved = true;
				showToast(SUCCESS_MESSAGES[actionName]?.() ?? 'done');
				await invalidateAll();
			}
			submitting = false;
			confirmDialog?.close();
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
			<form method="POST" action="/bookings?/complete" class="shrink-0" use:enhance={enhanceAction}>
				<input type="hidden" name="bookingId" value={session.id} />
				<button class="btn btn-sm" disabled={submitting}>mark complete</button>
			</form>
		{:else if !isRequest}
			<span class="badge badge-sm {badge.className} font-body shrink-0">{badge.label}</span>
		{/if}
	</div>
	{#if isRequest && session.clientNote}
		<p class="text-base-content/70 text-sm italic">"{session.clientNote}"</p>
	{/if}
	{#if isRequest}
		<div class="flex gap-2">
			<button type="button" class="btn btn-sm btn-accent" onclick={() => openConfirm('approve')}>
				approve
			</button>
			<button type="button" class="btn btn-sm btn-ghost" onclick={() => openConfirm('decline')}>
				decline
			</button>
		</div>

		<dialog bind:this={confirmDialog} class="modal">
			<div class="modal-box bg-base-100 flex flex-col gap-4 rounded-2xl">
				<h3 class="font-headings text-xl">{confirming} this request?</h3>

				<dl class="bg-base-200 border-base-300 divide-base-300 divide-y rounded-field border text-sm">
					{#each details as [label, value] (label)}
						<div class="grid grid-cols-[5.5rem_1fr] gap-4 px-4 py-2.5">
							<dt class="text-base-content/60">{label}</dt>
							<dd class={label === 'note' ? 'italic' : ''}>{value}</dd>
						</div>
					{/each}
				</dl>

				<p class="text-base-content/70 text-sm">
					{#if confirming === 'decline'}
						{firstName} will see this request as declined in their history. this can't be undone.
					{:else if session.packageName && session.balance != null}
						this confirms the session and uses 1 session from {firstName}'s {session.packageName} package
						({session.balance} → {session.balance - 1} left).
					{:else}
						this confirms the session. it's not drawn from a package, so nothing is used up.
					{/if}
				</p>

				<form
					method="POST"
					action="/bookings?/{confirming}"
					class="modal-action mt-0"
					use:enhance={enhanceAction}
				>
					<input type="hidden" name="bookingId" value={session.id} />
					<button type="button" class="btn btn-sm btn-ghost" onclick={() => confirmDialog?.close()}>
						{confirming === 'decline' ? 'keep it' : 'not yet'}
					</button>
					<button
						class="btn btn-sm {confirming === 'decline' ? 'btn-error' : 'btn-accent'}"
						disabled={submitting}
					>
						{#if submitting}
							{confirming === 'decline' ? 'declining…' : 'approving…'}
						{:else}
							yes, {confirming}
						{/if}
					</button>
				</form>
			</div>
			<form method="dialog" class="modal-backdrop">
				<button aria-label="close">close</button>
			</form>
		</dialog>
	{/if}
	{#if error}
		<p class="text-error text-sm">{error}</p>
	{/if}
</div>
