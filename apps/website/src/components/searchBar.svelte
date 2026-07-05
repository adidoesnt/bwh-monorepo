<script lang="ts">
  import { SearchIcon } from "@repo/ui/icons";
  import {
    hasSearchResults,
    searchSite,
    type SiteSearchSources,
  } from "../utils/siteSearch";

  interface Props {
    searchSources?: SiteSearchSources;
  }

  let { searchSources = {} }: Props = $props();

  let searchTerm = $state("");
  let debounceTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let debouncedSearchTerm = $state("");
  let isFocused = $state(false);

  let resultGroups = $derived(searchSite(debouncedSearchTerm, searchSources));

  let showDropdown = $derived(
    isFocused && debouncedSearchTerm.trim().length > 0,
  );

  function updateSearchTerm(value: string) {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    searchTerm = value;
    debounceTimeout = setTimeout(() => {
      debouncedSearchTerm = value;
    }, 300);
  }
</script>

<div class="relative flex w-max max-w-xs items-center gap-1">
  <input
    class="input input-bordered bg-white rounded-sm input-sm w-60 md:w-80"
    type="search"
    value={searchTerm}
    oninput={(event) =>
      updateSearchTerm((event.currentTarget as HTMLInputElement).value)}
    onfocus={() => (isFocused = true)}
    onblur={() => {
      setTimeout(() => {
        isFocused = false;
      }, 150);
    }}
    placeholder="search"
    aria-label="Search"
  />
  <button class="btn btn-sm btn-ghost aspect-square p-1" type="button">
    <SearchIcon className="size-5" />
  </button>

  {#if showDropdown}
    <div
      class="bg-white absolute top-full left-0 z-50 mt-2 min-w-full w-max max-w-sm overflow-hidden rounded-sm shadow-lg"
    >
      {#if !hasSearchResults(resultGroups)}
        <p class="font-body text-dark-brown/70 px-4 py-3 text-sm">
          no results
        </p>
      {:else}
        {#each resultGroups as group (group.id)}
          <section class="border-dark-brown/10 border-b last:border-b-0">
            <h2
              class="font-headings text-dark-brown bg-beige/50 px-4 py-2.5 text-base font-bold tracking-wide md:text-lg"
            >
              results from {group.label}
            </h2>
            <hr class="border-dark-brown/15" />
            <ul>
              {#each group.results as result (result.id)}
                <li>
                  <a
                    href={result.href}
                    class="font-body text-dark-brown hover:bg-beige block px-4 py-3 text-sm transition-colors"
                  >
                    <span class="font-bold">{result.title}</span>
                    <span class="text-dark-brown/70 block line-clamp-1">
                      {result.description}
                    </span>
                  </a>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      {/if}
    </div>
  {/if}
</div>
