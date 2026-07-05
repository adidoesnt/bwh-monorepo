<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import type { NavLink } from "../constants/navLinks";
  import {
    CartIcon,
    DumbbellIcon,
    MenuIcon,
    XIcon,
  } from "@repo/ui/icons";

  interface Props {
    navLinks: NavLink[];
    shopEnabled: boolean;
    ptEnabled: boolean;
    shopUrl: string;
    ptUrl: string;
  }

  let { navLinks, shopEnabled, ptEnabled, shopUrl, ptUrl }: Props = $props();

  let isOpen = $state(false);

  const open = () => {
    isOpen = true;
  };

  const close = () => {
    isOpen = false;
  };

  const handleInternalNavClick = (event: MouseEvent, href: string) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    const destination = new URL(href, window.location.origin);

    if (destination.origin !== window.location.origin) {
      return;
    }

    if (destination.pathname === window.location.pathname) {
      event.preventDefault();
      close();
    }
  };

  $effect(() => {
    const handlePageLoad = () => {
      close();
    };

    document.addEventListener("astro:page-load", handlePageLoad);
    return () => document.removeEventListener("astro:page-load", handlePageLoad);
  });

  $effect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<button
  type="button"
  class="md:hidden flex btn btn-ghost aspect-square p-1"
  aria-expanded={isOpen}
  aria-controls="mobile-menu-drawer"
  aria-label={isOpen ? "Close menu" : "Open menu"}
  onclick={() => (isOpen ? close() : open())}
>
  <MenuIcon className="md:size-6" />
</button>

{#if isOpen}
  <div class="fixed inset-0 z-60 md:hidden" role="presentation">
    <button
      type="button"
      class="absolute inset-0 bg-black/20"
      aria-label="Close menu"
      onclick={close}
      transition:fade={{ duration: 200 }}
    ></button>

    <div
      id="mobile-menu-drawer"
      class="absolute right-0 top-0 flex h-full w-full flex-col bg-[url(/landing-page-hero.png)] bg-cover bg-center"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
      transition:fly={{ x: "100%", duration: 300 }}
    >
      <button
        type="button"
        class="btn btn-ghost absolute right-4 top-4 z-10 aspect-square p-1 text-dark-brown"
        aria-label="Close menu"
        onclick={close}
      >
        <XIcon className="size-6" />
      </button>

      <div class="flex flex-1 items-center justify-center p-6">
        <div
          class="bg-white rounded-sm p-6 shadow-md flex w-full max-w-sm flex-col items-center gap-6"
        >
          <a
            href="/"
            class="font-headings text-2xl font-bold text-dark-brown"
            onclick={(event) => handleInternalNavClick(event, "/")}
          >
            built<span class="text-primary">with</span>habit
          </a>

          <nav aria-label="Site navigation" class="w-full">
            <ul
              class="flex flex-col items-center gap-4 font-body lowercase text-lg text-dark-brown"
            >
              {#each navLinks as link (link.href)}
                <li>
                  <a
                    class="hover:opacity-80 block text-center"
                    href={link.href}
                    onclick={(event) => handleInternalNavClick(event, link.href)}
                  >
                    {link.label}
                  </a>
                </li>
              {/each}
            </ul>
          </nav>
        </div>
      </div>

      {#if shopEnabled || ptEnabled}
        <div class="flex justify-center gap-2 p-6 pt-0">
          {#if shopEnabled}
            <a
              href={shopUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost aspect-square p-1 text-dark-brown"
              aria-label="Shop"
              onclick={close}
            >
              <CartIcon className="size-6" />
            </a>
          {/if}
          {#if ptEnabled}
            <a
              href={ptUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-ghost aspect-square p-1 text-dark-brown"
              aria-label="Personal training portal"
              onclick={close}
            >
              <DumbbellIcon className="size-6" />
            </a>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
