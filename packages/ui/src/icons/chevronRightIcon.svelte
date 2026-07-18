<script lang="ts">
  import { cn } from "../utils";

  const { className = "" } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  class={cn(
    "lucide lucide-chevron-right-icon lucide-chevron-right w-4 h-4 stroke-current fill-none stroke-2",
    className,
  )}
  viewBox="0 0 24 24"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m9 18 6-6-6-6" />
</svg>
