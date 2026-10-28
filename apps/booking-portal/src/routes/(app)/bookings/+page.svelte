<script lang="ts">
	import type { PageProps } from './$types';
	import ClientBookings from './ClientBookings.svelte';
	import TrainerBookings from './TrainerBookings.svelte';

	let { data }: PageProps = $props();
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
	{#if data.view === 'client'}
		<ClientBookings {data} />
	{:else if data.view === 'trainer'}
		<TrainerBookings {data} />
	{:else}
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	{/if}
</div>
