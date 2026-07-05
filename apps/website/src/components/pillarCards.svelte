<script lang="ts">
  import type { Pillar } from "../constants/pillars";

  interface Props {
    pillars: Pillar[];
  }

  let { pillars }: Props = $props();
</script>

{#each pillars as pillar (pillar.href)}
  <a href={pillar.href}>
    <div
      class="bg-white flex h-full flex-col gap-4 rounded-sm p-4 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105"
    >
      <h2
        class="font-headings text-dark-brown text-3xl font-bold tracking-wide"
      >
        {pillar.title}
      </h2>
      <div
        class="flex aspect-video items-center justify-center overflow-hidden rounded-sm"
      >
        <img
          src={pillar.img.src}
          alt={pillar.img.alt}
          class="h-full w-full object-cover"
        />
      </div>
      <h3 class="font-body text-dark-brown text-2xl font-bold tracking-wide">
        {pillar.subtitle}
      </h3>
      <hr class="border-dark-brown/60" />
      <p class="font-body text-dark-brown text-base">
        {pillar.description}
      </p>
    </div>
  </a>
{/each}
