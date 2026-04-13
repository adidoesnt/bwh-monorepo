<script lang="ts">
  const pillars = [
    {
      title: "learn",
      subtitle: "blog",
      href: "/blog",
      img: {
        src: "/pillars-learn.jpg",
        alt: "learn",
      },
      description:
        "learn about all things wellness, sustainability, and entrepreneurship!",
    },
    {
      title: "train",
      subtitle: "training",
      href: "/training",
      img: {
        src: "/pillars-training.jpeg",
        alt: "training",
      },
      description:
        "explore our personal training packages to improve strength, conditioning, and mobility!",
    },
    {
      title: "shop",
      subtitle: "activewear",
      href: "/activewear",
      img: {
        src: "/pillars-shop.jpg",
        alt: "activewear",
      },
      description:
        "join our waitlist for updates on our upcoming skin-safe activewear launch!",
    },
  ];
</script>

{#each pillars as pillar}
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
