<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { cancelOutcome, canReschedule, type CancelOutcome } from '$lib/booking';
	import { longDate, timeOf } from '$lib/format';
	import { STRIPE_NOT_IMPLEMENTED } from '$lib/payments';
	import { statusLabel } from '$lib/status';
	import type { ClientBooking } from '$lib/server/queries';

	type Step = 'menu' | 'pay-review' | 'pay-upload' | 'pay-done' | 'cancel' | 'cancel-done' | 'note';

	type Props = {
		booking: ClientBooking;
		clientZone: string;
		stripeEnabled: boolean;
		open?: boolean;
		onclose?: () => void;
	};
	let { booking, clientZone, stripeEnabled, open = $bindable(false), onclose }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let step = $state<Step>('menu');
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let fileName = $state<string | null>(null);
	let previewUrl = $state<string | null>(null);
	let doneOutcome = $state<CancelOutcome | null>(null);

	const now = new Date();
	const start = $derived(new Date(booking.startsAt));
	const isPast = $derived(start < now || booking.status === 'completed');
	const outcome = $derived(cancelOutcome(booking.status, start, now));
	const reschedulable = $derived(
		booking.coachActive && canReschedule(booking.status, start, now)
	);
	const cancelable = $derived(outcome !== 'blocked');

	const sgd = (cents: number) => `SG$${(cents / 100).toFixed(2)}`;
	const credits = (n: number) => (n === 1 ? '1 credit' : `${n} credits`);

	const cancelCopy: Record<CancelOutcome, string> = $derived({
		none: 'this frees the slot back up. no credit was taken for this one, so there is nothing to refund.',
		void: "we'll mark your payment as cancelled. if your paynow transfer already went through, message your coach and she'll sort the refund.",
		refund: `you're more than 24 hours out, so your ${credits(booking.creditCost)} goes straight back to your balance.`,
		forfeit: `this is within 24 hours of the session, so the ${credits(booking.creditCost)} will be used. this can't be undone.`,
		blocked: ''
	});

	function setPreview(file: File | undefined) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = file ? URL.createObjectURL(file) : null;
		fileName = file?.name ?? null;
	}

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

	$effect(() => () => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});

	function close() {
		open = false;
		step = 'menu';
		error = null;
		doneOutcome = null;
		setPreview(undefined);
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
			{#if step === 'menu'}manage session
			{:else if step === 'cancel'}cancel this session?
			{:else if step === 'cancel-done'}session cancelled
			{:else if step === 'note'}your notes
			{:else if step === 'pay-done'}payment submitted
			{:else}pay to confirm{/if}
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

				{#if booking.status === 'pending_payment'}
					<button class="btn btn-primary btn-sm w-full" onclick={() => (step = 'pay-review')}>
						pay to confirm
					</button>
				{/if}

				{#if isPast}
					<button class="btn btn-sm w-full" onclick={() => (step = 'note')}>
						{booking.clientReflection ? 'edit your notes' : 'add your notes'}
					</button>
				{/if}

				{#if reschedulable}
					<button class="btn btn-sm w-full" onclick={reschedule}>reschedule</button>
				{:else if !isPast && booking.status !== 'pending_verification' && !booking.coachActive}
					<p class="text-base-content/45 text-xs">this coach is no longer taking bookings — reschedule isn't available.</p>
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
				action="?/cancel"
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
					<button type="button" class="btn btn-sm" onclick={() => (step = 'menu')}>
						keep it
					</button>
					<button type="submit" class="btn btn-sm btn-error" disabled={submitting}>
						{submitting ? 'cancelling…' : 'cancel session'}
					</button>
				</div>
			</form>
		{:else if step === 'cancel-done'}
			<p class="text-base-content/70 text-sm leading-relaxed">
				{#if doneOutcome === 'refund'}
					done — your {credits(booking.creditCost)} is back on your balance.
				{:else if doneOutcome === 'forfeit'}
					done. the {credits(booking.creditCost)} was used for this late cancellation.
				{:else if doneOutcome === 'void'}
					done — the payment is marked cancelled. contact your coach if your transfer already went through.
				{:else}
					done — the slot is freed up.
				{/if}
			</p>
			<div class="modal-action">
				<button class="btn btn-sm btn-primary" onclick={close}>done</button>
			</div>
		{:else if step === 'note'}
			<form
				method="POST"
				action="?/reflect"
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
		{:else if step === 'pay-done'}
			<p class="text-base-content/70 text-sm leading-relaxed">
				thanks — we've got your paynow screenshot. your coach confirms it once it's verified,
				usually within a few hours. this session now shows as <strong>verifying payment</strong>
				under awaiting action.
			</p>
			{#if previewUrl}
				<img
					src={previewUrl}
					alt="your uploaded payment screenshot"
					class="border-base-300 mt-3 max-h-48 w-full rounded-md border object-contain"
				/>
			{/if}
			<div class="modal-action">
				<button class="btn btn-sm btn-primary" onclick={close}>done</button>
			</div>
		{:else if stripeEnabled}
			<div class="border-warning bg-warning/15 rounded-md border p-3 text-sm leading-relaxed">
				{STRIPE_NOT_IMPLEMENTED}
			</div>
			<div class="modal-action">
				<button class="btn btn-sm" onclick={() => (step = 'menu')}>back</button>
			</div>
		{:else if step === 'pay-review'}
			<div class="border-base-300 bg-base-200/40 mb-4 rounded-md border p-4 text-center">
				<div class="text-base-content/45 mb-2 text-[11px]">scan to pay with paynow</div>
				<div
					class="border-base-300 bg-base-100 mx-auto grid h-32 w-32 place-items-center rounded-md border border-dashed"
				>
					<span class="text-base-content/30 font-body text-[10px] uppercase">qr placeholder</span>
				</div>
				<div class="font-headings mt-3 text-2xl uppercase">{sgd(booking.amountCents)}</div>
				<div class="text-base-content/45 font-body mt-1 text-[11px]">
					reference · booking {booking.id.slice(0, 8)}
				</div>
			</div>
			<button class="btn btn-primary w-full" onclick={() => (step = 'pay-upload')}>
				i've paid — upload proof
			</button>
		{:else}
			<form
				method="POST"
				action="?/pay"
				enctype="multipart/form-data"
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
							step = 'pay-done';
							await update({ invalidateAll: true });
						}
					};
				}}
			>
				<input type="hidden" name="bookingId" value={booking.id} />
				<label class="text-base-content/60 mb-3 flex flex-col gap-1.5 text-xs">
					screenshot of your paynow payment
					<input
						type="file"
						name="screenshot"
						accept="image/*"
						required
						class="file-input file-input-sm border-base-300 w-full"
						onchange={(e) => setPreview(e.currentTarget.files?.[0])}
					/>
				</label>
				{#if previewUrl}
					<img
						src={previewUrl}
						alt="payment screenshot preview"
						class="border-base-300 mb-4 max-h-48 w-full rounded-md border object-contain"
					/>
				{/if}
				<div class="flex gap-2">
					<button type="button" class="btn btn-sm flex-1" onclick={() => (step = 'pay-review')}>
						back
					</button>
					<button
						type="submit"
						class="btn btn-sm btn-primary flex-1"
						disabled={submitting || !fileName}
					>
						{submitting ? 'submitting…' : 'submit'}
					</button>
				</div>
			</form>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="close">close</button>
	</form>
</dialog>
