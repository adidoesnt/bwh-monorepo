<script lang="ts">
	import { enhance } from '$app/forms';
	import { packageTotalCents } from '$lib/booking';
	import { STRIPE_NOT_IMPLEMENTED } from '$lib/payments';
	import type { PackageSummary } from '$lib/server/queries';

	type Props = {
		pkg: (PackageSummary & { coachName?: string }) | null;
		stripeEnabled: boolean;
		open?: boolean;
		onclose?: () => void;
	};
	let { pkg, stripeEnabled, open = $bindable(false), onclose }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let step = $state<'review' | 'upload' | 'done'>('review');
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let fileName = $state<string | null>(null);
	let previewUrl = $state<string | null>(null);

	const sgd = (cents: number) => `SG$${(cents / 100).toFixed(2)}`;

	function setPreview(file: File | undefined) {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = file ? URL.createObjectURL(file) : null;
		fileName = file?.name ?? null;
	}

	$effect(() => {
		if (!dialog) return;
		if (open) {
			step = 'review';
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
		step = 'review';
		error = null;
		setPreview(undefined);
		onclose?.();
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
			{#if step === 'done'}payment submitted{:else}buy a package{/if}
		</h3>

		{#if !pkg}
			<p class="text-base-content/60 text-sm">no package selected.</p>
		{:else}
			<p class="text-base-content/60 mb-4 text-xs">
				{pkg.name}{pkg.coachName ? ` · ${pkg.coachName}` : ''} · {pkg.sessionCount} × {pkg.sessionLengthMin}-min
				sessions · valid {pkg.validityDays} days
			</p>

			{#if error}
				<div class="border-error bg-error/15 mb-4 rounded-md border p-3 text-sm">{error}</div>
			{/if}

			{#if step === 'done'}
				<p class="text-base-content/70 text-sm leading-relaxed">
					thanks — we've got your paynow screenshot. once your coach verifies it, the
					{pkg.sessionCount} sessions land on your account and you can book with them. it usually
					takes a few hours; it'll show under <strong>awaiting verification</strong> on your packages
					page until then.
				</p>
				<div class="modal-action">
					<button class="btn btn-sm btn-primary" onclick={close}>done</button>
				</div>
			{:else if stripeEnabled}
				<div class="border-warning bg-warning/15 rounded-md border p-3 text-sm leading-relaxed">
					{STRIPE_NOT_IMPLEMENTED}
				</div>
				<div class="modal-action">
					<button class="btn btn-sm" onclick={close}>close</button>
				</div>
			{:else if step === 'review'}
				<div class="border-base-300 bg-base-200/40 mb-4 rounded-md border p-4 text-center">
					<div class="font-headings text-2xl uppercase">{sgd(packageTotalCents(pkg))}</div>
					<div class="text-base-content/45 font-body mt-1 text-[11px]">
						{sgd(pkg.pricePerSessionCents)} / session
					</div>
					<div
						class="border-base-300 bg-base-100 mx-auto mt-3 grid h-32 w-32 place-items-center rounded-md border border-dashed"
					>
						<span class="text-base-content/30 font-body text-[10px] uppercase">qr placeholder</span>
					</div>
					<div class="text-base-content/45 font-body mt-2 text-[11px]">scan to pay with paynow</div>
				</div>
				<button class="btn btn-primary w-full" onclick={() => (step = 'upload')}>
					i've paid — upload proof
				</button>
			{:else}
				<form
					method="POST"
					action="/packages?/buy"
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
								step = 'done';
								await update({ invalidateAll: true });
							}
						};
					}}
				>
					<input type="hidden" name="packageId" value={pkg.id} />
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
