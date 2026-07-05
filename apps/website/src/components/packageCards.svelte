<script lang="ts">
  import { trainingPackages } from "../constants/training";
</script>

{#each trainingPackages as pkg (pkg.title)}
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
{/each}
