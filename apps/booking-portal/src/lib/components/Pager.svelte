<script lang="ts">
	let {
		current,
		total,
		onChange
	}: { current: number; total: number; onChange: (n: number) => void } = $props();
</script>

<div class="flex items-center justify-center gap-3 pt-1 text-sm">
	<button
		type="button"
		class="btn btn-ghost btn-xs"
		disabled={current <= 1}
		onclick={() => onChange(current - 1)}
	>
		prev
	</button>
	<span class="text-base-content/60">page {current} of {total}</span>
	<button
		type="button"
		class="btn btn-ghost btn-xs"
		disabled={current >= total}
		onclick={() => onChange(current + 1)}
	>
		next
	</button>
</div>
