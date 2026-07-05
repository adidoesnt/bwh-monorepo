<script lang="ts">
  import { slide } from "svelte/transition";
  import { ChevronsDownIcon } from "@repo/ui/icons";
  import { faqCategories } from "../constants/training";

  let openKeys = $state<Record<string, boolean>>({});

  function itemKey(categoryIndex: number, itemIndex: number) {
    return `${categoryIndex}-${itemIndex}`;
  }

  function isOpen(key: string) {
    return !!openKeys[key];
  }

  function toggle(key: string) {
    openKeys = { ...openKeys, [key]: !openKeys[key] };
  }
</script>

<div class="flex w-full max-w-6xl flex-col gap-3">
  {#each faqCategories as category, categoryIndex (category.title)}
    <div class={categoryIndex > 0 ? "mt-8" : ""}>
      <h2 class="font-body text-dark-brown mb-4 text-xl font-bold">
        {category.title}
      </h2>
      <div class="flex flex-col gap-3">
        {#each category.items as item, itemIndex (item.question)}
          {@const key = itemKey(categoryIndex, itemIndex)}
          {@const open = isOpen(key)}
          <div class="overflow-hidden rounded-sm bg-white shadow-md">
            <button
              type="button"
              class="bg-neutral text-neutral-content font-body flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left font-bold"
              aria-expanded={open}
              onclick={() => toggle(key)}
            >
              <span>{item.question}</span>
              <ChevronsDownIcon
                className="size-5 shrink-0 transition-transform duration-300 ease-out {open
                  ? 'rotate-180'
                  : ''}"
              />
            </button>
            {#if open}
              <div transition:slide={{ duration: 300 }}>
                <div class="font-body text-dark-brown p-4 text-base">
                  {@html item.answerHtml}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
