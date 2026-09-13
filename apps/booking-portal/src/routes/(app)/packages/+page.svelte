<script lang="ts">
    import type { PageProps } from "./$types";
    import { isClient } from "./packages";
    import { PackagesCarousel, RecentActivity } from "$lib/components";
    import { viewerZone } from "$lib/utils/format";

    let { data }: PageProps = $props();

	const clientView = $derived(isClient(data));
	let zone: string = $derived(viewerZone(data.user));
</script>

<div class="mx-auto flex max-w-6xl flex-col gap-8 p-6 md:p-10">
	<div class="flex flex-col">
        <h1 class="font-headings text-3xl">packages</h1>
        <p class="text-base-content/60">purchase a package in order to start booking sessions with a coach of your choice.</p>
    </div>

	{#if clientView}
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<PackagesCarousel activePackages={data.activePackages} {zone} />
			<RecentActivity recentActivity={data.recentActivity} />
		</div>
	{:else}
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	{/if}
</div>
