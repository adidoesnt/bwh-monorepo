<script lang="ts">
  import { cn } from "../utils";

  const { className = "" } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  class={cn(
    "lucide lucide-menu-icon lucide-menu w-4 h-4 stroke-current fill-none stroke-2",
    className,
  )}
  stroke-linecap="round"
  stroke-linejoin="round"
  ><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" /></svg
>
