<script lang="ts">
	import { MenuIcon } from '@repo/ui';
	import { Sidebar } from '$lib/components';
	import { toast } from '$lib/toast.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let drawerOpen = $state(false);
</script>

<!-- The whole product uses lowercase; `uppercase` on leaf elements still wins. -->
<div class="drawer lg:drawer-open h-dvh lowercase">
	<input id="app-drawer" type="checkbox" class="drawer-toggle" bind:checked={drawerOpen} />

	<div class="drawer-content flex h-dvh flex-col">
		<header
			class="border-base-300 bg-base-200 flex items-center gap-3 border-b px-4 py-2.5 lg:hidden"
		>
			<label for="app-drawer" class="btn btn-ghost btn-sm btn-square" aria-label="open navigation">
				<MenuIcon />
			</label>
			<span class="font-headings text-lg">builtwithhabit</span>
		</header>

		<main class="bg-base-200 flex-1 overflow-y-auto">
			{@render children()}
		</main>

		{#if toast.current}
			{#key toast.current.id}
				<div class="toast toast-top toast-center z-50 w-full md:toast-end md:w-auto">
					<div
						class="alert {toast.current.variant === 'error'
							? 'alert-error'
							: 'alert-success'} w-full rounded-2xl md:w-auto"
					>
						<span>{toast.current.message}</span>
					</div>
				</div>
			{/key}
		{/if}
	</div>

	<div class="drawer-side z-20">
		<label for="app-drawer" class="drawer-overlay" aria-label="close navigation"></label>
		<Sidebar
			nav={data.nav}
			roleLabel={data.roleLabel}
			sidebarNote={data.sidebarNote}
			onNavigate={() => (drawerOpen = false)}
		/>
	</div>
</div>
