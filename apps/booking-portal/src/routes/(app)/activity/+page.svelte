<script lang="ts">
	import { ledgerLabel } from '$lib/activity';
	import { longDateNoYear } from '$lib/format';
	import { browserZone } from '$lib/tz';
	import { untrack } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tz = untrack(() => data.user.timezone ?? browserZone());
	const firstOf = (name: string) => name.split(' ')[0] ?? name;

	const all = $derived(data.activity);
	const coaches = $derived([...new Set(all.map((e) => e.coachName))].sort());

	let coach = $state<string | null>(null);
	const shown = $derived(coach ? all.filter((e) => e.coachName === coach) : all);
</script>

<div class="mx-auto max-w-3xl p-6 md:p-10">
	<h1 class="font-headings mb-1 text-4xl">activity</h1>
	<p class="text-base-content/60 mb-6 text-sm">
		every session movement across your packages, newest first.
	</p>

	{#if data.user.role !== 'client'}
		<p class="text-base-content/60">the {data.user.role} portal is coming soon.</p>
	{:else if all.length === 0}
		<div class="border-base-300 text-base-content/45 rounded-sm border border-dashed p-8 text-center text-sm">
			nothing yet — buy a package and book a session to get started.
		</div>
	{:else}
		{#if coaches.length > 1}
			<div class="mb-4 flex flex-wrap gap-1.5">
				<button
					class="rounded-full border px-3 py-1 text-xs transition-colors
						{coach === null ? 'border-neutral bg-neutral text-neutral-content' : 'border-base-300 text-base-content/60'}"
					onclick={() => (coach = null)}
				>
					all
				</button>
				{#each coaches as c (c)}
					<button
						class="rounded-full border px-3 py-1 text-xs transition-colors
							{coach === c ? 'border-neutral bg-neutral text-neutral-content' : 'border-base-300 text-base-content/60'}"
						onclick={() => (coach = c)}
					>
						{firstOf(c)}
					</button>
				{/each}
			</div>
		{/if}

		<ul class="border-base-300 divide-base-200 divide-y overflow-hidden rounded-sm border bg-white">
			{#each shown as e, i (`${e.createdAt}-${i}`)}
				<li class="flex items-baseline gap-3 px-4 py-2.5 text-sm">
					<span
						class="font-body w-8 shrink-0 text-xs {e.delta > 0
							? 'text-success'
							: 'text-base-content/40'}"
					>
						{e.delta > 0 ? `+${e.delta}` : e.delta}
					</span>
					<span class="min-w-0 flex-1">
						<span class="truncate">{ledgerLabel(e)}</span>
						<span class="text-base-content/45 block text-xs">{e.packageName}</span>
					</span>
					<span class="text-base-content/45 shrink-0 text-right text-xs">
						<span class="block">{longDateNoYear(new Date(e.createdAt), tz)}</span>
						<span class="text-base-content/35">balance {e.balanceAfter}</span>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>
