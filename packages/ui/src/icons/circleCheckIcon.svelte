<script lang="ts">
  import { cn } from "../utils";

  const { className = "" } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  class={cn(
    "lucide lucide-circle-check-icon lucide-circle-check w-4 h-4 stroke-current fill-none stroke-2",
    className,
  )}
  viewBox="0 0 24 24"
  stroke-linecap="round"
  stroke-linejoin="round"
  ><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg
>
