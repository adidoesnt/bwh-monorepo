<script lang="ts">
	let { stat }: { stat: { label: string; value: string; sub: string } } = $props();
</script>

<div class="bg-base-100 border-base-300 rounded-2xl border p-4">
	<div class="text-base-content/60 text-sm">{stat.label}</div>
	<div class="font-headings text-2xl">{stat.value}</div>
	<div class="text-base-content/50 text-xs">{stat.sub}</div>
</div>
