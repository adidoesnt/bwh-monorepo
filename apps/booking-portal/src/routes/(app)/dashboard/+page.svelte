<script lang="ts">
	import { formatFullDate, viewerZone } from '$lib/utils/format';
	import type { PageProps } from './$types';
	import ClientDashboard from './ClientDashboard.svelte';
	import TrainerDashboard from './TrainerDashboard.svelte';

	let { data }: PageProps = $props();

	const firstName = $derived(data.user.name.split(' ')[0] ?? data.user.name);

	const zone = $derived(viewerZone(data.user));
	const date = $derived(formatFullDate(new Date(), zone));
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
	<div class="flex items-center justify-between">
		<div class="flex flex-col">
			<p class="text-base-content/60 font-mono">{date}</p>
			<h1 class="font-headings text-3xl">hey {firstName}!</h1>
		</div>
		{#if data.view === 'client'}
			<a href="/bookings" class="btn btn-accent" title="request a session">request a session</a>
		{/if}
	</div>

	{#if data.view === 'client'}
		<ClientDashboard {data} {zone} />
	{:else if data.view === 'trainer'}
		<TrainerDashboard {data} />
	{:else}
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	{/if}
</div>
