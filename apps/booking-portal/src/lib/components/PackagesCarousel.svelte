<script lang="ts">
    import type { ActivePackage, PackageSlide } from "$lib/server/queries";
    import { formatFullDate } from "$lib/utils/format";
    import { balanceProgressClass, getPackageSlides } from "$lib/utils/packages";
    import { ChevronLeftIcon, ChevronRightIcon } from "@repo/ui";

    // TODO: Set showPackageActivity to true for /packages page, then show dropdown in package slide for each package.
    let { activePackages, zone, showPackageActivity = false }: { activePackages: ActivePackage[]; zone: string; showPackageActivity?: boolean } = $props();
    let packageSlides: PackageSlide[] = $derived(getPackageSlides(activePackages));

    // The href gives no-JS/accessible fallback behavior, but the browser's
    // native fragment-jump scrolls the whole page (any scrollable ancestor)
    // to the target, not just this horizontally-scrolling carousel — hence
    // the preventDefault + manually scoped scrollIntoView.
    const scrollToSlide = (e: MouseEvent, slideId: string) => {
        e.preventDefault();
        document.getElementById(slideId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    };
</script>

<div class="bg-neutral text-neutral-content flex flex-col gap-4 rounded-2xl p-5">
	<div class="flex items-center justify-between">
		<h2 class="font-headings text-xl">your packages</h2>
		<span class="text-neutral-content/60 text-sm">{activePackages.length} active</span>
	</div>
	{#if packageSlides.length === 0}
		<p class="text-neutral-content/60 text-sm">no active packages — get one to start booking.</p>
	{:else}
		<!-- TODO: auto-scroll this carousel (pause on hover/touch, respect prefers-reduced-motion) -->
		<div class="carousel carousel-center w-full gap-4">
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
				</div>
			{/each}
		</div>
	{/if}
</div>
