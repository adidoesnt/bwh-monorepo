<script lang="ts">
  import {
    trainingPackages,
    type TrainingPackage,
  } from "../constants/training";

  let carouselEl: HTMLDivElement | undefined = $state();
  let activeIndex = $state(0);

  const scrollToIndex = (index: number) => {
    if (!carouselEl) return;

    carouselEl.scrollTo({
      left: carouselEl.clientWidth * index,
      behavior: "smooth",
    });
  };

  $effect(() => {
    if (!carouselEl) return;

    const slides = carouselEl.querySelectorAll<HTMLElement>("[data-slide-index]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            activeIndex = Number(
              (entry.target as HTMLElement).dataset.slideIndex,
            );
          }
        }
      },
      { root: carouselEl, threshold: 0.6 },
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  });
</script>

{#snippet packageCard(pkg: TrainingPackage)}
  <div
    class="bg-white flex h-full w-full flex-col overflow-hidden rounded-sm shadow-md"
  >
    <header
      class="bg-base-100 text-secondary-content flex flex-col items-center gap-2 p-4 text-center md:p-6"
    >
      <h2
        class="font-headings text-3xl font-bold uppercase tracking-wide drop-shadow-sm"
      >
        {pkg.title}
      </h2>
      <p class="font-body">{pkg.sessionsLabel}</p>
      <p class="font-body italic">{pkg.tagline}</p>
    </header>

    <div class="flex flex-1 flex-col p-4 text-center md:p-6">
      <p class="font-body text-dark-brown text-base">{@html pkg.descriptionHtml}</p>
    </div>

    <div class="bg-neutral text-neutral-content normal-case p-4 text-center">
      <p class="font-body text-lg font-bold md:text-xl">{pkg.pricePerSession}</p>
      <p class="font-body text-sm md:text-base">{pkg.totalPrice}</p>
    </div>
  </div>
{/snippet}

<div class="w-full min-w-0 max-w-full">
  <div class="md:hidden w-full max-w-full overflow-hidden">
    <div
      bind:this={carouselEl}
      class="@container w-full max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Training packages"
    >
      <div class="grid auto-cols-[100cqw] grid-flow-col">
        {#each trainingPackages as pkg, index (pkg.title)}
          <div
            class="box-border snap-center px-0.5"
            data-slide-index={index}
            aria-roledescription="slide"
            aria-label="{index + 1} of {trainingPackages.length}"
          >
            {@render packageCard(pkg)}
          </div>
        {/each}
      </div>
    </div>

    <div class="mt-4 flex justify-center gap-2" role="tablist">
      {#each trainingPackages as pkg, index (pkg.title)}
        <button
          type="button"
          role="tab"
          aria-selected={activeIndex === index}
          aria-label="Go to {pkg.title} package"
          class="size-2 rounded-full transition-colors {activeIndex === index
            ? 'bg-neutral'
            : 'bg-neutral/30'}"
          onclick={() => scrollToIndex(index)}
        ></button>
      {/each}
    </div>
  </div>

  <div class="hidden md:grid md:grid-cols-3 md:gap-8">
    {#each trainingPackages as pkg (pkg.title)}
      {@render packageCard(pkg)}
    {/each}
  </div>
</div>
