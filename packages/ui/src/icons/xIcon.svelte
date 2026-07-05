<script lang="ts">
  import { cn } from "../utils";

  const { className = "" } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  stroke-linecap="round"
  stroke-linejoin="round"
  class={cn(
    "lucide lucide-x-icon lucide-x w-4 h-4 stroke-current fill-none stroke-2",
    className,
  )}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
>
