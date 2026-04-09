<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		appName: string;
		class?: string;
		children?: Snippet;
	}

	let { appName, class: className = '', children }: Props = $props();
</script>

<button
	type="button"
	class={className}
	onclick={() => alert(`Hello from your ${appName} app!`)}
>
	{@render children?.()}
</button>
