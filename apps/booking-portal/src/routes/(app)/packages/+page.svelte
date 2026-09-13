<script lang="ts">
    import type { PageProps } from "./$types";
    import { isClient } from "./packages";
    import { PackagesCarousel, RecentActivity } from "$lib/components";
    import { viewerZone } from "$lib/utils/format";

    let { data }: PageProps = $props();

	const clientView = $derived(isClient(data));
	let zone: string = $derived(viewerZone(data.user));
</script>

{#snippet SuggestedPackagePlaceholder()}
    <!--
        TODO: Replace with actual suggested package cards.
        These should either be based on previously booked coaches/packages by recency
        taking into account the user's current preferences (e.g. zone, location etc.).
        If no previous bookings exist, we will select the top 3 packages based on popularity
        that match the user's current preferences.
    -->
    <div class="flex flex-col gap-4">
        {#each new Array(3) as _, i}
            <div class="bg-base-100 rounded-lg p-6 border border-base-300">
                <div class="flex flex-col gap-2">
                    <h2 class="font-headings text-2xl">package {i + 1}</h2>
                    <p class="text-base-content/60">
                        Lorem ipsum dolor sit amet consectetur adipisicing elit.
                    </p>
                </div>
            </div>
        {/each}
    </div>
{/snippet}

{#snippet PackageBrowsingPanelPlaceholder()}
    <div class="flex flex-col gap-8 bg-base-100 p-6 rounded-lg border border-base-300">
    	<div class="flex flex-col">
    		<h2 class="font-headings text-2xl">browse packages</h2>
    		<p class="text-base-content/60">
                TODO: Replace with actual package browsing panel content.
                It should mirror the booking's page coach directry, but selecting
                a coach here will take them to a <strong>package</strong> booking page for that coach
                rather than the session booking page.

                It's important to note that users can purchase a package <strong>while</strong>
                booking a session if they don't have a package already.
    		</p>
    	</div>
    </div>
{/snippet}

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

		<div class="flex flex-col gap-8">
		    <div class="flex flex-col">
		        <h2 class="font-headings text-2xl">purchase a package</h2>
		        <p class="text-base-content/60">
		            browse the suggested packages below to find the one that fits your needs.
		        </p>
			</div>
    		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    			{@render SuggestedPackagePlaceholder()}
                {@render PackageBrowsingPanelPlaceholder()}
    		</div>
		</div>
	{:else}
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	{/if}
</div>
