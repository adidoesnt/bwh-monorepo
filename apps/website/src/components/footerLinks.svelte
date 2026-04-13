<script lang="ts">
  export const links = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/blog", label: "Blog" },
    { href: "/training", label: "Training" },
    { href: "/activewear", label: "Activewear" },
    { href: "/contact", label: "Contact Us" },
  ];
</script>

<div class="flex flex-col">
  <h3 class="font-headings mb-4 text-lg font-semibold md:text-2xl">
    Quick Links
  </h3>
  <ul class="font-body flex flex-col space-y-2 text-sm md:text-base">
    {#each links as route}
      <li class="flex items-center">
        <a href={route.href} class="hover:text-light-brown transition-colors">
          {route.label}
        </a>
      </li>
    {/each}
  </ul>
</div>
