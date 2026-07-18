<script lang="ts">
  import { ChevronLeftIcon, ChevronRightIcon, StarIcon } from "@repo/ui/icons";
  import {
    testimonials,
    type Testimonial,
  } from "../constants/training";

  let mobileCarouselEl: HTMLDivElement | undefined = $state();
  let desktopCarouselEl: HTMLDivElement | undefined = $state();
  let activeIndex = $state(0);

  const showDesktopCarousel = testimonials.length > 3;

  let canScrollLeft = $state(false);
  let canScrollRight = $state(showDesktopCarousel);

  const getInitials = (authorName: string) =>
    (authorName.trim()[0] ?? "").toUpperCase();

  const scrollToIndex = (index: number) => {
    if (!mobileCarouselEl) return;

    mobileCarouselEl.scrollTo({
      left: mobileCarouselEl.clientWidth * index,
      behavior: "smooth",
    });
  };

  const updateDesktopScrollState = () => {
    if (!desktopCarouselEl) return;

    const { scrollLeft, scrollWidth, clientWidth } = desktopCarouselEl;
    canScrollLeft = scrollLeft > 1;
    canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;
  };

  const scrollDesktopCarousel = (direction: -1 | 1) => {
    if (!desktopCarouselEl) return;

    const slides =
      desktopCarouselEl.querySelectorAll<HTMLElement>(
        "[data-desktop-slide-index]",
      );
    if (slides.length < 2) return;

    const step = slides[1]!.offsetLeft - slides[0]!.offsetLeft;

    desktopCarouselEl.scrollBy({
      left: direction * step,
      behavior: "smooth",
    });
  };

  $effect(() => {
    if (!desktopCarouselEl) return;

    const el = desktopCarouselEl;
    updateDesktopScrollState();

    const resizeObserver = new ResizeObserver(updateDesktopScrollState);
    resizeObserver.observe(el);
    el.addEventListener("scroll", updateDesktopScrollState, {
      passive: true,
    });

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", updateDesktopScrollState);
    };
  });

  $effect(() => {
    if (!mobileCarouselEl) return;

    const slides =
      mobileCarouselEl.querySelectorAll<HTMLElement>("[data-slide-index]");
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
      { root: mobileCarouselEl, threshold: 0.6 },
    );

    slides.forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  });
</script>

{#snippet testimonialCard(item: Testimonial)}
  <div
    class="bg-white flex max-h-96 w-full flex-col overflow-hidden rounded-sm shadow-md md:max-h-112"
  >
    <header
      class="bg-base-100 text-secondary-content flex shrink-0 flex-col items-center gap-3 p-4 text-center md:p-6"
    >
      <div
        class="bg-neutral text-neutral-content flex size-14 items-center justify-center rounded-full font-body text-lg font-bold normal-case"
        aria-hidden="true"
      >
        {getInitials(item.authorName)}
      </div>
      <p class="font-body font-bold">{item.authorName}</p>
      <div
        class="flex gap-1"
        role="img"
        aria-label="{item.rating} out of 5 stars"
      >
        {#each Array.from({ length: 5 }, (_, index) => index) as starIndex (starIndex)}
          <StarIcon
            className="size-4 {starIndex < item.rating
              ? 'fill-current'
              : 'fill-none opacity-40'}"
          />
        {/each}
      </div>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto p-4 text-center md:p-6">
      <p class="font-body text-dark-brown whitespace-pre-line text-base">
        {item.quote}
      </p>
    </div>
  </div>
{/snippet}

{#snippet carouselSlide(item: Testimonial, index: number, total: number)}
  <div
    class="box-border h-full snap-center px-0.5"
    data-slide-index={index}
    aria-roledescription="slide"
    aria-label="{index + 1} of {total}"
  >
    {@render testimonialCard(item)}
  </div>
{/snippet}

<div class="w-full min-w-0 max-w-full">
  <div class="md:hidden w-full max-w-full overflow-hidden">
    <div
      bind:this={mobileCarouselEl}
      class="@container w-full max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Client testimonials"
    >
      <div class="grid auto-cols-[100cqw] grid-flow-col">
        {#each testimonials as item, index (item.authorName)}
          {@render carouselSlide(item, index, testimonials.length)}
        {/each}
      </div>
    </div>

    <div class="mt-4 flex justify-center gap-2" role="tablist">
      {#each testimonials as item, index (item.authorName)}
        <button
          type="button"
          role="tab"
          aria-selected={activeIndex === index}
          aria-label="Go to {item.authorName}'s testimonial"
          class="size-2 rounded-full transition-colors {activeIndex === index
            ? 'bg-neutral'
            : 'bg-neutral/30'}"
          onclick={() => scrollToIndex(index)}
        ></button>
      {/each}
    </div>
  </div>

  {#if showDesktopCarousel}
    <div
      class="relative hidden md:block w-full max-w-full overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Client testimonials"
    >
      <div class="px-12">
        <div
          bind:this={desktopCarouselEl}
          class="@container w-full max-w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div
            class="grid auto-cols-[calc((100cqw-4rem)/3)] grid-flow-col gap-8"
          >
            {#each testimonials as item, index (item.authorName)}
              <div class="box-border h-full snap-start" data-desktop-slide-index={index}>
                {@render testimonialCard(item)}
              </div>
            {/each}
          </div>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-circle btn-sm absolute top-1/2 left-1 z-10 -translate-y-1/2 bg-white shadow-md transition-opacity hover:bg-base-100 disabled:pointer-events-none disabled:opacity-30"
        aria-label="Scroll testimonials left"
        disabled={!canScrollLeft}
        onclick={() => scrollDesktopCarousel(-1)}
      >
        <ChevronLeftIcon className="size-5" />
      </button>

      <button
        type="button"
        class="btn btn-circle btn-sm absolute top-1/2 right-1 z-10 -translate-y-1/2 bg-white shadow-md transition-opacity hover:bg-base-100 disabled:pointer-events-none disabled:opacity-30"
        aria-label="Scroll testimonials right"
        disabled={!canScrollRight}
        onclick={() => scrollDesktopCarousel(1)}
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  {:else}
    <div class="hidden md:grid md:grid-cols-3 md:gap-8">
      {#each testimonials as item (item.authorName)}
        {@render testimonialCard(item)}
      {/each}
    </div>
  {/if}
</div>
