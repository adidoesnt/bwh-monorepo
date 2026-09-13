
<script lang="ts">
	import type { RecentActivity } from '../server/queries';

	let { recentActivity }: { recentActivity: RecentActivity } = $props();
</script>

<div class="bg-base-100 border-base-300 flex flex-col gap-4 rounded-2xl border p-5">
		<div class="flex items-center justify-between">
			<h2 class="font-headings text-xl">recent activity</h2>
			<span class="text-accent text-sm" title="coming soon">view all</span>
		</div>
		{#if recentActivity.length === 0}
			<p class="text-base-content/60 text-sm">nothing here yet.</p>
		{:else}
			<div class="flex flex-col gap-2">
				{#each recentActivity as entry (entry.id)}
					<div class="flex items-center justify-between gap-3 text-sm">
						<span class="min-w-0 truncate">{entry.description}</span>
						<span class="shrink-0 {entry.delta >= 0 ? 'text-success' : 'text-error'}">
							{entry.delta >= 0 ? '+' : ''}{entry.delta}
						</span>
					</div>
					<hr class="my-2 last:hidden text-primary/30" />
				{/each}
			</div>
		{/if}
	</div>
