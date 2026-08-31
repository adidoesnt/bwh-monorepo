<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { MouseEventHandler } from 'svelte/elements';
	import { cn } from '../utils';

	type Variant = 'primary' | 'secondary' | 'accent' | 'neutral' | 'outline' | 'ghost' | 'link';
	type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

	interface Props {
		variant?: Variant;
		size?: Size;
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		disabled?: boolean;
		class?: string;
		children?: Snippet;
		onclick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
	}

	const variantClasses: Record<Variant, string> = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		accent: 'btn-accent',
		neutral: 'btn-neutral',
		outline: 'btn-outline',
		ghost: 'btn-ghost',
		link: 'btn-link'
	};

	const sizeClasses: Record<Size, string> = {
		xs: 'btn-xs',
		sm: 'btn-sm',
		md: 'btn-md',
		lg: 'btn-lg',
		xl: 'btn-xl'
	};

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		href,
		disabled = false,
		class: className = '',
		children,
		onclick
	}: Props = $props();

	const classes = $derived(cn('btn', variantClasses[variant], sizeClasses[size], className));
</script>

{#if href}
	<a {href} class={classes} aria-disabled={disabled} {onclick}>
		{@render children?.()}
	</a>
{:else}
	<button {type} {disabled} class={classes} {onclick}>
		{@render children?.()}
	</button>
{/if}
