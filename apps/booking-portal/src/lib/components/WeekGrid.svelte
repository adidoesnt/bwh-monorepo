<script lang="ts">
	import type { getWeekGrid, GridCellState } from '$lib/utils/weekGrid';

	let { grid }: { grid: ReturnType<typeof getWeekGrid> } = $props();

	const CELL_CLASSES: Record<GridCellState, string> = {
		open: 'bg-success/30',
		booked: 'bg-neutral text-neutral-content',
		requested: 'bg-warning/50',
		closed: 'border border-base-300'
	};
</script>

<!-- Below xl the grid scrolls in both directions inside a capped height, with the
     day row and hour column pinned so only the slots move. -->
<div class="max-h-[70vh] overflow-auto xl:max-h-none">
	<div class="grid min-w-xl grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] gap-1 text-xs">
		<div class="bg-base-100 sticky top-0 z-20 col-span-8 grid grid-cols-subgrid pb-1">
			<span class="bg-base-100 sticky left-0"></span>
			{#each grid.days as d (d.label)}
				<div class="text-center {d.isToday ? 'text-accent font-medium' : 'text-base-content/60'}">
					{d.label} {d.day}
				</div>
			{/each}
		</div>

		{#each grid.rows as row (row.minute)}
			{#if row.gapBefore}
				<div class="col-span-8 h-2"></div>
			{/if}
			<span class="pinned-hour text-base-content/60 flex items-center font-mono">{row.label}</span>
			{#each row.cells as cell, i (i)}
				<div
					class="h-7 truncate rounded-field px-1 text-center text-[10px] leading-7 {CELL_CLASSES[cell.state]} {cell.past
						? 'opacity-40'
						: ''}"
					title={cell.title}
				>
					{cell.label ?? ''}
				</div>
			{/each}
		{/each}
	</div>
</div>

<div class="text-base-content/60 flex flex-wrap items-center justify-between gap-3 text-xs">
	<div class="flex flex-wrap gap-4">
		{#each ['open', 'booked', 'requested', 'closed'] as const as state (state)}
			<span class="flex items-center gap-1.5">
				<span class="h-3 w-3 rounded-sm {CELL_CLASSES[state]}"></span>{state}
			</span>
		{/each}
	</div>
	<span class="font-mono">{grid.openHoursLeft} hours still open this week</span>
</div>
