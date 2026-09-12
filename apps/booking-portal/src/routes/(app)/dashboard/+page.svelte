<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const firstName = $derived(data.user.name.split(' ')[0] ?? data.user.name);
</script>

<div class="mx-auto max-w-5xl p-6 md:p-10">
	<div class="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
		<h1 class="font-headings text-3xl">welcome, {firstName}.</h1>
		<p class="text-base-content/60 max-w-sm">
			the {data.user.role} portal is coming soon — your tools will live here.
		</p>
	</div>
</div>
