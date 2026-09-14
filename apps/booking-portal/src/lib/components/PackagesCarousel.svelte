<script lang="ts">
    import type { ActivePackage, PackageSlide, PurchaseLedgerEntries } from "$lib/server/queries";
    import { formatFullDate } from "$lib/utils/format";
    import { balanceProgressClass, getPackageSlides } from "$lib/utils/packages";
    import { ChevronLeftIcon, ChevronRightIcon, ChevronsDownIcon } from "@repo/ui";

    let {
        activePackages,
        zone,
        showPackageActivity = false,
        purchaseLedgerEntries = []
    }: {
        activePackages: ActivePackage[];
        zone: string;
        showPackageActivity?: boolean;
        purchaseLedgerEntries?: PurchaseLedgerEntries;
    } = $props();
    let packageSlides: PackageSlide[] = $derived(getPackageSlides(activePackages));

    // Which slide's activity list is expanded, if any — inline (not a
    // floating popover), since this sits inside a horizontally-scrolling
    // carousel where absolutely-positioned overlays didn't behave reliably.
    let openActivityFor = $state<string | null>(null);
    const toggleActivity = (purchaseId: string) => {
        openActivityFor = openActivityFor === purchaseId ? null : purchaseId;
    };

    // The href gives no-JS/accessible fallback behavior, but the browser's
    // native fragment-jump scrolls the whole page (any scrollable ancestor)
    // to the target, not just this horizontally-scrolling carousel — hence
    // the preventDefault + manually scoped scrollIntoView.
    const scrollToSlide = (e: MouseEvent, slideId: string) => {
        e.preventDefault();
        document.getElementById(slideId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    };
</script>

{#snippet packageActivity(pkg: PackageSlide)}
	{@const entries = purchaseLedgerEntries.filter((e) => e.purchaseId === pkg.purchaseId)}
	{@const isOpen = openActivityFor === pkg.purchaseId}
	<div class="flex flex-col gap-2">
		<button
			type="button"
			class="flex w-full cursor-pointer items-center justify-between text-sm opacity-70 hover:opacity-100 gap-2"
			onclick={() => toggleActivity(pkg.purchaseId)}
		>
			activity
			<ChevronsDownIcon className="h-3 w-3 transition-transform {isOpen ? 'rotate-180' : ''} mr-1.5" />
		</button>
		{#if isOpen}
			{#if entries.length === 0}
				<p class="text-neutral-content/60 p-2 text-xs">no activity yet.</p>
			{:else}
				<div class="bg-base-100 text-base-content flex max-h-48 flex-col gap-1 overflow-y-auto rounded-xl p-2">
					{#each entries as entry (entry.id)}
						<div class="flex items-center justify-between gap-3 p-1.5 text-xs">
							<span class="min-w-0 truncate">
								{entry.description}
								<span class="text-base-content/40">· {formatFullDate(entry.createdAt, zone)}</span>
							</span>
							<span class="shrink-0 {entry.delta >= 0 ? 'text-success' : 'text-error'}">
								{entry.delta >= 0 ? '+' : ''}{entry.delta}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{/snippet}

<div class="bg-neutral text-neutral-content flex flex-col gap-4 rounded-2xl p-5">
	<div class="flex items-center justify-between">
		<h2 class="font-headings text-xl">your packages</h2>
		<span class="text-neutral-content/60 text-sm">{activePackages.length} active</span>
	</div>
	{#if packageSlides.length === 0}
		<p class="text-neutral-content/60 text-sm">no active packages — get one to start booking.</p>
	{:else}
		<!-- TODO: auto-scroll this carousel (pause on hover/touch, respect prefers-reduced-motion) -->
		<div class="carousel carousel-center w-full flex-1 gap-4">
			{#each packageSlides as pkg (pkg.purchaseId)}
				<div id={pkg.slideId} class="carousel-item w-full flex-col gap-3">
					<div>
						<div class="text-sm opacity-70">{pkg.packageName} · {pkg.coachName}</div>
						<div class="font-headings text-3xl">
							{pkg.balance} <span class="text-lg opacity-60">of {pkg.sessionCount} left</span>
						</div>
					</div>
					<progress
						class="progress {balanceProgressClass(pkg.balance, pkg.sessionCount)} w-full"
						value={pkg.balance}
						max={pkg.sessionCount}
					></progress>
					{#if showPackageActivity}
						{@render packageActivity(pkg)}
					{/if}
					<div class="flex items-center justify-between text-sm opacity-70">
						<span>expires {formatFullDate(pkg.expiresAt, zone)}</span>
						{#if packageSlides.length > 1}
							<span class="flex gap-1">
								<a
									href="#{pkg.prevId}"
									class="btn btn-circle btn-xs btn-ghost"
									onclick={(e) => scrollToSlide(e, pkg.prevId)}
								>
									<ChevronLeftIcon className="h-3 w-3" />
								</a>
								<a
									href="#{pkg.nextId}"
									class="btn btn-circle btn-xs btn-ghost"
									onclick={(e) => scrollToSlide(e, pkg.nextId)}
								>
									<ChevronRightIcon className="h-3 w-3" />
								</a>
							</span>
						{/if}
					</div>
					<a
						href={`/bookings/${pkg.coachSlug}?package=${pkg.purchaseId}`}
						class="btn btn-accent btn-sm w-full mt-auto"
					>
						request a session
					</a>
				</div>
			{/each}
		</div>
	{/if}
</div>
