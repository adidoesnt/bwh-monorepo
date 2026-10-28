<script lang="ts">
	let {
		current,
		total,
		onChange
	}: { current: number; total: number; onChange: (n: number) => void } = $props();

	// With two pages these would just repeat prev/next.
	const showEnds = $derived(total > 2);
</script>

{#snippet pageButton(label: string, target: number, disabled: boolean)}
	<button type="button" class="btn btn-ghost btn-xs" {disabled} onclick={() => onChange(target)}>
		{label}
	</button>
{/snippet}

<div class="flex items-center justify-center gap-3 pt-1 text-sm">
	{#if showEnds}
		{@render pageButton('first', 1, current <= 1)}
	{/if}
	{@render pageButton('prev', current - 1, current <= 1)}
	<span class="text-base-content/60">page {current} of {total}</span>
	{@render pageButton('next', current + 1, current >= total)}
	{#if showEnds}
		{@render pageButton('last', total, current >= total)}
	{/if}
</div>
