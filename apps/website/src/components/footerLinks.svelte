<script lang="ts">
  import type { NavLink } from "../constants/navLinks";

  interface Props {
    links: NavLink[];
  }

  let { links }: Props = $props();
</script>

<div class="flex flex-col">
  <h3 class="font-headings mb-4 text-lg font-semibold md:text-2xl">
    Quick Links
  </h3>
  <ul class="font-body flex flex-col space-y-2 text-sm md:text-base">
    {#each links as route (route.href)}
      <li class="flex items-center">
        <a href={route.href} class="hover:text-light-brown transition-colors">
          {route.label}
        </a>
      </li>
    {/each}
  </ul>
</div>
