<script lang="ts">
	import { ChevronLeftIcon } from '@repo/ui';
	import { formatMinuteRange, formatPriceCents } from '$lib/utils/format';
	import type { PageProps } from './$types';
	import { cheapestPackagePriceCents, isClient } from './coach';

	let { data }: PageProps = $props();

	const clientView = $derived(isClient(data));
	const priceCents = $derived(cheapestPackagePriceCents(data.packages));
	const shareUrl = $derived(data.shareUrl);

	let copied = $state(false);
	const copyLink = async () => {
		await navigator.clipboard.writeText(shareUrl);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	};
</script>

<div class="mx-auto max-w-3xl p-6 md:p-10">
	<div class="bg-base-100 border-base-300 flex flex-col gap-6 rounded-2xl border p-6 md:p-8">
		<a
			href="/bookings"
			class="text-base-content/70 hover:text-base-content flex w-fit items-center gap-1 text-sm"
		>
			<ChevronLeftIcon className="h-3 w-3" />
			all coaches
		</a>

		{#if clientView}
			<div class="bg-neutral text-neutral-content flex flex-col gap-4 rounded-2xl p-6">
				<div class="flex items-center gap-4">
					<div
						class="bg-base-100/10 text-neutral-content grid h-16 w-16 shrink-0 place-items-center rounded-full font-headings text-2xl"
					>
						{data.coach.name[0]}
					</div>
					<div class="min-w-0">
						<h1 class="font-headings text-3xl">{data.coach.name.split(' ')[0]}</h1>
						<p class="text-neutral-content/70">{data.coach.tagline}</p>
					</div>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each data.coach.tags as tag (tag)}
						<span class="badge badge-sm bg-base-100/10 text-neutral-content border-none font-body"
							>{tag}</span
						>
					{/each}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div class="bg-base-200 rounded-2xl p-4">
					<div class="text-base-content/60 text-sm">rate</div>
					<div class="text-lg font-medium">
						{priceCents !== null ? `from ${formatPriceCents(priceCents)} per session` : 'no packages yet'}
					</div>
				</div>
				<div class="bg-base-200 rounded-2xl p-4">
					<div class="text-base-content/60 text-sm">trains at</div>
					<div class="text-lg font-medium">{data.coach.locations.join(' · ')}</div>
				</div>
			</div>

			<p class="text-base-content/80">{data.coach.bio}</p>

			<div class="bg-base-200 flex items-center justify-between gap-3 rounded-2xl p-4">
				<span class="font-mono text-sm">{shareUrl}</span>
				<button
					type="button"
					class="btn btn-sm border-base-300 bg-base-100 text-base-content/60 font-normal"
					onclick={copyLink}
				>
					{copied ? 'copied' : 'copy link'}
				</button>
			</div>

			<div>
				<div class="text-base-content/60 text-xs tracking-wide uppercase">open hours</div>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each data.openHours as window (window.startMin)}
						<span class="badge badge-lg bg-base-200 border-none font-mono">
							{formatMinuteRange(window.startMin, window.endMin)}
						</span>
					{/each}
				</div>
			</div>
		{:else}
			<p class="text-base-content/60 max-w-sm">
				the {data.user.role} portal is coming soon — your tools will live here.
			</p>
		{/if}
	</div>
</div>
