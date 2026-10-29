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
		lateCancel?: boolean;
		latestProposal?: {
			id: string;
			startsAt: Date;
			proposedBy: string;
			status: string;
		} | null;
	};

	let { session, zone }: { session: Session; zone: string } = $props();

	const isPast = $derived(session.startsAt.getTime() < Date.now());
	const isRequest = $derived(session.status === 'pending_approval' && !isPast);
	const isToClose = $derived(session.status === 'confirmed' && isPast);
	// A client asking to move a confirmed session — waiting on the coach.
	const proposal = $derived(
		session.status === 'confirmed' &&
			!isPast &&
			session.latestProposal?.status === 'pending' &&
			session.latestProposal.proposedBy === 'client' &&
			session.latestProposal.startsAt.getTime() > Date.now()
			? session.latestProposal
			: null
	);
	const badge = $derived(bookingBadge(session.status, session.startsAt, session.lateCancel));

	type ConfirmAction = 'approve' | 'decline' | 'acceptProposal' | 'declineProposal';

	let submitting = $state(false);
	let confirmDialog = $state<HTMLDialogElement>();
	let confirming = $state<ConfirmAction>('approve');
	let declineNote = $state('');

	const openConfirm = (action: ConfirmAction) => {
		confirming = action;
		declineNote = '';
		confirmDialog?.showModal();
	};

	const isDeclining = $derived(confirming === 'decline' || confirming === 'declineProposal');
	const CONFIRM_TITLES: Record<ConfirmAction, string> = {
		approve: 'approve this request?',
		decline: 'decline this request?',
		acceptProposal: 'move this session?',
		declineProposal: 'keep the current time?'
	};
	const CONFIRM_LABELS: Record<ConfirmAction, [idle: string, busy: string]> = {
		approve: ['yes, approve', 'approving…'],
		decline: ['yes, decline', 'declining…'],
		acceptProposal: ['yes, move it', 'moving…'],
		declineProposal: ['yes, decline', 'declining…']
	};
	let error = $state<string | null>(null);
	// Only slide out when this row's own action removed it, not on tab/page changes.
	let resolved = $state(false);

	const firstName = $derived(session.clientName.split(' ')[0]);
	const when = $derived(`${dayLabel(session.startsAt, zone)} at ${formatTime(session.startsAt, zone)}`);
	const proposedWhen = $derived(
		proposal ? `${dayLabel(proposal.startsAt, zone)} at ${formatTime(proposal.startsAt, zone)}` : ''
	);
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
			[
				'moving to',
				proposal
					? `${weekdayAbbrev(proposal.startsAt, zone)} ${formatFullDate(proposal.startsAt, zone)} · ${formatTime(proposal.startsAt, zone)}`
					: null
			],
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
		complete: () => `marked ${firstName}'s session on ${when} as complete`,
		acceptProposal: () => `moved ${firstName}'s session to ${proposedWhen}`,
		declineProposal: () => `declined — ${firstName}'s session stays ${when}`
	};

	const enhanceAction: SubmitFunction = ({ action }) => {
		const actionName = action.search.replace('?/', '');
		submitting = true;
		error = null;
		return async ({ result }) => {
			if (isNetworkFailure(result)) error = NETWORK_ERROR_MESSAGE;
			else if (result.type === 'failure') {
				// Usually the booking changed under the coach (the client moved or withdrew,
				// another tab answered). Reload so the row shows what's true now; the message
				// goes in a toast since the reload may remove this row.
				showToast(String(result.data?.message ?? 'something went wrong'), 'error');
				await invalidateAll();
			} else if (result.type === 'error') error = 'something went wrong — please try again';
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
			{:else if proposal}
				<div class="text-warning-content/80 truncate text-xs">
					{dayLabel(session.startsAt, zone)} · asking to move to {dayLabel(proposal.startsAt, zone)} · {formatTime(
						proposal.startsAt,
						zone
					)}
				</div>
			{/if}
		</div>
		{#if isToClose}
			<form method="POST" action="/bookings?/complete" class="shrink-0" use:enhance={enhanceAction}>
				<input type="hidden" name="bookingId" value={session.id} />
				<button class="btn btn-sm" disabled={submitting}>mark complete</button>
			</form>
		{:else if !isRequest && !proposal}
			<span class="badge badge-sm {badge.className} font-body shrink-0">{badge.label}</span>
		{/if}
	</div>
	{#if isRequest && session.clientNote}
		<p class="text-base-content/70 text-sm italic">"{session.clientNote}"</p>
	{/if}
	{#if isRequest || proposal}
		<div class="flex gap-2">
			{#if isRequest}
				<button type="button" class="btn btn-sm btn-accent" onclick={() => openConfirm('approve')}>
					approve
				</button>
				<button type="button" class="btn btn-sm btn-ghost" onclick={() => openConfirm('decline')}>
					decline
				</button>
			{:else}
				<button type="button" class="btn btn-sm btn-accent" onclick={() => openConfirm('acceptProposal')}>
					move it
				</button>
				<button type="button" class="btn btn-sm btn-ghost" onclick={() => openConfirm('declineProposal')}>
					keep current time
				</button>
			{/if}
		</div>

		<dialog bind:this={confirmDialog} class="modal">
			<div class="modal-box bg-base-100 flex flex-col gap-4 rounded-2xl">
				<h3 class="font-headings text-xl">{CONFIRM_TITLES[confirming]}</h3>

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
					{:else if confirming === 'acceptProposal'}
						the session moves to {proposedWhen} and {when} opens up again. nothing changes on {firstName}'s
						package.
					{:else if confirming === 'declineProposal'}
						the session stays {when}. {firstName} will see you couldn't do {proposedWhen}, with your note if
						you add one.
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
					class="flex flex-col gap-4"
					use:enhance={enhanceAction}
				>
					<input type="hidden" name="bookingId" value={session.id} />
					{#if proposal}
						<input type="hidden" name="proposalId" value={proposal.id} />
					{/if}
					{#if confirming === 'declineProposal'}
						<label class="flex flex-col gap-1.5 text-sm">
							<span class="text-base-content/60">note to {firstName} (optional)</span>
							<textarea
								name="note"
								bind:value={declineNote}
								maxlength="300"
								rows="2"
								class="textarea textarea-bordered w-full"
								placeholder="i'm away that week — could thursday morning work instead?"
							></textarea>
						</label>
					{/if}
					<div class="modal-action mt-0">
						<button type="button" class="btn btn-sm btn-ghost" onclick={() => confirmDialog?.close()}>
							{isDeclining ? 'keep it' : 'not yet'}
						</button>
						<button class="btn btn-sm {isDeclining ? 'btn-error' : 'btn-accent'}" disabled={submitting}>
							{CONFIRM_LABELS[confirming][submitting ? 1 : 0]}
						</button>
					</div>
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
