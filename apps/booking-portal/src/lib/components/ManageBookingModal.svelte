<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { cancelOutcome, canReschedule, type CancelOutcome } from '$lib/booking';
	import { longDate, timeOf } from '$lib/format';
	import { statusLabel } from '$lib/status';
	import type { ClientBooking } from '$lib/server/queries';

	type Step = 'menu' | 'cancel' | 'cancel-done' | 'note';

	type Props = {
		booking: ClientBooking;
		clientZone: string;
		open?: boolean;
		onclose?: () => void;
	};
	let { booking, clientZone, open = $bindable(false), onclose }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let step = $state<Step>('menu');
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let doneOutcome = $state<CancelOutcome | null>(null);

	const now = new Date();
	const start = $derived(new Date(booking.startsAt));
	const isPast = $derived(start < now || booking.status === 'completed');
	const outcome = $derived(cancelOutcome(booking.status, start, now));
	const reschedulable = $derived(booking.coachActive && canReschedule(booking.status, start, now));
	const cancelable = $derived(outcome !== 'blocked');
	const packLabel = $derived(booking.packageName ?? 'your package');

	const cancelCopy: Record<CancelOutcome, string> = $derived({
		none: 'this frees the slot back up. no session was drawn for this one, so there is nothing to give back.',
		return: `you're more than 24 hours out, so the session goes straight back to ${packLabel}.`,
		forfeit: `this is within 24 hours of the session, so it's used up — it won't come back to ${packLabel}. this can't be undone.`,
		blocked: ''
	});

	// Show/hide only — reset to the menu each time it opens.
	$effect(() => {
		if (!dialog) return;
		if (open) {
			step = 'menu';
			error = null;
			dialog.showModal();
		} else {
			dialog.close();
		}
	});

	function close() {
		open = false;
		step = 'menu';
		error = null;
		doneOutcome = null;
		onclose?.();
	}

	function reschedule() {
		close();
		goto(`/bookings/${booking.coachSlug}?reschedule=${booking.id}`);
	}
</script>

<dialog bind:this={dialog} class="modal" onclose={close}>
	<div class="modal-box max-w-md rounded-sm">
		<button
			class="btn btn-sm btn-circle btn-ghost text-base-content/50 absolute right-2 top-2"
			aria-label="close"
			onclick={close}
		>
			✕
		</button>

		<h3 class="font-headings mb-1 text-xl">
			{#if step === 'cancel'}cancel this session?
			{:else if step === 'cancel-done'}session cancelled
			{:else if step === 'note'}your notes
			{:else}manage session{/if}
		</h3>
		<p class="text-base-content/60 mb-4 text-xs">
			{booking.coachName} · {booking.type} · {longDate(start, clientZone)} ·
			{timeOf(start, clientZone)} · {booking.location}
		</p>

		{#if error}
			<div class="border-error bg-error/15 mb-4 rounded-md border p-3 text-sm">{error}</div>
		{/if}

		{#if step === 'menu'}
			<div class="flex flex-col gap-2">
				<span class="badge badge-sm badge-ghost font-body self-start">
					{statusLabel[booking.status]}
				</span>

				{#if isPast}
					<button class="btn btn-sm w-full" onclick={() => (step = 'note')}>
						{booking.clientReflection ? 'edit your notes' : 'add your notes'}
					</button>
				{/if}

				{#if reschedulable}
					<button class="btn btn-sm w-full" onclick={reschedule}>reschedule</button>
				{:else if !isPast && !booking.coachActive}
					<p class="text-base-content/45 text-xs">
						this coach is no longer taking bookings — reschedule isn't available.
					</p>
				{/if}

				{#if cancelable && !isPast}
					<button
						class="btn btn-ghost btn-sm text-error w-full"
						onclick={() => (step = 'cancel')}
					>
						cancel session
					</button>
				{/if}
			</div>
		{:else if step === 'cancel'}
			<p class="text-base-content/70 text-sm leading-relaxed">{cancelCopy[outcome]}</p>
			<form
				method="POST"
				action="/bookings?/cancel"
				use:enhance={() => {
					submitting = true;
					error = null;
					return async ({ result, update }) => {
						submitting = false;
						if (result.type === 'failure') {
							error = (result.data?.error as string) ?? 'something went wrong — try again.';
							return;
						}
						if (result.type === 'success') {
							doneOutcome = (result.data?.cancelled as CancelOutcome) ?? outcome;
							step = 'cancel-done';
							await update({ invalidateAll: true });
						}
					};
				}}
			>
				<input type="hidden" name="bookingId" value={booking.id} />
				<div class="modal-action">
					<button type="button" class="btn btn-sm" onclick={() => (step = 'menu')}>keep it</button>
					<button type="submit" class="btn btn-sm btn-error" disabled={submitting}>
						{submitting ? 'cancelling…' : 'cancel session'}
					</button>
				</div>
			</form>
		{:else if step === 'cancel-done'}
			<p class="text-base-content/70 text-sm leading-relaxed">
				{#if doneOutcome === 'return'}
					done — the session is back on {packLabel}.
				{:else if doneOutcome === 'forfeit'}
					done. the session was used for this late cancellation.
				{:else}
					done — the slot is freed up.
				{/if}
			</p>
			<div class="modal-action">
				<button class="btn btn-sm btn-primary" onclick={close}>done</button>
			</div>
		{:else}
			<form
				method="POST"
				action="/bookings?/reflect"
				use:enhance={() => {
					submitting = true;
					error = null;
					return async ({ result, update }) => {
						submitting = false;
						if (result.type === 'failure') {
							error = (result.data?.error as string) ?? 'something went wrong — try again.';
							return;
						}
						if (result.type === 'success') {
							await update({ invalidateAll: true });
							close();
						}
					};
				}}
			>
				<input type="hidden" name="bookingId" value={booking.id} />
				<label class="text-base-content/60 mb-3 flex flex-col gap-1.5 text-xs">
					how did it go? just for you.
					<textarea
						name="reflection"
						rows="4"
						maxlength="2000"
						value={booking.clientReflection ?? ''}
						placeholder="felt strong on squats, form held up. knee was fine."
						class="textarea textarea-sm border-base-300 w-full leading-relaxed"
					></textarea>
				</label>
				<div class="modal-action">
					<button type="button" class="btn btn-sm" onclick={() => (step = 'menu')}>back</button>
					<button type="submit" class="btn btn-sm btn-primary" disabled={submitting}>
						{submitting ? 'saving…' : 'save'}
					</button>
				</div>
			</form>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="close">close</button>
	</form>
</dialog>
