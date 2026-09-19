<script lang="ts">
	import { page } from '$app/state';

	let { href = '/', label = 'go home' }: { href?: string; label?: string } = $props();

	const notFound = $derived(page.status === 404);
</script>

<div class="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center lowercase">
	<p class="font-headings text-base-content/40 text-6xl">{page.status}</p>
	<h1 class="font-headings text-2xl">
		{notFound ? "we can't find that" : 'something went wrong'}
	</h1>
	{#if page.error?.message}
		<p class="text-base-content/60">{page.error.message}</p>
	{/if}
	{#if page.error?.errorId}
		<p class="text-base-content/40 text-xs">reference: {page.error.errorId}</p>
	{/if}
	<a {href} class="btn btn-accent">{label}</a>
</div>
