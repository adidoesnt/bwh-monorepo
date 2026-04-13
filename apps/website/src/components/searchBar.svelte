<script lang="ts">
  import { SearchIcon } from "@repo/ui/icons"

  let searchTerm = $state("");
  let debounceTimeout = $state<NodeJS.Timeout | null>(null);
  let debouncedSearchTerm = $state("");

  let searchResults = $derived.by(() => {
    console.log(`Searching for ${debouncedSearchTerm}`);
    // TODO: Implement site-wide search
    return [];
  });
</script>

<div class="flex items-center gap-3">
  <input
    class="input input-bordered bg-white rounded-sm input-sm w-full"
    type="text"
    bind:value={
      () => searchTerm,
      (value: string) => {
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }

        debounceTimeout = setTimeout(() => {
          debouncedSearchTerm = value;
        }, 500);
        searchTerm = value;
      }
    }
    placeholder="search"
  />
  <button class="btn btn-sm btn-ghost aspect-square p-1">
    <SearchIcon className="size-5" />
  </button>
</div>
