<script lang="ts">
	let { name, tagline, tags }: { name: string; tagline: string; tags: string[] } = $props();
</script>

<div class="bg-neutral text-neutral-content flex flex-col gap-4 rounded-2xl p-6">
	<div class="flex items-center gap-4">
		<div
			class="bg-base-100/10 text-neutral-content grid h-16 w-16 shrink-0 place-items-center rounded-full font-headings text-2xl"
		>
			{name[0]}
		</div>
		<div class="min-w-0">
			<h1 class="font-headings text-3xl">{name.split(' ')[0]}</h1>
			<p class="text-neutral-content/70">{tagline}</p>
		</div>
	</div>
	<div class="flex flex-wrap gap-2">
		{#each tags as tag (tag)}
			<span class="badge badge-sm bg-base-100/10 text-neutral-content border-none font-body">{tag}</span>
		{/each}
	</div>
</div>
