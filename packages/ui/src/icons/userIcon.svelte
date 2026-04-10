<script lang="ts">
  import { cn } from "../utils";

  const { className = "" } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  class={cn(
    "lucide lucide-circle-user-icon lucide-circle-user w-4 h-4 stroke-current fill-none stroke-2",
    className,
  )}
  viewBox="0 0 24 24"
  stroke-linecap="round"
  stroke-linejoin="round"
  ><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path
    d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"
  /></svg
>
