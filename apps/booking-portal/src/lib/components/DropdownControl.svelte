<script lang="ts">
	import { ChevronsDownIcon, CircleCheckIcon } from '@repo/ui';

	let {
		options,
		current,
		onSelect
	}: {
		options: { value: string; label: string }[];
		current: string;
		onSelect: (value: string) => void;
	} = $props();

	const closeDropdown = (e: Event) => (e.currentTarget as HTMLElement).blur();
</script>

<div class="dropdown">
	<div
		tabindex="0"
		role="button"
		class="btn btn-sm border-base-300 bg-base-100 rounded-field flex items-center gap-1.5 font-normal"
	>
		{options.find((o) => o.value === current)?.label ?? current}
		<ChevronsDownIcon className="h-3 w-3" />
	</div>
	<ul
		tabindex="0"
		role="menu"
		class="dropdown-content menu bg-base-100 border-base-300 z-10 mt-1 w-36 rounded-xl border p-2 shadow-sm"
	>
		{#each options as opt (opt.value)}
			<li role="none">
				<button
					type="button"
					role="menuitem"
					class="flex items-center gap-2"
					onclick={(e) => {
						onSelect(opt.value);
						closeDropdown(e);
					}}
				>
					{#if opt.value === current}
						<CircleCheckIcon className="h-3 w-3" />
					{/if}
					{opt.label}
				</button>
			</li>
		{/each}
	</ul>
</div>
