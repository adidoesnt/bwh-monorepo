<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { CoachHeader } from '$lib/components';
	import { NETWORK_ERROR_MESSAGE, isNetworkFailure } from '$lib/utils/forms';
	import { formatPriceCents } from '$lib/utils/format';
	import { ChevronLeftIcon } from '@repo/ui';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const clientView = $derived(data.user.role === 'client');

	// One buy form per package card: a shared pending/network state stops a
	// second card being bought while the first is in flight.
	let buying = $state(false);
	let networkError = $state(false);
	const enhanceBuy: SubmitFunction = () => {
		buying = true;
		networkError = false;
		return async ({ result, update }) => {
			if (isNetworkFailure(result)) {
				buying = false;
				networkError = true;
				return;
			}
			await update();
			buying = false;
		};
	};
	const existingBalance = $derived(data.activePackages.reduce((sum, pkg) => sum + pkg.bookable, 0));
</script>

{#snippet packageCard(pkg: (typeof data.packages)[number])}
	<div class="bg-base-100 border-base-300 row-span-4 grid grid-rows-subgrid gap-3 rounded-2xl border p-6">
		<div>
			<h3 class="font-headings text-xl">{pkg.name}</h3>
			{#if pkg.description}
				<p class="text-base-content/60 text-sm">{pkg.description}</p>
			{/if}
		</div>
		<div class="text-base-content/70 text-sm">
			{pkg.sessionCount} × {pkg.sessionLengthMin}-min sessions · valid {pkg.validityDays} days
		</div>
		<div class="flex items-center justify-between gap-3">
			<span class="font-headings text-2xl">
				{formatPriceCents(pkg.sessionCount * pkg.pricePerSessionCents)}
			</span>
			<span class="text-base-content/50 text-xs">{formatPriceCents(pkg.pricePerSessionCents)} / session</span>
		</div>
		<form method="POST" action="?/buy" use:enhance={enhanceBuy}>
			<input type="hidden" name="packageId" value={pkg.id} />
			<button type="submit" class="btn btn-accent w-full" disabled={buying || !!data.purchaseBlockReason}>
				{buying ? 'buying…' : 'buy this package'}
			</button>
		</form>
	</div>
{/snippet}

<div class="mx-auto max-w-3xl p-6 md:p-10">
	<div class="bg-base-100 border-base-300 flex flex-col gap-6 rounded-2xl border p-6 md:p-8">
		<a
			href="/packages"
			class="text-base-content/70 hover:text-base-content flex w-fit items-center gap-1 text-sm"
		>
			<ChevronLeftIcon className="h-3 w-3" />
			all coaches
		</a>

		{#if clientView}
			<CoachHeader name={data.coach.name} tagline={data.coach.tagline} tags={data.coach.tags} />

			{#if existingBalance > 0}
				<div class="bg-base-200 rounded-2xl p-4 text-sm">
					you already have {existingBalance} session{existingBalance === 1 ? '' : 's'} left with {data.coach.name.split(
						' '
					)[0]}.
				</div>
			{/if}

			{#if data.purchaseBlockReason}
				<p class="text-warning text-sm">{data.purchaseBlockReason}</p>
			{/if}

			{#if form?.message}
				<p class="text-error text-sm">{form.message}</p>
			{/if}
			{#if networkError}
				<p class="text-error text-sm">{NETWORK_ERROR_MESSAGE}</p>
			{/if}

			{#if data.packages.length === 0}
				<p class="text-base-content/60 text-sm">
					{data.coach.name.split(' ')[0]} isn't selling packages right now.
				</p>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{#each data.packages as pkg (pkg.id)}
						{@render packageCard(pkg)}
					{/each}
				</div>
			{/if}
		{:else}
			<p class="text-base-content/60 max-w-sm">
				the {data.user.role} portal is coming soon — your tools will live here.
			</p>
		{/if}
	</div>
</div>
