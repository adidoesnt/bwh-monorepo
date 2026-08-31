<script lang="ts">
	import { page } from '$app/state';
	import type { NavItem } from '$lib/nav';

	interface Props {
		nav: NavItem[];
		roleLabel: string;
		sidebarNote: { title: string; body: string } | null;
		/** Called when a nav link is followed, so the mobile drawer can close. */
		onNavigate?: () => void;
	}

	let { nav, roleLabel, sidebarNote, onNavigate }: Props = $props();

	const isActive = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<div class="bg-base-200 border-base-300 flex h-full w-64 flex-col gap-8 border-r p-4">
	<div class="flex items-center gap-3 px-2 pt-2">
		<div
			class="bg-neutral text-neutral-content grid h-8 w-8 place-items-center rounded-field font-headings text-sm"
		>
			b
		</div>
		<div class="leading-tight">
			<div class="text-sm font-semibold">builtwithhabit</div>
			<div class="text-base-content/50 font-body text-xs">{roleLabel}</div>
		</div>
	</div>

	<nav class="flex flex-col gap-1">
		{#each nav as item (item.id)}
			{#if item.enabled}
				<a
					href={item.href}
					onclick={onNavigate}
					aria-current={isActive(item.href) ? 'page' : undefined}
					class="hover:bg-base-300 flex items-center justify-between gap-2 rounded-field px-3 py-2.5 text-sm transition-colors
						{isActive(item.href) ? 'bg-base-300 text-base-content font-medium' : 'text-base-content/70'}"
				>
					<span>{item.label}</span>
					{#if item.badge}
						<span class="badge badge-sm badge-ghost font-body">{item.badge}</span>
					{/if}
				</a>
			{:else}
				<span
					aria-disabled="true"
					title="coming soon"
					class="text-base-content/35 flex cursor-not-allowed items-center justify-between gap-2 rounded-field px-3 py-2.5 text-sm"
				>
					<span>{item.label}</span>
					{#if item.badge}
						<span class="badge badge-sm badge-ghost font-body opacity-60">{item.badge}</span>
					{/if}
				</span>
			{/if}
		{/each}
	</nav>

	<div class="mt-auto flex flex-col gap-3">
		{#if sidebarNote}
			<div class="bg-error/30 text-error-content rounded-sm p-3.5 text-sm leading-snug">
				<strong class="mb-1 block font-medium">{sidebarNote.title}</strong>
				{sidebarNote.body}
			</div>
		{/if}
		<form method="POST" action="/logout">
			<button
				type="submit"
				class="border-base-300 text-base-content/80 hover:text-base-content w-full rounded-field border px-3 py-2.5 text-sm transition-colors"
			>
				log out
			</button>
		</form>
	</div>
</div>
