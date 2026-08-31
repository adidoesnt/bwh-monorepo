<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="bg-base-100 text-base-content h-dvh w-dvw overflow-y-auto">
	{@render children()}
</div>
