<script lang="ts">
	import { enhance } from '$app/forms';
	import { longDate, timeOf } from '$lib/format';
	import { STRIPE_NOT_IMPLEMENTED } from '$lib/payments';
	import type { ClientBooking } from '$lib/server/queries';

	type Props = {
		booking: ClientBooking;
		clientZone: string;
		stripeEnabled: boolean;
		open?: boolean;
		onclose?: () => void;
	};
	let { booking, clientZone, stripeEnabled, open = $bindable(false), onclose }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let step = $state<'review' | 'pay' | 'waiting'>('review');
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let fileName = $state<string | null>(null);
	let previewUrl = $state<string | null>(null);

	function setPreview(file: File | undefined) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = file ? URL.createObjectURL(file) : null;
		fileName = file?.name ?? null;
	}

	// Show/hide only — no reactive reads beyond `open`, so picking a file
	// (which touches preview state) can't re-run this and reset the step.
	$effect(() => {
		if (!dialog) return;
		if (open) dialog.showModal();
		else dialog.close();
	});

	$effect(() => () => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});

	function close() {
		open = false;
		step = 'review';
		error = null;
		setPreview(undefined);
		onclose?.();
	}

	const sgd = (cents: number) => `SG$${(cents / 100).toFixed(2)}`;
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
		{#if stripeEnabled}
			<h3 class="font-headings mb-2 text-xl">card payment</h3>
			<div class="border-warning bg-warning/15 rounded-md border p-3 text-sm leading-relaxed">
				{STRIPE_NOT_IMPLEMENTED}
			</div>
			<div class="modal-action">
				<button class="btn btn-sm" onclick={close}>close</button>
			</div>
		{:else if step === 'waiting'}
			<h3 class="font-headings mb-2 text-xl">payment submitted</h3>
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
		{:else}
			<h3 class="font-headings mb-1 text-xl">pay to confirm</h3>
			<p class="text-base-content/60 mb-4 text-xs">
				{booking.coachName} · {booking.type} · {longDate(new Date(booking.startsAt), clientZone)} ·
				{timeOf(new Date(booking.startsAt), clientZone)} · {booking.location}
			</p>

			{#if error}
				<div class="border-error bg-error/15 mb-4 rounded-md border p-3 text-sm">{error}</div>
			{/if}

			{#if step === 'review'}
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
				<button class="btn btn-primary w-full" onclick={() => (step = 'pay')}>
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
								step = 'waiting';
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
						<button type="button" class="btn btn-sm flex-1" onclick={() => (step = 'review')}>
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
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="close">close</button>
	</form>
</dialog>
