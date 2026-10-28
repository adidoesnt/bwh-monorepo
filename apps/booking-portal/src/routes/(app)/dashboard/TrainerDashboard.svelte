<script lang="ts">
	import type { TrainerDashboardData } from './dashboard';

	let { data }: { data: TrainerDashboardData } = $props();
</script>

{#if !data.coach}
	<p class="text-base-content/60 max-w-sm">
		you don't have a coach profile yet — ask an admin to set one up before clients can book you.
	</p>
{/if}
