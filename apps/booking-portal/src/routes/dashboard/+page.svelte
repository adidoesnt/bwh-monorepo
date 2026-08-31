<script lang="ts">
	import { Button } from '@repo/ui';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<!-- TODO: Update. This is a placeholder dashboard page -->
<div class="grid h-full w-full place-items-center bg-base-100 p-8">
	<div class="flex flex-col items-center gap-6 text-center">
		<h1 class="font-headings text-base-content text-4xl">welcome, {data.user?.name}.</h1>
		<p class="font-body text-base-content/60">your sessions and packages will live here.</p>

		<form method="POST" action="?/logout">
			<Button type="submit" variant="outline">log out</Button>
		</form>
	</div>
</div>
