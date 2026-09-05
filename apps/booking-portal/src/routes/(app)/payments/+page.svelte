<script lang="ts">
	import { longDateNoYear } from '$lib/format';
	import { browserZone } from '$lib/tz';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tz = untrack(() => data.user.timezone ?? browserZone());
	const sgd = (cents: number) => `SG$${(cents / 100).toFixed(2)}`;

	const invoices = $derived(data.invoices);
	const totalPaid = $derived(
		invoices.filter((i) => i.status === 'paid').reduce((n, i) => n + i.amountCents, 0)
	);
	const pendingCount = $derived(invoices.filter((i) => i.status === 'pending').length);

	const statusPill: Record<string, string> = {
		paid: 'badge-success',
		pending: 'badge-warning',
		no_charge: 'badge-ghost'
	};
	const statusText: Record<string, string> = {
		paid: 'paid',
		pending: 'awaiting verification',
		no_charge: 'no charge'
	};
</script>

<div class="mx-auto max-w-4xl p-6 md:p-10">
	<h1 class="font-headings mb-1 text-4xl">payments</h1>
	<p class="text-base-content/60 mb-6 text-sm">every invoice on your account.</p>

	{#if data.user.role !== 'client'}
		<p class="text-base-content/60">the {data.user.role} portal is coming soon.</p>
	{:else}
		<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
			<div class="border-base-300 bg-white rounded-sm border p-4">
				<div class="text-base-content/60 mb-2 text-xs">total paid</div>
				<div class="font-headings text-2xl leading-none uppercase">{sgd(totalPaid)}</div>
			</div>
			<div class="border-base-300 bg-white rounded-sm border p-4">
				<div class="text-base-content/60 mb-2 text-xs">invoices</div>
				<div class="font-headings text-2xl leading-none">{invoices.length}</div>
			</div>
			<div class="border-base-300 bg-white rounded-sm border p-4">
				<div class="text-base-content/60 mb-2 text-xs">awaiting verification</div>
				<div class="font-headings text-2xl leading-none">{pendingCount}</div>
			</div>
		</div>

		{#if invoices.length === 0}
			<div class="border-base-300 text-base-content/45 rounded-sm border border-dashed p-8 text-center text-sm">
				no invoices yet.
			</div>
		{:else}
			<div class="border-base-300 overflow-x-auto rounded-sm border bg-white">
				<table class="table-sm table">
					<thead>
						<tr class="text-base-content/50">
							<th class="font-normal">invoice</th>
							<th class="font-normal">date</th>
							<th class="font-normal">for</th>
							<th class="font-normal">method</th>
							<th class="font-normal">amount</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each invoices as inv (inv.id)}
							<tr>
								<td class="font-body">{inv.number}</td>
								<td class="whitespace-nowrap">{longDateNoYear(new Date(inv.issuedAt), tz)}</td>
								<td class="min-w-40">{inv.description}</td>
								<td class="text-base-content/60">{inv.method}</td>
								<td class="whitespace-nowrap uppercase">{sgd(inv.amountCents)}</td>
								<td class="text-right whitespace-nowrap">
									<span class="badge badge-sm {statusPill[inv.status]} font-body">
										{statusText[inv.status]}
									</span>
									{#if inv.proofUrl}
										<a class="link ml-1.5 text-xs" href={inv.proofUrl} target="_blank" rel="noreferrer">
											proof
										</a>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<p class="text-base-content/45 mt-4 text-xs leading-relaxed">
			payments are PayNow for now — no card on file. cancellations more than {data.cancellationHours}
			hours before a session return the session to your package; inside {data.cancellationHours} hours
			the session is used.
		</p>
	{/if}
</div>
